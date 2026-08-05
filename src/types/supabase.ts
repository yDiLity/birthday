export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      congratulations_usage: {
        Row: {
          created_at: string | null;
          id: string;
          updated_at: string | null;
          used_ids: string[];
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          updated_at?: string | null;
          used_ids?: string[];
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          updated_at?: string | null;
          used_ids?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      congratulations: {
        Row: {
          created_at: string | null;
          id: string;
          text: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          text: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          text?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          birth_date: string;
          created_at: string | null;
          id: string;
          name: string;
          notes: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          birth_date: string;
          created_at?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          birth_date?: string;
          created_at?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          contact_id: string;
          created_at: string | null;
          id: string;
          sent_date: string;
          user_id: string;
        };
        Insert: {
          contact_id: string;
          created_at?: string | null;
          id?: string;
          sent_date: string;
          user_id: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string | null;
          id?: string;
          sent_date?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      telegram_pairings: {
        Row: {
          chat_id: string | null;
          code: string;
          created_at: string | null;
          id: string;
          telegram_id: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          chat_id?: string | null;
          code: string;
          created_at?: string | null;
          id?: string;
          telegram_id?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          chat_id?: string | null;
          code?: string;
          created_at?: string | null;
          id?: string;
          telegram_id?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      telegram_settings: {
        Row: {
          bot_token: string | null;
          chat_id: string;
          created_at: string | null;
          days_before: number | null;
          id: string;
          is_active: boolean | null;
          message_template: string | null;
          notification_time: string | null;
          timezone: string | null;
          updated_at: string | null;
          use_random_congratulations: boolean | null;
          user_id: string;
        };
        Insert: {
          bot_token?: string | null;
          chat_id: string;
          created_at?: string | null;
          days_before?: number | null;
          id?: string;
          is_active?: boolean | null;
          message_template?: string | null;
          notification_time?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          use_random_congratulations?: boolean | null;
          user_id: string;
        };
        Update: {
          bot_token?: string | null;
          chat_id?: string;
          created_at?: string | null;
          days_before?: number | null;
          id?: string;
          is_active?: boolean | null;
          message_template?: string | null;
          notification_time?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          use_random_congratulations?: boolean | null;
          user_id?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          credits: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          image: string | null;
          name: string | null;
          subscription: string | null;
          token_identifier: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          credits?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          image?: string | null;
          name?: string | null;
          subscription?: string | null;
          token_identifier: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          credits?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          image?: string | null;
          name?: string | null;
          subscription?: string | null;
          token_identifier?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_my_telegram_settings: {
        Args: Record<string, never>;
        Returns: {
          bot_token: string | null;
          chat_id: string;
          created_at: string | null;
          days_before: number | null;
          id: string;
          is_active: boolean | null;
          message_template: string | null;
          notification_time: string | null;
          timezone: string | null;
          updated_at: string | null;
          use_random_congratulations: boolean | null;
          user_id: string;
        };
      };
      pick_random_congratulation: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          id: string;
          text: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;
