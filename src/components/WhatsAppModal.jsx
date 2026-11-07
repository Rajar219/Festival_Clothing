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
  const hasDownloadedRef = useRef(false);

  useEffect(() => {
    if (bill?.customerPhone) {
      setMobileNumber(bill.customerPhone);
    } else {
      setMobileNumber('');
    }
    setErrorMsg('');
    setSharingStatus('idle');
    hasDownloadedRef.current = false;

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

  // Helper to detect mobile device environment
  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

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

  // Helper to trigger single download of the PDF
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
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.warn('PDF download error:', e);
    }
  };

  // 1. DIRECT MOBILE SHARE: Web Share API with BOTH PDF file and greeting message together
  const handleNativeFileShare = async () => {
    setIsProcessing(true);
    setErrorMsg('');

    const pdfResult = ensurePdf();
    if (!pdfResult?.blob) {
      showToast('Could not generate invoice PDF', 'error');
      setIsProcessing(false);
      return;
    }

    const message = generateWhatsAppDirectChatText(bill);
    const pdfFile = new File([pdfResult.blob], pdfResult.fileName || `${bill.billNumber}_Invoice.pdf`, { type: 'application/pdf' });

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
        showToast('Share sheet opened! Select WhatsApp to complete sending.', 'success');
      } catch (err) {
        if (err.name === 'AbortError') {
          if (onSharingIncomplete) onSharingIncomplete();
          showToast('Sharing cancelled. Bill remains safely saved.', 'info');
        } else {
          console.warn('Native share failed, falling back to desktop protocol:', err);
          showToast('Native share unavailable, trying direct chat...', 'info');
          handleSendDesktopWhatsApp();
        }
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Fallback
      handleSendDesktopWhatsApp();
    }
  };

  // 2. DESKTOP (WINDOWS / PC): Open ONLY installed WhatsApp Desktop application via protocol deep link
  const handleSendDesktopWhatsApp = async () => {
    const validation = validateIndianMobile(mobileNumber);
    if (!validation.isValid) {
      setErrorMsg(validation.error);
      return;
    }

    setErrorMsg('');
    setIsProcessing(true);

    try {
      // Step A: Generate PDF and trigger a single download
      const pdfResult = ensurePdf();
      if (pdfResult && !hasDownloadedRef.current) {
        triggerPdfDownload(pdfResult);
        hasDownloadedRef.current = true;
      }

      // Step B: Prefill EXACT greeting message:
      // Thanks for purchasing from FESTIVAL CLOTHING!
      //
      // We appreciate your support. Visit us again!
      //
      // Invoice No: [Bill Number]
      // Total: ₹[Bill Total]
      const message = generateWhatsAppDirectChatText(bill);
      const cleanPhone = validation.cleanNumber;

      // Step C: Open ONLY the installed WhatsApp Desktop app via deep link
      // whatsapp://send?phone=91[Number]&text=[EncodedText]
      // Using an anchor tag prevents opening WhatsApp Web or any browser tab
      const deepLink = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;
      const link = document.createElement('a');
      link.href = deepLink;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (updateBillRecordStatus) {
        await updateBillRecordStatus(bill.id, {
          whatsappStatus: 'chat_opened',
          customerPhone: cleanPhone,
        });
      }

      setSharingStatus('chat_opened');
      showToast(`WhatsApp Desktop opened for +91 ${cleanPhone}! Attach downloaded PDF.`, 'success');
    } catch (err) {
      console.warn('WhatsApp Desktop launch error:', err);
      showToast('Error opening WhatsApp Desktop: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. MAIN UNIFIED ACTION: Chooses mobile Web Share API or desktop WhatsApp protocol
  const handleSendWhatsAppInvoice = async () => {
    const isMobile = isMobileDevice();
    const pdfResult = ensurePdf();

    // If on mobile and native sharing is supported, trigger Web Share API with PDF + message
    if (isMobile && canNativeShare && pdfResult?.blob) {
      await handleNativeFileShare();
      return;
    }

    // Otherwise, perform Desktop Windows WhatsApp deep link
    await handleSendDesktopWhatsApp();
  };

  // 4. MANUAL FALLBACK TO WHATSAPP WEB (Only if WhatsApp Desktop is not installed on Windows PC)
  const handleOpenWhatsAppWeb = () => {
    const validation = validateIndianMobile(mobileNumber);
    if (!validation.isValid) {
      setErrorMsg(validation.error);
      return;
    }
    const message = generateWhatsAppDirectChatText(bill);
    const cleanPhone = validation.cleanNumber;
    const webUrl = `https://web.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  };

  // 5. MANUAL PDF DOWNLOAD: Only triggers when user explicitly taps "Download PDF"
  const handleDownloadPDF = () => {
    const pdfResult = ensurePdf();
    if (pdfResult) {
      triggerPdfDownload(pdfResult);
      hasDownloadedRef.current = true;
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
                  <strong>WhatsApp Desktop opened!</strong> Greeting prefilled for +91 {mobileNumber}. The invoice PDF is saved to your computer — simply drag or click 📎 in WhatsApp to attach.
                </p>
              ) : sharingStatus === 'shared_native' ? (
                <p>
                  <strong>Share sheet activated!</strong> The invoice PDF and greeting message were passed together to the native share menu. Select WhatsApp to send.
                </p>
              ) : (
                <p>
                  Tap <strong>SEND WHATSAPP INVOICE</strong> to open customer chat with prefilled greeting and ready-to-attach invoice PDF.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="wa-actions-wrapper">
            {/* Primary Action Button: Open exact customer WhatsApp chat with greeting prefilled + PDF */}
            <button
              type="button"
              className="wa-btn-main wa-btn-send-invoice"
              onClick={handleSendWhatsAppInvoice}
              disabled={isProcessing}
            >
              <Send size={18} />
              <span>
                {isProcessing
                  ? 'Connecting...'
                  : canNativeShare
                  ? 'SHARE INVOICE ON WHATSAPP'
                  : 'SEND WHATSAPP INVOICE'}
              </span>
            </button>

            {/* Secondary Action Row */}
            <div className="wa-secondary-actions-bar">
              <button
                type="button"
                className="wa-btn-sub"
                onClick={handleDownloadPDF}
                title="Download Thermal A4 invoice PDF copy to your device"
              >
                <Download size={14} />
                <span>Download PDF</span>
              </button>

              {!canNativeShare && isNumberValid && (
                <button
                  type="button"
                  className="wa-btn-sub wa-web-link"
                  onClick={handleOpenWhatsAppWeb}
                  title="Open in WhatsApp Web browser tab instead of Desktop application"
                >
                  <ExternalLink size={13} />
                  <span>Open WhatsApp Web</span>
                </button>
              )}
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
