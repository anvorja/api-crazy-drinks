/** What billing needs to know about accounts (implemented over the identity context). */
export interface UserDirectory {
  exists(userId: string): Promise<boolean>;
}
