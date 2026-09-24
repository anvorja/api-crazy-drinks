/** Messages sent to account owners (implemented with email). */
export interface AccountNotifier {
  passwordResetRequested(
    to: { email: string; name: string },
    token: string,
    expiresInMinutes: number,
  ): Promise<void>;
  passwordChanged(to: { email: string; name: string }): Promise<void>;
}
