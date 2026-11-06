import React, { useState, useEffect, useRef } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import {
  validateIndianMobile,
  generateWhatsAppDirectChatText,
  generateReceiptPDF,
} from '../utils/receiptGenerator';
import { formatINR } from '../utils/currency';
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
} from 'lucide-react';

export function WhatsAppModal({ isOpen, onClose, bill, onSharingIncomplete }) {
  const { settings, showToast, updateBillRecordStatus } = usePOS();

  const [mobileNumber, setMobileNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [sharingStatus, setSharingStatus] = useState('idle'); // 'idle' | 'chat_opened' | 'shared_native'
  const [pdfReady, setPdfReady] = useState(false);

  // Cached generated PDF references to prevent repeated generation
  const cachedPdfRef = useRef(null);

  useEffect(() => {
    if (bill?.customerPhone) {
      setMobileNumber(bill.customerPhone);
    } else {
      setMobileNumber('');
    }
    setErrorMsg('');
    setSharingStatus('idle');

    // Pre-generate PDF once for this bill
    if (bill) {
      try {
        const result = generateReceiptPDF(bill, { mode: 'thermal', autoDownload: false });
        cachedPdfRef.current = result;
        setPdfReady(true);
      } catch (err) {
        console.warn('PDF pre-generation warning:', err);
      }
    }

    // Check if device supports native file sharing
    try {
      if (typeof navigator !== 'undefined' && navigator.canShare) {
        const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
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

  // 1. PRIMARY METHOD: Direct Customer WhatsApp Chat (wa.me click-to-chat)
  const handleOpenDirectCustomerChat = async () => {
    const validation = validateIndianMobile(mobileNumber);
    if (!validation.isValid) {
      setErrorMsg(validation.error);
      return;
    }

    setErrorMsg('');

    // Ensure PDF is ready & downloaded for immediate attachment
    let pdfResult = cachedPdfRef.current;
    if (!pdfResult) {
      try {
        pdfResult = generateReceiptPDF(bill, { mode: 'thermal', autoDownload: true });
        cachedPdfRef.current = pdfResult;
      } catch (e) {
        console.warn('PDF generation error:', e);
      }
    } else {
      // Trigger download so cashier has the PDF ready in Downloads / Files to attach
      try {
        const url = URL.createObjectURL(pdfResult.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfResult.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('PDF trigger download:', e);
      }
    }

    // Exact message specified in prompt
    const message = generateWhatsAppDirectChatText(bill);
    const waUrl = `https://wa.me/91${validation.cleanNumber}?text=${encodeURIComponent(message)}`;

    // Open direct WhatsApp chat to customer's exact phone number
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    if (updateBillRecordStatus) {
      await updateBillRecordStatus(bill.id, {
        whatsappStatus: 'chat_opened',
        customerPhone: validation.cleanNumber,
      });
    }

    setSharingStatus('chat_opened');
    showToast(`WhatsApp chat opened for +91 ${validation.cleanNumber}. Attach PDF and press Send.`, 'success');
  };

  // 2. SECONDARY METHOD: Native Device File Sharing
  const handleNativeFileShare = async () => {
    const validation = validateIndianMobile(mobileNumber);
    const cleanNum = validation.isValid ? validation.cleanNumber : '';
    const message = generateWhatsAppDirectChatText(bill);

    let pdfResult = cachedPdfRef.current;
    if (!pdfResult) {
      pdfResult = generateReceiptPDF(bill, { mode: 'thermal', autoDownload: false });
      cachedPdfRef.current = pdfResult;
    }

    if (pdfResult?.blob && navigator.share) {
      try {
        const pdfFile = new File([pdfResult.blob], pdfResult.fileName, { type: 'application/pdf' });
        await navigator.share({
          title: `FESTIVAL CLOTHING Invoice #${bill.billNumber}`,
          text: message,
          files: [pdfFile],
        });

        if (updateBillRecordStatus) {
          await updateBillRecordStatus(bill.id, {
            whatsappStatus: 'sharing_opened',
            customerPhone: cleanNum || bill.customerPhone,
          });
        }
        setSharingStatus('shared_native');
        showToast('Device share sheet opened. Select recipient to complete sending.', 'info');
      } catch (err) {
        if (err.name === 'AbortError') {
          if (onSharingIncomplete) onSharingIncomplete();
          showToast('Sharing cancelled. Bill remains safely saved.', 'info');
        } else {
          showToast('Share failed: ' + err.message, 'error');
        }
      }
    } else {
      // Fallback: download PDF directly
      handleDownloadPDF();
    }
  };

  const handleDownloadPDF = () => {
    try {
      if (cachedPdfRef.current?.blob) {
        const url = URL.createObjectURL(cachedPdfRef.current.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cachedPdfRef.current.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        generateReceiptPDF(bill, { mode: 'thermal', autoDownload: true });
      }
      showToast(`Invoice PDF downloaded for #${bill.billNumber}`, 'success');
    } catch (err) {
      showToast('Download error: ' + err.message, 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="modal-dialog compact-whatsapp-modal" onClick={(e) => e.stopPropagation()}>
        {/* Compact Modal Header */}
        <div className="whatsapp-modal-header">
          <div className="whatsapp-title-group">
            <h2 className="whatsapp-modal-title">Share Invoice</h2>
            <div className="whatsapp-bill-meta">
              <span className="wa-bill-pill">#{bill.billNumber}</span>
              <span className="wa-total-pill">{formatINR(bill.finalPayableAmount, true)}</span>
            </div>
          </div>
          <button
            type="button"
            className="whatsapp-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Compact Modal Body */}
        <div className="whatsapp-modal-body">
          {/* Customer Number Input */}
          <div className="wa-input-section">
            <label htmlFor="wa-customer-phone" className="wa-input-label">
              Customer WhatsApp Mobile Number *
            </label>
            <div className={`wa-phone-input-wrap ${errorMsg ? 'has-error' : ''}`}>
              <span className="wa-country-badge">+91</span>
              <input
                id="wa-customer-phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                className="wa-phone-input"
                value={mobileNumber}
                onChange={(e) => {
                  setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                  if (errorMsg) setErrorMsg('');
                }}
                autoFocus
              />
              {mobileNumber.length === 10 && (
                <CheckCircle2 size={16} className="wa-valid-icon" />
              )}
            </div>
            {errorMsg && (
              <span className="wa-error-text">
                <AlertCircle size={12} />
                {errorMsg}
              </span>
            )}
          </div>

          {/* Accurate Status & Guidance Notice */}
          <div className="wa-info-notice">
            <div className="wa-status-row">
              <span className="wa-status-badge saved">
                <CheckCircle2 size={11} />
                Bill Saved Locally
              </span>
              <span className={`wa-status-badge ${pdfReady ? 'ready' : ''}`}>
                <FileText size={11} />
                {pdfReady ? 'PDF Ready' : 'Generating PDF'}
              </span>
            </div>
            <p className="wa-guide-text">
              {sharingStatus === 'chat_opened'
                ? 'Direct WhatsApp chat opened! The PDF has been downloaded to your device for immediate attachment.'
                : 'Your invoice is saved. Tapping Open Chat opens WhatsApp directly to this customer.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="wa-actions-group">
            {/* Primary Action: Direct Customer Chat */}
            <button
              type="button"
              id="btn-open-wa-chat"
              className="wa-btn-primary"
              onClick={handleOpenDirectCustomerChat}
            >
              <Send size={16} />
              <span>OPEN CUSTOMER WHATSAPP CHAT</span>
            </button>

            {/* Secondary Action: Native Share / Download PDF */}
            <div className="wa-secondary-row">
              {canNativeShare && (
                <button
                  type="button"
                  id="btn-native-share"
                  className="wa-btn-secondary"
                  onClick={handleNativeFileShare}
                  title="Share file and text using device share sheet"
                >
                  <Share2 size={14} />
                  <span>Share PDF</span>
                </button>
              )}
              <button
                type="button"
                className="wa-btn-secondary"
                onClick={handleDownloadPDF}
                title="Download invoice PDF to your device"
              >
                <Download size={14} />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Compact Modal Footer */}
        <div className="whatsapp-modal-footer">
          <button
            type="button"
            className="wa-btn-done"
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
