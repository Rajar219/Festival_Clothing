import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { formatINR, formatDateTime } from '../utils/currency';
import { generateReceiptPDF } from '../utils/receiptGenerator';
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
} from 'lucide-react';

export function SalesReportsView({ defaultTab = 'history' }) {
  const {
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
  } = usePOS();

  const [activeViewMode, setActiveViewMode] = useState(defaultTab); // 'history' | 'reports'

  useEffect(() => {
    if (defaultTab) {
      setActiveViewMode(defaultTab);
    }
  }, [defaultTab]);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'yesterday' | 'week' | 'month' | 'all'
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedBill, setSelectedBill] = useState(null);
  const [whatsAppBill, setWhatsAppBill] = useState(null);
  const [billToCancel, setBillToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);

  const handleDownloadBillPDF = (bill) => {
    try {
      generateReceiptPDF(bill, { mode: 'thermal', autoDownload: true });
      showToast(`Thermal PDF invoice downloaded for ${bill.billNumber}`, 'success');
    } catch (err) {
      showToast('Failed to generate PDF: ' + err.message, 'error');
    }
  };
  const [isDeleting, setIsDeleting] = useState(false);

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

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchNumber = bill.billNumber.toLowerCase().includes(query);
        const matchCustomer = (bill.customerName || '').toLowerCase().includes(query);
        const matchPhone = (bill.customerPhone || '').includes(query);
        if (!matchNumber && !matchCustomer && !matchPhone) return false;
      }

      return true;
    });
  }, [allBills, dateFilter, statusFilter, searchTerm, todayStart, yesterdayStart, weekStart, monthStart]);

  // Aggregate stats strictly using stored finalized transaction amounts
  const stats = useMemo(() => {
    let totalSales = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let validCount = 0;
    let cancelledCount = 0;

    for (const b of filteredBills) {
      if (b.status === 'cancelled') {
        cancelledCount++;
        continue;
      }

      validCount++;
      const billAmount = b.finalPayableAmount || 0;
      totalSales += billAmount;

      if (b.paymentMethod === 'cash') {
        cashTotal += billAmount;
      } else if (b.paymentMethod === 'upi') {
        upiTotal += billAmount;
      }
    }

    return {
      totalSales,
      cashTotal,
      upiTotal,
      validCount,
      cancelledCount,
    };
  }, [filteredBills]);

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

  // 1. Export Item-Level CSV (One row per line item, with bill_id for grouping in Pandas)
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

  // 2. Export Bills Summary CSV (One row per bill, avoiding double-counting totals)
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

  // 3. Export Products Catalog CSV
  const handleExportProductsCSV = () => {
    if (!isAdmin) {
      showToast('Admin access required to export products.', 'error');
      setIsAdminAuthModalOpen(true);
      return;
    }

    try {
      const csv = exportProductsCSV(products);
      downloadFile(csv, `${settings.shopName.replace(/\s+/g, '_')}_Product_Catalog_${new Date().toISOString().slice(0, 10)}.csv`);
      showToast('Product Catalog CSV exported.', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  // 4. Full Database Backup (JSON)
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
      {/* Sub-view Navigation Bar */}
      <div className="subview-tab-bar">
        <button
          type="button"
          className={`subview-tab-btn ${activeViewMode === 'history' ? 'active' : ''}`}
          onClick={() => setActiveViewMode('history')}
        >
          <History size={16} />
          <span>Sales History ({filteredBills.length} Bills)</span>
        </button>
        <button
          type="button"
          className={`subview-tab-btn ${activeViewMode === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveViewMode('reports')}
        >
          <BarChart3 size={16} />
          <span>Reports & Analytics</span>
        </button>
      </div>

      {/* Prominent Backup Reminder Banner */}
      <div className="local-storage-reminder-banner">
        <Database size={18} className="banner-icon" />
        <div className="banner-text">
          <strong>Local-First Storage Notice:</strong> Records are stored in this computer's browser IndexedDB. Clear browser cache or disk issues will erase data without backups. Remember to download a backup regularly.
        </div>
        <button
          type="button"
          className="btn-backup-banner-action"
          onClick={handleExportFullBackup}
          title="Download complete database backup JSON"
        >
          <Download size={14} />
          <span>Backup Data Now</span>
        </button>
      </div>

      {/* Reports & Analytics KPI Cards Grid (Rendered prominently in Reports Mode or summary in History) */}
      {activeViewMode === 'reports' && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card total-kpi">
              <div className="kpi-icon-box">
                <BarChart3 size={24} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">Total Sales ({dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? '7 Days' : 'Filtered'})</span>
                <span className="kpi-value">{formatINR(stats.totalSales, true)}</span>
                <span className="kpi-subtext">{stats.validCount} finalized bills</span>
              </div>
            </div>

            <div className="kpi-card cash-kpi">
              <div className="kpi-icon-box">
                <Banknote size={24} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">Cash Collected</span>
                <span className="kpi-value">{formatINR(stats.cashTotal, true)}</span>
                <span className="kpi-subtext">Physical drawer currency</span>
              </div>
            </div>

            <div className="kpi-card upi-kpi">
              <div className="kpi-icon-box">
                <QrCode size={24} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">UPI Digital Collections</span>
                <span className="kpi-value">{formatINR(stats.upiTotal, true)}</span>
                <span className="kpi-subtext">Direct to merchant bank</span>
              </div>
            </div>

            <div className="kpi-card cancelled-kpi">
              <div className="kpi-icon-box">
                <Ban size={24} />
              </div>
              <div className="kpi-data">
                <span className="kpi-title">Voided / Cancelled</span>
                <span className="kpi-value">{stats.cancelledCount} Bills</span>
                <span className="kpi-subtext">Audited corrections</span>
              </div>
            </div>
          </div>

          {/* Admin CSV Export Panel for Reports View */}
          <div className="reports-export-banner">
            <div className="export-banner-info">
              <FileSpreadsheet size={22} className="export-banner-icon" />
              <div>
                <h3 className="export-banner-title">Excel & Python Pandas Sales Exports</h3>
                <p className="export-banner-subtitle">
                  Export formatted UTF-8 CSVs with ISO timestamps, numeric floats, and stable bill identifiers.
                </p>
              </div>
            </div>
            <div className="export-button-group">
              <button
                type="button"
                className="btn-export-csv"
                onClick={handleExportLineItemsCSV}
                title="Export item-level sales CSV with stable bill_id for Python Pandas and Excel PivotTables"
              >
                <Download size={15} />
                <span>Export Items CSV (Pandas)</span>
              </button>

              <button
                type="button"
                className="btn-export-csv secondary"
                onClick={handleExportSummaryCSV}
                title="Export bills summary CSV (one row per bill) avoiding double-counted totals"
              >
                <Download size={15} />
                <span>Bills Summary CSV (Excel)</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Control Bar: Filters & Export Actions */}
      <div className="reports-control-bar">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search Bill #, Customer Name, Mobile..."
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

          <div className="date-filter-tabs">
            <button
              className={`date-tab ${dateFilter === 'today' ? 'active' : ''}`}
              onClick={() => setDateFilter('today')}
            >
              Today
            </button>
            <button
              className={`date-tab ${dateFilter === 'yesterday' ? 'active' : ''}`}
              onClick={() => setDateFilter('yesterday')}
            >
              Yesterday
            </button>
            <button
              className={`date-tab ${dateFilter === 'week' ? 'active' : ''}`}
              onClick={() => setDateFilter('week')}
            >
              7 Days
            </button>
            <button
              className={`date-tab ${dateFilter === 'month' ? 'active' : ''}`}
              onClick={() => setDateFilter('month')}
            >
              This Month
            </button>
            <button
              className={`date-tab ${dateFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDateFilter('all')}
            >
              All Time
            </button>
          </div>

          <select
            className="status-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Bills</option>
            <option value="completed">Active Bills Only</option>
            <option value="cancelled">Cancelled Bills Only</option>
          </select>
        </div>

        <div className="reports-actions">
          {/* Admin Export Dropdown / Buttons */}
          <div className="export-button-group">
            <button
              type="button"
              className="btn-export-csv"
              onClick={handleExportLineItemsCSV}
              title="Export item-level sales CSV with stable bill_id for Python Pandas and Excel PivotTables"
            >
              <FileSpreadsheet size={15} />
              <span>Export Items CSV</span>
            </button>

            <button
              type="button"
              className="btn-export-csv secondary"
              onClick={handleExportSummaryCSV}
              title="Export bills summary CSV (one row per bill) avoiding double-counted totals"
            >
              <FileSpreadsheet size={15} />
              <span>Bills Summary CSV</span>
            </button>
          </div>

          <button
            type="button"
            className="btn-refresh-grid"
            onClick={refreshBills}
            title="Refresh database records"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="ledger-card">
        {/* Desktop View: Wide Ledger Table (>= 768px) */}
        <div className="ledger-scroll-container desktop-ledger-view">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Bill Number</th>
                <th>Date & Time</th>
                <th>Cashier</th>
                <th>Items Summary</th>
                <th className="text-right">Subtotal</th>
                <th className="text-center">Reduction</th>
                <th className="text-right">Final Amount</th>
                <th className="text-center">Payment</th>
                <th className="text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center empty-ledger-cell">
                    <AlertTriangle size={32} className="empty-alert-icon" />
                    <p>No bills found for the selected filter.</p>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const isCancelled = bill.status === 'cancelled';

                  return (
                    <tr key={bill.id} className={`ledger-row ${isCancelled ? 'row-cancelled' : ''}`}>
                      <td>
                        <strong className="bill-number-text">{bill.billNumber}</strong>
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
                        <span>{formatINR(bill.subtotal, true)}</span>
                      </td>
                      <td className="text-center">
                        {bill.totalReduction > 0 ? (
                          <span className="reduction-count-badge">
                            -₹{bill.totalReduction}
                          </span>
                        ) : (
                          <span className="no-reduction">-</span>
                        )}
                      </td>
                      <td className="text-right">
                        <strong className={`ledger-amount ${isCancelled ? 'struck' : ''}`}>
                          {formatINR(bill.finalPayableAmount, true)}
                        </strong>
                      </td>
                      <td className="text-center">
                        <span className={`badge-payment-sm ${bill.paymentMethod}`}>
                          {bill.paymentMethod.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-center">
                        {isCancelled ? (
                          <span className="badge-status cancelled">CANCELLED</span>
                        ) : (
                          <span className="badge-status paid">COMPLETED</span>
                        )}
                      </td>
                      <td className="text-center">
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
                            title="Download Thermal A4 PDF"
                          >
                            <Download size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-action print"
                            onClick={() => triggerPrint(bill, 'thermal')}
                            title="Reprint receipt"
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
          </table>
        </div>

        {/* Mobile View: Stacked Transaction Cards (< 768px) */}
        <div className="mobile-ledger-cards">
          {filteredBills.length === 0 ? (
            <div className="mobile-empty-ledger">
              <AlertTriangle size={32} className="empty-alert-icon" />
              <p>No bills found for the selected filter.</p>
            </div>
          ) : (
            filteredBills.map((bill) => {
              const isCancelled = bill.status === 'cancelled';

              return (
                <div key={bill.id} className={`mobile-bill-card ${isCancelled ? 'card-cancelled' : ''}`}>
                  <div className="mobile-bill-header">
                    <div className="mobile-bill-number-row">
                      <strong className="mobile-bill-num">{bill.billNumber}</strong>
                      {isCancelled ? (
                        <span className="badge-status cancelled">CANCELLED</span>
                      ) : (
                        <span className="badge-status paid">COMPLETED</span>
                      )}
                    </div>
                    <span className="mobile-bill-time">{formatDateTime(bill.createdAt)}</span>
                  </div>

                  <div className="mobile-bill-items-row">
                    <span className="mobile-bill-items-text">
                      {(bill.items || []).map((i) => `${i.name} (×${i.qty})`).join(', ')}
                    </span>
                  </div>

                  <div className="mobile-bill-financials-row">
                    <div className="mobile-bill-amounts">
                      {bill.totalReduction > 0 && (
                        <span className="mobile-bill-sub-reduction">
                          Orig: ₹{bill.subtotal} • Saved: -₹{bill.totalReduction}
                        </span>
                      )}
                      <span className={`mobile-bill-final ${isCancelled ? 'struck' : ''}`}>
                        {formatINR(bill.finalPayableAmount, true)}
                      </span>
                    </div>

                    <div className="mobile-bill-tags">
                      <span className={`badge-payment-sm ${bill.paymentMethod}`}>
                        {bill.paymentMethod.toUpperCase()}
                      </span>
                      <span className="mobile-cashier-pill">{bill.cashierName || 'Cashier'}</span>
                    </div>
                  </div>

                  <div className="mobile-bill-actions-row">
                    <button
                      type="button"
                      className="mobile-bill-action-btn view"
                      onClick={() => setSelectedBill(bill)}
                      title="View bill details"
                    >
                      <Eye size={15} />
                      <span>Details</span>
                    </button>
                    <button
                      type="button"
                      className="mobile-bill-action-btn whatsapp"
                      onClick={() => setWhatsAppBill(bill)}
                      title="Share on WhatsApp"
                      style={{ color: '#059669' }}
                    >
                      <Send size={15} />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      className="mobile-bill-action-btn download"
                      onClick={() => handleDownloadBillPDF(bill)}
                      title="Download PDF"
                    >
                      <Download size={15} />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      className="mobile-bill-action-btn print"
                      onClick={() => triggerPrint(bill, 'thermal')}
                      title="Reprint receipt"
                    >
                      <Printer size={15} />
                      <span>Print</span>
                    </button>
                    {!isCancelled && (
                      <button
                        type="button"
                        className="mobile-bill-action-btn cancel"
                        onClick={() => handleAttemptCancel(bill)}
                        title="Cancel / void bill"
                      >
                        <Ban size={15} />
                        <span>Void</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="mobile-bill-action-btn delete"
                      onClick={() => handleAttemptDelete(bill)}
                      title="Delete bill"
                    >
                      <Trash2 size={15} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
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

              <div className="details-items-card">
                <h3>Items Purchased</h3>
                <table className="details-items-table">
                  <thead>
                    <tr>
                      <th>#</th>
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
                  <h4>Payment & Storage Status</h4>
                  <p><strong>Payment Mode:</strong> {selectedBill.paymentMethod.toUpperCase()}</p>
                  <p><strong>Cashier:</strong> {selectedBill.cashierName || 'Cashier'}</p>
                  {selectedBill.amountReceived > 0 && (
                    <p><strong>Amount Received:</strong> {formatINR(selectedBill.amountReceived, true)}</p>
                  )}
                  {selectedBill.changeDue > 0 && (
                    <p><strong>Change Returned:</strong> {formatINR(selectedBill.changeDue, true)}</p>
                  )}
                  {selectedBill.upiRef && (
                    <p><strong>UPI Ref:</strong> {selectedBill.upiRef}</p>
                  )}
                  <p><strong>Local Storage:</strong> Saved (WisdoFestivalPOS_DB)</p>
                  <p>
                    <strong>Google Drive Status:</strong>{' '}
                    {selectedBill.driveUploadStatus === 'uploaded' ? (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        Backed up ({selectedBill.driveFolderName || 'PC BILLING'})
                      </span>
                    ) : (
                      <span style={{ color: '#d97706' }}>Drive backup pending</span>
                    )}
                  </p>
                </div>

                <div className="totals-summary-box">
                  <div className="totals-row">
                    <span>Subtotal:</span>
                    <span>{formatINR(selectedBill.subtotal, true)}</span>
                  </div>
                  {selectedBill.totalReduction > 0 && (
                    <div className="totals-row disc">
                      <span>Total Item Reductions:</span>
                      <span>-{formatINR(selectedBill.totalReduction, true)}</span>
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
