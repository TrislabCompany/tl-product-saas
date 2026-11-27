// The theme context, its types and useTheme. The provider is in theme-provider.tsx, so that
// file exports only a component and keeps fast refresh.
import { createContext, useContext } from "react";
import type { CustomAccentSpec, DensityMode } from "@/components/theme/appearance-options";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  font: string;
  setFont: (id: string) => void;
  accent: string;
  setAccent: (id: string) => void;
  /** Currently configured custom accent spec — drives the live preview
   *  in the appearance UI even when a preset is selected. */
  customAccent: CustomAccentSpec;
  setCustomAccent: (spec: CustomAccentSpec) => void;
  density: DensityMode;
  setDensity: (next: DensityMode) => void;
  /** When true, forces reduced motion regardless of the OS setting. */
  reducedMotion: boolean;
  setReducedMotion: (next: boolean) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
