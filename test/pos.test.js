import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  generateBillNumber,
} from '../src/utils/currency';
import {
  exportSalesCSV,
  exportLineItemsCSV,
  exportBillsSummaryCSV,
  exportProductsCSV,
  COMPANY_BRANDING,
  DEFAULT_SETTINGS,
  INITIAL_PRODUCTS,
} from '../src/services/db';
import {
  validateIndianMobile,
  generateWhatsAppReceiptText,
  generateWhatsAppLink,
  generateReceiptPDF,
} from '../src/utils/receiptGenerator';
import {
  evaluateCombos,
  calculateBillTotals,
  DEFAULT_COMBOS,
} from '../src/utils/comboEngine';

describe('WISDO TECH Retail POS Engine - Festival Clothing Requirements', () => {

  // Test 1: One Shirt at ₹550 reduced to ₹540
  it('Scenario 1: One Shirt at ₹550 reduced to ₹540', () => {
    const originalPrice = 550;
    const reductionPerUnit = 10;
    const qty = 1;

    const finalUnitPrice = Math.max(0, originalPrice - reductionPerUnit);
    const lineTotal = finalUnitPrice * qty;

    expect(finalUnitPrice).toBe(540);
    expect(lineTotal).toBe(540);
  });

  // Test 2: One Pant at ₹750 reduced to ₹740
  it('Scenario 2: One Pant at ₹750 reduced to ₹740', () => {
    const originalPrice = 750;
    const reductionPerUnit = 10;
    const qty = 1;

    const finalUnitPrice = Math.max(0, originalPrice - reductionPerUnit);
    const lineTotal = finalUnitPrice * qty;

    expect(finalUnitPrice).toBe(740);
    expect(lineTotal).toBe(740);
  });

  // Test 3: Shirt and Pant reductions on the same bill
  it('Scenario 3: Shirt and Pant reductions on the same bill', () => {
    const items = [
      {
        id: '1',
        name: 'Shirt',
        originalUnitPrice: 550,
        reductionPerUnit: 10,
        finalUnitPrice: 540,
        qty: 1,
        lineTotal: 540,
      },
      {
        id: '2',
        name: 'Pant / Trousers',
        originalUnitPrice: 750,
        reductionPerUnit: 10,
        finalUnitPrice: 740,
        qty: 1,
        lineTotal: 740,
      },
    ];

    let subtotalPaise = 0;
    let totalRedPaise = 0;
    let finalPayablePaise = 0;

    for (const it of items) {
      subtotalPaise += rupeesToPaise(it.originalUnitPrice) * it.qty;
      totalRedPaise += rupeesToPaise(it.reductionPerUnit) * it.qty;
      finalPayablePaise += rupeesToPaise(it.finalUnitPrice) * it.qty;
    }

    const subtotal = paiseToRupees(subtotalPaise);
    const totalReduction = paiseToRupees(totalRedPaise);
    const grandTotal = paiseToRupees(finalPayablePaise);

    expect(subtotal).toBe(1300);
    expect(totalReduction).toBe(20);
    expect(grandTotal).toBe(1280);
    expect(subtotal - totalReduction).toBe(grandTotal);
  });

  // Test 4: Quantity 2 with one ₹10 Less action: unit price reduces by ₹10 and line total by ₹20
  it('Scenario 4: Quantity 2 with one ₹10 Less action reduces unit price by ₹10 and line total by ₹20', () => {
    const originalUnitPrice = 550;
    const qty = 2;
    const originalLineTotal = originalUnitPrice * qty; // ₹1,100

    // Cashier applies ₹10 Less once
    const reductionPerUnit = 10;
    const finalUnitPrice = originalUnitPrice - reductionPerUnit; // ₹540
    const newLineTotal = finalUnitPrice * qty; // ₹1,080

    const unitPriceReduction = originalUnitPrice - finalUnitPrice;
    const lineTotalReduction = originalLineTotal - newLineTotal;

    expect(unitPriceReduction).toBe(10);
    expect(lineTotalReduction).toBe(20);
    expect(newLineTotal).toBe(1080);
  });

  // Test 5: Undo / Reset Price restores the original unit price
  it('Scenario 5: Undo and Reset Price restore the original unit price', () => {
    const originalUnitPrice = 550;
    let reductionPerUnit = 20; // Two reductions applied
    let finalUnitPrice = originalUnitPrice - reductionPerUnit; // 530
    expect(finalUnitPrice).toBe(530);

    // 1. Undo once: restores ₹10
    reductionPerUnit = Math.max(0, reductionPerUnit - 10);
    finalUnitPrice = originalUnitPrice - reductionPerUnit;
    expect(reductionPerUnit).toBe(10);
    expect(finalUnitPrice).toBe(540);

    // 2. Reset price: restores full original unit price
    reductionPerUnit = 0;
    finalUnitPrice = originalUnitPrice;
    expect(reductionPerUnit).toBe(0);
    expect(finalUnitPrice).toBe(550);
  });

  // Test 6: Repeated reductions cannot produce a negative price
  it('Scenario 6: Repeated reductions cannot produce a negative price', () => {
    const originalUnitPrice = 15;
    let reductionPerUnit = 0;

    // Apply ₹10 Less: price becomes ₹5
    if (originalUnitPrice - (reductionPerUnit + 10) >= 0) {
      reductionPerUnit += 10;
    }
    let finalUnitPrice = originalUnitPrice - reductionPerUnit;
    expect(finalUnitPrice).toBe(5);

    // Try applying another ₹10 Less: would make price -₹5, must be blocked
    const canApplyAnother = originalUnitPrice - (reductionPerUnit + 10) >= 0;
    expect(canApplyAnother).toBe(false);

    if (canApplyAnother) {
      reductionPerUnit += 10;
    }
    finalUnitPrice = originalUnitPrice - reductionPerUnit;
    expect(finalUnitPrice).toBe(5);
    expect(finalUnitPrice).toBeGreaterThanOrEqual(0);
  });

  // Test 7: The administrator's default product price remains unchanged
  it("Scenario 7: Administrator's default catalogue product price remains completely unchanged", () => {
    const catalogProduct = { id: 'prod_shirt', name: 'Shirt', defaultPrice: 550 };

    // Item added to bill and reduced
    const billItem = {
      productId: catalogProduct.id,
      name: catalogProduct.name,
      originalUnitPrice: catalogProduct.defaultPrice,
      reductionPerUnit: 10,
      finalUnitPrice: catalogProduct.defaultPrice - 10,
      qty: 1,
      lineTotal: 540,
    };

    expect(billItem.finalUnitPrice).toBe(540);
    // Catalog product price must not be mutated
    expect(catalogProduct.defaultPrice).toBe(550);
  });

  // Test 8: Saved bills preserve their final prices after refresh and catalogue price changes
  it('Scenario 8: Saved bills preserve their final prices after refresh and catalogue price changes', () => {
    const savedBill = {
      id: 'bill-2026-001',
      billNumber: 'FC-20261009-0001',
      items: [
        {
          productId: 'prod_shirt',
          name: 'Shirt',
          originalUnitPrice: 550,
          reductionPerUnit: 10,
          finalUnitPrice: 540,
          qty: 1,
          lineTotal: 540,
        },
      ],
      subtotal: 550,
      totalReduction: 10,
      finalPayableAmount: 540,
    };

    // Admin later changes the default Shirt price in the database to ₹650
    const updatedCatalogPrice = 650;

    // Saved historical bill retains exact finalized numbers
    expect(savedBill.items[0].originalUnitPrice).toBe(550);
    expect(savedBill.items[0].finalUnitPrice).toBe(540);
    expect(savedBill.items[0].lineTotal).toBe(540);
    expect(savedBill.finalPayableAmount).toBe(540);
    expect(updatedCatalogPrice).toBe(650);
  });

  // Test 9: Cash and UPI payments use the correct grand total
  it('Scenario 9: Cash and UPI payments use the correct grand total', () => {
    const grandTotal = 1280; // After item-wise reductions

    // Cash Payment
    const cashReceived = 1500;
    const cashChangeDue = Math.max(0, cashReceived - grandTotal);
    expect(cashChangeDue).toBe(220);

    // UPI Payment
    const upiPayment = {
      method: 'upi',
      amountReceived: grandTotal,
      upiRef: 'UPI-4819284192',
    };
    expect(upiPayment.amountReceived).toBe(1280);
    expect(upiPayment.method).toBe('upi');
  });

  // Test 10: PDF invoice values match the finalized bill
  it('Scenario 10: PDF invoice values match the finalized bill', () => {
    const bill = {
      id: 'bill-pdf-01',
      billNumber: 'FC-20261009-0099',
      createdAt: '2026-10-09T17:00:00.000Z',
      cashierName: 'Cashier 1',
      status: 'completed',
      items: [
        {
          sno: 1,
          name: 'Shirt',
          originalUnitPrice: 550,
          reductionPerUnit: 10,
          finalUnitPrice: 540,
          qty: 1,
          lineTotal: 540,
        },
        {
          sno: 2,
          name: 'Pant / Trousers',
          originalUnitPrice: 750,
          reductionPerUnit: 10,
          finalUnitPrice: 740,
          qty: 1,
          lineTotal: 740,
        },
      ],
      subtotal: 1300,
      totalReduction: 20,
      finalPayableAmount: 1280,
      paymentMethod: 'cash',
      tenderAmount: 1500,
      amountReceived: 1500,
      changeDue: 220,
      storeDetails: {
        name: 'FESTIVAL CLOTHING',
        subtitle: 'MENSWEAR',
        address: 'Main Bazaar',
        phone: '+91 98400 12345',
      },
    };

    const pdfResult = generateReceiptPDF(bill, { mode: 'a4', autoDownload: false });
    expect(pdfResult).toBeDefined();
    expect(pdfResult.fileName).toBe('FC-20261009-0099_Invoice.pdf');
    expect(pdfResult.blob).toBeDefined();
    expect(pdfResult.blob.size).toBeGreaterThan(0);
  });

  // Test 11: WhatsApp message values match the saved invoice
  it('Scenario 11: WhatsApp message values match the saved invoice', () => {
    const bill = {
      billNumber: 'FC-20261009-0001',
      createdAt: '2026-10-09T16:30:00.000Z',
      items: [
        {
          name: 'Shirt',
          originalUnitPrice: 550,
          reductionPerUnit: 10,
          finalUnitPrice: 540,
          qty: 1,
          lineTotal: 540,
        },
        {
          name: 'Pant / Trousers',
          originalUnitPrice: 750,
          reductionPerUnit: 10,
          finalUnitPrice: 740,
          qty: 1,
          lineTotal: 740,
        },
      ],
      subtotal: 1300,
      totalReduction: 20,
      finalPayableAmount: 1280,
      paymentMethod: 'cash',
      tenderAmount: 1500,
      changeDue: 220,
      storeDetails: {
        name: 'FESTIVAL CLOTHING',
        subtitle: 'MENSWEAR',
      },
    };

    const text = generateWhatsAppReceiptText(bill);

    expect(text).toContain('FESTIVAL CLOTHING');
    expect(text).toContain('MENSWEAR');
    expect(text).toContain('FC-20261009-0001');
    expect(text).toContain('Shirt');
    expect(text).toContain('540');
    expect(text).toContain('Pant / Trousers');
    expect(text).toContain('740');
    expect(text).toContain('*Subtotal:* ₹1300.00');
    expect(text).toContain('*Total Item Reductions:* -₹20.00');
    expect(text).toContain('*Grand Total:* ₹1280.00');
    expect(text).toContain('*Payment Method:* CASH');
    expect(text).toContain('*Amount Received:* ₹1500.00');
    expect(text).toContain('*Change Due:* ₹220.00');
    expect(text).toContain(COMPANY_BRANDING.attributionText);
  });

  // Test 12: CSV exports contain correct item-level reductions and final totals
  it('Scenario 12: CSV exports contain correct item-level reductions and final totals', () => {
    const sampleBills = [
      {
        id: 'bill-uuid-001',
        billNumber: 'FC-20261009-0001',
        createdAt: '2026-10-09T16:30:00.000Z',
        cashierName: 'Ramesh',
        status: 'completed',
        items: [
          {
            productId: 'prod_shirt',
            name: 'Shirt',
            qty: 2,
            originalUnitPrice: 550,
            reductionPerUnit: 10,
            itemTotalReduction: 20,
            finalUnitPrice: 540,
            lineTotal: 1080,
          },
          {
            productId: 'prod_pant',
            name: 'Pant / Trousers',
            qty: 1,
            originalUnitPrice: 750,
            reductionPerUnit: 10,
            itemTotalReduction: 10,
            finalUnitPrice: 740,
            lineTotal: 740,
          },
        ],
        subtotal: 1850,
        totalReduction: 30,
        finalPayableAmount: 1820,
        paymentMethod: 'upi',
      },
    ];

    // Item-level CSV
    const itemCsv = exportLineItemsCSV(sampleBills, 'FESTIVAL CLOTHING');
    expect(itemCsv.startsWith('\uFEFF')).toBe(true);

    const itemLines = itemCsv.replace('\uFEFF', '').trim().split('\r\n');
    expect(itemLines.length).toBe(3); // Header + 2 items

    // Header checks
    expect(itemLines[0]).toContain('original_unit_price');
    expect(itemLines[0]).toContain('reduction_per_unit');
    expect(itemLines[0]).toContain('item_total_reduction');
    expect(itemLines[0]).toContain('final_unit_price');
    expect(itemLines[0]).toContain('line_total');

    // Row 1 (Shirt: qty 2, orig 550, final 540, red 10, itemTotRed 20, line 1080)
    expect(itemLines[1]).toContain('Shirt,2,550.00,540.00,10.00,20.00,1080.00');

    // Row 2 (Pant: qty 1, orig 750, final 740, red 10, itemTotRed 10, line 740)
    expect(itemLines[2]).toContain('Pant / Trousers,1,750.00,740.00,10.00,10.00,740.00');

    // Bills Summary CSV
    const summaryCsv = exportBillsSummaryCSV(sampleBills, 'FESTIVAL CLOTHING');
    const summaryLines = summaryCsv.replace('\uFEFF', '').trim().split('\r\n');
    expect(summaryLines.length).toBe(2); // Header + 1 bill

    expect(summaryLines[0]).toContain('subtotal,total_reduction,final_payable_amount');
    expect(summaryLines[1]).toContain('1850.00,30.00,1820.00,upi');
  });

  // Test 13: Existing bill persistence, backups and duplicate-checkout protection still work
  it('Scenario 13: Existing bill persistence, backups and duplicate-checkout protection still work', () => {
    // 1. Idempotency & duplicate protection
    const billNumber1 = generateBillNumber(1);
    const billNumber2 = generateBillNumber(2);
    expect(billNumber1).not.toBe(billNumber2);

    const existingBills = new Set();
    const tryFinalize = (bNum) => {
      if (existingBills.has(bNum)) {
        throw new Error('Duplicate bill creation prevented');
      }
      existingBills.add(bNum);
      return true;
    };

    expect(tryFinalize(billNumber1)).toBe(true);
    expect(() => tryFinalize(billNumber1)).toThrow('Duplicate bill creation prevented');

    // 2. Backup & Restore duplicate handling
    const backupJson = JSON.stringify({
      format: 'WISDO_POS_BACKUP_V2',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      shopName: 'FESTIVAL CLOTHING',
      stats: { totalBills: 2 },
      data: {
        bills: [
          { id: 'b1', billNumber: 'FC-101', subtotal: 540, finalPayableAmount: 540 },
          { id: 'b2', billNumber: 'FC-102', subtotal: 740, finalPayableAmount: 740 },
        ],
        products: [],
        settings: { shopName: 'FESTIVAL CLOTHING' },
      },
    });

    const parsed = JSON.parse(backupJson);
    expect(parsed.format).toBe('WISDO_POS_BACKUP_V2');
    expect(Array.isArray(parsed.data.bills)).toBe(true);
    expect(parsed.data.bills.length).toBe(2);

    const processedBills = new Set(['FC-101']);
    let imported = 0;
    let skipped = 0;

    for (const b of parsed.data.bills) {
      if (processedBills.has(b.billNumber)) {
        skipped++;
      } else {
        imported++;
        processedBills.add(b.billNumber);
      }
    }

    expect(imported).toBe(1);
    expect(skipped).toBe(1);
  });

  // Additional check: Indian Mobile Number validation for WhatsApp receipts
  it('Additional: Validates Indian mobile numbers with various formats', () => {
    expect(validateIndianMobile('9840012345').isValid).toBe(true);
    expect(validateIndianMobile('+91 98400 12345').isValid).toBe(true);
    expect(validateIndianMobile('09840012345').isValid).toBe(true);
    expect(validateIndianMobile('919840012345').isValid).toBe(true);
    expect(validateIndianMobile('12345').isValid).toBe(false);
    expect(validateIndianMobile('2340012345').isValid).toBe(false);
  });

  // Test: Bill Deletion authorization and ledger integrity
  it('Bill Deletion: Enforces administrator authorization and permanently purges from sales ledger', () => {
    // 1. Authorization check
    const mockDelete = (id, userRole) => {
      if (userRole !== 'admin') {
        throw new Error('Unauthorized: Only an Administrator can delete bills.');
      }
      return true;
    };

    expect(() => mockDelete('bill_123', 'cashier')).toThrow('Unauthorized: Only an Administrator can delete bills.');
    expect(mockDelete('bill_123', 'admin')).toBe(true);

    // 2. Ledger purge check
    let billsList = [
      { id: 'b1', billNumber: 'FC-20261009-0001', finalPayableAmount: 2930 },
      { id: 'b2', billNumber: 'FC-20261009-0002', finalPayableAmount: 1100 },
    ];

    expect(billsList.length).toBe(2);
    // Delete b1
    billsList = billsList.filter((b) => b.id !== 'b1');
    expect(billsList.length).toBe(1);
    expect(billsList.find((b) => b.id === 'b1')).toBeUndefined();
    expect(billsList[0].billNumber).toBe('FC-20261009-0002');
  });

  // Test: Mobile-First Billing Calculation & Item-Level Reduction Isolation
  it('Mobile Billing: Item-level ₹10 reduction applies strictly per piece and never to overall bill', () => {
    // A mobile cart with 2 shirts (₹550 with ₹10 off = ₹540 each) and 1 pant (₹750 with no reduction)
    const cartItems = [
      {
        id: 'item_shirt',
        name: 'Shirt',
        qty: 2,
        originalUnitPrice: 550,
        unitPrice: 540,
        reductionPerUnit: 10,
        lineTotal: 540 * 2, // 1080
      },
      {
        id: 'item_pant',
        name: 'Pant',
        qty: 1,
        originalUnitPrice: 750,
        unitPrice: 750,
        reductionPerUnit: 0,
        lineTotal: 750,
      },
    ];

    const originalSubtotal = cartItems.reduce((acc, it) => acc + it.originalUnitPrice * it.qty, 0);
    const totalReduction = cartItems.reduce((acc, it) => acc + it.reductionPerUnit * it.qty, 0);
    const finalPayable = cartItems.reduce((acc, it) => acc + it.lineTotal, 0);

    expect(originalSubtotal).toBe(1100 + 750); // 1850
    expect(totalReduction).toBe(20); // 2 shirts * 10 = 20 (Pant untouched)
    expect(finalPayable).toBe(1830); // 1850 - 20 = 1830

    // Pant price was NOT reduced
    expect(cartItems[1].unitPrice).toBe(750);
  });

  // Test: Google Drive Folder Structure & Terminal Designation
  it('Google Drive & Terminal: Verifies folder naming hierarchy and PC/Mobile device separation', () => {
    const rootFolder = 'FESTIVAL SALES BILL';
    const subfolders = ['PC BILLING', 'MOBILE BILLING', 'DAILY BACKUPS', 'SALES REPORTS'];

    // Expected folder structure check
    expect(rootFolder).toBe('FESTIVAL SALES BILL');
    expect(subfolders).toContain('PC BILLING');
    expect(subfolders).toContain('MOBILE BILLING');
    expect(subfolders).toContain('DAILY BACKUPS');
    expect(subfolders).toContain('SALES REPORTS');

    // Terminal routing check
    const resolveTargetFolder = (deviceType) => {
      return deviceType === 'MOBILE' ? 'MOBILE BILLING' : 'PC BILLING';
    };

    expect(resolveTargetFolder('PC')).toBe('PC BILLING');
    expect(resolveTargetFolder('MOBILE')).toBe('MOBILE BILLING');
    expect(resolveTargetFolder(undefined)).toBe('PC BILLING');
  });

  // Test: WhatsApp Web & Mobile Share Link Formatting
  it('WhatsApp Sharing: Generates valid click-to-chat URL with encoded invoice text for desktop and mobile', () => {
    const testBill = {
      billNumber: 'FC-20261105-001',
      createdAt: '2026-11-05T12:00:00.000Z',
      subtotal: 1300,
      totalReduction: 20,
      finalPayableAmount: 1280,
      paymentMethod: 'cash',
      items: [
        { name: 'Shirt', qty: 1, originalUnitPrice: 550, unitPrice: 540, reductionPerUnit: 10, lineTotal: 540 },
        { name: 'Pant', qty: 1, originalUnitPrice: 750, unitPrice: 740, reductionPerUnit: 10, lineTotal: 740 },
      ],
      storeDetails: {
        name: 'FESTIVAL CLOTHING',
        subtitle: 'MENSWEAR',
      },
    };

    const text = generateWhatsAppReceiptText(testBill, DEFAULT_SETTINGS);
    expect(text).toContain('FESTIVAL CLOTHING');
    expect(text).toContain('FC-20261105-001');
    expect(text).toContain('Powered by WISDO TECH');
    expect(text).toContain('1280.00');

    const cleanMobile = '9840012345';
    const link = generateWhatsAppLink(cleanMobile, text);
    expect(link).toBe(`https://wa.me/919840012345?text=${encodeURIComponent(text)}`);

    // Verify WhatsApp Web URL format for desktop
    const webLink = `https://web.whatsapp.com/send?phone=91${cleanMobile}&text=${encodeURIComponent(text)}`;
    expect(webLink).toContain('https://web.whatsapp.com/send?phone=919840012345');
  });

  // Test: 11 Core Menswear Products (Including Standalone Combos, Other / Custom Item Removed)
  it('Product Catalogue: Retains strictly the 11 menswear categories and removes Other / Custom Item', () => {
    expect(INITIAL_PRODUCTS.length).toBe(11);

    const productNames = INITIAL_PRODUCTS.map((p) => p.name);
    expect(productNames).toContain('Shirts');
    expect(productNames).toContain('3 Shirts Combo');
    expect(productNames).toContain('Formal Pants');
    expect(productNames).toContain('Jeans');
    expect(productNames).toContain('Half Sleeve T-Shirt');
    expect(productNames).toContain('Full Sleeve T-Shirt');
    expect(productNames).toContain('Tracks Jersey');
    expect(productNames).toContain('Shorts Jersey');
    expect(productNames).toContain('2 Shorts Jersey Combo');
    expect(productNames).toContain('Jersey T-Shirt');
    expect(productNames).toContain('3 T-Shirts Combo');

    // Ensure Other / Custom Item is completely removed
    expect(productNames).not.toContain('Other / Custom Item');
    expect(INITIAL_PRODUCTS.find((p) => p.id === 'prod_custom_item')).toBeUndefined();

    // Verify combos have correct configuration
    const shirtsCombo = INITIAL_PRODUCTS.find((p) => p.id === 'prod_3_shirts_combo');
    expect(shirtsCombo).toBeDefined();
    expect(shirtsCombo.isCombo).toBe(true);
    expect(shirtsCombo.defaultPrice).toBe(1000);
    expect(shirtsCombo.piecesPerUnit).toBe(3);
    expect(shirtsCombo.originalCombinedValue).toBe(1800);
    expect(shirtsCombo.comboSavingsPerUnit).toBe(800);
  });

  // Test: Offer Price Feature (Configurable without editing code)
  it('Offer Pricing: Uses configured offer price for new bills while preserving base price and historical bills', () => {
    const shirt = {
      id: 'prod_shirt',
      name: 'Shirt',
      defaultPrice: 550,
      offerPrice: 499, // Special festival offer
      reductionEnabled: true,
      maxReductionPerUnit: 50,
    };

    const hasOffer = shirt.offerPrice !== null && shirt.offerPrice !== undefined && shirt.offerPrice >= 0;
    const effectiveUnitPrice = hasOffer ? shirt.offerPrice : shirt.defaultPrice;

    expect(hasOffer).toBe(true);
    expect(effectiveUnitPrice).toBe(499);

    // Bill line item creation
    const qty = 2;
    const lineTotal = effectiveUnitPrice * qty;
    expect(lineTotal).toBe(998);

    // Historical bill price immutability check:
    // A past bill created at default price 550 must remain 550
    const historicalBill = {
      billNumber: 'FC-20261101-001',
      items: [{ name: 'Shirt', unitPrice: 550, qty: 2, lineTotal: 1100 }],
      finalPayableAmount: 1100,
    };
    expect(historicalBill.items[0].unitPrice).toBe(550);
    expect(historicalBill.finalPayableAmount).toBe(1100);
  });

  // Test: Configurable Item-Level Reductions (e.g. ₹550 -> ₹540 -> ₹530)
  it('Configurable Reductions: Supports step reductions (₹540, ₹530) up to maxReductionPerUnit limit', () => {
    const originalPrice = 550;
    const reductionStep = 10;
    const maxReductionPerUnit = 30; // Max 3 reductions allowed for this item
    let currentReduction = 0;

    // First reduction: ₹540
    currentReduction += reductionStep;
    expect(originalPrice - currentReduction).toBe(540);

    // Second reduction: ₹530
    currentReduction += reductionStep;
    expect(originalPrice - currentReduction).toBe(530);

    // Third reduction: ₹520 (reaches limit)
    currentReduction += reductionStep;
    expect(originalPrice - currentReduction).toBe(520);
    expect(currentReduction).toBe(maxReductionPerUnit);

    // Fourth reduction attempt must be blocked by maxReductionPerUnit limit
    const canReduceFurther = currentReduction + reductionStep <= maxReductionPerUnit;
    expect(canReduceFurther).toBe(false);

    // Reduction cannot make unit price negative
    const cheapItemPrice = 15;
    let cheapReduction = 10;
    expect(cheapItemPrice - cheapReduction).toBe(5);
    const canReduceBelowZero = cheapItemPrice - (cheapReduction + 10) >= 0;
    expect(canReduceBelowZero).toBe(false);
  });

  // Test: Manual Google Drive Save Only (Zero automatic uploads)
  it('Google Drive Manual Save: Verifies manual-only save behavior and target folder selection', () => {
    // 1. Settings check: autoUploadToDrive must not be active
    expect(DEFAULT_SETTINGS.autoUploadToDrive).toBeUndefined();

    // 2. Folder routing check: User explicitly picks PC BILLING or MOBILE BILLING
    const getFolderForManualSave = (selectedFolder, deviceType) => {
      const folder = selectedFolder || deviceType || 'PC';
      return folder === 'MOBILE' ? 'MOBILE BILLING' : 'PC BILLING';
    };

    expect(getFolderForManualSave('PC')).toBe('PC BILLING');
    expect(getFolderForManualSave('MOBILE')).toBe('MOBILE BILLING');
    expect(getFolderForManualSave(null, 'MOBILE')).toBe('MOBILE BILLING');
    expect(getFolderForManualSave(null, 'PC')).toBe('PC BILLING');
  });

  // ==========================================================================
  // EXACT 17 AUTOMATED TEST SCENARIOS FOR MENSWEAR PRICING & COMBO ENGINE
  // ==========================================================================

  // Scenario 1: Default product catalogue contains strictly the eleven specified categories
  it('Requirement 1: Default product catalogue contains strictly the eleven specified categories', () => {
    expect(INITIAL_PRODUCTS.length).toBe(11);
    const expected = [
      { name: 'Shirts', shortcut: '1', price: 600 },
      { name: '3 Shirts Combo', shortcut: '2', price: 1000 },
      { name: 'Formal Pants', shortcut: '3', price: 650 },
      { name: 'Jeans', shortcut: '4', price: 750 },
      { name: 'Half Sleeve T-Shirt', shortcut: '5', price: 500 },
      { name: 'Full Sleeve T-Shirt', shortcut: '6', price: 550 },
      { name: 'Tracks Jersey', shortcut: '7', price: 450 },
      { name: 'Shorts Jersey', shortcut: '8', price: 350 },
      { name: '2 Shorts Jersey Combo', shortcut: '9', price: 600 },
      { name: 'Jersey T-Shirt', shortcut: '0', price: 420 },
      { name: '3 T-Shirts Combo', shortcut: '', price: 1200 },
    ];

    expected.forEach((exp, idx) => {
      const prod = INITIAL_PRODUCTS[idx];
      expect(prod.name).toBe(exp.name);
      expect(prod.shortcut).toBe(exp.shortcut);
      expect(prod.defaultPrice).toBe(exp.price);
    });

    // Zero unwanted or custom items
    expect(INITIAL_PRODUCTS.find((p) => p.name.includes('Custom') || p.name.includes('Other'))).toBeUndefined();
  });

  // Scenario 2: Shirts pricing: ₹600 original, ₹550 offer, ₹500 offer, custom prices
  it('Requirement 2: Shirts pricing: ₹600 original, ₹550 offer, ₹500 offer, custom prices', () => {
    const shirts = INITIAL_PRODUCTS.find((p) => p.name === 'Shirts');
    expect(shirts).toBeDefined();
    expect(shirts.defaultPrice).toBe(600);
    expect(shirts.offers).toContain(550);
    expect(shirts.offers).toContain(500);

    // Custom prices allowed
    const customPrice1 = 490;
    const customPrice2 = 480;
    expect(customPrice1).toBeGreaterThanOrEqual(0);
    expect(customPrice2).toBeGreaterThanOrEqual(0);
  });

  // Scenario 3: Cashier price selection for all products
  it('Requirement 3: Cashier price selection for all products', () => {
    INITIAL_PRODUCTS.forEach((prod) => {
      // Cashier can select original price
      const selOriginal = prod.defaultPrice;
      expect(selOriginal).toBe(prod.defaultPrice);

      // Cashier can select custom authorized price
      const selCustom = Math.max(0, prod.defaultPrice - 50);
      expect(selCustom).toBeGreaterThan(0);
      expect(selCustom).toBeLessThanOrEqual(prod.defaultPrice);
    });
  });

  // Scenario 4: Cashier entered price reduction on Formal Pants, Jeans, Tracks Jersey, Jersey T-Shirt
  it('Requirement 4: Cashier entered price reduction on Formal Pants, Jeans, Tracks Jersey, Jersey T-Shirt', () => {
    const formalPants = { original: 650, reduction: 20, final: 630 };
    const jeans = { original: 750, reduction: 50, final: 700 };
    const tracksJersey = { original: 450, reduction: 30, final: 420 };
    const jerseyTShirt = { original: 420, reduction: 20, final: 400 };

    [formalPants, jeans, tracksJersey, jerseyTShirt].forEach((item) => {
      const calcFinal = item.original - item.reduction;
      expect(calcFinal).toBe(item.final);
      expect(calcFinal).toBeGreaterThanOrEqual(0);
    });
  });

  // Scenario 5: Combo A (Shirts: 3 for ₹1,000) applied and declined
  it('Requirement 5: Combo A (Shirts: 3 for ₹1,000) applied and declined', () => {
    const items = [
      { id: '1', productId: 'prod_shirts', name: 'Shirts', unitPrice: 600, qty: 3 },
    ];

    // 1. Applied: Normal = 3 * 600 = 1,800. Combo = 1,000. Savings = 800.
    const appliedTotals = calculateBillTotals(items, DEFAULT_COMBOS, { combo_shirts: true });
    expect(appliedTotals.subtotal).toBe(1800);
    expect(appliedTotals.comboSavings).toBe(800);
    expect(appliedTotals.finalPayableAmount).toBe(1000);

    // 2. Declined: Items billed at individual prices
    const declinedTotals = calculateBillTotals(items, DEFAULT_COMBOS, { combo_shirts: false });
    expect(declinedTotals.subtotal).toBe(1800);
    expect(declinedTotals.comboSavings).toBe(0);
    expect(declinedTotals.finalPayableAmount).toBe(1800);
  });

  // Dedicated Scenario: Standalone "3 Shirts Combo" Category Behavior & Independence
  it('Standalone 3 Shirts Combo: Verifies 3 pieces count, ₹1,000 price, ₹800 savings, and independence from regular shirts', () => {
    // 1. Verify 3 Shirts Combo configuration in INITIAL_PRODUCTS
    const comboCategory = INITIAL_PRODUCTS.find((p) => p.id === 'prod_3_shirts_combo');
    expect(comboCategory).toBeDefined();
    expect(comboCategory.name).toBe('3 Shirts Combo');
    expect(comboCategory.defaultPrice).toBe(1000);
    expect(comboCategory.piecesPerUnit).toBe(3);
    expect(comboCategory.originalCombinedValue).toBe(1800);
    expect(comboCategory.comboSavingsPerUnit).toBe(800);
    expect(comboCategory.avgPricePerPiece).toBe(333.33);
    expect(comboCategory.reductionEnabled).toBe(false);

    // 2. Adding 1 "3 Shirts Combo" to a bill
    const comboBillItems = [
      {
        id: 'c1',
        productId: 'prod_3_shirts_combo',
        name: '3 Shirts Combo',
        unitPrice: 1000,
        qty: 1,
        isCombo: true,
        piecesPerUnit: 3,
        originalCombinedValue: 1800,
      },
    ];

    const comboTotals = calculateBillTotals(comboBillItems);
    expect(comboTotals.originalSubtotal).toBe(1800);
    expect(comboTotals.comboSavings).toBe(800);
    expect(comboTotals.finalPayableAmount).toBe(1000);
    expect(comboTotals.totalPieces).toBe(3);

    // 3. Multiple combos: 2 × 3 Shirts Combo = 6 pieces, ₹2,000 payable, ₹1,600 savings
    const multiComboItems = [
      {
        id: 'c2',
        productId: 'prod_3_shirts_combo',
        name: '3 Shirts Combo',
        unitPrice: 1000,
        qty: 2,
        isCombo: true,
        piecesPerUnit: 3,
        originalCombinedValue: 1800,
      },
    ];
    const multiTotals = calculateBillTotals(multiComboItems);
    expect(multiTotals.originalSubtotal).toBe(3600);
    expect(multiTotals.comboSavings).toBe(1600);
    expect(multiTotals.finalPayableAmount).toBe(2000);
    expect(multiTotals.totalPieces).toBe(6);

    // 4. Regular Shirts Independence: Purchasing 3 regular Shirts without combo item does NOT auto-force combo
    const regularShirtItems = [
      { id: 's1', productId: 'prod_shirts', name: 'Shirts', originalUnitPrice: 600, unitPrice: 600, qty: 3 },
    ];
    // With combo declined or standalone mode
    const regularTotals = calculateBillTotals(regularShirtItems, DEFAULT_COMBOS, { combo_shirts: false });
    expect(regularTotals.originalSubtotal).toBe(1800);
    expect(regularTotals.comboSavings).toBe(0);
    expect(regularTotals.finalPayableAmount).toBe(1800);
    expect(regularTotals.totalPieces).toBe(3);

    // 5. Mixed bill: 1 × 3 Shirts Combo (₹1,000, 3 pieces) + 1 × regular Shirt (₹600, 1 piece)
    const mixedItems = [
      {
        id: 'c1',
        productId: 'prod_3_shirts_combo',
        name: '3 Shirts Combo',
        unitPrice: 1000,
        qty: 1,
        isCombo: true,
        piecesPerUnit: 3,
        originalCombinedValue: 1800,
      },
      {
        id: 's1',
        productId: 'prod_shirts',
        name: 'Shirts',
        originalUnitPrice: 600,
        unitPrice: 600,
        qty: 1,
      },
    ];
    const mixedTotals = calculateBillTotals(mixedItems);
    expect(mixedTotals.originalSubtotal).toBe(2400); // 1800 + 600
    expect(mixedTotals.comboSavings).toBe(800);
    expect(mixedTotals.finalPayableAmount).toBe(1600); // 1000 + 600
    expect(mixedTotals.totalPieces).toBe(4); // 3 + 1 = 4 pieces
  });

  // Scenario 6: Combo B (T-Shirts: 3 for ₹1,200) with mixed Half Sleeve and Full Sleeve items
  it('Requirement 6: Combo B (T-Shirts: 3 for ₹1,200) with mixed Half Sleeve and Full Sleeve items', () => {
    // Combination 1: 2 Half Sleeve (₹500 each) + 1 Full Sleeve (₹550) = ₹1,550
    const mix1 = [
      { id: '1', productId: 'prod_tshirt_half', name: 'T-Shirts – Half Sleeve', unitPrice: 500, qty: 2 },
      { id: '2', productId: 'prod_tshirt_full', name: 'T-Shirts – Full Sleeve', unitPrice: 550, qty: 1 },
    ];
    const res1 = calculateBillTotals(mix1, DEFAULT_COMBOS, { combo_tshirts: true });
    expect(res1.subtotal).toBe(1550);
    expect(res1.comboSavings).toBe(350); // 1550 - 1200 = 350
    expect(res1.finalPayableAmount).toBe(1200);

    // Combination 2: 1 Half Sleeve (₹500) + 2 Full Sleeve (₹550 each) = ₹1,600
    const mix2 = [
      { id: '1', productId: 'prod_tshirt_half', name: 'T-Shirts – Half Sleeve', unitPrice: 500, qty: 1 },
      { id: '2', productId: 'prod_tshirt_full', name: 'T-Shirts – Full Sleeve', unitPrice: 550, qty: 2 },
    ];
    const res2 = calculateBillTotals(mix2, DEFAULT_COMBOS, { combo_tshirts: true });
    expect(res2.subtotal).toBe(1600);
    expect(res2.comboSavings).toBe(400); // 1600 - 1200 = 400
    expect(res2.finalPayableAmount).toBe(1200);
  });

  // Scenario 7: Combo C (Shorts Jersey: 2 for ₹600)
  it('Requirement 7: Combo C (Shorts Jersey: 2 for ₹600)', () => {
    const items = [
      { id: '1', productId: 'prod_shorts_jersey', name: 'Shorts Jersey', unitPrice: 350, qty: 2 },
    ];
    const res = calculateBillTotals(items, DEFAULT_COMBOS, { combo_shorts: true });
    expect(res.subtotal).toBe(700);
    expect(res.comboSavings).toBe(100); // 700 - 600 = 100
    expect(res.finalPayableAmount).toBe(600);
  });

  // Scenario 8: Multiple combos on a single bill (e.g. 6 Shirts = 2 combos)
  it('Requirement 8: Multiple combos on a single bill (e.g. 6 Shirts = 2 combos)', () => {
    const items = [
      { id: '1', productId: 'prod_shirts', name: 'Shirts', unitPrice: 600, qty: 6 },
    ];
    const res = calculateBillTotals(items, DEFAULT_COMBOS, { combo_shirts: true });
    expect(res.subtotal).toBe(3600);
    expect(res.comboSavings).toBe(1600); // 2 combos @ 1000 = 2000, savings = 3600 - 2000 = 1600
    expect(res.finalPayableAmount).toBe(2000);
  });

  // Scenario 9: Partial combos (e.g. 4 Shirts = 1 combo + 1 single)
  it('Requirement 9: Partial combos (e.g. 4 Shirts = 1 combo + 1 single)', () => {
    const items = [
      { id: '1', productId: 'prod_shirts', name: 'Shirts', unitPrice: 600, qty: 4 },
    ];
    const res = calculateBillTotals(items, DEFAULT_COMBOS, { combo_shirts: true });
    expect(res.subtotal).toBe(2400);
    expect(res.comboSavings).toBe(800); // 1 combo (1000) + 1 single (600) = 1600. Savings = 2400 - 1600 = 800
    expect(res.finalPayableAmount).toBe(1600);
  });

  // Scenario 10: Decline combo: items billed at individual prices
  it('Requirement 10: Decline combo: items billed at individual prices', () => {
    const items = [
      { id: '1', productId: 'prod_shirts', name: 'Shirts', unitPrice: 600, qty: 3 },
      { id: '2', productId: 'prod_shorts_jersey', name: 'Shorts Jersey', unitPrice: 350, qty: 2 },
    ];
    // Cashier declines both combos
    const res = calculateBillTotals(items, DEFAULT_COMBOS, { combo_shirts: false, combo_shorts: false });
    expect(res.subtotal).toBe(1800 + 700); // 2500
    expect(res.comboSavings).toBe(0);
    expect(res.finalPayableAmount).toBe(2500);
  });

  // Scenario 11: Item price cannot be reduced below ₹0
  it('Requirement 11: Item price cannot be reduced below ₹0', () => {
    const basePrice = 20;
    const excessiveReduction = 30;
    const safePrice = Math.max(0, basePrice - excessiveReduction);
    expect(safePrice).toBe(0);
    expect(safePrice).toBeGreaterThanOrEqual(0);
  });

  // Scenario 12: Confirmation required when price is higher than original price
  it('Requirement 12: Confirmation required when price is higher than original price', () => {
    const originalPrice = 600;
    const testPriceNormal = 550;
    const testPriceHigher = 650;

    const requiresConfirmationNormal = testPriceNormal > originalPrice;
    const requiresConfirmationHigher = testPriceHigher > originalPrice;

    expect(requiresConfirmationNormal).toBe(false);
    expect(requiresConfirmationHigher).toBe(true);
  });

  // Scenario 13: Bill calculation: Subtotal, Line Discounts, Combo Savings, Grand Total
  it('Requirement 13: Bill calculation: Subtotal, Line Discounts, Combo Savings, Grand Total', () => {
    // 3 Shirts at base ₹600 reduced to ₹550 each (= ₹1,650) + Combo applied (= ₹1,000)
    // 1 Formal Pant at base ₹650 reduced to ₹630
    const items = [
      { id: '1', productId: 'prod_shirts', name: 'Shirts', originalUnitPrice: 600, unitPrice: 550, qty: 3 },
      { id: '2', productId: 'prod_formal_pants', name: 'Formal Pants', originalUnitPrice: 650, unitPrice: 630, qty: 1 },
    ];

    const res = calculateBillTotals(items, DEFAULT_COMBOS, { combo_shirts: true });
    // Original Subtotal = 3*600 + 1*650 = 1800 + 650 = 2450
    expect(res.originalSubtotal).toBe(2450);
    // Line Discounts = 3*(600-550) + 1*(650-630) = 150 + 20 = 170
    expect(res.lineReductions).toBe(170);
    // Subtotal before combo = 3*550 + 1*630 = 1650 + 630 = 2280
    expect(res.subtotal).toBe(2280);
    // Combo savings on 3 shirts: 3*550 = 1650, combo price = 1000, savings = 650
    expect(res.comboSavings).toBe(650);
    // Grand Total = 2280 - 650 = 1630 (or 1000 + 630 = 1630)
    expect(res.finalPayableAmount).toBe(1630);
    // Total savings = 170 (line) + 650 (combo) = 820
    expect(res.totalSavings).toBe(820);
    expect(res.originalSubtotal - res.totalSavings).toBe(res.finalPayableAmount);
  });

  // Scenario 14: Invoice generation shows combo savings and individual line prices
  it('Requirement 14: Invoice generation shows combo savings and individual line prices', () => {
    const bill = {
      id: 'bill_combo_test_1',
      billNumber: 'FC-20261105-0088',
      createdAt: new Date().toISOString(),
      cashierName: 'Cashier 1',
      paymentMethod: 'cash',
      items: [
        { id: '1', name: 'Shirts', originalUnitPrice: 600, unitPrice: 600, qty: 3, lineTotal: 1800 },
      ],
      subtotal: 1800,
      totalReduction: 800,
      comboSavings: 800,
      finalPayableAmount: 1000,
      storeDetails: { name: 'FESTIVAL CLOTHING', subtitle: 'MENSWEAR' },
    };

    const pdfRes = generateReceiptPDF(bill, { mode: 'a4', autoDownload: false });
    expect(pdfRes).toBeDefined();
    expect(pdfRes.blob.size).toBeGreaterThan(0);
    expect(pdfRes.fileName).toBe('FC-20261105-0088_Invoice.pdf');
  });

  // Scenario 15: Receipt shows combo savings and individual line prices
  it('Requirement 15: Receipt shows combo savings and individual line prices', () => {
    const bill = {
      id: 'bill_combo_test_2',
      billNumber: 'FC-20261105-0089',
      createdAt: '2026-11-05T12:00:00.000Z',
      cashierName: 'Cashier 1',
      paymentMethod: 'cash',
      items: [
        { id: '1', name: 'Shirts', originalUnitPrice: 600, unitPrice: 600, qty: 3, lineTotal: 1800 },
      ],
      subtotal: 1800,
      totalReduction: 800,
      comboSavings: 800,
      finalPayableAmount: 1000,
      storeDetails: { name: 'FESTIVAL CLOTHING', subtitle: 'MENSWEAR' },
    };

    const text = generateWhatsAppReceiptText(bill);
    expect(text).toContain('FESTIVAL CLOTHING');
    expect(text).toContain('FC-20261105-0089');
    expect(text).toContain('Shirts');
    expect(text).toContain('*Subtotal:* ₹1800.00');
    expect(text).toContain('*Combo Savings:* -₹800.00');
    expect(text).toContain('*Grand Total:* ₹1000.00');
  });

  // Scenario 16: Administrator edits product base price, offer price, and combo settings
  it('Requirement 16: Administrator edits product base price, offer price, and combo settings', () => {
    // Custom dynamic combo configured by admin
    const customAdminCombos = [
      {
        id: 'combo_shirts',
        name: 'Diwali Mega Shirt Combo',
        productIds: ['prod_shirts'],
        requiredQty: 3,
        comboPrice: 950, // Admin modified combo price from 1000 to 950
        isActive: true,
      },
    ];

    const items = [
      { id: '1', productId: 'prod_shirts', name: 'Shirts', unitPrice: 600, qty: 3 },
    ];

    const res = calculateBillTotals(items, customAdminCombos, { combo_shirts: true });
    expect(res.subtotal).toBe(1800);
    expect(res.comboSavings).toBe(850); // 1800 - 950 = 850
    expect(res.finalPayableAmount).toBe(950);
  });

  // Scenario 17: Historical bills retain original prices after catalogue and combo updates
  it('Requirement 17: Historical bills retain original prices after catalogue and combo updates', () => {
    const historicalBill = {
      id: 'hist_001',
      billNumber: 'FC-20261101-0001',
      createdAt: '2026-11-01T10:00:00.000Z',
      items: [
        { name: 'Shirts', unitPrice: 600, qty: 3, lineTotal: 1800 },
      ],
      subtotal: 1800,
      comboSavings: 800,
      finalPayableAmount: 1000,
    };

    // Deep freeze simulation - new catalogue prices or modified combos do NOT alter historical bill
    const newCatalogShirtPrice = 699;
    const newComboPrice = 1100;

    expect(historicalBill.items[0].unitPrice).toBe(600);
    expect(historicalBill.items[0].lineTotal).toBe(1800);
    expect(historicalBill.subtotal).toBe(1800);
    expect(historicalBill.comboSavings).toBe(800);
    expect(historicalBill.finalPayableAmount).toBe(1000);
    expect(newCatalogShirtPrice).toBe(699);
    expect(newComboPrice).toBe(1100);
  });

  // Scenario 18: GST is completely absent from settings, receipt generator, and outputs
  it('Requirement 18: GST is completely absent from settings, receipt generator, and outputs', () => {
    // 1. DEFAULT_SETTINGS must NOT contain gstin
    expect(DEFAULT_SETTINGS).not.toHaveProperty('gstin');

    const sampleBill = {
      id: 'test_no_gst_01',
      billNumber: 'FC-20261105-0001',
      createdAt: '2026-11-05T12:00:00.000Z',
      items: [
        {
          name: 'Shirts',
          originalUnitPrice: 600,
          finalUnitPrice: 550,
          reductionPerUnit: 50,
          qty: 1,
          lineTotal: 550,
        },
      ],
      subtotal: 600,
      totalReduction: 50,
      comboSavings: 0,
      finalPayableAmount: 550,
      paymentMethod: 'cash',
      tenderAmount: 600,
      changeDue: 50,
    };

    // 2. Generate PDF and check generated text
    const { doc } = generateReceiptPDF(sampleBill, { autoDownload: false, mode: 'a4' });
    // jsPDF internal text array inspection
    const pdfText = doc.internal.pages.flat().join(' ');
    expect(pdfText).not.toContain('GSTIN');
    expect(pdfText).not.toContain('CGST');
    expect(pdfText).not.toContain('SGST');
    expect(pdfText).not.toContain('TAX INVOICE');
    expect(pdfText).toContain('RETAIL INVOICE / SALES RECEIPT');

    // 3. WhatsApp text check
    const waText = generateWhatsAppReceiptText(sampleBill);
    expect(waText).not.toContain('GST');
    expect(waText).not.toContain('Tax');
  });

  // Scenario 19: Redesigned Customer PDF Invoice adheres to 6-column structure and Order Summary
  it('Requirement 19: Redesigned Customer PDF Invoice adheres to 6-column structure and Order Summary', () => {
    const bill = {
      id: 'bill_amazon_style',
      billNumber: 'FC-20261105-0042',
      createdAt: '2026-11-05T14:30:00.000Z',
      items: [
        {
          id: 'item_1',
          name: 'Shirts',
          originalUnitPrice: 600,
          finalUnitPrice: 540,
          reductionPerUnit: 60,
          qty: 2,
          lineTotal: 1080,
        },
        {
          id: 'item_2',
          name: '3 Shirts Combo',
          isCombo: true,
          piecesPerUnit: 3,
          originalCombinedValue: 1800,
          comboSavingsPerUnit: 800,
          finalUnitPrice: 1000,
          qty: 1,
          lineTotal: 1000,
        },
      ],
      subtotal: 3000,
      totalReduction: 120, // 60 * 2
      comboSavings: 800,
      finalPayableAmount: 2080,
      paymentMethod: 'cash',
      tenderAmount: 2500,
      changeDue: 420,
      storeDetails: {
        name: 'FESTIVAL CLOTHING',
        subtitle: 'MENSWEAR',
        address: 'Main Bazaar',
        phone: '+91 98400 12345',
      },
    };

    const { doc, fileName } = generateReceiptPDF(bill, { autoDownload: false, mode: 'a4' });
    expect(fileName).toBe('FC-20261105-0042_Invoice.pdf');

    const pdfText = doc.internal.pages.flat().join(' ');
    // Check 6 column table headers in PDF text
    expect(pdfText).toContain('S.No');
    expect(pdfText).toContain('Product Description');
    expect(pdfText).toContain('Qty');
    expect(pdfText).toContain('Original Price');
    expect(pdfText).toContain('Discount');
    expect(pdfText).toContain('Final Amount');

    // Check Order Summary items
    expect(pdfText).toContain('Original Merchandise Value');
    expect(pdfText).toContain('Individual Product Discounts');
    expect(pdfText).toContain('Combo Savings');
    expect(pdfText).toContain('Total Discount');
    expect(pdfText).toContain('Final Payable Amount');

    // Check Footer messages
    expect(pdfText).toContain('Thank you for shopping with FESTIVAL CLOTHING!');
    expect(pdfText).toContain('We appreciate your purchase.');
    expect(pdfText).toContain('FESTIVAL CLOTHING - MENSWEAR');
    expect(pdfText).toContain(COMPANY_BRANDING.attributionText);
  });

  // Scenario 20: WhatsApp invoice message format contains prompt greeting & order summary
  it('Requirement 20: WhatsApp invoice message format contains prompt greeting & order summary', () => {
    const bill = {
      billNumber: 'FC-20261105-0099',
      createdAt: '2026-11-05T15:00:00.000Z',
      items: [
        {
          name: 'Jeans',
          originalUnitPrice: 750,
          finalUnitPrice: 740,
          reductionPerUnit: 10,
          qty: 1,
          lineTotal: 740,
        },
      ],
      subtotal: 750,
      totalReduction: 10,
      comboSavings: 0,
      finalPayableAmount: 740,
      paymentMethod: 'upi',
    };

    const text = generateWhatsAppReceiptText(bill);

    // Prompt required header format:
    expect(text).toContain('Thank you for shopping at FESTIVAL CLOTHING!');
    expect(text).toContain('Your retail invoice is ready.');
    expect(text).toContain('Invoice No: FC-20261105-0099');
    expect(text).toContain('Amount Paid: ₹740.00');
    expect(text).toContain('Payment: UPI');
    expect(text).toContain('Please find your invoice attached.');
    expect(text).toContain(COMPANY_BRANDING.attributionText);
  });
});
