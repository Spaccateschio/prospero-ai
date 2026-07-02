// Parser deterministico per export "Elenco fatture" di Danea Easyfatt
// Formato tipico per riga: <Num> <Data> <Tipo> <Nominativo> <Totale> [Guadagno] [Ricarico%] [Margine%]
// Esempio: "123/A 15/01/2025 Fattura Mario Rossi SRL 1.234,56 100,00 10,00% 8,1%"

export type ParsedInvoice = {
  document_type: "fattura" | "parcella" | "nota_credito" | "ricevuta" | "ddt";
  direction: "attiva" | "passiva";
  number: string | null;
  counterpart_name: string;
  counterpart_vat: string | null;
  issue_date: string | null;
  due_date: string | null;
  amount: number | null;
  vat_amount: number | null;
  total_amount: number;
};

export const parseNumber = (v: string): number | null => {
  const cleaned = v
    .replace(/[€$%\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export const normalizeDate = (v: string): string | null => {
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

export const mapDocType = (raw: string): ParsedInvoice["document_type"] => {
  const t = raw.toLowerCase();
  if (t.includes("parcella")) return "parcella";
  if (t.includes("nota") && t.includes("credit")) return "nota_credito";
  if (t === "nc") return "nota_credito";
  if (t.includes("ricevuta")) return "ricevuta";
  if (t.includes("ddt") || t.includes("trasport")) return "ddt";
  return "fattura";
};

const DATE_RE = /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/;
const NUMERIC_TOKEN_RE = /^[€$]?-?[\d.,]+%?$/;

/**
 * Tenta di parsare un testo di elenco fatture in formato Danea.
 * Ritorna null se il pattern non è riconosciuto su un numero significativo di righe.
 */
export function parseDaneaInvoices(
  text: string,
  fallbackDirection: "attiva" | "passiva",
): ParsedInvoice[] | null {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const candidates = lines.filter((l) => DATE_RE.test(l));
  if (candidates.length < 3) return null;

  const out: ParsedInvoice[] = [];

  for (const line of candidates) {
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch || dateMatch.index === undefined) continue;
    const dateStr = dateMatch[1];
    const before = line.slice(0, dateMatch.index).trim();
    const after = line.slice(dateMatch.index + dateMatch[0].length).trim();
    if (!before || !after) continue;

    // Number = ultimo token prima della data
    const beforeTokens = before.split(/\s+/);
    let number = beforeTokens[beforeTokens.length - 1];
    if (!number) continue;
    // Sezionale staccato dal numero ("727 A", "727 /A") → ricompone "727/A".
    // La lettera distingue fatture con stesso numero e data: va preservata
    // perché entra nella chiave di deduplicazione.
    if (
      /^\/?[A-Za-z]{1,3}$/.test(number) &&
      beforeTokens.length >= 2 &&
      /^\d+$/.test(beforeTokens[beforeTokens.length - 2])
    ) {
      number = `${beforeTokens[beforeTokens.length - 2]}/${number.replace(/^\//, "")}`;
    }
    // Salta intestazioni (es. "Num Data" o "Pagina 1/5 ...")
    if (/^(num|numero|pag|pagina)/i.test(number)) continue;

    const afterTokens = after.split(/\s+/);

    // Estrae token numerici finali (totale, guadagno, %, %)
    const trailing: string[] = [];
    while (afterTokens.length > 0) {
      const last = afterTokens[afterTokens.length - 1];
      if (NUMERIC_TOKEN_RE.test(last)) {
        trailing.unshift(afterTokens.pop()!);
      } else {
        break;
      }
    }
    const moneyTokens = trailing.filter((t) => !t.endsWith("%"));
    if (moneyTokens.length === 0) continue;
    const total = parseNumber(moneyTokens[0]);
    if (total === null || total <= 0) continue;

    if (afterTokens.length === 0) continue;

    // Tipo: 1 o più token iniziali ("Fattura", "Nota di credito", "Fatt. accompagn.", ecc.)
    let typeStr = afterTokens.shift()!;
    if (
      typeStr.toLowerCase() === "nota" &&
      afterTokens[0]?.toLowerCase() === "di" &&
      afterTokens[1]?.toLowerCase().startsWith("credit")
    ) {
      typeStr = "nota di credito";
      afterTokens.shift();
      afterTokens.shift();
    }

    const name = afterTokens.join(" ").trim();
    if (!name || name.length < 2) continue;
    // Scarta righe con nome che è solo numeri/simboli
    if (!/[a-zA-Z]/.test(name)) continue;

    const issueDate = normalizeDate(dateStr);
    if (!issueDate) continue;

    out.push({
      document_type: mapDocType(typeStr),
      direction: fallbackDirection,
      number,
      counterpart_name: name,
      counterpart_vat: null,
      issue_date: issueDate,
      due_date: null,
      amount: null,
      vat_amount: null,
      total_amount: total,
    });
  }

  // Se abbiamo riconosciuto meno del 40% delle righe con data, probabilmente
  // non è formato Danea — meglio non azzardare.
  if (out.length < Math.max(3, candidates.length * 0.4)) return null;

  return out;
}
