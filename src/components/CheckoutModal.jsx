import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { formatINR } from '../utils/currency';
import {
  Banknote,
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Info,
  Check,
  ShoppingBag,
  Loader2,
} from 'lucide-react';

export function CheckoutModal() {
  const {
    isCheckoutModalOpen,
    setIsCheckoutModalOpen,
    finalPayableAmount,
    totalPieces,
    items,
    settings,
    finalizeCheckout,
    showToast,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    cashChangeDue,
    upiRef,
    setUpiRef,
    alsoUploadToDrive,
    setAlsoUploadToDrive,
  } = usePOS();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (!isSubmitting) {
      setIsCheckoutModalOpen(false);
    }
  };

  const { handleBackdropClick } = useModalBehavior({
    isOpen: isCheckoutModalOpen,
    onClose: handleClose,
  });

  if (!isCheckoutModalOpen) return null;

  const pieceCount = totalPieces || items.reduce((acc, it) => acc + (parseInt(it.qty, 10) || 0), 0);
  const parsedReceived = parseFloat(cashReceived) || 0;
  const isCashInsufficient = paymentMethod === 'cash' && parsedReceived < finalPayableAmount && parsedReceived > 0;

  // Preset cash suggestions
  const handleSetQuickCash = (extra) => {
    if (extra === 0) {
      setCashReceived(finalPayableAmount.toString());
    } else {
      const current = parseFloat(cashReceived) || finalPayableAmount;
      setCashReceived((current + extra).toString());
    }
  };

  const denominations = [
    Math.ceil(finalPayableAmount / 500) * 500,
    1000,
    2000,
  ].filter((val, idx, self) => val > finalPayableAmount && self.indexOf(val) === idx);

  const handleFinalize = async () => {
    if (isSubmitting) return;

    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) || 0;
      if (received < finalPayableAmount) {
        showToast('Cash received cannot be less than payable amount.', 'error');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await finalizeCheckout({
        method: paymentMethod,
        amountReceived: paymentMethod === 'cash' ? (parseFloat(cashReceived) || finalPayableAmount) : finalPayableAmount,
        changeDue: paymentMethod === 'cash' ? cashChangeDue : 0,
        upiRef: paymentMethod === 'upi' ? upiRef.trim() : '',
        alsoUploadToDrive,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay checkout-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="modal-dialog checkout-modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Fixed Modal Header */}
        <div className="checkout-modal-header">
          <div className="checkout-header-text">
            <div className="checkout-badge-row">
              <span className="checkout-badge">FINAL BILLING</span>
              <span className="checkout-meta-qty">{pieceCount} {pieceCount === 1 ? 'piece' : 'pieces'}</span>
            </div>
            <h2 className="checkout-modal-title">Complete Checkout</h2>
          </div>
          <button
            type="button"
            className="checkout-modal-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close checkout"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="checkout-modal-body">
          {/* Amount Payable Hero Card */}
          <div className="checkout-hero-payable">
            <div className="hero-payable-top">
              <span className="hero-payable-label">FINAL PAYABLE AMOUNT</span>
              <span className="hero-currency-tag">INR (₹)</span>
            </div>
            <div className="hero-payable-amount">
              {formatINR(finalPayableAmount, true)}
            </div>
          </div>

          {/* Prompt Required Section: SELECT PAYMENT METHOD */}
          <div className="checkout-payment-section">
            <div className="checkout-section-header">
              <span className="checkout-section-title">SELECT PAYMENT METHOD</span>
              <span className="checkout-section-hint">Choose Cash or UPI to complete payment</span>
            </div>

            <div className="payment-cards-grid" role="radiogroup" aria-label="Select Payment Method">
              {/* CASH Payment Card */}
              <button
                type="button"
                id="btn-select-cash"
                className={`payment-selection-card ${paymentMethod === 'cash' ? 'active-card' : ''}`}
                onClick={() => setPaymentMethod('cash')}
                role="radio"
                aria-checked={paymentMethod === 'cash'}
              >
                <div className="card-indicator">
                  {paymentMethod === 'cash' ? (
                    <span className="check-dot-active"><Check size={14} /></span>
                  ) : (
                    <span className="check-dot-inactive" />
                  )}
                </div>
                <div className="card-icon-wrap">
                  <Banknote size={26} className="payment-card-icon" />
                </div>
                <div className="card-info">
                  <strong className="card-label">CASH</strong>
                  <span className="card-subtext">Paper Currency</span>
                </div>
              </button>

              {/* UPI Payment Card */}
              <button
                type="button"
                id="btn-select-upi"
                className={`payment-selection-card ${paymentMethod === 'upi' ? 'active-card' : ''}`}
                onClick={() => setPaymentMethod('upi')}
                role="radio"
                aria-checked={paymentMethod === 'upi'}
              >
                <div className="card-indicator">
                  {paymentMethod === 'upi' ? (
                    <span className="check-dot-active"><Check size={14} /></span>
                  ) : (
                    <span className="check-dot-inactive" />
                  )}
                </div>
                <div className="card-icon-wrap">
                  <QrCode size={26} className="payment-card-icon" />
                </div>
                <div className="card-info">
                  <strong className="card-label">UPI</strong>
                  <span className="card-subtext">QR / GPay / PhonePe</span>
                </div>
              </button>
            </div>

            {/* CASH Payment Behaviour */}
            {paymentMethod === 'cash' && (
              <div className="payment-active-detail-box cash-active-box">
                <label htmlFor="modal-cash-received" className="detail-box-label">
                  Amount Received from Customer (₹)
                </label>
                <div className="cash-input-container">
                  <span className="cash-currency-symbol">₹</span>
                  <input
                    id="modal-cash-received"
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    className="modal-cash-input"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="Enter cash received"
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>

                {/* Quick Cash Tender Presets */}
                <div className="modal-tender-presets">
                  <span className="presets-caption">Quick Presets:</span>
                  <div className="presets-btn-row">
                    <button
                      type="button"
                      className="modal-preset-btn"
                      onClick={() => handleSetQuickCash(0)}
                    >
                      Exact (₹{finalPayableAmount})
                    </button>
                    <button
                      type="button"
                      className="modal-preset-btn"
                      onClick={() => handleSetQuickCash(100)}
                    >
                      +₹100
                    </button>
                    <button
                      type="button"
                      className="modal-preset-btn"
                      onClick={() => handleSetQuickCash(500)}
                    >
                      +₹500
                    </button>
                    {denominations.map((val) => (
                      <button
                        key={val}
                        type="button"
                        className="modal-preset-btn"
                        onClick={() => setCashReceived(val.toString())}
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Validation alert if cash received is less than payable */}
                {isCashInsufficient && (
                  <div className="insufficient-cash-alert">
                    <AlertCircle size={15} />
                    <span>Cash received is less than payable amount (₹{finalPayableAmount}).</span>
                  </div>
                )}

                {/* Balance / Change Calculation */}
                <div className="change-return-summary">
                  <div className="change-left">
                    <span className="change-label">Change to Return:</span>
                    <span className="change-sub">Return balance to customer</span>
                  </div>
                  <div className={`change-amount-display ${cashChangeDue > 0 ? 'has-change' : ''}`}>
                    {formatINR(cashChangeDue, true)}
                  </div>
                </div>
              </div>
            )}

            {/* UPI Payment Behaviour */}
            {paymentMethod === 'upi' && (
              <div className="payment-active-detail-box upi-active-box">
                <div className="upi-qr-card">
                  <div className="upi-qr-badge">
                    <QrCode size={48} className="upi-qr-symbol" />
                    <span className="qr-badge-text">Shop QR</span>
                  </div>
                  <div className="upi-qr-meta">
                    <div className="vpa-line">
                      <span className="vpa-lbl">Shop UPI ID:</span>
                      <strong className="vpa-code">{settings.upiId || 'festivalclothing@okhdfcbank'}</strong>
                    </div>
                    <div className="vpa-exact-line">
                      <span>Pay Exact Amount: </span>
                      <strong className="vpa-amt">{formatINR(finalPayableAmount, true)}</strong>
                    </div>
                  </div>
                </div>

                <div className="upi-ref-group">
                  <label htmlFor="modal-upi-ref" className="detail-box-label">
                    UPI Reference / UTR Number (Optional)
                  </label>
                  <input
                    id="modal-upi-ref"
                    type="text"
                    className="modal-upi-input"
                    value={upiRef}
                    onChange={(e) => setUpiRef(e.target.value)}
                    placeholder="e.g. 428901238912 (12-digit UTR)"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="upi-confirmation-notice">
                  <Info size={15} />
                  <span>
                    Payment recorded as UPI. Confirm receipt on shop QR soundbox/terminal before completing bill.
                  </span>
                </div>
              </div>
            )}

            {/* Prompt Required Optional Google Drive Backup Checkbox (Default: UNCHECKED) */}
            <div className="optional-drive-backup-row">
              <label className="drive-backup-toggle-label" htmlFor="modal-drive-backup-checkbox">
                <input
                  type="checkbox"
                  id="modal-drive-backup-checkbox"
                  className="drive-backup-checkbox-input"
                  checked={alsoUploadToDrive}
                  onChange={(e) => setAlsoUploadToDrive(e.target.checked)}
                />
                <div className="drive-backup-text-wrap">
                  <span className="drive-backup-title-text">Also upload this bill to Google Drive</span>
                  <span className="drive-backup-hint-text">Optional PDF archive in "FESTIVAL SALES BILL" folder</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Fixed Sticky Modal Footer */}
        <div className="checkout-modal-footer">
          <button
            type="button"
            className="checkout-cancel-btn"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            type="button"
            id="btn-confirm-checkout"
            className="checkout-finalize-btn"
            onClick={handleFinalize}
            disabled={isSubmitting || (paymentMethod === 'cash' && parsedReceived < finalPayableAmount)}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spinning" />
                <span>Recording Bill...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Confirm & Finalize Bill ({paymentMethod.toUpperCase()})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutModal;
