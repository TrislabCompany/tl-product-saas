import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailPlus } from "lucide-react";
import { toast } from "sonner";
import type { TFunction } from "i18next";
import { inviteUser } from "@/api/users";
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
import { describeError } from "@/lib/api-client";

type TFn = TFunction<"users">;

const makeSchema = (t: TFn) =>
  z.object({
    email: z.string().trim().pipe(z.email(t("invite.validation.email"))),
    firstName: z.string().trim().max(64).optional(),
    lastName: z.string().trim().max(64).optional(),
  });

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

/**
 * Invites an operator into root. Users are global: the address gets an e-mail with a link, a new address sets
 * its own password there, and an existing account signs in and accepts. Nobody chooses another person's password.
 */
export function InviteUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();
  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", firstName: "", lastName: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      inviteUser({
        email: values.email,
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
      }),
    onSuccess: (_, values) => {
      toast.success(t("invite.toast.sent"), { description: t("invite.toast.sentDesc", { email: values.email }) });
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
      handleClose();
    },
    onError: (err) => toast.error(t("invite.toast.failed"), { description: describeError(err) }),
  });

  function handleClose() {
    reset();
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
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[oklch(from_var(--color-primary)_l_c_h_/_0.12)] text-[var(--color-primary)] ring-1 ring-inset ring-[oklch(from_var(--color-primary)_l_c_h_/_0.18)]"
            >
              <MailPlus className="h-[18px] w-[18px]" />
            </span>
            <DialogTitle className="text-[16px]">{t("invite.title")}</DialogTitle>
          </div>
          <DialogDescription className="mt-1">{t("invite.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <DialogBody className="space-y-4">
            <Field id="iu-email" label={t("invite.field.email")} required error={errors.email?.message}>
              <Input
                id="iu-email"
                type="email"
                placeholder="user@example.com"
                autoComplete="off"
                className="font-mono"
                autoFocus
                aria-invalid={errors.email ? true : undefined}
                {...register("email")}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="iu-firstName" label={t("invite.field.firstName")} hint={t("invite.field.nameHint")}>
                <Input id="iu-firstName" autoComplete="off" {...register("firstName")} />
              </Field>
              <Field id="iu-lastName" label={t("invite.field.lastName")}>
                <Input id="iu-lastName" autoComplete="off" {...register("lastName")} />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              {t("invite.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("invite.sending") : t("invite.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
