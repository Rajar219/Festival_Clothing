/**
 * Currency and financial arithmetic utilities for FESTIVAL CLOTHING POS.
 * Uses integer paise arithmetic internally to eliminate floating-point precision issues.
 */

// Convert rupees (e.g. 550.50) to integer paise (55050)
export function rupeesToPaise(rupees) {
  if (rupees === null || rupees === undefined || isNaN(rupees)) return 0;
  return Math.round(Number(rupees) * 100);
}

// Convert integer paise to rupees
export function paiseToRupees(paise) {
  if (!paise || isNaN(paise)) return 0;
  return Number(paise) / 100;
}

// Format a rupee amount into Indian Rupee format (e.g. ₹1,100.00 or ₹500)
export function formatINR(amount, includeDecimals = true) {
  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(absNum);

  return isNegative ? `-${formatted}` : formatted;
}

// Calculate discount amount and percentage between reference/original price and final negotiated price
export function calculateDiscount(refPrice, finalPrice) {
  const ref = Number(refPrice) || 0;
  const final = Number(finalPrice) || 0;

  if (ref <= 0 || final >= ref) {
    return {
      hasDiscount: false,
      discountAmount: 0,
      discountPercent: 0,
    };
  }

  const discountAmount = Math.max(0, ref - final);
  const discountPercent = Math.round((discountAmount / ref) * 1000) / 10; // 1 decimal place

  return {
    hasDiscount: true,
    discountAmount,
    discountPercent,
  };
}

// Generate unique bill number: FC-YYYYMMDD-XXXX
export function generateBillNumber(sequence = 1) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const seqStr = String(sequence).padStart(4, '0');
  return `FC-${year}${month}${day}-${seqStr}`;
}

// Format date and time for receipt and history
export function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateOnly(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTimeOnly(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
