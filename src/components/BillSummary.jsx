import React, { useState, useEffect, useCallback } from 'react';
import { usePOS } from '../context/POSContext';
import { formatINR, rupeesToPaise, paiseToRupees } from '../utils/currency';
import { COMPANY_BRANDING } from '../services/db';
import {
  Banknote,
  QrCode,
  Tag,
  Undo2,
  CheckCircle2,
  RotateCcw,
  Loader2,
  AlertCircle,
  CreditCard,
} from 'lucide-react';

export function BillSummary() {
  const {
    items,
    subtotal,
    originalSubtotal,
    lineReductions,
    comboSavings,
    totalReduction,
    appliedCombos,
    finalPayableAmount,
    totalPieces,
    finalizeCheckout,
    startNewBill,
    showToast,
  } = usePOS();

  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'upi'
  const [cashReceived, setCashReceived] = useState('');
  const [cashChangeDue, setCashChangeDue] = useState(0);
  const [upiRef, setUpiRef] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Keep cash received updated when payable total changes
  useEffect(() => {
    setCashReceived(finalPayableAmount > 0 ? finalPayableAmount.toString() : '');
  }, [finalPayableAmount]);

  // Recalculate change due
  useEffect(() => {
    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) || 0;
      const recPaise = rupeesToPaise(received);
      const payablePaise = rupeesToPaise(finalPayableAmount);
      const diffPaise = recPaise - payablePaise;
      setCashChangeDue(paiseToRupees(Math.max(0, diffPaise)));
    } else {
      setCashChangeDue(0);
    }
  }, [cashReceived, finalPayableAmount, paymentMethod]);

  const pieceCount = totalPieces || items.reduce((acc, it) => acc + (parseInt(it.qty, 10) || 0), 0);
  const isBillReady = items.length > 0 && finalPayableAmount >= 0;

  // Quick cash tender preset helpers
  const handleSetQuickCash = (extra) => {
    if (extra === 0) {
      setCashReceived(finalPayableAmount.toString());
    } else {
      const current = parseFloat(cashReceived) || finalPayableAmount;
      setCashReceived((current + extra).toString());
    }
  };

  // Fast 1-click complete bill
  const handleFastCompleteBill = useCallback(async () => {
    if (!isBillReady || isSaving) return;

    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) || 0;
      if (received < finalPayableAmount) {
        showToast('Cash received cannot be less than payable amount.', 'error');
        return;
      }
    }

    try {
      setIsSaving(true);
      setSaveError('');

      const result = await finalizeCheckout({
        method: paymentMethod,
        amountReceived: paymentMethod === 'cash' ? parseFloat(cashReceived) || finalPayableAmount : finalPayableAmount,
        changeDue: paymentMethod === 'cash' ? cashChangeDue : 0,
        upiRef: paymentMethod === 'upi' ? upiRef.trim() : '',
      });

      if (!result) {
        setSaveError('Transaction failed to save. Please retry.');
      }
    } catch (err) {
      setSaveError(err.message || 'Error saving bill. Please retry.');
    } finally {
      setIsSaving(false);
    }
  }, [isBillReady, isSaving, paymentMethod, cashReceived, finalPayableAmount, cashChangeDue, upiRef, finalizeCheckout, showToast]);

  // Keyboard shortcut Alt+C for complete bill
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleFastCompleteBill();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFastCompleteBill]);

  return (
    <div className="bill-summary-card">
      <div className="summary-header">
        <div className="summary-header-title-wrap">
          <CreditCard size={17} className="summary-header-icon" />
          <h2 className="summary-title">Billing Summary</h2>
        </div>
        <span className="summary-qty-pill">
          {pieceCount} {pieceCount === 1 ? 'Piece' : 'Pieces'}
        </span>
      </div>

      <div className="summary-breakdown">
        {/* Base Subtotal */}
        <div className="breakdown-row">
          <span className="breakdown-label">Original Subtotal</span>
          <span className="breakdown-value">{formatINR(originalSubtotal || (subtotal + totalReduction), true)}</span>
        </div>

        {/* Item Reductions */}
        {lineReductions > 0 && (
          <div className="breakdown-row item-savings-row">
            <span className="breakdown-label">Item Reductions</span>
            <span className="breakdown-value savings-amount">- {formatINR(lineReductions, true)}</span>
          </div>
        )}

        {/* Combo Savings */}
        {comboSavings > 0 && (
          <div className="breakdown-row combo-savings-row" style={{ color: '#059669', fontWeight: 600 }}>
            <span className="breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Tag size={13} /> Combo Savings
            </span>
            <span className="breakdown-value savings-amount">- {formatINR(comboSavings, true)}</span>
          </div>
        )}

        {/* Active Applied Combos list */}
        {appliedCombos && appliedCombos.length > 0 && (
          <div style={{ margin: '4px 0 8px 0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {appliedCombos.map((c) => (
              <div key={c.comboId} style={{ fontSize: '0.75rem', color: '#065f46', background: '#ecfdf5', padding: '3px 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>✓ {c.name} {c.possibleCount > 1 ? `(${c.possibleCount}×)` : ''}</span>
                <span>- ₹{c.savings}</span>
              </div>
            ))}
          </div>
        )}

        <div className="summary-divider" />

        {/* High-Contrast Final Payable Amount Banner */}
        <div className="grand-total-card">
          <div className="grand-total-label-row">
            <span className="grand-total-label">FINAL PAYABLE AMOUNT</span>
            <span className="currency-code">INR</span>
          </div>
          <div className="grand-total-amount">
            {formatINR(finalPayableAmount, true)}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="payment-method-section">
          <span className="payment-section-label">PAYMENT METHOD</span>
          <div className="payment-toggle-grid">
            <button
              type="button"
              id="btn-select-cash"
              className={`quick-pay-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('cash')}
              disabled={isSaving}
            >
              <Banknote size={18} />
              <span>CASH</span>
            </button>
            <button
              type="button"
              id="btn-select-upi"
              className={`quick-pay-btn ${paymentMethod === 'upi' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('upi')}
              disabled={isSaving}
            >
              <QrCode size={18} />
              <span>UPI</span>
            </button>
          </div>

          {/* Conditional Cash Fields */}
          {paymentMethod === 'cash' && (
            <div className="cash-details-box">
              <div className="cash-input-row">
                <label htmlFor="cash-received-input" className="input-prefix">Received (₹):</label>
                <input
                  id="cash-received-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  className="quick-cash-input"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  disabled={isSaving}
                />
              </div>

              {/* Quick Cash Suggestions */}
              {finalPayableAmount > 0 && (
                <div className="quick-tender-presets">
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => handleSetQuickCash(0)}
                    disabled={isSaving}
                  >
                    Exact
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => handleSetQuickCash(100)}
                    disabled={isSaving}
                  >
                    +₹100
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => handleSetQuickCash(500)}
                    disabled={isSaving}
                  >
                    +₹500
                  </button>
                </div>
              )}

              {/* Change Due Callout */}
              {cashChangeDue > 0 && (
                <div className="change-return-pill">
                  <span>Change Due:</span>
                  <strong>{formatINR(cashChangeDue, true)}</strong>
                </div>
              )}
            </div>
          )}

          {/* Conditional UPI Fields */}
          {paymentMethod === 'upi' && (
            <div className="upi-details-box">
              <div className="upi-input-row">
                <input
                  type="text"
                  className="quick-upi-input"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  placeholder="UPI Ref / UTR (Optional)"
                  disabled={isSaving}
                />
              </div>
            </div>
          )}
        </div>

        {/* Save error banner with retry option */}
        {saveError && (
          <div className="save-error-callout">
            <AlertCircle size={16} />
            <span>{saveError}</span>
            <button
              type="button"
              className="btn-retry-save"
              onClick={handleFastCompleteBill}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Primary Actions Dock */}
      <div className="summary-actions">
        <button
          type="button"
          id="btn-complete-bill"
          className="btn-primary complete-bill-btn"
          disabled={!isBillReady || isSaving}
          onClick={handleFastCompleteBill}
          title="Complete and save bill (Alt+C)"
        >
          {isSaving ? (
            <>
              <Loader2 size={18} className="spinning" />
              <span>Saving Bill...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={18} />
              <span>Complete Bill</span>
              <kbd className="shortcut-btn-hint">Alt+C</kbd>
            </>
          )}
        </button>

        <button
          type="button"
          id="btn-start-new-bill"
          className="btn-secondary new-bill-action-btn"
          onClick={startNewBill}
          disabled={isSaving}
          title="Start fresh bill (F2)"
        >
          <RotateCcw size={15} />
          <span>New Bill</span>
          <kbd className="shortcut-btn-hint">F2</kbd>
        </button>
      </div>

      {/* Official Attribution Footer */}
      <div className="wisdo-summary-footer">
        <small>{COMPANY_BRANDING.attributionText}</small>
      </div>

      {/* Mobile Sticky Checkout Dock (< 768px) when bill has items */}
      {items.length > 0 && (
        <div className="mobile-sticky-checkout-bar">
          <div className="mobile-sticky-left">
            <span className="mobile-sticky-pieces">
              {pieceCount} {pieceCount === 1 ? 'item' : 'items'}
            </span>
            <span className="mobile-sticky-amount">
              {formatINR(finalPayableAmount, true)}
            </span>
          </div>

          <div className="mobile-sticky-actions">
            <button
              type="button"
              className="mobile-sticky-pay-btn"
              disabled={!isBillReady || isSaving}
              onClick={handleFastCompleteBill}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="spinning" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Complete ({paymentMethod.toUpperCase()})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

