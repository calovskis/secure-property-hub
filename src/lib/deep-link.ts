/**
 * Shared helper for in-app deep links written as plain hrefs with a query
 * string (e.g. `/property/12?open=feedback`). Parsing them here keeps
 * notifications and activity trails able to jump straight into the pop-up
 * that needs attention.
 */
import type { useNavigate } from "@tanstack/react-router";

export function openDeepLink(navigate: ReturnType<typeof useNavigate>, href: string) {
  const [path, query] = href.split("?");
  const search = query ? Object.fromEntries(new URLSearchParams(query)) : undefined;
  navigate({ to: path, ...(search ? { search } : {}) } as never);
}
