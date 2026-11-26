import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthHeadline, AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordFields } from "@/components/auth/new-password-fields";
import { MIN_PASSWORD_LENGTH, isNewPasswordReady } from "@/lib/password";
import { confirmEmail } from "@/api/identity";
import { ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/cn";

/**
 * Confirm-email landing — the link e-mailed when an account is created
 * brings the owner here with `?userId=&code=&tenant=`. The owner sets the
 * account's password, which proves they hold the address: the confirmation
 * and the password go to the server together (POST /confirm-email), so an
 * administrator never chooses a user's password.
 *
 * States: the form, success (green check + go-to-login), and failure (red x
 * + "request a new link"). We don't auto-redirect on success: the user wants
 * to see the outcome before the next click.
 */

type Status =
  | { kind: "form" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ConfirmEmailPage() {
  const { t } = useTranslation("auth");
  const [params] = useSearchParams();
  const userId = params.get("userId") ?? "";
  const code = params.get("code") ?? "";
  const tenant = params.get("tenant") ?? "";
  const malformed = !userId || !code || !tenant;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<Status>({ kind: "form" });
  const status: Status = malformed ? { kind: "error", message: t("confirm.malformed") } : result;

  const mutation = useMutation({
    mutationFn: () => confirmEmail({ userId, code, tenant, password }),
    onSuccess: (message) =>
      setResult({
        kind: "success",
        message: typeof message === "string" && message.length > 0 ? message : t("confirm.successFallback"),
      }),
    onError: (err: unknown) => {
      const detail =
        err instanceof ApiRequestError
          ? err.problem?.detail ?? err.problem?.title ?? err.message
          : (err as Error).message;
      // A rejected password (too weak) can be fixed in the form; anything else ends the link.
      if (err instanceof ApiRequestError && err.status === 400) setFormError(detail);
      else setResult({ kind: "error", message: detail });
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
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
    mutation.mutate();
  };

  return (
    <AuthShell
      footer={
        <Link
          to="/login"
          className="text-[var(--color-foreground)] underline-offset-4 hover:underline"
        >
          {t("confirm.backLink")}
        </Link>
      }
    >
      {status.kind === "form" && (
        <>
          <div className="mb-6 sm:mb-8">
            <AuthHeadline lead={t("confirm.formLead")} accent={t("confirm.formAccent")} />
            <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">
              {t("confirm.formBody")}
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-5" noValidate aria-describedby={formError ? "confirm-error" : undefined}>
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
              errorId={formError ? "confirm-error" : undefined}
              autoFocus
            />

            {formError && (
              <div
                id="confirm-error"
                role="alert"
                className={cn(
                  "tl-enter flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                  "border-destructive/30",
                  "bg-destructive/6",
                  "text-[var(--color-destructive)]",
                )}
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="leading-snug">{formError}</span>
              </div>
            )}

            <div className="pt-1.5">
              <Button
                type="submit"
                disabled={mutation.isPending || !isNewPasswordReady(password, confirm)}
                className="group h-11 w-full text-[14px] font-semibold"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>{t("confirm.submitting")}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    <span>{t("confirm.submit")}</span>
                    <ArrowRight className="size-[14px] opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </>
      )}

      {status.kind === "success" && (
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
            <AuthHeadline lead={t("confirm.successLead")} accent={t("confirm.successAccent")} />
            <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">
              {status.message}
            </p>
          </div>
          <Link to="/login" className="block">
            <Button type="button" className="group h-11 w-full text-[14px] font-semibold">
              <span>{t("confirm.continueSignIn")}</span>
              <ArrowRight className="size-[14px] opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Button>
          </Link>
        </div>
      )}

      {status.kind === "error" && (
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
            <AuthHeadline
              lead={t("confirm.errorLead")}
              accent={t("confirm.errorAccent")}
              trail={t("confirm.errorTrail")}
            />
            <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">
              {status.message}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted-foreground)]">
              {t("confirm.errorHint")}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link to="/login">
              <Button type="button" variant="outline">
                {t("confirm.backToSignIn")}
              </Button>
            </Link>
            <Link to="/forgot-password">
              <Button type="button" variant="ghost">
                {t("confirm.resetInstead")}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
