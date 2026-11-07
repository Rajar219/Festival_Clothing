import { openDB } from 'idb';
import { generateBillNumber, rupeesToPaise, paiseToRupees } from '../utils/currency.js';
import { DEFAULT_COMBOS } from '../utils/comboEngine.js';
import { getTerminalId, getTerminalType } from './terminal.js';

const DB_NAME = 'WisdoFestivalPOS_DB';
const DB_VERSION = 2;

// Permanent Immutable company attribution
export const COMPANY_BRANDING = {
  companyName: 'WISDO TECH (wisdotech.in)',
  attributionText: 'Powered by WISDO TECH',
  portalUrl: 'https://wisdotech.in',
};

// Initial default products - Strictly the 11 menswear product categories
export const INITIAL_PRODUCTS = [
  {
    id: 'prod_shirts',
    name: 'Shirts',
    shortcut: '1',
    defaultPrice: 600,
    offers: [550, 500],
    offerPrice: 550,
    allowCustomPrice: true,
    reductionEnabled: true,
    maxReductionPerUnit: 150,
    isActive: true,
    sortOrder: 1,
    icon: 'Shirt',
    image: '/products/shirt.jpg',
    piecesPerUnit: 1,
  },
  {
    id: 'prod_3_shirts_combo',
    name: '3 Shirts Combo',
    shortcut: '2',
    defaultPrice: 1000,
    offers: [],
    offerPrice: null,
    allowCustomPrice: false,
    reductionEnabled: false,
    maxReductionPerUnit: 0,
    isActive: true,
    sortOrder: 2,
    icon: 'ComboShirt',
    image: '/products/three_shirts_combo.jpg',
    isCombo: true,
    piecesPerUnit: 3,
    pieceUnitName: 'Shirts',
    regularPricePerUnit: 600,
    originalCombinedValue: 1800,
    comboSavingsPerUnit: 800,
    avgPricePerPiece: 333.33,
  },
  {
    id: 'prod_formal_pants',
    name: 'Formal Pants',
    shortcut: '3',
    defaultPrice: 650,
    offers: [],
    offerPrice: null,
    allowCustomPrice: true,
    reductionEnabled: true,
    maxReductionPerUnit: 150,
    isActive: true,
    sortOrder: 3,
    icon: 'Pant',
    image: '/products/pant.jpg',
    piecesPerUnit: 1,
  },
  {
    id: 'prod_jeans',
    name: 'Jeans',
    shortcut: '4',
    defaultPrice: 750,
    offers: [],
    offerPrice: null,
    allowCustomPrice: true,
    reductionEnabled: true,
    maxReductionPerUnit: 200,
    isActive: true,
    sortOrder: 4,
    icon: 'Jeans',
    image: '/products/jeans.jpg',
    piecesPerUnit: 1,
  },
  {
    id: 'prod_tshirt_half',
    name: 'T-Shirt',
    shortcut: '5',
    defaultPrice: 500,
    offers: [450],
    offerPrice: 450,
    allowCustomPrice: true,
    reductionEnabled: true,
    maxReductionPerUnit: 150,
    isActive: true,
    sortOrder: 5,
    icon: 'HalfSleeve',
    image: '/products/half_sleeve.jpg',
    piecesPerUnit: 1,
  },
  {
    id: 'prod_tshirt_full',
    name: 'Full Sleeve T-Shirt',
    shortcut: '6',
    defaultPrice: 550,
    offers: [500],
    offerPrice: 500,
    allowCustomPrice: true,
    reductionEnabled: true,
    maxReductionPerUnit: 150,
    isActive: true,
    sortOrder: 6,
    icon: 'FullSleeve',
    image: '/products/full_sleeve.jpg',
    piecesPerUnit: 1,
  },
  {
    id: 'prod_tracks_jersey',
    name: 'Tracks Jersey',
    shortcut: '7',
    defaultPrice: 450,
    offers: [],
    offerPrice: null,
    allowCustomPrice: true,
    reductionEnabled: true,
    maxReductionPerUnit: 100,
    isActive: true,
    sortOrder: 7,
    icon: 'Tracks',
    image: '/products/tracks_jersey.jpg',
    piecesPerUnit: 1,
  },
  {
    id: 'prod_shorts_jersey',
    name: 'Shorts Jersey',
    shortcut: '8',
    defaultPrice: 350,
    offers: [],
    offerPrice: null,
    allowCustomPrice: true,
    reductionEnabled: true,
    maxReductionPerUnit: 100,
    isActive: true,
    sortOrder: 8,
    icon: 'Shorts',
    image: '/products/shorts_jersey_single.jpg',
    piecesPerUnit: 1,
  },
  {
    id: 'prod_2_shorts_combo',
    name: '2 Shorts Jersey Combo',
    shortcut: '9',
    defaultPrice: 600,
    offers: [],
    offerPrice: null,
    allowCustomPrice: false,
    reductionEnabled: false,
    maxReductionPerUnit: 0,
    isActive: true,
    sortOrder: 9,
    icon: 'ComboShorts',
    image: '/products/two_shorts_combo.jpg',
    isCombo: true,
    piecesPerUnit: 2,
    pieceUnitName: 'Shorts Jersey',
    regularPricePerUnit: 350,
    originalCombinedValue: 700,
    comboSavingsPerUnit: 100,
    avgPricePerPiece: 300.00,
  },
  {
    id: 'prod_jersey_tshirt',
    name: 'Jersey T-Shirt',
    shortcut: '0',
    defaultPrice: 420,
    offers: [],
    offerPrice: null,
    allowCustomPrice: true,
    reductionEnabled: true,
    maxReductionPerUnit: 100,
    isActive: true,
    sortOrder: 10,
    icon: 'JerseyTShirt',
    image: '/products/jersey_tshirt.jpg',
    piecesPerUnit: 1,
  },
  {
    id: 'prod_3_tshirts_combo',
    name: '3 T-Shirts Combo',
    shortcut: '',
    defaultPrice: 1200,
    offers: [],
    offerPrice: null,
    allowCustomPrice: false,
    reductionEnabled: false,
    maxReductionPerUnit: 0,
    isActive: true,
    sortOrder: 11,
    icon: 'ComboTShirt',
    image: '/products/three_tshirts_combo.jpg',
    isCombo: true,
    piecesPerUnit: 3,
    pieceUnitName: 'T-Shirts',
    regularPricePerUnit: 500,
    originalCombinedValue: 1500,
    comboSavingsPerUnit: 300,
    avgPricePerPiece: 400.00,
  },
  {
    id: 'prod_hoodies',
    name: 'Hoodies',
    shortcut: '',
    defaultPrice: 600,
    offers: [500],
    offerPrice: 500,
    allowCustomPrice: true,
    reductionEnabled: true,
    maxReductionPerUnit: 100,
    isActive: true,
    sortOrder: 12,
    icon: 'Hoodie',
    image: '/products/hoodie.jpg',
    piecesPerUnit: 1,
  },
];

export const FESTIVE_QUOTES = [
  "May your celebrations be filled with happiness, light and style.",
  "Celebrate every moment. Wear every memory.",
  "Wishing you joy, prosperity and beautiful celebrations.",
  "Let every celebration bring a new reason to smile.",
  "Style your celebrations. Celebrate your moments.",
  "May your festive season shine with happiness and success.",
  "Every celebration deserves a little extra style.",
  "Thank you for making us part of your special moments.",
];

export function getBillFestiveQuote(bill) {
  if (bill && bill.festiveQuote) return bill.festiveQuote;
  const seedStr = (bill && (bill.id || bill.billNumber)) || '';
  if (seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % FESTIVE_QUOTES.length;
    return FESTIVE_QUOTES[idx];
  }
  return FESTIVE_QUOTES[Math.floor(Math.random() * FESTIVE_QUOTES.length)];
}

export const DEFAULT_SETTINGS = {
  shopName: 'FESTIVAL CLOTHING',
  subtitle: 'MENSWEAR',
  address: 'No. 10/12, N.N. Garden, Old Washermenpet, Chennai - 21, Tamil Nadu.',
  phone: '',
  receiptFooter: 'Wishing you a Happy & Prosperous Celebration!',
  defaultPrintMode: 'thermal', // 'thermal' or 'a4'
  upiId: 'festivalclothing@okhdfcbank',
  autoPrintOnCheckout: false,
  deviceType: 'PC', // 'PC' or 'MOBILE' (Admin registered terminal designation)
  googleClientId: '1016904752396-hml53gmsol15v9rh6jes43sugq2n684p.apps.googleusercontent.com', // Google OAuth Client ID
  // Item-level reduction configuration
  allowItemReductions: true, // Store-wide toggle for item reductions
  reductionStepAmount: 10, // Amount in ₹ reduced per step (default ₹10)
  maxReductionsCount: 5, // Maximum number of reduction clicks per unit (default 5 = ₹50 max reduction)
  cashierCanReduce: true, // Whether cashiers can apply reductions (if false, only Admin can)
  combos: DEFAULT_COMBOS, // Configurable combo discounts
  companyName: COMPANY_BRANDING.companyName,
  attributionText: COMPANY_BRANDING.attributionText,
};

// Check if IndexedDB is supported by the browser
export function isStorageAvailable() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

// Open local-first IndexedDB instance
export async function getDB() {
  if (!isStorageAvailable()) {
    throw new Error('IndexedDB is not supported or is disabled in your browser.');
  }

  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('products')) {
        const prodStore = db.createObjectStore('products', { keyPath: 'id' });
        prodStore.createIndex('isActive', 'isActive');
        prodStore.createIndex('sortOrder', 'sortOrder');
      }

      if (!db.objectStoreNames.contains('bills')) {
        const billStore = db.createObjectStore('bills', { keyPath: 'id' });
        billStore.createIndex('billNumber', 'billNumber', { unique: true });
        billStore.createIndex('createdAt', 'createdAt');
        billStore.createIndex('status', 'status');
        billStore.createIndex('paymentMethod', 'paymentMethod');
      }

      if (!db.objectStoreNames.contains('auditLogs')) {
        const auditStore = db.createObjectStore('auditLogs', { keyPath: 'id' });
        auditStore.createIndex('timestamp', 'timestamp');
        auditStore.createIndex('action', 'action');
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });
}

// Seed initial data without overwriting existing entries
export async function seedInitialDataIfEmpty() {
  const db = await getDB();

  // 1. Purge unwanted 'Other / Custom Item' if previously seeded
  try {
    const customProd = await db.get('products', 'prod_custom_item');
    if (customProd) {
      await db.delete('products', 'prod_custom_item');
    }
  } catch (e) {
    console.warn('Custom item cleanup notice:', e);
  }

  try {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const existing = await store.getAll();
    const existingMap = new Map(existing.map((p) => [p.id, p]));

    // Legacy ID mapping to migrate smoothly
    const legacyMap = {
      prod_shirt: 'prod_shirts',
      prod_pant: 'prod_formal_pants',
      prod_half_sleeve_shirt: 'prod_tshirt_half',
      prod_full_sleeve_shirt: 'prod_tshirt_full',
      prod_shorts: 'prod_shorts_jersey',
    };

    // Remove obsolete IDs that don't belong to canonical 8 categories
    const canonicalIds = new Set(INITIAL_PRODUCTS.map((p) => p.id));
    for (const prod of existing) {
      if (prod.id === 'prod_custom_item' || prod.id === 'prod_tshirt') {
        await store.delete(prod.id);
      }
    }

    for (const initProd of INITIAL_PRODUCTS) {
      let matched = existingMap.get(initProd.id);
      if (!matched) {
        // Look up by legacy ID
        for (const [oldId, newId] of Object.entries(legacyMap)) {
          if (newId === initProd.id && existingMap.has(oldId)) {
            matched = existingMap.get(oldId);
            await store.delete(oldId);
            break;
          }
        }
      }

      if (matched) {
        await store.put({
          ...initProd,
          ...matched,
          id: initProd.id,
          name: initProd.name,
          shortcut: initProd.shortcut,
          image: initProd.image || matched.image,
          isCombo: initProd.isCombo,
          piecesPerUnit: initProd.piecesPerUnit,
          originalCombinedValue: initProd.originalCombinedValue,
          comboSavingsPerUnit: initProd.comboSavingsPerUnit,
          avgPricePerPiece: initProd.avgPricePerPiece,
          offers: initProd.offers !== undefined ? initProd.offers : (matched.offers || []),
          sortOrder: initProd.sortOrder,
          icon: initProd.icon,
        });
      } else {
        await store.put(initProd);
      }
    }
    await tx.done;
  } catch (e) {
    console.warn('Product catalogue synchronization notice:', e);
  }

  const storedSettings = await db.get('settings', 'shop_config');
  if (!storedSettings) {
    await db.put('settings', {
      key: 'shop_config',
      value: DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
  } else if (storedSettings.value) {
    // Merge any new default settings keys including combos
    const merged = {
      ...DEFAULT_SETTINGS,
      ...storedSettings.value,
      combos: storedSettings.value.combos || DEFAULT_COMBOS,
      companyName: COMPANY_BRANDING.companyName,
      attributionText: COMPANY_BRANDING.attributionText,
    };
    delete merged.gstin; // Strictly remove GST registration from local storage
    if (merged.address?.includes('Main Bazaar') || !merged.address) {
      merged.address = DEFAULT_SETTINGS.address;
    }
    if (merged.phone === '+91 98400 12345') {
      merged.phone = '';
    }
    await db.put('settings', {
      key: 'shop_config',
      value: merged,
      updatedAt: new Date().toISOString(),
    });
  }
}

// ----------------------------------------------------------------------------
// PRODUCT MANAGEMENT
// ----------------------------------------------------------------------------

export async function getAllProducts() {
  const db = await getDB();
  const products = await db.getAll('products');
  const validIds = new Set(INITIAL_PRODUCTS.map((p) => p.id));
  return products
    .filter((p) => validIds.has(p.id) && p.id !== 'prod_custom_item')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export async function updateProduct(productId, updates, userRole = 'cashier', userName = 'Admin') {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only an Administrator has permission to modify product prices and details.');
  }

  const db = await getDB();
  const product = await db.get('products', productId);
  if (!product) {
    throw new Error('Product not found.');
  }

  const oldPrice = product.defaultPrice;
  const newPrice = updates.defaultPrice !== undefined ? Math.max(0, parseFloat(updates.defaultPrice) || 0) : oldPrice;

  let newOfferPrice = product.offerPrice ?? null;
  if (updates.offerPrice !== undefined) {
    if (updates.offerPrice === '' || updates.offerPrice === null) {
      newOfferPrice = null;
    } else {
      const parsed = parseFloat(updates.offerPrice);
      newOfferPrice = !isNaN(parsed) && parsed >= 0 ? parsed : null;
    }
  }

  const updatedProduct = {
    ...product,
    ...updates,
    defaultPrice: newPrice,
    offerPrice: newOfferPrice,
    reductionEnabled: updates.reductionEnabled !== undefined ? Boolean(updates.reductionEnabled) : (product.reductionEnabled !== false),
    maxReductionPerUnit: updates.maxReductionPerUnit !== undefined ? Math.max(0, parseFloat(updates.maxReductionPerUnit) || 0) : (product.maxReductionPerUnit || 50),
    updatedAt: new Date().toISOString(),
  };

  await db.put('products', updatedProduct);

  await recordAuditLog({
    action: 'PRODUCT_UPDATED',
    userRole,
    userName,
    details: `Updated ${product.name}: Base ₹${newPrice}${newOfferPrice !== null ? ` (Offer: ₹${newOfferPrice})` : ''}`,
    targetId: productId,
  });

  return updatedProduct;
}

// ----------------------------------------------------------------------------
// SHOP SETTINGS MANAGEMENT
// ----------------------------------------------------------------------------

export async function getShopSettings() {
  const db = await getDB();
  const stored = await db.get('settings', 'shop_config');
  if (stored && stored.value) {
    return {
      ...DEFAULT_SETTINGS,
      ...stored.value,
      companyName: COMPANY_BRANDING.companyName,
      attributionText: COMPANY_BRANDING.attributionText,
    };
  }
  return DEFAULT_SETTINGS;
}

export async function saveShopSettings(newSettings, userRole = 'cashier', userName = 'Admin') {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only an Administrator has permission to update shop settings.');
  }

  const sanitized = {
    ...newSettings,
    companyName: COMPANY_BRANDING.companyName,
    attributionText: COMPANY_BRANDING.attributionText,
  };

  const db = await getDB();
  await db.put('settings', {
    key: 'shop_config',
    value: sanitized,
    updatedAt: new Date().toISOString(),
  });

  await recordAuditLog({
    action: 'SHOP_SETTINGS_UPDATED',
    userRole,
    userName,
    details: `Updated shop configuration for "${sanitized.shopName}"`,
    targetId: 'shop_config',
  });

  return sanitized;
}

// ----------------------------------------------------------------------------
// BILLING & TRANSACTIONS (ATOMIC & DUPLICATE-PROTECTED)
// ----------------------------------------------------------------------------

export async function getNextBillSequence() {
  const db = await getDB();
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `FC-${todayStr}-`;

  const allBills = await db.getAll('bills');
  const todayBills = allBills.filter(b => b.billNumber && b.billNumber.startsWith(prefix));

  if (todayBills.length === 0) return 1;

  let maxSeq = 0;
  for (const b of todayBills) {
    const parts = b.billNumber.split('-');
    if (parts.length === 3) {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  return maxSeq + 1;
}

export async function saveFinalizedBill(billData, userName = 'Cashier', userRole = 'cashier') {
  const db = await getDB();

  // Guard against duplicate bill number
  const existing = await db.getFromIndex('bills', 'billNumber', billData.billNumber);
  if (existing) {
    throw new Error(`Bill ${billData.billNumber} has already been saved. Duplicate bill creation prevented.`);
  }

  const terminalId = billData.terminalId || getTerminalId();
  const terminalType = billData.terminalType || getTerminalType();

  const bill = {
    ...billData,
    terminalId,
    terminalType,
    createdAt: billData.createdAt || new Date().toISOString(),
    status: 'completed',
    cashierName: userName,
    saveStatus: 'saved', // Safely saved locally in IndexedDB
    festiveQuote: billData.festiveQuote || getBillFestiveQuote(billData),
    syncStatus: billData.syncStatus || 'pending', // Queued for cross-device synchronization
    syncedAt: billData.syncedAt || null,
    pdfStatus: billData.pdfStatus || 'not_generated',
    whatsappStatus: billData.whatsappStatus || 'not_shared',
    driveUploadStatus: billData.driveUploadStatus || (billData.alsoUploadToDrive ? 'pending' : 'not_requested'),
  };

  // Atomic write transaction
  const tx = db.transaction(['bills', 'auditLogs'], 'readwrite');
  await tx.objectStore('bills').put(bill);

  const auditEntry = {
    id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    action: 'BILL_FINALIZED',
    userRole,
    userName,
    details: `Finalized bill ${bill.billNumber} for ₹${bill.finalPayableAmount} (${bill.paymentMethod.toUpperCase()}) on ${terminalType} terminal with ₹${bill.totalReduction || 0} in item reductions`,
    targetId: bill.id,
    timestamp: new Date().toISOString(),
  };
  await tx.objectStore('auditLogs').put(auditEntry);

  await tx.done;
  return bill;
}

/**
 * Updates status fields on an existing saved bill (e.g., whatsappStatus, pdfStatus, driveUploadStatus)
 * without re-creating or altering the original transaction snapshot.
 */
export async function updateBillStatus(billId, statusUpdates = {}) {
  const db = await getDB();
  const bill = await db.get('bills', billId);
  if (!bill) return null;

  const updatedBill = {
    ...bill,
    ...statusUpdates,
    updatedAt: new Date().toISOString(),
  };

  await db.put('bills', updatedBill);
  return updatedBill;
}

export async function updateBillDriveStatus(billId, driveData) {
  const db = await getDB();
  const bill = await db.get('bills', billId);
  if (!bill) return null;

  const updatedBill = {
    ...bill,
    driveUploadStatus: driveData.status || (driveData.success ? 'uploaded' : 'failed'),
    driveFileId: driveData.fileId || bill.driveFileId || null,
    driveFileUrl: driveData.webViewLink || bill.driveFileUrl || null,
    driveUploadedAt: driveData.success ? (driveData.uploadedAt || new Date().toISOString()) : bill.driveUploadedAt,
    driveError: driveData.error || null,
    driveFolderName: driveData.folderName || bill.driveFolderName || null,
    updatedAt: new Date().toISOString(),
  };

  await db.put('bills', updatedBill);
  return updatedBill;
}

export async function getAllBills() {
  const db = await getDB();
  const bills = await db.getAll('bills');
  return bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function cancelBill(id, reason, userRole = 'admin', userName = 'Admin') {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only an Administrator can cancel bills.');
  }

  if (!reason || !reason.trim()) {
    throw new Error('A valid cancellation reason is required for the audit trail.');
  }

  const db = await getDB();
  const bill = await db.get('bills', id);
  if (!bill) {
    throw new Error('Bill not found.');
  }

  if (bill.status === 'cancelled') {
    throw new Error('This bill has already been cancelled.');
  }

  const updatedBill = {
    ...bill,
    status: 'cancelled',
    cancelReason: reason.trim(),
    cancelledAt: new Date().toISOString(),
    cancelledBy: userName,
    updatedAt: new Date().toISOString(),
  };

  const tx = db.transaction(['bills', 'auditLogs'], 'readwrite');
  await tx.objectStore('bills').put(updatedBill);

  const auditEntry = {
    id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    action: 'BILL_CANCELLED',
    userRole,
    userName,
    details: `Cancelled bill ${bill.billNumber}. Reason: "${reason.trim()}"`,
    targetId: id,
    timestamp: new Date().toISOString(),
  };
  await tx.objectStore('auditLogs').put(auditEntry);

  await tx.done;
  return updatedBill;
}

export async function deleteBill(id, userRole = 'admin', userName = 'Admin') {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only an Administrator can delete bills.');
  }

  const db = await getDB();
  const bill = await db.get('bills', id);
  if (!bill) {
    throw new Error('Bill not found or already deleted.');
  }

  const tx = db.transaction(['bills', 'auditLogs'], 'readwrite');
  await tx.objectStore('bills').delete(id);

  const auditEntry = {
    id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    action: 'BILL_DELETED',
    userRole,
    userName,
    details: `Permanently deleted bill ${bill.billNumber} (Amount: ₹${bill.finalPayableAmount}).`,
    targetId: id,
    timestamp: new Date().toISOString(),
  };
  await tx.objectStore('auditLogs').put(auditEntry);

  await tx.done;
  return true;
}

export async function recordAuditLog({ action, userRole = 'cashier', userName = 'User', details, targetId = null }) {
  const db = await getDB();
  const logEntry = {
    id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    action,
    userRole,
    userName,
    details,
    targetId,
    timestamp: new Date().toISOString(),
  };
  await db.put('auditLogs', logEntry);
  return logEntry;
}

export async function getAllAuditLogs() {
  const db = await getDB();
  const logs = await db.getAll('auditLogs');
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ----------------------------------------------------------------------------
// CSV EXPORT ENGINE (EXCEL & PYTHON PANDAS COMPATIBLE)
// ----------------------------------------------------------------------------

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 1. ITEM-LEVEL SALES CSV (One row per bill item)
 * Optimized for Pandas (df.groupby('bill_id')) and Excel PivotTables.
 */
export function exportLineItemsCSV(bills, shopName = 'FESTIVAL CLOTHING') {
  if (!bills || bills.length === 0) {
    throw new Error('No bills available to export.');
  }

  const headers = [
    's_no',
    'bill_id',
    'bill_number',
    'timestamp_iso',
    'date_time_local',
    'shop_name',
    'cashier_name',
    'status',
    'product_id',
    'product_name',
    'quantity',
    'original_unit_price',
    'final_unit_price',
    'reduction_per_unit',
    'item_total_reduction',
    'line_total',
    'bill_grand_total',
    'payment_method',
  ];

  const rows = [];
  let itemSNo = 1;

  for (const b of bills) {
    const items = b.items && b.items.length > 0 ? b.items : [
      { productId: 'custom', name: 'General Item', qty: 1, originalUnitPrice: b.subtotal, unitPrice: b.subtotal, reductionPerUnit: 0, lineTotal: b.subtotal }
    ];

    for (const item of items) {
      const finalPrice = Number(item.finalUnitPrice !== undefined ? item.finalUnitPrice : (item.unitPrice || 0));
      const origPrice = Number(item.originalUnitPrice !== undefined ? item.originalUnitPrice : finalPrice);
      const redPerUnit = Number(item.reductionPerUnit !== undefined ? item.reductionPerUnit : Math.max(0, origPrice - finalPrice));
      const itemTotRed = Number(item.itemTotalReduction !== undefined ? item.itemTotalReduction : (redPerUnit * item.qty));

      rows.push([
        itemSNo++,
        escapeCSV(b.id),
        escapeCSV(b.billNumber),
        escapeCSV(b.createdAt),
        escapeCSV(new Date(b.createdAt).toLocaleString('en-IN')),
        escapeCSV(shopName),
        escapeCSV(b.cashierName || 'Cashier'),
        escapeCSV(b.status),
        escapeCSV(item.productId || ''),
        escapeCSV(item.name),
        item.qty,
        origPrice.toFixed(2),
        finalPrice.toFixed(2),
        redPerUnit.toFixed(2),
        itemTotRed.toFixed(2),
        Number(item.lineTotal).toFixed(2),
        Number(b.finalPayableAmount || b.subtotal || 0).toFixed(2),
        escapeCSV(b.paymentMethod),
      ].join(','));
    }
  }

  // Prepend UTF-8 BOM so Excel opens Indian Rupee and UTF-8 characters without garbling
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * 2. BILLS SUMMARY CSV (One row per finalized bill)
 * Prevents double-counting totals when calculating overall sales, revenue, or tax.
 */
export function exportBillsSummaryCSV(bills, shopName = 'FESTIVAL CLOTHING') {
  if (!bills || bills.length === 0) {
    throw new Error('No bills available to export.');
  }

  const headers = [
    's_no',
    'bill_id',
    'bill_number',
    'timestamp_iso',
    'date_time_local',
    'shop_name',
    'cashier_name',
    'status',
    'total_item_count',
    'total_quantity_pieces',
    'subtotal',
    'total_reduction',
    'final_payable_amount',
    'payment_method',
    'amount_received',
    'change_due',
    'upi_ref',
    'customer_name',
    'customer_phone',
    'combo_savings',
    'cancel_reason',
    'attribution',
  ];

  const rows = bills.map((b, idx) => {
    const itemCount = b.items?.length || 0;
    const totalQty = (b.items || []).reduce((acc, it) => acc + (Number(it.qty) || 0), 0);

    return [
      bills.length - idx,
      escapeCSV(b.id),
      escapeCSV(b.billNumber),
      escapeCSV(b.createdAt),
      escapeCSV(new Date(b.createdAt).toLocaleString('en-IN')),
      escapeCSV(shopName),
      escapeCSV(b.cashierName || 'Cashier'),
      escapeCSV(b.status),
      itemCount,
      totalQty,
      Number(b.subtotal || 0).toFixed(2),
      Number(b.totalReduction || 0).toFixed(2),
      Number(b.finalPayableAmount || 0).toFixed(2),
      escapeCSV(b.paymentMethod),
      Number(b.amountReceived || 0).toFixed(2),
      Number(b.changeDue || 0).toFixed(2),
      escapeCSV(b.upiRef || ''),
      escapeCSV(b.customerName || ''),
      escapeCSV(b.customerPhone || ''),
      Number(b.comboSavings || 0).toFixed(2),
      escapeCSV(b.cancelReason || ''),
      escapeCSV(COMPANY_BRANDING.attributionText),
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * 3. PRODUCTS CATALOG CSV
 */
export function exportProductsCSV(products) {
  if (!products || products.length === 0) {
    throw new Error('No products available to export.');
  }

  const validProducts = products.filter((p) => p.id !== 'prod_custom_item');
  const headers = [
    'product_id',
    'name',
    'shortcut',
    'default_price',
    'offer_price',
    'reduction_enabled',
    'max_reduction_per_unit',
    'is_active',
    'sort_order',
  ];
  const rows = validProducts.map((p) => [
    escapeCSV(p.id),
    escapeCSV(p.name),
    escapeCSV(p.shortcut),
    Number(p.defaultPrice).toFixed(2),
    p.offerPrice !== null && p.offerPrice !== undefined ? Number(p.offerPrice).toFixed(2) : '',
    p.reductionEnabled !== false ? 'true' : 'false',
    Number(p.maxReductionPerUnit || 50).toFixed(2),
    p.isActive ? 'true' : 'false',
    p.sortOrder,
  ].join(','));

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

// Backward-compatible alias for existing tests
export function exportSalesCSV(bills, shopName = 'FESTIVAL CLOTHING') {
  return exportBillsSummaryCSV(bills, shopName);
}

// ----------------------------------------------------------------------------
// FULL SYSTEM DATABASE BACKUP & RESTORE (JSON)
// ----------------------------------------------------------------------------

export async function exportFullDatabaseBackup() {
  const db = await getDB();
  const bills = await db.getAll('bills');
  const products = await db.getAll('products');
  const auditLogs = await db.getAll('auditLogs');
  const settings = await getShopSettings();

  const backupPayload = {
    format: 'WISDO_POS_BACKUP_V2',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    shopName: settings.shopName,
    companyAttribution: COMPANY_BRANDING.attributionText,
    stats: {
      totalBills: bills.length,
      totalProducts: products.length,
      totalAuditLogs: auditLogs.length,
    },
    data: {
      bills,
      products,
      auditLogs,
      settings,
    },
  };

  return JSON.stringify(backupPayload, null, 2);
}

export async function importFullDatabaseBackup(jsonString, adminUser = 'Admin') {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Invalid JSON file format.');
  }

  if (!parsed.data || !Array.isArray(parsed.data.bills)) {
    throw new Error('Invalid backup file structure: missing bills records.');
  }

  const db = await getDB();
  const existingBills = await db.getAll('bills');
  const existingBillIds = new Set(existingBills.map((b) => b.id));
  const existingBillNumbers = new Set(existingBills.map((b) => b.billNumber));

  let importedBillsCount = 0;
  let skippedDuplicatesCount = 0;

  const tx = db.transaction(['bills', 'products', 'auditLogs', 'settings'], 'readwrite');

  // 1. Safely import bills without overwriting existing records
  for (const bill of parsed.data.bills) {
    if (existingBillIds.has(bill.id) || existingBillNumbers.has(bill.billNumber)) {
      skippedDuplicatesCount++;
      continue;
    }
    await tx.objectStore('bills').put(bill);
    importedBillsCount++;
  }

  // 2. Import products
  if (parsed.data.products && Array.isArray(parsed.data.products)) {
    for (const prod of parsed.data.products) {
      await tx.objectStore('products').put(prod);
    }
  }

  // 3. Import settings
  if (parsed.data.settings) {
    const sanitizedSettings = {
      ...parsed.data.settings,
      companyName: COMPANY_BRANDING.companyName,
      attributionText: COMPANY_BRANDING.attributionText,
    };
    await tx.objectStore('settings').put({
      key: 'shop_config',
      value: sanitizedSettings,
      updatedAt: new Date().toISOString(),
    });
  }

  // 4. Record audit log
  const auditEntry = {
    id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    action: 'BACKUP_RESTORED',
    userRole: 'admin',
    userName: adminUser,
    details: `Restored backup: ${importedBillsCount} new bills imported, ${skippedDuplicatesCount} duplicates skipped.`,
    targetId: 'database_restore',
    timestamp: new Date().toISOString(),
  };
  await tx.objectStore('auditLogs').put(auditEntry);

  await tx.done;

  return {
    importedBillsCount,
    skippedDuplicatesCount,
    totalInFile: parsed.data.bills.length,
  };
}
