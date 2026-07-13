export const USER_ROLES = ['BUYER', 'SELLER', 'MODERATOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export interface AuthUser {
  id: string;
  roles: UserRole[];
}
