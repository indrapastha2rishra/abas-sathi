/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Admin' | 'Committee' | 'Accountant' | 'Resident';

export type OccupancyStatus = 'Self Occupied' | 'Tenant Occupied' | 'Vacant';
export type PropertyStatus = 'Active' | 'Inactive' | 'Under Renovation';

export interface PropertyMaster {
  PropertyID: string;
  Flat_No: string;
  Block_Tower: string;
  Floor_No: number;
  Property_Type: '2BHK' | '3BHK' | '4BHK' | 'Penthouse' | 'Studio';
  Carpet_Area: number | null; // sq ft; null means blank in the source sheet
  Allocated_Common_Area: number | null;
  Structural_Area: number | null;
  Super_Built_up_Area: number | null;
  Occupancy_Status: OccupancyStatus;
  Property_Status: PropertyStatus;
  Remarks: string;
  Created_By: string;
  Created_At: string;
}

export interface OwnerMaster {
  OwnerID: string;
  Owner_Name: string;
  Mobile_No: string;
  Email_ID: string;
  Emergency_Contact: string;
  Owner_Address: string;
  Remarks: string;
  Created_By: string;
  Created_At: string;
}

export interface OwnershipHistory {
  Ownership_ID: string;
  PropertyID: string;
  OwnerID: string;
  Ownership_Type: 'Sole' | 'Joint' | 'Inherited' | 'Purchased';
  Ownership_Share: number; // e.g. 100 or 50%
  Ownership_Start_Date: string;
  Ownership_End_Date: string | null;
  Ownership_Status: 'Current' | 'Transferred' | 'Historical';
  Municipality_Assessee_No: string;
  Municipality_Holding_No: string;
  Khatian: string;
  JL_No: string;
  Deed_No: string;
  Owner_Document: string;
  Remarks: string;
  Created_By: string;
  Created_At: string;
}

export type CalculationMethod = 'Area × Rate' | 'Quantity × Rate' | 'Fixed Amount';
export type AreaBasis = 'Structural_Area' | 'Carpet_Area' | 'Allocated_Common_Area' | 'Super_Built-up_Area' | 'None';

export interface RateMaster {
  RateID: string;
  Purpose: string;
  Area_Basis: AreaBasis;
  Rate_Per_SqFt_Unit: number;
  Effective_From: string;
  Effective_To: string | null;
  Calculation_Method: CalculationMethod;
  Applicable_To: 'All Properties' | string; // PropertyID or All
  Status: 'Active' | 'Inactive' | 'Draft';
  Remarks: string;
  Approved_By: string;
  Approved_At: string;
  File_Reference: string;
  Created_By: string;
  Created_At: string;
}

export type InvoiceStatus = 'Paid' | 'Unpaid' | 'Partially Paid' | 'Overdue' | 'Cancelled' | 'Pending Verification';

export interface InvoiceRegister {
  InvoiceID: string;
  Invoice_Number: string; // INV-2026-XXXX
  Billing_Date: string;
  Bill_Period_From: string;
  Bill_Period_To: string;
  Due_Date: string;
  Ownership_ID: string;
  PropertyID: string;
  OwnerID: string;
  Purpose: string;
  Flat_Number: string;
  Owner_Name: string;
  RateID: string;
  Rate_Per_SqFt_Unit: number;
  Area_Basis: AreaBasis;
  Area_SqFt: number;
  Quantity: number;
  Unit_Of_Measure: string;
  Charge_Amount: number;
  Late_Fee: number;
  Discount_Amount: number;
  Adjustment_Amount: number; // Positive = debit, Negative = credit
  Net_Charge_Amount: number;
  Paid_Amount: number; // derived / tracked
  Outstanding_Amount: number; // derived
  Calculation_Method: CalculationMethod;
  Invoice_Description: string;
  Remarks: string;
  File_Reference: string;
  Invoice_Status: InvoiceStatus;
  Created_By: string;
  Created_At: string;
  Approved_By: string;
  Approved_At: string;
  Cancelled_At: string | null;
  Cancelled_By: string | null;
  Cancellation_Reason: string | null;
  Rate_Effective_Date: string;
}

export type PaymentMode = 'UPI' | 'NEFT' | 'IMPS' | 'Cheque' | 'Cash' | 'Card';
export type ReceiptStatus = 'Confirmed' | 'Pending Verification' | 'Rejected' | 'Cancelled' | 'Bounced';

export interface FundInflowRegister {
  Transaction_ID: string;
  Receipt_Number: string; // RCT-YYYY-######; assigned only after confirmation
  Date_Of_Received: string;
  PropertyID: string;
  Ownership_ID: string;
  OwnerID: string;
  Flat_No: string;
  Owner_Name: string;
  Received_Amount: number;
  Received_Mode: PaymentMode;
  Received_Reference: string; // UTR / Cheque No / UPI txn id
  Bank_Account: string;
  Unallocated_Amount: number;
  Remarks: string;
  File_Reference: string;
  Created_By: string;
  Created_At: string;
  Receipt_Status: ReceiptStatus;
}

export interface BillWiseDetails {
  Allocation_ID: string;
  Transaction_ID: string;
  InvoiceID: string;
  PropertyID: string;
  Ownership_ID: string;
  OwnerID: string;
  Invoice_Number: string;
  Invoice_Amount: number;
  Previously_Paid: number;
  Outstanding_Before: number;
  Allocated_Amount: number;
  Outstanding_After: number;
  Allocation_Date: string;
  Remarks: string;
  Created_By: string;
  Created_At: string;
}

export type ExpenseStatus = 'Paid' | 'Approved' | 'Pending Approval' | 'Draft' | 'Cancelled';

export interface ExpenseRegister {
  Expense_ID: string;
  Voucher_No: string; // VOU-2026-XXXX
  Payment_Date: string;
  Expense_Category: string;
  Expense_Subcategory: string;
  Payee_Name: string;
  Particulars: string;
  Payment_Amount: number;
  Payment_Mode: PaymentMode;
  Payment_Reference: string;
  Bank_Account: string;
  PropertyID: string; // "Common" or specific PropertyID
  Remarks: string;
  File_Reference: string;
  Expense_Status: ExpenseStatus;
  Created_By: string;
  Created_At: string;
  Approved_By: string;
  Approved_At: string;
  Cancelled_By: string | null;
  Cancelled_At: string | null;
  Cancellation_Reason: string | null;
}

export interface ExpenseCategoryMaster {
  Category_ID: string;
  Category_Name: string;
  Subcategory_Name: string;
  Description: string;
  Status: 'Active' | 'Inactive';
  Created_By: string;
  Created_At: string;
}

export interface BankAccountMaster {
  BankAccount_ID: string;
  Bank_Name: string;
  Branch_Name: string;
  Account_Name: string;
  Account_Number: string;
  IFSC_Code: string;
  Account_Type: 'Savings' | 'Current' | 'Fixed Deposit';
  Opening_Balance: number;
  Current_Balance: number;
  Opening_Balance_Date: string;
  Status: 'Active' | 'Inactive';
  Remarks: string;
  Created_By: string;
  Created_At: string;
}

export interface UserMaster {
  UserID: string;
  Full_Name: string;
  Email_ID: string;
  Mobile_No: string;
  Role: UserRole;
  PropertyID: string | null; // Null for pure admin/accountant, Flat ID for Resident
  Ownership_ID: string | null;
  Account_Status: 'Active' | 'Suspended' | 'Pending Verification';
  Last_Login: string;
  Created_By: string;
  Created_At: string;
}

export type RequestPriority = 'Low' | 'Medium' | 'High' | 'Emergency';
export type RequestStatus = 'Pending' | 'In Progress' | 'Completed' | 'Rejected' | 'Cancelled';

export interface ActivityRequestRegister {
  Request_ID: string;
  Request_Number: string; // REQ-2026-XXXX
  PropertyID: string;
  Ownership_ID: string;
  Requested_By: string;
  Request_Date: string;
  Request_Category: 'Plumbing' | 'Electrical' | 'Carpentry' | 'Lift/Elevator' | 'Security' | 'Cleanliness' | 'Administrative' | 'Other';
  Subject: string;
  Description: string;
  Priority: RequestPriority;
  Attachment: string;
  Assigned_To: string;
  Request_Status: RequestStatus;
  Admin_Remarks: string;
  Completion_Date: string | null;
  Completion_Proof: string | null;
  Created_At: string;
  Updated_At: string;
}

export interface NoticeMaster {
  Notice_ID: string;
  Notice_Number: string;
  Notice_Title: string;
  Notice_Category: 'General' | 'Financial' | 'Maintenance' | 'Emergency' | 'Festival & Event' | 'Meeting';
  Notice_Description: string;
  Publish_Date: string;
  Expiry_Date: string;
  Attachment: string;
  Visibility: 'All' | 'Owners Only' | 'Tenants Only' | 'Committee';
  Notice_Status: 'Published' | 'Draft' | 'Archived';
  Created_By: string;
  Created_At: string;
}

export interface GalleryMaster {
  Gallery_ID: string;
  Event_Name: string;
  Event_Date: string;
  Event_Description: string;
  Photo_File_Reference: string;
  Visibility: 'Public' | 'Residents Only' | 'Committee';
  Uploaded_By: string;
  Uploaded_At: string;
  Status: 'Active' | 'Archived';
}

export interface PreventiveMaintenanceMaster {
  Maintenance_ID: string;
  Asset_Name: string;
  Maintenance_Category: 'Lift' | 'DG Generator' | 'Water Pump' | 'Fire Safety' | 'Solar Panel' | 'CCTV & Intercom' | 'Transformer';
  Last_Service_Date: string;
  Next_Service_Date: string;
  Frequency: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  Service_Provider: string;
  Estimated_Cost: number;
  Actual_Cost: number;
  Maintenance_Status: 'Scheduled' | 'Completed' | 'Overdue' | 'In Progress';
  Remarks: string;
  Attachment: string;
  Created_By: string;
  Created_At: string;
}

export interface RatePropertyMapping {
  Rate_Mapping_ID: string;
  RateID: string;
  PropertyID: string;
  Effective_From: string;
  Effective_To: string | null;
  Status: 'Active' | 'Inactive';
  Created_By: string;
  Created_At: string;
}

export interface PropertyUtilityDetails {
  Utility_ID: string;
  PropertyID: string;
  Utility_Type: 'WBSEDCL Electricity' | 'KMC Water' | 'Piped Gas' | 'Internet Broadband';
  Consumer_ID: string;
  Installation_No: string;
  Meter_No: string;
  Effective_From: string;
  Effective_To: string | null;
  Status: 'Active' | 'Disconnected';
  Remarks: string;
}

export interface AuditLog {
  Log_ID: string;
  UserID: string;
  User_Name?: string;
  Action_Type: 'CREATE' | 'UPDATE' | 'APPROVE' | 'CANCEL' | 'ALLOCATE' | 'LOGIN';
  Module_Name: string;
  Record_ID: string;
  Old_Value: string;
  New_Value: string;
  Action_DateTime: string;
  Remarks: string;
}

export interface FinancialYearMaster {
  FY_ID: string;
  FY_Name: string; // e.g. "FY 2026-2027"
  Start_Date: string;
  End_Date: string;
  FY_Status: 'Active' | 'Closed' | 'Upcoming';
  Is_Current: boolean;
  Created_At: string;
}

export interface TenantMaster {
  Tenant_ID: string;
  PropertyID: string;
  Ownership_ID: string;
  Tenant_Name: string;
  Mobile_No: string;
  Email_ID: string;
  Occupancy_Start_Date: string;
  Occupancy_End_Date: string | null;
  Emergency_Contact: string;
  Tenant_Document: string;
  Status: 'Active' | 'Notice Period' | 'Vacated';
  Remarks: string;
  Created_At: string;
}

export interface AccountHeadMaster {
  Account_ID: string;
  Account_Code: string;
  Account_Name: string;
  Account_Type: 'Asset' | 'Liability' | 'Income' | 'Expense';
  Parent_Account_ID: string | null;
  Opening_Balance: number;
  Balance_Type: 'Debit' | 'Credit';
  Status: 'Active' | 'Inactive';
  Remarks: string;
}
