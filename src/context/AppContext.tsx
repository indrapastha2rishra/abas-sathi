/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
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
import {
  initialProperties,
  initialOwners,
  initialOwnerships,
  initialTenants,
  initialUsers,
  initialRates,
  initialInvoices,
  initialReceipts,
  initialBillAllocations,
  initialExpenses,
  initialExpenseCategories,
  initialBankAccounts,
  initialActivityRequests,
  initialNotices,
  initialGallery,
  initialPreventiveMaintenance,
  initialAuditLogs,
  initialFinancialYears,
  initialAccountHeads,
} from '../data/mockData';
import { Language, translations } from '../utils/i18n';
import {
  allocatePaymentToInvoice,
  calculateChargeAmount,
  calculateNetChargeAmount,
  generateNextCode,
} from '../utils/calculations';

export interface GoogleBackendConfig {
  spreadsheetId: string;
  driveFolderId: string;
  appsScriptWebAppUrl: string;
  mode: 'demo' | 'live';
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
  }) => InvoiceRegister;

  submitResidentPayment: (params: {
    invoiceIds: string[];
    amount: number;
    mode: PaymentMode;
    reference: string;
    bankAccount: string;
    remarks?: string;
    proofFileName?: string;
  }) => FundInflowRegister;

  confirmAndAllocatePayment: (receiptId: string, customAllocations?: { invoiceId: string; amount: number }[]) => void;

  addExpense: (params: Omit<ExpenseRegister, 'Expense_ID' | 'Voucher_No' | 'Created_At' | 'Created_By' | 'Approved_At' | 'Approved_By' | 'Cancelled_At' | 'Cancelled_By' | 'Cancellation_Reason'>) => ExpenseRegister;

  approveExpense: (expenseId: string) => void;

  createActivityRequest: (params: {
    category: ActivityRequestRegister['Request_Category'];
    subject: string;
    description: string;
    priority: ActivityRequestRegister['Priority'];
    attachment?: string;
  }) => ActivityRequestRegister;

  updateActivityRequest: (
    requestId: string,
    updates: Partial<Pick<ActivityRequestRegister, 'Request_Status' | 'Assigned_To' | 'Admin_Remarks' | 'Completion_Date' | 'Completion_Proof'>>
  ) => void;

  createNotice: (notice: Omit<NoticeMaster, 'Notice_ID' | 'Notice_Number' | 'Created_At' | 'Created_By'>) => void;

  // Backend settings
  googleConfig: GoogleBackendConfig;
  updateGoogleConfig: (config: Partial<GoogleBackendConfig>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [users, setUsers] = useState<UserMaster[]>(initialUsers);
  const [currentUser, setCurrentUser] = useState<UserMaster>(initialUsers[0]); // Starts as Admin
  const [activeRole, setActiveRole] = useState<UserRole>('Admin');
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Database collections
  const [properties, setProperties] = useState<PropertyMaster[]>(initialProperties);
  const [owners, setOwners] = useState<OwnerMaster[]>(initialOwners);
  const [ownerships, setOwnerships] = useState<OwnershipHistory[]>(initialOwnerships);
  const [tenants, setTenants] = useState<TenantMaster[]>(initialTenants);
  const [rates, setRates] = useState<RateMaster[]>(initialRates);
  const [invoices, setInvoices] = useState<InvoiceRegister[]>(initialInvoices);
  const [receipts, setReceipts] = useState<FundInflowRegister[]>(initialReceipts);
  const [billAllocations, setBillAllocations] = useState<BillWiseDetails[]>(initialBillAllocations);
  const [expenses, setExpenses] = useState<ExpenseRegister[]>(initialExpenses);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryMaster[]>(initialExpenseCategories);
  const [bankAccounts, setBankAccounts] = useState<BankAccountMaster[]>(initialBankAccounts);
  const [activityRequests, setActivityRequests] = useState<ActivityRequestRegister[]>(initialActivityRequests);
  const [notices, setNotices] = useState<NoticeMaster[]>(initialNotices);
  const [gallery, setGallery] = useState<GalleryMaster[]>(initialGallery);
  const [preventiveMaintenance, setPreventiveMaintenance] = useState<PreventiveMaintenanceMaster[]>(initialPreventiveMaintenance);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  const [financialYears, setFinancialYears] = useState<FinancialYearMaster[]>(initialFinancialYears);
  const [accountHeads, setAccountHeads] = useState<AccountHeadMaster[]>(initialAccountHeads);

  // Document preview modals
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceRegister | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<FundInflowRegister | null>(null);
  const [previewVoucher, setPreviewVoucher] = useState<ExpenseRegister | null>(null);

  // Google backend configuration. Saved locally in this browser.
  const [googleConfig, setGoogleConfig] = useState<GoogleBackendConfig>(() => {
    const defaults: GoogleBackendConfig = {
      spreadsheetId: '[ADD_SPREADSHEET_ID]',
      driveFolderId: '[ADD_DRIVE_FOLDER_ID]',
      appsScriptWebAppUrl: '[ADD_APPS_SCRIPT_WEB_APP_URL]',
      mode: 'demo',
    };
    try {
      if (typeof window === 'undefined') return defaults;
      const saved = window.localStorage.getItem('abasSathiGoogleConfig');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  const updateGoogleConfig = (cfg: Partial<GoogleBackendConfig>) => {
    setGoogleConfig((prev) => {
      const next = { ...prev, ...cfg };
      // The current Settings screen has no separate Live/Demo selector.
      // A real Apps Script URL therefore enables Live mode automatically.
      const url = next.appsScriptWebAppUrl.trim();
      if (cfg.appsScriptWebAppUrl !== undefined) {
        next.mode = url.startsWith('https://script.google.com/macros/s/') && url.endsWith('/exec')
          ? 'live'
          : 'demo';
      }
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

  // Load Property Master from Google Sheets when a valid backend URL is saved.
  useEffect(() => {
    if (googleConfig.mode !== 'live') return;
    const baseUrl = googleConfig.appsScriptWebAppUrl.trim();
    if (!baseUrl || baseUrl.startsWith('[ADD_')) return;

    let cancelled = false;
    const loadProperties = async () => {
      try {
        const separator = baseUrl.includes('?') ? '&' : '?';
        const response = await fetch(`${baseUrl}${separator}action=getProperties`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const result = await response.json();
        if (result.status !== 'success' || !Array.isArray(result.data)) {
          throw new Error(result.message || 'Invalid Google Sheets API response');
        }

        const liveProperties = result.data.map((row: Record<string, unknown>) => {
          const floorText = String(row['Floor No.'] ?? '');
          const floorMatch = floorText.match(/-?\d+/);
          const rawOccupancy = String(row['Occupancy Status'] ?? 'Vacant');
          const occupancy = rawOccupancy === 'Occupied' ? 'Self Occupied' : rawOccupancy;
          const rawPropertyStatus = String(row['Property_Status'] ?? 'Active');
          const propertyStatus = ['Active', 'Inactive', 'Under Renovation'].includes(rawPropertyStatus)
            ? rawPropertyStatus
            : 'Active';

          return {
            PropertyID: String(row['PropertyID'] ?? ''),
            Flat_No: String(row['Flat No.'] ?? ''),
            Block_Tower: String(row['Block / Tower'] ?? ''),
            Floor_No: floorMatch ? Number(floorMatch[0]) : 0,
            Property_Type: String(row['Property Type'] ?? '2BHK').replace(/\s+/g, '') as PropertyMaster['Property_Type'],
            Cover_Area: Number(row['Cover Area'] ?? 0),
            Corridor_Area: Number(row['Coridoor Area'] ?? 0),
            Super_Builtup_Area: Number(row['Super Buildup Area'] ?? 0),
            Total_Area: Number(row['Total Area'] ?? 0),
            Occupancy_Status: (['Self Occupied', 'Tenant Occupied', 'Vacant'].includes(occupancy)
              ? occupancy
              : 'Vacant') as PropertyMaster['Occupancy_Status'],
            Property_Status: propertyStatus as PropertyMaster['Property_Status'],
            Remarks: String(row['Remarks'] ?? ''),
            Created_By: String(row['Created_By'] ?? ''),
            Created_At: String(row['Created_At'] ?? ''),
          };
        }) as PropertyMaster[];

        if (!cancelled) {
          setProperties(liveProperties);
          console.info(`ABAS SATHI: Loaded ${liveProperties.length} properties from Google Sheets.`);
        }
      } catch (error) {
        console.error('ABAS SATHI Google Sheets read failed:', error);
      }
    };

    loadProperties();
    return () => { cancelled = true; };
  }, [googleConfig.mode, googleConfig.appsScriptWebAppUrl]);

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
    ? properties.find((p) => p.PropertyID === currentUser.PropertyID) || properties[0]
    : properties[0];

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

  // Generate an invoice
  const generateInvoice = (params: {
    propertyId: string;
    rateId: string;
    billPeriodFrom: string;
    billPeriodTo: string;
    dueDate: string;
    lateFee?: number;
    discount?: number;
    adjustment?: number;
    remarks?: string;
  }): InvoiceRegister => {
    const prop = properties.find((p) => p.PropertyID === params.propertyId) || properties[0];
    const ownership = ownerships.find((o) => o.PropertyID === prop.PropertyID && o.Ownership_Status === 'Current') || ownerships[0];
    const owner = owners.find((o) => o.OwnerID === ownership.OwnerID) || owners[0];
    const rate = rates.find((r) => r.RateID === params.rateId) || rates[0];

    const area = rate.Area_Basis === 'Super Builtup Area' ? prop.Super_Builtup_Area : prop.Cover_Area;
    const charge = calculateChargeAmount(rate.Calculation_Method, rate.Rate_Per_SqFt_Unit, area, 1);
    const lateFee = params.lateFee || 0;
    const discount = params.discount || 0;
    const adjustment = params.adjustment || 0;
    const netCharge = calculateNetChargeAmount(charge, lateFee, discount, adjustment);

    const nextInvCode = generateNextCode('INV', invoices.length);
    const today = new Date().toISOString().split('T')[0];

    const newInvoice: InvoiceRegister = {
      InvoiceID: `INV-ID-${Date.now()}`,
      Invoice_Number: nextInvCode,
      Billing_Date: today,
      Bill_Period_From: params.billPeriodFrom,
      Bill_Period_To: params.billPeriodTo,
      Due_Date: params.dueDate,
      Ownership_ID: ownership.Ownership_ID,
      PropertyID: prop.PropertyID,
      OwnerID: owner.OwnerID,
      Purpose: rate.Purpose,
      Flat_Number: prop.Flat_No,
      Owner_Name: owner.Owner_Name,
      RateID: rate.RateID,
      Rate_Per_SqFt_Unit: rate.Rate_Per_SqFt_Unit,
      Area_Basis: rate.Area_Basis,
      Area_SqFt: area,
      Quantity: 1,
      Unit_Of_Measure: rate.Calculation_Method === 'Area × Rate' ? 'Sq.Ft.' : 'Unit',
      Charge_Amount: charge,
      Late_Fee: lateFee,
      Discount_Amount: discount,
      Adjustment_Amount: adjustment,
      Net_Charge_Amount: netCharge,
      Paid_Amount: 0,
      Outstanding_Amount: netCharge,
      Calculation_Method: rate.Calculation_Method,
      Invoice_Description: `${rate.Purpose} for Flat ${prop.Flat_No} (${params.billPeriodFrom} to ${params.billPeriodTo})`,
      Remarks: params.remarks || '',
      File_Reference: `${nextInvCode}.pdf`,
      Invoice_Status: 'Unpaid',
      Created_By: currentUser.Full_Name,
      Created_At: new Date().toISOString(),
      Approved_By: currentUser.Full_Name,
      Approved_At: new Date().toISOString(),
      Cancelled_At: null,
      Cancelled_By: null,
      Cancellation_Reason: null,
      Rate_Effective_Date: rate.Effective_From,
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    logAction('CREATE', 'Invoice Register', nextInvCode, 'None', `Net ₹${netCharge} for Flat ${prop.Flat_No}`, 'Generated new society invoice');

    return newInvoice;
  };

  // Submit payment from resident (status: Pending Verification)
  const submitResidentPayment = (params: {
    invoiceIds: string[];
    amount: number;
    mode: PaymentMode;
    reference: string;
    bankAccount: string;
    remarks?: string;
    proofFileName?: string;
  }): FundInflowRegister => {
    const prop = residentProperty || properties[0];
    const ownership = ownerships.find((o) => o.PropertyID === prop.PropertyID) || ownerships[0];
    const owner = owners.find((o) => o.OwnerID === ownership.OwnerID) || owners[0];

    const nextRecCode = generateNextCode('REC', receipts.length);
    const today = new Date().toISOString().split('T')[0];

    const newReceipt: FundInflowRegister = {
      Transaction_ID: `TXN-ID-${Date.now()}`,
      Receipt_Number: nextRecCode,
      Date_Of_Received: today,
      PropertyID: prop.PropertyID,
      Ownership_ID: ownership.Ownership_ID,
      OwnerID: owner.OwnerID,
      Flat_No: prop.Flat_No,
      Owner_Name: owner.Owner_Name,
      Received_Amount: params.amount,
      Received_Mode: params.mode,
      Received_Reference: params.reference,
      Bank_Account: params.bankAccount,
      Unallocated_Amount: params.amount,
      Remarks: params.remarks || `Submitted against invoices: ${params.invoiceIds.join(', ')}`,
      File_Reference: params.proofFileName || `${nextRecCode}_proof.pdf`,
      Created_By: currentUser.Full_Name,
      Created_At: new Date().toISOString(),
      Receipt_Status: 'Pending Verification',
    };

    setReceipts((prev) => [newReceipt, ...prev]);

    // Update target invoices to 'Pending Verification' so resident knows it is in review
    setInvoices((prev) =>
      prev.map((inv) =>
        params.invoiceIds.includes(inv.InvoiceID)
          ? { ...inv, Invoice_Status: 'Pending Verification' as const }
          : inv
      )
    );

    logAction(
      'CREATE',
      'Fund Inflow Register',
      nextRecCode,
      'Pending',
      `₹${params.amount} via ${params.mode} (Ref: ${params.reference})`,
      'Resident submitted payment for verification'
    );

    return newReceipt;
  };

  // Admin/Accountant confirms payment & allocates
  const confirmAndAllocatePayment = (
    receiptId: string,
    customAllocations?: { invoiceId: string; amount: number }[]
  ) => {
    const receipt = receipts.find((r) => r.Transaction_ID === receiptId || r.Receipt_Number === receiptId);
    if (!receipt) return;

    let currentReceipt: FundInflowRegister = { ...receipt, Receipt_Status: 'Confirmed' };
    const newBillAllocations: BillWiseDetails[] = [];
    let updatedInvoicesMap = new Map<string, InvoiceRegister>();

    // If custom allocations provided, use them; otherwise auto-allocate to property's unpaid invoices
    if (customAllocations && customAllocations.length > 0) {
      for (const alloc of customAllocations) {
        const inv = updatedInvoicesMap.get(alloc.invoiceId) || invoices.find((i) => i.InvoiceID === alloc.invoiceId);
        if (!inv) continue;

        const res = allocatePaymentToInvoice({
          receipt: currentReceipt,
          invoice: inv,
          requestedAmount: alloc.amount,
          userId: currentUser.Full_Name,
          remarks: `Confirmed & allocated against ${receipt.Receipt_Number}`,
        });

        if (res.success && res.billDetail && res.updatedReceipt && res.updatedInvoice) {
          currentReceipt = res.updatedReceipt;
          newBillAllocations.push(res.billDetail);
          updatedInvoicesMap.set(res.updatedInvoice.InvoiceID, res.updatedInvoice);
        }
      }
    } else {
      // Auto-allocate against unpaid/pending invoices for this flat
      const flatInvoices = invoices.filter(
        (i) => i.PropertyID === receipt.PropertyID && i.Outstanding_Amount > 0
      );

      for (const inv of flatInvoices) {
        if (currentReceipt.Unallocated_Amount <= 0) break;
        const targetInv = updatedInvoicesMap.get(inv.InvoiceID) || inv;

        const res = allocatePaymentToInvoice({
          receipt: currentReceipt,
          invoice: targetInv,
          userId: currentUser.Full_Name,
          remarks: `Auto-allocated against ${receipt.Receipt_Number}`,
        });

        if (res.success && res.billDetail && res.updatedReceipt && res.updatedInvoice) {
          currentReceipt = res.updatedReceipt;
          newBillAllocations.push(res.billDetail);
          updatedInvoicesMap.set(res.updatedInvoice.InvoiceID, res.updatedInvoice);
        }
      }
    }

    // Update state
    setReceipts((prev) => prev.map((r) => (r.Transaction_ID === currentReceipt.Transaction_ID ? currentReceipt : r)));
    if (newBillAllocations.length > 0) {
      setBillAllocations((prev) => [...newBillAllocations, ...prev]);
    }
    if (updatedInvoicesMap.size > 0) {
      setInvoices((prev) =>
        prev.map((i) => (updatedInvoicesMap.has(i.InvoiceID) ? updatedInvoicesMap.get(i.InvoiceID)! : i))
      );
    }

    // Update bank account balance
    setBankAccounts((prev) =>
      prev.map((b) =>
        b.BankAccount_ID === currentReceipt.Bank_Account
          ? { ...b, Current_Balance: b.Current_Balance + currentReceipt.Received_Amount }
          : b
      )
    );

    logAction(
      'ALLOCATE',
      'Bill Wise Details',
      receipt.Receipt_Number,
      'Unallocated',
      `Allocated ₹${receipt.Received_Amount - currentReceipt.Unallocated_Amount} (Advance remaining: ₹${currentReceipt.Unallocated_Amount})`,
      'Accountant confirmed and completed bill allocation'
    );
  };

  // Add Expense
  const addExpense = (
    params: Omit<
      ExpenseRegister,
      | 'Expense_ID'
      | 'Voucher_No'
      | 'Created_At'
      | 'Created_By'
      | 'Approved_At'
      | 'Approved_By'
      | 'Cancelled_At'
      | 'Cancelled_By'
      | 'Cancellation_Reason'
    >
  ): ExpenseRegister => {
    const nextVouCode = generateNextCode('VOU', expenses.length);
    const newExp: ExpenseRegister = {
      ...params,
      Expense_ID: `EXP-${Date.now()}`,
      Voucher_No: nextVouCode,
      Created_By: currentUser.Full_Name,
      Created_At: new Date().toISOString(),
      Approved_By: params.Expense_Status === 'Paid' ? currentUser.Full_Name : '',
      Approved_At: params.Expense_Status === 'Paid' ? new Date().toISOString() : '',
      Cancelled_By: null,
      Cancelled_At: null,
      Cancellation_Reason: null,
    };

    setExpenses((prev) => [newExp, ...prev]);

    if (newExp.Expense_Status === 'Paid') {
      setBankAccounts((prev) =>
        prev.map((b) =>
          b.BankAccount_ID === newExp.Bank_Account
            ? { ...b, Current_Balance: b.Current_Balance - newExp.Payment_Amount }
            : b
        )
      );
    }

    logAction('CREATE', 'Expense Register', nextVouCode, 'None', `₹${newExp.Payment_Amount} for ${newExp.Expense_Category}`, 'New society expenditure voucher');

    return newExp;
  };

  // Approve Expense
  const approveExpense = (expenseId: string) => {
    setExpenses((prev) =>
      prev.map((exp) => {
        if (exp.Expense_ID === expenseId) {
          const updated: ExpenseRegister = {
            ...exp,
            Expense_Status: 'Paid',
            Approved_By: currentUser.Full_Name,
            Approved_At: new Date().toISOString(),
          };

          // Deduct from bank account
          setBankAccounts((prevBanks) =>
            prevBanks.map((b) =>
              b.BankAccount_ID === exp.Bank_Account
                ? { ...b, Current_Balance: b.Current_Balance - exp.Payment_Amount }
                : b
            )
          );

          logAction('APPROVE', 'Expense Register', exp.Voucher_No, exp.Expense_Status, 'Paid', `Approved and disbursed ₹${exp.Payment_Amount}`);
          return updated;
        }
        return exp;
      })
    );
  };

  // Activity Requests
  const createActivityRequest = (params: {
    category: ActivityRequestRegister['Request_Category'];
    subject: string;
    description: string;
    priority: ActivityRequestRegister['Priority'];
    attachment?: string;
  }): ActivityRequestRegister => {
    const prop = residentProperty || properties[0];
    const ownership = ownerships.find((o) => o.PropertyID === prop.PropertyID) || ownerships[0];
    const nextReqCode = generateNextCode('REQ', activityRequests.length);
    const today = new Date().toISOString().split('T')[0];

    const newReq: ActivityRequestRegister = {
      Request_ID: `REQ-ID-${Date.now()}`,
      Request_Number: nextReqCode,
      PropertyID: prop.PropertyID,
      Ownership_ID: ownership.Ownership_ID,
      Requested_By: currentUser.Full_Name,
      Request_Date: today,
      Request_Category: params.category,
      Subject: params.subject,
      Description: params.description,
      Priority: params.priority,
      Attachment: params.attachment || '',
      Assigned_To: 'Pending Assignment',
      Request_Status: 'Pending',
      Admin_Remarks: '',
      Completion_Date: null,
      Completion_Proof: null,
      Created_At: new Date().toISOString(),
      Updated_At: new Date().toISOString(),
    };

    setActivityRequests((prev) => [newReq, ...prev]);
    logAction('CREATE', 'Activity Request Register', nextReqCode, 'None', `${params.category}: ${params.subject}`, 'Resident raised service request');

    return newReq;
  };

  const updateActivityRequest = (
    requestId: string,
    updates: Partial<Pick<ActivityRequestRegister, 'Request_Status' | 'Assigned_To' | 'Admin_Remarks' | 'Completion_Date' | 'Completion_Proof'>>
  ) => {
    setActivityRequests((prev) =>
      prev.map((req) => {
        if (req.Request_ID === requestId) {
          const updated = {
            ...req,
            ...updates,
            Updated_At: new Date().toISOString(),
          };
          logAction(
            'UPDATE',
            'Activity Request Register',
            req.Request_Number,
            req.Request_Status,
            updates.Request_Status || req.Request_Status,
            updates.Admin_Remarks || 'Updated activity request status/assignment'
          );
          return updated;
        }
        return req;
      })
    );
  };

  // Create Notice
  const createNotice = (notice: Omit<NoticeMaster, 'Notice_ID' | 'Notice_Number' | 'Created_At' | 'Created_By'>) => {
    const nextNum = `NOT-2026-${String(notices.length + 1).padStart(3, '0')}`;
    const newNotice: NoticeMaster = {
      ...notice,
      Notice_ID: `NOT-${Date.now()}`,
      Notice_Number: nextNum,
      Created_By: currentUser.Full_Name,
      Created_At: new Date().toISOString(),
    };
    setNotices((prev) => [newNotice, ...prev]);
    logAction('CREATE', 'Notice Master', nextNum, 'None', notice.Notice_Title, 'Published society notice');
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
        submitResidentPayment,
        confirmAndAllocatePayment,
        addExpense,
        approveExpense,
        createActivityRequest,
        updateActivityRequest,
        createNotice,
        googleConfig,
        updateGoogleConfig,
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
