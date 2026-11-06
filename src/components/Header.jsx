import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { COMPANY_BRANDING } from '../services/db';
import {
  ShoppingBag,
  History,
  BarChart3,
  Settings,
  Clock,
  Printer,
  Shield,
  User,
  Lock,
  Cloud,
  CloudCheck,
  Laptop,
  Smartphone,
} from 'lucide-react';

export function Header() {
  const {
    currentView,
    setCurrentView,
    settings,
    items,
    lastFinalizedBill,
    triggerPrint,
    activePrintMode,
    isAdmin,
    setIsAdminAuthModalOpen,
    setPendingNavTarget,
    switchRoleToCashier,
    isDriveConnected,
  } = usePOS();

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const handleNavClick = (viewName) => {
    if ((viewName === 'settings' || viewName === 'products') && !isAdmin) {
      setPendingNavTarget(viewName);
      setIsAdminAuthModalOpen(true);
      return;
    }
    setCurrentView(viewName);
  };

  return (
    <header className="header-bar">
      <div className="header-left">
        <div className="brand-logo-container" onClick={() => setCurrentView('billing')} style={{ cursor: 'pointer' }}>
          <img
            src="/logo.png"
            alt="FESTIVAL CLOTHING"
            className="header-brand-logo-img"
          />
          <div className="brand-text">
            <div className="brand-title-row">
              <span className="brand-subtitle-badge">{settings.subtitle || 'MENSWEAR'}</span>
              <span className="wisdo-attribution-badge">
                {COMPANY_BRANDING.attributionText}
              </span>
            </div>
            {settings.shopName && settings.shopName !== 'FESTIVAL CLOTHING' && (
              <span className="brand-custom-name">{settings.shopName}</span>
            )}
          </div>
        </div>
      </div>

      {/* Live System Clock */}
      <div className="header-center">
        <div className="system-clock-pill">
          <Clock size={14} className="clock-icon" />
          <span className="clock-date">{formattedDate}</span>
          <span className="clock-divider">•</span>
          <span className="clock-time">{formattedTime}</span>
        </div>
      </div>

      {/* Navigation & Controls */}
      <div className="header-right">
        {/* Quick Reprint Button */}
        {lastFinalizedBill && (
          <button
            className="header-action-btn reprint-btn"
            onClick={() => triggerPrint(lastFinalizedBill, activePrintMode)}
            title="Reprint last finalized bill receipt"
          >
            <Printer size={15} />
            <span>Reprint #{lastFinalizedBill.billNumber.split('-').slice(1).join('-')}</span>
          </button>
        )}

        {/* Main Navigation Tabs */}
        <nav className="nav-tabs" aria-label="Main Navigation">
          <button
            className={`nav-tab-btn ${currentView === 'billing' ? 'active' : ''}`}
            onClick={() => handleNavClick('billing')}
            id="nav-tab-billing"
          >
            <ShoppingBag size={16} />
            <span>Billing Desk</span>
            {items.length > 0 && <span className="tab-badge">{items.length}</span>}
          </button>

          <button
            className={`nav-tab-btn ${currentView === 'history' || (currentView === 'sales' && !isAdmin) ? 'active' : ''}`}
            onClick={() => handleNavClick('history')}
            id="nav-tab-history"
          >
            <History size={16} />
            <span>Sales History</span>
          </button>

          <button
            className={`nav-tab-btn ${currentView === 'reports' ? 'active' : ''}`}
            onClick={() => handleNavClick('reports')}
            id="nav-tab-reports"
          >
            <BarChart3 size={16} />
            <span>Reports</span>
          </button>

          <button
            className={`nav-tab-btn ${currentView === 'settings' || currentView === 'products' ? 'active' : ''}`}
            onClick={() => handleNavClick('settings')}
            id="nav-tab-settings"
          >
            <Settings size={16} />
            <span>Admin Settings</span>
            {!isAdmin && <Lock size={12} className="tab-lock-icon" />}
          </button>
        </nav>

        {/* Terminal Type & Drive Status Badges */}
        <div className="terminal-status-indicators" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            className="terminal-type-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 600,
              background: '#ecfdf5',
              color: '#064e3b',
              border: '1px solid #a7f3d0',
            }}
            title={`Registered as ${settings.deviceType || 'PC'} Terminal`}
          >
            {settings.deviceType === 'MOBILE' ? <Smartphone size={12} /> : <Laptop size={12} />}
            <span>{settings.deviceType || 'PC'}</span>
          </span>

          <span
            className="drive-connection-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 600,
              background: isDriveConnected ? '#f0fdf4' : '#f8fafc',
              color: isDriveConnected ? '#15803d' : '#64748b',
              border: `1px solid ${isDriveConnected ? '#86efac' : '#cbd5e1'}`,
            }}
            title={isDriveConnected ? 'Google Drive Connected (Auto-backup active)' : 'Google Drive Disconnected (Local IndexedDB active)'}
          >
            <Cloud size={12} style={{ color: isDriveConnected ? '#16a34a' : '#94a3b8' }} />
            <span>{isDriveConnected ? 'Drive ON' : 'Local'}</span>
          </span>
        </div>

        {/* Role Indicator / Switcher */}
        <div className="role-switcher-badge">
          {isAdmin ? (
            <div className="admin-status-pill">
              <Shield size={13} className="admin-icon" />
              <span>Admin</span>
              <button
                type="button"
                className="role-switch-btn"
                onClick={switchRoleToCashier}
                title="Exit Admin mode and return to Cashier"
              >
                (Logout)
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="cashier-login-pill"
              onClick={() => {
                setPendingNavTarget('settings');
                setIsAdminAuthModalOpen(true);
              }}
              title="Click to authenticate as Administrator (PIN: 1234)"
            >
              <User size={13} />
              <span>Cashier</span>
              <Lock size={11} className="lock-icon" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

