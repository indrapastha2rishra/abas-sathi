/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  UserRole,
  UserMaster,
  PropertyMaster,
  OwnerMaster,
  OwnershipHistory,
  TenantMaster,
  RateMaster,
  InvoiceRegister,
  FundInflowRegister,
  BillWiseDetails,
  ExpenseRegister,
  ExpenseCategoryMaster,
  BankAccountMaster,
  ActivityRequestRegister,
  NoticeMaster,
  GalleryMaster,
  GalleryPhoto,
  PreventiveMaintenanceMaster,
  AuditLog,
  FinancialYearMaster,
  AccountHeadMaster,
  PropertyUtilityDetails,
  PaymentMode,
} from '../types/database';

import { Language, translations } from '../utils/i18n';
import { authRequest, BackendRequestError } from '../utils/authClient';
import { normalizeAuthRole } from '../utils/authValidation';
import { computeInvoiceOutstandingBills, roundMoney, toInvoiceAmount } from '../utils/invoiceOutstanding';
import { permissionGranted, moduleForTab, actionForTab, type PermissionAction, type RolePermissionRecord } from '../utils/permissions';
import {
  buildScopeKey,
  clearAllUserDataCaches,
  clearFundBalanceCache,
  invalidateScopedSnapshotModules,
  readCachedPermissions,
  readScopedSnapshot,
  writeCachedPermissions,
  writeScopedSnapshotModules,
} from '../utils/localDataCache';

export interface GoogleBackendConfig {
  spreadsheetId: string;
  driveFolderId: string;
  appsScriptWebAppUrl: string;
}

export interface SocietySettings {
  societyCode: string;
  societyName: string;
  societyAddress: string;
  societyRegistrationNo: string;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['en'];

  // Current session & role
  currentUser: UserMaster;
  setCurrentUser: (user: UserMaster) => void;
  activeRole: UserRole;
  actualRole: UserRole;
  isResidentMode: boolean;
  toggleResidentMode: () => boolean;
  hasPermission: (moduleName: string, action?: PermissionAction) => boolean;
  canAccessTab: (tab: string) => boolean;
  rolePermissions: RolePermissionRecord[];
  permissionsReady: boolean;
  refreshRolePermissions: () => Promise<void>;
  deleteRolePermission: (permissionId: string) => Promise<void>;
  setActiveRole: (role: UserRole) => void;
  switchUser: (userId: string) => void;
  residentProperty: PropertyMaster | null;

  // Active view
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Database records
  properties: PropertyMaster[];
  owners: OwnerMaster[];
  ownerships: OwnershipHistory[];
  tenants: TenantMaster[];
  rates: RateMaster[];
  invoices: InvoiceRegister[];
  receipts: FundInflowRegister[];
  billAllocations: BillWiseDetails[];
  expenses: ExpenseRegister[];
  expenseCategories: ExpenseCategoryMaster[];
  bankAccounts: BankAccountMaster[];
  activityRequests: ActivityRequestRegister[];
  notices: NoticeMaster[];
  gallery: GalleryMaster[];
  galleryPhotos: GalleryPhoto[];
  preventiveMaintenance: PreventiveMaintenanceMaster[];
  auditLogs: AuditLog[];
  financialYears: FinancialYearMaster[];
  accountHeads: AccountHeadMaster[];
  propertyUtilities: PropertyUtilityDetails[];
  users: UserMaster[];
  isRefreshingData: boolean;
  refreshActiveData: () => Promise<void>;

  // Modals & previews
  previewInvoice: InvoiceRegister | null;
  setPreviewInvoice: (inv: InvoiceRegister | null) => void;
  previewReceipt: FundInflowRegister | null;
  setPreviewReceipt: (rec: FundInflowRegister | null) => void;
  previewVoucher: ExpenseRegister | null;
  setPreviewVoucher: (exp: ExpenseRegister | null) => void;

  // Actions
  cancelInvoice: (invoiceId: string, reason: string) => Promise<void>;
  generateInvoice: (params: {
    propertyId: string;
    rateId: string;
    billPeriodFrom: string;
    billPeriodTo: string;
    dueDate: string;
    lateFee?: number;
    discount?: number;
    adjustment?: number;
    remarks?: string;
  }) => Promise<InvoiceRegister>;

  submitResidentPayment: (params: {
    invoiceIds: string[];
    amount: number;
    mode: PaymentMode;
    reference: string;
    bankAccount: string;
    remarks?: string;
    proofFileName?: string;
    propertyId?: string;
  }) => Promise<FundInflowRegister>;

  confirmAndAllocatePayment: (receiptId: string, customAllocations?: { invoiceId: string; amount: number }[]) => Promise<FundInflowRegister>;

  addExpense: (params: Omit<ExpenseRegister, 'Expense_ID' | 'Voucher_No' | 'Created_At' | 'Created_By' | 'Approved_At' | 'Approved_By' | 'Cancelled_At' | 'Cancelled_By' | 'Cancellation_Reason'>) => Promise<ExpenseRegister>;

  approveExpense: (expenseId: string) => Promise<void>;
  markExpensePaid: (expenseId: string) => Promise<void>;

  createActivityRequest: (params: {
    category: ActivityRequestRegister['Request_Category'];
    subject: string;
    description: string;
    priority: ActivityRequestRegister['Priority'];
    attachment?: string;
  }) => Promise<ActivityRequestRegister>;

  updateActivityRequest: (
    requestId: string,
    updates: Partial<Pick<ActivityRequestRegister, 'Request_Status' | 'Assigned_To' | 'Admin_Remarks' | 'Completion_Date' | 'Completion_Proof'>>
  ) => Promise<void>;

  createNotice: (notice: Omit<NoticeMaster, 'Notice_ID' | 'Notice_Number' | 'Created_At' | 'Created_By'>) => Promise<void>;

  // Backend & society settings
  googleConfig: GoogleBackendConfig;
  updateGoogleConfig: (config: Partial<GoogleBackendConfig>) => void;
  societySettings: SocietySettings;
  updateSocietySettings: (settings: Partial<SocietySettings>) => Promise<SocietySettings>;
  uploadPrivateFile: (file: File, category: string, propertyId?: string, ownerId?: string, relatedModule?: string, relatedRecordId?: string) => Promise<{fileId:string;fileName:string;mimeType:string}>;
  createModuleRecord: (module: string, record: Record<string, unknown>) => Promise<any>;
  updateModuleRecord: (module: string, recordId: string, record: Record<string, unknown>) => Promise<any>;
  cancelModuleRecord: (module: string, recordId: string, reason: string) => Promise<any>;
  getPrivateFile: (fileId: string, propertyId?: string) => Promise<any>;
  createSocietyBackup: () => Promise<any>;
  configureAutomatedBackup: (enabled: boolean) => Promise<any>;
  listSocietyBackups: () => Promise<any[]>;
  listRecoveryOperations: () => Promise<any[]>;
  restoreSocietyBackup: (backupFileId: string) => Promise<any>;
  listPrivateFiles: (category?: string) => Promise<any[]>;
  getReport: (reportType: string, filters?: Record<string, unknown>) => Promise<any>;
  createReportSnapshot: (asOfDate: string, remarks?: string) => Promise<any>;
  approveReportSnapshot: (snapshotId: string) => Promise<any>;
  listReportSnapshots: () => Promise<any[]>;
  postOpeningBalances: (entries: Array<{accountCode?:string;accountName:string;accountType:string;debit:number;credit:number}>, effectiveDate: string) => Promise<any>;
  getFundBalanceSummary: () => Promise<any>;
  getYearEndClosingPreview: (fyId: string, initialCashOpening?: number) => Promise<any>;
  finalizeYearEndClosing: (fyId: string, rows: any[], remarks?: string, initialCashOpening?: number) => Promise<any>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSession = (() => {
    try { return JSON.parse(localStorage.getItem('abasSathiSession') || '{}'); } catch { return {}; }
  })();
  const initialRole: UserRole = normalizeAuthRole(initialSession?.user?.role) || 'Resident';
  const initialScopeKey = initialSession?.token
    ? buildScopeKey(initialSession.societyCode, initialSession.user?.userId, initialRole, false)
    : '';
  const initialSnapshot = initialScopeKey ? readScopedSnapshot(initialScopeKey) : null;
  const initialModules = initialSnapshot?.modules || {};
  const initialPermissions = initialSession?.token
    ? readCachedPermissions(initialSession.societyCode, initialRole)
    : [];

  const [language, setLanguage] = useState<Language>('en');
  const [users, setUsers] = useState<UserMaster[]>([]);
  const [currentUser, setCurrentUser] = useState<UserMaster>(() => { try { const s = initialSession; const u = s.user || {}; return { UserID:u.userId || '', Full_Name:u.fullName || '', Email_ID:u.email || '', Mobile_No:u.mobile || '', Role:normalizeAuthRole(u.role) || 'Resident', PropertyID:u.propertyId || null, Ownership_ID:u.ownershipId || null, Account_Status:'Active', Last_Login:new Date().toISOString(), Created_By:'', Created_At:'' }; } catch { return { UserID:'', Full_Name:'', Email_ID:'', Mobile_No:'', Role:'Resident', PropertyID:null, Ownership_ID:null, Account_Status:'Active', Last_Login:'', Created_By:'', Created_At:'' }; } }); // Starts as Admin
  const [activeRole, setActiveRole] = useState<UserRole>(initialRole);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const actualRole: UserRole = currentUser.Role || 'Resident';
  const [isResidentMode, setIsResidentMode] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRecord[]>(initialPermissions);
  const [permissionsReady, setPermissionsReady] = useState<boolean>(initialPermissions.length > 0);

  // Database collections (synchronously hydrated from scoped local snapshot for <1ms UI boot)
  const [properties, setProperties] = useState<PropertyMaster[]>(() => (initialModules.properties?.data || []) as PropertyMaster[]);
  const [owners, setOwners] = useState<OwnerMaster[]>(() => (initialModules.owners?.data || []) as OwnerMaster[]);
  const [ownerships, setOwnerships] = useState<OwnershipHistory[]>(() => (initialModules.ownershipHistory?.data || []) as OwnershipHistory[]);
  const [tenants, setTenants] = useState<TenantMaster[]>(() => (initialModules.tenants?.data || []) as TenantMaster[]);
  const [rates, setRates] = useState<RateMaster[]>(() => (initialModules.rates?.data || []) as RateMaster[]);
  const [invoices, setInvoices] = useState<InvoiceRegister[]>(() => (initialModules.invoices?.data || []) as InvoiceRegister[]);
  const [receipts, setReceipts] = useState<FundInflowRegister[]>(() => (initialModules.receipts?.data || []) as FundInflowRegister[]);
  const [billAllocations, setBillAllocations] = useState<BillWiseDetails[]>(() => (initialModules.billWiseDetails?.data || []) as BillWiseDetails[]);
  const [expenses, setExpenses] = useState<ExpenseRegister[]>(() => (initialModules.expenses?.data || []) as ExpenseRegister[]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryMaster[]>(() => (initialModules.expenseCategories?.data || []) as ExpenseCategoryMaster[]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountMaster[]>(() => (initialModules.bankAccounts?.data || []) as BankAccountMaster[]);
  const [activityRequests, setActivityRequests] = useState<ActivityRequestRegister[]>(() => (initialModules.activityRequests?.data || []) as ActivityRequestRegister[]);
  const [notices, setNotices] = useState<NoticeMaster[]>(() => (initialModules.notices?.data || []) as NoticeMaster[]);
  const [gallery, setGallery] = useState<GalleryMaster[]>(() => (initialModules.gallery?.data || []) as GalleryMaster[]);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>(() => (initialModules.galleryPhotos?.data || []) as GalleryPhoto[]);
  const [preventiveMaintenance, setPreventiveMaintenance] = useState<PreventiveMaintenanceMaster[]>(() => (initialModules.preventiveMaintenance?.data || []) as PreventiveMaintenanceMaster[]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => (initialModules.auditLogs?.data || []) as AuditLog[]);
  const [financialYears, setFinancialYears] = useState<FinancialYearMaster[]>(() => (initialModules.financialYears?.data || []) as FinancialYearMaster[]);
  const [accountHeads, setAccountHeads] = useState<AccountHeadMaster[]>(() => (initialModules.accountHeads?.data || []) as AccountHeadMaster[]);
  const [propertyUtilities, setPropertyUtilities] = useState<PropertyUtilityDetails[]>(() => (initialModules.propertyUtilityDetails?.data || []) as PropertyUtilityDetails[]);
  const [societySettings, setSocietySettings] = useState<SocietySettings>(() => {
    try {
      const s = initialSession || {};
      const summaryCacheKey = s.societyCode && s.user?.userId ? `abasSathiDashboardSummary:${s.societyCode}:${s.user.userId}` : '';
      const cachedSummary = summaryCacheKey ? JSON.parse(sessionStorage.getItem(summaryCacheKey) || 'null') : null;
      const soc = cachedSummary?.society || {};
      return {
        societyCode: String(soc.societyCode || s.societyCode || '').trim(),
        societyName: String(soc.societyName || s.societyName || '').trim(),
        societyAddress: String(soc.societyAddress || s.societyAddress || '').trim(),
        societyRegistrationNo: String(soc.societyRegistrationNo || s.societyRegistrationNo || '').trim(),
      };
    } catch {
      return { societyCode: '', societyName: '', societyAddress: '', societyRegistrationNo: '' };
    }
  });
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const forceRefreshRef = useRef(false);
  const refreshResolversRef = useRef<Array<() => void>>([]);

  // Document preview modals
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceRegister | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<FundInflowRegister | null>(null);
  const [previewVoucher, setPreviewVoucher] = useState<ExpenseRegister | null>(null);

  // Google backend configuration. Saved locally in this browser.
  const [googleConfig, setGoogleConfig] = useState<GoogleBackendConfig>(() => {
    const defaults: GoogleBackendConfig = {
      spreadsheetId: '',
      driveFolderId: '',
      //appsScriptWebAppUrl: 'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQhQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec',
      appsScriptWebAppUrl: 'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQhQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec',
    };
    try {
      if (typeof window === 'undefined') return defaults;
      const saved = window.localStorage.getItem('abasSathiGoogleConfig');
      if (!saved) return defaults;
      const parsed = JSON.parse(saved);
      const legacyUrls = [
        'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQqQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec',
        'https://script.google.com/macros/s/AKfycbxxlu1phgG2mxJE-atFXlwEqixpVUHHaSUWndNgvDhRTPPU8X7vSORZnvxKvYCZ6Jvj0w/exec'
      ];
      const configuredUrl = String(parsed.appsScriptWebAppUrl || '').trim();
      const sanitized = {
        ...defaults, ...parsed,
        appsScriptWebAppUrl: (!configuredUrl || legacyUrls.includes(configuredUrl)) ? defaults.appsScriptWebAppUrl : configuredUrl,
        spreadsheetId: '', driveFolderId: ''
      };
      window.localStorage.setItem('abasSathiGoogleConfig', JSON.stringify(sanitized));
      return sanitized;
    } catch {
      return defaults;
    }
  });

  const updateGoogleConfig = (cfg: Partial<GoogleBackendConfig>) => {
    setGoogleConfig((prev) => {
      const next = { ...prev, ...cfg, spreadsheetId: '', driveFolderId: '' };
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('abasSathiGoogleConfig', JSON.stringify(next));
        }
      } catch (error) {
        console.error('ABAS SATHI: Could not save Google configuration:', error);
      }
      return next;
    });
  };

  const syncSocietyToSession = (next: SocietySettings) => {
    try {
      const latest = JSON.parse(localStorage.getItem('abasSathiSession') || '{}');
      if (latest.token) {
        latest.societyCode = next.societyCode || latest.societyCode || '';
        latest.societyName = next.societyName;
        latest.societyAddress = next.societyAddress;
        latest.societyRegistrationNo = next.societyRegistrationNo;
        localStorage.setItem('abasSathiSession', JSON.stringify(latest));
      }
    } catch {}
  };

  const updateSocietySettings = async (patch: Partial<SocietySettings>): Promise<SocietySettings> => {
    const payload = {
      societyName: String(patch.societyName ?? societySettings.societyName ?? '').trim(),
      societyAddress: String(patch.societyAddress ?? societySettings.societyAddress ?? '').trim(),
      societyRegistrationNo: String(patch.societyRegistrationNo ?? societySettings.societyRegistrationNo ?? '').trim(),
    };
    const result: any = await apiCall('updateSocietySettings', payload);
    const serverSoc = result?.society || {};
    const next: SocietySettings = {
      societyCode: String(serverSoc.societyCode || societySettings.societyCode || '').trim(),
      societyName: String(serverSoc.societyName ?? payload.societyName).trim(),
      societyAddress: String(serverSoc.societyAddress ?? payload.societyAddress).trim(),
      societyRegistrationNo: String(serverSoc.societyRegistrationNo ?? payload.societyRegistrationNo).trim(),
    };
    setSocietySettings(next);
    syncSocietyToSession(next);
    return next;
  };

  const t = translations[language];
  const newRequestId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pendingRequestIds = useRef(new Map<string,string>());
  const moduleDataCache = useRef(new Map<string,{at:number;data:any[]}>());
  // Seed in-memory cache once from the synchronous local snapshot so recent reloads skip redundant reads.
  const cacheSeededRef = useRef(false);
  if (!cacheSeededRef.current && initialScopeKey) {
    cacheSeededRef.current = true;
    Object.entries(initialModules).forEach(([mod, entry]) => {
      if (entry && Array.isArray(entry.data)) {
        moduleDataCache.current.set(`${initialScopeKey}:${mod}`, { at: Number(entry.at || 0), data: entry.data });
      }
    });
  }
  // In-flight read registry: concurrent components/navigation share one backend request.
  const inFlightReads = useRef(new Map<string,Promise<any>>());
  const readCacheTtlMs = 30000;
  const apiCall = async <T = any,>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
    let saved: any = {};
    try { saved = JSON.parse(localStorage.getItem('abasSathiSession') || '{}'); } catch {}
    if (!saved.token) throw new Error('Your login session has expired. Please sign in again.');
    const suppliedId = typeof payload.requestId === 'string' ? payload.requestId : '';
    const requestPayload = { ...payload }; delete requestPayload.requestId;
    const fingerprint = action + '|' + JSON.stringify(requestPayload);
    const requestId = suppliedId || pendingRequestIds.current.get(fingerprint) || newRequestId();
    pendingRequestIds.current.set(fingerprint, requestId);
    if (pendingRequestIds.current.size > 100) pendingRequestIds.current.delete(pendingRequestIds.current.keys().next().value as string);
    const request = { action, token: saved.token, ...requestPayload, requestId, viewAsResident:isResidentMode };
    const apiStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Only retry writes whose backend handlers persist requestId in the operation
    // ledger. Reusing the same ID makes an ambiguous network retry idempotent.
    const idempotentActions = new Set([
      'createRecord','updateRecord','cancelRecord','generateInvoice','cancelInvoice',
      'submitPayment','confirmPayment','rejectPayment','allocatePayment','createExpense',
      'approveExpense','markExpensePaid','cancelExpense',
      'postOpeningBalances','finalizeYearEndClosing'
    ]);
    try {
      let result: T;
      try {
        result = await authRequest<T>(request, { timeoutMs: action === 'uploadPrivateFile' ? 60000 : 25000 });
      } catch (error) {
        if (!(error instanceof BackendRequestError) || !error.retryable || !idempotentActions.has(action)) throw error;
        await new Promise(resolve => window.setTimeout(resolve, 350));
        result = await authRequest<T>(request);
      }
      pendingRequestIds.current.delete(fingerprint);
      const apiElapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - apiStartedAt);
      console.info('ABAS SATHI API timing', { action, elapsedMs: apiElapsed, role: saved.user?.role || 'unknown' });
      // Invalidate snapshots only after writes; reads must not evict warm module caches.
      const readActions = new Set(['getModuleData','getMyPermissions','getDashboardData','getRoleDashboardData','getDashboardSummary','getReports','getFundBalanceSummary','getYearEndClosingPreview','listReportSnapshots']);
      if (!readActions.has(action)) {
        const affected = typeof requestPayload.module === 'string' ? requestPayload.module : '';
        const scopeKey = buildScopeKey(saved.societyCode, saved.user?.userId, saved.user?.role, isResidentMode);
        if (affected) {
          for (const key of moduleDataCache.current.keys()) if (key.endsWith(':' + affected)) moduleDataCache.current.delete(key);
          invalidateScopedSnapshotModules(scopeKey, [affected]);
        } else {
          moduleDataCache.current.clear();
          invalidateScopedSnapshotModules(scopeKey);
        }
        if (['confirmPayment','markExpensePaid','cancelExpense','postOpeningBalances','finalizeYearEndClosing'].includes(action)) {
          clearFundBalanceCache(saved.societyCode, saved.user?.userId);
        }
        try { sessionStorage.removeItem(`abasSathiDashboardSummary:${saved.societyCode}:${saved.user?.userId}`); } catch {}
      }
      // Mirror the backend's sliding six-hour session TTL so an actively used
      // session is not discarded by an old client-side expiry timestamp.
      try {
        const latest = JSON.parse(localStorage.getItem('abasSathiSession') || '{}');
        if (latest.token === saved.token) {
          latest.expiresAt = Date.now() + 21600 * 1000;
          localStorage.setItem('abasSathiSession', JSON.stringify(latest));
        }
      } catch {}
      return result;
    } catch (error) {
      // Keep the same requestId for a deliberate retry after an ambiguous network failure.
      throw error;
    }
  };

  // Load only the modules required by the active screen, hydrating immediately from cache and refreshing progressively.
  useEffect(() => {
    const baseUrl = googleConfig.appsScriptWebAppUrl.trim();
    let session: any = {};
    try { session = JSON.parse(localStorage.getItem('abasSathiSession') || '{}'); } catch {}
    if (!session.token || !baseUrl) { setPermissionsReady(true); return; }
    let cancelled = false;

    const sessionRole = normalizeAuthRole(session.user?.role) || session.user?.role;
    const scopeKey = buildScopeKey(session.societyCode, session.user?.userId, sessionRole, isResidentMode);
    const cachedPerms = readCachedPermissions(session.societyCode, isResidentMode ? 'Resident' : sessionRole);
    if (cachedPerms.length > 0) {
      setRolePermissions(cachedPerms);
      setPermissionsReady(true);
    } else if (rolePermissions.length === 0) {
      setPermissionsReady(false);
    }

    // Hydrate local snapshot immediately when switching modes/scopes.
    const localSnapshot = readScopedSnapshot(scopeKey);
    if (localSnapshot?.modules) {
      Object.entries(localSnapshot.modules).forEach(([mod, entry]) => {
        if (entry && Array.isArray(entry.data)) {
          const cacheKey = `${scopeKey}:${mod}`;
          if (!moduleDataCache.current.has(cacheKey)) {
            moduleDataCache.current.set(cacheKey, { at: Number(entry.at || 0), data: entry.data });
          }
        }
      });
    }

    // Canonicalize the real-world sheet headers without changing the source sheets.
    // Handles punctuation, spaces, slash, hyphen and common spelling variants.
    const keyOf = (header: string) => String(header || '').trim()
      .replace(/[.\/()-]/g, ' ')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const normalizeRows = (rows: any[]) => (Array.isArray(rows) ? rows : []).map((row) => {
      const out: Record<string, any> = {};
      Object.keys(row || {}).forEach((key) => {
        let normalized = keyOf(key);
        // The legacy header "Super Buildup Area" maps to Structural_Area,
        // while the distinct header "Super Built-up Area" maps to Super_Built_up_Area.
        // keyOf removes punctuation, so preserve this important distinction before aliasing.
        const rawHeader = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        // Distinguish structural/super-buildup area from super built-up total area.
        if (/^super_built[- ]?up_area$/.test(rawHeader)) normalized = 'Super_Built_up_Area';
        // Preserve the exact TypeScript field names expected by existing screens.
        const aliases: Record<string,string> = {
          Flat_No:'Flat_No', Flat_No_:'Flat_No', Floor_No:'Floor_No',
          Block_Tower:'Block_Tower', Property_Type:'Property_Type',
          Cover_Area:'Carpet_Area', Carpet_Area:'Carpet_Area',
          Coridoor_Area:'Allocated_Common_Area', Corridor_Area:'Allocated_Common_Area',
          Allocated_Common_Area:'Allocated_Common_Area',
          Super_Buildup_Area:'Structural_Area', Super_Builtup_Area:'Structural_Area',
          Structural_Area:'Structural_Area',
          Total_Area:'Super_Built_up_Area', Super_Built_up_Area:'Super_Built_up_Area',
          Occupancy_Status:'Occupancy_Status', Property_Status:'Property_Status',
          Owner_Name:'Owner_Name', Email_ID:'Email_ID', Mobile_No:'Mobile_No',
          Invoice_ID:'InvoiceID', Invoice_No:'Invoice_Number', Property_ID:'PropertyID', Owner_ID:'OwnerID', Rate_ID:'RateID',
          OwnershipID:'Ownership_ID', TransactionID:'Transaction_ID',
          Allocated_Amt:'Allocated_Amount', Allocation_Amount:'Allocated_Amount',
          Net_Charge:'Net_Charge_Amount', Net_Amount:'Net_Charge_Amount'
        };
        normalized = aliases[normalized] || normalized;
        let value = row[key];
        if (normalized === 'Area_Basis' && typeof value === 'string') {
          const basis = value.trim().toLowerCase().replace(/[ _-]+/g, ' ');
          const basisAliases: Record<string,string> = {
            'cover area':'Carpet_Area', 'cover':'Carpet_Area',
            'corridor area':'Allocated_Common_Area', 'corridor':'Allocated_Common_Area',
            'super builtup area':'Structural_Area', 'super built up area':'Structural_Area',
            'structural area':'Structural_Area', 'super built-up area':'Super_Built_up_Area',
            'total area':'Super_Built_up_Area', 'allocated common area':'Allocated_Common_Area',
            'carpet area':'Carpet_Area', 'not applicable':'None', 'none':'None'
          };
          value = basisAliases[basis] || value;
        }
        if (typeof value === 'string' && value.trim() !== '' && /^-?\d+(\.\d+)?$/.test(value.trim())) {
          value = Number(value);
        }
        if (out[normalized] === undefined || out[normalized] === '') {
          out[normalized] = value;
        }
      });
      return out;
    });

    const applyModuleRows = (key: string, normalizedRows: any[]) => {
      if (cancelled) return;
      switch (key) {
        case 'properties':
          setProperties(normalizedRows.map((r: any) => ({
            ...r,
            PropertyID: String(r.PropertyID || ''), Flat_No: String(r.Flat_No || ''), Block_Tower: String(r.Block_Tower || ''),
            Floor_No: Number(r.Floor_No || 0),
            Carpet_Area: r.Carpet_Area === '' || r.Carpet_Area == null ? null : Number(r.Carpet_Area),
            Allocated_Common_Area: r.Allocated_Common_Area === '' || r.Allocated_Common_Area == null ? null : Number(r.Allocated_Common_Area),
            Structural_Area: r.Structural_Area === '' || r.Structural_Area == null ? null : Number(r.Structural_Area),
            Super_Built_up_Area: r.Super_Built_up_Area === '' || r.Super_Built_up_Area == null ? null : Number(r.Super_Built_up_Area),
            Occupancy_Status: r.Occupancy_Status === 'Occupied' ? 'Self Occupied' : (r.Occupancy_Status || 'Vacant'),
            Property_Status: r.Property_Status || 'Active',
          })) as PropertyMaster[]);
          break;
        case 'owners': setOwners(normalizedRows as OwnerMaster[]); break;
        case 'ownershipHistory': setOwnerships(normalizedRows as OwnershipHistory[]); break;
        case 'tenants': setTenants(normalizedRows as TenantMaster[]); break;
        case 'rates': setRates(normalizedRows as RateMaster[]); break;
        case 'invoices': setInvoices(normalizedRows as InvoiceRegister[]); break;
        case 'receipts': setReceipts(normalizedRows as FundInflowRegister[]); break;
        case 'billWiseDetails': setBillAllocations(normalizedRows as BillWiseDetails[]); break;
        case 'expenses': setExpenses(normalizedRows as ExpenseRegister[]); break;
        case 'expenseCategories': setExpenseCategories(normalizedRows as ExpenseCategoryMaster[]); break;
        case 'bankAccounts': setBankAccounts(normalizedRows as BankAccountMaster[]); break;
        case 'activityRequests': setActivityRequests(normalizedRows as ActivityRequestRegister[]); break;
        case 'notices': setNotices(normalizedRows as NoticeMaster[]); break;
        case 'gallery': setGallery(normalizedRows as GalleryMaster[]); break;
        case 'galleryPhotos': setGalleryPhotos(normalizedRows as GalleryPhoto[]); break;
        case 'preventiveMaintenance': setPreventiveMaintenance(normalizedRows as PreventiveMaintenanceMaster[]); break;
        case 'financialYears': setFinancialYears(normalizedRows as FinancialYearMaster[]); break;
        case 'accountHeads': setAccountHeads(normalizedRows as AccountHeadMaster[]); break;
        case 'propertyUtilityDetails': setPropertyUtilities(normalizedRows as PropertyUtilityDetails[]); break;
        case 'auditLogs': setAuditLogs(normalizedRows as AuditLog[]); break;
        case 'rolePermissions': {
          const freshPermissions = normalizedRows as RolePermissionRecord[];
          setRolePermissions(freshPermissions);
          writeCachedPermissions(session.societyCode, isResidentMode ? 'Resident' : sessionRole, freshPermissions);
          setPermissionsReady(true);
          break;
        }
      }
    };

    const modulePlan: Record<string, string[]> = {
      dashboard: activeRole === 'Resident' ? ['properties','owners','ownershipHistory','tenants','invoices','receipts','billWiseDetails','activityRequests','notices','gallery','galleryPhotos','propertyUtilityDetails'] : ['properties','owners','ownershipHistory','tenants','rates','financialYears','invoices','receipts','billWiseDetails','activityRequests','notices','gallery','galleryPhotos','expenses','bankAccounts','preventiveMaintenance'],
      properties_all: ['properties','owners','ownershipHistory','tenants'], properties_owners: ['properties','owners','ownershipHistory','tenants'],
      properties_history: ['ownershipHistory','owners','properties','tenants'], properties_tenants: ['tenants','properties','owners','ownershipHistory'],
      invoices_generate: ['properties','rates','ownershipHistory','owners','invoices','ratePropertyMapping'],
      invoices_register: ['invoices','properties','owners','rates','ratePropertyMapping','ownershipHistory','billWiseDetails','receipts'], invoices_rates: ['rates','ratePropertyMapping','properties'],
      invoices_outstanding: ['invoices','properties','owners','rates','billWiseDetails','receipts'],
      payments_record: ['receipts','invoices','properties','owners','ownershipHistory','bankAccounts','billWiseDetails'],
      payments_receipts: ['receipts','invoices','properties','billWiseDetails'], payments_allocation: ['receipts','invoices','billWiseDetails','properties','owners','ownershipHistory'],
      payments_advances: ['receipts','invoices','billWiseDetails','properties'], resident_flat: ['properties','owners','ownershipHistory','propertyUtilityDetails','tenants'],
      resident_bills: ['properties','owners','ownershipHistory','invoices','receipts','billWiseDetails'], resident_pay: ['invoices','properties','owners','ownershipHistory','receipts','billWiseDetails'], resident_history: ['properties','owners','ownershipHistory','receipts','billWiseDetails','invoices'],
      resident_requests: ['activityRequests','properties','ownershipHistory'], requests_all: ['activityRequests','properties'], requests_pending: ['activityRequests','properties'],
      expenses_add: ['expenses','expenseCategories','bankAccounts'], expenses_register: ['expenses','expenseCategories','bankAccounts'],
      expenses_categories: ['expenseCategories','expenses','bankAccounts'],
      reports_monthly: ['invoices','receipts','expenses','properties','owners','billWiseDetails','bankAccounts','financialYears'],
      reports_fy: ['invoices','receipts','expenses','properties','owners','billWiseDetails','bankAccounts','financialYears','rates'],
      reports_expense_summary: ['expenses','expenseCategories','bankAccounts'],
      reports_property_due: ['invoices','receipts','billWiseDetails','properties','owners','ownershipHistory'],
      reports_owner_due: ['invoices','receipts','billWiseDetails','properties','owners','ownershipHistory'],
      reports_ownership_due: ['invoices','receipts','billWiseDetails','properties','owners','ownershipHistory'],
      reports_balancesheet: ['invoices','receipts','expenses','bankAccounts','accountHeads','financialYears'],
      reports_year_end: ['financialYears','bankAccounts'],
      financial_rv: ['accountHeads','financialYears'], financial_pv: ['accountHeads','financialYears'], financial_jv: ['accountHeads','financialYears'], financial_cv: ['accountHeads','financialYears'],
      resident_notices: ['properties','ownershipHistory','tenants','notices','gallery','galleryPhotos'], resident_reports: ['properties','owners','ownershipHistory','tenants','propertyUtilityDetails','invoices','receipts','billWiseDetails','activityRequests','notices','gallery','galleryPhotos'], settings_maintenance: ['preventiveMaintenance','properties'], settings_audit: ['auditLogs']
    };
    const isForcedRefresh = forceRefreshRef.current;
    forceRefreshRef.current = false;
    const load = async () => {
      try {
        const permModuleMap: Record<string, string> = {
          properties: 'Properties & Residents', owners: 'Owner Management', ownershipHistory: 'Ownership History',
          tenants: 'Tenant Management', rates: 'Maintenance & Invoices', invoices: 'Maintenance & Invoices',
          receipts: 'Payments', billWiseDetails: 'Bill Wise Details', expenses: 'Expenses',
          expenseCategories: 'Expenses', bankAccounts: 'Bank Accounts', activityRequests: 'Activity Requests',
          notices: 'Notices', gallery: 'Gallery', galleryPhotos: 'Gallery', preventiveMaintenance: 'Preventive Maintenance',
          ratePropertyMapping: 'Maintenance & Invoices', propertyUtilityDetails: 'Properties & Residents',
          financialYears: 'Financial Year Management', accountHeads: 'Account Heads', auditLogs: 'Audit Log',
        };
        const residentPermAliases: Record<string, string[]> = {
          properties: ['Properties & Residents', 'My Flat', 'Resident Portal'],
          owners: ['Owner Management', 'My Flat', 'Resident Portal'],
          ownershipHistory: ['Ownership History', 'My Flat', 'Resident Portal'],
          tenants: ['Tenant Management', 'My Flat', 'Resident Portal'],
          propertyUtilityDetails: ['Properties & Residents', 'My Flat', 'Resident Portal'],
          invoices: ['Maintenance & Invoices', 'My Bills', 'Pay Now', 'Resident Portal'],
          receipts: ['Payments', 'Fund Inflow', 'Payment History', 'Pay Now', 'My Bills', 'Resident Portal'],
          billWiseDetails: ['Bill Wise Details', 'Payments', 'My Bills', 'Payment History', 'Pay Now', 'Resident Portal'],
          activityRequests: ['Activity Requests', 'Resident Portal'],
          notices: ['Notices', 'Notices & Gallery', 'Resident Portal'],
          gallery: ['Gallery', 'Notices & Gallery', 'Resident Portal'],
          galleryPhotos: ['Gallery', 'Notices & Gallery', 'Resident Portal'],
        };
        const reportCalculationKeys = new Set([
          'invoices',
          'receipts',
          'billWiseDetails',
          'rates',
          'financialYears',
          'properties',
          'owners',
          'ownershipHistory',
        ]);
        const effectiveRoleForLoad = isResidentMode ? 'Resident' : actualRole;
        const canLoadModule = (key: string, permRows: RolePermissionRecord[] = rolePermissions): boolean => {
          if (key === 'bankAccounts' && !['Admin', 'Accountant'].includes(effectiveRoleForLoad)) return false;
          if (key === 'auditLogs' && !['Admin', 'Accountant'].includes(effectiveRoleForLoad)) return false;
          if (key === 'rolePermissions') return true;
          if (permRows.length === 0) return true;
          if (effectiveRoleForLoad === 'Resident') {
            const candidates = residentPermAliases[key];
            if (candidates) {
              return candidates.some(m => permissionGranted(permRows, 'Resident', m, 'Can_View'));
            }
          }
          const modName = permModuleMap[key];
          if (!modName) return true;
          if (permissionGranted(permRows, effectiveRoleForLoad, modName, 'Can_View')) return true;
          if (key === 'receipts' && permissionGranted(permRows, effectiveRoleForLoad, 'Fund Inflow', 'Can_View')) return true;
          const hasReportOrMaintView =
            permissionGranted(permRows, effectiveRoleForLoad, 'Reports', 'Can_View') ||
            permissionGranted(permRows, effectiveRoleForLoad, 'Maintenance & Invoices', 'Can_View');
          if (hasReportOrMaintView && reportCalculationKeys.has(key)) {
            return true;
          }
          if (key === 'billWiseDetails') {
            return permissionGranted(permRows, effectiveRoleForLoad, 'Payments', 'Can_View')
              || permissionGranted(permRows, effectiveRoleForLoad, 'Fund Inflow', 'Can_View');
          }
          const hasExplicitModuleRow = (moduleLabel: string) =>
            permRows.some(
              (r) =>
                String(r.Role || '').trim().toLowerCase() === effectiveRoleForLoad.toLowerCase() &&
                String(r.Module_Name || '').trim().toLowerCase() === moduleLabel.toLowerCase()
            );
          if (key === 'ownershipHistory' && !hasExplicitModuleRow('Ownership History')) {
            return permissionGranted(permRows, effectiveRoleForLoad, 'Properties & Residents', 'Can_View');
          }
          return false;
        };
        const requested = Array.from(new Set([...(modulePlan[activeTab] || []), 'rolePermissions'])).filter(key => (key !== 'bankAccounts' || ['Admin','Accountant'].includes(activeRole)) && (key !== 'expenses' || activeRole !== 'Resident'));
        const permittedRequested = requested.filter(key => canLoadModule(key));

        const fetchModulePage = async (module: string, page: number) => {
          const response = await fetch(baseUrl, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            cache: 'no-store',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: module === 'rolePermissions' && actualRole !== 'Admin' ? 'getMyPermissions' : 'getModuleData',
              token: session.token,
              module,
              page,
              limit: 200,
              viewAsResident: isResidentMode,
            }),
          });
          if (!response.ok) throw new BackendRequestError(`HTTP ${response.status}`, response.status, response.status >= 500);
          const result = await response.json();
          if (result.status !== 'success') {
            throw new BackendRequestError(
              result.message || `Could not load ${module}`,
              response.status,
              response.status >= 500,
              String(result.code || '')
            );
          }
          return result;
        };

        const loadOne = async (module: string, forceRefresh = false) => {
          const cacheKey = `${scopeKey}:${module}`;
          const cached = moduleDataCache.current.get(cacheKey);
          if (!forceRefresh && cached && Date.now() - cached.at < readCacheTtlMs) return cached.data;
          const pending = inFlightReads.current.get(cacheKey);
          if (pending) return pending;
          const moduleStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const task = (async () => {
            const firstResult = await fetchModulePage(module, 1);
            const all: any[] = Array.isArray(firstResult.data) ? [...firstResult.data] : [];
            const pages = Math.min(100, Math.max(1, Number(firstResult.pagination?.totalPages || 1)));
            if (pages > 1) {
              const restPages = Array.from({ length: pages - 1 }, (_, i) => i + 2);
              const restResults = await Promise.all(restPages.map(p => fetchModulePage(module, p)));
              restResults.forEach((res) => {
                if (Array.isArray(res.data)) all.push(...res.data);
              });
            }
            const normalized = normalizeRows(all);
            const now = Date.now();
            moduleDataCache.current.set(cacheKey, { at: now, data: normalized });
            if (module !== 'rolePermissions') {
              writeScopedSnapshotModules(scopeKey, { [module]: normalized }, now);
            }
            console.info('ABAS SATHI module timing', { module, elapsedMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - moduleStartedAt), rows: normalized.length, pages, role: activeRole });
            return normalized;
          })();
          inFlightReads.current.set(cacheKey, task);
          try { return await task; } finally { inFlightReads.current.delete(cacheKey); }
        };

        // Instantly hydrate any cached/stale module arrays into React state (<1ms UI response) before background network fetches.
        permittedRequested.forEach((mod) => {
          const cached = moduleDataCache.current.get(`${scopeKey}:${mod}`);
          if (cached && Array.isArray(cached.data)) {
            applyModuleRows(mod, cached.data);
          }
        });

        const loadPermissionsFast = (): Promise<RolePermissionRecord[]> => {
          const permCacheKey = `${scopeKey}:rolePermissions`;
          const permCached = moduleDataCache.current.get(permCacheKey);
          if (permCached && Date.now() - permCached.at < readCacheTtlMs) {
            applyModuleRows('rolePermissions', permCached.data);
            return Promise.resolve(permCached.data as RolePermissionRecord[]);
          }
          return loadOne('rolePermissions')
            .then(rows => {
              applyModuleRows('rolePermissions', rows);
              return rows as RolePermissionRecord[];
            })
            .catch(err => {
              console.error('ABAS SATHI module load error', { module: 'Role Permissions', role: activeRole, error: String(err || 'Unknown error') });
              if (err instanceof BackendRequestError && err.code === 'AUTH_ERROR') {
                clearAllUserDataCaches();
                localStorage.removeItem('abasSathiSession');
                window.location.reload();
                return rolePermissions;
              }
              if (!cancelled) setPermissionsReady(true);
              return rolePermissions;
            });
        };

        if (activeTab === 'dashboard') {
          // Check if dashboard modules are already warm (<30s); otherwise fetch getRoleDashboardData once and populate all module caches.
          const dashCoreCandidates = activeRole === 'Resident'
            ? ['properties','invoices','receipts','billWiseDetails','activityRequests','notices','gallery','galleryPhotos']
            : ['properties','owners','ownershipHistory','tenants','rates','financialYears','invoices','receipts','billWiseDetails','expenses','activityRequests','notices','gallery','galleryPhotos','preventiveMaintenance'];
          const dashCoreModules = rolePermissions.length > 0
            ? dashCoreCandidates.filter((mod) => permittedRequested.includes(mod))
            : dashCoreCandidates;
          const allDashWarm = !isForcedRefresh && dashCoreModules.every((mod) => {
            const c = moduleDataCache.current.get(`${scopeKey}:${mod}`);
            return c && Date.now() - c.at < readCacheTtlMs;
          });

          const permsPromise = loadPermissionsFast();
          let dashLoadedOk = allDashWarm;

          const dashDataPromise = allDashWarm
            ? Promise.resolve()
            : apiCall<any>('getRoleDashboardData', { viewAsResident: isResidentMode, ...(isForcedRefresh ? { refresh: true } : {}) })
                .then((result) => {
                  const entries = Object.entries(result.data || {});
                  const now = Date.now();
                  const snapshotUpdates: Record<string, any[]> = {};
                  entries.forEach(([key, value]) => {
                    const normalized = normalizeRows(value as any[]);
                    moduleDataCache.current.set(`${scopeKey}:${key}`, { at: now, data: normalized });
                    snapshotUpdates[key] = normalized;
                    applyModuleRows(key, normalized);
                  });
                  writeScopedSnapshotModules(scopeKey, snapshotUpdates, now);
                  dashLoadedOk = true;
                })
                .catch((err) => {
                  dashLoadedOk = false;
                  console.error('ABAS SATHI module load error', { module: 'Role Dashboard Data', role: activeRole, error: String(err || 'Unknown error') });
                  if (err instanceof BackendRequestError && err.code === 'AUTH_ERROR') {
                    clearAllUserDataCaches();
                    localStorage.removeItem('abasSathiSession');
                    window.location.reload();
                  }
                });

          // Keep dashboard summary cache populated non-blockingly without competing with primary dashboard data.
          const summaryCacheKey = `abasSathiDashboardSummary:${session.societyCode}:${session.user?.userId}`;
          let hasFreshSummary = false;
          try {
            const cachedSummary = JSON.parse(sessionStorage.getItem(summaryCacheKey) || 'null');
            if (cachedSummary && Date.now() - Number(cachedSummary.at || 0) < 60000) {
              hasFreshSummary = true;
              if (cachedSummary.society && !cancelled) {
                const nextSoc: SocietySettings = {
                  societyCode: String(cachedSummary.society.societyCode || session.societyCode || '').trim(),
                  societyName: String(cachedSummary.society.societyName || session.societyName || '').trim(),
                  societyAddress: String(cachedSummary.society.societyAddress || session.societyAddress || '').trim(),
                  societyRegistrationNo: String(cachedSummary.society.societyRegistrationNo || session.societyRegistrationNo || '').trim(),
                };
                setSocietySettings(nextSoc);
              }
            }
          } catch {}
          const summaryPromise = hasFreshSummary
            ? Promise.resolve()
            : dashDataPromise.then(() =>
                apiCall<any>('getDashboardSummary', { viewAsResident: isResidentMode })
                  .then((result) => {
                    try { sessionStorage.setItem(summaryCacheKey, JSON.stringify({ at: Date.now(), summary: result.summary || {}, society: result.society || {} })); } catch {}
                    if (result.society && !cancelled) {
                      const nextSoc: SocietySettings = {
                        societyCode: String(result.society.societyCode || session.societyCode || '').trim(),
                        societyName: String(result.society.societyName || session.societyName || '').trim(),
                        societyAddress: String(result.society.societyAddress || session.societyAddress || '').trim(),
                        societyRegistrationNo: String(result.society.societyRegistrationNo || session.societyRegistrationNo || '').trim(),
                      };
                      setSocietySettings(nextSoc);
                      syncSocietyToSession(nextSoc);
                    }
                    console.info('ABAS SATHI dashboard summary timing', { role: activeRole, status: result.status || 'unknown' });
                  })
                  .catch((err) => {
                    console.error('ABAS SATHI module load error', { module: 'Dashboard Summary', role: activeRole, error: String(err || 'Unknown error') });
                  })
              );

          const [permsSettled] = await Promise.allSettled([permsPromise, dashDataPromise]);

          // Silently pre-warm commonly visited secondary master modules and any permitted calculation modules missing from backend cache.
          if (!cancelled) {
            const effectivePerms =
              permsSettled.status === 'fulfilled' && Array.isArray(permsSettled.value)
                ? permsSettled.value
                : rolePermissions;
            const prefetchCandidates = activeRole === 'Resident'
              ? ['propertyUtilityDetails', 'galleryPhotos']
              : ['owners', 'ownershipHistory', 'rates', 'expenseCategories', 'financialYears', 'galleryPhotos'];
            const calcModulesToVerify =
              dashLoadedOk && activeRole !== 'Resident'
                ? Array.from(reportCalculationKeys).filter((mod) => canLoadModule(mod, effectivePerms))
                : [];
            const prefetchPool = Array.from(new Set([...prefetchCandidates, ...calcModulesToVerify]));
            const missingPrefetch = prefetchPool.filter((mod) => {
              if (mod === 'expenseCategories') {
                if (effectivePerms.length > 0 && !permissionGranted(effectivePerms, effectiveRoleForLoad, 'Expenses', 'Can_View')) {
                  return false;
                }
              } else if (!canLoadModule(mod, effectivePerms)) {
                return false;
              }
              const c = moduleDataCache.current.get(`${scopeKey}:${mod}`);
              return !c || Date.now() - c.at >= readCacheTtlMs;
            });
            if (missingPrefetch.length > 0) {
              void Promise.allSettled(
                missingPrefetch.map((mod) =>
                  loadOne(mod)
                    .then((rows) => applyModuleRows(mod, rows))
                    .catch(() => undefined)
                )
              );
            }
          }
          void summaryPromise;
        } else {
          // Progressive per-module loading: each screen updates as soon as each module resolves.
          const tasks = permittedRequested.map((mod) => {
            if (mod === 'rolePermissions') return loadPermissionsFast();
            return loadOne(mod, isForcedRefresh)
              .then((rows) => applyModuleRows(mod, rows))
              .catch((err) => {
                console.error('ABAS SATHI module load error', { module: mod, role: activeRole, error: String(err || 'Unknown error') });
              });
          });
          await Promise.allSettled(tasks);
        }

        if (cancelled) return;
        setPermissionsReady(true);
        console.info('ABAS SATHI screen load timing', { tab: activeTab, role: activeRole, modules: permittedRequested.length });
      } catch (error:any) {
        setPermissionsReady(true);
        console.error('ABAS SATHI selective database load failed:', error);
        if (String(error?.message || '').toLowerCase().includes('session')) {
          clearAllUserDataCaches();
          localStorage.removeItem('abasSathiSession'); window.location.reload();
        }
      } finally {
        if (!cancelled) setIsRefreshingData(false);
        const pendingResolvers = refreshResolversRef.current.splice(0);
        pendingResolvers.forEach((resolve) => resolve());
      }
    };
    load();
    return () => { cancelled = true; };
  }, [googleConfig.appsScriptWebAppUrl, activeTab, activeRole, isResidentMode, refreshNonce]);

  const refreshActiveData = async () => {
    let session: any = {};
    try { session = JSON.parse(localStorage.getItem('abasSathiSession') || '{}'); } catch {}
    if (!session.token) return;
    const sessionRole = normalizeAuthRole(session.user?.role) || session.user?.role;
    const scopeKey = buildScopeKey(session.societyCode, session.user?.userId, sessionRole, isResidentMode);
    for (const key of Array.from(moduleDataCache.current.keys())) {
      if (key.startsWith(`${scopeKey}:`)) moduleDataCache.current.delete(key);
    }
    invalidateScopedSnapshotModules(scopeKey);
    clearFundBalanceCache(session.societyCode, session.user?.userId);
    forceRefreshRef.current = true;
    setIsRefreshingData(true);
    await new Promise<void>((resolve) => {
      refreshResolversRef.current.push(resolve);
      setRefreshNonce((n) => n + 1);
    });
  };

  // Helper to add audit log
  const logAction = (action: AuditLog['Action_Type'], module: string, recordId: string, oldVal: string, newVal: string, remarks: string) => {
    const newLog: AuditLog = {
      Log_ID: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      UserID: currentUser.UserID,
      User_Name: currentUser.Full_Name,
      Action_Type: action,
      Module_Name: module,
      Record_ID: recordId,
      Old_Value: oldVal,
      New_Value: newVal,
      Action_DateTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      Remarks: remarks,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Find resident's property
  const residentProperty = currentUser.PropertyID
    ? properties.find((p) => String(p.PropertyID || '').trim().toUpperCase() === String(currentUser.PropertyID || '').trim().toUpperCase()) || null
    : (activeRole === 'Resident' ? null : (properties[0] || null));

  const switchUser = (userId: string) => {
    // Role simulation is disabled in the authenticated production context.
    // Only the authenticated user may be selected; this prevents client-side role spoofing.
    if (String(userId) !== String(currentUser.UserID)) return;
    setActiveRole(actualRole);
    setActiveTab('dashboard');
  };

  // Keep currentUser.Ownership_ID synchronized from Ownership History if PropertyID is linked.
  useEffect(() => {
    if (!currentUser.PropertyID || currentUser.Ownership_ID || ownerships.length === 0) return;
    const match = ownerships.find(
      (o) =>
        String(o.PropertyID || '').trim().toUpperCase() === String(currentUser.PropertyID || '').trim().toUpperCase() &&
        String(o.Ownership_Status || '').trim().toLowerCase() === 'current'
    );
    if (match?.Ownership_ID) {
      setCurrentUser((prev) => (prev.Ownership_ID ? prev : { ...prev, Ownership_ID: String(match.Ownership_ID) }));
    }
  }, [currentUser.PropertyID, currentUser.Ownership_ID, ownerships]);

  const handleRoleChange = (role: UserRole) => {
    // UI display mode only. This never changes the authenticated user's actual role.
    if (role === 'Resident' && ['Committee','Accountant'].includes(actualRole)) {
      if (!currentUser.PropertyID || !currentUser.Ownership_ID) return;
      setIsResidentMode(true);
      setActiveRole('Resident');
      setActiveTab('dashboard');
    } else if (role === actualRole) {
      setIsResidentMode(false);
      setActiveRole(actualRole);
      setActiveTab('dashboard');
    }
  };
  const toggleResidentMode = () => {
    if (!['Committee','Accountant'].includes(actualRole)) return false;
    const matchedOwnershipId =
      currentUser.Ownership_ID ||
      ownerships.find(
        (o) =>
          String(o.PropertyID || '').trim() === String(currentUser.PropertyID || '').trim() &&
          String(o.Ownership_Status || '').trim().toLowerCase() === 'current'
      )?.Ownership_ID ||
      null;
    if (matchedOwnershipId && !currentUser.Ownership_ID) {
      setCurrentUser((prev) => ({ ...prev, Ownership_ID: String(matchedOwnershipId) }));
    }
    if (!currentUser.PropertyID || (!currentUser.Ownership_ID && !matchedOwnershipId)) return false;
    setIsResidentMode(prev => {
      const next = !prev;
      setActiveRole(next ? 'Resident' : actualRole);
      return next;
    });
    setActiveTab('dashboard');
    return true;
  };
  const hasPermission = (moduleName: string, action: PermissionAction = 'Can_View') => {
    const effectiveRole = isResidentMode ? 'Resident' : actualRole;
    return permissionGranted(rolePermissions, effectiveRole, moduleName, action);
  };
  const canAccessTab = (tab: string) => {
    if (tab === 'profile') return true;
    if (tab === 'settings_role_permissions') return actualRole === 'Admin';
    if (tab === 'settings_master') return activeRole !== 'Resident' && actualRole !== 'Resident' && ['Account Heads','Financial Year Management','Bank Accounts','Properties & Residents','Owner Management','Expenses'].some(m=>hasPermission(m,'Can_View'));
    const effectiveRole = isResidentMode ? 'Resident' : actualRole;
    if (effectiveRole === 'Resident') {
      const residentAliases: Record<string, string[]> = {
        dashboard: ['Dashboard', 'Resident Portal'],
        resident_flat: ['My Flat', 'Properties & Residents'],
        resident_bills: ['My Bills', 'Maintenance & Invoices'],
        resident_pay: ['Pay Now', 'Payments'],
        resident_history: ['Payment History', 'Payments', 'Fund Inflow'],
        resident_requests: ['Activity Requests'],
        resident_notices: ['Notices & Gallery', 'Notices', 'Gallery'],
        resident_reports: ['Resident Portal', 'Reports', 'My Bills'],
      };
      const candidates = residentAliases[tab];
      if (candidates) {
        const reqAction = actionForTab(tab);
        return candidates.some((m) => hasPermission(m, 'Can_View') && hasPermission(m, reqAction));
      }
    }
    const moduleName = moduleForTab(tab);
    return moduleName ? hasPermission(moduleName, 'Can_View') && hasPermission(moduleName, actionForTab(tab)) : false;
  };
  const refreshRolePermissions = async () => {
    const saved:any = (()=>{try{return JSON.parse(localStorage.getItem('abasSathiSession')||'{}')}catch{return {}}})();
    if(!saved.token)return;
    const res:any=await apiCall(actualRole==='Admin'?'getModuleData':'getMyPermissions',{module:'rolePermissions',viewAsResident:isResidentMode,page:1,limit:200});
    const rows = Array.isArray(res.data)?res.data:[];
    setRolePermissions(rows);
    writeCachedPermissions(saved.societyCode, isResidentMode ? 'Resident' : saved.user?.role, rows);
    const scopeKey = buildScopeKey(saved.societyCode, saved.user?.userId, saved.user?.role, isResidentMode);
    moduleDataCache.current.set(`${scopeKey}:rolePermissions`, { at: Date.now(), data: rows });
  };
  const deleteRolePermission = async (permissionId:string) => {
    await apiCall('deleteRolePermission',{permissionId});
    await refreshRolePermissions();
  };

  const uploadPrivateFile = async (file: File, category: string, propertyId?: string, ownerId?: string, relatedModule?: string, relatedRecordId?: string): Promise<{fileId:string;fileName:string;mimeType:string}> => {
    if (file.size > 5 * 1024 * 1024) throw new Error('File size must not exceed 5 MB.');
    if (!['application/pdf','image/jpeg','image/png'].includes(file.type)) throw new Error('Only PDF, JPG and PNG files are accepted.');
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    const base64 = btoa(binary);
    const result: any = await apiCall('uploadPrivateFile', { fileName:file.name, mimeType:file.type, base64, category, propertyId:propertyId || '', ownerId:ownerId || '', relatedModule:relatedModule||'', relatedRecordId:relatedRecordId||'' });
    if (!result.data?.fileId) throw new Error('Drive upload did not return a file reference.');
    return result.data;
  };

  const createModuleRecord = (module: string, record: Record<string, unknown>) =>
    apiCall('createRecord', { module, record });
  const updateModuleRecord = (module: string, recordId: string, record: Record<string, unknown>) =>
    apiCall('updateRecord', { module, recordId, record });
  const cancelModuleRecord = (module: string, recordId: string, reason: string) =>
    apiCall('cancelRecord', { module, recordId, reason });
  const getPrivateFile = (fileId: string, propertyId?: string) =>
    apiCall('getPrivateFile', { fileId, propertyId: propertyId || '' });
  const createSocietyBackup = () => apiCall('createSocietyBackup');
  const configureAutomatedBackup = (enabled: boolean) => apiCall('configureAutomatedBackup', { enabled });
  const restoreSocietyBackup = (backupFileId: string) => apiCall('restoreSocietyBackup', { backupFileId });
  const listSocietyBackups = async () => { const result:any=await apiCall('listSocietyBackups'); return Array.isArray(result.data)?result.data:[]; };
  const listRecoveryOperations = async () => { const result:any=await apiCall('listRecoveryOperations'); return Array.isArray(result.data)?result.data:[]; };
  const listPrivateFiles = async (category?: string) => {
    const result: any = await apiCall('listPrivateFiles', { category: category || '', limit: 200 });
    return Array.isArray(result.data) ? result.data : [];
  };
  const getReport = (reportType: string, filters: Record<string, unknown> = {}) =>
    apiCall('getReports', { reportType, ...filters });
  const createReportSnapshot = (asOfDate: string, remarks = '') =>
    apiCall('createReportSnapshot', { reportType: 'Balance Sheet', asOfDate, remarks });
  const approveReportSnapshot = (snapshotId: string) =>
    apiCall('approveReportSnapshot', { snapshotId });
  const listReportSnapshots = async () => { const result:any=await apiCall('listReportSnapshots'); return Array.isArray(result.data)?result.data:[]; };
  const postOpeningBalances = (entries: Array<{accountCode?:string;accountName:string;accountType:string;debit:number;credit:number}>, effectiveDate: string) =>
    apiCall('postOpeningBalances', { entries, effectiveDate });
  const getFundBalanceSummary = () => apiCall('getFundBalanceSummary');
  const getYearEndClosingPreview = (fyId: string, initialCashOpening = 0) => apiCall('getYearEndClosingPreview', { fyId, initialCashOpening });
  const finalizeYearEndClosing = (fyId: string, rows: any[], remarks = '', initialCashOpening = 0) => apiCall('finalizeYearEndClosing', { fyId, rows, remarks, initialCashOpening });

  const cancelInvoice = async (invoiceId: string, reason: string): Promise<void> => {
    await apiCall('cancelInvoice', { invoiceId, reason });
    setInvoices(prev=>prev.map(x=>x.InvoiceID===invoiceId?{...x,Invoice_Status:'Cancelled',Cancellation_Reason:reason}:x));
  };

  // Generate invoice on the server; UI state changes only after server confirmation.
  const generateInvoice = async (params: {
    propertyId: string; rateId: string; billPeriodFrom: string; billPeriodTo: string; dueDate: string;
    lateFee?: number; discount?: number; adjustment?: number; remarks?: string;
  }): Promise<InvoiceRegister> => {
    const result: any = await apiCall('generateInvoice', { ...params });
    const invoice = result.data?.invoice as InvoiceRegister | undefined;
    if (!invoice) throw new Error('The server did not return the generated invoice. Refresh the invoice register before retrying.');
    setInvoices(prev => [invoice, ...prev.filter(x => x.InvoiceID !== invoice.InvoiceID)]);
    return invoice;
  };

  // Submit resident payment to the server. No local receipt is created before confirmation.
  const submitResidentPayment = async (params: {
    invoiceIds: string[]; amount: number; mode: PaymentMode; reference: string; bankAccount: string;
    remarks?: string; proofFileName?: string; propertyId?: string;
  }): Promise<FundInflowRegister> => {
    const prop =
      (params.propertyId
        ? properties.find(p => String(p.PropertyID || '').trim().toUpperCase() === String(params.propertyId).trim().toUpperCase())
        : null) ||
      residentProperty ||
      properties[0];
    if (!prop) throw new Error('No property is linked to this account.');
    const ownership =
      (activeRole === 'Resident' && currentUser.Ownership_ID
        ? ownerships.find(
            o =>
              String(o.PropertyID || '').trim().toUpperCase() === String(prop.PropertyID || '').trim().toUpperCase() &&
              String(o.Ownership_ID || '').trim().toUpperCase() === String(currentUser.Ownership_ID || '').trim().toUpperCase()
          )
        : undefined) ||
      ownerships.find(
        o =>
          String(o.PropertyID || '').trim().toUpperCase() === String(prop.PropertyID || '').trim().toUpperCase() &&
          String(o.Ownership_Status || '').trim().toLowerCase() === 'current'
      ) ||
      ownerships.find(o => String(o.PropertyID || '').trim().toUpperCase() === String(prop.PropertyID || '').trim().toUpperCase());
    if (!ownership) throw new Error('Current ownership record is not available.');
    const result: any = await apiCall('submitPayment', {
      propertyId: prop.PropertyID, ownershipId: ownership.Ownership_ID,
      ownerId: ownership.OwnerID, amount: params.amount, mode: params.mode, reference: params.reference,
      bankAccount: params.bankAccount, remarks: params.remarks || (params.invoiceIds.length ? `Submitted against invoices: ${params.invoiceIds.join(', ')}` : 'Society payment recorded'),
      fileReference: params.proofFileName || '', invoiceIds: params.invoiceIds,
    });
    const receipt = result.data?.receipt as FundInflowRegister | undefined;
    if (!receipt) throw new Error('The server did not return the payment receipt. Check the payment register before retrying.');
    setReceipts(prev => [receipt, ...prev.filter(x => x.Transaction_ID !== receipt.Transaction_ID)]);
    return receipt;
  };

  // Payment confirmation and bill allocation are committed by the backend.
  const confirmAndAllocatePayment = async (
    receiptId: string, customAllocations?: { invoiceId: string; amount: number }[]
  ): Promise<FundInflowRegister> => {
    const receipt = receipts.find(r => r.Transaction_ID === receiptId || r.Receipt_Number === receiptId);
    if (!receipt) throw new Error('Payment record not found. Refresh the payment register.');
    let allocations = customAllocations || [];
    if (!customAllocations) {
      let remaining = Math.max(0, toInvoiceAmount(receipt.Received_Amount));
      const recProp = String(receipt.PropertyID || '').trim().toUpperCase();
      const recOwn = String(receipt.Ownership_ID || '').trim().toUpperCase();
      allocations = computeInvoiceOutstandingBills(invoices, billAllocations, receipts)
        .filter(i => {
          const propMatch = String(i.PropertyID || '').trim().toUpperCase() === recProp;
          const ownMatch = !recOwn || !i.Ownership_ID || String(i.Ownership_ID || '').trim().toUpperCase() === recOwn;
          return propMatch && ownMatch && i.Calculated_Outstanding > 0;
        })
        .sort((a,b) => String(a.Due_Date).localeCompare(String(b.Due_Date)))
        .map(i => { const amount = Math.min(remaining, i.Calculated_Outstanding); remaining = roundMoney(remaining - amount); return { invoiceId: i.InvoiceID, amount }; })
        .filter(x => x.amount > 0);
    }
    const result: any = await apiCall('confirmPayment', { transactionId: receipt.Transaction_ID, allocations });
    const allocated = toInvoiceAmount(result.data?.allocated || 0), unallocated = toInvoiceAmount(result.data?.unallocated || 0);
    const allocMap = new Map(allocations.map(x => [x.invoiceId, x.amount]));
    const confirmedReceipt: FundInflowRegister = { ...receipt, Receipt_Status: 'Confirmed', Unallocated_Amount: unallocated, Receipt_Number: result.data?.receiptNo || '', Bank_Account: result.data?.bankAccount || receipt.Bank_Account };
    setReceipts(prev => prev.map(r => r.Transaction_ID === receipt.Transaction_ID ? confirmedReceipt : r));
    setInvoices(prev => prev.map(inv => {
      const amount = toInvoiceAmount(allocMap.get(inv.InvoiceID) || 0); if (!amount) return inv;
      const net = Math.max(0, toInvoiceAmount(inv.Net_Charge_Amount));
      const nextPaid = Math.min(net, roundMoney(Math.max(0, toInvoiceAmount(inv.Paid_Amount)) + amount));
      const outstanding = Math.max(0, roundMoney(net - nextPaid));
      return { ...inv, Paid_Amount: nextPaid, Outstanding_Amount: outstanding, Invoice_Status: outstanding <= 0 ? 'Paid' : 'Partially Paid' };
    }));
    setBillAllocations(prev => [...(result.data?.allocationRows || []), ...prev]);
    setBankAccounts(prev => prev.map(b => b.BankAccount_ID === receipt.Bank_Account ? { ...b, Current_Balance: roundMoney(toInvoiceAmount(b.Current_Balance) + toInvoiceAmount(receipt.Received_Amount)) } : b));
    void allocated;
    return confirmedReceipt;
  };

  // Create expense in the server ledger. Expenses always begin Pending Approval.
  const addExpense = async (params: Omit<ExpenseRegister,
    'Expense_ID' | 'Voucher_No' | 'Created_At' | 'Created_By' | 'Approved_At' | 'Approved_By' | 'Cancelled_At' | 'Cancelled_By' | 'Cancellation_Reason'
  >): Promise<ExpenseRegister> => {
    const result: any = await apiCall('createExpense', { record: params });
    const server = result.data?.expense || {};
    const created: ExpenseRegister = {
      ...params, ...server, Expense_ID: result.data?.expenseId || server.Expense_ID,
      Voucher_No: result.data?.voucherNo || server.Voucher_No, Expense_Status: 'Pending Approval',
      Created_By: currentUser.Full_Name, Created_At: new Date().toISOString(), Approved_By: '', Approved_At: '',
      Cancelled_By: null, Cancelled_At: null, Cancellation_Reason: null,
    };
    setExpenses(prev => [created, ...prev]);
    return created;
  };

  // Existing UI action is labelled "Approve & Pay"; backend performs the guarded
  // approval/payment transition and bank balance update under one lock.
  const approveExpense = async (expenseId: string): Promise<void> => {
    await apiCall('approveExpense', { expenseId });
    const now = new Date().toISOString();
    setExpenses(prev => prev.map(e => e.Expense_ID === expenseId ? { ...e, Expense_Status: 'Approved', Approved_By: currentUser.Full_Name, Approved_At: now } : e));
  };

  const markExpensePaid = async (expenseId: string): Promise<void> => {
    const expense = expenses.find(e => e.Expense_ID === expenseId);
    if (!expense) throw new Error('Expense record not found.');
    if (String(expense.Expense_Status || '').trim().toLowerCase() !== 'approved') throw new Error('Expense must be approved before payment.');
    await apiCall('markExpensePaid', { expenseId });
    const now = new Date().toISOString();
    setExpenses(prev => prev.map(e => e.Expense_ID === expenseId ? { ...e, Expense_Status: 'Paid', Payment_Date: now.slice(0,10) } : e));
    setBankAccounts(prev => prev.map(b => b.BankAccount_ID === expense.Bank_Account ? { ...b, Current_Balance: roundMoney(toInvoiceAmount(b.Current_Balance) - toInvoiceAmount(expense.Payment_Amount)) } : b));
  };

  // Activity Requests — server-persisted.
  const createActivityRequest = async (params: {
    category: ActivityRequestRegister['Request_Category']; subject: string; description: string;
    priority: ActivityRequestRegister['Priority']; attachment?: string;
  }): Promise<ActivityRequestRegister> => {
    const prop = residentProperty || properties[0];
    if (!prop) throw new Error('No property is linked to this account.');
    const own =
      (currentUser.Ownership_ID
        ? ownerships.find(
            o =>
              String(o.PropertyID || '').trim().toUpperCase() === String(prop.PropertyID || '').trim().toUpperCase() &&
              String(o.Ownership_ID || '').trim().toUpperCase() === String(currentUser.Ownership_ID || '').trim().toUpperCase()
          )
        : undefined) ||
      ownerships.find(
        o =>
          String(o.PropertyID || '').trim().toUpperCase() === String(prop.PropertyID || '').trim().toUpperCase() &&
          String(o.Ownership_Status || '').trim().toLowerCase() === 'current'
      ) ||
      ownerships.find(
        o => String(o.PropertyID || '').trim().toUpperCase() === String(prop.PropertyID || '').trim().toUpperCase()
      );
    const ownershipIdToUse = own?.Ownership_ID || currentUser.Ownership_ID || '';
    if (!ownershipIdToUse) throw new Error('Current ownership record not found.');
    const record = { PropertyID: prop.PropertyID, Ownership_ID: ownershipIdToUse,
      Requested_By: currentUser.UserID, Request_Date: new Date().toISOString().slice(0,10),
      Request_Category: params.category, Subject: params.subject, Description: params.description,
      Priority: params.priority, Attachment: params.attachment || '', Assigned_To: 'Pending Assignment',
      Request_Status: 'Pending', Admin_Remarks: '' };
    const result: any = await apiCall('createRecord', { module: 'activityRequests', record });
    const created: ActivityRequestRegister = { ...record, Request_ID: result.data?.recordId || `REQ-${Date.now()}`, 
      Request_Number: result.data?.data?.Request_Number || `REQ-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}` } as ActivityRequestRegister;
    setActivityRequests(prev => [created, ...prev]);
    return created;
  };

  const updateActivityRequest = async (requestId: string,
    updates: Partial<Pick<ActivityRequestRegister, 'Request_Status' | 'Assigned_To' | 'Admin_Remarks' | 'Completion_Date' | 'Completion_Proof'>>
  ): Promise<void> => {
    await apiCall('updateRecord', { module: 'activityRequests', recordId: requestId, record: updates });
    setActivityRequests(prev => prev.map(req => req.Request_ID === requestId ? { ...req, ...updates, Updated_At: new Date().toISOString() } : req));
  };

  const createNotice = async (notice: Omit<NoticeMaster, 'Notice_ID' | 'Notice_Number' | 'Created_At' | 'Created_By'>): Promise<void> => {
    const result: any = await apiCall('createRecord', { module: 'notices', record: notice });
    const created = { ...notice, Notice_ID: result.data?.recordId || `NOT-${Date.now()}`,
      Notice_Number: result.data?.data?.Notice_Number || `NOT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      Created_By: currentUser.Full_Name, Created_At: new Date().toISOString() } as NoticeMaster;
    setNotices(prev => [created, ...prev]);
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentUser,
        setCurrentUser,
        activeRole,
        actualRole,
        isResidentMode,
        toggleResidentMode,
        hasPermission,
        canAccessTab,
        rolePermissions,
        permissionsReady,
        refreshRolePermissions,
        deleteRolePermission,
        setActiveRole: handleRoleChange,
        switchUser,
        residentProperty,
        activeTab,
        setActiveTab,
        properties,
        owners,
        ownerships,
        tenants,
        rates,
        invoices,
        receipts,
        billAllocations,
        expenses,
        expenseCategories,
        bankAccounts,
        activityRequests,
        notices,
        gallery,
        galleryPhotos,
        preventiveMaintenance,
        auditLogs,
        financialYears,
        accountHeads,
        propertyUtilities,
        users,
        isRefreshingData,
        refreshActiveData,
        previewInvoice,
        setPreviewInvoice,
        previewReceipt,
        setPreviewReceipt,
        previewVoucher,
        setPreviewVoucher,
        generateInvoice,
        cancelInvoice,
        submitResidentPayment,
        confirmAndAllocatePayment,
        addExpense,
        approveExpense,
        markExpensePaid,
        createActivityRequest,
        updateActivityRequest,
        createNotice,
        googleConfig,
        updateGoogleConfig,
        societySettings,
        updateSocietySettings,
        uploadPrivateFile,
        createModuleRecord,
        updateModuleRecord,
        cancelModuleRecord,
        getPrivateFile,
        createSocietyBackup,
        configureAutomatedBackup,
        restoreSocietyBackup,
        listSocietyBackups,
        listRecoveryOperations,
        listPrivateFiles,
        getReport,
        createReportSnapshot,
        approveReportSnapshot,
        listReportSnapshots,
        postOpeningBalances,
        getFundBalanceSummary,
        getYearEndClosingPreview,
        finalizeYearEndClosing,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
