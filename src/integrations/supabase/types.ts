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
      admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          account_email: string | null
          agent_email: string | null
          agent_ref: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          agent_email?: string | null
          agent_ref?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          agent_email?: string | null
          agent_ref?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      case_messages: {
        Row: {
          answered_at: string | null
          attachments: Json
          author_id: string
          author_name: string
          body: string
          call_slots: Json
          case_id: string
          case_kind: string
          chosen_slot: string | null
          client_user_id: string
          created_at: string
          event_id: string | null
          event_link: string | null
          from_loqal: boolean
          id: string
          kind: string
          meet_url: string | null
          read_by_client_at: string | null
          read_by_loqal_at: string | null
          reply_to: string | null
        }
        Insert: {
          answered_at?: string | null
          attachments?: Json
          author_id?: string
          author_name?: string
          body?: string
          call_slots?: Json
          case_id: string
          case_kind: string
          chosen_slot?: string | null
          client_user_id: string
          created_at?: string
          event_id?: string | null
          event_link?: string | null
          from_loqal?: boolean
          id?: string
          kind?: string
          meet_url?: string | null
          read_by_client_at?: string | null
          read_by_loqal_at?: string | null
          reply_to?: string | null
        }
        Update: {
          answered_at?: string | null
          attachments?: Json
          author_id?: string
          author_name?: string
          body?: string
          call_slots?: Json
          case_id?: string
          case_kind?: string
          chosen_slot?: string | null
          client_user_id?: string
          created_at?: string
          event_id?: string | null
          event_link?: string | null
          from_loqal?: boolean
          id?: string
          kind?: string
          meet_url?: string | null
          read_by_client_at?: string | null
          read_by_loqal_at?: string | null
          reply_to?: string | null
        }
        Relationships: []
      }
      client_profiles: {
        Row: {
          created_at: string
          first_name: string
          last_name: string
          middle_name: string | null
          phone: string
          updated_at: string
          us_person: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name?: string
          last_name?: string
          middle_name?: string | null
          phone?: string
          updated_at?: string
          us_person?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          last_name?: string
          middle_name?: string | null
          phone?: string
          updated_at?: string
          us_person?: boolean
          user_id?: string
        }
        Relationships: []
      }
      entity_setup_requests: {
        Row: {
          client_name: string
          created_at: string
          email: string
          history: Json
          id: string
          lead_id: string | null
          property_label: string | null
          requested_at: string
          status: string
          status_note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string
          created_at?: string
          email: string
          history?: Json
          id?: string
          lead_id?: string | null
          property_label?: string | null
          requested_at?: string
          status?: string
          status_note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string
          created_at?: string
          email?: string
          history?: Json
          id?: string
          lead_id?: string | null
          property_label?: string | null
          requested_at?: string
          status?: string
          status_note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_requests: {
        Row: {
          additional_contacts: Json
          admin_requests: Json
          agreement_countersigned_at: string | null
          agreement_countersigned_by: string | null
          agreement_countersigned_title: string | null
          agreement_signed_at: string | null
          agreement_signed_by: string | null
          all_states: boolean
          city: string
          company_licence: string | null
          company_name: string
          company_phone: string | null
          company_type: string
          country: string
          created_at: string
          decided_at: string | null
          email: string
          first_name: string
          id: string
          kind: string
          kyc: Json | null
          languages: string[]
          last_name: string
          lender_licence: string | null
          lender_licenses: Json
          partner_type: string | null
          phone: string
          position: string
          profile_change_requests: Json
          realtor_licenses: Json
          realtor_verification: Json | null
          registration_number: string
          review_note: string | null
          review_stage: string
          review_updated_at: string | null
          reviewer_id: string | null
          reviewer_name: string | null
          state: string
          states: string[]
          status: string
          street: string
          submitted_at: string
          tc_accepted_at: string | null
          updated_at: string
          user_id: string
          verification_docs: string[]
          zip: string
        }
        Insert: {
          additional_contacts?: Json
          admin_requests?: Json
          agreement_countersigned_at?: string | null
          agreement_countersigned_by?: string | null
          agreement_countersigned_title?: string | null
          agreement_signed_at?: string | null
          agreement_signed_by?: string | null
          all_states?: boolean
          city?: string
          company_licence?: string | null
          company_name?: string
          company_phone?: string | null
          company_type?: string
          country?: string
          created_at?: string
          decided_at?: string | null
          email?: string
          first_name?: string
          id?: string
          kind: string
          kyc?: Json | null
          languages?: string[]
          last_name?: string
          lender_licence?: string | null
          lender_licenses?: Json
          partner_type?: string | null
          phone?: string
          position?: string
          profile_change_requests?: Json
          realtor_licenses?: Json
          realtor_verification?: Json | null
          registration_number?: string
          review_note?: string | null
          review_stage?: string
          review_updated_at?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          state?: string
          states?: string[]
          status?: string
          street?: string
          submitted_at?: string
          tc_accepted_at?: string | null
          updated_at?: string
          user_id: string
          verification_docs?: string[]
          zip?: string
        }
        Update: {
          additional_contacts?: Json
          admin_requests?: Json
          agreement_countersigned_at?: string | null
          agreement_countersigned_by?: string | null
          agreement_countersigned_title?: string | null
          agreement_signed_at?: string | null
          agreement_signed_by?: string | null
          all_states?: boolean
          city?: string
          company_licence?: string | null
          company_name?: string
          company_phone?: string | null
          company_type?: string
          country?: string
          created_at?: string
          decided_at?: string | null
          email?: string
          first_name?: string
          id?: string
          kind?: string
          kyc?: Json | null
          languages?: string[]
          last_name?: string
          lender_licence?: string | null
          lender_licenses?: Json
          partner_type?: string | null
          phone?: string
          position?: string
          profile_change_requests?: Json
          realtor_licenses?: Json
          realtor_verification?: Json | null
          registration_number?: string
          review_note?: string | null
          review_stage?: string
          review_updated_at?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          state?: string
          states?: string[]
          status?: string
          street?: string
          submitted_at?: string
          tc_accepted_at?: string | null
          updated_at?: string
          user_id?: string
          verification_docs?: string[]
          zip?: string
        }
        Relationships: []
      }
      profile_deletions: {
        Row: {
          close_note: string | null
          closed_at: string | null
          closed_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          email: string
          id: string
          name: string
          reason: string
          recoverable_until: string | null
          requested_at: string
          requested_by: string
          role_label: string
          self_requested: boolean
          status: string
        }
        Insert: {
          close_note?: string | null
          closed_at?: string | null
          closed_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string
          reason?: string
          recoverable_until?: string | null
          requested_at?: string
          requested_by?: string
          role_label?: string
          self_requested?: boolean
          status?: string
        }
        Update: {
          close_note?: string | null
          closed_at?: string | null
          closed_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          reason?: string
          recoverable_until?: string | null
          requested_at?: string
          requested_by?: string
          role_label?: string
          self_requested?: boolean
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visa_support_requests: {
        Row: {
          citizenship: string | null
          client_name: string
          country_of_residence: string | null
          created_at: string
          email: string
          history: Json
          id: string
          requested_at: string
          status: string
          status_note: string | null
          updated_at: string
          user_id: string
          visa_partner: Json | null
        }
        Insert: {
          citizenship?: string | null
          client_name?: string
          country_of_residence?: string | null
          created_at?: string
          email: string
          history?: Json
          id?: string
          requested_at?: string
          status?: string
          status_note?: string | null
          updated_at?: string
          user_id: string
          visa_partner?: Json | null
        }
        Update: {
          citizenship?: string | null
          client_name?: string
          country_of_residence?: string | null
          created_at?: string
          email?: string
          history?: Json
          id?: string
          requested_at?: string
          status?: string
          status_note?: string | null
          updated_at?: string
          user_id?: string
          visa_partner?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "lender"
        | "realtor"
        | "partner"
        | "corporate"
        | "client"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "admin",
        "lender",
        "realtor",
        "partner",
        "corporate",
        "client",
      ],
    },
  },
} as const
