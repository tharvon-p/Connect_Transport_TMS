-- =========================================================================
-- CONNECT TRANSPORT TMS - COMPLETE DATABASE REVISION & MIGRATION (15/10/2026)
-- Project: https://yrorwyzlpjtwaktmsdgt.supabase.co
-- Run this entire script in Supabase Dashboard -> SQL Editor -> Click 'Run'
-- =========================================================================

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. VEHICLES (รถบรรทุก): เพิ่มรหัสย่อ, ยี่ห้อ/รุ่น, ปีจดทะเบียน, ภาษี, GPS, และผูก พขร.
-- =========================================================================
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS truck_name_id VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS truck_brand VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS truck_model VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS register_year VARCHAR(10);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tax_expiry_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps_brand VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id);

-- ตั้งค่าเริ่มต้นรหัสรถย่อ (รถคัน-1, รถคัน-2, ...) และจับคู่คนขับประจำรถสำหรับข้อมูลที่มีอยู่แล้ว
UPDATE vehicles SET 
    truck_name_id = 'รถคัน-1',
    truck_brand = 'Hino',
    truck_model = '500 Victor',
    register_year = '2564',
    gps_brand = 'DTC GPS',
    driver_id = '0e7b3833-a7e7-4cf0-82b0-7411b58d5884' -- สมหมาย ใจมั่น
WHERE plate_number = '70-9821 กทม.';

UPDATE vehicles SET 
    truck_name_id = 'รถคัน-2',
    truck_brand = 'Isuzu',
    truck_model = 'Giga 360',
    register_year = '2565',
    gps_brand = 'Hino Connect',
    driver_id = 'f3ba566f-8bb1-4481-b7c8-04bb4a66efb8' -- วิชัย ขยันยิ่ง
WHERE plate_number = '71-3452 ชลบุรี';

UPDATE vehicles SET 
    truck_name_id = 'รถคัน-3',
    truck_brand = 'Hino',
    truck_model = '500 Victor',
    register_year = '2563',
    gps_brand = 'DTC GPS',
    driver_id = 'af87f8c9-eaa8-42e4-84d0-12b48651ba32' -- ประเสริฐ ชำนาญทาง
WHERE plate_number = '70-4411 กทม.';

UPDATE vehicles SET 
    truck_name_id = 'รถคัน-4',
    truck_brand = 'Scania',
    truck_model = 'P360',
    register_year = '2566',
    gps_brand = 'Scania Fleet',
    driver_id = '6a7acf67-72da-4aaf-82d0-55ba7d512b2c' -- อำนาจ มั่นคง
WHERE plate_number = '72-1109 ระยอง';

-- ตั้งค่ารถคันอื่นๆ ที่ยังไม่มีรหัสย่อ
UPDATE vehicles 
SET truck_name_id = 'รถคัน-' || SUBSTRING(plate_number FROM '[0-9]+') 
WHERE truck_name_id IS NULL;


-- =========================================================================
-- 2. DRIVERS (พนักงานขับรถ): เพิ่มเลขบัตร ปชช. 13 หลัก และรูปถ่าย
-- =========================================================================
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS id_number VARCHAR(20);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS photo TEXT;

-- อัปเดตข้อมูลตัวอย่างเลขบัตร ปชช. ให้ครบ
UPDATE drivers SET id_number = '1-1002-34567-89-1' WHERE name LIKE '%สมหมาย%';
UPDATE drivers SET id_number = '3-2004-56789-01-2' WHERE name LIKE '%วิชัย%';
UPDATE drivers SET id_number = '1-1033-98765-43-1' WHERE name LIKE '%ประเสริฐ%';
UPDATE drivers SET id_number = '2-5001-23456-78-9' WHERE name LIKE '%อำนาจ%';


-- =========================================================================
-- 3. CUSTOMERS (ลูกค้า): เพิ่มสาขา, เครดิตเทอม, Shipper, ชนิดสินค้า
-- =========================================================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch VARCHAR(50) DEFAULT 'สำนักงานใหญ่';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_term_days INTEGER DEFAULT 30;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipper_name VARCHAR(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS commodity_name VARCHAR(200);

UPDATE customers SET 
    branch = 'สำนักงานใหญ่',
    credit_term_days = 30,
    shipper_name = 'Siam Logistics Global Trading Ltd.',
    commodity_name = 'ชิ้นส่วนยานยนต์ & เครื่องจักร'
WHERE company_name LIKE '%สยาม%';

UPDATE customers SET 
    branch = 'สาขาแหลมฉบัง (00001)',
    credit_term_days = 15,
    shipper_name = 'Eastern Cold Storage Co., Ltd.',
    commodity_name = 'อาหารทะเลแช่แข็งและผลไม้ส่งออก'
WHERE company_name LIKE '%อีสเทิร์น%';


-- =========================================================================
-- 4. LOCATIONS (สถานที่): เพิ่มผู้ติดต่อ, เบอร์โทร, พิกัด GPS, จุดสังเกต, รูปแผนที่
-- =========================================================================
ALTER TABLE locations ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_map TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_remark TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS map_picture TEXT;


-- =========================================================================
-- 5. RATE CARDS (อัตราค่าบริการ): เพิ่มลูกค้าเฉพาะราย และขนาด/ชนิดตู้
-- =========================================================================
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS container_size VARCHAR(20) DEFAULT '40';
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS container_type VARCHAR(20) DEFAULT 'HC';


-- =========================================================================
-- 6. JOBS (ใบรับงานขนส่ง): เพิ่มสายเรือ, Booking, B/L, สเปกตู้, สถานะบิล, และเบอร์รถ
-- =========================================================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS shipper_name VARCHAR(200);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ship_line VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS shipping_agent VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bl_no VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS book_no VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS booking_no VARCHAR(100);
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
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS truck_name_id VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(30) DEFAULT 'pending';

-- อัปเดตข้อมูลสายเรือ Booking B/L และเบอร์รถให้งานที่มีอยู่เดิม
UPDATE jobs SET 
    truck_name_id = 'รถคัน-1',
    ship_line = 'ONE (Ocean Network Express)',
    shipping_agent = 'ONE (Ocean Network Express)',
    book_no = 'BKG-ONE-2026-9901',
    booking_no = 'BKG-ONE-2026-9901',
    bl_no = 'BL-ONE-772819',
    container_amount = 1,
    invoice_status = 'billed',
    invoice_no = 'INV-6807-217'
WHERE job_no = 'TMS-2026-001';

UPDATE jobs SET 
    truck_name_id = 'รถคัน-2',
    ship_line = 'Evergreen Marine',
    shipping_agent = 'Evergreen Marine',
    book_no = 'EMC-BK-882190',
    booking_no = 'EMC-BK-882190',
    bl_no = 'EMC-BL-99120',
    container_amount = 1,
    invoice_status = 'pending'
WHERE job_no = 'TMS-2026-002';

UPDATE jobs SET 
    truck_name_id = 'รถคัน-3',
    ship_line = 'Maersk Line',
    shipping_agent = 'Maersk Line',
    book_no = 'MSK-990123-BK',
    booking_no = 'MSK-990123-BK',
    bl_no = 'MSK-BL-11234',
    container_amount = 1,
    invoice_status = 'pending'
WHERE job_no = 'TMS-2026-003';

UPDATE jobs SET 
    truck_name_id = 'รถคัน-1',
    ship_line = 'COSCO Shipping',
    shipping_agent = 'COSCO Shipping',
    book_no = 'COSU-2026-8812',
    booking_no = 'COSU-2026-8812',
    bl_no = 'COSU-BL-6612',
    container_amount = 1,
    invoice_status = 'pending'
WHERE job_no = 'TMS-2026-004';

UPDATE jobs SET 
    truck_name_id = 'รถคัน-2',
    ship_line = 'Yang Ming Line',
    shipping_agent = 'Yang Ming Line',
    book_no = 'YML-BK-33910',
    booking_no = 'YML-BK-33910',
    bl_no = 'YML-BL-8812',
    container_amount = 1,
    invoice_status = 'pending'
WHERE job_no = 'TMS-2026-005';

UPDATE jobs SET 
    truck_name_id = 'รถคัน-3',
    ship_line = 'Hapag-Lloyd',
    shipping_agent = 'Hapag-Lloyd',
    book_no = 'HLCU-99210-BK',
    booking_no = 'HLCU-99210-BK',
    bl_no = 'HLCU-BL-3301',
    container_amount = 1,
    invoice_status = 'pending'
WHERE job_no = 'TMS-2026-006';


-- =========================================================================
-- 7. JOB ASSIGNMENTS (ตารางจัดรถ 1 Job : หลายคัน / หลายตู้)
-- =========================================================================
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

ALTER TABLE IF EXISTS job_assignments DISABLE ROW LEVEL SECURITY;

-- สร้างข้อมูลเริ่มต้นใน job_assignments จาก jobs เดิม (ถ้ายังไม่มี)
INSERT INTO job_assignments (job_id, leg_index, truck_name_id, vehicle_id, driver_id, container_no, seal_no, current_step)
SELECT 
    j.id, 
    1, 
    COALESCE(j.truck_name_id, 'รถคัน-1'), 
    j.vehicle_id, 
    j.driver_id, 
    COALESCE(j.container_no, 'CT-TBRU-' || SUBSTRING(j.job_no FROM '[0-9]+')), 
    COALESCE(j.seal_no, 'SL-99' || SUBSTRING(j.job_no FROM '[0-9]+')), 
    CASE 
        WHEN j.status = 'completed' THEN 'completed'
        WHEN j.status = 'in_progress' THEN 'at_packing'
        ELSE 'assigned'
    END
FROM jobs j
WHERE NOT EXISTS (
    SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id
);


-- =========================================================================
-- 8. DRIVER EXPENSES (ตารางค่าใช้จ่ายและเบี้ยเลี้ยง พขร.): เพิ่มเบอร์รถและสลิป
-- =========================================================================
ALTER TABLE driver_expenses ADD COLUMN IF NOT EXISTS truck_name_id VARCHAR(50);
ALTER TABLE driver_expenses ADD COLUMN IF NOT EXISTS expense_picture TEXT;

-- อัปเดตเบอร์รถให้ค่าใช้จ่ายเดิม
UPDATE driver_expenses de
SET truck_name_id = COALESCE(
    (SELECT v.truck_name_id FROM vehicles v WHERE v.driver_id = de.driver_id LIMIT 1),
    'รถคัน-1'
)
WHERE truck_name_id IS NULL;


-- =========================================================================
-- 9. AUDIT LOGS (ตารางบันทึกประวัติการทำงานในระบบ): จัดเก็บถาวรใน PostgreSQL
-- =========================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100),
    user_name VARCHAR(150),
    user_role VARCHAR(100),
    action VARCHAR(50),
    module VARCHAR(50),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE IF EXISTS audit_logs DISABLE ROW LEVEL SECURITY;


-- =========================================================================
-- 10. APP USERS (ตารางผู้ใช้งานระบบ สำหรับ RBAC): บันทึกใน PostgreSQL
-- =========================================================================
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT,
    role_id VARCHAR(50) DEFAULT 'admin',
    title VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE IF EXISTS app_users DISABLE ROW LEVEL SECURITY;

-- เพิ่มผู้ใช้งานเริ่มต้น (ถ้ายังไม่มี)
INSERT INTO app_users (name, email, role_id, title)
VALUES 
    ('ธวัชชัย (Admin)', 'admin@connecttransport.com', 'admin', 'System Administrator'),
    ('ยศพล มณีทิพย์สกุล (MD)', 'md@connecttransport.com', 'md', 'กรรมการผู้จัดการ'),
    ('คุณนภา (CS Support)', 'cs@connecttransport.com', 'customer_support', 'Customer Support & Dispatch'),
    ('คุณอำนาจ (Dispatcher)', 'dispatch@connecttransport.com', 'dispatcher', 'หัวหน้าจัดรถและควบคุม พขร.'),
    ('คุณศิริพร (Finance)', 'account@connecttransport.com', 'accountant', 'หัวหน้าฝ่ายบัญชีและการเงิน')
ON CONFLICT (email) DO NOTHING;

-- =========================================================================
-- COMPLETE: ยืนยันการรันสำเร็จเรียบร้อย
-- =========================================================================
