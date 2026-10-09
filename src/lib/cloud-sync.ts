/**
 * Cloud sync for the platform's shared stores.
 *
 * Every store keeps its fast local copy, but each whitelisted key is mirrored
 * to the backend item by item (one row per notification, plan, message…), so
 * what one user does reaches every other user on any browser or device.
 *
 *  - Local writes are diffed against the last synced copy and only changed
 *    items are pushed (removed items become tombstones).
 *  - Remote changes are polled and merged item by item into the local copy,
 *    then the owning store is told to re-read.
 *  - Notifications carry their recipient as the row audience, so each user can
 *    only read alerts addressed to them (admins see the Loqal queue).
 */
import { supabase } from "@/integrations/supabase/client";

export const CLOUD_KEYS = [
  "loqal.leads.v1",
  "loqal.entityStructure.v1",
  "loqal.propertyRequests.v1",
  "loqal.buyer-process.v1",
  "loqal.fileChat.v1",
  "loqal.chat.v1",
  "loqal.notifications.v1",
  "loqal.notifications.read.v1",
  "loqal.activity.v1",
  "loqal.accounting.v1",
  "loqal.loanSubmissions.v1",
  "loqal.partnerHandovers.v1",
  "loqal.realtors.v2",
  "loqal.staff.v1",
  "loqal.directory.v1",
  "loqal.lender.team.v2",
  "loqal.lender.banks.v1",
  "loqal.getStarted.v1",
  "loqal.entityIntent.v1",
  "loqal.mortgage.drafts.v1",
  "loqal.buyerAgentDrafts.v1",
  "loqal.document.requests.staged.v1",
  "loqal.document.requests.firstseen.v1",
  "loqal.upload-drafts.v1",
  "loqal.licence-files.v1",
] as const;
const KEYS = new Set<string>(CLOUD_KEYS);

type Row = { data: unknown; pos: number; audience: string | null };

/* ---------- who may see each record ---------- */

/** Directory-style data every signed-in user may read. */
const PUBLIC_STORES = new Set(["loqal.realtors.v2", "loqal.staff.v1", "loqal.directory.v1", "loqal.lender.team.v2"]);
/** Stores whose items belong to one client file (lead). */
const LEAD_STORES = new Set([
  "loqal.leads.v1",
  "loqal.entityStructure.v1",
  "loqal.propertyRequests.v1",
  "loqal.buyer-process.v1",
  "loqal.fileChat.v1",
  "loqal.loanSubmissions.v1",
  "loqal.partnerHandovers.v1",
  "loqal.accounting.v1",
]);

type LeadLite = { id: string; clientEmail?: string; propertyLabel?: string; lenderPartnerId?: string; buyerAgent?: { agentId?: string } };

function leadIdOf(store: string, key: string, data: unknown): string | null {
  if (isObj(data)) {
    const l = data["leadId"];
    if (typeof l === "string") return l;
    if (store === "loqal.leads.v1" && typeof data["id"] === "string") return data["id"] as string;
  }
  const at = key.indexOf("{}");
  return at >= 0 ? key.slice(at + 2) : null;
}

/**
 * Who may see a record. File records resolve to the file's client, buyer's
 * agent and lender (same answer on every device); notifications to their
 * recipient. Anything else keeps whoever it already belongs to, or the writer
 * for a new record (Loqal admins always see everything).
 */
function participantsFor(store: string, key: string, data: unknown): string[] | null {
  if (PUBLIC_STORES.has(store)) return null;
  const prev = prevParts.get(`${store}\u0000${key}`);
  const own = () => (prev !== undefined ? prev : me ? [me] : null);
  if (store === "loqal.notifications.v1") {
    const to = audienceOf(data);
    return to ? [to] : own();
  }
  const out = new Set<string>();
  if (LEAD_STORES.has(store)) {
    const id = leadIdOf(store, key, data);
    const leads = readLocal("loqal.leads.v1");
    const lead = id && Array.isArray(leads) ? (leads as LeadLite[]).find((l) => l?.id === id) : undefined;
    if (lead) {
      if (lead.clientEmail) out.add(lead.clientEmail.toLowerCase());
      if (lead.buyerAgent?.agentId) out.add(`partner:${lead.buyerAgent.agentId}`);
      if (lead.lenderPartnerId) out.add(`partner:${lead.lenderPartnerId}`);
      else {
        const st = lead.propertyLabel?.match(/\b([A-Z]{2})\b\s*$/)?.[1];
        if (st) out.add(`lenderstate:${st}`);
      }
      return [...out].sort();
    }
  }
  return own();
}
/** Participants last seen on the server for each record. */
const prevParts = new Map<string, string[] | null>();
type Flat = Map<string, Row>;

const appliers = new Map<string, Set<() => void>>();
/** A store re-reads its local copy when remote changes arrive. */
export function registerCloudStore(key: string, apply: () => void) {
  const set = appliers.get(key) ?? new Set();
  set.add(apply);
  appliers.set(key, set);
  return () => {
    set.delete(apply);
  };
}

/* ---------- flatten / merge ---------- */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function idOf(el: unknown): string | null {
  if (typeof el === "string" || typeof el === "number") return `s:${el}`;
  if (!isObj(el)) return null;
  const id = el["id"] ?? el["leadId"];
  return typeof id === "string" || typeof id === "number" ? `i:${id}` : null;
}
function audienceOf(el: unknown): string | null {
  if (!isObj(el)) return null;
  const to = el["to"];
  return typeof to === "string" && to ? to.toLowerCase() : null;
}
function itemized(arr: unknown[]) {
  return arr.every((el) => idOf(el) !== null);
}

function flattenArray(prefix: string, arr: unknown[], out: Flat) {
  if (!itemized(arr)) {
    out.set(prefix, { data: arr, pos: 0, audience: null });
    return;
  }
  arr.forEach((el, i) => out.set(`${prefix}[]${idOf(el)}`, { data: el, pos: i, audience: audienceOf(el) }));
}

function flatten(value: unknown): Flat {
  const out: Flat = new Map();
  if (Array.isArray(value)) flattenArray("", value, out);
  else if (isObj(value)) {
    for (const [f, v] of Object.entries(value)) {
      if (f.includes("[]") || f.includes("{}")) {
        out.set(`=${f}`, { data: v, pos: 0, audience: null });
      } else if (Array.isArray(v)) flattenArray(f, v, out);
      else if (isObj(v))
        for (const [k, x] of Object.entries(v)) out.set(`${f}{}${k}`, { data: x, pos: 0, audience: audienceOf(x) });
      else out.set(f, { data: v, pos: 0, audience: null });
    }
  } else if (value !== undefined) out.set("", { data: value, pos: 0, audience: null });
  return out;
}

function applyRow(base: unknown, key: string, row: Row | null): unknown {
  if (key === "") return row ? row.data : base;
  const arrAt = key.indexOf("[]");
  const mapAt = key.indexOf("{}");
  const upsertArr = (arr: unknown[], id: string) => {
    const next = arr.filter((el) => idOf(el) !== id);
    if (!row) return next;
    const at = arr.findIndex((el) => idOf(el) === id);
    next.splice(at >= 0 ? at : Math.min(row.pos, next.length), 0, row.data);
    return next;
  };
  if (arrAt === 0) return upsertArr(Array.isArray(base) ? base : [], key.slice(2));
  const obj: Record<string, unknown> = isObj(base) ? { ...base } : {};
  if (key.startsWith("=")) {
    if (row) obj[key.slice(1)] = row.data;
    else delete obj[key.slice(1)];
  } else if (arrAt > 0 && (mapAt < 0 || arrAt < mapAt)) {
    const f = key.slice(0, arrAt);
    obj[f] = upsertArr(Array.isArray(obj[f]) ? (obj[f] as unknown[]) : [], key.slice(arrAt + 2));
  } else if (mapAt > 0) {
    const f = key.slice(0, mapAt);
    const m: Record<string, unknown> = isObj(obj[f]) ? { ...(obj[f] as Record<string, unknown>) } : {};
    if (row) m[key.slice(mapAt + 2)] = row.data;
    else delete m[key.slice(mapAt + 2)];
    obj[f] = m;
  } else if (row) obj[key] = row.data;
  else delete obj[key];
  return obj;
}

/* ---------- local storage access ---------- */

let rawSet: ((k: string, v: string) => void) | null = null;
function readLocal(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    (rawSet ?? ((k, v) => window.localStorage.setItem(k, v)))(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
  appliers.get(key)?.forEach((fn) => fn());
}

/* ---------- sync engine ---------- */

const baseline = new Map<string, Map<string, string>>();
const dirty = new Set<string>();
let me = "";
let ready = false;
let cursor = "1970-01-01T00:00:00Z";
let timer: ReturnType<typeof setTimeout> | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let session = 0;

const json = (r: Row, p?: string[] | null) => JSON.stringify([r.data, r.audience, p ?? null]);

function schedulePush() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void pushDirty(), 300);
}

async function pushDirty() {
  if (!ready) return;
  const keys = [...dirty];
  dirty.clear();
  const rows: Record<string, unknown>[] = [];
  for (const store of keys) {
    const base = baseline.get(store) ?? new Map<string, string>();
    baseline.set(store, base);
    const flat = flatten(readLocal(store));
    for (const [k, r] of flat) {
      const parts = participantsFor(store, k, r.data);
      const s = json(r, parts);
      if (base.get(k) === s) continue;
      base.set(k, s);
      prevParts.set(`${store}\u0000${k}`, parts);
      rows.push({ store, key: k, data: r.data, pos: r.pos, deleted: false, audience: r.audience ?? "", participants: parts });
    }
    for (const k of [...base.keys()])
      if (!flat.has(k)) {
        base.delete(k);
        rows.push({ store, key: k, data: null, pos: 0, deleted: true, audience: "" });
      }
  }
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.rpc("put_shared_records", { _rows: batch as never });
    if (error) {
      // Forget these rows so the next pass sends them again.
      for (const r of batch) baseline.get(r["store"] as string)?.set(r["key"] as string, "__retry");
      for (const r of batch) dirty.add(r["store"] as string);
      setTimeout(schedulePush, 5000);
      return;
    }
  }
}

type DbRow = { store: string; item_key: string; data: unknown; pos: number; deleted: boolean; audience: string | null; participants: string[] | null; updated_at: string };

async function fetchSince(since: string): Promise<DbRow[] | null> {
  const out: DbRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("shared_records")
      .select("store,item_key,data,pos,deleted,audience,participants,updated_at")
      .gt("updated_at", since)
      .order("updated_at", { ascending: true })
      .range(from, from + 999);
    if (error) return null;
    out.push(...((data ?? []) as DbRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function mergeRemote(rows: DbRow[], initial: boolean) {
  const byStore = new Map<string, DbRow[]>();
  for (const r of rows) {
    if (!KEYS.has(r.store)) continue;
    if (r.updated_at > cursor) cursor = r.updated_at;
    byStore.set(r.store, [...(byStore.get(r.store) ?? []), r]);
  }
  const touched = initial ? new Set<string>(CLOUD_KEYS) : new Set(byStore.keys());
  for (const store of touched) {
    const base = baseline.get(store) ?? new Map<string, string>();
    baseline.set(store, base);
    let value = readLocal(store);
    const before = JSON.stringify(value);
    const remoteKeys = new Set<string>();
    for (const r of byStore.get(store) ?? []) {
      remoteKeys.add(r.item_key);
      if (r.deleted) {
        if (!base.has(r.item_key) && !initial) continue;
        base.delete(r.item_key);
        value = applyRow(value, r.item_key, null);
        continue;
      }
      const row: Row = { data: r.data, pos: r.pos, audience: r.audience };
      prevParts.set(`${store}\u0000${r.item_key}`, r.participants);
      const s = json(row, r.participants);
      if (base.get(r.item_key) === s) continue;
      base.set(r.item_key, s);
      value = applyRow(value, r.item_key, row);
    }
    if (initial) {
      /* Items addressed to someone else that this browser created are already
         on the server — treat them as synced instead of re-sending stale copies. */
      for (const [k, r] of flatten(value))
        if (!remoteKeys.has(k) && r.audience && r.audience !== me && r.audience !== "admins")
          base.set(k, json(r, participantsFor(store, k, r.data)));
      dirty.add(store);
    }
    if (value !== undefined && JSON.stringify(value) !== before) writeLocal(store, value);
  }
}

async function start(email: string) {
  const mine = ++session;
  me = email.toLowerCase();
  ready = false;
  baseline.clear();
  prevParts.clear();
  cursor = "1970-01-01T00:00:00Z";
  const rows = await fetchSince(cursor);
  if (mine !== session || !rows) return;
  mergeRemote(rows, true);
  ready = true;
  schedulePush();
  if (poll) clearInterval(poll);
  poll = setInterval(async () => {
    if (!ready || document.hidden) return;
    const since = new Date(new Date(cursor).getTime() - 5000).toISOString();
    const r = await fetchSince(since);
    if (mine === session && r) mergeRemote(r, false);
  }, 4000);
}

function stop() {
  session++;
  ready = false;
  if (poll) clearInterval(poll);
  poll = null;
}

let installed = false;
/** Call once in the browser (root layout). */
export function startCloudSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const proto = Object.getPrototypeOf(window.localStorage) as Storage;
  const original = proto.setItem;
  rawSet = (k, v) => original.call(window.localStorage, k, v);
  proto.setItem = function (this: Storage, k: string, v: string) {
    original.call(this, k, v);
    if (this === window.localStorage && KEYS.has(k)) {
      dirty.add(k);
      // A file's client/partners changed — re-check who may see its records.
      if (k === "loqal.leads.v1") LEAD_STORES.forEach((s) => dirty.add(s));
      schedulePush();
    }
  };
  const onSession = (email: string | undefined) => {
    if (email && email.toLowerCase() !== me) void start(email);
    else if (!email) {
      stop();
      me = "";
    }
  };
  void supabase.auth.getSession().then(({ data }) => onSession(data.session?.user.email));
  supabase.auth.onAuthStateChange((event, s) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION")
      onSession(s?.user.email);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && ready) void fetchSince(new Date(new Date(cursor).getTime() - 5000).toISOString()).then((r) => r && mergeRemote(r, false));
  });
}
