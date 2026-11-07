import { jsPDF } from 'jspdf';
import { formatINR, formatDateTime } from './currency';
import { getBillFestiveQuote } from '../services/db';

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
 * Generates and downloads a PDF invoice using actual saved bill data
 * Re-architected using the clean thermal receipt layout adapted to A4 portrait
 * Occupies balanced 60–70% of usable page height with zero GST
 * @param {object} bill - Finalized bill object
 * @param {object|string} options - Configuration options or mode string ('thermal' | 'a4')
 */
export function generateReceiptPDF(bill, options = {}) {
  const mode = typeof options === 'string' ? options : (options.mode || 'thermal');
  const autoDownload = typeof options === 'object' && options.autoDownload !== undefined ? options.autoDownload : true;

  // Exact shop address: No. 10/12, N.N. Garden, Old Washermenpet, Chennai - 21, Tamil Nadu.
  const store = {
    name: bill.storeDetails?.name || 'FESTIVAL CLOTHING',
    subtitle: bill.storeDetails?.subtitle || 'MENSWEAR',
    address: bill.storeDetails?.address && !bill.storeDetails.address.includes('Main Bazaar')
      ? bill.storeDetails.address
      : 'No. 10/12, N.N. Garden, Old Washermenpet, Chennai - 21, Tamil Nadu.',
    phone: bill.storeDetails?.phone && bill.storeDetails.phone !== '+91 98400 12345' ? bill.storeDetails.phone : '',
    receiptFooter: bill.storeDetails?.receiptFooter && !bill.storeDetails.receiptFooter.includes('7 days')
      ? bill.storeDetails.receiptFooter
      : 'Wishing you a Happy & Prosperous Celebration!',
  };

  // Universal default: Every invoice and WhatsApp share renders the clean Thermal monospace receipt in A4
  // Legacy multi-column graphic layout is only retained under mode: 'legacy_graphic'
  if (mode !== 'legacy_graphic') {
    // =========================================================================
    // Thermal Receipt Format Scaled and Formatted in A4 Size (210mm x 297mm)
    // Clean monospace typography, dashed dividers, and ~60-70% page utilization
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
    y += 6;

    doc.setFontSize(12);
    doc.setFont('courier', 'bold');
    doc.text(store.subtitle, pageCenter, y, { align: 'center' });
    y += 5.5;

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

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text('FINAL PAYABLE: (Final Payable Amount)', totalsLeft, y);
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

    // Proportional vertical spacing to comfortably utilize 60–70% of A4 page
    y = Math.max(y + 12, 175);

    doc.line(marginLeft, y, marginRight, y);
    y += 6;

    // Footer & Customer Thank You with Rotating Festive Quote
    const festiveQuote = getBillFestiveQuote(bill);

    doc.setFont('courier', 'bold');
    doc.setFontSize(10.5);
    doc.text('THANK YOU FOR SHOPPING WITH US!', pageCenter, y, { align: 'center' });
    y += 5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text('We truly appreciate your support.', pageCenter, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8.5);
    doc.text(`"${festiveQuote}"`, pageCenter, y, { align: 'center', maxWidth: 160 });
    y += 6;

    doc.setLineDashPattern([], 0);
    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, y, marginRight, y);
    y += 5;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.text('FESTIVAL CLOTHING — MENSWEAR', pageCenter, y, { align: 'center' });

    const fileName = `${bill.billNumber}_Invoice.pdf`;
    if (autoDownload) {
      doc.save(fileName);
    }
    const blob = doc.output('blob');
    return { doc, fileName, blob };
  } else {
    // =========================================================================
    // Standard A4 Layout: Thermal Receipt Structure Scaled to A4 Portrait
    // Designed to occupy 60%–70% of page height with clean emerald & white aesthetics
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

    // Deep emerald green accent bar at top
    doc.setFillColor(6, 78, 59); // Deep Emerald (#064e3b)
    doc.rect(0, 0, pageWidth, 5.5, 'F');

    let y = 16;

    // Store Branding Header (Left)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(6, 78, 59); // Deep Emerald
    doc.text(store.name, marginLeft, y);

    doc.setFontSize(11);
    doc.setTextColor(5, 150, 105); // Emerald Green (#059669)
    doc.text(store.subtitle, marginLeft, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // Slate
    doc.text(store.address, marginLeft, y + 12, { maxWidth: 95 });
    if (store.phone) {
      doc.text(`Phone: ${store.phone}`, marginLeft, y + 17);
    }

    // Invoice Meta Header (Right)
    doc.setFillColor(240, 253, 244); // Light Mint (#f0fdf4)
    doc.roundedRect(125, y - 4, 70, 8, 1, 1, 'F');
    doc.setDrawColor(167, 243, 208); // Emerald border
    doc.roundedRect(125, y - 4, 70, 8, 1, 1, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(6, 78, 59);
    doc.text('RETAIL INVOICE / SALES RECEIPT', 160, y + 1.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Invoice No: ${bill.billNumber}`, marginRight, y + 9, { align: 'right' });
    doc.text(`Date & Time: ${formatDateTime(bill.createdAt)}`, marginRight, y + 14, { align: 'right' });

    // Payment Status badge
    doc.setFont('helvetica', 'bold');
    const statusText = bill.status === 'cancelled' ? 'STATUS: CANCELLED' : 'STATUS: PAID';
    doc.setTextColor(bill.status === 'cancelled' ? 220 : 5, bill.status === 'cancelled' ? 38 : 150, bill.status === 'cancelled' ? 38 : 105);
    doc.text(statusText, marginRight, y + 19, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`Payment: ${(bill.paymentMethod || 'cash').toUpperCase()}`, marginRight, y + 24, { align: 'right' });

    if (bill.customerName) {
      const custInfo = bill.customerPhone ? `${bill.customerName} (${bill.customerPhone})` : bill.customerName;
      doc.text(`Customer: ${custInfo}`, marginRight, y + 29, { align: 'right' });
      y += 5;
    }

    y += 28;

    // Clean subtle emerald separator line
    doc.setDrawColor(209, 250, 229);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, y, marginRight, y);
    y += 6;

    // 6-Column Itemized Table Header: | S.No | Product | Qty | Original Price | Discount | Final Amount |
    const colSNo = marginLeft + 4;
    const colProduct = marginLeft + 16;
    const colQty = marginLeft + 82;
    const colOrig = marginLeft + 112;
    const colDisc = marginLeft + 142;
    const colFinal = marginRight - 4;

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(marginLeft, y, contentWidth, 8.5, 1, 1, 'F');
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(marginLeft, y, contentWidth, 8.5, 1, 1, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 78, 59);
    doc.text('S.No', colSNo, y + 5.5);
    doc.text('Product Description', colProduct, y + 5.5);
    doc.text('Qty', colQty, y + 5.5, { align: 'center' });
    doc.text('Original Price', colOrig, y + 5.5, { align: 'right' });
    doc.text('Discount', colDisc, y + 5.5, { align: 'right' });
    doc.text('Final Amount', colFinal, y + 5.5, { align: 'right' });
    y += 12;

    // Items List
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    (bill.items || []).forEach((item, idx) => {
      const isCombo = Boolean(item.isCombo || item.productId?.includes('combo'));
      const origPrice = isCombo
        ? (item.originalCombinedValue ?? ((item.regularPricePerUnit || 600) * (item.piecesPerUnit || 3)))
        : (item.originalUnitPrice ?? item.unitPrice);
      const red = isCombo ? (item.comboSavingsPerUnit ?? 800) : (item.reductionPerUnit || 0);
      const lineSavings = red * item.qty;
      const displayName = isCombo ? `${item.name} (${item.piecesPerUnit || 3} Pcs)` : item.name;

      // Alternating row background for clean readability
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginLeft, y - 3, contentWidth, 8.5, 'F');
      }

      doc.setFontSize(8.5);
      doc.text(String(idx + 1), colSNo, y + 2.5);
      doc.text(displayName, colProduct, y + 2.5);
      doc.text(String(item.qty), colQty, y + 2.5, { align: 'center' });
      doc.text(`Rs. ${(origPrice * item.qty).toFixed(2)}`, colOrig, y + 2.5, { align: 'right' });

      if (lineSavings > 0) {
        doc.setTextColor(5, 150, 105);
        const label = isCombo ? `-Rs. ${lineSavings.toFixed(2)} (Combo)` : `-Rs. ${lineSavings.toFixed(2)}`;
        doc.text(label, colDisc, y + 2.5, { align: 'right' });
        doc.setTextColor(30, 41, 59);
      } else {
        doc.text('-', colDisc, y + 2.5, { align: 'right' });
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`Rs. ${item.lineTotal.toFixed(2)}`, colFinal, y + 2.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 8.5;
    });

    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginLeft, y, marginRight, y);
    y += 7;

    // Order Summary Calculation (Strictly avoiding double counting)
    const origMerchandiseValue = (bill.items || []).reduce((acc, item) => {
      const isCombo = Boolean(item.isCombo || item.productId?.includes('combo'));
      const origPrice = isCombo
        ? (item.originalCombinedValue ?? ((item.regularPricePerUnit || 600) * (item.piecesPerUnit || 3)))
        : (item.originalUnitPrice ?? item.unitPrice);
      return acc + (origPrice * item.qty);
    }, 0);

    const totalDiscount = (bill.totalReduction || 0) + (bill.comboSavings || 0);
    const finalPayable = bill.finalPayableAmount ?? (origMerchandiseValue - totalDiscount);

    // Customer Store Appreciation on the Left
    const termsStartY = y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Customer Notice:', marginLeft, termsStartY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('• Thank you for visiting Festival Clothing Menswear.', marginLeft, termsStartY + 5);
    doc.text('• We appreciate your valued business and support.', marginLeft, termsStartY + 9.5);

    // Order Summary Section on the Right
    const totalsLeft = 115;
    const totalsRight = marginRight - 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    doc.text('Original Merchandise Value:', totalsLeft, y);
    doc.text(`Rs. ${origMerchandiseValue.toFixed(2)}`, totalsRight, y, { align: 'right' });
    y += 5;

    if (bill.totalReduction > 0) {
      doc.setTextColor(5, 150, 105);
      doc.text('Individual Product Discounts:', totalsLeft, y);
      doc.text(`-Rs. ${(bill.totalReduction || 0).toFixed(2)}`, totalsRight, y, { align: 'right' });
      y += 5;
    }

    if (bill.comboSavings > 0) {
      doc.setTextColor(5, 150, 105);
      doc.text('Combo Savings:', totalsLeft, y);
      doc.text(`-Rs. ${(bill.comboSavings || 0).toFixed(2)}`, totalsRight, y, { align: 'right' });
      y += 5;
    }

    if (totalDiscount > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('Total Discount:', totalsLeft, y);
      doc.text(`-Rs. ${totalDiscount.toFixed(2)}`, totalsRight, y, { align: 'right' });
      y += 5.5;
    }

    // Grand Total Highlight Emerald Box
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(totalsLeft - 3, y - 1, 80, 9, 1, 1, 'F');
    doc.setDrawColor(5, 150, 105);
    doc.roundedRect(totalsLeft - 3, y - 1, 80, 9, 1, 1, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(6, 78, 59);
    doc.text('Final Payable Amount:', totalsLeft, y + 5.5);
    doc.text(`Rs. ${finalPayable.toFixed(2)}`, totalsRight, y + 5.5, { align: 'right' });
    y += 14;

    // Payment details box
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Payment Method: ${(bill.paymentMethod || 'cash').toUpperCase()}`, totalsLeft, y);
    y += 4.5;

    if (bill.paymentMethod === 'cash' && bill.tenderAmount) {
      doc.text(`Cash Received: Rs. ${Number(bill.tenderAmount).toFixed(2)}`, totalsLeft, y);
      y += 4.5;
      doc.text(`Change Returned: Rs. ${Number(bill.changeDue || 0).toFixed(2)}`, totalsLeft, y);
      y += 5;
    }

    // Natural vertical spacing to reach ~60-70% page height (around y=175mm–190mm)
    y = Math.max(y + 12, 175);

    // Clean Premium Thank You Footer with Rotating Festive Quote
    const festiveQuote = getBillFestiveQuote(bill);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(6, 78, 59);
    doc.text('THANK YOU FOR SHOPPING WITH US!', 105, y, { align: 'center' });
    y += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('We truly appreciate your support.', 105, y, { align: 'center' });
    y += 6;

    // Rotating Festive Quote
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(5, 150, 105);
    doc.text(`"${festiveQuote}"`, 105, y, { align: 'center', maxWidth: 160 });
    y += 7;

    // Bottom Separator
    doc.setDrawColor(209, 250, 229);
    doc.line(marginLeft, y, marginRight, y);
    y += 5;

    // Attribution branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(6, 78, 59);
    doc.text('FESTIVAL CLOTHING - MENSWEAR', 105, y, { align: 'center' });

    const fileName = `${bill.billNumber}_Invoice.pdf`;
    if (autoDownload) {
      doc.save(fileName);
    }
    const blob = doc.output('blob');
    return { doc, fileName, blob };
  }
}
