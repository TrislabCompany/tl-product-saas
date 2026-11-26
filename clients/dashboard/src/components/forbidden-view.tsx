import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ForbiddenView — what a route shows when the signed-in user lacks its
 * permission (RouteGuard). Same calm vocabulary as the not-found page: a
 * muted icon tile, a headline, one body line and the way back home. It
 * doesn't list the missing permissions: a tenant user can't grant them,
 * an Admin of the organisation can.
 */
export function ForbiddenView() {
  const { t } = useTranslation("common");
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6" data-testid="forbidden">
      <div className="flex w-full max-w-[420px] flex-col items-center text-center tl-enter">
        <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-[var(--color-muted)]">
          <ShieldOff className="size-6 text-muted-foreground/50" aria-hidden />
        </div>
        <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
          {t("forbidden.title")}
        </h1>
        <p className="mb-7 max-w-[360px] text-[14px] leading-relaxed text-[var(--color-muted-foreground)]">
          {t("forbidden.body")}
        </p>
        <Button asChild className="h-11 px-5 text-[14px] font-semibold">
          <Link to="/">
            <Home className="size-4" />
            <span>{t("forbidden.backHome")}</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
