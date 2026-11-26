import { apiFetch } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────
// Tenant theme / branding
//
// The theme endpoints are CURRENT-TENANT scoped server-side — they read the
// request's tenant (resolved from the caller's token) and act on that row.
// Unlike the admin app, the dashboard never targets a *different* tenant, so
// we send NO `tenant:` header: every call operates on the signed-in tenant.
//
// Types mirror clients/admin/src/api/tenants.ts (the two Vite apps duplicate
// by design — no cross-app imports). Keep the shapes in sync if the server
// DTO changes. Typography + layout exist on the server DTO but the editor
// omits them (parity with the admin card's v1 scope).
// ─────────────────────────────────────────────────────────────────────────

export type PaletteDto = {
  primary: string;
  secondary: string;
  tertiary: string;
  background: string;
  surface: string;
  error: string;
  warning: string;
  success: string;
  info: string;
};

export type BrandAssetsDto = {
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  faviconUrl?: string | null;
  deleteLogo?: boolean;
  deleteLogoDark?: boolean;
  deleteFavicon?: boolean;
};

export type TypographyDto = {
  fontFamily: string;
  headingFontFamily: string;
  fontSizeBase: number;
  lineHeightBase: number;
};

export type LayoutDto = {
  borderRadius: string;
  defaultElevation: number;
};

export type TenantThemeDto = {
  lightPalette: PaletteDto;
  darkPalette: PaletteDto;
  brandAssets: BrandAssetsDto;
  typography: TypographyDto;
  layout: LayoutDto;
  isDefault: boolean;
};

export const DEFAULT_LIGHT_PALETTE: PaletteDto = {
  primary: "#2563EB", // raw-color-allowed: the API's default tenant palette, data and not styling
  secondary: "#0F172A", // raw-color-allowed: the API's default tenant palette, data and not styling
  tertiary: "#6366F1", // raw-color-allowed: the API's default tenant palette, data and not styling
  background: "#F8FAFC", // raw-color-allowed: the API's default tenant palette, data and not styling
  surface: "#FFFFFF", // raw-color-allowed: the API's default tenant palette, data and not styling
  error: "#DC2626", // raw-color-allowed: the API's default tenant palette, data and not styling
  warning: "#F59E0B", // raw-color-allowed: the API's default tenant palette, data and not styling
  success: "#16A34A", // raw-color-allowed: the API's default tenant palette, data and not styling
  info: "#0284C7", // raw-color-allowed: the API's default tenant palette, data and not styling
};

export const DEFAULT_DARK_PALETTE: PaletteDto = {
  primary: "#38BDF8", // raw-color-allowed: the API's default tenant palette, data and not styling
  secondary: "#94A3B8", // raw-color-allowed: the API's default tenant palette, data and not styling
  tertiary: "#818CF8", // raw-color-allowed: the API's default tenant palette, data and not styling
  background: "#0B1220", // raw-color-allowed: the API's default tenant palette, data and not styling
  surface: "#111827", // raw-color-allowed: the API's default tenant palette, data and not styling
  error: "#F87171", // raw-color-allowed: the API's default tenant palette, data and not styling
  warning: "#FBBF24", // raw-color-allowed: the API's default tenant palette, data and not styling
  success: "#22C55E", // raw-color-allowed: the API's default tenant palette, data and not styling
  info: "#38BDF8", // raw-color-allowed: the API's default tenant palette, data and not styling
};

/** Fetch the current tenant's theme. Caller needs Tenants.ViewTheme (IsBasic). */
export async function getTenantTheme(): Promise<TenantThemeDto> {
  return apiFetch<TenantThemeDto>(`/api/v1/tenants/theme`);
}

/** Save the current tenant's theme. Caller needs Tenants.UpdateTheme. */
export async function updateTenantTheme(theme: TenantThemeDto): Promise<void> {
  await apiFetch<void>(`/api/v1/tenants/theme`, {
    method: "PUT",
    body: JSON.stringify(theme),
  });
}

/** Reset the current tenant's theme to framework defaults. Needs Tenants.UpdateTheme. */
export async function resetTenantTheme(): Promise<void> {
  await apiFetch<void>(`/api/v1/tenants/theme/reset`, {
    method: "POST",
  });
}
