import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/**
 * RouteFallback — what shows while a lazy chunk is downloading. Mirrors
 * the resolved page's shape: a thin header line, an atmospheric hero
 * placeholder, and three card placeholders. Uses the modernized
 * `.skeleton` shimmer so it feels like part of the same surface family.
 */
export function RouteFallback() {
  const { t } = useTranslation("common");
  return (
    <div className={cn("space-y-6 tl-enter")} role="status" aria-busy="true">
      <span className="sr-only">{t("list.loading")}</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3 w-96 max-w-full" />
      </div>
      <Skeleton className="h-32 w-full rounded-[20px]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  );
}
