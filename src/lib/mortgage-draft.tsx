/**
 * Draft autosave + incomplete-questionnaire reminders for the mortgage
 * pre-approval flow. Answers are saved every time the applicant moves to the
 * next step (and on edit), so they can leave and come back.
 *
 * Reminder cadence after the draft was last touched:
 *   3 hours  → in-platform notification only
 *   2 days   → in-platform + email
 *   7 days   → in-platform + email
 *   14 days  → in-platform + email
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

export type ReminderChannel = "in_app" | "in_app_email";

export type ReminderTier = {
  id: string;
  label: string;
  afterMs: number;
  channel: ReminderChannel;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const REMINDER_TIERS: ReminderTier[] = [
  { id: "3h", label: "3 hours", afterMs: 3 * HOUR, channel: "in_app" },
  { id: "2d", label: "2 days", afterMs: 2 * DAY, channel: "in_app_email" },
  { id: "7d", label: "7 days", afterMs: 7 * DAY, channel: "in_app_email" },
  { id: "14d", label: "2 weeks", afterMs: 14 * DAY, channel: "in_app_email" },
];

export type MortgageDraft = {
  /** Property the draft belongs to (0 = generic profile draft). */
  propertyId: number;
  propertyLabel?: string;
  step: number;
  /** Highest step the applicant has reached. */
  furthestStep: number;
  data: Record<string, unknown>;
  updatedAt: string;
  /** Percentage of required sections completed. */
  completion: number;
  remindersSent: string[];
  submitted: boolean;
};

export type ReminderLogEntry = {
  id: string;
  email: string;
  tierId: string;
  channel: ReminderChannel;
  propertyLabel?: string;
  sentAt: string;
  read: boolean;
};

type DraftState = { drafts: Record<string, MortgageDraft>; reminders: ReminderLogEntry[] };

const STORAGE_KEY = "loqal.mortgage.drafts.v1";
const emptyState: DraftState = { drafts: {}, reminders: [] };

const keyFor = (email: string, propertyId: number) => `${email.toLowerCase()}::${propertyId}`;

type DraftContextValue = {
  ready: boolean;
  getDraft: (email: string, propertyId: number) => MortgageDraft | undefined;
  drafts: (email: string) => MortgageDraft[];
  saveDraft: (
    email: string,
    draft: Omit<MortgageDraft, "updatedAt" | "remindersSent" | "submitted"> &
      Partial<Pick<MortgageDraft, "submitted">>,
  ) => void;
  clearDraft: (email: string, propertyId: number) => void;
  reminders: (email: string) => ReminderLogEntry[];
  unreadCount: (email: string) => number;
  markRemindersRead: (email: string) => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function MortgageDraftProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DraftState>(emptyState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...emptyState, ...(JSON.parse(raw) as DraftState) });
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: DraftState) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  /** Fire any reminder tiers that came due for unfinished drafts. */
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      setState((prev) => {
        const now = Date.now();
        const newReminders: ReminderLogEntry[] = [];
        const drafts = { ...prev.drafts };
        let changed = false;

        for (const [key, draft] of Object.entries(prev.drafts)) {
          if (draft.submitted || draft.completion >= 100) continue;
          const email = key.split("::")[0] ?? "";
          const age = now - new Date(draft.updatedAt).getTime();
          for (const tier of REMINDER_TIERS) {
            if (age < tier.afterMs || draft.remindersSent.includes(tier.id)) continue;
            changed = true;
            drafts[key] = { ...drafts[key]!, remindersSent: [...draft.remindersSent, tier.id] };
            newReminders.push({
              id: `${key}-${tier.id}`,
              email,
              tierId: tier.id,
              channel: tier.channel,
              ...(draft.propertyLabel ? { propertyLabel: draft.propertyLabel } : {}),
              sentAt: new Date().toISOString(),
              read: false,
            });
          }
        }
        if (!changed) return prev;

        const next: DraftState = { drafts, reminders: [...newReminders, ...prev.reminders] };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        newReminders.forEach((r) =>
          toast("Your pre-approval application is incomplete", {
            description: `Pick up where you left off${
              r.propertyLabel ? ` on ${r.propertyLabel}` : ""
            }.${r.channel === "in_app_email" ? " A reminder email was also sent." : ""}`,
          }),
        );
        return next;
      });
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [ready]);

  const value = useMemo<DraftContextValue>(
    () => ({
      ready,
      getDraft: (email, propertyId) => state.drafts[keyFor(email, propertyId)],
      drafts: (email) =>
        Object.entries(state.drafts)
          .filter(([k]) => k.startsWith(`${email.toLowerCase()}::`))
          .map(([, d]) => d)
          .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
      saveDraft: (email, draft) => {
        const key = keyFor(email, draft.propertyId);
        const prev = state.drafts[key];
        persist({
          ...state,
          drafts: {
            ...state.drafts,
            [key]: {
              ...draft,
              submitted: draft.submitted ?? false,
              updatedAt: new Date().toISOString(),
              // touching the draft restarts the reminder ladder
              remindersSent: prev && prev.completion === draft.completion ? prev.remindersSent : [],
            },
          },
        });
      },
      clearDraft: (email, propertyId) => {
        const next = { ...state.drafts };
        delete next[keyFor(email, propertyId)];
        persist({ ...state, drafts: next });
      },
      reminders: (email) =>
        state.reminders.filter((r) => r.email === email.toLowerCase()),
      unreadCount: (email) =>
        state.reminders.filter((r) => r.email === email.toLowerCase() && !r.read).length,
      markRemindersRead: (email) =>
        persist({
          ...state,
          reminders: state.reminders.map((r) =>
            r.email === email.toLowerCase() ? { ...r, read: true } : r,
          ),
        }),
    }),
    [state, ready, persist],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useMortgageDrafts() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useMortgageDrafts must be used inside <MortgageDraftProvider>");
  return ctx;
}
