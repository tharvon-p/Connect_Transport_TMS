'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalLogs, AuditLogEntry, AuditAction, AuditModule } from '@/lib/audit-logger';
import { useAuth } from '@/lib/auth-context';
import { 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  Printer, 
  ShieldCheck, 
  User, 
  FileText, 
  Trash2, 
  LogIn, 
  LogOut, 
  PlusCircle, 
  Edit3, 
  CheckCircle2,
  Clock,
  Download
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const actionConfig: Record<AuditAction, { label: string; badgeClass: string; icon: any }> = {
  LOGIN: { label: 'เข้าสู่ระบบ (Login)', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200', icon: LogIn },
  LOGOUT: { label: 'ออกจากระบบ (Logout)', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', icon: LogOut },
  CREATE: { label: 'สร้างรายการใหม่ (Create)', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: PlusCircle },
  UPDATE: { label: 'แก้ไขข้อมูล (Update)', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200', icon: Edit3 },
  DELETE: { label: 'ลบข้อมูล (Delete)', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200', icon: Trash2 },
  PRINT: { label: 'สั่งพิมพ์เอกสาร (Print)', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200', icon: Printer },
  APPROVE: { label: 'อนุมัติ (Approve)', badgeClass: 'bg-teal-100 text-teal-800 border-teal-200', icon: CheckCircle2 },
  CLOSE_JOB: { label: 'ปิดงาน (Close Job)', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: CheckCircle2 },
};

const moduleConfig: Record<AuditModule, { label: string; badgeClass: string }> = {
  AUTH: { label: 'ระบบยืนยันตัวตน', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  MASTER_DATA: { label: 'ข้อมูลหลัก (Master)', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  ORDERS: { label: 'รับงานขนส่ง (Orders)', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  DISPATCH: { label: 'จ่ายงาน & พขร.', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  EXPENSES: { label: 'เบี้ยเลี้ยง & ค่าใช้จ่าย', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INVOICING: { label: 'ใบแจ้งหนี้ & ท่าเรือ', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' },
  USERS_ROLES: { label: 'จัดการสิทธิ์ (RBAC)', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function AuditLogsPage() {
  const { users, currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setLogs(data as AuditLogEntry[]);
        return;
      }
    } catch (err) {
      console.error('Error fetching audit logs from Supabase:', err);
    }
    const list = getLocalLogs();
    setLogs(list);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClearLogs = async () => {
    if (!confirm('ยืนยันที่จะล้างประวัติ Audit Log ทั้งหมดหรือไม่? (สำหรับผู้ดูแลระบบ)')) return;
    try {
      await supabase.from('audit_logs').delete().neq('id', 'keep_all');
    } catch (e) {}
    localStorage.removeItem('tms_audit_logs');
    fetchLogs();
  };

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchAction = actionFilter === 'all' || log.action === actionFilter;
    const matchModule = moduleFilter === 'all' || log.module === moduleFilter;
    const matchUser = userFilter === 'all' || log.user_id === userFilter;

    return matchSearch && matchAction && matchModule && matchUser;
  });

  // KPI Calculations
  const totalCount = logs.length;
  const loginCount = logs.filter((l) => l.action === 'LOGIN').length;
  const createCount = logs.filter((l) => l.action === 'CREATE').length;
  const printCount = logs.filter((l) => l.action === 'PRINT').length;

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
              Security &amp; Compliance Audit Trail
            </span>
            <span className="text-xs text-slate-500">Connect Transport Co., Ltd.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <History className="h-7 w-7 text-blue-600" />
            ระบบบันทึกประวัติการทำงาน (Audit Log Trail)
          </h1>
          <p className="text-slate-500 text-sm">
            บันทึกการเข้าสู่ระบบ, การสร้างใบสั่งงาน, การจ่ายรถ, การบันทึกค่าใช้จ่าย, การพิมพ์เอกสาร และการแก้ไขสิทธิ์อย่างละเอียด
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            รีเฟรชประวัติ
          </Button>

          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => window.print()}
            className="gap-2 border-slate-300"
          >
            <Printer className="h-4 w-4" />
            พิมพ์รายงาน Log
          </Button>

          {currentUser.roleId === 'admin' && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleClearLogs}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
            >
              ล้างประวัติ
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">ประวัติกิจกรรมทั้งหมด</CardTitle>
            <History className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalCount} รายการ</div>
            <p className="text-[11px] text-slate-500 mt-0.5">กิจกรรมที่บันทึกไว้ในระบบทั้งหมด</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">การเข้าสู่ระบบ (Logins)</CardTitle>
            <LogIn className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{loginCount} ครั้ง</div>
            <p className="text-[11px] text-slate-500 mt-0.5">บันทึกการ Login และสลับสิทธิ์</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">การสร้างข้อมูล (Creations)</CardTitle>
            <PlusCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{createCount} รายการ</div>
            <p className="text-[11px] text-slate-500 mt-0.5">เปิดใบรับงาน, บันทึกค่าใช้จ่าย, เพิ่มรถ</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">การสั่งพิมพ์เอกสาร (Prints)</CardTitle>
            <Printer className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{printCount} ฉบับ</div>
            <p className="text-[11px] text-slate-500 mt-0.5">พิมพ์ใบสั่งงาน, ใบแจ้งหนี้, PAT</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ค้นหาชื่อผู้กระทำ หรือรายละเอียด..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Filter className="h-4 w-4 text-slate-500" />
            
            <select
              className="border rounded-md px-2.5 py-1.5 text-xs bg-white border-slate-300"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            >
              <option value="all">ผู้ใช้ทุกคน ({users.length})</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>

            <select
              className="border rounded-md px-2.5 py-1.5 text-xs bg-white border-slate-300"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="all">ทุกโมดูลระบบ</option>
              <option value="AUTH">ยืนยันตัวตน (Auth)</option>
              <option value="MASTER_DATA">ข้อมูลหลัก (Master)</option>
              <option value="ORDERS">รับงานขนส่ง (Orders)</option>
              <option value="DISPATCH">จ่ายงาน (Dispatch)</option>
              <option value="EXPENSES">ค่าใช้จ่าย (Expenses)</option>
              <option value="INVOICING">วางบิล (Invoicing)</option>
              <option value="USERS_ROLES">จัดการสิทธิ์ (RBAC)</option>
            </select>

            <select
              className="border rounded-md px-2.5 py-1.5 text-xs bg-white border-slate-300"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">ทุกประเภทการกระทำ</option>
              <option value="LOGIN">เข้าสู่ระบบ (Login)</option>
              <option value="CREATE">สร้างรายการ (Create)</option>
              <option value="UPDATE">แก้ไข (Update)</option>
              <option value="PRINT">สั่งพิมพ์ (Print)</option>
              <option value="DELETE">ลบข้อมูล (Delete)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">บันทึกประวัติการทำงาน ({filteredLogs.length})</CardTitle>
          <CardDescription>แสดงประวัติกิจกรรมล่าสุดเรียงตามวันเวลา</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70">
                  <TableHead className="font-semibold text-slate-800 whitespace-nowrap">วันและเวลา</TableHead>
                  <TableHead className="font-semibold text-slate-800 whitespace-nowrap">ผู้กระทำ (User & Role)</TableHead>
                  <TableHead className="font-semibold text-slate-800 whitespace-nowrap">โมดูล</TableHead>
                  <TableHead className="font-semibold text-slate-800 whitespace-nowrap">การกระทำ (Action)</TableHead>
                  <TableHead className="font-semibold text-slate-800">รายละเอียดเหตุการณ์ (Description)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      ไม่พบประวัติการทำงานที่ตรงกับเงื่อนไข
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => {
                    const act = actionConfig[log.action] || { label: log.action, badgeClass: '', icon: History };
                    const mod = moduleConfig[log.module] || { label: log.module, badgeClass: '' };
                    const ActIcon = act.icon;

                    return (
                      <TableRow key={log.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-xs text-slate-600 font-mono whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString('th-TH') : '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="font-bold text-xs text-slate-900">{log.user_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">Role: {log.user_role}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className={`text-xs font-normal ${mod.badgeClass}`}>
                            {mod.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className={`text-xs font-bold gap-1 ${act.badgeClass}`}>
                            <ActIcon className="h-3 w-3" />
                            {act.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-800 leading-relaxed">
                          {log.description}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
