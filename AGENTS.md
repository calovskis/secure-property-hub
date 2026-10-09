<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Shared app stores persist locally and mirror item-by-item to the `shared_records` table via `src/lib/cloud-sync.ts` (add new keys to CLOUD_KEYS + registerCloudStore). Each row carries `participants` (emails, `partner:<registration id>`, `lenderstate:<ST>`) checked server-side by `shared_record_visible` — so data reaches every device but only the file's client, partners and Loqal admins can read or change it.
- Partner agreement text is selected centrally by partner type; inspector source text lives in a browser-safe template with registration-derived variables so partner review, downloads and admin countersigning use the same document.
- Inspector licence requirements derive from registered state/service coverage; copies are private Storage files referenced in inspector_profile so profile and dashboard completion agree across devices.
- Inspection navigation is shared across workspace, profile and settings; case views and metrics use inspection_requests rather than lender data or sample figures.
