/** The shortest password the sign-up, reset and invitation forms accept (the server's rule is checked there too). */
export const MIN_PASSWORD_LENGTH = 8;

/** Whether a new password and its confirmation match and are long enough to submit. */
export function isNewPasswordReady(password: string, confirm: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password === confirm;
}
