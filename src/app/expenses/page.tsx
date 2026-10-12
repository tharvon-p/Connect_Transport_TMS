'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Job, Driver, DriverExpense, ExpenseType } from '@/types/database';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Fuel, 
  Coins, 
  Clock, 
  CreditCard, 
  Receipt, 
  CheckCircle2, 
  Printer, 
  User, 
  FileText,
  AlertCircle,
  TrendingDown
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const expenseTypeConfig: Record<ExpenseType, { label: string; badgeClass: string; icon: any }> = {
  per_diem: { label: 'เบี้ยเลี้ยงรายวัน', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200', icon: Coins },
  fuel: { label: 'ค่าน้ำมัน', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200', icon: Fuel },
  toll: { label: 'ค่าทางด่วน', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: CreditCard },
  waiting: { label: 'ค่าเสียเวลาจอดรอ', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200', icon: Clock },
  overtime: { label: 'ค่าล่วงเวลา (OT)', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200', icon: Clock },
  advance: { label: 'เบิกเงินล่วงหน้า', badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: Wallet },
};

interface ExpenseWithRelations extends DriverExpense {
  job?: Job;
  driver?: Driver;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal States
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openVoucherModal, setOpenVoucherModal] = useState(false);
  const [voucherDriver, setVoucherDriver] = useState<Driver | null>(null);
  const [currentDateStr, setCurrentDateStr] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    job_id: '',
    driver_id: '',
    expense_type: 'per_diem' as ExpenseType,
    amount: '600',
    description: '',
    status: 'approved',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expRes, jobRes, drivRes] = await Promise.all([
        supabase
          .from('driver_expenses')
          .select(`
            *,
            job:jobs(id, job_no, customer_id, origin:locations!origin_id(name), destination:locations!destination_id(name)),
            driver:drivers(id, name, phone, daily_rate)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('jobs').select('id, job_no, driver_id').order('job_date', { ascending: false }),
        supabase.from('drivers').select('*').order('name'),
      ]);

      if (expRes.data) setExpenses(expRes.data as ExpenseWithRelations[]);
      if (jobRes.data) setJobs(jobRes.data as Job[]);
      if (drivRes.data) setDrivers(drivRes.data as Driver[]);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setCurrentDateStr(new Date().toLocaleDateString('th-TH'));
  }, []);

  const handleOpenAddModal = () => {
    const defaultJob = jobs[0];
    const defaultDriver = drivers[0];
    setFormData({
      job_id: defaultJob?.id || '',
      driver_id: defaultJob?.driver_id || defaultDriver?.id || '',
      expense_type: 'per_diem',
      amount: String(defaultDriver?.daily_rate || 600),
      description: 'เบี้ยเลี้ยงประจำเที่ยววิ่ง',
      status: 'approved',
    });
    setOpenAddModal(true);
  };

  // Job change in modal auto-selects driver
  const handleJobSelectInModal = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    setFormData((prev) => ({
      ...prev,
      job_id: jobId,
      driver_id: job?.driver_id || prev.driver_id,
    }));
  };

  // Submit expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.job_id || !formData.driver_id) {
      alert('กรุณาเลือกงานและพนักงานขับรถ');
      return;
    }

    const amt = parseFloat(formData.amount) || 0;

    const { error } = await supabase.from('driver_expenses').insert([
      {
        job_id: formData.job_id,
        driver_id: formData.driver_id,
        expense_type: formData.expense_type,
        amount: amt,
        description: formData.description,
        status: formData.status,
      },
    ]);

    if (!error) {
      setOpenAddModal(false);
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย: ' + error.message);
    }
  };

  // Delete expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('ยืนยันที่จะลบรายการค่าใช้จ่ายนี้หรือไม่?')) return;
    const { error } = await supabase.from('driver_expenses').delete().eq('id', id);
    if (!error) {
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
    }
  };

  // Filtered expenses
  const filteredExpenses = expenses.filter((e) => {
    const matchDriver = driverFilter === 'all' || e.driver_id === driverFilter;
    const matchType = typeFilter === 'all' || e.expense_type === typeFilter;
    return matchDriver && matchType;
  });

  // Financial Calculations
  const totalPerDiem = expenses.filter((e) => e.expense_type === 'per_diem').reduce((s, e) => s + Number(e.amount), 0);
  const totalFuel = expenses.filter((e) => e.expense_type === 'fuel').reduce((s, e) => s + Number(e.amount), 0);
  const totalToll = expenses.filter((e) => e.expense_type === 'toll').reduce((s, e) => s + Number(e.amount), 0);
  const totalWaiting = expenses.filter((e) => e.expense_type === 'waiting').reduce((s, e) => s + Number(e.amount), 0);
  const totalOT = expenses.filter((e) => e.expense_type === 'overtime').reduce((s, e) => s + Number(e.amount), 0);
  const totalAdvance = expenses.filter((e) => e.expense_type === 'advance').reduce((s, e) => s + Number(e.amount), 0);

  // Total Actual Expenses (excluding advances)
  const totalOperatingCosts = totalPerDiem + totalFuel + totalToll + totalWaiting + totalOT;

  // Net Settlement (ค่าใช้จ่ายจริง - เงินที่เบิกไปแล้ว)
  const netPayable = totalOperatingCosts - totalAdvance;

  // Open Voucher for driver
  const handleOpenVoucher = (d: Driver) => {
    setVoucherDriver(d);
    setOpenVoucherModal(true);
  };

  const voucherDriverExpenses = voucherDriver
    ? expenses.filter((e) => e.driver_id === voucherDriver.id)
    : [];

  const voucherDriverTotal = voucherDriverExpenses
    .filter((e) => e.expense_type !== 'advance')
    .reduce((s, e) => s + Number(e.amount), 0);

  const voucherDriverAdvance = voucherDriverExpenses
    .filter((e) => e.expense_type === 'advance')
    .reduce((s, e) => s + Number(e.amount), 0);

  const voucherDriverNet = voucherDriverTotal - voucherDriverAdvance;

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Module 4: Driver Allowance & Expenses
            </span>
            <span className="text-xs text-slate-500">Connect Transport Co., Ltd.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <Wallet className="h-7 w-7 text-blue-600" />
            ระบบเบี้ยเลี้ยงและค่าใช้จ่าย พขร. (Driver Allowance & Expenses)
          </h1>
          <p className="text-slate-500 text-sm">
            บันทึกเบี้ยเลี้ยงรายวัน ค่าน้ำมัน ค่าทางด่วน ค่าเสียเวลาจอดรอ (Waiting) ค่า OT และตัดยอดเงินเบิกล่วงหน้า
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData} 
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button 
            size="sm" 
            onClick={handleOpenAddModal}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            + บันทึกค่าใช้จ่าย / เบิกเงิน
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Per Diem & OT */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">เบี้ยเลี้ยง & OT รวม</CardTitle>
            <Coins className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900">฿{(totalPerDiem + totalOT).toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">เบี้ยเลี้ยง ฿{totalPerDiem.toLocaleString()} | OT ฿{totalOT.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Card 2: Fuel */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">ค่าน้ำมัน (Fuel Cost)</CardTitle>
            <Fuel className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-700">฿{totalFuel.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">ค่าน้ำมันที่ พขร. สำรองจ่าย</p>
          </CardContent>
        </Card>

        {/* Card 3: Tolls & Waiting */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">ทางด่วน & จอดรอ</CardTitle>
            <CreditCard className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900">฿{(totalToll + totalWaiting).toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">ทางด่วน ฿{totalToll.toLocaleString()} | จอดรอ ฿{totalWaiting.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Card 4: Advance Payment */}
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-cyan-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-cyan-800">เบิกเงินล่วงหน้า (Advance)</CardTitle>
            <TrendingDown className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-cyan-700">฿{totalAdvance.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">เงินที่เบิกล่วงหน้าไปก่อนวิ่งงาน</p>
          </CardContent>
        </Card>

        {/* Card 5: Net Payable */}
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/50 col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-emerald-800">คงเหลือจ่ายสุทธิ (Net Pay)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-black ${netPayable >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              ฿{netPayable.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">ค่าใช้จ่ายจริง หัก เงินเบิกล่วงหน้า</p>
          </CardContent>
        </Card>
      </div>

      {/* Driver Summary & Voucher Buttons */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            สรุปยอดรายบุคคล & ออกใบเคลียร์เงิน (Driver Vouchers)
          </CardTitle>
          <CardDescription>
            คลิกที่ปุ่ม &ldquo;ใบเคลียร์เงิน&rdquo; เพื่อพิมพ์ใบสำคัญจ่าย / เคลียร์ค่าใช้จ่ายของ พขร. แต่ละคน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {drivers.map((d) => {
              const dExps = expenses.filter((e) => e.driver_id === d.id);
              const dCosts = dExps.filter((e) => e.expense_type !== 'advance').reduce((s, e) => s + Number(e.amount), 0);
              const dAdv = dExps.filter((e) => e.expense_type === 'advance').reduce((s, e) => s + Number(e.amount), 0);
              const dNet = dCosts - dAdv;

              return (
                <div key={d.id} className="p-3 bg-white border rounded-xl shadow-xs space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900">{d.name}</div>
                    <div className="text-xs text-slate-500">โทร: {d.phone || '-'}</div>
                    <div className="text-xs text-slate-600 mt-2 space-y-0.5">
                      <div className="flex justify-between">
                        <span>ค่าใช้จ่ายจริง:</span>
                        <strong>฿{dCosts.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between text-cyan-700">
                        <span>เบิกล่วงหน้า:</span>
                        <strong>฿{dAdv.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-700 pt-1 border-t">
                        <span>ยอดเคลียร์สุทธิ:</span>
                        <span>฿{dNet.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenVoucher(d)}
                    className="w-full text-xs gap-1.5 mt-2 border-slate-300 hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-600" />
                    ใบเคลียร์เงิน (Voucher)
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-base font-bold">บันทึกประวัติค่าใช้จ่ายทั้งหมด ({filteredExpenses.length})</CardTitle>
            <CardDescription>แสดงรายการเบี้ยเลี้ยง ค่าน้ำมัน ทางด่วน ค่าจอดรอ และเงินเบิกล่วงหน้า</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="border rounded-md px-2.5 py-1.5 text-xs bg-white border-slate-300"
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
            >
              <option value="all">พขร. ทุกคน ({drivers.length})</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              className="border rounded-md px-2.5 py-1.5 text-xs bg-white border-slate-300"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">ทุกประเภทค่าใช้จ่าย</option>
              <option value="per_diem">เบี้ยเลี้ยงรายวัน</option>
              <option value="fuel">ค่าน้ำมัน</option>
              <option value="toll">ค่าทางด่วน</option>
              <option value="waiting">ค่าเสียเวลาจอดรอ</option>
              <option value="overtime">ค่าล่วงเวลา (OT)</option>
              <option value="advance">เบิกเงินล่วงหน้า</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70">
                  <TableHead className="font-semibold text-slate-800">วันที่บันทึก</TableHead>
                  <TableHead className="font-semibold text-slate-800">รหัสงาน (Job ID)</TableHead>
                  <TableHead className="font-semibold text-slate-800">พนักงานขับรถ (พขร.)</TableHead>
                  <TableHead className="font-semibold text-slate-800">ประเภทค่าใช้จ่าย</TableHead>
                  <TableHead className="font-semibold text-slate-800">รายละเอียด / หมายเหตุ</TableHead>
                  <TableHead className="text-right font-semibold text-slate-800">จำนวนเงิน (บาท)</TableHead>
                  <TableHead className="text-center font-semibold text-slate-800">สถานะ</TableHead>
                  <TableHead className="text-right font-semibold text-slate-800">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      ไม่พบรายการค่าใช้จ่ายที่ตรงกับเงื่อนไข
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((exp) => {
                    const cfg = expenseTypeConfig[exp.expense_type];
                    const Icon = cfg?.icon || Receipt;
                    return (
                      <TableRow key={exp.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {exp.created_at ? new Date(exp.created_at).toLocaleDateString('th-TH') : '-'}
                        </TableCell>
                        <TableCell className="font-bold text-blue-700 whitespace-nowrap">
                          {exp.job?.job_no || '-'}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900 whitespace-nowrap">
                          {exp.driver?.name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-medium gap-1 text-xs ${cfg?.badgeClass || ''}`}>
                            <Icon className="h-3 w-3" />
                            {cfg?.label || exp.expense_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 max-w-xs truncate">
                          {exp.description || '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold whitespace-nowrap">
                          {exp.expense_type === 'advance' ? (
                            <span className="text-cyan-700">- ฿{Number(exp.amount).toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-900">฿{Number(exp.amount).toLocaleString()}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px]">
                            อนุมัติแล้ว
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* ================= MODAL: ADD EXPENSE ================= */}
      <Dialog open={openAddModal} onOpenChange={setOpenAddModal}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleCreateExpense}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                บันทึกค่าใช้จ่าย พขร. / เบิกเงินล่วงหน้า
              </DialogTitle>
              <DialogDescription>
                บันทึกรายการเบี้ยเลี้ยง ค่าน้ำมัน ค่าทางด่วน หรือเงินเบิกล่วงหน้า
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="space-y-1">
                <Label htmlFor="m_job">เลือกงานขนส่ง (Job ID) *</Label>
                <select
                  id="m_job"
                  required
                  className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                  value={formData.job_id}
                  onChange={(e) => handleJobSelectInModal(e.target.value)}
                >
                  <option value="">-- เลือก Job ID --</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.job_no}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="m_driver">พนักงานขับรถ (พขร.) *</Label>
                <select
                  id="m_driver"
                  required
                  className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                  value={formData.driver_id}
                  onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                >
                  <option value="">-- เลือก พขร. --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (เรทปกติ: ฿{d.daily_rate}/วัน)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="m_type">ประเภทค่าใช้จ่าย *</Label>
                <select
                  id="m_type"
                  required
                  className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                  value={formData.expense_type}
                  onChange={(e) => setFormData({ ...formData, expense_type: e.target.value as ExpenseType })}
                >
                  <option value="per_diem">เบี้ยเลี้ยงรายวัน (Daily Per Diem)</option>
                  <option value="fuel">ค่าน้ำมัน (Fuel Cost)</option>
                  <option value="toll">ค่าทางด่วน (Toll Fees)</option>
                  <option value="waiting">ค่าเสียเวลาจอดรอ (Waiting Penalties)</option>
                  <option value="overtime">ค่าล่วงเวลา (Overtime - OT)</option>
                  <option value="advance">เบิกเงินล่วงหน้า (Advance Payment)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="m_amount">จำนวนเงิน (บาท) *</Label>
                <Input
                  id="m_amount"
                  type="number"
                  required
                  placeholder="600"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="font-bold text-blue-700 text-base"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="m_desc">รายละเอียด / เลขที่ใบเสร็จ</Label>
                <Input
                  id="m_desc"
                  placeholder="เช่น ปั๊ม ปตท. ใบเสร็จเลขที่..., ทางด่วน ด่านบางปะอิน"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenAddModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                บันทึกรายการ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: PRINTABLE DRIVER VOUCHER ================= */}
      <Dialog open={openVoucherModal} onOpenChange={setOpenVoucherModal}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-600" />
              ใบสำคัญเคลียร์ค่าใช้จ่าย พขร. (Driver Payment Voucher)
            </DialogTitle>
            <DialogDescription>
              ใบสรุปเบี้ยเลี้ยง ค่าน้ำมัน ทางด่วน และยอดหักเงินเบิกล่วงหน้า
            </DialogDescription>
          </DialogHeader>

          {/* Printable Voucher Content */}
          <div className="border-2 border-slate-900 p-6 rounded-lg bg-white text-slate-900 space-y-4 print:border-none print:p-0">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-black text-slate-900">บริษัท คอนเนค ทรานสปอร์ต จำกัด</h2>
                <p className="text-xs text-slate-600">ใบสำคัญจ่ายและเคลียร์เงินพนักงานขับรถ (Driver Voucher)</p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="font-bold text-xs">
                  VOUCHER
                </Badge>
                <div className="text-xs text-slate-600 mt-1">วันที่: {currentDateStr}</div>
              </div>
            </div>

            {/* Driver Info */}
            <div className="p-3 bg-slate-50 rounded border text-xs grid grid-cols-2 gap-2">
              <div><strong>ชื่อ พขร.:</strong> {voucherDriver?.name}</div>
              <div><strong>เบอร์โทร:</strong> {voucherDriver?.phone || '-'}</div>
              <div><strong>เลขที่ใบขับขี่:</strong> {voucherDriver?.license_number || '-'}</div>
              <div><strong>เบี้ยเลี้ยงมาตรฐาน:</strong> ฿{Number(voucherDriver?.daily_rate || 0).toLocaleString()}/วัน</div>
            </div>

            {/* Expenses List */}
            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 text-xs">
                    <TableHead>งาน (Job No)</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                    <TableHead className="text-right">จำนวนเงิน (บาท)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voucherDriverExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-xs text-slate-500">
                        ไม่มีรายการค่าใช้จ่ายของ พขร. ท่านนี้
                      </TableCell>
                    </TableRow>
                  ) : (
                    voucherDriverExpenses.map((e) => (
                      <TableRow key={e.id} className="text-xs">
                        <TableCell className="font-bold text-blue-700">{e.job?.job_no || '-'}</TableCell>
                        <TableCell>{expenseTypeConfig[e.expense_type]?.label || e.expense_type}</TableCell>
                        <TableCell className="text-slate-600">{e.description || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {e.expense_type === 'advance' ? (
                            <span className="text-cyan-700">(หักเงินเบิก) -฿{Number(e.amount).toLocaleString()}</span>
                          ) : (
                            <span>฿{Number(e.amount).toLocaleString()}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="p-3 bg-slate-100 rounded border space-y-1 text-xs">
              <div className="flex justify-between">
                <span>รวมค่าใช้จ่ายจริงทั้งหมด (เบี้ยเลี้ยง + น้ำมัน + ทางด่วน + OT):</span>
                <strong className="text-slate-900">฿{voucherDriverTotal.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-cyan-800">
                <span>หัก เงินเบิกสำรองล่วงหน้า (Advance):</span>
                <strong>- ฿{voucherDriverAdvance.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-300">
                <span>ยอดจ่ายสุทธิแก่ พขร. (Net Payable):</span>
                <span className={voucherDriverNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  ฿{voucherDriverNet.toLocaleString()} บาท
                </span>
              </div>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs">
              <div className="border-t border-slate-400 pt-2">
                <div>( {voucherDriver?.name || '................................'} )</div>
                <div className="text-slate-500 text-[11px] mt-1">พนักงานขับรถ ผู้รับเงิน</div>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <div>( ......................................... )</div>
                <div className="text-slate-500 text-[11px] mt-1">เจ้าหน้าที่การเงิน / บัญชี ผู้จ่ายเงิน</div>
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={() => setOpenVoucherModal(false)}>
              ปิดหน้าต่าง
            </Button>
            <Button type="button" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Printer className="h-4 w-4" />
              พิมพ์ใบสำคัญจ่าย (Print Voucher)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
