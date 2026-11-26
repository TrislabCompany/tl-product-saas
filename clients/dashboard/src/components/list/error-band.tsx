import { useTranslation } from "react-i18next";

/**
 * Inline error band displayed between the toolbar and the list when a
 * query has failed. Picks up the destructive token + the mono-caps
 * "failure ·" eyebrow used elsewhere in the dashboard.
 */
export function ErrorBand({ message }: { message: string }) {
  const { t } = useTranslation("common");
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/6 px-5 py-3 text-sm text-[var(--color-destructive)]">
      <span className="text-[11px] font-semibold uppercase tracking-wider">
        {t("errorBand.failure")} ·{" "}
      </span>
      {message}
    </div>
  );
}
