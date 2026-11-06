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
  CheckCircle2,
  Laptop,
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
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
    terminalInfo,
    syncState,
    triggerManualSync,
    currentStaffUser,
    logoutStaff,
    loginWithGoogleStaff,
    isFirebaseConfigured,
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

  const isSyncing = syncState?.status === 'syncing';
  const isPending = syncState?.status === 'pending' || (syncState?.pendingCount > 0);
  const isOffline = !syncState?.isOnline || syncState?.status === 'offline';
  const isUnconfigured = syncState?.status === 'unconfigured';
  const isSynced = syncState?.status === 'synced' && !isPending && !isOffline;

  return (
    <header className="header-bar">
      <div className="header-main-row">
        {/* Brand & Logo */}
        <div className="header-left">
          <div
            className="brand-logo-container"
            onClick={() => setCurrentView('billing')}
            style={{ cursor: 'pointer' }}
          >
            <img
              src="/logo.png"
              alt="FESTIVAL CLOTHING"
              className="header-brand-logo-img"
            />
            <div className="brand-text">
              <div className="brand-title-row">
                <span className="brand-main-title">FESTIVAL CLOTHING</span>
                <span className="brand-subtitle-badge">{settings.subtitle || 'MENSWEAR'}</span>
                <span className="wisdo-attribution-badge desktop-only">
                  {COMPANY_BRANDING.attributionText}
                </span>
              </div>
              {settings.shopName && settings.shopName !== 'FESTIVAL CLOTHING' && (
                <span className="brand-custom-name">{settings.shopName}</span>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Center) */}
        <nav className="nav-tabs desktop-only" aria-label="Main Navigation">
          <button
            className={`nav-tab-btn ${currentView === 'billing' ? 'active' : ''}`}
            onClick={() => handleNavClick('billing')}
            id="nav-tab-billing"
          >
            <ShoppingBag size={15} />
            <span>Billing Desk</span>
            {items.length > 0 && <span className="tab-badge">{items.length}</span>}
          </button>

          <button
            className={`nav-tab-btn ${currentView === 'history' || (currentView === 'sales' && !isAdmin) ? 'active' : ''}`}
            onClick={() => handleNavClick('history')}
            id="nav-tab-history"
          >
            <History size={15} />
            <span>Sales History</span>
          </button>

          <button
            className={`nav-tab-btn ${currentView === 'reports' ? 'active' : ''}`}
            onClick={() => handleNavClick('reports')}
            id="nav-tab-reports"
          >
            <BarChart3 size={15} />
            <span>Reports</span>
          </button>

          <button
            className={`nav-tab-btn ${currentView === 'settings' || currentView === 'products' ? 'active' : ''}`}
            onClick={() => handleNavClick('settings')}
            id="nav-tab-settings"
          >
            <Settings size={15} />
            <span>Admin Settings</span>
            {!isAdmin && <Lock size={12} className="tab-lock-icon" />}
          </button>
        </nav>

        {/* Desktop Right: Status Indicators & Authentication */}
        <div className="header-right">
          {/* Subtle Terminal Badge */}
          <span
            className="header-subtle-badge header-terminal-badge"
            title={`Active Device: ${terminalInfo?.name || 'PC Terminal'}`}
          >
            {terminalInfo?.isMobile ? <Smartphone size={12} /> : <Laptop size={12} />}
            <span>{terminalInfo?.terminalType === 'MOBILE' ? 'Mobile' : 'PC'}</span>
          </span>

          {/* Central Cloud Sync Pill */}
          <button
            type="button"
            className={`header-sync-pill ${
              isSyncing
                ? 'syncing'
                : isPending
                ? 'pending'
                : isOffline
                ? 'offline'
                : isUnconfigured
                ? 'local'
                : 'synced'
            }`}
            onClick={triggerManualSync}
            title={
              isSyncing
                ? 'Synchronising sales with Central Cloud Database...'
                : isPending
                ? `${syncState?.pendingCount || 0} bill(s) pending sync. Click to retry now.`
                : isOffline
                ? 'Offline. Bills will automatically sync when network is restored.'
                : isUnconfigured
                ? 'Local-first. Central database not yet connected.'
                : 'All PC and Mobile sales are synchronised in real-time. Click to refresh.'
            }
          >
            {isSyncing ? (
              <>
                <RefreshCw size={11} className="spinning" />
                <span>Syncing...</span>
              </>
            ) : isPending ? (
              <>
                <Cloud size={11} />
                <span>Pending ({syncState?.pendingCount})</span>
              </>
            ) : isOffline ? (
              <>
                <WifiOff size={11} />
                <span>Offline</span>
              </>
            ) : isUnconfigured ? (
              <>
                <Cloud size={11} />
                <span>Local</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={11} />
                <span>Synced</span>
              </>
            )}
          </button>

          {/* Live System Clock (Desktop) */}
          <div className="header-clock-compact desktop-only">
            <Clock size={12} className="clock-icon" />
            <span>{formattedTime}</span>
          </div>

          {/* Role & Staff Account Indicator */}
          <div className="role-switcher-badge">
            {currentStaffUser ? (
              <div className="admin-status-pill staff-account-pill">
                <Shield size={13} className="admin-icon" />
                <span className="role-name" title={currentStaffUser.email}>
                  {currentStaffUser.email.split('@')[0]} ({currentStaffUser.role})
                </span>
                <button
                  type="button"
                  className="role-switch-btn"
                  onClick={logoutStaff}
                  title="Sign out of staff account"
                >
                  Exit
                </button>
              </div>
            ) : isAdmin ? (
              <div className="admin-status-pill">
                <Shield size={13} className="admin-icon" />
                <span className="role-name">Admin</span>
                <button
                  type="button"
                  className="role-switch-btn"
                  onClick={switchRoleToCashier}
                  title="Exit Admin mode and return to Cashier"
                >
                  Lock
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
                title="Click to authenticate as Administrator (PIN: 2111)"
              >
                <User size={13} />
                <span className="role-name">Cashier</span>
                <Lock size={11} className="lock-icon" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
