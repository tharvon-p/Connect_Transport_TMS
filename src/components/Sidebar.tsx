'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  Truck, 
  LayoutDashboard, 
  Database, 
  ClipboardList, 
  Send, 
  Wallet, 
  ReceiptText,
  ShieldCheck,
  History,
  Lock,
  UserCheck,
  LogOut
} from 'lucide-react';
import { Button } from './ui/button';

const navItems = [
  { href: '/', label: 'ภาพรวมระบบ (Dashboard)', icon: LayoutDashboard },
  { href: '/master-data', label: 'ข้อมูลหลัก (Master Data)', icon: Database },
  { href: '/orders', label: 'รับงานขนส่ง (Orders)', icon: ClipboardList },
  { href: '/dispatch', label: 'จ่ายงาน & พขร. (Dispatch)', icon: Send },
  { href: '/expenses', label: 'เบี้ยเลี้ยง & ค่าใช้จ่าย (Expenses)', icon: Wallet },
  { href: '/invoicing', label: 'วางบิล & ปิดงาน (Invoicing)', icon: ReceiptText },
  { href: '/users-roles', label: 'จัดการผู้ใช้ & สิทธิ์ (RBAC)', icon: ShieldCheck },
  { href: '/audit-logs', label: 'ประวัติการทำงาน (Audit Log)', icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { users, currentUser, currentRole, switchUser, hasAccess, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md">
          <Truck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-wide text-white leading-tight">Connect Transport</h1>
          <p className="text-xs text-blue-400 font-medium">TMS Container Logistics</p>
        </div>
      </div>

      {/* Role Switcher Box */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <UserCheck className="h-3.5 w-3.5 text-blue-400" />
            ผู้ใช้งานปัจจุบัน (Active User)
          </span>
        </div>

        <select
          value={currentUser.id}
          onChange={(e) => switchUser(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.avatar} {u.name}
            </option>
          ))}
        </select>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{currentUser.title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${currentRole?.badgeColor || ''}`}>
            {currentRole?.name.split(' ')[0] || 'ROLE'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          เมนูระบบ (Navigation)
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const allowed = hasAccess(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : allowed
                  ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-400 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : allowed ? 'text-slate-400' : 'text-slate-600'}`} />
                <span className="text-xs">{item.label}</span>
              </div>
              {!allowed && (
                <span title="ไม่มีสิทธิ์เข้าถึงใน Role นี้">
                  <Lock className="h-3 w-3 text-slate-500" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout & Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 gap-2 h-8"
        >
          <LogOut className="h-3.5 w-3.5" />
          ออกจากระบบ (Sign Out)
        </Button>

        <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Audit Log Active
          </span>
          <span className="font-mono">v1.1</span>
        </div>
      </div>
    </aside>
  );
}
