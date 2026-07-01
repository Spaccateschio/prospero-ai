import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getMembershipRole(
  supabase: {
    from: (t: string) => {
      select: (s: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: { role: string } | null; error: { message: string } | null }>;
          };
        };
      };
    };
  },
  companyId: string,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("company_users")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Non sei membro di questa azienda");
  return data.role;
}

// ============ IMPORT movimenti (righe vendita) ============
const SaleRowSchema = z.object({
  sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counterpart_name: z.string().min(1).max(200),
  product_name: z.string().min(1).max(200),
  product_code: z.string().max(60).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  total_amount: z.number().nonnegative(),
  reference_doc: z.string().max(200).optional().nullable(),
});

export const importProductSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      rows: z.array(SaleRowSchema).min(1).max(5000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin", "accountant"].includes(role)) {
      throw new Error("Permessi insufficienti per importare i movimenti prodotto");
    }

    // 1) Upsert catalogo prodotti (deduplicato per codice, o per nome se senza codice)
    const productMap = new Map<string, { name: string; code: string | null; category: string | null; unit: string | null; price: number }>();
    for (const r of data.rows) {
      const key = r.product_code ? `code:${r.product_code}` : `name:${r.product_name.toLowerCase()}`;
      productMap.set(key, {
        name: r.product_name,
        code: r.product_code ?? null,
        category: r.category ?? null,
        unit: r.unit ?? null,
        price: r.unit_price,
      });
    }
    const withCode = Array.from(productMap.values()).filter((p) => p.code);
    const withoutCode = Array.from(productMap.values()).filter((p) => !p.code);

    if (withCode.length > 0) {
      const { error } = await supabase.from("products").upsert(
        withCode.map((p) => ({
          company_id: data.company_id,
          code: p.code,
          name: p.name,
          category: p.category,
          default_unit: p.unit,
          last_unit_price: p.price,
        })),
        { onConflict: "company_id,code" },
      );
      if (error) throw new Error(error.message);
    }
    if (withoutCode.length > 0) {
      const { error } = await supabase.from("products").upsert(
        withoutCode.map((p) => ({
          company_id: data.company_id,
          code: null,
          name: p.name,
          category: p.category,
          default_unit: p.unit,
          last_unit_price: p.price,
        })),
        { onConflict: "company_id,name" },
      );
      if (error) throw new Error(error.message);
    }

    // 2) Insert righe vendita (upsert con ignoreDuplicates per evitare doppio import)
    let inserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < data.rows.length; i += CHUNK) {
      const chunk = data.rows.slice(i, i + CHUNK);
      const payload = chunk.map((r) => ({
        company_id: data.company_id,
        product_name: r.product_name,
        product_code: r.product_code ?? null,
        category: r.category ?? null,
        unit: r.unit ?? null,
        sale_date: r.sale_date,
        counterpart_name: r.counterpart_name,
        quantity: r.quantity,
        unit_price: r.unit_price,
        total_amount: r.total_amount,
        reference_doc: r.reference_doc ?? null,
      }));
      const { data: ins, error } = await supabase
        .from("product_sales")
        .upsert(payload, {
          onConflict: "company_id,reference_doc,product_name,sale_date,quantity,unit_price",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw new Error(error.message);
      inserted += ins?.length ?? 0;
    }

    return { inserted, total: data.rows.length };
  });

// ============ ANALYTICS ============
export type ProductStat = {
  product_name: string;
  product_code: string | null;
  category: string | null;
  unit: string | null;
  total_quantity: number;
  total_amount: number;
  avg_price: number;
  clients_count: number;
  top_client: string | null;
  top_client_amount: number;
};

export type ClientProductStat = {
  counterpart_name: string;
  product_name: string;
  total_quantity: number;
  total_amount: number;
  avg_price: number;
};

export const getProductAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("product_sales")
      .select("product_name, product_code, category, unit, sale_date, counterpart_name, quantity, unit_price, total_amount")
      .eq("company_id", data.company_id);
    if (data.from) q = q.gte("sale_date", data.from);
    if (data.to) q = q.lte("sale_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Aggregazione per prodotto
    const byProduct = new Map<string, ProductStat & { _priceSum: number; _priceWeight: number; _clients: Map<string, number> }>();
    // Aggregazione per prodotto+cliente (per "chi acquista di più")
    const byClientProduct = new Map<string, ClientProductStat & { _priceSum: number; _priceWeight: number }>();
    // Serie prezzo medio mensile complessivo
    const byMonth = new Map<string, { sum: number; qty: number }>();

    for (const r of rows ?? []) {
      const pKey = r.product_name.trim().toLowerCase();
      const qty = Number(r.quantity);
      const amt = Number(r.total_amount);
      const price = Number(r.unit_price);

      let p = byProduct.get(pKey);
      if (!p) {
        p = {
          product_name: r.product_name,
          product_code: r.product_code,
          category: r.category,
          unit: r.unit,
          total_quantity: 0,
          total_amount: 0,
          avg_price: 0,
          clients_count: 0,
          top_client: null,
          top_client_amount: 0,
          _priceSum: 0,
          _priceWeight: 0,
          _clients: new Map(),
        };
        byProduct.set(pKey, p);
      }
      p.total_quantity += qty;
      p.total_amount += amt;
      p._priceSum += price * qty;
      p._priceWeight += qty;
      p._clients.set(r.counterpart_name, (p._clients.get(r.counterpart_name) ?? 0) + amt);

      const cpKey = `${r.counterpart_name}::${pKey}`;
      let cp = byClientProduct.get(cpKey);
      if (!cp) {
        cp = {
          counterpart_name: r.counterpart_name,
          product_name: r.product_name,
          total_quantity: 0,
          total_amount: 0,
          avg_price: 0,
          _priceSum: 0,
          _priceWeight: 0,
        };
        byClientProduct.set(cpKey, cp);
      }
      cp.total_quantity += qty;
      cp.total_amount += amt;
      cp._priceSum += price * qty;
      cp._priceWeight += qty;

      const month = (r.sale_date as string).slice(0, 7);
      const m = byMonth.get(month) ?? { sum: 0, qty: 0 };
      m.sum += price * qty;
      m.qty += qty;
      byMonth.set(month, m);
    }

    const products: ProductStat[] = Array.from(byProduct.values()).map((p) => {
      let topClient: string | null = null;
      let topAmount = 0;
      for (const [name, amt] of p._clients) {
        if (amt > topAmount) {
          topAmount = amt;
          topClient = name;
        }
      }
      return {
        product_name: p.product_name,
        product_code: p.product_code,
        category: p.category,
        unit: p.unit,
        total_quantity: p.total_quantity,
        total_amount: p.total_amount,
        avg_price: p._priceWeight > 0 ? p._priceSum / p._priceWeight : 0,
        clients_count: p._clients.size,
        top_client: topClient,
        top_client_amount: topAmount,
      };
    }).sort((a, b) => b.total_amount - a.total_amount);

    const clientProducts: ClientProductStat[] = Array.from(byClientProduct.values())
      .map((cp) => ({
        counterpart_name: cp.counterpart_name,
        product_name: cp.product_name,
        total_quantity: cp.total_quantity,
        total_amount: cp.total_amount,
        avg_price: cp._priceWeight > 0 ? cp._priceSum / cp._priceWeight : 0,
      }))
      .sort((a, b) => b.total_amount - a.total_amount);

    const priceTrend = Array.from(byMonth.entries())
      .map(([month, v]) => ({ month, avg_price: v.qty > 0 ? v.sum / v.qty : 0 }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { products, clientProducts, priceTrend, rowsCount: (rows ?? []).length };
  });
