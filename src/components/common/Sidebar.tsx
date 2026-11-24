/** @license SPDX-License-Identifier: Apache-2.0 */
import React from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Building2, Receipt, CreditCard, Wrench, TrendingDown, BarChart3, Settings, Home, FileText, Clock, Image, CheckCircle, ShieldCheck, BookOpen } from 'lucide-react';

interface Props { isOpen:boolean; onClose:()=>void; }
type NavItem={id:string;label:string;module:string;action?:'Can_View'|'Can_Create'|'Can_Edit'|'Can_Approve';icon?:any};
type NavGroup={label:string;icon:any;items:NavItem[]};

export const Sidebar:React.FC<Props> = ({isOpen,onClose}) => {
  const {activeRole,actualRole,activeTab,setActiveTab,t,hasPermission} = useApp();
  const nav=(id:string)=>{setActiveTab(id);if(window.innerWidth<768)onClose();};
  const residentItems:NavItem[]=[
    {id:'dashboard',label:t.navDashboard,module:'Dashboard',icon:LayoutDashboard},
    {id:'resident_flat',label:t.navMyFlat,module:'My Flat',icon:Home},
    {id:'resident_bills',label:t.navMyBills,module:'My Bills',icon:Receipt},
    {id:'resident_pay',label:t.navPayNow,module:'Pay Now',action:'Can_Create',icon:CreditCard},
    {id:'resident_history',label:t.navPaymentHistory,module:'Payment History',icon:Clock},
    {id:'resident_requests',label:t.navActivityRequests,module:'Activity Requests',icon:Wrench},
    {id:'resident_notices',label:t.navNoticesGallery,module:'Notices & Gallery',icon:Image},
    {id:'resident_reports',label:'My Reports',module:'Resident Portal',icon:BarChart3}
  ];
  const groups:NavGroup[]=[
    {label:t.navPropertiesResidents,icon:Building2,items:[{id:'properties_all',label:t.navAllProperties,module:'Properties & Residents'},{id:'properties_owners',label:t.navOwnerDirectory,module:'Owner Management'},{id:'properties_history',label:t.navOwnershipHistory,module:'Ownership History'},{id:'properties_tenants',label:t.navTenantDetails,module:'Tenant Management'}]},
    {label:t.navMaintenanceInvoices,icon:Receipt,items:[{id:'invoices_generate',label:t.navGenerateInvoice,module:'Maintenance & Invoices',action:'Can_Create'},{id:'invoices_register',label:t.navInvoiceRegister,module:'Maintenance & Invoices'},{id:'invoices_rates',label:t.navRateMaster,module:'Maintenance & Invoices'},{id:'invoices_outstanding',label:t.navOutstandingBills,module:'Maintenance & Invoices'}]},
    {label:t.navPayments,icon:CreditCard,items:[{id:'payments_record',label:t.navRecordPayment,module:'Payments',action:'Can_Create'},{id:'payments_receipts',label:t.navReceiptRegister,module:'Payments'},{id:'payments_allocation',label:t.navBillAllocation,module:'Bill Wise Details',action:'Can_Edit'},{id:'payments_advances',label:'Advances',module:'Payments'}]},
    {label:t.navActivityRequests,icon:Wrench,items:[{id:'requests_all',label:t.navAllRequests,module:'Activity Requests'},{id:'requests_pending',label:t.navPendingRequests,module:'Activity Requests',action:'Can_Approve'}]},
    {label:t.navExpenses,icon:TrendingDown,items:[{id:'expenses_add',label:t.navAddExpense,module:'Expenses',action:'Can_Create'},{id:'expenses_register',label:t.navExpenseRegister,module:'Expenses'},{id:'expenses_categories',label:t.navExpenseCategories,module:'Expenses'}]},
    {label:'Financial Transactions',icon:BookOpen,items:[{id:'financial_rv',label:'Receipt Voucher (RV)',module:'Financial Transactions',action:'Can_Create'},{id:'financial_pv',label:'Payment Voucher (PV)',module:'Financial Transactions',action:'Can_Create'},{id:'financial_jv',label:'Journal Voucher (JV)',module:'Financial Transactions',action:'Can_Create'},{id:'financial_cv',label:'Contra Voucher (CV)',module:'Financial Transactions',action:'Can_Create'}]},
    {label:t.navReports,icon:BarChart3,items:[{id:'reports_monthly',label:t.navMonthlyReceiptPayment,module:'Reports'},{id:'reports_property_due',label:t.navPropertyOutstanding,module:'Reports'},{id:'reports_ownership_due',label:t.navOwnershipOutstanding,module:'Reports'},{id:'reports_year_end',label:'Year-End Closing & Carry Forward',module:'Reports',action:'Can_Create'},{id:'reports_balancesheet',label:t.navBalanceSheet,module:'Reports'}]},
    {label:t.navSettings,icon:Settings,items:[{id:'settings_google',label:'Google Backend Setup',module:'Settings'},{id:'settings_users',label:t.navUserManagement,module:'User Management'},{id:'settings_role_permissions',label:'Role Permission Management',module:'Role Permission Management'},{id:'settings_maintenance',label:t.navPreventiveMaintenance,module:'Preventive Maintenance'},{id:'settings_audit',label:t.navAuditLog,module:'Audit Log'}]}
  ];
  const visibleResident=residentItems.filter(item=>hasPermission(item.module,'Can_View')&&hasPermission(item.module,item.action||'Can_View'));
  const visibleGroups=groups.map(g=>({...g,items:g.items.filter(i=>hasPermission(i.module,'Can_View')&&hasPermission(i.module,i.action||'Can_View'))})).filter(g=>g.items.length>0);
  const visibleDashboard=hasPermission('Dashboard','Can_View');
  return <>
    {isOpen&&<div onClick={onClose} className="fixed inset-0 z-40 bg-black/40 md:hidden backdrop-blur-2xs no-print"/>}
    <aside className={`fixed top-16 bottom-0 left-0 z-40 w-64 md:w-72 border-r border-[#E8E1D4] bg-white transition-transform duration-200 md:static md:translate-x-0 overflow-y-auto no-print ${isOpen?'translate-x-0':'-translate-x-full'}`}>
      <div className="p-4 space-y-4">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#536B4D]">{activeRole==='Resident'?'Resident Portal Navigation':`${activeRole} Navigation`}</div>
        {activeRole==='Resident'?visibleResident.map(item=>{const Icon=item.icon||FileText;return <button key={item.id} onClick={()=>nav(item.id)} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${activeTab===item.id?'bg-[#536B4D] text-white shadow-xs':'text-[#29352D] hover:bg-[#F7F4EC]'}`}><Icon className="h-4 w-4"/><span>{item.label}</span></button>}) : <>
          {visibleDashboard&&<button onClick={()=>nav('dashboard')} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${activeTab==='dashboard'?'bg-[#536B4D] text-white':'text-[#29352D] hover:bg-[#F7F4EC]'}`}><LayoutDashboard size={16}/>{t.navDashboard}</button>}
          {visibleGroups.map(group=><div key={group.label} className="space-y-1"><div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#29352D]"><group.icon size={15} className="text-[#536B4D]"/>{group.label}</div><div className="ml-5 pl-2 border-l-2 border-[#E8E1D4] space-y-1">{group.items.map(item=><button key={item.id} onClick={()=>nav(item.id)} className={`w-full text-left py-1.5 px-2 rounded-lg text-xs ${activeTab===item.id?'text-[#536B4D] font-bold bg-[#536B4D]/10':'text-[#29352D]/80 hover:bg-[#F7F4EC]'}`}>{item.label}</button>)}</div></div>)}
          {['Account Heads','Financial Year Management','Bank Accounts','Properties & Residents','Expenses'].some(m=>hasPermission(m,'Can_View'))&&<button onClick={()=>nav('settings_master')} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${activeTab==='settings_master'?'bg-[#536B4D] text-white':'text-[#29352D] hover:bg-[#F7F4EC]'}`}><BookOpen size={16}/>Master Data</button>}
        </>}
        <div className="rounded-xl bg-[#F7F4EC] p-3 text-xs border border-[#E8E1D4] space-y-1"><p className="font-bold text-[#536B4D]">Developer: Sanju Kr. Mallik</p><p className="text-[11px] text-[#29352D]/70">Version: 6.0.0</p><p className="text-[10px] text-[#C97958] font-medium">FY 2026-2027 (Active)</p>{activeRole==='Resident'&&actualRole!=='Resident'&&<p className="text-[10px] font-semibold text-blue-700 flex items-center gap-1"><ShieldCheck size={12}/>Resident Preview Mode</p>}</div>
      </div>
    </aside>
  </>;
};
