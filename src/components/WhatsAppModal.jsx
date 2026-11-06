import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import {
  validateIndianMobile,
  generateWhatsAppReceiptText,
  generateWhatsAppLink,
  generateReceiptPDF,
} from '../utils/receiptGenerator';
import {
  Phone,
  Send,
  X,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Share2,
  RotateCcw,
  Info,
  ExternalLink,
} from 'lucide-react';

export function WhatsAppModal({ isOpen, onClose, bill }) {
  const { settings, startNewBill, showToast } = usePOS();

  const [mobileNumber, setMobileNumber] = useState(bill?.customerPhone || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [canShareFile, setCanShareFile] = useState(false);
  const [stepNotice, setStepNotice] = useState('');
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (bill?.customerPhone) {
      setMobileNumber(bill.customerPhone);
    }
    // Check if device is mobile
    const checkMobile = typeof navigator !== 'undefined' && (
      /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) ||
      (settings.deviceType === 'MOBILE')
    );
    setIsMobileDevice(checkMobile);

    // Check if browser supports native file sharing
    try {
      if (typeof navigator !== 'undefined' && navigator.canShare) {
        const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
        setCanShareFile(navigator.canShare({ files: [testFile] }));
      } else {
        setCanShareFile(false);
      }
    } catch {
      setCanShareFile(false);
    }
  }, [bill, settings.deviceType]);

  const { handleBackdropClick } = useModalBehavior({
    isOpen,
    onClose,
  });

  if (!isOpen || !bill) return null;

  const handleSendWhatsAppInvoice = async () => {
    const validation = validateIndianMobile(mobileNumber);
    if (!validation.isValid) {
      setErrorMsg(validation.error);
      return;
    }

    setErrorMsg('');
    setStepNotice('');

    const receiptText = generateWhatsAppReceiptText(bill, settings);

    // 1. Generate Thermal A4 PDF blob for customer sharing
    let pdfBlob = null;
    let pdfFileName = `${bill.billNumber}_Invoice.pdf`;
    try {
      const pdfResult = generateReceiptPDF(bill, { mode: 'thermal', autoDownload: false });
      pdfBlob = pdfResult.blob;
      pdfFileName = pdfResult.fileName;
    } catch (err) {
      console.warn('PDF generation fallback:', err);
    }

    // 2. Mobile Workflow: Native Web Share API with file attachment
    if (pdfBlob && canShareFile && typeof navigator !== 'undefined' && navigator.share) {
      try {
        const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            title: `${settings.shopName || 'Festival Clothing'} Invoice #${bill.billNumber}`,
            text: receiptText,
            files: [pdfFile],
          });
          setStepNotice('Device share sheet opened! Select WhatsApp to complete sending.');
          showToast('Share dialog opened. Complete sending in WhatsApp.', 'info');
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // Cashier dismissed share sheet
          return;
        }
        console.warn('Native file share fallback:', err);
      }
    }

    // 3. PC Workflow & Fallback: Download PDF & Open WhatsApp Web
    try {
      if (pdfBlob) {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setPdfDownloaded(true);
      } else {
        generateReceiptPDF(bill, { mode: 'thermal', autoDownload: true });
        setPdfDownloaded(true);
      }
    } catch (err) {
      console.warn('Auto download error:', err);
    }

    // Open WhatsApp Web on PC, or WhatsApp link on mobile
    const waUrl = isMobileDevice
      ? `https://wa.me/91${validation.cleanNumber}?text=${encodeURIComponent(receiptText)}`
      : `https://web.whatsapp.com/send?phone=91${validation.cleanNumber}&text=${encodeURIComponent(receiptText)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');

    setStepNotice(
      `WhatsApp opened for ${validation.formattedNumber}! The PDF invoice (${pdfFileName}) is downloaded on your computer. Click the 📎 paperclip icon in WhatsApp Web, choose Document, and select the downloaded PDF.`
    );
    showToast('WhatsApp opened and PDF downloaded. Complete send in WhatsApp.', 'info');
  };

  const handleDownloadOnlyPDF = () => {
    try {
      generateReceiptPDF(bill, { mode: 'thermal', autoDownload: true });
      setPdfDownloaded(true);
      showToast('Thermal PDF invoice downloaded successfully.', 'success');
    } catch (err) {
      showToast('Failed to generate PDF: ' + err.message, 'error');
    }
  };

  const handleDoneAndNewBill = () => {
    onClose();
    startNewBill();
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="modal-dialog whatsapp-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2 className="modal-title">Share Invoice via WhatsApp</h2>
            <span className="modal-subtitle">
              {isMobileDevice ? 'Mobile WhatsApp Direct Share' : 'WhatsApp Web Desktop Sharing'}
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Bill summary chip */}
          <div className="whatsapp-bill-meta-banner">
            <div>
              <span className="meta-label">Bill Number:</span>
              <strong className="meta-value">{bill.billNumber}</strong>
            </div>
            <div>
              <span className="meta-label">Grand Total:</span>
              <strong className="meta-val-highlight">₹{(bill.finalPayableAmount || 0).toFixed(2)}</strong>
            </div>
          </div>

          {/* Customer WhatsApp mobile input */}
          <div className="form-group">
            <label className="input-group-label" htmlFor="wa-mobile-input">
              Customer Indian Mobile Number *
            </label>
            <div className="whatsapp-phone-input-wrap">
              <span className="country-prefix">+91</span>
              <input
                id="wa-mobile-input"
                type="tel"
                inputMode="numeric"
                className="whatsapp-phone-input"
                placeholder="10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => {
                  setMobileNumber(e.target.value);
                  setErrorMsg('');
                  setStepNotice('');
                }}
                maxLength={15}
                autoFocus
              />
            </div>
            {errorMsg ? (
              <span className="phone-validation-error">
                <AlertCircle size={14} /> {errorMsg}
              </span>
            ) : (
              <small className="phone-hint-text">
                Enter customer's 10-digit Indian WhatsApp mobile number (no registration required).
              </small>
            )}
          </div>

          {/* Prominent Action Button: SEND WHATSAPP INVOICE */}
          <div style={{ marginTop: '16px', marginBottom: '16px' }}>
            <button
              type="button"
              id="btn-send-whatsapp-invoice"
              className="btn-whatsapp-send prominent-send-btn"
              onClick={handleSendWhatsAppInvoice}
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: '1rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                borderRadius: '10px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
              }}
            >
              <Send size={18} />
              <span>SEND WHATSAPP INVOICE</span>
            </button>
          </div>

          {/* Step Guidance Notice */}
          {stepNotice ? (
            <div className="whatsapp-status-notice" style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', padding: '12px', borderRadius: '8px' }}>
              <Info size={18} className="notice-icon" style={{ color: '#059669', flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#064e3b', lineHeight: 1.4 }}>
                {stepNotice}
              </p>
            </div>
          ) : (
            <div className="whatsapp-pdf-option-box">
              <div className="pdf-option-info">
                <FileText size={18} className="pdf-icon" />
                <div>
                  <strong>A4 Retail Invoice PDF</strong>
                  <p>Includes itemized ₹10 Less reductions & WISDO TECH attribution.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-download-pdf-sm"
                onClick={handleDownloadOnlyPDF}
              >
                <Download size={14} />
                <span>{pdfDownloaded ? 'Downloaded' : 'Download PDF'}</span>
              </button>
            </div>
          )}

          <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
            <em>Note: The cashier completes the final send in WhatsApp. FESTIVAL CLOTHING does not claim delivery until sent.</em>
          </div>
        </div>

        <div className="modal-footer whatsapp-footer">
          <button
            type="button"
            className="btn-primary start-next-btn"
            onClick={handleDoneAndNewBill}
            style={{ width: '100%' }}
          >
            <RotateCcw size={16} />
            <span>Done / Next Bill (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
