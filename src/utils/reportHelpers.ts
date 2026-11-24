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

export function computeConfirmedInvoiceMetrics(
  invoices: InvoiceRegister[],
  receipts: FundInflowRegister[],
  billAllocations: BillWiseDetails[]
) {
  const confirmedTxnIds = new Set(
    (receipts || [])
      .filter((r) => String(r.Receipt_Status || (r as any).Status || '').trim().toLowerCase() === 'confirmed')
      .map((r) => String(r.Transaction_ID || ''))
      .filter(Boolean)
  );
  const allocationsByInvoice = new Map<string, number>();
  (billAllocations || []).forEach((row) => {
    if (!confirmedTxnIds.has(String(row.Transaction_ID || ''))) return;
    const invoiceId = String(row.InvoiceID || '');
    if (invoiceId) {
      allocationsByInvoice.set(invoiceId, (allocationsByInvoice.get(invoiceId) || 0) + toReportAmount(row.Allocated_Amount));
    }
  });

  return (invoices || [])
    .filter((inv) => !EXCLUDED_INVOICE_STATUSES.has(String(inv.Invoice_Status || '').trim().toLowerCase()))
    .map((inv) => {
      const invoiceId = String(inv.InvoiceID || '');
      const hasAlloc = allocationsByInvoice.has(invoiceId);
      const net = Math.max(0, toReportAmount(inv.Net_Charge_Amount));
      const paid = Math.min(net, Math.max(0, hasAlloc ? (allocationsByInvoice.get(invoiceId) || 0) : toReportAmount(inv.Paid_Amount)));
      const rawDue = inv.Outstanding_Amount as unknown;
      const due =
        hasAlloc || rawDue === '' || rawDue === null || rawDue === undefined
          ? Math.max(0, Math.round((net - paid) * 100) / 100)
          : Math.max(0, toReportAmount(rawDue));
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

export function computeOwnershipOutstandingClient(params: {
  invoices: InvoiceRegister[];
  receipts: FundInflowRegister[];
  billAllocations: BillWiseDetails[];
  ownerships: OwnershipHistory[];
  properties: PropertyMaster[];
  owners: OwnerMaster[];
}) {
  const { invoices, receipts, billAllocations, ownerships, properties, owners } = params;
  const ownershipById = new Map((ownerships || []).map((o) => [String(o.Ownership_ID || ''), o]));
  const propById = new Map((properties || []).map((p) => [String(p.PropertyID || ''), p]));
  const ownerById = new Map((owners || []).map((o) => [String(o.OwnerID || ''), o]));
  const grouped = new Map<string, any>();
  let unlinkedInvoiceCount = 0;

  computeConfirmedInvoiceMetrics(invoices, receipts, billAllocations).forEach(({ inv, net, paid, due }) => {
    if (due <= 0) return;
    const ownershipId = String(inv.Ownership_ID || '');
    const propertyId = String(inv.PropertyID || '');
    const ownerId = String(inv.OwnerID || '');
    const key = ownershipId || `UNLINKED:${propertyId}:${ownerId}`;
    if (!ownershipId) unlinkedInvoiceCount += 1;
    const history = ownershipById.get(ownershipId);
    const prop = propById.get(propertyId);
    const owner = ownerById.get(ownerId);
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        Ownership_ID: ownershipId || 'Not linked',
        PropertyID: propertyId,
        Flat_No: String(inv.Flat_Number || (inv as any).Flat_No || prop?.Flat_No || ''),
        OwnerID: ownerId,
        Owner_Name: String(inv.Owner_Name || owner?.Owner_Name || ''),
        Ownership_Start_Date: history?.Ownership_Start_Date || '',
        Ownership_End_Date: history?.Ownership_End_Date || '',
        Ownership_Status: history?.Ownership_Status || 'Historical record not found',
        Invoice_Count: 0,
        Total_Billed: 0,
        Total_Paid: 0,
        Outstanding: 0,
        Data_Link_Status: ownershipId && history?.Ownership_ID ? 'Linked' : 'Needs review',
      };
      grouped.set(key, entry);
    }
    entry.Invoice_Count += 1;
    entry.Total_Billed = Math.round((entry.Total_Billed + net) * 100) / 100;
    entry.Total_Paid = Math.round((entry.Total_Paid + paid) * 100) / 100;
    entry.Outstanding = Math.round((entry.Outstanding + due) * 100) / 100;
  });

  const data = Array.from(grouped.values()).sort((a, b) => b.Outstanding - a.Outstanding);
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
