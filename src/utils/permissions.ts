import type { UserRole } from '../types/database';

export type PermissionAction = 'Can_View' | 'Can_Create' | 'Can_Edit' | 'Can_Delete' | 'Can_Approve';
export interface RolePermissionRecord {
  Permission_ID?: string;
  Role?: string;
  Module_Name?: string;
  Can_View?: boolean | string;
  Can_Create?: boolean | string;
  Can_Edit?: boolean | string;
  Can_Delete?: boolean | string;
  Can_Approve?: boolean | string;
  Remarks?: string;
}

export const PERMISSION_MODULES = [
  'Dashboard','Properties & Residents','Owner Management','Ownership History','Tenant Management',
  'Maintenance & Invoices','Payments','Fund Inflow','Bill Wise Details','Expenses','Activity Requests',
  'Notices','Gallery','Preventive Maintenance','Reports','Financial Year Management','Account Heads',
  'Bank Accounts','User Management','Role Permission Management','Settings','Audit Log',
  'Financial Transactions','My Flat','My Bills','Pay Now','Payment History','Notices & Gallery','Resident Portal'
] as const;

const TAB_MODULES: Record<string,string> = {
  dashboard:'Dashboard', profile:'Profile', settings_users:'User Management', settings_role_permissions:'Role Permission Management', settings_master:'Account Heads',
  settings_google:'Settings', settings_maintenance:'Preventive Maintenance', settings_audit:'Audit Log',
  properties_all:'Properties & Residents', properties_owners:'Owner Management', properties_history:'Ownership History', properties_tenants:'Tenant Management',
  invoices_generate:'Maintenance & Invoices', invoices_register:'Maintenance & Invoices', invoices_rates:'Maintenance & Invoices', invoices_outstanding:'Maintenance & Invoices',
  payments_record:'Payments', payments_receipts:'Payments', payments_allocation:'Bill Wise Details', payments_advances:'Payments',
  requests_all:'Activity Requests', requests_pending:'Activity Requests', resident_requests:'Activity Requests',
  expenses_add:'Expenses', expenses_register:'Expenses', expenses_categories:'Expenses',
  financial_rv:'Financial Transactions', financial_pv:'Financial Transactions', financial_jv:'Financial Transactions', financial_cv:'Financial Transactions',
  reports_monthly:'Reports', reports_fy:'Reports', reports_expense_summary:'Reports', reports_property_due:'Reports', reports_owner_due:'Reports', reports_ownership_due:'Reports', reports_balancesheet:'Reports', reports_year_end:'Reports',
  resident_flat:'My Flat', resident_bills:'My Bills', resident_pay:'Pay Now', resident_history:'Payment History', resident_notices:'Notices & Gallery', resident_reports:'Resident Portal'
};

export const moduleForTab = (tab: string) => TAB_MODULES[tab] || '';
export const actionForTab = (tab: string): PermissionAction => {
  if(['invoices_generate','payments_record','expenses_add','financial_rv','financial_pv','financial_jv','financial_cv'].includes(tab)) return 'Can_Create';
  if(tab==='resident_pay') return 'Can_Create';
  if(tab==='payments_allocation') return 'Can_Edit';
  if(tab==='reports_year_end') return 'Can_Create';
  if(tab==='requests_pending') return 'Can_Approve';
  return 'Can_View';
};
const toBool = (value: unknown) => value === true || String(value ?? '').trim().toLowerCase() === 'true' || String(value ?? '').trim() === '1';

export function permissionGranted(rows: RolePermissionRecord[], role: UserRole | string, moduleName: string, action: PermissionAction = 'Can_View') {
  if (!role || !moduleName) return false;
  const row = rows.find(r => String(r.Role || '').trim().toLowerCase() === String(role).trim().toLowerCase() && String(r.Module_Name || '').trim().toLowerCase() === moduleName.trim().toLowerCase());
  return row ? toBool(row[action]) : false; // missing records default deny
}
