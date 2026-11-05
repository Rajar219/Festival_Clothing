import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import {
  COMPANY_BRANDING,
  exportFullDatabaseBackup,
  importFullDatabaseBackup,
  exportProductsCSV,
  exportBillsSummaryCSV,
} from '../services/db';
import {
  uploadBackupToDrive,
  uploadCSVReportToDrive,
} from '../services/googleDrive';
import {
  Settings,
  Store,
  Printer,
  Database,
  Lock,
  Save,
  Info,
  ShieldCheck,
  ShieldAlert,
  Download,
  Upload,
  AlertTriangle,
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  XCircle,
  Laptop,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

export function SettingsView() {
  const {
    settings,
    products,
    allBills,
    updateSettings,
    isAdmin,
    setIsAdminAuthModalOpen,
    refreshBills,
    showToast,
    isDriveConnected,
    connectDrive,
    disconnectDrive,
  } = usePOS();

  const [formData, setFormData] = useState({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  if (!isAdmin) {
    return (
      <div className="admin-locked-container">
        <ShieldAlert size={48} className="lock-alert-icon" />
        <h2>Administrator Access Required</h2>
        <p>You must be authenticated as an Administrator to change store details, manage backups, or configure Google Drive.</p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setIsAdminAuthModalOpen(true)}
        >
          Login as Administrator
        </button>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setIsSaving(true);
    await updateSettings(formData);
    setIsSaving(false);
  };

  const downloadFile = (content, filename, mimeType = 'application/json') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Full Database Backup
  const handleDownloadBackup = async () => {
    try {
      const jsonStr = await exportFullDatabaseBackup();
      downloadFile(jsonStr, `FestivalClothing_FullBackup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
      showToast('Full database backup file (.json) downloaded successfully.', 'success');
    } catch (err) {
      showToast('Backup failed: ' + err.message, 'error');
    }
  };

  // Upload Backup to Google Drive
  const handleDriveBackupUpload = async () => {
    try {
      setIsUploadingToDrive(true);
      const jsonStr = await exportFullDatabaseBackup();
      const res = await uploadBackupToDrive(jsonStr);
      showToast(`Daily backup uploaded to Google Drive (${res.folderName})!`, 'success');
    } catch (err) {
      showToast(`Drive backup error: ${err.message}`, 'error');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Upload CSV Report to Google Drive
  const handleDriveReportUpload = async () => {
    try {
      setIsUploadingToDrive(true);
      const csv = exportBillsSummaryCSV(allBills, settings.shopName);
      const res = await uploadCSVReportToDrive(csv, 'BillsSummary');
      showToast(`Sales report CSV uploaded to Google Drive (${res.folderName})!`, 'success');
    } catch (err) {
      showToast(`Drive report error: ${err.message}`, 'error');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Export Product Settings CSV
  const handleExportProductCatalogCSV = () => {
    try {
      const csv = exportProductsCSV(products);
      downloadFile(csv, `FestivalClothing_Products_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
      showToast('Product settings CSV exported for Excel / Pandas.', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  // Restore Database from JSON
  const handleFileRestore = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsRestoring(true);
        const content = event.target?.result;
        const result = await importFullDatabaseBackup(content);
        await refreshBills();
        showToast(
          `Backup Restored! ${result.importedBillsCount} new bills imported (${result.skippedDuplicatesCount} existing duplicates preserved).`,
          'success'
        );
      } catch (err) {
        showToast('Restore failed: ' + err.message, 'error');
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleDriveConnectClick = async () => {
    try {
      setIsConnectingDrive(true);
      await connectDrive();
    } catch (err) {
      // toast shown in context
    } finally {
      setIsConnectingDrive(false);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-page-header">
        <div className="settings-title-row">
          <Settings size={26} className="settings-header-icon" />
          <div>
            <h2 className="page-heading">Shop Configuration & Data Management</h2>
            <p className="page-subheading">
              Manage retail store profile, terminal designation (PC / Mobile), Google Drive backup, and CSV exports.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="btn-primary btn-save-settings"
          disabled={isSaving}
        >
          <Save size={18} />
          <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="settings-grid">
        {/* Device Registration & Terminal Designation Card */}
        <div className="settings-card full-width">
          <div className="card-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {formData.deviceType === 'MOBILE' ? <Smartphone size={20} className="card-icon" /> : <Laptop size={20} className="card-icon" />}
              <h3 className="card-title">Terminal Device Identification (PC vs Mobile)</h3>
            </div>
            <span className="badge-payment">{formData.deviceType === 'MOBILE' ? 'MOBILE TERMINAL' : 'PC BILLING DESK'}</span>
          </div>

          <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '16px' }}>
            Register this specific device as either the main shop PC or a floor mobile terminal. This determines which Google Drive folder (<code>PC BILLING/</code> or <code>MOBILE BILLING/</code>) finalized invoice PDFs are uploaded to.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '8px',
                border: `2px solid ${formData.deviceType === 'PC' ? '#059669' : '#e2e8f0'}`,
                background: formData.deviceType === 'PC' ? '#f0fdf4' : '#ffffff',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="deviceType"
                value="PC"
                checked={formData.deviceType !== 'MOBILE'}
                onChange={handleChange}
                style={{ marginTop: '3px' }}
              />
              <div>
                <strong style={{ color: '#064e3b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Laptop size={16} /> PC Terminal (Main Cash Counter)
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Invoices save locally on this PC and upload to Google Drive under <code>FESTIVAL SALES BILL / PC BILLING</code>.
                </p>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '8px',
                border: `2px solid ${formData.deviceType === 'MOBILE' ? '#059669' : '#e2e8f0'}`,
                background: formData.deviceType === 'MOBILE' ? '#f0fdf4' : '#ffffff',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="deviceType"
                value="MOBILE"
                checked={formData.deviceType === 'MOBILE'}
                onChange={handleChange}
                style={{ marginTop: '3px' }}
              />
              <div>
                <strong style={{ color: '#064e3b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={16} /> Mobile Terminal (Sales Floor Handheld)
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Invoices save locally on this phone/tablet and upload to Google Drive under <code>FESTIVAL SALES BILL / MOBILE BILLING</code>.
                </p>
              </div>
            </label>
          </div>

          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', color: '#475569' }}>
            ℹ️ <strong>Independent Sales Record Architecture:</strong> PC and mobile maintain separate, independent local IndexedDB databases on each device. Bills created on PC remain on PC; bills created on mobile remain on mobile. Both backup documents to Google Drive.
          </div>
        </div>

        {/* Google Drive Integration Card */}
        <div className="settings-card full-width">
          <div className="card-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cloud size={22} className="card-icon" style={{ color: '#0284c7' }} />
              <h3 className="card-title">Google Drive Cloud Document Storage</h3>
            </div>
            {isDriveConnected ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600, fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} /> Connected to Google Drive
              </span>
            ) : (
              <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>
                Not Connected
              </span>
            )}
          </div>

          <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '14px' }}>
            Connect your shop's Google Drive account using Google OAuth 2.0 with restricted file-level permissions (<code>drive.file</code>). Once connected, the system automatically creates and maintains the following folder structure:
          </p>

          <pre style={{ background: '#0f172a', color: '#38bdf8', padding: '10px 14px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '16px' }}>
            {`FESTIVAL SALES BILL/
  ├── PC BILLING/        (Invoices generated on shop computer)
  ├── MOBILE BILLING/    (Invoices generated on mobile devices)
  ├── DAILY BACKUPS/     (Daily full JSON database snapshots)
  └── SALES REPORTS/     (CSV sales ledgers for accounting & Excel)`}
          </pre>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
            {!isDriveConnected ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleDriveConnectClick}
                disabled={isConnectingDrive}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
              >
                <Cloud size={18} />
                <span>{isConnectingDrive ? 'Authorizing Google...' : 'Connect Google Drive'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDriveBackupUpload}
                  disabled={isUploadingToDrive}
                  className="btn-backup-action"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={16} />
                  <span>{isUploadingToDrive ? 'Uploading...' : 'Upload Daily Backup to Drive'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDriveReportUpload}
                  disabled={isUploadingToDrive}
                  className="btn-product-csv-action"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileSpreadsheet size={16} />
                  <span>Upload Sales CSV to Drive</span>
                </button>

                <button
                  type="button"
                  onClick={disconnectDrive}
                  className="btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  Disconnect Google Drive
                </button>
              </>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="input-group-label" style={{ fontSize: '0.8rem' }}>
              Custom Google OAuth 2.0 Web Client ID (Optional override)
            </label>
            <input
              type="text"
              name="googleClientId"
              className="form-control"
              value={formData.googleClientId || ''}
              onChange={handleChange}
              placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
              style={{ fontSize: '0.85rem' }}
            />
            <small className="field-hint">
              By default uses <code>VITE_GOOGLE_CLIENT_ID</code> from environment. You can enter or update your Google Cloud OAuth Client ID here without re-deploying.
            </small>
          </div>
        </div>

        {/* Store Profile Card */}
        <div className="settings-card">
          <div className="card-header-row">
            <Store size={20} className="card-icon" />
            <h3 className="card-title">Shop Branding & Profile</h3>
          </div>

          <div className="form-group">
            <label className="input-group-label">Active Retail Shop Name *</label>
            <input
              type="text"
              name="shopName"
              className="form-control"
              value={formData.shopName || ''}
              onChange={handleChange}
              placeholder="e.g. FESTIVAL CLOTHING"
              required
            />
          </div>

          <div className="form-group">
            <label className="input-group-label">Category Subtitle / Tagline *</label>
            <input
              type="text"
              name="subtitle"
              className="form-control"
              value={formData.subtitle || ''}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="input-group-label">Store Address</label>
            <textarea
              name="address"
              rows={2}
              className="form-control"
              value={formData.address || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="input-group-label">Store Contact Phone</label>
            <input
              type="text"
              name="phone"
              className="form-control"
              value={formData.phone || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="input-group-label">UPI ID (For Digital Checkout QR)</label>
            <input
              type="text"
              name="upiId"
              className="form-control"
              value={formData.upiId || ''}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Printing & Receipt Preferences */}
        <div className="settings-card">
          <div className="card-header-row">
            <Printer size={20} className="card-icon" />
            <h3 className="card-title">Receipt Printing & Preferences</h3>
          </div>

          <div className="form-group">
            <label className="input-group-label">Default Printing Format</label>
            <select
              name="defaultPrintMode"
              className="form-control"
              value={formData.defaultPrintMode || 'thermal'}
              onChange={handleChange}
            >
              <option value="thermal">Thermal POS Receipt (80mm / 3-inch roll)</option>
              <option value="a4">Standard A4 / Letter Retail Invoice</option>
            </select>
          </div>

          <div className="form-group">
            <label className="input-group-label">Receipt Footer Message / Policy</label>
            <textarea
              name="receiptFooter"
              rows={3}
              className="form-control"
              value={formData.receiptFooter || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group toggle-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                name="autoPrintOnCheckout"
                checked={!!formData.autoPrintOnCheckout}
                onChange={handleChange}
              />
              <span className="checkmark" />
              <span className="checkbox-label">
                Automatically trigger printer prompt immediately after finalizing bill
              </span>
            </label>
          </div>

          {/* Item-Level Price Reduction Configuration */}
          <div className="settings-card">
            <div className="card-header-row">
              <Percent size={20} className="card-icon" />
              <h3 className="card-title">Item-Level Price Reduction Settings</h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '14px' }}>
              Configure individual item reductions (₹10 Less). Reductions apply strictly to specific items (never the bill subtotal) and protect against negative prices.
            </p>

            <div className="form-group toggle-group">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="allowItemReductions"
                  checked={formData.allowItemReductions !== false}
                  onChange={handleChange}
                />
                <span className="checkmark" />
                <span className="checkbox-label" style={{ fontWeight: 600 }}>
                  Enable Item-Level Price Reductions Store-Wide
                </span>
              </label>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="input-group-label">Reduction Step Amount (₹)</label>
                <input
                  type="number"
                  name="reductionStepAmount"
                  className="form-control"
                  min="1"
                  step="1"
                  value={formData.reductionStepAmount ?? 10}
                  onChange={handleChange}
                />
                <small className="field-hint">Amount in ₹ reduced per click (default ₹10).</small>
              </div>

              <div className="form-group">
                <label className="input-group-label">Max Reductions per Unit</label>
                <input
                  type="number"
                  name="maxReductionsCount"
                  className="form-control"
                  min="1"
                  max="20"
                  value={formData.maxReductionsCount ?? 5}
                  onChange={handleChange}
                />
                <small className="field-hint">e.g. 5 clicks = max ₹50 reduction per piece.</small>
              </div>
            </div>

            <div className="form-group toggle-group" style={{ marginTop: '8px' }}>
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="cashierCanReduce"
                  checked={formData.cashierCanReduce !== false}
                  onChange={handleChange}
                />
                <span className="checkmark" />
                <span className="checkbox-label" style={{ fontWeight: 600 }}>
                  Allow Cashiers to apply reductions (if unchecked, requires Admin PIN)
                </span>
              </label>
            </div>
          </div>

          {/* Immutable Official Company Branding Card */}
          <div className="immutable-attribution-box">
            <div className="immutable-header">
              <Lock size={15} />
              <strong>Official Product Branding (Protected)</strong>
            </div>
            <p>
              Developed and maintained by <strong>{COMPANY_BRANDING.companyName}</strong>. The company attribution tag <em>"{COMPANY_BRANDING.attributionText}"</em> is permanently affixed to the application footer, receipts, and WhatsApp invoices.
            </p>
          </div>
        </div>

        {/* Local-First IndexedDB Database & Backup Management */}
        <div className="settings-card full-width">
          <div className="card-header-row">
            <Database size={20} className="card-icon" />
            <h3 className="card-title">Local-First Database & Backup Management</h3>
          </div>

          <div className="backup-management-grid">
            {/* Box 1: Full System Backup */}
            <div className="backup-card-box highlight">
              <div className="box-header">
                <h4>Full System Backup (.JSON)</h4>
                <span className="box-tag">Full Database Restore</span>
              </div>
              <p>
                Exports all finalized bills, line items, product prices, settings, and audit logs to an encrypted local JSON file. <strong>Recommended at closing every evening during the Diwali rush.</strong>
              </p>
              <button
                type="button"
                className="btn-backup-action"
                onClick={handleDownloadBackup}
              >
                <Download size={16} />
                <span>Export System Backup (JSON)</span>
              </button>
            </div>

            {/* Box 2: Restore Database */}
            <div className="backup-card-box">
              <div className="box-header">
                <h4>Restore / Import Database (.JSON)</h4>
                <span className="box-tag">Duplicate-Safe</span>
              </div>
              <p>
                Safely imports records from a previously exported backup file. Verifies structure, prevents overwriting existing bills, and records an audit log.
              </p>
              <label className="btn-restore-action">
                <Upload size={16} />
                <span>{isRestoring ? 'Restoring Records...' : 'Import Backup File (JSON)'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileRestore}
                  style={{ display: 'none' }}
                  disabled={isRestoring}
                />
              </label>
            </div>

            {/* Box 3: Product Settings CSV */}
            <div className="backup-card-box">
              <div className="box-header">
                <h4>Product Settings (.CSV)</h4>
                <span className="box-tag">Excel & Pandas</span>
              </div>
              <p>
                Exports current product catalog names, keyboard shortcuts, and default prices in UTF-8 CSV format for spreadsheet editing or Python Pandas analysis.
              </p>
              <button
                type="button"
                className="btn-product-csv-action"
                onClick={handleExportProductCatalogCSV}
              >
                <FileSpreadsheet size={16} />
                <span>Export Products CSV</span>
              </button>
            </div>
          </div>

          {/* CRITICAL LOCAL DATA WARNING BANNER */}
          <div
            className="single-computer-warning-card"
            style={{
              marginTop: '20px',
              border: '2px solid #f59e0b',
              background: '#fffbeb',
              padding: '16px',
              borderRadius: '8px',
            }}
          >
            <div className="warning-card-header" style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} />
              <strong style={{ fontSize: '0.95rem' }}>CRITICAL LOCAL DATA SAFETY WARNING (IndexedDB Architecture)</strong>
            </div>
            <ul className="storage-notes-list" style={{ color: '#92400e', marginTop: '10px', lineHeight: 1.5 }}>
              <li>
                <strong>Browser-Local Storage:</strong> All transaction records and bill histories are stored strictly inside this device's browser IndexedDB database (<code>WisdoFestivalPOS_DB</code>).
              </li>
              <li>
                <strong>Risk of Data Loss:</strong> <u>Clearing browser cookies/site data, uninstalling the browser, browsing in incognito/private mode, or device hardware failure will permanently erase local transaction records.</u>
              </li>
              <li>
                <strong>Prevention:</strong> Connect Google Drive above for automatic cloud invoice archiving, and download a daily JSON backup at the end of every business day.
              </li>
              <li>
                <strong>Independent Devices:</strong> PC and mobile terminals maintain independent local databases. Bills created on PC do not appear on mobile, and bills created on mobile do not appear on PC.
              </li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
}
