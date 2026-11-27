// The mobile navigation's context and hook, apart from its components so mobile-nav.tsx
// exports only components and keeps fast refresh.
import { createContext, useContext } from "react";

export type MobileNavContextValue = {
  open: boolean;
  setOpen: (next: boolean) => void;
};

export const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used within MobileNavProvider");
  return ctx;
}
