// Taken from the person's repository. Billing, main module.
// Provided as is, no reformatting.

import { db } from "../db";

export async function computeInvoiceTotal(invoiceId: string) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("not found");

  let total = 0;
  for (const line of invoice.lines) {
    total += line.unitPrice * line.quantity;
  }

  // VAT
  let vat = 0;
  if (invoice.country === "FR") {
    vat = total * 0.2;
  } else if (invoice.country === "DE") {
    vat = total * 0.19;
  } else if (invoice.country === "BE") {
    vat = total * 0.21;
  } else {
    vat = total * 0.2;
  }

  return total + vat;
}

export async function computeQuoteTotal(quoteId: string) {
  const quote = await db.quote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new Error("not found");

  let total = 0;
  for (const line of quote.lines) {
    total += line.unitPrice * line.quantity;
  }

  // VAT
  let vat = 0;
  if (quote.country === "FR") {
    vat = total * 0.2;
  } else if (quote.country === "DE") {
    vat = total * 0.19;
  } else if (quote.country === "BE") {
    vat = total * 0.21;
  } else {
    vat = total * 0.2;
  }

  return total + vat;
}

// TODO: factor out with computeInvoiceTotal, its the same computation
export async function computeCreditNoteTotal(creditNoteId: string) {
  const cn = await db.creditNote.findUnique({ where: { id: creditNoteId } });
  if (!cn) throw new Error("not found");
  let total = 0;
  for (const line of cn.lines) {
    total += line.unitPrice * line.quantity;
  }
  let vat = 0;
  if (cn.country === "FR") vat = total * 0.2;
  else if (cn.country === "DE") vat = total * 0.19;
  else if (cn.country === "BE") vat = total * 0.21;
  else vat = total * 0.2;
  return -(total + vat);
}
