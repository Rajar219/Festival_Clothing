import { jsPDF } from 'jspdf';
import { formatDateTime } from './currency';

/**
 * Groups bills by local calendar date (YYYY-MM-DD) for day-wise breakdown.
 * Excludes cancelled bills from completed revenue while tracking cancelled count.
 * Sorted descending (newest date first).
 */
export function groupBillsByDate(bills) {
  const groups = {};

  for (const b of (bills || [])) {
    const d = new Date(b.createdAt);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const sortKey = `${year}-${month}-${day}`;

    const displayDate = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });

    if (!groups[sortKey]) {
      groups[sortKey] = {
        sortKey,
        displayDate: `${displayDate} (${dayName})`,
        shortDate: displayDate,
        dateObj: d,
        totalBills: 0,
        completedBills: 0,
        cancelledBills: 0,
        totalSales: 0,
        cashSales: 0,
        upiSales: 0,
        itemDiscounts: 0,
        comboSavings: 0,
        pcSales: 0,
        pcCount: 0,
        mobileSales: 0,
        mobileCount: 0,
      };
    }

    const grp = groups[sortKey];
    grp.totalBills++;

    if (b.status === 'cancelled') {
      grp.cancelledBills++;
      continue;
    }

    grp.completedBills++;
    const amt = Number(b.finalPayableAmount) || 0;
    grp.totalSales += amt;
    grp.itemDiscounts += Number(b.totalReduction) || 0;
    grp.comboSavings += Number(b.comboSavings) || 0;

    if (b.paymentMethod === 'cash') {
      grp.cashSales += amt;
    } else if (b.paymentMethod === 'upi') {
      grp.upiSales += amt;
    }

    const term = (b.terminalType || 'PC').toUpperCase();
    if (term === 'MOBILE') {
      grp.mobileSales += amt;
      grp.mobileCount++;
    } else {
      grp.pcSales += amt;
      grp.pcCount++;
    }
  }

  return Object.values(groups).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

/**
 * Returns formatted period label from active filter
 */
export function getReportPeriodLabel(dateFilter, bills = []) {
  const filterKey = (dateFilter || 'today').toLowerCase();
  const now = new Date();
  const options = { day: '2-digit', month: 'short', year: 'numeric' };

  if (filterKey === 'today') {
    return `Today (${now.toLocaleDateString('en-IN', options)})`;
  }
  if (filterKey === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    return `Yesterday (${yest.toLocaleDateString('en-IN', options)})`;
  }
  if (filterKey === 'week') {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    return `Last 7 Days (${weekStart.toLocaleDateString('en-IN', options)} – ${now.toLocaleDateString('en-IN', options)})`;
  }
  if (filterKey === 'month') {
    const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return `This Month (${monthName})`;
  }
  if (filterKey === 'all') {
    if (bills && bills.length > 0) {
      const dates = bills.map((b) => new Date(b.createdAt).getTime());
      const minD = new Date(Math.min(...dates));
      const maxD = new Date(Math.max(...dates));
      return `All Time (${minD.toLocaleDateString('en-IN', options)} – ${maxD.toLocaleDateString('en-IN', options)})`;
    }
    return 'All Time Records';
  }
  return dateFilter.toUpperCase();
}

/**
 * Generates and downloads a professional A4 Daily Sales Summary PDF
 * 
 * Features:
 * - A4 Portrait (210mm x 297mm)
 * - Deep emerald and white branding matching Festival Clothing luxury menswear
 * - Executive 6-Core KPI Summary Grid
 * - Day-wise Sales Breakdown Table (Date, Total Bills, Cash, UPI, Total Sales)
 * - Daily Detailed Audit (Completed, Cancelled, Terminal Split, Customer Savings)
 * - Two-pass page numbering ("Page X of Y")
 * - Zero GST fields, zero WISDO TECH attribution on customer-facing/business PDF
 * - Parity verified: Cash + UPI = Total Sales
 */
export function generateSalesSummaryPDF({
  bills = [],
  stats = {},
  dateFilter = 'today',
  settings = {},
  autoDownload = true,
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 15;
  const marginRight = 195;
  const contentWidth = marginRight - marginLeft; // 180mm

  const store = {
    name: settings?.shopName || 'FESTIVAL CLOTHING',
    subtitle: 'MENSWEAR',
    address: 'No. 10/12, N.N Garden, Old Washermenpet, Chennai - 21, Tamil Nadu.',
    phone: settings?.phone || '',
  };

  const periodLabel = getReportPeriodLabel(dateFilter, bills);
  const generatedAtStr = formatDateTime(new Date().toISOString());
  const dayGroups = groupBillsByDate(bills);

  // Fallback stats computation if not provided
  const validBills = (bills || []).filter((b) => b.status !== 'cancelled');
  const cancelledBills = (bills || []).filter((b) => b.status === 'cancelled');

  const totalSales = stats.totalSales !== undefined
    ? stats.totalSales
    : validBills.reduce((acc, b) => acc + (Number(b.finalPayableAmount) || 0), 0);

  const cashTotal = stats.cashTotal !== undefined
    ? stats.cashTotal
    : validBills.filter((b) => b.paymentMethod === 'cash').reduce((acc, b) => acc + (Number(b.finalPayableAmount) || 0), 0);

  const upiTotal = stats.upiTotal !== undefined
    ? stats.upiTotal
    : validBills.filter((b) => b.paymentMethod === 'upi').reduce((acc, b) => acc + (Number(b.finalPayableAmount) || 0), 0);

  const totalDiscounts = stats.totalDiscounts !== undefined
    ? stats.totalDiscounts
    : validBills.reduce((acc, b) => acc + (Number(b.totalReduction) || 0), 0);

  const totalComboSavings = stats.comboSavings !== undefined
    ? stats.comboSavings
    : (stats.totalComboSavings !== undefined ? stats.totalComboSavings : validBills.reduce((acc, b) => acc + (Number(b.comboSavings) || 0), 0));

  const totalSavings = totalDiscounts + totalComboSavings;
  const grossValue = totalSales + totalSavings;

  const pcSales = stats.pcSales !== undefined
    ? stats.pcSales
    : validBills.filter((b) => (b.terminalType || 'PC').toUpperCase() !== 'MOBILE').reduce((acc, b) => acc + (Number(b.finalPayableAmount) || 0), 0);

  const pcCount = stats.pcCount !== undefined
    ? stats.pcCount
    : validBills.filter((b) => (b.terminalType || 'PC').toUpperCase() !== 'MOBILE').length;

  const mobileSales = stats.mobileSales !== undefined
    ? stats.mobileSales
    : validBills.filter((b) => (b.terminalType || 'PC').toUpperCase() === 'MOBILE').reduce((acc, b) => acc + (Number(b.finalPayableAmount) || 0), 0);

  const mobileCount = stats.mobileCount !== undefined
    ? stats.mobileCount
    : validBills.filter((b) => (b.terminalType || 'PC').toUpperCase() === 'MOBILE').length;

  const completedCount = validBills.length;
  const cancelledCount = cancelledBills.length;

  let y = 14;

  // Header renderer for page 1 and subsequent pages
  const renderHeader = (isFirstPage = false) => {
    // Top Emerald Accent Stripe
    doc.setFillColor(6, 78, 59); // Deep Emerald #064e3b
    doc.rect(0, 0, pageWidth, 5, 'F');

    if (isFirstPage) {
      y = 14;
      // Store Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(6, 78, 59);
      doc.text(store.name, marginLeft, y);

      // Subtitle
      doc.setFontSize(10);
      doc.setTextColor(5, 150, 105); // Emerald Green #059669
      doc.text(store.subtitle, marginLeft, y + 5.5);

      // Address
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(store.address, marginLeft, y + 10.5);

      // Right Header - Report Title & Meta
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(6, 78, 59);
      doc.text('DAILY SALES REPORT', marginRight, y, { align: 'right' });

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Period: ${periodLabel}`, marginRight, y + 5.5, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${generatedAtStr}`, marginRight, y + 10.5, { align: 'right' });

      y += 16;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(marginLeft, y, marginRight, y);
      y += 6;
    } else {
      y = 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(6, 78, 59);
      doc.text(`${store.name} — DAILY SALES REPORT`, marginLeft, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Period: ${periodLabel}`, marginRight, y, { align: 'right' });

      y += 4;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, y, marginRight, y);
      y += 6;
    }
  };

  // Check page overflow
  const ensureSpace = (neededHeight) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      renderHeader(false);
    }
  };

  // Page 1 Header
  renderHeader(true);

  // =========================================================================
  // SECTION A: OVERALL SALES SUMMARY (EXECUTIVE KPI GRID)
  // =========================================================================
  ensureSpace(42);

  // Section Heading
  doc.setFillColor(236, 253, 245); // #ecfdf5
  doc.rect(marginLeft, y, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text('1. OVERALL SALES SUMMARY', marginLeft + 3, y + 4.6);
  y += 9;

  // 4-Column KPI Cards Grid
  const cardW = (contentWidth - 9) / 4; // ~42.75mm
  const cardH = 14;

  const kpis = [
    { label: 'TOTAL SALES (NET)', val: `Rs. ${totalSales.toLocaleString('en-IN')}`, sub: `${completedCount} completed bill(s)` },
    { label: 'CASH COLLECTIONS', val: `Rs. ${cashTotal.toLocaleString('en-IN')}`, sub: `${((cashTotal / (totalSales || 1)) * 100).toFixed(1)}% of sales` },
    { label: 'UPI COLLECTIONS', val: `Rs. ${upiTotal.toLocaleString('en-IN')}`, sub: `${((upiTotal / (totalSales || 1)) * 100).toFixed(1)}% of sales` },
    { label: 'CUSTOMER SAVINGS', val: `Rs. ${totalSavings.toLocaleString('en-IN')}`, sub: `Disc: Rs. ${totalDiscounts.toLocaleString('en-IN')} | Combo: Rs. ${totalComboSavings.toLocaleString('en-IN')}` },
    { label: 'PC COUNTER SALES', val: `Rs. ${pcSales.toLocaleString('en-IN')}`, sub: `${pcCount} bill(s)` },
    { label: 'MOBILE TERMINAL', val: `Rs. ${mobileSales.toLocaleString('en-IN')}`, sub: `${mobileCount} bill(s)` },
    { label: 'VOIDED / CANCELLED', val: `${cancelledCount} bill(s)`, sub: 'Excluded from totals' },
    { label: 'GROSS MERCHANDISE', val: `Rs. ${grossValue.toLocaleString('en-IN')}`, sub: 'Original value before savings' },
  ];

  for (let i = 0; i < kpis.length; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = marginLeft + col * (cardW + 3);
    const cy = y + row * (cardH + 2.5);

    doc.setFillColor(248, 250, 252); // #f8fafc
    doc.setDrawColor(226, 232, 240); // #e2e8f0
    doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD');

    // KPI Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpis[i].label, cx + 3, cy + 4);

    // KPI Value
    doc.setFontSize(9.5);
    doc.setTextColor(6, 78, 59);
    doc.text(kpis[i].val, cx + 3, cy + 8.5);

    // KPI Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpis[i].sub, cx + 3, cy + 12);
  }

  y += (cardH * 2) + 7;

  // =========================================================================
  // SECTION B: DAY-WISE SALES BREAKDOWN TABLE
  // =========================================================================
  ensureSpace(35);

  doc.setFillColor(236, 253, 245);
  doc.rect(marginLeft, y, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text('2. DAY-WISE SALES BREAKDOWN', marginLeft + 3, y + 4.6);
  y += 8.5;

  // Table Column Positions
  const colDate = marginLeft + 3;
  const colBills = marginLeft + 70;
  const colCash = marginLeft + 115;
  const colUpi = marginLeft + 150;
  const colTotal = marginRight - 3;

  // Table Header Row
  doc.setFillColor(6, 78, 59);
  doc.rect(marginLeft, y, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Date', colDate, y + 4.5);
  doc.text('Total Bills', colBills, y + 4.5, { align: 'center' });
  doc.text('Cash (Rs.)', colCash, y + 4.5, { align: 'right' });
  doc.text('UPI (Rs.)', colUpi, y + 4.5, { align: 'right' });
  doc.text('Total Sales (Rs.)', colTotal, y + 4.5, { align: 'right' });
  y += 6.5;

  // Table Body Rows
  if (dayGroups.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No sales recorded for the selected period.', marginLeft + 3, y + 5);
    y += 8;
  } else {
    dayGroups.forEach((dayGrp, idx) => {
      ensureSpace(6);

      // Alternating row background
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginLeft, y, contentWidth, 5.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);

      doc.text(dayGrp.displayDate, colDate, y + 3.8);
      
      const billDetailStr = dayGrp.cancelledBills > 0
        ? `${dayGrp.completedBills} (${dayGrp.cancelledBills} void)`
        : `${dayGrp.completedBills}`;
      doc.text(billDetailStr, colBills, y + 3.8, { align: 'center' });

      doc.text(dayGrp.cashSales.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colCash, y + 3.8, { align: 'right' });
      doc.text(dayGrp.upiSales.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colUpi, y + 3.8, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.text(dayGrp.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colTotal, y + 3.8, { align: 'right' });

      // Subtle row border
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(marginLeft, y + 5.5, marginRight, y + 5.5);

      y += 5.5;
    });

    // Summary Total Row
    ensureSpace(7);
    doc.setFillColor(236, 253, 245); // #ecfdf5
    doc.rect(marginLeft, y, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 78, 59);

    doc.text('TOTAL', colDate, y + 4.5);
    doc.text(`${completedCount} Bills`, colBills, y + 4.5, { align: 'center' });
    doc.text(cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colCash, y + 4.5, { align: 'right' });
    doc.text(upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colUpi, y + 4.5, { align: 'right' });
    doc.text(totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colTotal, y + 4.5, { align: 'right' });

    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.4);
    doc.line(marginLeft, y, marginRight, y);
    doc.line(marginLeft, y + 6.5, marginRight, y + 6.5);

    y += 9.5;
  }

  // =========================================================================
  // SECTION C: DAILY DETAILS AUDIT
  // =========================================================================
  ensureSpace(28);

  doc.setFillColor(236, 253, 245);
  doc.rect(marginLeft, y, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text('3. DAILY DETAILS & TERMINAL SPLIT AUDIT', marginLeft + 3, y + 4.6);
  y += 9;

  dayGroups.forEach((dayGrp) => {
    ensureSpace(22);

    // Day Header Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginLeft, y, contentWidth, 19, 1.5, 1.5, 'FD');

    // Date Title Badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(6, 78, 59);
    doc.text(`* ${dayGrp.displayDate}`, marginLeft + 3.5, y + 5);

    // Sales total on the right
    doc.setFontSize(10);
    doc.setTextColor(6, 78, 59);
    doc.text(`Daily Sales: Rs. ${dayGrp.totalSales.toLocaleString('en-IN')}`, marginRight - 3.5, y + 5, { align: 'right' });

    // Inner details - Row 1: Bills & Collections
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Completed: ${dayGrp.completedBills} bill(s) | Voided: ${dayGrp.cancelledBills} bill(s) | Cash: Rs. ${dayGrp.cashSales.toLocaleString('en-IN')} | UPI: Rs. ${dayGrp.upiSales.toLocaleString('en-IN')}`,
      marginLeft + 3.5,
      y + 10
    );

    // Inner details - Row 2: Customer Savings & Terminals
    const savingsToday = dayGrp.itemDiscounts + dayGrp.comboSavings;
    doc.text(
      `Discounts: Rs. ${dayGrp.itemDiscounts.toLocaleString('en-IN')} | Combo Savings: Rs. ${dayGrp.comboSavings.toLocaleString('en-IN')} (Total Savings: Rs. ${savingsToday.toLocaleString('en-IN')})`,
      marginLeft + 3.5,
      y + 14.2
    );

    // Terminal Split badge right aligned
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(
      `PC: Rs. ${dayGrp.pcSales.toLocaleString('en-IN')} (${dayGrp.pcCount}) | Mobile: Rs. ${dayGrp.mobileSales.toLocaleString('en-IN')} (${dayGrp.mobileCount})`,
      marginRight - 3.5,
      y + 14.2,
      { align: 'right' }
    );

    y += 21.5;
  });

  // =========================================================================
  // FOOTER (TWO-PASS PAGE NUMBERING)
  // =========================================================================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footY = pageHeight - 9;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, footY - 3, marginRight, footY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.text('FESTIVAL CLOTHING — DAILY SALES REPORT', marginLeft, footY);
    doc.text(`Period: ${periodLabel}`, pageWidth / 2, footY, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, marginRight, footY, { align: 'right' });
  }

  const cleanPeriod = (dateFilter || 'today').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `FestivalClothing_SalesReport_${cleanPeriod}_${new Date().toISOString().slice(0, 10)}.pdf`;

  if (autoDownload) {
    doc.save(fileName);
  }

  const blob = doc.output('blob');
  return { doc, fileName, blob };
}

export default generateSalesSummaryPDF;
