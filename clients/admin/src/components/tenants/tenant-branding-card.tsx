import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { useQuery } from "@tanstack/react-query";
import { Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ErrorBand, LoadingRow, SettingsSection } from "@/components/list";
import { getTenantTheme, type BrandAssetsDto, type PaletteDto } from "@/api/tenants";
import { ApiRequestError } from "@/lib/api-client";

/**
 * TenantBrandingCard — a read-only preview of one tenant's theme.
 *
 * The platform operator only reads inside a tenant (the framework's D-44 rule): the framework refuses any write
 * the operator sends with the `tenant` header. The tenant's Admins change their branding in the dashboard
 * (Settings, Branding). The read sends `tenantId` in the `tenant` header, which only a root operator may.
 */
export function TenantBrandingCard({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation("tenants");

  const themeQuery = useQuery({
    queryKey: ["tenant", tenantId, "theme"],
    queryFn: () => getTenantTheme(tenantId),
    // Re-fetch when the page regains focus so the tenant's own edits show without a manual refresh.
    refetchOnWindowFocus: true,
  });

  if (themeQuery.isLoading) {
    return (
      <SettingsSection
        title={t("branding.title")}
        icon={Palette}
        description={t("branding.descriptionLoading")}
      >
        <LoadingRow label={t("branding.loading")} />
      </SettingsSection>
    );
  }

  if (themeQuery.isError) {
    return (
      <SettingsSection title={t("branding.title")} icon={Palette}>
        <ErrorBand message={apiErr(themeQuery.error, t("branding.unknownError"))} />
      </SettingsSection>
    );
  }

  const theme = themeQuery.data;
  if (!theme) return null;

  return (
    <SettingsSection
      title={t("branding.title")}
      icon={Palette}
      description={t("branding.description")}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {theme.isDefault && (
            <Badge variant="outline" className="font-mono uppercase tracking-[0.14em]">
              {t("branding.badge.default")}
            </Badge>
          )}
          <Badge variant="muted" className="font-mono uppercase tracking-[0.14em]">
            {t("branding.badge.readOnly")}
          </Badge>
        </div>
      }
    >
      <div className="space-y-6">
        <ThemePreview palette={theme.lightPalette} label={t("branding.preview.light")} />

        <div className="grid gap-5 lg:grid-cols-2">
          <PaletteView title={t("branding.palette.light")} palette={theme.lightPalette} />
          <PaletteView title={t("branding.palette.dark")} palette={theme.darkPalette} />
        </div>

        <BrandAssetsView assets={theme.brandAssets} />
      </div>
    </SettingsSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Palette — colour swatches with their hex values
// ─────────────────────────────────────────────────────────────────────────

const PALETTE_FIELDS: ReadonlyArray<{ key: keyof PaletteDto; label: ParseKeys<"tenants"> }> = [
  { key: "primary", label: "branding.paletteField.primary" },
  { key: "secondary", label: "branding.paletteField.secondary" },
  { key: "tertiary", label: "branding.paletteField.tertiary" },
  { key: "background", label: "branding.paletteField.background" },
  { key: "surface", label: "branding.paletteField.surface" },
  { key: "error", label: "branding.paletteField.error" },
  { key: "warning", label: "branding.paletteField.warning" },
  { key: "success", label: "branding.paletteField.success" },
  { key: "info", label: "branding.paletteField.info" },
];

function PaletteView({ title, palette }: { title: string; palette: PaletteDto }) {
  const { t } = useTranslation("tenants");
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
      <div className="border-b border-border/50 px-4 py-2.5">
        <h4 className="text-[12.5px] font-semibold tracking-tight text-[var(--color-foreground)]">{title}</h4>
      </div>
      <dl className="grid gap-2 p-4 sm:grid-cols-2">
        {PALETTE_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="h-8 w-8 shrink-0 rounded-lg shadow-sm ring-1 ring-inset ring-[var(--color-border)]"
              style={{ backgroundColor: palette[key] }}
            />
            <div className="min-w-0 flex-1">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
                {t(label)}
              </dt>
              <dd className="font-mono text-[11.5px] text-[var(--color-foreground)]">{palette[key]}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Brand assets — logo, dark logo and favicon addresses
// ─────────────────────────────────────────────────────────────────────────

function BrandAssetsView({ assets }: { assets: BrandAssetsDto }) {
  const { t } = useTranslation("tenants");
  const rows: ReadonlyArray<{ label: string; value?: string | null }> = [
    { label: t("branding.assets.logoUrl"), value: assets.logoUrl },
    { label: t("branding.assets.logoDarkUrl"), value: assets.logoDarkUrl },
    { label: t("branding.assets.faviconUrl"), value: assets.faviconUrl },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
      <div className="border-b border-border/50 px-4 py-2.5">
        <h4 className="text-[12.5px] font-semibold tracking-tight text-[var(--color-foreground)]">
          {t("branding.assets.title")}
        </h4>
      </div>
      <dl className="space-y-3 p-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-[11.5px] font-medium text-[var(--color-muted-foreground)]">{row.label}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-[12px] text-[var(--color-foreground)]">
                {row.value || t("branding.assets.none")}
              </span>
              {row.value && (
                // A small thumbnail shows the address loads; a failed load just hides it.
                <img
                  src={row.value}
                  alt=""
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                  className="h-9 w-9 shrink-0 rounded-lg object-contain ring-1 ring-inset ring-[var(--color-border)] bg-[var(--color-background)]"
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Live preview — shows how primary-action buttons + surface tokens render
// ─────────────────────────────────────────────────────────────────────────

function ThemePreview({ palette, label }: { palette: PaletteDto; label: string }) {
  const { t } = useTranslation("tenants");
  return (
    <div
      className="overflow-hidden rounded-xl border border-[var(--color-border)]"
      style={{ backgroundColor: palette.background }}
    >
      {/* Preview header bar */}
      <div
        className="flex items-center justify-between border-b px-4 py-2"
        style={{
          borderColor: `${palette.surface}55`,
          backgroundColor: palette.surface,
        }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-60"
          style={{ color: palette.secondary }}
        >
          {label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
          style={{ backgroundColor: palette.success, color: palette.surface }}
        >
          {t("branding.preview.live")}
        </span>
      </div>

      {/* Preview body */}
      <div className="p-4">
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: palette.surface }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span
              className="text-[13px] font-semibold"
              style={{ color: palette.secondary }}
            >
              {t("branding.preview.samplePage")}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
              style={{ backgroundColor: palette.success, color: palette.surface }}
            >
              {t("branding.preview.active")}
            </span>
          </div>
          <p
            className="mb-4 text-[12.5px] leading-relaxed"
            style={{ color: palette.secondary, opacity: 0.72 }}
          >
            {t("branding.preview.paragraph")}
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Primary action */}
            <span
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm"
              style={{ backgroundColor: palette.primary, color: palette.surface }}
            >
              {t("branding.preview.primaryAction")}
            </span>
            {/* Outline secondary */}
            <span
              className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: palette.primary,
                color: palette.primary,
                backgroundColor: "transparent",
              }}
            >
              {t("branding.preview.secondary")}
            </span>
            {/* Warning pill */}
            <span
              className="inline-flex items-center rounded-lg px-2.5 py-1 text-[10.5px] font-mono font-medium uppercase tracking-[0.1em]"
              style={{ backgroundColor: palette.warning, color: palette.background }}
            >
              {t("branding.preview.warn")}
            </span>
            {/* Error pill */}
            <span
              className="inline-flex items-center rounded-lg px-2.5 py-1 text-[10.5px] font-mono font-medium uppercase tracking-[0.1em]"
              style={{ backgroundColor: palette.error, color: palette.surface }}
            >
              {t("branding.preview.error")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function apiErr(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) {
    return err.problem?.detail ?? err.problem?.title ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
