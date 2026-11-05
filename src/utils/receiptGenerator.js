import { jsPDF } from 'jspdf';
import { formatINR, formatDateTime } from './currency';
import { COMPANY_BRANDING } from '../services/db';

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

/**
 * Generates formatted WhatsApp itemized receipt text from actual finalized transaction
 * Follows exact two-line greeting specification:
 * Line 1: Thanks for purchasing from FESTIVAL CLOTHING!
 * Line 2: We appreciate your support. Visit us again!
 */
export function generateWhatsAppReceiptText(bill, settings = {}) {
  const shopName = bill.storeDetails?.name || settings.shopName || 'FESTIVAL CLOTHING';
  const attribution = COMPANY_BRANDING.attributionText;
  const paymentUpper = (bill.paymentMethod || 'cash').toUpperCase();
  const grandTotal = (bill.finalPayableAmount || 0).toFixed(2);

  // Exact two-line greeting
  let text = `Thanks for purchasing from ${shopName.toUpperCase()}!\n\n`;
  text += `We appreciate your support. Visit us again!\n\n`;
  text += `*Invoice No:* ${bill.billNumber}\n`;
  text += `*Date:* ${formatDateTime(bill.createdAt)}\n`;
  text += `*Amount Paid:* ₹${grandTotal}\n`;
  text += `*Payment:* ${paymentUpper}\n\n`;
  text += `Please find your retail invoice attached.\n\n`;
  text += `_${attribution}_`;

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
  const mode = typeof options === 'string' ? options : (options.mode || 'a4');
  const autoDownload = typeof options === 'object' && options.autoDownload !== undefined ? options.autoDownload : true;

  // Exact shop address: No. 10/12, N.N. Garden, Old Washermenpet, Chennai - 21, Tamil Nadu.
  const store = {
    name: bill.storeDetails?.name || 'FESTIVAL CLOTHING',
    subtitle: bill.storeDetails?.subtitle || 'MENSWEAR',
    address: bill.storeDetails?.address && !bill.storeDetails.address.includes('Main Bazaar')
      ? bill.storeDetails.address
      : 'No. 10/12, N.N. Garden, Old Washermenpet, Chennai - 21, Tamil Nadu.',
    phone: bill.storeDetails?.phone && bill.storeDetails.phone !== '+91 98400 12345' ? bill.storeDetails.phone : '',
    receiptFooter: bill.storeDetails?.receiptFooter || 'Wishing you a Happy & Prosperous Diwali! Exchanges within 7 days with bill in original condition.',
  };

  if (mode === 'thermal') {
    // 80mm thermal receipt format (80mm width, dynamic height)
    const itemCount = bill.items?.length || 1;
    const estimatedHeight = Math.max(160, 110 + itemCount * 12);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, estimatedHeight],
    });

    let y = 10;
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.text(store.name, 40, y, { align: 'center' });
    y += 5;

    doc.setFontSize(9.5);
    doc.setFont('courier', 'normal');
    doc.text(store.subtitle, 40, y, { align: 'center' });
    y += 4.5;

    doc.setFontSize(7.5);
    doc.text(store.address, 40, y, { align: 'center', maxWidth: 70 });
    y += 8;

    if (store.phone) {
      doc.text(`Ph: ${store.phone}`, 40, y, { align: 'center' });
      y += 4.5;
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text('RETAIL INVOICE', 40, y, { align: 'center' });
    y += 4.5;

    doc.setLineDashPattern([1, 1], 0);
    doc.line(5, y, 75, y);
    y += 5;

    // Bill Meta
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.text(`Bill No: ${bill.billNumber}`, 5, y);
    y += 4;
    doc.text(`Date: ${formatDateTime(bill.createdAt)}`, 5, y);
    y += 4;
    doc.text(`Cashier: ${bill.cashierName || 'Cashier'}`, 5, y);
    if (bill.customerName) {
      y += 4;
      doc.text(`Cust: ${bill.customerName.substring(0, 20)}`, 5, y);
    }
    y += 4.5;

    doc.line(5, y, 75, y);
    y += 4.5;

    // Items table header
    doc.setFont('courier', 'bold');
    doc.text('Item', 5, y);
    doc.text('Qty', 38, y);
    doc.text('Rate', 48, y);
    doc.text('Total', 75, y, { align: 'right' });
    y += 3.5;
    doc.line(5, y, 75, y);
    y += 4;

    // Items
    doc.setFont('courier', 'normal');
    (bill.items || []).forEach((item) => {
      const finalPrice = item.finalUnitPrice ?? item.unitPrice;
      const red = item.reductionPerUnit || 0;
      const name = item.name.length > 17 ? item.name.substring(0, 15) + '..' : item.name;
      
      doc.text(name, 5, y);
      doc.text(String(item.qty), 40, y);
      doc.text(String(finalPrice), 48, y);
      doc.text(item.lineTotal.toFixed(2), 75, y, { align: 'right' });
      y += 4;

      if (item.isCombo) {
        doc.setFontSize(6.5);
        const pcs = (item.piecesPerUnit || 3) * item.qty;
        const savings = item.comboSavingsPerUnit ? (item.comboSavingsPerUnit * item.qty) : (item.comboSavings || 800);
        doc.text(` (${pcs} Pcs, Combo Savings: Rs.${savings})`, 5, y);
        doc.setFontSize(8);
        y += 3.5;
      } else if (red > 0) {
        doc.setFontSize(6.5);
        doc.text(` (Orig: Rs.${item.originalUnitPrice ?? item.unitPrice}, Less Rs.${red}/pc)`, 5, y);
        doc.setFontSize(8);
        y += 3.5;
      }
    });

    doc.line(5, y, 75, y);
    y += 4.5;

    // Totals
    doc.text('Subtotal:', 5, y);
    doc.text(`Rs. ${(bill.subtotal || 0).toFixed(2)}`, 75, y, { align: 'right' });
    y += 4.5;

    if (bill.totalReduction > 0) {
      doc.text(`Item Reductions:`, 5, y);
      doc.text(`-Rs. ${(bill.totalReduction || 0).toFixed(2)}`, 75, y, { align: 'right' });
      y += 4.5;
    }

    if (bill.comboSavings > 0) {
      doc.text(`Combo Savings:`, 5, y);
      doc.text(`-Rs. ${(bill.comboSavings || 0).toFixed(2)}`, 75, y, { align: 'right' });
      y += 4.5;
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.text('FINAL PAYABLE:', 5, y);
    doc.text(`Rs. ${(bill.finalPayableAmount || 0).toFixed(2)}`, 75, y, { align: 'right' });
    y += 5.5;

    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.text(`Payment: ${(bill.paymentMethod || 'cash').toUpperCase()}`, 5, y);
    y += 4;

    if (bill.paymentMethod === 'cash' && bill.tenderAmount) {
      doc.text(`Received: Rs. ${Number(bill.tenderAmount).toFixed(2)}`, 5, y);
      y += 3.5;
      doc.text(`Change Due: Rs. ${Number(bill.changeDue || 0).toFixed(2)}`, 5, y);
      y += 4.5;
    } else {
      y += 1;
    }

    doc.line(5, y, 75, y);
    y += 4.5;

    // Footer & Attribution
    doc.setFontSize(7);
    doc.text('Thanks for purchasing from FESTIVAL CLOTHING!', 40, y, { align: 'center' });
    y += 3.5;
    doc.text('We appreciate your support. Visit us again!', 40, y, { align: 'center' });
    y += 4;
    doc.text(COMPANY_BRANDING.attributionText, 40, y, { align: 'center' });
    y += 3.5;
    doc.text(COMPANY_BRANDING.companyName, 40, y, { align: 'center' });

    const fileName = `${bill.billNumber}_Thermal.pdf`;
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

    // Terms & Conditions on the Left
    const termsStartY = y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Terms & Conditions:', marginLeft, termsStartY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('• Goods once sold can be exchanged within 7 days with this bill.', marginLeft, termsStartY + 5);
    doc.text('• Items must be unwashed, unworn, and retain all original retail tags.', marginLeft, termsStartY + 9.5);
    if (store.receiptFooter) {
      doc.text(`• ${store.receiptFooter}`, marginLeft, termsStartY + 14, { maxWidth: 88 });
    }

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

    // Clean Two-Line Thank You Footer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(6, 78, 59);
    doc.text('Thank you for shopping with FESTIVAL CLOTHING!', 105, y, { align: 'center' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('We appreciate your purchase. Visit us again!', 105, y, { align: 'center' });
    y += 6;

    // Bottom Separator
    doc.setDrawColor(209, 250, 229);
    doc.line(marginLeft, y, marginRight, y);
    y += 5;

    // Attribution branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 78, 59);
    doc.text('FESTIVAL CLOTHING - MENSWEAR', 105, y, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(5, 150, 105);
    doc.text(`${COMPANY_BRANDING.attributionText} / wisdotech.in`, 105, y + 4.5, { align: 'center' });

    const fileName = `${bill.billNumber}_Invoice.pdf`;
    if (autoDownload) {
      doc.save(fileName);
    }
    const blob = doc.output('blob');
    return { doc, fileName, blob };
  }
}
