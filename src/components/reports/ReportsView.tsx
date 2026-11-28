/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BalanceSheetWorkflow } from './BalanceSheetWorkflow';
import { YearEndClosingWorkflow } from './YearEndClosingWorkflow';
import { OwnershipOutstandingPrintModal } from '../modals/OwnershipOutstandingPrintModal';
import { useApp } from '../../context/AppContext';
import { formatDateDisplay, formatDateTimeDisplay, formatMonthYearDisplay } from '../../utils/dateFormat';
import { readFundBalanceCache, writeFundBalanceCache } from '../../utils/localDataCache';
import {
  computeConfirmedInvoiceMetrics,
  computeOwnerOutstandingRows,
  computeOwnershipOutstandingClient,
  computePropertyOutstandingRows,
  getFloorMeta,
  groupOwnershipOutstandingByFloor,
  PropertyOutstandingRow,
  ReportKey,
  resolveFloorValue,
  resolveFYRangeForMonth,
  resolveReportKey,
  tabForReportKey,
  toReportAmount,
  toReportDateKey,
} from '../../utils/reportHelpers';
import { computeMaintenanceCollectionRate } from '../../utils/dashboardHelpers';
import {
  BarChart3,
  Download,
  Printer,
  FileSpreadsheet,
  Info,
  RefreshCw,
} from 'lucide-react';

const formatINR = (val: unknown, decimals = 2) =>
  `₹${toReportAmount(val).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

export const ReportsView: React.FC<{ initialReport?: string }> = ({ initialReport = 'reports_monthly' }) => {
  const {
    currentUser,
    invoices,
    receipts,
    billAllocations,
    expenses,
    properties,
    owners,
    ownerships,
    bankAccounts,
    accountHeads,
    financialYears,
    rates,
    societySettings,
    getReport,
    getFundBalanceSummary,
    setActiveTab,
    canAccessTab,
    hasPermission,
    t,
  } = useApp();

  const [activeReport, setActiveReport] = useState<ReportKey>(() => resolveReportKey(initialReport));
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedFyId, setSelectedFyId] = useState<string>('');
  const [propertyFilter, setPropertyFilter] = useState<'all' | 'pending' | 'clear'>('all');
  const [propertySearch, setPropertySearch] = useState('');
  const [ownershipViewMode, setOwnershipViewMode] = useState<'by_floor' | 'flat_list'>('by_floor');
  const [selectedOwnershipFloor, setSelectedOwnershipFloor] = useState<string>('all');
  const [serverReport, setServerReport] = useState<any>(null);
  const [serverReportError, setServerReportError] = useState('');
  const [serverReportLoading, setServerReportLoading] = useState(false);
  const [balanceSheetReport, setBalanceSheetReport] = useState<any>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [showOwnershipPrintModal, setShowOwnershipPrintModal] = useState(false);

  const sessionInfo = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('abasSathiSession') || '{}');
    } catch {
      return {};
    }
  }, []);

  const [fundBalanceSummary, setFundBalanceSummary] = useState<any>(() =>
    readFundBalanceCache(sessionInfo.societyCode, sessionInfo.user?.userId)
  );

  // Sync activeReport whenever a sidebar Report button updates initialReport
  useEffect(() => {
    setActiveReport(resolveReportKey(initialReport));
  }, [initialReport]);

  // Keep Fund Balance Register summary warm for Opening Balance & FY linkage
  useEffect(() => {
    if (!['Admin', 'Accountant', 'Committee'].includes(currentUser.Role)) return;
    let live = true;
    getFundBalanceSummary()
      .then((r: any) => {
        if (live && r?.data) {
          setFundBalanceSummary(r.data);
          writeFundBalanceCache(sessionInfo.societyCode, sessionInfo.user?.userId, r.data);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [currentUser.Role, reloadNonce]);

  const sortedFYs = useMemo(
    () =>
      [...financialYears].sort((a, b) =>
        toReportDateKey(b.Start_Date).localeCompare(toReportDateKey(a.Start_Date))
      ),
    [financialYears]
  );

  const activeFYRange = useMemo(() => {
    if (selectedFyId) {
      const matched = financialYears.find((fy) => String(fy.FY_ID) === String(selectedFyId));
      if (matched) {
        return {
          fyId: matched.FY_ID,
          fyName: matched.FY_Name,
          startDate: toReportDateKey(matched.Start_Date),
          endDate: toReportDateKey(matched.End_Date),
        };
      }
    }
    return resolveFYRangeForMonth(selectedMonth, financialYears);
  }, [selectedFyId, selectedMonth, financialYears]);

  // Fetch live server report when switching report type, month, or FY
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (activeReport === 'year_end' || activeReport === 'balancesheet') {
        if (!cancelled) {
          setServerReport(null);
          setServerReportError('');
          setServerReportLoading(false);
        }
        return;
      }
      setServerReportLoading(true);
      setServerReportError('');
      try {
        let type = 'receiptPayment';
        let filters: Record<string, unknown> = {};
        if (activeReport === 'property_due') {
          type = 'outstanding';
        } else if (activeReport === 'owner_due') {
          type = 'ownerOutstanding';
        } else if (activeReport === 'ownership_due') {
          type = 'ownershipOutstanding';
        } else if (activeReport === 'expense_summary') {
          type = 'expenseSummary';
          const [y, m] = selectedMonth.split('-').map(Number);
          const last = new Date(y, m, 0).getDate();
          filters = { fromDate: `${selectedMonth}-01`, toDate: `${selectedMonth}-${String(last).padStart(2, '0')}` };
        } else if (activeReport === 'fy') {
          type = 'financialYear';
          filters = { fromDate: activeFYRange.startDate, toDate: activeFYRange.endDate };
        } else {
          const [y, m] = selectedMonth.split('-').map(Number);
          const last = new Date(y, m, 0).getDate();
          filters = { fromDate: `${selectedMonth}-01`, toDate: `${selectedMonth}-${String(last).padStart(2, '0')}` };
        }
        const result: any = await getReport(type, filters);
        if (!cancelled) setServerReport(result);
      } catch (e: any) {
        if (!cancelled) setServerReportError(e?.message || 'Server report could not be loaded.');
      } finally {
        if (!cancelled) setServerReportLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeReport, selectedMonth, activeFYRange.startDate, activeFYRange.endDate, reloadNonce]);

  const handleSelectReport = (key: ReportKey) => {
    setActiveReport(key);
    const targetTab = tabForReportKey(key);
    if (canAccessTab(targetTab)) {
      setActiveTab(targetTab);
    }
  };

  // Monthly Receipt & Payment (timezone-safe date matching + Fund Balance Register opening)
  const monthStartKey = `${selectedMonth}-01`;
  const [selYear, selMonth] = selectedMonth.split('-').map(Number);
  const selLastDay = new Date(selYear || new Date().getFullYear(), selMonth || new Date().getMonth() + 1, 0).getDate();
  const monthEndKey = `${selectedMonth}-${String(selLastDay).padStart(2, '0')}`;
  const monthPeriodLabel = `${formatDateDisplay(monthStartKey)} to ${formatDateDisplay(monthEndKey)}`;

  const clientMonthReceipts = useMemo(
    () =>
      receipts.filter(
        (r) =>
          String(r.Receipt_Status || (r as any).Status || '').trim().toLowerCase() === 'confirmed' &&
          toReportDateKey(r.Date_Of_Received).startsWith(selectedMonth)
      ),
    [receipts, selectedMonth]
  );

  const clientMonthExpenses = useMemo(
    () =>
      expenses.filter(
        (e) =>
          String(e.Expense_Status || '').trim().toLowerCase() === 'paid' &&
          toReportDateKey(e.Payment_Date).startsWith(selectedMonth)
      ),
    [expenses, selectedMonth]
  );

  // Use server receipt/expense rows as backup if client state hasn't hydrated yet
  const effectiveMonthReceipts = useMemo(() => {
    if (clientMonthReceipts.length > 0 || receipts.length > 0) return clientMonthReceipts;
    return Array.isArray(serverReport?.data?.receipts) ? serverReport.data.receipts : [];
  }, [clientMonthReceipts, receipts.length, serverReport]);

  const effectiveMonthExpenses = useMemo(() => {
    if (clientMonthExpenses.length > 0 || expenses.length > 0) return clientMonthExpenses;
    return Array.isArray(serverReport?.data?.expenses) ? serverReport.data.expenses : [];
  }, [clientMonthExpenses, expenses.length, serverReport]);

  const totalMonthInflow = useMemo(
    () =>
      effectiveMonthReceipts.length > 0
        ? effectiveMonthReceipts.reduce((sum: number, r: any) => sum + toReportAmount(r.Received_Amount), 0)
        : toReportAmount(serverReport?.data?.totalReceipts),
    [effectiveMonthReceipts, serverReport]
  );

  const totalMonthOutflow = useMemo(
    () =>
      effectiveMonthExpenses.length > 0
        ? effectiveMonthExpenses.reduce((sum: number, e: any) => sum + toReportAmount(e.Payment_Amount), 0)
        : toReportAmount(serverReport?.data?.totalPayments),
    [effectiveMonthExpenses, serverReport]
  );

  const fyOpeningFallback = useMemo(() => {
    if (typeof fundBalanceSummary?.openingFundBalance === 'number') {
      return toReportAmount(fundBalanceSummary.openingFundBalance);
    }
    return bankAccounts.reduce((sum, b) => sum + toReportAmount(b.Opening_Balance), 0);
  }, [fundBalanceSummary, bankAccounts]);

  const computedOpeningAtMonthStart = useMemo(() => {
    if (activeReport === 'monthly' && typeof serverReport?.data?.openingBalance === 'number') {
      return toReportAmount(serverReport.data.openingBalance);
    }
    const fyStart = activeFYRange.startDate;
    let priorIn = 0;
    let priorOut = 0;
    if (fyStart && monthStartKey > fyStart) {
      priorIn = receipts
        .filter((r) => String(r.Receipt_Status || (r as any).Status || '').trim().toLowerCase() === 'confirmed')
        .filter((r) => {
          const d = toReportDateKey(r.Date_Of_Received);
          return d >= fyStart && d < monthStartKey;
        })
        .reduce((s, r) => s + toReportAmount(r.Received_Amount), 0);
      priorOut = expenses
        .filter((e) => String(e.Expense_Status || '').trim().toLowerCase() === 'paid')
        .filter((e) => {
          const d = toReportDateKey(e.Payment_Date);
          return d >= fyStart && d < monthStartKey;
        })
        .reduce((s, e) => s + toReportAmount(e.Payment_Amount), 0);
    }
    return Math.round((fyOpeningFallback + priorIn - priorOut) * 100) / 100;
  }, [activeReport, serverReport, activeFYRange.startDate, monthStartKey, receipts, expenses, fyOpeningFallback]);

  const openingBankSource =
    (activeReport === 'monthly' && serverReport?.data?.openingSource) ||
    fundBalanceSummary?.sourceStatus ||
    'Fund Balance Register';

  const closingBank = Math.round((computedOpeningAtMonthStart + totalMonthInflow - totalMonthOutflow) * 100) / 100;

  const monthOptions = useMemo(() => {
    const months = new Set<string>([selectedMonth]);
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    receipts.forEach((r) => {
      const ym = toReportDateKey(r.Date_Of_Received).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) months.add(ym);
    });
    expenses.forEach((e) => {
      const ym = toReportDateKey(e.Payment_Date).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) months.add(ym);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [selectedMonth, receipts, expenses]);

  // Property-wise Outstanding (Client + Server merge)
  const clientPropertyDues = useMemo(
    () =>
      computePropertyOutstandingRows({
        properties,
        invoices,
        receipts,
        billAllocations,
        owners,
        ownerships,
      }),
    [properties, invoices, receipts, billAllocations, owners, ownerships]
  );

  const propertyDues = useMemo<PropertyOutstandingRow[]>(() => {
    if (clientPropertyDues.length > 0) return clientPropertyDues;
    if (activeReport === 'property_due' && Array.isArray(serverReport?.data)) {
      return serverReport.data.map((r: any) => {
        const due = toReportAmount(r.Outstanding);
        return {
          propertyId: String(r.PropertyID || ''),
          flatNo: String(r.Flat_No || r.PropertyID || ''),
          tower: String(r.Block_Tower || ''),
          ownerName: String(r.Owner_Name || 'Registered Owner'),
          invoiceCount: Number(r.Invoice_Count || 0),
          totalBilled: toReportAmount(r.Total_Billed),
          totalPaid: toReportAmount(r.Total_Paid),
          totalDue: due,
          status: due === 0 ? ('Clear' as const) : ('Pending' as const),
        };
      });
    }
    return [];
  }, [clientPropertyDues, activeReport, serverReport]);

  const filteredPropertyDues = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    return propertyDues.filter((item) => {
      if (propertyFilter === 'pending' && item.totalDue <= 0) return false;
      if (propertyFilter === 'clear' && item.totalDue > 0) return false;
      if (!q) return true;
      return (
        item.flatNo.toLowerCase().includes(q) ||
        item.tower.toLowerCase().includes(q) ||
        item.ownerName.toLowerCase().includes(q) ||
        item.propertyId.toLowerCase().includes(q)
      );
    });
  }, [propertyDues, propertyFilter, propertySearch]);

  // Owner-wise Outstanding (Server + Client fallback)
  const clientOwnerDues = useMemo(
    () =>
      computeOwnerOutstandingRows({
        invoices,
        receipts,
        billAllocations,
        owners,
        properties,
      }),
    [invoices, receipts, billAllocations, owners, properties]
  );

  const ownerDues = useMemo(() => {
    if (activeReport === 'owner_due' && Array.isArray(serverReport?.data) && serverReport.data.length > 0) {
      return serverReport.data;
    }
    return clientOwnerDues;
  }, [activeReport, serverReport, clientOwnerDues]);

  // Ownership-wise Outstanding Maintenance (Bill Wise Details Allocated_Amount grouped by Ownership_ID + Floor_No)
  const clientOwnershipDues = useMemo(
    () =>
      computeOwnershipOutstandingClient({
        invoices,
        receipts,
        billAllocations,
        ownerships,
        properties,
        owners,
      }),
    [invoices, receipts, billAllocations, ownerships, properties, owners]
  );

  const useClientOwnershipReport =
    (invoices.length > 0 || billAllocations.length > 0) &&
    (hasPermission('Bill Wise Details', 'Can_View') || serverReport?.reportType !== 'ownershipOutstanding');

  const ownershipDuesRows = useMemo(() => {
    const propById = new Map(properties.map((p) => [String(p.PropertyID || '').trim(), p]));
    const propByFlat = new Map(properties.map((p) => [String(p.Flat_No || '').trim().toLowerCase(), p]));
    const rawRows =
      !useClientOwnershipReport &&
      activeReport === 'ownership_due' &&
      serverReport?.reportType === 'ownershipOutstanding' &&
      Array.isArray(serverReport?.data)
        ? serverReport.data
        : clientOwnershipDues.data;

    return rawRows.map((r: any) => {
      if (r.Floor_No !== undefined && r.Floor_No !== null && String(r.Floor_No).trim() !== '') {
        return r;
      }
      const prop =
        propById.get(String(r.PropertyID || '').trim()) ||
        propByFlat.get(String(r.Flat_No || '').trim().toLowerCase());
      return {
        ...r,
        Floor_No: resolveFloorValue(prop, r),
      };
    });
  }, [useClientOwnershipReport, activeReport, serverReport, clientOwnershipDues.data, properties]);

  const ownershipDuesSummary = useMemo(() => {
    if (
      !useClientOwnershipReport &&
      activeReport === 'ownership_due' &&
      serverReport?.reportType === 'ownershipOutstanding' &&
      serverReport?.summary
    ) {
      return serverReport.summary;
    }
    return clientOwnershipDues.summary;
  }, [useClientOwnershipReport, activeReport, serverReport, clientOwnershipDues.summary]);

  const ownershipFloorGroups = useMemo(
    () => groupOwnershipOutstandingByFloor(ownershipDuesRows, properties),
    [ownershipDuesRows, properties]
  );

  useEffect(() => {
    if (
      selectedOwnershipFloor !== 'all' &&
      !ownershipFloorGroups.some((g) => g.floorKey === selectedOwnershipFloor)
    ) {
      setSelectedOwnershipFloor('all');
    }
  }, [ownershipFloorGroups, selectedOwnershipFloor]);

  const filteredOwnershipFloorGroups = useMemo(
    () =>
      selectedOwnershipFloor === 'all'
        ? ownershipFloorGroups
        : ownershipFloorGroups.filter((g) => g.floorKey === selectedOwnershipFloor),
    [ownershipFloorGroups, selectedOwnershipFloor]
  );

  const filteredOwnershipRows = useMemo(
    () => filteredOwnershipFloorGroups.flatMap((g) => g.rows),
    [filteredOwnershipFloorGroups]
  );

  const ownershipTotalAllocatedPaid = useMemo(
    () =>
      Math.round(
        ownershipDuesRows.reduce((s: number, r: any) => s + toReportAmount(r.Total_Paid), 0) * 100
      ) / 100,
    [ownershipDuesRows]
  );

  // Expense Summary (Server + Client fallback)
  const clientExpenseCategories = useMemo(() => {
    const grouped = new Map<string, { Category: string; Count: number; Total: number }>();
    effectiveMonthExpenses.forEach((e: any) => {
      const cat = String(e.Expense_Category || 'Uncategorized');
      const cur = grouped.get(cat) || { Category: cat, Count: 0, Total: 0 };
      cur.Count += 1;
      cur.Total = Math.round((cur.Total + toReportAmount(e.Payment_Amount)) * 100) / 100;
      grouped.set(cat, cur);
    });
    return Array.from(grouped.values()).sort((a, b) => b.Total - a.Total);
  }, [effectiveMonthExpenses]);

  const expenseCategoriesData = useMemo(() => {
    if (activeReport === 'expense_summary' && Array.isArray(serverReport?.data) && serverReport.data.length > 0) {
      return serverReport.data;
    }
    return clientExpenseCategories;
  }, [activeReport, serverReport, clientExpenseCategories]);

  // Financial Year summary (Server + Client fallback)
  const fyClientSummary = useMemo(() => {
    const from = activeFYRange.startDate;
    const to = activeFYRange.endDate;
    const fyInv = computeConfirmedInvoiceMetrics(invoices, receipts, billAllocations).filter(({ inv }) => {
      const d = toReportDateKey(inv.Billing_Date);
      return d && d >= from && d <= to;
    });
    const fyRec = receipts.filter((r) => {
      if (String(r.Receipt_Status || (r as any).Status || '').trim().toLowerCase() !== 'confirmed') return false;
      const d = toReportDateKey(r.Date_Of_Received);
      return d && d >= from && d <= to;
    });
    const fyExp = expenses.filter((e) => {
      if (String(e.Expense_Status || '').trim().toLowerCase() !== 'paid') return false;
      const d = toReportDateKey(e.Payment_Date);
      return d && d >= from && d <= to;
    });
    const billed = fyInv.reduce((s, x) => s + x.net, 0);
    const receiptsTotal = fyRec.reduce((s, r) => s + toReportAmount(r.Received_Amount), 0);
    const paidTotal = fyExp.reduce((s, e) => s + toReportAmount(e.Payment_Amount), 0);
    const outstanding = fyInv.reduce((s, x) => s + x.due, 0);
    const maintRateInfo = computeMaintenanceCollectionRate({
      invoices,
      receipts,
      billAllocations,
      rates,
      periodStart: from,
      periodEnd: to,
    });
    return {
      fyName: activeFYRange.fyName,
      openingFundBalance: fyOpeningFallback,
      openingSource: fundBalanceSummary?.sourceStatus || 'Fund Balance Register',
      closingFundBalance: Math.round((fyOpeningFallback + receiptsTotal - paidTotal) * 100) / 100,
      invoiceCount: fyInv.length,
      receiptCount: fyRec.length,
      expenseCount: fyExp.length,
      billed,
      receipts: receiptsTotal,
      paidExpenses: paidTotal,
      outstanding,
      maintenanceBilled: maintRateInfo.maintenanceBilled,
      maintenanceCollected: maintRateInfo.maintenanceCollected,
      maintenanceCollectionRate: maintRateInfo.maintenanceCollectionRate,
    };
  }, [activeFYRange, invoices, receipts, billAllocations, expenses, rates, fyOpeningFallback, fundBalanceSummary]);

  const fySummary = useMemo(() => {
    if (activeReport === 'fy' && serverReport?.data) {
      return { ...fyClientSummary, ...serverReport.data };
    }
    return fyClientSummary;
  }, [activeReport, serverReport, fyClientSummary]);

  // Account Heads for Balance Sheet Reference (Sheet U)
  const effectiveAccountHeads = useMemo(() => {
    if (accountHeads.length > 0) return accountHeads;
    const serverHeads = balanceSheetReport?.data?.accountHeads;
    return Array.isArray(serverHeads) ? serverHeads : [];
  }, [accountHeads, balanceSheetReport]);

  const handleExportCSV = (filename: string, rows: string[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const canCreateYearEnd = hasPermission('Reports', 'Can_Create') || currentUser.Role === 'Admin';

  return (
    <div className="space-y-6">
      {/* Title & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E1D4] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#536B4D]" />
            {t.navReports} / আর্থিক হিসাব ও অডিট রিপোর্ট
          </h1>
          <p className="text-xs text-gray-500">
            Cash-basis Receipt & Payment statements, verified outstanding ledgers, and balance sheet disclosures
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => setReloadNonce((n) => n + 1)}
            className="flex items-center gap-1.5 rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#536B4D] ${serverReportLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] transition-colors cursor-pointer"
          >
            <Printer className="h-4 w-4 text-[#536B4D]" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex flex-wrap gap-1 bg-[#F7F4EC] p-1.5 rounded-2xl border border-[#E8E1D4] no-print">
        <button
          onClick={() => handleSelectReport('monthly')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'monthly' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70 hover:text-[#29352D]'
          }`}
        >
          Monthly Receipt & Payment (Cash Basis)
        </button>
        <button
          onClick={() => handleSelectReport('fy')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'fy' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70 hover:text-[#29352D]'
          }`}
        >
          Financial Year
        </button>
        <button
          onClick={() => handleSelectReport('property_due')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'property_due' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70 hover:text-[#29352D]'
          }`}
        >
          Property-wise Outstanding ({propertyDues.length || properties.length} Flats)
        </button>
        <button
          onClick={() => handleSelectReport('expense_summary')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'expense_summary' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70 hover:text-[#29352D]'
          }`}
        >
          Expense Summary
        </button>
        <button
          onClick={() => handleSelectReport('owner_due')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'owner_due' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70 hover:text-[#29352D]'
          }`}
        >
          Owner-wise Outstanding
        </button>
        <button
          onClick={() => handleSelectReport('ownership_due')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'ownership_due' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70 hover:text-[#29352D]'
          }`}
        >
          Ownership-wise Outstanding Maintenance
        </button>
        {canCreateYearEnd && (
          <button
            onClick={() => handleSelectReport('year_end')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'year_end' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70 hover:text-[#29352D]'
            }`}
          >
            Year-End Closing & Carry Forward
          </button>
        )}
        <button
          onClick={() => handleSelectReport('balancesheet')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'balancesheet' ? 'bg-white text-[#C97958] shadow-xs' : 'text-[#29352D]/70 hover:text-[#29352D]'
          }`}
        >
          Balance Sheet Status (Accrual Basis)
        </button>
      </div>

      {/* Live Server Status Banner (when syncing or error) */}
      {activeReport !== 'balancesheet' && activeReport !== 'year_end' && (serverReportLoading || serverReportError) && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs flex items-center justify-between ${
            serverReportError
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-[#E8E1D4] bg-white text-gray-600'
          }`}
        >
          <span>
            {serverReportLoading
              ? 'Syncing live report from Google Sheets…'
              : `Live sheet sync note: ${serverReportError} (showing loaded society records).`}
          </span>
          {serverReport?.generatedAt && (
            <span className="text-[10px] text-gray-500">{formatDateTimeDisplay(serverReport.generatedAt)}</span>
          )}
        </div>
      )}

      {/* REPORT 1: MONTHLY RECEIPT & PAYMENT STATEMENT */}
      {activeReport === 'monthly' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E8E1D4] pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D] uppercase">
                  Accounting Basis: Pure Cash Flow
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#F7F4EC] text-[#29352D] border border-[#E8E1D4]">
                  Opening Source: {openingBankSource}
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#29352D] mt-1">
                Monthly Receipt & Payment Account / মাসিক প্রাপ্তি ও পরিশোধ
              </h2>
              <p className="text-xs text-gray-500">
                For the period of {monthPeriodLabel} • Realized inflows and disbursed payments only
              </p>
            </div>

            <div className="flex items-center gap-2 no-print">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-xs font-bold text-[#29352D]"
              >
                {monthOptions.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatMonthYearDisplay(ym)}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  const rows: string[][] = [
                    [`${societySettings.societyName || 'Housing Society'} - Monthly Receipt & Payment Statement`],
                    ['Period', monthPeriodLabel],
                    ['Opening Source', openingBankSource],
                    ['Opening Balance', computedOpeningAtMonthStart.toFixed(2)],
                    ['Confirmed Cash Inflows', totalMonthInflow.toFixed(2)],
                    ['Paid Cash Outflows', totalMonthOutflow.toFixed(2)],
                    ['Net Cash Movement', (totalMonthInflow - totalMonthOutflow).toFixed(2)],
                    ['Closing Balance', closingBank.toFixed(2)],
                    [],
                    ['Type', 'Date', 'Ref / Voucher', 'Particulars', 'Mode', 'Amount (INR)'],
                    ...effectiveMonthReceipts.map((r: any) => [
                      'Receipt',
                      formatDateDisplay(r.Date_Of_Received),
                      String(r.Receipt_Number || r.Transaction_ID || ''),
                      `Flat ${r.Flat_No || ''} - ${r.Owner_Name || 'Resident'}`,
                      String(r.Received_Mode || ''),
                      toReportAmount(r.Received_Amount).toFixed(2),
                    ]),
                    ...effectiveMonthExpenses.map((e: any) => [
                      'Payment',
                      formatDateDisplay(e.Payment_Date),
                      String(e.Voucher_No || e.Expense_ID || ''),
                      `${e.Expense_Category || 'Expense'} - ${e.Payee_Name || ''}`,
                      String(e.Payment_Mode || ''),
                      toReportAmount(e.Payment_Amount).toFixed(2),
                    ]),
                  ];
                  handleExportCSV(`Receipt_Payment_${formatMonthYearDisplay(selectedMonth)}`, rows);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#536B4D] text-white text-xs font-bold hover:bg-[#3F523A] transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] p-3.5">
              <span className="text-gray-500">Opening Fund Balance</span>
              <strong className="block text-base text-[#29352D] mt-1">{formatINR(computedOpeningAtMonthStart)}</strong>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
              <span className="text-emerald-800">Confirmed Receipts ({effectiveMonthReceipts.length})</span>
              <strong className="block text-base text-emerald-900 mt-1">{formatINR(totalMonthInflow)}</strong>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5">
              <span className="text-red-800">Paid Expenses ({effectiveMonthExpenses.length})</span>
              <strong className="block text-base text-red-900 mt-1">{formatINR(totalMonthOutflow)}</strong>
            </div>
            <div className="rounded-xl bg-[#536B4D]/10 border border-[#536B4D]/30 p-3.5">
              <span className="text-[#536B4D] font-semibold">Closing Fund Balance</span>
              <strong className="block text-base text-[#29352D] mt-1">{formatINR(closingBank)}</strong>
            </div>
          </div>

          {/* Two-Column T-Account Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Receipts Column */}
            <div className="rounded-xl border border-[#E8E1D4] overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-[#536B4D] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                  <span>RECEIPTS (INFLOWS)</span>
                  <span>AMOUNT (₹)</span>
                </div>
                <div className="p-4 space-y-2 text-xs divide-y divide-[#E8E1D4]">
                  <div className="flex justify-between font-bold text-[#536B4D] pb-2">
                    <span>To Opening Bank & Cash Balance:</span>
                    <span>{formatINR(computedOpeningAtMonthStart)}</span>
                  </div>
                  {effectiveMonthReceipts.map((r: any, idx: number) => {
                    const ownerShort = String(r.Owner_Name || 'Resident').trim().split(/\s+/)[0] || 'Resident';
                    return (
                      <div key={r.Transaction_ID || idx} className="flex justify-between items-start gap-2 py-1.5">
                        <div>
                          <span className="font-medium block">
                            Flat {r.Flat_No || r.PropertyID || '—'} — {ownerShort}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {formatDateDisplay(r.Date_Of_Received, '—')} • {r.Receipt_Number || r.Transaction_ID} • {r.Received_Mode || '—'}
                          </span>
                        </div>
                        <span className="font-semibold whitespace-nowrap">{formatINR(r.Received_Amount)}</span>
                      </div>
                    );
                  })}
                  {effectiveMonthReceipts.length === 0 && (
                    <div className="py-3 text-gray-400 italic">No confirmed cash receipts in {formatMonthYearDisplay(selectedMonth)}.</div>
                  )}
                </div>
              </div>
              <div className="bg-[#F7F4EC] px-4 py-3 border-t border-[#E8E1D4] flex justify-between items-center text-xs font-bold">
                <span>Total Receipts (incl. Opening):</span>
                <span className="text-sm text-[#536B4D]">{formatINR(computedOpeningAtMonthStart + totalMonthInflow)}</span>
              </div>
            </div>

            {/* Payments Column */}
            <div className="rounded-xl border border-[#E8E1D4] overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-[#C97958] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                  <span>PAYMENTS (OUTFLOWS)</span>
                  <span>AMOUNT (₹)</span>
                </div>
                <div className="p-4 space-y-2 text-xs divide-y divide-[#E8E1D4]">
                  {effectiveMonthExpenses.map((e: any, idx: number) => (
                    <div key={e.Expense_ID || idx} className="flex justify-between items-start gap-2 py-1.5">
                      <div>
                        <span className="font-semibold block">{e.Expense_Category || 'Expense'}</span>
                        <span className="text-[11px] text-gray-500">
                          {formatDateDisplay(e.Payment_Date, '—')} • {e.Payee_Name || '—'} • {e.Voucher_No || e.Expense_ID || ''}
                        </span>
                      </div>
                      <span className="font-semibold whitespace-nowrap">{formatINR(e.Payment_Amount)}</span>
                    </div>
                  ))}
                  {effectiveMonthExpenses.length === 0 && (
                    <div className="py-3 text-gray-400 italic">No paid expenses disbursed in {formatMonthYearDisplay(selectedMonth)}.</div>
                  )}
                  <div className="flex justify-between font-bold text-emerald-800 pt-2">
                    <span>By Closing Fund Balance (c/d):</span>
                    <span>{formatINR(closingBank)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#F7F4EC] px-4 py-3 border-t border-[#E8E1D4] flex justify-between items-center text-xs font-bold">
                <span>Total Outflows + Closing:</span>
                <span className="text-sm text-[#C97958]">{formatINR(totalMonthOutflow + closingBank)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: FINANCIAL YEAR REPORT */}
      {activeReport === 'fy' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E8E1D4] pb-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D] uppercase">
                Financial Year Consolidation
              </span>
              <h2 className="text-lg font-bold text-[#29352D] mt-1">
                Financial Year Summary — {fySummary.fyName || activeFYRange.fyName}
              </h2>
              <p className="text-xs text-gray-500">
                Period: {formatDateDisplay(activeFYRange.startDate)} to {formatDateDisplay(activeFYRange.endDate)} • Source: {fySummary.openingSource || 'Fund Balance Register'}
              </p>
            </div>
            <div className="flex items-center gap-2 no-print">
              {sortedFYs.length > 0 && (
                <select
                  value={selectedFyId || activeFYRange.fyId}
                  onChange={(e) => setSelectedFyId(e.target.value)}
                  className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-xs font-bold text-[#29352D]"
                >
                  {sortedFYs.map((fy) => (
                    <option key={fy.FY_ID} value={fy.FY_ID}>
                      {fy.FY_Name} ({formatDateDisplay(fy.Start_Date)} – {formatDateDisplay(fy.End_Date)})
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => {
                  const rows = [
                    ['Financial Year', fySummary.fyName || activeFYRange.fyName],
                    ['Period', `${formatDateDisplay(activeFYRange.startDate)} to ${formatDateDisplay(activeFYRange.endDate)}`],
                    ['Opening Fund Balance', toReportAmount(fySummary.openingFundBalance).toFixed(2)],
                    ['Total Billed Invoices', toReportAmount(fySummary.billed).toFixed(2)],
                    ['Confirmed Fund Receipts', toReportAmount(fySummary.receipts).toFixed(2)],
                    ['Paid Expenses', toReportAmount(fySummary.paidExpenses).toFixed(2)],
                    ['Closing / Available Fund Balance', toReportAmount(fySummary.closingFundBalance).toFixed(2)],
                    ['FY Invoice Outstanding', toReportAmount(fySummary.outstanding).toFixed(2)],
                    ['Maintenance Collection Rate (%)', `${fySummary.maintenanceCollectionRate ?? '0'}%`],
                  ];
                  handleExportCSV(`Financial_Year_${(fySummary.fyName || activeFYRange.fyName).replace(/\s+/g, '_')}`, rows);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#536B4D] text-white text-xs font-bold hover:bg-[#3F523A] cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" /> Export CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] p-4">
              <span className="text-gray-600">Opening Fund Balance</span>
              <strong className="block text-xl text-[#29352D] mt-1">{formatINR(fySummary.openingFundBalance)}</strong>
              <span className="text-[11px] text-[#536B4D] mt-1 block">{fySummary.openingSource || 'Fund Balance Register'}</span>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <span className="text-emerald-800">Confirmed Fund Receipts ({fySummary.receiptCount || 0})</span>
              <strong className="block text-xl text-emerald-900 mt-1">{formatINR(fySummary.receipts)}</strong>
              <span className="text-[11px] text-emerald-700 mt-1 block">From Fund Inflow Register</span>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <span className="text-red-800">Paid Expenses ({fySummary.expenseCount || 0})</span>
              <strong className="block text-xl text-red-900 mt-1">{formatINR(fySummary.paidExpenses)}</strong>
              <span className="text-[11px] text-red-700 mt-1 block">From Expense Register</span>
            </div>
            <div className="rounded-xl bg-[#536B4D]/10 border border-[#536B4D]/30 p-4">
              <span className="text-[#536B4D] font-semibold">Available / Closing Fund Balance</span>
              <strong className="block text-xl text-[#29352D] mt-1">{formatINR(fySummary.closingFundBalance)}</strong>
              <span className="text-[11px] text-gray-600 mt-1 block">Opening + Receipts − Paid Expenses</span>
            </div>
            <div className="rounded-xl bg-white border border-[#E8E1D4] p-4">
              <span className="text-gray-600">Total Maintenance Billed ({fySummary.invoiceCount || 0} invoices)</span>
              <strong className="block text-xl text-[#29352D] mt-1">{formatINR(fySummary.billed)}</strong>
              <span className="text-[11px] text-gray-500 mt-1 block">From Invoice Register (excl. cancelled)</span>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <span className="text-amber-900">Outstanding Maintenance Dues (FY)</span>
              <strong className="block text-xl text-red-700 mt-1">{formatINR(fySummary.outstanding)}</strong>
              <span className="text-[11px] text-amber-800 mt-1 block">Net billed less confirmed allocations</span>
            </div>
            <div className="rounded-xl bg-white border border-[#E8E1D4] p-4">
              <span className="text-gray-600">Maintenance Collection Rate</span>
              <strong className="block text-xl text-[#536B4D] mt-1">{fySummary.maintenanceCollectionRate ?? '0'}%</strong>
              <span className="text-[11px] text-gray-500 mt-1 block">
                {formatINR(fySummary.maintenanceCollected)} / {formatINR(fySummary.maintenanceBilled)} allocated (Maintenance only)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 3: PROPERTY-WISE OUTSTANDING */}
      {activeReport === 'property_due' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-[#29352D] text-sm">
                Property-wise Outstanding Ledger / ফ্ল্যাটভিত্তিক বকেয়া তালিকা
              </h3>
              <p className="text-xs text-gray-500">
                Live status across {propertyDues.length} community units • Pending: {propertyDues.filter((p) => p.totalDue > 0).length} • Total Due:{' '}
                <strong className="text-red-700">
                  {formatINR(propertyDues.reduce((s, p) => s + p.totalDue, 0))}
                </strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <input
                type="text"
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                placeholder="Search flat or owner…"
                className="rounded-xl border border-[#E8E1D4] bg-white px-3 py-1.5 text-xs"
              />
              <select
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value as 'all' | 'pending' | 'clear')}
                className="rounded-xl border border-[#E8E1D4] bg-white px-3 py-1.5 text-xs font-semibold"
              >
                <option value="all">All Flats ({propertyDues.length})</option>
                <option value="pending">Pending Dues ({propertyDues.filter((p) => p.totalDue > 0).length})</option>
                <option value="clear">Cleared ({propertyDues.filter((p) => p.totalDue === 0).length})</option>
              </select>
              <button
                onClick={() => {
                  const rows = [
                    ['PropertyID', 'Flat_No', 'Block_Tower', 'Owner_Name', 'Invoices', 'Total_Billed', 'Total_Paid', 'Outstanding_Due', 'Status'],
                    ...filteredPropertyDues.map((p) => [
                      p.propertyId,
                      p.flatNo,
                      p.tower,
                      p.ownerName,
                      String(p.invoiceCount),
                      p.totalBilled.toFixed(2),
                      p.totalPaid.toFixed(2),
                      p.totalDue.toFixed(2),
                      p.status,
                    ]),
                  ];
                  handleExportCSV('Property_Outstanding_Ledger', rows);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#536B4D] text-white text-xs font-bold hover:bg-[#3F523A] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV ({filteredPropertyDues.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Flat No</th>
                  <th className="px-4 py-3 font-semibold">Block / Tower</th>
                  <th className="px-4 py-3 font-semibold">Owner Name</th>
                  <th className="px-4 py-3 font-semibold text-right">Invoices</th>
                  <th className="px-4 py-3 font-semibold text-right">Billed (₹)</th>
                  <th className="px-4 py-3 font-semibold text-right">Paid (₹)</th>
                  <th className="px-4 py-3 font-semibold text-right">Outstanding (₹)</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {filteredPropertyDues.map((item) => (
                  <tr key={item.propertyId} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-sm text-[#29352D]">{item.flatNo}</td>
                    <td className="px-4 py-3 font-medium text-[#536B4D]">{item.tower || '—'}</td>
                    <td className="px-4 py-3 font-medium">{item.ownerName}</td>
                    <td className="px-4 py-3 text-right">{item.invoiceCount}</td>
                    <td className="px-4 py-3 text-right">{formatINR(item.totalBilled)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatINR(item.totalPaid)}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {item.totalDue > 0 ? (
                        <span className="text-red-700">{formatINR(item.totalDue)}</span>
                      ) : (
                        <span className="text-emerald-700">₹0.00 (Cleared)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.totalDue === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredPropertyDues.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      {serverReportLoading ? 'Loading property outstanding records…' : 'No matching property records found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: EXPENSE SUMMARY */}
      {activeReport === 'expense_summary' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-[#29352D] text-sm">
                Category-wise Expense Summary / খাতভিত্তিক ব্যয় সারাংশ
              </h3>
              <p className="text-xs text-gray-500">
                Paid vouchers for {monthPeriodLabel} • Total Paid:{' '}
                <strong className="text-[#C97958]">
                  {formatINR(expenseCategoriesData.reduce((s: number, r: any) => s + toReportAmount(r.Total), 0))}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-2 no-print">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-[#E8E1D4] bg-white px-3 py-1.5 text-xs font-bold text-[#29352D]"
              >
                {monthOptions.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatMonthYearDisplay(ym)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const rows = [
                    ['Expense_Category', 'Paid_Vouchers', 'Total_Paid'],
                    ...expenseCategoriesData.map((r: any) => [
                      String(r.Category || ''),
                      String(r.Count || 0),
                      toReportAmount(r.Total).toFixed(2),
                    ]),
                  ];
                  handleExportCSV(`Expense_Summary_${formatMonthYearDisplay(selectedMonth)}`, rows);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#536B4D] text-white text-xs font-bold hover:bg-[#3F523A] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Expense Category</th>
                  <th className="px-4 py-3 font-semibold text-right">Paid Vouchers</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Paid (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {expenseCategoriesData.map((r: any) => (
                  <tr key={r.Category} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-semibold text-[#29352D]">{r.Category}</td>
                    <td className="px-4 py-3 text-right">{r.Count}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#C97958]">{formatINR(r.Total)}</td>
                  </tr>
                ))}
                {expenseCategoriesData.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                      No paid expenses recorded for {formatMonthYearDisplay(selectedMonth)}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 5: OWNER-WISE OUTSTANDING */}
      {activeReport === 'owner_due' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-[#29352D] text-sm">
                Owner-wise Outstanding Ledger / মালিকভিত্তিক বকেয়া তালিকা
              </h3>
              <p className="text-xs text-gray-500">
                Owners with pending dues: {ownerDues.length} • Total Outstanding:{' '}
                <strong className="text-red-700">
                  {formatINR(ownerDues.reduce((s: number, r: any) => s + toReportAmount(r.Outstanding), 0))}
                </strong>
              </p>
            </div>
            <button
              onClick={() => {
                const rows = [
                  ['OwnerID', 'Owner_Name', 'Flats', 'Invoices', 'Total_Billed', 'Total_Paid', 'Outstanding'],
                  ...ownerDues.map((r: any) => [
                    String(r.OwnerID || ''),
                    String(r.Owner_Name || ''),
                    String(r.Flat_Numbers || ''),
                    String(r.Invoice_Count || 0),
                    toReportAmount(r.Total_Billed).toFixed(2),
                    toReportAmount(r.Total_Paid).toFixed(2),
                    toReportAmount(r.Outstanding).toFixed(2),
                  ]),
                ];
                handleExportCSV('Owner_Outstanding_Ledger', rows);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#536B4D] text-white text-xs font-bold hover:bg-[#3F523A] no-print cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Owner ID</th>
                  <th className="px-4 py-3 font-semibold">Owner Name</th>
                  <th className="px-4 py-3 font-semibold">Flats</th>
                  <th className="px-4 py-3 font-semibold text-right">Invoices</th>
                  <th className="px-4 py-3 font-semibold text-right">Billed (₹)</th>
                  <th className="px-4 py-3 font-semibold text-right">Paid (₹)</th>
                  <th className="px-4 py-3 font-semibold text-right">Outstanding (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {ownerDues.map((r: any, idx: number) => (
                  <tr key={`${r.OwnerID}-${idx}`} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{r.OwnerID || '—'}</td>
                    <td className="px-4 py-3 font-bold text-[#29352D]">{r.Owner_Name || 'Registered Owner'}</td>
                    <td className="px-4 py-3">{r.Flat_Numbers || `${r.Property_Count || 0} unit(s)`}</td>
                    <td className="px-4 py-3 text-right">{r.Invoice_Count || 0}</td>
                    <td className="px-4 py-3 text-right">{formatINR(r.Total_Billed)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatINR(r.Total_Paid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">{formatINR(r.Outstanding)}</td>
                  </tr>
                ))}
                {ownerDues.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {serverReportLoading ? 'Loading owner-wise outstanding ledger…' : 'No owner-wise outstanding dues found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 6: OWNERSHIP-WISE OUTSTANDING MAINTENANCE (BY FLOOR & OWNERSHIP_ID) */}
      {activeReport === 'ownership_due' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#E8E1D4] pb-3">
            <div>
              <h3 className="font-bold text-[#29352D] text-sm">
                Ownership-wise Outstanding Maintenance / মালিকানাভিত্তিক বকেয়া রক্ষণাবেক্ষণ
              </h3>
              <p className="text-xs text-gray-500">
                Grouped by Floor (Floor No.) &amp; Ownership_ID • Paid checked from Bill Wise Details (Invoice &amp; Owner wise)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <select
                aria-label="Filter by Floor"
                value={selectedOwnershipFloor}
                onChange={(e) => setSelectedOwnershipFloor(e.target.value)}
                className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-1.5 text-xs font-semibold text-[#29352D]"
              >
                <option value="all">All Floors ({ownershipFloorGroups.length})</option>
                {ownershipFloorGroups.map((g) => (
                  <option key={g.floorKey} value={g.floorKey}>
                    {g.floorLabel} ({g.ownershipCount})
                  </option>
                ))}
              </select>

              <div className="inline-flex rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setOwnershipViewMode('by_floor')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    ownershipViewMode === 'by_floor'
                      ? 'bg-white text-[#536B4D] shadow-2xs font-bold'
                      : 'text-[#29352D]/70 hover:text-[#29352D]'
                  }`}
                >
                  By Floor
                </button>
                <button
                  type="button"
                  onClick={() => setOwnershipViewMode('flat_list')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    ownershipViewMode === 'flat_list'
                      ? 'bg-white text-[#536B4D] shadow-2xs font-bold'
                      : 'text-[#29352D]/70 hover:text-[#29352D]'
                  }`}
                >
                  All Ownerships
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowOwnershipPrintModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E1D4] bg-white text-[#29352D] text-xs font-bold hover:bg-[#F7F4EC] cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-[#536B4D]" /> Print/Download PDF
              </button>
              <button
                onClick={() => {
                  const rows = [
                    ['Floor_No', 'Ownership_ID', 'PropertyID', 'Flat_No', 'Owner_Name', 'Start_Date', 'End_Date', 'Status', 'Invoices', 'Billed', 'Allocated_Paid', 'Outstanding', 'Link_Status'],
                    ...filteredOwnershipRows.map((r: any) => [
                      getFloorMeta(r.Floor_No).floorLabel,
                      String(r.Ownership_ID || ''),
                      String(r.PropertyID || ''),
                      String(r.Flat_No || r.PropertyID || ''),
                      String(r.Owner_Name || r.OwnerID || ''),
                      formatDateDisplay(r.Ownership_Start_Date, '—'),
                      formatDateDisplay(r.Ownership_End_Date, 'Current'),
                      String(r.Ownership_Status || ''),
                      String(r.Invoice_Count || 0),
                      toReportAmount(r.Total_Billed).toFixed(2),
                      toReportAmount(r.Total_Paid).toFixed(2),
                      toReportAmount(r.Outstanding).toFixed(2),
                      String(r.Data_Link_Status || ''),
                    ]),
                  ];
                  handleExportCSV('Ownership_Outstanding_Maintenance_By_Floor', rows);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#536B4D] text-white text-xs font-bold hover:bg-[#3F523A] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV ({filteredOwnershipRows.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] p-3.5">
              <span className="text-gray-600">Floors with Dues</span>
              <strong className="block text-lg text-[#29352D] mt-1">{ownershipFloorGroups.length}</strong>
            </div>
            <div className="rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] p-3.5">
              <span className="text-gray-600">Ownership Records with Dues</span>
              <strong className="block text-lg text-[#29352D] mt-1">{Number(ownershipDuesSummary?.ownershipCount || 0)}</strong>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
              <span className="text-emerald-800">Allocated Paid (Bill Wise Details)</span>
              <strong className="block text-lg text-emerald-800 mt-1">{formatINR(ownershipTotalAllocatedPaid)}</strong>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5">
              <span className="text-red-800">Total Outstanding</span>
              <strong className="block text-lg text-red-700 mt-1">{formatINR(ownershipDuesSummary?.totalOutstanding)}</strong>
            </div>
          </div>

          {Number(ownershipDuesSummary?.unlinkedInvoiceCount || 0) > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs text-amber-900">
              Unlinked Legacy Invoices: <strong>{Number(ownershipDuesSummary?.unlinkedInvoiceCount || 0)}</strong> invoice(s) have no Ownership_ID linked.
            </div>
          )}

          {/* Floor-wise Summary Strip */}
          {ownershipFloorGroups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#536B4D]">
                  Floor-wise Summary / ফ্লোরভিত্তিক বকেয়া সারসংক্ষেপ
                </span>
                {selectedOwnershipFloor !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedOwnershipFloor('all')}
                    className="text-xs font-semibold text-[#536B4D] hover:underline cursor-pointer no-print"
                  >
                    Show All Floors
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                {ownershipFloorGroups.map((grp) => {
                  const isSelected = selectedOwnershipFloor === grp.floorKey;
                  return (
                    <button
                      key={grp.floorKey}
                      type="button"
                      onClick={() =>
                        setSelectedOwnershipFloor((cur) => (cur === grp.floorKey ? 'all' : grp.floorKey))
                      }
                      className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#536B4D] bg-[#536B4D]/10'
                          : 'border-[#E8E1D4] bg-[#F7F4EC]/60 hover:bg-[#F7F4EC]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[#29352D]">{grp.floorLabel}</span>
                        <span className="text-[10px] font-semibold text-gray-500">
                          {grp.ownershipCount} unit{grp.ownershipCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <strong className="block text-sm text-red-700 mt-1">{formatINR(grp.totalOutstanding)}</strong>
                      <span className="block text-[10px] text-emerald-700 mt-0.5">
                        Paid: {formatINR(grp.totalPaid)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grouped by Floor Display */}
          {ownershipViewMode === 'by_floor' && (
            <div className="space-y-4">
              {filteredOwnershipFloorGroups.map((grp) => (
                <div key={grp.floorKey} className="overflow-hidden rounded-xl border border-[#E8E1D4]">
                  <div className="bg-[#536B4D] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{grp.floorLabel}</span>
                      <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                        {grp.ownershipCount} ownership{grp.ownershipCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[11px]">
                      <span>Billed: <strong>{formatINR(grp.totalBilled)}</strong></span>
                      <span>Paid (Allocated): <strong>{formatINR(grp.totalPaid)}</strong></span>
                      <span className="rounded-md bg-white px-2 py-0.5 text-red-700 font-bold">
                        Floor Due: {formatINR(grp.totalOutstanding)}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F7F4EC] text-[#29352D] border-b border-[#E8E1D4]">
                        <tr>
                          <th className="p-3 font-bold">Ownership ID</th>
                          <th className="p-3 font-bold">PropertyID / Flat</th>
                          <th className="p-3 font-bold">Owner</th>
                          <th className="p-3 font-bold">Ownership Period</th>
                          <th className="p-3 font-bold">Status</th>
                          <th className="p-3 font-bold text-right">Invoices</th>
                          <th className="p-3 font-bold text-right">Billed</th>
                          <th className="p-3 font-bold text-right">Paid (Allocated)</th>
                          <th className="p-3 font-bold text-right text-red-700">Outstanding</th>
                          <th className="p-3 font-bold">Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E1D4]">
                        {grp.rows.map((r: any, i: number) => (
                          <tr key={`${r.Ownership_ID}-${r.PropertyID}-${i}`} className="hover:bg-neutral-50">
                            <td className="p-3 font-mono">{r.Ownership_ID}</td>
                            <td className="p-3">
                              <span className="font-semibold text-[#536B4D]">{r.Flat_No || r.PropertyID}</span>
                              {r.PropertyID && r.Flat_No && r.PropertyID !== r.Flat_No && (
                                <span className="block text-[10px] font-mono text-gray-500">{r.PropertyID}</span>
                              )}
                            </td>
                            <td className="p-3">{r.Owner_Name || r.OwnerID || '—'}</td>
                            <td className="p-3 whitespace-nowrap">
                              {formatDateDisplay(r.Ownership_Start_Date, '—')} to {formatDateDisplay(r.Ownership_End_Date, 'Current')}
                            </td>
                            <td className="p-3">{r.Ownership_Status}</td>
                            <td className="p-3 text-right">{r.Invoice_Count}</td>
                            <td className="p-3 text-right">{formatINR(r.Total_Billed)}</td>
                            <td className="p-3 text-right text-emerald-700">{formatINR(r.Total_Paid)}</td>
                            <td className="p-3 text-right font-semibold text-red-700">{formatINR(r.Outstanding)}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.Data_Link_Status === 'Linked' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {r.Data_Link_Status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#F7F4EC]/80 border-t border-[#E8E1D4] font-bold text-[#29352D]">
                        <tr>
                          <td colSpan={5} className="p-3">{grp.floorLabel} Subtotal</td>
                          <td className="p-3 text-right">{grp.invoiceCount}</td>
                          <td className="p-3 text-right">{formatINR(grp.totalBilled)}</td>
                          <td className="p-3 text-right text-emerald-700">{formatINR(grp.totalPaid)}</td>
                          <td className="p-3 text-right text-red-700">{formatINR(grp.totalOutstanding)}</td>
                          <td className="p-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}
              {filteredOwnershipFloorGroups.length === 0 && (
                <div className="rounded-xl border border-[#E8E1D4] p-6 text-center text-xs text-gray-500">
                  {serverReportLoading ? 'Loading ownership-wise outstanding maintenance report…' : 'No outstanding ownership maintenance dues found.'}
                </div>
              )}
            </div>
          )}

          {/* Flat List Display (All Ownerships with Floor Column) */}
          {ownershipViewMode === 'flat_list' && (
            <div className="overflow-x-auto rounded-xl border border-[#E8E1D4]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#536B4D] text-white">
                  <tr>
                    <th className="p-3">Floor</th>
                    <th className="p-3">Ownership ID</th>
                    <th className="p-3">PropertyID / Flat</th>
                    <th className="p-3">Owner</th>
                    <th className="p-3">Ownership Period</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Invoices</th>
                    <th className="p-3 text-right">Billed</th>
                    <th className="p-3 text-right">Paid (Allocated)</th>
                    <th className="p-3 text-right">Outstanding</th>
                    <th className="p-3">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D4]">
                  {filteredOwnershipRows.map((r: any, i: number) => (
                    <tr key={`${r.Ownership_ID}-${r.PropertyID}-${i}`} className="hover:bg-neutral-50">
                      <td className="p-3 font-semibold text-[#29352D]">{getFloorMeta(r.Floor_No).floorLabel}</td>
                      <td className="p-3 font-mono">{r.Ownership_ID}</td>
                      <td className="p-3">
                        <span className="font-semibold">{r.Flat_No || r.PropertyID}</span>
                        {r.PropertyID && r.Flat_No && r.PropertyID !== r.Flat_No && (
                          <span className="block text-[10px] font-mono text-gray-500">{r.PropertyID}</span>
                        )}
                      </td>
                      <td className="p-3">{r.Owner_Name || r.OwnerID || '—'}</td>
                      <td className="p-3 whitespace-nowrap">
                        {formatDateDisplay(r.Ownership_Start_Date, '—')} to {formatDateDisplay(r.Ownership_End_Date, 'Current')}
                      </td>
                      <td className="p-3">{r.Ownership_Status}</td>
                      <td className="p-3 text-right">{r.Invoice_Count}</td>
                      <td className="p-3 text-right">{formatINR(r.Total_Billed)}</td>
                      <td className="p-3 text-right text-emerald-700">{formatINR(r.Total_Paid)}</td>
                      <td className="p-3 text-right font-semibold text-red-700">{formatINR(r.Outstanding)}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.Data_Link_Status === 'Linked' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.Data_Link_Status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredOwnershipRows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-gray-500">
                        {serverReportLoading ? 'Loading ownership-wise outstanding maintenance report…' : 'No outstanding ownership maintenance dues found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-amber-700">
            Outstanding maintenance is grouped by Floor (Floor No.) and Ownership_ID, calculated by summing Allocated_Amount from Bill Wise Details grouped by Ownership_ID and deducting from Invoice Register Net_Charge_Amount.
          </p>
        </div>
      )}

      {/* REPORT 7: YEAR-END CLOSING */}
      {activeReport === 'year_end' && <YearEndClosingWorkflow />}

      {/* REPORT 8: ACCRUAL BALANCE SHEET DISCLOSURE (SECTION 5 NOTE & SECTION 13) */}
      {activeReport === 'balancesheet' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-6">
          <div className="border-b border-[#E8E1D4] pb-4">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#C97958]/10 text-[#C97958] uppercase">
              Financial Architecture Compliance
            </span>
            <h2 className="text-lg font-bold text-[#29352D] mt-1">
              Statutory Balance Sheet Disclosure / অ্যাকাউন্টিং পদ্ধতি
            </h2>
            <p className="text-xs text-gray-500">
              Mandatory disclosure in compliance with Section 5 (Table U Note) & Section 13
            </p>
          </div>

          {/* Explicit Accounting Basis Banner */}
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
              <Info className="h-5 w-5 text-amber-700" />
              Accounting Basis Notice:
            </div>
            <p>
              A true accrual-based Balance Sheet requires double-entry General Journal Vouchers, Journal Details, Depreciation Schedules, and Prepaid Expense amortization. In strict compliance with the project guidelines:
            </p>
            <p className="font-semibold italic">
              "Do not show a falsely complete Balance Sheet using only cash receipts and payments. Clearly identify the accounting basis of every report. For Balance Sheet, do not invent missing journal entries, assets or liabilities."
            </p>
            <p>
              In Phase 1, ABAS SATHI maintains complete cash-basis Receipt & Payment books and provides the Account Head Master ledger balances below.
            </p>
          </div>

          <BalanceSheetWorkflow onReportLoaded={setBalanceSheetReport} />

          {/* Account Head Master Reference */}
          <div>
            <h3 className="font-bold text-sm text-[#29352D] mb-3">
              Account Head Master Opening Balance Reference (Sheet U)
            </h3>
            <div className="rounded-xl border border-[#E8E1D4] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#536B4D] text-white">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Account Code</th>
                    <th className="px-4 py-2.5 font-semibold">Account Head Name</th>
                    <th className="px-4 py-2.5 font-semibold">Type</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Balance (₹)</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Dr / Cr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D4]">
                  {effectiveAccountHeads.map((acc: any, idx: number) => (
                    <tr key={acc.Account_ID || acc.Account_Code || idx} className="hover:bg-neutral-50">
                      <td className="px-4 py-2.5 font-mono text-gray-500">{acc.Account_Code || '—'}</td>
                      <td className="px-4 py-2.5 font-bold text-[#29352D]">{acc.Account_Name || '—'}</td>
                      <td className="px-4 py-2.5 font-medium">{acc.Account_Type || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#29352D]">
                        {formatINR(acc.Opening_Balance)}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#536B4D]">{acc.Balance_Type || '—'}</td>
                    </tr>
                  ))}
                  {effectiveAccountHeads.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        No Account Head Master opening balances configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <OwnershipOutstandingPrintModal
        isOpen={showOwnershipPrintModal}
        onClose={() => setShowOwnershipPrintModal(false)}
        floorGroups={filteredOwnershipFloorGroups}
        totalOutstanding={
          selectedOwnershipFloor === 'all'
            ? toReportAmount(ownershipDuesSummary?.totalOutstanding)
            : filteredOwnershipFloorGroups.reduce((sum, g) => sum + toReportAmount(g.totalOutstanding), 0)
        }
        ownershipCount={
          selectedOwnershipFloor === 'all'
            ? Number(ownershipDuesSummary?.ownershipCount || filteredOwnershipRows.length)
            : filteredOwnershipRows.length
        }
        unlinkedInvoiceCount={Number(ownershipDuesSummary?.unlinkedInvoiceCount || 0)}
        printedDate={(() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })()}
        societyName={societySettings.societyName || t.apartmentName}
        societyAddress={societySettings.societyAddress}
        societyRegistrationNo={societySettings.societyRegistrationNo}
      />
    </div>
  );
};
