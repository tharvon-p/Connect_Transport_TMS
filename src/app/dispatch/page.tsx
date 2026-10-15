'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Job, Vehicle, Driver, RateCard } from '@/types/database';
import { logActivity } from '@/lib/audit-logger';
import { useAuth } from '@/lib/auth-context';
import { SortableHeader, sortArray, SortState } from '@/components/ui/table-sort';
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
  Box,
  Copy,
  Check,
  Camera,
  Image as ImageIcon,
  Ship,
  Eye,
  AlertTriangle,
  FileSpreadsheet,
  Calendar,
  Anchor,
  Edit3,
  Phone,
  Search,
  Filter,
  ExternalLink,
  User
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

const jobTypeMap: Record<string, string> = {
  heavy_to_open: 'ลากตู้หนักไปเปิด (Import)',
  empty_to_stuff: 'ลากตู้เปล่าไปบรรจุ (Export)',
  empty_return: 'ลากตู้เปล่าคืน',
  yard_move: 'ย้ายลาน',
};

const vehicleTypeMap: Record<string, string> = {
  '4_wheel': 'รถ 4 ล้อ',
  '6_wheel': 'รถ 6 ล้อ',
  '10_wheel': 'รถ 10 ล้อ',
  trailer: 'รถเทรลเลอร์ (หัวลาก)',
  semi_trailer: 'รถกึ่งพ่วง',
};

const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  draft: { label: 'ฉบับร่าง', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
  assigned: { label: 'มอบหมายแล้ว', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_progress: { label: 'กำลังวิ่งงาน', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  completed: { label: 'เสร็จสิ้น', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'ยกเลิก', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' },
};

const formatCheckinTime = (isoString?: string | null) => {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  } catch {
    return isoString;
  }
};

const formatCheckinDateTime = (isoString?: string | null) => {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  } catch {
    return isoString;
  }
};

export default function DispatchPage() {
  const { currentUser, currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState('dispatch');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [openAssignModal, setOpenAssignModal] = useState(false);
  const [openCostModal, setOpenCostModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [openPhotoViewerModal, setOpenPhotoViewerModal] = useState(false);
  const [copiedLine, setCopiedLine] = useState(false);
  const [copiedDriverLink, setCopiedDriverLink] = useState(false);
  const copyDriverPortalLink = (driverId?: string) => {
    const id = driverId || tab3DriverId;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = id ? `${origin}/driver?d=${id}` : `${origin}/driver`;
    navigator.clipboard.writeText(url);
    setCopiedDriverLink(true);
    setTimeout(() => setCopiedDriverLink(false), 2500);
  };

  // Sorting State
  const [dispatchSort, setDispatchSort] = useState<SortState>({ key: 'job_no', direction: 'desc' });
  const handleSort = (key: string) => {
    setDispatchSort(prev => ({
      key,
      direction: prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc'
    }));
  };

  const sortedJobs = useMemo(() => {
    return sortArray(jobs, dispatchSort.key, dispatchSort.direction, (j) => {
      if (dispatchSort.key === 'customer') return j.customer?.company_name || '';
      if (dispatchSort.key === 'route') return `${j.pickup_place || j.origin?.name || ''} ${j.return_place || j.destination?.name || ''}`;
      if (dispatchSort.key === 'truck') return j.vehicle?.truck_name_id || j.truck_name_id || '';
      if (dispatchSort.key === 'driver') return j.driver?.name || '';
      if (dispatchSort.key === 'volume') return `${j.container_amount || 1}x${j.container_size || '40'}`;
      if (dispatchSort.key === 'profit') return Number(j.net_profit || 0);
      return (j as any)[dispatchSort.key];
    });
  }, [jobs, dispatchSort]);

  // Tab 2: Live CS Timeline Filter & Search State
  const [timelineStatusFilter, setTimelineStatusFilter] = useState<string>('active');
  const [timelineSearch, setTimelineSearch] = useState<string>('');

  const timelineCounts = useMemo(() => {
    const counts = {
      active: 0,
      all: jobs.length,
      in_progress: 0,
      assigned: 0,
      draft: 0,
      completed: 0,
      cancelled: 0,
    };
    jobs.forEach((j) => {
      if (j.status !== 'completed' && j.status !== 'cancelled') counts.active++;
      if (j.status === 'in_progress') counts.in_progress++;
      else if (j.status === 'assigned') counts.assigned++;
      else if (j.status === 'draft') counts.draft++;
      else if (j.status === 'completed') counts.completed++;
      else if (j.status === 'cancelled') counts.cancelled++;
    });
    return counts;
  }, [jobs]);

  const filteredTimelineJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 1. Status Filter (default: 'active' = all non-completed and non-cancelled)
      if (timelineStatusFilter === 'active') {
        if (job.status === 'completed' || job.status === 'cancelled') return false;
      } else if (timelineStatusFilter !== 'all') {
        if (job.status !== timelineStatusFilter) return false;
      }

      // 2. Search query filter
      if (timelineSearch.trim()) {
        const q = timelineSearch.toLowerCase().trim();
        const matchJobNo = job.job_no?.toLowerCase().includes(q);
        const matchCustomer = job.customer?.company_name?.toLowerCase().includes(q);
        const matchBooking = job.book_no?.toLowerCase().includes(q) || job.booking_no?.toLowerCase().includes(q);
        const matchBL = job.bl_no?.toLowerCase().includes(q);
        const matchTruck = (job.vehicle?.truck_name_id || '').toLowerCase().includes(q) || 
                           (job.vehicle?.plate_number || '').toLowerCase().includes(q) || 
                           (job.truck_name_id || '').toLowerCase().includes(q);
        const matchDriver = (job.driver?.name || '').toLowerCase().includes(q) || (job.driver?.phone || '').toLowerCase().includes(q);
        const matchContainer = (job.container_no || '').toLowerCase().includes(q);
        const matchSeal = (job.seal_no || '').toLowerCase().includes(q);
        const matchRoute = `${job.pickup_place || ''} ${job.packing_place || ''} ${job.return_place || ''}`.toLowerCase().includes(q);
        if (!matchJobNo && !matchCustomer && !matchBooking && !matchBL && !matchTruck && !matchDriver && !matchContainer && !matchSeal && !matchRoute) {
          return false;
        }
      }
      return true;
    });
  }, [jobs, timelineStatusFilter, timelineSearch]);

  // Assignment Form State (Truck auto-pairs with Driver)
  const [assignForm, setAssignForm] = useState({
    vehicle_id: '',
    truck_name_id: '',
    driver_id: '',
    driver_name: '',
    driver_phone: '',
    container_no: '',
    seal_no: '',
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

  // Tab 3: Driver Simulator View State (Dispatcher Preview Mode)
  const [tab3DriverId, setTab3DriverId] = useState<string>('');
  const [tab3DateFilter, setTab3DateFilter] = useState<'today' | 'tomorrow' | 'all'>('today');
  const [tab3StatusFilter, setTab3StatusFilter] = useState<'active' | 'completed' | 'all'>('active');

  const [tab3TodayStr, setTab3TodayStr] = useState<string>('');
  const [tab3TomorrowStr, setTab3TomorrowStr] = useState<string>('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().split('T')[0];
    setTab3TodayStr(today);
    setTab3TomorrowStr(tomorrow);
  }, []);

  const tab3DriverJobs = useMemo(() => {
    if (!tab3DriverId) return [];
    return jobs.filter(j => j.driver_id === tab3DriverId);
  }, [jobs, tab3DriverId]);

  const tab3Counts = useMemo(() => {
    const counts = {
      today: 0,
      tomorrow: 0,
      active: 0,
      completed: 0,
      all: tab3DriverJobs.length,
    };
    tab3DriverJobs.forEach(j => {
      const isAct = j.status !== 'completed' && j.status !== 'cancelled';
      if (isAct) counts.active++;
      if (j.status === 'completed') counts.completed++;
      if (j.job_date === tab3TodayStr) counts.today++;
      if (j.job_date === tab3TomorrowStr) counts.tomorrow++;
    });
    return counts;
  }, [tab3DriverJobs, tab3TodayStr, tab3TomorrowStr]);

  const filteredTab3Jobs = useMemo(() => {
    return tab3DriverJobs.filter(j => {
      // 1. Status Filter (default: 'active' - not completed / not cancelled)
      if (tab3StatusFilter === 'active') {
        if (j.status === 'completed' || j.status === 'cancelled') return false;
      } else if (tab3StatusFilter === 'completed') {
        if (j.status !== 'completed') return false;
      }

      // 2. Date Filter (default: 'today')
      if (tab3DateFilter === 'today') {
        if (j.job_date !== tab3TodayStr) return false;
      } else if (tab3DateFilter === 'tomorrow') {
        if (j.job_date !== tab3TomorrowStr) return false;
      }

      return true;
    });
  }, [tab3DriverJobs, tab3StatusFilter, tab3DateFilter, tab3TodayStr, tab3TomorrowStr]);

  // Driver App View State
  const [driverSelectedJobId, setDriverSelectedJobId] = useState<string>('');
  const [driverCurrentStep, setDriverCurrentStep] = useState<'step1' | 'step2' | 'step3'>('step1');
  const [driverAppForm, setDriverAppForm] = useState({
    container_no: '',
    seal_no: '',
    temperature: '',
    checkin_pickup: '',
    checkin_packing: '',
    checkin_return: '',
    driver_notes: '',
    
    // Checkpoint 1 photos (5 mandatory)
    photo_front: false,
    photo_floor: false,
    photo_left: false,
    photo_right: false,
    photo_back: false,
    photo_reefer_drain: false,
    photo_reefer_cable: false,
    photo_reefer_temp: false,
    photo_pickup_receipt: false,
    photo_pickup_eir: false,

    // Checkpoint 2 photos
    photo_sealed: false,
    photo_packing_temp: false,
    photo_packing_receipt: false,

    // Checkpoint 3 photos
    photo_return_front: false,
    photo_return_temp: false,
    photo_return_receipt: false,
    photo_return_eir: false,
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
        supabase.from('vehicles').select('*, driver:drivers(*)').eq('status', 'active'),
        supabase.from('drivers').select('*').order('name'),
      ]);

      if (jobsRes.data) {
        setJobs(jobsRes.data as Job[]);
      }
      if (vehRes.data) setVehicles(vehRes.data as Vehicle[]);
      if (drivRes.data && drivRes.data.length > 0) {
        setDrivers(drivRes.data as Driver[]);
        if (!tab3DriverId) {
          const firstWithJob = (jobsRes.data as Job[])?.find(j => j.driver_id)?.driver_id || drivRes.data[0].id;
          setTab3DriverId(firstWithJob);
        }
      }
    } catch (err) {
      console.error('Error fetching dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync selected job in Tab 3 simulator
  useEffect(() => {
    if (filteredTab3Jobs.length > 0) {
      const match = filteredTab3Jobs.find(j => j.id === driverSelectedJobId);
      if (!match) {
        setDriverSelectedJobId(filteredTab3Jobs[0].id);
        initDriverAppForm(filteredTab3Jobs[0]);
      }
    } else {
      setDriverSelectedJobId('');
    }
  }, [filteredTab3Jobs, driverSelectedJobId]);

  const initDriverAppForm = (job: Job) => {
    setDriverAppForm(prev => ({
      ...prev,
      container_no: job.container_no || '',
      seal_no: job.seal_no || '',
      temperature: job.temperature ? String(job.temperature) : '',
      checkin_pickup: job.checkin_location || '',
      driver_notes: job.driver_notes || '',
    }));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // -------------------------------------------------------------------
  // 1. DISPATCH ASSIGNMENT LOGIC (Truck auto-pairs with Driver)
  // -------------------------------------------------------------------
  const handleOpenAssign = (job: Job) => {
    setSelectedJob(job);

    // If job already has a vehicle
    const currentVeh = vehicles.find((v) => v.id === job.vehicle_id);
    const defaultVeh = currentVeh || vehicles[0];

    // Current assigned driver or paired driver
    const currentDriver = drivers.find(d => d.id === job.driver_id);
    const pairedDriver = defaultVeh?.driver || drivers.find(d => d.id === defaultVeh?.driver_id);
    const activeDriver = currentDriver || pairedDriver;

    setAssignForm({
      vehicle_id: defaultVeh?.id || '',
      truck_name_id: defaultVeh?.truck_name_id || '',
      driver_id: activeDriver?.id || defaultVeh?.driver_id || '',
      driver_name: activeDriver?.name || 'ยังไม่ผูกคนขับ',
      driver_phone: activeDriver?.phone || '',
      container_no: job.container_no || '',
      seal_no: job.seal_no || '',
      status: job.status === 'draft' ? 'assigned' : job.status,
    });

    setCopiedLine(false);
    setOpenAssignModal(true);
  };

  // When truck is chosen, auto-pair driver
  const handleVehicleChange = (vehId: string) => {
    const veh = vehicles.find((v) => v.id === vehId);
    const pairedDriver = veh?.driver || drivers.find(d => d.id === veh?.driver_id);

    setAssignForm(prev => ({
      ...prev,
      vehicle_id: vehId,
      truck_name_id: veh?.truck_name_id || '',
      driver_id: pairedDriver?.id || '',
      driver_name: pairedDriver?.name || 'ยังไม่ผูกคนขับประจำรถ',
      driver_phone: pairedDriver?.phone || '',
      status: prev.status === 'draft' ? 'assigned' : prev.status,
    }));
  };

  // When driver is manually chosen (e.g. relief driver)
  const handleDriverChange = (driverId: string) => {
    const d = drivers.find(drv => drv.id === driverId);
    setAssignForm(prev => ({
      ...prev,
      driver_id: driverId,
      driver_name: d?.name || '',
      driver_phone: d?.phone || '',
    }));
  };

  // Save Assignment
  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (selectedJob.status === 'completed') {
      alert('งานนี้เสร็จสิ้นส่งมอบตู้เรียบร้อยแล้ว ระบบล็อกข้อมูลเพื่อป้องกันการแก้ไขย้อนหลัง');
      return;
    }
    if (selectedJob.status === 'cancelled') {
      alert('งานนี้ถูกยกเลิกแล้ว ไม่สามารถแก้ไขข้อมูลการจ่ายรถได้');
      return;
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        vehicle_id: assignForm.vehicle_id,
        driver_id: assignForm.driver_id || null,
        container_no: assignForm.container_no ? assignForm.container_no.toUpperCase() : null,
        seal_no: assignForm.seal_no ? assignForm.seal_no.toUpperCase() : null,
        status: assignForm.status,
      })
      .eq('id', selectedJob.id);

    if (!error) {
      logActivity({
        user_id: currentUser?.id || 'sys',
        user_name: currentUser?.name || 'User',
        user_role: currentRole?.id || 'dispatcher',
        action: 'UPDATE',
        module: 'DISPATCH',
        description: `จ่ายงาน ${selectedJob.job_no}: มอบหมาย ${assignForm.truck_name_id} พขร. ${assignForm.driver_name}`,
      });
      setOpenAssignModal(false);
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการมอบหมายงาน: ' + error.message);
    }
  };

  // Generate LINE Message text for Driver
  const generateLineText = (job: Job | null) => {
    if (!job) return '';
    const veh = vehicles.find(v => v.id === assignForm.vehicle_id) || job.vehicle;
    const containerStr = assignForm.container_no || job.container_no;
    const sealStr = assignForm.seal_no || job.seal_no;
    const targetDriverId = assignForm.driver_id || job.driver_id;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const driverLink = targetDriverId ? `\n📲 แตะเพื่อเปิดดูงานและเช็คอินถ่ายรูปบนมือถือ:\n${origin}/driver?d=${targetDriverId}` : '';

    return `🚛 คำสั่งงานขนส่ง: ${job.job_no}
📅 วันที่วิ่งงาน: ${job.job_date}
🏢 ลูกค้า: ${job.customer?.company_name || 'ลูกค้าทั่วไป'}
🚢 สายเรือ: ${job.ship_line || '-'} | Booking: ${job.book_no || '-'}
📦 สเปกตู้: ${job.container_amount || 1}x${job.container_size || '40'}' ${job.container_type || 'HC'} | สินค้า: ${job.commodity_name || 'ทั่วไป'}
${containerStr ? `🔢 หมายเลขตู้ (Container No.): ${containerStr}\n` : ''}${sealStr ? `🔒 หมายเลขซีล (Seal No.): ${sealStr}\n` : ''}------------------------------------
📍 จุดที่ 1 (รับตู้): ${job.pickup_place || job.origin?.name || '-'} (${job.pickup_date || job.job_date})
📍 จุดที่ 2 (บรรจุสินค้า): ${job.packing_place || 'โรงงานลูกค้า'} (${job.packing_date || job.job_date})
📍 จุดที่ 3 (คืนตู้): ${job.return_place || job.destination?.name || '-'} (${job.return_date || job.job_date})
------------------------------------
🚛 รถ: ${veh?.truck_name_id || 'รถคัน-1'} (${veh?.plate_number || '-'})
👨‍✈️ พขร.: ${assignForm.driver_name || job.driver?.name || '-'} (${assignForm.driver_phone || job.driver?.phone || '-'})
${job.driver_notes ? `📝 หมายเหตุ/คำสั่งพิเศษ: ${job.driver_notes}\n` : ''}⚠️ พขร. กรุณาเช็คอินและถ่ายรูปตรวจสภาพตู้ 5 รูปผ่าน Driver App เมื่อถึงจุดรับตู้${driverLink}`;
  };

  const copyLineToClipboard = () => {
    const text = generateLineText(selectedJob);
    navigator.clipboard.writeText(text);
    setCopiedLine(true);
    setTimeout(() => setCopiedLine(false), 2500);
  };

  // -------------------------------------------------------------------
  // 2. COST CALCULATOR HANDLERS
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // 3. DRIVER MOBILE APP HANDLERS (3 Checkpoints + 5 Mandatory Photos)
  // -------------------------------------------------------------------
  const handleDriverCheckin = (point: 'pickup' | 'packing' | 'return') => {
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const locationName = point === 'pickup' 
      ? (selectedDriverJob?.pickup_place || selectedDriverJob?.origin?.name || 'จุดรับตู้')
      : point === 'packing' 
      ? (selectedDriverJob?.packing_place || 'จุดบรรจุสินค้า')
      : (selectedDriverJob?.return_place || selectedDriverJob?.destination?.name || 'จุดคืนตู้');

    if (point === 'pickup') {
      setDriverAppForm(prev => ({ ...prev, checkin_pickup: `📍 ถึง ${locationName} เวลา ${timeStr} น. (GPS: 13.7291, 100.5621)` }));
    } else if (point === 'packing') {
      setDriverAppForm(prev => ({ ...prev, checkin_packing: `📍 ถึง ${locationName} เวลา ${timeStr} น. (GPS: 14.1205, 100.6128)` }));
    } else {
      setDriverAppForm(prev => ({ ...prev, checkin_return: `📍 ถึง ${locationName} เวลา ${timeStr} น. (GPS: 13.7082, 100.5786)` }));
    }
  };

  const handleSaveDriverUpdate = async (isCompleting: boolean = false) => {
    if (!driverSelectedJobId) return;

    const payload: any = {
      container_no: driverAppForm.container_no,
      seal_no: driverAppForm.seal_no,
      temperature: driverAppForm.temperature ? parseFloat(driverAppForm.temperature) : null,
      checkin_location: driverAppForm.checkin_return || driverAppForm.checkin_packing || driverAppForm.checkin_pickup,
      checkin_time: new Date().toISOString(),
      driver_notes: driverAppForm.driver_notes,
      status: isCompleting ? 'completed' : 'in_progress',
    };

    const { error } = await supabase
      .from('jobs')
      .update(payload)
      .eq('id', driverSelectedJobId);

    if (!error) {
      alert(isCompleting ? '✅ ปิดงานและส่งมอบตู้สำเร็จเรียบร้อย!' : '💾 บันทึกข้อมูลและเช็คอินเรียบร้อย');
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const selectedDriverJob = jobs.find((j) => j.id === driverSelectedJobId);
  const isReefer = selectedDriverJob?.container_type === 'RH' || (selectedDriverJob?.container_type as string) === 'RF';

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
            การจ่ายงานและปฏิบัติการภาคสนาม (Dispatch & Operations)
          </h1>
          <p className="text-slate-500 text-sm">
            มอบหมายรถ (ผูกคนขับอัตโนมัติ), หน้าจอติดตามงานสด (Live CS Timeline 3 จุดตรวจ) และพอร์ทัล พขร. มือถือ (ตรวจตู้ 5 มุม)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรชข้อมูล
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-200 p-1 rounded-xl">
          <TabsTrigger value="dispatch" className="gap-2">
            <Truck className="h-4 w-4" />
            จัดการจ่ายรถ &amp; ปฏิบัติการ ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Eye className="h-4 w-4 text-blue-600" />
            หน้าจอติดตามงานสด (Live CS Timeline)
          </TabsTrigger>
          <TabsTrigger value="driver-app" className="gap-2">
            <Smartphone className="h-4 w-4 text-emerald-600" />
            พอร์ทัล พขร. มือถือ (Driver App ภาษาไทย 100%)
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: DISPATCH & OPERATIONS ================= */}
        <TabsContent value="dispatch">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">รายการคำสั่งงานสำหรับจ่ายรถ</CardTitle>
                <CardDescription>
                  เลือกรหัสรถย่อ (เช่น รถคัน-1) เพื่อดึงคนขับประจำรถทันที และคำนวณต้นทุน/กำไร
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/70 text-xs">
                      <SortableHeader title="Job ID" sortKey="job_no" currentSort={dispatchSort} onSort={handleSort} className="font-bold text-blue-900" />
                      <SortableHeader title="วันที่" sortKey="job_date" currentSort={dispatchSort} onSort={handleSort} />
                      <SortableHeader title="ลูกค้า / สายเรือ" sortKey="customer" currentSort={dispatchSort} onSort={handleSort} />
                      <SortableHeader title="เส้นทาง 3 จุด" sortKey="route" currentSort={dispatchSort} onSort={handleSort} />
                      <SortableHeader title="สเปกตู้" sortKey="volume" currentSort={dispatchSort} onSort={handleSort} align="center" />
                      <SortableHeader title="รถที่มอบหมาย" sortKey="truck" currentSort={dispatchSort} onSort={handleSort} className="text-blue-950" />
                      <SortableHeader title="พขร. ประจำรถ" sortKey="driver" currentSort={dispatchSort} onSort={handleSort} className="text-slate-900" />
                      <SortableHeader title="สถานะ" sortKey="status" currentSort={dispatchSort} onSort={handleSort} />
                      <SortableHeader title="ต้นทุน / กำไร" sortKey="profit" currentSort={dispatchSort} onSort={handleSort} align="right" />
                      <TableHead className="text-right">จัดการงาน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedJobs.map((j) => (
                      <TableRow key={j.id} className="hover:bg-slate-50/80 text-xs">
                        <TableCell className="font-bold text-blue-700 font-mono">{j.job_no}</TableCell>
                        <TableCell className="text-slate-600">{j.job_date}</TableCell>
                        <TableCell className="max-w-[150px]">
                          <div className="font-bold text-slate-900 truncate">{j.customer?.company_name}</div>
                          <div className="text-[11px] text-blue-700 font-medium">{j.ship_line || '-'}</div>
                        </TableCell>
                        <TableCell className="max-w-[180px] text-[11px]">
                          <div className="truncate"><span className="text-slate-400">1:</span> {j.pickup_place || j.origin?.name || '-'}</div>
                          <div className="truncate font-semibold text-blue-900"><span className="text-slate-400">3:</span> {j.return_place || j.destination?.name || '-'}</div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold">
                          {j.container_amount || 1}x{j.container_size}&apos; {j.container_type}
                        </TableCell>
                        <TableCell>
                          {j.vehicle ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold font-mono">
                              {j.vehicle.truck_name_id || j.vehicle.plate_number}
                            </span>
                          ) : (
                            <span className="text-rose-600 font-semibold italic">ยังไม่จ่ายรถ</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {j.driver ? (
                            <div>
                              <div className="font-semibold text-slate-900">{j.driver.name}</div>
                              <div className="text-slate-500 text-[10px]">{j.driver.phone || '-'}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig[j.status]?.badgeClass || ''}>
                            {statusConfig[j.status]?.label || j.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-emerald-700">กำไร ฿{Number(j.net_profit || 0).toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500">ทุน ฿{Number(j.total_cost || 0).toLocaleString()}</div>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {j.status === 'draft' ? (
                              <Button
                                size="sm"
                                onClick={() => handleOpenAssign(j)}
                                className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                                title="จ่ายงานและเลือกรถ+พขร."
                              >
                                <Truck className="h-3.5 w-3.5" />
                                จ่ายรถ
                              </Button>
                            ) : j.status === 'assigned' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAssign(j)}
                                className="h-8 text-xs gap-1 text-blue-800 border-blue-300 bg-blue-50/60 hover:bg-blue-100 font-semibold"
                                title="แก้ไขการจัดรถหรือเปลี่ยน พขร. ก่อนวิ่งงาน"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-blue-600" />
                                แก้ไขจัดรถ
                              </Button>
                            ) : j.status === 'in_progress' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAssign(j)}
                                className="h-8 text-xs gap-1 text-amber-800 border-amber-300 bg-amber-50/60 hover:bg-amber-100 font-semibold"
                                title="งานกำลังวิ่ง - เปลี่ยนรถ/พขร. กรณีฉุกเฉิน"
                              >
                                <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
                                สลับรถวิ่ง
                              </Button>
                            ) : j.status === 'completed' ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenAssign(j)}
                                className="h-8 text-xs gap-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-semibold"
                                title="งานเสร็จสิ้นส่งมอบแล้ว (ข้อมูลถูกล็อก - ดูข้อมูลรถเท่านั้น)"
                              >
                                <Lock className="h-3.5 w-3.5 text-emerald-600" />
                                ดูข้อมูลรถ (ล็อก)
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic px-2 py-1">
                                ยกเลิกแล้ว
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenCost(j)}
                              className="h-8 text-xs gap-1 text-slate-700 border-slate-300"
                            >
                              <Calculator className="h-3.5 w-3.5" />
                              ต้นทุน
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedJob(j);
                                setOpenPrintModal(true);
                              }}
                              className="h-8 text-xs gap-1 text-slate-600"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 2: LIVE CS TIMELINE MONITORING ================= */}
        <TabsContent value="timeline" className="space-y-6">
          {/* Header & Filter Control Bar */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
                    <Eye className="h-6 w-6 text-blue-600" />
                    หน้าจอติดตามงานสด 3 จุดตรวจ (Live Operations &amp; CS Monitoring)
                  </h2>
                  <p className="text-slate-500 text-xs md:text-sm mt-0.5">
                    สำหรับฝ่าย CS และผู้ควบคุมงานติดตามสถานะงานสด: กำหนดการ 3 จุดตรวจ, รถ + พขร. ที่รับผิดชอบ, เวลาเช็คอิน, และพิกัด GPS
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    className="gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    รีเฟรชข้อมูลสด
                  </Button>
                </div>
              </div>

              {/* Filters & Search Row */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Filter className="h-3.5 w-3.5 text-blue-600" />
                    กรองสถานะ:
                  </span>

                  {/* Primary Dropdown */}
                  <select
                    className="border-2 border-blue-300 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs md:text-sm font-bold bg-white text-slate-900 shadow-xs cursor-pointer"
                    value={timelineStatusFilter}
                    onChange={(e) => setTimelineStatusFilter(e.target.value)}
                  >
                    <option value="active">⚡ กำลังติดตามงาน (ยังไม่เสร็จสิ้น) ({timelineCounts.active})</option>
                    <option value="all">📁 ทุกสถานะงานทั้งหมด ({timelineCounts.all})</option>
                    <option value="in_progress">🚛 กำลังวิ่งงาน (In Progress) ({timelineCounts.in_progress})</option>
                    <option value="assigned">📋 มอบหมายแล้ว (Assigned) ({timelineCounts.assigned})</option>
                    <option value="draft">📝 ฉบับร่าง / รอจ่ายรถ (Draft) ({timelineCounts.draft})</option>
                    <option value="completed">✅ เสร็จสิ้นส่งมอบแล้ว (Completed) ({timelineCounts.completed})</option>
                    <option value="cancelled">⛔ ยกเลิกแล้ว (Cancelled) ({timelineCounts.cancelled})</option>
                  </select>

                  {/* Quick Filter Pill Buttons */}
                  <div className="hidden sm:flex items-center gap-1.5 ml-1">
                    <button
                      type="button"
                      onClick={() => setTimelineStatusFilter('active')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                        timelineStatusFilter === 'active'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      กำลังติดตาม ({timelineCounts.active})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineStatusFilter('in_progress')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                        timelineStatusFilter === 'in_progress'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      กำลังวิ่ง ({timelineCounts.in_progress})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineStatusFilter('assigned')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                        timelineStatusFilter === 'assigned'
                          ? 'bg-blue-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      มอบหมายแล้ว ({timelineCounts.assigned})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineStatusFilter('all')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                        timelineStatusFilter === 'all'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      ทั้งหมด ({timelineCounts.all})
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="ค้นหา Job, รถ, พขร, ตู้..."
                      className="pl-9 pr-8 h-9 text-xs rounded-xl bg-slate-50 border-slate-300"
                      value={timelineSearch}
                      onChange={(e) => setTimelineSearch(e.target.value)}
                    />
                    {timelineSearch && (
                      <button
                        type="button"
                        onClick={() => setTimelineSearch('')}
                        className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                    พบ {filteredTimelineJobs.length} รายการ
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards List */}
          {filteredTimelineJobs.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-300 p-12 text-center bg-white rounded-2xl">
              <Eye className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">ไม่พบรายการงานตามเงื่อนไขที่เลือก</h3>
              <p className="text-xs text-slate-500 mt-1">
                {timelineStatusFilter === 'active'
                  ? 'ปัจจุบันไม่มีงานที่อยู่ระหว่างติดตาม (เสร็จสิ้นหรือยกเลิกหมดแล้ว)'
                  : 'ไม่พบงานที่ตรงกับคำค้นหาหรือตัวกรองที่กำหนด'}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTimelineStatusFilter('all');
                    setTimelineSearch('');
                  }}
                  className="text-xs font-bold"
                >
                  แสดงงานทั้งหมด ({jobs.length})
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-5">
              {filteredTimelineJobs.map((job) => {
                const isAssigned = Boolean(job.vehicle_id || job.vehicle || job.truck_name_id);
                const isReeferJob = job.container_type === 'RH' || (job.container_type as string) === 'RF' || job.container_type === 'Reefer';
                const isCompleted = job.status === 'completed';
                const isInProgress = job.status === 'in_progress';

                return (
                  <div
                    key={job.id}
                    className={`border-2 rounded-2xl p-5 md:p-6 bg-white shadow-sm hover:shadow-md transition-all space-y-4 ${
                      isInProgress 
                        ? 'border-amber-300 ring-2 ring-amber-100' 
                        : job.status === 'assigned'
                        ? 'border-blue-300 ring-2 ring-blue-50'
                        : isCompleted
                        ? 'border-emerald-200'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Top Row: Job Meta & Prominent Truck + Driver */}
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between pb-4 border-b border-slate-100 gap-4">
                      {/* Left: Job Identification */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono font-black text-lg md:text-xl text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-xl border border-blue-200 shadow-xs flex items-center gap-1.5">
                            {job.job_no}
                          </span>
                          <Badge variant="outline" className={`${statusConfig[job.status]?.badgeClass || ''} text-xs md:text-sm px-3 py-1 font-bold rounded-lg shadow-xs`}>
                            {statusConfig[job.status]?.label || job.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-300 font-semibold px-2.5 py-1">
                            {jobTypeMap[job.job_type] || job.job_type}
                          </Badge>
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            วันที่เปิดงาน: <strong className="font-mono text-slate-900">{job.job_date}</strong>
                          </span>
                        </div>

                        <div>
                          <div className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                            <span>{job.customer?.company_name || 'ลูกค้าทั่วไป'}</span>
                            {job.customer?.branch && (
                              <span className="text-xs font-normal text-slate-500">({job.customer.branch})</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
                            <span>สายเรือ: <strong className="text-slate-900 font-bold">{job.ship_line || '-'}</strong></span>
                            <span>Booking: <strong className="font-mono text-slate-900 font-bold">{job.book_no || '-'}</strong></span>
                            {job.bl_no && <span>B/L: <strong className="font-mono text-slate-900 font-bold">{job.bl_no}</strong></span>}
                            <span>สเปกตู้: <strong className="font-mono text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{job.container_amount || 1}x{job.container_size}&apos; {job.container_type}</strong></span>
                            {job.commodity_name && <span>สินค้า: <strong className="text-slate-900 font-medium">{job.commodity_name}</strong></span>}
                          </div>
                        </div>
                      </div>

                      {/* Right: Prominent Truck & Driver Box */}
                      <div className="lg:w-80 shrink-0">
                        {isAssigned ? (
                          <div className="bg-gradient-to-br from-blue-50/60 to-emerald-50/40 border-2 border-emerald-200/90 rounded-2xl p-3.5 shadow-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                                <Truck className="h-4 w-4 text-emerald-600" />
                                รถ + พขร. ที่รับผิดชอบ
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-100/50 px-2 font-bold"
                                onClick={() => handleOpenAssign(job)}
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                {isCompleted ? 'ดูข้อมูล' : 'ปรับเปลี่ยน'}
                              </Button>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <div className="font-black text-slate-900 text-sm md:text-base">
                                {job.vehicle?.truck_name_id || job.truck_name_id || 'รถบรรทุก'}
                              </div>
                              {job.vehicle?.plate_number && (
                                <Badge variant="outline" className="font-mono font-black text-xs bg-white text-slate-900 border-slate-300 shadow-xs px-2 py-0.5">
                                  {job.vehicle.plate_number}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-200/60">
                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                                <span>{job.driver?.name || 'พขร.'}</span>
                              </div>
                              {job.driver?.phone ? (
                                <a 
                                  href={`tel:${job.driver.phone}`} 
                                  className="text-emerald-700 hover:text-emerald-800 font-mono font-bold flex items-center gap-1 text-xs hover:underline bg-white px-2 py-0.5 rounded border border-emerald-200"
                                  title="โทรหา พขร."
                                >
                                  <Phone className="h-3 w-3" />
                                  {job.driver.phone}
                                </a>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-amber-50/90 border-2 border-dashed border-amber-300 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between space-y-2.5">
                            <div className="flex items-start gap-2 text-amber-900 font-bold text-xs">
                              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <div>ยังไม่ได้จัดสรร รถ + คนขับ</div>
                                <div className="text-[11px] font-normal text-amber-700">จำเป็นต้องจ่ายรถเพื่อให้เริ่มวิ่งงานได้</div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-xl gap-1.5 shadow-xs"
                              onClick={() => handleOpenAssign(job)}
                            >
                              <Truck className="h-4 w-4" />
                              จ่ายรถและมอบหมายงาน
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3 Step Visual Route Progress */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
                      {/* ================= STEP 1: PICKUP ================= */}
                      <div className={`p-4 rounded-xl border-2 space-y-3 transition-all ${
                        job.status !== 'draft' 
                          ? 'bg-blue-50/50 border-blue-200 shadow-xs' 
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 font-black text-sm text-blue-950">
                          <span className="flex items-center gap-1.5">
                            <span className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-mono">1</span>
                            รับตู้ (Pickup)
                          </span>
                          {job.status !== 'draft' ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              {isInProgress || isCompleted ? 'ตรวจรับแล้ว' : 'มอบหมายแล้ว'}
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500">รอจ่ายงาน</span>
                          )}
                        </div>

                        {/* Appointment Date */}
                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-blue-200/80 text-xs md:text-sm font-bold text-blue-950">
                          <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                          <span className="text-slate-600 font-semibold">วันนัดรับตู้:</span>
                          <span className="font-mono text-blue-800 font-black">{job.pickup_date || job.job_date || '-'}</span>
                        </div>

                        {/* Location */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">สถานที่รับตู้:</div>
                          <div className="flex items-start gap-1.5 font-bold text-slate-900 text-sm">
                            <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <span className="break-words">{job.pickup_place || job.origin?.name || 'ลานตู้คอนเทนเนอร์'}</span>
                          </div>
                        </div>

                        {/* Container Number */}
                        <div className="flex items-center justify-between text-xs bg-white/90 p-2 rounded-lg border border-blue-100">
                          <span className="text-slate-600 font-semibold flex items-center gap-1">
                            <Box className="h-3.5 w-3.5 text-blue-600" />
                            เบอร์ตู้:
                          </span>
                          <strong className="font-mono text-xs md:text-sm font-black text-slate-900">
                            {job.container_no || 'รอ พขร. ตรวจรับ'}
                          </strong>
                        </div>

                        {/* Check-in & Timestamp */}
                        {job.checkin_time || job.checkin_location || isInProgress || isCompleted ? (
                          <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-lg space-y-1 text-xs">
                            <div className="flex items-center justify-between font-bold text-emerald-950">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                เช็คอินจุดรับตู้เรียบร้อย
                              </span>
                              <span className="font-mono text-[11px] font-black text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                                {formatCheckinTime(job.checkin_time) || 'บันทึกเวลาแล้ว'}
                              </span>
                            </div>
                            {job.checkin_location && (
                              <div className="text-[11px] text-emerald-800 font-medium break-words pt-0.5">
                                {job.checkin_location}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 bg-slate-100/80 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>รอ พขร. เดินทางถึงและกดเช็คอิน</span>
                          </div>
                        )}

                        {/* Proof & Inspections Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <Badge variant="outline" className="text-[10px] md:text-xs bg-white text-emerald-800 border-emerald-300 font-semibold shadow-2xs">
                            📸 ตรวจสภาพตู้ 5 มุม
                          </Badge>
                          <Badge variant="outline" className="text-[10px] md:text-xs bg-white text-blue-700 border-blue-300 font-semibold shadow-2xs">
                            📄 ใบกำกับ EIR
                          </Badge>
                        </div>
                      </div>

                      {/* ================= STEP 2: PACKING ================= */}
                      <div className={`p-4 rounded-xl border-2 space-y-3 transition-all ${
                        isInProgress || isCompleted 
                          ? 'bg-amber-50/50 border-amber-200 shadow-xs' 
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 font-black text-sm text-amber-950">
                          <span className="flex items-center gap-1.5">
                            <span className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-mono">2</span>
                            บรรจุสินค้า (Packing)
                          </span>
                          {isInProgress ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                              กำลังดำเนินการ
                            </span>
                          ) : isCompleted ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              บรรจุเสร็จสิ้น
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500">รอเข้าบรรจุ</span>
                          )}
                        </div>

                        {/* Appointment Date */}
                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200/80 text-xs md:text-sm font-bold text-amber-950">
                          <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="text-slate-600 font-semibold">วันนัดบรรจุ:</span>
                          <span className="font-mono text-amber-800 font-black">{job.packing_date || job.job_date || '-'}</span>
                        </div>

                        {/* Location */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">สถานที่บรรจุ:</div>
                          <div className="flex items-start gap-1.5 font-bold text-slate-900 text-sm">
                            <MapPin className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <span className="break-words">{job.packing_place || 'โรงงานลูกค้า'}</span>
                          </div>
                        </div>

                        {/* Seal Number & Reefer Temp */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs bg-white/90 p-2 rounded-lg border border-amber-100">
                            <span className="text-slate-600 font-semibold flex items-center gap-1">
                              <Lock className="h-3.5 w-3.5 text-amber-600" />
                              เบอร์ซีล:
                            </span>
                            <strong className="font-mono text-xs md:text-sm font-black text-slate-900">
                              {job.seal_no || 'รอซีลหลังบรรจุเสร็จ'}
                            </strong>
                          </div>

                          {isReeferJob && (
                            <div className="flex items-center justify-between text-xs bg-blue-50 p-2 rounded-lg border border-blue-200">
                              <span className="text-blue-900 font-bold flex items-center gap-1">
                                <Thermometer className="h-3.5 w-3.5 text-blue-600" />
                                อุณหภูมิตู้เย็น:
                              </span>
                              <strong className="font-mono font-bold text-blue-800">
                                {job.temperature !== null ? `${job.temperature} °C` : '-18.5 °C'}
                              </strong>
                            </div>
                          )}
                        </div>

                        {/* Check-in & Status */}
                        {isCompleted ? (
                          <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-lg space-y-1 text-xs">
                            <div className="flex items-center justify-between font-bold text-emerald-950">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                บรรจุและล็อคซีลเสร็จสิ้น
                              </span>
                              <span className="font-mono text-[11px] font-black text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                                สำเร็จ
                              </span>
                            </div>
                          </div>
                        ) : isInProgress ? (
                          <div className="p-2.5 bg-amber-100/70 border border-amber-300 rounded-lg space-y-1 text-xs">
                            <div className="flex items-center justify-between font-bold text-amber-950">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                                ถึงโรงงาน / กำลังบรรจุ
                              </span>
                              <span className="font-mono text-[11px] font-black text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-300">
                                In Progress
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 bg-slate-100/80 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>รอขบวนรถเดินทางเข้าโรงงานบรรจุ</span>
                          </div>
                        )}

                        {/* Proof & Inspections Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <Badge variant="outline" className="text-[10px] md:text-xs bg-white text-slate-700 border-slate-300 font-semibold shadow-2xs">
                            🔒 ล็อคซีลเรียบร้อย
                          </Badge>
                          {isReeferJob && (
                            <Badge variant="outline" className="text-[10px] md:text-xs bg-blue-100 text-blue-800 border-blue-300 font-mono font-bold shadow-2xs">
                              ❄️ ควบคุมอุณหภูมิ
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* ================= STEP 3: RETURN ================= */}
                      <div className={`p-4 rounded-xl border-2 space-y-3 transition-all ${
                        isCompleted 
                          ? 'bg-emerald-50/50 border-emerald-200 shadow-xs' 
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 font-black text-sm text-emerald-950">
                          <span className="flex items-center gap-1.5">
                            <span className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-mono">3</span>
                            คืนตู้ / เข้าท่า (Return)
                          </span>
                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ส่งมอบสำเร็จ
                            </span>
                          ) : isInProgress ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                              <Truck className="h-3 w-3 text-blue-600" />
                              กำลังเดินทาง
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500">รอส่งมอบตู้</span>
                          )}
                        </div>

                        {/* Appointment Date */}
                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-emerald-200/80 text-xs md:text-sm font-bold text-emerald-950">
                          <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-slate-600 font-semibold">วันนัดคืนตู้:</span>
                          <span className="font-mono text-emerald-800 font-black">{job.return_date || job.job_date || '-'}</span>
                        </div>

                        {/* Location */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">สถานที่คืนตู้:</div>
                          <div className="flex items-start gap-1.5 font-bold text-slate-900 text-sm">
                            <Anchor className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="break-words">{job.return_place || job.destination?.name || 'ท่าเรือ / ลานคืนตู้'}</span>
                          </div>
                        </div>

                        {/* Terminal Destination */}
                        <div className="text-xs text-slate-700 bg-white/90 p-2 rounded-lg border border-emerald-100 flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">ปลายทาง:</span>
                          <strong className="text-purple-900 font-bold font-mono">
                            {job.return_place?.includes('PAT') || job.destination?.name?.includes('คลองเตย')
                              ? 'ท่าเรือกรุงเทพ คลองเตย (PAT)'
                              : 'ท่าเรือแหลมฉบัง (LCB)'}
                          </strong>
                        </div>

                        {/* Check-in & Status */}
                        {isCompleted ? (
                          <div className="p-2.5 bg-emerald-100/80 border border-emerald-300 rounded-lg space-y-1 text-xs">
                            <div className="flex items-center justify-between font-bold text-emerald-950">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                คืนตู้และปิดงานเสร็จสิ้นสมบูรณ์
                              </span>
                              <span className="font-mono text-[11px] font-black text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                                {formatCheckinTime(job.checkin_time) || 'เรียบร้อย'}
                              </span>
                            </div>
                            <div className="text-[11px] text-emerald-800 font-medium">
                              ✅ ส่งมอบตู้และตรวจรับเอกสารครบถ้วน
                            </div>
                          </div>
                        ) : isInProgress ? (
                          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-blue-600 animate-pulse shrink-0" />
                            <span>กำลังเดินทางมุ่งหน้าสู่ท่าเรือ / ลานคืนตู้</span>
                          </div>
                        ) : (
                          <div className="p-2 bg-slate-100/80 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>รอส่งมอบตู้ที่ปลายทาง</span>
                          </div>
                        )}

                        {/* Proof & Inspections Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <Badge variant="outline" className="text-[10px] md:text-xs bg-white text-slate-700 border-slate-300 font-semibold shadow-2xs">
                            🧾 สลิปคืนตู้
                          </Badge>
                          <Badge variant="outline" className="text-[10px] md:text-xs bg-white text-emerald-800 border-emerald-300 font-semibold shadow-2xs">
                            📄 EIR คืนตู้
                          </Badge>
                          {job.pat_letter_required && (
                            <Badge variant="outline" className="text-[10px] md:text-xs bg-purple-100 text-purple-800 border-purple-200 font-semibold shadow-2xs">
                              จดหมาย PAT พร้อม
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Driver Notes (if any) */}
                    {job.driver_notes && (
                      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold">หมายเหตุหน้างาน / คำสั่งพิเศษ:</strong> {job.driver_notes}
                        </div>
                      </div>
                    )}

                    {/* Card Action Bar */}
                    <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 gap-2">
                      <div className="text-xs text-slate-500">
                        อัปเดตล่าสุด: <span className="font-mono font-semibold text-slate-700">{formatCheckinDateTime(job.updated_at || job.created_at)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-bold gap-1 text-slate-700 bg-white hover:bg-slate-50"
                          onClick={() => {
                            setSelectedJob(job);
                            setOpenPrintModal(true);
                          }}
                        >
                          <Printer className="h-3.5 w-3.5 text-slate-500" />
                          พิมพ์ใบสั่งงาน พขร.
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-bold gap-1 text-slate-700 bg-white hover:bg-slate-50"
                          onClick={() => {
                            setSelectedJob(job);
                            copyLineToClipboard();
                          }}
                        >
                          <Send className="h-3.5 w-3.5 text-blue-600" />
                          คัดลอกข้อความ LINE
                        </Button>

                        <Button
                          size="sm"
                          className="h-8 text-xs font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => handleOpenAssign(job)}
                        >
                          {job.status === 'completed' ? (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              ดูข้อมูลรถ (เสร็จสิ้น)
                            </>
                          ) : (
                            <>
                              <Truck className="h-3.5 w-3.5" />
                              {job.status === 'draft' ? 'จ่ายรถและมอบหมาย' : 'จัดการ / แก้ไขจัดรถ'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ================= TAB 3: DRIVER MOBILE WEB APP ================= */}
        <TabsContent value="driver-app">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Dispatcher Simulator Control Bar */}
            <Card className="border-2 border-emerald-500 shadow-md rounded-2xl bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase font-bold tracking-wider text-emerald-100 flex items-center gap-1.5">
                      <Truck className="h-4 w-4" />
                      Connect Transport Driver Portal Simulator
                    </div>
                    <h2 className="text-lg md:text-xl font-black mt-0.5">พอร์ทัล พขร. ภาคสนาม (โหมดจำลองมุมมอง)</h2>
                    <p className="text-xs text-emerald-100 mt-0.5">
                      ระบบจำลองหน้าจอมือถือจริง: พขร. แต่ละคนจะเห็นเฉพาะงานที่ได้รับมอบหมาย วันนี้ และงานที่ต้องทำ
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(tab3DriverId ? `/driver?d=${tab3DriverId}` : '/driver', '_blank')}
                      className="bg-white text-emerald-900 border-white hover:bg-emerald-50 font-bold text-xs gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-emerald-700" />
                      เปิดบนมือถือเต็มจอ (/driver)
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => copyDriverPortalLink(tab3DriverId)}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs gap-1.5 shadow-sm"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {copiedDriverLink ? 'คัดลอกลิงก์ LINE แล้ว!' : 'คัดลอกลิงก์ส่ง LINE'}
                    </Button>
                  </div>
                </div>

                {/* Driver Selector & Filters */}
                <div className="mt-4 pt-3 border-t border-emerald-500/60 space-y-3 text-slate-900">
                  {/* 1. Driver Selector */}
                  <div className="bg-white p-3 rounded-xl border border-emerald-300 space-y-1.5 shadow-xs">
                    <Label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-emerald-600" />
                      เลือกคนขับเพื่อจำลองมุมมอง (Driver Profile):
                    </Label>
                    <select
                      className="w-full border-2 border-emerald-400 focus:border-emerald-600 rounded-xl p-2.5 text-sm font-black bg-emerald-50/50 text-slate-900"
                      value={tab3DriverId}
                      onChange={(e) => setTab3DriverId(e.target.value)}
                    >
                      {drivers.map(d => {
                        const pairedVeh = vehicles.find(v => v.driver_id === d.id || (v as any).paired_driver_id === d.id);
                        return (
                          <option key={d.id} value={d.id}>
                            พขร. {d.name} {pairedVeh ? `[${pairedVeh.truck_name_id || pairedVeh.plate_number}]` : ''} - โทร {d.phone || '-'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* 2. Date Filter & Status Filter Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Date Pills (Default: วันนี้) */}
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-300 space-y-1">
                      <div className="text-[11px] font-bold text-slate-600">กรองวันที่ (Default: วันนี้):</div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setTab3DateFilter('today')}
                          className={`flex-1 py-1.5 rounded-lg font-black transition-all ${
                            tab3DateFilter === 'today'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          📅 วันนี้ ({tab3Counts.today})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab3DateFilter('tomorrow')}
                          className={`flex-1 py-1.5 rounded-lg font-black transition-all ${
                            tab3DateFilter === 'tomorrow'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          พรุ่งนี้ ({tab3Counts.tomorrow})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab3DateFilter('all')}
                          className={`flex-1 py-1.5 rounded-lg font-black transition-all ${
                            tab3DateFilter === 'all'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          ทุกวัน ({tab3Counts.all})
                        </button>
                      </div>
                    </div>

                    {/* Status Pills (Default: งานที่ต้องทำ) */}
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-300 space-y-1">
                      <div className="text-[11px] font-bold text-slate-600">สถานะงาน (Default: งานที่ต้องทำ):</div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setTab3StatusFilter('active')}
                          className={`flex-1 py-1.5 rounded-lg font-black transition-all ${
                            tab3StatusFilter === 'active'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          🚛 ต้องทำ ({tab3Counts.active})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab3StatusFilter('completed')}
                          className={`flex-1 py-1.5 rounded-lg font-black transition-all ${
                            tab3StatusFilter === 'completed'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          ✅ เสร็จแล้ว ({tab3Counts.completed})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab3StatusFilter('all')}
                          className={`flex-1 py-1.5 rounded-lg font-black transition-all ${
                            tab3StatusFilter === 'all'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          ทั้งหมด ({tab3Counts.all})
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Area of Simulated Driver View */}
              <CardContent className="p-4 md:p-6 space-y-4 bg-slate-50">
                {filteredTab3Jobs.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-slate-300 space-y-3">
                    <Truck className="h-12 w-12 text-slate-300 mx-auto" />
                    <h3 className="text-base font-black text-slate-800">
                      {tab3DateFilter === 'today'
                        ? 'วันนี้ไม่มีงานมอบหมายให้ พขร. คนนี้'
                        : 'ไม่พบงานของ พขร. คนนี้ตามเงื่อนไขที่เลือก'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      ระบบจะแสดงเฉพาะงานที่มอบหมายให้ พขร. ท่านนี้เท่านั้น ไม่ปะปนกับงานของคนอื่น
                    </p>
                    <div className="pt-2 flex justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTab3DateFilter('all');
                          setTab3StatusFilter('all');
                        }}
                        className="rounded-xl font-bold text-xs"
                      >
                        แสดงงานทุกวันของคนขับคนนี้ ({tab3DriverJobs.length})
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Job Picker (Filtered ONLY for this driver) */}
                    <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-1.5">
                      <Label className="text-xs md:text-sm font-black text-slate-800 flex items-center justify-between">
                        <span>เลือกเที่ยววิ่งของ พขร. (เฉพาะงานตัวเอง):</span>
                        <span className="text-xs font-semibold text-blue-700">พบ {filteredTab3Jobs.length} งาน</span>
                      </Label>
                      <select
                        className="w-full border-2 border-slate-300 focus:border-blue-500 rounded-xl p-3 text-sm md:text-base font-black bg-slate-50"
                        value={driverSelectedJobId}
                        onChange={(e) => {
                          setDriverSelectedJobId(e.target.value);
                          const j = jobs.find(job => job.id === e.target.value);
                          if (j) initDriverAppForm(j);
                        }}
                      >
                        {filteredTab3Jobs.map(j => (
                          <option key={j.id} value={j.id}>
                            {j.job_no} [{j.job_date}] - {j.customer?.company_name} ({j.container_size}&apos; {j.container_type}) - สถานะ: {statusConfig[j.status]?.label || j.status}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Job Card Banner */}
                    {selectedDriverJob && (
                      <div className="p-4 bg-white rounded-2xl space-y-2 text-xs md:text-sm border-2 border-slate-200 shadow-xs">
                        <div className="flex justify-between items-center font-black">
                          <span className="text-blue-700 font-mono text-base bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            {selectedDriverJob.job_no}
                          </span>
                          <span className="text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                            📅 {selectedDriverJob.job_date}
                          </span>
                        </div>
                        <div className="font-black text-base text-slate-900">{selectedDriverJob.customer?.company_name}</div>
                        <div className="text-slate-600 text-xs flex flex-wrap gap-x-3 gap-y-1">
                          <span>สายเรือ: <strong>{selectedDriverJob.ship_line || '-'}</strong></span>
                          <span>Booking: <strong className="font-mono">{selectedDriverJob.book_no || '-'}</strong></span>
                          <span>สเปกตู้: <strong className="font-mono text-blue-800">{selectedDriverJob.container_amount || 1}x{selectedDriverJob.container_size}&apos; {selectedDriverJob.container_type}</strong></span>
                        </div>
                      </div>
                    )}

                    {/* 3 Step Tabs for Driver */}
                    <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-200 rounded-2xl text-center text-xs md:text-sm font-black">
                      <button
                        type="button"
                        onClick={() => setDriverCurrentStep('step1')}
                        className={`py-2.5 rounded-xl transition-all ${
                          driverCurrentStep === 'step1' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        1. รับตู้
                      </button>
                      <button
                        type="button"
                        onClick={() => setDriverCurrentStep('step2')}
                        className={`py-2.5 rounded-xl transition-all ${
                          driverCurrentStep === 'step2' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        2. บรรจุ
                      </button>
                      <button
                        type="button"
                        onClick={() => setDriverCurrentStep('step3')}
                        className={`py-2.5 rounded-xl transition-all ${
                          driverCurrentStep === 'step3' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        3. คืนตู้
                      </button>
                    </div>

                    {/* STEP 1: PICKUP */}
                    {driverCurrentStep === 'step1' && (
                      <div className="bg-white p-4 rounded-2xl border-2 border-blue-200 space-y-3">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                          <div className="font-black text-blue-900 text-xs md:text-sm">
                            จุดที่ 1: {selectedDriverJob?.pickup_place || selectedDriverJob?.origin?.name || 'สถานที่รับตู้'}
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleDriverCheckin('pickup')}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-12 text-sm md:text-base rounded-xl gap-2 shadow-md"
                          >
                            <MapPin className="h-5 w-5" />
                            กดเช็คอินจุดรับตู้ (บันทึกเวลา + GPS)
                          </Button>
                          {driverAppForm.checkin_pickup && (
                            <p className="text-xs text-emerald-700 font-bold">{driverAppForm.checkin_pickup}</p>
                          )}
                        </div>

                        {/* Mandatory 5 Photos Checklist */}
                        <div className="p-3 bg-slate-50 border rounded-xl space-y-2">
                          <div className="font-black text-slate-900 text-xs md:text-sm flex items-center justify-between">
                            <span>📸 ถ่ายรูปตรวจสภาพตู้ 5 รูป (บังคับ):</span>
                            <span className="text-rose-600 font-bold text-xs">* บังคับทุกมุม</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                              { key: 'photo_front', label: '1. ด้านหน้าตู้' },
                              { key: 'photo_floor', label: '2. พื้นตู้ภายใน' },
                              { key: 'photo_left', label: '3. ด้านซ้ายตู้' },
                              { key: 'photo_right', label: '4. ด้านขวาตู้' },
                              { key: 'photo_back', label: '5. ด้านหลังตู้ (ประตู)', full: true },
                            ].map(p => (
                              <label
                                key={p.key}
                                className={`${p.full ? 'col-span-2' : ''} flex items-center gap-2 p-2.5 bg-white rounded-xl border cursor-pointer hover:bg-slate-50 font-bold`}
                              >
                                <input
                                  type="checkbox"
                                  checked={(driverAppForm as any)[p.key]}
                                  onChange={(e) => setDriverAppForm({ ...driverAppForm, [p.key]: e.target.checked })}
                                  className="h-4 w-4 text-emerald-600 rounded"
                                />
                                <span>{p.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Cold container 3 extra photos if Reefer */}
                        {isReefer && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                            <div className="font-black text-blue-900 text-xs flex items-center gap-1">
                              <Thermometer className="h-4 w-4 text-blue-600" />
                              ❄️ สำหรับตู้เย็น (Reefer) ถ่ายเพิ่ม 3 รูป:
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border cursor-pointer font-bold">
                                <input
                                  type="checkbox"
                                  checked={driverAppForm.photo_reefer_drain}
                                  onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_reefer_drain: e.target.checked })}
                                  className="h-4 w-4 text-blue-600 rounded"
                                />
                                <span>1. รูปรูน้ำทิ้งทั้ง 4 ด้าน</span>
                              </label>
                              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border cursor-pointer font-bold">
                                <input
                                  type="checkbox"
                                  checked={driverAppForm.photo_reefer_cable}
                                  onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_reefer_cable: e.target.checked })}
                                  className="h-4 w-4 text-blue-600 rounded"
                                />
                                <span>2. รูปสายไฟตู้เย็น</span>
                              </label>
                              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border cursor-pointer font-bold">
                                <input
                                  type="checkbox"
                                  checked={driverAppForm.photo_reefer_temp}
                                  onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_reefer_temp: e.target.checked })}
                                  className="h-4 w-4 text-blue-600 rounded"
                                />
                                <span>3. รูปหน้าจอโชว์อุณหภูมิ</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {/* Receipts & EIR */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border cursor-pointer font-bold">
                            <input
                              type="checkbox"
                              checked={driverAppForm.photo_pickup_receipt}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_pickup_receipt: e.target.checked })}
                              className="h-4 w-4 text-slate-600 rounded"
                            />
                            <span>🧾 สลิป Lift On / Gate</span>
                          </label>
                          <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border cursor-pointer font-bold">
                            <input
                              type="checkbox"
                              checked={driverAppForm.photo_pickup_eir}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_pickup_eir: e.target.checked })}
                              className="h-4 w-4 text-slate-600 rounded"
                            />
                            <span>📄 ใบรับตู้ EIR</span>
                          </label>
                        </div>

                        {/* Container No & Seal No Input */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs font-black">หมายเลขตู้ (Container No.)</Label>
                            <Input
                              placeholder="MRKU0670006"
                              value={driverAppForm.container_no}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, container_no: e.target.value.toUpperCase() })}
                              className="font-mono font-black text-sm uppercase"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-black">หมายเลขซีล (Seal No.)</Label>
                            <Input
                              placeholder="SN-998124"
                              value={driverAppForm.seal_no}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, seal_no: e.target.value.toUpperCase() })}
                              className="font-mono font-black text-sm uppercase"
                            />
                          </div>
                        </div>

                        {isReefer && (
                          <div>
                            <Label className="text-xs font-black text-blue-900">อุณหภูมิตู้แช่เย็น (°C)</Label>
                            <Input
                              type="number"
                              placeholder="-18.0"
                              value={driverAppForm.temperature}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, temperature: e.target.value })}
                              className="font-mono font-bold text-blue-800"
                            />
                          </div>
                        )}

                        <Button
                          type="button"
                          onClick={() => {
                            handleSaveDriverUpdate(false);
                            setDriverCurrentStep('step2');
                          }}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black h-12 text-sm rounded-xl"
                        >
                          บันทึกจุดที่ 1 &amp; ออกเดินทางไปจุดบรรจุ ➔
                        </Button>
                      </div>
                    )}

                    {/* STEP 2: PACKING */}
                    {driverCurrentStep === 'step2' && (
                      <div className="bg-white p-4 rounded-2xl border-2 border-amber-200 space-y-3">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                          <div className="font-black text-amber-900 text-xs md:text-sm">
                            จุดที่ 2: {selectedDriverJob?.packing_place || 'โรงงานบรรจุสินค้า'}
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleDriverCheckin('packing')}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black h-12 text-sm md:text-base rounded-xl gap-2 shadow-md"
                          >
                            <MapPin className="h-5 w-5" />
                            กดเช็คอินจุดบรรจุสินค้า (บันทึกเวลา + GPS)
                          </Button>
                          {driverAppForm.checkin_packing && (
                            <p className="text-xs text-emerald-700 font-bold">{driverAppForm.checkin_packing}</p>
                          )}
                        </div>

                        <div className="p-3 bg-slate-50 border rounded-xl space-y-2 text-xs">
                          <div className="font-black text-slate-900">ถ่ายรูปหน้างานจุดบรรจุ:</div>
                          <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer font-bold">
                            <input
                              type="checkbox"
                              checked={driverAppForm.photo_sealed}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_sealed: e.target.checked })}
                              className="h-4 w-4 text-amber-600 rounded"
                            />
                            <span className="text-slate-900">📸 รูปหน้าตู้ที่ล็อคซีล (Seal) เรียบร้อยแล้ว (บังคับ)</span>
                          </label>

                          {isReefer && (
                            <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer font-bold">
                              <input
                                type="checkbox"
                                checked={driverAppForm.photo_packing_temp}
                                onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_packing_temp: e.target.checked })}
                                className="h-4 w-4 text-blue-600 rounded"
                              />
                              <span>❄️ รูปหน้าจออุณหภูมิหลังบรรจุสินค้า</span>
                            </label>
                          )}

                          <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer font-bold">
                            <input
                              type="checkbox"
                              checked={driverAppForm.photo_packing_receipt}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_packing_receipt: e.target.checked })}
                              className="h-4 w-4 text-slate-600 rounded"
                            />
                            <span>🧾 สลิปค่าธรรมเนียม / เอกสารโรงงาน</span>
                          </label>
                        </div>

                        <Button
                          type="button"
                          onClick={() => {
                            handleSaveDriverUpdate(false);
                            setDriverCurrentStep('step3');
                          }}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black h-12 text-sm rounded-xl"
                        >
                          บันทึกจุดที่ 2 &amp; ออกเดินทางไปจุดคืนตู้ ➔
                        </Button>
                      </div>
                    )}

                    {/* STEP 3: RETURN */}
                    {driverCurrentStep === 'step3' && (
                      <div className="bg-white p-4 rounded-2xl border-2 border-emerald-200 space-y-3">
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                          <div className="font-black text-purple-900 text-xs md:text-sm">
                            จุดที่ 3: {selectedDriverJob?.return_place || selectedDriverJob?.destination?.name || 'สถานที่คืนตู้'}
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleDriverCheckin('return')}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black h-12 text-sm md:text-base rounded-xl gap-2 shadow-md"
                          >
                            <MapPin className="h-5 w-5" />
                            กดเช็คอินจุดคืนตู้ (บันทึกเวลา + GPS)
                          </Button>
                          {driverAppForm.checkin_return && (
                            <p className="text-xs text-emerald-700 font-bold">{driverAppForm.checkin_return}</p>
                          )}
                        </div>

                        <div className="p-3 bg-slate-50 border rounded-xl space-y-2 text-xs">
                          <div className="font-black text-slate-900">ถ่ายรูปส่งมอบตู้:</div>
                          <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer font-bold">
                            <input
                              type="checkbox"
                              checked={driverAppForm.photo_return_front}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_return_front: e.target.checked })}
                              className="h-4 w-4 text-purple-600 rounded"
                            />
                            <span className="text-slate-900">📸 รูปหน้าตู้ส่งคืนที่ลาน/ท่าเรือ (บังคับ)</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer font-bold">
                            <input
                              type="checkbox"
                              checked={driverAppForm.photo_return_receipt}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_return_receipt: e.target.checked })}
                              className="h-4 w-4 text-slate-600 rounded"
                            />
                            <span>🧾 สลิป Lift Off / Gate Charge</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer font-bold">
                            <input
                              type="checkbox"
                              checked={driverAppForm.photo_return_eir}
                              onChange={(e) => setDriverAppForm({ ...driverAppForm, photo_return_eir: e.target.checked })}
                              className="h-4 w-4 text-slate-600 rounded"
                            />
                            <span>📄 ใบรับตู้คืน EIR</span>
                          </label>
                        </div>

                        <div>
                          <Label className="text-xs font-black">หมายเหตุหน้างานของ พขร.</Label>
                          <Input
                            placeholder="ส่งมอบตู้เรียบร้อย ไม่มีรอยขูดขีด..."
                            value={driverAppForm.driver_notes}
                            onChange={(e) => setDriverAppForm({ ...driverAppForm, driver_notes: e.target.value })}
                            className="text-xs"
                          />
                        </div>

                        {/* BIG COMPLETE BUTTON */}
                        <Button
                          type="button"
                          onClick={() => handleSaveDriverUpdate(true)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-14 text-base rounded-2xl gap-2 shadow-lg"
                        >
                          <CheckCircle2 className="h-6 w-6" />
                          จบงาน &amp; ส่งมอบตู้สำเร็จ (Complete Job)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= MODAL: ASSIGN VEHICLE & DRIVER ================= */}
      <Dialog open={openAssignModal} onOpenChange={setOpenAssignModal}>
        <DialogContent className="sm:max-w-[850px] max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
              <Truck className="h-6 w-6 text-blue-600" />
              จ่ายงานขนส่งและจัดรถ (Assign Truck &amp; Driver)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              ตรวจสอบรายละเอียดงาน เส้นทาง 3 จุดตรวจ และวันเวลานัดหมาย เพื่อมอบหมายรถและ พขร. ที่เหมาะสม
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAssign} className="space-y-5 pt-2">
            {/* 1. COMPREHENSIVE JOB OVERVIEW CARD */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-3.5 shadow-xs">
              {/* Row 1: Job ID, Status, Job Date */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-black text-lg text-blue-800 bg-blue-100 px-3 py-1 rounded-lg border border-blue-200">
                    {selectedJob?.job_no}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`font-semibold text-xs px-2.5 py-0.5 ${statusConfig[selectedJob?.status || 'draft']?.badgeClass || ''}`}
                  >
                    {statusConfig[selectedJob?.status || 'draft']?.label || selectedJob?.status}
                  </Badge>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-200 text-slate-800">
                    {jobTypeMap[selectedJob?.job_type || ''] || selectedJob?.job_type}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-sm font-bold text-amber-950 bg-amber-100/80 px-3 py-1 rounded-lg border border-amber-300">
                  <Calendar className="h-4 w-4 text-amber-700" />
                  วันที่วิ่งงาน: <span className="font-mono">{selectedJob?.job_date}</span>
                </div>
              </div>

              {/* Row 2: Customer, Shipping Line, Booking, Volume */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="p-2.5 bg-white rounded-lg border space-y-1">
                  <span className="text-xs text-slate-500 font-medium">ลูกค้าผู้ว่าจ้าง:</span>
                  <div className="font-black text-slate-900 text-base truncate" title={selectedJob?.customer?.company_name}>
                    {selectedJob?.customer?.company_name || 'ลูกค้าทั่วไป'}
                  </div>
                  <div className="text-xs text-slate-600 truncate">
                    สินค้า: <strong className="text-slate-800">{selectedJob?.commodity_name || 'สินค้าทั่วไป'}</strong>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border space-y-1">
                  <span className="text-xs text-slate-500 font-medium">สายเรือ &amp; เอกสาร:</span>
                  <div className="font-bold text-blue-800 text-sm flex items-center gap-1">
                    <Ship className="h-4 w-4 shrink-0 text-blue-600" />
                    {selectedJob?.ship_line || '-'}
                  </div>
                  <div className="text-xs font-mono">
                    <span className="text-slate-500 font-sans">Booking:</span> <strong className="text-slate-900">{selectedJob?.book_no || '-'}</strong>
                    {selectedJob?.bl_no && (
                      <span className="ml-2 text-slate-500 font-sans">B/L: <strong className="text-slate-700">{selectedJob.bl_no}</strong></span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border space-y-1">
                  <span className="text-xs text-slate-500 font-medium">สเปก &amp; จำนวนตู้ (Volume):</span>
                  <div>
                    <span className="font-mono font-black text-sm text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 inline-flex items-center gap-1">
                      <Box className="h-4 w-4 text-blue-600" />
                      {selectedJob?.container_amount || 1} x {selectedJob?.container_size}&apos; {selectedJob?.container_type}
                    </span>
                  </div>
                  {selectedJob?.pat_letter_required && (
                    <div className="text-[11px] text-purple-700 font-semibold flex items-center gap-1">
                      <Anchor className="h-3 w-3" /> ต้องทำจดหมายการท่าเรือ (PAT)
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: 3-Point Operational Route (Pickup -> Packing -> Return) */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  กำหนดการเดินทางและเส้นทาง 3 จุดตรวจ:
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Point 1: Pickup */}
                  <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 space-y-1">
                    <div className="text-xs font-bold text-blue-900 flex items-center justify-between">
                      <span>1. สถานที่ลากตู้ (รับตู้)</span>
                      <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.2 rounded font-semibold">Pickup</span>
                    </div>
                    <div className="font-bold text-sm text-blue-950 truncate" title={selectedJob?.pickup_place || selectedJob?.origin?.name || '-'}>
                      {selectedJob?.pickup_place || selectedJob?.origin?.name || '-'}
                    </div>
                    <div className="text-xs text-blue-800 font-semibold flex items-center gap-1 pt-0.5">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      วันที่ลากตู้: <span className="font-mono font-bold">{selectedJob?.pickup_date || selectedJob?.job_date}</span>
                    </div>
                  </div>

                  {/* Point 2: Packing */}
                  <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1">
                    <div className="text-xs font-bold text-amber-900 flex items-center justify-between">
                      <span>2. สถานที่บรรจุสินค้า</span>
                      <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.2 rounded font-semibold">Packing</span>
                    </div>
                    <div className="font-bold text-sm text-amber-950 truncate" title={selectedJob?.packing_place || 'โรงงานลูกค้า'}>
                      {selectedJob?.packing_place || 'โรงงานลูกค้า'}
                    </div>
                    <div className="text-xs text-amber-800 font-semibold flex items-center gap-1 pt-0.5">
                      <Calendar className="h-3.5 w-3.5 text-amber-600" />
                      วันที่บรรจุ: <span className="font-mono font-bold">{selectedJob?.packing_date || selectedJob?.job_date}</span>
                    </div>
                  </div>

                  {/* Point 3: Return */}
                  <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-1">
                    <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                      <span>3. สถานที่คืนตู้</span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">Return</span>
                    </div>
                    <div className="font-bold text-sm text-emerald-950 truncate" title={selectedJob?.return_place || selectedJob?.destination?.name || '-'}>
                      {selectedJob?.return_place || selectedJob?.destination?.name || '-'}
                    </div>
                    <div className="text-xs text-emerald-800 font-semibold flex items-center gap-1 pt-0.5">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                      วันที่คืนตู้: <span className="font-mono font-bold">{selectedJob?.return_date || selectedJob?.job_date}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Notes / Instructions (if any) */}
              {selectedJob?.driver_notes && (
                <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-900 flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">คำสั่งพิเศษ / หมายเหตุหน้างาน:</strong> {selectedJob.driver_notes}
                  </div>
                </div>
              )}
            </div>

            {/* 2. DISPATCH ASSIGNMENT SECTION (TRUCK & DRIVER SELECTION) */}
            {(() => {
              const isJobCompleted = selectedJob?.status === 'completed';
              const isJobCancelled = selectedJob?.status === 'cancelled';
              const isLocked = isJobCompleted || isJobCancelled;

              return (
                <div className="space-y-4 border-t pt-4">
                  <div className="font-bold text-base text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-blue-600" />
                      จัดสรรรถและพนักงานขับรถ (Truck &amp; Driver Assignment)
                    </span>
                    {isLocked && (
                      <span className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5 text-emerald-600" />
                        {isJobCompleted ? 'งานเสร็จสิ้นแล้ว (ล็อกข้อมูล)' : 'งานถูกยกเลิกแล้ว'}
                      </span>
                    )}
                  </div>

                  {/* Security / Locked Banners */}
                  {isJobCompleted && (
                    <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-start gap-3 text-emerald-950">
                      <Lock className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-sm">🔒 งานนี้เสร็จสิ้นส่งมอบตู้เรียบร้อยแล้ว (Job Completed &amp; Locked)</div>
                        <div className="text-xs text-emerald-800 mt-0.5">
                          ระบบล็อกข้อมูลรถและพนักงานขับรถ ไม่สามารถแก้ไขหรือเปลี่ยนรถย้อนหลังได้ เพื่อรักษาความถูกต้องของข้อมูลบัญชีและสถิติ
                        </div>
                      </div>
                    </div>
                  )}

                  {isJobCancelled && (
                    <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-3 text-rose-950">
                      <AlertTriangle className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-sm">⛔ งานนี้ถูกยกเลิกแล้ว (Job Cancelled)</div>
                        <div className="text-xs text-rose-800 mt-0.5">
                          ไม่สามารถจ่ายรถหรือมอบหมายงานสำหรับใบงานที่ถูกยกเลิกได้
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Truck Select */}
                    <div>
                      <Label className="text-sm font-bold text-blue-900 mb-1.5 block">
                        เลือกรถที่ต้องการจ่ายงาน *
                      </Label>
                      <select
                        required
                        disabled={isLocked}
                        className="w-full border-2 border-blue-300 focus:border-blue-500 rounded-xl px-3 h-11 text-sm bg-white font-bold text-slate-900 shadow-xs disabled:bg-slate-100 disabled:cursor-not-allowed"
                        value={assignForm.vehicle_id}
                        onChange={(e) => handleVehicleChange(e.target.value)}
                      >
                        <option value="">-- เลือกรถ --</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.truck_name_id || 'รถ'} ({v.plate_number}) - {v.truck_brand} {v.truck_model} [{vehicleTypeMap[v.vehicle_type] || v.vehicle_type}]
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Driver Select */}
                    {(() => {
                      const selectedVeh = vehicles.find((v) => v.id === assignForm.vehicle_id);
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <Label className="text-sm font-bold text-emerald-900">
                              พนักงานขับรถ (พขร.) *
                            </Label>
                            {!isLocked && (
                              <span className="text-[11px] text-emerald-700 font-medium">
                                (ดึงอัตโนมัติ / สลับคนขับได้)
                              </span>
                            )}
                          </div>
                          <select
                            required
                            disabled={isLocked}
                            className="w-full border-2 border-emerald-300 focus:border-emerald-500 rounded-xl px-3 h-11 text-sm bg-white font-bold text-slate-900 shadow-xs disabled:bg-slate-100 disabled:cursor-not-allowed"
                            value={assignForm.driver_id}
                            onChange={(e) => handleDriverChange(e.target.value)}
                          >
                            <option value="">-- เลือกคนขับ --</option>
                            {drivers.map((d) => {
                              const isPaired = selectedVeh?.driver_id === d.id || selectedVeh?.driver?.id === d.id;
                              return (
                                <option key={d.id} value={d.id}>
                                  {d.name} {d.phone ? `(${d.phone})` : ''} {isPaired ? '⭐ [คนขับประจำรถคันนี้]' : ''}
                                </option>
                              );
                            })}
                          </select>
                          <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
                            <span>เบอร์โทรศัพท์: <strong className="font-mono text-slate-900">{assignForm.driver_phone || '-'}</strong></span>
                            {assignForm.driver_name && (
                              <span className="text-emerald-700 font-semibold text-[11px]">พขร. ประจำงาน</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Container No & Seal No (Optional at dispatch time) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                        หมายเลขตู้ (Container No.)
                      </Label>
                      <Input
                        disabled={isLocked}
                        placeholder="เช่น TGHU9482710 (ถ้าทราบแล้ว)"
                        value={assignForm.container_no}
                        onChange={(e) => setAssignForm({ ...assignForm, container_no: e.target.value })}
                        className="font-mono text-sm uppercase h-10 font-bold disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                        หมายเลขซีล (Seal No.)
                      </Label>
                      <Input
                        disabled={isLocked}
                        placeholder="เช่น EMCA291834 (ถ้าทราบแล้ว)"
                        value={assignForm.seal_no}
                        onChange={(e) => setAssignForm({ ...assignForm, seal_no: e.target.value })}
                        className="font-mono text-sm uppercase h-10 font-bold disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Job Status */}
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                      ปรับสถานะงานขนส่ง
                    </Label>
                    <select
                      disabled={isLocked}
                      className="w-full border rounded-lg px-3 h-10 text-sm bg-white font-medium disabled:bg-slate-100 disabled:cursor-not-allowed"
                      value={assignForm.status}
                      onChange={(e) => setAssignForm({ ...assignForm, status: e.target.value })}
                    >
                      <option value="assigned">มอบหมายแล้ว (Assigned)</option>
                      <option value="in_progress">กำลังวิ่งงาน (In Progress)</option>
                      <option value="draft">ฉบับร่าง (Draft)</option>
                      {isJobCompleted && <option value="completed">เสร็จสิ้น (Completed)</option>}
                    </select>
                  </div>

                  {/* Quick Line Copy */}
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={copyLineToClipboard}
                      className="w-full gap-2 text-emerald-800 border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 h-11 text-sm font-bold shadow-xs"
                    >
                      {copiedLine ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5 text-emerald-600" />}
                      {copiedLine ? 'คัดลอกข้อความสรุปงานแล้ว!' : 'คัดลอกสรุปงานส่ง LINE ให้ พขร.'}
                    </Button>
                  </div>

                  <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
                    {isLocked ? (
                      <div className="w-full flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                          <Lock className="h-4 w-4 text-emerald-600" />
                          {isJobCompleted ? 'งานเสร็จสิ้นส่งมอบแล้ว — ข้อมูลถูกล็อกการแก้ไข' : 'งานถูกยกเลิกแล้ว'}
                        </span>
                        <Button type="button" variant="outline" onClick={() => setOpenAssignModal(false)} className="h-11 px-6 text-sm">
                          ปิดหน้าต่าง
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button type="button" variant="outline" onClick={() => setOpenAssignModal(false)} className="h-11 px-5 text-sm">
                          ยกเลิก
                        </Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 h-11 px-8 text-sm font-bold shadow-md gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          {selectedJob?.status === 'assigned' 
                            ? 'บันทึกการแก้ไขจัดรถ' 
                            : selectedJob?.status === 'in_progress' 
                            ? 'บันทึกการสลับรถวิ่ง' 
                            : 'บันทึกจ่ายงาน'}
                        </Button>
                      </>
                    )}
                  </DialogFooter>
                </div>
              );
            })()}
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: COST & PROFIT ================= */}
      <Dialog open={openCostModal} onOpenChange={setOpenCostModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-600" />
              คำนวณต้นทุนจริง &amp; สรุปกำไรเที่ยววิ่ง
            </DialogTitle>
            <DialogDescription>
              บันทึกค่าน้ำมัน, เบี้ยเลี้ยง, ทางด่วน, OT และค่าใช้จ่ายอื่นๆ
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCost} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-100 rounded-lg flex justify-between font-bold text-sm">
              <span>รายได้ค่าขนส่ง (Revenue):</span>
              <span className="text-emerald-700">฿{Number(selectedJob?.revenue || 0).toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ค่าน้ำมันจริง (Fuel)</Label>
                <Input
                  type="number"
                  value={costForm.fuel_cost}
                  onChange={(e) => setCostForm({ ...costForm, fuel_cost: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">เบี้ยเลี้ยง พขร. จริง</Label>
                <Input
                  type="number"
                  value={costForm.driver_allowance}
                  onChange={(e) => setCostForm({ ...costForm, driver_allowance: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ค่าทางด่วนจริง</Label>
                <Input
                  type="number"
                  value={costForm.toll_fee}
                  onChange={(e) => setCostForm({ ...costForm, toll_fee: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">ค่าเสียเวลาจอดรอ (Waiting)</Label>
                <Input
                  type="number"
                  value={costForm.waiting_fee}
                  onChange={(e) => setCostForm({ ...costForm, waiting_fee: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ค่าล่วงเวลา (OT)</Label>
                <Input
                  type="number"
                  value={costForm.ot_fee}
                  onChange={(e) => setCostForm({ ...costForm, ot_fee: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">ค่าใช้จ่ายอื่นๆ</Label>
                <Input
                  type="number"
                  value={costForm.other_cost}
                  onChange={(e) => setCostForm({ ...costForm, other_cost: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCostModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                บันทึกต้นทุนจริง
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
          </DialogHeader>

          <div className="border-2 border-slate-900 p-6 rounded-lg bg-white text-slate-900 space-y-4 print:border-none print:p-0">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo-print.png" alt="Connect Transport" className="h-10 w-auto object-contain" />
                <div>
                  <h3 className="font-black text-base text-slate-900">บริษัท คอนเนค ทรานสปอร์ต จำกัด</h3>
                  <p className="text-[10px] text-slate-600">369/1 ถนนเลียบคลองมอญ เขตลาดกระบัง กทม. โทร 089-5351313</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-sm text-blue-900">ใบสั่งงานขนส่งสินค้า</div>
                <div className="font-mono font-bold text-xs">JOB NO: {selectedJob?.job_no}</div>
                <div className="text-[10px] text-slate-500">วันที่: {selectedJob?.job_date}</div>
              </div>
            </div>

            {/* Info Table */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded border">
              <div>
                <div><strong>ลูกค้า:</strong> {selectedJob?.customer?.company_name}</div>
                <div><strong>สายเรือ:</strong> {selectedJob?.ship_line || '-'}</div>
                <div><strong>Booking No:</strong> <span className="font-mono">{selectedJob?.book_no || '-'}</span></div>
                <div><strong>สินค้า:</strong> {selectedJob?.commodity_name || 'ทั่วไป'}</div>
              </div>
              <div>
                <div><strong>รถบรรทุก:</strong> {selectedJob?.vehicle?.truck_name_id || '-'} ({selectedJob?.vehicle?.plate_number || '-'})</div>
                <div><strong>พขร. ที่มอบหมาย:</strong> {selectedJob?.driver?.name || '-'}</div>
                <div><strong>เบอร์โทร พขร:</strong> {selectedJob?.driver?.phone || '-'}</div>
                <div><strong>สเปกตู้:</strong> {selectedJob?.container_amount || 1}x{selectedJob?.container_size}&apos; {selectedJob?.container_type}</div>
              </div>
            </div>

            {/* Route */}
            <div className="border rounded p-3 text-xs space-y-1">
              <div className="font-bold text-blue-900">กำหนดการเดินทาง 3 จุด:</div>
              <div>1. จุดรับตู้: <strong>{selectedJob?.pickup_place || selectedJob?.origin?.name || '-'}</strong> ({selectedJob?.pickup_date})</div>
              <div>2. จุดบรรจุ: <strong>{selectedJob?.packing_place || 'โรงงานลูกค้า'}</strong> ({selectedJob?.packing_date})</div>
              <div>3. จุดคืนตู้: <strong>{selectedJob?.return_place || selectedJob?.destination?.name || '-'}</strong> ({selectedJob?.return_date})</div>
            </div>

            {/* 3 Party Signatures */}
            <div className="grid grid-cols-3 gap-2 pt-6 text-center text-[11px] border-t">
              <div>
                <div>( ......................................... )</div>
                <div className="font-bold mt-1">ผู้จ่ายงาน (Dispatcher)</div>
                <div className="text-slate-400 text-[10px]">วันที่ ......./......./.......</div>
              </div>
              <div>
                <div>( ......................................... )</div>
                <div className="font-bold mt-1">พนักงานขับรถ (Driver)</div>
                <div className="text-slate-400 text-[10px]">วันที่ ......./......./.......</div>
              </div>
              <div>
                <div>( ......................................... )</div>
                <div className="font-bold mt-1">ผู้รับสินค้า (Customer)</div>
                <div className="text-slate-400 text-[10px]">วันที่ ......./......./.......</div>
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={() => setOpenPrintModal(false)}>
              ปิดหน้าต่าง
            </Button>
            <Button type="button" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Printer className="h-4 w-4" />
              พิมพ์ใบสั่งงาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
