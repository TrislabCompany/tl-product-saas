import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

type Strength = "weak" | "fair" | "strong";

function scorePassword(value: string): Strength | null {
  if (value.length === 0) return null;
  if (value.length < MIN_PASSWORD_LENGTH) return "weak";

  let score = 0;
  if (/[a-z]/.test(value)) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (value.length >= 12) score++;

  if (score <= 2) return "weak";
  if (score === 3) return "fair";
  return "strong";
}

const STRENGTH_META: Record<Strength, { fill: string; bar: string }> = {
  weak: { fill: "bg-[var(--color-destructive)]", bar: "w-1/3" },
  fair: { fill: "bg-[var(--color-warning)]", bar: "w-2/3" },
  strong: { fill: "bg-[var(--color-success)]", bar: "w-full" },
};

type NewPasswordFieldsProps = {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  /** The id of the form's error message, when one shows. */
  errorId?: string;
  autoFocus?: boolean;
};

/**
 * The new password and its confirmation, with a strength meter: the reset-password, confirm-email and
 * accept-invitation pages all set a password this way.
 */
export function NewPasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  errorId,
  autoFocus = false,
}: NewPasswordFieldsProps) {
  const { t } = useTranslation("auth");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const strength = useMemo(() => scorePassword(password), [password]);
  const matches = password.length > 0 && password === confirm;
  const toggleClass =
    "absolute right-3.5 top-1/2 grid h-6 w-6 -translate-y-1/2 cursor-pointer place-items-center rounded text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";
  const labelClass = "block text-[11.5px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]";

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="new-password" className={labelClass}>
          {t("reset.newPassword")}
        </Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={t("reset.newPasswordPlaceholder")}
            required
            autoComplete="new-password"
            autoFocus={autoFocus}
            minLength={MIN_PASSWORD_LENGTH}
            aria-describedby={errorId}
            className="h-11 pr-11 text-[14px]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("reset.hidePassword") : t("reset.showPassword")}
            className={toggleClass}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        {strength && (
          <div className="tl-enter flex items-center gap-2 pt-1.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
              <div className={cn("h-full transition-all duration-200", STRENGTH_META[strength].fill, STRENGTH_META[strength].bar)} />
            </div>
            <span className="min-w-[3.5rem] text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              {t(`reset.strength_${strength}`)}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm-password" className={labelClass}>
          {t("reset.confirmPassword")}
        </Label>
        <div className="relative">
          <Input
            id="confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
            placeholder={t("reset.confirmPasswordPlaceholder")}
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            aria-describedby={errorId}
            className="h-11 pr-11 text-[14px]"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? t("reset.hidePassword") : t("reset.showPassword")}
            className={toggleClass}
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        {confirm.length > 0 && (
          <div
            className={cn(
              "flex items-center gap-1.5 pt-1 text-[11.5px]",
              matches ? "text-[var(--color-success)]" : "text-[var(--color-muted-foreground)]",
            )}
          >
            <Check className={cn("size-3.5", matches ? "opacity-100" : "opacity-40")} />
            <span>{matches ? t("reset.matches") : t("reset.notMatchYet")}</span>
          </div>
        )}
      </div>
    </>
  );
}
