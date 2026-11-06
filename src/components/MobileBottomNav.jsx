import React from 'react';
import { usePOS } from '../context/POSContext';
import { ShoppingBag, History, BarChart3, Settings, Lock } from 'lucide-react';

export function MobileBottomNav() {
  const {
    currentView,
    setCurrentView,
    items,
    isAdmin,
    setIsAdminAuthModalOpen,
    setPendingNavTarget,
  } = usePOS();

  const handleNavClick = (viewName) => {
    if ((viewName === 'settings' || viewName === 'products') && !isAdmin) {
      setPendingNavTarget(viewName);
      setIsAdminAuthModalOpen(true);
      return;
    }
    setCurrentView(viewName);
  };

  const isBillingActive = currentView === 'billing';
  const isHistoryActive = currentView === 'history' || currentView === 'sales';
  const isReportsActive = currentView === 'reports';
  const isSettingsActive = currentView === 'settings' || currentView === 'products';

  return (
    <nav className="mobile-bottom-nav-bar" aria-label="Mobile Bottom Navigation">
      {/* 1. BILLING */}
      <button
        type="button"
        id="mobile-nav-billing"
        className={`mobile-nav-item ${isBillingActive ? 'active' : ''}`}
        onClick={() => handleNavClick('billing')}
        aria-label="Billing Desk"
      >
        <div className="mobile-nav-icon-wrap">
          <ShoppingBag size={21} />
          {items.length > 0 && (
            <span className="mobile-nav-badge">{items.length}</span>
          )}
        </div>
        <span className="mobile-nav-label">Billing</span>
      </button>

      {/* 2. SALES HISTORY */}
      <button
        type="button"
        id="mobile-nav-history"
        className={`mobile-nav-item ${isHistoryActive ? 'active' : ''}`}
        onClick={() => handleNavClick('history')}
        aria-label="Sales History"
      >
        <div className="mobile-nav-icon-wrap">
          <History size={21} />
        </div>
        <span className="mobile-nav-label">Sales</span>
      </button>

      {/* 3. REPORTS */}
      <button
        type="button"
        id="mobile-nav-reports"
        className={`mobile-nav-item ${isReportsActive ? 'active' : ''}`}
        onClick={() => handleNavClick('reports')}
        aria-label="Sales Reports"
      >
        <div className="mobile-nav-icon-wrap">
          <BarChart3 size={21} />
        </div>
        <span className="mobile-nav-label">Reports</span>
      </button>

      {/* 4. ADMIN SETTINGS */}
      <button
        type="button"
        id="mobile-nav-settings"
        className={`mobile-nav-item ${isSettingsActive ? 'active' : ''}`}
        onClick={() => handleNavClick('settings')}
        aria-label="Admin Settings"
      >
        <div className="mobile-nav-icon-wrap">
          <Settings size={21} />
          {!isAdmin && <Lock size={10} className="mobile-nav-lock" />}
        </div>
        <span className="mobile-nav-label">Settings</span>
      </button>
    </nav>
  );
}

export default MobileBottomNav;
