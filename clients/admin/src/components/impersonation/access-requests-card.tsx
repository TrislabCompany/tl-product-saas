import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Send } from "lucide-react";
import { toast } from "sonner";
import {
  listSentImpersonationRequests,
  startImpersonation,
  type ImpersonationRequestDto,
  type ImpersonationResponse,
} from "@/api/impersonation";
import { useAuth } from "@/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "@/components/list";
import { ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { handoffToDashboard } from "@/lib/impersonation-handoff";
import { IdentityPermissions } from "@/lib/permissions";
import { IMPERSONATION_REQUEST_STATUS_KEYS, statusKey } from "@/lib/status-keys";

const REFRESH_INTERVAL_MS = 10_000;
const DURATION_MINUTES = [10, 15, 30] as const;

type BadgeVariant = "success" | "muted" | "outline" | "warning" | "danger";
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  Pending: "warning",
  Approved: "success",
  Denied: "danger",
  Used: "muted",
  Expired: "muted",
};

/**
 * AccessRequestsCard — the operator's own requests for read-only access to this tenant's users, newest first.
 * A pending request waits for the user's answer; an approved one starts here, once, and opens the dashboard
 * with a read-only token. Hidden when the operator has sent none.
 */
export function AccessRequestsCard({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation("impersonation");
  const { user, permissionsHydrated } = useAuth();
  const canImpersonate = (user?.permissions ?? []).includes(IdentityPermissions.Users.Impersonate);

  const query = useQuery({
    queryKey: ["impersonation-requests", "sent"],
    queryFn: () => listSentImpersonationRequests({ take: 100 }),
    enabled: permissionsHydrated && canImpersonate,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  if (!permissionsHydrated || !canImpersonate || query.isLoading) return null;
  const items = (query.data ?? []).filter((r) => r.targetTenantId === tenantId);
  if (items.length === 0) return null;

  return (
    <SettingsSection title={t("requests.title")} icon={Send} description={t("requests.description")}>
      <ul className="divide-y divide-[var(--color-border)]">
        {items.map((r) => (
          <RequestRow key={r.id} request={r} tenantId={tenantId} />
        ))}
      </ul>
    </SettingsSection>
  );
}

function RequestRow({ request: r, tenantId }: { request: ImpersonationRequestDto; tenantId: string }) {
  const { t } = useTranslation("impersonation");
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState<number>(15);
  const key = statusKey(IMPERSONATION_REQUEST_STATUS_KEYS, r.status);

  const start = useMutation<ImpersonationResponse, Error, { requestId: string; durationMinutes: number }>({
    mutationFn: (input) => startImpersonation(input),
    onSuccess: (response, { durationMinutes }) => {
      handoffToDashboard(response, tenantId);
      toast.success(t("requests.toast.started", { minutes: durationMinutes }), {
        description: t("requests.toast.startedDesc", { name: r.targetUserName ?? r.targetUserId }),
      });
      void queryClient.invalidateQueries({ queryKey: ["impersonation-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["impersonation-grants"] });
    },
    onError: (err) => {
      const detail =
        err instanceof ApiRequestError ? err.problem?.detail ?? err.problem?.title ?? err.message : err.message;
      toast.error(t("requests.toast.startFailed"), { description: detail });
      void queryClient.invalidateQueries({ queryKey: ["impersonation-requests"] });
    },
  });

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px] font-medium text-[var(--color-foreground)]">
            {r.targetUserName ?? r.targetUserId}
          </span>
          <Badge variant={STATUS_VARIANT[r.status] ?? "outline"} className="font-mono uppercase tracking-[0.14em]">
            {key ? t(key) : r.status}
          </Badge>
        </div>
        <div className="mt-0.5 truncate font-mono text-[10.5px] text-[var(--color-muted-foreground)]">
          {t("requests.window", { requested: formatTime(r.requestedAtUtc), expires: formatTime(r.expiresAtUtc) })}
          {r.reason && <> · {r.reason}</>}
        </div>
      </div>

      {r.status === "Approved" && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div role="group" aria-label={t("requests.duration")} className="flex items-center gap-1">
            {DURATION_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-[11px] tabular-nums transition-colors",
                  minutes === m
                    ? "border-[var(--color-accent-signal)] bg-[var(--color-accent-signal)]/10"
                    : "border-[var(--color-border)] hover:bg-[var(--color-muted)]/60",
                )}
              >
                {t("requests.minutes", { minutes: m })}
              </button>
            ))}
          </div>
          <Button
            variant="signal"
            size="sm"
            disabled={start.isPending}
            onClick={() => start.mutate({ requestId: r.id, durationMinutes: minutes })}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            {start.isPending ? t("requests.starting") : t("requests.start")}
          </Button>
        </div>
      )}
    </li>
  );
}
