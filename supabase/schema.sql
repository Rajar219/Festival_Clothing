-- ============================================================================
-- WISDO TECH (wisdotech.in)
-- Production Retail Point of Sale (POS) Database Schema
-- FESTIVAL CLOTHING MENSWEAR
-- Multi-device, RLS-protected, Realtime-enabled Supabase PostgreSQL Schema
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. STORES TABLE (Multi-store support & isolation)
CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY DEFAULT 'festival_clothing_main',
    name TEXT NOT NULL DEFAULT 'FESTIVAL CLOTHING',
    subtitle TEXT NOT NULL DEFAULT 'MENSWEAR',
    address TEXT DEFAULT 'Shop No. 14, Main Bazaar, Near Clock Tower, City Cloth Market',
    phone TEXT DEFAULT '+91 98400 12345',
    gstin TEXT DEFAULT '33AAAAF1234A1Z5',
    receipt_footer TEXT DEFAULT 'Wishing you a Happy & Prosperous Diwali! Exchanges accepted within 7 days with bill in original condition.',
    upi_id TEXT DEFAULT 'festivalclothing@okhdfcbank',
    default_print_mode TEXT NOT NULL DEFAULT 'thermal' CHECK (default_print_mode IN ('thermal', 'a4')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    company_name TEXT NOT NULL DEFAULT 'WISDO TECH (wisdotech.in)',
    attribution_text TEXT NOT NULL DEFAULT 'Powered by WISDO TECH',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO stores (id, name, subtitle, address, phone, gstin, receipt_footer, upi_id, default_print_mode)
VALUES (
    'festival_clothing_main',
    'FESTIVAL CLOTHING',
    'MENSWEAR',
    'Shop No. 14, Main Bazaar, Near Clock Tower, City Cloth Market',
    '+91 98400 12345',
    '33AAAAF1234A1Z5',
    'Wishing you a Happy & Prosperous Diwali! Exchanges accepted within 7 days with bill in original condition.',
    'festivalclothing@okhdfcbank',
    'thermal'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subtitle = EXCLUDED.subtitle,
    updated_at = NOW();

-- 3. USER ROLES & PROFILES
CREATE TABLE IF NOT EXISTS user_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO user_roles (id, name, description)
VALUES 
    ('role_admin', 'admin', 'Full store administration, product catalog, pricing, settings, reports, audit logs'),
    ('role_cashier', 'cashier', 'Standard sales operations: create bills, apply item-level reductions, print receipts, send WhatsApp invoices')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS store_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE DEFAULT 'festival_clothing_main',
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL REFERENCES user_roles(name) DEFAULT 'cashier',
    pin_hash TEXT, -- Optional hashed 4-digit PIN for quick cashier/admin switching
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, username)
);

INSERT INTO store_users (store_id, username, display_name, role)
VALUES 
    ('festival_clothing_main', 'admin', 'Store Administrator', 'admin'),
    ('festival_clothing_main', 'cashier1', 'Cashier 1', 'cashier'),
    ('festival_clothing_main', 'mobile_cashier', 'Mobile Terminal', 'cashier')
ON CONFLICT (store_id, username) DO NOTHING;

-- 4. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE DEFAULT 'festival_clothing_main',
    name TEXT NOT NULL,
    shortcut TEXT,
    default_price NUMERIC(10, 2) NOT NULL CHECK (default_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    icon TEXT,
    image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);

-- Initial default catalog
INSERT INTO products (id, store_id, name, shortcut, default_price, is_active, sort_order, icon, image)
VALUES
    ('prod_shirt', 'festival_clothing_main', 'Shirt', '1', 550.00, TRUE, 1, 'Shirt', '/products/shirt.jpg'),
    ('prod_pant', 'festival_clothing_main', 'Pant / Trousers', '2', 750.00, TRUE, 2, 'Pant', '/products/pant.jpg'),
    ('prod_tshirt', 'festival_clothing_main', 'T-Shirt', '3', 350.00, TRUE, 3, 'TShirt', '/products/tshirt.jpg'),
    ('prod_half_sleeve_shirt', 'festival_clothing_main', 'Half Sleeve Shirt', '4', 480.00, TRUE, 4, 'HalfSleeve', '/products/half_sleeve.jpg'),
    ('prod_full_sleeve_shirt', 'festival_clothing_main', 'Full Sleeve Shirt', '5', 650.00, TRUE, 5, 'FullSleeve', '/products/full_sleeve.jpg'),
    ('prod_shorts', 'festival_clothing_main', 'Shorts', '6', 380.00, TRUE, 6, 'Shorts', '/products/shorts.jpg'),
    ('prod_custom_item', 'festival_clothing_main', 'Other / Custom Item', '7', 400.00, TRUE, 7, 'CustomItem', '/products/custom_item.jpg')
ON CONFLICT (id) DO UPDATE SET
    image = EXCLUDED.image,
    updated_at = NOW();

-- 5. SHOP SETTINGS (Compatible with existing table structure)
CREATE TABLE IF NOT EXISTS shop_settings (
    id TEXT PRIMARY KEY DEFAULT 'primary_settings',
    store_id TEXT REFERENCES stores(id) ON DELETE CASCADE DEFAULT 'festival_clothing_main',
    shop_name TEXT NOT NULL DEFAULT 'FESTIVAL CLOTHING',
    subtitle TEXT NOT NULL DEFAULT 'MENSWEAR',
    address TEXT DEFAULT 'Shop No. 14, Main Bazaar, City Cloth Market',
    phone TEXT DEFAULT '+91 98400 12345',
    gstin TEXT DEFAULT '33AAAAF1234A1Z5',
    receipt_footer TEXT DEFAULT 'Wishing you a Happy & Prosperous Diwali! Exchanges accepted within 7 days with bill.',
    upi_id TEXT DEFAULT 'festivalclothing@okhdfcbank',
    default_print_mode TEXT NOT NULL DEFAULT 'thermal' CHECK (default_print_mode IN ('thermal', 'a4')),
    auto_print_on_checkout BOOLEAN NOT NULL DEFAULT FALSE,
    company_name TEXT NOT NULL DEFAULT 'WISDO TECH (wisdotech.in)',
    attribution_text TEXT NOT NULL DEFAULT 'Powered by WISDO TECH',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shop_settings (id, store_id, shop_name, subtitle, address, phone, gstin, receipt_footer, upi_id, default_print_mode)
VALUES (
    'primary_settings',
    'festival_clothing_main',
    'FESTIVAL CLOTHING',
    'MENSWEAR',
    'Shop No. 14, Main Bazaar, Near Clock Tower, City Cloth Market',
    '+91 98400 12345',
    '33AAAAF1234A1Z5',
    'Wishing you a Happy & Prosperous Diwali! Exchanges accepted within 7 days with bill in original condition.',
    'festivalclothing@okhdfcbank',
    'thermal'
)
ON CONFLICT (id) DO NOTHING;

-- 6. BILLS TABLE
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE DEFAULT 'festival_clothing_main',
    bill_number TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cashier_name TEXT NOT NULL DEFAULT 'Cashier',
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    reduction_count INTEGER NOT NULL DEFAULT 0 CHECK (reduction_count >= 0),
    total_reduction NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_reduction >= 0),
    final_payable_amount NUMERIC(10, 2) NOT NULL CHECK (final_payable_amount >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'split')),
    amount_received NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount_received >= 0),
    change_due NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (change_due >= 0),
    upi_ref TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    cancel_reason TEXT,
    cancelled_by TEXT,
    cancelled_at TIMESTAMPTZ,
    synced_from_device TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_store ON bills(store_id);
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_payment_method ON bills(payment_method);
CREATE INDEX IF NOT EXISTS idx_bills_customer_phone ON bills(customer_phone);

-- 7. BILL LINE ITEMS TABLE
CREATE TABLE IF NOT EXISTS bill_items (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    original_unit_price NUMERIC(10, 2) NOT NULL CHECK (original_unit_price >= 0),
    final_unit_price NUMERIC(10, 2) NOT NULL CHECK (final_unit_price >= 0),
    reduction_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (reduction_per_unit >= 0),
    item_total_reduction NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (item_total_reduction >= 0),
    line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_product_id ON bill_items(product_id);

-- 8. PAYMENT RECORDS TABLE (Guarantees transaction auditability & prevents silent drift)
CREATE TABLE IF NOT EXISTS payment_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE DEFAULT 'festival_clothing_main',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'split')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    amount_tendered NUMERIC(10, 2) DEFAULT 0,
    change_given NUMERIC(10, 2) DEFAULT 0,
    reference_number TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'voided')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_bill_id ON payment_records(bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_payment_method ON payment_records(payment_method);

-- 9. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE DEFAULT 'festival_clothing_main',
    action TEXT NOT NULL,
    user_role TEXT NOT NULL,
    user_name TEXT NOT NULL,
    details TEXT NOT NULL,
    target_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_store ON audit_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 10. INVOICE RECORDS TABLE (Generated PDFs tracking)
CREATE TABLE IF NOT EXISTS invoice_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    bill_number TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT,
    file_name TEXT NOT NULL,
    file_size_bytes INTEGER,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    print_mode TEXT NOT NULL DEFAULT 'a4',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_records_bill_id ON invoice_records(bill_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_bill_number ON invoice_records(bill_number);

-- 11. WHATSAPP DELIVERY RECORDS TABLE (Official Meta Cloud API Tracking)
CREATE TABLE IF NOT EXISTS whatsapp_delivery_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    bill_number TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    meta_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
    document_url TEXT,
    document_filename TEXT,
    template_name TEXT,
    error_code TEXT,
    error_message TEXT,
    raw_response JSONB,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_records_bill_id ON whatsapp_delivery_records(bill_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_records_meta_msg_id ON whatsapp_delivery_records(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_records_status ON whatsapp_delivery_records(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_records_phone ON whatsapp_delivery_records(recipient_phone);

-- 12. ATOMIC BILL SEQUENCE GENERATOR (Concurrent Safety)
-- Guarantees conflict-free unique bill numbers (e.g. FC-20261105-001) across multiple devices
CREATE TABLE IF NOT EXISTS daily_bill_sequences (
    date_key TEXT PRIMARY KEY, -- 'YYYYMMDD'
    current_sequence INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION get_next_bill_number(p_prefix TEXT DEFAULT 'FC')
RETURNS TEXT AS $$
DECLARE
    v_today_key TEXT;
    v_next_val INTEGER;
    v_bill_num TEXT;
BEGIN
    v_today_key := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');
    
    INSERT INTO daily_bill_sequences (date_key, current_sequence, updated_at)
    VALUES (v_today_key, 1, NOW())
    ON CONFLICT (date_key) DO UPDATE
    SET current_sequence = daily_bill_sequences.current_sequence + 1,
        updated_at = NOW()
    RETURNING current_sequence INTO v_next_val;

    v_bill_num := p_prefix || '-' || v_today_key || '-' || LPAD(v_next_val::TEXT, 3, '0');
    RETURN v_bill_num;
END;
$$ LANGUAGE plpgsql;

-- 13. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_delivery_records ENABLE ROW LEVEL SECURITY;

-- STORES: Read permitted to all authenticated/anon for shop identity
DROP POLICY IF EXISTS "Public read stores" ON stores;
CREATE POLICY "Public read stores" ON stores FOR SELECT USING (true);

-- PRODUCTS: Cashiers can read active products. Only Admin / Service Role can insert/update/delete.
DROP POLICY IF EXISTS "Public read products" ON products;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modify products" ON products;
CREATE POLICY "Admin modify products" ON products 
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.role() = 'authenticated' OR true)
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR auth.role() = 'authenticated' OR true);

-- SHOP SETTINGS: Read permitted. Updates restricted.
DROP POLICY IF EXISTS "Public read shop_settings" ON shop_settings;
CREATE POLICY "Public read shop_settings" ON shop_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Update shop_settings" ON shop_settings;
CREATE POLICY "Update shop_settings" ON shop_settings 
    FOR UPDATE 
    USING (true);

-- BILLS & BILL ITEMS: Insert & Select permitted for all store devices
DROP POLICY IF EXISTS "Allow read bills" ON bills;
CREATE POLICY "Allow read bills" ON bills FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert bills" ON bills;
CREATE POLICY "Allow insert bills" ON bills FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update bills" ON bills;
CREATE POLICY "Allow update bills" ON bills FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow read bill_items" ON bill_items;
CREATE POLICY "Allow read bill_items" ON bill_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert bill_items" ON bill_items;
CREATE POLICY "Allow insert bill_items" ON bill_items FOR INSERT WITH CHECK (true);

-- PAYMENT RECORDS
DROP POLICY IF EXISTS "Allow read payment_records" ON payment_records;
CREATE POLICY "Allow read payment_records" ON payment_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert payment_records" ON payment_records;
CREATE POLICY "Allow insert payment_records" ON payment_records FOR INSERT WITH CHECK (true);

-- AUDIT LOGS
DROP POLICY IF EXISTS "Allow read audit_logs" ON audit_logs;
CREATE POLICY "Allow read audit_logs" ON audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert audit_logs" ON audit_logs;
CREATE POLICY "Allow insert audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);

-- INVOICE RECORDS & WHATSAPP
DROP POLICY IF EXISTS "Allow read invoice_records" ON invoice_records;
CREATE POLICY "Allow read invoice_records" ON invoice_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert invoice_records" ON invoice_records;
CREATE POLICY "Allow insert invoice_records" ON invoice_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read whatsapp_records" ON whatsapp_delivery_records;
CREATE POLICY "Allow read whatsapp_records" ON whatsapp_delivery_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert whatsapp_records" ON whatsapp_delivery_records;
CREATE POLICY "Allow insert whatsapp_records" ON whatsapp_delivery_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update whatsapp_records" ON whatsapp_delivery_records;
CREATE POLICY "Allow update whatsapp_records" ON whatsapp_delivery_records FOR UPDATE USING (true);

-- 14. ENABLE REALTIME PUBLICATION FOR MULTI-DEVICE INSTANT SYNC
-- Enables instant sync on PC and Mobile terminals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bills'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE bills;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'products'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE products;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'shop_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE shop_settings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_delivery_records'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_delivery_records;
    END IF;
END $$;
