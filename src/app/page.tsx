'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Job } from '@/types/database';
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
  FileSpreadsheet
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Helper labels
const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  draft: { label: 'ฉบับร่าง', badgeClass: 'bg-slate-200 text-slate-700' },
  assigned: { label: 'มอบหมายแล้ว', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_progress: { label: 'กำลังดำเนินการ', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  completed: { label: 'เสร็จสิ้น', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'ยกเลิก', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' },
};

const vehicleTypeMap: Record<string, string> = {
  '4_wheel': '4 ล้อ',
  '6_wheel': '6 ล้อ',
  '10_wheel': '10 ล้อ',
  'trailer': 'เทรลเลอร์',
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
  const [loading, setLoading] = useState(true);

  // Fetch jobs data with relations
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          origin:locations!origin_id(*),
          destination:locations!destination_id(*),
          vehicle:vehicles(*),
          driver:drivers(*)
        `)
        .order('job_date', { ascending: false });

      if (!error && data) {
        setJobs(data as Job[]);
      }
    } catch (err) {
      console.error('Error fetching dashboard jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // 1. Status Cards Metrics
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;
  const inProgressJobs = jobs.filter((j) => j.status === 'in_progress').length;
  const pendingJobs = jobs.filter((j) => j.status === 'draft' || j.status === 'assigned').length;

  // 2. Financial Summary Metrics
  const totalRevenue = jobs.reduce((sum, j) => sum + (Number(j.revenue) || 0), 0);
  const totalCost = jobs.reduce((sum, j) => sum + (Number(j.total_cost) || 0), 0);
  const netProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

  // 3. Route Summary Grouping
  const routeMap: Record<string, RouteSummary> = {};
  jobs.forEach((j) => {
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

  const routeSummaries = Object.values(routeMap);

  // 4. Latest 5 Jobs
  const latestJobs = jobs.slice(0, 5);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Module 1: Operations & Financial Overview
            </span>
            <span className="text-xs text-slate-500">Connect Transport Co., Ltd.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Dashboard ภาพรวมและการวิเคราะห์ข้อมูล
          </h1>
          <p className="text-slate-500 text-sm">
            ติดตามสถานะตู้คอนเทนเนอร์ รายได้ ค่าใช้จ่าย และผลกำไรประจำเที่ยววิ่งแบบ Real-time
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData} 
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรชข้อมูล
          </Button>
          <Link href="/orders">
            <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
              <PlusCircle className="h-4 w-4" />
              รับงานขนส่งใหม่ (Order)
            </Button>
          </Link>
        </div>
      </div>

      {/* ================= 1. STATUS CARDS ================= */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          สถานะงานขนส่งตู้คอนเทนเนอร์ (Job Status Overview)
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Jobs */}
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">งานทั้งหมด (Total)</CardTitle>
              <Truck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{totalJobs} เที่ยว</div>
              <p className="text-xs text-slate-500 mt-1">งานขนส่งที่บันทึกในระบบทั้งหมด</p>
            </CardContent>
          </Card>

          {/* Card 2: Completed */}
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">งานที่เสร็จแล้ว (Completed)</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{completedJobs} เที่ยว</div>
              <p className="text-xs text-slate-500 mt-1">ส่งมอบตู้และเปิดงานสำเร็จ</p>
            </CardContent>
          </Card>

          {/* Card 3: In Progress */}
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">กำลังวิ่งงาน (In Progress)</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{inProgressJobs} เที่ยว</div>
              <p className="text-xs text-slate-500 mt-1">พขร. อยู่ระหว่างเดินทาง/ขึ้นตู้</p>
            </CardContent>
          </Card>

          {/* Card 4: Pending / Assigned */}
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">รอดำเนินการ (Pending)</CardTitle>
              <AlertCircle className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">{pendingJobs} เที่ยว</div>
              <p className="text-xs text-slate-500 mt-1">ฉบับร่าง หรือ มอบหมายรถแล้ว</p>
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
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">รายได้รวม (Total Revenue)</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                ฿{totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">ค่าบริการเรียกเก็บตามสัญญา/Rate Card</p>
            </CardContent>
          </Card>

          {/* Total Cost */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-rose-50/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">ต้นทุนรวม (Total Cost)</CardTitle>
              <CreditCard className="h-4 w-4 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600">
                ฿{totalCost.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">ค่าน้ำมัน, ค่าแรง/เบี้ยเลี้ยง, ทางด่วน, OT</p>
            </CardContent>
          </Card>

          {/* Net Profit */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">กำไรสุทธิ (Net Profit)</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                ฿{netProfit.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">รายได้รวม หัก ต้นทุนค่าใช้จ่ายทั้งหมด</p>
            </CardContent>
          </Card>

          {/* Margin % */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">อัตรากำไร (Margin %)</CardTitle>
              <Percent className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-700">
                {marginPercent}%
              </div>
              <p className="text-xs text-slate-500 mt-1">สัดส่วนกำไรสุทธิต่อรายได้รวม</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================= 3. ROUTE SUMMARY TABLE ================= */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Route className="h-5 w-5 text-blue-600" />
              ตารางสรุปแยกตามเส้นทาง (Route Performance Summary)
            </CardTitle>
            <CardDescription>
              วิเคราะห์รายได้ ต้นทุน และกำไรสุทธิของแต่ละเส้นทางการเดินรถ เพื่อประเมินความคุ้มค่า
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70">
                  <TableHead className="font-semibold text-slate-800">เส้นทาง (ต้นทาง ➔ ปลายทาง)</TableHead>
                  <TableHead className="text-center font-semibold text-slate-800">จำนวนงาน</TableHead>
                  <TableHead className="text-right font-semibold text-slate-800">รายได้รวม (บาท)</TableHead>
                  <TableHead className="text-right font-semibold text-slate-800">ต้นทุนรวม (บาท)</TableHead>
                  <TableHead className="text-right font-semibold text-slate-800">กำไรสุทธิ (บาท)</TableHead>
                  <TableHead className="text-center font-semibold text-slate-800">สถานะผลประกอบการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routeSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                      ยังไม่มีข้อมูลการวิ่งงานในแต่ละเส้นทาง
                    </TableCell>
                  </TableRow>
                ) : (
                  routeSummaries.map((r, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/80">
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
                      <TableCell className="text-center">
                        {r.netProfit >= 0 ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
                            กำไร (Profitable)
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs">
                            ขาดทุน (Loss)
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ================= 4. LATEST 5 JOBS TABLE ================= */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              งานขนส่งล่าสุด 5 รายการ (Latest Transport Orders)
            </CardTitle>
            <CardDescription>
              รายการงานที่บันทึกล่าสุด พร้อมรายละเอียดลูกค้า เส้นทาง รถบรรทุก และสถานะ
            </CardDescription>
          </div>
          <Link href="/master-data">
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              ดูข้อมูลหลัก
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70">
                  <TableHead className="font-semibold text-slate-800">Job ID</TableHead>
                  <TableHead className="font-semibold text-slate-800">วันที่</TableHead>
                  <TableHead className="font-semibold text-slate-800">ชื่อลูกค้า</TableHead>
                  <TableHead className="font-semibold text-slate-800">เส้นทาง</TableHead>
                  <TableHead className="font-semibold text-slate-800">ประเภทรถ</TableHead>
                  <TableHead className="font-semibold text-slate-800">สเปกตู้</TableHead>
                  <TableHead className="font-semibold text-slate-800">สถานะ</TableHead>
                  <TableHead className="text-right font-semibold text-slate-800">ราคาขาย (บาท)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                      ยังไม่มีรายการงานขนส่งในระบบ
                    </TableCell>
                  </TableRow>
                ) : (
                  latestJobs.map((j) => (
                    <TableRow key={j.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-bold text-blue-700">{j.job_no}</TableCell>
                      <TableCell className="text-xs text-slate-600">{j.job_date}</TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {j.customer?.company_name || 'ลูกค้าทั่วไป'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {j.origin?.name || '-'} ➔ {j.destination?.name || '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {vehicleTypeMap[j.vehicle_type] || j.vehicle_type}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                          {j.container_size}&apos; {j.container_type} {j.cargo_type === 'DG' ? '⚠️ DG' : ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`font-medium ${statusConfig[j.status]?.badgeClass || ''}`}
                        >
                          {statusConfig[j.status]?.label || j.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        ฿{Number(j.revenue).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
