export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accountant_access_requests: {
        Row: {
          accountant_user_id: string
          company_id: string
          created_at: string
          expires_at: string
          id: string
          reason: string | null
          requested_at: string
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["access_request_status"]
        }
        Insert: {
          accountant_user_id: string
          company_id: string
          created_at?: string
          expires_at: string
          id?: string
          reason?: string | null
          requested_at?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["access_request_status"]
        }
        Update: {
          accountant_user_id?: string
          company_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          reason?: string | null
          requested_at?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["access_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "accountant_access_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_diagnoses: {
        Row: {
          action_plan: Json
          company_id: string
          created_at: string
          description: string | null
          dismissed_at: string | null
          id: string
          severity: Database["public"]["Enums"]["diagnosis_severity"]
          snoozed_until: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          action_plan?: Json
          company_id: string
          created_at?: string
          description?: string | null
          dismissed_at?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["diagnosis_severity"]
          snoozed_until?: string | null
          status?: string
          title: string
          type: string
        }
        Update: {
          action_plan?: Json
          company_id?: string
          created_at?: string
          description?: string | null
          dismissed_at?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["diagnosis_severity"]
          snoozed_until?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_diagnoses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_opportunities: {
        Row: {
          company_id: string
          confidence: Database["public"]["Enums"]["tax_confidence"]
          created_at: string
          description: string | null
          estimated_impact: number | null
          id: string
          metadata: Json
          status: Database["public"]["Enums"]["opportunity_status"]
          title: string
          type: string
        }
        Insert: {
          company_id: string
          confidence?: Database["public"]["Enums"]["tax_confidence"]
          created_at?: string
          description?: string | null
          estimated_impact?: number | null
          id?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["opportunity_status"]
          title: string
          type: string
        }
        Update: {
          company_id?: string
          confidence?: Database["public"]["Enums"]["tax_confidence"]
          created_at?: string
          description?: string | null
          estimated_impact?: number | null
          id?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["opportunity_status"]
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_sheets: {
        Row: {
          company_id: string
          confirmed: boolean
          created_at: string
          debiti_totali: number | null
          dipendenti: number | null
          ebitda: number | null
          extracted_data: Json
          id: string
          liquidita: number | null
          patrimonio_netto: number | null
          raw_file_url: string | null
          ricavi: number | null
          source_type: string | null
          updated_at: string
          utile_netto: number | null
          year: number
        }
        Insert: {
          company_id: string
          confirmed?: boolean
          created_at?: string
          debiti_totali?: number | null
          dipendenti?: number | null
          ebitda?: number | null
          extracted_data?: Json
          id?: string
          liquidita?: number | null
          patrimonio_netto?: number | null
          raw_file_url?: string | null
          ricavi?: number | null
          source_type?: string | null
          updated_at?: string
          utile_netto?: number | null
          year: number
        }
        Update: {
          company_id?: string
          confirmed?: boolean
          created_at?: string
          debiti_totali?: number | null
          dipendenti?: number | null
          ebitda?: number | null
          extracted_data?: Json
          id?: string
          liquidita?: number | null
          patrimonio_netto?: number | null
          raw_file_url?: string | null
          ricavi?: number | null
          source_type?: string | null
          updated_at?: string
          utile_netto?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "balance_sheets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      carbon_footprint: {
        Row: {
          company_id: string
          created_at: string
          energy_tco2e: number | null
          fleet_tco2e: number | null
          id: string
          period_end: string
          period_start: string
          scope3_tco2e: number | null
          source_data: Json
          total_tco2e: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          energy_tco2e?: number | null
          fleet_tco2e?: number | null
          id?: string
          period_end: string
          period_start: string
          scope3_tco2e?: number | null
          source_data?: Json
          total_tco2e?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          energy_tco2e?: number | null
          fleet_tco2e?: number | null
          id?: string
          period_end?: string
          period_start?: string
          scope3_tco2e?: number | null
          source_data?: Json
          total_tco2e?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "carbon_footprint_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          email: string | null
          fiscal_code: string | null
          id: string
          last_order_date: string | null
          name: string
          notes: string | null
          phone: string | null
          total_revenue_ytd: number | null
          updated_at: string
          vat: string | null
          zone: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          fiscal_code?: string | null
          id?: string
          last_order_date?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          total_revenue_ytd?: number | null
          updated_at?: string
          vat?: string | null
          zone?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          fiscal_code?: string | null
          id?: string
          last_order_date?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          total_revenue_ytd?: number | null
          updated_at?: string
          vat?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accountant_approval_timeout_hours: number
          annual_revenue: number | null
          ateco: string | null
          city: string | null
          company_type: Database["public"]["Enums"]["company_type"] | null
          created_at: string
          created_by: string
          employees_count: number | null
          fiscal_code: string | null
          founded_year: number | null
          id: string
          iso_certifications: Json
          iva_frequency: Database["public"]["Enums"]["iva_frequency"] | null
          legal_name: string | null
          logo_url: string | null
          name: string
          province: string | null
          regime_fiscale: Database["public"]["Enums"]["regime_fiscale"] | null
          region: string | null
          require_accountant_approval: boolean
          sector: string | null
          updated_at: string
          vat: string | null
          zip_code: string | null
        }
        Insert: {
          accountant_approval_timeout_hours?: number
          annual_revenue?: number | null
          ateco?: string | null
          city?: string | null
          company_type?: Database["public"]["Enums"]["company_type"] | null
          created_at?: string
          created_by: string
          employees_count?: number | null
          fiscal_code?: string | null
          founded_year?: number | null
          id?: string
          iso_certifications?: Json
          iva_frequency?: Database["public"]["Enums"]["iva_frequency"] | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          province?: string | null
          regime_fiscale?: Database["public"]["Enums"]["regime_fiscale"] | null
          region?: string | null
          require_accountant_approval?: boolean
          sector?: string | null
          updated_at?: string
          vat?: string | null
          zip_code?: string | null
        }
        Update: {
          accountant_approval_timeout_hours?: number
          annual_revenue?: number | null
          ateco?: string | null
          city?: string | null
          company_type?: Database["public"]["Enums"]["company_type"] | null
          created_at?: string
          created_by?: string
          employees_count?: number | null
          fiscal_code?: string | null
          founded_year?: number | null
          id?: string
          iso_certifications?: Json
          iva_frequency?: Database["public"]["Enums"]["iva_frequency"] | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          province?: string | null
          regime_fiscale?: Database["public"]["Enums"]["regime_fiscale"] | null
          region?: string | null
          require_accountant_approval?: boolean
          sector?: string | null
          updated_at?: string
          vat?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      company_grants: {
        Row: {
          company_id: string
          created_at: string
          eligibility_notes: string | null
          eligibility_score: number | null
          eligibility_verdict: string | null
          grant_id: string
          id: string
          saved: boolean
          status: Database["public"]["Enums"]["opportunity_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          eligibility_notes?: string | null
          eligibility_score?: number | null
          eligibility_verdict?: string | null
          grant_id: string
          id?: string
          saved?: boolean
          status?: Database["public"]["Enums"]["opportunity_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          eligibility_notes?: string | null
          eligibility_score?: number | null
          eligibility_verdict?: string | null
          grant_id?: string
          id?: string
          saved?: boolean
          status?: Database["public"]["Enums"]["opportunity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_grants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_grants_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          permissions: Json
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          annual_value: number | null
          auto_renewal: boolean
          company_id: string
          cost_category: string | null
          created_at: string
          end_date: string | null
          extracted_data: Json
          file_url: string | null
          id: string
          monthly_value: number | null
          notes: string | null
          notice_days: number | null
          payment_terms: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          supplier_name: string
          type: string | null
          updated_at: string
        }
        Insert: {
          annual_value?: number | null
          auto_renewal?: boolean
          company_id: string
          cost_category?: string | null
          created_at?: string
          end_date?: string | null
          extracted_data?: Json
          file_url?: string | null
          id?: string
          monthly_value?: number | null
          notes?: string | null
          notice_days?: number | null
          payment_terms?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          supplier_name: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          annual_value?: number | null
          auto_renewal?: boolean
          company_id?: string
          cost_category?: string | null
          created_at?: string
          end_date?: string | null
          extracted_data?: Json
          file_url?: string | null
          id?: string
          monthly_value?: number | null
          notes?: string | null
          notice_days?: number | null
          payment_terms?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          supplier_name?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_savings: {
        Row: {
          category: string
          company_id: string
          confidence: Database["public"]["Enums"]["tax_confidence"]
          created_at: string
          description: string | null
          estimated_saving_annual: number | null
          id: string
          simulation_id: string | null
          source_data: Json
          status: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          confidence?: Database["public"]["Enums"]["tax_confidence"]
          created_at?: string
          description?: string | null
          estimated_saving_annual?: number | null
          id?: string
          simulation_id?: string | null
          source_data?: Json
          status?: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          confidence?: Database["public"]["Enums"]["tax_confidence"]
          created_at?: string
          description?: string | null
          estimated_saving_annual?: number | null
          id?: string
          simulation_id?: string | null
          source_data?: Json
          status?: Database["public"]["Enums"]["opportunity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_savings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_savings_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_layouts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          layout: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_layouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      events_timeline: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          metadata: Json
          title: string
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          event_date?: string
          event_type: string
          id?: string
          metadata?: Json
          title: string
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          metadata?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_timeline_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          active: boolean
          company_types: Json
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          last_updated: string
          max_amount: number | null
          max_employees: number | null
          max_percentage: number | null
          max_revenue: number | null
          min_employees: number | null
          min_revenue: number | null
          regions: Json
          required_certifications: Json
          requirements: Json
          sectors: Json
          source: string | null
          title: string
          type: Database["public"]["Enums"]["grant_type"] | null
          url: string | null
        }
        Insert: {
          active?: boolean
          company_types?: Json
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          last_updated?: string
          max_amount?: number | null
          max_employees?: number | null
          max_percentage?: number | null
          max_revenue?: number | null
          min_employees?: number | null
          min_revenue?: number | null
          regions?: Json
          required_certifications?: Json
          requirements?: Json
          sectors?: Json
          source?: string | null
          title: string
          type?: Database["public"]["Enums"]["grant_type"] | null
          url?: string | null
        }
        Update: {
          active?: boolean
          company_types?: Json
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          last_updated?: string
          max_amount?: number | null
          max_employees?: number | null
          max_percentage?: number | null
          max_revenue?: number | null
          min_employees?: number | null
          min_revenue?: number | null
          regions?: Json
          required_certifications?: Json
          requirements?: Json
          sectors?: Json
          source?: string | null
          title?: string
          type?: Database["public"]["Enums"]["grant_type"] | null
          url?: string | null
        }
        Relationships: []
      }
      health_scores: {
        Row: {
          benchmark_sector_avg: number | null
          calculated_at: string
          company_id: string
          credit_score_estimate: Json
          id: string
          period_end: string | null
          period_start: string | null
          score: number
          sub_scores: Json
        }
        Insert: {
          benchmark_sector_avg?: number | null
          calculated_at?: string
          company_id: string
          credit_score_estimate?: Json
          id?: string
          period_end?: string | null
          period_start?: string | null
          score: number
          sub_scores?: Json
        }
        Update: {
          benchmark_sector_avg?: number | null
          calculated_at?: string
          company_id?: string
          credit_score_estimate?: Json
          id?: string
          period_end?: string | null
          period_start?: string | null
          score?: number
          sub_scores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "health_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          company_id: string
          counterpart_name: string
          counterpart_vat: string | null
          created_at: string
          direction: Database["public"]["Enums"]["invoice_direction"]
          due_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          notes: string | null
          number: string | null
          paid_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          updated_at: string
          vat_amount: number | null
          xml_url: string | null
        }
        Insert: {
          amount: number
          client_id?: string | null
          company_id: string
          counterpart_name: string
          counterpart_vat?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["invoice_direction"]
          due_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          number?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          updated_at?: string
          vat_amount?: number | null
          xml_url?: string | null
        }
        Update: {
          amount?: number
          client_id?: string | null
          company_id?: string
          counterpart_name?: string
          counterpart_vat?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["invoice_direction"]
          due_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          number?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
          vat_amount?: number | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          company_id: string
          created_at: string
          end_date: string | null
          id: string
          initial_amount: number
          installment: number | null
          lender: string | null
          name: string
          next_due_date: string | null
          notes: string | null
          paid_installments: number | null
          rate_type: Database["public"]["Enums"]["loan_rate_type"]
          rate_value: number | null
          residual: number
          start_date: string | null
          total_installments: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          initial_amount: number
          installment?: number | null
          lender?: string | null
          name: string
          next_due_date?: string | null
          notes?: string | null
          paid_installments?: number | null
          rate_type?: Database["public"]["Enums"]["loan_rate_type"]
          rate_value?: number | null
          residual: number
          start_date?: string | null
          total_installments?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          initial_amount?: number
          installment?: number | null
          lender?: string | null
          name?: string
          next_due_date?: string | null
          notes?: string | null
          paid_installments?: number | null
          rate_type?: Database["public"]["Enums"]["loan_rate_type"]
          rate_value?: number | null
          residual?: number
          start_date?: string | null
          total_installments?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          id: string
          payload: Json
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          locale: string
          onboarding_completed: boolean
          phone: string | null
          two_factor_enabled: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          locale?: string
          onboarding_completed?: boolean
          phone?: string | null
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          locale?: string
          onboarding_completed?: boolean
          phone?: string | null
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      simulations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          parameters: Json
          promoted_at: string | null
          result: Json
          status: Database["public"]["Enums"]["simulation_status"]
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parameters?: Json
          promoted_at?: string | null
          result?: Json
          status?: Database["public"]["Enums"]["simulation_status"]
          type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parameters?: Json
          promoted_at?: string | null
          result?: Json
          status?: Database["public"]["Enums"]["simulation_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotes: {
        Row: {
          ai_comparison: Json
          company_id: string
          comparison_group: string
          contract_id: string | null
          created_at: string
          duration_months: number | null
          extracted_data: Json
          file_url: string | null
          id: string
          payment_terms: string | null
          recommended: boolean
          supplier_name: string
          total_price: number | null
        }
        Insert: {
          ai_comparison?: Json
          company_id: string
          comparison_group?: string
          contract_id?: string | null
          created_at?: string
          duration_months?: number | null
          extracted_data?: Json
          file_url?: string | null
          id?: string
          payment_terms?: string | null
          recommended?: boolean
          supplier_name: string
          total_price?: number | null
        }
        Update: {
          ai_comparison?: Json
          company_id?: string
          comparison_group?: string
          contract_id?: string | null
          created_at?: string
          duration_months?: number | null
          extracted_data?: Json
          file_url?: string | null
          id?: string
          payment_terms?: string | null
          recommended?: boolean
          supplier_name?: string
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_deadlines: {
        Row: {
          actual_amount: number | null
          company_id: string
          confidence: Database["public"]["Enums"]["tax_confidence"]
          created_at: string
          description: string | null
          due_date: string
          estimated_amount: number | null
          id: string
          notify_days_before: number
          paid_at: string | null
          status: Database["public"]["Enums"]["tax_status"]
          type: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          company_id: string
          confidence?: Database["public"]["Enums"]["tax_confidence"]
          created_at?: string
          description?: string | null
          due_date: string
          estimated_amount?: number | null
          id?: string
          notify_days_before?: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["tax_status"]
          type: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          company_id?: string
          confidence?: Database["public"]["Enums"]["tax_confidence"]
          created_at?: string
          description?: string | null
          due_date?: string
          estimated_amount?: number | null
          id?: string
          notify_days_before?: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["tax_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_deadlines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          company_id: string
          counterpart: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          invoice_id: string | null
          reconciled: boolean
          source: string | null
          source_ref: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          company_id: string
          counterpart?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          reconciled?: boolean
          source?: string | null
          source_ref?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string
          counterpart?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          reconciled?: boolean
          source?: string | null
          source_ref?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_bills: {
        Row: {
          category: string
          company_id: string
          consumption: number | null
          created_at: string
          extracted_data: Json
          file_url: string | null
          fixed_costs: number | null
          id: string
          period_end: string | null
          period_start: string | null
          supplier: string | null
          total_amount: number | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          consumption?: number | null
          created_at?: string
          extracted_data?: Json
          file_url?: string | null
          fixed_costs?: number | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          supplier?: string | null
          total_amount?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          consumption?: number | null
          created_at?: string
          extracted_data?: Json
          file_url?: string | null
          fixed_costs?: number | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          supplier?: string | null
          total_amount?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      access_request_status: "pending" | "approved" | "rejected" | "expired"
      app_role: "owner" | "admin" | "accountant" | "viewer"
      company_type:
        | "srl"
        | "srls"
        | "spa"
        | "sapa"
        | "snc"
        | "sas"
        | "ditta_individuale"
        | "cooperativa"
        | "altro"
      contract_status:
        | "active"
        | "expiring_soon"
        | "expired"
        | "under_renegotiation"
      diagnosis_severity: "critical" | "warning" | "info"
      grant_type:
        | "fondo_perduto"
        | "credito_imposta"
        | "finanziamento_agevolato"
        | "garanzia"
        | "misto"
      invoice_direction: "attiva" | "passiva"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      iva_frequency: "mensile" | "trimestrale" | "annuale"
      loan_rate_type: "fisso" | "variabile" | "misto"
      opportunity_status:
        | "new"
        | "in_review"
        | "simulated"
        | "applied"
        | "dismissed"
      regime_fiscale: "ordinario" | "semplificato" | "forfettario" | "agricolo"
      simulation_status: "draft" | "reviewed" | "promoted" | "archived"
      tax_confidence: "high" | "medium" | "low"
      tax_status: "upcoming" | "paid" | "overdue"
      transaction_status: "pending" | "confirmed" | "reconciled"
      transaction_type: "entrata" | "uscita"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_request_status: ["pending", "approved", "rejected", "expired"],
      app_role: ["owner", "admin", "accountant", "viewer"],
      company_type: [
        "srl",
        "srls",
        "spa",
        "sapa",
        "snc",
        "sas",
        "ditta_individuale",
        "cooperativa",
        "altro",
      ],
      contract_status: [
        "active",
        "expiring_soon",
        "expired",
        "under_renegotiation",
      ],
      diagnosis_severity: ["critical", "warning", "info"],
      grant_type: [
        "fondo_perduto",
        "credito_imposta",
        "finanziamento_agevolato",
        "garanzia",
        "misto",
      ],
      invoice_direction: ["attiva", "passiva"],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      iva_frequency: ["mensile", "trimestrale", "annuale"],
      loan_rate_type: ["fisso", "variabile", "misto"],
      opportunity_status: [
        "new",
        "in_review",
        "simulated",
        "applied",
        "dismissed",
      ],
      regime_fiscale: ["ordinario", "semplificato", "forfettario", "agricolo"],
      simulation_status: ["draft", "reviewed", "promoted", "archived"],
      tax_confidence: ["high", "medium", "low"],
      tax_status: ["upcoming", "paid", "overdue"],
      transaction_status: ["pending", "confirmed", "reconciled"],
      transaction_type: ["entrata", "uscita"],
    },
  },
} as const
