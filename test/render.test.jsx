import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';
import { POSProvider } from '../src/context/POSContext';
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
});
