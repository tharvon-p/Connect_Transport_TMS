-- ==============================================================================
-- CONNECT TRANSPORT TMS - JOB TYPES MASTER TABLE
-- Execute in Supabase SQL Editor if you wish to store Job Types in PostgreSQL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.job_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  process_flow TEXT,
  notes TEXT,
  requires_pat BOOLEAN DEFAULT false,
  requires_inspection BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.job_types ENABLE ROW LEVEL SECURITY;

-- Allow anonymous & authenticated read/write for TMS operations
CREATE POLICY "Allow public read job_types" ON public.job_types FOR SELECT USING (true);
CREATE POLICY "Allow public insert job_types" ON public.job_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update job_types" ON public.job_types FOR UPDATE USING (true);
CREATE POLICY "Allow public delete job_types" ON public.job_types FOR DELETE USING (true);

-- Insert Default Job Types
INSERT INTO public.job_types (code, name, category, process_flow, notes, requires_pat, requires_inspection, status)
VALUES
  ('heavy_to_open', 'ลากตู้หนักไปเปิด (Heavy to Open)', 'งานนำเข้าสินค้า (Import Work)', 'รับตู้หนักจากท่าเรือหรือลานตู้ ➔ ขนส่งไปยังโรงงานลูกค้าเพื่อเปิดตู้และนำสินค้าลง ➔ ลากตู้เปล่ากลับไปคืนลานตู้สายเรือ', 'มีการออกจดหมายเปลี่ยนใบเสร็จท่าเรือ (PAT) กรณีรับจากท่าเรือคลองเตย', true, false, 'active'),
  ('empty_to_stuff', 'ลากตู้เปล่าไปบรรจุ (Empty to Stuff)', 'งานส่งออกสินค้า (Export Work)', 'รับตู้เปล่าจากลานตู้สายเรือ ➔ ขนส่งไปยังโรงงานลูกค้าเพื่อบรรจุสินค้าและล็อคซีล (Seal) ➔ ขนส่งตู้หนักไปส่งที่ท่าเรือเพื่อรอขึ้นเรือ', 'ต้องตรวจสภาพตู้ 5 มุม และถ่ายรูปหน้าตู้ที่ล็อคซีลอย่างเคร่งครัด', false, true, 'active'),
  ('empty_return', 'ลากตู้เปล่าคืน (Empty Return)', 'ส่งคืนตู้เปล่าเข้าลานสายเรือ', 'รับตู้เปล่าที่เปิดสินค้าแล้วแกะตู้เสร็จจากโรงงาน ➔ ตรวจสภาพความเสียหายและทำความสะอาด ➔ ส่งมอบคืนลานตู้สายเรือพร้อมรับใบ EIR', 'ตรวจตั๋วรับตู้ EIR ให้ตรงกับ Booking/สายเรือ', false, true, 'active'),
  ('yard_move', 'ย้ายลาน (Yard Move)', 'การเคลื่อนย้ายภายในลานหรือระหว่างลานตู้', 'ยกตู้กดสับเปลี่ยนตำแหน่งระหว่างลาน หรือย้ายตู้จากลานพักไปท่าเรือเพื่อรอรอบการบรรทุกขึ้นเรือ', 'บันทึกตำแหน่ง Slot / Bay ในลานตู้ให้แม่นยำ', false, false, 'active')
ON CONFLICT (code) DO NOTHING;
