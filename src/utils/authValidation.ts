export const AUTH_ROLES = ['Admin', 'Committee', 'Accountant', 'Resident'] as const;
export type AuthRole = typeof AUTH_ROLES[number];

export function isStrongPassword(value: string): boolean {
  return value.length >= 12 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value);
}

export function isAllowedAuthRole(value: unknown): value is AuthRole {
  return AUTH_ROLES.includes(String(value) as AuthRole);
}

export function isActiveAuthenticatedProfile(profile: any): boolean {
  return Boolean(
    profile &&
    String(profile.Account_Status || '').trim().toLowerCase() === 'active' &&
    isAllowedAuthRole(profile.Role) &&
    String(profile.UserID || '').trim()
  );
}
