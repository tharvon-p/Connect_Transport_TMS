'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { RoleGuard } from './RoleGuard';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main className="flex-1 min-h-screen bg-slate-900">{children}</main>;
  }

  return (
    <div id="app-shell" className="min-h-full flex bg-slate-50 text-slate-900 font-sans w-full">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <RoleGuard>{children}</RoleGuard>
      </main>
    </div>
  );
}
