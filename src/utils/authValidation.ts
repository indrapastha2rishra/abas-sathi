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

export function normalizeAuthRole(value: unknown): AuthRole | '' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'admin') return 'Admin';
  if (normalized === 'committee') return 'Committee';
  if (normalized === 'accountant') return 'Accountant';
  if (normalized === 'resident') return 'Resident';
  return '';
}

export function isAllowedAuthRole(value: unknown): value is AuthRole {
  return normalizeAuthRole(value) !== '';
}

export function isActiveAuthenticatedProfile(profile: any): boolean {
  return Boolean(
    profile &&
    String(profile.Account_Status || '').trim().toLowerCase() === 'active' &&
    isAllowedAuthRole(profile.Role) &&
    String(profile.UserID || '').trim()
  );
}
