import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * NotFoundPage — calm centered "page not found" card.
 *
 * Matches the dashboard's not-found vocabulary: atmospheric orbs, a muted
 * icon tile, an display-face headline, a soft body line, and primary affordances.
 * Mounted at the root via `path: "*"`.
 */
export function NotFoundPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const requested = location.pathname + location.search;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-background)] px-5 py-8 sm:py-12">
      {/* Atmospheric background — same primary/saffron orbs as the auth pages */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute -top-[25%] -left-[15%] h-[70vw] w-[70vw] rounded-full blur-[140px]"
          style={{ backgroundColor: "color-mix(in oklab, var(--color-primary) 5%, transparent)" }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] h-[55vw] w-[55vw] rounded-full blur-[120px]"
          style={{ backgroundColor: "color-mix(in oklab, var(--color-saffron, var(--color-primary)) 7%, transparent)" }}
        />
      </div>

      <div className="relative z-10 flex w-full max-w-[460px] flex-col items-center text-center tl-enter tl-enter-1">
        {/* Icon tile — muted bg + rounded-2xl, matching dashboard EntityEmpty */}
        <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-[var(--color-muted)]">
          <FileQuestion className="size-6 text-muted-foreground/50" />
        </div>

        <h1 className="mb-2 font-display text-[clamp(1.5rem,5vw,2rem)] font-semibold tracking-tight text-[var(--color-foreground)]">
          {t("notFound.title")}
        </h1>
        <p className="mb-2 max-w-[380px] text-[14px] leading-relaxed text-[var(--color-muted-foreground)]">
          {t("notFound.body")}
        </p>

        {/* Requested path — soft inline display */}
        <p
          className="mb-7 inline-flex max-w-full items-center gap-1.5 text-[12px] text-[var(--color-muted-foreground)]"
          title={requested}
        >
          <span className="text-muted-foreground/60">
            {t("notFound.requested")}
          </span>
          <span className="truncate text-[var(--color-foreground)]">{requested}</span>
        </p>

        {/* Primary actions */}
        <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="group h-11 px-5 text-[14px] font-semibold">
            <Link to="/">
              <Home className="size-4" />
              <span>{t("notFound.backHome")}</span>
            </Link>
          </Button>
        </div>

        {/* Tertiary — go-back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" />
          <span>{t("notFound.goBack")}</span>
        </button>
      </div>
    </div>
  );
}
