import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  rupeesToPaise,
  paiseToRupees,
  generateBillNumber,
} from '../utils/currency';
import {
  getAllProducts,
  updateProduct as updateProductInDB,
  getShopSettings,
  saveShopSettings as saveShopSettingsInDB,
  saveFinalizedBill,
  updateBillStatus,
  updateBillDriveStatus,
  getAllBills,
  cancelBill as cancelBillInDB,
  deleteBill as deleteBillInDB,
  getNextBillSequence,
  seedInitialDataIfEmpty,
  DEFAULT_SETTINGS,
  COMPANY_BRANDING,
  isStorageAvailable,
} from '../services/db';
import {
  isGoogleDriveConnected,
  connectGoogleDrive,
  disconnectGoogleDrive,
  uploadInvoicePDFToDrive,
  uploadBackupToDrive,
  uploadCSVReportToDrive,
} from '../services/googleDrive';
import { generateReceiptPDF } from '../utils/receiptGenerator';
import { calculateBillTotals, evaluateCombos, DEFAULT_COMBOS } from '../utils/comboEngine';

export const POSContext = createContext(null);

export function POSProvider({ children }) {
  // Navigation View: 'billing' | 'sales' | 'products' | 'settings'
  const [currentView, setCurrentView] = useState('billing');

  // Authentication & Role-based permissions
  // Roles: 'cashier' | 'admin'
  const [userRole, setUserRole] = useState('cashier'); // default cashier for desktop speed
  const [currentUserName, setCurrentUserName] = useState('Cashier 1');
  const isAdmin = userRole === 'admin';

  // Products from Database
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Shop Settings
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Active Bill State
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [appliedComboDecisions, setAppliedComboDecisions] = useState({});

  // Sales History
  const [allBills, setAllBills] = useState([]);
  const [isLoadingBills, setIsLoadingBills] = useState(true);

  // Modals
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState(null);
  const [billToPrint, setBillToPrint] = useState(null);
  const [activePrintMode, setActivePrintMode] = useState('thermal');
  const [lastFinalizedBill, setLastFinalizedBill] = useState(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  // Check Drive connection on mount
  useEffect(() => {
    setIsDriveConnected(isGoogleDriveConnected());
  }, []);

  // Submission lock to prevent duplicate checkouts
  const isSubmittingRef = useRef(false);

  // Toast notifications
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Initialize Data
  useEffect(() => {
    async function init() {
      try {
        await seedInitialDataIfEmpty();
        const loadedSettings = await getShopSettings();
        setSettings(loadedSettings);
        setActivePrintMode(loadedSettings.defaultPrintMode || 'thermal');

        const loadedProducts = await getAllProducts();
        setProducts(loadedProducts);
        setIsLoadingProducts(false);

        const loadedBills = await getAllBills();
        setAllBills(loadedBills);
        setIsLoadingBills(false);
      } catch (err) {
        console.error('Initialization error:', err);
        showToast('Initialization issue: ' + err.message, 'error');
        setIsLoadingProducts(false);
        setIsLoadingBills(false);
      }
    }
    init();
  }, [showToast]);

  // Billing calculation engine including combos and item-level reductions
  const billCalculations = useMemo(() => {
    return calculateBillTotals(items, settings.combos || DEFAULT_COMBOS, appliedComboDecisions);
  }, [items, settings.combos, appliedComboDecisions]);

  const {
    originalSubtotal,
    lineReductions,
    subtotal,
    comboSavings,
    totalReduction,
    finalPayableAmount,
    totalPieces,
    comboEvaluations,
    appliedCombos,
  } = billCalculations;

  // Toggle combo application
  const toggleCombo = useCallback((comboId, forcedState) => {
    setAppliedComboDecisions((prev) => {
      const currentState = prev[comboId] !== false; // default true when qualified
      const nextState = forcedState !== undefined ? forcedState : !currentState;
      showToast(nextState ? 'Combo offer applied!' : 'Combo offer declined.', 'info');
      return {
        ...prev,
        [comboId]: nextState,
      };
    });
  }, [showToast]);

  // Apply configurable item reduction (default ₹10 Less) to a specific line item
  const applyItemTenLess = useCallback(
    (itemId) => {
      if (settings.allowItemReductions === false) {
        showToast('Item reductions are currently disabled in store settings.', 'warning');
        return;
      }

      if (!isAdmin && settings.cashierCanReduce === false) {
        showToast('Unauthorized: Cashiers are not permitted to apply item reductions.', 'error');
        return;
      }

      const step = Math.max(1, Number(settings.reductionStepAmount) || 10);
      const stepPaise = step * 100;

      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            if (item.reductionEnabled === false) {
              showToast(`Reductions are disabled for ${item.name}.`, 'warning');
              return item;
            }

            const maxRed = item.maxReductionPerUnit !== undefined ? Number(item.maxReductionPerUnit) : (Number(settings.maxReductionsCount || 5) * step);
            const currentReduction = item.reductionPerUnit || 0;

            if (currentReduction + step > maxRed) {
              showToast(`Maximum permitted reduction of ₹${maxRed} reached for ${item.name}.`, 'warning');
              return item;
            }

            const currentUnitPaise = rupeesToPaise(item.unitPrice);
            if (currentUnitPaise < stepPaise) {
              showToast(`Cannot reduce ${item.name} unit price below ₹0.`, 'warning');
              return item;
            }

            const newUnitPaise = currentUnitPaise - stepPaise;
            const newUnitPrice = paiseToRupees(newUnitPaise);
            const reductionPerUnit = currentReduction + step;
            const lineTotal = paiseToRupees(newUnitPaise * item.qty);
            showToast(`Applied ₹${step} Less on ${item.name}: now ₹${newUnitPrice}/unit`, 'info');
            return {
              ...item,
              unitPrice: newUnitPrice,
              reductionPerUnit,
              lineTotal,
            };
          }
          return item;
        })
      );
    },
    [settings.allowItemReductions, settings.cashierCanReduce, settings.reductionStepAmount, settings.maxReductionsCount, isAdmin, showToast]
  );

  // Undo reduction on a specific line item
  const undoItemTenLess = useCallback(
    (itemId) => {
      const step = Math.max(1, Number(settings.reductionStepAmount) || 10);
      const stepPaise = step * 100;

      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId && (item.reductionPerUnit || 0) >= step) {
            const currentUnitPaise = rupeesToPaise(item.unitPrice);
            const newUnitPaise = currentUnitPaise + stepPaise;
            const newUnitPrice = paiseToRupees(newUnitPaise);
            const reductionPerUnit = Math.max(0, (item.reductionPerUnit || 0) - step);
            const lineTotal = paiseToRupees(newUnitPaise * item.qty);
            showToast(`Undid ₹${step} Less on ${item.name}: restored to ₹${newUnitPrice}/unit`, 'info');
            return {
              ...item,
              unitPrice: newUnitPrice,
              reductionPerUnit,
              lineTotal,
            };
          }
          return item;
        })
      );
    },
    [settings.reductionStepAmount, showToast]
  );

  // Reset line item price back to administrator configured price
  const resetItemPrice = useCallback((itemId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const configuredPrice = item.offerPrice !== null && item.offerPrice !== undefined
            ? Number(item.offerPrice)
            : (item.originalUnitPrice !== undefined ? Number(item.originalUnitPrice) : Number(item.unitPrice));
          const lineTotal = paiseToRupees(rupeesToPaise(configuredPrice) * item.qty);
          showToast(`Reset ${item.name} to configured price ₹${configuredPrice}/unit`, 'info');
          return {
            ...item,
            unitPrice: configuredPrice,
            reductionPerUnit: 0,
            lineTotal,
          };
        }
        return item;
      })
    );
  }, [showToast]);

  // Add Product to Bill (retrieves default or offer price from database)
  const addProductToBill = useCallback((product) => {
    if (!product || !product.isActive) {
      showToast('This product is currently inactive.', 'warning');
      return;
    }

    setItems((prev) => {
      // Check if product already exists in current bill
      const existingIdx = prev.findIndex((it) => it.productId === product.id);
      if (existingIdx >= 0) {
        // Increment quantity, keeping current unitPrice
        const updated = [...prev];
        const currentItem = updated[existingIdx];
        const newQty = (currentItem.qty || 1) + 1;
        const lineTotal = paiseToRupees(rupeesToPaise(currentItem.unitPrice) * newQty);
        updated[existingIdx] = {
          ...currentItem,
          qty: newQty,
          lineTotal,
        };
        return updated;
      }

      // Add as new line item with unit price from database
      const defaultPrice = Number(product.defaultPrice);
      const hasOffer = product.offerPrice !== null && product.offerPrice !== undefined && Number(product.offerPrice) >= 0;
      const effectivePrice = hasOffer ? Number(product.offerPrice) : defaultPrice;

      const isCombo = Boolean(product.isCombo || product.id?.includes('combo'));
      const piecesPerUnit = isCombo ? (product.piecesPerUnit || 3) : 1;

      const newItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        productId: product.id,
        name: product.name,
        image: product.image || `/products/${product.id.replace('prod_', '')}.jpg`,
        qty: 1,
        isCombo,
        piecesPerUnit,
        pieceUnitName: product.pieceUnitName || (isCombo ? 'Pieces' : ''),
        regularPricePerUnit: product.regularPricePerUnit,
        originalCombinedValue: product.originalCombinedValue,
        comboSavingsPerUnit: product.comboSavingsPerUnit,
        avgPricePerPiece: product.avgPricePerPiece,
        originalUnitPrice: isCombo ? (product.originalCombinedValue || 1800) : defaultPrice,
        offerPrice: hasOffer ? effectivePrice : null,
        unitPrice: effectivePrice,
        reductionEnabled: isCombo ? false : (product.reductionEnabled !== false),
        maxReductionPerUnit: isCombo ? 0 : (product.maxReductionPerUnit !== undefined ? Number(product.maxReductionPerUnit) : 150),
        reductionPerUnit: 0,
        lineTotal: effectivePrice,
      };

      const updated = [...prev, newItem];
      return updated.map((it, idx) => ({ ...it, sno: idx + 1 }));
    });

    const hasOffer = product.offerPrice !== null && product.offerPrice !== undefined && Number(product.offerPrice) >= 0;
    showToast(`Added ${product.name} (₹${hasOffer ? product.offerPrice : product.defaultPrice}) to bill`, 'info');
  }, [showToast]);

  // Add Product to bill with specific cashier price and quantity
  const addProductWithPrice = useCallback((product, price, qty = 1) => {
    if (!product || !product.isActive) {
      showToast('This product is currently inactive.', 'warning');
      return;
    }

    const defaultPrice = Number(product.defaultPrice);
    const chosenPrice = price !== undefined && !isNaN(price) && Number(price) >= 0 ? Number(price) : defaultPrice;
    const chosenQty = Math.max(1, parseInt(qty, 10) || 1);
    const lineTotal = paiseToRupees(rupeesToPaise(chosenPrice) * chosenQty);
    const isCombo = Boolean(product.isCombo || product.id?.includes('combo'));
    const piecesPerUnit = isCombo ? (product.piecesPerUnit || 3) : 1;
    const origPrice = isCombo ? (product.originalCombinedValue || 1800) : defaultPrice;
    const reduction = isCombo ? 0 : Math.max(0, defaultPrice - chosenPrice);

    setItems((prev) => {
      // If same product exists with same unitPrice, combine quantity
      const existingIdx = prev.findIndex((it) => it.productId === product.id && it.unitPrice === chosenPrice);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const currentItem = updated[existingIdx];
        const newQty = (currentItem.qty || 1) + chosenQty;
        updated[existingIdx] = {
          ...currentItem,
          qty: newQty,
          lineTotal: paiseToRupees(rupeesToPaise(chosenPrice) * newQty),
        };
        return updated;
      }

      const newItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        productId: product.id,
        name: product.name,
        image: product.image || `/products/${product.id.replace('prod_', '')}.jpg`,
        qty: chosenQty,
        isCombo,
        piecesPerUnit,
        pieceUnitName: product.pieceUnitName || (isCombo ? 'Pieces' : ''),
        regularPricePerUnit: product.regularPricePerUnit,
        originalCombinedValue: product.originalCombinedValue,
        comboSavingsPerUnit: product.comboSavingsPerUnit,
        avgPricePerPiece: product.avgPricePerPiece,
        originalUnitPrice: origPrice,
        unitPrice: chosenPrice,
        reductionEnabled: isCombo ? false : (product.reductionEnabled !== false),
        maxReductionPerUnit: isCombo ? 0 : (product.maxReductionPerUnit !== undefined ? Number(product.maxReductionPerUnit) : 150),
        reductionPerUnit: reduction,
        lineTotal,
      };

      const updated = [...prev, newItem];
      return updated.map((it, idx) => ({ ...it, sno: idx + 1 }));
    });

    showToast(`Added ${chosenQty}× ${product.name} @ ₹${chosenPrice}`, 'info');
  }, [showToast]);

  // Direct line item price adjustment
  const updateItemPrice = useCallback((itemId, newPrice, newQty) => {
    const priceNum = Math.max(0, parseFloat(newPrice) || 0);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const qty = newQty !== undefined ? Math.max(1, parseInt(newQty, 10) || 1) : (item.qty || 1);
          const origPrice = item.originalUnitPrice !== undefined ? item.originalUnitPrice : priceNum;
          const reduction = Math.max(0, origPrice - priceNum);
          const lineTotal = paiseToRupees(rupeesToPaise(priceNum) * qty);
          return {
            ...item,
            unitPrice: priceNum,
            qty,
            reductionPerUnit: reduction,
            lineTotal,
          };
        }
        return item;
      })
    );
    showToast('Updated price to ₹' + priceNum, 'info');
  }, [showToast]);

  // Update line item quantity
  const updateItemQty = useCallback((itemId, newQty) => {
    const qty = Math.max(1, parseInt(newQty, 10) || 1);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const lineTotal = paiseToRupees(rupeesToPaise(item.unitPrice) * qty);
          return { ...item, qty, lineTotal };
        }
        return item;
      })
    );
  }, []);

  // Remove line item
  const removeItem = useCallback((itemId) => {
    setItems((prev) => {
      const filtered = prev.filter((item) => item.id !== itemId);
      return filtered.map((item, index) => ({ ...item, sno: index + 1 }));
    });
  }, []);

  // Clear bill
  const clearBill = useCallback((askConfirmation = true) => {
    if (items.length > 0 && askConfirmation) {
      if (!window.confirm('Clear active bill? All items and adjustments will be reset.')) {
        return;
      }
    }
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
  }, [items.length]);

  // Start fresh bill
  const startNewBill = useCallback(() => {
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setIsCheckoutModalOpen(false);
    setIsSuccessModalOpen(false);
    setIsPrintPreviewOpen(false);
    setCurrentView('billing');
    showToast('New bill ready for next customer.', 'info');
  }, [showToast]);

  // Refresh bills
  const refreshBills = useCallback(async () => {
    try {
      const refreshed = await getAllBills();
      setAllBills(refreshed);
    } catch (err) {
      console.error('Failed to reload bills:', err);
    }
  }, []);

  // Finalize Checkout (Cash or UPI)
  const finalizeCheckout = useCallback(
    async (paymentDetails) => {
      if (isSubmittingRef.current) {
        console.warn('Checkout submission locked to prevent duplicate bill creation.');
        return false;
      }

      if (items.length === 0) {
        showToast('Cannot finalize an empty bill.', 'error');
        return false;
      }

      try {
        isSubmittingRef.current = true;

        const nextSeq = await getNextBillSequence();
        const billNumber = generateBillNumber(nextSeq);
        const billId = `bill_${Date.now()}_${nextSeq}`;

        const finalizedBill = {
          id: billId,
          billNumber,
          createdAt: new Date().toISOString(),
          cashierName: currentUserName,
          status: 'completed',
          items: items.map((it) => {
            const orig = it.originalUnitPrice !== undefined ? it.originalUnitPrice : it.unitPrice;
            const finalP = it.unitPrice;
            const red = it.reductionPerUnit !== undefined ? it.reductionPerUnit : Math.max(0, orig - finalP);
            return {
              id: it.id,
              productId: it.productId,
              name: it.name,
              qty: it.qty,
              originalUnitPrice: orig,
              unitPrice: finalP,
              reductionPerUnit: red,
              itemTotalReduction: paiseToRupees(rupeesToPaise(red) * it.qty),
              lineTotal: it.lineTotal,
            };
          }),
          subtotal,
          totalReduction,
          comboSavings,
          appliedCombos: appliedCombos.map((c) => ({
            id: c.comboId,
            name: c.name,
            savings: c.savings,
            count: c.possibleCount,
          })),
          finalPayableAmount,
          paymentMethod: paymentDetails.method, // 'cash' | 'upi'
          amountReceived: Number(paymentDetails.amountReceived) || finalPayableAmount,
          changeDue: Number(paymentDetails.changeDue) || 0,
          upiRef: paymentDetails.upiRef || '',
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          storeDetails: {
            name: settings.shopName,
            subtitle: settings.subtitle,
            address: settings.address,
            phone: settings.phone,
            receiptFooter: settings.receiptFooter,
            companyName: COMPANY_BRANDING.companyName,
            attributionText: COMPANY_BRANDING.attributionText,
          },
        };

        // Step 2: Persist atomically to IndexedDB FIRST
        const savedBill = await saveFinalizedBill(finalizedBill, currentUserName, userRole);

        // Update in-memory state and history
        setLastFinalizedBill(savedBill);
        setBillToPrint(savedBill);
        await refreshBills();

        // Clear active cart items now that bill is safely saved
        setItems([]);
        setCustomerName('');
        setCustomerPhone('');
        setAppliedComboDecisions({});

        // Step 3: Open Success confirmation modal
        setIsCheckoutModalOpen(false);
        setIsSuccessModalOpen(true);

        showToast(`Bill saved successfully! Bill No: ${billNumber}`, 'success');

        if (settings.autoPrintOnCheckout) {
          setTimeout(() => window.print(), 400);
        }

        return savedBill;
      } catch (err) {
        console.error('Finalize checkout local save error:', err);
        showToast('Local save failed: ' + err.message + '. Cart items preserved. Please retry.', 'error');
        return false;
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [
      items,
      subtotal,
      totalReduction,
      finalPayableAmount,
      currentUserName,
      userRole,
      customerName,
      customerPhone,
      settings,
      refreshBills,
      showToast,
    ]
  );

  // Admin: Update Product Default Price
  const updateProductPrice = useCallback(
    async (productId, newPrice) => {
      if (!isAdmin) {
        showToast('Unauthorized: Only Administrator can modify product prices.', 'error');
        return false;
      }

      try {
        const updated = await updateProductInDB(
          productId,
          { defaultPrice: newPrice },
          userRole,
          currentUserName
        );
        // Refresh products list
        const refreshed = await getAllProducts();
        setProducts(refreshed);
        showToast(`Updated price for ${updated.name} to ₹${newPrice}`, 'success');
        return true;
      } catch (err) {
        showToast('Failed to update product: ' + err.message, 'error');
        return false;
      }
    },
    [isAdmin, userRole, currentUserName, showToast]
  );

  // Admin: Update Full Product Configuration (Price, Offer Price, Reductions, Image, Name)
  const updateProductDetails = useCallback(
    async (productId, updates) => {
      if (!isAdmin) {
        showToast('Unauthorized: Only Administrator can modify product configurations.', 'error');
        return false;
      }

      try {
        const updated = await updateProductInDB(
          productId,
          updates,
          userRole,
          currentUserName
        );
        const refreshed = await getAllProducts();
        setProducts(refreshed);
        showToast(`Updated product settings for "${updated.name}"`, 'success');
        return true;
      } catch (err) {
        showToast('Failed to update product: ' + err.message, 'error');
        return false;
      }
    },
    [isAdmin, userRole, currentUserName, showToast]
  );

  // Admin: Toggle Product Active Status
  const toggleProductStatus = useCallback(
    async (productId, currentActive) => {
      if (!isAdmin) {
        showToast('Unauthorized: Only Administrator can change product status.', 'error');
        return false;
      }

      try {
        await updateProductInDB(
          productId,
          { isActive: !currentActive },
          userRole,
          currentUserName
        );
        const refreshed = await getAllProducts();
        setProducts(refreshed);
        showToast(`Product status updated.`, 'info');
        return true;
      } catch (err) {
        showToast('Failed to update product: ' + err.message, 'error');
        return false;
      }
    },
    [isAdmin, userRole, currentUserName, showToast]
  );

  // Admin: Save Shop Settings
  const updateSettings = useCallback(
    async (newSettings) => {
      if (!isAdmin) {
        showToast('Unauthorized: Only Administrator can update shop settings.', 'error');
        return false;
      }

      try {
        const updated = await saveShopSettingsInDB(newSettings, userRole, currentUserName);
        setSettings(updated);
        showToast('Shop settings updated successfully', 'success');
        return true;
      } catch (err) {
        showToast('Failed to save settings: ' + err.message, 'error');
        return false;
      }
    },
    [isAdmin, userRole, currentUserName, showToast]
  );

  // Admin: Cancel Bill with Audit Reason
  const cancelBill = useCallback(
    async (billId, reason) => {
      if (!isAdmin) {
        showToast('Unauthorized: Only Administrator can cancel finalized bills.', 'error');
        return false;
      }

      try {
        const updated = await cancelBillInDB(billId, reason, userRole, currentUserName);
        await refreshBills();
        showToast(`Bill ${updated.billNumber} cancelled with audit trail.`, 'warning');
        return updated;
      } catch (err) {
        showToast('Cancellation error: ' + err.message, 'error');
        throw err;
      }
    },
    [isAdmin, userRole, currentUserName, refreshBills, showToast]
  );

  // Admin: Delete Bill permanently with Audit Log
  const deleteBill = useCallback(
    async (billId) => {
      if (!isAdmin) {
        showToast('Unauthorized: Only Administrator can delete bills.', 'error');
        return false;
      }

      try {
        await deleteBillInDB(billId, userRole, currentUserName);
        await refreshBills();
        showToast('Bill deleted permanently from database.', 'success');
        return true;
      } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
        return false;
      }
    },
    [isAdmin, userRole, currentUserName, refreshBills, showToast]
  );

  // Role switching with pending navigation target resolution
  const loginAsAdmin = useCallback((pin) => {
    // Default PIN: 1234
    if (pin === '1234' || pin === 'admin') {
      setUserRole('admin');
      setCurrentUserName('Admin');
      setIsAdminAuthModalOpen(false);
      const target = pendingNavTarget || 'settings';
      setCurrentView(target);
      setPendingNavTarget(null);
      showToast('Logged in as Administrator (Full Access)', 'success');
      return true;
    } else {
      showToast('Invalid Administrator PIN.', 'error');
      return false;
    }
  }, [pendingNavTarget, showToast]);

  const switchRoleToCashier = useCallback(() => {
    setUserRole('cashier');
    setCurrentUserName('Cashier 1');
    setPendingNavTarget(null);
    if (currentView === 'products' || currentView === 'settings') {
      setCurrentView('billing');
    }
    showToast('Switched to Cashier mode.', 'info');
  }, [currentView, showToast]);

  // Update Bill status fields (whatsappStatus, pdfStatus, etc.) safely in IndexedDB
  const updateBillRecordStatus = useCallback(async (billId, statusUpdates) => {
    try {
      const updated = await updateBillStatus(billId, statusUpdates);
      if (updated) {
        setAllBills((prev) =>
          prev.map((b) => (b.id === billId ? { ...b, ...updated } : b))
        );
        setLastFinalizedBill((prev) => {
          if (prev && prev.id === billId) {
            return { ...prev, ...updated };
          }
          return prev;
        });
      }
      return updated;
    } catch (err) {
      console.error('Failed to update bill status:', err);
      return null;
    }
  }, []);

  // Google Drive Cloud Storage Integration
  const connectDrive = useCallback(async () => {
    try {
      showToast('Opening Google Authorization...', 'info');
      const res = await connectGoogleDrive(settings.googleClientId);
      setIsDriveConnected(true);
      showToast('Connected to Google Drive! Folders initialized.', 'success');
      return res;
    } catch (err) {
      showToast(`Drive connection failed: ${err.message}`, 'error');
      throw err;
    }
  }, [settings.googleClientId, showToast]);

  const disconnectDrive = useCallback(() => {
    disconnectGoogleDrive();
    setIsDriveConnected(false);
    showToast('Disconnected from Google Drive.', 'info');
  }, [showToast]);

  // Explicit Manual Save to Google Drive (Zero background or silent uploads)
  const manualSaveBillToDrive = useCallback(
    async (bill, targetFolder) => {
      if (!bill) return { success: false, error: 'No bill selected' };
      if (!isGoogleDriveConnected()) {
        showToast('Google Drive is not connected. Connect in Admin Settings first.', 'warning');
        return { success: false, error: 'DRIVE_NOT_CONNECTED' };
      }

      const folderToUse = targetFolder || settings.deviceType || 'PC';
      const folderDisplayName = folderToUse === 'MOBILE' ? 'MOBILE BILLING' : 'PC BILLING';

      try {
        showToast(`Saving invoice to Google Drive (${folderDisplayName})...`, 'info');
        const { blob } = generateReceiptPDF(bill, { mode: 'thermal', autoDownload: false });
        if (!blob) throw new Error('Failed to generate PDF document');

        const driveRes = await uploadInvoicePDFToDrive(bill, blob, folderToUse);
        if (driveRes.success) {
          const updated = await updateBillDriveStatus(bill.id, driveRes);
          if (lastFinalizedBill && lastFinalizedBill.id === bill.id) {
            setLastFinalizedBill(updated);
          }
          await refreshBills();
          showToast(`Saved to Google Drive (${driveRes.folderName})!`, 'success');
          return driveRes;
        } else {
          await updateBillDriveStatus(bill.id, { success: false, error: driveRes.error });
          showToast(`Drive save failed: ${driveRes.error}`, 'error');
          return driveRes;
        }
      } catch (err) {
        showToast(`Drive save error: ${err.message}`, 'error');
        return { success: false, error: err.message };
      }
    },
    [settings.deviceType, lastFinalizedBill, refreshBills, showToast]
  );

  const retryDriveUpload = manualSaveBillToDrive;

  // Trigger Print
  const triggerPrint = useCallback((bill, mode = 'thermal') => {
    setBillToPrint(bill);
    setActivePrintMode(mode);
    setIsPrintPreviewOpen(true);
  }, []);

  // Global Keyboard Navigation
  useEffect(() => {
    function handleKeyDown(e) {
      const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
      const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      // F2 or Alt+N: New Bill
      if (e.key === 'F2' || (e.altKey && (e.key === 'n' || e.key === 'N'))) {
        e.preventDefault();
        startNewBill();
        return;
      }

      // Alt+P: Reprint last receipt
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        if (lastFinalizedBill) {
          e.preventDefault();
          triggerPrint(lastFinalizedBill, settings.defaultPrintMode || 'thermal');
        }
        return;
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        if (isPrintPreviewOpen) setIsPrintPreviewOpen(false);
        else if (isSuccessModalOpen) setIsSuccessModalOpen(false);
        else if (isAdminAuthModalOpen) setIsAdminAuthModalOpen(false);
        return;
      }

      // Keys 1-8 for instant product selection (8 menswear categories)
      if (!isInput && currentView === 'billing' && !isSuccessModalOpen && !isPrintPreviewOpen && !isAdminAuthModalOpen) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 8 && products.length >= num) {
          e.preventDefault();
          const prod = products[num - 1];
          if (prod) {
            addProductToBill(prod);
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentView,
    products,
    isSuccessModalOpen,
    isPrintPreviewOpen,
    isAdminAuthModalOpen,
    lastFinalizedBill,
    settings.defaultPrintMode,
    startNewBill,
    addProductToBill,
    triggerPrint,
  ]);

  const value = {
    currentView,
    setCurrentView,
    userRole,
    currentUserName,
    isAdmin,
    loginAsAdmin,
    switchRoleToCashier,
    isAdminAuthModalOpen,
    setIsAdminAuthModalOpen,
    pendingNavTarget,
    setPendingNavTarget,
    updateBillRecordStatus,
    products,
    isLoadingProducts,
    updateProductPrice,
    updateProductDetails,
    toggleProductStatus,
    settings,
    updateSettings,
    items,
    addProductToBill,
    updateItemQty,
    removeItem,
    clearBill,
    startNewBill,
    applyItemTenLess,
    undoItemTenLess,
    resetItemPrice,
    totalPieces,
    totalReduction,
    comboSavings,
    comboEvaluations,
    appliedCombos,
    toggleCombo,
    subtotal,
    originalSubtotal,
    lineReductions,
    finalPayableAmount,
    addProductWithPrice,
    updateItemPrice,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    isCheckoutModalOpen,
    setIsCheckoutModalOpen,
    isSuccessModalOpen,
    setIsSuccessModalOpen,
    isPrintPreviewOpen,
    setIsPrintPreviewOpen,
    billToPrint,
    setBillToPrint,
    activePrintMode,
    setActivePrintMode,
    lastFinalizedBill,
    finalizeCheckout,
    isDriveConnected,
    connectDrive,
    disconnectDrive,
    retryDriveUpload,
    manualSaveBillToDrive,
    allBills,
    refreshBills,
    isLoadingBills,
    cancelBill,
    deleteBill,
    triggerPrint,
    toast,
    showToast,
    isStorageAvailable: isStorageAvailable(),
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
}
