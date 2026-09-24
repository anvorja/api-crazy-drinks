/** What billing needs to know about accounts (implemented over the identity context). */
export interface UserDirectory {
  exists(userId: string): Promise<boolean>;
  /** Where to send receipts and prefill the checkout; null if the user doesn't exist. */
  emailOf(userId: string): Promise<string | null>;
}
