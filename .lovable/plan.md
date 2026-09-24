# Purchase terms guided pop-up

## What will change
- Replace the realtor’s inline **Purchase terms for the seller** form with a focused, mortgage-style pop-up while keeping the buyer-file overview compact.
- Split the pop-up into four clear stages: **Offer basics**, **Protections**, **Deadlines & costs**, and **Review & send**.
- Save every entered choice as a draft on the property file, so Anna can close the window and resume without losing work.
- Expand the terms using the reference’s useful deal details:
  - deposit amount and timing, payment method, target closing, and possession/key handover;
  - inspection, appraisal, financing, title/lien, survey/boundary, and due-diligence/HOA protections;
  - separate deadlines for inspection, appraisal, mortgage submission, final loan approval, title objections, and offer expiration;
  - included/excluded items, seller credits, home warranty, closing-cost allocation, prorations, and special terms.
- Make the final stage a complete, readable terms summary with a required review confirmation before the agent sends it to the buyer.
- Preserve the established approval order: the realtor drafts and sends; the buyer confirms or requests changes; only buyer-confirmed terms are marked ready for seller presentation.
- Improve the confirmed state in the realtor file so it clearly says the terms are ready for the seller and keeps the next agreement-upload action visible.

## Technical details
- Extend the shared purchase-term model and summary helpers with backward-compatible defaults for existing saved files.
- Add persisted draft terms and current pop-up step to the existing per-property plan.
- Reuse the existing date input and dialog controls, with validation for required dates and internally consistent deadlines.
- Keep existing buyer notifications, change-request rounds, seller-stage status, and agreement signing intact.
- Verify the realtor draft/resume/send flow, buyer review/confirmation flow, seller-ready status, mobile layout, and app diagnostics.
