-- =========================================================================
-- MIGRATION SCRIPT: REVISION #2 (15/10/2026)
-- Connect Transport TMS System Overhaul
-- =========================================================================

-- 1. VEHICLES: เพิ่มรหัสย่อ, ยี่ห้อ/รุ่น, ปีจดทะเบียน, ภาษี, GPS และผูกคนขับประจำรถ
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS truck_name_id VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS truck_brand VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS truck_model VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS register_year VARCHAR(10);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tax_expiry_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps_brand VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id);

-- ตั้งค่าเริ่มต้นรหัสรถย่อสำหรับข้อมูลเดิม (ถ้ามี)
UPDATE vehicles SET truck_name_id = 'รถคัน-' || SUBSTRING(plate_number FROM '[0-9]+') WHERE truck_name_id IS NULL;

-- 2. DRIVERS: เพิ่มเลขบัตร ปชช. 13 หลัก และรูปถ่าย
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS id_number VARCHAR(20);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS photo TEXT;

-- 3. CUSTOMERS: เพิ่มสาขา, เครดิตเทอม, Shipper, สินค้า
ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch VARCHAR(50) DEFAULT 'สำนักงานใหญ่';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_term_days INTEGER DEFAULT 30;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipper_name VARCHAR(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS commodity_name VARCHAR(200);

-- 4. LOCATIONS: เพิ่มผู้ติดต่อ, พิกัด GPS, จุดสังเกต, รูปแผนที่
ALTER TABLE locations ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_map TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_remark TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS map_picture TEXT;

-- 5. RATE CARDS: เพิ่มขนาด/ชนิดตู้ และลูกค้าเฉพาะราย
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS container_size VARCHAR(20);
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS container_type VARCHAR(20);

-- 6. JOBS: เพิ่มข้อมูลสายเรือ, Booking, B/L, สินค้า, วันที่รับ-บรรจุ-คืนตู้, สเปก Volume และ Invoice No.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS shipper_name VARCHAR(200);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ship_line VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bl_no VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS book_no VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS commodity_name VARCHAR(200);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pickup_place VARCHAR(200);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pickup_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS packing_place VARCHAR(200);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS packing_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS return_place VARCHAR(200);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS return_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS container_amount INTEGER DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS addon_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(50);

-- 7. JOB ASSIGNMENTS: รองรับ 1 Job สามารถจ่ายรถได้หลายคัน (1 : Many)
CREATE TABLE IF NOT EXISTS job_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    leg_index INTEGER DEFAULT 1,
    truck_name_id VARCHAR(50),
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES drivers(id),
    container_no VARCHAR(50),
    seal_no VARCHAR(50),
    temperature NUMERIC(5,2),
    current_step VARCHAR(30) DEFAULT 'assigned',
    pickup_checkin_time TIMESTAMPTZ,
    pickup_gps TEXT,
    pickup_photos JSONB,
    pickup_reefer_photos JSONB,
    pickup_receipt_photos JSONB,
    pickup_eir_photo TEXT,
    packing_checkin_time TIMESTAMPTZ,
    packing_gps TEXT,
    packing_photo_sealed TEXT,
    packing_reefer_photo TEXT,
    packing_receipt_photos JSONB,
    packing_eir_photo TEXT,
    return_checkin_time TIMESTAMPTZ,
    return_gps TEXT,
    return_photo_front TEXT,
    return_reefer_photo TEXT,
    return_receipt_photos JSONB,
    return_eir_photo TEXT,
    driver_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ปิด RLS เพื่อให้ใช้งานได้ราบรื่น
ALTER TABLE IF EXISTS job_assignments DISABLE ROW LEVEL SECURITY;

-- 8. DRIVER EXPENSES: เพิ่มรหัสรถย่อและรูปสลิป
ALTER TABLE driver_expenses ADD COLUMN IF NOT EXISTS truck_name_id VARCHAR(50);
ALTER TABLE driver_expenses ADD COLUMN IF NOT EXISTS expense_picture TEXT;
