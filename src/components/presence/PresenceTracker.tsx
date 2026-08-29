/**
 * Records how long the signed-in person stays on each page, so the Loqal
 * admin console can show real "last online" and engagement metrics.
 */
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { recordVisit } from "@/lib/presence";

export function PresenceTracker() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const startedAt = useRef<number>(Date.now());
  const previous = useRef<{ path: string; email?: string }>({ path: pathname });

  useEffect(() => {
    const prev = previous.current;
    const seconds = (Date.now() - startedAt.current) / 1000;
    if (prev.path !== pathname) {
      recordVisit(prev.email ?? user?.email, prev.path, seconds);
      startedAt.current = Date.now();
    }
    previous.current = { path: pathname, ...(user?.email ? { email: user.email } : {}) };
  }, [pathname, user?.email]);

  useEffect(() => {
    function flush() {
      const prev = previous.current;
      recordVisit(prev.email, prev.path, (Date.now() - startedAt.current) / 1000);
      startedAt.current = Date.now();
    }
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, []);

  return null;
}
