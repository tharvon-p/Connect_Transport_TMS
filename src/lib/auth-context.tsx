'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'md' | 'customer_support' | 'dispatcher' | 'accountant';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  avatar: string;
}

export const ROLES_CONFIG: Record<UserRole, {
  name: string;
  description: string;
  allowedPaths: string[];
  badgeColor: string;
}> = {
  admin: {
    name: 'Admin (ผู้ดูแลระบบ)',
    description: 'เข้าถึงได้ทุกหน้า ทุกโมดูล และจัดการตั้งค่าระบบทั้งหมด',
    allowedPaths: ['/', '/master-data', '/orders', '/dispatch', '/expenses', '/invoicing'],
    badgeColor: 'bg-red-100 text-red-800 border-red-300',
  },
  md: {
    name: 'MD (กรรมการผู้จัดการ)',
    description: 'ดูภาพรวมผลประกอบการ กำไรสุทธิ ใบแจ้งหนี้ และรายงานสรุป',
    allowedPaths: ['/', '/orders', '/expenses', '/invoicing'],
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  customer_support: {
    name: 'Customer Support (ฝ่ายรับงาน/บริการลูกค้า)',
    description: 'เปิดใบรับงานใหม่ ตรวจสอบข้อมูลลูกค้า และลานตู้คอนเทนเนอร์',
    allowedPaths: ['/orders', '/master-data'],
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  dispatcher: {
    name: 'Dispatcher (ฝ่ายจ่ายงาน/ปฏิบัติการ)',
    description: 'มอบหมายรถและ พขร. สั่งพิมพ์ใบสั่งงาน และติดตามสถานะหน้างาน',
    allowedPaths: ['/orders', '/dispatch', '/master-data'],
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  accountant: {
    name: 'Accountant (ฝ่ายการเงิน/บัญชี)',
    description: 'จัดการเบี้ยเลี้ยง พขร. ค่าน้ำมัน ออกใบแจ้งหนี้ และจดหมายท่าเรือ PAT',
    allowedPaths: ['/', '/expenses', '/invoicing'],
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
};

export const MOCK_USERS: UserProfile[] = [
  { id: 'u1', name: 'ธวัชชัย (Admin)', role: 'admin', title: 'System Administrator', avatar: '👨‍💻' },
  { id: 'u2', name: 'คุณกฤษฎา (MD)', role: 'md', title: 'Managing Director', avatar: '👔' },
  { id: 'u3', name: 'คุณนภา (CS Support)', role: 'customer_support', title: 'Customer Support Lead', avatar: '🎧' },
  { id: 'u4', name: 'คุณอำนาจ (Dispatcher)', role: 'dispatcher', title: 'Fleet & Dispatch Officer', avatar: '🚛' },
  { id: 'u5', name: 'คุณศิริพร (Finance)', role: 'accountant', title: 'Senior Accountant', avatar: '💰' },
];

interface AuthContextType {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  switchRole: (role: UserRole) => void;
  hasAccess: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_USERS[0]);

  // Load from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem('tms_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const match = MOCK_USERS.find((u) => u.id === parsed.id);
        if (match) setCurrentUser(match);
      } catch (e) {}
    }
  }, []);

  const switchRole = (role: UserRole) => {
    const found = MOCK_USERS.find((u) => u.role === role) || MOCK_USERS[0];
    setCurrentUser(found);
    localStorage.setItem('tms_current_user', JSON.stringify(found));
  };

  const hasAccess = (path: string) => {
    const roleConfig = ROLES_CONFIG[currentUser.role];
    if (!roleConfig) return false;
    // Admin has access to everything
    if (currentUser.role === 'admin') return true;
    return roleConfig.allowedPaths.some((p) => p === path || (p !== '/' && path.startsWith(p)));
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, switchRole, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
