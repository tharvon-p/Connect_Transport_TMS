'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Job, Driver, Vehicle, DriverExpense, ExpenseType } from '@/types/database';
import { SortableHeader, sortArray, SortState } from '@/components/ui/table-sort';
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
  TrendingDown,
  Download,
  Truck,
  Image as ImageIcon,
  Paperclip,
  X,
  ExternalLink
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

const STANDARD_DESCRIPTIONS: Record<string, string[]> = {
  per_diem: ['เบี้ยเลี้ยงประจำเที่ยววิ่ง', 'เบี้ยเลี้ยงค้างคืน'],
  fuel: ['ค่าน้ำมันดีเซล (ปตท.)', 'ค่าน้ำมันดีเซล (บางจาก)', 'ค่าน้ำมันดีเซล (เชลล์)'],
  toll: ['ค่าทางด่วนบูรพาวิถี', 'ค่าทางด่วนมอเตอร์เวย์', 'ค่าทางด่วนด่านบางปะอิน', 'ค่าโทลล์เวย์'],
  waiting: ['ค่าเสียเวลาจอดรอขึ้นตู้เกิน 4 ชม.', 'ค่าเสียเวลาจอดรอคืนตู้ท่าเรือ'],
  overtime: ['ค่าทำงานล่วงเวลา (OT) วันหยุด', 'ค่า OT กะดึก'],
  advance: ['เบิกเงินสำรองค่าน้ำมันล่วงหน้า', 'เบิกเงินค่าเบี้ยเลี้ยงล่วงหน้า'],
};

interface ExpenseWithRelations extends DriverExpense {
  job?: Job;
  driver?: Driver;
  truck_name_id?: string;
  receipt_url?: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [truckFilter, setTruckFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Sorting State
  const [expenseSort, setExpenseSort] = useState<SortState>({ key: 'created_at', direction: 'desc' });
  const handleSort = (key: string) => {
    setExpenseSort(prev => ({
      key,
      direction: prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc'
    }));
  };

  // Modal States
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openVoucherModal, setOpenVoucherModal] = useState(false);
  const [voucherDriver, setVoucherDriver] = useState<Driver | null>(null);
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    job_id: '',
    truck_name_id: '',
    driver_id: '',
    expense_type: 'per_diem' as ExpenseType,
    amount: '600',
    description: 'เบี้ยเลี้ยงประจำเที่ยววิ่ง',
    receipt_url: '',
    status: 'approved',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expRes, jobRes, drivRes, vehRes] = await Promise.all([
        supabase
          .from('driver_expenses')
          .select(`
            *,
            job:jobs(id, job_no, customer_id, truck_name_id, origin:locations!origin_id(name), destination:locations!destination_id(name)),
            driver:drivers(id, name, phone, daily_rate)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('jobs').select('id, job_no, driver_id, truck_name_id').order('job_date', { ascending: false }),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('vehicles').select('*').order('truck_name_id'),
      ]);

      if (expRes.data) setExpenses(expRes.data as ExpenseWithRelations[]);
      if (jobRes.data) setJobs(jobRes.data as unknown as Job[]);
      if (drivRes.data) setDrivers(drivRes.data as Driver[]);
      if (vehRes.data) setVehicles(vehRes.data as Vehicle[]);
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
      truck_name_id: defaultJob?.truck_name_id || '',
      driver_id: defaultJob?.driver_id || defaultDriver?.id || '',
      expense_type: 'per_diem',
      amount: String(defaultDriver?.daily_rate || 600),
      description: 'เบี้ยเลี้ยงประจำเที่ยววิ่ง',
      receipt_url: '',
      status: 'approved',
    });
    setOpenAddModal(true);
  };

  // Job change in modal auto-selects driver and truck
  const handleJobSelectInModal = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    setFormData((prev) => ({
      ...prev,
      job_id: jobId,
      truck_name_id: job?.truck_name_id || prev.truck_name_id,
      driver_id: job?.driver_id || prev.driver_id,
    }));
  };

  // Truck change auto-selects paired driver
  const handleTruckSelectInModal = (truckNameId: string) => {
    const veh = vehicles.find((v) => v.truck_name_id === truckNameId);
    let autoDriverId = formData.driver_id;
    if (veh?.paired_driver_id || veh?.driver_id) {
      autoDriverId = (veh.paired_driver_id || veh.driver_id) as string;
    }
    setFormData((prev) => ({
      ...prev,
      truck_name_id: truckNameId,
      driver_id: autoDriverId,
    }));
  };

  // Receipt image upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          receipt_url: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
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
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchDriver = driverFilter === 'all' || e.driver_id === driverFilter;
      const matchType = typeFilter === 'all' || e.expense_type === typeFilter;
      const matchTruck = truckFilter === 'all' || 
                         e.truck_name_id === truckFilter || 
                         e.job?.truck_name_id === truckFilter;
      return matchDriver && matchType && matchTruck;
    });
  }, [expenses, driverFilter, truckFilter, typeFilter]);

  // Sorted expenses
  const sortedExpenses = useMemo(() => {
    return sortArray(filteredExpenses, expenseSort.key, expenseSort.direction, (e) => {
      if (expenseSort.key === 'job_no') return e.job?.job_no || '';
      if (expenseSort.key === 'truck') return e.truck_name_id || e.job?.truck_name_id || '';
      if (expenseSort.key === 'driver') return e.driver?.name || '';
      if (expenseSort.key === 'amount') return Number(e.amount || 0);
      return (e as any)[expenseSort.key];
    });
  }, [filteredExpenses, expenseSort]);

  // Financial Calculations on filtered expenses
  const totalPerDiem = filteredExpenses.filter((e) => e.expense_type === 'per_diem').reduce((s, e) => s + Number(e.amount), 0);
  const totalFuel = filteredExpenses.filter((e) => e.expense_type === 'fuel').reduce((s, e) => s + Number(e.amount), 0);
  const totalToll = filteredExpenses.filter((e) => e.expense_type === 'toll').reduce((s, e) => s + Number(e.amount), 0);
  const totalWaiting = filteredExpenses.filter((e) => e.expense_type === 'waiting').reduce((s, e) => s + Number(e.amount), 0);
  const totalOT = filteredExpenses.filter((e) => e.expense_type === 'overtime').reduce((s, e) => s + Number(e.amount), 0);
  const totalAdvance = filteredExpenses.filter((e) => e.expense_type === 'advance').reduce((s, e) => s + Number(e.amount), 0);

  // Total Actual Costs
  const totalOperatingCosts = totalPerDiem + totalFuel + totalToll + totalWaiting + totalOT;
  // Net Settlement
  const netPayable = totalOperatingCosts - totalAdvance;

  // Export Expenses to CSV with UTF-8 BOM
  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = [
      'วันที่',
      'เลขที่งาน (Job No)',
      'เบอร์รถ',
      'พนักงานขับรถ',
      'ประเภทค่าใช้จ่าย',
      'รายละเอียด',
      'จำนวนเงิน (บาท)',
      'สถานะ',
    ];

    const rows = filteredExpenses.map((e) => [
      `"${e.created_at ? new Date(e.created_at).toLocaleDateString('th-TH') : '-'}"`,
      `"${e.job?.job_no || '-'}"`,
      `"${e.truck_name_id || e.job?.truck_name_id || '-'}"`,
      `"${(e.driver?.name || '-').replace(/"/g, '""')}"`,
      `"${expenseTypeConfig[e.expense_type]?.label || e.expense_type}"`,
      `"${(e.description || '-').replace(/"/g, '""')}"`,
      e.expense_type === 'advance' ? -Number(e.amount) : Number(e.amount),
      `"${e.status === 'approved' ? 'อนุมัติแล้ว' : 'รอตรวจสอบ'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Connect_Transport_Expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* ================= HEADER & ACTIONS ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Module 4: Driver Allowance & Expenses
            </span>
            <span className="text-xs text-slate-500 font-medium">Connect Transport Co., Ltd.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <Wallet className="h-7 w-7 text-blue-600" />
            ระบบเบี้ยเลี้ยงและค่าใช้จ่าย พขร.
          </h1>
          <p className="text-slate-500 text-sm">
            บันทึกเบี้ยเลี้ยงรายวัน ค่าน้ำมัน ค่าทางด่วน ค่าเสียเวลาจอดรอ ค่า OT และตัดยอดเงินเบิกล่วงหน้า พร้อมใบสำคัญจ่าย
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData} 
            disabled={loading}
            className="gap-2 bg-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCSV}
            className="gap-2 bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            ส่งออก CSV (Excel)
          </Button>

          <Button 
            size="sm" 
            onClick={handleOpenAddModal}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
          >
            <Plus className="h-4 w-4" />
            บันทึกค่าใช้จ่าย / เบิกเงิน
          </Button>
        </div>
      </div>

      {/* ================= KPI METRIC CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 print:hidden">
        {/* Card 1: Per Diem & OT */}
        <Card className="border-slate-200 shadow-sm bg-white">
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
        <Card className="border-slate-200 shadow-sm bg-white">
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
        <Card className="border-slate-200 shadow-sm bg-white">
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
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-cyan-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-cyan-800">เบิกเงินล่วงหน้า (Advance)</CardTitle>
            <TrendingDown className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-cyan-700">฿{totalAdvance.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">เงินที่ พขร. เบิกไปก่อนเริ่มวิ่งงาน</p>
          </CardContent>
        </Card>

        {/* Card 5: Net Payable */}
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/60 col-span-2 lg:col-span-1">
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

      {/* ================= DRIVER SUMMARY & VOUCHER CARDS ================= */}
      <Card className="border-slate-200 shadow-sm bg-white print:hidden">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <User className="h-4 w-4 text-blue-600" />
            สรุปยอดรายบุคคล & ออกใบเคลียร์เงิน (Driver Vouchers)
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            คลิกที่ปุ่ม &ldquo;ใบเคลียร์เงิน&rdquo; เพื่อพิมพ์ใบสำคัญจ่าย / เคลียร์ค่าใช้จ่ายของ พขร. แต่ละคน
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {drivers.map((d) => {
              const dExps = expenses.filter((e) => e.driver_id === d.id);
              const dCosts = dExps.filter((e) => e.expense_type !== 'advance').reduce((s, e) => s + Number(e.amount), 0);
              const dAdv = dExps.filter((e) => e.expense_type === 'advance').reduce((s, e) => s + Number(e.amount), 0);
              const dNet = dCosts - dAdv;
              const pairedTruck = vehicles.find((v) => v.paired_driver_id === d.id || v.driver_id === d.id);

              return (
                <div key={d.id} className="p-3 bg-slate-50 border rounded-xl shadow-xs space-y-2 flex flex-col justify-between hover:bg-slate-100/60 transition-colors">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">{d.name}</span>
                      {pairedTruck?.truck_name_id && (
                        <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 font-mono">
                          {pairedTruck.truck_name_id}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">โทร: {d.phone || '-'}</div>
                    <div className="text-xs text-slate-600 mt-2 space-y-0.5">
                      <div className="flex justify-between">
                        <span>ค่าใช้จ่ายจริง:</span>
                        <strong className="text-slate-800">฿{dCosts.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between text-cyan-700">
                        <span>เบิกล่วงหน้า:</span>
                        <strong>- ฿{dAdv.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-700 pt-1 border-t border-slate-200">
                        <span>ยอดเคลียร์สุทธิ:</span>
                        <span className={dNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          ฿{dNet.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenVoucher(d)}
                    className="w-full text-xs gap-1.5 mt-2 bg-white border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-600" />
                    ใบสำคัญจ่าย (Voucher)
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ================= EXPENSES TABLE ================= */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              บันทึกประวัติค่าใช้จ่ายทั้งหมด ({filteredExpenses.length} รายการ)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              แสดงรายการเบี้ยเลี้ยง ค่าน้ำมัน ทางด่วน ค่าจอดรอ และเงินเบิกล่วงหน้า
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Truck Filter */}
            <select
              className="border rounded-md px-2.5 py-1.5 text-xs bg-white border-slate-300"
              value={truckFilter}
              onChange={(e) => setTruckFilter(e.target.value)}
              aria-label="กรองเบอร์รถ"
            >
              <option value="all">รถทุกคัน</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.truck_name_id || v.id}>
                  {v.truck_name_id ? `${v.truck_name_id} (${v.plate_number})` : v.plate_number}
                </option>
              ))}
            </select>

            {/* Driver Filter */}
            <select
              className="border rounded-md px-2.5 py-1.5 text-xs bg-white border-slate-300"
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              aria-label="กรองพนักงานขับรถ"
            >
              <option value="all">พขร. ทุกคน ({drivers.length})</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              className="border rounded-md px-2.5 py-1.5 text-xs bg-white border-slate-300"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="กรองประเภทค่าใช้จ่าย"
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

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/80 text-xs">
                  <SortableHeader title="วันที่บันทึก" sortKey="created_at" currentSort={expenseSort} onSort={handleSort} />
                  <SortableHeader title="รหัสงาน (Job ID)" sortKey="job_no" currentSort={expenseSort} onSort={handleSort} className="font-bold text-blue-900" />
                  <SortableHeader title="เบอร์รถ / พขร." sortKey="truck" currentSort={expenseSort} onSort={handleSort} />
                  <SortableHeader title="ประเภทค่าใช้จ่าย" sortKey="expense_type" currentSort={expenseSort} onSort={handleSort} />
                  <TableHead className="font-semibold text-slate-800">รายละเอียด / หมายเหตุ</TableHead>
                  <SortableHeader title="จำนวนเงิน (บาท)" sortKey="amount" currentSort={expenseSort} onSort={handleSort} align="right" />
                  <SortableHeader title="สถานะ" sortKey="status" currentSort={expenseSort} onSort={handleSort} align="center" />
                  <TableHead className="text-right font-semibold text-slate-800 print:hidden">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500 text-xs">
                      ไม่พบรายการค่าใช้จ่ายที่ตรงกับเงื่อนไข
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedExpenses.map((exp) => {
                    const cfg = expenseTypeConfig[exp.expense_type];
                    const Icon = cfg?.icon || Receipt;
                    const truckDisplay = exp.truck_name_id || exp.job?.truck_name_id;

                    return (
                      <TableRow key={exp.id} className="hover:bg-slate-50/80 text-xs">
                        <TableCell className="text-slate-600 whitespace-nowrap">
                          {exp.created_at ? new Date(exp.created_at).toLocaleDateString('th-TH') : '-'}
                        </TableCell>
                        <TableCell className="font-bold text-blue-700 whitespace-nowrap">
                          {exp.job?.job_no || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {truckDisplay && (
                              <Badge className="bg-blue-600 text-white font-mono text-[10px] px-1.5 py-0">
                                {truckDisplay}
                              </Badge>
                            )}
                            <span className="font-medium text-slate-900">{exp.driver?.name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-medium gap-1 text-[11px] ${cfg?.badgeClass || ''}`}>
                            <Icon className="h-3 w-3" />
                            {cfg?.label || exp.expense_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-700 max-w-xs truncate">
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
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[10px]">
                            อนุมัติแล้ว
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right print:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7"
                            title="ลบรายการ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleCreateExpense}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                บันทึกค่าใช้จ่าย พขร. / เบิกเงินล่วงหน้า
              </DialogTitle>
              <DialogDescription className="text-xs">
                บันทึกรายการเบี้ยเลี้ยง ค่าน้ำมัน ค่าทางด่วน หรือเงินเบิกล่วงหน้า พร้อมผูกเบอร์รถและ พขร.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-sm">
              {/* Job Selection */}
              <div className="space-y-1">
                <Label htmlFor="m_job" className="text-xs font-semibold">เลือกงานขนส่ง (Job ID) *</Label>
                <select
                  id="m_job"
                  required
                  className="w-full border rounded-md p-2 text-xs bg-white border-slate-300"
                  value={formData.job_id}
                  onChange={(e) => handleJobSelectInModal(e.target.value)}
                >
                  <option value="">-- เลือก Job ID --</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.job_no} {j.truck_name_id ? `(${j.truck_name_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Truck & Driver Pair */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="m_truck" className="text-xs font-semibold">เบอร์รถ (Truck)</Label>
                  <select
                    id="m_truck"
                    className="w-full border rounded-md p-2 text-xs bg-white border-slate-300"
                    value={formData.truck_name_id}
                    onChange={(e) => handleTruckSelectInModal(e.target.value)}
                  >
                    <option value="">-- ระบุเบอร์รถ --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.truck_name_id || v.id}>
                        {v.truck_name_id ? `${v.truck_name_id} (${v.plate_number})` : v.plate_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="m_driver" className="text-xs font-semibold">พนักงานขับรถ (พขร.) *</Label>
                  <select
                    id="m_driver"
                    required
                    className="w-full border rounded-md p-2 text-xs bg-white border-slate-300"
                    value={formData.driver_id}
                    onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                  >
                    <option value="">-- เลือก พขร. --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (เรท: ฿{d.daily_rate})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Expense Type */}
              <div className="space-y-1">
                <Label htmlFor="m_type" className="text-xs font-semibold">ประเภทค่าใช้จ่าย *</Label>
                <select
                  id="m_type"
                  required
                  className="w-full border rounded-md p-2 text-xs bg-white border-slate-300"
                  value={formData.expense_type}
                  onChange={(e) => {
                    const newType = e.target.value as ExpenseType;
                    const defaultDesc = STANDARD_DESCRIPTIONS[newType]?.[0] || '';
                    setFormData({ ...formData, expense_type: newType, description: defaultDesc });
                  }}
                >
                  <option value="per_diem">เบี้ยเลี้ยงรายวัน (Daily Per Diem)</option>
                  <option value="fuel">ค่าน้ำมัน (Fuel Cost)</option>
                  <option value="toll">ค่าทางด่วน (Toll Fees)</option>
                  <option value="waiting">ค่าเสียเวลาจอดรอ (Waiting Penalties)</option>
                  <option value="overtime">ค่าล่วงเวลา (Overtime - OT)</option>
                  <option value="advance">เบิกเงินล่วงหน้า (Advance Payment)</option>
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <Label htmlFor="m_amount" className="text-xs font-semibold">จำนวนเงิน (บาท) *</Label>
                <Input
                  id="m_amount"
                  type="number"
                  required
                  placeholder="600"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="font-bold text-blue-700 text-base h-9"
                />
              </div>

              {/* Description & Quick Preset Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="m_desc" className="text-xs font-semibold">รายละเอียด / เลขที่ใบเสร็จ</Label>
                  <span className="text-[11px] text-slate-400">คลิกข้อความลัดด้านล่างเพื่อเลือก</span>
                </div>
                <Input
                  id="m_desc"
                  placeholder="เช่น ปตท. สาขา..., ทางด่วน ด่านบางปะอิน"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="h-8 text-xs"
                />
                {/* Standard quick chips */}
                {STANDARD_DESCRIPTIONS[formData.expense_type] && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {STANDARD_DESCRIPTIONS[formData.expense_type].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, description: preset })}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Receipt Image Upload */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">แนบรูปใบเสร็จ / สลิปโอนเงิน (ถ้ามี)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="h-8 text-xs bg-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700"
                  />
                  {formData.receipt_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewImage(formData.receipt_url)}
                      className="h-8 text-xs gap-1 text-blue-600"
                    >
                      <ImageIcon className="h-3.5 w-3.5" /> ดูรูป
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenAddModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                บันทึกรายการ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: PRINTABLE DRIVER VOUCHER ================= */}
      <Dialog open={openVoucherModal} onOpenChange={setOpenVoucherModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[92vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-600" />
              ใบสำคัญเคลียร์ค่าใช้จ่าย พขร. (Driver Payment Voucher)
            </DialogTitle>
            <DialogDescription className="text-xs">
              ใบสรุปเบี้ยเลี้ยง ค่าน้ำมัน ทางด่วน และยอดหักเงินเบิกล่วงหน้า เพื่อเบิกจ่ายเงินสด
            </DialogDescription>
          </DialogHeader>

          {/* Printable Voucher Content */}
          <div className="border border-slate-800 p-6 rounded-lg bg-white text-slate-900 space-y-4 print:border-none print:p-0">
            {/* Header with Logo */}
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
              <div className="flex items-start gap-3">
                <Image 
                  src="/images/logo-print.png" 
                  alt="Connect Transport Logo" 
                  width={140} 
                  height={48} 
                  className="object-contain" 
                />
                <div>
                  <h2 className="text-base font-black text-slate-900">บริษัท คอนเนค ทรานสปอร์ต จำกัด</h2>
                  <p className="text-[11px] text-slate-600">CONNECT TRANSPORT CO., LTD.</p>
                  <p className="text-[10px] text-slate-500">ใบสำคัญจ่ายและเคลียร์เงินพนักงานขับรถ (Driver Payment Voucher)</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="font-bold text-xs border-slate-800 text-slate-800">
                  VOUCHER
                </Badge>
                <div className="text-[11px] text-slate-600 mt-1">วันที่: {currentDateStr}</div>
              </div>
            </div>

            {/* Driver Info */}
            <div className="p-3 bg-slate-50 rounded border text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><strong>ชื่อ พขร.:</strong> {voucherDriver?.name}</div>
              <div><strong>เบอร์โทร:</strong> {voucherDriver?.phone || '-'}</div>
              <div><strong>เลขที่ใบขับขี่:</strong> {voucherDriver?.license_number || '-'}</div>
              <div><strong>เรทเบี้ยเลี้ยง:</strong> ฿{Number(voucherDriver?.daily_rate || 0).toLocaleString()}/วัน</div>
            </div>

            {/* Expenses List */}
            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 text-xs">
                    <TableHead className="font-semibold text-slate-800">งาน (Job No)</TableHead>
                    <TableHead className="font-semibold text-slate-800">รายการค่าใช้จ่าย</TableHead>
                    <TableHead className="font-semibold text-slate-800">รายละเอียด</TableHead>
                    <TableHead className="text-right font-semibold text-slate-800">จำนวนเงิน (บาท)</TableHead>
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
                            <span className="text-cyan-700 font-semibold">(หักเงินเบิก) -฿{Number(e.amount).toLocaleString()}</span>
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
            <div className="p-3 bg-slate-50 rounded border space-y-1 text-xs">
              <div className="flex justify-between">
                <span>รวมค่าใช้จ่ายจริงทั้งหมด (เบี้ยเลี้ยง + น้ำมัน + ทางด่วน + OT):</span>
                <strong className="text-slate-900">฿{voucherDriverTotal.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-cyan-800">
                <span>หัก เงินเบิกสำรองล่วงหน้า (Advance):</span>
                <strong>- ฿{voucherDriverAdvance.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-sm font-black pt-1.5 border-t border-slate-300">
                <span>ยอดจ่ายสุทธิแก่ พขร. (Net Payable):</span>
                <span className={voucherDriverNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  ฿{voucherDriverNet.toLocaleString()} บาท
                </span>
              </div>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs">
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
            <Button type="button" variant="outline" size="sm" onClick={() => setOpenVoucherModal(false)}>
              ปิดหน้าต่าง
            </Button>
            <Button type="button" size="sm" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Printer className="h-4 w-4" />
              พิมพ์ใบสำคัญจ่าย (Print Voucher)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: RECEIPT IMAGE PREVIEW ================= */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">รูปหลักฐานใบเสร็จ / สลิปโอนเงิน</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImage} alt="Receipt Preview" className="max-h-[60vh] object-contain rounded border" />
            </div>
            <DialogFooter>
              <Button type="button" size="sm" onClick={() => setPreviewImage(null)}>
                ปิดรูป
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
