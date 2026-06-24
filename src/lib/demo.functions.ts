import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Crea una azienda demo "ACME Srl" con qualche fattura di esempio
 * per gli utenti che entrano in modalità prova (anonimi).
 * Idempotente: se l'utente ha già un'azienda, non fa nulla.
 */
export const seedDemoCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ companyId: string; created: boolean }> => {
    const { supabase, userId } = context;

    // Già membro di un'azienda? Skip.
    const { data: existing } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (existing?.company_id) {
      return { companyId: existing.company_id, created: false };
    }

    // Crea azienda demo
    const { data: company, error: cErr } = await supabase
      .from("companies")
      .insert({
        name: "ACME Srl (Demo)",
        legal_name: "ACME Società a Responsabilità Limitata",
        vat: "12345678901",
        fiscal_code: "12345678901",
        ateco: "62.01.00",
        ateco_description: "Produzione di software non connesso all'edizione",
        sector: "Tecnologia",
        region: "Lombardia",
        province: "MI",
        city: "Milano",
        zip_code: "20121",
        legal_address_street: "Via Esempio 10",
        company_type: "srl",
        regime_fiscale: "ordinario",
        iva_frequency: "trimestrale",
        founded_year: 2015,
        employees_count: 12,
        annual_revenue: 850000,
        created_by: userId,
      })
      .select("id")
      .single();
    if (cErr || !company) throw new Error(cErr?.message ?? "Errore creazione azienda demo");

    const { error: mErr } = await supabase.from("company_users").insert({
      company_id: company.id,
      user_id: userId,
      role: "owner",
    });
    if (mErr) throw new Error(mErr.message);

    // Qualche fattura di esempio (mese corrente e precedenti)
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const monthAgo = (n: number) => {
      const d = new Date(today);
      d.setMonth(d.getMonth() - n);
      return d;
    };

    const invoices = [
      // Vendite incassate
      { direction: "attiva" as const, number: "2025/001", counterpart_name: "Beta Spa", amount: 12000, vat_amount: 2640, total_amount: 14640, issue_date: iso(monthAgo(2)), due_date: iso(monthAgo(1)), paid_date: iso(monthAgo(1)), status: "paid" as const },
      { direction: "attiva" as const, number: "2025/002", counterpart_name: "Gamma Srl", amount: 8500, vat_amount: 1870, total_amount: 10370, issue_date: iso(monthAgo(2)), due_date: iso(monthAgo(1)), paid_date: iso(monthAgo(1)), status: "paid" as const },
      { direction: "attiva" as const, number: "2025/003", counterpart_name: "Delta Industries", amount: 15000, vat_amount: 3300, total_amount: 18300, issue_date: iso(monthAgo(1)), due_date: iso(today), paid_date: null, status: "sent" as const },
      { direction: "attiva" as const, number: "2025/004", counterpart_name: "Omega Consulting", amount: 6200, vat_amount: 1364, total_amount: 7564, issue_date: iso(today), due_date: iso(new Date(today.getTime() + 30 * 86400000)), paid_date: null, status: "sent" as const },
      // Acquisti
      { direction: "passiva" as const, number: "F-2025-44", counterpart_name: "Hosting Pro Srl", amount: 1200, vat_amount: 264, total_amount: 1464, issue_date: iso(monthAgo(1)), due_date: iso(today), paid_date: iso(today), status: "paid" as const },
      { direction: "passiva" as const, number: "F-2025-45", counterpart_name: "Studio Commercialista", amount: 800, vat_amount: 176, total_amount: 976, issue_date: iso(monthAgo(1)), due_date: iso(new Date(today.getTime() + 15 * 86400000)), paid_date: null, status: "sent" as const },
    ];

    const { error: invErr } = await supabase.from("invoices").insert(
      invoices.map((i) => ({ ...i, company_id: company.id, is_demo: true }))
    );
    if (invErr) throw new Error(invErr.message);

    return { companyId: company.id, created: true };
  });
