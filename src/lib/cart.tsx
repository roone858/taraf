import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  image?: string | undefined;
  variant?: string | undefined;
  unitPrice: number;
  quantity: number;
  maxQty?: number | undefined;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (item: CartItem) => void;
  setQty: (productId: string, variant: string | undefined, qty: number) => void;
  remove: (productId: string, variant: string | undefined) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "taraf-cart-v1";
const same = (a: CartItem, id: string, v?: string) => a.productId === id && (a.variant ?? "") === (v ?? "");
const clamp = (q: number, max?: number) => Math.max(1, Math.min(q, max && max > 0 ? max : 99));

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, loaded]);

  const value: CartCtx = {
    items,
    open,
    setOpen,
    count: items.reduce((s, i) => s + i.quantity, 0),
    subtotal: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    add: (item) =>
      setItems((prev) => {
        const ex = prev.find((p) => same(p, item.productId, item.variant));
        if (ex)
          return prev.map((p) =>
            same(p, item.productId, item.variant)
              ? { ...p, ...item, quantity: clamp(p.quantity + item.quantity, item.maxQty) }
              : p,
          );
        return [...prev, { ...item, quantity: clamp(item.quantity, item.maxQty) }];
      }),
    setQty: (id, v, q) =>
      setItems((prev) => prev.map((p) => (same(p, id, v) ? { ...p, quantity: clamp(q, p.maxQty) } : p))),
    remove: (id, v) => setItems((prev) => prev.filter((p) => !same(p, id, v))),
    clear: () => setItems([]),
    replace: setItems,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
