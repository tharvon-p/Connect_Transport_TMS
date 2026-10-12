-- ==========================================================
-- Database Schema for Transport Management System (TMS)
-- Company: Connect Transport Co., Ltd.
-- Best Practices: PostgreSQL / Supabase
-- ==========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ปิด RLS เพื่อให้ระบบ TMS ภายในสามารถ อ่าน/เขียน ข้อมูลได้โดยตรง
ALTER TABLE IF EXISTS vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rate_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS driver_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs DISABLE ROW LEVEL SECURITY;

-- 1.1 Audit Logs (บันทึกประวัติการทำงาน)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100),
    user_name VARCHAR(150),
    user_role VARCHAR(50),
    action VARCHAR(50) NOT NULL, -- 'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'PRINT', 'APPROVE', 'CLOSE_JOB'
    module VARCHAR(50) NOT NULL, -- 'AUTH', 'MASTER_DATA', 'ORDERS', 'DISPATCH', 'EXPENSES', 'INVOICING', 'USERS_ROLES'
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. MASTER DATA TABLES

-- 2.1 Vehicles (รถบรรทุก)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(50) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL, -- '4_wheel', '6_wheel', '10_wheel', 'trailer', 'semi_trailer'
    capacity_tons NUMERIC(10, 2) DEFAULT 0,
    iso_expiry_date DATE,            -- วันหมดอายุ ISO 39001
    insurance_expiry_date DATE,      -- วันหมดอายุประกันภัย
    act_expiry_date DATE,            -- วันหมดอายุ พรบ.
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'maintenance', 'inactive'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.2 Drivers (พนักงานขับรถ / พขร.)
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    license_number VARCHAR(50),
    license_expiry_date DATE,
    daily_rate NUMERIC(10, 2) DEFAULT 500, -- เบี้ยเลี้ยง/ค่าจ้างมาตรฐานต่อวัน
    status VARCHAR(20) DEFAULT 'available', -- 'available', 'on_job', 'leave', 'inactive'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 Customers (ลูกค้า)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(200) NOT NULL,
    tax_id VARCHAR(50),
    contact_name VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 Locations (สถานที่: ลานฝากตู้, ท่าเรือ, โรงงาน)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    location_type VARCHAR(50) NOT NULL, -- 'depot', 'factory', 'port', 'yard', 'other'
    province VARCHAR(100),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.5 Rate Cards (ตารางมาตรฐานราคาค่าขนส่ง)
CREATE TABLE IF NOT EXISTS rate_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    destination_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL,
    base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- ราคาเรียกเก็บลูกค้า
    fuel_cost_est NUMERIC(12, 2) DEFAULT 0,         -- ต้นทุนน้ำมันประมาณการ
    toll_fee_est NUMERIC(12, 2) DEFAULT 0,          -- ค่าทางด่วนประมาณการ
    driver_fee_est NUMERIC(12, 2) DEFAULT 0,        -- ค่าแรง พขร. ประมาณการ
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. OPERATIONS & JOBS (ระบบงานขนส่ง)

-- 3.1 Jobs (คำสั่งงานขนส่ง)
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_no VARCHAR(50) NOT NULL UNIQUE,             -- TMS-001, TMS-002
    job_date DATE NOT NULL DEFAULT CURRENT_DATE,
    job_type VARCHAR(50) NOT NULL,                  -- 'heavy_to_open', 'empty_to_stuff', 'empty_return', 'yard_move'
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    origin_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
    destination_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_type VARCHAR(50) NOT NULL,              -- ประเภทรถที่ต้องการ
    container_size VARCHAR(20) NOT NULL,            -- '20', '40', '45'
    container_type VARCHAR(20) NOT NULL,            -- 'DC', 'HC', 'OT', 'RH'
    cargo_type VARCHAR(20) NOT NULL DEFAULT 'NON_DG', -- 'NON_DG', 'DG'
    status VARCHAR(30) NOT NULL DEFAULT 'draft',    -- 'draft', 'assigned', 'in_progress', 'completed', 'cancelled'
    
    -- ข้อมูลปฏิบัติการจาก พขร. (อัปเดตระหว่างวิ่งงานหรือจบงาน)
    container_no VARCHAR(50),
    seal_no VARCHAR(50),
    temperature NUMERIC(5, 2),
    checkin_location TEXT,
    checkin_time TIMESTAMPTZ,
    driver_notes TEXT,

    -- การเงินและต้นทุน (Financial Summary)
    revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    fuel_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    driver_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    toll_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    waiting_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ot_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    other_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,

    -- เอกสารพิเศษ (เช่น ท่าเรือ)
    pat_letter_required BOOLEAN DEFAULT false,
    pat_letter_status VARCHAR(30) DEFAULT 'none',    -- 'none', 'pending', 'issued', 'completed'

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.2 Driver Expenses & Advances (เบี้ยเลี้ยงและค่าใช้จ่าย พขร.)
CREATE TABLE IF NOT EXISTS driver_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE RESTRICT,
    expense_type VARCHAR(50) NOT NULL,              -- 'per_diem', 'fuel', 'toll', 'waiting', 'overtime', 'advance'
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    description TEXT,
    receipt_url TEXT,
    status VARCHAR(30) DEFAULT 'approved',          -- 'pending', 'approved', 'rejected', 'reimbursed'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. INDEXES เพื่อประสิทธิภาพการค้นหา
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_driver ON jobs(driver_id);
CREATE INDEX IF NOT EXISTS idx_jobs_vehicle ON jobs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(job_date);

-- ==========================================================
-- 5. MOCK DATA (ข้อมูลตัวอย่างสำหรับเริ่มทดสอบระบบ)
-- ==========================================================

-- ใส่ข้อมูลรถบรรทุกตัวอย่าง
INSERT INTO vehicles (plate_number, vehicle_type, capacity_tons, iso_expiry_date, insurance_expiry_date, act_expiry_date, status)
VALUES
('70-9821 กทม.', 'trailer', 32.00, '2027-06-30', '2027-05-15', '2027-05-15', 'active'),
('71-3452 ชลบุรี', 'semi_trailer', 35.00, '2027-08-20', '2027-04-10', '2027-04-10', 'active'),
('70-4411 กทม.', '10_wheel', 15.00, '2026-12-31', '2027-03-25', '2027-03-25', 'active'),
('72-1109 ระยอง', 'trailer', 32.00, '2027-09-15', '2027-07-01', '2027-07-01', 'maintenance')
ON CONFLICT (plate_number) DO NOTHING;

-- ใส่ข้อมูลพนักงานขับรถ (พขร.) ตัวอย่าง
INSERT INTO drivers (name, phone, license_number, license_expiry_date, daily_rate, status)
VALUES
('สมหมาย ใจมั่น', '081-234-5678', 'ท.4-0098765', '2028-10-15', 600.00, 'available'),
('วิชัย ขยันยิ่ง', '089-876-5432', 'ท.4-0082341', '2027-11-20', 600.00, 'available'),
('ประเสริฐ ชำนาญทาง', '086-555-1234', 'ท.4-0071122', '2028-02-18', 650.00, 'available'),
('อำนาจ มั่นคง', '082-333-8899', 'ท.3-0054321', '2027-09-05', 550.00, 'available')
ON CONFLICT DO NOTHING;

-- ใส่ข้อมูลลูกค้าตัวอย่าง
INSERT INTO customers (company_name, tax_id, contact_name, phone, email, address)
VALUES
('บริษัท สยาม โลจิสติกส์ เทรดดิ้ง จำกัด', '0105558012345', 'คุณกิตติศักดิ์', '02-123-4567', 'kittisak@siamlogistics.com', '88 ถ.บางนา-ตราด กม.19 สมุทรปราการ'),
('บริษัท โอเชียน ชิปปิ้ง แอนด์ ทรานสปอร์ต จำกัด', '0105561098765', 'คุณพัชรี', '02-987-6543', 'patcharee@oceanshipping.co.th', '123 ท่าเรือกรุงเทพ คลองเตย กทม.'),
('บริษัท ไทย เบฟเวอเรจ โลจิสติกส์ จำกัด', '0105549033221', 'คุณสมพงษ์', '035-222-333', 'sompong@thaibevlogistics.com', '55 นิคมอุตสาหกรรมไฮเทค อยุธยา')
ON CONFLICT DO NOTHING;

-- ใส่ข้อมูลสถานที่ (Locations)
INSERT INTO locations (name, location_type, province, address)
VALUES
('ท่าเรือแหลมฉบัง C0', 'port', 'ชลบุรี', 'ท่าเรือแหลมฉบัง ต.ทุ่งสุขลา อ.ศรีราชา ชลบุรี'),
('ท่าเรือกรุงเทพ (คลองเตย)', 'port', 'กรุงเทพฯ', 'การท่าเรือแห่งประเทศไทย คลองเตย กทม.'),
('ลานฝากตู้ บึงทองคำ (BTH Depot)', 'depot', 'ชลบุรี', 'ต.หนองขาม อ.ศรีราชา ชลบุรี'),
('ลานตู้ สยามคอนเทนเนอร์ ยาร์ด (SCY)', 'depot', 'สมุทรปราการ', 'กิ่งแก้ว บางพลี สมุทรปราการ'),
('โรงงานไทยเบฟ บางปะอิน', 'factory', 'พระนครศรีอยุธยา', 'นิคมอุตสาหกรรมบางปะอิน อยุธยา'),
('โรงงานซีพีเอฟ แปดริ้ว', 'factory', 'ฉะเชิงเทรา', 'อ.แปลงยาว ฉะเชิงเทรา')
ON CONFLICT DO NOTHING;
