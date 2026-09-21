# Mortgage file requests and eligibility actions

## What will change
- Add a clear **New information request** action inside each mortgage file’s Requests section.
- Save every request on the client file with its request type, sent date, wording, response, documents, and status.
- Make each saved request open as a communication thread, so the lender can review the original request and the client’s response together.
- Add direct actions beneath bank-eligibility suggestions:
  - **Request visa support** when valid visa documentation is required.
  - **Request evidence** for missing documents or proof.
  - **Request information** for missing or incomplete file details.
- Prefill each request with wording based on the bank rule and client, while allowing the lender to edit it before sending.
- Prevent confusing duplicates by showing an existing open request when the same request type and bank requirement is already awaiting a response.

## Technical details
- Extend mortgage information requests with a typed category and optional bank-program/recommendation context while keeping older saved requests compatible.
- Reuse the current mortgage-file request storage and client reply flow, so requests remain attached to the same case.
- Add a reusable request dialog shared by the Requests section and Bank eligibility window.
- Keep the current mortgage overview and bank matching rules unchanged.
- Verify both manual requests and eligibility-generated requests in the lender case workspace, including the separate-tab case page.
