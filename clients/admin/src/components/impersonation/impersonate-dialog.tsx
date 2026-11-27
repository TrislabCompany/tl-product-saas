import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Search, Send, ShieldAlert, UserCog } from "lucide-react";
import { toast } from "sonner";
import { searchUsers, type UserDto } from "@/api/users";
import { requestImpersonation, type ImpersonationRequestDto } from "@/api/impersonation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Monogram } from "@/components/monogram";
import { ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { TFunction } from "i18next";

type TFn = TFunction<"impersonation">;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName?: string;
  /** Pre-select a user — skips the picker and jumps straight to the form. */
  prefillUser?: UserDto;
};

/**
 * ImpersonateDialog — asks a user for read-only access, in two steps:
 *   1. Pick a user inside the target tenant (skipped if `prefillUser` is set)
 *   2. Enter the reason → request access
 *
 * The user approves or denies the request in the dashboard. Once approved, the
 * operator starts it from the access requests card (AccessRequestsCard), which
 * opens the dashboard with a read-only token.
 */
export function ImpersonateDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  prefillUser,
}: Props) {
  const { t } = useTranslation("impersonation");
  const [step, setStep] = useState<"pick" | "configure">(prefillUser ? "configure" : "pick");
  const [selected, setSelected] = useState<UserDto | null>(prefillUser ?? null);

  // Reset on close + when prefill changes so reopening is idempotent.
  // Adjusted during render (react.dev "adjusting state when a prop changes").
  const [synced, setSynced] = useState({ open: false, prefillUser });
  if (synced.open !== open || synced.prefillUser !== prefillUser) {
    setSynced({ open, prefillUser });
    if (open) {
      setStep(prefillUser ? "configure" : "pick");
      setSelected(prefillUser ?? null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-accent-signal)]/15 text-[var(--color-accent-signal)]"
            >
              <UserCog className="h-4 w-4" />
            </span>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("dialog.tenant")}{" "}
            <code className="code-chip">{tenantName ?? tenantId}</code> ·{" "}
            {step === "pick"
              ? t("dialog.descPick")
              : t("dialog.descConfigure")}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <PickStep
            tenantId={tenantId}
            onPick={(user) => {
              setSelected(user);
              setStep("configure");
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          selected && (
            <ConfigureStep
              tenantId={tenantId}
              tenantName={tenantName}
              user={selected}
              onBack={
                prefillUser
                  ? undefined
                  : () => {
                      setSelected(null);
                      setStep("pick");
                    }
              }
              onDone={() => onOpenChange(false)}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 1: pick user ──────────────────────────────────────────────────

function PickStep({
  tenantId,
  onPick,
  onCancel,
}: {
  tenantId: string;
  onPick: (user: UserDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("impersonation");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(handle);
  }, [search]);

  const query = useQuery({
    queryKey: ["impersonation", "users", tenantId, debounced],
    queryFn: () =>
      searchUsers({
        tenantId,
        search: debounced || undefined,
        pageSize: 25,
        // Skip disabled accounts — impersonating a deactivated user is a footgun
        // (the impersonation token would be valid, but the user's normal sign-in
        // is disabled — confusing to debug).
        isActive: true,
      }),
    placeholderData: keepPreviousData,
  });

  const users = query.data?.items ?? [];

  return (
    <>
      <DialogBody className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("dialog.pick.searchPlaceholder")}
            aria-label={t("dialog.pick.searchAria")}
            className="pl-9"
          />
        </div>

        <div className="-mx-2 max-h-[22rem] overflow-y-auto">
          {query.isError && (
            <div className="px-3 py-6 text-sm text-[var(--color-destructive)]">
              {query.error instanceof ApiRequestError
                ? query.error.problem?.detail ?? query.error.message
                : t("dialog.pick.loadError")}
            </div>
          )}

          {query.isLoading && (
            <div className="px-3 py-10 text-center font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
              {t("dialog.pick.loading")}
              <span className="caret text-[var(--color-accent-signal)]" aria-hidden />
            </div>
          )}

          {!query.isLoading && users.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
              {t("dialog.pick.noMatch")}{debounced ? ` “${debounced}”` : ""}.
            </div>
          )}

          <ul className="divide-y divide-[var(--color-border)]">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => onPick(user)}
                  className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-muted)]/60 focus:outline-none focus-visible:bg-[var(--color-muted)]/60"
                >
                  <Monogram
                    seed={user.id ?? user.userName ?? "x"}
                    firstName={user.firstName ?? undefined}
                    lastName={user.lastName ?? undefined}
                    fallback={user.userName ?? user.email ?? "?"}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="truncate text-sm font-medium">
                        {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                          user.userName ||
                          user.email ||
                          t("dialog.pick.unnamed")}
                      </span>
                      {user.userName && (
                        <span className="truncate font-mono text-[11px] text-[var(--color-muted-foreground)]">
                          @{user.userName}
                        </span>
                      )}
                    </div>
                    <div className="truncate font-mono text-[11px] text-[var(--color-muted-foreground)]">
                      {user.email ?? "—"}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t("dialog.cancel")}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Step 2: configure ──────────────────────────────────────────────────

function ConfigureStep({
  tenantId,
  tenantName,
  user,
  onBack,
  onDone,
}: {
  tenantId: string;
  tenantName?: string;
  user: UserDto;
  onBack?: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation("impersonation");
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const trimmedReason = reason.trim();
  const reasonValid = trimmedReason.length >= 4;

  const mutation = useMutation<ImpersonationRequestDto, Error, { reason: string }>({
    mutationFn: ({ reason }) =>
      requestImpersonation({
        targetUserId: user.id,
        targetTenantId: tenantId,
        reason,
      }),
    onSuccess: () => {
      toast.success(t("dialog.toast.requested"), {
        description: t("dialog.toast.requestedDesc", { name: labelFor(user, t) }),
      });
      void queryClient.invalidateQueries({ queryKey: ["impersonation-requests"] });
      onDone();
    },
    onError: (err) => {
      const detail =
        err instanceof ApiRequestError
          ? err.problem?.detail ?? err.problem?.title ?? err.message
          : err.message;
      toast.error(t("dialog.toast.failed"), { description: detail });
    },
  });

  return (
    <>
      <DialogBody className="space-y-5">
        <SelectedUserCard user={user} tenantId={tenantId} tenantName={tenantName} />

        <div className="space-y-1.5">
          <label
            htmlFor="impersonation-reason"
            className="meta flex items-center gap-1.5 text-[var(--color-muted-foreground)]"
          >
            {t("dialog.configure.reason")}
            <span className="text-[var(--color-destructive)]" aria-hidden>
              ·
            </span>
          </label>
          <textarea
            id="impersonation-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("dialog.configure.reasonPlaceholder")}
            rows={3}
            maxLength={500}
            className={cn(
              "w-full resize-y rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-sm",
              "transition-[border-color,background-color,box-shadow] duration-[var(--duration-fast)]",
              "hover:border-[var(--color-border-strong)]",
              "focus-visible:outline-none focus-visible:border-[var(--color-accent-signal)] focus-visible:ring-2 focus-visible:ring-accent-signal/25 focus-visible:bg-[var(--color-surface-2)]",
            )}
          />
          <p className="flex items-center justify-between text-[11px] text-[var(--color-muted-foreground)]">
            <span>
              {t("dialog.configure.reasonHelp")}
            </span>
            <span
              className={cn(
                "font-mono tabular-nums",
                trimmedReason.length > 0 && !reasonValid && "text-[var(--color-warning)]",
              )}
            >
              {trimmedReason.length}/500
            </span>
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-[var(--color-warning)]/40 bg-warning/8 px-3 py-2.5 text-xs text-[var(--color-foreground)]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-warning)]" />
          <div>
            <strong className="font-medium">{t("dialog.configure.warningStrong")}</strong>
            {t("dialog.configure.warningRest")}
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        {onBack && (
          <Button variant="outline" onClick={onBack} disabled={mutation.isPending} className="sm:mr-auto">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t("dialog.configure.chooseAnother")}
          </Button>
        )}
        <Button
          variant="signal"
          disabled={!reasonValid || mutation.isPending}
          onClick={() => mutation.mutate({ reason: trimmedReason })}
        >
          {mutation.isPending ? (
            t("dialog.configure.requesting")
          ) : (
            <>
              <Send className="mr-1 h-3.5 w-3.5" /> {t("dialog.configure.request")}
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

function SelectedUserCard({
  user,
  tenantId,
  tenantName,
}: {
  user: UserDto;
  tenantId: string;
  tenantName?: string;
}) {
  const { t } = useTranslation("impersonation");
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-3">
      <Monogram
        seed={user.id ?? user.userName ?? "x"}
        firstName={user.firstName ?? undefined}
        lastName={user.lastName ?? undefined}
        fallback={user.userName ?? user.email ?? "?"}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="truncate text-sm font-medium">{labelFor(user, t)}</span>
          {user.userName && (
            <span className="truncate font-mono text-[11px] text-[var(--color-muted-foreground)]">
              @{user.userName}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-2 font-mono text-[11px] text-[var(--color-muted-foreground)]">
          <span className="truncate">{user.email ?? "—"}</span>
          <Badge variant="muted" className="font-mono uppercase tracking-[0.14em]">
            {tenantName ?? tenantId}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function labelFor(user: UserDto, t: TFn): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.userName ||
    user.email ||
    t("dialog.unnamedUser")
  );
}
