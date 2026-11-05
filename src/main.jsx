import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { POSProvider } from './context/POSContext';
import './index.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('POS Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          fontFamily: 'sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '520px',
            background: '#ffffff',
            padding: '32px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
          }}>
            <h2 style={{ color: '#064e3b', marginBottom: '8px', fontSize: '1.25rem' }}>FESTIVAL CLOTHING POS</h2>
            <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '16px', fontSize: '0.9rem' }}>
              An unexpected error occurred during rendering.
            </p>
            <pre style={{
              background: '#f1f5f9',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              overflowX: 'auto',
              textAlign: 'left',
              marginBottom: '20px',
              color: '#1e293b',
            }}>
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#064e3b',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload POS Desk
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <POSProvider>
        <App />
      </POSProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Register Progressive Web App (PWA) Service Worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('FESTIVAL POS Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('Service Worker registration skipped or failed:', error);
      });
  });
}
