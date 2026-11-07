import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { formatINR, formatDateTime } from './currency.js';
import { getBillFestiveQuote } from '../services/db.js';

/**
 * Validates and cleans Indian mobile numbers
 * Accepts formats: +919840012345, 9840012345, 09840012345, 919840012345, 98400-12345
 * Returns { isValid: boolean, cleanNumber: string, formattedNumber: string, error?: string }
 */
export function validateIndianMobile(raw) {
  if (!raw || typeof raw !== 'string') {
    return { isValid: false, cleanNumber: '', error: 'Mobile number is required' };
  }

  // Remove all non-digits except a leading plus
  let cleaned = raw.trim().replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }

  // Must be exactly 10 digits and start with 6, 7, 8, or 9
  const regex = /^[6-9]\d{9}$/;
  if (!regex.test(cleaned)) {
    return {
      isValid: false,
      cleanNumber: cleaned,
      error: 'Please enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)',
    };
  }

  return {
    isValid: true,
    cleanNumber: cleaned,
    formattedNumber: `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`,
  };
}

export function generateWhatsAppDirectChatText(bill) {
  const billNumber = bill?.billNumber || '';
  const total = Number(bill?.finalPayableAmount !== undefined ? bill.finalPayableAmount : (bill?.total || 0)).toLocaleString('en-IN');
  return `Thanks for purchasing from FESTIVAL CLOTHING!\n\nWe truly appreciate your support. Visit us again!\n\nInvoice No: ${billNumber}\nTotal Amount: ₹${total}`;
}

/**
 * Builds the complete WhatsApp greeting message for Android mobile sharing
 * Includes:
 * - Happy Diwali greeting
 * - Customer thank-you message
 * - Bill number
 * - Final payable amount
 */
export function generateMobileWhatsAppGreeting(bill) {
  const billNumber = bill?.billNumber || '';
  const total = Number(
    bill?.finalPayableAmount !== undefined ? bill.finalPayableAmount : (bill?.total || 0)
  ).toLocaleString('en-IN');

  return [
    '*HAPPY DIWALI!*',
    '"May this Festival of Lights fill your home with happiness, prosperity and beautiful moments."',
    '',
    'Thanks for purchasing from FESTIVAL CLOTHING!',
    'We truly appreciate your support. Visit us again!',
    '',
    `Invoice No: ${billNumber}`,
    `Final Payable Amount: ₹${total}`,
  ].join('\n');
}

/**
 * Generates formatted WhatsApp itemized receipt text from actual finalized transaction
 * Follows exact two-line greeting specification:
 * Line 1: Thanks for purchasing from FESTIVAL CLOTHING!
 * Line 2: We appreciate your support. Visit us again!
 * Line 3: Invoice No: [BILL NUMBER]
 */
export function generateWhatsAppReceiptText(bill, settings = {}) {
  const shopName = bill?.storeDetails?.name || settings?.shopName || 'FESTIVAL CLOTHING';
  const grandTotal = (bill?.finalPayableAmount || 0).toFixed(2);
  const paymentUpper = (bill?.paymentMethod || 'cash').toUpperCase();

  let text = `Thanks for purchasing from ${shopName.toUpperCase()}!\n\n`;
  text += `We appreciate your support. Visit us again!\n\n`;
  text += `*Invoice No:* ${bill?.billNumber || ''}\n`;
  text += `*Amount Paid:* ₹${grandTotal}\n`;
  text += `*Payment:* ${paymentUpper}\n\n`;
  text += `Please find your retail invoice attached.`;

  return text;
}

/**
 * Creates a click-to-chat WhatsApp link
 */
export function generateWhatsAppLink(cleanMobile, text) {
  return `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(text)}`;
}

/**
 * Generates a high-resolution vector QR code directly onto jsPDF
 * Encodes bill number, date, items, final payable amount and payment method.
 * Excludes customer phone number or other personal data.
 */
function drawBillQRCode(doc, bill, x, y, sizeMm) {
  const itemsSummary = (bill.items || [])
    .map((it) => `• ${it.name} x ${it.qty}`)
    .join('\n');
  const dateStr = formatDateTime(bill.createdAt);
  const payMethod = (bill.paymentMethod || 'cash').toUpperCase();
  const finalAmt = (Number(bill.finalPayableAmount) || 0).toFixed(2);

  const qrText = [
    'FESTIVAL CLOTHING',
    `Invoice: ${bill.billNumber}`,
    `Date: ${dateStr}`,
    'Items:',
    itemsSummary,
    `Payment: ${payMethod}`,
    `Final Total: Rs. ${finalAmt}`,
  ].join('\n');

  try {
    const qr = QRCode.create(qrText, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;
    const moduleSize = sizeMm / moduleCount;

    // White quiet-zone backing
    doc.setFillColor(255, 255, 255);
    doc.rect(x - 1, y - 1, sizeMm + 2, sizeMm + 2, 'F');

    // Draw QR modules in pure solid black for 100% reliable scanner optical recognition
    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.modules.get(r, c)) {
          doc.rect(x + c * moduleSize, y + r * moduleSize, moduleSize, moduleSize, 'F');
        }
      }
    }

    // Subtle emerald border around QR box
    doc.setDrawColor(167, 243, 208);
    doc.setLineWidth(0.35);
    doc.rect(x - 1, y - 1, sizeMm + 2, sizeMm + 2, 'S');

    return true;
  } catch (err) {
    console.error('Failed to draw QR code:', err);
    return false;
  }
}

/**
 * Generates and downloads a customer invoice PDF using actual saved bill data
 * @param {object} bill - Finalized bill object
 * @param {object|string} options - Configuration options or mode string ('a4' | 'thermal')
 */
export function generateReceiptPDF(bill, options = {}) {
  const mode = typeof options === 'string' ? options : (options.mode || 'a4');
  const autoDownload = typeof options === 'object' && options.autoDownload !== undefined ? options.autoDownload : true;

  // Strict Shop Branding: Only FESTIVAL CLOTHING, zero MENSWEAR, zero Powered by WISDO TECH
  const store = {
    name: 'FESTIVAL CLOTHING',
    address: 'No. 10/12, N.N. Garden, Old Washermenpet, Chennai - 21, Tamil Nadu.',
    phone: bill.storeDetails?.phone && bill.storeDetails.phone !== '+91 98400 12345' ? bill.storeDetails.phone : '',
  };

  if (mode === 'thermal') {
    // =========================================================================
    // Thermal Receipt Format (80mm Monospace Scaled to A4)
    // =========================================================================
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const marginLeft = 20;
    const marginRight = 190;
    const pageCenter = 105;

    let y = 18;
    doc.setFont('courier', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(store.name, pageCenter, y, { align: 'center' });
    y += 6.5;

    doc.setFontSize(9.5);
    doc.setFont('courier', 'normal');
    doc.text(store.address, pageCenter, y, { align: 'center', maxWidth: 150 });
    y += 8.5;

    if (store.phone) {
      doc.text(`Phone: ${store.phone}`, pageCenter, y, { align: 'center' });
      y += 5;
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text('RETAIL INVOICE / SALES RECEIPT', pageCenter, y, { align: 'center' });
    y += 5;

    doc.setLineDashPattern([2, 1.5], 0);
    doc.setLineWidth(0.35);
    doc.line(marginLeft, y, marginRight, y);
    y += 6;

    // Bill Meta
    doc.setFontSize(9.5);
    doc.setFont('courier', 'normal');
    doc.text(`Bill No: ${bill.billNumber}`, marginLeft, y);
    doc.text(`Date & Time: ${formatDateTime(bill.createdAt)}`, marginRight, y, { align: 'right' });
    y += 5;

    doc.text(`Cashier: ${bill.cashierName || 'Cashier'}`, marginLeft, y);
    const statusText = bill.status === 'cancelled' ? 'STATUS: CANCELLED' : 'STATUS: PAID';
    doc.setFont('courier', 'bold');
    doc.text(statusText, marginRight, y, { align: 'right' });
    doc.setFont('courier', 'normal');

    if (bill.customerName) {
      y += 5;
      const custInfo = bill.customerPhone ? `${bill.customerName} (${bill.customerPhone})` : bill.customerName;
      doc.text(`Customer: ${custInfo}`, marginLeft, y);
    }
    y += 5.5;

    doc.line(marginLeft, y, marginRight, y);
    y += 5.5;

    // Items table header
    const colSNo = marginLeft;
    const colItem = marginLeft + 14;
    const colQty = marginLeft + 98;
    const colRate = marginLeft + 132;
    const colTotal = marginRight;

    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text('S.No', colSNo, y);
    doc.text('Item Description', colItem, y);
    doc.text('Qty', colQty, y, { align: 'center' });
    doc.text('Rate', colRate, y, { align: 'right' });
    doc.text('Total', colTotal, y, { align: 'right' });
    y += 3.5;
    doc.line(marginLeft, y, marginRight, y);
    y += 5.5;

    // Items list
    doc.setFont('courier', 'normal');
    doc.setFontSize(9.5);

    (bill.items || []).forEach((item, index) => {
      const finalPrice = item.finalUnitPrice ?? item.unitPrice;
      const red = item.reductionPerUnit || 0;
      const isCombo = Boolean(item.isCombo || item.productId?.includes('combo'));
      const origPrice = isCombo
        ? (item.originalCombinedValue ?? ((item.regularPricePerUnit || 600) * (item.piecesPerUnit || 3)))
        : (item.originalUnitPrice ?? item.unitPrice);
      const displayName = isCombo ? `${item.name} (${item.piecesPerUnit || 3} Pcs)` : item.name;

      doc.text(String(index + 1), colSNo, y);
      doc.text(displayName, colItem, y);
      doc.text(String(item.qty), colQty, y, { align: 'center' });
      doc.text(`Rs. ${finalPrice.toFixed(2)}`, colRate, y, { align: 'right' });
      doc.text(`Rs. ${item.lineTotal.toFixed(2)}`, colTotal, y, { align: 'right' });
      y += 4.5;

      if (isCombo) {
        doc.setFontSize(8);
        const savings = item.comboSavingsPerUnit ? (item.comboSavingsPerUnit * item.qty) : (item.comboSavings || 800);
        doc.text(`  (Orig Combined: Rs. ${(origPrice * item.qty).toFixed(2)}, Combo Savings: -Rs. ${savings.toFixed(2)})`, colItem, y);
        doc.setFontSize(9.5);
        y += 4.5;
      } else if (red > 0) {
        doc.setFontSize(8);
        doc.text(`  (Orig: Rs. ${origPrice.toFixed(2)}, Discount: -Rs. ${red.toFixed(2)}/pc)`, colItem, y);
        doc.setFontSize(9.5);
        y += 4.5;
      }
    });

    doc.line(marginLeft, y, marginRight, y);
    y += 5.5;

    // Totals Section
    const totalsLeft = 112;
    doc.setFontSize(9.5);
    doc.setFont('courier', 'normal');

    doc.text('Subtotal:', totalsLeft, y);
    doc.text(`Rs. ${(bill.subtotal || 0).toFixed(2)}`, marginRight, y, { align: 'right' });
    y += 5;

    if (bill.totalReduction > 0) {
      doc.text('Item Reductions:', totalsLeft, y);
      doc.text(`-Rs. ${(bill.totalReduction || 0).toFixed(2)}`, marginRight, y, { align: 'right' });
      y += 5;
    }

    if (bill.comboSavings > 0) {
      doc.text('Combo Savings:', totalsLeft, y);
      doc.text(`-Rs. ${(bill.comboSavings || 0).toFixed(2)}`, marginRight, y, { align: 'right' });
      y += 5;
    }

    const totalDiscount = (bill.totalReduction || 0) + (bill.comboSavings || 0);
    if (totalDiscount > 0) {
      doc.setFont('courier', 'bold');
      doc.text('Total Discount:', totalsLeft, y);
      doc.text(`-Rs. ${totalDiscount.toFixed(2)}`, marginRight, y, { align: 'right' });
      doc.setFont('courier', 'normal');
      y += 5;
    }

    y += 2;
    doc.line(totalsLeft - 4, y, marginRight, y);
    y += 5.5;

    // FIX OVERLAPPING: Display FINAL PAYABLE only once, aligned neatly on right
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text('FINAL PAYABLE:', totalsLeft, y);
    doc.text(`Rs. ${(bill.finalPayableAmount || 0).toFixed(2)}`, marginRight, y, { align: 'right' });
    y += 6;
    doc.line(totalsLeft - 4, y, marginRight, y);
    y += 5.5;

    doc.setFontSize(9.5);
    doc.setFont('courier', 'normal');
    doc.text(`Payment Mode: ${(bill.paymentMethod || 'cash').toUpperCase()}`, totalsLeft, y);
    y += 4.5;

    if (bill.paymentMethod === 'cash' && (bill.amountReceived || bill.tenderAmount)) {
      doc.text(`Cash Received: Rs. ${Number(bill.amountReceived || bill.tenderAmount).toFixed(2)}`, totalsLeft, y);
      y += 4.5;
      doc.text(`Change Returned: Rs. ${Number(bill.changeDue || 0).toFixed(2)}`, totalsLeft, y);
      y += 5;
    } else if (bill.paymentMethod === 'upi' && bill.upiRef) {
      doc.text(`UPI Ref: ${bill.upiRef}`, totalsLeft, y);
      y += 5;
    }

    // QR Code in thermal
    const qrSize = 26;
    drawBillQRCode(doc, bill, marginLeft + 2, y + 2, qrSize);

    y = Math.max(y + qrSize + 8, 172);

    doc.line(marginLeft, y, marginRight, y);
    y += 6;

    // Footer & Customer Thank You
    doc.setFont('courier', 'bold');
    doc.setFontSize(10.5);
    doc.text('THANK YOU FOR SHOPPING WITH US!', pageCenter, y, { align: 'center' });
    y += 5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text('We truly appreciate your support.', pageCenter, y, { align: 'center' });
    y += 5;

    // Attractive Diwali Greeting Footer
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text('HAPPY DIWALI!', pageCenter, y, { align: 'center' });
    y += 5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.text('"May this Festival of Lights fill your home with happiness, prosperity and beautiful moments."', pageCenter, y, { align: 'center', maxWidth: 160 });
    y += 5.5;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.text('Thank you for choosing FESTIVAL CLOTHING!', pageCenter, y, { align: 'center' });
    y += 6;

    doc.setLineDashPattern([], 0);
    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, y, marginRight, y);
    y += 5;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.text('FESTIVAL CLOTHING', pageCenter, y, { align: 'center' });

    const fileName = `${bill.billNumber}_Invoice.pdf`;
    if (autoDownload) {
      doc.save(fileName);
    }
    const blob = doc.output('blob');
    return { doc, fileName, blob };
  } else {
    // =========================================================================
    // Standard A4 Layout: Premium Emerald-Green & White Theme with Gold Accents
    // Fits neatly on A4 (65%–75% height) with crisp vector QR and Diwali greeting
    // =========================================================================
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const marginLeft = 18;
    const marginRight = 192;
    const contentWidth = marginRight - marginLeft; // 174mm
    const pageCenter = 105;

    // Deep emerald green accent bar at top
    doc.setFillColor(6, 78, 59); // Deep Emerald (#064e3b)
    doc.rect(0, 0, pageWidth, 5, 'F');

    let y = 16;

    // Store Branding Header (Left) - FESTIVAL CLOTHING only, zero MENSWEAR
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(6, 78, 59); // Deep Emerald
    doc.text('FESTIVAL CLOTHING', marginLeft, y);

    y += 6.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // Slate
    doc.text(store.address, marginLeft, y, { maxWidth: 96 });
    if (store.phone) {
      doc.text(`Phone: ${store.phone}`, marginLeft, y + 5);
      y += 5;
    }

    // Invoice Meta Header (Right)
    doc.setFillColor(240, 253, 244); // Light Mint (#f0fdf4)
    doc.roundedRect(126, 11, 66, 8, 1, 1, 'F');
    doc.setDrawColor(167, 243, 208); // Emerald border
    doc.roundedRect(126, 11, 66, 8, 1, 1, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(6, 78, 59);
    doc.text('RETAIL INVOICE / SALES RECEIPT', 159, 16.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Invoice No: ${bill.billNumber}`, marginRight, 24, { align: 'right' });
    doc.text(`Date & Time: ${formatDateTime(bill.createdAt)}`, marginRight, 29, { align: 'right' });

    // Payment Status badge
    doc.setFont('helvetica', 'bold');
    const isCancelled = bill.status === 'cancelled';
    const statusText = isCancelled ? 'STATUS: CANCELLED' : 'STATUS: PAID';
    doc.setTextColor(isCancelled ? 220 : 5, isCancelled ? 38 : 150, isCancelled ? 38 : 105);
    doc.text(statusText, marginRight, 34, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`Payment: ${(bill.paymentMethod || 'cash').toUpperCase()}`, marginRight, 39, { align: 'right' });

    if (bill.customerName) {
      const custInfo = bill.customerPhone ? `${bill.customerName} (${bill.customerPhone})` : bill.customerName;
      doc.text(`Customer: ${custInfo}`, marginRight, 44, { align: 'right' });
    }

    y = Math.max(y + 8, bill.customerName ? 48 : 44);

    // Clean subtle emerald separator line
    doc.setDrawColor(209, 250, 229);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, y, marginRight, y);
    y += 5;

    // 6-Column Itemized Table Header: | S.No | Product Description | Qty | Original Price | Discount | Final Amount |
    const colSNo = marginLeft + 3; // 21
    const colProduct = marginLeft + 14; // 32
    const colQty = marginLeft + 92; // 110
    const colOrig = marginLeft + 120; // 138
    const colDisc = marginLeft + 148; // 166
    const colFinal = marginRight - 3; // 189

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(marginLeft, y, contentWidth, 8, 1, 1, 'F');
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(marginLeft, y, contentWidth, 8, 1, 1, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 78, 59);
    doc.text('S.No', colSNo, y + 5.2, { align: 'center' });
    doc.text('Product Description', colProduct, y + 5.2);
    doc.text('Qty', colQty, y + 5.2, { align: 'center' });
    doc.text('Original Price', colOrig, y + 5.2, { align: 'right' });
    doc.text('Discount', colDisc, y + 5.2, { align: 'right' });
    doc.text('Final Amount', colFinal, y + 5.2, { align: 'right' });
    y += 11;

    // Items list
    (bill.items || []).forEach((item, idx) => {
      const isCombo = Boolean(item.isCombo || item.productId?.includes('combo'));
      const origPrice = isCombo
        ? (item.originalCombinedValue ?? ((item.regularPricePerUnit || 600) * (item.piecesPerUnit || 3)))
        : (item.originalUnitPrice ?? item.unitPrice);
      const red = isCombo ? (item.comboSavingsPerUnit ?? 800) : (item.reductionPerUnit || 0);
      const lineSavings = red * item.qty;
      const displayName = isCombo ? `${item.name} (${item.piecesPerUnit || 3} Pcs)` : item.name;

      const maxProdWidth = 72;
      const prodLines = doc.splitTextToSize(displayName, maxProdWidth);
      const rowHeight = Math.max(7.5, prodLines.length * 4.5 + 2);

      // Alternating row background for clean readability
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginLeft, y - 2.5, contentWidth, rowHeight, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(String(idx + 1), colSNo, y + 2, { align: 'center' });
      doc.text(prodLines, colProduct, y + 2);
      doc.text(String(item.qty), colQty, y + 2, { align: 'center' });
      doc.text(`Rs. ${(origPrice * item.qty).toFixed(2)}`, colOrig, y + 2, { align: 'right' });

      if (lineSavings > 0) {
        doc.setTextColor(5, 150, 105);
        const label = isCombo ? `-Rs. ${lineSavings.toFixed(2)} (Combo)` : `-Rs. ${lineSavings.toFixed(2)}`;
        doc.text(label, colDisc, y + 2, { align: 'right' });
        doc.setTextColor(30, 41, 59);
      } else {
        doc.text('-', colDisc, y + 2, { align: 'right' });
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`Rs. ${item.lineTotal.toFixed(2)}`, colFinal, y + 2, { align: 'right' });

      y += rowHeight;
    });

    doc.setDrawColor(226, 232, 240);
    doc.line(marginLeft, y, marginRight, y);
    y += 5;

    // Totals Calculation
    const origMerchandiseValue = (bill.items || []).reduce((acc, item) => {
      const isCombo = Boolean(item.isCombo || item.productId?.includes('combo'));
      const origPrice = isCombo
        ? (item.originalCombinedValue ?? ((item.regularPricePerUnit || 600) * (item.piecesPerUnit || 3)))
        : (item.originalUnitPrice ?? item.unitPrice);
      return acc + (origPrice * item.qty);
    }, 0);

    const totalDiscount = (bill.totalReduction || 0) + (bill.comboSavings || 0);
    const finalPayable = bill.finalPayableAmount ?? (origMerchandiseValue - totalDiscount);

    const summaryStartY = y;

    // LEFT COLUMN: QR Code & Verification
    const qrSize = 30; // 30mm x 30mm
    const qrX = marginLeft + 2;
    const qrY = summaryStartY + 1;
    drawBillQRCode(doc, bill, qrX, qrY, qrSize);

    // QR Label below code
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(6, 78, 59);
    doc.text('SCAN TO VERIFY INVOICE', qrX + (qrSize / 2), qrY + qrSize + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Genuine Retail Bill Summary', qrX + (qrSize / 2), qrY + qrSize + 8, { align: 'center' });

    // RIGHT COLUMN: Order Summary Table
    const totalsLeft = 116;
    const totalsRight = marginRight - 3;
    let rightY = summaryStartY;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    doc.text('Original Merchandise Value:', totalsLeft, rightY);
    doc.text(`Rs. ${origMerchandiseValue.toFixed(2)}`, totalsRight, rightY, { align: 'right' });
    rightY += 5;

    if (bill.totalReduction > 0) {
      doc.setTextColor(5, 150, 105);
      doc.text('Individual Product Discounts:', totalsLeft, rightY);
      doc.text(`-Rs. ${(bill.totalReduction || 0).toFixed(2)}`, totalsRight, rightY, { align: 'right' });
      rightY += 5;
    }

    if (bill.comboSavings > 0) {
      doc.setTextColor(5, 150, 105);
      doc.text('Combo Savings:', totalsLeft, rightY);
      doc.text(`-Rs. ${(bill.comboSavings || 0).toFixed(2)}`, totalsRight, rightY, { align: 'right' });
      rightY += 5;
    }

    if (totalDiscount > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('Total Discount:', totalsLeft, rightY);
      doc.text(`-Rs. ${totalDiscount.toFixed(2)}`, totalsRight, rightY, { align: 'right' });
      rightY += 5.5;
    }

    // Grand Total Highlight Emerald Box - FIX OVERLAPPING: FINAL PAYABLE only once, aligned right
    const boxW = totalsRight - totalsLeft + 6;
    const boxX = totalsLeft - 3;
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(boxX, rightY, boxW, 9.5, 1.5, 1.5, 'F');
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.5);
    doc.roundedRect(boxX, rightY, boxW, 9.5, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(6, 78, 59);
    doc.text('FINAL PAYABLE:', totalsLeft, rightY + 6.2);
    doc.setFontSize(11.5);
    doc.text(`Rs. ${finalPayable.toFixed(2)}`, totalsRight, rightY + 6.2, { align: 'right' });
    rightY += 14;

    // Payment Info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Payment Mode: ${(bill.paymentMethod || 'cash').toUpperCase()}`, totalsLeft, rightY);
    rightY += 4.5;

    if (bill.paymentMethod === 'cash' && (bill.amountReceived || bill.tenderAmount)) {
      doc.text(`Cash Tendered: Rs. ${Number(bill.amountReceived || bill.tenderAmount).toFixed(2)}`, totalsLeft, rightY);
      rightY += 4.5;
      doc.text(`Change Returned: Rs. ${Number(bill.changeDue || 0).toFixed(2)}`, totalsLeft, rightY);
      rightY += 5;
    } else if (bill.paymentMethod === 'upi' && bill.upiRef) {
      doc.text(`UPI Ref: ${bill.upiRef}`, totalsLeft, rightY);
      rightY += 5;
    }

    // Natural vertical spacing to reach ~60-70% page height
    y = Math.max(rightY, qrY + qrSize + 12);
    const bannerY = Math.max(y + 8, 168);
    const bannerH = 26;

    // Attractive Diwali Festive Greeting Card with elegant gold accents
    doc.setFillColor(255, 251, 235); // Festive Warm Cream (#fffbeb)
    doc.roundedRect(marginLeft, bannerY, contentWidth, bannerH, 2, 2, 'F');
    doc.setDrawColor(217, 119, 6); // Festive Gold (#d97706)
    doc.setLineWidth(0.6);
    doc.roundedRect(marginLeft, bannerY, contentWidth, bannerH, 2, 2, 'S');

    // Inner gold decorative line
    doc.setDrawColor(253, 230, 138); // Amber-200 (#fde68a)
    doc.setLineWidth(0.3);
    doc.roundedRect(marginLeft + 1.2, bannerY + 1.2, contentWidth - 2.4, bannerH - 2.4, 1.5, 1.5, 'S');

    // HAPPY DIWALI!
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(180, 83, 9); // Rich Festive Gold (#b45309)
    doc.text('* HAPPY DIWALI! *', pageCenter, bannerY + 7.5, { align: 'center' });

    // Quote
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85); // Slate-700 (#334155)
    doc.text('"May this Festival of Lights fill your home with happiness, prosperity and beautiful moments."', pageCenter, bannerY + 13.5, { align: 'center' });

    // Store Appreciation Sign-off
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(6, 78, 59); // Deep Emerald (#064e3b)
    doc.text('Thank you for choosing FESTIVAL CLOTHING!', pageCenter, bannerY + 20.5, { align: 'center' });

    // Bottom Branding Footer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('FESTIVAL CLOTHING', pageCenter, bannerY + bannerH + 6, { align: 'center' });

    // Bottom deep emerald bar
    doc.setFillColor(6, 78, 59);
    doc.rect(0, 292, pageWidth, 5, 'F');

    const fileName = `${bill.billNumber}_Invoice.pdf`;
    if (autoDownload) {
      doc.save(fileName);
    }
    const blob = doc.output('blob');
    return { doc, fileName, blob };
  }
}
