import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

const ACTIVE_COMPANY_KEY = "cfoai.activeCompanyId";

export type CompanyMembership = {
  id: string;
  role: "owner" | "admin" | "accountant" | "viewer";
  company: {
    id: string;
    name: string;
    vat: string | null;
    logo_url: string | null;
  };
};

export function useCompanies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["companies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_users")
        .select("id, role, company:companies(id, name, vat, logo_url)")
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CompanyMembership[];
    },
  });
}

export function useActiveCompanyId() {
  const [activeId, setActiveIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_COMPANY_KEY);
  });

  // Sync with localStorage across tabs
  useEffect(() => {
    function handler(e: StorageEvent) {
      if (e.key === ACTIVE_COMPANY_KEY) setActiveIdState(e.newValue);
    }
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setActiveId = (id: string | null) => {
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(ACTIVE_COMPANY_KEY, id);
      else window.localStorage.removeItem(ACTIVE_COMPANY_KEY);
    }
    setActiveIdState(id);
  };

  return { activeId, setActiveId };
}

export function useActiveCompany() {
  const { data: companies, isLoading } = useCompanies();
  const { activeId, setActiveId } = useActiveCompanyId();

  // Auto-select first company if none active
  useEffect(() => {
    if (!isLoading && companies && companies.length > 0) {
      const exists = companies.some((c) => c.company.id === activeId);
      if (!activeId || !exists) {
        setActiveId(companies[0].company.id);
      }
    }
  }, [companies, isLoading, activeId, setActiveId]);

  const active = companies?.find((c) => c.company.id === activeId) ?? null;
  return { active, activeId, setActiveId, companies: companies ?? [], isLoading };
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { setActiveId } = useActiveCompanyId();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      legal_name?: string;
      vat?: string;
      ateco?: string;
      sector?: string;
      region?: string;
      province?: string;
      city?: string;
      regime_fiscale?: "ordinario" | "semplificato" | "forfettario" | "agricolo";
      iva_frequency?: "mensile" | "trimestrale" | "annuale";
      company_type?:
        | "srl" | "srls" | "spa" | "sapa" | "snc" | "sas"
        | "ditta_individuale" | "cooperativa" | "altro";
      founded_year?: number;
      employees_count?: number;
      annual_revenue?: number;
      iso_certifications?: string[];
    }) => {
      if (!user) throw new Error("Utente non autenticato");

      const { data: company, error } = await supabase
        .from("companies")
        .insert({
          ...input,
          iso_certifications: input.iso_certifications ?? [],
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: memberError } = await supabase.from("company_users").insert({
        company_id: company.id,
        user_id: user.id,
        role: "owner",
      });
      if (memberError) throw memberError;

      return company;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setActiveId(company.id);
    },
  });
}
