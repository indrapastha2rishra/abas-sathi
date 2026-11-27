import type {
  BillWiseDetails,
  ExpenseRegister,
  FinancialYearMaster,
  FundInflowRegister,
  InvoiceRegister,
  OwnerMaster,
  OwnershipHistory,
  PropertyMaster,
} from '../types/database';

export type ReportKey =
  | 'monthly'
  | 'fy'
  | 'property_due'
  | 'owner_due'
  | 'ownership_due'
  | 'expense_summary'
  | 'balancesheet'
  | 'year_end';

export function resolveReportKey(tab?: string): ReportKey {
  switch (tab) {
    case 'reports_property_due':
      return 'property_due';
    case 'reports_balancesheet':
      return 'balancesheet';
    case 'reports_fy':
      return 'fy';
    case 'reports_expense_summary':
      return 'expense_summary';
    case 'reports_owner_due':
      return 'owner_due';
    case 'reports_ownership_due':
      return 'ownership_due';
    case 'reports_year_end':
      return 'year_end';
    case 'reports_monthly':
    default:
      return 'monthly';
  }
}

export function tabForReportKey(key: ReportKey): string {
  switch (key) {
    case 'property_due':
      return 'reports_property_due';
    case 'balancesheet':
      return 'reports_balancesheet';
    case 'fy':
      return 'reports_fy';
    case 'expense_summary':
      return 'reports_expense_summary';
    case 'owner_due':
      return 'reports_owner_due';
    case 'ownership_due':
      return 'reports_ownership_due';
    case 'year_end':
      return 'reports_year_end';
    case 'monthly':
    default:
      return 'reports_monthly';
  }
}

export function toReportAmount(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? '').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function toReportDateKey(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : localDateKey(value);
  }
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) return raw.replace(/\//g, '-');
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  if (raw.includes('T') || /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw) || /\b(?:GMT|UTC)\b/i.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return localDateKey(parsed);
  }
  const ymdPrefix = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdPrefix) {
    return `${ymdPrefix[1]}-${ymdPrefix[2].padStart(2, '0')}-${ymdPrefix[3].padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : localDateKey(parsed);
}

const EXCLUDED_INVOICE_STATUSES = new Set(['cancelled', 'draft', 'pending_approval', 'pending approval']);
const EXCLUDED_ALLOCATION_STATUSES = new Set(['cancelled', 'canceled', 'rejected', 'void', 'reversed']);

export function computeConfirmedInvoiceMetrics(
  invoices: InvoiceRegister[],
  receipts: FundInflowRegister[],
  billAllocations: BillWiseDetails[]
) {
  const receiptStatusByTxnId = new Map<string, string>();
  (receipts || []).forEach((r) => {
    const txnId = String(r.Transaction_ID || '').trim();
    if (!txnId) return;
    receiptStatusByTxnId.set(txnId, String(r.Receipt_Status || (r as any).Status || '').trim().toLowerCase());
  });
  const invoiceIdByNumber = new Map<string, string>();
  (invoices || []).forEach((inv) => {
    const id = String(inv.InvoiceID || '').trim();
    const num = String(inv.Invoice_Number || '').trim();
    if (id && num) invoiceIdByNumber.set(num, id);
  });
  const allocationsByInvoice = new Map<string, number>();
  (billAllocations || []).forEach((row) => {
    const allocStatus = String((row as any).Allocation_Status || (row as any).Status || '').trim().toLowerCase();
    if (allocStatus && EXCLUDED_ALLOCATION_STATUSES.has(allocStatus)) return;
    const txnId = String(row.Transaction_ID || '').trim();
    if (txnId && receiptStatusByTxnId.has(txnId) && receiptStatusByTxnId.get(txnId) !== 'confirmed') return;
    const invoiceId =
      String(row.InvoiceID || '').trim() ||
      invoiceIdByNumber.get(String(row.Invoice_Number || '').trim()) ||
      '';
    if (invoiceId) {
      allocationsByInvoice.set(
        invoiceId,
        Math.round(((allocationsByInvoice.get(invoiceId) || 0) + Math.max(0, toReportAmount(row.Allocated_Amount))) * 100) / 100
      );
    }
  });

  return (invoices || [])
    .filter((inv) => !EXCLUDED_INVOICE_STATUSES.has(String(inv.Invoice_Status || '').trim().toLowerCase()))
    .map((inv) => {
      const invoiceId = String(inv.InvoiceID || '').trim();
      const net = Math.max(0, Math.round(toReportAmount(inv.Net_Charge_Amount) * 100) / 100);
      const allocated = Math.max(0, Math.round((allocationsByInvoice.get(invoiceId) || 0) * 100) / 100);
      const paid = Math.min(net, allocated);
      const due = Math.max(0, Math.round((net - allocated) * 100) / 100);
      return { inv, net, paid, due };
    });
}

export interface PropertyOutstandingRow {
  propertyId: string;
  flatNo: string;
  tower: string;
  ownerName: string;
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  status: 'Clear' | 'Pending';
}

export function computePropertyOutstandingRows(params: {
  properties: PropertyMaster[];
  invoices: InvoiceRegister[];
  receipts: FundInflowRegister[];
  billAllocations: BillWiseDetails[];
  owners: OwnerMaster[];
  ownerships: OwnershipHistory[];
}): PropertyOutstandingRow[] {
  const { properties, invoices, receipts, billAllocations, owners, ownerships } = params;
  const ownerById = new Map<string, OwnerMaster>();
  (owners || []).forEach((o) => {
    if (o.OwnerID) ownerById.set(String(o.OwnerID), o);
  });
  const currentOwnByProp = new Map<string, OwnershipHistory>();
  (ownerships || []).forEach((h) => {
    if (h.PropertyID && String(h.Ownership_Status || '').trim().toLowerCase() === 'current') {
      currentOwnByProp.set(String(h.PropertyID), h);
    }
  });

  const grouped = new Map<string, PropertyOutstandingRow>();

  (properties || []).forEach((prop) => {
    const pid = String(prop.PropertyID || '');
    if (!pid) return;
    const curOwn = currentOwnByProp.get(pid);
    const owner = curOwn ? ownerById.get(String(curOwn.OwnerID || '')) : undefined;
    grouped.set(pid, {
      propertyId: pid,
      flatNo: String(prop.Flat_No || ''),
      tower: String(prop.Block_Tower || ''),
      ownerName: String(owner?.Owner_Name || ''),
      invoiceCount: 0,
      totalBilled: 0,
      totalPaid: 0,
      totalDue: 0,
      status: 'Clear',
    });
  });

  computeConfirmedInvoiceMetrics(invoices, receipts, billAllocations).forEach(({ inv, net, paid, due }) => {
    const pid = String(inv.PropertyID || '');
    if (!pid) return;
    let entry = grouped.get(pid);
    if (!entry) {
      const owner = ownerById.get(String(inv.OwnerID || ''));
      entry = {
        propertyId: pid,
        flatNo: String(inv.Flat_Number || (inv as any).Flat_No || pid),
        tower: '',
        ownerName: String(inv.Owner_Name || owner?.Owner_Name || ''),
        invoiceCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        totalDue: 0,
        status: 'Clear',
      };
      grouped.set(pid, entry);
    }
    if (!entry.ownerName) {
      const owner = ownerById.get(String(inv.OwnerID || ''));
      entry.ownerName = String(inv.Owner_Name || owner?.Owner_Name || '');
    }
    entry.invoiceCount += 1;
    entry.totalBilled = Math.round((entry.totalBilled + net) * 100) / 100;
    entry.totalPaid = Math.round((entry.totalPaid + paid) * 100) / 100;
    entry.totalDue = Math.round((entry.totalDue + due) * 100) / 100;
    entry.status = entry.totalDue > 0 ? 'Pending' : 'Clear';
  });

  return Array.from(grouped.values()).map((r) => ({
    ...r,
    ownerName: r.ownerName || 'Registered Owner',
  }));
}

export function computeOwnerOutstandingRows(params: {
  invoices: InvoiceRegister[];
  receipts: FundInflowRegister[];
  billAllocations: BillWiseDetails[];
  owners: OwnerMaster[];
  properties: PropertyMaster[];
}) {
  const { invoices, receipts, billAllocations, owners, properties } = params;
  const ownerById = new Map((owners || []).map((o) => [String(o.OwnerID || ''), o]));
  const propById = new Map((properties || []).map((p) => [String(p.PropertyID || ''), p]));
  const grouped = new Map<
    string,
    {
      OwnerID: string;
      Owner_Name: string;
      flats: Set<string>;
      Invoice_Count: number;
      Total_Billed: number;
      Total_Paid: number;
      Outstanding: number;
    }
  >();

  computeConfirmedInvoiceMetrics(invoices, receipts, billAllocations).forEach(({ inv, net, paid, due }) => {
    if (due <= 0) return;
    const key = String(inv.OwnerID || inv.Owner_Name || inv.PropertyID || 'UNMAPPED');
    const owner = ownerById.get(String(inv.OwnerID || ''));
    const prop = propById.get(String(inv.PropertyID || ''));
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        OwnerID: String(inv.OwnerID || '—'),
        Owner_Name: String(inv.Owner_Name || owner?.Owner_Name || 'Registered Owner'),
        flats: new Set<string>(),
        Invoice_Count: 0,
        Total_Billed: 0,
        Total_Paid: 0,
        Outstanding: 0,
      };
      grouped.set(key, entry);
    }
    const flatLabel = String(inv.Flat_Number || (inv as any).Flat_No || prop?.Flat_No || inv.PropertyID || '');
    if (flatLabel) entry.flats.add(flatLabel);
    entry.Invoice_Count += 1;
    entry.Total_Billed = Math.round((entry.Total_Billed + net) * 100) / 100;
    entry.Total_Paid = Math.round((entry.Total_Paid + paid) * 100) / 100;
    entry.Outstanding = Math.round((entry.Outstanding + due) * 100) / 100;
  });

  return Array.from(grouped.values())
    .map((e) => ({
      OwnerID: e.OwnerID,
      Owner_Name: e.Owner_Name,
      Property_Count: e.flats.size,
      Flat_Numbers: Array.from(e.flats).join(', '),
      Invoice_Count: e.Invoice_Count,
      Total_Billed: e.Total_Billed,
      Total_Paid: e.Total_Paid,
      Outstanding: e.Outstanding,
    }))
    .sort((a, b) => b.Outstanding - a.Outstanding);
}

export function resolveFloorValue(
  prop?: Partial<PropertyMaster> | Record<string, any> | null,
  inv?: Partial<InvoiceRegister> | Record<string, any> | null,
  history?: Partial<OwnershipHistory> | Record<string, any> | null
): number | string {
  const candidates = [
    prop?.Floor_No,
    (prop as any)?.['Floor No.'],
    (prop as any)?.['Floor No'],
    (inv as any)?.Floor_No,
    (history as any)?.Floor_No,
  ];
  for (const raw of candidates) {
    if (raw === undefined || raw === null) continue;
    const str = String(raw).trim();
    if (str === '') continue;
    const num = Number(str);
    return Number.isFinite(num) ? num : str;
  }
  return '';
}

export function getFloorMeta(floorNo: unknown): { floorKey: string; floorLabel: string; floorRank: number } {
  if (floorNo === undefined || floorNo === null || String(floorNo).trim() === '') {
    return { floorKey: '__UNASSIGNED__', floorLabel: 'Unassigned Floor', floorRank: Number.MAX_SAFE_INTEGER };
  }
  const str = String(floorNo).trim();
  const num = Number(str);
  if (Number.isFinite(num)) {
    return {
      floorKey: String(num),
      floorLabel: `Floor ${num}`,
      floorRank: num,
    };
  }
  return {
    floorKey: str,
    floorLabel: /^floor\b/i.test(str) ? str : `Floor ${str}`,
    floorRank: Number.MAX_SAFE_INTEGER - 1,
  };
}

export interface OwnershipFloorGroup<T = any> {
  floorKey: string;
  floorLabel: string;
  floorRank: number;
  ownershipCount: number;
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  rows: T[];
}

export function groupOwnershipOutstandingByFloor<T extends Record<string, any>>(
  rows: T[],
  properties: PropertyMaster[] = []
): OwnershipFloorGroup<T>[] {
  const propById = new Map<string, PropertyMaster>();
  const propByFlat = new Map<string, PropertyMaster>();
  (properties || []).forEach((p) => {
    if (p.PropertyID) propById.set(String(p.PropertyID).trim(), p);
    if (p.Flat_No) propByFlat.set(String(p.Flat_No).trim().toLowerCase(), p);
  });

  const groups = new Map<string, OwnershipFloorGroup<T>>();

  (rows || []).forEach((row) => {
    const prop =
      propById.get(String(row.PropertyID || '').trim()) ||
      propByFlat.get(String(row.Flat_No || '').trim().toLowerCase());
    const floorVal =
      row.Floor_No !== undefined && row.Floor_No !== null && String(row.Floor_No).trim() !== ''
        ? row.Floor_No
        : resolveFloorValue(prop);
    const meta = getFloorMeta(floorVal);
    let grp = groups.get(meta.floorKey);
    if (!grp) {
      grp = {
        floorKey: meta.floorKey,
        floorLabel: meta.floorLabel,
        floorRank: meta.floorRank,
        ownershipCount: 0,
        invoiceCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        rows: [],
      };
      groups.set(meta.floorKey, grp);
    }
    const enriched =
      row.Floor_No === floorVal
        ? row
        : ({ ...row, Floor_No: floorVal } as T);
    grp.rows.push(enriched);
    grp.ownershipCount += 1;
    grp.invoiceCount += Number(row.Invoice_Count || 0);
    grp.totalBilled = Math.round((grp.totalBilled + toReportAmount(row.Total_Billed)) * 100) / 100;
    grp.totalPaid = Math.round((grp.totalPaid + toReportAmount(row.Total_Paid)) * 100) / 100;
    grp.totalOutstanding = Math.round((grp.totalOutstanding + toReportAmount(row.Outstanding)) * 100) / 100;
  });

  return Array.from(groups.values())
    .sort((a, b) => {
      if (a.floorRank !== b.floorRank) return a.floorRank - b.floorRank;
      return a.floorLabel.localeCompare(b.floorLabel, undefined, { numeric: true, sensitivity: 'base' });
    })
    .map((grp) => ({
      ...grp,
      rows: [...grp.rows].sort((a, b) => {
        const flatA = String(a.Flat_No || a.PropertyID || '').trim();
        const flatB = String(b.Flat_No || b.PropertyID || '').trim();
        const flatCmp = flatA.localeCompare(flatB, undefined, { numeric: true, sensitivity: 'base' });
        if (flatCmp !== 0) return flatCmp;
        const dateCmp = toReportDateKey(a.Ownership_Start_Date).localeCompare(toReportDateKey(b.Ownership_Start_Date));
        if (dateCmp !== 0) return dateCmp;
        return String(a.Ownership_ID || '').localeCompare(String(b.Ownership_ID || ''));
      }),
    }));
}

export function computeOwnershipOutstandingClient(params: {
  invoices: InvoiceRegister[];
  receipts: FundInflowRegister[];
  billAllocations: BillWiseDetails[];
  ownerships: OwnershipHistory[];
  properties: PropertyMaster[];
  owners: OwnerMaster[];
}) {
  const { invoices, receipts, billAllocations, ownerships, properties, owners } = params;
  const normName = (v: unknown) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();

  const ownershipByIdUpper = new Map<string, OwnershipHistory>();
  (ownerships || []).forEach((o) => {
    const id = String(o.Ownership_ID || (o as any).OwnershipID || '').trim();
    if (id) ownershipByIdUpper.set(id.toUpperCase(), o);
  });

  const propByIdUpper = new Map<string, PropertyMaster>();
  (properties || []).forEach((p) => {
    const id = String(p.PropertyID || (p as any).Property_ID || '').trim();
    if (id) propByIdUpper.set(id.toUpperCase(), p);
  });

  const ownerByIdUpper = new Map<string, OwnerMaster>();
  (owners || []).forEach((o) => {
    const id = String(o.OwnerID || (o as any).Owner_ID || '').trim();
    if (id) ownerByIdUpper.set(id.toUpperCase(), o);
  });

  const receiptByTxnIdUpper = new Map<
    string,
    { status: string; ownerId: string; ownerName: string; ownershipId: string; propertyId: string }
  >();
  (receipts || []).forEach((r) => {
    const txnId = String(r.Transaction_ID || (r as any).TransactionID || '').trim().toUpperCase();
    if (!txnId) return;
    receiptByTxnIdUpper.set(txnId, {
      status: String(r.Receipt_Status || (r as any).Status || '').trim().toLowerCase(),
      ownerId: String(r.OwnerID || (r as any).Owner_ID || '').trim(),
      ownerName: String(r.Owner_Name || '').trim(),
      ownershipId: String(r.Ownership_ID || (r as any).OwnershipID || '').trim(),
      propertyId: String(r.PropertyID || (r as any).Property_ID || '').trim(),
    });
  });

  interface IssuedInvoiceMeta {
    key: string;
    invId: string;
    invNum: string;
    ownershipId: string;
    propertyId: string;
    ownerId: string;
    ownerName: string;
  }

  const issuedInvoiceByIdUpper = new Map<string, IssuedInvoiceMeta>();
  const issuedInvoiceByNumberUpper = new Map<string, IssuedInvoiceMeta>();
  const keyByUpperKey = new Map<string, string>();
  const keysByPropertyAndOwnerUpper = new Map<string, Set<string>>();
  const grouped = new Map<string, any>();

  (invoices || []).forEach((inv) => {
    const statusLower = String(inv.Invoice_Status || '').trim().toLowerCase();
    if (EXCLUDED_INVOICE_STATUSES.has(statusLower)) return;

    const rawOwnershipId = String(inv.Ownership_ID || (inv as any).OwnershipID || '').trim();
    const history = rawOwnershipId ? ownershipByIdUpper.get(rawOwnershipId.toUpperCase()) : undefined;
    const ownershipId = String(history?.Ownership_ID || rawOwnershipId).trim();
    const propertyId = String(inv.PropertyID || (inv as any).Property_ID || history?.PropertyID || '').trim();
    const ownerId = String(inv.OwnerID || (inv as any).Owner_ID || history?.OwnerID || '').trim();
    const key = ownershipId || `UNLINKED:${propertyId}:${ownerId}`;
    keyByUpperKey.set(key.toUpperCase(), key);

    if (propertyId && ownerId) {
      const poKey = `${propertyId.toUpperCase()}::${ownerId.toUpperCase()}`;
      const set = keysByPropertyAndOwnerUpper.get(poKey) || new Set<string>();
      set.add(key);
      keysByPropertyAndOwnerUpper.set(poKey, set);
    }

    const prop = propertyId ? propByIdUpper.get(propertyId.toUpperCase()) : undefined;
    const owner = ownerId ? ownerByIdUpper.get(ownerId.toUpperCase()) : undefined;
    const ownerName = String(inv.Owner_Name || owner?.Owner_Name || '').trim();
    const invId = String(inv.InvoiceID || (inv as any).Invoice_ID || '').trim();
    const invNum = String(inv.Invoice_Number || (inv as any).Invoice_No || '').trim();

    const meta: IssuedInvoiceMeta = {
      key,
      invId,
      invNum,
      ownershipId,
      propertyId,
      ownerId,
      ownerName,
    };
    if (invId) issuedInvoiceByIdUpper.set(invId.toUpperCase(), meta);
    if (invNum) issuedInvoiceByNumberUpper.set(invNum.toUpperCase(), meta);

    const floorNo = resolveFloorValue(prop, inv, history);

    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        Ownership_ID: ownershipId || 'Not linked',
        PropertyID: propertyId,
        Flat_No: String(inv.Flat_Number || (inv as any).Flat_No || prop?.Flat_No || ''),
        Floor_No: floorNo,
        OwnerID: ownerId,
        Owner_Name: ownerName,
        Ownership_Start_Date: history?.Ownership_Start_Date || '',
        Ownership_End_Date: history?.Ownership_End_Date || '',
        Ownership_Status: history?.Ownership_Status || 'Historical record not found',
        Invoice_Count: 0,
        Total_Billed: 0,
        Total_Paid: 0,
        Outstanding: 0,
        Data_Link_Status: ownershipId && history?.Ownership_ID ? 'Linked' : 'Needs review',
        _legacyPaid: 0,
        _hasOwnershipId: Boolean(ownershipId),
      };
      grouped.set(key, entry);
    } else {
      if (entry.Floor_No === '' && floorNo !== '') entry.Floor_No = floorNo;
      if (!entry.OwnerID && ownerId) entry.OwnerID = ownerId;
      if (!entry.Owner_Name && ownerName) entry.Owner_Name = ownerName;
      if (!entry.PropertyID && propertyId) entry.PropertyID = propertyId;
    }

    const net = Math.max(0, toReportAmount(inv.Net_Charge_Amount));
    const legacyPaid = Math.max(0, toReportAmount(inv.Paid_Amount));
    entry.Invoice_Count += 1;
    entry.Total_Billed = Math.round((entry.Total_Billed + net) * 100) / 100;
    entry._legacyPaid = Math.round((entry._legacyPaid + legacyPaid) * 100) / 100;
  });

  // Check Paid from Bill Wise Details against mentioned Invoice (InvoiceID / Invoice_Number) and Owner wise
  const allocatedByOwnership = new Map<string, number>();
  (billAllocations || []).forEach((row) => {
    const allocStatus = String((row as any).Allocation_Status || (row as any).Status || '').trim().toLowerCase();
    if (allocStatus && EXCLUDED_ALLOCATION_STATUSES.has(allocStatus)) return;

    const txnIdUpper = String(row.Transaction_ID || (row as any).TransactionID || '').trim().toUpperCase();
    const recInfo = txnIdUpper ? receiptByTxnIdUpper.get(txnIdUpper) : undefined;
    if (recInfo && recInfo.status !== 'confirmed') return;

    const allocatedAmt = Math.max(
      0,
      toReportAmount(row.Allocated_Amount ?? (row as any).Allocation_Amount ?? (row as any).Allocated_Amt)
    );
    if (allocatedAmt <= 0) return;

    const rowInvId = String(row.InvoiceID || (row as any).Invoice_ID || '').trim();
    const rowInvNum = String(row.Invoice_Number || (row as any).Invoice_No || '').trim();
    const rowOwnershipId = String(row.Ownership_ID || (row as any).OwnershipID || '').trim();
    const rowPropId = String(row.PropertyID || (row as any).Property_ID || '').trim();
    const rowOwnerId = String(row.OwnerID || (row as any).Owner_ID || '').trim() || recInfo?.ownerId || '';
    const resolvedRowOwner = rowOwnerId ? ownerByIdUpper.get(rowOwnerId.toUpperCase()) : undefined;
    const rowOwnerName = String((row as any).Owner_Name || '').trim() || recInfo?.ownerName || String(resolvedRowOwner?.Owner_Name || '').trim();

    let resolvedKey = '';

    if (rowInvId || rowInvNum) {
      // Invoice mentioned: must match an active issued invoice and match Owner / Ownership if specified
      const matchedInv =
        (rowInvId ? issuedInvoiceByIdUpper.get(rowInvId.toUpperCase()) : undefined) ||
        (rowInvNum ? issuedInvoiceByNumberUpper.get(rowInvNum.toUpperCase()) : undefined);
      if (!matchedInv) return;

      const entry = grouped.get(matchedInv.key);
      const targetOwnerId = matchedInv.ownerId || String(entry?.OwnerID || '').trim();
      const targetOwnerFromMaster = targetOwnerId ? ownerByIdUpper.get(targetOwnerId.toUpperCase()) : undefined;
      const targetOwnerName = matchedInv.ownerName || String(entry?.Owner_Name || targetOwnerFromMaster?.Owner_Name || '').trim();

      if (rowOwnerId && targetOwnerId && rowOwnerId.toUpperCase() !== targetOwnerId.toUpperCase()) return;
      if ((!rowOwnerId || !targetOwnerId) && rowOwnerName && targetOwnerName && normName(rowOwnerName) !== normName(targetOwnerName)) {
        return;
      }
      if (rowOwnershipId && matchedInv.ownershipId && rowOwnershipId.toUpperCase() !== matchedInv.ownershipId.toUpperCase()) {
        return;
      }
      if (rowPropId && matchedInv.propertyId && rowPropId.toUpperCase() !== matchedInv.propertyId.toUpperCase()) {
        return;
      }
      resolvedKey = matchedInv.key;
    } else {
      // No InvoiceID/Invoice_Number mentioned: match Ownership_ID (or unique Property+Owner) and verify Owner wise
      if (rowOwnershipId) {
        resolvedKey = keyByUpperKey.get(rowOwnershipId.toUpperCase()) || '';
      } else if (rowPropId && rowOwnerId) {
        const unlinkedKey = keyByUpperKey.get(`UNLINKED:${rowPropId}:${rowOwnerId}`.toUpperCase());
        if (unlinkedKey) {
          resolvedKey = unlinkedKey;
        } else {
          const candidates = keysByPropertyAndOwnerUpper.get(`${rowPropId.toUpperCase()}::${rowOwnerId.toUpperCase()}`);
          if (candidates && candidates.size === 1) {
            resolvedKey = Array.from(candidates)[0];
          }
        }
      }
      if (!resolvedKey) return;
      const entry = grouped.get(resolvedKey);
      if (!entry) return;

      const targetOwnerId = String(entry.OwnerID || '').trim();
      const targetOwnerName = String(entry.Owner_Name || '').trim();
      if (rowOwnerId && targetOwnerId && rowOwnerId.toUpperCase() !== targetOwnerId.toUpperCase()) return;
      if (!rowOwnerId && rowOwnerName && targetOwnerName && normName(rowOwnerName) !== normName(targetOwnerName)) {
        return;
      }
      if (rowPropId && entry.PropertyID && rowPropId.toUpperCase() !== String(entry.PropertyID).trim().toUpperCase()) {
        return;
      }
    }

    allocatedByOwnership.set(
      resolvedKey,
      Math.round(((allocatedByOwnership.get(resolvedKey) || 0) + allocatedAmt) * 100) / 100
    );
  });

  let unlinkedInvoiceCount = 0;

  const data = Array.from(grouped.entries())
    .map(([key, entry]) => {
      const paid = allocatedByOwnership.get(key) || 0;
      const totalPaid = Math.round(Math.max(0, paid) * 100) / 100;
      const outstanding = Math.max(0, Math.round((entry.Total_Billed - totalPaid) * 100) / 100);
      if (!entry._hasOwnershipId && outstanding > 0) {
        unlinkedInvoiceCount += entry.Invoice_Count;
      }
      const { _legacyPaid, _hasOwnershipId, ...publicRow } = entry;
      return {
        ...publicRow,
        Total_Paid: totalPaid,
        Outstanding: outstanding,
      };
    })
    .filter((r) => r.Outstanding > 0)
    .sort((a, b) => {
      const floorA = getFloorMeta(a.Floor_No);
      const floorB = getFloorMeta(b.Floor_No);
      if (floorA.floorRank !== floorB.floorRank) return floorA.floorRank - floorB.floorRank;
      const flatCmp = String(a.Flat_No || a.PropertyID || '').localeCompare(
        String(b.Flat_No || b.PropertyID || ''),
        undefined,
        { numeric: true, sensitivity: 'base' }
      );
      if (flatCmp !== 0) return flatCmp;
      return String(a.Ownership_ID || '').localeCompare(String(b.Ownership_ID || ''));
    });

  const totalOutstanding = Math.round(data.reduce((s, r) => s + r.Outstanding, 0) * 100) / 100;
  return {
    data,
    summary: {
      ownershipCount: data.length,
      totalOutstanding,
      unlinkedInvoiceCount,
    },
  };
}

export function resolveFYRangeForMonth(selectedMonth: string, financialYears: FinancialYearMaster[]) {
  const monthStart = `${selectedMonth}-01`;
  const matched = (financialYears || []).find((fy) => {
    const start = toReportDateKey(fy.Start_Date);
    const end = toReportDateKey(fy.End_Date);
    return start && end && monthStart >= start && monthStart <= end;
  });
  if (matched) {
    return {
      fyId: matched.FY_ID,
      fyName: matched.FY_Name,
      startDate: toReportDateKey(matched.Start_Date),
      endDate: toReportDateKey(matched.End_Date),
    };
  }
  const year = Number(selectedMonth.slice(0, 4)) || new Date().getFullYear();
  const monthNum = Number(selectedMonth.slice(5, 7)) || (new Date().getMonth() + 1);
  const fyStart = monthNum >= 4 ? year : year - 1;
  return {
    fyId: '',
    fyName: `FY ${fyStart}-${fyStart + 1}`,
    startDate: `${fyStart}-04-01`,
    endDate: `${fyStart + 1}-03-31`,
  };
}
