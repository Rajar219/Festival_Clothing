import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { ErrorBoundary } from './ErrorBoundary';
import {
  COMPANY_BRANDING,
  exportFullDatabaseBackup,
  importFullDatabaseBackup,
  exportProductsCSV,
  exportBillsSummaryCSV,
  DEFAULT_SETTINGS,
} from '../services/db';
import {
  getSavedDriveAuth,
  ensureFolderStructure,
  uploadBackupToDrive,
  uploadCSVReportToDrive,
} from '../services/googleDrive';
import { DEFAULT_COMBOS } from '../utils/comboEngine';
import { formatINR } from '../utils/currency';
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
  Percent,
  Tags,
  Sliders,
  Layers,
  Edit2,
  RotateCcw,
  Check,
  X,
  UserCheck,
  Sparkles,
  Users,
  UserPlus,
  Trash2,
} from 'lucide-react';

export function SettingsView() {
  const {
    settings,
    products,
    allBills,
    updateSettings,
    updateProductDetails,
    toggleProductStatus,
    isAdmin,
    setIsAdminAuthModalOpen,
    setPendingNavTarget,
    switchRoleToCashier,
    refreshBills,
    showToast,
    isDriveConnected,
    connectDrive,
    disconnectDrive,
    staffList,
    currentStaffUser,
    approveStaff,
    revokeStaff,
    changeStaffRole,
    isFirebaseConfigured,
  } = usePOS();

  // Active sub-tab inside Admin Settings: 'shop' | 'products' | 'combos' | 'discounts' | 'gdrive' | 'receipt' | 'admin'
  const [activeTab, setActiveTab] = useState('shop');

  // Form State with deep fallback
  const [formData, setFormData] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [driveTestMessage, setDriveTestMessage] = useState('');
  const [lastDriveBackupTime, setLastDriveBackupTime] = useState(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('wisdo_last_drive_backup_time') || null;
    }
    return null;
  });

  // Product Editing inside Settings
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    defaultPrice: '',
    offerPrice: '',
    offersStr: '',
    reductionEnabled: true,
    isActive: true,
  });

  // Combos Editing State
  const [combosConfig, setCombosConfig] = useState(() => {
    return (settings && settings.combos) ? settings.combos : DEFAULT_COMBOS;
  });

  // Staff Account Management State
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('CASHIER');
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    if (!newStaffEmail || !newStaffEmail.includes('@')) {
      showToast('Please enter a valid staff email address.', 'error');
      return;
    }
    setIsAddingStaff(true);
    try {
      await approveStaff(newStaffEmail.trim().toLowerCase(), newStaffRole);
      setNewStaffEmail('');
      showToast(`Approved ${newStaffEmail.trim()} as ${newStaffRole}!`, 'success');
    } catch (err) {
      showToast(`Failed to approve staff: ${err.message}`, 'error');
    } finally {
      setIsAddingStaff(false);
    }
  };
  const [isSavingCombos, setIsSavingCombos] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData((prev) => ({
        ...DEFAULT_SETTINGS,
        ...prev,
        ...settings,
      }));
      if (settings.combos) {
        setCombosConfig(settings.combos);
      }
    }
  }, [settings]);

  // Auth Guard
  if (!isAdmin) {
    return (
      <div className="admin-locked-container">
        <ShieldAlert size={56} className="lock-alert-icon" style={{ color: '#dc2626', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#064e3b', marginBottom: '8px' }}>
          Administrator Authentication Required
        </h2>
        <p style={{ color: '#475569', maxWidth: '480px', lineHeight: 1.5, marginBottom: '20px' }}>
          You must be authenticated as an Administrator to view and modify store configuration, product prices, discount permissions, and Google Drive integrations.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (setPendingNavTarget) setPendingNavTarget('settings');
            setIsAdminAuthModalOpen(true);
          }}
          style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 700 }}
        >
          <Lock size={18} />
          <span>Login as Administrator (PIN: 1234)</span>
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

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(formData);
    } finally {
      setIsSaving(false);
    }
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
    URL.revokeObjectURL(url);
  };

  // Full Database Backup
  const handleDownloadBackup = async () => {
    try {
      const jsonStr = await exportFullDatabaseBackup();
      downloadFile(
        jsonStr,
        `FestivalClothing_FullBackup_${new Date().toISOString().slice(0, 10)}.json`,
        'application/json'
      );
      showToast('Full database backup (.json) downloaded successfully.', 'success');
    } catch (err) {
      showToast('Backup failed: ' + err.message, 'error');
    }
  };

  // Upload Backup to Google Drive (Manual Only)
  const handleDriveBackupUpload = async () => {
    try {
      setIsUploadingToDrive(true);
      const jsonStr = await exportFullDatabaseBackup();
      const res = await uploadBackupToDrive(jsonStr);
      const timestamp = new Date().toLocaleString('en-IN');
      setLastDriveBackupTime(timestamp);
      localStorage.setItem('wisdo_last_drive_backup_time', timestamp);
      showToast(`Daily backup uploaded to Google Drive (${res.folderName})!`, 'success');
    } catch (err) {
      showToast(`Drive backup error: ${err.message}`, 'error');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Upload CSV Report to Google Drive (Manual Only)
  const handleDriveReportUpload = async () => {
    try {
      setIsUploadingToDrive(true);
      const csv = exportBillsSummaryCSV(allBills || [], settings?.shopName || 'FESTIVAL CLOTHING');
      const res = await uploadCSVReportToDrive(csv, 'BillsSummary');
      showToast(`Sales report CSV uploaded to Google Drive (${res.folderName})!`, 'success');
    } catch (err) {
      showToast(`Drive report error: ${err.message}`, 'error');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Test / Verify Google Drive connection & folder structure
  const handleTestDriveFolders = async () => {
    try {
      setIsTestingDrive(true);
      setDriveTestMessage('');
      const folders = await ensureFolderStructure();
      setDriveTestMessage('Verified! Root folder "FESTIVAL SALES BILL" and sub-folders exist in Drive.');
      showToast('Google Drive folder structure verified successfully!', 'success');
    } catch (err) {
      setDriveTestMessage('Verification issue: ' + err.message);
      showToast('Drive verification failed: ' + err.message, 'error');
    } finally {
      setIsTestingDrive(false);
    }
  };

  // Export Product Settings CSV
  const handleExportProductCatalogCSV = () => {
    try {
      const csv = exportProductsCSV(products || []);
      downloadFile(
        csv,
        `FestivalClothing_Products_${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8;'
      );
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
          `Backup Restored! ${result.importedBillsCount} bills imported (${result.skippedDuplicatesCount} duplicates preserved).`,
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

  // Product Editing Handlers
  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    const offersArr = Array.isArray(prod.offers)
      ? prod.offers
      : prod.offerPrice
      ? [prod.offerPrice]
      : [];
    setProductForm({
      name: prod.name,
      defaultPrice: String(prod.defaultPrice || ''),
      offerPrice: prod.offerPrice !== null && prod.offerPrice !== undefined ? String(prod.offerPrice) : '',
      offersStr: offersArr.join(', '),
      reductionEnabled: prod.reductionEnabled !== false,
      isActive: prod.isActive !== false,
    });
  };

  const handleSaveProductModal = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    const basePrice = parseFloat(productForm.defaultPrice);
    if (isNaN(basePrice) || basePrice < 0) {
      alert('Please enter a valid positive base price.');
      return;
    }

    const offerPrice = productForm.offerPrice ? parseFloat(productForm.offerPrice) : null;
    const rawOffers = productForm.offersStr
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);

    const mergedOffers = Array.from(new Set([
      ...(offerPrice ? [offerPrice] : []),
      ...rawOffers,
    ])).sort((a, b) => b - a);

    try {
      await updateProductDetails(editingProduct.id, {
        name: productForm.name.trim() || editingProduct.name,
        defaultPrice: basePrice,
        offerPrice: offerPrice,
        offers: mergedOffers,
        reductionEnabled: productForm.reductionEnabled,
        isActive: productForm.isActive,
      });
      setEditingProduct(null);
      showToast(`Updated price settings for "${editingProduct.name}"`, 'success');
    } catch (err) {
      alert('Error updating product: ' + err.message);
    }
  };

  // Combo Configuration Handlers
  const handleComboPriceChange = (comboId, newOfferPrice) => {
    const val = parseFloat(newOfferPrice);
    setCombosConfig((prev) =>
      prev.map((c) => (c.id === comboId ? { ...c, offerPrice: isNaN(val) ? 0 : val } : c))
    );
  };

  const handleComboToggle = (comboId) => {
    setCombosConfig((prev) =>
      prev.map((c) => (c.id === comboId ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleSaveCombos = async () => {
    setIsSavingCombos(true);
    try {
      await updateSettings({
        ...settings,
        combos: combosConfig,
      });
      showToast('Combo promotion rules updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to save combos: ' + err.message, 'error');
    } finally {
      setIsSavingCombos(false);
    }
  };

  const driveAuth = getSavedDriveAuth();

  return (
    <div className="settings-container">
      {/* Page Header */}
      <div className="settings-page-header">
        <div className="settings-title-row">
          <Settings size={28} className="settings-header-icon" />
          <div>
            <h2 className="page-heading">Shop Administration & System Settings</h2>
            <p className="page-subheading">
              Manage store profile, product prices, combo promotions, discount rules, Google Drive backups, and receipt printing.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={switchRoleToCashier}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            title="Lock Admin Mode and return to Cashier Desk"
          >
            <Lock size={15} />
            <span>Lock / Exit Admin</span>
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            className="btn-primary btn-save-settings"
            disabled={isSaving}
          >
            <Save size={18} />
            <span>{isSaving ? 'Saving Changes...' : 'Save All Settings'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="settings-tabs-nav" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
        <button
          type="button"
          className={`settings-nav-pill ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => setActiveTab('shop')}
        >
          <Store size={16} />
          <span>Shop Profile</span>
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <Tags size={16} />
          <span>Products & Prices</span>
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeTab === 'combos' ? 'active' : ''}`}
          onClick={() => setActiveTab('combos')}
        >
          <Layers size={16} />
          <span>Combo Rules</span>
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeTab === 'discounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('discounts')}
        >
          <Percent size={16} />
          <span>Item Reductions</span>
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeTab === 'gdrive' ? 'active' : ''}`}
          onClick={() => setActiveTab('gdrive')}
        >
          <Cloud size={16} />
          <span>Google Drive Cloud</span>
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeTab === 'receipt' ? 'active' : ''}`}
          onClick={() => setActiveTab('receipt')}
        >
          <Printer size={16} />
          <span>Receipt & Printer</span>
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          <Users size={16} />
          <span>Staff Accounts</span>
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin')}
        >
          <Database size={16} />
          <span>Terminal & Database</span>
        </button>
      </div>

      {/* SECTION 1: SHOP INFORMATION */}
      {activeTab === 'shop' && (
        <ErrorBoundary title="Shop Profile Section">
          <div className="settings-section-card">
            <div className="card-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={22} className="card-icon" />
                <h3 className="card-title">Shop Branding & Store Details</h3>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '16px' }}>
              Official shop details printed on A4 retail invoices, thermal receipts, and shared via WhatsApp.
            </p>

            <div className="settings-fields-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
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
                  placeholder="e.g. MENSWEAR"
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="input-group-label">Official Store Address *</label>
                <textarea
                  name="address"
                  rows={2}
                  className="form-control"
                  value={formData.address || ''}
                  onChange={handleChange}
                  placeholder="No. 10/12, N.N. Garden, Old Washermenpet, Chennai - 21, Tamil Nadu."
                />
              </div>

              <div className="form-group">
                <label className="input-group-label">Contact Phone (Optional)</label>
                <input
                  type="text"
                  name="phone"
                  className="form-control"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  placeholder="e.g. +91 98765 43210"
                />
              </div>

              <div className="form-group">
                <label className="input-group-label">UPI ID (For Digital Payments)</label>
                <input
                  type="text"
                  name="upiId"
                  className="form-control"
                  value={formData.upiId || ''}
                  onChange={handleChange}
                  placeholder="e.g. festivalclothing@okhdfcbank"
                />
              </div>
            </div>

            {/* Official WISDO TECH Protected Branding Banner */}
            <div className="immutable-attribution-box" style={{ marginTop: '20px' }}>
              <div className="immutable-header">
                <Lock size={15} />
                <strong>Official Product Engineering Attribution (Protected)</strong>
              </div>
              <p>
                Engineered and maintained by <strong>{COMPANY_BRANDING.companyName}</strong>. The company attribution tag <em>"{COMPANY_BRANDING.attributionText}"</em> is permanently affixed to the application footer, invoices, and thermal receipts.
              </p>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* SECTION 2: PRODUCT AND PRICE MANAGEMENT */}
      {activeTab === 'products' && (
        <ErrorBoundary title="Product Management Section">
          <div className="settings-section-card">
            <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tags size={22} className="card-icon" />
                <h3 className="card-title">Product Catalog & Base Prices (Menswear)</h3>
              </div>
              <button
                type="button"
                className="btn-product-csv-action"
                onClick={handleExportProductCatalogCSV}
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                <FileSpreadsheet size={15} />
                <span>Export CSV</span>
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '14px' }}>
              Configure base selling prices, offer pricing options, and item active statuses for all retail items.
            </p>

            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="ledger-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Default Base Price</th>
                    <th className="text-right">Primary Offer</th>
                    <th>Quick Offer Buttons</th>
                    <th className="text-center">Reductions</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(products || []).filter((p) => p.id !== 'prod_custom_item').map((prod) => (
                    <tr key={prod.id}>
                      <td>
                        <strong>{prod.name}</strong>
                      </td>
                      <td className="text-right">₹{prod.defaultPrice}</td>
                      <td className="text-right">
                        {prod.offerPrice ? <span style={{ color: '#059669', fontWeight: 600 }}>₹{prod.offerPrice}</span> : '-'}
                      </td>
                      <td>
                        {Array.isArray(prod.offers) && prod.offers.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {prod.offers.map((off, idx) => (
                              <span key={idx} style={{ background: '#f0fdf4', color: '#064e3b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                                ₹{off}
                              </span>
                            ))}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="text-center">
                        {prod.reductionEnabled !== false ? (
                          <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 600 }}>Enabled</span>
                        ) : (
                          <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>Disabled</span>
                        )}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => toggleProductStatus(prod.id)}
                          style={{
                            border: 'none',
                            background: prod.isActive !== false ? '#dcfce7' : '#fee2e2',
                            color: prod.isActive !== false ? '#15803d' : '#b91c1c',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {prod.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-icon-action view"
                          onClick={() => handleOpenEditProduct(prod)}
                          title="Edit product price & offers"
                        >
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* SECTION 3: COMBO RULES */}
      {activeTab === 'combos' && (
        <ErrorBoundary title="Combo Rules Section">
          <div className="settings-section-card">
            <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={22} className="card-icon" />
                <h3 className="card-title">Festival Combo Promotion Rules</h3>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveCombos}
                disabled={isSavingCombos}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              >
                <Save size={15} />
                <span>{isSavingCombos ? 'Saving...' : 'Save Combo Rules'}</span>
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '16px' }}>
              Automatic combo savings evaluated in real time at checkout (e.g. 3 Shirts @ ₹1000). Cashiers can also manually toggle combos on/off per bill.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {combosConfig.map((combo) => (
                <div
                  key={combo.id}
                  style={{
                    border: `2px solid ${combo.enabled ? '#059669' : '#e2e8f0'}`,
                    borderRadius: '10px',
                    padding: '14px',
                    background: combo.enabled ? '#f0fdf4' : '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#064e3b' }}>{combo.name}</strong>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={combo.enabled}
                        onChange={() => handleComboToggle(combo.id)}
                      />
                      <span>{combo.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  </div>

                  <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#475569' }}>
                    Requires <strong>{combo.requiredQty} pcs</strong> of <em>{combo.productName || combo.name}</em>
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>Bundle Price:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#064e3b' }}>₹</span>
                      <input
                        type="number"
                        className="form-control"
                        value={combo.offerPrice}
                        onChange={(e) => handleComboPriceChange(combo.id, e.target.value)}
                        style={{ width: '100px', padding: '4px 8px', fontSize: '0.9rem', fontWeight: 700 }}
                        min="0"
                        step="50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* SECTION 4: OFFERS & ITEM REDUCTION PERMISSIONS */}
      {activeTab === 'discounts' && (
        <ErrorBoundary title="Item Reductions Section">
          <div className="settings-section-card">
            <div className="card-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Percent size={22} className="card-icon" />
                <h3 className="card-title">Item-Level Price Reduction Settings (₹10 Less)</h3>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '16px' }}>
              Allows cashiers to click "₹10 Less" on individual items in the bill to quickly accommodate customer bargaining. Prevents negative rates and preserves full audit logs.
            </p>

            <div className="form-group toggle-group" style={{ marginBottom: '16px' }}>
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="allowItemReductions"
                  checked={formData.allowItemReductions !== false}
                  onChange={handleChange}
                />
                <span className="checkmark" />
                <span className="checkbox-label" style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                  Enable Item-Level Price Reductions Store-Wide
                </span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
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
                <small className="field-hint">Amount in ₹ deducted per click (default ₹10).</small>
              </div>

              <div className="form-group">
                <label className="input-group-label">Maximum Reductions per Piece</label>
                <input
                  type="number"
                  name="maxReductionsCount"
                  className="form-control"
                  min="1"
                  max="20"
                  value={formData.maxReductionsCount ?? 5}
                  onChange={handleChange}
                />
                <small className="field-hint">e.g. 5 clicks = max ₹50 reduction per unit.</small>
              </div>
            </div>

            <div className="form-group toggle-group">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="cashierCanReduce"
                  checked={formData.cashierCanReduce !== false}
                  onChange={handleChange}
                />
                <span className="checkmark" />
                <span className="checkbox-label" style={{ fontWeight: 600 }}>
                  Allow Cashiers to apply reductions without Administrator PIN prompt
                </span>
              </label>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* SECTION 5: GOOGLE DRIVE BACKUP */}
      {activeTab === 'gdrive' && (
        <ErrorBoundary title="Google Drive Cloud Section">
          <div className="settings-section-card">
            <div className="card-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={24} className="card-icon" style={{ color: '#0284c7' }} />
                <h3 className="card-title">Google Drive Cloud Storage & Backups</h3>
              </div>
              {isDriveConnected ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 700, fontSize: '0.85rem' }}>
                  <CheckCircle2 size={16} /> Connected to Google Drive
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>
                  <XCircle size={16} /> Not Connected
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '14px' }}>
              Connect your shop's Google account to archive bills, daily JSON database backups, and sales CSV ledgers. Google Drive uploads are <strong>MANUAL ONLY</strong> (no silent background uploads).
            </p>

            {/* Folder Structure Representation */}
            <pre style={{ background: '#0f172a', color: '#38bdf8', padding: '12px 16px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
              {`FESTIVAL SALES BILL/
  ├── PC BILLING/        (Invoices generated on shop computer)
  ├── MOBILE BILLING/    (Invoices generated on mobile handhelds)
  ├── DAILY BACKUPS/     (Daily full JSON database snapshots)
  └── SALES REPORTS/     (CSV sales ledgers for accounting & Excel)`}
            </pre>

            {/* Connection Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
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
                    onClick={handleTestDriveFolders}
                    disabled={isTestingDrive}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Check size={16} />
                    <span>{isTestingDrive ? 'Verifying...' : 'Test Connection & Folders'}</span>
                  </button>

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

            {driveTestMessage && (
              <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', color: '#064e3b', marginBottom: '14px' }}>
                {driveTestMessage}
              </div>
            )}

            {lastDriveBackupTime && (
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '14px' }}>
                🕒 <strong>Last Successful Drive Backup:</strong> {lastDriveBackupTime}
              </div>
            )}

            {/* Custom Client ID Override */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="input-group-label" style={{ fontSize: '0.8rem' }}>
                Google OAuth 2.0 Web Client ID
              </label>
              <input
                type="text"
                name="googleClientId"
                className="form-control"
                value={formData.googleClientId || ''}
                onChange={handleChange}
                placeholder="e.g. 1016904752396-xxxx.apps.googleusercontent.com"
                style={{ fontSize: '0.85rem' }}
              />
              <small className="field-hint">
                Default configured for Festival Clothing. Can be overridden if creating a new Google Cloud project.
              </small>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* SECTION 6: RECEIPT & INVOICE SETTINGS */}
      {activeTab === 'receipt' && (
        <ErrorBoundary title="Receipt & Printer Section">
          <div className="settings-section-card">
            <div className="card-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={22} className="card-icon" />
                <h3 className="card-title">Receipt Printing & Invoice Settings</h3>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '16px' }}>
              Configure invoice layout, policy notices, and browser print prompt defaults.
            </p>

            <div className="form-group">
              <label className="input-group-label">Default Printing Format</label>
              <select
                name="defaultPrintMode"
                className="form-control"
                value={formData.defaultPrintMode || 'thermal'}
                onChange={handleChange}
              >
                <option value="thermal">Thermal POS Receipt (Clean Monospace A4 Format)</option>
                <option value="a4">Standard A4 / Letter Retail Invoice</option>
              </select>
            </div>

            <div className="form-group">
              <label className="input-group-label">Receipt Footer Exchange Policy / Message</label>
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
                  Automatically open browser printer dialog immediately after checkout save
                </span>
              </label>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* SECTION 7: TERMINAL & DATABASE MANAGEMENT */}
      {activeTab === 'admin' && (
        <ErrorBoundary title="Terminal & Database Section">
          <div className="settings-section-card">
            <div className="card-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={22} className="card-icon" />
                <h3 className="card-title">Terminal Registration & Database Management</h3>
              </div>
            </div>

            {/* Terminal Designation */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.95rem', color: '#1e293b' }}>
                Device Terminal Designation
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '12px' }}>
                Register this specific device as either the main cash counter PC or a mobile handheld terminal.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
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
                      Saves locally and uploads to Google Drive under <code>PC BILLING/</code>.
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
                      Saves locally and uploads to Google Drive under <code>MOBILE BILLING/</code>.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Full Database Export & Restore */}
            <div className="backup-management-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div className="backup-card-box highlight" style={{ border: '1px solid #cbd5e1', padding: '16px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 6px', color: '#064e3b' }}>Full System Backup (.JSON)</h4>
                <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '12px' }}>
                  Exports all saved bills, customer records, product prices, and audit logs to a local JSON file. Recommended at closing every evening.
                </p>
                <button
                  type="button"
                  className="btn-backup-action"
                  onClick={handleDownloadBackup}
                  style={{ width: '100%' }}
                >
                  <Download size={16} />
                  <span>Export System Backup (JSON)</span>
                </button>
              </div>

              <div className="backup-card-box" style={{ border: '1px solid #cbd5e1', padding: '16px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>Restore / Import Database (.JSON)</h4>
                <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '12px' }}>
                  Safely imports bills and settings from a previous backup without overwriting existing bills.
                </p>
                <label className="btn-restore-action" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  <Upload size={16} style={{ display: 'inline', marginRight: '6px' }} />
                  <span>{isRestoring ? 'Restoring...' : 'Import Backup File (JSON)'}</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileRestore}
                    style={{ display: 'none' }}
                    disabled={isRestoring}
                  />
                </label>
              </div>
            </div>

            {/* Critical Data Storage Notice */}
            <div
              style={{
                border: '2px solid #f59e0b',
                background: '#fffbeb',
                padding: '14px',
                borderRadius: '8px',
                color: '#92400e',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '6px' }}>
                <AlertTriangle size={18} />
                <span>CRITICAL LOCAL DATA NOTICE (WisdoFestivalPOS_DB)</span>
              </div>
              <p style={{ margin: '0 0 6px', lineHeight: 1.4 }}>
                All transaction records are saved locally inside this browser's IndexedDB. To protect against accidental browser cache clearing or device loss, connect Google Drive or download a JSON backup at daily closing.
              </p>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* SECTION 7: STAFF EMAIL ACCESS CONTROL */}
      {activeTab === 'staff' && (
        <ErrorBoundary title="Staff Accounts Section">
          <div className="settings-section-card">
            <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={22} className="card-icon" />
                <h3 className="card-title">Authorized Staff Email Accounts (Admin Controlled)</h3>
              </div>
              <div>
                {isFirebaseConfigured ? (
                  <span className="badge-sync-ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', padding: '4px 10px' }}>
                    <ShieldCheck size={14} /> Firebase Auth & Firestore Active
                  </span>
                ) : (
                  <span className="badge-sync-offline" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', padding: '4px 10px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
                    <Info size={14} /> Local Offline Mode (PIN + Storage Cache)
                  </span>
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '18px', lineHeight: 1.5 }}>
              Manage authorized Google accounts for cashiers and administrators. Cashiers can ring up bills and share WhatsApp invoices, while only Admins can alter prices, combos, and store settings.
            </p>

            {/* Add New Staff Email Form */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', color: '#064e3b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserPlus size={16} /> Authorize New Staff Member
              </h4>
              <form onSubmit={handleAddStaffSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 240px' }}>
                  <label className="input-group-label" style={{ marginBottom: '4px' }}>Staff Google Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. staff.cashier@gmail.com"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="input-group-label" style={{ marginBottom: '4px' }}>Assigned Role</label>
                  <select
                    className="form-control"
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                  >
                    <option value="CASHIER">CASHIER (Billing Desk)</option>
                    <option value="ADMIN">ADMIN (Full Access)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isAddingStaff}
                  style={{ height: '42px', padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserCheck size={16} />
                  <span>{isAddingStaff ? 'Approving...' : 'Approve Staff'}</span>
                </button>
              </form>
            </div>

            {/* Approved Staff Members List */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#1e293b' }}>
                Currently Approved Accounts ({staffList?.length || 0})
              </h4>

              {(!staffList || staffList.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No staff members registered yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {staffList.map((staff) => {
                    const isRevoked = staff.status === 'revoked';
                    const isOwner = staff.approvedBy === 'SYSTEM_OWNER' || staff.email === 'leviraja670@gmail.com';

                    return (
                      <div
                        key={staff.email}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: isRevoked ? '1px dashed #cbd5e1' : '1px solid #e2e8f0',
                          background: isRevoked ? '#f8fafc' : '#ffffff',
                          opacity: isRevoked ? 0.75 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: staff.role === 'ADMIN' ? '#dcfce7' : '#e0f2fe',
                              color: staff.role === 'ADMIN' ? '#166534' : '#0369a1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                            }}
                          >
                            {staff.email ? staff.email[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>
                              {staff.email}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                              <span>Approved {staff.approvedAt ? new Date(staff.approvedAt).toLocaleDateString('en-IN') : 'Default'}</span>
                              {isOwner && <span style={{ color: '#059669', fontWeight: 600 }}>• Primary Owner</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: staff.role === 'ADMIN' ? '#dcfce7' : '#e0f2fe',
                              color: staff.role === 'ADMIN' ? '#166534' : '#0369a1',
                            }}
                          >
                            {staff.role}
                          </span>

                          {isRevoked ? (
                            <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, background: '#fee2e2', padding: '3px 8px', borderRadius: '4px' }}>
                              REVOKED
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, background: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
                              ACTIVE
                            </span>
                          )}

                          {!isOwner && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                onClick={() => changeStaffRole(staff.email, staff.role === 'ADMIN' ? 'CASHIER' : 'ADMIN')}
                                title="Toggle between Cashier and Admin role"
                              >
                                Change to {staff.role === 'ADMIN' ? 'CASHIER' : 'ADMIN'}
                              </button>

                              {isRevoked ? (
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{ fontSize: '0.75rem', padding: '4px 8px', background: '#059669' }}
                                  onClick={() => approveStaff(staff.email, staff.role)}
                                >
                                  Re-Activate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ fontSize: '0.75rem', padding: '4px 8px', color: '#dc2626', borderColor: '#fca5a5' }}
                                  onClick={() => revokeStaff(staff.email)}
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Offline Fallback Notice */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#166534' }}>
              <strong>Admin PIN Fallback:</strong> If operating offline or without Google sign-in, the Administrator PINs <code>2111</code> and <code>1234</code> remain fully available to unlock store administration anytime on any device.
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Edit Product Price Modal */}
      {editingProduct && (
        <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Price — {editingProduct.name}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingProduct(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProductModal}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="input-group-label">Product Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="input-group-label">Default Base Price (₹) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={productForm.defaultPrice}
                    onChange={(e) => setProductForm({ ...productForm, defaultPrice: e.target.value })}
                    required
                    min="0"
                    step="10"
                  />
                </div>

                <div className="form-group">
                  <label className="input-group-label">Primary Offer Price (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={productForm.offerPrice}
                    onChange={(e) => setProductForm({ ...productForm, offerPrice: e.target.value })}
                    placeholder="e.g. 550"
                    min="0"
                    step="10"
                  />
                </div>

                <div className="form-group">
                  <label className="input-group-label">Quick Offer Price Buttons (Comma separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={productForm.offersStr}
                    onChange={(e) => setProductForm({ ...productForm, offersStr: e.target.value })}
                    placeholder="e.g. 550, 500"
                  />
                  <small className="field-hint">e.g. 550, 500 will appear as quick tap buttons on mobile.</small>
                </div>

                <div className="form-group toggle-group">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={productForm.reductionEnabled}
                      onChange={(e) => setProductForm({ ...productForm, reductionEnabled: e.target.checked })}
                    />
                    <span className="checkmark" />
                    <span className="checkbox-label">Allow ₹10 Less Reductions on this product</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingProduct(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Save size={16} />
                  <span>Update Price</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
