import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { ReceiptPrintView } from './ReceiptPrintView';
import { Printer, FileText, X, Check } from 'lucide-react';

export function PrintPreviewModal() {
  const {
    isPrintPreviewOpen,
    setIsPrintPreviewOpen,
    billToPrint,
    activePrintMode,
    setActivePrintMode,
  } = usePOS();

  const handleClose = () => {
    setIsPrintPreviewOpen(false);
  };

  const { handleBackdropClick } = useModalBehavior({
    isOpen: isPrintPreviewOpen,
    onClose: handleClose,
  });

  if (!isPrintPreviewOpen || !billToPrint) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay no-print" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="modal-dialog print-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2 className="modal-title">Receipt Print Preview</h2>
            <span className="modal-subtitle">Bill: {billToPrint.billNumber}</span>
          </div>

          <div className="print-mode-toggle-group">
            <button
              type="button"
              className={`mode-toggle-btn ${activePrintMode === 'thermal' ? 'active' : ''}`}
              onClick={() => setActivePrintMode('thermal')}
            >
              <Printer size={16} />
              <span>Thermal (80mm)</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${activePrintMode === 'a4' ? 'active' : ''}`}
              onClick={() => setActivePrintMode('a4')}
            >
              <FileText size={16} />
              <span>A4 Invoice</span>
            </button>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close print preview"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body preview-scroll-body">
          <div className={`receipt-preview-container ${activePrintMode}`}>
            <ReceiptPrintView bill={billToPrint} mode={activePrintMode} />
          </div>
        </div>

        <div className="modal-footer">
          <span className="preview-tip-text">
            Printer dialog will open. Uncheck "Headers and Footers" in browser print settings for best thermal receipt results.
          </span>
          <div className="preview-footer-buttons">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsPrintPreviewOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              id="btn-print-now"
              className="btn-primary"
              onClick={handlePrint}
            >
              <Printer size={18} />
              <span>Print Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
