import { useState } from "react";
import { formatTime } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { ShieldOff, UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  listImpersonationGrants,
  type ImpersonationGrantDto,
} from "@/api/impersonation-grants";
import { useAuth } from "@/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "@/components/list";
import { RevokeGrantDialog } from "@/components/impersonation/revoke-grant-dialog";
import { IdentityPermissions } from "@/lib/permissions";

const REFRESH_INTERVAL_MS = 5_000;

/**
 * ActiveGrantsCard — tenant-detail inline view of active impersonation
 * sessions targeting users in this tenant. Polls every 5s. Renders nothing
 * if the caller can't see impersonation grants (perm-gated upstream).
 */
export function ActiveGrantsCard({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation("impersonation");
  const { user } = useAuth();
  const canView = (user?.permissions ?? []).includes(IdentityPermissions.Impersonation.View);
  const canRevoke = (user?.permissions ?? []).includes(IdentityPermissions.Impersonation.Revoke);

  const query = useQuery({
    queryKey: ["impersonation-grants", "tenant-active", tenantId],
    queryFn: () =>
      listImpersonationGrants({
        status: "Active",
        impersonatedTenantId: tenantId,
        take: 50,
      }),
    enabled: canView,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const [targetGrant, setTargetGrant] = useState<ImpersonationGrantDto | null>(null);

  // Quiet hide when there's nothing to show — busy operators don't need
  // an empty box on every tenant page.
  if (!canView) return null;
  if (query.isLoading) return null;
  const items = query.data ?? [];
  if (items.length === 0) return null;

  return (
    <>
      <SettingsSection
        title={t("card.title")}
        icon={UserCog}
        description={t("card.description")}
      >
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((g) => (
            <GrantRow
              key={g.id}
              grant={g}
              canRevoke={canRevoke}
              onRevoke={() => setTargetGrant(g)}
            />
          ))}
        </ul>
      </SettingsSection>

      <RevokeGrantDialog
        grant={targetGrant}
        onOpenChange={(open) => !open && setTargetGrant(null)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// GrantRow — a single active impersonation session row
// ─────────────────────────────────────────────────────────────────────────

function GrantRow({
  grant: g,
  canRevoke,
  onRevoke,
}: {
  grant: ImpersonationGrantDto;
  canRevoke: boolean;
  onRevoke: () => void;
}) {
  const { t } = useTranslation("impersonation");
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3 first:pt-0 last:pb-0">
      {/* Live-session pulse dot */}
      <span
        aria-hidden
        className="pulse-dot"
        title={t("card.activeSession")}
      />

      {/* Session detail */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px]">
            <span className="font-medium text-[var(--color-foreground)]">
              {g.actorUserName ?? g.actorUserId}
            </span>
            <span className="mx-1.5 text-[var(--color-muted-foreground)]">→</span>
            <span className="font-medium text-[var(--color-foreground)]">
              {g.impersonatedUserName ?? g.impersonatedUserId}
            </span>
          </span>
          <Badge variant="brand" className="font-mono uppercase tracking-[0.14em]">
            {t("status.active")}
          </Badge>
        </div>
        <div className="mt-0.5 truncate font-mono text-[10.5px] text-[var(--color-muted-foreground)]">
          {t("card.window", {
            started: formatTime(g.startedAtUtc),
            expires: formatTime(g.expiresAtUtc),
          })}
          {g.reason && <> · {truncate(g.reason, 80)}</>}
        </div>
      </div>

      {/* Row actions */}
      <RowActions canRevoke={canRevoke} onRevoke={onRevoke} />
    </li>
  );
}

function RowActions({
  canRevoke,
  onRevoke,
}: {
  canRevoke: boolean;
  onRevoke: () => void;
}) {
  const { t } = useTranslation("impersonation");
  if (!canRevoke) {
    return (
      <Badge variant="muted" className="font-mono uppercase tracking-[0.14em]">
        <UserCog className="h-3 w-3" /> {t("card.viewOnly")}
      </Badge>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={onRevoke}>
      <ShieldOff className="mr-1 h-3.5 w-3.5" /> {t("revoke")}
    </Button>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
