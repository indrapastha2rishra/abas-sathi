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
