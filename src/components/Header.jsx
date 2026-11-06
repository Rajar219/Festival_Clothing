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

        {/* Live System Clock (Desktop) */}
        <div className="header-center desktop-only">
          <div className="system-clock-pill">
            <Clock size={14} className="clock-icon" />
            <span className="clock-date">{formattedDate}</span>
            <span className="clock-divider">•</span>
            <span className="clock-time">{formattedTime}</span>
          </div>
        </div>

        {/* Desktop Navigation Tabs & Controls */}
        <div className="header-right">
          {/* Quick Reprint Button */}
          {lastFinalizedBill && (
            <button
              className="header-action-btn reprint-btn desktop-only"
              onClick={() => triggerPrint(lastFinalizedBill, activePrintMode)}
              title="Reprint last finalized bill receipt"
            >
              <Printer size={15} />
              <span>Reprint #{lastFinalizedBill.billNumber.split('-').slice(1).join('-')}</span>
            </button>
          )}

          {/* Desktop Navigation Tabs (Hidden on mobile; mobile uses BottomNav) */}
          <nav className="nav-tabs desktop-only" aria-label="Main Navigation">
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

          {/* Role Indicator / Switcher */}
          <div className="role-switcher-badge">
            {isAdmin ? (
              <div className="admin-status-pill">
                <Shield size={13} className="admin-icon" />
                <span className="role-name">Admin</span>
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

      {/* Cross-Device Status Strip (Visible on Mobile & Desktop) */}
      <div className="header-status-strip">
        <div className="status-badges-group">
          {/* Terminal Identity Badge */}
          <span
            className="terminal-pill-badge"
            title={`Active Device: ${terminalInfo?.name || 'PC Terminal'}`}
          >
            {terminalInfo?.isMobile ? <Smartphone size={12} /> : <Laptop size={12} />}
            <span>{terminalInfo?.terminalType === 'MOBILE' ? 'Mobile Handheld' : 'PC Counter'}</span>
          </span>

          {/* Online / Offline Network Badge */}
          <span
            className={`network-pill-badge ${isOffline ? 'badge-offline' : 'badge-online'}`}
            title={isOffline ? 'Device is offline' : 'Device is online'}
          >
            {isOffline ? <WifiOff size={11} /> : <Wifi size={11} />}
            <span>{isOffline ? 'Offline' : 'Online'}</span>
          </span>

          {/* Cross-Device Cloud Sync Indicator */}
          <button
            type="button"
            className={`sync-status-badge ${
              isSyncing
                ? 'badge-syncing'
                : isPending
                ? 'badge-pending'
                : isOffline
                ? 'badge-offline'
                : isUnconfigured
                ? 'badge-local'
                : 'badge-synced'
            }`}
            onClick={triggerManualSync}
            title={
              isSyncing
                ? 'Synchronising sales with central cloud database...'
                : isPending
                ? `${syncState?.pendingCount || 0} bill(s) pending sync. Click to retry now.`
                : isOffline
                ? 'Offline. Bills will automatically sync when network is restored.'
                : isUnconfigured
                ? 'Central database not yet connected. Operating local-first.'
                : 'All PC and mobile sales are synchronised with central database. Click to refresh.'
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
                <Cloud size={11} />
                <span>Queue Active</span>
              </>
            ) : isUnconfigured ? (
              <>
                <Cloud size={11} />
                <span>Local-First</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={11} />
                <span>Synced</span>
              </>
            )}
          </button>

          {/* Google Drive Status Indicator */}
          <span
            className={`drive-pill-badge ${isDriveConnected ? 'drive-on' : 'drive-off'}`}
            title={isDriveConnected ? 'Google Drive Connected (Optional backups active)' : 'Google Drive Disconnected'}
          >
            <Cloud size={11} />
            <span>{isDriveConnected ? 'Drive ON' : 'Drive OFF'}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

export default Header;
