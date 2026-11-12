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
  PreventiveMaintenanceMaster,
  AuditLog,
  FinancialYearMaster,
  AccountHeadMaster,
  PaymentMode,
} from '../types/database';

import { Language, translations } from '../utils/i18n';
import { authRequest, BackendRequestError } from '../utils/authClient';

export interface GoogleBackendConfig {
  spreadsheetId: string;
  driveFolderId: string;
  appsScriptWebAppUrl: string;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['en'];

  // Current session & role
  currentUser: UserMaster;
  setCurrentUser: (user: UserMaster) => void;
  activeRole: UserRole;
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
  preventiveMaintenance: PreventiveMaintenanceMaster[];
  auditLogs: AuditLog[];
  financialYears: FinancialYearMaster[];
  accountHeads: AccountHeadMaster[];
  users: UserMaster[];

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

  // Backend settings
  googleConfig: GoogleBackendConfig;
  updateGoogleConfig: (config: Partial<GoogleBackendConfig>) => void;
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
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [users, setUsers] = useState<UserMaster[]>([]);
  const [currentUser, setCurrentUser] = useState<UserMaster>(() => { try { const s = JSON.parse(localStorage.getItem('abasSathiSession') || '{}'); const u = s.user || {}; return { UserID:u.userId || '', Full_Name:u.fullName || '', Email_ID:u.email || '', Mobile_No:u.mobile || '', Role:u.role || 'Resident', PropertyID:u.propertyId || null, Ownership_ID:null, Account_Status:'Active', Last_Login:new Date().toISOString(), Created_By:'', Created_At:'' }; } catch { return { UserID:'', Full_Name:'', Email_ID:'', Mobile_No:'', Role:'Resident', PropertyID:null, Ownership_ID:null, Account_Status:'Active', Last_Login:'', Created_By:'', Created_At:'' }; } }); // Starts as Admin
  const [activeRole, setActiveRole] = useState<UserRole>(() => { try { return JSON.parse(localStorage.getItem('abasSathiSession') || '{}').user?.role || 'Resident'; } catch { return 'Resident'; } });
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Database collections
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [owners, setOwners] = useState<OwnerMaster[]>([]);
  const [ownerships, setOwnerships] = useState<OwnershipHistory[]>([]);
  const [tenants, setTenants] = useState<TenantMaster[]>([]);
  const [rates, setRates] = useState<RateMaster[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRegister[]>([]);
  const [receipts, setReceipts] = useState<FundInflowRegister[]>([]);
  const [billAllocations, setBillAllocations] = useState<BillWiseDetails[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRegister[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryMaster[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountMaster[]>([]);
  const [activityRequests, setActivityRequests] = useState<ActivityRequestRegister[]>([]);
  const [notices, setNotices] = useState<NoticeMaster[]>([]);
  const [gallery, setGallery] = useState<GalleryMaster[]>([]);
  const [preventiveMaintenance, setPreventiveMaintenance] = useState<PreventiveMaintenanceMaster[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYearMaster[]>([]);
  const [accountHeads, setAccountHeads] = useState<AccountHeadMaster[]>([]);

  // Document preview modals
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceRegister | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<FundInflowRegister | null>(null);
  const [previewVoucher, setPreviewVoucher] = useState<ExpenseRegister | null>(null);

  // Google backend configuration. Saved locally in this browser.
  const [googleConfig, setGoogleConfig] = useState<GoogleBackendConfig>(() => {
    const defaults: GoogleBackendConfig = {
      spreadsheetId: '',
      driveFolderId: '',
      //appsScriptWebAppUrl: 'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQqQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec',
      appsScriptWebAppUrl: 'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQqQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec',
    };
    try {
      if (typeof window === 'undefined') return defaults;
      const saved = window.localStorage.getItem('abasSathiGoogleConfig');
      if (!saved) return defaults;
      const parsed = JSON.parse(saved);
      const sanitized = { ...defaults, ...parsed, spreadsheetId: '', driveFolderId: '' };
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

  const t = translations[language];
  const newRequestId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pendingRequestIds = useRef(new Map<string,string>());
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
    const request = { action, token: saved.token, ...requestPayload, requestId };
    // Only retry writes whose backend handlers persist requestId in the operation
    // ledger. Reusing the same ID makes an ambiguous network retry idempotent.
    const idempotentActions = new Set([
      'createRecord','updateRecord','cancelRecord','generateInvoice','cancelInvoice',
      'submitPayment','confirmPayment','rejectPayment','allocatePayment','createExpense',
      'approveExpense','markExpensePaid','cancelExpense','uploadPrivateFile',
      'postOpeningBalances'
    ]);
    try {
      let result: T;
      try {
        result = await authRequest<T>(request);
      } catch (error) {
        if (!(error instanceof BackendRequestError) || !error.retryable || !idempotentActions.has(action)) throw error;
        await new Promise(resolve => window.setTimeout(resolve, 350));
        result = await authRequest<T>(request);
      }
      pendingRequestIds.current.delete(fingerprint);
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

  // Load only the modules required by the active screen.
  useEffect(() => {
    const baseUrl = googleConfig.appsScriptWebAppUrl.trim();
    let session: any = {};
    try { session = JSON.parse(localStorage.getItem('abasSathiSession') || '{}'); } catch {}
    if (!session.token || !baseUrl) return;
    let cancelled = false;

    const keyOf = (header: string) => header.trim()
      .replace(/[./()-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');

    const normalizeRows = (rows: any[]) => (Array.isArray(rows) ? rows : []).map((row) => {
      const out: Record<string, any> = {};
      Object.keys(row || {}).forEach((key) => {
        let normalized = keyOf(key);
        // The legacy header "Super Buildup Area" maps to Structural_Area,
        // while the distinct header "Super Built-up Area" maps to Super_Built_up_Area.
        // keyOf removes punctuation, so preserve this important distinction before aliasing.
        const rawHeader = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        if (rawHeader === 'super_built-up_area') normalized = 'Super_Built_up_Area';
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
          Owner_Name:'Owner_Name', Email_ID:'Email_ID', Mobile_No:'Mobile_No'
        };
        normalized = aliases[normalized] || normalized;
        let value = row[key];
        if (normalized === 'Area_Basis' && typeof value === 'string') {
          const basis = value.trim().toLowerCase().replace(/[ _-]+/g, ' ');
          const basisAliases: Record<string,string> = {
            'cover area':'Carpet_Area', 'cover':'Carpet_Area',
            'corridor area':'Allocated_Common_Area', 'corridor':'Allocated_Common_Area',
            'super builtup area':'Structural_Area', 'super built up area':'Structural_Area',
            'structural area':'Structural_Area', 'super built-up area':'Super_Built-up_Area',
            'total area':'Super_Built-up_Area', 'allocated common area':'Allocated_Common_Area',
            'carpet area':'Carpet_Area', 'not applicable':'None', 'none':'None'
          };
          value = basisAliases[basis] || value;
        }
        if (typeof value === 'string' && value.trim() !== '' && /^-?\d+(\\.\d+)?$/.test(value.trim())) {
          value = Number(value);
        }
        out[normalized] = value;
      });
      return out;
    });

    const modulePlan: Record<string, string[]> = {
      dashboard: ['properties','owners','ownershipHistory','invoices','receipts','activityRequests','notices','gallery','expenses','bankAccounts','preventiveMaintenance','auditLogs'],
      properties_all: ['properties','owners','ownershipHistory','tenants'], properties_owners: ['properties','owners','ownershipHistory','tenants'],
      properties_history: ['ownershipHistory','owners','properties','tenants'], properties_tenants: ['tenants','properties','owners','ownershipHistory'],
      invoices_generate: ['properties','rates','ownershipHistory','owners','invoices','ratePropertyMapping'],
      invoices_register: ['invoices','properties','owners','rates','ratePropertyMapping','ownershipHistory'], invoices_rates: ['rates','ratePropertyMapping','properties'],
      invoices_outstanding: ['invoices','properties','owners','rates'],
      payments_record: ['receipts','invoices','properties','owners','ownershipHistory','bankAccounts','billWiseDetails'],
      payments_receipts: ['receipts','invoices','properties','billWiseDetails'], payments_allocation: ['receipts','invoices','billWiseDetails','properties','owners','ownershipHistory'],
      payments_advances: ['receipts','invoices','billWiseDetails','properties'], resident_flat: ['properties','owners','ownershipHistory','propertyUtilityDetails','tenants'],
      resident_bills: ['invoices'], resident_pay: ['invoices','properties','owners','ownershipHistory'], resident_history: ['receipts','billWiseDetails'],
      resident_requests: ['activityRequests','properties','ownershipHistory'], requests_all: ['activityRequests','properties'], requests_pending: ['activityRequests','properties'],
      expenses_add: ['expenses','expenseCategories','bankAccounts'], expenses_register: ['expenses','expenseCategories','bankAccounts'],
      expenses_categories: ['expenseCategories','expenses','bankAccounts'], reports_monthly: ['invoices','receipts','expenses','properties'],
      reports_property_due: ['invoices','properties','owners'], reports_ownership_due: ['invoices','properties','owners','ownershipHistory'], reports_balancesheet: ['invoices','receipts','expenses','bankAccounts','accountHeads'],
      resident_notices: ['notices','gallery'], settings_maintenance: ['preventiveMaintenance','properties'], settings_audit: ['auditLogs']
    };
    const load = async () => {
      try {
        const requested = Array.from(new Set(modulePlan[activeTab] || [])).filter(key => (key !== 'bankAccounts' || ['Admin','Accountant'].includes(session.user?.role || '')) && (key !== 'expenses' || session.user?.role !== 'Resident'));
        const permittedRequested = requested.filter(key => key !== 'auditLogs' || ['Admin','Accountant'].includes(session.user?.role || ''));
        const loadOne = async (module: string) => {
          const all: any[] = []; let page = 1; let pages = 1;
          do {
            const response = await fetch(baseUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
              body: JSON.stringify({action:'getModuleData', token:session.token, module, page, limit:200}) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || `Could not load ${module}`);
            all.push(...(Array.isArray(result.data) ? result.data : []));
            pages = Number(result.pagination?.totalPages || 1); page += 1;
            if (page > 100) throw new Error(`Safety limit reached while loading ${module}`);
          } while (page <= pages);
          return all;
        };
        const loaded = await Promise.all(permittedRequested.map(async key => [key, normalizeRows(await loadOne(key))] as const));
        if (cancelled) return;
        const data: Record<string, any[]> = Object.fromEntries(loaded);
        const rows = (key: string) => data[key] || [];
        if (requested.includes('properties')) setProperties(rows('properties').map((r:any) => ({...r,
          PropertyID:String(r.PropertyID||''), Flat_No:String(r.Flat_No||''), Block_Tower:String(r.Block_Tower||''),
          Floor_No:Number(r.Floor_No||0),
          Carpet_Area:r.Carpet_Area === '' || r.Carpet_Area == null ? null : Number(r.Carpet_Area),
          Allocated_Common_Area:r.Allocated_Common_Area === '' || r.Allocated_Common_Area == null ? null : Number(r.Allocated_Common_Area),
          Structural_Area:r.Structural_Area === '' || r.Structural_Area == null ? null : Number(r.Structural_Area),
          Super_Built_up_Area:r.Super_Built_up_Area === '' || r.Super_Built_up_Area == null ? null : Number(r.Super_Built_up_Area),
          Occupancy_Status:r.Occupancy_Status==='Occupied'?'Self Occupied':(r.Occupancy_Status||'Vacant'), Property_Status:r.Property_Status||'Active'
        })) as PropertyMaster[]);
        if (requested.includes('owners')) setOwners(rows('owners') as OwnerMaster[]);
        if (requested.includes('ownershipHistory')) setOwnerships(rows('ownershipHistory') as OwnershipHistory[]);
        if (requested.includes('tenants')) setTenants(rows('tenants') as TenantMaster[]);
        if (requested.includes('rates')) setRates(rows('rates') as RateMaster[]);
        if (requested.includes('invoices')) setInvoices(rows('invoices') as InvoiceRegister[]);
        if (requested.includes('receipts')) setReceipts(rows('receipts') as FundInflowRegister[]);
        if (requested.includes('billWiseDetails')) setBillAllocations(rows('billWiseDetails') as BillWiseDetails[]);
        if (requested.includes('expenses')) setExpenses(rows('expenses') as ExpenseRegister[]);
        if (requested.includes('expenseCategories')) setExpenseCategories(rows('expenseCategories') as ExpenseCategoryMaster[]);
        if (requested.includes('bankAccounts')) setBankAccounts(rows('bankAccounts') as BankAccountMaster[]);
        if (requested.includes('activityRequests')) setActivityRequests(rows('activityRequests') as ActivityRequestRegister[]);
        if (requested.includes('notices')) setNotices(rows('notices') as NoticeMaster[]);
        if (requested.includes('gallery')) setGallery(rows('gallery') as GalleryMaster[]);
        if (requested.includes('preventiveMaintenance')) setPreventiveMaintenance(rows('preventiveMaintenance') as PreventiveMaintenanceMaster[]);
        if (requested.includes('financialYears')) setFinancialYears(rows('financialYears') as FinancialYearMaster[]);
        if (requested.includes('accountHeads')) setAccountHeads(rows('accountHeads') as AccountHeadMaster[]);
        if (permittedRequested.includes('auditLogs')) setAuditLogs(rows('auditLogs') as AuditLog[]);
        console.info(`ABAS SATHI: selectively loaded ${permittedRequested.join(', ') || 'no modules'} for ${activeTab}.`);
      } catch (error:any) {
        console.error('ABAS SATHI selective database load failed:', error);
        if (String(error?.message || '').toLowerCase().includes('session')) {
          localStorage.removeItem('abasSathiSession'); window.location.reload();
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [googleConfig.appsScriptWebAppUrl, activeTab]);

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
    ? properties.find((p) => p.PropertyID === currentUser.PropertyID) || null
    : (properties[0] || null);

  const switchUser = (userId: string) => {
    const found = users.find((u) => u.UserID === userId);
    if (found) {
      setCurrentUser(found);
      setActiveRole(found.Role);
      setActiveTab('dashboard');
      logAction('LOGIN', 'User Session', found.UserID, '', `Switched user to ${found.Full_Name} (${found.Role})`, 'Role switch');
    }
  };

  const handleRoleChange = (role: UserRole) => {
    setActiveRole(role);
    // Find representative user for this role
    const repUser = users.find((u) => u.Role === role);
    if (repUser) {
      setCurrentUser(repUser);
    }
    setActiveTab('dashboard');
  };

  const uploadPrivateFile = async (file: File, category: string, propertyId?: string, ownerId?: string, relatedModule?: string, relatedRecordId?: string): Promise<{fileId:string;fileName:string;mimeType:string}> => {
    if (file.size > 5 * 1024 * 1024) throw new Error('File size must not exceed 5 MB.');
    if (!['application/pdf','image/jpeg','image/png'].includes(file.type)) throw new Error('Only PDF, JPG and PNG files are accepted.');
    const base64 = await new Promise<string>((resolve,reject) => {
      const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.onload = () => { const value = String(reader.result || ''); resolve(value.includes(',') ? value.split(',')[1] : value); };
      reader.readAsDataURL(file);
    });
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
    remarks?: string; proofFileName?: string;
  }): Promise<FundInflowRegister> => {
    const prop = residentProperty || properties[0];
    if (!prop) throw new Error('No property is linked to this account.');
    const ownership = ownerships.find(o => o.PropertyID === prop.PropertyID && o.Ownership_Status === 'Current');
    if (!ownership) throw new Error('Current ownership record is not available.');
    const result: any = await apiCall('submitPayment', {
      propertyId: prop.PropertyID, ownershipId: ownership.Ownership_ID,
      ownerId: ownership.OwnerID, amount: params.amount, mode: params.mode, reference: params.reference,
      bankAccount: params.bankAccount, remarks: params.remarks || `Submitted against invoices: ${params.invoiceIds.join(', ')}`,
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
      let remaining = Number(receipt.Received_Amount || 0);
      allocations = invoices.filter(i => i.PropertyID === receipt.PropertyID && i.Ownership_ID === receipt.Ownership_ID && i.Outstanding_Amount > 0)
        .sort((a,b) => String(a.Due_Date).localeCompare(String(b.Due_Date)))
        .map(i => { const amount = Math.min(remaining, Number(i.Outstanding_Amount || 0)); remaining -= amount; return { invoiceId: i.InvoiceID, amount }; })
        .filter(x => x.amount > 0);
    }
    const result: any = await apiCall('confirmPayment', { transactionId: receipt.Transaction_ID, allocations });
    const allocated = Number(result.data?.allocated || 0), unallocated = Number(result.data?.unallocated || 0);
    const allocMap = new Map(allocations.map(x => [x.invoiceId, x.amount]));
    const confirmedReceipt: FundInflowRegister = { ...receipt, Receipt_Status: 'Confirmed', Unallocated_Amount: unallocated, Receipt_Number: result.data?.receiptNo || '', Bank_Account: result.data?.bankAccount || receipt.Bank_Account };
    setReceipts(prev => prev.map(r => r.Transaction_ID === receipt.Transaction_ID ? confirmedReceipt : r));
    setInvoices(prev => prev.map(inv => {
      const amount = Number(allocMap.get(inv.InvoiceID) || 0); if (!amount) return inv;
      const outstanding = Math.max(0, Number(inv.Outstanding_Amount || 0) - amount);
      return { ...inv, Paid_Amount: Number(inv.Paid_Amount || 0) + amount, Outstanding_Amount: outstanding, Invoice_Status: outstanding <= 0 ? 'Paid' : 'Partially Paid' };
    }));
    setBillAllocations(prev => [...(result.data?.allocationRows || []), ...prev]);
    setBankAccounts(prev => prev.map(b => b.BankAccount_ID === receipt.Bank_Account ? { ...b, Current_Balance: Number(b.Current_Balance || 0) + Number(receipt.Received_Amount || 0) } : b));
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
    if (expense.Expense_Status !== 'Approved') throw new Error('Expense must be approved before payment.');
    await apiCall('markExpensePaid', { expenseId });
    const now = new Date().toISOString();
    setExpenses(prev => prev.map(e => e.Expense_ID === expenseId ? { ...e, Expense_Status: 'Paid', Payment_Date: now.slice(0,10) } : e));
    setBankAccounts(prev => prev.map(b => b.BankAccount_ID === expense.Bank_Account ? { ...b, Current_Balance: Number(b.Current_Balance || 0) - Number(expense.Payment_Amount || 0) } : b));
  };

  // Activity Requests — server-persisted.
  const createActivityRequest = async (params: {
    category: ActivityRequestRegister['Request_Category']; subject: string; description: string;
    priority: ActivityRequestRegister['Priority']; attachment?: string;
  }): Promise<ActivityRequestRegister> => {
    const prop = residentProperty || properties[0];
    if (!prop) throw new Error('No property is linked to this account.');
    const own = ownerships.find(o => o.PropertyID === prop.PropertyID && o.Ownership_Status === 'Current');
    if (!own) throw new Error('Current ownership record not found.');
    const record = { PropertyID: prop.PropertyID, Ownership_ID: own.Ownership_ID,
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
        preventiveMaintenance,
        auditLogs,
        financialYears,
        accountHeads,
        users,
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
