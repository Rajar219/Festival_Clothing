import React from 'react';
import { formatINR, formatDateTime } from '../utils/currency';
import { COMPANY_BRANDING } from '../services/db';

export function ReceiptPrintView({ bill, mode = 'thermal' }) {
  if (!bill) return null;

  const store = bill.storeDetails || {
    name: 'FESTIVAL CLOTHING',
    subtitle: 'MENSWEAR',
    address: 'Shop No. 14, Main Bazaar, City Cloth Market',
    phone: '+91 98400 12345',
    receiptFooter: 'Wishing you a Happy & Prosperous Diwali! Exchanges accepted within 7 days with bill.',
    attributionText: COMPANY_BRANDING.attributionText,
    companyName: COMPANY_BRANDING.companyName,
  };

  const isThermal = mode === 'thermal';

  if (isThermal) {
    return (
      <div className="printable-receipt thermal-receipt">
        {/* Header with configured shop name and WISDO TECH attribution */}
        <div className="receipt-header">
          <h1 className="receipt-store-name">{store.name}</h1>
          <h2 className="receipt-subtitle">{store.subtitle}</h2>
          <div className="receipt-address">{store.address}</div>
          <div className="receipt-phone">Ph: {store.phone}</div>
        </div>

        <div className="receipt-divider-dashed" />

        {/* Bill Metadata */}
        <div className="receipt-meta-grid">
          <div className="meta-line">
            <span>Bill No:</span>
            <strong>{bill.billNumber}</strong>
          </div>
          <div className="meta-line">
            <span>Date & Time:</span>
            <span>{formatDateTime(bill.createdAt)}</span>
          </div>
          <div className="meta-line">
            <span>Cashier:</span>
            <span>{bill.cashierName || 'Cashier'}</span>
          </div>
          {bill.customerName && (
            <div className="meta-line">
              <span>Customer:</span>
              <span>{bill.customerName} {bill.customerPhone ? `(${bill.customerPhone})` : ''}</span>
            </div>
          )}
          {bill.status === 'cancelled' && (
            <div className="meta-line cancelled-flag">
              <span>STATUS:</span>
              <strong>*** CANCELLED ***</strong>
            </div>
          )}
        </div>

        <div className="receipt-divider-dashed" />

        {/* Items Table */}
        <table className="thermal-items-table">
          <thead>
            <tr>
              <th className="th-sno">#</th>
              <th className="th-item">Item</th>
              <th className="th-qty">Qty</th>
              <th className="th-rate">Rate</th>
              <th className="th-amount">Total</th>
            </tr>
          </thead>
          <tbody>
            {(bill.items || []).map((item, index) => {
              const orig = item.originalUnitPrice ?? item.unitPrice;
              const finalRate = item.finalUnitPrice ?? item.unitPrice;
              const red = item.reductionPerUnit || 0;
              return (
                <React.Fragment key={item.id || index}>
                  <tr>
                    <td className="td-sno">{item.sno || index + 1}</td>
                    <td className="td-item">
                      <div className="thermal-item-name">{item.name}</div>
                    </td>
                    <td className="td-qty">{item.qty}</td>
                    <td className="td-rate">₹{finalRate}</td>
                    <td className="td-amount">₹{item.lineTotal.toFixed(2)}</td>
                  </tr>
                  {red > 0 && (
                    <tr className="tr-discount-subnote">
                      <td></td>
                      <td colSpan="4" className="thermal-item-discount-note">
                        (Orig ₹{orig}, Less ₹{red}/pc × {item.qty} = -₹{item.itemTotalReduction || red * item.qty})
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        <div className="receipt-divider-dashed" />

        {/* Totals Section */}
        <div className="receipt-totals-section">
          <div className="total-line">
            <span>Subtotal:</span>
            <span>₹{(bill.subtotal || 0).toFixed(2)}</span>
          </div>

          {bill.totalReduction > 0 && (
            <div className="total-line discount-line">
              <span>Total Item Reductions:</span>
              <span>-₹{(bill.totalReduction || 0).toFixed(2)}</span>
            </div>
          )}

          <div className="total-line grand-total-line">
            <span>FINAL PAYABLE:</span>
            <strong>₹{(bill.finalPayableAmount || 0).toFixed(2)}</strong>
          </div>

          <div className="receipt-divider-dotted" />

          {/* Payment Details */}
          <div className="total-line">
            <span>Payment Mode:</span>
            <span>{bill.paymentMethod.toUpperCase()}</span>
          </div>

          {bill.paymentMethod === 'cash' && (
            <>
              {(bill.amountReceived || bill.tenderAmount) > 0 && (
                <div className="total-line">
                  <span>Amount Received:</span>
                  <span>₹{(bill.amountReceived || bill.tenderAmount || 0).toFixed(2)}</span>
                </div>
              )}
              {bill.changeDue > 0 && (
                <div className="total-line">
                  <span>Change Returned:</span>
                  <span>₹{(bill.changeDue || 0).toFixed(2)}</span>
                </div>
              )}
            </>
          )}

          {bill.paymentMethod === 'upi' && bill.upiRef && (
            <div className="total-line">
              <span>UPI Ref / UTR:</span>
              <span>{bill.upiRef}</span>
            </div>
          )}
        </div>

        <div className="receipt-divider-dashed" />

        {/* Footer with Mandatory Official WISDO TECH Attribution */}
        <div className="receipt-footer">
          <p className="thank-you-msg">*** THANK YOU FOR VISITING! ***</p>
          <p className="footer-custom-text">{store.receiptFooter}</p>
          <div className="receipt-divider-dotted" />
          <p className="wisdo-print-attribution">{COMPANY_BRANDING.attributionText}</p>
          <p className="wisdo-web-link">{COMPANY_BRANDING.companyName}</p>
        </div>
      </div>
    );
  }

  // A4 Layout with Amazon-inspired clean invoice clarity & Emerald green styling
  const origMerchandiseValue = (bill.items || []).reduce((acc, item) => {
    const isCombo = Boolean(item.isCombo || item.productId?.includes('combo'));
    const origPrice = isCombo
      ? (item.originalCombinedValue ?? ((item.regularPricePerUnit || 600) * (item.piecesPerUnit || 3)))
      : (item.originalUnitPrice ?? item.unitPrice);
    return acc + (origPrice * item.qty);
  }, 0);
  const totalDiscount = (bill.totalReduction || 0) + (bill.comboSavings || 0);
  const finalPayable = bill.finalPayableAmount ?? (origMerchandiseValue - totalDiscount);

  return (
    <div className="printable-receipt a4-receipt">
      <div className="a4-header-box">
        <div className="a4-header-left">
          <h1 className="a4-store-name">{store.name}</h1>
          <h2 className="a4-store-sub">{store.subtitle}</h2>
          <div className="a4-brand-subnote">{COMPANY_BRANDING.attributionText}</div>
          <p className="a4-store-addr">{store.address}</p>
          <p className="a4-store-contact">Phone: {store.phone}</p>
        </div>
        <div className="a4-header-right">
          <div className="invoice-title-chip">RETAIL INVOICE / SALES RECEIPT</div>
          <div className="a4-meta-row">
            <span>Invoice No:</span>
            <strong>{bill.billNumber}</strong>
          </div>
          <div className="a4-meta-row">
            <span>Date & Time:</span>
            <span>{formatDateTime(bill.createdAt)}</span>
          </div>
          <div className="a4-meta-row">
            <span>Status:</span>
            <strong style={{ color: bill.status === 'cancelled' ? '#dc2626' : '#059669' }}>
              {bill.status === 'cancelled' ? 'CANCELLED' : 'PAID'}
            </strong>
          </div>
          <div className="a4-meta-row">
            <span>Payment Method:</span>
            <span className="badge-payment-a4">{(bill.paymentMethod || 'cash').toUpperCase()}</span>
          </div>
        </div>
      </div>

      {bill.customerName && (
        <div className="a4-customer-banner">
          <span>Customer: <strong>{bill.customerName}</strong></span>
          {bill.customerPhone && <span> | Mobile: {bill.customerPhone}</span>}
        </div>
      )}

      {bill.status === 'cancelled' && (
        <div className="a4-cancelled-alert">
          *** THIS INVOICE IS CANCELLED - Reason: {bill.cancelReason || 'N/A'} ***
        </div>
      )}

      {/* 6-Column Itemized Product Table: | S.No | Product Description | Qty | Original Price | Discount | Final Amount | */}
      <table className="a4-items-table">
        <thead>
          <tr>
            <th style={{ width: '45px' }} className="text-center">S.No</th>
            <th>Product Description</th>
            <th style={{ width: '65px' }} className="text-center">Qty</th>
            <th style={{ width: '110px' }} className="text-right">Original Price</th>
            <th style={{ width: '110px' }} className="text-right">Discount</th>
            <th style={{ width: '120px' }} className="text-right">Final Amount</th>
          </tr>
        </thead>
        <tbody>
          {(bill.items || []).map((item, idx) => {
            const isCombo = Boolean(item.isCombo || item.productId?.includes('combo'));
            const origPrice = isCombo
              ? (item.originalCombinedValue ?? ((item.regularPricePerUnit || 600) * (item.piecesPerUnit || 3)))
              : (item.originalUnitPrice ?? item.unitPrice);
            const red = isCombo ? (item.comboSavingsPerUnit ?? 800) : (item.reductionPerUnit || 0);
            const lineSavings = red * item.qty;
            const displayName = isCombo ? `${item.name} (${item.piecesPerUnit || 3} Pcs)` : item.name;

            return (
              <tr key={item.id || idx}>
                <td className="text-center">{item.sno || idx + 1}</td>
                <td>
                  <strong>{displayName}</strong>
                  {isCombo && <div className="table-subnote">Combo Package</div>}
                </td>
                <td className="text-center">{item.qty}</td>
                <td className="text-right">₹{(origPrice * item.qty).toFixed(2)}</td>
                <td className="text-right" style={{ color: lineSavings > 0 ? '#059669' : 'inherit' }}>
                  {lineSavings > 0 ? `-₹${lineSavings.toFixed(2)}` : '-'}
                </td>
                <td className="text-right"><strong>₹{item.lineTotal.toFixed(2)}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Order Summary & Terms */}
      <div className="a4-summary-footer-grid">
        <div className="a4-terms-box">
          <h4>Terms & Conditions:</h4>
          <ul>
            <li>Goods once sold can be exchanged within 7 days with this original bill.</li>
            <li>Items must be unwashed, unworn, and retain all original retail tags.</li>
            <li>{store.receiptFooter}</li>
          </ul>
        </div>

        <div className="a4-totals-box">
          <div className="a4-row">
            <span>Original Merchandise Value:</span>
            <span>₹{origMerchandiseValue.toFixed(2)}</span>
          </div>
          {bill.totalReduction > 0 && (
            <div className="a4-row disc">
              <span>Individual Product Discounts:</span>
              <span>-₹{(bill.totalReduction || 0).toFixed(2)}</span>
            </div>
          )}
          {bill.comboSavings > 0 && (
            <div className="a4-row disc">
              <span>Combo Savings:</span>
              <span>-₹{(bill.comboSavings || 0).toFixed(2)}</span>
            </div>
          )}
          {totalDiscount > 0 && (
            <div className="a4-row disc font-bold">
              <span>Total Discount:</span>
              <span>-₹{totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="a4-row a4-grand-row">
            <span>Final Payable Amount:</span>
            <strong>₹{finalPayable.toFixed(2)}</strong>
          </div>
          <div className="a4-row">
            <span>Payment Method:</span>
            <span>{(bill.paymentMethod || 'cash').toUpperCase()}</span>
          </div>
          {bill.paymentMethod === 'cash' && (
            <>
              {(bill.amountReceived || bill.tenderAmount) > 0 && (
                <div className="a4-row">
                  <span>Cash Received:</span>
                  <span>₹{(bill.amountReceived || bill.tenderAmount || 0).toFixed(2)}</span>
                </div>
              )}
              {bill.changeDue > 0 && (
                <div className="a4-row">
                  <span>Change Returned:</span>
                  <span>₹{bill.changeDue.toFixed(2)}</span>
                </div>
              )}
            </>
          )}

          <div className="a4-signature-box">
            <span>Authorized Signatory</span>
            <div className="sig-line" />
            <small>{store.name}</small>
          </div>
        </div>
      </div>

      <div className="a4-footer-thanks">
        <p className="a4-thanks-main">Thank you for shopping with FESTIVAL CLOTHING!</p>
        <p className="a4-thanks-sub">We appreciate your purchase.</p>
      </div>

      <div className="a4-company-attribution">
        <strong>FESTIVAL CLOTHING — MENSWEAR</strong> • <span>{COMPANY_BRANDING.attributionText} / wisdotech.in</span>
      </div>
    </div>
  );
}
