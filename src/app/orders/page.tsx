'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Customer, Location, RateCard, Job, JobType, JobStatus, ContainerSize, ContainerType, CargoType, VehicleType } from '@/types/database';
import { logActivity } from '@/lib/audit-logger';
import { useAuth } from '@/lib/auth-context';
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
  Sparkles,
  Download,
  Printer,
  Ship,
  Anchor,
  ReceiptText,
  Calendar,
  Box
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

const COMMON_SHIPPING_LINES = [
  'YML (Yang Ming)',
  'OOCL',
  'CMA CGM',
  'Evergreen',
  'ONE (Ocean Network Express)',
  'Maersk',
  'MSC',
  'COSCO',
  'Hapag-Lloyd',
  'RCL',
  'SITC',
  'Wanhai'
];

// CSV Export Helper
function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const bom = '\uFEFF';
  const csvContent = bom + [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function OrdersPage() {
  const { currentUser, currentRole } = useAuth();
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
    shipper_name: '',
    ship_line: 'Evergreen',
    bl_no: '',
    book_no: '',
    commodity_name: '',

    // Routes
    pickup_place: '',
    pickup_date: '',
    packing_place: '',
    packing_date: '',
    return_place: '',
    return_date: '',

    origin_id: '',
    destination_id: '',
    vehicle_type: 'trailer' as VehicleType,
    container_size: '40' as ContainerSize,
    container_type: 'HC' as ContainerType,
    container_amount: '1',
    cargo_type: 'NON_DG' as CargoType,
    status: 'draft' as JobStatus,

    // Pricing
    price: '5500',
    addon_price: '0',
    revenue: '5500',

    pat_letter_required: false,
    notes: '',
  });

  const [selectedRateCardId, setSelectedRateCardId] = useState<string>('');
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
        supabase.from('rate_cards').select('*, origin:locations!origin_id(*), destination:locations!destination_id(*)'),
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

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const nextNo = generateNextJobNo();
    const today = new Date().toISOString().split('T')[0];
    const defaultCust = customers[0];
    const defaultOrigin = locations[0]?.name || 'ลานตู้บึงทองคำ';
    const defaultDest = locations[1]?.name || 'ท่าเรือคลองเตย (PAT)';

    setFormData({
      job_no: nextNo,
      job_date: today,
      job_type: 'heavy_to_open',
      customer_id: defaultCust?.id || '',
      shipper_name: defaultCust?.shipper_name || '',
      ship_line: 'Evergreen',
      bl_no: '',
      book_no: '',
      commodity_name: defaultCust?.commodity_name || '',

      pickup_place: defaultOrigin,
      pickup_date: today,
      packing_place: 'โรงงานลูกค้า',
      packing_date: today,
      return_place: defaultDest,
      return_date: today,

      origin_id: locations[0]?.id || '',
      destination_id: locations[1]?.id || '',
      vehicle_type: 'trailer',
      container_size: '40',
      container_type: 'HC',
      container_amount: '1',
      cargo_type: 'NON_DG',
      status: 'draft',

      price: '5500',
      addon_price: '0',
      revenue: '5500',

      pat_letter_required: defaultDest.includes('PAT') || defaultDest.includes('คลองเตย'),
      notes: '',
    });

    setSelectedRateCardId('');
    setRateCardMatchNote(null);
    setOpenOrderModal(true);
  };

  // When Customer changes, auto-fill default shipper & commodity
  const handleCustomerChange = (custId: string) => {
    const cust = customers.find(c => c.id === custId);
    setFormData(prev => ({
      ...prev,
      customer_id: custId,
      shipper_name: cust?.shipper_name || prev.shipper_name,
      commodity_name: cust?.commodity_name || prev.commodity_name,
    }));
  };

  // When Return Place changes, auto check PAT checkbox if port is PAT / Klongtoey
  const handleReturnPlaceChange = (placeName: string) => {
    const isPat = placeName.toUpperCase().includes('PAT') || placeName.includes('คลองเตย');
    setFormData(prev => ({
      ...prev,
      return_place: placeName,
      pat_letter_required: isPat || prev.pat_letter_required,
    }));
  };

  // Handle Rate Card selection
  const handleApplyRateCard = (rateId: string) => {
    setSelectedRateCardId(rateId);
    if (!rateId) return;

    const rate = rateCards.find(r => r.id === rateId);
    if (rate) {
      const basePrice = Number(rate.base_price || 0);
      const addon = parseFloat(formData.addon_price) || 0;
      const count = parseInt(formData.container_amount) || 1;
      const totalRev = (basePrice + addon) * count;

      setFormData(prev => ({
        ...prev,
        origin_id: rate.origin_id || prev.origin_id,
        destination_id: rate.destination_id || prev.destination_id,
        pickup_place: rate.origin?.name || prev.pickup_place,
        return_place: rate.destination?.name || prev.return_place,
        container_size: (rate.container_size as ContainerSize) || prev.container_size,
        container_type: (rate.container_type as ContainerType) || prev.container_type,
        vehicle_type: rate.vehicle_type || prev.vehicle_type,
        price: String(basePrice),
        revenue: String(totalRev),
        pat_letter_required: (rate.destination?.name || '').includes('PAT') || (rate.destination?.name || '').includes('คลองเตย'),
      }));

      setRateCardMatchNote(`ใช้เรท: ${rate.origin?.name} ➔ ${rate.destination?.name} (ราคา ฿${basePrice.toLocaleString()} / ตู้)`);
    }
  };

  // Recalculate Revenue when price, addon_price, or container_amount changes
  const handlePriceUpdate = (newPrice: string, newAddon: string, newAmount: string) => {
    const p = parseFloat(newPrice) || 0;
    const a = parseFloat(newAddon) || 0;
    const c = parseInt(newAmount) || 1;
    const total = (p + a) * c;
    setFormData(prev => ({
      ...prev,
      price: newPrice,
      addon_price: newAddon,
      container_amount: newAmount,
      revenue: String(total),
    }));
  };

  // Submit new Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id) {
      alert('กรุณาเลือกลูกค้าผู้ว่าจ้าง');
      return;
    }

    const price = parseFloat(formData.price) || 0;
    const addon = parseFloat(formData.addon_price) || 0;
    const totalRev = parseFloat(formData.revenue) || (price + addon);
    const amount = parseInt(formData.container_amount) || 1;

    // Check estimated costs
    const fuelEst = price * 0.3 * amount;
    const driverEst = 600 * amount;
    const tollEst = 200 * amount;
    const totalCostEst = fuelEst + driverEst + tollEst;
    const netProfitEst = totalRev - totalCostEst;

    const { error } = await supabase.from('jobs').insert([
      {
        job_no: formData.job_no,
        job_date: formData.job_date,
        job_type: formData.job_type,
        customer_id: formData.customer_id,
        shipper_name: formData.shipper_name || null,
        ship_line: formData.ship_line || null,
        bl_no: formData.bl_no || null,
        book_no: formData.book_no || null,
        commodity_name: formData.commodity_name || null,

        pickup_place: formData.pickup_place || null,
        pickup_date: formData.pickup_date || null,
        packing_place: formData.packing_place || null,
        packing_date: formData.packing_date || null,
        return_place: formData.return_place || null,
        return_date: formData.return_date || null,

        origin_id: formData.origin_id || null,
        destination_id: formData.destination_id || null,
        vehicle_type: formData.vehicle_type,
        container_size: formData.container_size,
        container_type: formData.container_type,
        container_amount: amount,
        cargo_type: formData.cargo_type,
        status: formData.status,

        price: price,
        addon_price: addon,
        revenue: totalRev,
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
        invoice_no: null, // initially null until billed
        driver_notes: formData.notes,
      },
    ]);

    if (!error) {
      logActivity({
        user_id: currentUser?.id || 'sys',
        user_name: currentUser?.name || 'User',
        user_role: currentRole?.id || 'cs',
        action: 'CREATE',
        module: 'ORDERS',
        description: `เปิดใบรับงานขนส่งใหม่: ${formData.job_no} (${amount}x${formData.container_size}' ${formData.container_type})`,
      });
      setOpenOrderModal(false);
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการสร้างงาน: ' + error.message);
    }
  };

  // Delete Order
  const handleDeleteOrder = async (id: string, jobNo: string) => {
    if (!confirm(`ยืนยันที่จะลบงานขนส่ง "${jobNo}" หรือไม่?`)) return;
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (!error) {
      logActivity({
        user_id: currentUser?.id || 'sys',
        user_name: currentUser?.name || 'User',
        user_role: currentRole?.id || 'admin',
        action: 'DELETE',
        module: 'ORDERS',
        description: `ลบงานขนส่ง: ${jobNo}`,
      });
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
    }
  };

  // Export CSV
  const exportOrdersCsv = () => {
    const headers = [
      'Job ID', 'วันที่รับงาน', 'ประเภทงาน', 'ลูกค้า', 'สายเรือ', 'Booking No.', 'B/L No.', 'Shipper',
      'Volume (สเปกตู้)', 'จำนวนตู้', 'จุดรับตู้', 'จุดบรรจุ', 'จุดคืนตู้', 'ราคาขนส่ง', 'อัตราเพิ่ม',
      'รายได้รวม', 'สถานะงาน', 'Invoice No.', 'จดหมาย PAT'
    ];
    const rows = filteredJobs.map(j => [
      j.job_no,
      j.job_date,
      jobTypeMap[j.job_type]?.label || j.job_type,
      j.customer?.company_name || '-',
      j.ship_line || '-',
      j.book_no || '-',
      j.bl_no || '-',
      j.shipper_name || '-',
      `${j.container_amount || 1}x${j.container_size}' ${j.container_type}`,
      j.container_amount || 1,
      j.pickup_place || j.origin?.name || '-',
      j.packing_place || '-',
      j.return_place || j.destination?.name || '-',
      j.price || j.revenue,
      j.addon_price || 0,
      j.revenue,
      statusConfig[j.status]?.label || j.status,
      j.invoice_no || 'ยังไม่ออกบิล',
      j.pat_letter_required ? 'ต้องทำ PAT' : '-'
    ]);
    exportToCsv('Job_Orders_Master', headers, rows);
  };

  // Filtered jobs
  const filteredJobs = jobs.filter((j) => {
    const matchSearch =
      j.job_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.customer?.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.ship_line || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.book_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.pickup_place || j.origin?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.return_place || j.destination?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

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
            เปิดใบรับงานใหม่ กำหนดสเปก Volume ตู้ (เช่น 2x20&apos; DC, 1x40&apos; HC), สายเรือ, Booking, อ้างอิง Rate Card และตรวจสอบ Invoice No.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm" onClick={exportOrdersCsv} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button onClick={handleOpenCreateModal} className="bg-blue-600 hover:bg-blue-700 gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            เปิดงานใหม่ (New Job)
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-4 gap-4">
          <div>
            <CardTitle className="text-base font-bold">รายการคำสั่งงานขนส่งทั้งหมด ({filteredJobs.length})</CardTitle>
            <CardDescription>
              รายการงานนำเข้า/ส่งออก, สเปกตู้, เส้นทาง 3 จุด, ติดตามเลข Invoice No. และสถานะการเปลี่ยนใบเสร็จท่าเรือ PAT
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="ค้นหา Job ID, ลูกค้า, สายเรือ, ลานตู้..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 text-xs border rounded-md px-2.5 bg-white border-slate-300"
            >
              <option value="all">ทุกสถานะงาน</option>
              <option value="draft">ฉบับร่าง</option>
              <option value="assigned">มอบหมายแล้ว</option>
              <option value="in_progress">กำลังดำเนินการ</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70 text-xs">
                  <TableHead className="font-bold text-blue-900">Job ID</TableHead>
                  <TableHead className="font-bold">วันที่วิ่งงาน</TableHead>
                  <TableHead className="font-bold">ลูกค้า / สายเรือ</TableHead>
                  <TableHead>Booking / B/L No.</TableHead>
                  <TableHead className="font-bold">เส้นทาง 3 จุด (รับตู้ ➔ บรรจุ ➔ คืนตู้)</TableHead>
                  <TableHead className="font-bold text-center">Volume / สเปก</TableHead>
                  <TableHead className="text-center font-bold text-purple-900">Invoice No.</TableHead>
                  <TableHead>สถานะงาน</TableHead>
                  <TableHead>จดหมายท่าเรือ (PAT)</TableHead>
                  <TableHead className="text-right font-bold text-emerald-800">ราคาเรียกเก็บ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
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
                  filteredJobs.map((j) => {
                    const volumeStr = `${j.container_amount || 1}x${j.container_size || '40'}' ${j.container_type || 'HC'}`;
                    return (
                      <TableRow key={j.id} className="hover:bg-slate-50/80 text-xs">
                        <TableCell className="font-bold text-blue-700 whitespace-nowrap font-mono">
                          {j.job_no}
                        </TableCell>
                        <TableCell className="text-slate-600 whitespace-nowrap">
                          {j.job_date}
                        </TableCell>
                        <TableCell className="max-w-[170px]">
                          <div className="font-bold text-slate-900 truncate">{j.customer?.company_name || 'ลูกค้าทั่วไป'}</div>
                          {j.ship_line && (
                            <div className="text-[11px] text-blue-700 flex items-center gap-1 font-medium">
                              <Ship className="h-3 w-3 shrink-0" /> {j.ship_line}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">
                          <div><span className="text-slate-400">BK:</span> {j.book_no || '-'}</div>
                          {j.bl_no && <div><span className="text-slate-400">BL:</span> {j.bl_no}</div>}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="text-[11px] text-slate-700 truncate">
                            <span className="text-slate-500">รับ:</span> {j.pickup_place || j.origin?.name || '-'}
                          </div>
                          <div className="text-[11px] text-slate-700 truncate">
                            <span className="text-slate-500">บรรจุ:</span> {j.packing_place || '-'}
                          </div>
                          <div className="text-[11px] text-slate-900 font-semibold truncate">
                            <span className="text-blue-600">คืน:</span> {j.return_place || j.destination?.name || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 font-mono font-bold text-slate-900 border text-xs">
                            <Box className="h-3 w-3 text-blue-600" />
                            {volumeStr}
                          </span>
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {j.invoice_no ? (
                            <Badge variant="outline" className="font-mono font-bold text-blue-800 bg-blue-50 border-blue-200">
                              <ReceiptText className="h-3 w-3 mr-1" />
                              {j.invoice_no}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">ยังไม่ออกบิล</span>
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
                        <TableCell>
                          {j.pat_letter_required ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              <Anchor className="h-3 w-3 mr-1" />
                              ต้องทำ PAT
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-700 whitespace-nowrap">
                          ฿{Number(j.revenue || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteOrder(j.id, j.job_no)}
                            className="text-slate-400 hover:text-red-700 hover:bg-red-50 h-8 w-8"
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

      {/* ================= MODAL: CREATE NEW ORDER ================= */}
      <Dialog open={openOrderModal} onOpenChange={setOpenOrderModal}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateOrder}>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-600" />
                เปิดใบรับงานขนส่งใหม่ (New Job Order)
              </DialogTitle>
              <DialogDescription>
                กรอกข้อมูลรับงาน, สเปก Volume ตู้, สายเรือ, และเส้นทาง 3 จุด หรือเลือกจาก Rate Card เพื่อดึงราคาอัตโนมัติ
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Quick Rate Card Select */}
              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-blue-900">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    อ้างอิง Rate Card ราคามาตรฐาน (ถ้ามี):
                  </span>
                  <span className="text-[11px] text-blue-600 font-normal">ดึงเส้นทาง สเปกตู้ และราคาให้อัตโนมัติ</span>
                </div>
                <select
                  className="w-full border rounded-md px-3 py-1.5 text-xs bg-white border-blue-300 font-medium"
                  value={selectedRateCardId}
                  onChange={(e) => handleApplyRateCard(e.target.value)}
                >
                  <option value="">-- ไม่ใช้อ้างอิง Rate Card (ป้อนข้อมูลเองทั้งหมด) --</option>
                  {rateCards.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.origin?.name} ➔ {r.destination?.name} ({r.container_size}&apos; {r.container_type}) - ฿{Number(r.base_price).toLocaleString()}
                    </option>
                  ))}
                </select>
                {rateCardMatchNote && (
                  <p className="text-[11px] text-emerald-700 font-semibold">{rateCardMatchNote}</p>
                )}
              </div>

              {/* 1. Job Meta */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold text-blue-900">Job ID (อัตโนมัติ) *</Label>
                  <Input
                    required
                    value={formData.job_no}
                    onChange={(e) => setFormData({ ...formData, job_no: e.target.value })}
                    className="font-mono font-bold bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">วันที่รับงาน / วิ่งงาน *</Label>
                  <Input
                    required
                    type="date"
                    value={formData.job_date}
                    onChange={(e) => setFormData({ ...formData, job_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">ประเภทงาน *</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-xs bg-white"
                    value={formData.job_type}
                    onChange={(e) => setFormData({ ...formData, job_type: e.target.value as JobType })}
                  >
                    <option value="heavy_to_open">ลากตู้หนักไปเปิด (Import)</option>
                    <option value="empty_to_stuff">ลากตู้เปล่าไปบรรจุ (Export)</option>
                    <option value="empty_return">ลากตู้เปล่าคืน</option>
                    <option value="yard_move">ย้ายลาน</option>
                  </select>
                </div>
              </div>

              {/* 2. Customer & Shipping Line */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">ลูกค้าผู้ว่าจ้าง *</Label>
                  <select
                    required
                    className="w-full border rounded-md px-3 py-2 text-xs bg-white font-medium"
                    value={formData.customer_id}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                  >
                    <option value="">-- เลือกลูกค้า --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.branch || 'สำนักงานใหญ่'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-bold">สายเรือ (Shipping Line)</Label>
                  <input
                    list="shipping-lines-list"
                    className="w-full border rounded-md px-3 py-2 text-xs bg-white"
                    placeholder="เช่น Evergreen, YML, OOCL, CMA CGM"
                    value={formData.ship_line}
                    onChange={(e) => setFormData({ ...formData, ship_line: e.target.value })}
                  />
                  <datalist id="shipping-lines-list">
                    {COMMON_SHIPPING_LINES.map(line => (
                      <option key={line} value={line} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 3. B/L, Booking, Shipper, Commodity */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">เลขที่ Booking (สายเรือ)</Label>
                  <Input
                    placeholder="เช่น 256674749"
                    value={formData.book_no}
                    onChange={(e) => setFormData({ ...formData, book_no: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">เลขที่ B/L</Label>
                  <Input
                    placeholder="เช่น NOSNB25BK22851"
                    value={formData.bl_no}
                    onChange={(e) => setFormData({ ...formData, bl_no: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">ชื่อ Shipper บน B/L</Label>
                  <Input
                    placeholder="ELECTRICAL COMPONENTS CO."
                    value={formData.shipper_name}
                    onChange={(e) => setFormData({ ...formData, shipper_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">ชื่อสินค้า (Commodity)</Label>
                  <Input
                    placeholder="ชิ้นส่วนอิเล็กทรอนิกส์"
                    value={formData.commodity_name}
                    onChange={(e) => setFormData({ ...formData, commodity_name: e.target.value })}
                  />
                </div>
              </div>

              {/* 4. Three Route Points (Pickup ➔ Packing ➔ Return) */}
              <div className="border rounded-lg p-3 bg-slate-50/60 space-y-3">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  กำหนดการเดินทางและเส้นทาง 3 จุด:
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Point 1: Pickup */}
                  <div className="p-2.5 bg-white rounded border space-y-1.5">
                    <div className="font-bold text-blue-900">1. สถานที่รับตู้ (Pickup)</div>
                    <Input
                      placeholder="เช่น ลานตู้บึงทองคำ"
                      value={formData.pickup_place}
                      onChange={(e) => setFormData({ ...formData, pickup_place: e.target.value })}
                    />
                    <div>
                      <span className="text-[10px] text-slate-500">วันที่รับตู้:</span>
                      <Input
                        type="date"
                        value={formData.pickup_date}
                        onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Point 2: Packing */}
                  <div className="p-2.5 bg-white rounded border space-y-1.5">
                    <div className="font-bold text-slate-900">2. สถานที่บรรจุสินค้า</div>
                    <Input
                      placeholder="เช่น โรงงาน KRC นวนคร"
                      value={formData.packing_place}
                      onChange={(e) => setFormData({ ...formData, packing_place: e.target.value })}
                    />
                    <div>
                      <span className="text-[10px] text-slate-500">วันที่บรรจุ:</span>
                      <Input
                        type="date"
                        value={formData.packing_date}
                        onChange={(e) => setFormData({ ...formData, packing_date: e.target.value })}
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Point 3: Return */}
                  <div className="p-2.5 bg-white rounded border space-y-1.5">
                    <div className="font-bold text-blue-900">3. สถานที่คืนตู้ (Return)</div>
                    <Input
                      placeholder="เช่น ท่าเรือคลองเตย (PAT)"
                      value={formData.return_place}
                      onChange={(e) => handleReturnPlaceChange(e.target.value)}
                    />
                    <div>
                      <span className="text-[10px] text-slate-500">วันที่คืนตู้:</span>
                      <Input
                        type="date"
                        value={formData.return_date}
                        onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Volume & Container Specs */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-bold">ขนาดตู้</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-xs bg-white font-medium"
                    value={formData.container_size}
                    onChange={(e) => setFormData({ ...formData, container_size: e.target.value as ContainerSize })}
                  >
                    <option value="20">20 ฟุต</option>
                    <option value="40">40 ฟุต</option>
                    <option value="45">45 ฟุต</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold">ชนิดตู้</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-xs bg-white font-medium"
                    value={formData.container_type}
                    onChange={(e) => setFormData({ ...formData, container_type: e.target.value as ContainerType })}
                  >
                    <option value="DC">DC (แห้งทั่วไป)</option>
                    <option value="HC">HC (ทรงสูง High Cube)</option>
                    <option value="OT">OT (เปิดหลังคา Open Top)</option>
                    <option value="RH">RH (ตู้เย็น Reefer)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-blue-900">จำนวนตู้ (Volume)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.container_amount}
                    onChange={(e) => handlePriceUpdate(formData.price, formData.addon_price, e.target.value)}
                    className="font-bold text-center"
                  />
                </div>

                <div>
                  <Label className="text-xs">ชนิดสินค้า</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-xs bg-white"
                    value={formData.cargo_type}
                    onChange={(e) => setFormData({ ...formData, cargo_type: e.target.value as CargoType })}
                  >
                    <option value="NON_DG">ทั่วไป (Non-DG)</option>
                    <option value="DG">สินค้าอันตราย (DG)</option>
                  </select>
                </div>
              </div>

              {/* Volume preview badge */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">สเปกและปริมาณงาน (Volume):</span>
                <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold text-xs border border-blue-200">
                  {formData.container_amount}x{formData.container_size}&apos; {formData.container_type}
                </span>
                {parseInt(formData.container_amount) > 1 && (
                  <span className="text-[11px] text-amber-700 italic">
                    * 1 Job หลายตู้: จะสามารถจ่ายรถหลายคันแยกตามตู้ได้ในหน้า Dispatch
                  </span>
                )}
              </div>

              {/* 6. Pricing & Addon */}
              <div className="grid grid-cols-3 gap-3 border-t pt-3">
                <div>
                  <Label className="text-xs font-bold">ราคาค่าขนส่งต่อตู้ (บาท)</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => handlePriceUpdate(e.target.value, formData.addon_price, formData.container_amount)}
                  />
                </div>
                <div>
                  <Label className="text-xs">อัตราเพิ่มต่อตู้ (เช่น ค่าน้ำมันขึ้น)</Label>
                  <Input
                    type="number"
                    value={formData.addon_price}
                    onChange={(e) => handlePriceUpdate(formData.price, e.target.value, formData.container_amount)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-emerald-800">ราคารวมเรียกเก็บลูกค้า (บาท) *</Label>
                  <Input
                    required
                    type="number"
                    value={formData.revenue}
                    onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                    className="font-bold text-emerald-700 text-sm"
                  />
                </div>
              </div>

              {/* 7. PAT Checkbox Auto-check */}
              <div className="pt-2 border-t">
                <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border bg-purple-50/50 hover:bg-purple-50">
                  <input
                    type="checkbox"
                    checked={formData.pat_letter_required}
                    onChange={(e) => setFormData({ ...formData, pat_letter_required: e.target.checked })}
                    className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-semibold text-purple-900 text-xs">
                      ทำจดหมายขอเปลี่ยนใบเสร็จการท่าเรือแห่งประเทศไทย (PAT Letter)
                    </span>
                    <p className="text-[11px] text-purple-700">
                      ระบบจะสร้างเอกสารขอใบกำกับภาษีถึงการท่าเรือฯ ในนามบริษัทลูกค้าให้อัตโนมัติในโมดูล Invoicing
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenOrderModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 gap-2">
                <CheckCircle2 className="h-4 w-4" />
                บันทึกคำสั่งงานขนส่ง
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
