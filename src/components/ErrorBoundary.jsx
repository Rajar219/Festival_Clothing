import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

/**
 * Robust React Error Boundary to catch any unhandled render or lifecycle errors.
 * Prevents the application or settings page from collapsing into a blank screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled exception:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.handleReset,
        });
      }

      return (
        <div
          className="error-boundary-card"
          style={{
            margin: '20px auto',
            maxWidth: '680px',
            padding: '24px',
            borderRadius: '12px',
            border: '2px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <AlertCircle size={28} style={{ color: '#dc2626', flexShrink: 0 }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#991b1b', fontWeight: 700 }}>
                {this.props.title || 'Component Display Issue'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#b91c1c' }}>
                A temporary rendering exception occurred in this section. Your transaction records in IndexedDB remain safe and intact.
              </p>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid #fee2e2',
              fontSize: '0.82rem',
              fontFamily: 'monospace',
              color: '#b91c1c',
              overflowX: 'auto',
              marginBottom: '16px',
            }}
          >
            {this.state.error?.message || 'Unknown component error'}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={this.handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <RotateCcw size={16} />
              <span>Retry / Reload Section</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
