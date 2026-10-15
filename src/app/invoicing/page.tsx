'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Job, Customer } from '@/types/database';
import { logActivity } from '@/lib/audit-logger';
import { useAuth } from '@/lib/auth-context';
import { SortableHeader, sortArray, SortState } from '@/components/ui/table-sort';
import { 
  ReceiptText, 
  FileText, 
  Printer, 
  CheckCircle2, 
  Clock, 
  Building2, 
  DollarSign, 
  RefreshCw, 
  Anchor, 
  AlertCircle,
  FileCheck2,
  TrendingUp,
  Percent,
  Download,
  Edit3,
  Plus,
  Trash2,
  Calculator,
  Save,
  Check,
  Filter,
  Search,
  RotateCcw,
  Lock,
  Calendar,
  X
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

const patStatusMap: Record<string, { label: string; badgeClass: string }> = {
  none: { label: 'ไม่ต้องทำ PAT', badgeClass: 'bg-slate-100 text-slate-600' },
  pending: { label: 'รอออกจดหมาย', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  issued: { label: 'ออกจดหมายแล้ว', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  completed: { label: 'เปลี่ยนใบเสร็จสำเร็จ', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

// Safe math formula evaluator (e.g. "=2*220+2*600" -> 1640)
function evaluateMathFormula(input: string): number {
  if (!input) return 0;
  const expr = input.replace(/^=/, '').trim();
  if (!expr) return 0;
  // Only allow valid mathematical characters
  if (!/^[0-9+\-*/. ()]+$/.test(expr)) {
    return parseFloat(expr) || 0;
  }
  try {
    const result = Function(`'use strict'; return (${expr})`)();
    return isNaN(result) ? 0 : Number(result);
  } catch {
    return parseFloat(expr) || 0;
  }
}

// Convert western year to Thai Buddhist year (e.g. 2026 -> 2569)
function toThaiDateString(dateObj: Date): string {
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear() + 543;
  return `${d}/${m}/${y}`;
}

interface ExtraChargeItem {
  id: string;
  description: string;
  formula: string; // e.g. "=2*220+2*600"
  amount: number;
  category: 'advance' | 'transport';
}

export default function InvoicingPage() {
  const { currentUser, currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState('invoices');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayDateStr, setTodayDateStr] = useState('');

  // Modals
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [openEditInvoiceModal, setOpenEditInvoiceModal] = useState(false);
  const [openPatModal, setOpenPatModal] = useState(false);

  // Filter States (Default job status is 'completed' as requested)
  const [jobStatusFilter, setJobStatusFilter] = useState('completed');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all'); // all | pending | billed
  const [dateFilterType, setDateFilterType] = useState('all'); // all | today | this_month | last_month | custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper to read saved invoice data from LocalStorage
  const getSavedInvoiceData = (jobId: string, invoiceNo?: string | null) => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`connect_invoice_data_${jobId}`) || 
        (invoiceNo ? localStorage.getItem(`connect_invoice_data_${invoiceNo}`) : null);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error reading invoice from localStorage', e);
    }
    return null;
  };

  // Active Invoice Form State (for printing & editing)
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_no: '6807-217',
    invoice_date: '',
    credit_days: '30 DAYS',
    customer_name: '',
    customer_branch: 'สำนักงานใหญ่',
    customer_address: '',
    customer_tax_id: '',
    container_no: '',
    container_type_20: 0,
    container_type_40: 1,
    transport_description: 'TRANSPORTATION CHARGE @ 5,700.00',
    transport_amount: 5700,
    consignee_shipper: 'SHIPPER: ELECTRICAL COMPONENTS CO.,LTD.',
    booking_bl: 'BOOKING NO. 256674749',
    route_note: '( KRC - KLONGLUANG - LCB B1 )',
    extra_items: [] as ExtraChargeItem[],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [jobsRes, custRes] = await Promise.all([
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
      ]);

      if (jobsRes.data) setJobs(jobsRes.data as Job[]);
      if (custRes.data) setCustomers(custRes.data as Customer[]);
    } catch (err) {
      console.error('Error fetching invoicing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setTodayDateStr(toThaiDateString(new Date()));
  }, []);

  // Update PAT Status
  const handleUpdatePatStatus = async (jobId: string, newStatus: string) => {
    const { error } = await supabase
      .from('jobs')
      .update({ pat_letter_status: newStatus })
      .eq('id', jobId);

    if (!error) {
      logActivity({
        user_id: currentUser?.id || 'sys',
        user_name: currentUser?.name || 'User',
        user_role: currentRole?.id || 'accountant',
        action: 'UPDATE',
        module: 'INVOICING',
        description: `อัปเดตสถานะจดหมาย PAT ของงาน ${jobId} เป็น ${newStatus}`,
      });
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ PAT: ' + error.message);
    }
  };

  // Close Job Action
  const handleCloseJob = async (jobId: string) => {
    if (!confirm('ยืนยันที่จะปิดงานและสรุปผลกำไรขั้นสุดท้ายของเที่ยวนี้หรือไม่?')) return;
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', jobId);

    if (!error) {
      logActivity({
        user_id: currentUser?.id || 'sys',
        user_name: currentUser?.name || 'User',
        user_role: currentRole?.id || 'accountant',
        action: 'CLOSE_JOB',
        module: 'INVOICING',
        description: `ปิดงานขนส่งสำเร็จ: Job ID ${jobId}`,
      });
      alert('✅ ปิดงานและสรุปผลกำไรสำเร็จ!');
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  // Reset Filters to Default
  const handleResetFilters = () => {
    setJobStatusFilter('completed');
    setInvoiceStatusFilter('all');
    setDateFilterType('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
  };

  // Populate Invoice Form from Job (Prioritizing Saved Revisions in LocalStorage)
  const populateInvoiceFromJob = (job: Job) => {
    // 1. Check if we have previously saved custom items / revised invoice for this job
    const saved = getSavedInvoiceData(job.id, job.invoice_no);
    if (saved && Array.isArray(saved.extra_items)) {
      setInvoiceForm(saved);
      return;
    }

    // 2. Otherwise generate default template
    const is20 = job.container_size === '20';
    const amount = job.container_amount || 1;
    const singleRate = Number(job.price || job.revenue || 5500) / amount;
    const totalTransport = Number(job.revenue || 5500);

    const generatedInvNo = job.invoice_no || `6807-${job.job_no.replace('TMS-', '').replace(/^[0-9]+-/, '') || '217'}`;

    setInvoiceForm({
      invoice_no: generatedInvNo,
      invoice_date: todayDateStr || toThaiDateString(new Date()),
      credit_days: job.customer?.credit_term_days ? `${job.customer.credit_term_days} DAYS` : '30 DAYS',
      customer_name: job.customer?.company_name || 'บริษัท ปทุม ทรานสปอร์ต จำกัด',
      customer_branch: job.customer?.branch || 'สำนักงานใหญ่',
      customer_address: job.customer?.address || '66/53 หมู่ที่ 19 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120',
      customer_tax_id: job.customer?.tax_id || '0135563000175',
      container_no: job.container_no || 'TLLU2959650',
      container_type_20: is20 ? amount : 0,
      container_type_40: !is20 ? amount : 0,
      transport_description: `TRANSPORTATION CHARGE @ ${singleRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      transport_amount: totalTransport,
      consignee_shipper: job.shipper_name ? `SHIPPER: ${job.shipper_name}` : 'SHIPPER: ELECTRICAL COMPONENTS CO.,LTD.',
      booking_bl: job.book_no ? `BOOKING NO. ${job.book_no}` : job.bl_no ? `B/L NO. ${job.bl_no}` : 'BOOKING NO. 256674749',
      route_note: `( ${job.pickup_place || job.origin?.name || 'KRC'} - ${job.packing_place || 'KLONGLUANG'} - ${job.return_place || job.destination?.name || 'LCB B1'} )`,
      extra_items: [
        {
          id: 'item_1',
          description: 'LIFT ON/OFF & GATE CHARGE',
          formula: '=2*220+2*600',
          amount: 1640.00,
          category: 'advance',
        }
      ],
    });
  };

  // Reset current invoice to standard default
  const handleResetInvoiceToDefault = () => {
    if (!selectedJob) return;
    if (!confirm('ยืนยันที่จะคืนค่าเริ่มต้น (ล้างรายการที่เคยบันทึกเพิ่มเติม) หรือไม่?')) return;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`connect_invoice_data_${selectedJob.id}`);
      if (selectedJob.invoice_no) {
        localStorage.removeItem(`connect_invoice_data_${selectedJob.invoice_no}`);
      }
    }

    const is20 = selectedJob.container_size === '20';
    const amount = selectedJob.container_amount || 1;
    const singleRate = Number(selectedJob.price || selectedJob.revenue || 5500) / amount;
    const totalTransport = Number(selectedJob.revenue || 5500);
    const generatedInvNo = selectedJob.invoice_no || `6807-${selectedJob.job_no.replace('TMS-', '').replace(/^[0-9]+-/, '') || '217'}`;

    setInvoiceForm({
      invoice_no: generatedInvNo,
      invoice_date: todayDateStr || toThaiDateString(new Date()),
      credit_days: selectedJob.customer?.credit_term_days ? `${selectedJob.customer.credit_term_days} DAYS` : '30 DAYS',
      customer_name: selectedJob.customer?.company_name || 'บริษัท ปทุม ทรานสปอร์ต จำกัด',
      customer_branch: selectedJob.customer?.branch || 'สำนักงานใหญ่',
      customer_address: selectedJob.customer?.address || '66/53 หมู่ที่ 19 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120',
      customer_tax_id: selectedJob.customer?.tax_id || '0135563000175',
      container_no: selectedJob.container_no || 'TLLU2959650',
      container_type_20: is20 ? amount : 0,
      container_type_40: !is20 ? amount : 0,
      transport_description: `TRANSPORTATION CHARGE @ ${singleRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      transport_amount: totalTransport,
      consignee_shipper: selectedJob.shipper_name ? `SHIPPER: ${selectedJob.shipper_name}` : 'SHIPPER: ELECTRICAL COMPONENTS CO.,LTD.',
      booking_bl: selectedJob.book_no ? `BOOKING NO. ${selectedJob.book_no}` : selectedJob.bl_no ? `B/L NO. ${selectedJob.bl_no}` : 'BOOKING NO. 256674749',
      route_note: `( ${selectedJob.pickup_place || selectedJob.origin?.name || 'KRC'} - ${selectedJob.packing_place || 'KLONGLUANG'} - ${selectedJob.return_place || selectedJob.destination?.name || 'LCB B1'} )`,
      extra_items: [
        {
          id: 'item_1',
          description: 'LIFT ON/OFF & GATE CHARGE',
          formula: '=2*220+2*600',
          amount: 1640.00,
          category: 'advance',
        }
      ],
    });
    alert('✅ คืนค่าเริ่มต้นเรียบร้อยแล้ว');
  };

  // Open Invoice Modal
  const handleOpenInvoice = (job: Job) => {
    setSelectedJob(job);
    populateInvoiceFromJob(job);
    setOpenInvoiceModal(true);
  };

  // Open Edit / Revise Invoice Modal
  const handleOpenEditInvoice = (job: Job) => {
    setSelectedJob(job);
    populateInvoiceFromJob(job);
    setOpenEditInvoiceModal(true);
  };

  // Save Revised Invoice (Persisting to LocalStorage + Supabase)
  const handleSaveRevisedInvoice = async () => {
    if (!selectedJob) return;

    // Recalculate Totals
    const totalAdv = invoiceForm.extra_items
      .filter(i => i.category === 'advance')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalTrans = Number(invoiceForm.transport_amount || 0) + 
      invoiceForm.extra_items
        .filter(i => i.category === 'transport')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const tax1 = Math.round((totalTrans * 0.01) * 100) / 100;
    const netTrans = totalTrans - tax1;
    const grandTot = totalAdv + netTrans;

    // 1. Save complete invoice data to LocalStorage (Persist extra_items & formulas)
    if (typeof window !== 'undefined') {
      const dataToSave = {
        ...invoiceForm,
        last_saved_at: new Date().toISOString(),
        total_advance: totalAdv,
        total_transport: totalTrans,
        tax_1_percent: tax1,
        grand_total: grandTot,
      };
      localStorage.setItem(`connect_invoice_data_${selectedJob.id}`, JSON.stringify(dataToSave));
      if (invoiceForm.invoice_no) {
        localStorage.setItem(`connect_invoice_data_${invoiceForm.invoice_no}`, JSON.stringify(dataToSave));
      }
    }

    // 2. Update Supabase jobs record
    const { error } = await supabase
      .from('jobs')
      .update({ 
        invoice_no: invoiceForm.invoice_no,
        invoice_status: 'billed',
        price: invoiceForm.transport_amount,
        addon_price: totalAdv,
        revenue: grandTot,
      })
      .eq('id', selectedJob.id);

    // 3. Immediately update in-memory jobs state so UI refreshes without lag
    setJobs(prevJobs => prevJobs.map(j => {
      if (j.id === selectedJob.id) {
        return {
          ...j,
          invoice_no: invoiceForm.invoice_no,
          invoice_status: 'billed',
          price: invoiceForm.transport_amount,
          addon_price: totalAdv,
          revenue: grandTot,
        };
      }
      return j;
    }));

    if (!error) {
      logActivity({
        user_id: currentUser?.id || 'sys',
        user_name: currentUser?.name || 'User',
        user_role: currentRole?.id || 'accountant',
        action: 'UPDATE',
        module: 'INVOICING',
        description: `ปรับปรุงใบแจ้งหนี้ (Revise Invoice): ${invoiceForm.invoice_no} สำหรับงาน ${selectedJob.job_no} (รวม ฿${grandTot.toLocaleString()})`,
      });
      setOpenEditInvoiceModal(false);
      alert(`✅ บันทึกการแก้ไขใบแจ้งหนี้ ${invoiceForm.invoice_no} เรียบร้อยแล้ว!\n• เงินทดรองจ่าย: ฿${totalAdv.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• ค่าขนส่ง: ฿${totalTrans.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• ยอดรวมสุทธิ: ฿${grandTot.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\nระบบบันทึกรายการเพิ่มและสูตรคำนวณไว้เรียบร้อยแล้ว เมื่อกด 'พิมพ์ Invoice' รายการเหล่านี้จะแสดงผลอย่างครบถ้วน`);
    } else {
      setOpenEditInvoiceModal(false);
      alert(`✅ บันทึกข้อมูลการแก้ไขเรียบร้อยแล้ว (บันทึกในเครื่องสำเร็จ)`);
    }
  };

  // Open PAT Modal
  const handleOpenPat = (job: Job) => {
    setSelectedJob(job);
    setOpenPatModal(true);
  };

  // Calculate Totals for Modal Previews
  const totalAdvance = invoiceForm.extra_items
    .filter(i => i.category === 'advance')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalTransport = Number(invoiceForm.transport_amount || 0) + 
    invoiceForm.extra_items
      .filter(i => i.category === 'transport')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  // WHT 1% is computed ONLY on transport (Advance is 0% tax!)
  const tax1Percent = Math.round((totalTransport * 0.01) * 100) / 100;
  const netTransport = totalTransport - tax1Percent;
  const netAdvance = totalAdvance;
  const grandTotal = netAdvance + netTransport;

  // Filter Jobs
  const patJobs = jobs.filter((j) => j.pat_letter_required);

  // Table Sorting States
  const [invoiceSort, setInvoiceSort] = useState<SortState>({ key: 'job_date', direction: 'desc' });
  const [patSort, setPatSort] = useState<SortState>({ key: 'job_date', direction: 'desc' });

  const handleInvoiceSort = (key: string) => {
    setInvoiceSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePatSort = (key: string) => {
    setPatSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Multi-Criteria Filtered Jobs (Defaults to completed jobs)
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 1. Job Status filter (Default is 'completed')
      if (jobStatusFilter !== 'all' && job.status !== jobStatusFilter) {
        return false;
      }

      // 2. Invoice Status filter
      if (invoiceStatusFilter === 'pending') {
        if (job.invoice_no || job.invoice_status === 'billed') return false;
      } else if (invoiceStatusFilter === 'billed') {
        if (!job.invoice_no && job.invoice_status !== 'billed') return false;
      }

      // 3. Date filter
      if (dateFilterType !== 'all') {
        const jobDateStr = job.job_date; // YYYY-MM-DD
        if (!jobDateStr) return false;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        if (dateFilterType === 'today') {
          if (jobDateStr !== todayStr) return false;
        } else if (dateFilterType === 'this_month') {
          const currentYearMonth = `${year}-${month}`;
          if (!jobDateStr.startsWith(currentYearMonth)) return false;
        } else if (dateFilterType === 'last_month') {
          const lastMonthObj = new Date(year, now.getMonth() - 1, 1);
          const lmYear = lastMonthObj.getFullYear();
          const lmMonth = String(lastMonthObj.getMonth() + 1).padStart(2, '0');
          const lastYearMonth = `${lmYear}-${lmMonth}`;
          if (!jobDateStr.startsWith(lastYearMonth)) return false;
        } else if (dateFilterType === 'custom') {
          if (customStartDate && jobDateStr < customStartDate) return false;
          if (customEndDate && jobDateStr > customEndDate) return false;
        }
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNo = job.job_no?.toLowerCase().includes(q);
        const matchInv = job.invoice_no?.toLowerCase().includes(q);
        const matchCust = job.customer?.company_name?.toLowerCase().includes(q);
        const matchContainer = job.container_no?.toLowerCase().includes(q);
        const matchBook = (job.book_no || job.booking_no || '')?.toLowerCase().includes(q);
        const matchShipper = job.shipper_name?.toLowerCase().includes(q);
        if (!matchNo && !matchInv && !matchCust && !matchContainer && !matchBook && !matchShipper) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, jobStatusFilter, invoiceStatusFilter, dateFilterType, customStartDate, customEndDate, searchQuery]);

  const sortedJobs = useMemo(() => {
    return sortArray(filteredJobs, invoiceSort.key, invoiceSort.direction, (item) => {
      if (invoiceSort.key === 'customer') return item.customer?.company_name || '';
      return (item as any)[invoiceSort.key];
    });
  }, [filteredJobs, invoiceSort]);

  const sortedPatJobs = useMemo(() => {
    return sortArray(patJobs, patSort.key, patSort.direction, (item) => {
      if (patSort.key === 'customer') return item.customer?.company_name || '';
      if (patSort.key === 'tax_id') return item.customer?.tax_id || '';
      return (item as any)[patSort.key];
    });
  }, [patJobs, patSort]);

  // Financial Metrics
  const totalBilled = jobs.reduce((s, j) => s + Number(j.revenue || 0), 0);
  const totalCosts = jobs.reduce((s, j) => s + Number(j.total_cost || 0), 0);
  const totalProfit = totalBilled - totalCosts;
  const pendingPatCount = patJobs.filter((j) => j.pat_letter_status === 'pending').length;

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Module 5: Invoicing &amp; Closing
            </span>
            <span className="text-xs text-slate-500">Connect Transport Co., Ltd. (สาขาที่ 00001)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <ReceiptText className="h-7 w-7 text-blue-600" />
            การออกบิลและการปิดงาน (Invoicing &amp; Closing)
          </h1>
          <p className="text-slate-500 text-sm">
            ออกใบแจ้งหนี้จริง (แยกเงินทดรองจ่าย &amp; ค่าขนส่ง หักภาษี 1% เฉพาะค่าขนส่ง พร้อมช่องสูตรคำนวณ Excel) และจดหมายท่าเรือ PAT
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
            รีเฟรชข้อมูล
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-blue-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">ยอดวางบิลรวม (Total Invoiced)</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">฿{totalBilled.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">ยอดรายได้จากทุกเที่ยววิ่งในระบบ</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-rose-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">ต้นทุนรวมที่เกิดขึ้น (Total Costs)</CardTitle>
            <TrendingUp className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">฿{totalCosts.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">ค่าน้ำมัน, เบี้ยเลี้ยง พขร., ทางด่วน, OT</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">กำไรสุทธิรวม (Realized Profit)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">฿{totalProfit.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">รายได้ หัก ต้นทุนทุกเที่ยววิ่ง</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-purple-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-purple-900">เอกสารท่าเรือ (PAT Letters)</CardTitle>
            <Anchor className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{patJobs.length} ฉบับ</div>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">รอดำเนินการ {pendingPatCount} ฉบับ</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-200 p-1 rounded-xl">
          <TabsTrigger value="invoices" className="gap-2">
            <ReceiptText className="h-4 w-4" />
            การออกใบแจ้งหนี้ &amp; วางบิล ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="pat-letters" className="gap-2">
            <Anchor className="h-4 w-4 text-purple-700" />
            จดหมายเปลี่ยนใบเสร็จท่าเรือ PAT ({patJobs.length})
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: INVOICES ================= */}
        <TabsContent value="invoices">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-3 gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>รายการงานขนส่งสำหรับออกบิลลูกค้า</span>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    แสดง {sortedJobs.length} จาก {jobs.length} งาน
                  </Badge>
                </CardTitle>
                <CardDescription>
                  ออกใบแจ้งหนี้ (Invoice) มาตรฐาน Connect Transport สำหรับงานที่เสร็จสิ้นแล้ว, คำนวณภาษีหัก ณ ที่จ่าย 1% เฉพาะค่าขนส่ง
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* ================= FILTER BAR ================= */}
              <div className="p-3.5 bg-slate-100/80 rounded-xl border border-slate-200 space-y-3">
                {/* Row 1: Primary Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
                  {/* Search Box (4 cols) */}
                  <div className="lg:col-span-4 relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหา Job ID, เลขบิล, ลูกค้า, ตู้, Booking..."
                      className="pl-9 pr-8 text-xs bg-white h-9"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="ล้างคำค้นหา"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Job Status Filter (3 cols) - DEFAULT: 'completed' */}
                  <div className="lg:col-span-3">
                    <div className="flex items-center gap-1.5 bg-white border rounded-md px-2.5 h-9">
                      <Filter className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-600 shrink-0">สถานะงาน:</span>
                      <select
                        value={jobStatusFilter}
                        onChange={(e) => setJobStatusFilter(e.target.value)}
                        aria-label="กรองสถานะงาน"
                        className="w-full bg-transparent text-xs font-semibold text-slate-900 border-none focus:outline-none cursor-pointer"
                      >
                        <option value="completed">✅ งานเสร็จสิ้น (พร้อมออกบิล) [ค่าเริ่มต้น]</option>
                        <option value="all">📁 ทุกสถานะงาน (รวมทั้งหมด)</option>
                        <option value="in_progress">🚚 กำลังวิ่งงาน (ยังไม่เสร็จ)</option>
                        <option value="assigned">📋 จ่ายงานแล้ว (ยังไม่เสร็จ)</option>
                        <option value="draft">📝 ร่าง (ยังไม่จ่ายรถ)</option>
                        <option value="cancelled">❌ ยกเลิก</option>
                      </select>
                    </div>
                  </div>

                  {/* Invoice Status Filter (2 cols) */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-1.5 bg-white border rounded-md px-2.5 h-9">
                      <ReceiptText className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <select
                        value={invoiceStatusFilter}
                        onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                        aria-label="กรองสถานะบิล"
                        className="w-full bg-transparent text-xs font-semibold text-slate-900 border-none focus:outline-none cursor-pointer"
                      >
                        <option value="all">บิลทั้งหมด</option>
                        <option value="pending">⏳ ยังไม่ออกบิล</option>
                        <option value="billed">✓ ออกบิลแล้ว</option>
                      </select>
                    </div>
                  </div>

                  {/* Date Filter Mode (2 cols) */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-1.5 bg-white border rounded-md px-2.5 h-9">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <select
                        value={dateFilterType}
                        onChange={(e) => setDateFilterType(e.target.value)}
                        aria-label="กรองวันที่วิ่งงาน"
                        className="w-full bg-transparent text-xs font-semibold text-slate-900 border-none focus:outline-none cursor-pointer"
                      >
                        <option value="all">ทุกช่วงวันที่</option>
                        <option value="today">📅 วิ่งงานวันนี้</option>
                        <option value="this_month">🗓️ เดือนนี้</option>
                        <option value="last_month">🗓️ เดือนที่แล้ว</option>
                        <option value="custom">🔍 กำหนดช่วงวันที่...</option>
                      </select>
                    </div>
                  </div>

                  {/* Reset Button (1 col) */}
                  <div className="lg:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      className="h-9 w-full text-xs text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 gap-1 px-2"
                      title="รีเซ็ตตัวกรองทั้งหมดเป็นค่าเริ่มต้น (งานเสร็จสิ้น)"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">รีเซ็ต</span>
                    </Button>
                  </div>
                </div>

                {/* Row 2: Custom Date Inputs (if custom is selected) */}
                {dateFilterType === 'custom' && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/80 text-xs bg-white p-2.5 rounded-md">
                    <span className="font-semibold text-slate-700">ช่วงวันที่วิ่งงาน:</span>
                    <div className="flex items-center gap-2">
                      <label className="text-slate-500">ตั้งแต่:</label>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="h-8 text-xs w-36"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-slate-500">ถึง:</label>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="h-8 text-xs w-36"
                      />
                    </div>
                  </div>
                )}

                {/* Active Filters Summary Bar */}
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500">มุมมองปัจจุบัน:</span>
                    {jobStatusFilter === 'completed' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> เฉพาะงานเสร็จสิ้น (พร้อมออกบิล)
                      </span>
                    ) : jobStatusFilter === 'all' ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-semibold">
                        ทุกสถานะงาน
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                        สถานะ: {jobStatusFilter}
                      </span>
                    )}

                    {invoiceStatusFilter !== 'all' && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-semibold">
                        บิล: {invoiceStatusFilter === 'billed' ? 'ออกบิลแล้ว' : 'ยังไม่ออกบิล'}
                      </span>
                    )}

                    {dateFilterType !== 'all' && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold">
                        วันที่: {dateFilterType === 'today' ? 'วันนี้' : dateFilterType === 'this_month' ? 'เดือนนี้' : dateFilterType === 'last_month' ? 'เดือนที่แล้ว' : `${customStartDate || '...'} ถึง ${customEndDate || '...'}`}
                      </span>
                    )}

                    {searchQuery && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-semibold">
                        ค้นหา: &quot;{searchQuery}&quot;
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500">
                    พบ {sortedJobs.length} รายการ
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/70 text-xs">
                      <SortableHeader title="Job ID" sortKey="job_no" currentSort={invoiceSort} onSort={handleInvoiceSort} className="font-bold text-blue-900" />
                      <SortableHeader title="วันที่วิ่งงาน" sortKey="job_date" currentSort={invoiceSort} onSort={handleInvoiceSort} className="font-bold" />
                      <SortableHeader title="ลูกค้าผู้ว่าจ้าง" sortKey="customer" currentSort={invoiceSort} onSort={handleInvoiceSort} className="font-bold" />
                      <SortableHeader title="Invoice No." sortKey="invoice_no" currentSort={invoiceSort} onSort={handleInvoiceSort} className="font-bold text-purple-900" />
                      <SortableHeader title="หมายเลขตู้ / ซีล" sortKey="container_no" currentSort={invoiceSort} onSort={handleInvoiceSort} />
                      <SortableHeader title="สถานะงาน" sortKey="status" currentSort={invoiceSort} onSort={handleInvoiceSort} />
                      <SortableHeader title="ยอดเรียกเก็บ (บาท)" sortKey="revenue" currentSort={invoiceSort} onSort={handleInvoiceSort} align="right" className="font-bold text-slate-900" />
                      <SortableHeader title="กำไรสุทธิ" sortKey="net_profit" currentSort={invoiceSort} onSort={handleInvoiceSort} align="right" className="font-bold text-emerald-800" />
                      <TableHead className="text-center font-bold">จัดการบิล</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-slate-500 space-y-2">
                          <ReceiptText className="h-10 w-10 text-slate-300 mx-auto" />
                          <p className="font-semibold text-slate-700">ไม่พบรายการงานขนส่งตามเงื่อนไขตัวกรอง</p>
                          <p className="text-xs text-slate-400">
                            {jobStatusFilter === 'completed' 
                              ? 'ขณะนี้ไม่มีงานที่มีสถานะ "เสร็จสิ้น" หากต้องการดูงานทั้งหมด ให้เปลี่ยนตัวกรองเป็น "ทุกสถานะงาน"' 
                              : 'ลองปรับเปลี่ยนคำค้นหาหรือตัวกรองช่วงวันที่'}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className="text-xs mt-2"
                          >
                            รีเซ็ตตัวกรองเป็นค่าเริ่มต้น
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedJobs.map((j) => (
                        <TableRow key={j.id} className="hover:bg-slate-50/80 text-xs">
                          <TableCell className="font-bold text-blue-700 font-mono whitespace-nowrap">
                            {j.job_no}
                          </TableCell>
                          <TableCell className="text-slate-600 whitespace-nowrap">
                            {j.job_date}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900 max-w-[170px] truncate">
                            {j.customer?.company_name || 'ลูกค้าทั่วไป'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono font-bold">
                            {j.invoice_no ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {j.invoice_no}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">ยังไม่ออกบิล</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">
                            {j.container_no ? (
                              <span className="font-bold text-slate-900">{j.container_no}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {j.status === 'completed' ? (
                              <div className="flex flex-col gap-1 items-start">
                                <Badge className="bg-emerald-600 text-white font-medium text-[11px] gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> งานเสร็จสิ้น
                                </Badge>
                                {j.invoice_no || j.invoice_status === 'billed' ? (
                                  <span className="text-[10px] text-blue-700 font-semibold flex items-center gap-0.5">
                                    ✓ ออกบิลแล้ว
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                                    ⏳ พร้อมออกบิล
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 items-start">
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-[11px] gap-1">
                                  {j.status === 'in_progress' ? '🚚 กำลังวิ่งงาน' : j.status === 'assigned' ? '📋 จ่ายงานแล้ว' : j.status === 'draft' ? '📝 ฉบับร่าง' : j.status}
                                </Badge>
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                  <Lock className="h-2.5 w-2.5" /> รอจบงานก่อนออกบิล
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900">
                            ฿{Number(j.revenue || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-700">
                            ฿{Number(j.net_profit || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Guarded Invoice Actions: Only allowed if job.status === 'completed' */}
                              {j.status === 'completed' ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenInvoice(j)}
                                    className="h-8 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold"
                                    title="เปิดแบบฟอร์มพิมพ์ใบแจ้งหนี้อย่างเป็นทางการ"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                    พิมพ์ Invoice
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenEditInvoice(j)}
                                    className="h-8 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                                    title="แก้ไข / ปรับปรุงบิล และสูตรคำนวณ Excel"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                    แก้ไขบิล
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="h-8 text-xs gap-1 opacity-50 bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                    title="ไม่สามารถออกบิลได้: งานต้องมีสถานะ 'เสร็จสิ้น' (ปิดงานเรียบร้อย) ก่อนเท่านั้น"
                                  >
                                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                                    พิมพ์ Invoice
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="h-8 text-xs gap-1 opacity-50 bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                    title="ไม่สามารถแก้ไขบิลได้: งานต้องมีสถานะ 'เสร็จสิ้น' ก่อนเท่านั้น"
                                  >
                                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                                    แก้ไขบิล
                                  </Button>
                                </>
                              )}

                              {j.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleCloseJob(j.id)}
                                  className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                                  title="คลิกเพื่อปิดงานและสรุปผลกำไรขั้นสุดท้าย (เปลี่ยนสถานะเป็น 'เสร็จสิ้น' เพื่อให้สามารถออกบิลได้)"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  ปิดงาน
                                </Button>
                              )}
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

        {/* ================= TAB 2: PAT LETTERS ================= */}
        <TabsContent value="pat-letters">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Anchor className="h-5 w-5 text-purple-600" />
                  จดหมายเปลี่ยนใบเสร็จการท่าเรือแห่งประเทศไทย (PAT Letter)
                </CardTitle>
                <CardDescription>
                  ออกหนังสือราชการขอเปลี่ยนใบเสร็จรับเงินท่าเรือ จากชื่อ Connect Transport เป็นชื่อบริษัทลูกค้า
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/70 text-xs">
                      <SortableHeader title="Job ID" sortKey="job_no" currentSort={patSort} onSort={handlePatSort} className="font-bold text-blue-900" />
                      <SortableHeader title="วันที่" sortKey="job_date" currentSort={patSort} onSort={handlePatSort} className="font-bold" />
                      <SortableHeader title="บริษัทลูกค้า (ผู้ออกใบเสร็จใหม่)" sortKey="customer" currentSort={patSort} onSort={handlePatSort} className="font-bold" />
                      <SortableHeader title="เลขประจำตัวผู้เสียภาษี" sortKey="tax_id" currentSort={patSort} onSort={handlePatSort} />
                      <SortableHeader title="เลขตู้คอนเทนเนอร์" sortKey="container_no" currentSort={patSort} onSort={handlePatSort} />
                      <SortableHeader title="สถานะจดหมาย PAT" sortKey="pat_letter_status" currentSort={patSort} onSort={handlePatSort} />
                      <TableHead className="text-center font-semibold">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPatJobs.map((j) => (
                      <TableRow key={j.id} className="hover:bg-slate-50/80 text-xs">
                        <TableCell className="font-bold text-blue-700 font-mono">{j.job_no}</TableCell>
                        <TableCell className="text-slate-600">{j.job_date}</TableCell>
                        <TableCell className="font-bold text-slate-900">{j.customer?.company_name}</TableCell>
                        <TableCell className="font-mono text-slate-700">{j.customer?.tax_id || '-'}</TableCell>
                        <TableCell className="font-mono font-bold text-purple-900">{j.container_no || 'ยังไม่ระบุ'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={patStatusMap[j.pat_letter_status]?.badgeClass || ''}>
                            {patStatusMap[j.pat_letter_status]?.label || j.pat_letter_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPat(j)}
                              className="h-8 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-50 font-semibold"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              พิมพ์จดหมาย PAT
                            </Button>

                            <select
                              className="border rounded px-2 py-1 text-xs bg-white border-slate-300"
                              value={j.pat_letter_status}
                              onChange={(e) => handleUpdatePatStatus(j.id, e.target.value)}
                            >
                              <option value="pending">รอออกจดหมาย</option>
                              <option value="issued">ออกจดหมายแล้ว</option>
                              <option value="completed">เปลี่ยนสำเร็จ</option>
                            </select>
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
      </Tabs>

      {/* ================= MODAL: PRINTABLE INVOICE (REAL LAYOUT) ================= */}
      <Dialog open={openInvoiceModal} onOpenChange={setOpenInvoiceModal}>
        <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <ReceiptText className="h-5 w-5 text-blue-600" />
                  ใบแจ้งหนี้ / INVOICE (แบบฟอร์มทางการ Connect Transport)
                  {selectedJob && getSavedInvoiceData(selectedJob.id, selectedJob.invoice_no) && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold flex items-center gap-1">
                      <Check className="h-3 w-3" /> ข้อมูลที่ปรับปรุงล่าสุด (Active Revision)
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  แยก 2 คอลัมน์ (เงินทดรองจ่าย &amp; ค่าขนส่ง) หักภาษี 1% เฉพาะค่าขนส่ง
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpenInvoiceModal(false);
                  setOpenEditInvoiceModal(true);
                }}
                className="gap-1.5 text-xs text-amber-800 border-amber-300 hover:bg-amber-50"
              >
                <Edit3 className="h-3.5 w-3.5" />
                แก้ไขตัวเลข / สูตร (Revise)
              </Button>
            </div>
          </DialogHeader>

          {/* Printable Invoice Sheet */}
          <div className="border border-slate-900 p-6 rounded-lg bg-white text-slate-900 space-y-4 print:border-none print:p-0 font-sans">
            {/* Header with Logo */}
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start gap-4">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/images/logo-print.png" 
                  alt="Connect Transport Logo" 
                  className="h-14 w-auto object-contain mt-1" 
                />
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight">
                    CONNECT TRANSPORT CO.,LTD.
                  </h2>
                  <p className="text-xs font-bold text-slate-800">บริษัท คอนเนค ทรานสปอร์ต จำกัด ( สาขาที่ 00001 )</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    369/1 ถนนเลียบคลองมอญ แขวงทับยาว เขตลาดกระบัง กรุงเทพฯ 10520<br />
                    369/1 LIAP KHLONG MON ROAD, THAP YAO, LAT KRABANG, BANGKOK 10520
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    TEL : 089-5351313 &nbsp;|&nbsp; FAX : 02-1167337 &nbsp;|&nbsp; E-MAIL : yodsapol@connecttransport.co.th
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-lg font-black text-slate-900 leading-tight">ใบแจ้งหนี้ / INVOICE</div>
                <div className="text-[11px] text-slate-700 font-mono mt-1">เลขประจำตัวผู้เสียภาษี 0115557007317</div>
              </div>
            </div>

            {/* Bill To & Invoice Meta Box */}
            <div className="border border-slate-800 text-xs">
              <div className="grid grid-cols-3">
                <div className="col-span-2 p-2.5 border-r border-slate-800 space-y-1">
                  <div><strong>ชื่อ / NAME:</strong> {invoiceForm.customer_name} ({invoiceForm.customer_branch})</div>
                  <div><strong>ที่อยู่ / ADDRESS:</strong> {invoiceForm.customer_address}</div>
                  <div><strong>TAX ID:</strong> <span className="font-mono font-bold">{invoiceForm.customer_tax_id}</span></div>
                </div>
                <div className="p-2.5 space-y-1">
                  <div><strong>วันที่ / DATE:</strong> {invoiceForm.invoice_date}</div>
                  <div><strong>INVOICE NO:</strong> <span className="font-mono font-bold text-blue-900">{invoiceForm.invoice_no}</span></div>
                  <div><strong>CREDIT:</strong> <span className="font-bold text-rose-600">{invoiceForm.credit_days}</span></div>
                </div>
              </div>
            </div>

            {/* Main Invoice Table (2 Columns: Advance vs Transport) */}
            <div className="border border-slate-800">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-800 text-center font-bold">
                    <th className="border-r border-slate-800 py-1.5 px-2 w-20">วันที่<br/><span className="text-[10px] font-normal">Date</span></th>
                    <th className="border-r border-slate-800 py-1.5 px-2 w-28">หมายเลขตู้<br/><span className="text-[10px] font-normal">Container No.</span></th>
                    <th className="border-r border-slate-800 py-1.5 px-2 w-16">
                      type<br/>
                      <span className="text-[10px] font-normal">20&apos; &nbsp; 40&apos;</span>
                    </th>
                    <th className="border-r border-slate-800 py-1.5 px-2 text-left">รายละเอียด<br/><span className="text-[10px] font-normal">Description</span></th>
                    <th className="border-r border-slate-800 py-1.5 px-2 w-28 text-right">เงินทดรองจ่าย<br/><span className="text-[10px] font-normal">Advance</span></th>
                    <th className="py-1.5 px-2 w-28 text-right">ค่าขนส่ง<br/><span className="text-[10px] font-normal">Transport</span></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Line 1: Main Transport Charge */}
                  <tr className="align-top">
                    <td className="border-r border-slate-800 p-2 text-center font-mono">
                      {selectedJob?.job_date || invoiceForm.invoice_date}
                    </td>
                    <td className="border-r border-slate-800 p-2 font-mono font-bold">
                      {invoiceForm.container_no}
                    </td>
                    <td className="border-r border-slate-800 p-2 text-center font-mono font-bold">
                      {invoiceForm.container_type_20 > 0 ? `${invoiceForm.container_type_20} ` : ''}
                      {invoiceForm.container_type_40 > 0 ? ` ${invoiceForm.container_type_40}` : ''}
                    </td>
                    <td className="border-r border-slate-800 p-2 font-bold text-slate-900">
                      {invoiceForm.transport_description}
                    </td>
                    {/* Advance Column: Blank for main transport */}
                    <td className="border-r border-slate-800 p-2 text-right font-mono font-bold"></td>
                    {/* Transport Column */}
                    <td className="p-2 text-right font-mono font-bold">
                      {Number(invoiceForm.transport_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Lines 2..N: Advance & Extra Items (Each item on its own row with amount aligned directly to its line) */}
                  {invoiceForm.extra_items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="border-r border-slate-800 px-2 py-1"></td>
                      <td className="border-r border-slate-800 px-2 py-1"></td>
                      <td className="border-r border-slate-800 px-2 py-1"></td>
                      <td className="border-r border-slate-800 px-2 py-1 font-bold text-slate-900">
                        {item.description}
                      </td>
                      {/* Advance Column: Exactly aligned with this specific advance item */}
                      <td className="border-r border-slate-800 px-2 py-1 text-right font-mono font-bold">
                        {item.category === 'advance' && Number(item.amount) > 0
                          ? Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })
                          : ''}
                      </td>
                      {/* Transport Column */}
                      <td className="px-2 py-1 text-right font-mono font-bold">
                        {item.category === 'transport' && Number(item.amount) > 0
                          ? Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })
                          : ''}
                      </td>
                    </tr>
                  ))}

                  {/* Consignee, Shipper, Booking, Route Notes Line */}
                  <tr className="align-top">
                    <td className="border-r border-slate-800 px-2 pt-2"></td>
                    <td className="border-r border-slate-800 px-2 pt-2"></td>
                    <td className="border-r border-slate-800 px-2 pt-2"></td>
                    <td className="border-r border-slate-800 px-2 pt-2 space-y-0.5">
                      <div className="text-[11px] text-slate-700 font-semibold">{invoiceForm.consignee_shipper}</div>
                      <div className="text-[11px] text-slate-700 font-semibold">{invoiceForm.booking_bl}</div>
                      <div className="text-[11px] text-slate-700 font-mono font-semibold">{invoiceForm.route_note}</div>
                    </td>
                    <td className="border-r border-slate-800 px-2 pt-2"></td>
                    <td className="px-2 pt-2"></td>
                  </tr>

                  {/* Empty rows to maintain table height like original form */}
                  <tr className="h-20 border-b border-slate-800">
                    <td className="border-r border-slate-800"></td>
                    <td className="border-r border-slate-800"></td>
                    <td className="border-r border-slate-800"></td>
                    <td className="border-r border-slate-800"></td>
                    <td className="border-r border-slate-800"></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>

              {/* Bottom Summary Table */}
              <div className="border-t border-slate-800">
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-800 font-bold">
                      <td className="py-1 px-3 text-right">Total</td>
                      <td className="py-1 px-3 text-right font-mono border-l border-slate-800 w-28">
                        {totalAdvance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-3 text-right font-mono border-l border-slate-800 w-28">
                        {totalTransport.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-800 font-bold">
                      <td className="py-1 px-3 text-right">Tax 1% (คิดเฉพาะค่าขนส่ง)</td>
                      <td className="py-1 px-3 text-right font-mono border-l border-slate-800 w-28 text-slate-400">-</td>
                      <td className="py-1 px-3 text-right font-mono border-l border-slate-800 w-28 text-rose-600">
                        {tax1Percent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-800 font-bold bg-slate-50">
                      <td className="py-1 px-3 text-right">Total Baht</td>
                      <td className="py-1 px-3 text-right font-mono border-l border-slate-800 w-28">
                        {netAdvance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-3 text-right font-mono border-l border-slate-800 w-28">
                        {netTransport.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="font-black bg-slate-100 text-sm">
                      <td className="py-1.5 px-3 text-right text-blue-900">Grand Total</td>
                      <td colSpan={2} className="py-1.5 px-3 text-right font-mono border-l border-slate-800 text-blue-900">
                        ฿{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signatures Block */}
            <div className="pt-6 grid grid-cols-2 gap-8 text-xs">
              <div className="space-y-1">
                <div>ผู้รับวางบิล ................................................................</div>
                <div>วันที่ .........................................................................</div>
                <div>วันที่รับเช็ค ...............................................................</div>
              </div>
              <div className="text-right space-y-1">
                <div>ผู้มีอำนาจลงนาม ........................................................</div>
                <div>วันที่ {invoiceForm.invoice_date}</div>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-600 pt-2 border-t">
              โปรดสั่งจ่ายเช็คขีดคร่อมในนาม <strong>&quot;บริษัท คอนเนค ทรานสปอร์ต จำกัด&quot;</strong> เท่านั้น
            </div>
          </div>

          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={() => setOpenInvoiceModal(false)}>
              ปิดหน้าต่าง
            </Button>
            <Button type="button" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Printer className="h-4 w-4" />
              พิมพ์ใบแจ้งหนี้ (Print Invoice)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: EDIT / REVISE INVOICE (FORMULA BREAKDOWN AUDIT) ================= */}
      <Dialog open={openEditInvoiceModal} onOpenChange={setOpenEditInvoiceModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Edit3 className="h-5 w-5 text-amber-600" />
              แก้ไขและปรับปรุงใบแจ้งหนี้ (Edit / Revise Invoice)
            </DialogTitle>
            <DialogDescription>
              ปรับเปลี่ยนเลขที่บิล, วันที่, เครดิตเทอม และใส่สูตรคำนวณแบบ Excel ในรายการทดรองจ่าย
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Meta Fields */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold text-blue-900">เลขที่ใบแจ้งหนี้ (Invoice No.)</Label>
                <Input
                  value={invoiceForm.invoice_no}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_no: e.target.value })}
                  className="font-mono font-bold"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">วันที่ออกบิล</Label>
                <Input
                  value={invoiceForm.invoice_date}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-rose-600">Credit Term</Label>
                <Input
                  value={invoiceForm.credit_days}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, credit_days: e.target.value })}
                  placeholder="30 DAYS"
                />
              </div>
            </div>

            {/* Transport Charge */}
            <div className="p-3 bg-slate-50 rounded-lg border space-y-2">
              <div className="font-bold text-slate-900">ค่าบริการขนส่งหลัก (Transport Charge):</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input
                    value={invoiceForm.transport_description}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, transport_description: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    value={invoiceForm.transport_amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, transport_amount: parseFloat(e.target.value) || 0 })}
                    className="font-bold font-mono text-right"
                  />
                </div>
              </div>
            </div>

            {/* Advance & Extra Charges (WITH EXCEL FORMULA BREAKDOWN) */}
            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-950">รายการเงินทดรองจ่าย &amp; ช่องสูตรคำนวณ (Excel Formula):</span>
                  <p className="text-[11px] text-amber-700">สามารถพิมพ์สูตรคณิตศาสตร์ เช่น =2*220+2*600 หรือ 150+150+300 เพื่อบันทึกที่มาของตัวเลข</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInvoiceForm({
                      ...invoiceForm,
                      extra_items: [
                        ...invoiceForm.extra_items,
                        {
                          id: 'item_' + Date.now(),
                          description: 'LIFT OFF & EXTRA CHARGE',
                          formula: '=150+150',
                          amount: 300,
                          category: 'advance',
                        }
                      ]
                    });
                  }}
                  className="gap-1 text-xs bg-white text-amber-900 border-amber-300 hover:bg-amber-100"
                >
                  <Plus className="h-3 w-3" /> เพิ่มรายการ
                </Button>
              </div>

              {invoiceForm.extra_items.map((item, idx) => (
                <div key={item.id} className="p-2.5 bg-white rounded border space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Label className="text-[10px] text-slate-500">ชื่อรายการ</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...invoiceForm.extra_items];
                          updated[idx].description = e.target.value;
                          setInvoiceForm({ ...invoiceForm, extra_items: updated });
                        }}
                        className="text-xs"
                      />
                    </div>
                    <div className="col-span-4">
                      <Label className="text-[10px] text-blue-700 font-bold flex items-center gap-1">
                        <Calculator className="h-3 w-3" /> สูตรการคำนวณ (Excel Formula)
                      </Label>
                      <Input
                        value={item.formula}
                        placeholder="=2*220+2*600"
                        onChange={(e) => {
                          const updated = [...invoiceForm.extra_items];
                          const formulaVal = e.target.value;
                          updated[idx].formula = formulaVal;
                          updated[idx].amount = evaluateMathFormula(formulaVal);
                          setInvoiceForm({ ...invoiceForm, extra_items: updated });
                        }}
                        className="font-mono text-xs text-blue-900 font-bold"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[10px] text-slate-500">ผลลัพธ์ (บาท)</Label>
                      <Input
                        type="number"
                        value={item.amount}
                        onChange={(e) => {
                          const updated = [...invoiceForm.extra_items];
                          updated[idx].amount = parseFloat(e.target.value) || 0;
                          setInvoiceForm({ ...invoiceForm, extra_items: updated });
                        }}
                        className="font-mono text-xs text-right font-bold text-emerald-800"
                      />
                    </div>
                    <div className="col-span-1 pt-4 text-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const updated = invoiceForm.extra_items.filter((_, i) => i !== idx);
                          setInvoiceForm({ ...invoiceForm, extra_items: updated });
                        }}
                        className="h-8 w-8 text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations Summary Preview */}
            <div className="p-3 bg-slate-100 rounded-lg space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span>ยอดเงินทดรองจ่าย (Total Advance):</span>
                <strong>฿{totalAdvance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="flex justify-between">
                <span>ยอดค่าบริการขนส่ง (Total Transport):</span>
                <strong>฿{totalTransport.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>ภาษีหัก ณ ที่จ่าย 1% (เฉพาะค่าขนส่ง):</span>
                <strong>-฿{tax1Percent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t text-sm font-bold text-blue-900">
                <span>ยอดสุทธิทั้งสิ้น (Grand Total):</span>
                <strong>฿{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={handleResetInvoiceToDefault}
              className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              คืนค่าเริ่มต้น (Reset Default)
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenEditInvoiceModal(false)}>
                ยกเลิก
              </Button>
              <Button type="button" onClick={handleSaveRevisedInvoice} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 font-bold">
                <Save className="h-4 w-4" />
                บันทึกการปรับปรุงบิล (Save Revision)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: PAT LETTER ================= */}
      <Dialog open={openPatModal} onOpenChange={setOpenPatModal}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-purple-600" />
              หนังสือขอเปลี่ยนใบเสร็จรับเงินการท่าเรือแห่งประเทศไทย (PAT Letter)
            </DialogTitle>
            <DialogDescription>
              จดหมายทางการส่งถึงผู้อำนวยการแผนกกองคลังการท่าเรือแห่งประเทศไทย
            </DialogDescription>
          </DialogHeader>

          {/* Printable Official PAT Letter */}
          <div className="border border-slate-900 p-8 rounded-lg bg-white text-slate-900 space-y-5 print:border-none print:p-0 font-serif leading-relaxed">
            {/* Letterhead with Logo */}
            <div className="flex justify-between items-start border-b pb-4">
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/images/logo-print.png" 
                  alt="Connect Transport Logo" 
                  className="h-16 w-auto object-contain" 
                />
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-tight">CONNECT TRANSPORT CO.,LTD.</h2>
                  <p className="text-sm font-bold text-slate-800">บริษัท คอนเนค ทรานสปอร์ต จำกัด</p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    369/1 LIAP KHLONG MON ROAD, THAP YAO, LATKRABANG, BANGKOK 10520<br />
                    369/1 ถนนเลียบคลองมอญ แขวงทับยาว เขตลาดกระบัง กรุงเทพมหานคร 10520
                  </p>
                </div>
              </div>
              <div className="text-right text-xs font-sans text-slate-700 space-y-0.5">
                <div>TEL : (662) 2861900 ( AUTO )</div>
                <div>E-MAIL : yodsapol@connecttransport.co.th</div>
              </div>
            </div>

            {/* Letter Date */}
            <div className="text-right text-xs font-sans pt-2">
              วันที่ {todayDateStr}
            </div>

            {/* Subject & Salutation */}
            <div className="text-xs space-y-2 font-sans">
              <div className="flex justify-between items-center">
                <div><strong>เรื่อง:</strong> ขอใบกำกับภาษีเต็มรูปแบบ</div>
                <div className="text-slate-500 font-mono text-[11px]">รหัส: 0115557007317</div>
              </div>
              <div><strong>เรียน:</strong> ผู้อำนวยการแผนกกองคลังการท่าเรือแห่งประเทศไทย</div>
            </div>

            {/* Body */}
            <div className="text-xs space-y-3 font-sans indent-8 text-justify leading-relaxed">
              <p>
                เนื่องจากบริษัท คอนเนค ทรานสปอร์ต จำกัด ได้กระทำการชำระค่าภาระสินค้าขาออกและค่ายานพาหนะผ่านท่าการนำสินค้าเข้าท่าเรือนั้น บริษัทมีความประสงค์จะขอให้กองคลังออกใบกำกับภาษีตามรายละเอียดดังนี้
              </p>
            </div>

            {/* Target Customer Specs */}
            <div className="p-4 bg-slate-50 rounded border text-xs font-sans space-y-2">
              <div className="font-bold text-slate-900 text-sm">
                {selectedJob?.customer?.company_name} ({selectedJob?.customer?.branch || 'สาขาที่ 00001'})
              </div>
              <div className="text-slate-700">
                {selectedJob?.customer?.address || 'ที่อยู่ตาม ภ.พ.20'}
              </div>
              <div>
                เลขประจำตัวผู้เสียภาษี: <span className="font-mono font-bold text-slate-900">{selectedJob?.customer?.tax_id || '-'}</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t">
                หมายเลขตู้คอนเทนเนอร์: <span className="font-mono font-bold text-blue-900">{selectedJob?.container_no || '-'}</span> (ขนาด {selectedJob?.container_size}&apos; {selectedJob?.container_type}) | อ้างอิง Job ID: {selectedJob?.job_no}
              </div>
            </div>

            <div className="text-xs font-sans indent-8">
              <p>
                จึงเรียนมาเพื่อทราบและโปรดพิจารณาด้วย จักเป็นพระคุณยิ่ง
              </p>
            </div>

            {/* Signatures */}
            <div className="flex justify-end pt-8 text-center text-xs font-sans">
              <div className="w-64 space-y-1">
                <div>ขอแสดงความนับถือ</div>
                <div className="py-6">( .................................................... )</div>
                <div className="font-bold text-slate-900">(นายยศพล มณีทิพย์สกุล)</div>
                <div className="text-slate-600 text-xs">ผู้รับมอบ</div>
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={() => setOpenPatModal(false)}>
              ปิดหน้าต่าง
            </Button>
            <Button type="button" onClick={() => window.print()} className="bg-purple-700 hover:bg-purple-800 text-white gap-2">
              <Printer className="h-4 w-4" />
              พิมพ์จดหมาย PAT Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
