/**
 * Dati seed per la modalità demo. Sono valori realistici di una PMI italiana
 * fittizia ("ACME Srl") usati per popolare KPI, grafici e tabelle senza
 * toccare il database.
 */

export type DemoCompany = {
  id: string;
  name: string;
  legal_name: string;
  vat: string;
  fiscal_code: string;
  ateco: string;
  region: string;
  city: string;
  province: string;
  zip: string;
  address: string;
  company_type: string;
  founded_year: number;
  employees_count: number;
  annual_revenue: number;
};

export type DemoInvoice = {
  id: string;
  direction: "attiva" | "passiva";
  number: string;
  counterpart_name: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  issue_date: string; // YYYY-MM-DD
  due_date: string;
  paid_date: string | null;
  status: "draft" | "sent" | "paid" | "overdue";
  category?: string;
};

export type DemoPayment = {
  id: string;
  direction: "in" | "out";
  invoice_id?: string;
  counterpart_name: string;
  amount: number;
  date: string;
  method: "bonifico" | "carta" | "contanti" | "rid";
  notes?: string;
};

export type DemoClient = {
  id: string;
  name: string;
  vat: string;
  city: string;
  email: string;
};

export type DemoSupplier = {
  id: string;
  name: string;
  vat: string;
  city: string;
  category: string;
};

export type DemoCategory = { name: string; type: "income" | "expense" };

export type DemoTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  is_forecast?: boolean;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const monthOffset = (n: number) => {
  const d = new Date(today);
  d.setMonth(d.getMonth() + n);
  return d;
};
const dayOffset = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};

export function buildSeed() {
  const company: DemoCompany = {
    id: "demo-company",
    name: "ACME Srl",
    legal_name: "ACME Società a Responsabilità Limitata",
    vat: "01234567890",
    fiscal_code: "01234567890",
    ateco: "62.01.00",
    region: "Lazio",
    city: "Roma",
    province: "RM",
    zip: "00185",
    address: "Via dell'Esempio 10",
    company_type: "srl",
    founded_year: 2016,
    employees_count: 14,
    annual_revenue: 980000,
  };

  const clients: DemoClient[] = [
    { id: "c1", name: "Beta Spa", vat: "11122233344", city: "Milano", email: "amministrazione@beta.it" },
    { id: "c2", name: "Gamma Srl", vat: "22233344455", city: "Torino", email: "fatture@gamma.it" },
    { id: "c3", name: "Delta Industries", vat: "33344455566", city: "Bologna", email: "ap@delta.it" },
    { id: "c4", name: "Omega Consulting", vat: "44455566677", city: "Roma", email: "billing@omega.it" },
  ];

  const suppliers: DemoSupplier[] = [
    { id: "s1", name: "Hosting Pro Srl", vat: "55566677788", city: "Milano", category: "IT / Cloud" },
    { id: "s2", name: "Studio Commercialista Rossi", vat: "66677788899", city: "Roma", category: "Servizi" },
    { id: "s3", name: "Energia Italia Spa", vat: "77788899900", city: "Roma", category: "Utenze" },
  ];

  const invoices: DemoInvoice[] = [
    // Vendite (attive)
    {
      id: "i1", direction: "attiva", number: "2026/001", counterpart_name: "Beta Spa",
      amount: 12000, vat_amount: 2640, total_amount: 14640,
      issue_date: iso(monthOffset(-3)), due_date: iso(monthOffset(-2)), paid_date: iso(monthOffset(-2)),
      status: "paid",
    },
    {
      id: "i2", direction: "attiva", number: "2026/002", counterpart_name: "Gamma Srl",
      amount: 8500, vat_amount: 1870, total_amount: 10370,
      issue_date: iso(monthOffset(-2)), due_date: iso(monthOffset(-1)), paid_date: iso(monthOffset(-1)),
      status: "paid",
    },
    {
      id: "i3", direction: "attiva", number: "2026/003", counterpart_name: "Delta Industries",
      amount: 15000, vat_amount: 3300, total_amount: 18300,
      issue_date: iso(monthOffset(-1)), due_date: iso(dayOffset(5)), paid_date: null,
      status: "sent",
    },
    {
      id: "i4", direction: "attiva", number: "2026/004", counterpart_name: "Omega Consulting",
      amount: 6200, vat_amount: 1364, total_amount: 7564,
      issue_date: iso(today), due_date: iso(dayOffset(30)), paid_date: null,
      status: "sent",
    },
    {
      id: "i5", direction: "attiva", number: "2026/005", counterpart_name: "Beta Spa",
      amount: 4500, vat_amount: 990, total_amount: 5490,
      issue_date: iso(dayOffset(-50)), due_date: iso(dayOffset(-10)), paid_date: null,
      status: "overdue",
    },
    // Acquisti (passive)
    {
      id: "p1", direction: "passiva", number: "F-2026-44", counterpart_name: "Hosting Pro Srl",
      amount: 1200, vat_amount: 264, total_amount: 1464,
      issue_date: iso(monthOffset(-1)), due_date: iso(today), paid_date: iso(today),
      status: "paid", category: "IT / Cloud",
    },
    {
      id: "p2", direction: "passiva", number: "F-2026-45", counterpart_name: "Studio Commercialista Rossi",
      amount: 800, vat_amount: 176, total_amount: 976,
      issue_date: iso(monthOffset(-1)), due_date: iso(dayOffset(15)), paid_date: null,
      status: "sent", category: "Servizi",
    },
    {
      id: "p3", direction: "passiva", number: "F-2026-46", counterpart_name: "Energia Italia Spa",
      amount: 540, vat_amount: 118.8, total_amount: 658.8,
      issue_date: iso(monthOffset(-2)), due_date: iso(monthOffset(-1)), paid_date: iso(monthOffset(-1)),
      status: "paid", category: "Utenze",
    },
    {
      id: "p4", direction: "passiva", number: "F-2026-47", counterpart_name: "Hosting Pro Srl",
      amount: 1200, vat_amount: 264, total_amount: 1464,
      issue_date: iso(monthOffset(-2)), due_date: iso(monthOffset(-1)), paid_date: iso(monthOffset(-1)),
      status: "paid", category: "IT / Cloud",
    },
  ];

  const payments: DemoPayment[] = [
    // Ricevuti
    { id: "pay1", direction: "in", invoice_id: "i1", counterpart_name: "Beta Spa", amount: 14640, date: iso(monthOffset(-2)), method: "bonifico" },
    { id: "pay2", direction: "in", invoice_id: "i2", counterpart_name: "Gamma Srl", amount: 10370, date: iso(monthOffset(-1)), method: "bonifico" },
    { id: "pay3", direction: "in", counterpart_name: "Vendita Servizi Web", amount: 2200, date: iso(dayOffset(-7)), method: "carta" },
    { id: "pay4", direction: "in", counterpart_name: "Consulenza una-tantum", amount: 1500, date: iso(dayOffset(-3)), method: "bonifico" },
    // Da fare
    { id: "pay5", direction: "out", invoice_id: "p2", counterpart_name: "Studio Commercialista Rossi", amount: 976, date: iso(dayOffset(15)), method: "bonifico" },
    { id: "pay6", direction: "out", counterpart_name: "Stipendi", amount: 18500, date: iso(dayOffset(7)), method: "bonifico" },
    { id: "pay7", direction: "out", counterpart_name: "Affitto ufficio", amount: 2200, date: iso(dayOffset(10)), method: "rid" },
  ];

  const categories: DemoCategory[] = [
    { name: "Vendite", type: "income" },
    { name: "Consulenze", type: "income" },
    { name: "Stipendi", type: "expense" },
    { name: "Affitti", type: "expense" },
    { name: "IT / Cloud", type: "expense" },
    { name: "Utenze", type: "expense" },
    { name: "Servizi", type: "expense" },
  ];

  // Genero transazioni derivate da fatture pagate + alcune ricorrenze
  const transactions: DemoTransaction[] = [];
  for (const inv of invoices) {
    if (inv.paid_date) {
      transactions.push({
        id: `tx-${inv.id}`,
        date: inv.paid_date,
        description: `Fattura ${inv.number} — ${inv.counterpart_name}`,
        amount: inv.total_amount,
        type: inv.direction === "attiva" ? "income" : "expense",
        category: inv.direction === "attiva" ? "Vendite" : (inv.category ?? "Servizi"),
      });
    }
  }
  // Ricorrenze tipiche degli ultimi 6 mesi
  for (let m = -6; m <= 0; m++) {
    transactions.push({
      id: `tx-sal-${m}`,
      date: iso(new Date(today.getFullYear(), today.getMonth() + m, 27)),
      description: "Stipendi mensili",
      amount: 18500,
      type: "expense",
      category: "Stipendi",
    });
    transactions.push({
      id: `tx-aff-${m}`,
      date: iso(new Date(today.getFullYear(), today.getMonth() + m, 5)),
      description: "Affitto ufficio",
      amount: 2200,
      type: "expense",
      category: "Affitti",
    });
  }

  return { company, clients, suppliers, invoices, payments, categories, transactions };
}
