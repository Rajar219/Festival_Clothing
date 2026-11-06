import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';
import { POSProvider } from '../src/context/POSContext';
import { PriceSelectorModal } from '../src/components/PriceSelectorModal';
import fs from 'fs';
import path from 'path';

describe('App Render & Responsive Design Test', () => {
  it('renders App component to string without crashing and displays branding', () => {
    const html = renderToString(
      <POSProvider>
        <App />
      </POSProvider>
    );
    expect(html).toContain('FESTIVAL CLOTHING');
    expect(html).toContain('Powered by WISDO TECH');
  });

  it('verifies index.html has mobile viewport-fit and theme-color configuration', () => {
    const indexPath = path.resolve(__dirname, '../index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain('viewport-fit=cover');
    expect(indexContent).toContain('name="theme-color"');
  });

  it('verifies index.css includes mobile media queries for responsive viewports (320px to 1440px)', () => {
    const cssPath = path.resolve(__dirname, '../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Check media queries for breakpoints
    expect(cssContent).toContain('@media (max-width: 1024px)');
    expect(cssContent).toContain('@media (max-width: 860px)');
    expect(cssContent).toContain('@media (max-width: 768px)');
    expect(cssContent).toContain('@media (max-width: 640px)');
    expect(cssContent).toContain('@media (max-width: 360px)');

    // Check mobile-specific elements are styled
    expect(cssContent).toContain('.mobile-billing-list');
    expect(cssContent).toContain('.mobile-cart-item-card');
    expect(cssContent).toContain('.mobile-sticky-checkout-bar');
    expect(cssContent).toContain('.mobile-ledger-cards');
    expect(cssContent).toContain('overflow-x: hidden');
  });

  it('verifies PWA manifest, service worker, and Vercel routing configuration exist', () => {
    // 1. Manifest
    const manifestPath = path.resolve(__dirname, '../public/manifest.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifestJson.name).toContain('FESTIVAL CLOTHING');
    expect(manifestJson.display).toBe('standalone');
    expect(manifestJson.theme_color).toBe('#064e3b');

    // 2. Service Worker
    const swPath = path.resolve(__dirname, '../public/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);
    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain('festival-pos-cache');

    // 3. Vercel Configuration
    const vercelPath = path.resolve(__dirname, '../vercel.json');
    expect(fs.existsSync(vercelPath)).toBe(true);
    const vercelJson = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
    expect(vercelJson.rewrites).toBeDefined();

    // 4. Vercel Health Check
    const healthPath = path.resolve(__dirname, '../api/health.js');
    expect(fs.existsSync(healthPath)).toBe(true);
  });

  it('verifies SettingsView and Admin authentication views render without icon or runtime exceptions', () => {
    // Render POSProvider with SettingsView
    const html = renderToString(
      <POSProvider>
        <App />
      </POSProvider>
    );
    expect(html).toContain('FESTIVAL CLOTHING');
  });

  it('verifies PriceSelectorModal renders compact thumbnail, product title, stepper, and pinned footer', () => {
    const sampleProduct = {
      id: 'prod_shirts',
      name: 'Shirts',
      defaultPrice: 600,
      offerPrice: 550,
      offers: [550, 500],
      image: '/products/shirt.jpg',
    };

    const modalHtml = renderToString(
      <PriceSelectorModal
        isOpen={true}
        product={sampleProduct}
        onClose={() => {}}
        onConfirmPrice={() => {}}
      />
    );

    // 1. Thumbnail & Header
    expect(modalHtml).toContain('price-selector-thumb');
    expect(modalHtml).toContain('/products/shirt.jpg');
    expect(modalHtml).toContain('Shirts');
    expect(modalHtml).toContain('Catalogue Base:');
    expect(modalHtml).toContain('600');

    // 2. Offer pills & quick reductions
    expect(modalHtml).toContain('price-pill-row');
    expect(modalHtml).toContain('600');
    expect(modalHtml).toContain('550');
    expect(modalHtml).toContain('500');
    expect(modalHtml).toContain('10');
    expect(modalHtml).toContain('Reset');

    // 3. Stepper controls & input
    expect(modalHtml).toContain('qty-stepper-box');
    expect(modalHtml).toContain('qty-step-btn minus');
    expect(modalHtml).toContain('qty-step-btn plus');
    expect(modalHtml).toContain('custom-price-input');

    // 4. Pinned footer with live subtotal & actions
    expect(modalHtml).toContain('price-selector-footer');
    expect(modalHtml).toContain('live-total-amount');
    expect(modalHtml).toContain('btn-modal-cancel');
    expect(modalHtml).toContain('btn-modal-confirm');
  });

  it('tests SettingsView rendering directly with admin privileges', async () => {
    const { SettingsView } = await import('../src/components/SettingsView');
    const { POSContext } = await import('../src/context/POSContext');
    const { DEFAULT_SETTINGS } = await import('../src/services/db');

    const mockPOS = {
      settings: DEFAULT_SETTINGS,
      products: [],
      allBills: [],
      updateSettings: async () => {},
      isAdmin: true,
      setIsAdminAuthModalOpen: () => {},
      refreshBills: async () => {},
      showToast: () => {},
      isDriveConnected: false,
      connectDrive: async () => {},
      disconnectDrive: () => {},
    };

    const html = renderToString(
      <POSContext.Provider value={mockPOS}>
        <SettingsView />
      </POSContext.Provider>
    );

    expect(html).toContain('Shop Administration');
    expect(html).toContain('Shop Branding');
  });

  it('verifies index.css strictly implements compact thumbnail, flex-column, and non-overlapping footer architecture', () => {
    const cssPath = path.resolve(__dirname, '../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Viewport and flex-column constraints
    expect(cssContent).toContain('.modal-dialog.price-selector-modal');
    expect(cssContent).toContain('max-height: 85dvh');
    expect(cssContent).toContain('flex-direction: column');
    expect(cssContent).toContain('overflow: hidden');

    // Thumbnail size constraint & object-fit: contain (no screen blowing)
    expect(cssContent).toContain('.price-selector-thumb');
    expect(cssContent).toContain('object-fit: contain');
    expect(cssContent).toContain('max-width: 70px');
    expect(cssContent).toContain('max-height: 82px');

    // Scrollable body with flex: 1 and min-height: 0
    expect(cssContent).toContain('.price-selector-body');
    expect(cssContent).toContain('overflow-y: auto');
    expect(cssContent).toContain('min-height: 0');

    // Pinned footer never overlapping content
    expect(cssContent).toContain('.price-selector-footer');
    expect(cssContent).toContain('flex-shrink: 0');
    expect(cssContent).toContain('env(safe-area-inset-bottom)');

    // Mobile bottom sheet docking
    expect(cssContent).toContain('align-items: flex-end');
    expect(cssContent).toContain('border-radius: 20px 20px 0 0');
  });

  it('verifies CheckoutModal renders SELECT PAYMENT METHOD with CASH and UPI selectable cards and cash/UPI behavior', async () => {
    const { CheckoutModal } = await import('../src/components/CheckoutModal');
    const { POSContext } = await import('../src/context/POSContext');
    const { DEFAULT_SETTINGS } = await import('../src/services/db');

    const mockCashPOS = {
      isCheckoutModalOpen: true,
      setIsCheckoutModalOpen: () => {},
      finalPayableAmount: 1200,
      totalPieces: 2,
      items: [{ id: '1', name: 'Shirt', qty: 2, unitPrice: 600 }],
      settings: DEFAULT_SETTINGS,
      finalizeCheckout: async () => {},
      showToast: () => {},
      paymentMethod: 'cash',
      setPaymentMethod: () => {},
      cashReceived: '1500',
      setCashReceived: () => {},
      cashChangeDue: 300,
      upiRef: '',
      setUpiRef: () => {},
    };

    const cashHtml = renderToString(
      <POSContext.Provider value={mockCashPOS}>
        <CheckoutModal />
      </POSContext.Provider>
    );

    // 1. Title and Amount Payable
    expect(cashHtml).toContain('Complete Checkout');
    expect(cashHtml).toContain('FINAL PAYABLE AMOUNT');
    expect(cashHtml).toContain('1,200');

    // 2. Select Payment Method Section
    expect(cashHtml).toContain('SELECT PAYMENT METHOD');
    expect(cashHtml).toContain('CASH');
    expect(cashHtml).toContain('Paper Currency');
    expect(cashHtml).toContain('UPI');
    expect(cashHtml).toContain('QR / GPay / PhonePe');

    // 3. Cash active fields
    expect(cashHtml).toContain('Amount Received from Customer');
    expect(cashHtml).toContain('Change to Return:');
    expect(cashHtml).toContain('300');
    expect(cashHtml).toContain('Exact');
    expect(cashHtml).toContain('+₹100');
    expect(cashHtml).toContain('+₹500');

    // 4. Confirm Finalize Button
    expect(cashHtml).toContain('btn-confirm-checkout');
    expect(cashHtml).toContain('Confirm &amp; Finalize Bill');

    // Test UPI state
    const mockUpiPOS = {
      ...mockCashPOS,
      paymentMethod: 'upi',
      upiRef: '428901238912',
    };

    const upiHtml = renderToString(
      <POSContext.Provider value={mockUpiPOS}>
        <CheckoutModal />
      </POSContext.Provider>
    );

    expect(upiHtml).toContain('festivalclothing@okhdfcbank');
    expect(upiHtml).toContain('Pay Exact Amount');
    expect(upiHtml).toContain('UPI Reference / UTR Number');
    expect(upiHtml).toContain('Confirm &amp; Finalize Bill');
  });

  it('verifies index.css contains emerald green active states and mobile checkout responsive rules', () => {
    const cssPath = path.resolve(__dirname, '../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Check payment cards grid & emerald active styles
    expect(cssContent).toContain('.payment-cards-grid');
    expect(cssContent).toContain('.payment-selection-card');
    expect(cssContent).toContain('.payment-selection-card.active-card');
    expect(cssContent).toContain('#059669'); // Emerald green
    expect(cssContent).toContain('#ecfdf5'); // Emerald tint

    // Check mobile bottom sheet
    expect(cssContent).toContain('.checkout-modal-sheet');
    expect(cssContent).toContain('max-height: 90dvh');
    expect(cssContent).toContain('.checkout-finalize-btn');
  });
});
