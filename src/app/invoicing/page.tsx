'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Job, Customer } from '@/types/database';
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
  Download
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export default function InvoicingPage() {
  const [activeTab, setActiveTab] = useState('invoices');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayDateStr, setTodayDateStr] = useState('');

  // Modals
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [openPatModal, setOpenPatModal] = useState(false);

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
    setTodayDateStr(new Date().toLocaleDateString('th-TH'));
  }, []);

  // Update PAT Status
  const handleUpdatePatStatus = async (jobId: string, newStatus: string) => {
    const { error } = await supabase
      .from('jobs')
      .update({ pat_letter_status: newStatus })
      .eq('id', jobId);

    if (!error) {
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
      alert('✅ ปิดงานและสรุปผลกำไรสำเร็จ!');
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  // Open Invoice Modal
  const handleOpenInvoice = (job: Job) => {
    setSelectedJob(job);
    setOpenInvoiceModal(true);
  };

  // Open PAT Modal
  const handleOpenPat = (job: Job) => {
    setSelectedJob(job);
    setOpenPatModal(true);
  };

  // Filter Jobs
  const patJobs = jobs.filter((j) => j.pat_letter_required);

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
              Module 5: Invoicing & Closing
            </span>
            <span className="text-xs text-slate-500">Connect Transport Co., Ltd.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <ReceiptText className="h-7 w-7 text-blue-600" />
            การออกบิลและการปิดงาน (Invoicing & Closing)
          </h1>
          <p className="text-slate-500 text-sm">
            ออกใบแจ้งหนี้เรียกเก็บเงินลูกค้า (Invoice), จัดการจดหมายเปลี่ยนใบเสร็จท่าเรือ (PAT Letter) และสรุปปิดงาน
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
            การออกใบแจ้งหนี้ & วางบิล ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="pat-letters" className="gap-2">
            <Anchor className="h-4 w-4 text-purple-700" />
            จดหมายเปลี่ยนใบเสร็จท่าเรือ PAT ({patJobs.length})
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: INVOICES ================= */}
        <TabsContent value="invoices">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">รายการงานขนส่งสำหรับวางบิลลูกค้า</CardTitle>
                <CardDescription>
                  ออกใบแจ้งหนี้ (Invoice) มาตรฐาน คำนวณหัก ณ ที่จ่าย 1% และปิดงาน
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
                      <TableHead className="font-semibold text-slate-800">ลูกค้า (Customer)</TableHead>
                      <TableHead className="font-semibold text-slate-800">เส้นทาง</TableHead>
                      <TableHead className="font-semibold text-slate-800">เลขตู้ / ซีล</TableHead>
                      <TableHead className="font-semibold text-slate-800">สถานะงาน</TableHead>
                      <TableHead className="text-right font-semibold text-slate-800">ยอดเรียกเก็บ (บาท)</TableHead>
                      <TableHead className="text-right font-semibold text-slate-800">กำไรสุทธิ</TableHead>
                      <TableHead className="text-center font-semibold text-slate-800">จัดการเอกสาร</TableHead>
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
                          <TableCell className="font-semibold text-slate-900 max-w-[170px] truncate">
                            {j.customer?.company_name || 'ลูกค้าทั่วไป'}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-slate-900">{j.origin?.name}</span>
                            <span className="mx-1 text-slate-400">➔</span>
                            <span>{j.destination?.name}</span>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {j.container_no ? (
                              <span className="font-semibold text-blue-900">{j.container_no}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {j.status === 'completed' ? (
                              <Badge className="bg-emerald-600 text-white font-medium">ปิดงานแล้ว</Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                                {j.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900">
                            ฿{Number(j.revenue).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-700 text-xs">
                            ฿{Number(j.net_profit).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenInvoice(j)}
                                className="h-8 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                พิมพ์ใบแจ้งหนี้ (Invoice)
                              </Button>

                              {j.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleCloseJob(j.id)}
                                  className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
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
                    <TableRow className="bg-slate-100/70">
                      <TableHead className="font-semibold text-slate-800">Job ID</TableHead>
                      <TableHead className="font-semibold text-slate-800">วันที่</TableHead>
                      <TableHead className="font-semibold text-slate-800">บริษัทลูกค้า (ผู้ออกใบเสร็จใหม่)</TableHead>
                      <TableHead className="font-semibold text-slate-800">เลขประจำตัวผู้เสียภาษี</TableHead>
                      <TableHead className="font-semibold text-slate-800">เลขตู้คอนเทนเนอร์</TableHead>
                      <TableHead className="font-semibold text-slate-800">สถานะจดหมาย PAT</TableHead>
                      <TableHead className="text-center font-semibold text-slate-800">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          ไม่มีรายการงานที่ต้องทำจดหมายเปลี่ยนใบเสร็จท่าเรือ
                        </TableCell>
                      </TableRow>
                    ) : (
                      patJobs.map((j) => (
                        <TableRow key={j.id} className="hover:bg-slate-50/80">
                          <TableCell className="font-bold text-blue-700">{j.job_no}</TableCell>
                          <TableCell className="text-xs text-slate-600">{j.job_date}</TableCell>
                          <TableCell className="font-semibold text-slate-900">{j.customer?.company_name}</TableCell>
                          <TableCell className="text-xs font-mono">{j.customer?.tax_id || '-'}</TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-purple-900">
                            {j.container_no || 'ยังไม่ระบุเลขตู้'}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`font-medium ${patStatusMap[j.pat_letter_status]?.badgeClass || ''}`}
                            >
                              {patStatusMap[j.pat_letter_status]?.label || j.pat_letter_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPat(j)}
                                className="h-8 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================= MODAL 1: PRINTABLE INVOICE ================= */}
      <Dialog open={openInvoiceModal} onOpenChange={setOpenInvoiceModal}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-600" />
              พิมพ์ใบแจ้งหนี้ / ใบวางบิล (Tax Invoice / Billing Note)
            </DialogTitle>
            <DialogDescription>
              เอกสารสำหรับเรียกเก็บเงินลูกค้าตามมาตรฐานบัญชีไทย (คำนวณหัก ณ ที่จ่าย 1%)
            </DialogDescription>
          </DialogHeader>

          {/* Printable Invoice Sheet */}
          <div className="border-2 border-slate-900 p-8 rounded-lg bg-white text-slate-900 space-y-5 print:border-none print:p-0">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-slate-900">บริษัท คอนเนค ทรานสปอร์ต จำกัด</h2>
                <p className="text-xs font-semibold text-blue-900">CONNECT TRANSPORT CO., LTD.</p>
                <p className="text-xs text-slate-600 mt-1">
                  88/9 หมู่ 2 ถนนบางนา-ตราด ต.บางเสาธง อ.บางเสาธง จ.สมุทรปราการ 10570
                </p>
                <p className="text-xs text-slate-600">เลขประจำตัวผู้เสียภาษี: 0105562099881 | โทร: 02-765-4321</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-slate-900">ใบแจ้งหนี้ / ใบวางบิล</div>
                <p className="text-xs text-slate-500 font-mono">INVOICE / BILLING NOTE</p>
                <div className="mt-2 text-xs">
                  <div>เลขที่บิล: <strong className="font-mono text-blue-800">INV-{selectedJob?.job_no}</strong></div>
                  <div>วันที่: <strong>{todayDateStr}</strong></div>
                  <div>อ้างอิง Job ID: <strong className="font-mono">{selectedJob?.job_no}</strong></div>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="p-3 bg-slate-50 rounded border text-xs grid grid-cols-2 gap-3">
              <div>
                <div className="font-bold text-slate-800">ลูกค้า (Bill To):</div>
                <div className="font-semibold text-slate-900 text-sm mt-0.5">{selectedJob?.customer?.company_name}</div>
                <div className="text-slate-600 mt-0.5">{selectedJob?.customer?.address || 'ไม่ระบุที่อยู่'}</div>
                <div className="text-slate-600 mt-0.5">เลขผู้เสียภาษี: {selectedJob?.customer?.tax_id || '-'}</div>
              </div>
              <div>
                <div className="font-bold text-slate-800">เงื่อนไขการชำระ:</div>
                <div className="text-slate-700 mt-0.5">เครดิตเทอม: 30 วัน</div>
                <div className="text-slate-700 mt-0.5">ผู้ติดต่อ: {selectedJob?.customer?.contact_name || '-'}</div>
                <div className="text-slate-700 mt-0.5">เบอร์โทร: {selectedJob?.customer?.phone || '-'}</div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 text-xs font-bold text-slate-900">
                    <TableHead className="w-12 text-center">ลำดับ</TableHead>
                    <TableHead>รายละเอียดค่าบริการขนส่ง (Description)</TableHead>
                    <TableHead className="text-center">สเปกตู้</TableHead>
                    <TableHead className="text-right">จำนวนเงิน (บาท)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="text-xs">
                    <TableCell className="text-center font-bold">1</TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-900">
                        ค่าบริการขนส่งตู้คอนเทนเนอร์: {selectedJob?.origin?.name} ➔ {selectedJob?.destination?.name}
                      </div>
                      <div className="text-slate-600 text-[11px] mt-0.5">
                        หมายเลขตู้: <span className="font-mono font-semibold">{selectedJob?.container_no || '-'}</span> | ซีล: <span className="font-mono">{selectedJob?.seal_no || '-'}</span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        รถบรรทุก: {selectedJob?.vehicle?.plate_number || '-'} | พขร: {selectedJob?.driver?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {selectedJob?.container_size}&apos; {selectedJob?.container_type}
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-900">
                      ฿{Number(selectedJob?.revenue || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Calculations Breakdown */}
            {(() => {
              const subtotal = Number(selectedJob?.revenue || 0);
              const wht1 = subtotal * 0.01; // 1% หัก ณ ที่จ่าย ค่าขนส่ง
              const netAfterWht = subtotal - wht1;

              return (
                <div className="flex justify-end">
                  <div className="w-72 p-3 bg-slate-50 rounded border text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-700">
                      <span>ยอดรวมค่าขนส่ง (Subtotal):</span>
                      <strong>฿{subtotal.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>หัก ภาษี ณ ที่จ่าย 1% (WHT 1%):</span>
                      <strong className="text-rose-600">- ฿{wht1.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-300 text-slate-900">
                      <span>ยอดสุทธิที่ต้องชำระ (Net Total):</span>
                      <span className="text-blue-800">
                        ฿{netAfterWht.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Payment Bank Details */}
            <div className="p-3 bg-blue-50/60 rounded border border-blue-200 text-xs">
              <div className="font-bold text-blue-900">ข้อมูลการโอนเงินเข้าบัญชี (Bank Transfer):</div>
              <div className="text-slate-700 mt-1">
                ธนาคารกสิกรไทย (KBANK) | บัญชีกระแสรายวัน: <strong>045-8-99999-1</strong> | ชื่อบัญชี: <strong>บจก. คอนเนค ทรานสปอร์ต</strong>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs">
              <div className="border-t border-slate-400 pt-2">
                <div>( .................................................... )</div>
                <div className="text-slate-600 text-[11px] mt-1">ผู้วางบิล / ฝ่ายบัญชีและการเงิน</div>
                <div className="text-slate-400 text-[10px]">บจก. คอนเนค ทรานสปอร์ต</div>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <div>( .................................................... )</div>
                <div className="text-slate-600 text-[11px] mt-1">ผู้รับวางบิล / วันที่รับวางบิล</div>
                <div className="text-slate-400 text-[10px]">{selectedJob?.customer?.company_name}</div>
              </div>
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

      {/* ================= MODAL 2: PRINTABLE PAT LETTER ================= */}
      <Dialog open={openPatModal} onOpenChange={setOpenPatModal}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-purple-600" />
              หนังสือขอเปลี่ยนใบเสร็จรับเงินการท่าเรือแห่งประเทศไทย (PAT Letter)
            </DialogTitle>
            <DialogDescription>
              จดหมายทางการส่งถึงการท่าเรือฯ เพื่อขอเปลี่ยนชื่อในใบเสร็จเป็นชื่อบริษัทลูกค้า
            </DialogDescription>
          </DialogHeader>

          {/* Printable Official PAT Letter */}
          <div className="border-2 border-slate-900 p-8 rounded-lg bg-white text-slate-900 space-y-5 print:border-none print:p-0 font-serif leading-relaxed">
            {/* Letterhead */}
            <div className="text-center border-b pb-4">
              <h2 className="text-xl font-black text-slate-900">บริษัท คอนเนค ทรานสปอร์ต จำกัด</h2>
              <p className="text-xs font-sans text-slate-600">CONNECT TRANSPORT CO., LTD.</p>
              <p className="text-xs font-sans text-slate-500 mt-1">
                88/9 หมู่ 2 ถ.บางนา-ตราด ต.บางเสาธง อ.บางเสาธง จ.สมุทรปราการ 10570 | โทร: 02-765-4321
              </p>
            </div>

            {/* Letter Meta */}
            <div className="flex justify-between text-xs font-sans">
              <div>ที่: CT-PAT/{selectedJob?.job_no}</div>
              <div>วันที่: {todayDateStr}</div>
            </div>

            {/* Subject & Salutation */}
            <div className="text-xs space-y-1.5 font-sans">
              <div><strong>เรื่อง:</strong> ขอเปลี่ยนชื่อและที่อยู่ในใบเสร็จรับเงิน / ใบกำกับภาษี ของการท่าเรือแห่งประเทศไทย</div>
              <div><strong>เรียน:</strong> ผู้อำนวยการกองการเงิน / ผู้อำนวยการฝ่ายการเงินและบัญชี การท่าเรือแห่งประเทศไทย</div>
            </div>

            {/* Body */}
            <div className="text-xs space-y-3 font-sans indent-8 text-justify">
              <p>
                ตามที่ บริษัท คอนเนค ทรานสปอร์ต จำกัด ได้รับมอบหมายให้ดำเนินการขนย้ายตู้คอนเทนเนอร์ และได้ชำระเงินค่าภาระหรือค่าธรรมเนียมต่างๆ ของการท่าเรือแห่งประเทศไทย โดยใบเสร็จรับเงินเดิมได้ออกในนามของ บริษัท คอนเนค ทรานสปอร์ต จำกัด นั้น
              </p>
              <p>
                บริษัทฯ ขอเรียนชี้แจงว่า ตู้คอนเทนเนอร์ดังกล่าวเป็นกรรมสิทธิ์และการว่าจ้างของลูกค้า บริษัทฯ จึงใคร่ขอความอนุเคราะห์จากท่าน โปรดดำเนินการยกเลิกใบเสร็จรับเงินเดิม และออกใบเสร็จรับเงิน / ใบกำกับภาษีฉบับใหม่ ในนามของลูกค้า โดยมีรายละเอียดดังต่อไปนี้:
              </p>
            </div>

            {/* Target Customer Specs */}
            <div className="p-4 bg-slate-50 rounded border text-xs font-sans space-y-1.5">
              <div><strong>1. ชื่อบริษัทลูกค้า:</strong> {selectedJob?.customer?.company_name}</div>
              <div><strong>2. เลขประจำตัวผู้เสียภาษี (13 หลัก):</strong> <span className="font-mono font-bold">{selectedJob?.customer?.tax_id || '-'}</span> (สำนักงานใหญ่)</div>
              <div><strong>3. ที่อยู่ตามทะเบียนภาษี:</strong> {selectedJob?.customer?.address || '-'}</div>
              <div><strong>4. หมายเลขตู้คอนเทนเนอร์:</strong> <span className="font-mono font-bold text-blue-900">{selectedJob?.container_no || '-'}</span> (ขนาด {selectedJob?.container_size}&apos; {selectedJob?.container_type})</div>
              <div><strong>5. อ้างอิง Job ID:</strong> {selectedJob?.job_no} (วันที่ {selectedJob?.job_date})</div>
            </div>

            <div className="text-xs font-sans indent-8">
              <p>
                บริษัทฯ ได้แนบใบเสร็จรับเงินฉบับเดิมพร้อมหนังสือมอบอำนาจมาพร้อมหนังสือฉบับนี้แล้ว จึงเรียนมาเพื่อโปรดพิจารณาให้ความอนุเคราะห์ และขอขอบพระคุณเป็นอย่างสูงมา ณ โอกาสนี้
              </p>
            </div>

            {/* Signatures */}
            <div className="flex justify-end pt-8 text-center text-xs font-sans">
              <div className="w-64 space-y-1">
                <div>ขอแสดงความนับถือ</div>
                <div className="py-6">( .................................................... )</div>
                <div className="font-bold">กรรมการผู้จัดการ / ผู้มีอำนาจลงนาม</div>
                <div className="text-slate-500 text-[11px]">บริษัท คอนเนค ทรานสปอร์ต จำกัด</div>
                <div className="text-[10px] text-slate-400 mt-2">[ ประทับตราสำคัญของบริษัท ]</div>
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
