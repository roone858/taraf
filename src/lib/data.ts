import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Settings = Database["public"]["Tables"]["store_settings"]["Row"];
export type Testimonial = Database["public"]["Tables"]["testimonials"]["Row"];
export type Faq = Database["public"]["Tables"]["faqs"]["Row"];

export const faqsQuery = queryOptions({
  queryKey: ["faqs"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("faqs")
      .select("*")
      .eq("is_published", true)
      .order("sort_order")
      .order("created_at");
    if (error) throw error;
    return data;
  },
});

export const testimonialsQuery = queryOptions({
  queryKey: ["testimonials"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("testimonials")
      .select("*")
      .eq("is_published", true)
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const featuredQuery = queryOptions({
  queryKey: ["products", "featured"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    return data;
  },
});

export const bestsellersQuery = queryOptions({
  queryKey: ["products", "bestsellers"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .eq("is_bestseller", true)
      .order("updated_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    return data;
  },
});

/** Published products with a sale price below the regular price, biggest discount first. */
export const onSaleQuery = queryOptions({
  queryKey: ["products", "on-sale"],
  queryFn: async () => {
    // PostgREST can't compare two columns, so fetch sale-priced rows and finish the filter here
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .not("sale_price", "is", null)
      .neq("availability", "unavailable")
      .limit(60);
    if (error) throw error;
    const discount = (p: (typeof data)[number]) => 1 - Number(p.sale_price) / Number(p.price);
    return data
      .filter((p) => Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price))
      .sort((a, b) => discount(b) - discount(a))
      .slice(0, 8);
  },
});

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, slug)")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
