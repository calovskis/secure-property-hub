/**
 * Admin account maintenance. Thin server-function wrappers only — every
 * privileged import happens inside the handler, after the caller has been
 * verified as a Loqal admin through the `has_role` check.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminAccountInfo = {
  exists: boolean;
  userId?: string;
  email?: string;
  lastSignInAt?: string | null;
  createdAt?: string | null;
  emailConfirmed?: boolean;
};

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const supabase = context.supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data } = await supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Forbidden");
}

async function findUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Does this person have a login, and when were they last authenticated? */
export const getAccountInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }): Promise<AdminAccountInfo> => {
    await assertAdmin(context);
    const user = await findUserByEmail(data.email);
    if (!user) return { exists: false };
    return {
      exists: true,
      userId: user.id,
      email: user.email ?? data.email,
      lastSignInAt: user.last_sign_in_at ?? null,
      createdAt: user.created_at ?? null,
      emailConfirmed: Boolean(user.email_confirmed_at),
    };
  });

/** Sets a new password directly on the account. */
export const setAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters.");
    const user = await findUserByEmail(data.email);
    if (!user) throw new Error("No login exists for this e-mail yet.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends the person a password-reset e-mail. */
export const requestPasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; redirectTo: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
