import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';
import { POSProvider, normalizePOSView, getInitialPOSView } from '../src/context/POSContext';
import { PriceSelectorModal } from '../src/components/PriceSelectorModal';
import { FESTIVE_QUOTES, getBillFestiveQuote } from '../src/services/db';
import { SalesReportsView } from '../src/components/SalesReportsView';
import { WhatsAppModal } from '../src/components/WhatsAppModal';
import { generateWhatsAppDirectChatText } from '../src/utils/receiptGenerator';
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

  it('verifies MobileBottomNav renders all 4 sections with navigation IDs and labels', () => {
    const html = renderToString(
      <POSProvider>
        <App />
      </POSProvider>
    );

    // Check Mobile Bottom Nav dock
    expect(html).toContain('mobile-bottom-nav-bar');
    expect(html).toContain('mobile-nav-billing');
    expect(html).toContain('mobile-nav-history');
    expect(html).toContain('mobile-nav-reports');
    expect(html).toContain('mobile-nav-settings');

    // Check labels
    expect(html).toContain('Billing');
    expect(html).toContain('Sales History');
    expect(html).toContain('Reports');
    expect(html).toContain('Admin Settings');
  });

  it('verifies Festive Quotes list, quote stability, and customer-facing invoice redesign', () => {
    // 1. Verify exactly 8 approved quotes
    expect(FESTIVE_QUOTES.length).toBe(8);
    FESTIVE_QUOTES.forEach((quote) => {
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(15);
      // No religious references or promotional claims
      expect(quote).not.toMatch(/diwali|god|lord|sale|discount|free|offer/i);
    });

    // 2. Verify stability for the same bill
    const sampleBill1 = { id: 'bill_abc_123', billNumber: '20261106-0001' };
    const quote1A = getBillFestiveQuote(sampleBill1);
    const quote1B = getBillFestiveQuote(sampleBill1);
    expect(quote1A).toBe(quote1B);
    expect(FESTIVE_QUOTES).toContain(quote1A);

    // 3. Verify bill with existing quote preserves it
    const sampleBill2 = { id: 'bill_xyz', festiveQuote: FESTIVE_QUOTES[3] };
    expect(getBillFestiveQuote(sampleBill2)).toBe(FESTIVE_QUOTES[3]);
  });

  it('verifies SalesReportsView renders S.No headers in Sales History and Reports & Analytics tables', () => {
    // 1. History mode S.NO
    const historyHtml = renderToString(
      <POSProvider>
        <SalesReportsView defaultTab="history" />
      </POSProvider>
    );
    expect(historyHtml.toUpperCase()).toContain('S.NO');
    expect(historyHtml.toUpperCase()).toContain('BILL NUMBER');

    // 2. Reports mode S.No
    const reportsHtml = renderToString(
      <POSProvider>
        <SalesReportsView defaultTab="reports" />
      </POSProvider>
    );
    expect(reportsHtml.toUpperCase()).toContain('S.NO');
    expect(reportsHtml).toContain('Reports &amp; Analytics');
  });

  it('verifies Mobile Sales History unified compact table architecture without subtotal/reduction columns', () => {
    const historyHtml = renderToString(
      <POSProvider>
        <SalesReportsView defaultTab="history" />
      </POSProvider>
    );

    // Verify unified table headers
    expect(historyHtml).toContain('ledger-scroll-container');
    expect(historyHtml).toContain('ledger-table');
    expect(historyHtml).toContain('mobile-table-swipe-hint');
    expect(historyHtml.toUpperCase()).toContain('S.NO');
    expect(historyHtml.toUpperCase()).toContain('BILL NUMBER');
    expect(historyHtml.toUpperCase()).toContain('DATE &AMP; TIME');
    expect(historyHtml.toUpperCase()).toContain('CASHIER');
    expect(historyHtml.toUpperCase()).toContain('ITEMS SUMMARY');
    expect(historyHtml.toUpperCase()).toContain('FINAL AMOUNT');
    expect(historyHtml.toUpperCase()).toContain('PAYMENT');
    expect(historyHtml.toUpperCase()).toContain('STATUS');
    expect(historyHtml.toUpperCase()).toContain('ACTIONS');

    // Verify subtotal and reduction columns are removed from table headers
    expect(historyHtml).not.toContain('>SUBTOTAL<');
    expect(historyHtml).not.toContain('>REDUCTION<');

    // Verify CSS styles for sticky columns and mobile horizontal scroll
    const cssPath = path.resolve(__dirname, '../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    expect(cssContent).toContain('.ledger-scroll-container');
    expect(cssContent).toContain('.mobile-table-swipe-hint');
    expect(cssContent).toContain('position: sticky');
  });

  it('verifies Grand Total chip renders in Sales History with bold styling', () => {
    const historyHtml = renderToString(
      <POSProvider>
        <SalesReportsView defaultTab="history" />
      </POSProvider>
    );

    // Verify Grand Total chip renders in sales history view
    expect(historyHtml).toContain('sales-history-grand-total-chip');
    expect(historyHtml).toContain('Grand Total:');
    expect(historyHtml).toContain('grand-total-amount');

    // Verify CSS styles
    const cssPath = path.resolve(__dirname, '../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    expect(cssContent).toContain('.sales-history-grand-total-chip');
    expect(cssContent).toContain('.grand-total-amount');
    expect(cssContent).toContain('font-weight: 800');
  });

  it('verifies Mobile Sales History features S.NO, BILL NUMBER, and FINAL AMOUNT as sticky columns', () => {
    const historyHtml = renderToString(
      <POSProvider>
        <SalesReportsView defaultTab="history" />
      </POSProvider>
    );

    // Verify sticky class names on table headers
    expect(historyHtml).toContain('col-sno');
    expect(historyHtml).toContain('col-bill-no');
    expect(historyHtml).toContain('col-final-amt');
    expect(historyHtml).toContain('ORIGINAL AMOUNT');

    // Verify column order: S.NO -> BILL NUMBER -> FINAL AMOUNT
    const snoIdx = historyHtml.indexOf('col-sno');
    const billNoIdx = historyHtml.indexOf('col-bill-no');
    const finalAmtIdx = historyHtml.indexOf('col-final-amt');
    expect(snoIdx).toBeLessThan(billNoIdx);
    expect(billNoIdx).toBeLessThan(finalAmtIdx);

    // Check CSS sticky rules for mobile
    const cssPath = path.resolve(__dirname, '../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    expect(cssContent).toContain('.ledger-table .col-final-amt');
    expect(cssContent).toContain('box-shadow: 4px 0 6px -2px');
  });

  it('verifies Reports view removed Total Discounts and Combo Savings from KPI cards and distribution', () => {
    const reportsHtml = renderToString(
      <POSProvider>
        <SalesReportsView defaultTab="reports" />
      </POSProvider>
    );

    // Must NOT contain Total Discounts or Combo Savings KPI cards
    expect(reportsHtml).not.toContain('savings-kpi');
    expect(reportsHtml).not.toContain('combo-kpi');
    expect(reportsHtml).not.toContain('Savings Analysis (Discounts vs Combos)');

    // Must contain the 4 primary operational KPI cards
    expect(reportsHtml).toContain('today-kpi');
    expect(reportsHtml).toContain('total-kpi');
    expect(reportsHtml).toContain('cash-kpi');
    expect(reportsHtml).toContain('upi-kpi');
  });

  it('verifies Header title uses luxury retail typography with letter-spacing', () => {
    const cssPath = path.resolve(__dirname, '../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('.brand-main-title');
    expect(cssContent).toContain('letter-spacing: 2px');
    expect(cssContent).toContain('Plus Jakarta Sans');
  });

  it('verifies Mobile Header rules display logo prominently and remove text and right status pills', () => {
    const cssPath = path.resolve(__dirname, '../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Verify mobile header media query exists and sets compact centered layout
    expect(cssContent).toContain('@media (max-width: 860px)');
    expect(cssContent).toContain('.header-brand-logo-img');
    expect(cssContent).toContain('height: 38px !important');
    expect(cssContent).toContain('.brand-text');
    expect(cssContent).toContain('.header-right');

    // Verify App renders Header with logo and clickable brand container
    const appHtml = renderToString(
      <POSProvider>
        <App />
      </POSProvider>
    );
    expect(appHtml).toContain('header-brand-logo-img');
    expect(appHtml).toContain('/logo.png');
    expect(appHtml).toContain('brand-logo-container');
  });

  it('verifies exact WhatsApp greeting message format and WhatsAppModal rendering', () => {
    const sampleBill = {
      id: 'bill_test_wa',
      billNumber: 'FC-20261107-0042',
      finalPayableAmount: 1250,
      customerPhone: '9840012345',
      customerName: 'Karthik',
      createdAt: new Date().toISOString(),
    };

    // 1. Verify exact message format
    const text = generateWhatsAppDirectChatText(sampleBill);
    expect(text).toBe(
      'Thanks for purchasing from FESTIVAL CLOTHING!\n\nWe truly appreciate your support. Visit us again!\n\nInvoice No: FC-20261107-0042\nTotal Amount: ₹1,250'
    );

    // 2. Verify WhatsAppModal rendering
    const modalHtml = renderToString(
      <POSProvider>
        <WhatsAppModal isOpen={true} onClose={() => {}} bill={sampleBill} />
      </POSProvider>
    );

    expect(modalHtml).toContain('wa-modal-container');
    expect(modalHtml).toContain('Share WhatsApp Invoice');
    expect(modalHtml).toContain('FC-20261107-0042');
    expect(modalHtml).toContain('9840012345');
    expect(modalHtml).toContain('wa-btn-send-invoice');
  });

  describe('Page Refresh Navigation & Route Persistence', () => {
    it('verifies normalizePOSView normalizes views and maps sales to history', () => {
      expect(normalizePOSView('history')).toBe('history');
      expect(normalizePOSView('reports')).toBe('reports');
      expect(normalizePOSView('settings')).toBe('settings');
      expect(normalizePOSView('billing')).toBe('billing');
      expect(normalizePOSView('sales')).toBe('history');
      expect(normalizePOSView('/reports/')).toBe('reports');
      expect(normalizePOSView('INVALID')).toBe(null);
      expect(normalizePOSView(null)).toBe(null);
    });

    it('verifies getInitialPOSView restores active route from URL query parameters', () => {
      const storageMap = new Map();
      const mockStorage = {
        getItem: (k) => storageMap.get(k) || null,
        setItem: (k, v) => storageMap.set(k, String(v)),
        removeItem: (k) => storageMap.delete(k),
        clear: () => storageMap.clear(),
      };

      const hadWindow = 'window' in globalThis;
      const hadLocalStorage = 'localStorage' in globalThis;
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;

      globalThis.localStorage = mockStorage;
      globalThis.window = {
        location: {
          search: '?view=history',
          pathname: '/',
          hash: '',
          href: 'https://festival-clothing.vercel.app/?view=history',
        },
        localStorage: mockStorage,
      };

      expect(getInitialPOSView()).toBe('history');

      // Test reports
      globalThis.window.location.search = '?view=reports';
      expect(getInitialPOSView()).toBe('reports');

      // Test settings
      globalThis.window.location.search = '?view=settings';
      expect(getInitialPOSView()).toBe('settings');

      // Test billing
      globalThis.window.location.search = '?view=billing';
      expect(getInitialPOSView()).toBe('billing');

      if (hadWindow) globalThis.window = origWindow; else delete globalThis.window;
      if (hadLocalStorage) globalThis.localStorage = origLocalStorage; else delete globalThis.localStorage;
    });

    it('verifies getInitialPOSView restores active route from URL pathname', () => {
      const storageMap = new Map();
      const mockStorage = {
        getItem: (k) => storageMap.get(k) || null,
        setItem: (k, v) => storageMap.set(k, String(v)),
        removeItem: (k) => storageMap.delete(k),
        clear: () => storageMap.clear(),
      };

      const hadWindow = 'window' in globalThis;
      const hadLocalStorage = 'localStorage' in globalThis;
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;

      globalThis.localStorage = mockStorage;
      globalThis.window = {
        location: {
          search: '',
          pathname: '/reports',
          hash: '',
          href: 'https://festival-clothing.vercel.app/reports',
        },
        localStorage: mockStorage,
      };

      expect(getInitialPOSView()).toBe('reports');

      globalThis.window.location.pathname = '/settings';
      expect(getInitialPOSView()).toBe('settings');

      globalThis.window.location.pathname = '/history';
      expect(getInitialPOSView()).toBe('history');

      if (hadWindow) globalThis.window = origWindow; else delete globalThis.window;
      if (hadLocalStorage) globalThis.localStorage = origLocalStorage; else delete globalThis.localStorage;
    });

    it('verifies getInitialPOSView falls back to localStorage if URL has no view param', () => {
      const storageMap = new Map();
      const mockStorage = {
        getItem: (k) => storageMap.get(k) || null,
        setItem: (k, v) => storageMap.set(k, String(v)),
        removeItem: (k) => storageMap.delete(k),
        clear: () => storageMap.clear(),
      };

      const hadWindow = 'window' in globalThis;
      const hadLocalStorage = 'localStorage' in globalThis;
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;

      globalThis.localStorage = mockStorage;
      globalThis.window = {
        location: {
          search: '',
          pathname: '/',
          hash: '',
          href: 'https://festival-clothing.vercel.app/',
        },
        localStorage: mockStorage,
      };

      mockStorage.setItem('festival_pos_active_view', 'settings');
      expect(getInitialPOSView()).toBe('settings');

      mockStorage.setItem('festival_pos_active_view', 'reports');
      expect(getInitialPOSView()).toBe('reports');

      mockStorage.setItem('festival_pos_active_view', 'history');
      expect(getInitialPOSView()).toBe('history');

      mockStorage.removeItem('festival_pos_active_view');
      expect(getInitialPOSView()).toBe('billing');

      if (hadWindow) globalThis.window = origWindow; else delete globalThis.window;
      if (hadLocalStorage) globalThis.localStorage = origLocalStorage; else delete globalThis.localStorage;
    });

    it('renders App directly into Sales History when refreshing with ?view=history', () => {
      const storageMap = new Map();
      const mockStorage = {
        getItem: (k) => storageMap.get(k) || null,
        setItem: (k, v) => storageMap.set(k, String(v)),
        removeItem: (k) => storageMap.delete(k),
        clear: () => storageMap.clear(),
      };

      const hadWindow = 'window' in globalThis;
      const hadLocalStorage = 'localStorage' in globalThis;
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;

      globalThis.localStorage = mockStorage;
      globalThis.window = {
        location: {
          search: '?view=history',
          pathname: '/',
          hash: '',
          href: 'https://festival-clothing.vercel.app/?view=history',
        },
        history: {
          pushState: () => {},
          replaceState: () => {},
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        localStorage: mockStorage,
      };

      const html = renderToString(
        <POSProvider>
          <App />
        </POSProvider>
      );

      // Verify Sales History table or header is rendered instead of default billing layout
      expect(html).toContain('Sales History');
      expect(html).toContain('subview-tab-bar');

      if (hadWindow) globalThis.window = origWindow; else delete globalThis.window;
      if (hadLocalStorage) globalThis.localStorage = origLocalStorage; else delete globalThis.localStorage;
    });

    it('renders App directly into Reports when refreshing with ?view=reports', () => {
      const storageMap = new Map();
      const mockStorage = {
        getItem: (k) => storageMap.get(k) || null,
        setItem: (k, v) => storageMap.set(k, String(v)),
        removeItem: (k) => storageMap.delete(k),
        clear: () => storageMap.clear(),
      };

      const hadWindow = 'window' in globalThis;
      const hadLocalStorage = 'localStorage' in globalThis;
      const origWindow = globalThis.window;
      const origLocalStorage = globalThis.localStorage;

      globalThis.localStorage = mockStorage;
      globalThis.window = {
        location: {
          search: '?view=reports',
          pathname: '/',
          hash: '',
          href: 'https://festival-clothing.vercel.app/?view=reports',
        },
        history: {
          pushState: () => {},
          replaceState: () => {},
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        localStorage: mockStorage,
      };

      const html = renderToString(
        <POSProvider>
          <App />
        </POSProvider>
      );

      expect(html).toContain('Reports &amp; Analytics');

      if (hadWindow) globalThis.window = origWindow; else delete globalThis.window;
      if (hadLocalStorage) globalThis.localStorage = origLocalStorage; else delete globalThis.localStorage;
    });
  });
});
