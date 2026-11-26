import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, LogIn, MailCheck } from "lucide-react";
import { useAuth } from "@/auth/use-auth";
import { acceptInvitation, type AcceptInvitationResponse } from "@/api/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeadline, AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordFields } from "@/components/auth/new-password-fields";
import { MIN_PASSWORD_LENGTH, isNewPasswordReady } from "@/lib/password";
import { ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/cn";

/** The server's code for "this account is confirmed: sign in first, then accept". */
const SIGN_IN_REQUIRED = "Identity.InvitationSignInRequired";

/**
 * Accept-invitation landing — the link e-mailed when an administrator invites an address:
 *
 *   /accept-invitation?token=<token>&new=<1|0>
 *
 * Users are global. `new=1` is an account its owner hasn't proven yet: they set their password here (and
 * optionally their name), which also confirms the address. `new=0` is a confirmed account: its owner signs in
 * and accepts, and the tenant joins the ones they can switch between.
 */
export function AcceptInvitationPage() {
  const { t } = useTranslation("auth");
  const { isAuthenticated, switchTenant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const needsPassword = params.get("new") === "1";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);
  const [accepted, setAccepted] = useState<AcceptInvitationResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const accept = useMutation({
    mutationFn: () =>
      needsPassword
        ? acceptInvitation({
            token,
            password,
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            anonymous: true,
          })
        : acceptInvitation({ token, anonymous: false }),
    onSuccess: setAccepted,
    onError: (err: unknown) => {
      if (err instanceof ApiRequestError && err.status === 401 && err.problem?.code === SIGN_IN_REQUIRED) {
        setSignInRequired(true);
        return;
      }
      const detail =
        err instanceof ApiRequestError
          ? err.problem?.detail ?? err.problem?.title ?? err.message
          : (err as Error).message;
      // A rejected password can be fixed in the form; an expired, used or revoked link can't.
      if (needsPassword && err instanceof ApiRequestError && err.status === 400) setFormError(detail);
      else setFailure(detail);
    },
  });

  const open = useMutation({
    mutationFn: (tenant: string) => switchTenant({ tenant, setDefault: false }),
    onSuccess: () => navigate("/", { replace: true }),
    onError: (err: unknown) => setFailure(err instanceof Error ? err.message : String(err)),
  });

  const goSignIn = () =>
    navigate("/login", { state: { from: { pathname: `${location.pathname}${location.search}` } } });

  const onSubmitNew = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      setFormError(t("reset.errMismatch"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(t("reset.errTooShort"));
      return;
    }
    setFormError(null);
    accept.mutate();
  };

  const tenantName = accepted?.tenantName || accepted?.tenant;
  const labelClass = "block text-[11.5px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]";
  const errorBox = cn(
    "tl-enter flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
    "border-destructive/30",
    "bg-destructive/6",
    "text-[var(--color-destructive)]",
  );

  let body: React.ReactNode;
  if (!token || failure) {
    body = (
      <div className="tl-enter space-y-5 text-center">
        <div className="grid place-items-center">
          <span
            aria-hidden
            className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-[var(--color-destructive)]"
          >
            <AlertCircle className="size-6" />
          </span>
        </div>
        <div>
          <AuthHeadline lead={t("invite.errorLead")} accent={t("invite.errorAccent")} />
          <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">
            {failure ?? t("invite.malformed")}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted-foreground)]">{t("invite.errorHint")}</p>
        </div>
        <Link to="/login">
          <Button type="button" variant="outline">
            {t("invite.backToSignIn")}
          </Button>
        </Link>
      </div>
    );
  } else if (accepted) {
    body = (
      <div className="tl-enter space-y-5 text-center">
        <div className="grid place-items-center">
          <span
            aria-hidden
            className="grid size-14 place-items-center rounded-2xl bg-success/10 text-[var(--color-success)]"
          >
            <CheckCircle2 className="size-6" />
          </span>
        </div>
        <div>
          <AuthHeadline lead={t("invite.doneLead")} accent={t("invite.doneAccent")} />
          <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">
            {t("invite.doneBody", { tenant: tenantName })}
          </p>
        </div>
        {isAuthenticated ? (
          <Button
            type="button"
            className="group h-11 w-full text-[14px] font-semibold"
            disabled={open.isPending}
            onClick={() => open.mutate(accepted.tenant)}
          >
            {open.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            <span>{t("invite.openTenant", { tenant: tenantName })}</span>
            <ArrowRight className="size-[14px] opacity-60" />
          </Button>
        ) : (
          <Link to="/login" className="block">
            <Button type="button" className="group h-11 w-full text-[14px] font-semibold">
              <span>{t("invite.continueSignIn")}</span>
              <ArrowRight className="size-[14px] opacity-60" />
            </Button>
          </Link>
        )}
      </div>
    );
  } else if (signInRequired || (!needsPassword && !isAuthenticated)) {
    body = (
      <div className="space-y-5">
        <div>
          <AuthHeadline lead={t("invite.signInLead")} accent={t("invite.signInAccent")} />
          <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">{t("invite.signInBody")}</p>
        </div>
        <Button type="button" onClick={goSignIn} className="group h-11 w-full text-[14px] font-semibold">
          <LogIn className="size-4" />
          <span>{t("invite.signIn")}</span>
        </Button>
      </div>
    );
  } else if (needsPassword) {
    body = (
      <>
        <div className="mb-6 sm:mb-8">
          <AuthHeadline lead={t("invite.newLead")} accent={t("invite.newAccent")} />
          <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">{t("invite.newBody")}</p>
        </div>
        <form onSubmit={onSubmitNew} className="space-y-5" noValidate aria-describedby={formError ? "invite-error" : undefined}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-first" className={labelClass}>
                {t("invite.firstName")}
              </Label>
              <Input
                id="invite-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className="h-11 text-[14px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-last" className={labelClass}>
                {t("invite.lastName")}
              </Label>
              <Input
                id="invite-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className="h-11 text-[14px]"
              />
            </div>
          </div>
          <NewPasswordFields
            password={password}
            confirm={confirm}
            onPasswordChange={(value) => {
              setPassword(value);
              setFormError(null);
            }}
            onConfirmChange={(value) => {
              setConfirm(value);
              setFormError(null);
            }}
            errorId={formError ? "invite-error" : undefined}
          />
          {formError && (
            <div id="invite-error" role="alert" className={errorBox}>
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="leading-snug">{formError}</span>
            </div>
          )}
          <div className="pt-1.5">
            <Button
              type="submit"
              disabled={accept.isPending || !isNewPasswordReady(password, confirm)}
              className="group h-11 w-full text-[14px] font-semibold"
            >
              {accept.isPending ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
              <span>{accept.isPending ? t("invite.accepting") : t("invite.accept")}</span>
            </Button>
          </div>
        </form>
      </>
    );
  } else {
    body = (
      <div className="space-y-5">
        <div>
          <AuthHeadline lead={t("invite.existingLead")} accent={t("invite.existingAccent")} />
          <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">{t("invite.existingBody")}</p>
        </div>
        <Button
          type="button"
          disabled={accept.isPending}
          onClick={() => accept.mutate()}
          className="group h-11 w-full text-[14px] font-semibold"
        >
          {accept.isPending ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
          <span>{accept.isPending ? t("invite.accepting") : t("invite.accept")}</span>
        </Button>
      </div>
    );
  }

  return (
    <AuthShell
      footer={
        <Link to="/login" className="text-[var(--color-foreground)] underline-offset-4 hover:underline">
          {t("invite.backToSignIn")}
        </Link>
      }
    >
      {body}
    </AuthShell>
  );
}
