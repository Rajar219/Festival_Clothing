import React, { useState, useEffect, useRef } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import {
  validateIndianMobile,
  generateWhatsAppDirectChatText,
  generateReceiptPDF,
} from '../utils/receiptGenerator';
import { formatINR, formatDateTime } from '../utils/currency';
import {
  Phone,
  Send,
  X,
  Download,
  AlertCircle,
  CheckCircle2,
  Share2,
  FileText,
  ExternalLink,
  Info,
  Calendar,
  User,
  ShieldCheck,
} from 'lucide-react';

export function WhatsAppModal({ isOpen, onClose, bill, onSharingIncomplete }) {
  const { showToast, updateBillRecordStatus } = usePOS();

  const [mobileNumber, setMobileNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [sharingStatus, setSharingStatus] = useState('idle'); // 'idle' | 'chat_opened' | 'shared_native'
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cached generated PDF references to avoid redundant generation
  const cachedPdfRef = useRef(null);

  useEffect(() => {
    if (bill?.customerPhone) {
      setMobileNumber(bill.customerPhone);
    } else {
      setMobileNumber('');
    }
    setErrorMsg('');
    setSharingStatus('idle');

    // Pre-generate Thermal A4 PDF once for this bill
    if (bill) {
      try {
        const result = generateReceiptPDF(bill, { mode: 'thermal', autoDownload: false });
        cachedPdfRef.current = result;
        setIsPdfReady(true);
      } catch (err) {
        console.warn('PDF pre-generation notice:', err);
      }
    }

    // Check if device/browser supports native file sharing (Web Share API level 2)
    try {
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        const testFile = new File(['test'], 'invoice.pdf', { type: 'application/pdf' });
        setCanNativeShare(Boolean(navigator.canShare({ files: [testFile] })));
      } else {
        setCanNativeShare(false);
      }
    } catch {
      setCanNativeShare(false);
    }
  }, [bill]);

  const { handleBackdropClick } = useModalBehavior({
    isOpen,
    onClose,
  });

  if (!isOpen || !bill) return null;

  // Helper to ensure PDF is generated
  const ensurePdf = () => {
    if (cachedPdfRef.current?.blob) {
      return cachedPdfRef.current;
    }
    try {
      const res = generateReceiptPDF(bill, { mode: 'thermal', autoDownload: false });
      cachedPdfRef.current = res;
      setIsPdfReady(true);
      return res;
    } catch (e) {
      console.warn('PDF generation error:', e);
      return null;
    }
  };

  // Helper to trigger explicit manual client download of the PDF
  const triggerPdfDownload = (pdfResult) => {
    if (!pdfResult?.blob) return;
    try {
      const url = URL.createObjectURL(pdfResult.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfResult.fileName || `Invoice_${bill.billNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.warn('PDF download error:', e);
    }
  };

  // 1. DIRECT NATIVE SHARING: Web Share API with PDF file + greeting text directly (NO SAVE AS DIALOG)
  const handleNativeFileShare = async () => {
    setIsProcessing(true);
    setErrorMsg('');

    const pdfResult = ensurePdf();
    if (!pdfResult) {
      showToast('Could not generate invoice PDF', 'error');
      setIsProcessing(false);
      return;
    }

    const message = generateWhatsAppDirectChatText(bill);
    const pdfFile = new File([pdfResult.blob], pdfResult.fileName, { type: 'application/pdf' });

    // Check canShare with the actual file
    const isShareable = typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [pdfFile] });

    if (isShareable) {
      try {
        await navigator.share({
          title: `FESTIVAL CLOTHING Invoice #${bill.billNumber}`,
          text: message,
          files: [pdfFile],
        });

        if (updateBillRecordStatus) {
          const validation = validateIndianMobile(mobileNumber);
          await updateBillRecordStatus(bill.id, {
            whatsappStatus: 'shared_native',
            customerPhone: validation.isValid ? validation.cleanNumber : (bill.customerPhone || ''),
          });
        }
        setSharingStatus('shared_native');
        showToast('Share sheet opened! Select WhatsApp to complete sending.', 'info');
      } catch (err) {
        if (err.name === 'AbortError') {
          if (onSharingIncomplete) onSharingIncomplete();
          showToast('Sharing cancelled. Bill remains safely saved.', 'info');
        } else {
          console.warn('Native share failed, falling back to direct chat:', err);
          showToast('Opening direct WhatsApp chat...', 'info');
          handleDirectCustomerChat(true);
        }
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Fallback to direct WhatsApp chat without download
      showToast('Opening direct WhatsApp chat...', 'info');
      handleDirectCustomerChat(true);
      setIsProcessing(false);
    }
  };

  // 2. PRIMARY ACTION: Send WhatsApp Invoice directly to entered customer number
  const handleSendWhatsAppInvoice = async () => {
    const validation = validateIndianMobile(mobileNumber);
    if (!validation.isValid) {
      setErrorMsg(validation.error);
      return;
    }

    setErrorMsg('');
    setIsProcessing(true);

    try {
      // Step A: Ensure Thermal A4 invoice PDF is generated and downloaded immediately
      const pdfResult = ensurePdf();
      if (pdfResult) {
        triggerPdfDownload(pdfResult);
      }

      // Step B: Prefill greeting message:
      // Thanks for purchasing from FESTIVAL CLOTHING!
      // We appreciate your support. Visit us again!
      // Invoice No: [Bill Number]
      // Total: ₹[Bill Amount]
      const message = generateWhatsAppDirectChatText(bill);
      const cleanPhone = validation.cleanNumber;
      const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;

      // Step C: Open exact customer's WhatsApp chat using their entered number
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      if (updateBillRecordStatus) {
        await updateBillRecordStatus(bill.id, {
          whatsappStatus: 'chat_opened',
          customerPhone: cleanPhone,
        });
      }

      setSharingStatus('chat_opened');
      showToast(`WhatsApp chat opened for +91 ${cleanPhone}! Invoice PDF downloaded.`, 'success');
    } catch (err) {
      console.warn('WhatsApp direct send error:', err);
      showToast('Error opening WhatsApp: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectCustomerChat = handleSendWhatsAppInvoice;

  // 3. MANUAL PDF DOWNLOAD: Only triggers when user explicitly taps "Download PDF"
  const handleDownloadPDF = () => {
    const pdfResult = ensurePdf();
    if (pdfResult) {
      triggerPdfDownload(pdfResult);
      showToast(`Invoice PDF downloaded for #${bill.billNumber}`, 'success');
    } else {
      showToast('Failed to download invoice PDF', 'error');
    }
  };

  const validation = mobileNumber ? validateIndianMobile(mobileNumber) : null;
  const isNumberValid = validation?.isValid;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="modal-dialog wa-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="wa-modal-header">
          <div className="wa-header-brand">
            <div className="wa-header-icon-box">
              <Send size={18} />
            </div>
            <div>
              <h2 className="wa-modal-title">Share WhatsApp Invoice</h2>
              <span className="wa-modal-subtitle">Direct PDF invoice & customer greeting</span>
            </div>
          </div>
          <button
            type="button"
            className="wa-modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="wa-modal-body">
          {/* Bill Summary Card */}
          <div className="wa-bill-summary-card">
            <div className="wa-summary-top-row">
              <div className="wa-bill-meta-group">
                <span className="wa-bill-num-badge">#{bill.billNumber}</span>
                <span className="wa-bill-status-pill">PAID</span>
              </div>
              <div className="wa-total-display">
                <span className="wa-total-label">Total Payable:</span>
                <strong className="wa-total-amount">{formatINR(bill.finalPayableAmount, true)}</strong>
              </div>
            </div>

            <div className="wa-summary-meta-row">
              <div className="wa-meta-item">
                <Calendar size={12} />
                <span>{formatDateTime(bill.createdAt)}</span>
              </div>
              {bill.customerName && (
                <div className="wa-meta-item">
                  <User size={12} />
                  <span>{bill.customerName}</span>
                </div>
              )}
            </div>

            <div className="wa-status-pills-row">
              <span className="wa-pill-verified">
                <ShieldCheck size={11} />
                Saved Locally
              </span>
              <span className={`wa-pill-verified ${isPdfReady ? 'ready' : ''}`}>
                <FileText size={11} />
                {isPdfReady ? 'Thermal A4 PDF Ready' : 'Generating PDF...'}
              </span>
            </div>
          </div>

          {/* Customer Mobile Number Section */}
          <div className="wa-phone-section">
            <label htmlFor="wa-customer-input" className="wa-field-label">
              Customer Mobile Number (WhatsApp) *
            </label>
            <div className={`wa-phone-input-wrap ${errorMsg ? 'has-error' : ''} ${isNumberValid ? 'is-valid' : ''}`}>
              <span className="wa-country-flag">+91</span>
              <input
                id="wa-customer-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                className="wa-phone-text-input"
                value={mobileNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setMobileNumber(val);
                  if (errorMsg) setErrorMsg('');
                }}
              />
              {isNumberValid && (
                <span className="wa-input-valid-indicator" title="Valid 10-digit Indian Mobile Number">
                  <CheckCircle2 size={16} />
                </span>
              )}
            </div>
            {errorMsg && (
              <div className="wa-field-error">
                <AlertCircle size={13} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Compact Instructions Notice */}
          <div className="wa-guidance-card">
            <div className="wa-guidance-icon-wrap">
              <Info size={16} />
            </div>
            <div className="wa-guidance-content">
              {sharingStatus === 'chat_opened' ? (
                <p>
                  <strong>WhatsApp chat opened!</strong> Greeting prefilled for +91 {mobileNumber}. The invoice PDF is downloaded to your device and ready to attach (tap 📎 Paperclip &gt; Document).
                </p>
              ) : (
                <p>
                  Enter customer's 10-digit mobile number and tap <strong>SEND WHATSAPP INVOICE</strong>. This opens their exact chat with greeting prefilled and downloads the PDF bill ready to attach.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="wa-actions-wrapper">
            {/* Primary Action Button: Open exact customer WhatsApp chat with greeting prefilled + PDF downloaded */}
            <button
              type="button"
              className="wa-btn-main wa-btn-send-invoice"
              onClick={handleSendWhatsAppInvoice}
              disabled={isProcessing}
            >
              <Send size={18} />
              <span>{isProcessing ? 'Opening WhatsApp...' : 'SEND WHATSAPP INVOICE'}</span>
            </button>

            {/* Secondary Action Row */}
            <div className="wa-secondary-actions-bar">
              {canNativeShare && (
                <button
                  type="button"
                  className="wa-btn-sub"
                  onClick={handleNativeFileShare}
                  title="Open system share sheet with PDF attached"
                >
                  <Share2 size={14} />
                  <span>Share Sheet (With PDF)</span>
                </button>
              )}
              <button
                type="button"
                className="wa-btn-sub"
                onClick={handleDownloadPDF}
                title="Download Thermal A4 invoice PDF copy to your device"
              >
                <Download size={14} />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="wa-modal-footer">
          <button
            type="button"
            className="wa-btn-dismiss"
            onClick={onClose}
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppModal;
