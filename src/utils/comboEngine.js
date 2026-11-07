import { rupeesToPaise, paiseToRupees } from './currency.js';

export const DEFAULT_COMBOS = [
  {
    id: 'combo_shirts',
    name: '3 Shirts Combo',
    description: '3 Shirts for ₹1,000',
    productIds: ['prod_shirts', 'prod_shirt'],
    requiredQty: 3,
    comboPrice: 1000,
    isActive: true,
  },
  {
    id: 'combo_tshirts',
    name: '3 T-Shirts Combo',
    description: '3 T-Shirts (Half or Full Sleeve) for ₹1,200',
    productIds: ['prod_tshirt_half', 'prod_tshirt_full', 'prod_half_sleeve_shirt', 'prod_full_sleeve_shirt', 'prod_tshirt'],
    requiredQty: 3,
    comboPrice: 1200,
    isActive: true,
  },
  {
    id: 'combo_shorts',
    name: '2 Shorts Jersey Combo',
    description: '2 Shorts Jersey for ₹600',
    productIds: ['prod_shorts_jersey', 'prod_shorts'],
    requiredQty: 2,
    comboPrice: 600,
    isActive: true,
  },
];

/**
 * Evaluates current cart items against active combo configurations (for legacy or auto-detection if enabled)
 */
export function evaluateCombos(items, combosConfig = DEFAULT_COMBOS, appliedComboIds = {}) {
  const activeCombos = (combosConfig || DEFAULT_COMBOS).filter((c) => c.isActive !== false);
  const results = [];

  // Exclude explicit standalone combo items from auto-grouping
  const regularItems = items.filter((it) => !it.isCombo && !it.productId?.includes('combo'));

  const itemUnits = [];
  regularItems.forEach((item, itemIdx) => {
    const qty = Math.max(0, parseInt(item.qty, 10) || 0);
    for (let u = 0; u < qty; u++) {
      itemUnits.push({
        unitId: `${item.id || item.productId}_${u}`,
        itemIndex: itemIdx,
        productId: item.productId,
        name: item.name,
        originalUnitPrice: Number(item.originalUnitPrice !== undefined ? item.originalUnitPrice : item.unitPrice),
        unitPrice: Number(item.unitPrice),
        isClaimed: false,
      });
    }
  });

  for (const combo of activeCombos) {
    const matchingProductIds = new Set(combo.productIds || []);

    const eligibleUnits = itemUnits.filter(
      (u) => !u.isClaimed && matchingProductIds.has(u.productId)
    );

    const requiredQty = Math.max(1, parseInt(combo.requiredQty, 10) || 1);
    const comboPrice = Math.max(0, parseFloat(combo.comboPrice) || 0);
    const possibleCount = Math.floor(eligibleUnits.length / requiredQty);

    if (possibleCount > 0) {
      eligibleUnits.sort((a, b) => b.unitPrice - a.unitPrice);

      const isApplied = appliedComboIds[combo.id] !== false;

      let totalNormalPriceForCombos = 0;
      const claimedUnitsInThisCombo = [];

      for (let c = 0; c < possibleCount; c++) {
        const comboUnits = eligibleUnits.slice(c * requiredQty, (c + 1) * requiredQty);
        const comboNormalPrice = comboUnits.reduce((sum, u) => sum + u.unitPrice, 0);
        totalNormalPriceForCombos += comboNormalPrice;

        if (isApplied) {
          comboUnits.forEach((u) => {
            u.isClaimed = true;
            claimedUnitsInThisCombo.push(u);
          });
        }
      }

      const totalComboCost = possibleCount * comboPrice;
      const potentialSavings = Math.max(0, totalNormalPriceForCombos - totalComboCost);

      results.push({
        comboId: combo.id,
        name: combo.name,
        description: combo.description,
        requiredQty,
        comboPrice,
        possibleCount,
        isApplied,
        totalComboCost,
        savings: isApplied ? potentialSavings : 0,
        potentialSavings,
        claimedUnitCount: isApplied ? claimedUnitsInThisCombo.length : 0,
      });
    }
  }

  return results;
}

/**
 * Calculates complete billing figures including Subtotal, Line Discounts, Combo Savings, and Grand Total
 * Supports both standalone combo products and auto-evaluated combos
 */
export function calculateBillTotals(items, combosConfig = DEFAULT_COMBOS, appliedComboIds = {}) {
  let originalSubtotalPaise = 0;
  let lineReductionsPaise = 0;
  let lineSubtotalPaise = 0;
  let standaloneComboSavingsPaise = 0;
  let totalPieces = 0;
  const appliedCombosList = [];

  for (const item of items) {
    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    const unitPaise = rupeesToPaise(item.unitPrice);

    // Standalone Combo product check
    const isCombo = Boolean(
      item.isCombo ||
      item.productId === 'prod_3_shirts_combo' ||
      item.productId === 'prod_2_shorts_combo' ||
      item.productId === 'prod_3_tshirts_combo'
    );

    if (isCombo) {
      const piecesPerCombo = Math.max(1, parseInt(item.piecesPerUnit, 10) || (item.productId === 'prod_2_shorts_combo' ? 2 : 3));
      const origCombinedUnit = item.originalCombinedValue !== undefined
        ? Number(item.originalCombinedValue)
        : (item.originalUnitPrice !== undefined
            ? Number(item.originalUnitPrice)
            : (item.regularPricePerUnit ? item.regularPricePerUnit * piecesPerCombo : (item.unitPrice + 800)));
      
      const origCombinedPaise = rupeesToPaise(origCombinedUnit);
      const savingsPerUnit = Math.max(0, origCombinedUnit - Number(item.unitPrice));
      const savingsPaise = rupeesToPaise(savingsPerUnit);

      originalSubtotalPaise += origCombinedPaise * qty;
      lineSubtotalPaise += unitPaise * qty;
      standaloneComboSavingsPaise += savingsPaise * qty;
      totalPieces += piecesPerCombo * qty;

      appliedCombosList.push({
        comboId: item.productId || item.id,
        name: item.name,
        description: `${piecesPerCombo} Pieces for ₹${item.unitPrice}`,
        savings: paiseToRupees(savingsPaise * qty),
        possibleCount: qty,
        isApplied: true,
      });
    } else {
      const originalUnitPaise = rupeesToPaise(item.originalUnitPrice !== undefined ? item.originalUnitPrice : item.unitPrice);

      originalSubtotalPaise += originalUnitPaise * qty;
      lineSubtotalPaise += unitPaise * qty;
      lineReductionsPaise += Math.max(0, originalUnitPaise - unitPaise) * qty;
      totalPieces += qty;
    }
  }

  // Auto-combo evaluation only applies if no standalone combo items exist and cart has eligible regular items
  let autoComboSavingsPaise = 0;
  let comboEvaluations = [];

  if (standaloneComboSavingsPaise === 0) {
    comboEvaluations = evaluateCombos(items, combosConfig, appliedComboIds);
    const activeApplied = comboEvaluations.filter((c) => c.isApplied && c.savings > 0);
    activeApplied.forEach((c) => {
      autoComboSavingsPaise += rupeesToPaise(c.savings);
      appliedCombosList.push(c);
    });
  }

  const totalComboSavingsPaise = standaloneComboSavingsPaise + autoComboSavingsPaise;
  const finalPayablePaise = Math.max(0, lineSubtotalPaise - autoComboSavingsPaise);
  const totalSavingsPaise = lineReductionsPaise + totalComboSavingsPaise;

  return {
    originalSubtotal: paiseToRupees(originalSubtotalPaise),
    lineReductions: paiseToRupees(lineReductionsPaise),
    subtotal: paiseToRupees(originalSubtotalPaise - lineReductionsPaise),
    comboSavings: paiseToRupees(totalComboSavingsPaise),
    totalSavings: paiseToRupees(totalSavingsPaise),
    totalReduction: paiseToRupees(totalSavingsPaise),
    finalPayableAmount: paiseToRupees(finalPayablePaise),
    totalPieces,
    comboEvaluations,
    appliedCombos: appliedCombosList,
  };
}
