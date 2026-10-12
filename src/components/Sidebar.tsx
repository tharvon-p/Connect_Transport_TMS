'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Truck, 
  LayoutDashboard, 
  Database, 
  ClipboardList, 
  Send, 
  Wallet, 
  ReceiptText
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'ภาพรวมระบบ (Dashboard)', icon: LayoutDashboard },
  { href: '/master-data', label: 'ข้อมูลหลัก (Master Data)', icon: Database },
  { href: '/orders', label: 'รับงานขนส่ง (Orders)', icon: ClipboardList },
  { href: '/dispatch', label: 'จ่ายงาน & พขร. (Dispatch)', icon: Send },
  { href: '/expenses', label: 'เบี้ยเลี้ยง & ค่าใช้จ่าย (Expenses)', icon: Wallet },
  { href: '/invoicing', label: 'วางบิล & ปิดงาน (Invoicing)', icon: ReceiptText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md">
          <Truck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-wide text-white leading-tight">Connect Transport</h1>
          <p className="text-xs text-blue-400 font-medium">TMS Container Logistics</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          เมนูหลัก (Navigation)
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Supabase Connected
        </span>
        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">v1.0 MVP</span>
      </div>
    </aside>
  );
}
