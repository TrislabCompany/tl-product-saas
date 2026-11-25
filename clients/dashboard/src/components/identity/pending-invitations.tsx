import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, X } from "lucide-react";
import { toast } from "sonner";
import { listInvitations, revokeInvitation, type InvitationDto } from "@/api/identity";
import { Button } from "@/components/ui/button";
import { EntityListCard, EntityStatusBadge } from "@/components/list";
import { describe, formatDate } from "@/lib/list-helpers";

/**
 * The invitations of this tenant nobody has accepted yet, with a revoke. A user appears in the user list only once
 * they accept, so without this an administrator could not see who was invited.
 */
export function PendingInvitations() {
  const { t } = useTranslation("identity");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["identity", "invitations"],
    queryFn: listInvitations,
    staleTime: 30_000,
  });

  const revoke = useMutation({
    mutationFn: (invitation: InvitationDto) => revokeInvitation(invitation.id),
    onSuccess: (_, invitation) => {
      toast.success(t("invitations.toastRevoked", { email: invitation.email }));
      void queryClient.invalidateQueries({ queryKey: ["identity", "invitations"] });
    },
    onError: (err) => toast.error(t("invitations.toastRevokeFailed"), { description: describe(err) }),
  });

  const pending = (query.data ?? []).filter((i) => i.status === "Pending");
  if (pending.length === 0) return null;

  return (
    <section aria-labelledby="pending-invitations-title" className="space-y-2">
      <h2
        id="pending-invitations-title"
        className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-foreground)]"
      >
        <MailPlus className="size-4 text-[var(--color-muted-foreground)]" />
        {t("invitations.title")}
      </h2>
      <EntityListCard>
        <ul className="divide-y divide-[var(--color-border)]">
          {pending.map((invitation) => (
            <li key={invitation.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium">{invitation.email}</div>
                <div className="text-[11.5px] text-[var(--color-muted-foreground)]">
                  {t("invitations.expires", { date: formatDate(invitation.expiresOnUtc) })}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <EntityStatusBadge tone="warning">{t("invitations.statusPending")}</EntityStatusBadge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(invitation)}
                  aria-label={t("invitations.revokeAria", { email: invitation.email })}
                >
                  <X className="size-4" />
                  {t("invitations.revoke")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </EntityListCard>
    </section>
  );
}
