# Property listing and deal workspace

## What will change
- Keep the original property listing as the full listing view, without active-deal workflow content mixed into it.
- Add a dedicated deal workspace for properties already in action, using the attached reference for information hierarchy while retaining Loqal’s current design.
- From **Properties in Action → Open Property**, open the deal workspace and provide a **View initial listing** button.
- When a client opens an initial listing that already has an active deal, show an **Open deal workspace** button.
- Preserve direct notification links so messages, calls, mortgage feedback, agreements, and other focused actions still open correctly.

## Deal workspace content
- Property and deal summary, current status, progress, next action, mortgage status, assigned partners, documents/messages access, and existing buyer workflow controls.
- No duplicate listing content below the workspace; the full listing remains available only through **View initial listing**.
- Responsive layout for desktop and mobile.

## Technical details
- Use a distinct TanStack route for the workspace and keep `/property/$propertyId` as the initial listing.
- Update active-property links to the workspace while marketplace/listing links continue to use the listing route.
- Reuse existing lead, buyer-process, partner, messaging, mortgage, and document state rather than duplicating business logic.
- Verify both directions and focused notification actions in the browser, then check the latest build output.
