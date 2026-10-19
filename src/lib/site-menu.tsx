import { createContext, useContext, useState, type ReactNode } from "react";

/** Open state of the store's slide-in menu, shared by the header (☰) and the mobile bottom bar. */
const Ctx = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

export function SiteMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function useSiteMenu() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSiteMenu outside SiteMenuProvider");
  return c;
}
