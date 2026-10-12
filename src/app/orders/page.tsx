'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Customer, Location, RateCard, Job, JobType, JobStatus, ContainerSize, ContainerType, CargoType, VehicleType } from '@/types/database';
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search, 
  Filter, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  DollarSign,
  Sparkles
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

// Standard TMS Configuration Maps
const jobTypeMap: Record<JobType, { label: string; desc: string }> = {
  heavy_to_open: { label: 'ลากตู้หนักไปเปิด', desc: 'รับตู้หนักจากท่าเรือ/ลาน ไปเปิดของที่โรงงาน' },
  empty_to_stuff: { label: 'ลากตู้เปล่าไปบรรจุ', desc: 'รับตู้เปล่าไปบรรจุสินค้าที่โรงงาน' },
  empty_return: { label: 'ลากตู้เปล่าคืน', desc: 'นำตู้เปล่าส่งคืนลานตู้สายเรือ' },
  yard_move: { label: 'ย้ายลาน', desc: 'ย้ายตู้ระหว่างลานหรือในท่าเรือ' },
};

const vehicleTypeMap: Record<VehicleType, string> = {
  '4_wheel': 'รถ 4 ล้อ',
  '6_wheel': 'รถ 6 ล้อ',
  '10_wheel': 'รถ 10 ล้อ',
  'trailer': 'รถเทรลเลอร์ (หัวลาก)',
  'semi_trailer': 'รถกึ่งพ่วง (Semi-Trailer)',
};

const statusConfig: Record<JobStatus, { label: string; badgeClass: string }> = {
  draft: { label: 'ฉบับร่าง', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
  assigned: { label: 'มอบหมายแล้ว', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_progress: { label: 'กำลังดำเนินการ', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  completed: { label: 'เสร็จสิ้น', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'ยกเลิก', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export default function OrdersPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State
  const [openOrderModal, setOpenOrderModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    job_no: '',
    job_date: '',
    job_type: 'heavy_to_open' as JobType,
    customer_id: '',
    origin_id: '',
    destination_id: '',
    vehicle_type: 'trailer' as VehicleType,
    container_size: '40' as ContainerSize,
    container_type: 'HC' as ContainerType,
    cargo_type: 'NON_DG' as CargoType,
    status: 'draft' as JobStatus,
    revenue: '0',
    pat_letter_required: false,
    notes: '',
  });

  const [rateCardMatchNote, setRateCardMatchNote] = useState<string | null>(null);

  // Fetch all related data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [jobsRes, custRes, locRes, rateRes] = await Promise.all([
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
        supabase.from('customers').select('*').order('company_name'),
        supabase.from('locations').select('*').order('name'),
        supabase.from('rate_cards').select('*'),
      ]);

      if (jobsRes.data) setJobs(jobsRes.data as Job[]);
      if (custRes.data) setCustomers(custRes.data as Customer[]);
      if (locRes.data) setLocations(locRes.data as Location[]);
      if (rateRes.data) setRateCards(rateRes.data as RateCard[]);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Generate new Job Number (e.g. TMS-2026-005)
  const generateNextJobNo = () => {
    const currentYear = new Date().getFullYear();
    const count = jobs.length + 1;
    const formatted = `TMS-${currentYear}-${String(count).padStart(3, '0')}`;
    return formatted;
  };

  const handleOpenCreateModal = () => {
    const nextNo = generateNextJobNo();
    setFormData({
      job_no: nextNo,
      job_date: new Date().toISOString().split('T')[0],
      job_type: 'heavy_to_open',
      customer_id: customers[0]?.id || '',
      origin_id: locations[0]?.id || '',
      destination_id: locations[1]?.id || '',
      vehicle_type: 'trailer',
      container_size: '40',
      container_type: 'HC',
      cargo_type: 'NON_DG',
      status: 'draft',
      revenue: '7500',
      pat_letter_required: false,
      notes: '',
    });
    setRateCardMatchNote(null);
    setOpenOrderModal(true);
  };

  // Check rate card match automatically when origin, dest, or vehicle type changes
  const checkRateCard = (originId: string, destId: string, vType: VehicleType) => {
    const match = rateCards.find(
      (r) => r.origin_id === originId && r.destination_id === destId && r.vehicle_type === vType
    );
    if (match) {
      setFormData((prev) => ({ ...prev, revenue: String(match.base_price) }));
      setRateCardMatchNote(`พบคู่เส้นทางใน Rate Card: ราคาแนะนำ ฿${Number(match.base_price).toLocaleString()}`);
    } else {
      setRateCardMatchNote(null);
    }
  };

  // Submit new Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.origin_id || !formData.destination_id) {
      alert('กรุณาเลือกข้อมูลลูกค้า ต้นทาง และปลายทางให้ครบถ้วน');
      return;
    }

    const price = parseFloat(formData.revenue) || 0;

    // Check estimated costs from rate card or sensible defaults
    const match = rateCards.find(
      (r) => r.origin_id === formData.origin_id && r.destination_id === formData.destination_id && r.vehicle_type === formData.vehicle_type
    );
    const fuelEst = match ? Number(match.fuel_cost_est) : price * 0.3;
    const driverEst = match ? Number(match.driver_fee_est) : 600;
    const tollEst = match ? Number(match.toll_fee_est) : 200;
    const totalCostEst = fuelEst + driverEst + tollEst;
    const netProfitEst = price - totalCostEst;

    const { error } = await supabase.from('jobs').insert([
      {
        job_no: formData.job_no,
        job_date: formData.job_date,
        job_type: formData.job_type,
        customer_id: formData.customer_id,
        origin_id: formData.origin_id,
        destination_id: formData.destination_id,
        vehicle_type: formData.vehicle_type,
        container_size: formData.container_size,
        container_type: formData.container_type,
        cargo_type: formData.cargo_type,
        status: formData.status,
        revenue: price,
        fuel_cost: fuelEst,
        driver_allowance: driverEst,
        toll_fee: tollEst,
        waiting_fee: 0,
        ot_fee: 0,
        other_cost: 0,
        total_cost: totalCostEst,
        net_profit: netProfitEst,
        pat_letter_required: formData.pat_letter_required,
        pat_letter_status: formData.pat_letter_required ? 'pending' : 'none',
        driver_notes: formData.notes,
      },
    ]);

    if (!error) {
      setOpenOrderModal(false);
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการสร้างงาน: ' + error.message);
    }
  };

  // Delete Order
  const handleDeleteOrder = async (id: string) => {
    if (!confirm('ยืนยันที่จะลบงานขนส่งนี้หรือไม่?')) return;
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (!error) {
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
    }
  };

  // Filtered jobs
  const filteredJobs = jobs.filter((j) => {
    const matchSearch =
      j.job_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.customer?.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.origin?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.destination?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Module 2: Order Management
            </span>
            <span className="text-xs text-slate-500">Connect Transport Co., Ltd.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-blue-600" />
            ระบบรับงานขนส่ง (Order Management)
          </h1>
          <p className="text-slate-500 text-sm">
            เปิดใบรับงานใหม่ กำหนดสเปกตู้คอนเทนเนอร์ (20&apos;, 40&apos;, 45&apos; / DC, HC) คำนวณราคาตาม Rate Card
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
            onClick={handleOpenCreateModal}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            + รับงานขนส่งใหม่ (New Job Order)
          </Button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ค้นหา Job ID, ลูกค้า, เส้นทาง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white text-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              className="border rounded-md px-3 py-2 text-sm bg-white border-slate-300"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">ทุกสถานะงาน ({jobs.length})</option>
              <option value="draft">ฉบับร่าง (Draft)</option>
              <option value="assigned">มอบหมายแล้ว (Assigned)</option>
              <option value="in_progress">กำลังดำเนินการ (In Progress)</option>
              <option value="completed">เสร็จสิ้น (Completed)</option>
              <option value="cancelled">ยกเลิก (Cancelled)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold">รายการงานขนส่งทั้งหมด ({filteredJobs.length})</CardTitle>
            <CardDescription>แสดงงานที่เปิดรับในระบบเรียงตามวันที่ล่าสุด</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70">
                  <TableHead className="font-semibold text-slate-800">Job ID</TableHead>
                  <TableHead className="font-semibold text-slate-800">วันที่รับงาน</TableHead>
                  <TableHead className="font-semibold text-slate-800">ประเภทงาน</TableHead>
                  <TableHead className="font-semibold text-slate-800">ชื่อลูกค้า</TableHead>
                  <TableHead className="font-semibold text-slate-800">เส้นทาง (ต้นทาง ➔ ปลายทาง)</TableHead>
                  <TableHead className="font-semibold text-slate-800">สเปกตู้</TableHead>
                  <TableHead className="font-semibold text-slate-800">ประเภทรถ</TableHead>
                  <TableHead className="font-semibold text-slate-800">สถานะ</TableHead>
                  <TableHead className="font-semibold text-slate-800">จดหมายท่าเรือ (PAT)</TableHead>
                  <TableHead className="text-right font-semibold text-slate-800">ราคาเรียกเก็บ</TableHead>
                  <TableHead className="text-right font-semibold text-slate-800">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-slate-500">
                      ไม่พบข้อมูลงานขนส่งที่ตรงกับเงื่อนไขการค้นหา
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((j) => (
                    <TableRow key={j.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-bold text-blue-700 whitespace-nowrap">
                        {j.job_no}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {j.job_date}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {jobTypeMap[j.job_type]?.label || j.job_type}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 max-w-[160px] truncate">
                        {j.customer?.company_name || 'ลูกค้าทั่วไป'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        <span className="font-medium text-slate-900">{j.origin?.name || '-'}</span>
                        <span className="mx-1 text-slate-400">➔</span>
                        <span>{j.destination?.name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-800 border">
                          {j.container_size}&apos; {j.container_type}
                          {j.cargo_type === 'DG' && (
                            <span className="text-rose-600 font-bold" title="Dangerous Goods">⚠️ DG</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {vehicleTypeMap[j.vehicle_type] || j.vehicle_type}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`font-medium ${statusConfig[j.status]?.badgeClass || ''}`}
                        >
                          {statusConfig[j.status]?.label || j.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {j.pat_letter_required ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            ต้องทำ PAT
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        ฿{Number(j.revenue).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteOrder(j.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ================= MODAL: CREATE NEW ORDER ================= */}
      <Dialog open={openOrderModal} onOpenChange={setOpenOrderModal}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateOrder}>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-600" />
                เปิดใบรับงานขนส่งใหม่ (New Job Order)
              </DialogTitle>
              <DialogDescription>
                กรอกข้อมูลรับงานขนส่งตู้คอนเทนเนอร์ ระบบจะแนะนำราคาอัตโนมัติตามเส้นทาง
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              {/* Row 1: Job ID & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="job_no">Job ID (สร้างอัตโนมัติ)</Label>
                  <Input 
                    id="job_no" 
                    value={formData.job_no} 
                    readOnly 
                    className="bg-slate-100 font-bold text-blue-700 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="job_date">วันที่รับงาน (Job Date) *</Label>
                  <Input 
                    id="job_date" 
                    type="date"
                    required
                    value={formData.job_date} 
                    onChange={(e) => setFormData({ ...formData, job_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 2: Customer & Job Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="customer_id">ชื่อลูกค้า (Customer) *</Label>
                  <select
                    id="customer_id"
                    required
                    className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  >
                    <option value="">-- เลือกลูกค้า --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="job_type">ประเภทงาน (Job Type) *</Label>
                  <select
                    id="job_type"
                    required
                    className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                    value={formData.job_type}
                    onChange={(e) => setFormData({ ...formData, job_type: e.target.value as JobType })}
                  >
                    <option value="heavy_to_open">1. ลากตู้หนักไปเปิด (Heavy to Open)</option>
                    <option value="empty_to_stuff">2. ลากตู้เปล่าไปบรรจุ (Empty to Stuff)</option>
                    <option value="empty_return">3. ลากตู้เปล่าคืน (Empty Return)</option>
                    <option value="yard_move">4. ย้ายลาน (Yard Move)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Route (Origin -> Destination) */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-100/70 rounded-lg border border-slate-200">
                <div className="space-y-1">
                  <Label htmlFor="origin_id">ต้นทาง (Origin - รับของ/ตู้) *</Label>
                  <select
                    id="origin_id"
                    required
                    className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                    value={formData.origin_id}
                    onChange={(e) => {
                      const newOrigin = e.target.value;
                      setFormData({ ...formData, origin_id: newOrigin });
                      checkRateCard(newOrigin, formData.destination_id, formData.vehicle_type);
                    }}
                  >
                    <option value="">-- เลือกสถานที่ต้นทาง --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name} ({loc.province})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="destination_id">ปลายทาง (Destination - ส่งของ/ตู้) *</Label>
                  <select
                    id="destination_id"
                    required
                    className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                    value={formData.destination_id}
                    onChange={(e) => {
                      const newDest = e.target.value;
                      setFormData({ ...formData, destination_id: newDest });
                      checkRateCard(formData.origin_id, newDest, formData.vehicle_type);
                    }}
                  >
                    <option value="">-- เลือกสถานที่ปลายทาง --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name} ({loc.province})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Vehicle Type */}
              <div className="space-y-1">
                <Label htmlFor="vehicle_type">ประเภทรถที่ต้องการ (Vehicle Type) *</Label>
                <select
                  id="vehicle_type"
                  required
                  className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                  value={formData.vehicle_type}
                  onChange={(e) => {
                    const newVType = e.target.value as VehicleType;
                    setFormData({ ...formData, vehicle_type: newVType });
                    checkRateCard(formData.origin_id, formData.destination_id, newVType);
                  }}
                >
                  <option value="trailer">รถเทรลเลอร์ (หัวลาก)</option>
                  <option value="semi_trailer">รถกึ่งพ่วง (Semi-Trailer)</option>
                  <option value="10_wheel">รถ 10 ล้อ</option>
                  <option value="6_wheel">รถ 6 ล้อ</option>
                  <option value="4_wheel">รถ 4 ล้อ</option>
                </select>
              </div>

              {/* Row 5: Container Specifications */}
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 space-y-2">
                <div className="font-semibold text-blue-900 text-xs uppercase tracking-wide">
                  สเปกตู้คอนเทนเนอร์ (Container Specification)
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="c_size">ขนาด (Size)</Label>
                    <select
                      id="c_size"
                      className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                      value={formData.container_size}
                      onChange={(e) => setFormData({ ...formData, container_size: e.target.value as ContainerSize })}
                    >
                      <option value="20">20 ฟุต (20&apos;)</option>
                      <option value="40">40 ฟุต (40&apos;)</option>
                      <option value="45">45 ฟุต (45&apos;)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="c_type">ชนิดตู้ (Type)</Label>
                    <select
                      id="c_type"
                      className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                      value={formData.container_type}
                      onChange={(e) => setFormData({ ...formData, container_type: e.target.value as ContainerType })}
                    >
                      <option value="DC">DC (Dry Container ตู้แห้ง)</option>
                      <option value="HC">HC (High Cube ตู้สูง)</option>
                      <option value="OT">OT (Open Top ตู้เปิดหลังคา)</option>
                      <option value="RH">RH (Reefer HC ตู้เย็น)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cargo_type">ชนิดสินค้า (Cargo)</Label>
                    <select
                      id="cargo_type"
                      className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                      value={formData.cargo_type}
                      onChange={(e) => setFormData({ ...formData, cargo_type: e.target.value as CargoType })}
                    >
                      <option value="NON_DG">Non-DG (สินค้าทั่วไป)</option>
                      <option value="DG">DG (สินค้าอันตราย ⚠️)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 6: Pricing and Rate Card Auto-Suggestion */}
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="revenue">ราคาค่าขนส่งเรียกเก็บ (บาท) *</Label>
                    {rateCardMatchNote && (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Rate Card Auto
                      </span>
                    )}
                  </div>
                  <Input 
                    id="revenue" 
                    type="number"
                    required
                    value={formData.revenue} 
                    onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                    className="font-bold text-emerald-700 text-base"
                  />
                  {rateCardMatchNote && (
                    <p className="text-[11px] text-emerald-600 mt-0.5">{rateCardMatchNote}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="status">สถานะเริ่มต้น</Label>
                  <select
                    id="status"
                    className="w-full border rounded-md p-2 text-sm bg-white border-slate-300"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as JobStatus })}
                  >
                    <option value="draft">ฉบับร่าง (Draft)</option>
                    <option value="assigned">มอบหมายแล้ว (Assigned)</option>
                    <option value="in_progress">กำลังดำเนินการ (In Progress)</option>
                    <option value="completed">เสร็จสิ้น (Completed)</option>
                  </select>
                </div>
              </div>

              {/* Row 7: Special Documents & Notes */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-slate-50">
                <input
                  type="checkbox"
                  id="pat"
                  checked={formData.pat_letter_required}
                  onChange={(e) => setFormData({ ...formData, pat_letter_required: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <Label htmlFor="pat" className="text-xs font-medium text-slate-800 cursor-pointer">
                  ต้องทำ <strong>&ldquo;จดหมายเปลี่ยนใบเสร็จท่าเรือ (PAT Letter)&rdquo;</strong> สำหรับงานนี้
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenOrderModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 gap-2">
                <CheckCircle2 className="h-4 w-4" />
                บันทึกใบรับงาน
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
