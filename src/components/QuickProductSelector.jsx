import React, { useState, useMemo } from 'react';
import { usePOS } from '../context/POSContext';
import { Tag, Search, X, Sparkles, SlidersHorizontal, Package, Check } from 'lucide-react';
import { PriceSelectorModal } from './PriceSelectorModal';

const PRODUCT_IMAGE_FALLBACK = {
  prod_shirts: '/products/shirt.jpg',
  prod_3_shirts_combo: '/products/three_shirts_combo.jpg',
  prod_formal_pants: '/products/pant.jpg',
  prod_jeans: '/products/jeans.jpg',
  prod_tshirt_half: '/products/half_sleeve.jpg',
  prod_tshirt_full: '/products/full_sleeve.jpg',
  prod_tracks_jersey: '/products/tracks_jersey.jpg',
  prod_shorts_jersey: '/products/shorts.jpg',
  prod_2_shorts_combo: '/products/two_shorts_combo.jpg',
  prod_jersey_tshirt: '/products/jersey_tshirt.jpg',
  prod_3_tshirts_combo: '/products/three_tshirts_combo.jpg',
};

export function QuickProductSelector() {
  const { products, addProductToBill, addProductWithPrice } = usePOS();
  const [searchQuery, setSearchQuery] = useState('');
  const [pricingModalProduct, setPricingModalProduct] = useState(null);

  // Strictly active menswear products (excluding any custom item)
  const filteredProducts = useMemo(() => {
    const active = products.filter((p) => p.isActive && p.id !== 'prod_custom_item');
    if (!searchQuery.trim()) {
      return active;
    }
    const q = searchQuery.toLowerCase().trim();
    return active.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.shortcut && p.shortcut.includes(q))
    );
  }, [products, searchQuery]);

  const handleCardClick = (prod) => {
    if (prod.isCombo || prod.id?.includes('combo')) {
      // 1-click adds the combo pack directly to the bill
      addProductToBill(prod);
    } else {
      setPricingModalProduct(prod);
    }
  };

  const handleConfirmPrice = (price, qty) => {
    if (pricingModalProduct) {
      addProductWithPrice(pricingModalProduct, price, qty);
    }
  };

  return (
    <div className="quick-product-card">
      <div className="quick-product-header">
        <div className="quick-product-title-row">
          <div className="section-title-icon-wrap">
            <Tag size={16} className="section-icon" />
          </div>
          <div>
            <h2 className="section-title">Quick Add Products</h2>
            <p className="section-subtitle">Click card to add to bill • Press number keys <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd></p>
          </div>
        </div>

        {/* Product Search Bar */}
        <div className="product-search-wrapper">
          <Search size={15} className="search-icon-inside" />
          <input
            type="text"
            className="product-search-input"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search product catalogue"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="product-grid">
        {filteredProducts.map((prod) => {
          const isCombo = Boolean(prod.isCombo || prod.id?.includes('combo'));
          const hasOffer = !isCombo && prod.offerPrice !== null && prod.offerPrice !== undefined && Number(prod.offerPrice) >= 0;
          const displayPrice = hasOffer ? Number(prod.offerPrice) : Number(prod.defaultPrice);
          const imgSrc =
            prod.image ||
            PRODUCT_IMAGE_FALLBACK[prod.id] ||
            '/products/shirt.jpg';

          const offersList = Array.isArray(prod.offers) && prod.offers.length > 0
            ? prod.offers
            : (hasOffer ? [prod.offerPrice] : []);

          return (
            <div
              key={prod.id}
              id={`quick-prod-${prod.id}`}
              className={`product-card ${isCombo ? 'product-card-combo' : ''}`}
              onClick={() => handleCardClick(prod)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(prod);
                }
              }}
              title={isCombo ? `Click to add ${prod.name} (₹${prod.defaultPrice})` : `Click to select rate for ${prod.name}`}
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: isCombo ? '1.5px solid #059669' : undefined,
                background: isCombo ? '#fcfdfd' : undefined,
              }}
            >
              <div className="product-card-top">
                <div className="product-img-wrap" style={{ background: '#ffffff' }}>
                  <img
                    src={imgSrc}
                    alt={prod.name}
                    className="product-dress-photo"
                    loading="lazy"
                    style={{ objectFit: 'contain', width: '100%', height: '100%', maxHeight: '140px' }}
                    onError={(e) => {
                      e.target.src = '/products/shirt.jpg';
                    }}
                  />
                </div>

                {isCombo ? (
                  <span
                    className="product-combo-tag"
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      background: '#065f46',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
                    }}
                  >
                    <Package size={10} /> {prod.piecesPerUnit || 3} Pieces Combo
                  </span>
                ) : hasOffer ? (
                  <span
                    className="product-offer-tag"
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      background: '#059669',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    }}
                  >
                    <Sparkles size={10} /> Offer
                  </span>
                ) : null}

                {prod.shortcut && (
                  <span className="shortcut-key-chip" title={`Shortcut key: ${prod.shortcut}`}>
                    <kbd>{prod.shortcut}</kbd>
                  </span>
                )}
              </div>

              <div className="product-card-body">
                <span className="product-name" style={{ fontWeight: isCombo ? 700 : 600 }}>
                  {prod.name}
                </span>

                {/* Primary Price Display */}
                <div className="product-price-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span className="product-price-badge" style={{ background: isCombo ? '#065f46' : (hasOffer ? '#059669' : undefined) }}>
                    ₹{displayPrice}
                  </span>
                  {isCombo && prod.originalCombinedValue && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        textDecoration: 'line-through',
                        color: '#94a3b8',
                        fontWeight: 500,
                      }}
                    >
                      ₹{prod.originalCombinedValue}
                    </span>
                  )}
                  {hasOffer && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        textDecoration: 'line-through',
                        color: '#94a3b8',
                        fontWeight: 500,
                      }}
                    >
                      ₹{prod.defaultPrice}
                    </span>
                  )}
                </div>

                {/* Subtitle / Savings Pill */}
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {isCombo ? (
                    <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>
                      Saves ₹{prod.comboSavingsPerUnit || 800} (₹{prod.avgPricePerPiece || 333.33}/pc)
                    </span>
                  ) : offersList.length > 0 ? (
                    <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
                      Offers: {offersList.map((o) => `₹${o}`).join(', ')}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Editable Rate
                    </span>
                  )}

                  {!isCombo && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontWeight: 600,
                      }}
                    >
                      <SlidersHorizontal size={11} /> Price
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="no-products-found">
            <p>No products match "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Cashier Price Selector Modal */}
      {pricingModalProduct && (
        <PriceSelectorModal
          isOpen={Boolean(pricingModalProduct)}
          onClose={() => setPricingModalProduct(null)}
          product={pricingModalProduct}
          onConfirmPrice={handleConfirmPrice}
        />
      )}
    </div>
  );
}
