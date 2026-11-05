import React, { useState, useEffect, useRef } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { formatINR } from '../utils/currency';
import { Tag, Sparkles, Check, X, AlertTriangle, ArrowRight } from 'lucide-react';

export function PriceSelectorModal({
  isOpen,
  onClose,
  product,
  item = null,
  onConfirmPrice,
}) {
  const [selectedPrice, setSelectedPrice] = useState('');
  const [qty, setQty] = useState(1);
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
      
      setSelectedPrice(String(initialPrice));
      setQty(item ? Number(item.qty || 1) : 1);
      setRequiresConfirmation(false);
      setErrorMsg('');

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, product, item]);

  const { handleBackdropClick } = useModalBehavior({
    isOpen,
    onClose,
  });

  if (!isOpen || !product) return null;

  const originalPrice = Number(product.defaultPrice || (item?.originalUnitPrice ?? 0));
  const offers = Array.isArray(product.offers) ? product.offers : (product.offerPrice ? [product.offerPrice] : []);

  const handlePriceButtonClick = (price) => {
    setSelectedPrice(String(price));
    setRequiresConfirmation(false);
    setErrorMsg('');
  };

  const handleApplyReduction = (amount) => {
    const current = parseFloat(selectedPrice) || originalPrice;
    const next = Math.max(0, current - amount);
    setSelectedPrice(String(next));
    setRequiresConfirmation(false);
    setErrorMsg('');
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const priceNum = parseFloat(selectedPrice);

    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMsg('Price cannot be negative or invalid.');
      return;
    }

    // Check if price entered is greater than original price
    if (priceNum > originalPrice && !requiresConfirmation) {
      setRequiresConfirmation(true);
      setErrorMsg(`Selling price ₹${priceNum} is higher than catalogue price (₹${originalPrice}). Click Confirm to proceed.`);
      return;
    }

    onConfirmPrice(priceNum, qty);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="price-selector-title">
      <div
        className="modal-content price-selector-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '92%',
          background: '#ffffff',
          borderRadius: '14px',
          padding: '20px 24px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.22)',
          border: '1px solid #e2e8f0',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                border: '1px solid #cbd5e1',
              }}
            >
              {product.image ? (
                <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Tag size={20} color="#059669" />
              )}
            </div>
            <div>
              <h3 id="price-selector-title" style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
                {product.name}
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Catalogue Base Price: <strong>₹{originalPrice}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close price selection dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pricing Selection Area */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
            Standard Price & Festival Offers:
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {/* Original Price Pill */}
            <button
              type="button"
              onClick={() => handlePriceButtonClick(originalPrice)}
              style={{
                flex: '1 1 auto',
                padding: '8px 12px',
                borderRadius: '8px',
                border: selectedPrice === String(originalPrice) ? '2px solid #059669' : '1px solid #cbd5e1',
                background: selectedPrice === String(originalPrice) ? '#ecfdf5' : '#f8fafc',
                color: selectedPrice === String(originalPrice) ? '#065f46' : '#1e293b',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              Original ₹{originalPrice}
            </button>

            {/* Offer Prices */}
            {offers.map((off) => {
              const offNum = Number(off);
              const isSelected = selectedPrice === String(offNum);
              return (
                <button
                  key={offNum}
                  type="button"
                  onClick={() => handlePriceButtonClick(offNum)}
                  style={{
                    flex: '1 1 auto',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #059669' : '1px solid #86efac',
                    background: isSelected ? '#ecfdf5' : '#f0fdf4',
                    color: '#065f46',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Sparkles size={13} color="#059669" />
                  ₹{offNum} Offer
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Reduction Step Buttons */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
            Quick Reductions:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[10, 20, 50].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleApplyReduction(amt)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#f1f5f9',
                  color: '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                -₹{amt}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePriceButtonClick(originalPrice)}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Custom Price & Qty Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Selling Price per Unit (₹):
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 700,
                    color: '#64748b',
                  }}
                >
                  ₹
                </span>
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  step="1"
                  value={selectedPrice}
                  onChange={(e) => {
                    setSelectedPrice(e.target.value);
                    setRequiresConfirmation(false);
                    setErrorMsg('');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 28px',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: requiresConfirmation ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. 480"
                />
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Quantity:
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Feedback or Confirmation Message */}
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: requiresConfirmation ? '#fffbeb' : '#fef2f2',
                border: requiresConfirmation ? '1px solid #fef3c7' : '1px solid #fee2e2',
                color: requiresConfirmation ? '#b45309' : '#b91c1c',
                fontSize: '0.82rem',
                marginBottom: '14px',
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: requiresConfirmation ? '#d97706' : '#059669',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
              }}
            >
              {requiresConfirmation ? (
                <>
                  <Check size={16} /> Confirm Higher Price (₹{selectedPrice})
                </>
              ) : (
                <>
                  <Check size={16} /> {item ? 'Update Price' : 'Add to Bill'} (₹{selectedPrice})
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

