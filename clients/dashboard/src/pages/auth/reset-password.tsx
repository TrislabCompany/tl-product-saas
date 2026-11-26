import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/use-auth";
import { Button } from "@/components/ui/button";
import { AuthHeadline, AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordFields } from "@/components/auth/new-password-fields";
import { MIN_PASSWORD_LENGTH, isNewPasswordReady } from "@/lib/password";
import { resetPassword } from "@/api/identity";
import { ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/cn";

/**
 * Reset-password — step 2 of the reset flow. The user lands here from a
 * link emailed by the forgot-password endpoint:
 *
 *   /reset-password?token=<urlencoded>&email=<urlencoded>[&tenant=<id>]
 *
 * Token + email come from the URL, and the tenant when the reset was asked
 * for inside one (users are global, so usually not); the password comes from
 * the form.
 * On success we toast and redirect to /login (existing JWTs stay valid
 * until natural expiry — a fresh sign-in under the new password is the
 * cleanest UX).
 */

export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Token and email are required for the server call. We treat the page as
  // "malformed link" if either is missing rather than letting the user
  // submit a doomed request. The tenant is optional.
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const tenant = params.get("tenant") ?? undefined;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Keep the error in sync with the form: typing after an error should
  // clear it rather than persist a stale message under the new input.
  const onPasswordChange = (value: string) => {
    setPassword(value);
    setError(null);
  };
  const onConfirmChange = (value: string) => {
    setConfirm(value);
    setError(null);
  };

  const matches = password.length > 0 && password === confirm;

  const mutation = useMutation({
    mutationFn: () => resetPassword({ email, password, token, tenant }),
    onSuccess: () => {
      toast.success(t("reset.toastTitle"), {
        description: t("reset.toastDesc"),
      });
      navigate("/login", { replace: true });
    },
    onError: (err: unknown) => {
      const detail =
        err instanceof ApiRequestError
          ? err.problem?.detail ?? err.problem?.title ?? err.message
          : (err as Error).message;
      setError(detail);
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const malformed = !token || !email;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!matches) {
      setError(t("reset.errMismatch"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("reset.errTooShort"));
      return;
    }
    mutation.mutate();
  };

  return (
    <AuthShell
      footer={
        <span>
          {t("reset.changedMind")}{" "}
          <Link
            to="/login"
            className="text-[var(--color-foreground)] underline-offset-4 hover:underline"
          >
            {t("reset.signIn")}
          </Link>
        </span>
      }
    >
      {malformed ? (
        <div className="space-y-4">
          <div className="mb-2">
            <AuthHeadline lead={t("reset.incompleteLead")} accent={t("reset.incompleteAccent")} />
            <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">
              {t("reset.incompletePre")}{" "}
              <span className="text-[var(--color-foreground)]">{t("reset.fieldToken")}</span>{" "}
              {t("reset.or")}{" "}
              <span className="text-[var(--color-foreground)]">{t("reset.fieldEmail")}</span>.{" "}
              {t("reset.incompletePost")}
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <Link to="/forgot-password">
              <Button type="button" variant="outline">
                {t("reset.requestNewLink")}
              </Button>
            </Link>
            <Link to="/login">
              <Button type="button" variant="ghost">
                {t("reset.backToSignIn")}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 sm:mb-8">
            <AuthHeadline lead={t("reset.titleLead")} accent={t("reset.titleAccent")} />
            <p className="text-[13px] text-[var(--color-muted-foreground)]">
              {t("reset.subtitlePre")}{" "}
              <span className="text-[var(--color-foreground)]">{email}</span>{t("reset.subtitlePost")}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" noValidate aria-describedby={error ? "reset-error" : undefined}>
            <NewPasswordFields
              password={password}
              confirm={confirm}
              onPasswordChange={onPasswordChange}
              onConfirmChange={onConfirmChange}
              errorId={error ? "reset-error" : undefined}
              autoFocus
            />

            {error && (
              <div
                id="reset-error"
                role="alert"
                className={cn(
                  "tl-enter flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                  "border-[oklch(from_var(--color-destructive)_l_c_h_/_0.30)]",
                  "bg-[oklch(from_var(--color-destructive)_l_c_h_/_0.06)]",
                  "text-[var(--color-destructive)]",
                )}
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="leading-snug">{error}</span>
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
                    <span>{t("reset.submitting")}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    <span>{t("reset.submit")}</span>
                    <ArrowRight className="size-[14px] opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </>
      )}
    </AuthShell>
  );
}
