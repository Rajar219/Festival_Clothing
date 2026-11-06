import React from 'react';
import { usePOS } from './context/POSContext';
import { Header } from './components/Header';
import { QuickProductSelector } from './components/QuickProductSelector';
import { BillingTable } from './components/BillingTable';
import { BillSummary } from './components/BillSummary';
import { CheckoutModal } from './components/CheckoutModal';
import { SuccessModal } from './components/SuccessModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { AdminAuthModal } from './components/AdminAuthModal';
import { SalesReportsView } from './components/SalesReportsView';
import { ProductManagementView } from './components/ProductManagementView';
import { SettingsView } from './components/SettingsView';
import { ReceiptPrintView } from './components/ReceiptPrintView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { COMPANY_BRANDING } from './services/db';
import { AlertCircle, CheckCircle, Info, Sparkles } from 'lucide-react';

export function App() {
  const {
    currentView,
    toast,
    billToPrint,
    activePrintMode,
    settings,
  } = usePOS();

  return (
    <div className="pos-app-root">
      {/* Top Application Header */}
      <Header />

      {/* Main Content Area */}
      <main className="pos-main-container">
        <ErrorBoundary title="Application View">
          {currentView === 'billing' && (
            <div className="billing-desk-layout">
              {/* Left Column: Product Selection & Current Bill Table */}
              <div className="billing-main-column">
                <QuickProductSelector />
                <BillingTable />
              </div>

              {/* Right Column: Checkout Summary & Payment Dock */}
              <div className="billing-side-column">
                <BillSummary />
              </div>
            </div>
          )}

          {currentView === 'history' && <SalesReportsView defaultTab="history" />}

          {currentView === 'reports' && <SalesReportsView defaultTab="reports" />}

          {currentView === 'sales' && <SalesReportsView defaultTab="history" />}

          {currentView === 'products' && <ProductManagementView />}

          {currentView === 'settings' && <SettingsView />}
        </ErrorBoundary>
      </main>

      {/* Mandatory Official Company Footer */}
      <footer className="pos-app-footer no-print">
        <div className="footer-content">
          <span>{settings.shopName || 'FESTIVAL CLOTHING'} POS System</span>
          <span className="footer-bullet">•</span>
          <strong>{COMPANY_BRANDING.attributionText}</strong>
          <span className="footer-bullet">•</span>
          <a
            href={COMPANY_BRANDING.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-wisdo-link"
          >
            {COMPANY_BRANDING.companyName}
          </a>
        </div>
      </footer>

      {/* Modals & Dialogs */}
      <CheckoutModal />
      <SuccessModal />
      <PrintPreviewModal />
      <AdminAuthModal />

      {/* Dedicated native browser print root */}
      <div id="print-receipt-root" className="print-only">
        {billToPrint && (
          <ReceiptPrintView bill={billToPrint} mode={activePrintMode} />
        )}
      </div>

      {/* Premium Mobile Bottom Navigation Dock */}
      <MobileBottomNav />

      {/* Toast Notification Banner */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          {toast.type === 'info' && <Sparkles size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
