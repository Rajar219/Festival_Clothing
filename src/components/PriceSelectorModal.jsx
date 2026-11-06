import React, { useState, useEffect, useRef } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { formatINR } from '../utils/currency';
import { Tag, Sparkles, Check, X, AlertTriangle, Minus, Plus } from 'lucide-react';

export function PriceSelectorModal({
  isOpen,
  onClose,
  product,
  item = null,
  onConfirmPrice,
}) {
  const [selectedPrice, setSelectedPrice] = useState('');
  const [qty, setQty] = useState(1);
  const [qtyInput, setQtyInput] = useState('1');
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && product) {
      const initialPrice = item
        ? (item.unitPrice !== undefined ? item.unitPrice : item.originalUnitPrice)
        : (product.offerPrice !== null && product.offerPrice !== undefined && Number(product.offerPrice) >= 0
          ? Number(product.offerPrice)
          : Number(product.defaultPrice));

      const initialQty = item ? Number(item.qty || 1) : 1;
      setSelectedPrice(String(initialPrice));
      setQty(initialQty);
      setQtyInput(String(initialQty));
      setRequiresConfirmation(false);
      setErrorMsg('');

      // Auto-focus the price input after open animation
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 60);
    }
  }, [isOpen, product, item]);

  const { handleBackdropClick } = useModalBehavior({
    isOpen,
    onClose,
  });

  if (!isOpen || !product) return null;

  const originalPrice = Number(product.defaultPrice || (item?.originalUnitPrice ?? 0));
  const offers = Array.isArray(product.offers) ? product.offers : (product.offerPrice ? [product.offerPrice] : []);

  // Price selections do NOT reset quantity
  const handlePriceButtonClick = (price) => {
    setSelectedPrice(String(price));
    setRequiresConfirmation(false);
    setErrorMsg('');
  };

  // Reductions do NOT reset quantity
  const handleApplyReduction = (amount) => {
    const current = parseFloat(selectedPrice) || originalPrice;
    const next = Math.max(0, current - amount);
    setSelectedPrice(String(next));
    setRequiresConfirmation(false);
    setErrorMsg('');
  };

  // Quantity controls do NOT reset price
  const handleQtyChange = (val) => {
    setQtyInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setQty(parsed);
    }
  };

  const handleQtyBlur = () => {
    const parsed = parseInt(qtyInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      setQty(1);
      setQtyInput('1');
    } else {
      setQty(parsed);
      setQtyInput(String(parsed));
    }
  };

  const handleIncrement = () => {
    setQty((prev) => {
      const next = prev + 1;
      setQtyInput(String(next));
      return next;
    });
  };

  const handleDecrement = () => {
    setQty((prev) => {
      const next = Math.max(1, prev - 1);
      setQtyInput(String(next));
      return next;
    });
  };

  const numericPrice = parseFloat(selectedPrice) || 0;
  const effectiveQty = Math.max(1, parseInt(qtyInput, 10) || qty || 1);
  const lineTotal = numericPrice * effectiveQty;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const priceNum = parseFloat(selectedPrice);

    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMsg('Price cannot be negative or invalid.');
      return;
    }

    const finalQty = Math.max(1, parseInt(qtyInput, 10) || qty || 1);

    // Warning if price entered is greater than original price
    if (priceNum > originalPrice && !requiresConfirmation) {
      setRequiresConfirmation(true);
      setErrorMsg(`Selling price ₹${priceNum} is higher than catalogue price (₹${originalPrice}). Click Confirm to proceed.`);
      return;
    }

    onConfirmPrice(priceNum, finalQty);
    onClose();
  };

  return (
    <div
      className="modal-overlay price-selector-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-selector-title"
    >
      <div
        className="modal-dialog price-selector-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Pinned */}
        <div className="price-selector-header">
          <div className="price-selector-prod-info">
            <div className="price-selector-thumb">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/products/shirt.jpg';
                  }}
                />
              ) : (
                <Tag size={20} color="#059669" />
              )}
            </div>
            <div className="price-selector-prod-text">
              <h3 id="price-selector-title" className="price-selector-title">
                {product.name}
              </h3>
              <span className="price-selector-base-hint">
                Catalogue Base: <strong>₹{originalPrice}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn price-selector-close-btn"
            onClick={onClose}
            aria-label="Close price selection dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="price-selector-body">
          {/* Pricing Options */}
          <div className="price-selector-section">
            <label className="price-section-label">
              Standard Rate & Offers:
            </label>
            <div className="price-pill-row">
              {/* Original Price Pill */}
              <button
                type="button"
                className={`price-pill-btn ${selectedPrice === String(originalPrice) ? 'active' : ''}`}
                onClick={() => handlePriceButtonClick(originalPrice)}
              >
                Base ₹{originalPrice}
              </button>

              {/* Offer Pills */}
              {offers.map((off) => {
                const offNum = Number(off);
                const isSelected = selectedPrice === String(offNum);
                return (
                  <button
                    key={offNum}
                    type="button"
                    className={`price-pill-btn offer ${isSelected ? 'active' : ''}`}
                    onClick={() => handlePriceButtonClick(offNum)}
                  >
                    <Sparkles size={13} />
                    ₹{offNum} Offer
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Reductions (-10, -20, -50, Reset) */}
          <div className="price-selector-section">
            <label className="price-section-label">
              Quick Reductions (Per Unit):
            </label>
            <div className="quick-red-btn-grid">
              {[10, 20, 50].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="quick-red-btn"
                  onClick={() => handleApplyReduction(amt)}
                >
                  -₹{amt}
                </button>
              ))}
              <button
                type="button"
                className="quick-red-btn reset"
                onClick={() => handlePriceButtonClick(originalPrice)}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Rate & Quantity Controls Form */}
          <form id="price-selector-form" onSubmit={handleSubmit}>
            <div className="price-qty-row">
              {/* Rate per Unit */}
              <div className="field-col price-col">
                <label className="field-label">
                  Selling Rate / Unit (₹):
                </label>
                <div className="price-input-wrapper">
                  <span className="currency-prefix">₹</span>
                  <input
                    ref={inputRef}
                    type="number"
                    min="0"
                    step="1"
                    className={`custom-price-input ${requiresConfirmation ? 'warning' : ''}`}
                    value={selectedPrice}
                    onChange={(e) => {
                      setSelectedPrice(e.target.value);
                      setRequiresConfirmation(false);
                      setErrorMsg('');
                    }}
                    placeholder="e.g. 540"
                    aria-label="Unit selling price in rupees"
                  />
                </div>
              </div>

              {/* Quantity Stepper with Large + / - Controls */}
              <div className="field-col qty-col">
                <label className="field-label">
                  Quantity:
                </label>
                <div className="qty-stepper-box">
                  <button
                    type="button"
                    className="qty-step-btn minus"
                    onClick={handleDecrement}
                    disabled={effectiveQty <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="qty-stepper-input"
                    value={qtyInput}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    onBlur={handleQtyBlur}
                    aria-label="Item quantity"
                  />
                  <button
                    type="button"
                    className="qty-step-btn plus"
                    onClick={handleIncrement}
                    aria-label="Increase quantity"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Error or Confirmation Warning */}
            {errorMsg && (
              <div className={`price-alert-box ${requiresConfirmation ? 'warning' : 'danger'}`}>
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
          </form>
        </div>

        {/* Footer - Pinned with Live Line Total and Add Action */}
        <div className="price-selector-footer">
          <div className="price-selector-footer-total">
            <span className="live-total-label">Subtotal:</span>
            <span className="live-total-amount">₹{lineTotal.toFixed(2)}</span>
            <span className="live-total-pieces">({effectiveQty} {effectiveQty === 1 ? 'piece' : 'pieces'})</span>
          </div>

          <div className="price-selector-footer-actions">
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="price-selector-form"
              className={`btn-modal-confirm ${requiresConfirmation ? 'btn-warning-confirm' : 'btn-primary-confirm'}`}
            >
              {requiresConfirmation ? (
                <>
                  <Check size={18} /> Confirm ₹{numericPrice}
                </>
              ) : (
                <>
                  <Check size={18} /> {item ? 'Update' : 'Add to Bill'} (₹{lineTotal.toFixed(2)})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
