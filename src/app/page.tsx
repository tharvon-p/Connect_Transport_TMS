'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Job, Vehicle, Driver, Customer } from '@/types/database';
import { 
  Truck, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  CreditCard, 
  Percent, 
  ArrowUpRight,
  Route, 
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Printer,
  Copy,
  Check,
  Search,
  Filter,
  Calendar,
  Phone,
  Building2,
  Box,
  FileCheck2,
  Navigation
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableHeader, sortArray, SortState } from '@/components/ui/table-sort';

// Helper labels
const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  draft: { label: 'ฉบับร่าง', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
  assigned: { label: 'มอบหมายแล้ว', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  in_progress: { label: 'กำลังวิ่งงาน', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  completed: { label: 'เสร็จสิ้น', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelled: { label: 'ยกเลิก', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' },
};

const vehicleTypeMap: Record<string, string> = {
  '4_wheel': '4 ล้อ',
  '6_wheel': '6 ล้อ',
  '10_wheel': '10 ล้อ',
  'trailer': 'หัวลากเทรลเลอร์',
  'semi_trailer': 'กึ่งพ่วง',
};

interface RouteSummary {
  routeKey: string;
  originName: string;
  destinationName: string;
  jobCount: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [datePeriod, setDatePeriod] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [truckFilter, setTruckFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Date strings for filtering safely computed in useEffect to avoid Next.js static prerender errors
  const [todayDateStr, setTodayDateStr] = useState('');
  const [sevenDaysAgoDateStr, setSevenDaysAgoDateStr] = useState('');
  const [monthStartDateStr, setMonthStartDateStr] = useState('');
  const [printDateStr, setPrintDateStr] = useState('');

  // UI state for copy feedback
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);

  // Fetch jobs data with relations
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [jobsRes, vehRes, drivRes, custRes] = await Promise.all([
        supabase
          .from('jobs')
          .select(`
            *,
            customer:customers(*),
            origin:locations!origin_id(*),
            destination:locations!destination_id(*),
            vehicle:vehicles(*),
            driver:drivers(*)
          `)
          .order('job_date', { ascending: false }),
        supabase.from('vehicles').select('*').order('truck_name_id'),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('customers').select('*').order('company_name'),
      ]);

      if (jobsRes.data) setJobs(jobsRes.data as Job[]);
      if (vehRes.data) setVehicles(vehRes.data as Vehicle[]);
      if (drivRes.data) setDrivers(drivRes.data as Driver[]);
      if (custRes.data) setCustomers(custRes.data as Customer[]);
    } catch (err) {
      console.error('Error fetching dashboard jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const now = new Date();
    setTodayDateStr(now.toISOString().split('T')[0]);
    const seven = new Date();
    seven.setDate(seven.getDate() - 7);
    setSevenDaysAgoDateStr(seven.toISOString().split('T')[0]);
    setMonthStartDateStr(now.toISOString().slice(0, 7) + '-01');
    setPrintDateStr(`${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH')}`);
  }, []);

  // Filtered jobs memo
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 1. Date filter
      if (datePeriod === 'today') {
        if (todayDateStr && job.job_date !== todayDateStr) return false;
      } else if (datePeriod === '7days') {
        if (sevenDaysAgoDateStr && (job.job_date < sevenDaysAgoDateStr || (todayDateStr && job.job_date > todayDateStr))) return false;
      } else if (datePeriod === 'month') {
        if (monthStartDateStr && job.job_date < monthStartDateStr) return false;
      } else if (datePeriod === 'custom') {
        if (customStartDate && job.job_date < customStartDate) return false;
        if (customEndDate && job.job_date > customEndDate) return false;
      }

      // 2. Truck filter (by truck_name_id or vehicle_id)
      if (truckFilter !== 'all') {
        const matchesTruckId = job.vehicle_id === truckFilter;
        const matchesTruckNameId = job.truck_name_id === truckFilter || job.vehicle?.truck_name_id === truckFilter;
        if (!matchesTruckId && !matchesTruckNameId) return false;
      }

      // 3. Driver filter
      if (driverFilter !== 'all') {
        if (job.driver_id !== driverFilter) return false;
      }

      // 4. Customer filter
      if (customerFilter !== 'all') {
        if (job.customer_id !== customerFilter) return false;
      }

      // 5. Status filter
      if (statusFilter !== 'all') {
        if (job.status !== statusFilter) return false;
      }

      // 6. Search term (Job No, Container No, B/L, Booking, Customer, Driver)
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const jNo = (job.job_no || '').toLowerCase();
        const cNo = (job.container_no || '').toLowerCase();
        const bNo = (job.booking_no || '').toLowerCase();
        const bl = (job.bl_no || '').toLowerCase();
        const custName = (job.customer?.company_name || '').toLowerCase();
        const drivName = (job.driver?.name || '').toLowerCase();
        const truckName = (job.truck_name_id || job.vehicle?.truck_name_id || job.vehicle?.plate_number || '').toLowerCase();

        const match = jNo.includes(term) || cNo.includes(term) || bNo.includes(term) || bl.includes(term) ||
                      custName.includes(term) || drivName.includes(term) || truckName.includes(term);
        if (!match) return false;
      }

      return true;
    });
  }, [jobs, datePeriod, customStartDate, customEndDate, truckFilter, driverFilter, customerFilter, statusFilter, searchTerm]);

  // Financial Metrics on filtered jobs
  const totalJobs = filteredJobs.length;
  const completedJobs = filteredJobs.filter((j) => j.status === 'completed').length;
  const inProgressJobs = filteredJobs.filter((j) => j.status === 'in_progress').length;
  const pendingJobs = filteredJobs.filter((j) => j.status === 'draft' || j.status === 'assigned').length;

  const totalRevenue = filteredJobs.reduce((sum, j) => sum + (Number(j.revenue) || 0), 0);
  const totalCost = filteredJobs.reduce((sum, j) => sum + (Number(j.total_cost) || 0), 0);
  const netProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

  // Container volume summary
  const container20 = filteredJobs.filter((j) => j.container_size === '20').length;
  const container40 = filteredJobs.filter((j) => j.container_size === '40').length;
  const reeferCount = filteredJobs.filter((j) => j.container_type === 'Reefer').length;
  const dgCount = filteredJobs.filter((j) => j.cargo_type === 'DG').length;

  // Route Summary Grouping
  const routeSummaries = useMemo(() => {
    const routeMap: Record<string, RouteSummary> = {};
    filteredJobs.forEach((j) => {
      const originName = j.origin?.name || 'ไม่ระบุต้นทาง';
      const destinationName = j.destination?.name || 'ไม่ระบุปลายทาง';
      const key = `${originName} -> ${destinationName}`;

      if (!routeMap[key]) {
        routeMap[key] = {
          routeKey: key,
          originName,
          destinationName,
          jobCount: 0,
          totalRevenue: 0,
          totalCost: 0,
          netProfit: 0,
        };
      }
      routeMap[key].jobCount += 1;
      routeMap[key].totalRevenue += Number(j.revenue) || 0;
      routeMap[key].totalCost += Number(j.total_cost) || 0;
      routeMap[key].netProfit += (Number(j.revenue) || 0) - (Number(j.total_cost) || 0);
    });
    return Object.values(routeMap);
  }, [filteredJobs]);

  // Table Sorting States
  const [jobSort, setJobSort] = useState<SortState>({ key: 'job_date', direction: 'desc' });
  const [routeSort, setRouteSort] = useState<SortState>({ key: 'jobCount', direction: 'desc' });

  const handleJobSort = (key: string) => {
    setJobSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleRouteSort = (key: string) => {
    setRouteSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedFilteredJobs = useMemo(() => {
    return sortArray(filteredJobs, jobSort.key, jobSort.direction, (item) => {
      if (jobSort.key === 'truck') return item.truck_name_id || item.vehicle?.truck_name_id || '';
      if (jobSort.key === 'customer') return item.customer?.company_name || '';
      if (jobSort.key === 'container_no') return item.container_no || item.booking_no || item.bl_no || '';
      if (jobSort.key === 'route') return `${item.origin?.name || ''} ${item.destination?.name || ''}`;
      if (jobSort.key === 'container_size') return `${item.container_size || ''} ${item.container_type || ''}`;
      return (item as any)[jobSort.key];
    });
  }, [filteredJobs, jobSort]);

  const sortedRouteSummaries = useMemo(() => {
    return sortArray(routeSummaries, routeSort.key, routeSort.direction, (item) => {
      if (routeSort.key === 'margin') {
        return item.totalRevenue > 0 ? (item.netProfit / item.totalRevenue) * 100 : 0;
      }
      return (item as any)[routeSort.key];
    });
  }, [routeSummaries, routeSort]);

  // One-click LINE Job Order Text Generator
  const handleCopyLineText = (job: Job) => {
    const truckLabel = job.truck_name_id || job.vehicle?.truck_name_id || 'รถคัน-';
    const plate = job.vehicle?.plate_number ? `(${job.vehicle.plate_number})` : '';
    const driverName = job.driver?.name || 'ยังไม่ระบุ';
    const driverPhone = job.driver?.phone || '-';
    const cust = job.customer?.company_name || 'ลูกค้าทั่วไป';
    const volume = `${job.volume_count || 1}x${job.container_size}' ${job.container_type}`;
    const ship = job.shipping_agent ? `สายเรือ: ${job.shipping_agent}` : '';
    const bkg = job.booking_no ? `Booking: ${job.booking_no}` : '';
    const bl = job.bl_no ? `B/L: ${job.bl_no}` : '';
    const container = job.container_no ? `เบอร์ตู้: ${job.container_no} / ซีล: ${job.seal_no || '-'}` : 'เบอร์ตู้: (รอรับตู้เปล่า)';
    const origin = job.origin?.name || 'จุดรับตู้';
    const dest = job.destination?.name || 'จุดส่งตู้/คืนตู้';
    const allowance = job.driver_allowance ? `💰 เบี้ยเลี้ยง: ${Number(job.driver_allowance).toLocaleString()} บาท` : '';

    const lineText = `🚛 [Connect Transport - ใบสั่งงาน พขร.]
เลขที่งาน: ${job.job_no}
วันที่: ${job.job_date}
เบอร์รถ: ${truckLabel} ${plate}
พนักงานขับรถ: ${driverName} (โทร: ${driverPhone})
ลูกค้า: ${cust}
${ship ? ship + '\n' : ''}${bkg ? bkg + '\n' : ''}${bl ? bl + '\n' : ''}ขนาดตู้: ${volume} ${job.cargo_type === 'DG' ? '⚠️ [สินค้าอันตราย DG]' : ''}
${container}
-----------------------
📍 ต้นทาง: ${origin}
📍 ปลายทาง: ${dest}
-----------------------
${allowance}
⚠️ คำเตือน พขร.:
1. ถ่ายรูปสภาพตู้ 5 มุมผ่านระบบก่อนลากตู้
2. แนบรูปใบเสร็จค่าใช้จ่าย/ใบรับรองตู้ (EIR) ทุกครั้ง
3. ขับขี่ปลอดภัยด้วยความเร็วตามกฎหมายกำหนด`;

    navigator.clipboard.writeText(lineText);
    setCopiedJobId(job.id);
    setTimeout(() => setCopiedJobId(null), 2500);
  };

  // Export Filtered Jobs to CSV (with UTF-8 BOM for Thai Excel compatibility)
  const handleExportCSV = () => {
    if (filteredJobs.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = [
      'Job No',
      'วันที่',
      'เบอร์รถ',
      'ทะเบียนรถ',
      'พขร.',
      'เบอร์โทร พขร.',
      'ลูกค้า',
      'สายเรือ',
      'Booking No',
      'B/L No',
      'ขนาดตู้',
      'ประเภทตู้',
      'เบอร์ตู้',
      'เบอร์ซีล',
      'ต้นทาง',
      'ปลายทาง',
      'สถานะงาน',
      'สถานะ Invoice',
      'ราคาค่าขนส่ง (บาท)',
      'ต้นทุนรวม (บาท)',
      'กำไรสุทธิ (บาท)',
    ];

    const rows = filteredJobs.map((j) => [
      `"${j.job_no}"`,
      `"${j.job_date}"`,
      `"${j.truck_name_id || j.vehicle?.truck_name_id || '-'}"`,
      `"${j.vehicle?.plate_number || '-'}"`,
      `"${j.driver?.name || '-'}"`,
      `"${j.driver?.phone || '-'}"`,
      `"${(j.customer?.company_name || '-').replace(/"/g, '""')}"`,
      `"${j.shipping_agent || '-'}"`,
      `"${j.booking_no || '-'}"`,
      `"${j.bl_no || '-'}"`,
      `"${j.container_size}'"`,
      `"${j.container_type}"`,
      `"${j.container_no || '-'}"`,
      `"${j.seal_no || '-'}"`,
      `"${(j.origin?.name || '-').replace(/"/g, '""')}"`,
      `"${(j.destination?.name || '-').replace(/"/g, '""')}"`,
      `"${statusConfig[j.status]?.label || j.status}"`,
      `"${j.invoice_status === 'billed' ? 'ออกบิลแล้ว' : 'รอบิล'}"`,
      j.revenue || 0,
      j.total_cost || 0,
      (Number(j.revenue) || 0) - (Number(j.total_cost) || 0),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Connect_Transport_Jobs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* ================= PRINT HEADER (visible only in print) ================= */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image 
              src="/images/logo-print.png" 
              alt="Connect Transport Logo" 
              width={160} 
              height={54} 
              className="object-contain" 
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900">บริษัท คอนเนค ทรานสปอร์ต จำกัด</h1>
              <p className="text-xs text-slate-600">รายงานสรุปงานขนส่งและตารางวิ่งรถประจำวัน (Daily TMS Schedule)</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>วันที่พิมพ์: {printDateStr || '-'}</p>
            <p>จำนวนงานทั้งหมด: {filteredJobs.length} รายการ</p>
          </div>
        </div>
      </div>

      {/* ================= TOP BANNER & ACTION BAR ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Module 1: Operations & Financial Overview
            </span>
            <span className="text-xs text-slate-500 font-medium">Connect Transport Co., Ltd.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Dashboard ภาพรวมการเดินรถและการเงิน
          </h1>
          <p className="text-slate-500 text-sm">
            ศูนย์รวมข้อมูลควบคุมงานขนส่งตู้คอนเทนเนอร์ สั่งงาน พขร. ติดตามรายได้ และต้นทุนแบบ Real-time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData} 
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
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="gap-2 bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <Printer className="h-4 w-4 text-slate-600" />
            พิมพ์รายงาน (PDF)
          </Button>

          <Link href="/orders">
            <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm">
              <PlusCircle className="h-4 w-4" />
              เปิด Job ขนส่งใหม่
            </Button>
          </Link>
        </div>
      </div>

      {/* ================= TOP FILTER BAR ================= */}
      <Card className="border-slate-200 shadow-sm print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Filter className="h-4 w-4 text-blue-600" />
              <span>ตัวกรองค้นหาข้อมูล (Filters)</span>
              {filteredJobs.length !== jobs.length && (
                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                  พบ {filteredJobs.length} จาก {jobs.length} งาน
                </Badge>
              )}
            </div>
            {(datePeriod !== 'all' || truckFilter !== 'all' || driverFilter !== 'all' || customerFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDatePeriod('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setTruckFilter('all');
                  setDriverFilter('all');
                  setCustomerFilter('all');
                  setStatusFilter('all');
                  setSearchTerm('');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 h-7 px-2"
              >
                ล้างตัวกรองทั้งหมด
              </Button>
            )}
          </div>

          {/* Quick Date Period Buttons + Custom Inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> ช่วงเวลา:
            </span>
            <div className="inline-flex rounded-md shadow-sm border border-slate-200 p-0.5 bg-slate-100/80">
              <button
                type="button"
                onClick={() => setDatePeriod('all')}
                className={`px-3 py-1 text-xs font-medium rounded ${datePeriod === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setDatePeriod('today')}
                className={`px-3 py-1 text-xs font-medium rounded ${datePeriod === 'today' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => setDatePeriod('7days')}
                className={`px-3 py-1 text-xs font-medium rounded ${datePeriod === '7days' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                7 วันล่าสุด
              </button>
              <button
                type="button"
                onClick={() => setDatePeriod('month')}
                className={`px-3 py-1 text-xs font-medium rounded ${datePeriod === 'month' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                เดือนนี้
              </button>
              <button
                type="button"
                onClick={() => setDatePeriod('custom')}
                className={`px-3 py-1 text-xs font-medium rounded ${datePeriod === 'custom' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                กำหนดเอง
              </button>
            </div>

            {datePeriod === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 text-xs w-36 bg-white"
                />
                <span className="text-xs text-slate-400">ถึง</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 text-xs w-36 bg-white"
                />
              </div>
            )}
          </div>

          {/* Dropdown Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
            {/* Truck Filter */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">เบอร์รถบรรทุก</label>
              <select
                value={truckFilter}
                onChange={(e) => setTruckFilter(e.target.value)}
                aria-label="เลือกเบอร์รถบรรทุก"
                className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">รถทุกคัน</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.truck_name_id || v.id}>
                    {v.truck_name_id ? `${v.truck_name_id} (${v.plate_number})` : v.plate_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Driver Filter */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">พนักงานขับรถ (พขร.)</label>
              <select
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                aria-label="เลือกพนักงานขับรถ"
                className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">พขร. ทุกคน</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.phone ? `(${d.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Filter */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">ลูกค้า (Customer)</label>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                aria-label="เลือกลูกค้า"
                className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
              >
                <option value="all">ลูกค้าทั้งหมด</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">สถานะงานขนส่ง</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="เลือกสถานะงานขนส่ง"
                className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="draft">ฉบับร่าง (Draft)</option>
                <option value="assigned">มอบหมายแล้ว (Assigned)</option>
                <option value="in_progress">กำลังวิ่งงาน (In Progress)</option>
                <option value="completed">เสร็จสิ้น (Completed)</option>
                <option value="cancelled">ยกเลิก (Cancelled)</option>
              </select>
            </div>

            {/* Keyword Search */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">ค้นหาคำสำคัญ</label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Job No / ตู้ / BKG / B/L"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-xs pl-8 bg-white"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================= 1. STATUS CARDS ================= */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
          <span>สถานะงานขนส่งตู้คอนเทนเนอร์ (Job Status Overview)</span>
          <span className="text-[11px] font-normal lowercase text-slate-400">
            คำนวณจากงานที่เลือก {totalJobs} เที่ยว
          </span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Jobs */}
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">งานทั้งหมด (Total)</CardTitle>
              <Truck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{totalJobs} เที่ยว</div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                <span>ตู้ 20&apos;: <strong className="text-slate-700">{container20}</strong></span>
                <span>•</span>
                <span>ตู้ 40&apos;: <strong className="text-slate-700">{container40}</strong></span>
                {reeferCount > 0 && <span>• เย็น: <strong className="text-cyan-700">{reeferCount}</strong></span>}
                {dgCount > 0 && <span>• DG: <strong className="text-amber-700">{dgCount}</strong></span>}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Completed */}
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">งานเสร็จแล้ว (Completed)</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{completedJobs} เที่ยว</div>
              <p className="text-xs text-slate-500 mt-1">
                {totalJobs > 0 ? `${((completedJobs / totalJobs) * 100).toFixed(0)}% ของงานทั้งหมด` : 'ส่งมอบตู้และเคลียร์งานแล้ว'}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: In Progress */}
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">กำลังวิ่งงาน (In Progress)</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{inProgressJobs} เที่ยว</div>
              <p className="text-xs text-slate-500 mt-1">พขร. อยู่ระหว่างเดินทาง/ขึ้นตู้/ส่งคืน</p>
            </CardContent>
          </Card>

          {/* Card 4: Pending / Assigned */}
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">รอดำเนินการ (Pending)</CardTitle>
              <AlertCircle className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">{pendingJobs} เที่ยว</div>
              <p className="text-xs text-slate-500 mt-1">ฉบับร่าง หรือ มอบหมายรถแล้วรอรับตู้</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================= 2. FINANCIAL SUMMARY CARDS ================= */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          สรุปการเงินและผลประกอบการ (Financial Summary)
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-blue-50/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">รายได้รวม (Revenue)</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                ฿{totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">ค่าบริการขนส่งตาม Rate Card ลูกค้า</p>
            </CardContent>
          </Card>

          {/* Total Cost */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-rose-50/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">ต้นทุนรวม (Total Cost)</CardTitle>
              <CreditCard className="h-4 w-4 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600">
                ฿{totalCost.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">ค่าน้ำมัน เบี้ยเลี้ยง ทางด่วน ค่าใช้จ่าย พขร.</p>
            </CardContent>
          </Card>

          {/* Net Profit */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">กำไรสุทธิ (Net Profit)</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ฿{netProfit.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">รายได้รวม หัก ต้นทุนค่าใช้จ่ายทั้งหมด</p>
            </CardContent>
          </Card>

          {/* Margin % */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-indigo-50/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">อัตรากำไร (Margin %)</CardTitle>
              <Percent className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-700">
                {marginPercent}%
              </div>
              <p className="text-xs text-slate-500 mt-1">สัดส่วนผลกำไรสุทธิต่อรายได้รวม</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================= 3. JOB ORDER DISPATCH TABLE ================= */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              ตารางสั่งงานและติดตาม พขร. (Daily Job Dispatch & Driver Orders)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              รายการงานพร้อมรายละเอียด เบอร์รถ พขร. สเปกตู้ สายเรือ และปุ่มคัดลอกส่ง LINE ให้ พขร. ทันที
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">แสดงผล {filteredJobs.length} รายการ</span>
            <Link href="/dispatch">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                ไปหน้าจัดรถ (Dispatch)
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/80 text-xs">
                  <SortableHeader title="Job No / วันที่" sortKey="job_date" currentSort={jobSort} onSort={handleJobSort} className="font-semibold text-slate-800" />
                  <SortableHeader title="เบอร์รถ & พขร." sortKey="truck" currentSort={jobSort} onSort={handleJobSort} className="font-semibold text-slate-800" />
                  <SortableHeader title="ลูกค้า & สายเรือ" sortKey="customer" currentSort={jobSort} onSort={handleJobSort} className="font-semibold text-slate-800" />
                  <SortableHeader title="Booking / B/L / ตู้" sortKey="container_no" currentSort={jobSort} onSort={handleJobSort} className="font-semibold text-slate-800" />
                  <SortableHeader title="เส้นทาง (ต้นทาง ➔ ปลายทาง)" sortKey="route" currentSort={jobSort} onSort={handleJobSort} className="font-semibold text-slate-800" />
                  <SortableHeader title="สเปกตู้" sortKey="container_size" currentSort={jobSort} onSort={handleJobSort} align="center" className="font-semibold text-slate-800" />
                  <SortableHeader title="สถานะงาน" sortKey="status" currentSort={jobSort} onSort={handleJobSort} align="center" className="font-semibold text-slate-800" />
                  <SortableHeader title="ราคาขาย" sortKey="revenue" currentSort={jobSort} onSort={handleJobSort} align="right" className="font-semibold text-slate-800" />
                  <TableHead className="text-center font-semibold text-slate-800 print:hidden">การสั่งงาน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFilteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Box className="h-8 w-8 text-slate-300" />
                        <p className="font-medium text-sm">ไม่พบรายการงานขนส่งตามเงื่อนไขที่เลือก</p>
                        <p className="text-xs text-slate-400">ลองปรับเปลี่ยนตัวกรองค้นหาด้านบน หรือกดเปิดงานขนส่งใหม่</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedFilteredJobs.map((j) => {
                    const truckDisplay = j.truck_name_id || j.vehicle?.truck_name_id;
                    const plateDisplay = j.vehicle?.plate_number;
                    const isCopied = copiedJobId === j.id;

                    return (
                      <TableRow key={j.id} className="hover:bg-slate-50/80 text-xs">
                        {/* Job No & Date */}
                        <TableCell>
                          <div className="font-bold text-blue-700">{j.job_no}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {j.job_date}
                          </div>
                          {j.invoice_status === 'billed' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5 py-0 mt-1 font-normal">
                              ออกบิลแล้ว
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 mt-1 font-normal">
                              รอบิล
                            </Badge>
                          )}
                        </TableCell>

                        {/* Truck & Driver */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {truckDisplay ? (
                              <Badge className="bg-blue-600 text-white font-mono text-[11px] px-2 py-0.5">
                                {truckDisplay}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 text-[10px]">
                                รอระบุรถ
                              </Badge>
                            )}
                            {plateDisplay && (
                              <span className="text-slate-600 font-mono text-[11px]">
                                {plateDisplay}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-slate-800 font-medium">
                            <span>{j.driver?.name || 'ยังไม่กำหนด พขร.'}</span>
                          </div>
                          {j.driver?.phone && (
                            <div className="text-slate-500 text-[11px] flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <a href={`tel:${j.driver.phone}`} className="hover:underline text-blue-600">
                                {j.driver.phone}
                              </a>
                            </div>
                          )}
                        </TableCell>

                        {/* Customer & Shipping Line */}
                        <TableCell>
                          <div className="font-semibold text-slate-900 max-w-[180px] truncate" title={j.customer?.company_name}>
                            {j.customer?.company_name || 'ลูกค้าทั่วไป'}
                          </div>
                          {j.shipping_agent && (
                            <div className="text-[11px] text-indigo-700 font-medium mt-0.5 flex items-center gap-1">
                              <span className="px-1 py-0.2 rounded bg-indigo-50 border border-indigo-100">
                                {j.shipping_agent}
                              </span>
                            </div>
                          )}
                        </TableCell>

                        {/* Booking / B/L / Container No */}
                        <TableCell>
                          <div className="space-y-0.5 font-mono text-[11px]">
                            {j.booking_no && (
                              <div className="text-slate-700">
                                <span className="text-slate-400 text-[10px]">BKG:</span> {j.booking_no}
                              </div>
                            )}
                            {j.bl_no && (
                              <div className="text-slate-700">
                                <span className="text-slate-400 text-[10px]">BL:</span> {j.bl_no}
                              </div>
                            )}
                            {j.container_no ? (
                              <div className="text-blue-900 font-semibold bg-blue-50/60 px-1 py-0.5 rounded text-[11px]">
                                📦 {j.container_no}
                              </div>
                            ) : (
                              <div className="text-slate-400 italic text-[11px]">(รอเบอร์ตู้)</div>
                            )}
                          </div>
                        </TableCell>

                        {/* Route (Origin -> Destination) */}
                        <TableCell className="max-w-[200px]">
                          <div className="text-slate-800 font-medium truncate" title={j.origin?.name || '-'}>
                            📍 {j.origin?.name || '-'}
                          </div>
                          <div className="text-slate-500 text-[11px] my-0.5 pl-3">➔</div>
                          <div className="text-slate-800 font-medium truncate" title={j.destination?.name || '-'}>
                            🏁 {j.destination?.name || '-'}
                          </div>
                        </TableCell>

                        {/* Container Spec */}
                        <TableCell className="text-center">
                          <span className="inline-block text-xs px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-800 border border-slate-200">
                            {j.volume_count || 1}x{j.container_size}&apos; {j.container_type}
                          </span>
                          {j.cargo_type === 'DG' && (
                            <div className="text-[10px] text-amber-700 font-semibold mt-1">
                              ⚠️ สารเคมี DG
                            </div>
                          )}
                        </TableCell>

                        {/* Job Status */}
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline" 
                            className={`font-medium text-[11px] ${statusConfig[j.status]?.badgeClass || ''}`}
                          >
                            {statusConfig[j.status]?.label || j.status}
                          </Badge>
                        </TableCell>

                        {/* Revenue */}
                        <TableCell className="text-right font-bold text-slate-900 text-xs">
                          ฿{Number(j.revenue).toLocaleString()}
                        </TableCell>

                        {/* Action: Copy LINE & View */}
                        <TableCell className="text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyLineText(j)}
                              className={`h-7 px-2 text-[11px] gap-1 transition-all ${
                                isCopied 
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600' 
                                  : 'hover:bg-green-50 text-emerald-700 border-emerald-300'
                              }`}
                              title="คัดลอกข้อความสั่งงานพร้อมส่งเข้า LINE ให้ พขร."
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  <span>คัดลอกแล้ว!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-emerald-600" />
                                  <span>สั่งงาน LINE</span>
                                </>
                              )}
                            </Button>

                            <Link href="/dispatch">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                                title="ไปหน้าควบคุมการจัดรถ"
                              >
                                <Navigation className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </div>
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

      {/* ================= 4. ROUTE PERFORMANCE SUMMARY ================= */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <Route className="h-5 w-5 text-blue-600" />
              ตารางสรุปประสิทธิภาพแยกตามเส้นทาง (Route Performance Summary)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              วิเคราะห์รายได้ ต้นทุน และกำไรสุทธิของแต่ละเส้นทางการเดินรถ เพื่อประเมินความคุ้มค่าและตั้งราคา Rate Card
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/80 text-xs">
                  <SortableHeader title="เส้นทาง (ต้นทาง ➔ ปลายทาง)" sortKey="routeKey" currentSort={routeSort} onSort={handleRouteSort} className="font-semibold text-slate-800" />
                  <SortableHeader title="จำนวนงาน" sortKey="jobCount" currentSort={routeSort} onSort={handleRouteSort} align="center" className="font-semibold text-slate-800" />
                  <SortableHeader title="รายได้รวม (บาท)" sortKey="totalRevenue" currentSort={routeSort} onSort={handleRouteSort} align="right" className="font-semibold text-slate-800" />
                  <SortableHeader title="ต้นทุนรวม (บาท)" sortKey="totalCost" currentSort={routeSort} onSort={handleRouteSort} align="right" className="font-semibold text-slate-800" />
                  <SortableHeader title="กำไรสุทธิ (บาท)" sortKey="netProfit" currentSort={routeSort} onSort={handleRouteSort} align="right" className="font-semibold text-slate-800" />
                  <SortableHeader title="อัตรากำไร (Margin)" sortKey="margin" currentSort={routeSort} onSort={handleRouteSort} align="center" className="font-semibold text-slate-800" />
                  <TableHead className="text-center font-semibold text-slate-800">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRouteSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-slate-500 text-xs">
                      ยังไม่มีข้อมูลการวิ่งงานในเส้นทางตามเงื่อนไขที่เลือก
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRouteSummaries.map((r, idx) => {
                    const margin = r.totalRevenue > 0 ? ((r.netProfit / r.totalRevenue) * 100).toFixed(1) : '0';
                    return (
                      <TableRow key={idx} className="hover:bg-slate-50/80 text-xs">
                        <TableCell className="font-medium text-slate-900">
                          <span className="font-semibold text-blue-900">{r.originName}</span>
                          <span className="mx-2 text-slate-400">➔</span>
                          <span className="font-semibold text-slate-700">{r.destinationName}</span>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{r.jobCount} เที่ยว</TableCell>
                        <TableCell className="text-right font-medium text-slate-700">
                          ฿{r.totalRevenue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-rose-600">
                          ฿{r.totalCost.toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${r.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ฿{r.netProfit.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-slate-700">
                          {margin}%
                        </TableCell>
                        <TableCell className="text-center">
                          {r.netProfit >= 0 ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[10px] px-2 py-0.5">
                              มีกำไร
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-[10px] px-2 py-0.5">
                              ขาดทุน
                            </Badge>
                          )}
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
