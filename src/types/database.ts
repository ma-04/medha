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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attempt_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          question_id: string
          selected_key: string
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          question_id: string
          selected_key: string
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          question_id?: string
          selected_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          correct_count: number | null
          deadline: string
          exam_id: string
          id: string
          rank: number | null
          score: number | null
          skipped_count: number | null
          started_at: string
          subject_breakdown: Json | null
          submitted_at: string | null
          user_id: string
          wrong_count: number | null
        }
        Insert: {
          correct_count?: number | null
          deadline: string
          exam_id: string
          id?: string
          rank?: number | null
          score?: number | null
          skipped_count?: number | null
          started_at?: string
          subject_breakdown?: Json | null
          submitted_at?: string | null
          user_id: string
          wrong_count?: number | null
        }
        Update: {
          correct_count?: number | null
          deadline?: string
          exam_id?: string
          id?: string
          rank?: number | null
          score?: number | null
          skipped_count?: number | null
          started_at?: string
          subject_breakdown?: Json | null
          submitted_at?: string | null
          user_id?: string
          wrong_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          exam_id: string
          order_index: number
          question_id: string
          subject_id: string
        }
        Insert: {
          exam_id: string
          order_index?: number
          question_id: string
          subject_id: string
        }
        Update: {
          exam_id?: string
          order_index?: number
          question_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          pattern: Json
          results_published_at: string | null
          starts_at: string | null
          status: string
          title_bn: string
          title_en: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          pattern?: Json
          results_published_at?: string | null
          starts_at?: string | null
          status?: string
          title_bn: string
          title_en: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          pattern?: Json
          results_published_at?: string | null
          starts_at?: string | null
          status?: string
          title_bn?: string
          title_en?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_answers: {
        Row: {
          answered_at: string
          id: number
          is_correct: boolean
          question_id: string
          selected_key: string
          topic_id: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          id?: never
          is_correct: boolean
          question_id: string
          selected_key: string
          topic_id: string
          user_id: string
        }
        Update: {
          answered_at?: string
          id?: never
          is_correct?: boolean
          question_id?: string
          selected_key?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_answers_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          plan: string
          preferred_locale: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          plan?: string
          preferred_locale?: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          plan?: string
          preferred_locale?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_answers: {
        Row: {
          correct_key: string
          question_id: string
        }
        Insert: {
          correct_key: string
          question_id: string
        }
        Update: {
          correct_key?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          body: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          difficulty: number | null
          explanation: string | null
          id: string
          image_url: string | null
          options: Json
          search_vector: unknown
          source_exam: string | null
          source_label: string | null
          source_year: number | null
          status: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          body: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          options: Json
          search_vector?: unknown
          source_exam?: string | null
          source_label?: string | null
          source_year?: number | null
          status?: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          options?: Json
          search_vector?: unknown
          source_exam?: string | null
          source_label?: string | null
          source_year?: number | null
          status?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          name_bn: string
          name_en: string
          order_index: number
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_bn: string
          name_en: string
          order_index?: number
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name_bn?: string
          name_en?: string
          order_index?: number
          slug?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          id: string
          name_bn: string
          name_en: string
          order_index: number
          slug: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_bn: string
          name_en: string
          order_index?: number
          slug: string
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name_bn?: string
          name_en?: string
          order_index?: number
          slug?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_user_topic_stats: {
        Row: {
          attempts: number | null
          correct: number | null
          topic_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_answers_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _grade_attempt: { Args: { p_attempt_id: string }; Returns: undefined }
      admin_set_exam_questions: {
        Args: { p_exam_id: string; p_question_ids: string[] }
        Returns: number
      }
      admin_upsert_question: {
        Args: {
          p_body: string
          p_correct_key: string
          p_difficulty?: number
          p_explanation?: string
          p_id?: string
          p_image_url?: string
          p_options: Json
          p_source_exam?: string
          p_source_label?: string
          p_source_year?: number
          p_status?: string
          p_topic_id: string
        }
        Returns: string
      }
      auto_finalize_live: { Args: never; Returns: undefined }
      auto_submit_expired: { Args: never; Returns: undefined }
      can_author: { Args: never; Returns: boolean }
      check_practice_answer: {
        Args: { p_question_id: string; p_selected_key: string }
        Returns: {
          correct_key: string
          explanation: string
          is_correct: boolean
        }[]
      }
      finalize_live_exam: { Args: { p_exam_id: string }; Returns: number }
      get_attempt_review: {
        Args: { p_attempt_id: string }
        Returns: {
          body: string
          correct_key: string
          explanation: string
          image_url: string
          is_correct: boolean
          options: Json
          order_index: number
          question_id: string
          selected_key: string
          subject_id: string
        }[]
      }
      get_leaderboard: {
        Args: { p_exam_id: string }
        Returns: {
          full_name: string
          is_self: boolean
          rank: number
          score: number
          user_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      reveal_answer: {
        Args: { p_question_id: string }
        Returns: {
          correct_key: string
          explanation: string
        }[]
      }
      save_answer: {
        Args: {
          p_attempt_id: string
          p_question_id: string
          p_selected_key: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_exam_attempt: { Args: { p_exam_id: string }; Returns: Json }
      submit_attempt: { Args: { p_attempt_id: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
