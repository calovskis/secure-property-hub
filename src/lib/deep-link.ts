/**
 * Shared helper for in-app deep links written as plain hrefs with a query
 * string (e.g. `/property/12?open=feedback`). Parsing them here keeps
 * notifications and activity trails able to jump straight into the pop-up
 * that needs attention.
 *
 * Every audience uses the same convention:
 *   ?tab=<id>       select a workspace tab (partner / admin portals)
 *   ?open=<action>  open the pop-up that the notification is about
 *   ?focus=<id>     highlight / expand one record inside the page
 */
import { useEffect } from "react";
import { useSearch, type useNavigate } from "@tanstack/react-router";

/**
 * Navigates to a deep link. Every navigation carries a fresh `k` nonce so that
 * clicking the same notification twice re-fires the target action — without it
 * the URL would be identical the second time and nothing would re-open.
 */
export function openDeepLink(navigate: ReturnType<typeof useNavigate>, href: string) {
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("k", String(Date.now()));
  const search = Object.fromEntries(params);
  navigate({ to: path, search } as never);
}

type DeepLinkSearch = {
  tab?: string | undefined;
  open?: string | undefined;
  focus?: string | undefined;
  doc?: string | undefined;
  request?: string | undefined;
  /** Nonce that makes repeated clicks on the same link re-trigger actions. */
  k?: string | undefined;
};

/** Current deep-link parameters, whatever route we are on. */
export function useDeepLink(): DeepLinkSearch {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const pick = (k: keyof DeepLinkSearch) =>
    typeof search[k] === "string" ? (search[k] as string) : undefined;
  return {
    ...(pick("tab") ? { tab: pick("tab") } : {}),
    ...(pick("open") ? { open: pick("open") } : {}),
    ...(pick("focus") ? { focus: pick("focus") } : {}),
    ...(pick("doc") ? { doc: pick("doc") } : {}),
    ...(pick("request") ? { request: pick("request") } : {}),
  };
}

/**
 * Runs `handler` when the page is opened with `?open=<action>` (optionally
 * also matching `?focus=<id>`), so a notification lands on the pop-up itself.
 */
export function useDeepLinkAction(action: string, handler: (focus?: string) => void) {
  const { open, focus } = useDeepLink();
  useEffect(() => {
    if (open !== action) return;
    handler(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focus, action]);
}
