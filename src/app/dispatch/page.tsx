'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Job, Vehicle, Driver, RateCard } from '@/types/database';
import { 
  Send, 
  Truck, 
  UserCheck, 
  Printer, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Calculator, 
  FileText, 
  RefreshCw, 
  Smartphone,
  ShieldCheck,
  Thermometer,
  Lock,
  Box
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  draft: { label: 'ฉบับร่าง', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
  assigned: { label: 'มอบหมายแล้ว', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_progress: { label: 'กำลังวิ่งงาน', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  completed: { label: 'เสร็จสิ้น', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'ยกเลิก', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export default function DispatchPage() {
  const [activeTab, setActiveTab] = useState('dispatch');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [openAssignModal, setOpenAssignModal] = useState(false);
  const [openCostModal, setOpenCostModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);

  // Assignment Form State
  const [assignForm, setAssignForm] = useState({
    vehicle_id: '',
    driver_id: '',
    status: 'assigned',
  });

  // Cost Form State
  const [costForm, setCostForm] = useState({
    fuel_cost: '0',
    driver_allowance: '0',
    toll_fee: '0',
    waiting_fee: '0',
    ot_fee: '0',
    other_cost: '0',
  });

  // Driver App View State
  const [driverSelectedJobId, setDriverSelectedJobId] = useState<string>('');
  const [driverAppForm, setDriverAppForm] = useState({
    container_no: '',
    seal_no: '',
    temperature: '',
    checkin_location: '',
    driver_notes: '',
  });

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [jobsRes, vehRes, drivRes] = await Promise.all([
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
        supabase.from('vehicles').select('*').eq('status', 'active'),
        supabase.from('drivers').select('*').order('name'),
      ]);

      if (jobsRes.data) {
        setJobs(jobsRes.data as Job[]);
        // Set default driver app job if none selected
        if (!driverSelectedJobId && jobsRes.data.length > 0) {
          const activeJob = jobsRes.data.find((j: any) => j.status === 'in_progress' || j.status === 'assigned') || jobsRes.data[0];
          setDriverSelectedJobId(activeJob.id);
          setDriverAppForm({
            container_no: activeJob.container_no || '',
            seal_no: activeJob.seal_no || '',
            temperature: activeJob.temperature ? String(activeJob.temperature) : '',
            checkin_location: activeJob.checkin_location || '',
            driver_notes: activeJob.driver_notes || '',
          });
        }
      }
      if (vehRes.data) setVehicles(vehRes.data as Vehicle[]);
      if (drivRes.data) setDrivers(drivRes.data as Driver[]);
    } catch (err) {
      console.error('Error fetching dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open Assign Modal
  const handleOpenAssign = (job: Job) => {
    setSelectedJob(job);
    setAssignForm({
      vehicle_id: job.vehicle_id || (vehicles[0]?.id || ''),
      driver_id: job.driver_id || (drivers[0]?.id || ''),
      status: job.status === 'draft' ? 'assigned' : job.status,
    });
    setOpenAssignModal(true);
  };

  // Submit Assign
  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    const { error } = await supabase
      .from('jobs')
      .update({
        vehicle_id: assignForm.vehicle_id || null,
        driver_id: assignForm.driver_id || null,
        status: assignForm.status,
      })
      .eq('id', selectedJob.id);

    if (!error) {
      setOpenAssignModal(false);
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการมอบหมายงาน: ' + error.message);
    }
  };

  // Open Cost Modal
  const handleOpenCost = (job: Job) => {
    setSelectedJob(job);
    setCostForm({
      fuel_cost: String(job.fuel_cost || 0),
      driver_allowance: String(job.driver_allowance || 0),
      toll_fee: String(job.toll_fee || 0),
      waiting_fee: String(job.waiting_fee || 0),
      ot_fee: String(job.ot_fee || 0),
      other_cost: String(job.other_cost || 0),
    });
    setOpenCostModal(true);
  };

  // Submit Cost Calculation
  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    const fuel = parseFloat(costForm.fuel_cost) || 0;
    const allowance = parseFloat(costForm.driver_allowance) || 0;
    const toll = parseFloat(costForm.toll_fee) || 0;
    const waiting = parseFloat(costForm.waiting_fee) || 0;
    const ot = parseFloat(costForm.ot_fee) || 0;
    const other = parseFloat(costForm.other_cost) || 0;

    const totalCost = fuel + allowance + toll + waiting + ot + other;
    const revenue = Number(selectedJob.revenue) || 0;
    const netProfit = revenue - totalCost;

    const { error } = await supabase
      .from('jobs')
      .update({
        fuel_cost: fuel,
        driver_allowance: allowance,
        toll_fee: toll,
        waiting_fee: waiting,
        ot_fee: ot,
        other_cost: other,
        total_cost: totalCost,
        net_profit: netProfit,
      })
      .eq('id', selectedJob.id);

    if (!error) {
      setOpenCostModal(false);
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึกต้นทุน: ' + error.message);
    }
  };

  // Open Printable Job Order
  const handleOpenPrint = (job: Job) => {
    setSelectedJob(job);
    setOpenPrintModal(true);
  };

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // Driver App: Select Job
  const handleDriverSelectJob = (jobId: string) => {
    setDriverSelectedJobId(jobId);
    const j = jobs.find((job) => job.id === jobId);
    if (j) {
      setDriverAppForm({
        container_no: j.container_no || '',
        seal_no: j.seal_no || '',
        temperature: j.temperature ? String(j.temperature) : '',
        checkin_location: j.checkin_location || '',
        driver_notes: j.driver_notes || '',
      });
    }
  };

  // Driver App: Check-in button
  const handleQuickCheckin = (locName: string) => {
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    setDriverAppForm((prev) => ({
      ...prev,
      checkin_location: `📍 ถึง ${locName} เมื่อเวลา ${timeStr} น.`,
    }));
  };

  // Driver App: Save details & update job
  const handleSaveDriverUpdate = async (isCompleting: boolean = false) => {
    if (!driverSelectedJobId) return;

    const payload: any = {
      container_no: driverAppForm.container_no,
      seal_no: driverAppForm.seal_no,
      temperature: driverAppForm.temperature ? parseFloat(driverAppForm.temperature) : null,
      checkin_location: driverAppForm.checkin_location,
      driver_notes: driverAppForm.driver_notes,
    };

    if (isCompleting) {
      payload.status = 'completed';
    } else {
      payload.status = 'in_progress';
    }

    const { error } = await supabase
      .from('jobs')
      .update(payload)
      .eq('id', driverSelectedJobId);

    if (!error) {
      alert(isCompleting ? '✅ ปิดงานและส่งมอบตู้สำเร็จแล้ว!' : '💾 บันทึกข้อมูลและเช็คอินเรียบร้อย');
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const selectedDriverJob = jobs.find((j) => j.id === driverSelectedJobId);

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Module 3: Dispatch & Operations
            </span>
            <span className="text-xs text-slate-500">Connect Transport Co., Ltd.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <Send className="h-7 w-7 text-blue-600" />
            การจ่ายงานและปฏิบัติการขนส่ง (Dispatch & Operations)
          </h1>
          <p className="text-slate-500 text-sm">
            มอบหมายรถและ พขร. คำนวณต้นทุนต่อเที่ยว ออกใบสั่งงาน (Job Order) และระบบเช็คอินงานสำหรับ พขร.
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchData} 
          disabled={loading}
          className="gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรชข้อมูล
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-200 p-1 rounded-xl">
          <TabsTrigger value="dispatch" className="gap-2">
            <Truck className="h-4 w-4" />
            ตารางจ่ายงาน & คำนวณต้นทุน ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="driver-app" className="gap-2">
            <Smartphone className="h-4 w-4 text-emerald-600" />
            พอร์ทัล พขร. เช็คอิน & จบงาน (Driver App)
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: DISPATCH & OPERATIONS ================= */}
        <TabsContent value="dispatch" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">รายการงานขนส่งและการจ่ายรถ</CardTitle>
                <CardDescription>
                  เลือกพนักงานขับรถ, ทะเบียนรถ, คำนวณต้นทุนกำไรจริง และสั่งพิมพ์ใบสั่งงาน พขร.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/70">
                      <TableHead className="font-semibold text-slate-800">Job ID</TableHead>
                      <TableHead className="font-semibold text-slate-800">วันที่</TableHead>
                      <TableHead className="font-semibold text-slate-800">เส้นทาง (ต้นทาง ➔ ปลายทาง)</TableHead>
                      <TableHead className="font-semibold text-slate-800">รถบรรทุก</TableHead>
                      <TableHead className="font-semibold text-slate-800">พนักงานขับรถ (พขร.)</TableHead>
                      <TableHead className="font-semibold text-slate-800">เลขตู้ / ซีล</TableHead>
                      <TableHead className="font-semibold text-slate-800">สถานะ</TableHead>
                      <TableHead className="text-right font-semibold text-slate-800">รายได้ / ต้นทุน / กำไร</TableHead>
                      <TableHead className="text-center font-semibold text-slate-800">จัดการปฏิบัติการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                          ยังไม่มีงานขนส่งในระบบ
                        </TableCell>
                      </TableRow>
                    ) : (
                      jobs.map((j) => (
                        <TableRow key={j.id} className="hover:bg-slate-50/80">
                          <TableCell className="font-bold text-blue-700 whitespace-nowrap">
                            {j.job_no}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                            {j.job_date}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-slate-900">{j.origin?.name || '-'}</span>
                            <span className="mx-1 text-slate-400">➔</span>
                            <span>{j.destination?.name || '-'}</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {j.vehicle ? (
                              <span className="font-semibold text-slate-900">{j.vehicle.plate_number}</span>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                                ยังไม่ระบุรถ
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {j.driver ? (
                              <span className="font-medium text-slate-900">{j.driver.name}</span>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                                ยังไม่ระบุ พขร.
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {j.container_no ? (
                              <div>
                                <span className="text-blue-800 font-semibold">{j.container_no}</span>
                                {j.seal_no && <div className="text-[10px] text-slate-500">ซีล: {j.seal_no}</div>}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`font-medium ${statusConfig[j.status]?.badgeClass || ''}`}
                            >
                              {statusConfig[j.status]?.label || j.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <div className="font-bold text-slate-900">฿{Number(j.revenue).toLocaleString()}</div>
                            <div className="text-[11px] text-rose-600">ทุน: ฿{Number(j.total_cost).toLocaleString()}</div>
                            <div className={`text-[11px] font-semibold ${Number(j.net_profit) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              กำไร: ฿{Number(j.net_profit).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAssign(j)}
                                className="h-8 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                จ่ายรถ/พขร.
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenCost(j)}
                                className="h-8 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                <Calculator className="h-3.5 w-3.5" />
                                ต้นทุน/กำไร
                              </Button>

                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenPrint(j)}
                                className="h-8 text-xs gap-1 bg-slate-100 hover:bg-slate-200"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                ใบสั่งงาน
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 2: DRIVER APP / MOBILE PORTAL ================= */}
        <TabsContent value="driver-app">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Left: Job selector */}
            <Card className="md:col-span-1 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  เลือกงานที่กำลังวิ่ง (Active Jobs)
                </CardTitle>
                <CardDescription>เลือกเที่ยววิ่งของ พขร. เพื่ออัปเดตข้อมูลภาคสนาม</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => handleDriverSelectJob(job.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      driverSelectedJobId === job.id
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-blue-700">{job.job_no}</span>
                      <Badge variant="outline" className={`text-xs ${statusConfig[job.status]?.badgeClass || ''}`}>
                        {statusConfig[job.status]?.label || job.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-700 mt-1 font-medium">
                      {job.origin?.name} ➔ {job.destination?.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex justify-between">
                      <span>พขร: {job.driver?.name || 'ยังไม่ระบุ'}</span>
                      <span>รถ: {job.vehicle?.plate_number || '-'}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Right: Driver Interface (Mobile Mockup style) */}
            <Card className="md:col-span-2 border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b bg-slate-900 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      <Truck className="h-5 w-5 text-blue-400" />
                      หน้าจอรายงานผล พขร. (Connect Driver Portal)
                    </CardTitle>
                    <p className="text-xs text-slate-300 mt-0.5">
                      พขร: {selectedDriverJob?.driver?.name || 'ไม่ระบุ'} | ทะเบียน: {selectedDriverJob?.vehicle?.plate_number || 'ไม่ระบุ'}
                    </p>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-mono">
                    {selectedDriverJob?.job_no || 'เลือกงาน'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {selectedDriverJob ? (
                  <>
                    {/* Job Details Banner */}
                    <div className="p-4 bg-slate-50 border rounded-xl space-y-2 text-sm">
                      <div className="flex justify-between items-center text-xs text-slate-500">
                        <span>ลูกค้า: {selectedDriverJob.customer?.company_name}</span>
                        <span>วันที่: {selectedDriverJob.job_date}</span>
                      </div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-rose-500" />
                        {selectedDriverJob.origin?.name} ➔ {selectedDriverJob.destination?.name}
                      </div>
                      <div className="text-xs text-slate-600">
                        สเปกตู้: {selectedDriverJob.container_size}&apos; {selectedDriverJob.container_type} | สินค้า: {selectedDriverJob.cargo_type}
                      </div>
                    </div>

                    {/* Section 1: Check-in Location */}
                    <div className="space-y-3 p-4 border rounded-xl bg-blue-50/30 border-blue-200">
                      <div className="flex items-center justify-between">
                        <Label className="font-bold text-blue-900 flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          รายงานพิกัด / เช็คอินสถานที่ปัจจุบัน
                        </Label>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleQuickCheckin(selectedDriverJob.origin?.name || 'ต้นทาง')}
                          className="text-xs border-blue-300 bg-white"
                        >
                          📍 ถึงต้นทาง ({selectedDriverJob.origin?.name})
                        </Button>
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleQuickCheckin(selectedDriverJob.destination?.name || 'ปลายทาง')}
                          className="text-xs border-blue-300 bg-white"
                        >
                          📍 ถึงปลายทาง ({selectedDriverJob.destination?.name})
                        </Button>
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleQuickCheckin('ด่านเก็บค่าผ่านทาง / ระหว่างเดินทาง')}
                          className="text-xs border-blue-300 bg-white"
                        >
                          📍 ระหว่างทาง
                        </Button>
                      </div>

                      <Input
                        placeholder="ระบุสถานที่เช็คอิน หรือกดปุ่มลัดด้านบน"
                        value={driverAppForm.checkin_location}
                        onChange={(e) => setDriverAppForm({ ...driverAppForm, checkin_location: e.target.value })}
                        className="bg-white text-sm"
                      />
                    </div>

                    {/* Section 2: Container & Seal Details */}
                    <div className="space-y-4 p-4 border rounded-xl bg-slate-50">
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Box className="h-4 w-4 text-blue-600" />
                        ข้อมูลตู้คอนเทนเนอร์ & ซีลล็อค (กรอกเมื่อรับตู้)
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="cno" className="text-xs font-semibold">
                            หมายเลขตู้คอนเทนเนอร์ (Container No.) *
                          </Label>
                          <Input
                            id="cno"
                            placeholder="เช่น TCLU 123456-7"
                            value={driverAppForm.container_no}
                            onChange={(e) => setDriverAppForm({ ...driverAppForm, container_no: e.target.value.toUpperCase() })}
                            className="bg-white font-mono uppercase"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="sno" className="text-xs font-semibold flex items-center gap-1">
                            <Lock className="h-3 w-3 text-slate-500" />
                            หมายเลขซีลล็อคตู้ (Seal No.) *
                          </Label>
                          <Input
                            id="sno"
                            placeholder="เช่น SL-998822"
                            value={driverAppForm.seal_no}
                            onChange={(e) => setDriverAppForm({ ...driverAppForm, seal_no: e.target.value.toUpperCase() })}
                            className="bg-white font-mono uppercase"
                          />
                        </div>
                      </div>

                      {/* Temperature for Reefer */}
                      <div className="space-y-1">
                        <Label htmlFor="temp" className="text-xs font-semibold flex items-center gap-1">
                          <Thermometer className="h-3.5 w-3.5 text-cyan-600" />
                          อุณหภูมิตู้ (°C) (สำหรับตู้เย็น Reefer RH)
                        </Label>
                        <Input
                          id="temp"
                          type="number"
                          step="0.1"
                          placeholder="เช่น -18.5 หรือ 4.0"
                          value={driverAppForm.temperature}
                          onChange={(e) => setDriverAppForm({ ...driverAppForm, temperature: e.target.value })}
                          className="bg-white max-w-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="dnotes" className="text-xs font-semibold">
                          หมายเหตุของ พขร. (เช่น สภาพตู้, ปัญหาการรอคอย)
                        </Label>
                        <Input
                          id="dnotes"
                          placeholder="ระบุข้อสังเกตเพิ่มเติมถ้ามี"
                          value={driverAppForm.driver_notes}
                          onChange={(e) => setDriverAppForm({ ...driverAppForm, driver_notes: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={() => handleSaveDriverUpdate(false)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                      >
                        <Clock className="h-4 w-4" />
                        บันทึกสถานะกำลังวิ่งงาน (Save Progress)
                      </Button>

                      <Button
                        type="button"
                        onClick={() => handleSaveDriverUpdate(true)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2 font-bold"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        จบงาน & ส่งมอบตู้สำเร็จ (Complete Job)
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    กรุณาเลือกงานที่ต้องการอัปเดตจากรายการด้านซ้าย
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= MODAL: ASSIGN DRIVER & VEHICLE ================= */}
      <Dialog open={openAssignModal} onOpenChange={setOpenAssignModal}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSaveAssign}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                จ่ายงาน & มอบหมาย พขร. ({selectedJob?.job_no})
              </DialogTitle>
              <DialogDescription>
                เลือกรถบรรทุกและพนักงานขับรถเพื่อวิ่งงานเที่ยวนี้
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <div><strong>เส้นทาง:</strong> {selectedJob?.origin?.name} ➔ {selectedJob?.destination?.name}</div>
                <div><strong>ประเภทรถที่ต้องการ:</strong> {selectedJob?.vehicle_type}</div>
                <div><strong>สเปกตู้:</strong> {selectedJob?.container_size}&apos; {selectedJob?.container_type}</div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="veh_select">เลือกรถบรรทุก (ทะเบียนรถ) *</Label>
                <select
                  id="veh_select"
                  required
                  className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                  value={assignForm.vehicle_id}
                  onChange={(e) => setAssignForm({ ...assignForm, vehicle_id: e.target.value })}
                >
                  <option value="">-- เลือกรถบรรทุก --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number} ({v.vehicle_type} - {v.capacity_tons} ตัน)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="driv_select">เลือกพนักงานขับรถ (พขร.) *</Label>
                <select
                  id="driv_select"
                  required
                  className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                  value={assignForm.driver_id}
                  onChange={(e) => setAssignForm({ ...assignForm, driver_id: e.target.value })}
                >
                  <option value="">-- เลือก พขร. --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (โทร: {d.phone || '-'}) [{d.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="st_select">สถานะงานหลังจ่ายรถ</Label>
                <select
                  id="st_select"
                  className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                  value={assignForm.status}
                  onChange={(e) => setAssignForm({ ...assignForm, status: e.target.value })}
                >
                  <option value="assigned">มอบหมายแล้ว (Assigned)</option>
                  <option value="in_progress">กำลังวิ่งงาน (In Progress)</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenAssignModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                ยืนยันการจ่ายงาน
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: ACTUAL COST & PROFIT ================= */}
      <Dialog open={openCostModal} onOpenChange={setOpenCostModal}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSaveCost}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-emerald-600" />
                คำนวณต้นทุนและกำไรจริง ({selectedJob?.job_no})
              </DialogTitle>
              <DialogDescription>
                บันทึกค่าน้ำมัน ค่าแรง พขร. ค่าทางด่วน และค่าเสียเวลาจอดรอ
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-sm">
              <div className="p-3 bg-emerald-50 rounded-lg text-xs flex justify-between font-bold text-emerald-900">
                <span>ราคาขายเรียกเก็บ (รายได้):</span>
                <span>฿{Number(selectedJob?.revenue || 0).toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="fuel">ค่าน้ำมัน (Fuel Cost)</Label>
                  <Input
                    id="fuel"
                    type="number"
                    value={costForm.fuel_cost}
                    onChange={(e) => setCostForm({ ...costForm, fuel_cost: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="allowance">ค่าแรง/เบี้ยเลี้ยง พขร.</Label>
                  <Input
                    id="allowance"
                    type="number"
                    value={costForm.driver_allowance}
                    onChange={(e) => setCostForm({ ...costForm, driver_allowance: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="toll">ค่าทางด่วน (Toll Fees)</Label>
                  <Input
                    id="toll"
                    type="number"
                    value={costForm.toll_fee}
                    onChange={(e) => setCostForm({ ...costForm, toll_fee: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="waiting">ค่าเสียเวลาจอดรอ (Waiting)</Label>
                  <Input
                    id="waiting"
                    type="number"
                    value={costForm.waiting_fee}
                    onChange={(e) => setCostForm({ ...costForm, waiting_fee: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ot">ค่าล่วงเวลา (OT)</Label>
                  <Input
                    id="ot"
                    type="number"
                    value={costForm.ot_fee}
                    onChange={(e) => setCostForm({ ...costForm, ot_fee: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="other">ค่าใช้จ่ายอื่นๆ</Label>
                  <Input
                    id="other"
                    type="number"
                    value={costForm.other_cost}
                    onChange={(e) => setCostForm({ ...costForm, other_cost: e.target.value })}
                  />
                </div>
              </div>

              {/* Live Preview Calculation */}
              {(() => {
                const total =
                  (parseFloat(costForm.fuel_cost) || 0) +
                  (parseFloat(costForm.driver_allowance) || 0) +
                  (parseFloat(costForm.toll_fee) || 0) +
                  (parseFloat(costForm.waiting_fee) || 0) +
                  (parseFloat(costForm.ot_fee) || 0) +
                  (parseFloat(costForm.other_cost) || 0);
                const rev = Number(selectedJob?.revenue || 0);
                const prof = rev - total;
                const margin = rev > 0 ? ((prof / rev) * 100).toFixed(1) : '0';

                return (
                  <div className="p-3 bg-slate-100 rounded-lg space-y-1 text-xs mt-2 border">
                    <div className="flex justify-between text-slate-700">
                      <span>รวมต้นทุนทั้งหมด:</span>
                      <strong className="text-rose-600">฿{total.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-900">กำไรสุทธิคำนวณได้:</span>
                      <strong className={prof >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        ฿{prof.toLocaleString()} ({margin}%)
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCostModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                บันทึกต้นทุนและคำนวณกำไร
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: PRINTABLE JOB ORDER SHEET ================= */}
      <Dialog open={openPrintModal} onOpenChange={setOpenPrintModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-600" />
              พิมพ์ใบสั่งงาน พขร. (Job Order Sheet)
            </DialogTitle>
            <DialogDescription>
              ตรวจสอบความถูกต้องของเอกสารก่อนสั่งพิมพ์ให้พนักงานขับรถ
            </DialogDescription>
          </DialogHeader>

          {/* Printable Job Order Sheet */}
          <div id="job-order-print" className="border-2 border-slate-900 p-6 rounded-lg bg-white text-slate-900 space-y-4 print:border-none print:p-0">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black tracking-wide text-slate-900">บริษัท คอนเนค ทรานสปอร์ต จำกัด</h2>
                <p className="text-xs text-slate-600">CONNECT TRANSPORT CO., LTD. | ระบบบริหารงานขนส่งตู้คอนเทนเนอร์</p>
                <p className="text-[11px] text-slate-500">มาตรฐานความปลอดภัย ISO 39001 Road Traffic Safety</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-black font-mono text-blue-800">{selectedJob?.job_no}</div>
                <div className="text-xs text-slate-600">วันที่: {selectedJob?.job_date}</div>
                <Badge variant="outline" className="text-xs font-bold mt-1">
                  ใบสั่งงาน พขร.
                </Badge>
              </div>
            </div>

            {/* Job Information Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 p-2 bg-slate-50 rounded border">
                <div><strong>ลูกค้า:</strong> {selectedJob?.customer?.company_name}</div>
                <div><strong>ผู้ติดต่อ:</strong> {selectedJob?.customer?.contact_name || '-'} (โทร: {selectedJob?.customer?.phone || '-'})</div>
                <div><strong>ประเภทงาน:</strong> {selectedJob?.job_type}</div>
              </div>
              <div className="space-y-1 p-2 bg-slate-50 rounded border">
                <div><strong>พนักงานขับรถ (พขร.):</strong> {selectedJob?.driver?.name || 'ยังไม่ระบุ'}</div>
                <div><strong>ทะเบียนรถ:</strong> {selectedJob?.vehicle?.plate_number || 'ยังไม่ระบุ'}</div>
                <div><strong>เบอร์โทร พขร.:</strong> {selectedJob?.driver?.phone || '-'}</div>
              </div>
            </div>

            {/* Route Details */}
            <div className="p-3 bg-blue-50/60 rounded border border-blue-200 text-xs space-y-1.5">
              <div className="font-bold text-blue-900 text-sm">รายละเอียดเส้นทาง (Route Details):</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold text-slate-700">1. จุดรับของ/ลานตู้ (ต้นทาง):</span>
                  <div className="text-slate-900 font-bold">{selectedJob?.origin?.name}</div>
                  <div className="text-[11px] text-slate-500">{selectedJob?.origin?.address}</div>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">2. จุดส่งของ/โรงงาน (ปลายทาง):</span>
                  <div className="text-slate-900 font-bold">{selectedJob?.destination?.name}</div>
                  <div className="text-[11px] text-slate-500">{selectedJob?.destination?.address}</div>
                </div>
              </div>
            </div>

            {/* Container Details */}
            <div className="border rounded p-3 text-xs space-y-2">
              <div className="font-bold text-slate-900">ข้อมูลตู้คอนเทนเนอร์ (Container Specification):</div>
              <div className="grid grid-cols-4 gap-2 text-center bg-slate-100 p-2 rounded">
                <div>
                  <span className="text-slate-500 block text-[10px]">ขนาด</span>
                  <strong>{selectedJob?.container_size} ฟุต</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ชนิดตู้</span>
                  <strong>{selectedJob?.container_type}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ชนิดสินค้า</span>
                  <strong>{selectedJob?.cargo_type}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">เอกสารท่าเรือ (PAT)</span>
                  <strong>{selectedJob?.pat_letter_required ? 'ต้องทำ PAT' : 'ไม่มี'}</strong>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="border-b border-dashed pb-1">
                  หมายเลขตู้ (Container No.): <strong className="font-mono text-sm">{selectedJob?.container_no || '........................'}</strong>
                </div>
                <div className="border-b border-dashed pb-1">
                  หมายเลขซีล (Seal No.): <strong className="font-mono text-sm">{selectedJob?.seal_no || '........................'}</strong>
                </div>
              </div>
            </div>

            {/* Safety & Driver Instructions */}
            <div className="text-[11px] text-slate-600 bg-amber-50/60 p-2.5 rounded border border-amber-200">
              <strong>ข้อกำหนดความปลอดภัยและการปฏิบัติงาน:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>ตรวจสภาพรถ รัดตรึงตู้ และล็อก Twistlock ให้ครบ 4 มุมก่อนออกเดินทาง</li>
                <li>ปฏิบัติตามความเร็วที่กฎหมายกำหนด และพักผ่อนตามข้อกำหนด ISO 39001</li>
                <li>เมื่อถึงจุดหมายให้ตรวจสอบหมายเลขตู้ และ Seal ให้ตรงกับเอกสารก่อนเปิดตู้</li>
              </ul>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs">
              <div className="border-t border-slate-400 pt-2">
                <div>( ......................................... )</div>
                <div className="text-slate-500 text-[11px] mt-1">เจ้าหน้าที่จ่ายงาน (Dispatcher)</div>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <div>( ......................................... )</div>
                <div className="text-slate-500 text-[11px] mt-1">พนักงานขับรถ (Driver)</div>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <div>( ......................................... )</div>
                <div className="text-slate-500 text-[11px] mt-1">ผู้รับสินค้าปลายทาง</div>
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={() => setOpenPrintModal(false)}>
              ปิดหน้าต่าง
            </Button>
            <Button type="button" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Printer className="h-4 w-4" />
              สั่งพิมพ์ใบสั่งงาน (Print)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
