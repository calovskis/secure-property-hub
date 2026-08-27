/**
 * Server-only storage for each app user's Google connection key.
 * Rows are written and read with the service-role client; the encrypted
 * handle never leaves the server.
 */
import { decryptConnectionKey, encryptConnectionKey } from "@/server/connectionKeyCrypto";

export type StoredConnection = {
  connectionAPIKey: string;
  accountEmail: string | null;
  agentRef: string | null;
};

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
  meta?: { agentRef?: string | null; agentEmail?: string | null; accountEmail?: string | null },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      agent_ref: meta?.agentRef ?? null,
      agent_email: meta?.agentEmail?.toLowerCase() ?? null,
      account_email: meta?.accountEmail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionForUser(
  userId: string,
  connectorId: string,
): Promise<StoredConnection | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connections")
    .select("connection_key_ciphertext, account_email, agent_ref")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    connectionAPIKey: decryptConnectionKey(data.connection_key_ciphertext),
    accountEmail: data.account_email,
    agentRef: data.agent_ref,
  };
}

export async function getConnectionKeyForUser(userId: string, connectorId: string) {
  return (await getConnectionForUser(userId, connectorId))?.connectionAPIKey ?? null;
}

/**
 * Look up a Loqal buyer's agent connection by their agent id or e-mail, so a
 * client can see that agent's real availability and book into their calendar.
 */
export async function getConnectionForAgent(
  connectorId: string,
  agent: { agentRef?: string | undefined; agentEmail?: string | undefined },
): Promise<StoredConnection | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("app_user_connections")
    .select("connection_key_ciphertext, account_email, agent_ref")
    .eq("connector_id", connectorId)
    .limit(1);
  if (agent.agentRef) query = query.eq("agent_ref", agent.agentRef);
  else if (agent.agentEmail) query = query.eq("agent_email", agent.agentEmail.toLowerCase());
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    connectionAPIKey: decryptConnectionKey(data.connection_key_ciphertext),
    accountEmail: data.account_email,
    agentRef: data.agent_ref,
  };
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
  if (error) throw error;
}
