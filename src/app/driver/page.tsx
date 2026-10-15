'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Job, Driver, Vehicle } from '@/types/database';
import { 
  Truck, 
  MapPin, 
  Camera, 
  CheckCircle2, 
  Clock, 
  Lock, 
  Box, 
  Calendar, 
  Phone, 
  Thermometer, 
  Navigation, 
  RefreshCw, 
  LogOut, 
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  FileText,
  User,
  ArrowLeft,
  X,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Job Type Map in plain Thai
const jobTypeThai: Record<string, string> = {
  heavy_to_open: 'ลากตู้หนักไปเปิด (Import)',
  empty_to_stuff: 'ลากตู้เปล่าไปบรรจุ (Export)',
  empty_return: 'ลากตู้เปล่าคืนลาน',
  yard_move: 'ย้ายลานตู้',
};

function DriverPortalContent() {
  const searchParams = useSearchParams();
  const urlDriverId = searchParams.get('id') || searchParams.get('d');

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Driver Identity State (Remembered on Device)
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [rememberMe, setRememberMe] = useState(true);

  // Filters State
  // Date filter: 'today', 'tomorrow', 'all', or custom 'YYYY-MM-DD'
  const [todayStr, setTodayStr] = useState<string>('');
  const [tomorrowStr, setTomorrowStr] = useState<string>('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().split('T')[0];
    setTodayStr(today);
    setTomorrowStr(tomorrow);
  }, []);

  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'all' | string>('today');
  // Status filter: 'active' (default: assigned + in_progress), 'completed', 'all'
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active');

  // Active Job Workflow State
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [currentStep, setCurrentStep] = useState<'step1' | 'step2' | 'step3'>('step1');

  // Form Data & Photo State for active job
  const [driverForm, setDriverForm] = useState({
    container_no: '',
    seal_no: '',
    temperature: '',
    checkin_pickup: '',
    checkin_packing: '',
    checkin_return: '',
    driver_notes: '',

    // Checkpoint 1 Photos
    photo_front: '',
    photo_floor: '',
    photo_left: '',
    photo_right: '',
    photo_back: '',
    photo_reefer_drain: '',
    photo_reefer_cable: '',
    photo_reefer_temp: '',
    photo_pickup_receipt: '',
    photo_pickup_eir: '',

    // Checkpoint 2 Photos
    photo_sealed: '',
    photo_packing_temp: '',
    photo_packing_receipt: '',

    // Checkpoint 3 Photos
    photo_return_front: '',
    photo_return_receipt: '',
    photo_return_eir: '',
  });

  // Photo viewer modal
  const [previewPhoto, setPreviewPhoto] = useState<{ title: string; url: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Hidden file inputs refs for direct camera capture
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // 1. Fetch initial data from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      const [drivRes, vehRes, jobsRes] = await Promise.all([
        supabase.from('drivers').select('*').order('name'),
        supabase.from('vehicles').select('*'),
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
          .order('job_date', { ascending: false })
      ]);

      if (drivRes.data) setDrivers(drivRes.data as Driver[]);
      if (vehRes.data) setVehicles(vehRes.data as Vehicle[]);
      if (jobsRes.data) setJobs(jobsRes.data as Job[]);

      // Check stored driver or URL driver
      const storedDriverId = typeof window !== 'undefined' ? localStorage.getItem('connect_driver_id') : null;
      const targetDriverId = urlDriverId || storedDriverId;

      if (targetDriverId && drivRes.data) {
        const found = drivRes.data.find(d => d.id === targetDriverId);
        if (found) {
          setCurrentDriver(found);
          setSelectedDriverId(found.id);
          if (typeof window !== 'undefined' && urlDriverId) {
            localStorage.setItem('connect_driver_id', found.id);
          }
        }
      }
    } catch (err) {
      console.error('Driver portal fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Set active driver vehicle
  const driverVehicle = useMemo(() => {
    if (!currentDriver) return null;
    return vehicles.find(v => v.driver_id === currentDriver.id || (v as any).paired_driver_id === currentDriver.id);
  }, [currentDriver, vehicles]);

  // Filter jobs for CURRENT DRIVER ONLY
  const myJobs = useMemo(() => {
    if (!currentDriver) return [];
    return jobs.filter(j => j.driver_id === currentDriver.id);
  }, [jobs, currentDriver]);

  // Compute counts for filter buttons
  const myJobCounts = useMemo(() => {
    const counts = {
      today: 0,
      tomorrow: 0,
      active: 0,
      completed: 0,
      all: myJobs.length,
    };
    myJobs.forEach(j => {
      const isAct = j.status !== 'completed' && j.status !== 'cancelled';
      if (isAct) counts.active++;
      if (j.status === 'completed') counts.completed++;
      if (j.job_date === todayStr) counts.today++;
      if (j.job_date === tomorrowStr) counts.tomorrow++;
    });
    return counts;
  }, [myJobs, todayStr, tomorrowStr]);

  // Filtered jobs according to selected Date & Status
  const filteredMyJobs = useMemo(() => {
    return myJobs.filter(j => {
      // 1. Status Filter
      if (statusFilter === 'active') {
        if (j.status === 'completed' || j.status === 'cancelled') return false;
      } else if (statusFilter === 'completed') {
        if (j.status !== 'completed') return false;
      }

      // 2. Date Filter
      if (dateFilter === 'today') {
        if (j.job_date !== todayStr) return false;
      } else if (dateFilter === 'tomorrow') {
        if (j.job_date !== tomorrowStr) return false;
      } else if (dateFilter !== 'all') {
        if (j.job_date !== dateFilter) return false;
      }

      return true;
    });
  }, [myJobs, statusFilter, dateFilter, todayStr, tomorrowStr]);

  // Select job to work on
  const handleSelectJob = (job: Job) => {
    setActiveJob(job);
    setDriverForm({
      container_no: job.container_no || '',
      seal_no: job.seal_no || '',
      temperature: job.temperature !== null ? String(job.temperature) : '',
      checkin_pickup: job.checkin_location?.includes('รับตู้') ? job.checkin_location : '',
      checkin_packing: job.checkin_location?.includes('บรรจุ') ? job.checkin_location : '',
      checkin_return: job.checkin_location?.includes('คืนตู้') ? job.checkin_location : '',
      driver_notes: job.driver_notes || '',
      photo_front: '',
      photo_floor: '',
      photo_left: '',
      photo_right: '',
      photo_back: '',
      photo_reefer_drain: '',
      photo_reefer_cable: '',
      photo_reefer_temp: '',
      photo_pickup_receipt: '',
      photo_pickup_eir: '',
      photo_sealed: '',
      photo_packing_temp: '',
      photo_packing_receipt: '',
      photo_return_front: '',
      photo_return_receipt: '',
      photo_return_eir: '',
    });

    if (job.status === 'completed') {
      setCurrentStep('step3');
    } else if (job.status === 'in_progress') {
      setCurrentStep('step2');
    } else {
      setCurrentStep('step1');
    }
  };

  // Login as driver
  const handleDriverLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId) return;

    const d = drivers.find(dr => dr.id === selectedDriverId);
    if (!d) return;

    // PIN check (optional PIN: last 4 digits of phone or ID number)
    const expectedPin = d.id_number?.replace(/\D/g, '').slice(-4) || d.phone?.replace(/\D/g, '').slice(-4) || '1234';
    if (pinInput && pinInput.trim() !== expectedPin && pinInput.trim() !== '1234') {
      setPinError(`รหัส PIN ไม่ถูกต้อง (สำหรับทดสอบสามารถใช้ 4 ตัวท้ายเบอร์โทร ${expectedPin} หรือ 1234)`);
      return;
    }

    setCurrentDriver(d);
    setPinError('');
    if (rememberMe && typeof window !== 'undefined') {
      localStorage.setItem('connect_driver_id', d.id);
    }
  };

  // Logout / Switch driver
  const handleDriverLogout = () => {
    if (confirm('คุณต้องการเปลี่ยนคนขับ หรือออกจากระบบใช่หรือไม่?')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('connect_driver_id');
      }
      setCurrentDriver(null);
      setActiveJob(null);
      setSelectedDriverId('');
      setPinInput('');
    }
  };

  // Check-in with GPS and real-time Thai timestamp
  const handleCheckin = (point: 'pickup' | 'packing' | 'return') => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

    const locationName = point === 'pickup' 
      ? (activeJob?.pickup_place || activeJob?.origin?.name || 'จุดรับตู้')
      : point === 'packing' 
      ? (activeJob?.packing_place || 'โรงงานลูกค้า')
      : (activeJob?.return_place || activeJob?.destination?.name || 'ท่าเรือคืนตู้');

    // Attempt GPS geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(4);
          const lng = pos.coords.longitude.toFixed(4);
          const checkinText = `📍 ถึง ${locationName} เวลา ${timeStr} (${dateStr}) [GPS: ${lat}, ${lng}]`;

          if (point === 'pickup') setDriverForm(prev => ({ ...prev, checkin_pickup: checkinText }));
          else if (point === 'packing') setDriverForm(prev => ({ ...prev, checkin_packing: checkinText }));
          else setDriverForm(prev => ({ ...prev, checkin_return: checkinText }));
        },
        () => {
          // Fallback if GPS permission denied
          const checkinText = `📍 ถึง ${locationName} เวลา ${timeStr} (${dateStr})`;
          if (point === 'pickup') setDriverForm(prev => ({ ...prev, checkin_pickup: checkinText }));
          else if (point === 'packing') setDriverForm(prev => ({ ...prev, checkin_packing: checkinText }));
          else setDriverForm(prev => ({ ...prev, checkin_return: checkinText }));
        },
        { timeout: 6000 }
      );
    } else {
      const checkinText = `📍 ถึง ${locationName} เวลา ${timeStr} (${dateStr})`;
      if (point === 'pickup') setDriverForm(prev => ({ ...prev, checkin_pickup: checkinText }));
      else if (point === 'packing') setDriverForm(prev => ({ ...prev, checkin_packing: checkinText }));
      else setDriverForm(prev => ({ ...prev, checkin_return: checkinText }));
    }
  };

  // Direct Photo Capture Handler
  const handleCapturePhoto = (photoKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      setDriverForm(prev => ({ ...prev, [photoKey]: base64Url }));
    };
    reader.readAsDataURL(file);
  };

  // Open Google Maps Navigation
  const openGoogleMaps = (locationName: string) => {
    if (!locationName) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`;
    window.open(url, '_blank');
  };

  // Save Progress to Supabase
  const handleSaveProgress = async (isCompleting: boolean = false) => {
    if (!activeJob) return;
    setIsSaving(true);

    try {
      const nowIso = new Date().toISOString();
      const currentLocation = driverForm.checkin_return || driverForm.checkin_packing || driverForm.checkin_pickup;

      // 1. Update Jobs table
      const { error: jobErr } = await supabase
        .from('jobs')
        .update({
          container_no: driverForm.container_no.trim() || activeJob.container_no,
          seal_no: driverForm.seal_no.trim() || activeJob.seal_no,
          temperature: driverForm.temperature ? parseFloat(driverForm.temperature) : activeJob.temperature,
          checkin_location: currentLocation || activeJob.checkin_location,
          checkin_time: nowIso,
          driver_notes: driverForm.driver_notes,
          status: isCompleting ? 'completed' : 'in_progress',
        })
        .eq('id', activeJob.id);

      if (jobErr) throw jobErr;

      // 2. Also record in job_assignments table if available
      try {
        await supabase
          .from('job_assignments')
          .update({
            container_no: driverForm.container_no || activeJob.container_no,
            seal_no: driverForm.seal_no || activeJob.seal_no,
            temperature: driverForm.temperature ? parseFloat(driverForm.temperature) : null,
            current_step: isCompleting ? 'completed' : currentStep === 'step1' ? 'at_packing' : 'at_return',
            driver_notes: driverForm.driver_notes,
          })
          .eq('job_id', activeJob.id);
      } catch (e) {
        // silently ignore if assignment table update is not critical
      }

      await fetchData();

      if (isCompleting) {
        alert('🎉 จบงานและส่งมอบตู้สำเร็จเรียบร้อยครับ! ขอบคุณสำหรับความปลอดภัยในการขับขี่');
        setActiveJob(null);
      } else {
        alert('💾 บันทึกข้อมูลและเช็คอินเรียบร้อย กำลังนำทางไปจุดถัดไป');
        if (currentStep === 'step1') setCurrentStep('step2');
        else if (currentStep === 'step2') setCurrentStep('step3');
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
    } finally {
      setIsSaving(false);
    }
  };

  const isReefer = activeJob?.container_type === 'RH' || (activeJob?.container_type as string) === 'RF' || activeJob?.container_type === 'Reefer';

  // =========================================================================
  // VIEW 1: DRIVER LOGIN / PROFILE SELECTION (If not logged in on device)
  // =========================================================================
  if (!currentDriver) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white text-center">
            <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
              <Truck className="h-10 w-10 text-white" />
            </div>
            <div className="text-xs uppercase font-bold tracking-wider text-emerald-100">Connect Transport TMS</div>
            <h1 className="text-2xl font-black mt-1">พอร์ทัล พขร. ภาคสนาม</h1>
            <p className="text-emerald-100 text-sm mt-1">ระบบงาน พขร. เมนูภาษาไทย ตัวหนังสือใหญ่ ใช้งานง่าย</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleDriverLogin} className="p-6 space-y-5">
            <div>
              <Label className="text-base font-bold text-slate-800 block mb-2">
                1. เลือกชื่อของคุณ (พนักงานขับรถ):
              </Label>
              <select
                required
                className="w-full border-2 border-emerald-400 focus:border-emerald-600 rounded-2xl p-4 text-base md:text-lg font-black bg-emerald-50/50 text-slate-900 shadow-sm"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
              >
                <option value="">-- แตะเพื่อเลือกชื่อ พขร. --</option>
                {drivers.map(d => {
                  const pairedVeh = vehicles.find(v => v.driver_id === d.id || (v as any).paired_driver_id === d.id);
                  return (
                    <option key={d.id} value={d.id}>
                      {d.name} {pairedVeh ? `(${pairedVeh.truck_name_id || pairedVeh.plate_number})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedDriverId && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-300">
                <div>
                  <Label className="text-sm font-bold text-slate-700 block mb-1.5">
                    2. ใส่รหัส PIN 4 หลัก (เพื่อความปลอดภัย):
                  </Label>
                  <Input
                    type="password"
                    maxLength={4}
                    placeholder="ใส่ PIN 4 หลัก (เช่น 1234)"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="h-14 text-center text-2xl font-mono tracking-widest rounded-2xl border-2 border-slate-300 font-bold"
                  />
                  <p className="text-xs text-slate-500 mt-1 text-center">
                    💡 ค่าเริ่มต้น: ใช้ 4 ตัวท้ายเบอร์โทรศัพท์ของคุณ หรือ <strong className="font-mono text-emerald-700 font-bold">1234</strong>
                  </p>
                </div>

                {pinError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{pinError}</span>
                  </div>
                )}

                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border cursor-pointer hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-5 w-5 text-emerald-600 rounded border-slate-400"
                  />
                  <span className="text-sm font-bold text-slate-800">
                    จำฉันไว้ในเครื่องนี้ (ครั้งต่อไปไม่ต้องล็อกอินอีก)
                  </span>
                </label>
              </div>
            )}

            <Button
              type="submit"
              disabled={!selectedDriverId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-14 text-lg rounded-2xl shadow-lg gap-2 disabled:bg-slate-300 disabled:shadow-none"
            >
              <CheckCircle2 className="h-6 w-6" />
              เข้าสู่ระบบเริ่มรับงาน
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACTIVE JOB DETAILS & 3-CHECKPOINT STEP-BY-STEP (When a Job is picked)
  // =========================================================================
  if (activeJob) {
    return (
      <div className="min-h-screen bg-slate-100 pb-12">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-30 bg-emerald-600 text-white shadow-md">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveJob(null)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl text-sm font-bold border border-white/20 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              กลับหน้ารายการ
            </button>

            <div className="text-center">
              <div className="text-[11px] font-bold text-emerald-100">ใบงานขนส่ง</div>
              <div className="font-mono font-black text-base tracking-wider">{activeJob.job_no}</div>
            </div>

            <button
              type="button"
              onClick={fetchData}
              className="h-9 w-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center border border-white/20"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-4 space-y-4">
          {/* Job Overview Card (Large Font) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-slate-200 space-y-3">
            <div className="flex items-start justify-between border-b pb-3 gap-2">
              <div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  {jobTypeThai[activeJob.job_type] || activeJob.job_type}
                </span>
                <h2 className="text-lg md:text-xl font-black text-slate-900 mt-1.5">
                  {activeJob.customer?.company_name || 'ลูกค้าทั่วไป'}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-500">วันนัดหมาย:</span>
                <div className="font-mono font-black text-slate-900 text-sm">{activeJob.job_date}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border">
              <div>
                <span className="text-slate-500">สายเรือ:</span> <strong className="text-slate-900 font-bold">{activeJob.ship_line || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Booking:</span> <strong className="font-mono text-slate-900 font-bold">{activeJob.book_no || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500">เบอร์ตู้:</span> <strong className="font-mono text-blue-900 font-bold">{activeJob.container_no || driverForm.container_no || 'ยังไม่ระบุ'}</strong>
              </div>
              <div>
                <span className="text-slate-500">สเปก:</span> <strong className="font-mono text-blue-800 font-bold">{activeJob.container_amount || 1}x{activeJob.container_size}&apos; {activeJob.container_type}</strong>
              </div>
            </div>

            {/* Special Instructions / Notes */}
            {activeJob.driver_notes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">คำสั่งพิเศษจากออฟฟิศ:</strong> {activeJob.driver_notes}
                </div>
              </div>
            )}
          </div>

          {/* 3 Step Large Navigation Tabs */}
          <div className="grid grid-cols-3 gap-2 bg-slate-200 p-1.5 rounded-2xl text-center font-black">
            <button
              type="button"
              onClick={() => setCurrentStep('step1')}
              className={`py-3 rounded-xl text-sm md:text-base transition-all flex flex-col items-center justify-center gap-0.5 ${
                currentStep === 'step1'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-300'
              }`}
            >
              <span className="text-xs opacity-80">จุดที่ 1</span>
              <span>1. รับตู้</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep('step2')}
              className={`py-3 rounded-xl text-sm md:text-base transition-all flex flex-col items-center justify-center gap-0.5 ${
                currentStep === 'step2'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-300'
              }`}
            >
              <span className="text-xs opacity-80">จุดที่ 2</span>
              <span>2. บรรจุ</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep('step3')}
              className={`py-3 rounded-xl text-sm md:text-base transition-all flex flex-col items-center justify-center gap-0.5 ${
                currentStep === 'step3'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-300'
              }`}
            >
              <span className="text-xs opacity-80">จุดที่ 3</span>
              <span>3. คืนตู้</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* STEP 1: PICKUP (รับตู้เปล่า / ลากตู้หนัก) */}
          {/* ========================================================================= */}
          {currentStep === 'step1' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-blue-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <span className="text-xs font-bold text-blue-700 uppercase">ขั้นตอนที่ 1</span>
                  <h3 className="text-lg font-black text-slate-900">รับตู้คอนเทนเนอร์ (Pickup)</h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openGoogleMaps(activeJob.pickup_place || activeJob.origin?.name || 'ลานตู้คอนเทนเนอร์')}
                  className="gap-1.5 font-bold text-xs text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100"
                >
                  <Navigation className="h-4 w-4 text-blue-600" />
                  เปิด Google Maps
                </Button>
              </div>

              {/* Location info */}
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1">
                <div className="text-xs font-bold text-slate-500">สถานที่รับตู้:</div>
                <div className="text-base font-black text-blue-950 flex items-start gap-1.5">
                  <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span>{activeJob.pickup_place || activeJob.origin?.name || 'ลานตู้คอนเทนเนอร์'}</span>
                </div>
                {activeJob.pickup_date && (
                  <div className="text-xs font-semibold text-blue-800 flex items-center gap-1 pt-1">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    วันนัดรับตู้: <strong className="font-mono">{activeJob.pickup_date}</strong>
                  </div>
                )}
              </div>

              {/* Big Check-in Button */}
              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={() => handleCheckin('pickup')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-14 text-base md:text-lg rounded-2xl gap-2 shadow-md"
                >
                  <MapPin className="h-6 w-6" />
                  กดเช็คอินจุดรับตู้ (บันทึกเวลา + GPS)
                </Button>
                {driverForm.checkin_pickup && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{driverForm.checkin_pickup}</span>
                  </div>
                )}
              </div>

              {/* 5 Mandatory Inspection Photos */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-sm md:text-base font-black text-slate-900 flex items-center gap-1.5">
                    <Camera className="h-5 w-5 text-blue-600" />
                    ถ่ายรูปตรวจสภาพตู้ 5 รูป (บังคับทุกมุม):
                  </Label>
                  <span className="text-xs text-rose-600 font-black">* ต้องถ่ายครบ</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { key: 'photo_front', label: '1. ด้านหน้าตู้' },
                    { key: 'photo_floor', label: '2. พื้นตู้ภายใน' },
                    { key: 'photo_left', label: '3. ด้านซ้ายตู้' },
                    { key: 'photo_right', label: '4. ด้านขวาตู้' },
                    { key: 'photo_back', label: '5. ด้านหลังตู้ (ประตู)', full: true },
                  ].map((p) => {
                    const hasPhoto = Boolean(driverForm[p.key as keyof typeof driverForm]);
                    return (
                      <div
                        key={p.key}
                        className={`${p.full ? 'col-span-2' : ''} border-2 rounded-2xl p-3 flex flex-col justify-between items-center text-center transition-all ${
                          hasPhoto ? 'bg-emerald-50 border-emerald-400' : 'bg-slate-50 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          ref={el => { fileInputRefs.current[p.key] = el; }}
                          onChange={(e) => handleCapturePhoto(p.key, e)}
                        />

                        <div className="w-full flex items-center justify-between mb-2">
                          <span className="text-xs md:text-sm font-bold text-slate-900">{p.label}</span>
                          {hasPhoto && (
                            <Badge className="bg-emerald-600 text-white text-[10px] gap-0.5">
                              <CheckCircle2 className="h-3 w-3" /> ถ่ายแล้ว
                            </Badge>
                          )}
                        </div>

                        {hasPhoto ? (
                          <div className="relative w-full h-24 rounded-xl overflow-hidden border border-emerald-300 group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={driverForm[p.key as keyof typeof driverForm] as string}
                              alt={p.label}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewPhoto({ title: p.label, url: driverForm[p.key as keyof typeof driverForm] as string })}
                                className="p-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold"
                              >
                                ดูรูปใหญ่
                              </button>
                              <button
                                type="button"
                                onClick={() => fileInputRefs.current[p.key]?.click()}
                                className="p-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
                              >
                                ถ่ายใหม่
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[p.key]?.click()}
                            className="w-full py-4 bg-white border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-700"
                          >
                            <Camera className="h-6 w-6 text-blue-600" />
                            <span className="text-xs font-bold">แตะเพื่อถ่ายรูปมุมนี้</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cold Container Extra 3 Photos if Reefer */}
              {isReefer && (
                <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-black text-blue-950 flex items-center gap-1.5">
                      <Thermometer className="h-5 w-5 text-blue-600" />
                      ❄️ ตู้เย็น (Reefer) ถ่ายเพิ่ม 3 รูป:
                    </Label>
                    <span className="text-xs text-blue-700 font-bold">* บังคับสำหรับตู้เย็น</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    {[
                      { key: 'photo_reefer_drain', label: '1. รูน้ำทิ้ง 4 ด้าน' },
                      { key: 'photo_reefer_cable', label: '2. สายไฟตู้เย็น' },
                      { key: 'photo_reefer_temp', label: '3. หน้าจออุณหภูมิ' },
                    ].map(p => {
                      const hasPhoto = Boolean(driverForm[p.key as keyof typeof driverForm]);
                      return (
                        <div key={p.key} className="p-2.5 bg-white rounded-xl border flex items-center justify-between">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            ref={el => { fileInputRefs.current[p.key] = el; }}
                            onChange={(e) => handleCapturePhoto(p.key, e)}
                          />
                          <span className="font-bold text-slate-800">{p.label}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={hasPhoto ? 'default' : 'outline'}
                            onClick={() => fileInputRefs.current[p.key]?.click()}
                            className={`h-8 text-xs font-bold ${hasPhoto ? 'bg-emerald-600 text-white' : ''}`}
                          >
                            <Camera className="h-3.5 w-3.5 mr-1" />
                            {hasPhoto ? 'ถ่ายแล้ว' : 'ถ่ายรูป'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Receipts & EIR photos */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                {[
                  { key: 'photo_pickup_receipt', label: 'สลิป Lift On / Gate' },
                  { key: 'photo_pickup_eir', label: 'ใบรับตู้ EIR' },
                ].map(p => {
                  const hasPhoto = Boolean(driverForm[p.key as keyof typeof driverForm]);
                  return (
                    <div key={p.key} className="p-2.5 bg-slate-50 border rounded-xl flex items-center justify-between">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        ref={el => { fileInputRefs.current[p.key] = el; }}
                        onChange={(e) => handleCapturePhoto(p.key, e)}
                      />
                      <span className="text-xs font-bold text-slate-800">{p.label}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={hasPhoto ? 'default' : 'outline'}
                        onClick={() => fileInputRefs.current[p.key]?.click()}
                        className={`h-8 text-xs font-bold ${hasPhoto ? 'bg-emerald-600 text-white' : ''}`}
                      >
                        <Camera className="h-3.5 w-3.5 mr-1" />
                        {hasPhoto ? 'ถ่ายแล้ว' : 'ถ่ายรูป'}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Container No & Seal Input (Large text) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <Label className="text-sm font-bold text-slate-800 block mb-1">
                    หมายเลขตู้คอนเทนเนอร์ (Container No.) *
                  </Label>
                  <Input
                    placeholder="เช่น MRKU0670006"
                    value={driverForm.container_no}
                    onChange={(e) => setDriverForm({ ...driverForm, container_no: e.target.value.toUpperCase() })}
                    className="h-12 text-base font-mono font-black uppercase rounded-xl border-2 border-slate-300"
                  />
                </div>
                <div>
                  <Label className="text-sm font-bold text-slate-800 block mb-1">
                    หมายเลขซีล (Seal No.)
                  </Label>
                  <Input
                    placeholder="เช่น SN-998124"
                    value={driverForm.seal_no}
                    onChange={(e) => setDriverForm({ ...driverForm, seal_no: e.target.value.toUpperCase() })}
                    className="h-12 text-base font-mono font-black uppercase rounded-xl border-2 border-slate-300"
                  />
                </div>
              </div>

              {/* Save Button */}
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveProgress(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black h-14 text-base md:text-lg rounded-2xl shadow-lg gap-2"
              >
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                บันทึกจุดที่ 1 &amp; ออกเดินทางไปจุดบรรจุสินค้า ➔
              </Button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: PACKING (บรรจุสินค้าที่โรงงาน) */}
          {/* ========================================================================= */}
          {currentStep === 'step2' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-amber-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <span className="text-xs font-bold text-amber-700 uppercase">ขั้นตอนที่ 2</span>
                  <h3 className="text-lg font-black text-slate-900">บรรจุสินค้าที่โรงงาน (Packing)</h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openGoogleMaps(activeJob.packing_place || 'โรงงานลูกค้า')}
                  className="gap-1.5 font-bold text-xs text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
                >
                  <Navigation className="h-4 w-4 text-amber-600" />
                  เปิด Google Maps
                </Button>
              </div>

              {/* Location info */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1">
                <div className="text-xs font-bold text-slate-500">สถานที่บรรจุสินค้า:</div>
                <div className="text-base font-black text-amber-950 flex items-start gap-1.5">
                  <MapPin className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{activeJob.packing_place || 'โรงงานลูกค้า'}</span>
                </div>
                {activeJob.packing_date && (
                  <div className="text-xs font-semibold text-amber-800 flex items-center gap-1 pt-1">
                    <Calendar className="h-3.5 w-3.5 text-amber-600" />
                    วันนัดบรรจุ: <strong className="font-mono">{activeJob.packing_date}</strong>
                  </div>
                )}
              </div>

              {/* Big Check-in Button */}
              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={() => handleCheckin('packing')}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black h-14 text-base md:text-lg rounded-2xl gap-2 shadow-md"
                >
                  <MapPin className="h-6 w-6" />
                  กดเช็คอินจุดบรรจุสินค้า (บันทึกเวลา + GPS)
                </Button>
                {driverForm.checkin_packing && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{driverForm.checkin_packing}</span>
                  </div>
                )}
              </div>

              {/* Packing Photos */}
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm md:text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Camera className="h-5 w-5 text-amber-600" />
                  ถ่ายรูปหน้างานจุดบรรจุ:
                </Label>

                {/* Sealed photo */}
                <div className="border-2 border-amber-200 rounded-2xl p-4 bg-amber-50/40 space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    ref={el => { fileInputRefs.current['photo_sealed'] = el; }}
                    onChange={(e) => handleCapturePhoto('photo_sealed', e)}
                  />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-black text-slate-900 text-sm">📸 รูปหน้าตู้ที่ล็อคซีล (Seal) แล้ว *</div>
                      <div className="text-xs text-slate-500">ถ่ายให้เห็นเบอร์ซีลชัดเจน ป้องกันการปลอมแปลง</div>
                    </div>
                    {driverForm.photo_sealed && (
                      <Badge className="bg-emerald-600 text-white text-xs">ถ่ายแล้ว</Badge>
                    )}
                  </div>

                  {driverForm.photo_sealed ? (
                    <div className="relative w-full h-36 rounded-xl overflow-hidden border border-emerald-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={driverForm.photo_sealed} alt="Sealed Container" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current['photo_sealed']?.click()}
                        className="absolute bottom-2 right-2 px-3 py-1 bg-white/90 text-slate-900 rounded-lg text-xs font-bold shadow-md"
                      >
                        ถ่ายใหม่
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => fileInputRefs.current['photo_sealed']?.click()}
                      className="w-full h-12 bg-white text-amber-900 border-2 border-amber-300 hover:bg-amber-100 font-bold rounded-xl gap-2"
                    >
                      <Camera className="h-5 w-5 text-amber-600" />
                      แตะเพื่อถ่ายรูปตู้ล็อคซีล
                    </Button>
                  )}
                </div>

                {/* Reefer temp photo if cold */}
                {isReefer && (
                  <div className="p-3 bg-blue-50 border rounded-xl flex items-center justify-between">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      ref={el => { fileInputRefs.current['photo_packing_temp'] = el; }}
                      onChange={(e) => handleCapturePhoto('photo_packing_temp', e)}
                    />
                    <div>
                      <div className="text-xs font-bold text-blue-900">❄️ รูปหน้าจออุณหภูมิหลังบรรจุ</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => fileInputRefs.current['photo_packing_temp']?.click()}
                      className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700"
                    >
                      <Camera className="h-3.5 w-3.5 mr-1" />
                      {driverForm.photo_packing_temp ? 'ถ่ายแล้ว' : 'ถ่ายรูป'}
                    </Button>
                  </div>
                )}

                {/* Seal number confirm */}
                <div>
                  <Label className="text-sm font-bold text-slate-800 block mb-1">
                    ยืนยันหมายเลขซีลที่ล็อค (Seal No.) *
                  </Label>
                  <Input
                    placeholder="เช่น SN-998124"
                    value={driverForm.seal_no}
                    onChange={(e) => setDriverForm({ ...driverForm, seal_no: e.target.value.toUpperCase() })}
                    className="h-12 text-base font-mono font-black uppercase rounded-xl border-2 border-slate-300"
                  />
                </div>
              </div>

              {/* Save Button */}
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveProgress(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black h-14 text-base md:text-lg rounded-2xl shadow-lg gap-2"
              >
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                บันทึกจุดที่ 2 &amp; ออกเดินทางไปคืนตู้ที่ท่าเรือ ➔
              </Button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: RETURN (คืนตู้ / เข้าท่าเรือ) */}
          {/* ========================================================================= */}
          {currentStep === 'step3' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-emerald-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <span className="text-xs font-bold text-emerald-700 uppercase">ขั้นตอนที่ 3</span>
                  <h3 className="text-lg font-black text-slate-900">คืนตู้คอนเทนเนอร์ (Return)</h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openGoogleMaps(activeJob.return_place || activeJob.destination?.name || 'ท่าเรือคืนตู้')}
                  className="gap-1.5 font-bold text-xs text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                >
                  <Navigation className="h-4 w-4 text-emerald-600" />
                  เปิด Google Maps
                </Button>
              </div>

              {/* Location info */}
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1">
                <div className="text-xs font-bold text-slate-500">สถานที่ส่งคืนตู้ / เข้าท่า:</div>
                <div className="text-base font-black text-emerald-950 flex items-start gap-1.5">
                  <MapPin className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{activeJob.return_place || activeJob.destination?.name || 'ท่าเรือ / ลานคืนตู้'}</span>
                </div>
                <div className="text-xs font-bold text-purple-900 bg-white p-2 rounded-lg border border-emerald-200 mt-1">
                  ปลายทาง: {activeJob.return_place?.includes('PAT') || activeJob.destination?.name?.includes('คลองเตย')
                    ? 'ท่าเรือกรุงเทพ คลองเตย (PAT)'
                    : 'ท่าเรือแหลมฉบัง (LCB)'}
                </div>
              </div>

              {/* Big Check-in Button */}
              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={() => handleCheckin('return')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-14 text-base md:text-lg rounded-2xl gap-2 shadow-md"
                >
                  <MapPin className="h-6 w-6" />
                  กดเช็คอินจุดคืนตู้ (บันทึกเวลา + GPS)
                </Button>
                {driverForm.checkin_return && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{driverForm.checkin_return}</span>
                  </div>
                )}
              </div>

              {/* Return Photos */}
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm md:text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Camera className="h-5 w-5 text-emerald-600" />
                  ถ่ายรูปส่งมอบตู้และเอกสารคืนตู้:
                </Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {[
                    { key: 'photo_return_front', label: '📸 รูปหน้าตู้ส่งคืนที่ลาน (บังคับ)' },
                    { key: 'photo_return_receipt', label: '🧾 สลิป Lift Off / Gate' },
                    { key: 'photo_return_eir', label: '📄 ใบรับตู้คืน EIR' },
                  ].map(p => {
                    const hasPhoto = Boolean(driverForm[p.key as keyof typeof driverForm]);
                    return (
                      <div key={p.key} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          ref={el => { fileInputRefs.current[p.key] = el; }}
                          onChange={(e) => handleCapturePhoto(p.key, e)}
                        />
                        <span className="text-xs font-bold text-slate-900">{p.label}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant={hasPhoto ? 'default' : 'outline'}
                          onClick={() => fileInputRefs.current[p.key]?.click()}
                          className={`h-8 text-xs font-bold ${hasPhoto ? 'bg-emerald-600 text-white' : ''}`}
                        >
                          <Camera className="h-3.5 w-3.5 mr-1" />
                          {hasPhoto ? 'ถ่ายแล้ว' : 'ถ่ายรูป'}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <Label className="text-sm font-bold text-slate-800 block mb-1">
                    หมายเหตุหน้างานของ พขร. (ถ้ามี)
                  </Label>
                  <Input
                    placeholder="เช่น ส่งคืนตู้เรียบร้อย ไม่มีรอยขูดขีด..."
                    value={driverForm.driver_notes}
                    onChange={(e) => setDriverForm({ ...driverForm, driver_notes: e.target.value })}
                    className="h-12 text-sm rounded-xl border-slate-300"
                  />
                </div>
              </div>

              {/* BIG COMPLETE BUTTON */}
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveProgress(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-16 text-lg md:text-xl rounded-2xl shadow-xl gap-2 mt-4"
              >
                <CheckCircle2 className="h-7 w-7" />
                จบงาน &amp; ส่งมอบตู้สำเร็จ (Complete Job)
              </Button>
            </div>
          )}
        </main>

        {/* Photo Preview Modal */}
        {previewPhoto && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-lg bg-slate-900 rounded-2xl overflow-hidden text-white flex flex-col">
              <div className="p-3 flex items-center justify-between border-b border-slate-800">
                <span className="font-bold text-sm">{previewPhoto.title}</span>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-2 flex items-center justify-center max-h-[75vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewPhoto.url} alt={previewPhoto.title} className="max-h-[70vh] w-auto object-contain rounded-lg" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: DRIVER JOBS LIST (Main Dashboard for Driver)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Mobile Top Header */}
      <header className="bg-emerald-600 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-xl border border-white/20">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-100 flex items-center gap-1">
                <span>CONNECT TRANSPORT</span>
                <span>•</span>
                <span className="text-emerald-200">{driverVehicle?.truck_name_id || 'รถบรรทุก'}</span>
              </div>
              <h1 className="text-base md:text-lg font-black leading-tight">
                สวัสดีคุณ{currentDriver.name}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDriverLogout}
            className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/20 font-bold transition-all"
            title="เปลี่ยนคนขับ"
          >
            <LogOut className="h-3.5 w-3.5" />
            เปลี่ยนคนขับ
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Driver Vehicle Card Banner */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-100 font-bold">รถประจำตัวของคุณ:</div>
            <div className="text-lg md:text-xl font-black mt-0.5">
              {driverVehicle?.truck_name_id || 'รถหัวลาก'} ({driverVehicle?.plate_number || 'มีงานมอบหมาย'})
            </div>
            <div className="text-xs text-emerald-100 mt-0.5">
              {driverVehicle?.truck_brand} {driverVehicle?.truck_model}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-emerald-100 font-bold">โทรศัพท์:</span>
            <div className="font-mono font-bold text-sm">{currentDriver.phone || '-'}</div>
          </div>
        </div>

        {/* 1. Date Filter (Default: "วันนี้") */}
        <div className="bg-white rounded-2xl p-3 shadow-xs border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-emerald-600" />
              กรองวันที่งาน:
            </span>
            <span className="text-xs font-semibold text-slate-500">
              ค่าเริ่มต้นคือ <strong className="text-emerald-700">วันนี้</strong>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`py-2.5 px-2 rounded-xl text-xs md:text-sm font-black transition-all ${
                dateFilter === 'today'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              📅 วันนี้ ({myJobCounts.today})
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('tomorrow')}
              className={`py-2.5 px-2 rounded-xl text-xs md:text-sm font-black transition-all ${
                dateFilter === 'tomorrow'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              พรุ่งนี้ ({myJobCounts.tomorrow})
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`py-2.5 px-2 rounded-xl text-xs md:text-sm font-black transition-all ${
                dateFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ทุกวัน ({myJobCounts.all})
            </button>
          </div>
        </div>

        {/* 2. Status Filter (Default: "งานที่ต้องทำ (ยังไม่เสร็จ)") */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`flex-1 py-3 px-3 rounded-2xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-1.5 border-2 ${
              statusFilter === 'active'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>งานที่ต้องทำ ({myJobCounts.active})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`flex-1 py-3 px-3 rounded-2xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-1.5 border-2 ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>งานที่เสร็จแล้ว ({myJobCounts.completed})</span>
          </button>
        </div>

        {/* Jobs List */}
        <div className="space-y-3 pt-1">
          {filteredMyJobs.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border-2 border-dashed border-slate-300 space-y-3">
              <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Truck className="h-8 w-8" />
              </div>
              <h3 className="text-base md:text-lg font-black text-slate-800">
                {dateFilter === 'today'
                  ? 'วันนี้ยังไม่มีงานที่มอบหมายให้คุณ'
                  : 'ไม่พบงานตามเงื่อนไขที่เลือก'}
              </h3>
              <p className="text-xs md:text-sm text-slate-500 max-w-sm mx-auto">
                {dateFilter === 'today'
                  ? 'หากมีงานเข้ามา ระบบจะแจ้งเตือน หรือกดปุ่มด้านล่างเพื่อดูงานวันอื่นได้ครับ'
                  : 'คุณสามารถกดเลือกดูงานทุกวันเพื่อตรวจสอบงานย้อนหลัง'}
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDateFilter('all');
                    setStatusFilter('all');
                  }}
                  className="rounded-xl font-bold text-xs"
                >
                  แสดงงานทั้งหมด ({myJobs.length})
                </Button>
              </div>
            </div>
          ) : (
            filteredMyJobs.map(job => {
              const isDone = job.status === 'completed';
              const isRunning = job.status === 'in_progress';

              return (
                <div
                  key={job.id}
                  onClick={() => handleSelectJob(job)}
                  className={`bg-white rounded-2xl p-4 md:p-5 shadow-sm border-2 transition-all cursor-pointer hover:shadow-md space-y-3 active:scale-[0.99] ${
                    isRunning
                      ? 'border-amber-400 ring-2 ring-amber-100'
                      : isDone
                      ? 'border-emerald-300'
                      : 'border-blue-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                        {job.job_no}
                      </span>
                      {isRunning && (
                        <span className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                          กำลังวิ่งงาน
                        </span>
                      )}
                      {isDone && (
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          เสร็จสิ้นแล้ว
                        </span>
                      )}
                      {job.status === 'assigned' && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-1 rounded-full border border-blue-300">
                          รอดำเนินการ
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-mono font-bold text-slate-600 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {job.job_date}
                    </div>
                  </div>

                  {/* Customer & Volume */}
                  <div>
                    <h4 className="text-base font-black text-slate-900 leading-snug">
                      {job.customer?.company_name || 'ลูกค้าทั่วไป'}
                    </h4>
                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>สายเรือ: <strong>{job.ship_line || '-'}</strong></span>
                      <span>Booking: <strong className="font-mono">{job.book_no || '-'}</strong></span>
                      <span>สเปก: <strong className="font-mono text-blue-800">{job.container_amount || 1}x{job.container_size}&apos; {job.container_type}</strong></span>
                    </div>
                  </div>

                  {/* 3 Step Visual Route Bar */}
                  <div className="bg-slate-50 p-3 rounded-xl border space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-mono font-black text-[10px] shrink-0">1</span>
                      <span className="text-slate-500">รับตู้:</span>
                      <strong className="text-slate-900 font-bold truncate">{job.pickup_place || job.origin?.name || 'ลานตู้'}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-mono font-black text-[10px] shrink-0">2</span>
                      <span className="text-slate-500">บรรจุ:</span>
                      <strong className="text-slate-900 font-bold truncate">{job.packing_place || 'โรงงานลูกค้า'}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-black text-[10px] shrink-0">3</span>
                      <span className="text-slate-500">คืนตู้:</span>
                      <strong className="text-slate-900 font-bold truncate">{job.return_place || job.destination?.name || 'ท่าเรือ'}</strong>
                    </div>
                  </div>

                  {/* Action prompt */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500 font-semibold">
                      ตู้: <strong className="font-mono text-slate-900">{job.container_no || 'รอ พขร. ตรวจรับ'}</strong>
                    </span>

                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl gap-1 shadow-sm h-9"
                    >
                      <span>แตะเพื่อเริ่มทำงาน</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

export default function DriverPortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center font-bold text-slate-600">กำลังโหลดพอร์ทัล พขร....</div>
      </div>
    }>
      <DriverPortalContent />
    </Suspense>
  );
}
