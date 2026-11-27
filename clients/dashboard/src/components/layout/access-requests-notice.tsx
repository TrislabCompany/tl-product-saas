import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Eye, X } from "lucide-react";
import {
  approveImpersonationRequest,
  denyImpersonationRequest,
  getMyImpersonationRequests,
  type ImpersonationRequestDto,
} from "@/api/identity";
import { useAuth } from "@/auth/use-auth";
import { Button } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTimeMono } from "@/lib/list-helpers";

/** The permission GET /impersonation/requests/mine and its answers need; the Basic role holds it. */
const RESPOND_PERMISSION = "Permissions.Impersonation.Respond";

const REFRESH_INTERVAL_MS = 30_000;
const QUERY_KEY = ["impersonation-requests", "mine"] as const;

function describe(err: unknown): string | undefined {
  if (err instanceof ApiRequestError) return err.problem?.detail ?? err.problem?.title ?? err.message;
  return err instanceof Error ? err.message : undefined;
}

/**
 * Asks the signed-in user about every request to impersonate them (D-44): who asks and why, to approve or deny.
 * An approved request, and the read-only impersonation it started, stays listed so the user can take it back.
 * Hidden while impersonating, and without the permission, so no poll is a 403.
 */
export function AccessRequestsNotice() {
  const { t } = useTranslation("common");
  const { user, impersonation, permissionsHydrated } = useAuth();
  const enabled =
    !!user && !impersonation && permissionsHydrated && user.permissions.includes(RESPOND_PERMISSION);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getMyImpersonationRequests,
    enabled,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const items = enabled ? (query.data ?? []) : [];
  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label={t("accessRequests.region")}
      className="relative z-30 space-y-2 border-b px-4 py-2.5 sm:px-6"
      style={{
        borderColor: "color-mix(in oklab, var(--color-warning) 28%, transparent)",
        backgroundColor: "color-mix(in oklab, var(--color-warning) 8%, transparent)",
      }}
    >
      {items.map((r) => (
        <RequestLine key={r.id} request={r} />
      ))}
    </div>
  );
}

function RequestLine({ request: r }: { request: ImpersonationRequestDto }) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const actor = r.actorUserName ?? r.actorUserId;
  const answered = r.status === "Approved" || r.status === "Used";

  const answer = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? approveImpersonationRequest(id) : denyImpersonationRequest(id),
    onSuccess: (_result, { approve }) => {
      toast.success(
        approve
          ? t("accessRequests.toast.approved", { name: actor })
          : answered
            ? t("accessRequests.toast.revoked", { name: actor })
            : t("accessRequests.toast.denied", { name: actor }),
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => {
      toast.error(t("accessRequests.toast.failed"), { description: describe(err) });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const message =
    r.status === "Used"
      ? t("accessRequests.active", { name: actor })
      : r.status === "Approved"
        ? t("accessRequests.approved", { name: actor })
        : t("accessRequests.pending", { name: actor });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-warning)]" aria-hidden />
        <div className="min-w-0 text-[13px] text-[var(--color-foreground)]">
          <p className={cn(r.status === "Used" && "font-medium")}>{message}</p>
          <p className="truncate text-[12px] text-[var(--color-muted-foreground)]">
            {t("accessRequests.reason", { reason: r.reason })} ·{" "}
            {t("accessRequests.expires", { date: formatDateTimeMono(r.expiresAtUtc) })}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {answered ? (
          <Button
            size="sm"
            variant="outline"
            disabled={answer.isPending}
            onClick={() => answer.mutate({ id: r.id, approve: false })}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {r.status === "Used" ? t("accessRequests.end") : t("accessRequests.revoke")}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={answer.isPending}
              onClick={() => answer.mutate({ id: r.id, approve: false })}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {t("accessRequests.deny")}
            </Button>
            <Button size="sm" disabled={answer.isPending} onClick={() => answer.mutate({ id: r.id, approve: true })}>
              <Check className="mr-1 h-3.5 w-3.5" />
              {t("accessRequests.approve")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
