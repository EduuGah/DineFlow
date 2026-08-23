/**
 * Tipos do banco no formato gerado pelo Supabase CLI.
 *
 * Regenere com `npm run db:types` sempre que criar uma migration -- este
 * arquivo e mantido a mao apenas enquanto não há um Supabase local rodando.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          timezone: string;
          status: Database["public"]["Enums"]["restaurant_status"];
          plan: string;
          trial_ends_at: string | null;
          onboarding_completed_at: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          timezone?: string;
          status?: Database["public"]["Enums"]["restaurant_status"];
          plan?: string;
          trial_ends_at?: string | null;
          onboarding_completed_at?: string | null;
          settings?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["restaurants"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          restaurant_id: string | null;
          name: string;
          email: string;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["user_status"];
          phone: string | null;
          avatar_url: string | null;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          restaurant_id?: string | null;
          name: string;
          email: string;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["user_status"];
          phone?: string | null;
          avatar_url?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["users"]["Insert"], "id">> & {
          last_seen_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "users_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      tables: {
        Row: {
          id: string;
          restaurant_id: string;
          number: number;
          name: string | null;
          capacity: number;
          status: Database["public"]["Enums"]["table_status"];
          area: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          number: number;
          name?: string | null;
          capacity?: number;
          status?: Database["public"]["Enums"]["table_status"];
          area?: string | null;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["tables"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description: string | null;
          position: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          description?: string | null;
          position?: number;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          restaurant_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number;
          image_url: string | null;
          active: boolean;
          available: boolean;
          prep_minutes: number | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price: number;
          image_url?: string | null;
          active?: boolean;
          available?: boolean;
          prep_minutes?: number | null;
          position?: number;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "products_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_same_restaurant";
            columns: ["restaurant_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["restaurant_id", "id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          restaurant_id: string;
          number: number;
          business_date: string;
          table_id: string;
          waiter_id: string;
          status: Database["public"]["Enums"]["order_status"];
          notes: string | null;
          client_request_id: string;
          items_count: number;
          total: number;
          cancellation_reason: Database["public"]["Enums"]["cancellation_reason"] | null;
          cancellation_note: string | null;
          cancelled_by: string | null;
          created_at: string;
          updated_at: string;
          sent_at: string | null;
          received_at: string | null;
          started_at: string | null;
          ready_at: string | null;
          delivered_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          table_id: string;
          waiter_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          notes?: string | null;
          client_request_id?: string;
        };
        Update: {
          status?: Database["public"]["Enums"]["order_status"];
          notes?: string | null;
          table_id?: string;
          cancellation_reason?: Database["public"]["Enums"]["cancellation_reason"] | null;
          cancellation_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_table_same_restaurant";
            columns: ["restaurant_id", "table_id"];
            isOneToOne: false;
            referencedRelation: "tables";
            referencedColumns: ["restaurant_id", "id"];
          },
          {
            foreignKeyName: "orders_waiter_same_restaurant";
            columns: ["restaurant_id", "waiter_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["restaurant_id", "id"];
          },
          {
            foreignKeyName: "orders_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          restaurant_id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          notes: string | null;
          batch: number;
          status: Database["public"]["Enums"]["order_item_status"];
          sent_at: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          order_id: string;
          product_id: string;
          /** Sobrescrito pelo trigger com o nome atual do cardápio. */
          product_name: string;
          quantity: number;
          /** Sobrescrito pelo trigger com o preço atual do cardápio. */
          unit_price: number;
          notes?: string | null;
          /** Sobrescrito pelo trigger com a rodada aberta do pedido. */
          batch: number;
        };
        Update: {
          quantity?: number;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_same_restaurant";
            columns: ["restaurant_id", "order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["restaurant_id", "id"];
          },
          {
            foreignKeyName: "order_items_product_same_restaurant";
            columns: ["restaurant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["restaurant_id", "id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          restaurant_id: string;
          user_id: string;
          order_id: string | null;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          message: string;
          metadata: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [
          {
            foreignKeyName: "notifications_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: number;
          restaurant_id: string | null;
          user_id: string | null;
          actor_name: string | null;
          actor_role: Database["public"]["Enums"]["user_role"] | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_invitations: {
        Row: {
          id: string;
          restaurant_id: string;
          email: string;
          role: Database["public"]["Enums"]["user_role"];
          invited_by: string | null;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          email: string;
          role: Database["public"]["Enums"]["user_role"];
          invited_by?: string | null;
        };
        Update: {
          role?: Database["public"]["Enums"]["user_role"];
          accepted_at?: string | null;
          accepted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staff_invitations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      order_counters: {
        Row: { restaurant_id: string; business_date: string; last_number: number };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "order_counters_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_restaurant: {
        Args: { p_name: string };
        Returns: string;
      };
      pending_invitations: {
        Args: Record<never, never>;
        Returns: Database["public"]["Tables"]["staff_invitations"]["Row"][];
      };
      dashboard_summary: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: Json;
      };
      top_products: {
        Args: { p_from?: string | null; p_to?: string | null; p_limit?: number };
        Returns: {
          product_id: string;
          product_name: string;
          quantity: number;
          revenue: number;
        }[];
      };
      onboarding_status: {
        Args: Record<never, never>;
        Returns: Json;
      };
    };
    Enums: {
      user_role: "waiter" | "kitchen" | "manager" | "admin" | "platform_admin";
      user_status: "invited" | "active" | "inactive";
      restaurant_status: "trial" | "active" | "suspended" | "cancelled";
      table_status: "available" | "occupied" | "waiting" | "ready" | "closed";
      order_status:
        | "draft"
        | "sent"
        | "received"
        | "preparing"
        | "ready"
        | "delivered"
        | "completed"
        | "cancelled";
      order_item_status: "draft" | "sent" | "preparing" | "ready" | "delivered" | "cancelled";
      cancellation_reason:
        "customer_gave_up" | "waiter_error" | "product_unavailable" | "duplicate" | "other";
      notification_type:
        | "order_sent"
        | "order_received"
        | "order_preparing"
        | "order_ready"
        | "order_delivered"
        | "order_completed"
        | "order_cancelled"
        | "order_complement";
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
