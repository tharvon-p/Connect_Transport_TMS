'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  Truck, 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { users, roles, login, switchUser } = useAuth();

  const [email, setEmail] = useState('admin@connecttransport.com');
  const [password, setPassword] = useState('admin');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    const res = await login(email, password);
    setSubmitting(false);

    if (res.success) {
      router.push('/');
    } else {
      setErrorMsg(res.error || 'การเข้าสู่ระบบล้มเหลว');
    }
  };

  const handleQuickDemoLogin = (userId: string) => {
    switchUser(userId);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center bg-white px-6 py-3.5 rounded-2xl shadow-2xl mb-3 border border-slate-700/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/images/logo.png" 
            alt="Connect Transport Co., Ltd." 
            className="h-12 w-auto object-contain"
          />
        </div>
        <p className="text-sm text-blue-400 font-medium mt-1">
          TMS Container Haulage &amp; Logistics Management
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0 z-10 space-y-6">
        {/* Main Login Card */}
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <h2 className="text-lg font-bold text-slate-900">ลงชื่อเข้าสู่ระบบ (Sign In)</h2>
              <p className="text-xs text-slate-500">กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งานตามสิทธิ์ Role ที่ได้รับ</p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                อีเมลผู้ใช้งาน (Email Address)
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@connecttransport.com"
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                รหัสผ่าน (Password)
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 text-sm gap-2 mt-2 shadow-sm"
            >
              <span>{submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ (Log In)'}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Quick Demo Logins Section */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 text-white space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              ทางลัดทดสอบระบบ (One-Click Demo Login)
            </span>
            <span className="text-[11px] text-slate-400">คลิกเพื่อเข้าสู่ระบบตาม Role ทันที</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {users.map((u) => {
              const uRole = roles.find((r) => r.id === u.roleId);

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickDemoLogin(u.id)}
                  className="text-left p-3 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-blue-500 hover:bg-slate-700/60 transition-all group flex items-start justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{u.avatar}</span>
                    <div>
                      <div className="font-bold text-xs text-white group-hover:text-blue-300">
                        {u.name}
                      </div>
                      <div className="text-[11px] text-slate-400">{u.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Pass: {u.password}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-semibold ${uRole?.badgeColor || ''}`}>
                    {uRole?.name.split(' ')[0] || u.roleId}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
