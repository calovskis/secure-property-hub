# Mortgage questionnaire and lender portal corrections

## What will change
- Add **Other** to visa/status choices and preserve the selected status throughout the client profile and lender file.
- Make foreign-income USD conversion fully automatic from the existing daily open exchange-rate feed; remove manual rate editing while showing the applied rate and update date.
- Replace the visa upload’s immediate save with a review flow: support multiple files, remove/replace/add files, then explicitly confirm submission. Store confirmed document metadata with the mortgage lead so the lender can see it.
- Repair **My Profile** navigation/rendering and verify it from the live app.
- Correct lender terminology: **Open requests**, **In process**, and **Pre-approvals issued**. Keep request-list columns aligned and place the foreign-income indicator on its own line.
- Rename **Liabilities & DTI** to **Assets & Liabilities**.
- Keep all five questionnaire steps visible and sequential for every applicant. Step 3 will be **Assets & Liabilities**; non-US applicants will complete assets while liability questions remain conditional. Step 5 will always open and contain Ethnicity, Race, and Sex.
- Add assets for all applicants: financial institution/location country, account type (checking, savings, safety deposit, cash/liquid, investments, other), balance/value and currency, plus separately repeatable other-property assets.
- Show submitted assets and confirmed documents in the lender’s compartmentalized applicant file.

## Technical details
- Extend the shared questionnaire/profile types and defaults with asset and multi-document records while remaining compatible with existing saved local drafts.
- Update step validation/navigation so no hidden numeric step creates a gap or bypasses demographics.
- Update document records before creating the lead, then ensure the lead snapshot receives the confirmed files.
- Verify build diagnostics plus client questionnaire, profile route, upload confirmation, and lender file in the browser.
