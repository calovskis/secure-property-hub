import { buildClientFilePdf } from "@/lib/client-file-pdf";
const lead: any = JSON.parse(await Bun.file("/tmp/lead.json").text());
const doc = await buildClientFilePdf(lead, { stage:"agreement_signed", closingDate:"2026-12-01", approvalDueDate:"2026-11-01", signedAt:"2026-09-15T10:00:00Z", agreedPrice:680000, hardCheckOpen:true } as any);
await Bun.write("/tmp/qa.pdf", doc.output("arraybuffer"));
console.log("ok");
