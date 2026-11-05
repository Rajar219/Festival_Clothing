# FESTIVAL CLOTHING — RETAIL POS (SIMPLE DIWALI EDITION)
### Powered by WISDO TECH ([wisdotech.in](https://wisdotech.in))
**Architecture: Vercel + Browser IndexedDB + Google Drive API + WhatsApp Sharing**

A fast, resilient, standalone retail Point of Sale (POS) billing system customized for **FESTIVAL CLOTHING (MENSWEAR)** for high-volume Diwali festival counter sales.

---

## 🏗️ Architecture & Philosophy

- **Hosting:** Vercel (Edge CDN, HTTPS, Single-Page App with `/api/health` health check).
- **Frontend:** React 19 + Vite 6 + Installable Progressive Web App (PWA).
- **Authoritative Local Storage:** Browser **IndexedDB** (`WisdoFestivalPOS_DB`). Fast, zero-latency, works 100% offline.
- **Cloud Document Archiving:** **Google Drive API (Manual Save Only)** using Google OAuth 2.0 with restricted file-level scope (`https://www.googleapis.com/auth/drive.file`). No automatic or background uploads.
- **Product Catalogue:** 6 core menswear apparel categories (Shirt, Pant / Trousers, T-Shirt, Half Sleeve Shirt, Full Sleeve Shirt, Shorts) with professional photography on clothing hangers against pure white backgrounds. Other/custom items removed.
- **Offer Pricing & Configurable Reductions:** Supports optional offer prices, store-wide and item-level reduction limits, and cashier permission controls.
- **Invoice Sharing:** One prominent **SEND WHATSAPP INVOICE** action for standard (non-business) WhatsApp accounts:
  - **PC:** Opens WhatsApp Web with prefilled message and downloads the PDF invoice ready for 1-click attachment.
  - **Mobile:** Uses native Web Share API with file attachment directly to WhatsApp.
- **Multi-Device Model:** **Independent Local Sales Records**. PC and Mobile maintain separate local databases. Finalized PDF invoices, daily JSON backups, and CSV sales ledgers automatically archive to their respective folders in the shop's Google Drive.
- **No Complex External Database:** No Supabase, PostgreSQL, or backend database subscription required.

---

## 📁 Google Drive Cloud Document Structure

Once authorized via the administrator-controlled **Connect Google Drive** button in Admin Settings, the system automatically creates and identifies the following folder hierarchy:

```
FESTIVAL CLOTHING POS/
  ├── PC BILLING/        (PDF Invoices generated on the shop counter PC)
  ├── MOBILE BILLING/    (PDF Invoices generated on sales floor mobile devices)
  ├── DAILY BACKUPS/     (Daily full JSON database snapshots)
  └── SALES REPORTS/     (CSV sales ledgers for Excel & Python Pandas)
```

### Key Safety & Reliability Features
- **Manual Save Only (Zero Background Uploads):** Invoices, daily backups, and CSV ledgers are **never** uploaded automatically or silently in the background. The user explicitly clicks **"Save to Google Drive"** and can select `PC BILLING` or `MOBILE BILLING`.
- **Duplicate Prevention:** Before upload, checks for existing files with the same bill number and date.
- **Local Persistence:** Drive file IDs and web view links are saved locally inside IndexedDB.
- **Non-Destructive Failures:** Local bills are **never deleted or blocked** if Google Drive upload encounters network issues. An **Upload Failed / Retry** button is always available.
- **Restricted Scope:** Uses strictly `drive.file` scope — the app cannot see or modify any personal files in your Google Drive outside the files it creates.

---

## 🛠️ Google Cloud Console Setup Guide

Follow these steps to obtain your Google OAuth 2.0 Web Client ID:

### Step 1: Create Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** > **New Project**.
3. Name it **`Festival-Clothing-POS`** and click **Create**.

### Step 2: Enable Google Drive API
1. In the left navigation, go to **APIs & Services** > **Library**.
2. Search for **`Google Drive API`**.
3. Click on **Google Drive API** and click **Enable**.

### Step 3: Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** and click **Create**.
3. Fill in:
   - **App name:** `FESTIVAL CLOTHING POS`
   - **User support email:** Your email address
   - **Developer contact information:** Your email address
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**:
   - Manually add or select: `https://www.googleapis.com/auth/drive.file`
   - Description: *See, edit, create, and delete only the specific Google Drive files you use with this app*.
6. Click **Save and Continue**.
7. Under **Test Users**, add the Google email account(s) you will use at the store.
8. Click **Save and Continue**.

### Step 4: Create OAuth 2.0 Web Client ID
1. Go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** > **OAuth client ID**.
3. Choose **Application type:** `Web application`.
4. Name: `Festival POS Web Client`.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (for local development)
   - `https://your-pos-domain.vercel.app` (your Vercel production URL)
6. Click **Create**.
7. Copy the generated **Client ID** (format: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`).
   *(Note: Client Secret is not needed or used in the browser).*

### Step 5: Configure Client ID
Either:
- Add to `.env` as `VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`
- Or paste it directly in **Admin Settings** > **Google Drive Cloud Document Storage** in the running app!

---

## 🚀 Vercel Deployment Guide

### Deploy via Vercel Dashboard
1. Push this repository to GitHub / GitLab / Bitbucket.
2. In [Vercel](https://vercel.com/), click **Add New...** > **Project**.
3. Select this repository.
4. **Framework Preset:** Vite (automatically detected).
5. **Build Command:** `vite build`
6. **Output Directory:** `dist`
7. Under **Environment Variables**, add:
   - `VITE_GOOGLE_CLIENT_ID` = `your-client-id.apps.googleusercontent.com`
8. Click **Deploy**.
9. Once deployed, copy your production Vercel URL (e.g. `https://festival-clothing-pos.vercel.app`) and add it to **Authorized JavaScript origins** in Google Cloud Console Credentials.

### Vercel Routing Configuration (`vercel.json`)
The included `vercel.json` provides:
- Single-page application fallback routing to `/index.html`.
- Preserved `/api/health` serverless endpoint for uptime monitoring.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`).
- PWA manifest and service worker cache headers.

---

## 📱 Mobile PWA & Terminal Registration

### Registering Terminal (PC vs Mobile)
In **Admin Settings** (PIN: `1234`), choose:
- **PC Terminal (Main Cash Counter):** Invoices archive into `FESTIVAL CLOTHING POS / PC BILLING`.
- **Mobile Terminal (Sales Floor Handheld):** Invoices archive into `FESTIVAL CLOTHING POS / MOBILE BILLING`.

### Installing as a Mobile App (PWA)
- **Android (Chrome):** Open your Vercel URL, tap the 3 dots menu > **Install app** or **Add to Home screen**.
- **iOS (Safari):** Open your Vercel URL, tap the Share icon > **Add to Home Screen**.
- The app launches full-screen with offline caching of all static assets via the built-in Service Worker.

---

## 💬 WhatsApp Invoice Sharing Workflow

1. Finalize the bill using **Cash** or **UPI**.
2. Click the prominent **SEND WHATSAPP INVOICE** button.
3. Enter the customer's 10-digit Indian mobile number (no registration required).
4. **On PC:**
   - WhatsApp Web opens in a new tab with the prefilled message.
   - The official A4 PDF tax invoice downloads automatically.
   - Cashier clicks 📎 **Attachment** > **Document** in WhatsApp Web, attaches the invoice, and clicks **Send**.
5. **On Mobile:**
   - Automatically opens the native OS Share Sheet with the PDF invoice attached directly.
   - Cashier taps WhatsApp > Customer contact > Send.
6. Cashier clicks **Done / Next Bill (Enter)** to immediately serve the next customer.

---

## ⚠️ Critical Local Data Safety Notice

Because this Simple Diwali Edition uses browser **IndexedDB** for maximum counter speed and offline independence:
- Transaction records are stored **locally inside the browser** on that specific device.
- **Clearing browser cookies/site data, browsing in incognito mode, uninstalling the browser, or hardware failure will erase local transaction records.**
- **Protection Rules:**
  1. Keep **Google Drive connected** so all invoice PDFs are archived to the cloud automatically.
  2. At the end of every business day, the Administrator should click **Export System Backup (JSON)** in Settings and download the backup file (or click **Upload Daily Backup to Drive**).
  3. The system includes **Duplicate-Safe Restore**: importing a backup file skips existing bills and never double-counts totals.

---

## 🧪 Testing & Verification

Run the full automated test suite:
```bash
npm test
```

### Verified Test Cases (22 Passing Tests):
1. Item-level ₹10 Less calculations (Shirt ₹550 ➔ ₹540, Pant ₹750 ➔ ₹740).
2. Multiple item reductions on same bill (Shirt + Pant = ₹20 reduction, ₹1280 grand total).
3. Quantity multiplier: Qty 2 with ₹10 Less reduces unit price by ₹10 and line total by ₹20.
4. Undo & Reset Price restore catalog prices.
5. Lower bound protection: price cannot reduce below ₹0.
6. Integer paise calculations avoiding floating point rounding errors.
7. Bill sequence generation (`FC-YYYYMMDD-001`).
8. Idempotency & duplicate submission locking.
9. Historical bill price immutability when catalog price changes later.
10. Cash vs UPI payment separation and change return math.
11. Item-level sales CSV export for Excel & Python Pandas.
12. Bills summary CSV export avoiding double-counted totals.
13. Full JSON system backup and duplicate-safe restore.
14. Indian mobile number format validation.
15. Administrator authorization on bill cancellation and deletion.
16. Mobile cart item-level reduction isolation.
17. Google Drive folder hierarchy (`FESTIVAL CLOTHING POS/`, `PC BILLING/`, `MOBILE BILLING/`, `DAILY BACKUPS/`, `SALES REPORTS/`).
18. WhatsApp Web & Mobile share URL and receipt text formatting.
19. Component string rendering & WISDO TECH attribution.
20. Responsive viewport meta tags and mobile CSS breakpoints (320px, 360px, 640px, 768px, 1024px).
21. PWA manifest structure, standalone display, and theme color.
22. Service worker caching and Vercel routing configuration.

---

## ⌨️ Retail Keyboard Shortcuts
- <kbd>1</kbd> to <kbd>7</kbd> — Add catalog item to active bill
- <kbd>Alt</kbd> + <kbd>C</kbd> — Open Checkout Dialog
- <kbd>F2</kbd> / <kbd>Alt</kbd> + <kbd>N</kbd> — Start New Bill
- <kbd>Alt</kbd> + <kbd>P</kbd> — Reprint last receipt
- <kbd>Enter</kbd> (on Success Screen) — Immediately start next bill
- <kbd>Esc</kbd> — Close active modal dialog

---

## 🔒 Security & Admin Access
- **Cashier Mode:** Unrestricted high-speed counter billing, no PIN needed.
- **Administrator PIN:** `1234` (or `admin`) unlocks Product Pricing, Shop Configuration, Google Drive Setup, and Backups.
- **Official Attribution:** Permanently attributed to **WISDO TECH ([wisdotech.in](https://wisdotech.in))**.
