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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string | null
          id: string
          is_published: boolean
          title: string
        }
        Insert: {
          author_id: string
          author_role?: string
          body: string
          created_at?: string | null
          id?: string
          is_published?: boolean
          title: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string | null
          id?: string
          is_published?: boolean
          title?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          details: string | null
          id: string
          target_id: string | null
          timestamp: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          timestamp?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          favorite_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          favorite_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          favorite_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_favorite_id_fkey"
            columns: ["favorite_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          age: number | null
          citizenship: string | null
          created_at: string | null
          current_city: string | null
          current_state: string | null
          dob: string | null
          education_history: Json | null
          email: string | null
          expectations: string | null
          family_details: Json | null
          family_initials: string | null
          father_name: string | null
          father_phone: string | null
          father_work: string | null
          full_name: string
          gender: string | null
          height: string | null
          height_inches: number | null
          hide_email: boolean
          hide_phone: boolean
          id: string
          interests: string[] | null
          is_approved: boolean | null
          is_submitted: boolean | null
          is_test_data: boolean | null
          kovil: string | null
          linkedin_profile: string | null
          marital_status: string | null
          mother_name: string | null
          mother_phone: string | null
          mother_work: string | null
          native_place: string | null
          phone: string | null
          pirivu: string | null
          profession: string | null
          profile_photo_url: string | null
          rasi: string | null
          resident_country: string | null
          resident_status: string | null
          role: string | null
          siblings: string[] | null
          star: string | null
          updated_at: string | null
          workplace: string | null
        }
        Insert: {
          account_status?: string
          age?: number | null
          citizenship?: string | null
          created_at?: string | null
          current_city?: string | null
          current_state?: string | null
          dob?: string | null
          education_history?: Json | null
          email?: string | null
          expectations?: string | null
          family_details?: Json | null
          family_initials?: string | null
          father_name?: string | null
          father_phone?: string | null
          father_work?: string | null
          full_name: string
          gender?: string | null
          height?: string | null
          height_inches?: number | null
          hide_email?: boolean
          hide_phone?: boolean
          id?: string
          interests?: string[] | null
          is_approved?: boolean | null
          is_submitted?: boolean | null
          is_test_data?: boolean | null
          kovil?: string | null
          linkedin_profile?: string | null
          marital_status?: string | null
          mother_name?: string | null
          mother_phone?: string | null
          mother_work?: string | null
          native_place?: string | null
          phone?: string | null
          pirivu?: string | null
          profession?: string | null
          profile_photo_url?: string | null
          rasi?: string | null
          resident_country?: string | null
          resident_status?: string | null
          role?: string | null
          siblings?: string[] | null
          star?: string | null
          updated_at?: string | null
          workplace?: string | null
        }
        Update: {
          account_status?: string
          age?: number | null
          citizenship?: string | null
          created_at?: string | null
          current_city?: string | null
          current_state?: string | null
          dob?: string | null
          education_history?: Json | null
          email?: string | null
          expectations?: string | null
          family_details?: Json | null
          family_initials?: string | null
          father_name?: string | null
          father_phone?: string | null
          father_work?: string | null
          full_name?: string
          gender?: string | null
          height?: string | null
          height_inches?: number | null
          hide_email?: boolean
          hide_phone?: boolean
          id?: string
          interests?: string[] | null
          is_approved?: boolean | null
          is_submitted?: boolean | null
          is_test_data?: boolean | null
          kovil?: string | null
          linkedin_profile?: string | null
          marital_status?: string | null
          mother_name?: string | null
          mother_phone?: string | null
          mother_work?: string | null
          native_place?: string | null
          phone?: string | null
          pirivu?: string | null
          profession?: string | null
          profile_photo_url?: string | null
          rasi?: string | null
          resident_country?: string | null
          resident_status?: string | null
          role?: string | null
          siblings?: string[] | null
          star?: string | null
          updated_at?: string | null
          workplace?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: string | null
          target_id: string
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string | null
          target_id: string
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string | null
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_test_profiles: {
        Args: { num_users: number }
        Returns: undefined
      }
      get_favorite_profile_cards_v1: {
        Args: {
          p_cursor_created_at?: string
          p_cursor_favorite_id?: string
          p_page_size?: number
          p_user_id: string
        }
        Returns: {
          age: number
          current_city: string
          current_state: string
          fav_created_at: string
          full_name: string
          gender: string
          height_inches: number
          id: string
          kovil: string
          native_place: string
          pirivu: string
          profession: string
          profile_photo_url: string
          resident_country: string
          resident_status: string
          updated_at: string
        }[]
      }
      get_filter_metadata: { Args: never; Returns: Json }
      get_profile_by_id_v1: { Args: { p_id: string }; Returns: Json }
      get_profile_facets: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_moderator: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      purge_test_data:
        | { Args: never; Returns: number }
        | { Args: { batch_size?: number }; Returns: number }
      search_profile_cards_v1: {
        Args: {
          p_countries: string[]
          p_cursor_id: string
          p_cursor_updated_at: string
          p_education: string[]
          p_exclude_kovil_pirivu: string[]
          p_exclude_user_id: string
          p_forced_gender: string
          p_interests: string[]
          p_marital_statuses: string[]
          p_max_age: number
          p_max_height: number
          p_min_age: number
          p_min_height: number
          p_page_size: number
          p_query: string
        }
        Returns: {
          age: number
          current_city: string
          current_state: string
          full_name: string
          gender: string
          height_inches: number
          id: string
          kovil: string
          native_place: string
          pirivu: string
          profession: string
          profile_photo_url: string
          resident_country: string
          resident_status: string
          updated_at: string
        }[]
      }
      search_profiles_v2: {
        Args: {
          p_countries?: string[]
          p_cursor_id?: string
          p_cursor_updated_at?: string
          p_educations?: string[]
          p_exclude_kovil_pirivu?: string[]
          p_interests?: string[]
          p_marital_statuses?: string[]
          p_max_age?: number
          p_max_height?: number
          p_min_age?: number
          p_min_height?: number
          p_page_size?: number
          p_query?: string
        }
        Returns: {
          profile_data: Json
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "USER" | "MODERATOR" | "ADMIN"
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
      app_role: ["USER", "MODERATOR", "ADMIN"],
    },
  },
} as const
