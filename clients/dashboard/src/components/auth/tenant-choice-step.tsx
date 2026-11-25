import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Loader2 } from "lucide-react";
import type { TenantMembership } from "@/auth/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type TenantChoiceStepProps = {
  email: string;
  tenants: TenantMembership[];
  onSubmit: (choice: { tenant: string; setDefault: boolean }) => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
};

/**
 * The step of the sign-in card for an account that belongs to several tenants and has no default: the user
 * picks the tenant to open, and may keep it as the default so the next sign-in opens it directly.
 */
export function TenantChoiceStep({ email, tenants, onSubmit, onBack, submitting, error }: TenantChoiceStepProps) {
  const { t } = useTranslation("auth");
  const [tenant, setTenant] = useState<string>(tenants[0]?.id ?? "");
  const [setDefault, setSetDefault] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tenant && !submitting) onSubmit({ tenant, setDefault });
  };

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-1.5 font-display text-[22px] font-semibold tracking-tight text-[var(--color-foreground)]">
          {t("tenantChoice.title")}
        </h1>
        <p className="text-[13px] text-[var(--color-muted-foreground)]">
          {t("tenantChoice.subtitle")}{" "}
          <span className="font-medium text-[var(--color-foreground)]">{email}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-describedby={error ? "tenant-choice-error" : undefined}>
        <fieldset className="space-y-2">
          <legend className="sr-only">{t("tenantChoice.legend")}</legend>
          {tenants.map((option) => (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-[13.5px] transition-colors",
                tenant === option.id
                  ? "border-[var(--color-primary)] bg-[oklch(from_var(--color-primary)_l_c_h_/_0.06)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-muted)]",
              )}
            >
              <input
                type="radio"
                name="tenant"
                value={option.id}
                checked={tenant === option.id}
                onChange={() => setTenant(option.id)}
                className="accent-[var(--color-primary)]"
              />
              <Building2 className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
              <span className="font-medium text-[var(--color-foreground)]">{option.name || option.id}</span>
            </label>
          ))}
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[var(--color-muted-foreground)]">
          <input
            type="checkbox"
            checked={setDefault}
            onChange={(e) => setSetDefault(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          {t("tenantChoice.setDefault")}
        </label>

        {error && (
          <div
            id="tenant-choice-error"
            role="alert"
            className={cn(
              "tl-enter flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
              "border-[oklch(from_var(--color-destructive)_l_c_h_/_0.30)]",
              "bg-[oklch(from_var(--color-destructive)_l_c_h_/_0.06)]",
              "text-[var(--color-destructive)]",
            )}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <div className="space-y-2 pt-1.5">
          <Button type="submit" disabled={submitting || !tenant} className="group h-11 w-full text-[14px] font-semibold">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{t("tenantChoice.submitting")}</span>
              </>
            ) : (
              <>
                <span>{t("tenantChoice.submit")}</span>
                <ArrowRight className="size-[14px] opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
              </>
            )}
          </Button>
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 text-[12.5px] font-medium text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft className="size-3.5" />
            {t("tenantChoice.back")}
          </button>
        </div>
      </form>
    </>
  );
}
