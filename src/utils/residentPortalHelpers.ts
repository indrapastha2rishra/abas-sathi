/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ActivityRequestRegister,
  BillWiseDetails,
  FundInflowRegister,
  GalleryMaster,
  GalleryPhoto,
  InvoiceRegister,
  NoticeMaster,
  OwnerMaster,
  OwnershipHistory,
  PropertyMaster,
  PropertyUtilityDetails,
  TenantMaster,
} from '../types/database';
import { calculateResidentInvoiceMetrics } from './residentBilling';
import { buildActiveGalleryEvents, filterActiveNotices, type ActiveGalleryEvent } from './dashboardHelpers';
import { toReportAmount, toReportDateKey } from './reportHelpers';

export const normId = (value: unknown): string => String(value ?? '').trim().toUpperCase();
export const normText = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export interface ResidentScopeOptions {
  allowBlankOwnership?: boolean;
  requestedByUserId?: string;
}

export function filterResidentScopedRecords<
  T extends { PropertyID?: string | null; Ownership_ID?: string | null; Requested_By?: string | null }
>(
  rows: T[],
  propertyId?: string | null,
  ownershipId?: string | null,
  options: ResidentScopeOptions = {}
): T[] {
  const pid = normId(propertyId);
  if (!pid) return [];
  const oid = normId(ownershipId);
  const reqBy = normId(options.requestedByUserId);

  return (rows || []).filter((row) => {
    if (normId(row?.PropertyID) !== pid) return false;
    if (!oid) return true;
    const rowOid = normId(row?.Ownership_ID);
    if (!rowOid) return Boolean(options.allowBlankOwnership) || (Boolean(reqBy) && normId(row?.Requested_By) === reqBy);
    if (rowOid === oid) return true;
    if (reqBy && normId(row?.Requested_By) === reqBy) return true;
    return false;
  });
}

const RESTRICTED_VISIBILITIES = new Set([
  'committee',
  'committee only',
  'admin',
  'admin only',
  'staff',
  'staff only',
]);

const SHARED_RESIDENT_VISIBILITIES = new Set([
  '',
  'all',
  'public',
  'all residents',
  'residents only',
  'residents',
  'all owners',
  'all members',
]);

export interface ResidentVisibilityContext {
  isOwner?: boolean;
  isTenant?: boolean;
  propertyId?: string | null;
}

export function isResidentVisibleNotice(
  notice: Partial<NoticeMaster> & Record<string, any>,
  context: ResidentVisibilityContext = {}
): boolean {
  const vis = normText(notice?.Visibility);
  if (RESTRICTED_VISIBILITIES.has(vis)) return false;
  if (SHARED_RESIDENT_VISIBILITIES.has(vis)) return true;
  if (vis === 'owners only' || vis === 'owner only') {
    return context.isOwner !== false;
  }
  if (vis === 'tenants only' || vis === 'tenant only') {
    return Boolean(context.isTenant);
  }
  if (vis === 'selected properties' || vis === 'selected flats') {
    const pid = normId(context.propertyId);
    const targetRaw = String(
      notice?.Target_Properties || notice?.PropertyIDs || notice?.PropertyID || ''
    ).trim();
    if (!targetRaw) return true;
    if (!pid) return false;
    return targetRaw
      .split(/[,;|]+/)
      .map((s) => normId(s))
      .filter(Boolean)
      .includes(pid);
  }
  return false;
}

export function isResidentVisibleGallery(
  event: Partial<GalleryMaster> & Record<string, any>
): boolean {
  const vis = normText(event?.Visibility);
  if (RESTRICTED_VISIBILITIES.has(vis)) return false;
  if (SHARED_RESIDENT_VISIBILITIES.has(vis) || vis === 'owners only') return true;
  return true;
}

export function filterResidentNotices(
  notices: NoticeMaster[],
  todayKey: string,
  context: ResidentVisibilityContext = {}
): NoticeMaster[] {
  return filterActiveNotices(notices, todayKey).filter((n) => isResidentVisibleNotice(n, context));
}

export function filterResidentGalleryEvents(
  gallery: GalleryMaster[],
  galleryPhotos: GalleryPhoto[] = []
): ActiveGalleryEvent[] {
  const visibleGallery = (gallery || []).filter((g) => isResidentVisibleGallery(g));
  return buildActiveGalleryEvents(visibleGallery, galleryPhotos);
}

export function sortResidentInvoicesNewestFirst<T extends Partial<InvoiceRegister>>(invoices: T[]): T[] {
  return [...(invoices || [])].sort((a, b) => {
    const dateA =
      toReportDateKey(a.Billing_Date) ||
      toReportDateKey(a.Bill_Period_From) ||
      toReportDateKey(a.Created_At) ||
      toReportDateKey(a.Due_Date);
    const dateB =
      toReportDateKey(b.Billing_Date) ||
      toReportDateKey(b.Bill_Period_From) ||
      toReportDateKey(b.Created_At) ||
      toReportDateKey(b.Due_Date);
    const cmp = dateB.localeCompare(dateA);
    if (cmp !== 0) return cmp;
    return String(b.Invoice_Number || b.InvoiceID || '').localeCompare(
      String(a.Invoice_Number || a.InvoiceID || ''),
      undefined,
      { numeric: true, sensitivity: 'base' }
    );
  });
}

export function sortResidentReceiptsNewestFirst<T extends Partial<FundInflowRegister>>(receipts: T[]): T[] {
  return [...(receipts || [])].sort((a, b) => {
    const dateA = toReportDateKey(a.Date_Of_Received) || toReportDateKey(a.Created_At);
    const dateB = toReportDateKey(b.Date_Of_Received) || toReportDateKey(b.Created_At);
    const cmp = dateB.localeCompare(dateA);
    if (cmp !== 0) return cmp;
    return String(b.Receipt_Number || b.Transaction_ID || '').localeCompare(
      String(a.Receipt_Number || a.Transaction_ID || ''),
      undefined,
      { numeric: true, sensitivity: 'base' }
    );
  });
}

export function sortActivityRequestsNewestFirst<T extends Partial<ActivityRequestRegister>>(requests: T[]): T[] {
  return [...(requests || [])].sort((a, b) => {
    const dateA = toReportDateKey(a.Request_Date) || toReportDateKey(a.Created_At);
    const dateB = toReportDateKey(b.Request_Date) || toReportDateKey(b.Created_At);
    const cmp = dateB.localeCompare(dateA);
    if (cmp !== 0) return cmp;
    return String(b.Request_Number || b.Request_ID || '').localeCompare(
      String(a.Request_Number || a.Request_ID || ''),
      undefined,
      { numeric: true, sensitivity: 'base' }
    );
  });
}

export function summarizeResidentPortalData(params: {
  property: PropertyMaster | null;
  ownershipId?: string | null;
  userId?: string | null;
  invoices: InvoiceRegister[];
  receipts: FundInflowRegister[];
  billAllocations: BillWiseDetails[];
  activityRequests: ActivityRequestRegister[];
  ownerships: OwnershipHistory[];
  owners: OwnerMaster[];
  tenants: TenantMaster[];
  propertyUtilities: PropertyUtilityDetails[];
  notices: NoticeMaster[];
  gallery: GalleryMaster[];
  galleryPhotos: GalleryPhoto[];
  now?: Date;
}) {
  const now = params.now || new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const pid = params.property?.PropertyID || null;

  const propertyOwnerships = (params.ownerships || []).filter((o) => normId(o.PropertyID) === normId(pid));
  const currentOwnership =
    (params.ownershipId
      ? propertyOwnerships.find((o) => normId(o.Ownership_ID) === normId(params.ownershipId))
      : undefined) ||
    propertyOwnerships.find((o) => normText(o.Ownership_Status) === 'current') ||
    propertyOwnerships[0] ||
    null;

  const effectiveOwnershipId = params.ownershipId || currentOwnership?.Ownership_ID || null;
  const currentOwner = currentOwnership
    ? (params.owners || []).find((o) => normId(o.OwnerID) === normId(currentOwnership.OwnerID)) || null
    : null;

  const myInvoicesRaw = filterResidentScopedRecords(params.invoices, pid, effectiveOwnershipId);
  const myReceiptsRaw = filterResidentScopedRecords(params.receipts, pid, effectiveOwnershipId);
  const myAllocations = filterResidentScopedRecords(params.billAllocations, pid, effectiveOwnershipId);
  const myRequestsRaw = filterResidentScopedRecords(params.activityRequests, pid, effectiveOwnershipId, {
    allowBlankOwnership: true,
    requestedByUserId: params.userId || undefined,
  });

  const billMetrics = sortResidentInvoicesNewestFirst(
    calculateResidentInvoiceMetrics(myInvoicesRaw, myReceiptsRaw, myAllocations, now)
  );
  const sortedReceipts = sortResidentReceiptsNewestFirst(myReceiptsRaw);
  const sortedRequests = sortActivityRequestsNewestFirst(myRequestsRaw);

  const totalBilled = Math.round(billMetrics.reduce((s, i) => s + Math.max(0, toReportAmount(i.Net_Charge_Amount)), 0) * 100) / 100;
  const totalPaidAgainstBills = Math.round(billMetrics.reduce((s, i) => s + Math.max(0, toReportAmount(i.Paid_Amount)), 0) * 100) / 100;
  const totalOutstanding = Math.round(billMetrics.reduce((s, i) => s + Math.max(0, toReportAmount(i.Outstanding_Amount)), 0) * 100) / 100;

  const unpaidMetrics = billMetrics.filter((i) => toReportAmount(i.Outstanding_Amount) > 0);
  const earliestUnpaid = [...unpaidMetrics].sort((a, b) =>
    (toReportDateKey(a.Due_Date) || '9999-12-31').localeCompare(toReportDateKey(b.Due_Date) || '9999-12-31')
  )[0];

  const confirmedReceipts = sortedReceipts.filter((r) => normText(r.Receipt_Status) === 'confirmed');
  const pendingReceipts = sortedReceipts.filter((r) => normText(r.Receipt_Status) === 'pending verification');
  const confirmedReceivedTotal = Math.round(
    confirmedReceipts.reduce((s, r) => s + Math.max(0, toReportAmount(r.Received_Amount)), 0) * 100
  ) / 100;
  const pendingVerificationAmount = Math.round(
    pendingReceipts.reduce((s, r) => s + Math.max(0, toReportAmount(r.Received_Amount)), 0) * 100
  ) / 100;
  const advanceCreditTotal = Math.round(
    confirmedReceipts.reduce((s, r) => s + Math.max(0, toReportAmount(r.Unallocated_Amount)), 0) * 100
  ) / 100;

  const activeTenants = filterResidentScopedRecords(params.tenants || [], pid, effectiveOwnershipId, {
    allowBlankOwnership: true,
  }).filter((t) => {
    const st = normText(t.Status);
    return !st || st === 'active' || st === 'notice period';
  });

  const activeUtilities = (params.propertyUtilities || []).filter((u) => normId(u.PropertyID) === normId(pid));

  const visibilityContext: ResidentVisibilityContext = {
    isOwner: Boolean(currentOwnership) || activeTenants.length === 0,
    isTenant: activeTenants.length > 0,
    propertyId: pid,
  };
  const activeNotices = filterResidentNotices(params.notices, todayKey, visibilityContext);
  const activeGalleryEvents = filterResidentGalleryEvents(params.gallery, params.galleryPhotos);

  const pendingReqCount = sortedRequests.filter((r) => normText(r.Request_Status) === 'pending').length;
  const inProgressReqCount = sortedRequests.filter((r) => normText(r.Request_Status) === 'in progress').length;
  const completedReqCount = sortedRequests.filter((r) => normText(r.Request_Status) === 'completed').length;
  const openReqCount = pendingReqCount + inProgressReqCount;

  return {
    todayKey,
    currentOwnership,
    currentOwner,
    propertyOwnerships,
    billMetrics,
    sortedReceipts,
    myAllocations,
    sortedRequests,
    activeTenants,
    activeUtilities,
    activeNotices,
    activeGalleryEvents,
    totalBilled,
    totalPaidAgainstBills,
    totalOutstanding,
    nextDueDate: earliestUnpaid?.Due_Date || '',
    paidBillCount: billMetrics.filter((i) => i.Invoice_Status === 'Paid').length,
    unpaidOrPartialCount: unpaidMetrics.length,
    overdueCount: billMetrics.filter((i) => i.Invoice_Status === 'Overdue').length,
    confirmedReceiptsCount: confirmedReceipts.length,
    confirmedReceivedTotal,
    pendingVerificationCount: pendingReceipts.length,
    pendingVerificationAmount,
    advanceCreditTotal,
    pendingReqCount,
    inProgressReqCount,
    completedReqCount,
    openReqCount,
  };
}

export interface ResidentStatementRow {
  id: string;
  date: string;
  refNo: string;
  entryType: 'Invoice' | 'Receipt (Confirmed)' | 'Receipt (Pending)' | 'Receipt (Reversed)';
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  status: string;
}

export function buildResidentStatementLedger(
  invoices: InvoiceRegister[],
  receipts: FundInflowRegister[],
  options: { fromDate?: string; toDate?: string } = {}
) {
  const excludedInv = new Set(['cancelled', 'draft', 'pending_approval', 'pending approval']);
  const events: Array<Omit<ResidentStatementRow, 'runningBalance'> & { sortOrder: number }> = [];

  (invoices || []).forEach((inv) => {
    if (excludedInv.has(normText(inv.Invoice_Status))) return;
    const date = toReportDateKey(inv.Billing_Date) || toReportDateKey(inv.Bill_Period_From) || toReportDateKey(inv.Created_At);
    const amount = Math.max(0, toReportAmount(inv.Net_Charge_Amount));
    events.push({
      id: `INV:${inv.InvoiceID || inv.Invoice_Number}`,
      date,
      refNo: String(inv.Invoice_Number || inv.InvoiceID || ''),
      entryType: 'Invoice',
      description: String(inv.Purpose || inv.Invoice_Description || 'Maintenance Bill'),
      debit: amount,
      credit: 0,
      status: String(inv.Invoice_Status || 'Unpaid'),
      sortOrder: 0,
    });
  });

  (receipts || []).forEach((rec) => {
    const statusLower = normText(rec.Receipt_Status);
    const isConfirmed = statusLower === 'confirmed';
    const isPending = statusLower === 'pending verification';
    const date = toReportDateKey(rec.Date_Of_Received) || toReportDateKey(rec.Created_At);
    const amount = Math.max(0, toReportAmount(rec.Received_Amount));
    events.push({
      id: `REC:${rec.Transaction_ID || rec.Receipt_Number}`,
      date,
      refNo: String(rec.Receipt_Number || rec.Transaction_ID || ''),
      entryType: isConfirmed
        ? 'Receipt (Confirmed)'
        : isPending
        ? 'Receipt (Pending)'
        : 'Receipt (Reversed)',
      description: `${rec.Received_Mode || 'Payment'}${rec.Received_Reference ? ` (${rec.Received_Reference})` : ''}`,
      debit: 0,
      credit: isConfirmed ? amount : 0,
      status: String(rec.Receipt_Status || ''),
      sortOrder: 1,
    });
  });

  events.sort((a, b) => {
    const cmp = (a.date || '').localeCompare(b.date || '');
    if (cmp !== 0) return cmp;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.refNo.localeCompare(b.refNo, undefined, { numeric: true, sensitivity: 'base' });
  });

  let runningBalance = 0;
  let openingBalance = 0;
  const fromKey = toReportDateKey(options.fromDate);
  const toKey = toReportDateKey(options.toDate);
  const rows: ResidentStatementRow[] = [];

  events.forEach((ev) => {
    const nextBalance = Math.round((runningBalance + ev.debit - ev.credit) * 100) / 100;
    if (fromKey && ev.date && ev.date < fromKey) {
      openingBalance = nextBalance;
      runningBalance = nextBalance;
      return;
    }
    if (toKey && ev.date && ev.date > toKey) {
      runningBalance = nextBalance;
      return;
    }
    runningBalance = nextBalance;
    rows.push({
      id: ev.id,
      date: ev.date,
      refNo: ev.refNo,
      entryType: ev.entryType,
      description: ev.description,
      debit: ev.debit,
      credit: ev.credit,
      runningBalance,
      status: ev.status,
    });
  });

  const periodDebit = Math.round(rows.reduce((s, r) => s + r.debit, 0) * 100) / 100;
  const periodCredit = Math.round(rows.reduce((s, r) => s + r.credit, 0) * 100) / 100;
  const closingBalance = rows.length > 0 ? rows[rows.length - 1].runningBalance : openingBalance;

  return {
    rows,
    openingBalance,
    periodDebit,
    periodCredit,
    closingBalance,
  };
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toResidentStatementCsv(rows: ResidentStatementRow[]): string {
  const header = ['Date', 'Reference No', 'Type', 'Description', 'Billed (Debit)', 'Confirmed Paid (Credit)', 'Balance', 'Status'];
  const lines = [
    header.map(escapeCsvCell).join(','),
    ...(rows || []).map((r) =>
      [
        r.date,
        r.refNo,
        r.entryType,
        r.description,
        r.debit.toFixed(2),
        r.credit.toFixed(2),
        r.runningBalance.toFixed(2),
        r.status,
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];
  return lines.join('\r\n');
}
