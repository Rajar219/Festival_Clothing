import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { formatINR, rupeesToPaise, paiseToRupees } from '../utils/currency';
import {
  Banknote,
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Info,
} from 'lucide-react';

export function CheckoutModal() {
  const {
    isCheckoutModalOpen,
    setIsCheckoutModalOpen,
    finalPayableAmount,
    items,
    settings,
    finalizeCheckout,
    showToast,
  } = usePOS();

  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'upi'
  const [cashReceived, setCashReceived] = useState('');
  const [cashChangeDue, setCashChangeDue] = useState(0);
  const [upiRef, setUpiRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isCheckoutModalOpen) {
      setPaymentMethod('cash');
      setCashReceived(finalPayableAmount.toString());
      setCashChangeDue(0);
      setUpiRef('');
      setIsSubmitting(false);
    }
  }, [isCheckoutModalOpen, finalPayableAmount]);

  useEffect(() => {
    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) || 0;
      const recPaise = rupeesToPaise(received);
      const payablePaise = rupeesToPaise(finalPayableAmount);
      const diffPaise = recPaise - payablePaise;
      setCashChangeDue(paiseToRupees(Math.max(0, diffPaise)));
    }
  }, [cashReceived, finalPayableAmount, paymentMethod]);

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

  const denominations = [
    finalPayableAmount,
    Math.ceil(finalPayableAmount / 500) * 500,
    1000,
    2000,
  ].filter((val, idx, self) => val >= finalPayableAmount && self.indexOf(val) === idx);

  const handleFinalize = async () => {
    if (isSubmitting) return;

    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) || 0;
      if (received < finalPayableAmount) {
        showToast('Cash received cannot be less than the payable amount.', 'error');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await finalizeCheckout({
        method: paymentMethod,
        tenderAmount: paymentMethod === 'cash' ? parseFloat(cashReceived) || finalPayableAmount : finalPayableAmount,
        amountReceived: paymentMethod === 'cash' ? parseFloat(cashReceived) || finalPayableAmount : finalPayableAmount,
        changeDue: paymentMethod === 'cash' ? cashChangeDue : 0,
        upiRef: paymentMethod === 'upi' ? upiRef : '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="modal-dialog checkout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2 className="modal-title">Payment Selection</h2>
            <span className="modal-subtitle">Choose payment method to complete bill</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close payment dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Payable Total Display */}
          <div className="checkout-payable-card">
            <span className="payable-label">Amount Payable:</span>
            <span className="payable-value">{formatINR(finalPayableAmount, true)}</span>
          </div>

          {/* Payment Method Tabs: CASH and UPI */}
          <div className="payment-method-tabs two-options" role="tablist">
            <button
              type="button"
              className={`payment-tab-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('cash')}
              role="tab"
              aria-selected={paymentMethod === 'cash'}
            >
              <Banknote size={22} />
              <div className="tab-label-text">
                <span className="tab-title">CASH</span>
                <span className="tab-sub">Paper Currency</span>
              </div>
            </button>

            <button
              type="button"
              className={`payment-tab-btn ${paymentMethod === 'upi' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('upi')}
              role="tab"
              aria-selected={paymentMethod === 'upi'}
            >
              <QrCode size={22} />
              <div className="tab-label-text">
                <span className="tab-title">UPI</span>
                <span className="tab-sub">GPay, PhonePe, Paytm QR</span>
              </div>
            </button>
          </div>

          {/* Cash Payment Details */}
          {paymentMethod === 'cash' && (
            <div className="payment-content-section cash-section">
              <label className="input-group-label">Amount Received (₹)</label>
              <div className="tendered-input-wrap">
                <span className="currency-prefix">₹</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="tendered-input"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Enter cash received"
                  autoFocus
                />
              </div>

              {/* Quick Preset Tender Chips */}
              <div className="quick-denom-chips">
                <span className="denom-label">Quick Tender:</span>
                {denominations.map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="denom-btn"
                    onClick={() => setCashReceived(val.toString())}
                  >
                    ₹{val}
                  </button>
                ))}
              </div>

              {/* Change Due Box */}
              <div className="change-due-box">
                <span className="change-label">Change to Return to Customer:</span>
                <span className={`change-amount ${cashChangeDue > 0 ? 'highlight-change' : ''}`}>
                  {formatINR(cashChangeDue, true)}
                </span>
              </div>
            </div>
          )}

          {/* UPI Payment Details */}
          {paymentMethod === 'upi' && (
            <div className="payment-content-section upi-section">
              <div className="upi-info-card">
                <div className="upi-qr-placeholder">
                  <QrCode size={56} className="qr-icon" />
                  <span className="qr-hint">Scan & Pay</span>
                </div>
                <div className="upi-text-info">
                  <div className="vpa-display">
                    <span className="vpa-label">Shop UPI ID:</span>
                    <strong className="vpa-id">{settings.upiId || 'festivalclothing@okhdfcbank'}</strong>
                  </div>
                  <div className="vpa-amount">
                    <span>Pay Exact: </span>
                    <strong>{formatINR(finalPayableAmount, true)}</strong>
                  </div>
                </div>
              </div>

              <div className="upi-ref-field">
                <label className="input-group-label">UPI Reference / UTR Number (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 428901238912"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                />
              </div>

              <div className="upi-disclaimer-note">
                <Info size={14} />
                <span>
                  Note: Payment recorded as manual UPI transfer. Gateway status will be verified via bank reconciliation.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsCheckoutModalOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            type="button"
            id="btn-confirm-checkout"
            className="btn-success finalize-btn"
            onClick={handleFinalize}
            disabled={isSubmitting}
          >
            <CheckCircle2 size={18} />
            <span>{isSubmitting ? 'Recording Bill...' : `Confirm & Finalize Bill`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
