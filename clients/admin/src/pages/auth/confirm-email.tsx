import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmEmail } from "@/api/users";
import { ApiRequestError } from "@/lib/api-client";

const MIN_PASSWORD_LENGTH = 8;

type Status =
  | { kind: "form" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

/**
 * Confirm-email landing — admin variant.
 *
 * Same shape as the dashboard's: the owner sets the account's password, which
 * proves the address, and the confirmation and the password go to the server
 * together (POST /confirm-email). Then a stable success or failure state with
 * recovery affordances, in the unified centered-card auth shell.
 */
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
  // A malformed link never fires the request — its error state is derived.
  const status: Status = malformed ? { kind: "error", message: t("confirm.malformed") } : result;
  const ready = password.length >= MIN_PASSWORD_LENGTH && password === confirm;

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
      // A rejected password can be fixed in the form; anything else ends the link.
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

  const labelClass = "block text-[11.5px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-background)] px-5 py-8 sm:py-12">
      {/* Atmospheric background orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute -top-[25%] -left-[15%] h-[70vw] w-[70vw] rounded-full blur-[140px]"
          style={{ backgroundColor: "oklch(from var(--color-primary) l c h / 0.05)" }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] h-[55vw] w-[55vw] rounded-full blur-[120px]"
          style={{ backgroundColor: "oklch(from var(--color-saffron, var(--color-primary)) l c h / 0.07)" }}
        />
        <div
          className="absolute top-[10%] right-[5%] h-[30vw] w-[30vw] rounded-full blur-[80px]"
          style={{ backgroundColor: "oklch(from var(--color-primary) l c h / 0.025)" }}
        />
      </div>

      {/* Card column */}
      <div className="relative z-10 w-full max-w-[420px] tl-enter tl-enter-1">
        {/* Brand lockup */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="brand-mark grid size-9 shrink-0 place-items-center rounded-lg font-display text-[15px] font-bold text-[var(--color-primary-foreground)]">T</span>
            <span className="font-display text-[26px] font-semibold tracking-tight text-[var(--color-foreground)]">
              Tris<span className="text-[var(--color-primary)]">lab</span>
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[oklch(from_var(--color-muted-foreground)_l_c_h_/_0.7)]">
            <span aria-hidden className="h-px w-6 bg-[var(--color-border)]" />
            <span>{t("tagline.starterKit")}</span>
            <span aria-hidden className="h-px w-6 bg-[var(--color-border)]" />
          </div>
        </div>

        {/* Status card */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[oklch(from_var(--color-card)_l_c_h_/_0.85)] shadow-[0_1px_3px_oklch(0_0_0_/_0.04),0_8px_24px_oklch(0_0_0_/_0.06)] backdrop-blur-xl">
          <div className="px-6 py-7 sm:px-8 sm:py-9">
            {status.kind === "form" && (
              <>
                <div className="mb-6">
                  <h1 className="mb-1.5 font-display text-[22px] font-semibold tracking-tight text-[var(--color-foreground)]">
                    {t("confirm.formTitleLead")}{" "}
                    <span className="text-[var(--color-primary)]">{t("confirm.formTitleAccent")}</span>
                  </h1>
                  <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">
                    {t("confirm.formBody")}
                  </p>
                </div>
                <form onSubmit={onSubmit} className="space-y-5" noValidate aria-describedby={formError ? "confirm-error" : undefined}>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className={labelClass}>
                      {t("confirm.password")}
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFormError(null);
                      }}
                      autoComplete="new-password"
                      autoFocus
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                      className="h-11 text-[14px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className={labelClass}>
                      {t("confirm.confirmPassword")}
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirm}
                      onChange={(e) => {
                        setConfirm(e.target.value);
                        setFormError(null);
                      }}
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                      className="h-11 text-[14px]"
                    />
                  </div>
                  {formError && (
                    <div
                      id="confirm-error"
                      role="alert"
                      className="tl-enter flex items-start gap-2 rounded-lg border border-[oklch(from_var(--color-destructive)_l_c_h_/_0.30)] bg-[oklch(from_var(--color-destructive)_l_c_h_/_0.06)] px-3 py-2 text-sm text-[var(--color-destructive)]"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span className="leading-snug">{formError}</span>
                    </div>
                  )}
                  <Button type="submit" disabled={mutation.isPending || !ready} className="group h-11 w-full text-[14px] font-semibold">
                    {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    <span>{mutation.isPending ? t("confirm.submitting") : t("confirm.submit")}</span>
                  </Button>
                </form>
              </>
            )}

            {status.kind === "success" && (
              <div className="tl-enter space-y-5 text-center">
                <div className="grid place-items-center">
                  <span
                    aria-hidden
                    className="grid size-14 place-items-center rounded-2xl bg-[oklch(from_var(--color-success)_l_c_h_/_0.10)] text-[var(--color-success)]"
                  >
                    <CheckCircle2 className="size-6" />
                  </span>
                </div>
                <div>
                  <h1 className="mb-1.5 font-display text-[22px] font-semibold tracking-tight text-[var(--color-foreground)]">
                    {t("confirm.successTitleLead")}{" "}
                    <span className="text-[var(--color-primary)]">{t("confirm.successTitleAccent")}</span>
                  </h1>
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
                    className="grid size-14 place-items-center rounded-2xl bg-[oklch(from_var(--color-destructive)_l_c_h_/_0.10)] text-[var(--color-destructive)]"
                  >
                    <AlertCircle className="size-6" />
                  </span>
                </div>
                <div>
                  <h1 className="mb-1.5 font-display text-[22px] font-semibold tracking-tight text-[var(--color-foreground)]">
                    {t("confirm.errorTitleLead")}{" "}
                    <span className="text-[var(--color-primary)]">{t("confirm.errorTitleAccent")}</span>{" "}
                    {t("confirm.errorTitleTrail")}
                  </h1>
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
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-[12.5px] text-[var(--color-muted-foreground)] underline-offset-4 hover:text-[var(--color-foreground)] hover:underline"
          >
            {t("confirm.backLink")}
          </Link>
        </div>
      </div>
    </div>
  );
}
