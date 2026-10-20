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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_published: boolean
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          deducted_qty: number
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
          variant: string | null
        }
        Insert: {
          deducted_qty?: number
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
          variant?: string | null
        }
        Update: {
          deducted_qty?: number
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          admin_notes: string | null
          city: string
          created_at: string
          currency: string
          customer_name: string
          delivery_fee: number
          id: string
          notes: string | null
          order_number: string
          phone: string
          status: Database["public"]["Enums"]["order_status"]
          stock_deducted: boolean
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          address: string
          admin_notes?: string | null
          city: string
          created_at?: string
          currency?: string
          customer_name: string
          delivery_fee?: number
          id?: string
          notes?: string | null
          order_number?: string
          phone: string
          status?: Database["public"]["Enums"]["order_status"]
          stock_deducted?: boolean
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          address?: string
          admin_notes?: string | null
          city?: string
          created_at?: string
          currency?: string
          customer_name?: string
          delivery_fee?: number
          id?: string
          notes?: string | null
          order_number?: string
          phone?: string
          status?: Database["public"]["Enums"]["order_status"]
          stock_deducted?: boolean
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          availability: string
          category_id: string | null
          colors: string[]
          created_at: string
          depth_cm: number | null
          description: string | null
          finishes: string[]
          height_cm: number | null
          id: string
          images: string[]
          is_bestseller: boolean
          is_featured: boolean
          is_published: boolean
          materials: string | null
          name: string
          price: number
          sale_price: number | null
          seo_description: string | null
          seo_title: string | null
          sizes: Json
          sku: string | null
          slug: string
          stock: number
          updated_at: string
          width_cm: number | null
        }
        Insert: {
          availability?: string
          category_id?: string | null
          colors?: string[]
          created_at?: string
          depth_cm?: number | null
          description?: string | null
          finishes?: string[]
          height_cm?: number | null
          id?: string
          images?: string[]
          is_bestseller?: boolean
          is_featured?: boolean
          is_published?: boolean
          materials?: string | null
          name: string
          price: number
          sale_price?: number | null
          seo_description?: string | null
          seo_title?: string | null
          sizes?: Json
          sku?: string | null
          slug: string
          stock?: number
          updated_at?: string
          width_cm?: number | null
        }
        Update: {
          availability?: string
          category_id?: string | null
          colors?: string[]
          created_at?: string
          depth_cm?: number | null
          description?: string | null
          finishes?: string[]
          height_cm?: number | null
          id?: string
          images?: string[]
          is_bestseller?: boolean
          is_featured?: boolean
          is_published?: boolean
          materials?: string | null
          name?: string
          price?: number
          sale_price?: number | null
          seo_description?: string | null
          seo_title?: string | null
          sizes?: Json
          sku?: string | null
          slug?: string
          stock?: number
          updated_at?: string
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          currency: string
          delivery_fee: number
          facebook_url: string | null
          hero_image_url: string | null
          hero_subtitle: string
          hero_title: string
          home_config: Json
          id: number
          instagram_url: string | null
          policies: string | null
          promo_banner: string | null
          seo: Json
          snapchat_url: string | null
          store_name: string
          story_body: string
          story_title: string
          twitter_url: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          delivery_fee?: number
          facebook_url?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string
          hero_title?: string
          home_config?: Json
          id?: number
          instagram_url?: string | null
          policies?: string | null
          promo_banner?: string | null
          seo?: Json
          snapchat_url?: string | null
          store_name?: string
          story_body?: string
          story_title?: string
          twitter_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          delivery_fee?: number
          facebook_url?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string
          hero_title?: string
          home_config?: Json
          id?: number
          instagram_url?: string | null
          policies?: string | null
          promo_banner?: string | null
          seo?: Json
          snapchat_url?: string | null
          store_name?: string
          story_body?: string
          story_title?: string
          twitter_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          body: string
          city: string | null
          created_at: string
          customer_name: string
          id: string
          is_published: boolean
          rating: number
          sort_order: number
        }
        Insert: {
          body: string
          city?: string | null
          created_at?: string
          customer_name: string
          id?: string
          is_published?: boolean
          rating?: number
          sort_order?: number
        }
        Update: {
          body?: string
          city?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          is_published?: boolean
          rating?: number
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      place_order: {
        Args: {
          _customer: Json
          _items: Json
        }
        Returns: string
      }
      set_order_status: {
        Args: {
          _order_id: string
          _status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin"
      order_status: "new" | "confirmed" | "in_production" | "delivered" | "cancelled"
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
      app_role: ["admin"],
      order_status: ["new", "confirmed", "in_production", "delivered", "cancelled"],
    },
  },
} as const
