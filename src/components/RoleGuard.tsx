'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, ROLES_CONFIG } from '@/lib/auth-context';
import { ShieldAlert, ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, hasAccess, switchRole } = useAuth();

  const allowed = hasAccess(pathname);

  if (!allowed) {
    const userRoleConfig = ROLES_CONFIG[currentUser.role];
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 min-h-[80vh]">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-md p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
            <p className="text-xs text-slate-500 mt-1">
              Access Restricted for <strong>{userRoleConfig.name}</strong>
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border space-y-1 text-left">
            <div><strong>ผู้ใช้งานปัจจุบัน:</strong> {currentUser.name} ({currentUser.title})</div>
            <div><strong>หน้าที่รับผิดชอบ:</strong> {userRoleConfig.description}</div>
            <div>
              <strong>หน้าที่มีสิทธิ์ใช้งาน:</strong>{' '}
              {userRoleConfig.allowedPaths.join(', ')}
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link href={userRoleConfig.allowedPaths[0] || '/'}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2 text-xs">
                <ArrowLeft className="h-4 w-4" />
                กลับไปยังหน้าหลักที่มีสิทธิ์
              </Button>
            </Link>

            <Button 
              variant="outline" 
              onClick={() => switchRole('admin')} 
              className="w-full text-xs gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Users className="h-4 w-4 text-purple-600" />
              สลับเป็น Admin (เพื่อปลดล็อกทุกสิทธิ์)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
