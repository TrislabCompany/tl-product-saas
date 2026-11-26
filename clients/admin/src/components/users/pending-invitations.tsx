import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, X } from "lucide-react";
import { toast } from "sonner";
import { listInvitations, revokeInvitation, type InvitationDto } from "@/api/users";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

/**
 * The operator invitations nobody has accepted yet, with a revoke. An operator appears in the user list only
 * once they accept, so without this nobody could see who was invited.
 */
export function PendingInvitations() {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["invitations"], queryFn: listInvitations, staleTime: 30_000 });

  const revoke = useMutation({
    mutationFn: (invitation: InvitationDto) => revokeInvitation(invitation.id),
    onSuccess: (_, invitation) => {
      toast.success(t("invitations.toastRevoked", { email: invitation.email }));
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (err) => toast.error(t("invitations.toastRevokeFailed"), { description: describeError(err) }),
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
      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {pending.map((invitation) => (
          <li key={invitation.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-mono text-[13px]">{invitation.email}</div>
              <div className="text-[11.5px] text-[var(--color-muted-foreground)]">
                {t("invitations.expires", { date: formatDate(invitation.expiresOnUtc) })}
              </div>
            </div>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
