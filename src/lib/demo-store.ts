import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  buildSeed,
  type DemoCategory,
  type DemoClient,
  type DemoCompany,
  type DemoInvoice,
  type DemoPayment,
  type DemoSupplier,
  type DemoTransaction,
} from "./demo-seed";

type State = {
  company: DemoCompany;
  invoices: DemoInvoice[];
  payments: DemoPayment[];
  clients: DemoClient[];
  suppliers: DemoSupplier[];
  categories: DemoCategory[];
  transactions: DemoTransaction[];
};

type Actions = {
  addInvoice: (inv: Omit<DemoInvoice, "id">) => void;
  updateInvoice: (id: string, patch: Partial<DemoInvoice>) => void;
  deleteInvoice: (id: string) => void;
  addPayment: (p: Omit<DemoPayment, "id">) => void;
  addClient: (c: Omit<DemoClient, "id">) => void;
  addSupplier: (s: Omit<DemoSupplier, "id">) => void;
  addTransaction: (t: Omit<DemoTransaction, "id">) => void;
  reset: () => void;
};

const newId = () => `id_${Math.random().toString(36).slice(2, 10)}`;

export const useDemoStore = create<State & Actions>()(
  persist(
    (set) => ({
      ...buildSeed(),

      addInvoice: (inv) =>
        set((s) => {
          const full: DemoInvoice = { ...inv, id: newId() };
          const txs = [...s.transactions];
          if (full.paid_date) {
            txs.push({
              id: newId(),
              date: full.paid_date,
              description: `Fattura ${full.number} — ${full.counterpart_name}`,
              amount: full.total_amount,
              type: full.direction === "attiva" ? "income" : "expense",
              category: full.direction === "attiva" ? "Vendite" : (full.category ?? "Servizi"),
            });
          }
          return { invoices: [full, ...s.invoices], transactions: txs };
        }),

      updateInvoice: (id, patch) =>
        set((s) => ({
          invoices: s.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),

      deleteInvoice: (id) =>
        set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) })),

      addPayment: (p) =>
        set((s) => {
          const full: DemoPayment = { ...p, id: newId() };
          const tx: DemoTransaction = {
            id: newId(),
            date: full.date,
            description: `Pagamento — ${full.counterpart_name}`,
            amount: full.amount,
            type: full.direction === "in" ? "income" : "expense",
            category: full.direction === "in" ? "Vendite" : "Servizi",
          };
          return { payments: [full, ...s.payments], transactions: [...s.transactions, tx] };
        }),


      addClient: (c) =>
        set((s) => ({ clients: [{ ...c, id: newId() }, ...s.clients] })),

      addSupplier: (sup) =>
        set((s) => ({ suppliers: [{ ...sup, id: newId() }, ...s.suppliers] })),

      addTransaction: (t) =>
        set((s) => ({ transactions: [{ ...t, id: newId() }, ...s.transactions] })),

      reset: () => set({ ...buildSeed() }),
    }),
    {
      name: "cfo-demo-v1",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage),
      ),

    },
  ),
);
