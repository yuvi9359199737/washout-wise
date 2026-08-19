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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          summary: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      drug_dictionary: {
        Row: {
          atc_code: string | null
          common_misspellings: string[]
          created_at: string
          half_life_hours: number | null
          id: string
          preferred_name: string
          source: string
          trade_names: string[]
        }
        Insert: {
          atc_code?: string | null
          common_misspellings?: string[]
          created_at?: string
          half_life_hours?: number | null
          id?: string
          preferred_name: string
          source?: string
          trade_names?: string[]
        }
        Update: {
          atc_code?: string | null
          common_misspellings?: string[]
          created_at?: string
          half_life_hours?: number | null
          id?: string
          preferred_name?: string
          source?: string
          trade_names?: string[]
        }
        Relationships: []
      }
      patient_medications: {
        Row: {
          clearance_date: string | null
          created_at: string
          dose: string | null
          drug_dictionary_id: string | null
          drug_name_raw: string
          frequency: string | null
          id: string
          is_prohibited: boolean
          last_dose_date: string | null
          patient_id: string
          protocol_deviation_risk: Database["public"]["Enums"]["risk_level"]
        }
        Insert: {
          clearance_date?: string | null
          created_at?: string
          dose?: string | null
          drug_dictionary_id?: string | null
          drug_name_raw: string
          frequency?: string | null
          id?: string
          is_prohibited?: boolean
          last_dose_date?: string | null
          patient_id: string
          protocol_deviation_risk?: Database["public"]["Enums"]["risk_level"]
        }
        Update: {
          clearance_date?: string | null
          created_at?: string
          dose?: string | null
          drug_dictionary_id?: string | null
          drug_name_raw?: string
          frequency?: string | null
          id?: string
          is_prohibited?: boolean
          last_dose_date?: string | null
          patient_id?: string
          protocol_deviation_risk?: Database["public"]["Enums"]["risk_level"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_medications_drug_dictionary_id_fkey"
            columns: ["drug_dictionary_id"]
            isOneToOne: false
            referencedRelation: "drug_dictionary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number | null
          created_at: string
          enrollment_date: string | null
          gender: string | null
          id: string
          pseudonym: string | null
          status: Database["public"]["Enums"]["patient_status"]
          study_id: string
          study_id_number: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          enrollment_date?: string | null
          gender?: string | null
          id?: string
          pseudonym?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          study_id: string
          study_id_number: string
        }
        Update: {
          age?: number | null
          created_at?: string
          enrollment_date?: string | null
          gender?: string | null
          id?: string
          pseudonym?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          study_id?: string
          study_id_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      prohibited_drugs: {
        Row: {
          atc_code: string | null
          created_at: string
          drug_name: string
          id: string
          reason: string | null
          study_id: string
          washout_days_required: number
        }
        Insert: {
          atc_code?: string | null
          created_at?: string
          drug_name: string
          id?: string
          reason?: string | null
          study_id: string
          washout_days_required?: number
        }
        Update: {
          atc_code?: string | null
          created_at?: string
          drug_name?: string
          id?: string
          reason?: string | null
          study_id?: string
          washout_days_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "prohibited_drugs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      studies: {
        Row: {
          created_at: string
          id: string
          indication: string | null
          name: string
          phase: string | null
          pi_id: string | null
          protocol_number: string
          status: Database["public"]["Enums"]["study_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          indication?: string | null
          name: string
          phase?: string | null
          pi_id?: string | null
          protocol_number: string
          status?: Database["public"]["Enums"]["study_status"]
        }
        Update: {
          created_at?: string
          id?: string
          indication?: string | null
          name?: string
          phase?: string | null
          pi_id?: string | null
          protocol_number?: string
          status?: Database["public"]["Enums"]["study_status"]
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
      washout_calculations: {
        Row: {
          calculated_at: string
          calculated_by: string | null
          clearance_date: string | null
          drug_dictionary_id: string | null
          half_life_used: number | null
          id: string
          last_dose_date: string | null
          patient_medication_id: string | null
          risk: Database["public"]["Enums"]["risk_level"]
          status: string | null
        }
        Insert: {
          calculated_at?: string
          calculated_by?: string | null
          clearance_date?: string | null
          drug_dictionary_id?: string | null
          half_life_used?: number | null
          id?: string
          last_dose_date?: string | null
          patient_medication_id?: string | null
          risk?: Database["public"]["Enums"]["risk_level"]
          status?: string | null
        }
        Update: {
          calculated_at?: string
          calculated_by?: string | null
          clearance_date?: string | null
          drug_dictionary_id?: string | null
          half_life_used?: number | null
          id?: string
          last_dose_date?: string | null
          patient_medication_id?: string | null
          risk?: Database["public"]["Enums"]["risk_level"]
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "washout_calculations_drug_dictionary_id_fkey"
            columns: ["drug_dictionary_id"]
            isOneToOne: false
            referencedRelation: "drug_dictionary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "washout_calculations_patient_medication_id_fkey"
            columns: ["patient_medication_id"]
            isOneToOne: false
            referencedRelation: "patient_medications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "coordinator" | "pi" | "cra"
      patient_status: "screening" | "enrolled" | "completed" | "dropped"
      risk_level: "low" | "medium" | "high" | "unknown"
      study_status: "active" | "completed" | "on-hold"
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
      app_role: ["admin", "coordinator", "pi", "cra"],
      patient_status: ["screening", "enrolled", "completed", "dropped"],
      risk_level: ["low", "medium", "high", "unknown"],
      study_status: ["active", "completed", "on-hold"],
    },
  },
} as const
