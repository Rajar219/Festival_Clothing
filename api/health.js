// FESTIVAL CLOTHING POS - Simple Diwali Edition
// Health Check Endpoint for Vercel
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'healthy',
    app: 'FESTIVAL CLOTHING POS',
    edition: 'Simple Diwali Edition',
    architecture: {
      hosting: 'Vercel',
      frontend: 'React + Vite SPA',
      localStorage: 'IndexedDB (WisdoFestivalPOS_DB)',
      cloudStorage: 'Google Drive API (Restricted drive.file OAuth 2.0)',
      invoiceSharing: 'WhatsApp Web & Native Web Share API',
      multiDevice: 'Independent Local PC & Mobile Ledgers',
    },
    branding: 'WISDO TECH (wisdotech.in)',
    attribution: 'Powered by WISDO TECH',
    timestamp: new Date().toISOString(),
  });
}
