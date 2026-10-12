'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ScreenPermission {
  path: string;
  label: string;
  description: string;
}

export const ALL_SCREENS: ScreenPermission[] = [
  { path: '/', label: 'ภาพรวมระบบ (Dashboard)', description: 'ดูสรุปงาน รายได้ ต้นทุน กำไร และตารางผลประกอบการ' },
  { path: '/master-data', label: 'ข้อมูลหลัก (Master Data)', description: 'จัดการข้อมูลรถ, พขร., ลูกค้า, สถานที่, เรทราคา' },
  { path: '/orders', label: 'รับงานขนส่ง (Orders)', description: 'เปิดใบรับงานใหม่ กำหนดสเปกตู้คอนเทนเนอร์' },
  { path: '/dispatch', label: 'จ่ายงาน & พขร. (Dispatch)', description: 'มอบหมายรถ/คนขับ คำนวณต้นทุน พิมพ์ใบสั่งงาน พอร์ทัล พขร.' },
  { path: '/expenses', label: 'เบี้ยเลี้ยง & ค่าใช้จ่าย (Expenses)', description: 'บันทึกเบี้ยเลี้ยง ค่าน้ำมัน ทางด่วน OT เบิกเงินล่วงหน้า' },
  { path: '/invoicing', label: 'วางบิล & ปิดงาน (Invoicing)', description: 'ออกใบแจ้งหนี้ (Invoice) จดหมายท่าเรือ PAT และปิดงาน' },
  { path: '/users-roles', label: 'จัดการผู้ใช้ & สิทธิ์ (Users & Roles)', description: 'สร้างผู้ใช้ จัดการ Role และกำหนดสิทธิ์เข้าถึงหน้าจอ' },
];

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  allowedPaths: string[];
  badgeColor: string;
  isSystem?: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  roleId: string;
  title: string;
  avatar: string;
  status: 'active' | 'inactive';
}

// Initial Default Roles
export const INITIAL_ROLES: RoleDefinition[] = [
  {
    id: 'admin',
    name: 'Admin (ผู้ดูแลระบบ)',
    description: 'สิทธิ์สูงสุด เข้าถึงได้ทุกหน้าจอและจัดการการตั้งค่าระบบทั้งหมด',
    allowedPaths: ['/', '/master-data', '/orders', '/dispatch', '/expenses', '/invoicing', '/users-roles'],
    badgeColor: 'bg-red-100 text-red-800 border-red-300',
    isSystem: true,
  },
  {
    id: 'md',
    name: 'MD (กรรมการผู้จัดการ)',
    description: 'ดูภาพรวมผลประกอบการ กำไรสุทธิ ตรวจสอบใบแจ้งหนี้ และรายงานสรุป',
    allowedPaths: ['/', '/orders', '/expenses', '/invoicing'],
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    isSystem: false,
  },
  {
    id: 'customer_support',
    name: 'Customer Support (ฝ่ายรับงาน/บริการลูกค้า)',
    description: 'เปิดใบรับงานใหม่ ประสานงานลูกค้า และตรวจสอบลานตู้คอนเทนเนอร์',
    allowedPaths: ['/orders', '/master-data'],
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    isSystem: false,
  },
  {
    id: 'dispatcher',
    name: 'Dispatcher (ฝ่ายจ่ายงาน/ปฏิบัติการ)',
    description: 'มอบหมายรถและ พขร. สั่งพิมพ์ใบสั่งงาน และติดตามสถานะหน้างาน',
    allowedPaths: ['/orders', '/dispatch', '/master-data'],
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    isSystem: false,
  },
  {
    id: 'accountant',
    name: 'Accountant (ฝ่ายการเงิน/บัญชี)',
    description: 'จัดการเบี้ยเลี้ยง พขร. ค่าน้ำมัน ออกใบแจ้งหนี้ และจดหมายท่าเรือ PAT',
    allowedPaths: ['/', '/expenses', '/invoicing'],
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    isSystem: false,
  },
];

// Initial Default Users
export const INITIAL_USERS: UserAccount[] = [
  { id: 'u1', name: 'ธวัชชัย (Admin)', email: 'admin@connecttransport.com', roleId: 'admin', title: 'System Administrator', avatar: '👨‍💻', status: 'active' },
  { id: 'u2', name: 'คุณกฤษฎา (MD)', email: 'kritsada@connecttransport.com', roleId: 'md', title: 'Managing Director', avatar: '👔', status: 'active' },
  { id: 'u3', name: 'คุณนภา (CS Support)', email: 'napha.cs@connecttransport.com', roleId: 'customer_support', title: 'Customer Support Lead', avatar: '🎧', status: 'active' },
  { id: 'u4', name: 'คุณอำนาจ (Dispatcher)', email: 'amnat.ops@connecttransport.com', roleId: 'dispatcher', title: 'Fleet & Dispatch Officer', avatar: '🚛', status: 'active' },
  { id: 'u5', name: 'คุณศิริพร (Finance)', email: 'siriporn.acc@connecttransport.com', roleId: 'accountant', title: 'Senior Accountant', avatar: '💰', status: 'active' },
];

interface AuthContextType {
  roles: RoleDefinition[];
  users: UserAccount[];
  currentUser: UserAccount;
  currentRole: RoleDefinition;
  switchUser: (userId: string) => void;
  hasAccess: (path: string) => boolean;
  // Role CRUD
  addRole: (role: Omit<RoleDefinition, 'id'>) => void;
  updateRole: (id: string, role: Partial<RoleDefinition>) => void;
  deleteRole: (id: string) => void;
  // User CRUD
  addUser: (user: Omit<UserAccount, 'id'>) => void;
  updateUser: (id: string, user: Partial<UserAccount>) => void;
  deleteUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [roles, setRoles] = useState<RoleDefinition[]>(INITIAL_ROLES);
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [currentUserId, setCurrentUserId] = useState<string>('u1');

  // Load from localStorage
  useEffect(() => {
    try {
      const savedRoles = localStorage.getItem('tms_custom_roles');
      if (savedRoles) setRoles(JSON.parse(savedRoles));

      const savedUsers = localStorage.getItem('tms_custom_users');
      if (savedUsers) setUsers(JSON.parse(savedUsers));

      const savedCurUser = localStorage.getItem('tms_active_user_id');
      if (savedCurUser) setCurrentUserId(savedCurUser);
    } catch (e) {
      console.error('Error loading RBAC from localStorage:', e);
    }
  }, []);

  // Save changes
  const saveRoles = (newRoles: RoleDefinition[]) => {
    setRoles(newRoles);
    localStorage.setItem('tms_custom_roles', JSON.stringify(newRoles));
  };

  const saveUsers = (newUsers: UserAccount[]) => {
    setUsers(newUsers);
    localStorage.setItem('tms_custom_users', JSON.stringify(newUsers));
  };

  const switchUser = (userId: string) => {
    setCurrentUserId(userId);
    localStorage.setItem('tms_active_user_id', userId);
  };

  const currentUser = users.find((u) => u.id === currentUserId) || users[0] || INITIAL_USERS[0];
  const currentRole = roles.find((r) => r.id === currentUser.roleId) || roles[0] || INITIAL_ROLES[0];

  const hasAccess = (path: string) => {
    if (!currentRole) return false;
    if (currentRole.id === 'admin') return true;
    return currentRole.allowedPaths.some((p) => p === path || (p !== '/' && path.startsWith(p)));
  };

  // Role Actions
  const addRole = (role: Omit<RoleDefinition, 'id'>) => {
    const newId = 'role_' + Date.now();
    const created: RoleDefinition = { ...role, id: newId };
    saveRoles([...roles, created]);
  };

  const updateRole = (id: string, updated: Partial<RoleDefinition>) => {
    const next = roles.map((r) => (r.id === id ? { ...r, ...updated } : r));
    saveRoles(next);
  };

  const deleteRole = (id: string) => {
    if (roles.find((r) => r.id === id)?.isSystem) {
      alert('ไม่สามารถลบ Role พื้นฐานของระบบได้');
      return;
    }
    const next = roles.filter((r) => r.id !== id);
    saveRoles(next);
  };

  // User Actions
  const addUser = (user: Omit<UserAccount, 'id'>) => {
    const newId = 'u_' + Date.now();
    const created: UserAccount = { ...user, id: newId };
    saveUsers([...users, created]);
  };

  const updateUser = (id: string, updated: Partial<UserAccount>) => {
    const next = users.map((u) => (u.id === id ? { ...u, ...updated } : u));
    saveUsers(next);
  };

  const deleteUser = (id: string) => {
    if (users.length <= 1) {
      alert('ต้องมีผู้ใช้อย่างน้อย 1 คนในระบบ');
      return;
    }
    const next = users.filter((u) => u.id !== id);
    saveUsers(next);
    if (currentUserId === id) {
      switchUser(next[0].id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        roles,
        users,
        currentUser,
        currentRole,
        switchUser,
        hasAccess,
        addRole,
        updateRole,
        deleteRole,
        addUser,
        updateUser,
        deleteUser,
      }}
    >
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
