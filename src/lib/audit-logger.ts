import { supabase } from './supabase';

export type AuditAction = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'PRINT' 
  | 'APPROVE' 
  | 'CLOSE_JOB';

export type AuditModule = 
  | 'AUTH' 
  | 'MASTER_DATA' 
  | 'ORDERS' 
  | 'DISPATCH' 
  | 'EXPENSES' 
  | 'INVOICING' 
  | 'USERS_ROLES';

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: AuditAction;
  module: AuditModule;
  description: string;
  metadata?: any;
  created_at: string;
}

// Initial Sample Audit Logs
const INITIAL_LOGS: AuditLogEntry[] = [
  {
    id: 'log_1',
    user_id: 'u1',
    user_name: 'ธวัชชัย (Admin)',
    user_role: 'admin',
    action: 'LOGIN',
    module: 'AUTH',
    description: 'เข้าสู่ระบบสำเร็จ ผ่าน IP 110.100.101.93 (Desktop Chrome)',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'log_2',
    user_id: 'u1',
    user_name: 'ธวัชชัย (Admin)',
    user_role: 'admin',
    action: 'CREATE',
    module: 'MASTER_DATA',
    description: 'เพิ่มข้อมูลรถบรรทุกทะเบียน 70-9821 กทม. (รถเทรลเลอร์ 32 ตัน)',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'log_3',
    user_id: 'u3',
    user_name: 'คุณนภา (CS Support)',
    user_role: 'customer_support',
    action: 'CREATE',
    module: 'ORDERS',
    description: 'เปิดใบรับงานขนส่งใหม่ TMS-2026-001 (สเปกตู้ 40\' HC) ลูกค้า สยาม โลจิสติกส์',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'log_4',
    user_id: 'u4',
    user_name: 'คุณอำนาจ (Dispatcher)',
    user_role: 'dispatcher',
    action: 'UPDATE',
    module: 'DISPATCH',
    description: 'จ่ายงาน TMS-2026-001 มอบหมายรถ 70-9821 และ พขร. สมหมาย ใจมั่น',
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
  },
  {
    id: 'log_5',
    user_id: 'u4',
    user_name: 'คุณอำนาจ (Dispatcher)',
    user_role: 'dispatcher',
    action: 'PRINT',
    module: 'DISPATCH',
    description: 'สั่งพิมพ์ใบสั่งงาน พขร. (Job Order Sheet) สำหรับงาน TMS-2026-001',
    created_at: new Date(Date.now() - 3600000 * 1.2).toISOString(),
  },
  {
    id: 'log_6',
    user_id: 'u5',
    user_name: 'คุณศิริพร (Finance)',
    user_role: 'accountant',
    action: 'CREATE',
    module: 'EXPENSES',
    description: 'บันทึกเบี้ยเลี้ยง พขร. สมหมาย ใจมั่น จำนวน 700 บาท (งาน TMS-2026-001)',
    created_at: new Date(Date.now() - 3600000 * 0.8).toISOString(),
  },
  {
    id: 'log_7',
    user_id: 'u5',
    user_name: 'คุณศิริพร (Finance)',
    user_role: 'accountant',
    action: 'PRINT',
    module: 'INVOICING',
    description: 'สั่งพิมพ์ใบแจ้งหนี้ INV-TMS-2026-001 เรียกเก็บเงินลูกค้า สยาม โลจิสติกส์ ยอด 8,500 บาท',
    created_at: new Date(Date.now() - 3600000 * 0.3).toISOString(),
  },
];

export async function logActivity(entry: {
  user_id: string;
  user_name: string;
  user_role: string;
  action: AuditAction;
  module: AuditModule;
  description: string;
  metadata?: any;
}) {
  const newLog: AuditLogEntry = {
    id: 'log_' + Date.now(),
    ...entry,
    created_at: new Date().toISOString(),
  };

  // 1. Save to local storage cache
  try {
    const existing = getLocalLogs();
    const updated = [newLog, ...existing].slice(0, 500); // keep up to 500 logs
    localStorage.setItem('tms_audit_logs', JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving audit log to localStorage:', e);
  }

  // 2. Attempt save to Supabase audit_logs table (if table exists)
  try {
    await supabase.from('audit_logs').insert([newLog]);
  } catch (err) {
    // Graceful fallback to local cache
  }

  return newLog;
}

export function getLocalLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return INITIAL_LOGS;
  try {
    const raw = localStorage.getItem('tms_audit_logs');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return INITIAL_LOGS;
}
