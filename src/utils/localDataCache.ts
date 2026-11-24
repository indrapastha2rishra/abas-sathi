/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RolePermissionRecord } from './permissions';

export interface CachedModuleEntry {
  at: number;
  data: any[];
}

export interface ScopedSnapshot {
  savedAt: number;
  modules: Record<string, CachedModuleEntry>;
}

const SNAPSHOT_PREFIX = 'abasSathiSnapshot:';
const FUND_PREFIX = 'abasSathiFundBalance:';
const PERM_PREFIX = 'abasSathiRolePermissions:';
const SUMMARY_PREFIX = 'abasSathiDashboardSummary:';

export function buildScopeKey(
  societyCode: string | undefined,
  userId: string | undefined,
  role: string | undefined,
  isResidentMode: boolean
): string {
  return [
    String(societyCode || '').trim().toUpperCase(),
    String(userId || '').trim(),
    String(role || '').trim(),
    isResidentMode ? 'resident-preview' : 'staff',
  ].join(':');
}

export function readCachedPermissions(societyCode?: string, role?: string): RolePermissionRecord[] {
  if (typeof window === 'undefined' || !societyCode || !role) return [];
  try {
    const raw = window.localStorage.getItem(`${PERM_PREFIX}${societyCode}:${role}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rows) ? (parsed.rows as RolePermissionRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeCachedPermissions(societyCode: string | undefined, role: string | undefined, rows: RolePermissionRecord[]): void {
  if (typeof window === 'undefined' || !societyCode || !role) return;
  try {
    window.localStorage.setItem(`${PERM_PREFIX}${societyCode}:${role}`, JSON.stringify({ savedAt: Date.now(), rows }));
  } catch {
    // Ignore storage quota errors
  }
}

export function readScopedSnapshot(scopeKey: string): ScopedSnapshot | null {
  if (typeof window === 'undefined' || !scopeKey) return null;
  try {
    const raw = window.localStorage.getItem(`${SNAPSHOT_PREFIX}${scopeKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.modules !== 'object' || !parsed.modules) return null;
    return parsed as ScopedSnapshot;
  } catch {
    return null;
  }
}

export function writeScopedSnapshotModules(
  scopeKey: string,
  updates: Record<string, any[]>,
  timestamp = Date.now()
): void {
  if (typeof window === 'undefined' || !scopeKey) return;
  const keys = Object.keys(updates);
  if (!keys.length) return;
  try {
    const existing = readScopedSnapshot(scopeKey) || { savedAt: timestamp, modules: {} };
    const nextModules: Record<string, CachedModuleEntry> = { ...existing.modules };
    for (const key of keys) {
      if (Array.isArray(updates[key])) {
        nextModules[key] = { at: timestamp, data: updates[key] };
      }
    }
    const payload = JSON.stringify({ savedAt: timestamp, modules: nextModules });
    try {
      window.localStorage.setItem(`${SNAPSHOT_PREFIX}${scopeKey}`, payload);
    } catch {
      // If quota is exceeded, keep only the newly updated modules.
      const compact: Record<string, CachedModuleEntry> = {};
      for (const key of keys) {
        if (Array.isArray(updates[key])) {
          compact[key] = { at: timestamp, data: updates[key] };
        }
      }
      window.localStorage.setItem(`${SNAPSHOT_PREFIX}${scopeKey}`, JSON.stringify({ savedAt: timestamp, modules: compact }));
    }
  } catch {
    // Ignore storage quota or serialization errors
  }
}

export function invalidateScopedSnapshotModules(scopeKey: string, modules?: string[]): void {
  if (typeof window === 'undefined' || !scopeKey) return;
  try {
    if (!modules || !modules.length) {
      window.localStorage.removeItem(`${SNAPSHOT_PREFIX}${scopeKey}`);
      return;
    }
    const existing = readScopedSnapshot(scopeKey);
    if (!existing) return;
    const nextModules = { ...existing.modules };
    for (const mod of modules) {
      delete nextModules[mod];
    }
    window.localStorage.setItem(`${SNAPSHOT_PREFIX}${scopeKey}`, JSON.stringify({ savedAt: existing.savedAt, modules: nextModules }));
  } catch {
    // Ignore storage errors
  }
}

export function readFundBalanceCache(societyCode?: string, userId?: string): any | null {
  if (typeof window === 'undefined' || !societyCode || !userId) return null;
  try {
    const raw = window.localStorage.getItem(`${FUND_PREFIX}${societyCode}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export function writeFundBalanceCache(societyCode: string | undefined, userId: string | undefined, data: any): void {
  if (typeof window === 'undefined' || !societyCode || !userId || !data) return;
  try {
    window.localStorage.setItem(`${FUND_PREFIX}${societyCode}:${userId}`, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Ignore storage errors
  }
}

export function clearFundBalanceCache(societyCode?: string, userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (societyCode && userId) {
      window.localStorage.removeItem(`${FUND_PREFIX}${societyCode}:${userId}`);
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearAllUserDataCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const localKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith(SNAPSHOT_PREFIX) || k.startsWith(FUND_PREFIX))) {
        localKeys.push(k);
      }
    }
    localKeys.forEach((k) => window.localStorage.removeItem(k));
    const sessionKeys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(SUMMARY_PREFIX)) {
        sessionKeys.push(k);
      }
    }
    sessionKeys.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
}
