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
          activity_start_date: string | null
          activity_status: string | null
          annual_revenue: number | null
          ateco: string | null
          ateco_description: string | null
          cashflow_alert_threshold: number | null
          chamber_of_commerce: string | null
          city: string | null
          company_type: Database["public"]["Enums"]["company_type"] | null
          created_at: string
          created_by: string
          data_source: string
          employees_count: number | null
          fiscal_code: string | null
          founded_year: number | null
          id: string
          iso_certifications: Json
          iva_frequency: Database["public"]["Enums"]["iva_frequency"] | null
          last_verified_at: string | null
          legal_address_street: string | null
          legal_form: string | null
          legal_name: string | null
          logo_url: string | null
          name: string
          pec_email: string | null
          province: string | null
          rea_code: string | null
          regime_fiscale: Database["public"]["Enums"]["regime_fiscale"] | null
          region: string | null
          require_accountant_approval: boolean
          sdi_code: string | null
          sector: string | null
          updated_at: string
          vat: string | null
          verification_provider: string | null
          zip_code: string | null
        }
        Insert: {
          accountant_approval_timeout_hours?: number
          activity_start_date?: string | null
          activity_status?: string | null
          annual_revenue?: number | null
          ateco?: string | null
          ateco_description?: string | null
          cashflow_alert_threshold?: number | null
          chamber_of_commerce?: string | null
          city?: string | null
          company_type?: Database["public"]["Enums"]["company_type"] | null
          created_at?: string
          created_by: string
          data_source?: string
          employees_count?: number | null
          fiscal_code?: string | null
          founded_year?: number | null
          id?: string
          iso_certifications?: Json
          iva_frequency?: Database["public"]["Enums"]["iva_frequency"] | null
          last_verified_at?: string | null
          legal_address_street?: string | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          pec_email?: string | null
          province?: string | null
          rea_code?: string | null
          regime_fiscale?: Database["public"]["Enums"]["regime_fiscale"] | null
          region?: string | null
          require_accountant_approval?: boolean
          sdi_code?: string | null
          sector?: string | null
          updated_at?: string
          vat?: string | null
          verification_provider?: string | null
          zip_code?: string | null
        }
        Update: {
          accountant_approval_timeout_hours?: number
          activity_start_date?: string | null
          activity_status?: string | null
          annual_revenue?: number | null
          ateco?: string | null
          ateco_description?: string | null
          cashflow_alert_threshold?: number | null
          chamber_of_commerce?: string | null
          city?: string | null
          company_type?: Database["public"]["Enums"]["company_type"] | null
          created_at?: string
          created_by?: string
          data_source?: string
          employees_count?: number | null
          fiscal_code?: string | null
          founded_year?: number | null
          id?: string
          iso_certifications?: Json
          iva_frequency?: Database["public"]["Enums"]["iva_frequency"] | null
          last_verified_at?: string | null
          legal_address_street?: string | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          pec_email?: string | null
          province?: string | null
          rea_code?: string | null
          regime_fiscale?: Database["public"]["Enums"]["regime_fiscale"] | null
          region?: string | null
          require_accountant_approval?: boolean
          sdi_code?: string | null
          sector?: string | null
          updated_at?: string
          vat?: string | null
          verification_provider?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          company_id: string
          created_at: string
          doc_type: string
          document_date: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          doc_type: string
          document_date?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          company_id?: string
          created_at?: string
          doc_type?: string
          document_date?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_field_sources: {
        Row: {
          company_id: string
          created_at: string
          field_name: string
          id: string
          provider: string | null
          source: string
          updated_at: string
          updated_by: string | null
          verified_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          field_name: string
          id?: string
          provider?: string | null
          source: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          field_name?: string
          id?: string
          provider?: string | null
          source?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_field_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      company_verifications: {
        Row: {
          company_id: string | null
          created_at: string
          error_message: string | null
          id: string
          provider: string
          raw_response: Json | null
          requested_by: string
          status: string
          vat_queried: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          provider: string
          raw_response?: Json | null
          requested_by: string
          status: string
          vat_queried: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string
          raw_response?: Json | null
          requested_by?: string
          status?: string
          vat_queried?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_verifications_company_id_fkey"
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
      deadlines: {
        Row: {
          actual_amount: number | null
          category: string | null
          company_id: string
          confidence: Database["public"]["Enums"]["tax_confidence"]
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          estimated_amount: number | null
          id: string
          is_demo: boolean
          kind: Database["public"]["Enums"]["deadline_kind"]
          notify_days_before: number
          paid_at: string | null
          recurrence: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          category?: string | null
          company_id: string
          confidence?: Database["public"]["Enums"]["tax_confidence"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          estimated_amount?: number | null
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["deadline_kind"]
          notify_days_before?: number
          paid_at?: string | null
          recurrence?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          category?: string | null
          company_id?: string
          confidence?: Database["public"]["Enums"]["tax_confidence"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          estimated_amount?: number | null
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["deadline_kind"]
          notify_days_before?: number
          paid_at?: string | null
          recurrence?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_company_id_fkey"
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
          is_demo: boolean
          issue_date: string | null
          notes: string | null
          notes_internal: string | null
          number: string | null
          paid_amount: number
          paid_date: string | null
          payment_method: string | null
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
          is_demo?: boolean
          issue_date?: string | null
          notes?: string | null
          notes_internal?: string | null
          number?: string | null
          paid_amount?: number
          paid_date?: string | null
          payment_method?: string | null
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
          is_demo?: boolean
          issue_date?: string | null
          notes?: string | null
          notes_internal?: string | null
          number?: string | null
          paid_amount?: number
          paid_date?: string | null
          payment_method?: string | null
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
          frequency: string
          id: string
          initial_amount: number
          installment: number | null
          is_demo: boolean
          lender: string | null
          name: string
          next_due_date: string | null
          notes: string | null
          paid_installments: number | null
          rate_type: Database["public"]["Enums"]["loan_rate_type"]
          rate_value: number | null
          residual: number
          start_date: string | null
          status: string
          total_installments: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date?: string | null
          frequency?: string
          id?: string
          initial_amount: number
          installment?: number | null
          is_demo?: boolean
          lender?: string | null
          name: string
          next_due_date?: string | null
          notes?: string | null
          paid_installments?: number | null
          rate_type?: Database["public"]["Enums"]["loan_rate_type"]
          rate_value?: number | null
          residual: number
          start_date?: string | null
          status?: string
          total_installments?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string | null
          frequency?: string
          id?: string
          initial_amount?: number
          installment?: number | null
          is_demo?: boolean
          lender?: string | null
          name?: string
          next_due_date?: string | null
          notes?: string | null
          paid_installments?: number | null
          rate_type?: Database["public"]["Enums"]["loan_rate_type"]
          rate_value?: number | null
          residual?: number
          start_date?: string | null
          status?: string
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
          ai_extractions_used: number
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_demo: boolean
          locale: string
          onboarding_completed: boolean
          phone: string | null
          two_factor_enabled: boolean
          updated_at: string
        }
        Insert: {
          ai_extractions_used?: number
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_demo?: boolean
          locale?: string
          onboarding_completed?: boolean
          phone?: string | null
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Update: {
          ai_extractions_used?: number
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_demo?: boolean
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
      transaction_categories: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_company_id_fkey"
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
          is_demo: boolean
          is_forecast: boolean
          origin: string
          payment_method: string | null
          reconciled: boolean
          recurrence: string | null
          source: string | null
          source_deadline_id: string | null
          source_invoice_id: string | null
          source_loan_id: string | null
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
          is_demo?: boolean
          is_forecast?: boolean
          origin?: string
          payment_method?: string | null
          reconciled?: boolean
          recurrence?: string | null
          source?: string | null
          source_deadline_id?: string | null
          source_invoice_id?: string | null
          source_loan_id?: string | null
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
          is_demo?: boolean
          is_forecast?: boolean
          origin?: string
          payment_method?: string | null
          reconciled?: boolean
          recurrence?: string | null
          source?: string | null
          source_deadline_id?: string | null
          source_invoice_id?: string | null
          source_loan_id?: string | null
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
          {
            foreignKeyName: "transactions_source_deadline_fkey"
            columns: ["source_deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_loan_id_fkey"
            columns: ["source_loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
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
      increment_ai_extractions: { Args: never; Returns: number }
      is_demo_user: { Args: never; Returns: boolean }
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
      deadline_kind: "tax" | "contract" | "payment" | "admin" | "other"
      diagnosis_severity: "critical" | "warning" | "info"
      grant_type:
        | "fondo_perduto"
        | "credito_imposta"
        | "finanziamento_agevolato"
        | "garanzia"
        | "misto"
      invoice_direction: "attiva" | "passiva"
      invoice_status:
        | "draft"
        | "sent"
        | "paid"
        | "overdue"
        | "cancelled"
        | "partially_paid"
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
      deadline_kind: ["tax", "contract", "payment", "admin", "other"],
      diagnosis_severity: ["critical", "warning", "info"],
      grant_type: [
        "fondo_perduto",
        "credito_imposta",
        "finanziamento_agevolato",
        "garanzia",
        "misto",
      ],
      invoice_direction: ["attiva", "passiva"],
      invoice_status: [
        "draft",
        "sent",
        "paid",
        "overdue",
        "cancelled",
        "partially_paid",
      ],
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
