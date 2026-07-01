// Parser per fatture elettroniche XML in formato FatturaPA (standard SDI italiano).
// Gestisce namespace/prefissi variabili (p:, ns2:, nessuno) cercando per nome locale.

export type ParsedXmlInvoice = {
  direction: "attiva" | "passiva" | null; // null = non determinabile, richiede scelta manuale
  document_type: "fattura" | "nota_credito" | "parcella" | "ricevuta" | "ddt";
  number: string | null;
  counterpart_name: string;
  counterpart_vat: string | null;
  issue_date: string | null;
  due_date: string | null;
  total_amount: number;
  payment_method: string | null;
  notes: string | null;
};

function findAll(root: Element | Document, tagName: string): Element[] {
  const out: Element[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.localName === tagName) out.push(child);
      walk(child);
    }
  };
  const rootEl = root instanceof Document ? root.documentElement : root;
  if (rootEl) walk(rootEl);
  return out;
}

function findFirst(root: Element | Document, tagName: string): Element | null {
  return findAll(root, tagName)[0] ?? null;
}

function text(el: Element | null): string | null {
  const t = el?.textContent?.trim();
  return t && t.length > 0 ? t : null;
}

const TD_CREDIT_NOTES = new Set(["TD04", "TD08"]); // nota di credito, nota di credito semplificata

function mapDocType(tipoDocumento: string | null): ParsedXmlInvoice["document_type"] {
  if (tipoDocumento && TD_CREDIT_NOTES.has(tipoDocumento)) return "nota_credito";
  return "fattura";
}

function mapPaymentMethod(mp: string | null): string | null {
  if (!mp) return null;
  const map: Record<string, string> = {
    MP01: "contanti",
    MP02: "assegno",
    MP05: "bonifico",
    MP08: "carta di pagamento",
    MP12: "RIBA",
    MP19: "SEPA",
  };
  return map[mp] ?? mp;
}

/**
 * Estrae una o più fatture da un singolo file XML FatturaPA.
 * Se companyVat è fornita, determina automaticamente la direzione (attiva/passiva)
 * confrontando la P.IVA dell'azienda con Cedente/Cessionario; altrimenti direction=null.
 */
export function parseFatturaPA(xmlText: string, companyVat: string | null): ParsedXmlInvoice[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("XML non valido o malformato");

  const header = findFirst(doc, "FatturaElettronicaHeader");
  if (!header) throw new Error("Non è un file FatturaPA valido (manca FatturaElettronicaHeader)");

  const cedente = findFirst(header, "CedentePrestatore");
  const cessionario = findFirst(header, "CessionarioCommittente");

  const cedenteVat = cedente ? text(findFirst(cedente, "IdCodice")) : null;
  const cedenteName = cedente
    ? text(findFirst(cedente, "Denominazione")) ??
      [text(findFirst(cedente, "Nome")), text(findFirst(cedente, "Cognome"))].filter(Boolean).join(" ")
    : null;
  const cessionarioVat = cessionario ? text(findFirst(cessionario, "IdCodice")) : null;
  const cessionarioName = cessionario
    ? text(findFirst(cessionario, "Denominazione")) ??
      [text(findFirst(cessionario, "Nome")), text(findFirst(cessionario, "Cognome"))].filter(Boolean).join(" ")
    : null;

  const normalizedCompanyVat = companyVat?.replace(/\D/g, "") || null;
  let direction: "attiva" | "passiva" | null = null;
  if (normalizedCompanyVat) {
    if (cedenteVat?.replace(/\D/g, "") === normalizedCompanyVat) direction = "attiva";
    else if (cessionarioVat?.replace(/\D/g, "") === normalizedCompanyVat) direction = "passiva";
  }

  const bodies = findAll(doc, "FatturaElettronicaBody");
  const results: ParsedXmlInvoice[] = [];

  for (const body of bodies) {
    const datiGenerali = findFirst(body, "DatiGeneraliDocumento");
    if (!datiGenerali) continue;

    const tipoDocumento = text(findFirst(datiGenerali, "TipoDocumento"));
    const numero = text(findFirst(datiGenerali, "Numero"));
    const dataDoc = text(findFirst(datiGenerali, "Data"));
    const importoTotale = text(findFirst(datiGenerali, "ImportoTotaleDocumento"));

    // La controparte è "l'altra parte" rispetto alla direzione determinata:
    // se la fattura è attiva (noi = cedente), controparte = cessionario, e viceversa.
    let counterpartName: string | null;
    let counterpartVat: string | null;
    if (direction === "attiva") {
      counterpartName = cessionarioName;
      counterpartVat = cessionarioVat;
    } else if (direction === "passiva") {
      counterpartName = cedenteName;
      counterpartVat = cedenteVat;
    } else {
      // Direzione sconosciuta: assumiamo il cedente come controparte di default
      // (il chiamante può correggere se necessario in base al contesto pagina).
      counterpartName = cedenteName;
      counterpartVat = cedenteVat;
    }
    if (!counterpartName) continue;

    const dettaglioPagamento = findFirst(body, "DettaglioPagamento");
    const dataScadenza = dettaglioPagamento ? text(findFirst(dettaglioPagamento, "DataScadenzaPagamento")) : null;
    const modalitaPagamento = dettaglioPagamento ? text(findFirst(dettaglioPagamento, "ModalitaPagamento")) : null;

    const total = importoTotale ? Number(importoTotale) : NaN;
    if (!Number.isFinite(total) || total <= 0) continue;

    results.push({
      direction,
      document_type: mapDocType(tipoDocumento),
      number: numero,
      counterpart_name: counterpartName,
      counterpart_vat: counterpartVat,
      issue_date: dataDoc,
      due_date: dataScadenza,
      total_amount: total,
      payment_method: mapPaymentMethod(modalitaPagamento),
      notes: null,
    });
  }

  return results;
}
