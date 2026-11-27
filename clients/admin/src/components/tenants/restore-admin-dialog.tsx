import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { restoreTenantAdminAccess } from "@/api/tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiRequestError } from "@/lib/api-client";
import type { TFunction } from "i18next";

type TFn = TFunction<"tenants">;

const makeSchema = (t: TFn) =>
  z.object({
    email: z.string().trim().pipe(z.email(t("restoreAdmin.validation.email"))),
    reason: z
      .string()
      .trim()
      .min(4, t("restoreAdmin.validation.reason"))
      .max(500, t("restoreAdmin.validation.reasonMax")),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
  });

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const EMPTY: FormValues = { email: "", reason: "", firstName: "", lastName: "" };

function describe(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) return err.problem?.detail ?? err.problem?.title ?? err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * Gives a tenant an Admin again, when its customer has lost every way in (D-44). The only write the operator makes
 * inside a tenant: an active member with the address becomes Admin, or the address is invited as Admin. The
 * tenant's active Admins are e-mailed and the tenant's audit trail records it, so check with the customer first.
 */
export function RestoreAdminDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
}) {
  const { t } = useTranslation("tenants");
  const queryClient = useQueryClient();
  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const mutation = useMutation({
    // The values ride through mutate(arg), never through form state the callbacks close over.
    mutationFn: (values: FormValues) => restoreTenantAdminAccess(tenantId, values),
    onSuccess: (result, values) => {
      toast.success(
        result.outcome === "RoleAssigned" ? t("restoreAdmin.toast.assigned") : t("restoreAdmin.toast.invited"),
        { description: t("restoreAdmin.toast.notified", { email: values.email, admins: result.adminsNotified }) },
      );
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
      handleClose();
    },
    onError: (err) =>
      toast.error(t("restoreAdmin.toast.failed"), { description: describe(err, t("restoreAdmin.toast.failedFallback")) }),
  });

  function handleClose() {
    reset(EMPTY);
    onOpenChange(false);
  }

  const onSubmit = handleSubmit((values) => mutation.mutate(values));
  const submitting = isSubmitting || mutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-[var(--color-primary)] ring-1 ring-inset ring-primary/18"
            >
              <UserPlus className="h-[18px] w-[18px]" />
            </span>
            <DialogTitle className="text-[16px]">{t("restoreAdmin.title")}</DialogTitle>
          </div>
          <DialogDescription className="mt-1">{t("restoreAdmin.description", { name: tenantName })}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <DialogBody className="space-y-4">
            <Field id="ra-email" label={t("restoreAdmin.field.email")} required error={errors.email?.message}>
              <Input id="ra-email" type="email" autoComplete="off" {...register("email")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ra-firstName" label={t("restoreAdmin.field.firstName")} error={errors.firstName?.message}>
                <Input id="ra-firstName" autoComplete="off" {...register("firstName")} />
              </Field>
              <Field id="ra-lastName" label={t("restoreAdmin.field.lastName")} error={errors.lastName?.message}>
                <Input id="ra-lastName" autoComplete="off" {...register("lastName")} />
              </Field>
            </div>
            <Field
              id="ra-reason"
              label={t("restoreAdmin.field.reason")}
              required
              hint={t("restoreAdmin.field.reasonHint")}
              error={errors.reason?.message}
            >
              <Input id="ra-reason" autoComplete="off" maxLength={500} {...register("reason")} />
            </Field>
            <div className="flex items-start gap-2 rounded-md border border-[var(--color-warning)]/40 bg-warning/8 px-3 py-2.5 text-xs text-[var(--color-foreground)]">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-warning)]" />
              <span>{t("restoreAdmin.warning")}</span>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              {t("restoreAdmin.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("restoreAdmin.saving") : t("restoreAdmin.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
