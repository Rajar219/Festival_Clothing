import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { formatINR } from '../utils/currency';
import { DEFAULT_COMBOS } from '../utils/comboEngine';
import {
  Tags,
  CheckCircle,
  XCircle,
  Edit2,
  Save,
  X,
  AlertCircle,
  Info,
  ShieldAlert,
  Sparkles,
  Percent,
  Sliders,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';

export function ProductManagementView() {
  const {
    products,
    updateProductDetails,
    toggleProductStatus,
    settings,
    updateSettings,
    isAdmin,
    setIsAdminAuthModalOpen,
  } = usePOS();

  // Strictly 8 menswear categories (exclude any custom item)
  const menswearProducts = products.filter((p) => p.id !== 'prod_custom_item');

  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    defaultPrice: '',
    offerPrice: '',
    offersStr: '',
    reductionEnabled: true,
    maxReductionPerUnit: 150,
    isActive: true,
    image: '',
  });

  // Combos Configuration State
  const currentCombos = settings.combos || DEFAULT_COMBOS;
  const [combosConfig, setCombosConfig] = useState(currentCombos);
  const [isSavingCombos, setIsSavingCombos] = useState(false);

  const { handleBackdropClick } = useModalBehavior({
    isOpen: Boolean(editingProduct),
    onClose: () => setEditingProduct(null),
  });

  if (!isAdmin) {
    return (
      <div className="admin-locked-container">
        <ShieldAlert size={48} className="lock-alert-icon" />
        <h2>Administrator Access Required</h2>
        <p>You must be authenticated as an Administrator to view and edit product configurations.</p>
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

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    const offersArr = Array.isArray(prod.offers) ? prod.offers : (prod.offerPrice ? [prod.offerPrice] : []);
    setFormData({
      name: prod.name,
      defaultPrice: String(prod.defaultPrice || ''),
      offerPrice: prod.offerPrice !== null && prod.offerPrice !== undefined ? String(prod.offerPrice) : '',
      offersStr: offersArr.join(', '),
      reductionEnabled: prod.reductionEnabled !== false,
      maxReductionPerUnit: prod.maxReductionPerUnit !== undefined ? Number(prod.maxReductionPerUnit) : 150,
      isActive: prod.isActive !== false,
      image: prod.image || `/products/${prod.id.replace('prod_', '')}.jpg`,
    });
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    const basePrice = parseFloat(formData.defaultPrice);
    if (isNaN(basePrice) || basePrice < 0) {
      alert('Please enter a valid positive base price.');
      return;
    }

    let parsedOffer = null;
    if (formData.offerPrice.trim() !== '') {
      const off = parseFloat(formData.offerPrice);
      if (isNaN(off) || off < 0) {
        alert('Please enter a valid offer price or leave it blank.');
        return;
      }
      parsedOffer = off;
    }

    // Parse offers list (e.g. "550, 500")
    let offersList = [];
    if (formData.offersStr.trim() !== '') {
      offersList = formData.offersStr
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n >= 0);
    } else if (parsedOffer !== null) {
      offersList = [parsedOffer];
    }

    const maxRed = parseFloat(formData.maxReductionPerUnit);
    const isCombo = Boolean(editingProduct.isCombo || editingProduct.id?.includes('combo'));
    const pieces = editingProduct.piecesPerUnit || (editingProduct.id === 'prod_2_shorts_combo' ? 2 : 3);
    const origVal = editingProduct.originalCombinedValue || (pieces === 3 && editingProduct.id === 'prod_3_shirts_combo' ? 1800 : (pieces === 2 ? 700 : basePrice));
    const comboSavings = Math.max(0, origVal - basePrice);
    const avgPiecePrice = Number((basePrice / pieces).toFixed(2));

    await updateProductDetails(editingProduct.id, {
      name: formData.name.trim() || editingProduct.name,
      defaultPrice: basePrice,
      offerPrice: isCombo ? null : parsedOffer,
      offers: isCombo ? [] : offersList,
      reductionEnabled: isCombo ? false : Boolean(formData.reductionEnabled),
      maxReductionPerUnit: isCombo ? 0 : (!isNaN(maxRed) && maxRed >= 0 ? maxRed : 150),
      isActive: Boolean(formData.isActive),
      image: formData.image.trim() || editingProduct.image,
      isCombo,
      piecesPerUnit: pieces,
      originalCombinedValue: origVal,
      comboSavingsPerUnit: comboSavings,
      avgPricePerPiece: avgPiecePrice,
    });

    setEditingProduct(null);
  };

  const handleComboChange = (comboId, field, value) => {
    setCombosConfig((prev) =>
      prev.map((c) => {
        if (c.id === comboId) {
          return {
            ...c,
            [field]: value,
          };
        }
        return c;
      })
    );
  };

  const handleSaveCombos = async () => {
    try {
      setIsSavingCombos(true);
      await updateSettings({
        ...settings,
        combos: combosConfig,
      });
    } finally {
      setIsSavingCombos(false);
    }
  };

  return (
    <div className="product-mgmt-container">
      <div className="mgmt-header">
        <div className="mgmt-title-row">
          <Tags size={24} className="mgmt-icon" />
          <div>
            <h2 className="page-heading">Product Catalogue & Pricing Management</h2>
            <p className="page-subheading">
              Configure default prices, festival offer buttons, ₹10 Less limits, and hanger packshots for all 8 menswear categories.
            </p>
          </div>
        </div>
      </div>

      <div className="sample-data-notice" style={{ background: '#f0fdf4', border: '1px solid #a7f3d0' }}>
        <Info size={18} style={{ color: '#059669', flexShrink: 0 }} />
        <span style={{ color: '#064e3b' }}>
          <strong>Product Pricing Rules:</strong> Setting an <em>Offer Price</em> displays a special festival offer badge on the product card and provides quick-pricing buttons for cashiers. Historical bills retain their frozen original prices.
        </span>
      </div>

      {/* 8 Product Categories Catalog Table */}
      <div className="product-catalog-card">
        <table className="catalog-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>Key</th>
              <th style={{ width: '80px' }}>Packshot</th>
              <th>Product Details</th>
              <th style={{ width: '130px' }} className="text-right">Regular Price</th>
              <th style={{ width: '160px' }} className="text-right">Offer Options</th>
              <th style={{ width: '140px' }} className="text-center">₹10 Reduction</th>
              <th style={{ width: '100px' }} className="text-center">Status</th>
              <th style={{ width: '130px' }} className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {menswearProducts.map((prod) => {
              const hasOffer = prod.offerPrice !== null && prod.offerPrice !== undefined && Number(prod.offerPrice) >= 0;
              const offersList = Array.isArray(prod.offers) && prod.offers.length > 0 ? prod.offers : (hasOffer ? [prod.offerPrice] : []);

              return (
                <tr key={prod.id} className={!prod.isActive ? 'row-inactive' : ''}>
                  <td>
                    <kbd>{prod.shortcut}</kbd>
                  </td>
                  <td>
                    <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={prod.image || `/products/${prod.id.replace('prod_', '')}.jpg`}
                        alt={prod.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => { e.target.src = '/products/shirt.jpg'; }}
                      />
                    </div>
                  </td>
                  <td>
                    <strong className="prod-name-title" style={{ fontSize: '0.95rem' }}>{prod.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      ID: <code>{prod.id}</code>
                    </div>
                  </td>
                  <td className="text-right">
                    <span className="prod-price-display" style={{ fontWeight: 600 }}>
                      ₹{Number(prod.defaultPrice).toFixed(2)}
                    </span>
                  </td>
                  <td className="text-right">
                    {offersList.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end' }}>
                        {offersList.map((o) => (
                          <span key={o} style={{ color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <Sparkles size={10} /> ₹{o}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>None</span>
                    )}
                  </td>
                  <td className="text-center">
                    {prod.reductionEnabled !== false ? (
                      <span style={{ fontSize: '0.8rem', color: '#166534', background: '#f0fdf4', padding: '3px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                        Active (Max ₹{prod.maxReductionPerUnit || 150})
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px' }}>
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="text-center">
                    {prod.isActive ? (
                      <span className="badge-status-active">Active</span>
                    ) : (
                      <span className="badge-status-inactive">Inactive</span>
                    )}
                  </td>
                  <td className="text-center">
                    <button
                      type="button"
                      className="btn-action-edit"
                      onClick={() => handleOpenEdit(prod)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}
                    >
                      <Edit2 size={13} />
                      <span>Configure</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Combos & Bundle Offers Section */}
      <div style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} color="#059669" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>
                Combos & Bundle Offers Configuration
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                Configure festival bundle prices, minimum qualifying quantities, and toggle auto-detection.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveCombos}
            disabled={isSavingCombos}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={15} />
            <span>{isSavingCombos ? 'Saving...' : 'Save Combo Settings'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
          {combosConfig.map((combo) => (
            <div
              key={combo.id}
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                border: combo.isActive ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong style={{ fontSize: '0.95rem', color: combo.isActive ? '#065f46' : '#64748b' }}>
                  {combo.name}
                </strong>
                <label className="checkbox-container" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={combo.isActive !== false}
                    onChange={(e) => handleComboChange(combo.id, 'isActive', e.target.checked)}
                  />
                  <span className="checkmark" />
                  <span className="checkbox-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    {combo.isActive ? 'Active' : 'Disabled'}
                  </span>
                </label>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>
                {combo.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Required Quantity:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={combo.requiredQty}
                    onChange={(e) => handleComboChange(combo.id, 'requiredQty', Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Combo Price (₹):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={combo.comboPrice}
                    onChange={(e) => handleComboChange(combo.id, 'comboPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#059669',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true">
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h2 className="modal-title">Configure Product</h2>
                <span className="modal-subtitle">{editingProduct.name} (Key {editingProduct.shortcut})</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingProduct(null)}
                aria-label="Close product configuration dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveModal}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="input-group-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="input-group-label">{editingProduct.isCombo ? 'Combo Selling Price (₹) *' : 'Base Default Price (₹) *'}</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="form-control"
                      value={formData.defaultPrice}
                      onChange={(e) => setFormData({ ...formData, defaultPrice: e.target.value })}
                      required
                    />
                  </div>

                  {!editingProduct.isCombo ? (
                    <div className="form-group">
                      <label className="input-group-label">Offer Options (comma separated, ₹)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 550, 500"
                        value={formData.offersStr}
                        onChange={(e) => setFormData({ ...formData, offersStr: e.target.value })}
                      />
                      <small style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Provides quick offer buttons in cashier price selector.
                      </small>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="input-group-label">Combo Details</label>
                      <div style={{ fontSize: '0.8rem', color: '#065f46', background: '#ecfdf5', padding: '8px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                        {editingProduct.piecesPerUnit || 3} pieces pack. Regular individual offers & ₹10 reductions are locked.
                      </div>
                    </div>
                  )}
                </div>

                {!editingProduct.isCombo && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="checkbox-container" style={{ marginTop: '8px' }}>
                        <input
                          type="checkbox"
                          checked={formData.reductionEnabled}
                          onChange={(e) => setFormData({ ...formData, reductionEnabled: e.target.checked })}
                        />
                        <span className="checkmark" />
                        <span className="checkbox-label" style={{ fontWeight: 600 }}>
                          Enable ₹10 Less on this item
                        </span>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="input-group-label">Max Reduction / Unit (₹)</label>
                      <input
                        type="number"
                        step="10"
                        min="0"
                        className="form-control"
                        value={formData.maxReductionPerUnit}
                        onChange={(e) => setFormData({ ...formData, maxReductionPerUnit: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="input-group-label">Packshot Image Path</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="/products/shirt.jpg"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #cbd5e1', background: '#fff' }}>
                      <img
                        src={formData.image || editingProduct.image}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => { e.target.src = '/products/shirt.jpg'; }}
                      />
                    </div>
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                      Hanger packshot photography displayed on clean neutral background.
                    </small>
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span className="checkmark" />
                    <span className="checkbox-label" style={{ fontWeight: 600 }}>
                      Product is Active & visible in billing grid
                    </span>
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingProduct(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Save size={16} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
