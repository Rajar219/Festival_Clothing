import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { formatINR } from '../utils/currency';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  ShoppingBag,
  Tag,
  Undo2,
  RotateCcw,
  Package,
  Check,
  X,
  Edit3,
} from 'lucide-react';
import { PriceSelectorModal } from './PriceSelectorModal';

export function BillingTable() {
  const {
    items,
    updateItemQty,
    removeItem,
    clearBill,
    applyItemTenLess,
    undoItemTenLess,
    resetItemPrice,
    updateItemPrice,
    products,
  } = usePOS();

  const [editingItemForPrice, setEditingItemForPrice] = useState(null);

  // Total pieces reflects 3 pieces per 3-Shirts combo, 2 pieces per 2-Shorts combo, etc.
  const totalPieces = items.reduce(
    (acc, it) => acc + ((Number(it.piecesPerUnit) || 1) * (Number(it.qty) || 1)),
    0
  );

  const handleOpenPriceModal = (item) => {
    // If it's a fixed combo pack, price is non-editable by cashiers
    if (item.isCombo || item.productId?.includes('combo')) {
      return;
    }

    const matchingProd = products.find((p) => p.id === item.productId || p.name === item.name) || {
      id: item.productId,
      name: item.name,
      defaultPrice: item.originalUnitPrice || item.unitPrice,
      offers: [],
      image: item.image,
    };
    setEditingItemForPrice({ item, product: matchingProd });
  };

  const handleConfirmPriceUpdate = (newPrice, newQty) => {
    if (editingItemForPrice && editingItemForPrice.item) {
      updateItemPrice(editingItemForPrice.item.id, newPrice, newQty);
    }
  };

  return (
    <div className="billing-table-card">
      <div className="table-header-bar">
        <div className="table-title-wrap">
          <div className="table-icon-badge">
            <ShoppingCart size={16} />
          </div>
          <div>
            <h2 className="table-title">Current Bill</h2>
            <span className="items-meta-text">
              {items.length} {items.length === 1 ? 'line item' : 'line items'} • {totalPieces} {totalPieces === 1 ? 'piece' : 'pieces'}
            </span>
          </div>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            className="clear-bill-btn"
            onClick={() => clearBill(true)}
            title="Clear all items from active bill"
          >
            <Trash2 size={14} />
            <span>Clear Bill</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-billing-state">
          <div className="empty-icon-wrap">
            <ShoppingBag size={48} className="empty-icon" />
          </div>
          <h3 className="empty-title">Select a product to start billing</h3>
          <p className="empty-subtitle">
            Click any product card above or press keys <kbd>1</kbd> to <kbd>9</kbd> on your keyboard.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop View: Full 7-column ledger table (>= 768px) */}
          <div className="table-scroll-container desktop-table-view">
            <table className="billing-table">
              <thead>
                <tr>
                  <th style={{ width: '55px' }} className="text-center">SL. NO.</th>
                  <th style={{ minWidth: '170px' }}>PRODUCT</th>
                  <th style={{ width: '140px' }} className="text-right">UNIT PRICE</th>
                  <th style={{ minWidth: '160px' }} className="text-center">₹10 REDUCTION</th>
                  <th style={{ width: '125px' }} className="text-center">QUANTITY</th>
                  <th style={{ width: '130px' }} className="text-right">AMOUNT</th>
                  <th style={{ width: '55px' }} className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isComboItem = Boolean(item.isCombo || item.productId?.includes('combo'));
                  const isDiscounted = (item.reductionPerUnit || 0) > 0;
                  const totalItemReduction = (item.reductionPerUnit || 0) * (item.qty || 1);
                  const piecesInLine = (Number(item.piecesPerUnit) || 1) * (Number(item.qty) || 1);

                  return (
                    <tr key={item.id} className={`billing-row ${isDiscounted ? 'row-discounted' : ''} ${isComboItem ? 'row-combo' : ''}`}>
                      {/* SL. NO. */}
                      <td className="text-center">
                        <span className="sno-badge">{item.sno}</span>
                      </td>

                      {/* PRODUCT */}
                      <td>
                        <div className="item-name-cell">
                          {item.image && (
                            <img
                              src={item.image}
                              alt=""
                              className="item-row-thumbnail"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <div className="item-name-meta-wrap">
                            <span className="item-name-text" style={{ fontWeight: isComboItem ? 700 : 600 }}>
                              {item.name}
                            </span>

                            {isComboItem ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                                <span style={{ background: '#ecfdf5', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>
                                  {piecesInLine} Pieces {item.avgPricePerPiece ? `(₹${item.avgPricePerPiece}/pc)` : ''}
                                </span>
                                {item.comboSavingsPerUnit && (
                                  <span style={{ color: '#059669', fontSize: '0.72rem', fontWeight: 600 }}>
                                    Saves ₹{item.comboSavingsPerUnit * item.qty}
                                  </span>
                                )}
                              </div>
                            ) : isDiscounted ? (
                              <span className="item-discount-tag">
                                ₹{item.reductionPerUnit} off / unit
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* UNIT PRICE with Quick Edit option for regular items */}
                      <td className="text-right">
                        <div
                          className="unit-price-cell"
                          onClick={() => handleOpenPriceModal(item)}
                          title={isComboItem ? 'Fixed combo price' : 'Click to edit unit selling price'}
                          style={{ cursor: isComboItem ? 'default' : 'pointer' }}
                        >
                          {isComboItem && item.originalCombinedValue ? (
                            <span className="original-price-strike">
                              ₹{item.originalCombinedValue}
                            </span>
                          ) : isDiscounted ? (
                            <span className="original-price-strike">
                              ₹{item.originalUnitPrice || item.unitPrice + item.reductionPerUnit}
                            </span>
                          ) : null}

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span className={`unit-price-text ${isDiscounted ? 'discounted-price' : ''} ${isComboItem ? 'combo-price-text' : ''}`}>
                              {formatINR(item.unitPrice, true)}
                            </span>
                            {!isComboItem && <Edit3 size={11} color="#64748b" />}
                          </div>
                        </div>
                      </td>

                      {/* ITEM-WISE ₹10 LESS CONTROL (Disabled on Combos) */}
                      <td className="text-center">
                        {isComboItem ? (
                          <span style={{ fontSize: '0.78rem', color: '#065f46', background: '#ecfdf5', padding: '4px 10px', borderRadius: '6px', border: '1px solid #a7f3d0', fontWeight: 600 }}>
                            Combo Pack (Fixed Rate)
                          </span>
                        ) : (
                          <div className="item-reduction-control-wrap">
                            <button
                              type="button"
                              className="btn-item-ten-less"
                              onClick={() => applyItemTenLess(item.id)}
                              disabled={item.unitPrice < 10 || item.reductionEnabled === false}
                              title={item.reductionEnabled === false ? 'Reductions disabled for this product' : `Reduce unit price of ${item.name} by ₹10 (current: ₹${item.unitPrice})`}
                            >
                              <Tag size={12} />
                              <span>₹10 Less</span>
                            </button>

                            {isDiscounted && (
                              <div className="item-reduction-feedback">
                                <span className="reduction-pill">
                                  -₹{item.reductionPerUnit}/pc
                                  {item.qty > 1 && (
                                    <small className="total-reduction-hint"> (-₹{totalItemReduction} on {item.qty} pcs)</small>
                                  )}
                                </span>
                                <div className="undo-actions-inline">
                                  <button
                                    type="button"
                                    className="btn-item-undo"
                                    onClick={() => undoItemTenLess(item.id)}
                                    title="Undo one ₹10 reduction"
                                  >
                                    <Undo2 size={11} />
                                    <span>Undo</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-item-reset"
                                    onClick={() => resetItemPrice(item.id)}
                                    title="Reset to catalogue price"
                                  >
                                    <RotateCcw size={11} />
                                    <span>Reset</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* QUANTITY (Allows multiple combos) */}
                      <td>
                        <div className="qty-control-group">
                          <button
                            type="button"
                            className="qty-btn minus"
                            onClick={() => updateItemQty(item.id, (item.qty || 1) - 1)}
                            disabled={item.qty <= 1}
                            aria-label={`Decrease quantity of ${item.name}`}
                            title="Decrease quantity"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="999"
                            className="qty-input"
                            value={item.qty}
                            onChange={(e) => updateItemQty(item.id, e.target.value)}
                            aria-label={`Quantity for ${item.name}`}
                            title="Click to edit quantity"
                          />
                          <button
                            type="button"
                            className="qty-btn plus"
                            onClick={() => updateItemQty(item.id, (item.qty || 1) + 1)}
                            aria-label={`Increase quantity of ${item.name}`}
                            title="Increase quantity"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </td>

                      {/* AMOUNT */}
                      <td className="text-right">
                        <div className="line-total-cell">
                          <span className="line-total-amount">
                            {formatINR(item.lineTotal, true)}
                          </span>
                          {item.qty > 1 && (
                            <span className="line-calc-breakdown">
                              ({item.qty} × ₹{item.unitPrice})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="text-center">
                        <button
                          type="button"
                          className="delete-item-btn"
                          onClick={() => removeItem(item.id)}
                          title={`Remove ${item.name}`}
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Compact, Touch-Optimized Cards (< 768px) */}
          <div className="mobile-billing-list">
            {items.map((item) => {
              const isComboItem = Boolean(item.isCombo || item.productId?.includes('combo'));
              const isDiscounted = (item.reductionPerUnit || 0) > 0;
              const piecesInLine = (Number(item.piecesPerUnit) || 1) * (Number(item.qty) || 1);

              return (
                <div key={item.id} className={`mobile-cart-item-card ${isDiscounted ? 'discounted-card' : ''} ${isComboItem ? 'combo-cart-card' : ''}`}>
                  {/* Top Row: Item Details, Unit Price, and Remove Button */}
                  <div className="mobile-item-top-row">
                    <div className="mobile-item-info">
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="mobile-item-thumb"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div className="mobile-item-text">
                        <span className="mobile-item-name" style={{ fontWeight: isComboItem ? 700 : 600 }}>
                          {item.name}
                        </span>
                        <div className="mobile-unit-price-line" onClick={() => handleOpenPriceModal(item)} style={{ cursor: isComboItem ? 'default' : 'pointer' }}>
                          {isComboItem && item.originalCombinedValue ? (
                            <span className="mobile-orig-price">
                              ₹{item.originalCombinedValue}
                            </span>
                          ) : isDiscounted ? (
                            <span className="mobile-orig-price">
                              ₹{item.originalUnitPrice || item.unitPrice + item.reductionPerUnit}
                            </span>
                          ) : null}

                          <span className={`mobile-final-rate ${isDiscounted ? 'rate-green' : ''}`}>
                            ₹{item.unitPrice} {isComboItem ? '/ pack' : '/ pc'}
                          </span>
                          {!isComboItem && <Edit3 size={10} color="#64748b" style={{ marginLeft: '4px' }} />}
                        </div>
                        {isComboItem && (
                          <div style={{ fontSize: '0.72rem', color: '#065f46', marginTop: '2px', fontWeight: 600 }}>
                            {piecesInLine} Pieces • Saves ₹{(item.comboSavingsPerUnit || 800) * item.qty}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mobile-remove-btn"
                      onClick={() => removeItem(item.id)}
                      title={`Remove ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Middle Row: Item-Level Reduction & Line Total */}
                  <div className="mobile-reduction-row">
                    <div className="mobile-red-actions">
                      {isComboItem ? (
                        <span style={{ fontSize: '0.72rem', color: '#065f46', background: '#ecfdf5', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Combo Pack
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="mobile-btn-ten-less"
                            onClick={() => applyItemTenLess(item.id)}
                            disabled={item.unitPrice < 10 || item.reductionEnabled === false}
                          >
                            <Tag size={12} />
                            <span>₹10 Less</span>
                          </button>

                          {isDiscounted && (
                            <div className="mobile-red-feedback">
                              <span className="mobile-red-pill">
                                -₹{item.reductionPerUnit}
                              </span>
                              <button
                                type="button"
                                className="mobile-btn-undo"
                                onClick={() => undoItemTenLess(item.id)}
                                title="Undo ₹10 reduction"
                              >
                                <Undo2 size={11} />
                              </button>
                              <button
                                type="button"
                                className="mobile-btn-reset"
                                onClick={() => resetItemPrice(item.id)}
                                title="Reset to catalogue price"
                              >
                                <RotateCcw size={11} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="mobile-line-total-wrap">
                      <span className="mobile-line-total-label">Total:</span>
                      <span className="mobile-line-total-val">{formatINR(item.lineTotal, true)}</span>
                    </div>
                  </div>

                  {/* Bottom Row: Quantity Controls */}
                  <div className="mobile-qty-row">
                    <span className="mobile-qty-label">Quantity:</span>
                    <div className="mobile-qty-ctrl">
                      <button
                        type="button"
                        className="mobile-qty-btn"
                        onClick={() => updateItemQty(item.id, (item.qty || 1) - 1)}
                        disabled={item.qty <= 1}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="mobile-qty-display">{item.qty}</span>
                      <button
                        type="button"
                        className="mobile-qty-btn"
                        onClick={() => updateItemQty(item.id, (item.qty || 1) + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Edit Line Item Price Modal */}
      {editingItemForPrice && (
        <PriceSelectorModal
          isOpen={Boolean(editingItemForPrice)}
          onClose={() => setEditingItemForPrice(null)}
          product={editingItemForPrice.product}
          item={editingItemForPrice.item}
          onConfirmPrice={handleConfirmPriceUpdate}
        />
      )}
    </div>
  );
}
