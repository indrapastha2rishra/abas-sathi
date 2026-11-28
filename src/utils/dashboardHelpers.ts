/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BankAccountMaster,
  BillWiseDetails,
  ExpenseRegister,
  FinancialYearMaster,
  FundInflowRegister,
  GalleryMaster,
  GalleryPhoto,
  InvoiceRegister,
  NoticeMaster,
  RateMaster,
} from '../types/database';
import { calculateFundSummary, summarizePaidExpenses, type FundSummaryData } from './calculations';
import {
  computeInvoiceOutstandingBills,
  isConfirmedReceipt,
  isExcludedAllocationStatus,
  isExcludedInvoiceStatus,
  roundMoney,
  toInvoiceAmount,
  type ComputedInvoiceOutstanding,
} from './invoiceOutstanding';
import { computeConfirmedInvoiceMetrics, resolveFYRangeForMonth, toReportAmount, toReportDateKey } from './reportHelpers';

export interface OwnershipOutstandingRowLike {
  Ownership_ID?: string;
  Flat_No?: string;
  PropertyID?: string;
  Ownership_Start_Date?: string;
  [key: string]: unknown;
}

export interface DashboardDonutSegment {
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue';
  color: string;
  count: number;
  length: number;
  offset: number;
}

export interface DashboardInvoiceSummary {
  issuedInvoices: ComputedInvoiceOutstanding[];
  outstandingRows: ComputedInvoiceOutstanding[];
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  fyBilled: number;
  fyCollected: number;
  fyOutstanding: number;
  collectionRate: string;
  maintenanceBilled: number;
  maintenanceCollected: number;
  maintenanceOutstanding: number;
  maintenanceCollectionRate: string;
  maintenanceInvoiceCount: number;
  maintenanceIssuedInvoices: ComputedInvoiceOutstanding[];
  maintenancePaidCount: number;
  maintenancePartialCount: number;
  maintenanceUnpaidCount: number;
  maintenanceOverdueCount: number;
  maintenanceDonutSegments: DashboardDonutSegment[];
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  overdueCount: number;
  donutSegments: DashboardDonutSegment[];
}

export const DASHBOARD_DONUT_CIRCUMFERENCE = 2 * Math.PI * 38;

const NON_MAINTENANCE_PURPOSE_RE = /\b(sinking\s*fund|parking|electricity|water\s*charges?|repair\s*levy|corpus)\b/i;
const MAINTENANCE_PURPOSE_RE = /(maintenance|রক্ষণাবেক্ষণ|\bcam\b)/i;

function buildRateMap(rates: RateMaster[] = []): Map<string, RateMaster> {
  const rateById = new Map<string, RateMaster>();
  (rates || []).forEach((r) => {
    const id = String(r.RateID || '').trim();
    if (id) {
      rateById.set(id, r);
      rateById.set(id.toUpperCase(), r);
    }
  });
  return rateById;
}

function buildStatusDonutSegments(rows: ComputedInvoiceOutstanding[]) {
  const paidCount = rows.filter((i) => i.Invoice_Status === 'Paid').length;
  const partialCount = rows.filter((i) => i.Invoice_Status === 'Partially Paid').length;
  const unpaidCount = rows.filter((i) => i.Invoice_Status === 'Unpaid').length;
  const overdueCount = rows.filter((i) => i.Invoice_Status === 'Overdue').length;

  const denominator = rows.length || 1;
  const rawSegments: Array<{ status: DashboardDonutSegment['status']; color: string; count: number }> = [
    { status: 'Paid', color: '#536B4D', count: paidCount },
    { status: 'Partially Paid', color: '#3B82F6', count: partialCount },
    { status: 'Unpaid', color: '#F59E0B', count: unpaidCount },
    { status: 'Overdue', color: '#C97958', count: overdueCount },
  ];

  let cumulativeOffset = 0;
  const donutSegments: DashboardDonutSegment[] = rawSegments.map((seg) => {
    const length = (seg.count / denominator) * DASHBOARD_DONUT_CIRCUMFERENCE;
    const segment: DashboardDonutSegment = {
      ...seg,
      length,
      offset: cumulativeOffset === 0 ? 0 : -cumulativeOffset,
    };
    cumulativeOffset += length;
    return segment;
  });

  return {
    paidCount,
    partialCount,
    unpaidCount,
    overdueCount,
    donutSegments,
  };
}

export function isMaintenanceInvoice(
  invoice: Partial<InvoiceRegister>,
  rateById?: Map<string, RateMaster>
): boolean {
  const rateKey = String(invoice.RateID || '').trim();
  const rate =
    rateKey && rateById
      ? rateById.get(rateKey) || rateById.get(rateKey.toUpperCase())
      : undefined;
  const purpose = String(invoice.Purpose || rate?.Purpose || '').trim();
  if (purpose) {
    if (MAINTENANCE_PURPOSE_RE.test(purpose)) return true;
    if (NON_MAINTENANCE_PURPOSE_RE.test(purpose)) return false;
    return false;
  }
  const desc = String(invoice.Invoice_Description || rate?.Remarks || '').trim();
  return MAINTENANCE_PURPOSE_RE.test(desc) && !NON_MAINTENANCE_PURPOSE_RE.test(desc);
}

export function invoiceMatchesBillingPeriod(
  invoice: Partial<InvoiceRegister>,
  periodStart?: string,
  periodEnd?: string
): boolean {
  const start = periodStart ? toReportDateKey(periodStart) : '';
  const end = periodEnd ? toReportDateKey(periodEnd) : '';
  if (!start && !end) return true;

  const billFrom = toReportDateKey(invoice.Bill_Period_From);
  const billTo = toReportDateKey(invoice.Bill_Period_To);
  if (billFrom || billTo) {
    const effFrom = billFrom || billTo;
    const effTo = billTo || billFrom;
    if (start && effTo < start) return false;
    if (end && effFrom > end) return false;
    return true;
  }

  const billingDate = toReportDateKey(invoice.Billing_Date);
  if (!billingDate) return false;
  if (start && billingDate < start) return false;
  if (end && billingDate > end) return false;
  return true;
}

export function computeMaintenanceCollectionRate(params: {
  invoices: InvoiceRegister[];
  receipts: FundInflowRegister[];
  billAllocations: BillWiseDetails[];
  rates?: RateMaster[];
  periodStart?: string;
  periodEnd?: string;
  now?: Date;
  computedInvoices?: ComputedInvoiceOutstanding[];
}): {
  maintenanceBilled: number;
  maintenanceCollected: number;
  maintenanceOutstanding: number;
  maintenanceCollectionRate: string;
  maintenanceInvoiceCount: number;
  maintenanceIssuedInvoices: ComputedInvoiceOutstanding[];
} {
  const { invoices, receipts, billAllocations, rates = [], periodStart, periodEnd, now = new Date(), computedInvoices } = params;
  const rateById = buildRateMap(rates);

  const computed = computedInvoices || computeInvoiceOutstandingBills(invoices, billAllocations, receipts, now);
  const maintenanceInvoices = computed.filter((inv) => {
    if (isExcludedInvoiceStatus(inv.Invoice_Status)) return false;
    if (!isMaintenanceInvoice(inv, rateById)) return false;
    return invoiceMatchesBillingPeriod(inv, periodStart, periodEnd);
  });

  const maintenanceBilled = roundMoney(maintenanceInvoices.reduce((sum, inv) => sum + inv.Net_Charge_Amount, 0));
  const maintenanceCollected = roundMoney(
    maintenanceInvoices.reduce((sum, inv) => sum + inv.Paid_Amount, 0)
  );
  const maintenanceOutstanding = roundMoney(
    maintenanceInvoices.reduce((sum, inv) => sum + inv.Calculated_Outstanding, 0)
  );
  const maintenanceCollectionRate =
    maintenanceBilled > 0 ? ((maintenanceCollected / maintenanceBilled) * 100).toFixed(1) : '0';

  return {
    maintenanceBilled,
    maintenanceCollected,
    maintenanceOutstanding,
    maintenanceCollectionRate,
    maintenanceInvoiceCount: maintenanceInvoices.length,
    maintenanceIssuedInvoices: maintenanceInvoices,
  };
}

export function computeDashboardInvoiceSummary(params: {
  invoices: InvoiceRegister[];
  receipts: FundInflowRegister[];
  billAllocations: BillWiseDetails[];
  rates?: RateMaster[];
  periodStart?: string;
  periodEnd?: string;
  now?: Date;
}): DashboardInvoiceSummary {
  const { invoices, receipts, billAllocations, rates = [], periodStart, periodEnd, now = new Date() } = params;
  const computed = computeInvoiceOutstandingBills(invoices, billAllocations, receipts, now);
  const issuedInvoices = computed.filter((inv) => !isExcludedInvoiceStatus(inv.Invoice_Status));

  const totalBilled = roundMoney(issuedInvoices.reduce((sum, inv) => sum + inv.Net_Charge_Amount, 0));
  const totalCollected = roundMoney(issuedInvoices.reduce((sum, inv) => sum + inv.Paid_Amount, 0));
  const totalOutstanding = roundMoney(issuedInvoices.reduce((sum, inv) => sum + inv.Calculated_Outstanding, 0));
  const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : '0';

  const fyStartKey = periodStart ? toReportDateKey(periodStart) : '';
  const fyEndKey = periodEnd ? toReportDateKey(periodEnd) : '';
  const fyIssuedInvoices = issuedInvoices.filter((inv) => {
    if (!fyStartKey && !fyEndKey) return true;
    const dateKey = toReportDateKey(inv.Billing_Date) || toReportDateKey(inv.Bill_Period_From);
    if (!dateKey) return false;
    if (fyStartKey && dateKey < fyStartKey) return false;
    if (fyEndKey && dateKey > fyEndKey) return false;
    return true;
  });
  const fyBilled = Math.round(fyIssuedInvoices.reduce((sum, inv) => sum + inv.Net_Charge_Amount, 0) * 100) / 100;
  const fyCollected =
    Math.round(
      fyIssuedInvoices.reduce(
        (sum, inv) => sum + Math.min(inv.Net_Charge_Amount, Math.max(0, inv.Allocated_Amount_Total)),
        0
      ) * 100
    ) / 100;
  const fyOutstanding =
    Math.round(fyIssuedInvoices.reduce((sum, inv) => sum + inv.Calculated_Outstanding, 0) * 100) / 100;

  const maintenanceMetrics = computeMaintenanceCollectionRate({
    invoices,
    receipts,
    billAllocations,
    rates,
    periodStart,
    periodEnd,
    now,
    computedInvoices: computed,
  });

  const overallDonut = buildStatusDonutSegments(issuedInvoices);
  const maintenanceDonut = buildStatusDonutSegments(maintenanceMetrics.maintenanceIssuedInvoices);

  const outstandingRows = issuedInvoices
    .filter((inv) => inv.Calculated_Outstanding > 0)
    .sort((a, b) => toReportDateKey(a.Due_Date).localeCompare(toReportDateKey(b.Due_Date)));

  return {
    issuedInvoices,
    outstandingRows,
    totalBilled,
    totalCollected,
    totalOutstanding,
    fyBilled,
    fyCollected,
    fyOutstanding,
    collectionRate,
    ...maintenanceMetrics,
    maintenancePaidCount: maintenanceDonut.paidCount,
    maintenancePartialCount: maintenanceDonut.partialCount,
    maintenanceUnpaidCount: maintenanceDonut.unpaidCount,
    maintenanceOverdueCount: maintenanceDonut.overdueCount,
    maintenanceDonutSegments: maintenanceDonut.donutSegments,
    paidCount: overallDonut.paidCount,
    partialCount: overallDonut.partialCount,
    unpaidCount: overallDonut.unpaidCount,
    overdueCount: overallDonut.overdueCount,
    donutSegments: overallDonut.donutSegments,
  };
}

export interface DashboardFYInfo {
  fyId: string;
  fyName: string;
  startDate: string;
  endDate: string;
}

export function resolveDashboardFY(params: {
  todayKey: string;
  financialYears?: FinancialYearMaster[];
  serverFy?: Partial<FinancialYearMaster> | null;
}): DashboardFYInfo {
  const { todayKey, financialYears = [], serverFy } = params;
  const serverStart = serverFy ? toReportDateKey(serverFy.Start_Date) : '';
  const serverEnd = serverFy ? toReportDateKey(serverFy.End_Date) : '';
  if (serverFy && serverStart && serverEnd) {
    return {
      fyId: String(serverFy.FY_ID || ''),
      fyName: String(serverFy.FY_Name || `FY ${serverStart.slice(0, 4)}-${serverEnd.slice(0, 4)}`),
      startDate: serverStart,
      endDate: serverEnd,
    };
  }

  const currentFlag = (financialYears || []).find((fy) => {
    const start = toReportDateKey(fy.Start_Date);
    const end = toReportDateKey(fy.End_Date);
    return start && end && todayKey >= start && todayKey <= end;
  }) || (financialYears || []).find((fy) => String(fy.Is_Current).trim().toLowerCase() === 'true');

  if (currentFlag) {
    const start = toReportDateKey(currentFlag.Start_Date);
    const end = toReportDateKey(currentFlag.End_Date);
    if (start && end) {
      return {
        fyId: String(currentFlag.FY_ID || ''),
        fyName: String(currentFlag.FY_Name || `FY ${start.slice(0, 4)}-${end.slice(0, 4)}`),
        startDate: start,
        endDate: end,
      };
    }
  }

  return resolveFYRangeForMonth(todayKey.slice(0, 7), financialYears);
}

/**
 * Calculates total Outstanding Collection directly as:
 *   total 'Invoice Register' (issued Net_Charge_Amount) − total 'Bill Wise Details' (Allocated_Amount)
 * Not restricted to any single Financial Year.
 */
export function computeTotalOutstandingCollection(params: {
  invoices: InvoiceRegister[];
  billAllocations: BillWiseDetails[];
  receipts?: FundInflowRegister[];
}): {
  totalInvoiceRegister: number;
  totalBillWiseDetails: number;
  outstandingCollection: number;
} {
  const { invoices, billAllocations, receipts = [] } = params;
  const receiptStatusByTxnId = new Map<string, string>();
  (receipts || []).forEach((rec) => {
    const txnId = String(rec.Transaction_ID || '').trim().toUpperCase();
    if (!txnId) return;
    receiptStatusByTxnId.set(txnId, String(rec.Receipt_Status || (rec as any).Status || '').trim().toLowerCase());
  });

  const totalInvoiceRegister = roundMoney(
    (invoices || [])
      .filter((inv) => !isExcludedInvoiceStatus(inv.Invoice_Status))
      .reduce((sum, inv) => sum + Math.max(0, toInvoiceAmount(inv.Net_Charge_Amount)), 0)
  );

  const totalBillWiseDetails = roundMoney(
    (billAllocations || [])
      .filter((row) => {
        if (isExcludedAllocationStatus(row as any)) return false;
        const txnId = String(row.Transaction_ID || '').trim().toUpperCase();
        if (txnId && receiptStatusByTxnId.has(txnId)) {
          return receiptStatusByTxnId.get(txnId) === 'confirmed';
        }
        return true;
      })
      .reduce((sum, row) => sum + Math.max(0, toInvoiceAmount(row.Allocated_Amount)), 0)
  );

  const outstandingCollection = Math.max(0, roundMoney(totalInvoiceRegister - totalBillWiseDetails));
  return {
    totalInvoiceRegister,
    totalBillWiseDetails,
    outstandingCollection,
  };
}

export function computeDashboardFundSummary(params: {
  fyRange: DashboardFYInfo;
  fundBalanceSummary?: {
    openingFundBalance?: number;
    totalFundReceived?: number;
    totalFundUtilized?: number;
  } | null;
  receipts: FundInflowRegister[];
  expenses: ExpenseRegister[];
  invoices: InvoiceRegister[];
  billAllocations?: BillWiseDetails[];
  bankAccounts: BankAccountMaster[];
  totalOutstanding?: number;
}): FundSummaryData {
  const { fyRange, fundBalanceSummary, receipts, expenses, invoices, billAllocations, bankAccounts, totalOutstanding } = params;
  const hasServerOpening = typeof fundBalanceSummary?.openingFundBalance === 'number';
  const openingBalanceTotal = hasServerOpening
    ? roundMoney(toReportAmount(fundBalanceSummary?.openingFundBalance))
    : roundMoney((bankAccounts || []).reduce((sum, b) => sum + toReportAmount(b.Opening_Balance), 0));

  const summary = calculateFundSummary({
    openingBalance: openingBalanceTotal,
    receipts,
    expenses,
    invoices,
    startDate: fyRange.startDate,
    endDate: fyRange.endDate,
  });

  if (fundBalanceSummary) {
    if ((receipts || []).length === 0 && typeof fundBalanceSummary.totalFundReceived === 'number') {
      summary.totalFundReceived = roundMoney(toReportAmount(fundBalanceSummary.totalFundReceived));
    }
    if ((expenses || []).length === 0 && typeof fundBalanceSummary.totalFundUtilized === 'number') {
      summary.totalFundUtilized = roundMoney(toReportAmount(fundBalanceSummary.totalFundUtilized));
    }
  }

  summary.availableFund = roundMoney(
    summary.openingFundBalance + summary.totalFundReceived - summary.totalFundUtilized
  );

  if (typeof totalOutstanding === 'number' && Number.isFinite(totalOutstanding)) {
    summary.outstandingCollection = roundMoney(totalOutstanding);
  } else if (Array.isArray(billAllocations)) {
    summary.outstandingCollection = computeTotalOutstandingCollection({
      invoices,
      billAllocations,
      receipts,
    }).outstandingCollection;
  }
  return summary;
}

export function computeMonthlyReceiptPaymentSummary(params: {
  selectedMonth: string;
  fyStartDate?: string;
  openingFYBalance: number;
  receipts: FundInflowRegister[];
  expenses: ExpenseRegister[];
}) {
  const { selectedMonth, fyStartDate, openingFYBalance, receipts, expenses } = params;
  const monthStartKey = `${selectedMonth}-01`;
  const confirmedReceipts = (receipts || []).filter((r) => isConfirmedReceipt(r as any));
  const monthReceipts = confirmedReceipts.filter((r) =>
    toReportDateKey(r.Date_Of_Received).startsWith(selectedMonth)
  );

  const monthPaid = summarizePaidExpenses(
    expenses || [],
    monthStartKey,
    `${selectedMonth}-31`
  );
  // Also match exact YYYY-MM prefix for safety
  const monthExpenses = (expenses || []).filter(
    (e) =>
      String(e.Expense_Status || (e as any).Status || '').trim().toLowerCase() === 'paid' &&
      toReportDateKey(e.Payment_Date).startsWith(selectedMonth)
  );
  void monthPaid;

  const totalMonthInflow = roundMoney(
    monthReceipts.reduce((sum, r) => sum + Math.max(0, toReportAmount(r.Received_Amount)), 0)
  );
  const totalMonthOutflow = roundMoney(
    monthExpenses.reduce((sum, e) => sum + Math.max(0, toReportAmount(e.Payment_Amount)), 0)
  );

  const fyStart = fyStartDate ? toReportDateKey(fyStartDate) : '';
  let priorIn = 0;
  let priorOut = 0;
  if (fyStart && monthStartKey > fyStart) {
    priorIn = roundMoney(
      confirmedReceipts
        .filter((r) => {
          const d = toReportDateKey(r.Date_Of_Received);
          return d >= fyStart && d < monthStartKey;
        })
        .reduce((s, r) => s + Math.max(0, toReportAmount(r.Received_Amount)), 0)
    );
    priorOut = roundMoney(
      (expenses || [])
        .filter((e) => String(e.Expense_Status || (e as any).Status || '').trim().toLowerCase() === 'paid')
        .filter((e) => {
          const d = toReportDateKey(e.Payment_Date);
          return d >= fyStart && d < monthStartKey;
        })
        .reduce((s, e) => s + Math.max(0, toReportAmount(e.Payment_Amount)), 0)
    );
  }

  const openingAtMonthStart = roundMoney(toReportAmount(openingFYBalance) + priorIn - priorOut);
  const closingAtMonthEnd = roundMoney(openingAtMonthStart + totalMonthInflow - totalMonthOutflow);

  return {
    monthReceipts,
    monthExpenses,
    totalMonthInflow,
    totalMonthOutflow,
    openingAtMonthStart,
    closingAtMonthEnd,
  };
}

export function computeFinancialYearSummary(params: {
  fyName: string;
  startDate: string;
  endDate: string;
  openingFundBalance: number;
  openingSource?: string;
  invoices: InvoiceRegister[];
  receipts: FundInflowRegister[];
  billAllocations: BillWiseDetails[];
  expenses: ExpenseRegister[];
  rates?: RateMaster[];
  now?: Date;
}) {
  const {
    fyName,
    startDate,
    endDate,
    openingFundBalance,
    openingSource = 'Fund Balance Register',
    invoices,
    receipts,
    billAllocations,
    expenses,
    rates = [],
    now = new Date(),
  } = params;

  const from = toReportDateKey(startDate);
  const to = toReportDateKey(endDate);

  const fyInv = computeConfirmedInvoiceMetrics(invoices, receipts, billAllocations, now).filter(({ inv }) => {
    const d = toReportDateKey(inv.Billing_Date) || toReportDateKey(inv.Bill_Period_From);
    return d && (!from || d >= from) && (!to || d <= to);
  });
  const fyRec = (receipts || []).filter((r) => {
    if (!isConfirmedReceipt(r as any)) return false;
    const d = toReportDateKey(r.Date_Of_Received);
    return d && (!from || d >= from) && (!to || d <= to);
  });
  const { count: expenseCount, total: paidTotal } = summarizePaidExpenses(expenses || [], from, to);

  const normalizedOpening = roundMoney(toReportAmount(openingFundBalance));
  const billed = roundMoney(fyInv.reduce((s, x) => s + x.net, 0));
  const receiptsTotal = roundMoney(fyRec.reduce((s, r) => s + Math.max(0, toReportAmount(r.Received_Amount)), 0));
  const outstanding = roundMoney(fyInv.reduce((s, x) => s + x.due, 0));
  const maintRateInfo = computeMaintenanceCollectionRate({
    invoices,
    receipts,
    billAllocations,
    rates,
    periodStart: from,
    periodEnd: to,
    now,
  });

  return {
    fyName,
    openingFundBalance: normalizedOpening,
    openingSource,
    closingFundBalance: roundMoney(normalizedOpening + receiptsTotal - paidTotal),
    invoiceCount: fyInv.length,
    receiptCount: fyRec.length,
    expenseCount,
    billed,
    receipts: receiptsTotal,
    paidExpenses: paidTotal,
    outstanding,
    maintenanceBilled: maintRateInfo.maintenanceBilled,
    maintenanceCollected: maintRateInfo.maintenanceCollected,
    maintenanceCollectionRate: maintRateInfo.maintenanceCollectionRate,
  };
}

export function sortOwnershipOutstandingByFlatAsc<T extends OwnershipOutstandingRowLike>(rows: T[]): T[] {
  return [...(rows || [])].sort((a, b) => {
    const flatA = String(a.Flat_No || a.PropertyID || '').trim();
    const flatB = String(b.Flat_No || b.PropertyID || '').trim();
    const flatCmp = flatA.localeCompare(flatB, undefined, { numeric: true, sensitivity: 'base' });
    if (flatCmp !== 0) return flatCmp;
    const dateA = toReportDateKey(a.Ownership_Start_Date);
    const dateB = toReportDateKey(b.Ownership_Start_Date);
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return String(a.Ownership_ID || '').localeCompare(String(b.Ownership_ID || ''));
  });
}

export function filterActiveNotices(notices: NoticeMaster[], todayKey: string): NoticeMaster[] {
  return (notices || [])
    .filter((notice) => {
      const status = String(notice.Notice_Status || (notice as any).Status || '').trim().toLowerCase();
      const isActiveStatus = status === 'published' || status === 'active';
      if (!isActiveStatus) return false;
      const publish = toReportDateKey(notice.Publish_Date);
      const expiry = toReportDateKey(notice.Expiry_Date);
      return (!publish || publish <= todayKey) && (!expiry || expiry >= todayKey);
    })
    .sort((a, b) => toReportDateKey(b.Publish_Date).localeCompare(toReportDateKey(a.Publish_Date)));
}

export interface ActiveGalleryPhotoItem {
  photoId: string;
  ref: string;
  caption: string;
}

export interface ActiveGalleryEvent {
  event: GalleryMaster;
  photos: ActiveGalleryPhotoItem[];
}

export function extractPhotoReference(row: Record<string, any> | null | undefined): string {
  if (!row) return '';
  return String(
    row.Photo_File_Reference ||
      row.Photo_URL ||
      row.Image_URL ||
      row.Photo_File_ID ||
      row.Image_File_ID ||
      row.File_Reference ||
      row.Photo ||
      ''
  ).trim();
}

export function buildActiveGalleryEvents(
  gallery: GalleryMaster[],
  galleryPhotos: GalleryPhoto[] = []
): ActiveGalleryEvent[] {
  const photosByGalleryId = new Map<string, GalleryPhoto[]>();

  (galleryPhotos || []).forEach((photo) => {
    const gid = String(photo.Gallery_ID || '').trim();
    if (!gid) return;
    const status = String(photo.Status || '').trim().toLowerCase();
    if (status === 'inactive' || status === 'archived' || status === 'deleted') return;
    const ref = extractPhotoReference(photo as any);
    if (!ref) return;
    const existing = photosByGalleryId.get(gid) || [];
    existing.push(photo);
    photosByGalleryId.set(gid, existing);
  });

  return (gallery || [])
    .filter((item) => {
      const status = String(item.Status || '').trim().toLowerCase();
      return !status || status === 'active' || status === 'published';
    })
    .sort((a, b) => toReportDateKey(b.Event_Date).localeCompare(toReportDateKey(a.Event_Date)))
    .map((event) => {
      const gid = String(event.Gallery_ID || '').trim();
      const linkedRows = [...(photosByGalleryId.get(gid) || [])].sort((a, b) => {
        const orderA = Number(a.Display_Order ?? Number.MAX_SAFE_INTEGER);
        const orderB = Number(b.Display_Order ?? Number.MAX_SAFE_INTEGER);
        if (Number.isFinite(orderA) && Number.isFinite(orderB) && orderA !== orderB) {
          return orderA - orderB;
        }
        return String(a.Photo_ID || '').localeCompare(String(b.Photo_ID || ''));
      });

      const seenRefs = new Set<string>();
      const photos: ActiveGalleryPhotoItem[] = [];

      linkedRows.forEach((row, idx) => {
        const ref = extractPhotoReference(row as any);
        if (!ref || seenRefs.has(ref)) return;
        seenRefs.add(ref);
        photos.push({
          photoId: String(row.Photo_ID || `${gid}-photo-${idx}`),
          ref,
          caption: String(row.Photo_Caption || (row as any).Caption || (row as any).Title || '').trim(),
        });
      });

      const masterRef = extractPhotoReference(event as any);
      if (masterRef && !seenRefs.has(masterRef)) {
        seenRefs.add(masterRef);
        photos.unshift({
          photoId: `${gid}-cover`,
          ref: masterRef,
          caption: '',
        });
      }

      return { event, photos };
    });
}
