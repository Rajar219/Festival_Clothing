import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { Shield, Lock, X, CheckCircle2 } from 'lucide-react';

export function AdminAuthModal() {
  const {
    isAdminAuthModalOpen,


    setIsAdminAuthModalOpen,
    loginAsAdmin,
    setPendingNavTarget,
  } = usePOS();

  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClose = () => {
    setIsAdminAuthModalOpen(false);
    if (setPendingNavTarget) setPendingNavTarget(null);
    setPin('');
    setErrorMsg('');
  };

  const { handleBackdropClick } = useModalBehavior({
    isOpen: isAdminAuthModalOpen,
    onClose: handleClose,
  });

  if (!isAdminAuthModalOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pin) {
      setErrorMsg('Please enter Administrator PIN');
      return;
    }

    const success = loginAsAdmin(pin);
    if (!success) {
      setErrorMsg('Incorrect Administrator PIN. Default PIN: 1234');
      setPin('');
    } else {
      setPin('');
      setErrorMsg('');
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="admin-auth-title">
      <div className="modal-dialog admin-auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2 id="admin-auth-title" className="modal-title">Administrator Authentication</h2>
            <span className="modal-subtitle">Authorized retail manager access</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close administrator authentication dialog"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="auth-icon-wrap">
              <Shield size={36} className="auth-shield-icon" />
            </div>

            <p className="auth-description-text">
              Enter Administrator PIN to configure product prices, shop settings, and cancel bills.
            </p>

            <div className="form-group">
              <label className="input-group-label" htmlFor="admin-pin-input">Administrator PIN</label>
              <div className="pin-input-wrap">
                <Lock size={16} className="pin-lock-icon" />
                <input
                  id="admin-pin-input"
                  type="password"
                  className="pin-input-field"
                  placeholder="Enter PIN (Default: 1234)"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setErrorMsg('');
                  }}
                  autoFocus
                />
              </div>
              {errorMsg && <span className="auth-error-msg">{errorMsg}</span>}
              <small className="pin-hint-text">Default demo admin PIN is <strong>1234</strong></small>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <CheckCircle2 size={16} />
              <span>Unlock Admin Access</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
