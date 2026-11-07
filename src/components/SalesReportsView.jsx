import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { formatINR, formatDateTime } from '../utils/currency';
import { generateReceiptPDF } from '../utils/receiptGenerator';
import { generateSalesSummaryPDF } from '../utils/salesSummaryPdfGenerator';
import { WhatsAppModal } from './WhatsAppModal';
import {
  exportLineItemsCSV,
  exportBillsSummaryCSV,
  exportProductsCSV,
  exportFullDatabaseBackup,
  COMPANY_BRANDING,
} from '../services/db';
import {
  BarChart3,
  History,
  Search,
  Download,
  Printer,
  Ban,
  Eye,
  Banknote,
  QrCode,
  AlertTriangle,
  RotateCcw,
  X,
  FileSpreadsheet,
  Lock,
  Database,
  Calendar,
  Layers,
  Info,
  Package,
  Trash2,
  Send,
  Cloud,
  CheckCircle2,
  Smartphone,
  Laptop,
  TrendingUp,
  ShoppingBag,
  Tag,
  User,
  Phone,
  Clock,
  FileText,
} from 'lucide-react';

export function SalesReportsView({ defaultTab = 'history' }) {
  const {
    currentView,
    setCurrentView,
    allBills,
    products,
    refreshBills,
    cancelBill,
    deleteBill,
    triggerPrint,
    showToast,
    isAdmin,
    setIsAdminAuthModalOpen,
    settings,
    syncState,
    triggerManualSync,
    isFirebaseConfigured,
    terminalInfo,
  } = usePOS();

  const [activeViewMode, setActiveViewMode] = useState(() => {
    if (currentView === 'reports' || defaultTab === 'reports') return 'reports';
    return 'history';
  });

  useEffect(() => {
    const targetMode = currentView === 'reports' || defaultTab === 'reports' ? 'reports' : 'history';
    setActiveViewMode(targetMode);
  }, [currentView, defaultTab]);

  const handleSubTabSwitch = (mode) => {
    setActiveViewMode(mode);
    if (setCurrentView) {
      setCurrentView(mode);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'yesterday' | 'week' | 'month' | 'all'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'cancelled'
  const [terminalFilter, setTerminalFilter] = useState('all'); // 'all' | 'PC' | 'MOBILE'
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all' | 'cash' | 'upi'

  const [selectedBill, setSelectedBill] = useState(null);
  const [whatsAppBill, setWhatsAppBill] = useState(null);
  const [billToCancel, setBillToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDownloadBillPDF = (bill) => {
    try {
      generateReceiptPDF(bill, { mode: 'thermal', autoDownload: true });
      showToast(`Thermal PDF invoice downloaded for ${bill.billNumber}`, 'success');
    } catch (err) {
      showToast('Failed to generate PDF: ' + err.message, 'error');
    }
  };

  const activeReportsModal = Boolean(selectedBill || billToCancel || billToDelete);
  const handleCloseActiveModal = () => {
    if (!isCancelling && !isDeleting) {
      setSelectedBill(null);
      setBillToCancel(null);
      setBillToDelete(null);
    }
  };

  useModalBehavior({
    isOpen: activeReportsModal,
    onClose: handleCloseActiveModal,
    isDestructive: Boolean(billToDelete || billToCancel),
  });

  // Time boundaries (Local timezone)
  const now = new Date();
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const yesterdayStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  // Filtered bills based on all criteria
  const filteredBills = useMemo(() => {
    return allBills.filter((bill) => {
      const billTime = new Date(bill.createdAt).getTime();

      if (dateFilter === 'today' && billTime < todayStart) return false;
      if (dateFilter === 'yesterday') {
        if (billTime < yesterdayStart || billTime >= todayStart) return false;
      }
      if (dateFilter === 'week' && billTime < weekStart) return false;
      if (dateFilter === 'month' && billTime < monthStart) return false;

      if (statusFilter === 'completed' && bill.status !== 'completed') return false;
      if (statusFilter === 'cancelled' && bill.status !== 'cancelled') return false;

      if (terminalFilter !== 'all') {
        const bTerm = (bill.terminalType || 'PC').toUpperCase();
        if (terminalFilter.toUpperCase() !== bTerm) return false;
      }

      if (paymentFilter !== 'all') {
        if ((bill.paymentMethod || 'cash').toLowerCase() !== paymentFilter.toLowerCase()) return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchNumber = bill.billNumber.toLowerCase().includes(query);
        const matchCustomer = (bill.customerName || '').toLowerCase().includes(query);
        const matchPhone = (bill.customerPhone || '').includes(query);
        if (!matchNumber && !matchCustomer && !matchPhone) return false;
      }

      return true;
    });
  }, [allBills, dateFilter, statusFilter, terminalFilter, paymentFilter, searchTerm, todayStart, yesterdayStart, weekStart, monthStart]);

  useEffect(() => {
    if (typeof window !== 'undefined' && filteredBills.length > 0) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('details') === 'true') {
        setSelectedBill(filteredBills[0]);
      }
    }
  }, [filteredBills]);

  // Comprehensive Sales Metrics & Parity Analytics
  const stats = useMemo(() => {
    let totalSales = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let validCount = 0;
    let cancelledCount = 0;
    let totalDiscounts = 0;
    let totalComboSavings = 0;
    let totalUnitsSold = 0;

    let pcSales = 0;
    let pcCount = 0;
    let mobileSales = 0;
    let mobileCount = 0;

    const productSalesMap = {};

    for (const b of filteredBills) {
      if (b.status === 'cancelled') {
        cancelledCount++;
        continue;
      }

      validCount++;
      const billAmount = Number(b.finalPayableAmount) || 0;
      totalSales += billAmount;
      totalDiscounts += Number(b.totalReduction) || 0;
      totalComboSavings += Number(b.comboSavings) || 0;

      if (b.paymentMethod === 'cash') {
        cashTotal += billAmount;
      } else if (b.paymentMethod === 'upi') {
        upiTotal += billAmount;
      }

      const term = (b.terminalType || 'PC').toUpperCase();
      if (term === 'MOBILE') {
        mobileSales += billAmount;
        mobileCount++;
      } else {
        pcSales += billAmount;
        pcCount++;
      }

      // Aggregate item quantities
      (b.items || []).forEach((it) => {
        const qty = Number(it.qty) || 0;
        totalUnitsSold += qty;
        const pKey = it.name || it.productId || 'Item';
        if (!productSalesMap[pKey]) {
          productSalesMap[pKey] = { name: pKey, qty: 0, revenue: 0 };
        }
        productSalesMap[pKey].qty += qty;
        productSalesMap[pKey].revenue += Number(it.lineTotal) || 0;
      });
    }

    // Historical fixed milestones across ALL bills (independent of active filter)
    let todaySales = 0;
    let todayCount = 0;
    let yesterdaySales = 0;
    let yesterdayCount = 0;
    let monthSales = 0;
    let monthCount = 0;

    for (const b of allBills) {
      if (b.status === 'cancelled') continue;
      const bTime = new Date(b.createdAt).getTime();
      const amt = Number(b.finalPayableAmount) || 0;

      if (bTime >= todayStart) {
        todaySales += amt;
        todayCount++;
      } else if (bTime >= yesterdayStart && bTime < todayStart) {
        yesterdaySales += amt;
        yesterdayCount++;
      }

      if (bTime >= monthStart) {
        monthSales += amt;
        monthCount++;
      }
    }

    const allProductSales = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue);

    const topProducts = allProductSales.slice(0, 8);

    return {
      totalSales,
      cashTotal,
      upiTotal,
      validCount,
      cancelledCount,
      totalDiscounts,
      totalComboSavings,
      totalCustomerSavings: totalDiscounts + totalComboSavings,
      totalUnitsSold,
      pcSales,
      pcCount,
      mobileSales,
      mobileCount,
      todaySales,
      todayCount,
      yesterdaySales,
      yesterdayCount,
      monthSales,
      monthCount,
      topProducts,
      allProductSales,
    };
  }, [filteredBills, allBills, todayStart, yesterdayStart, monthStart]);

  // Download Thermal Daily Sales Summary & Transactions PDF Report
  const handleDownloadSalesSummaryPDF = (scope = 'filtered') => {
    try {
      const isAll = scope === 'all';
      const targetBills = isAll ? allBills : (filteredBills.length > 0 ? filteredBills : allBills);
      const targetFilter = isAll ? 'all' : dateFilter;
      showToast(`Generating Thermal Sales Summary & Transactions PDF (${targetFilter.toUpperCase()})...`, 'info');
      generateSalesSummaryPDF({
        bills: targetBills,
        stats: isAll ? undefined : stats,
        dateFilter: targetFilter,
        settings,
        autoDownload: true,
      });
      showToast(`Thermal Sales Summary PDF (${targetBills.length} Bills) downloaded successfully!`, 'success');
    } catch (err) {
      console.error('Failed to generate sales summary PDF:', err);
      showToast('Error generating PDF report: ' + err.message, 'error');
    }
  };

  // Helper to trigger file download
  const downloadFile = (content, filename, mimeType = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Export Item-Level CSV
  const handleExportLineItemsCSV = () => {
    if (!isAdmin) {
      showToast('Admin access required to export sales data.', 'error');
      setIsAdminAuthModalOpen(true);
      return;
    }
    if (filteredBills.length === 0) {
      showToast('No bills available in selected date range.', 'error');
      return;
    }
    try {
      const csv = exportLineItemsCSV(filteredBills, settings.shopName);
      const dateTag = dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'Last7Days' : 'Filtered';
      downloadFile(csv, `${settings.shopName.replace(/\s+/g, '_')}_Items_Sales_${dateTag}_${new Date().toISOString().slice(0, 10)}.csv`);
      showToast('Item-Level Sales CSV exported for Excel and Pandas analysis.', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  // 2. Export Bills Summary CSV
  const handleExportSummaryCSV = () => {
    if (!isAdmin) {
      showToast('Admin access required to export sales data.', 'error');
      setIsAdminAuthModalOpen(true);
      return;
    }
    if (filteredBills.length === 0) {
      showToast('No bills available in selected date range.', 'error');
      return;
    }
    try {
      const csv = exportBillsSummaryCSV(filteredBills, settings.shopName);
      const dateTag = dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'Last7Days' : 'Filtered';
      downloadFile(csv, `${settings.shopName.replace(/\s+/g, '_')}_Bills_Summary_${dateTag}_${new Date().toISOString().slice(0, 10)}.csv`);
      showToast('Bills Summary CSV exported (one row per bill).', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  // 3. Full Database Backup (JSON)
  const handleExportFullBackup = async () => {
    if (!isAdmin) {
      showToast('Admin access required for full system backup.', 'error');
      setIsAdminAuthModalOpen(true);
      return;
    }
    try {
      const jsonStr = await exportFullDatabaseBackup();
      downloadFile(jsonStr, `FestivalClothing_FullBackup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
      showToast('Full system database backup downloaded.', 'success');
    } catch (err) {
      showToast('Backup failed: ' + err.message, 'error');
    }
  };

  const handleAttemptCancel = (bill) => {
    if (!isAdmin) {
      showToast('Only an Administrator can cancel or void a finalized bill.', 'error');
      setIsAdminAuthModalOpen(true);
      return;
    }
    setBillToCancel(bill);
    setCancelReason('');
  };

  const handleConfirmCancel = async () => {
    if (!billToCancel) return;
    if (!cancelReason.trim()) {
      showToast('Please state a reason for cancelling this bill.', 'error');
      return;
    }
    try {
      setIsCancelling(true);
      await cancelBill(billToCancel.id, cancelReason);
      setBillToCancel(null);
      setCancelReason('');
      if (selectedBill && selectedBill.id === billToCancel.id) {
        setSelectedBill(null);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAttemptDelete = (bill) => {
    if (!isAdmin) {
      showToast('Only an Administrator can delete a bill record.', 'error');
      setIsAdminAuthModalOpen(true);
      return;
    }
    setBillToDelete(bill);
  };

  const handleConfirmDelete = async () => {
    if (!billToDelete) return;
    try {
      setIsDeleting(true);
      const success = await deleteBill(billToDelete.id);
      if (success) {
        if (selectedBill && selectedBill.id === billToDelete.id) {
          setSelectedBill(null);
        }
        setBillToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="sales-reports-container">
      {/* Sub-view Navigation Bar (Parity Switcher for Desktop & Mobile) */}
      <div className="subview-tab-bar">
        <div className="subview-tab-buttons">
          <button
            type="button"
            id="btn-subtab-history"
            className={`subview-tab-btn ${activeViewMode === 'history' ? 'active' : ''}`}
            onClick={() => handleSubTabSwitch('history')}
          >
            <History size={16} />
            <span>Sales History ({filteredBills.length})</span>
          </button>
          <button
            type="button"
            id="btn-subtab-reports"
            className={`subview-tab-btn ${activeViewMode === 'reports' ? 'active' : ''}`}
            onClick={() => handleSubTabSwitch('reports')}
          >
            <BarChart3 size={16} />
            <span>Reports & Analytics</span>
          </button>
        </div>

        {/* Prominent Grand Total Badge on the Top Left Corner Free Space */}
        {activeViewMode === 'history' && (
          <div className="sales-history-grand-total-chip" id="sales-history-grand-total" title="Grand Total of completed bills for the selected filter period">
            <span className="grand-total-label">Grand Total:</span>
            <span className="grand-total-amount">{formatINR(stats.totalSales, true)}</span>
            <span className="grand-total-count">({stats.validCount} {stats.validCount === 1 ? 'Bill' : 'Bills'})</span>
          </div>
        )}
      </div>

      {/* Cloud Synchronisation & Local-First Cache Status Banner */}
      <div className="local-storage-reminder-banner">
        {syncState?.status === 'syncing' ? (
          <RotateCcw size={18} className="banner-icon spinning" style={{ color: '#0284c7' }} />
        ) : (syncState?.pendingCount || 0) > 0 ? (
          <Cloud size={18} className="banner-icon" style={{ color: '#f59e0b' }} />
        ) : isFirebaseConfigured ? (
          <CheckCircle2 size={18} className="banner-icon" style={{ color: '#16a34a' }} />
        ) : (
          <Database size={18} className="banner-icon" />
        )}
        <div className="banner-text">
          <div className="banner-desktop-text desktop-only">
            {isFirebaseConfigured ? (
              <>
                <strong>Shared Cloud Database Active:</strong> PC and Mobile terminals synchronise sales in real-time via Cloud Firestore (collection: <code>sales_bills</code>). Local IndexedDB serves as the offline-first cache so billing never stops.
                {(syncState?.pendingCount || 0) > 0 && (
                  <span style={{ display: 'block', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                    ⏳ {syncState.pendingCount} bill(s) pending sync to cloud database.
                  </span>
                )}
              </>
            ) : (
              <>
                <strong>Local-First Storage Active:</strong> Bills are securely saved in this device's browser database (IndexedDB). Central cloud database is operating in local fallback mode.
              </>
            )}
          </div>
          <div className="banner-mobile-card mobile-only">
            <div className="banner-mobile-header">
              <strong className="banner-mobile-title">
                {isFirebaseConfigured ? 'Cloud Sync Active' : 'Local-First Storage Active'}
              </strong>
              {(syncState?.pendingCount || 0) > 0 && (
                <span className="banner-mobile-pending-pill">
                  {syncState.pendingCount} Pending
                </span>
              )}
            </div>
            <p className="banner-mobile-desc">
              {isFirebaseConfigured
                ? 'PC and Mobile bills synchronised.'
                : 'Bills securely saved in browser database.'}
            </p>
          </div>
        </div>
        <div className="banner-actions-group">
          <button
            type="button"
            className="btn-backup-banner-action btn-sync-action"
            onClick={triggerManualSync}
            title="Sync all sales now with central database"
            disabled={syncState?.status === 'syncing'}
          >
            <RotateCcw size={13} className={syncState?.status === 'syncing' ? 'spinning' : ''} />
            <span>{syncState?.status === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
          </button>
          <button
            type="button"
            className="btn-backup-banner-action btn-backup-action"
            onClick={handleExportFullBackup}
            title="Download complete database backup JSON"
          >
            <Download size={13} />
            <span>Backup JSON</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          MODE 1: REPORTS & ANALYTICS VIEW
          ==================================================================== */}
      {activeViewMode === 'reports' && (
        <div className="reports-analytics-section">
          {/* Top Date Filter Chips for Instant Period Switching */}
          <div className="reports-date-filter-bar">
            <span className="reports-date-label">Report Period:</span>
            <div className="date-filter-tabs">
              <button
                type="button"
                className={`date-tab ${dateFilter === 'today' ? 'active' : ''}`}
                onClick={() => setDateFilter('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={`date-tab ${dateFilter === 'yesterday' ? 'active' : ''}`}
                onClick={() => setDateFilter('yesterday')}
              >
                Yesterday
              </button>
              <button
                type="button"
                className={`date-tab ${dateFilter === 'week' ? 'active' : ''}`}
                onClick={() => setDateFilter('week')}
              >
                7 Days
              </button>
              <button
                type="button"
                className={`date-tab ${dateFilter === 'month' ? 'active' : ''}`}
                onClick={() => setDateFilter('month')}
              >
                This Month
              </button>
              <button
                type="button"
                className={`date-tab ${dateFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDateFilter('all')}
              >
                All Time
              </button>
            </div>
            <button
              type="button"
              className="btn-download-sales-pdf"
              onClick={() => handleDownloadSalesSummaryPDF('filtered')}
              title="Download Thermal Daily Sales Summary & Transactions PDF"
            >
              <FileText size={15} />
              <span>Download Sales Summary PDF</span>
            </button>
          </div>

          {/* Executive Performance Milestones Cards (6-Core KPI Grid) */}
          <div className="kpi-grid">
            {/* 1. Today's Sales */}
            <div className="kpi-card today-kpi">
              <div className="kpi-icon-box">
                <TrendingUp size={22} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">Today's Sales</span>
                <span className="kpi-value">{formatINR(stats.todaySales, true)}</span>
                <span className="kpi-subtext">{stats.todayCount} bill(s) today</span>
              </div>
            </div>

            {/* 2. Total Bills in Period */}
            <div className="kpi-card total-kpi">
              <div className="kpi-icon-box">
                <BarChart3 size={22} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">Total Bills</span>
                <span className="kpi-value">{stats.validCount}</span>
                <span className="kpi-subtext">{formatINR(stats.totalSales, true)} period sales</span>
              </div>
            </div>

            {/* 3. Cash Collections */}
            <div className="kpi-card cash-kpi">
              <div className="kpi-icon-box">
                <Banknote size={22} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">Cash Collections</span>
                <span className="kpi-value">{formatINR(stats.cashTotal, true)}</span>
                <span className="kpi-subtext">Physical drawer cash</span>
              </div>
            </div>

            {/* 4. UPI Collections */}
            <div className="kpi-card upi-kpi">
              <div className="kpi-icon-box">
                <QrCode size={22} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">UPI Collections</span>
                <span className="kpi-value">{formatINR(stats.upiTotal, true)}</span>
                <span className="kpi-subtext">Instant QR transfers</span>
              </div>
            </div>

            {/* Desktop-only bonus cards */}
            <div className="kpi-card yesterday-kpi desktop-only">
              <div className="kpi-icon-box">
                <History size={22} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">Yesterday's Sales</span>
                <span className="kpi-value">{formatINR(stats.yesterdaySales, true)}</span>
                <span className="kpi-subtext">{stats.yesterdayCount} bill(s) yesterday</span>
              </div>
            </div>

            <div className="kpi-card month-kpi desktop-only">
              <div className="kpi-icon-box">
                <Calendar size={22} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">This Month</span>
                <span className="kpi-value">{formatINR(stats.monthSales, true)}</span>
                <span className="kpi-subtext">{stats.monthCount} bill(s) this month</span>
              </div>
            </div>
          </div>

          {/* Comparative Distribution Cards: PC vs Mobile, Cash vs UPI, Discounts vs Combos */}
          <div className="reports-comparative-grid">
            {/* Terminal Breakdown: PC vs Mobile Handheld */}
            <div className="report-distribution-card">
              <div className="dist-header">
                <div className="dist-title-wrap">
                  <Laptop size={18} className="dist-icon" />
                  <h3>Terminal Analysis (PC vs Mobile)</h3>
                </div>
                <span className="dist-badge">Active Range</span>
              </div>

              <div className="dist-stats-row">
                <div className="dist-col">
                  <span className="dist-label">PC Counter</span>
                  <span className="dist-value">{formatINR(stats.pcSales, true)}</span>
                  <span className="dist-sub">{stats.pcCount} bills ({stats.totalSales > 0 ? Math.round((stats.pcSales / stats.totalSales) * 100) : 0}%)</span>
                </div>
                <div className="dist-divider-v" />
                <div className="dist-col">
                  <span className="dist-label">Mobile Handheld</span>
                  <span className="dist-value">{formatINR(stats.mobileSales, true)}</span>
                  <span className="dist-sub">{stats.mobileCount} bills ({stats.totalSales > 0 ? Math.round((stats.mobileSales / stats.totalSales) * 100) : 0}%)</span>
                </div>
              </div>

              {/* Visual Split Bar */}
              <div className="dist-bar-track">
                <div
                  className="dist-bar-fill pc"
                  style={{
                    width: stats.totalSales > 0 ? `${(stats.pcSales / stats.totalSales) * 100}%` : '50%',
                  }}
                  title={`PC: ${stats.totalSales > 0 ? Math.round((stats.pcSales / stats.totalSales) * 100) : 0}%`}
                />
                <div
                  className="dist-bar-fill mobile"
                  style={{
                    width: stats.totalSales > 0 ? `${(stats.mobileSales / stats.totalSales) * 100}%` : '50%',
                  }}
                  title={`Mobile: ${stats.totalSales > 0 ? Math.round((stats.mobileSales / stats.totalSales) * 100) : 0}%`}
                />
              </div>
            </div>

            {/* Payment Method Distribution: Cash vs UPI */}
            <div className="report-distribution-card">
              <div className="dist-header">
                <div className="dist-title-wrap">
                  <Banknote size={18} className="dist-icon" />
                  <h3>Payment Analysis (Cash vs UPI)</h3>
                </div>
                <span className="dist-badge">Collections</span>
              </div>

              <div className="dist-stats-row">
                <div className="dist-col">
                  <span className="dist-label">Cash Tender</span>
                  <span className="dist-value">{formatINR(stats.cashTotal, true)}</span>
                  <span className="dist-sub">
                    {stats.totalSales > 0 ? `${Math.round((stats.cashTotal / stats.totalSales) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="dist-divider-v" />
                <div className="dist-col">
                  <span className="dist-label">UPI Digital</span>
                  <span className="dist-value">{formatINR(stats.upiTotal, true)}</span>
                  <span className="dist-sub">
                    {stats.totalSales > 0 ? `${Math.round((stats.upiTotal / stats.totalSales) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>

              {/* Visual Split Bar */}
              <div className="dist-bar-track">
                <div
                  className="dist-bar-fill cash"
                  style={{
                    width: stats.totalSales > 0 ? `${(stats.cashTotal / stats.totalSales) * 100}%` : '50%',
                  }}
                />
                <div
                  className="dist-bar-fill upi"
                  style={{
                    width: stats.totalSales > 0 ? `${(stats.upiTotal / stats.totalSales) * 100}%` : '50%',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Product Sales Performance Ranking */}
          {stats.topProducts.length > 0 && (
            <div className="top-products-card">
              <div className="top-products-header">
                <Package size={18} className="top-p-icon" />
                <h3>Top Selling Items & Bundles</h3>
              </div>
              <div className="top-products-list">
                {stats.topProducts.map((p, idx) => (
                  <div key={idx} className="top-product-row">
                    <span className="top-p-rank">
                      <span className="serial-number-badge">#{idx + 1}</span>
                    </span>
                    <div className="top-p-info">
                      <strong className="top-p-name">{p.name}</strong>
                      <span className="top-p-qty">{p.qty} units sold</span>
                    </div>
                    <span className="top-p-rev">{formatINR(p.revenue, true)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Item-Wise Sales Report Table with Serial Numbers */}
          {stats.allProductSales && stats.allProductSales.length > 0 && (
            <div className="ledger-card" style={{ marginTop: '20px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} style={{ color: '#064e3b' }} />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#064e3b', fontWeight: 700 }}>
                    Item-Wise Sales & Revenue Report
                  </h3>
                </div>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  {stats.allProductSales.length} items sold • Period: <strong>{dateFilter.toUpperCase()}</strong>
                </span>
              </div>

              <div className="ledger-scroll-container">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: '60px' }}>S.No</th>
                      <th>Product / Apparel Name</th>
                      <th className="text-center">Units Sold</th>
                      <th className="text-right">Total Revenue</th>
                      <th className="text-right">% Share of Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.allProductSales.map((p, idx) => {
                      const share = stats.totalSales > 0 ? ((p.revenue / stats.totalSales) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={idx}>
                          <td className="text-center">
                            <span className="serial-number-badge">{idx + 1}</span>
                          </td>
                          <td>
                            <strong style={{ color: '#0f172a' }}>{p.name}</strong>
                          </td>
                          <td className="text-center font-mono">
                            <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                              {p.qty} pcs
                            </span>
                          </td>
                          <td className="text-right font-mono" style={{ fontWeight: 700, color: '#064e3b' }}>
                            {formatINR(p.revenue, true)}
                          </td>
                          <td className="text-right font-mono" style={{ color: '#64748b' }}>
                            {share}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                      <td colSpan={2} className="text-right" style={{ padding: '12px 16px' }}>
                        Total Product Performance:
                      </td>
                      <td className="text-center" style={{ padding: '12px 16px' }}>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: '4px' }}>
                          {stats.totalUnitsSold} pcs
                        </span>
                      </td>
                      <td className="text-right font-mono" style={{ padding: '12px 16px', color: '#064e3b', fontSize: '1rem' }}>
                        {formatINR(stats.totalSales, true)}
                      </td>
                      <td className="text-right" style={{ padding: '12px 16px' }}>
                        100.0%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Admin CSV Export Panel */}
          <div className="reports-export-banner">
            <div className="export-banner-info">
              <FileSpreadsheet size={22} className="export-banner-icon" />
              <div>
                <h3 className="export-banner-title">Accounting & Data Exports (Excel / CSV)</h3>
                <p className="export-banner-subtitle">
                  Download structured sales logs for offline tax preparation, spreadsheet reporting, or backup storage.
                </p>
              </div>
            </div>
            <div className="export-button-group">
              <button
                type="button"
                className="btn-export-pdf"
                onClick={() => handleDownloadSalesSummaryPDF('filtered')}
                title="Download Thermal Sales Summary & Transactions PDF Report"
              >
                <FileText size={15} />
                <span>Summary PDF (Thermal)</span>
              </button>
              <button
                type="button"
                className="btn-export-pdf secondary-export-pdf"
                onClick={() => handleDownloadSalesSummaryPDF('all')}
                title="Download Complete All-Time Sales History Ledger in Thermal PDF format"
              >
                <FileText size={15} />
                <span>All Sales History PDF</span>
              </button>
              <button
                type="button"
                className="btn-export-csv"
                onClick={handleExportLineItemsCSV}
              >
                <Download size={15} />
                <span>Line Items CSV</span>
              </button>
              <button
                type="button"
                className="btn-export-csv secondary"
                onClick={handleExportSummaryCSV}
              >
                <Download size={15} />
                <span>Bills Summary CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODE 2: SALES HISTORY VIEW
          ==================================================================== */}
      {/* Mobile-Friendly Sales History Header & Period Summary Bar */}
      {activeViewMode === 'history' && (
        <div className="mobile-sales-summary-bar">
          <div className="mobile-sales-summary-info">
            <div className="mobile-sales-title-row">
              <h2 className="mobile-sales-page-title">Sales History</h2>
              <span className="mobile-sales-count-pill">{filteredBills.length} {filteredBills.length === 1 ? 'Bill' : 'Bills'}</span>
            </div>
            <div className="mobile-sales-stats-row">
              <span className="summary-stat-label">Grand Total:</span>
              <strong className="summary-stat-amount">{formatINR(stats.totalSales, true)}</strong>
            </div>
          </div>
          <div className="mobile-sales-btns-wrap">
            <button
              type="button"
              className="mobile-download-pdf-chip"
              onClick={() => handleDownloadSalesSummaryPDF('filtered')}
              title="Download Thermal Sales Summary & Transactions PDF Report"
            >
              <FileText size={12} />
              <span>Summary PDF</span>
            </button>
            <button
              type="button"
              className={`mobile-sync-chip-btn ${syncState?.status || 'synced'}`}
              onClick={triggerManualSync}
              title="Click to synchronise sales now"
              disabled={syncState?.status === 'syncing'}
            >
              {syncState?.status === 'syncing' ? (
                <>
                  <RotateCcw size={12} className="spinning" />
                  <span>Syncing...</span>
                </>
              ) : (syncState?.pendingCount || 0) > 0 ? (
                <>
                  <Cloud size={12} color="#f59e0b" />
                  <span>{syncState.pendingCount} Pending</span>
                </>
              ) : isFirebaseConfigured ? (
                <>
                  <CheckCircle2 size={12} color="#10b981" />
                  <span>Live Synced</span>
                </>
              ) : (
                <>
                  <Database size={12} />
                  <span>Local DB</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Control Bar: Filters & Export Actions (Visible in both, with focus on History) */}
      <div className="reports-control-bar">
        <div className="search-filter-group">
          {/* Text Search */}
          <div className="search-input-wrap">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search Bill #, Customer Name, Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Filter Tabs */}
          <div className="date-filter-tabs">
            <button
              type="button"
              className={`date-tab ${dateFilter === 'today' ? 'active' : ''}`}
              onClick={() => setDateFilter('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`date-tab ${dateFilter === 'yesterday' ? 'active' : ''}`}
              onClick={() => setDateFilter('yesterday')}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`date-tab ${dateFilter === 'week' ? 'active' : ''}`}
              onClick={() => setDateFilter('week')}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`date-tab ${dateFilter === 'month' ? 'active' : ''}`}
              onClick={() => setDateFilter('month')}
            >
              This Month
            </button>
            <button
              type="button"
              className={`date-tab ${dateFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDateFilter('all')}
            >
              All Time
            </button>
          </div>

          {/* Dropdown Filters Group */}
          <div className="dropdown-filters-row">
            {/* Terminal Filter: PC vs Mobile */}
            <select
              className="status-filter-select"
              value={terminalFilter}
              onChange={(e) => setTerminalFilter(e.target.value)}
              title="Filter by originating terminal"
            >
              <option value="all">All Terminals</option>
              <option value="PC">PC Counter</option>
              <option value="MOBILE">Mobile Handheld</option>
            </select>

            {/* Payment Method Filter */}
            <select
              className="status-filter-select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              title="Filter by payment method"
            >
              <option value="all">All Payments</option>
              <option value="cash">Cash Only</option>
              <option value="upi">UPI Only</option>
            </select>

            {/* Status Filter */}
            <select
              className="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Filter by status"
            >
              <option value="all">All Bills</option>
              <option value="completed">Active Bills Only</option>
              <option value="cancelled">Cancelled Bills Only</option>
            </select>
          </div>
        </div>

        <div className="reports-actions">
          <button
            type="button"
            className="btn-download-sales-pdf"
            onClick={() => handleDownloadSalesSummaryPDF('filtered')}
            title="Download Thermal Sales Summary & Transactions PDF Report"
          >
            <FileText size={15} />
            <span>Download Sales Summary PDF</span>
          </button>
          {dateFilter !== 'all' && (
            <button
              type="button"
              className="btn-download-sales-pdf secondary-pdf-btn"
              onClick={() => handleDownloadSalesSummaryPDF('all')}
              title="Download Complete All-Time Sales History in Thermal PDF format"
            >
              <FileText size={15} />
              <span>All Sales History PDF</span>
            </button>
          )}
          <button
            type="button"
            className="btn-refresh-grid"
            onClick={refreshBills}
            title="Refresh database records"
          >
            <RotateCcw size={16} />
            <span className="desktop-only">Refresh</span>
          </button>
        </div>
      </div>

      {/* Ledger Cards & Table Container */}
      {/* Ledger Cards & Table Container */}
      <div className="ledger-card">
        {/* Mobile Horizontal Swipe Hint Badge */}
        <div className="mobile-table-swipe-hint mobile-only">
          <span>← Swipe table horizontally to view all columns & actions →</span>
        </div>

        {/* Unified Table View: Horizontally Scrollable on Mobile, Full-Width on Desktop */}
        <div className="ledger-scroll-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th className="text-center col-sno" style={{ width: '40px' }}>S.NO</th>
                <th className="col-bill-no" style={{ minWidth: '125px' }}>BILL NUMBER</th>
                <th className="text-right col-final-amt" style={{ minWidth: '100px' }}>FINAL AMOUNT</th>
                <th style={{ minWidth: '135px' }}>DATE & TIME</th>
                <th style={{ minWidth: '85px' }}>CASHIER</th>
                <th style={{ minWidth: '170px' }}>PRODUCTS / ITEMS SUMMARY</th>
                <th className="text-right" style={{ minWidth: '105px' }}>ORIGINAL AMOUNT</th>
                <th className="text-center" style={{ minWidth: '85px' }}>PAYMENT</th>
                <th className="text-center" style={{ minWidth: '95px' }}>STATUS</th>
                <th className="text-center" style={{ minWidth: '175px', whiteSpace: 'nowrap' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center empty-ledger-cell">
                    <AlertTriangle size={32} className="empty-alert-icon" />
                    <p>No bills found for the selected filter criteria.</p>
                    <button
                      type="button"
                      className="btn-reset-filters"
                      onClick={() => {
                        setSearchTerm('');
                        setDateFilter('all');
                        setTerminalFilter('all');
                        setPaymentFilter('all');
                        setStatusFilter('all');
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Reset Filters</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill, index) => {
                  const isCancelled = bill.status === 'cancelled';
                  const originalTotal = bill.subtotal || ((bill.items || []).reduce((sum, i) => sum + ((i.originalPrice || i.price || 0) * (i.qty || 1)), 0)) || bill.finalPayableAmount;

                  return (
                    <tr key={bill.id} className={`ledger-row ${isCancelled ? 'row-cancelled' : ''}`}>
                      <td className="text-center col-sno">
                        <span className="serial-number-badge">{filteredBills.length - index}</span>
                      </td>
                      <td className="col-bill-no">
                        <strong className="bill-number-text">{bill.billNumber}</strong>
                      </td>
                      <td className="text-right col-final-amt">
                        <strong className={`final-amount-text ${isCancelled ? 'struck' : ''}`}>
                          {formatINR(bill.finalPayableAmount, false)}
                        </strong>
                      </td>
                      <td>
                        <span className="timestamp-text">{formatDateTime(bill.createdAt)}</span>
                      </td>
                      <td>
                        <span className="cashier-tag">{bill.cashierName || 'Cashier'}</span>
                      </td>
                      <td>
                        <span className="items-summary-text">
                          {(bill.items || []).map((i) => `${i.name} (×${i.qty})`).join(', ')}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="original-amount-text">
                          {formatINR(originalTotal, false)}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`badge-payment ${bill.paymentMethod}`}>
                          {bill.paymentMethod.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-center">
                        {isCancelled ? (
                          <span className="badge-status cancelled" title={bill.cancelReason}>CANCELLED</span>
                        ) : (
                          <span className="badge-status paid">COMPLETED</span>
                        )}
                      </td>
                      <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                        <div className="ledger-action-btns">
                          <button
                            type="button"
                            className="btn-icon-action view"
                            onClick={() => setSelectedBill(bill)}
                            title="View bill details"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-action whatsapp"
                            onClick={() => setWhatsAppBill(bill)}
                            title="Share invoice on WhatsApp"
                            style={{ color: '#059669' }}
                          >
                            <Send size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-action download"
                            onClick={() => handleDownloadBillPDF(bill)}
                            title="Download A4 PDF"
                          >
                            <Download size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-action print"
                            onClick={() => triggerPrint(bill, 'thermal')}
                            title="Reprint thermal receipt"
                          >
                            <Printer size={15} />
                          </button>
                          {!isCancelled && (
                            <button
                              type="button"
                              className="btn-icon-action cancel"
                              onClick={() => handleAttemptCancel(bill)}
                              title="Cancel / void bill (Admin only)"
                            >
                              <Ban size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-icon-action delete"
                            onClick={() => handleAttemptDelete(bill)}
                            title="Delete bill permanently (Admin only)"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredBills.length > 0 && (
              <tfoot>
                <tr className="ledger-table-grand-total-row">
                  <td colSpan={2} className="text-right ledger-tfoot-label">
                    Grand Total ({stats.validCount} {stats.validCount === 1 ? 'Bill' : 'Bills'}):
                  </td>
                  <td className="text-right font-mono ledger-tfoot-amount col-final-amt">
                    {formatINR(stats.totalSales, true)}
                  </td>
                  <td colSpan={7}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Bill Details Modal */}
      {selectedBill && (
        <div className="modal-overlay" onClick={() => setSelectedBill(null)}>
          <div className="modal-dialog bill-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h2 className="modal-title">Bill Details: {selectedBill.billNumber}</h2>
                <span className="modal-subtitle">{formatDateTime(selectedBill.createdAt)}</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedBill(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {selectedBill.status === 'cancelled' && (
                <div className="cancelled-callout">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>This bill was cancelled on {formatDateTime(selectedBill.cancelledAt)}</strong>
                    <p>Reason: "{selectedBill.cancelReason}" (By: {selectedBill.cancelledBy || 'Admin'})</p>
                  </div>
                </div>
              )}

              {/* Customer Info in Modal */}
              {(selectedBill.customerName || selectedBill.customerPhone) && (
                <div className="customer-modal-banner">
                  <User size={15} />
                  <span>Customer: <strong>{selectedBill.customerName || 'N/A'}</strong></span>
                  {selectedBill.customerPhone && (
                    <span> • Phone: <strong>{selectedBill.customerPhone}</strong></span>
                  )}
                </div>
              )}

              <div className="details-items-card">
                <h3>Items Purchased</h3>
                <table className="details-items-table">
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: '50px' }}>S.No</th>
                      <th>Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Orig Price</th>
                      <th className="text-right">Reduction</th>
                      <th className="text-right">Final Rate</th>
                      <th className="text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedBill.items || []).map((it, idx) => {
                      const orig = it.originalUnitPrice ?? it.unitPrice;
                      const finalRate = it.finalUnitPrice ?? it.unitPrice;
                      const red = it.reductionPerUnit || 0;
                      return (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td><strong>{it.name}</strong></td>
                          <td className="text-center">{it.qty}</td>
                          <td className="text-right">₹{orig}</td>
                          <td className="text-right">{red > 0 ? `-₹${red}/pc` : '-'}</td>
                          <td className="text-right"><strong>₹{finalRate}</strong></td>
                          <td className="text-right">{formatINR(it.lineTotal, true)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="details-totals-grid">
                <div className="payment-meta-box">
                  <h4>Payment & Storage Details</h4>
                  <p><strong>Payment Mode:</strong> {(selectedBill.paymentMethod || 'cash').toUpperCase()}</p>
                  <p><strong>Cashier:</strong> {selectedBill.cashierName || 'Cashier'}</p>
                  <p><strong>Terminal:</strong> {(selectedBill.terminalType || 'PC').toUpperCase() === 'MOBILE' ? 'Mobile Handheld' : 'PC Counter'}</p>
                  {selectedBill.amountReceived > 0 && (
                    <p><strong>Amount Received:</strong> {formatINR(selectedBill.amountReceived, true)}</p>
                  )}
                  {selectedBill.changeDue > 0 && (
                    <p><strong>Change Returned:</strong> {formatINR(selectedBill.changeDue, true)}</p>
                  )}
                  {selectedBill.upiRef && (
                    <p><strong>UPI Ref:</strong> {selectedBill.upiRef}</p>
                  )}
                  <p><strong>Database:</strong> Stored locally (WisdoFestivalPOS_DB)</p>
                  {selectedBill.festiveQuote && (
                    <p><strong>Invoice Quote:</strong> <em>"{selectedBill.festiveQuote}"</em></p>
                  )}
                </div>

                <div className="totals-summary-box">
                  <div className="totals-row">
                    <span>Subtotal:</span>
                    <span>{formatINR(selectedBill.subtotal || selectedBill.finalPayableAmount, true)}</span>
                  </div>
                  {selectedBill.totalReduction > 0 && (
                    <div className="totals-row disc">
                      <span>Total Item Reductions:</span>
                      <span>-{formatINR(selectedBill.totalReduction, true)}</span>
                    </div>
                  )}
                  {selectedBill.comboSavings > 0 && (
                    <div className="totals-row disc">
                      <span>Combo Savings:</span>
                      <span>-{formatINR(selectedBill.comboSavings, true)}</span>
                    </div>
                  )}
                  <div className="totals-row grand">
                    <span>Final Payable Amount:</span>
                    <strong>{formatINR(selectedBill.finalPayableAmount, true)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="btn-danger-outline"
                onClick={() => handleAttemptDelete(selectedBill)}
                title="Permanently delete this bill from database"
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>

              <div style={{ flex: 1 }} />

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedBill(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleDownloadBillPDF(selectedBill)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={16} />
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setWhatsAppBill(selectedBill)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#059669', borderColor: '#a7f3d0' }}
              >
                <Send size={16} />
                <span>Share WhatsApp</span>
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => triggerPrint(selectedBill, 'thermal')}
              >
                <Printer size={16} />
                <span>Reprint Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Cancellation Modal (Admin Only) */}
      {billToCancel && (
        <div className="modal-overlay" onClick={() => !isCancelling && setBillToCancel(null)}>
          <div className="modal-dialog cancel-reason-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h2 className="modal-title text-danger">Cancel Bill {billToCancel.billNumber}</h2>
                <span className="modal-subtitle">Authorized Void Action (Administrator)</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isCancelling && setBillToCancel(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="cancellation-alert-note">
                <AlertTriangle size={20} />
                <span>
                  This bill will be marked as <strong>CANCELLED</strong> in the permanent sales ledger. It will NOT be deleted to protect retail audit integrity.
                </span>
              </div>

              <div className="form-group">
                <label className="input-group-label">Mandatory Cancellation Reason *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. Customer returned items, cashier duplicate entry, order cancelled..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setBillToCancel(null)}
                disabled={isCancelling}
              >
                Keep Bill
              </button>
              <button
                type="button"
                id="btn-confirm-cancel-bill"
                className="btn-danger"
                onClick={handleConfirmCancel}
                disabled={isCancelling || !cancelReason.trim()}
              >
                <Ban size={16} />
                <span>{isCancelling ? 'Recording Cancellation...' : 'Confirm Cancellation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Deletion Confirmation Modal (Admin Only) */}
      {billToDelete && (
        <div className="modal-overlay" onClick={() => !isDeleting && setBillToDelete(null)}>
          <div className="modal-dialog cancel-reason-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h2 className="modal-title text-danger">Delete Bill {billToDelete.billNumber}</h2>
                <span className="modal-subtitle">Permanent Deletion (Administrator)</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isDeleting && setBillToDelete(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div
                className="cancellation-alert-note"
                style={{ borderColor: '#fca5a5', background: '#fef2f2', color: '#991b1b' }}
              >
                <AlertTriangle size={20} color="#dc2626" />
                <span>
                  <strong>Warning:</strong> Are you sure you want to permanently delete bill{' '}
                  <strong>{billToDelete.billNumber}</strong> ({formatINR(billToDelete.finalPayableAmount, true)})?
                  This record will be permanently purged from your browser's IndexedDB database.
                </span>
              </div>

              <div style={{ marginTop: '14px', fontSize: '0.86rem', color: 'var(--navy-800)', lineHeight: '1.6', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div><strong>Bill Date:</strong> {formatDateTime(billToDelete.createdAt)}</div>
                <div><strong>Cashier:</strong> {billToDelete.cashierName || 'Cashier'}</div>
                <div><strong>Items:</strong> {billToDelete.items?.map((it) => `${it.name} (×${it.qty})`).join(', ') || 'N/A'}</div>
                <div><strong>Payment:</strong> {billToDelete.paymentMethod ? billToDelete.paymentMethod.toUpperCase() : 'N/A'}</div>
                <div><strong>Total Amount:</strong> {formatINR(billToDelete.finalPayableAmount, true)}</div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setBillToDelete(null)}
                disabled={isDeleting}
              >
                Keep Bill
              </button>
              <button
                type="button"
                id="btn-confirm-delete-bill"
                className="btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                <span>{isDeleting ? 'Deleting Bill...' : 'Confirm & Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal for Retrying / Sharing Historical Bills */}
      <WhatsAppModal
        isOpen={Boolean(whatsAppBill)}
        onClose={() => setWhatsAppBill(null)}
        bill={whatsAppBill}
      />
    </div>
  );
}

export default SalesReportsView;
