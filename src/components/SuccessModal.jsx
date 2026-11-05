import React, { useEffect, useState } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { formatINR, formatDateTime } from '../utils/currency';
import { generateReceiptPDF } from '../utils/receiptGenerator';
import { WhatsAppModal } from './WhatsAppModal';
import {
  CheckCircle2,
  Printer,
  FileText,
  RotateCcw,
  Send,
  Download,
  X,
  Cloud,
  RefreshCw,
  ExternalLink,
  Laptop,
  Smartphone,
  AlertCircle,
} from 'lucide-react';

export function SuccessModal() {
  const {
    isSuccessModalOpen,
    setIsSuccessModalOpen,
    lastFinalizedBill,
    startNewBill,
    triggerPrint,
    settings,
    showToast,
    isDriveConnected,
    manualSaveBillToDrive,
  } = usePOS();

  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [targetFolder, setTargetFolder] = useState(settings.deviceType || 'PC');
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [driveUploadError, setDriveUploadError] = useState(null);

  useEffect(() => {
    setTargetFolder(settings.deviceType || 'PC');
    setDriveUploadError(null);
  }, [lastFinalizedBill, settings.deviceType]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!isSuccessModalOpen || isWhatsAppOpen) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        startNewBill();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSuccessModalOpen, isWhatsAppOpen, startNewBill]);

  const { handleBackdropClick } = useModalBehavior({
    isOpen: isSuccessModalOpen && !isWhatsAppOpen,
    onClose: startNewBill,
  });

  if (!isSuccessModalOpen || !lastFinalizedBill) return null;

  const handleDownloadPDF = (mode = 'a4') => {
    try {
      generateReceiptPDF(lastFinalizedBill, mode);
      showToast(`PDF invoice (${mode.toUpperCase()}) downloaded successfully.`, 'success');
    } catch (err) {
      showToast('Error generating PDF: ' + err.message, 'error');
    }
  };

  const handleManualSaveToDrive = async () => {
    if (!isDriveConnected) {
      showToast('Google Drive is not connected. Please connect in Admin Settings.', 'warning');
      return;
    }

    setIsSavingDrive(true);
    setDriveUploadError(null);

    const result = await manualSaveBillToDrive(lastFinalizedBill, targetFolder);
    setIsSavingDrive(false);

    if (!result?.success) {
      setDriveUploadError(result?.error || 'Upload failed');
    }
  };

  const isAlreadySavedToDrive = lastFinalizedBill.driveUploadStatus === 'uploaded';

  return (
    <>
      <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="success-dialog-title">
        <div className="modal-dialog success-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', position: 'relative' }}>
          <button
            type="button"
            className="modal-close-btn"
            onClick={startNewBill}
            aria-label="Close dialog and start new bill"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              zIndex: 10,
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={18} />
          </button>
          <div className="success-header">
            <div className="success-icon-badge">
              <CheckCircle2 size={44} className="success-icon" />
            </div>
            <h2 id="success-dialog-title" className="success-title">Bill Saved Locally!</h2>
            <span className="success-bill-number">
              Bill No: <strong>{lastFinalizedBill.billNumber}</strong>
            </span>
            <span className="success-timestamp">
              {formatDateTime(lastFinalizedBill.createdAt)}
            </span>
          </div>

          <div className="success-summary-box">
            <div className="summary-stat-row">
              <span>Total Pieces:</span>
              <strong>{(lastFinalizedBill.items || []).reduce((a, b) => a + (b.qty || 1), 0)} pcs</strong>
            </div>
            <div className="summary-stat-row">
              <span>Grand Total:</span>
              <strong className="stat-highlight">{formatINR(lastFinalizedBill.finalPayableAmount, true)}</strong>
            </div>
            <div className="summary-stat-row">
              <span>Payment:</span>
              <strong className="badge-payment">{lastFinalizedBill.paymentMethod.toUpperCase()}</strong>
            </div>
            {lastFinalizedBill.paymentMethod === 'cash' && lastFinalizedBill.changeDue > 0 && (
              <div className="summary-stat-row change-row">
                <span>Change Returned:</span>
                <strong className="change-return-val">{formatINR(lastFinalizedBill.changeDue, true)}</strong>
              </div>
            )}
          </div>

          {/* MANUAL SAVE TO GOOGLE DRIVE (NO SILENT BACKGROUND UPLOADS) */}
          <div
            className="manual-drive-save-card"
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '14px',
              background: isAlreadySavedToDrive ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${isAlreadySavedToDrive ? '#a7f3d0' : '#e2e8f0'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cloud size={17} style={{ color: isAlreadySavedToDrive ? '#16a34a' : '#0284c7' }} />
                <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  {isAlreadySavedToDrive ? 'Saved in Google Drive' : 'Cloud Archive (Google Drive)'}
                </strong>
              </div>

              {/* Folder Selector: PC BILLING vs MOBILE BILLING */}
              {!isAlreadySavedToDrive && (
                <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '2px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setTargetFolder('PC')}
                    style={{
                      border: 'none',
                      background: targetFolder === 'PC' ? '#ffffff' : 'transparent',
                      color: targetFolder === 'PC' ? '#064e3b' : '#64748b',
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <Laptop size={11} /> PC
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetFolder('MOBILE')}
                    style={{
                      border: 'none',
                      background: targetFolder === 'MOBILE' ? '#ffffff' : 'transparent',
                      color: targetFolder === 'MOBILE' ? '#064e3b' : '#64748b',
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <Smartphone size={11} /> Mobile
                  </button>
                </div>
              )}
            </div>

            {isAlreadySavedToDrive ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle2 size={15} /> Uploaded to <strong>{lastFinalizedBill.driveFolderName || `${targetFolder} BILLING`}</strong>
                </span>
                {lastFinalizedBill.driveFileUrl && (
                  <a
                    href={lastFinalizedBill.driveFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontWeight: 600 }}
                  >
                    <span>View File</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  id="btn-save-to-google-drive"
                  onClick={handleManualSaveToDrive}
                  disabled={isSavingDrive}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: isDriveConnected ? '#0284c7' : '#94a3b8',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isDriveConnected ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  title={isDriveConnected ? `Upload PDF into FESTIVAL SALES BILL / ${targetFolder} BILLING` : 'Google Drive is not connected. Connect in Settings.'}
                >
                  <Cloud size={15} className={isSavingDrive ? 'spin' : ''} />
                  <span>
                    {isSavingDrive
                      ? `Saving to ${targetFolder} BILLING...`
                      : isDriveConnected
                      ? `Save to Google Drive (${targetFolder} BILLING)`
                      : 'Connect Drive in Settings to Save'}
                  </span>
                </button>

                {driveUploadError && (
                  <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} />
                    <span>Failed: {driveUploadError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prominent Action Button: SEND WHATSAPP INVOICE */}
          <div style={{ marginBottom: '12px' }}>
            <button
              type="button"
              id="btn-send-whatsapp-bill"
              className="action-card-btn whatsapp-action"
              onClick={() => setIsWhatsAppOpen(true)}
              style={{
                width: '100%',
                padding: '15px',
                background: '#059669',
                color: '#fff',
                borderRadius: '10px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                fontSize: '1.05rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)',
              }}
            >
              <Send size={20} className="whatsapp-icon" />
              <span>SEND WHATSAPP INVOICE</span>
            </button>
          </div>

          <div className="success-actions-grid two-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            {/* 1. Print Receipt */}
            <button
              type="button"
              id="btn-print-receipt"
              className="action-card-btn primary"
              onClick={() => triggerPrint(lastFinalizedBill, settings.defaultPrintMode || 'thermal')}
              style={{ padding: '12px' }}
            >
              <Printer size={18} />
              <div className="action-card-text">
                <strong>Print Receipt</strong>
                <small>{settings.defaultPrintMode === 'a4' ? 'A4 Invoice' : 'Thermal 80mm'}</small>
              </div>
            </button>

            {/* 2. Download PDF */}
            <button
              type="button"
              id="btn-download-pdf"
              className="action-card-btn tertiary"
              onClick={() => handleDownloadPDF('a4')}
              style={{ padding: '12px' }}
            >
              <Download size={18} />
              <div className="action-card-text">
                <strong>Download PDF</strong>
                <small>A4 Retail Bill</small>
              </div>
            </button>
          </div>

          <div className="modal-footer success-footer">
            <button
              type="button"
              id="btn-start-next-bill"
              className="btn-primary start-next-btn"
              onClick={startNewBill}
              autoFocus
              style={{ width: '100%' }}
            >
              <RotateCcw size={18} />
              <span>New Bill (Press Enter)</span>
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal Dialog */}
      <WhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        bill={lastFinalizedBill}
      />
    </>
  );
}
