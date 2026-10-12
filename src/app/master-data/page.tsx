'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Vehicle, Driver, Customer, Location, RateCard } from '@/types/database';
import { 
  Truck, 
  Users, 
  Building2, 
  MapPin, 
  BadgeDollarSign, 
  Plus, 
  Trash2, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Database
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

// Helper labels
const vehicleTypeMap: Record<string, string> = {
  '4_wheel': 'รถ 4 ล้อ',
  '6_wheel': 'รถ 6 ล้อ',
  '10_wheel': 'รถ 10 ล้อ',
  'trailer': 'รถเทรลเลอร์ (หัวลาก)',
  'semi_trailer': 'รถกึ่งพ่วง (Semi-Trailer)',
};

const locationTypeMap: Record<string, string> = {
  'depot': 'ลานฝากตู้ (Depot)',
  'port': 'ท่าเรือ (Port)',
  'factory': 'โรงงาน (Factory)',
  'yard': 'ลานจอด/ลานซ่อม',
  'other': 'อื่นๆ',
};

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('vehicles');
  const [loading, setLoading] = useState(false);

  // States for Master Data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);

  // Dialog States
  const [openVehicleModal, setOpenVehicleModal] = useState(false);
  const [openDriverModal, setOpenDriverModal] = useState(false);
  const [openCustomerModal, setOpenCustomerModal] = useState(false);
  const [openLocationModal, setOpenLocationModal] = useState(false);
  const [openRateCardModal, setOpenRateCardModal] = useState(false);

  // Form States
  const [vehicleForm, setVehicleForm] = useState({
    plate_number: '',
    vehicle_type: 'trailer',
    capacity_tons: '32',
    iso_expiry_date: '',
    insurance_expiry_date: '',
    act_expiry_date: '',
    status: 'active',
  });

  const [driverForm, setDriverForm] = useState({
    name: '',
    phone: '',
    license_number: '',
    license_expiry_date: '',
    daily_rate: '600',
    status: 'available',
  });

  const [customerForm, setCustomerForm] = useState({
    company_name: '',
    tax_id: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
  });

  const [locationForm, setLocationForm] = useState({
    name: '',
    location_type: 'depot',
    province: '',
    address: '',
  });

  const [rateCardForm, setRateCardForm] = useState({
    origin_id: '',
    destination_id: '',
    vehicle_type: 'trailer',
    base_price: '5500',
    fuel_cost_est: '1800',
    toll_fee_est: '200',
    driver_fee_est: '600',
  });

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [vRes, dRes, cRes, lRes, rRes] = await Promise.all([
        supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('locations').select('*').order('name', { ascending: true }),
        supabase.from('rate_cards').select('*, origin:locations!origin_id(*), destination:locations!destination_id(*)'),
      ]);

      if (vRes.data) setVehicles(vRes.data);
      if (dRes.data) setDrivers(dRes.data);
      if (cRes.data) setCustomers(cRes.data);
      if (lRes.data) setLocations(lRes.data);
      if (rRes.data) setRateCards(rRes.data);
    } catch (error) {
      console.error('Error fetching master data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Add Handlers
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('vehicles').insert([
      {
        plate_number: vehicleForm.plate_number,
        vehicle_type: vehicleForm.vehicle_type,
        capacity_tons: parseFloat(vehicleForm.capacity_tons) || 0,
        iso_expiry_date: vehicleForm.iso_expiry_date || null,
        insurance_expiry_date: vehicleForm.insurance_expiry_date || null,
        act_expiry_date: vehicleForm.act_expiry_date || null,
        status: vehicleForm.status,
      },
    ]);
    if (!error) {
      setOpenVehicleModal(false);
      setVehicleForm({
        plate_number: '',
        vehicle_type: 'trailer',
        capacity_tons: '32',
        iso_expiry_date: '',
        insurance_expiry_date: '',
        act_expiry_date: '',
        status: 'active',
      });
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('drivers').insert([
      {
        name: driverForm.name,
        phone: driverForm.phone,
        license_number: driverForm.license_number,
        license_expiry_date: driverForm.license_expiry_date || null,
        daily_rate: parseFloat(driverForm.daily_rate) || 500,
        status: driverForm.status,
      },
    ]);
    if (!error) {
      setOpenDriverModal(false);
      setDriverForm({
        name: '',
        phone: '',
        license_number: '',
        license_expiry_date: '',
        daily_rate: '600',
        status: 'available',
      });
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('customers').insert([customerForm]);
    if (!error) {
      setOpenCustomerModal(false);
      setCustomerForm({
        company_name: '',
        tax_id: '',
        contact_name: '',
        phone: '',
        email: '',
        address: '',
      });
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('locations').insert([locationForm]);
    if (!error) {
      setOpenLocationModal(false);
      setLocationForm({
        name: '',
        location_type: 'depot',
        province: '',
        address: '',
      });
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleAddRateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateCardForm.origin_id || !rateCardForm.destination_id) {
      alert('กรุณาเลือกต้นทางและปลายทาง');
      return;
    }
    const { error } = await supabase.from('rate_cards').insert([
      {
        origin_id: rateCardForm.origin_id,
        destination_id: rateCardForm.destination_id,
        vehicle_type: rateCardForm.vehicle_type,
        base_price: parseFloat(rateCardForm.base_price) || 0,
        fuel_cost_est: parseFloat(rateCardForm.fuel_cost_est) || 0,
        toll_fee_est: parseFloat(rateCardForm.toll_fee_est) || 0,
        driver_fee_est: parseFloat(rateCardForm.driver_fee_est) || 0,
      },
    ]);
    if (!error) {
      setOpenRateCardModal(false);
      fetchData();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  // Delete Handler
  const handleDelete = async (table: string, id: string) => {
    if (!confirm('ยืนยันที่จะลบข้อมูลรายการนี้หรือไม่?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      fetchData();
    } else {
      alert('ไม่สามารถลบได้เนื่องจากมีการใช้งานข้อมูลนี้อยู่ในส่วนอื่น: ' + error.message);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Database className="h-7 w-7 text-blue-600" />
            การจัดการข้อมูลหลัก (Master Data Management)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Module 0: จัดการข้อมูลพื้นฐานของรถบรรทุก, พนักงานขับรถ, ลูกค้า, สถานที่ และเรทราคามาตรฐาน
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

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-200/80 p-1 rounded-xl flex flex-wrap h-auto gap-1">
          <TabsTrigger value="vehicles" className="gap-2">
            <Truck className="h-4 w-4" />
            รถบรรทุก ({vehicles.length})
          </TabsTrigger>
          <TabsTrigger value="drivers" className="gap-2">
            <Users className="h-4 w-4" />
            พนักงานขับรถ ({drivers.length})
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Building2 className="h-4 w-4" />
            ลูกค้า ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-2">
            <MapPin className="h-4 w-4" />
            สถานที่/ลานตู้ ({locations.length})
          </TabsTrigger>
          <TabsTrigger value="rates" className="gap-2">
            <BadgeDollarSign className="h-4 w-4" />
            เรทราคา ({rateCards.length})
          </TabsTrigger>
          <TabsTrigger value="job-types" className="gap-2">
            <FileCheck className="h-4 w-4" />
            ประเภทงาน
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: VEHICLES ================= */}
        <TabsContent value="vehicles">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">รายการรถบรรทุก (Vehicles)</CardTitle>
                <CardDescription>
                  ข้อมูลทะเบียน, ชนิดรถ, และการติดตามวันหมดอายุเอกสาร ISO 39001, ประกันภัย, พรบ.
                </CardDescription>
              </div>
              <Button onClick={() => setOpenVehicleModal(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" /> เพิ่มรถบรรทุก
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ทะเบียนรถ</TableHead>
                      <TableHead>ประเภทรถ</TableHead>
                      <TableHead>ความจุ (ตัน)</TableHead>
                      <TableHead>ตรวจสภาพ ISO 39001</TableHead>
                      <TableHead>วันหมดอายุประกันภัย</TableHead>
                      <TableHead>วันหมดอายุ พรบ.</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                          ยังไม่มีข้อมูลรถบรรทุก
                        </TableCell>
                      </TableRow>
                    ) : (
                      vehicles.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-semibold text-slate-900">{v.plate_number}</TableCell>
                          <TableCell>{vehicleTypeMap[v.vehicle_type] || v.vehicle_type}</TableCell>
                          <TableCell>{v.capacity_tons} ตัน</TableCell>
                          <TableCell>
                            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                              {v.iso_expiry_date || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                              {v.insurance_expiry_date || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                              {v.act_expiry_date || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {v.status === 'active' ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700">พร้อมใช้งาน</Badge>
                            ) : v.status === 'maintenance' ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800">เข้าซ่อม</Badge>
                            ) : (
                              <Badge variant="outline">ไม่พร้อมใช้</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete('vehicles', v.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
        </TabsContent>

        {/* ================= TAB 2: DRIVERS ================= */}
        <TabsContent value="drivers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">พนักงานขับรถ (Drivers / พขร.)</CardTitle>
                <CardDescription>รายชื่อพนักงานขับรถ, ข้อมูลใบขับขี่ และเบอร์โทรศัพท์ติดต่อ</CardDescription>
              </div>
              <Button onClick={() => setOpenDriverModal(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" /> เพิ่ม พขร.
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ - นามสกุล</TableHead>
                      <TableHead>เบอร์โทรศัพท์</TableHead>
                      <TableHead>เลขที่ใบขับขี่</TableHead>
                      <TableHead>วันหมดอายุใบขับขี่</TableHead>
                      <TableHead>เบี้ยเลี้ยงพื้นฐาน (บาท/วัน)</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                          ยังไม่มีข้อมูล พขร.
                        </TableCell>
                      </TableRow>
                    ) : (
                      drivers.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-semibold text-slate-900">{d.name}</TableCell>
                          <TableCell>{d.phone || '-'}</TableCell>
                          <TableCell>{d.license_number || '-'}</TableCell>
                          <TableCell>{d.license_expiry_date || '-'}</TableCell>
                          <TableCell>฿{Number(d.daily_rate).toLocaleString()}</TableCell>
                          <TableCell>
                            {d.status === 'available' ? (
                              <Badge className="bg-emerald-600">พร้อมวิ่งงาน</Badge>
                            ) : d.status === 'on_job' ? (
                              <Badge className="bg-blue-600">กำลังวิ่งงาน</Badge>
                            ) : (
                              <Badge variant="outline">ลา / พักงาน</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete('drivers', d.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
        </TabsContent>

        {/* ================= TAB 3: CUSTOMERS ================= */}
        <TabsContent value="customers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">ลูกค้า (Customers)</CardTitle>
                <CardDescription>รายชื่อบริษัทลูกค้า, เลขประจำตัวผู้เสียภาษี และข้อมูลติดต่อ</CardDescription>
              </div>
              <Button onClick={() => setOpenCustomerModal(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" /> เพิ่มลูกค้า
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อบริษัท</TableHead>
                      <TableHead>เลขผู้เสียภาษี</TableHead>
                      <TableHead>ผู้ติดต่อ</TableHead>
                      <TableHead>เบอร์โทร</TableHead>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>ที่อยู่</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                          ยังไม่มีข้อมูลลูกค้า
                        </TableCell>
                      </TableRow>
                    ) : (
                      customers.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-semibold text-slate-900">{c.company_name}</TableCell>
                          <TableCell>{c.tax_id || '-'}</TableCell>
                          <TableCell>{c.contact_name || '-'}</TableCell>
                          <TableCell>{c.phone || '-'}</TableCell>
                          <TableCell>{c.email || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-slate-500">{c.address || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete('customers', c.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
        </TabsContent>

        {/* ================= TAB 4: LOCATIONS ================= */}
        <TabsContent value="locations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">สถานที่ (Locations)</CardTitle>
                <CardDescription>ลานฝากตู้คอนเทนเนอร์, ท่าเรือรับ-ส่งตู้, และโรงงานลูกค้า</CardDescription>
              </div>
              <Button onClick={() => setOpenLocationModal(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" /> เพิ่มสถานที่
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อสถานที่</TableHead>
                      <TableHead>ประเภทสถานที่</TableHead>
                      <TableHead>จังหวัด</TableHead>
                      <TableHead>รายละเอียดที่อยู่</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                          ยังไม่มีข้อมูลสถานที่
                        </TableCell>
                      </TableRow>
                    ) : (
                      locations.map((loc) => (
                        <TableRow key={loc.id}>
                          <TableCell className="font-semibold text-slate-900">{loc.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {locationTypeMap[loc.location_type] || loc.location_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{loc.province || '-'}</TableCell>
                          <TableCell className="text-xs text-slate-500">{loc.address || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete('locations', loc.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
        </TabsContent>

        {/* ================= TAB 5: RATE CARDS ================= */}
        <TabsContent value="rates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">ตารางเรทราคามาตรฐาน (Rate Cards)</CardTitle>
                <CardDescription>
                  กำหนดราคาค่าบริการและต้นทุนประมาณการแยกตามเส้นทาง (ต้นทาง - ปลายทาง) และประเภทรถ
                </CardDescription>
              </div>
              <Button onClick={() => setOpenRateCardModal(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" /> เพิ่มเรทราคา
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ต้นทาง</TableHead>
                      <TableHead>ปลายทาง</TableHead>
                      <TableHead>ประเภทรถ</TableHead>
                      <TableHead>ราคาขายลูกค้า (บาท)</TableHead>
                      <TableHead>ค่าน้ำมันประมาณการ</TableHead>
                      <TableHead>ค่าทางด่วนประมาณการ</TableHead>
                      <TableHead>ค่าแรง พขร. ประมาณการ</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateCards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                          ยังไม่มีข้อมูลเรทราคา
                        </TableCell>
                      </TableRow>
                    ) : (
                      rateCards.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-semibold">{r.origin?.name || '-'}</TableCell>
                          <TableCell className="font-semibold">{r.destination?.name || '-'}</TableCell>
                          <TableCell>{vehicleTypeMap[r.vehicle_type] || r.vehicle_type}</TableCell>
                          <TableCell className="font-bold text-emerald-600">
                            ฿{Number(r.base_price).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-600">฿{Number(r.fuel_cost_est).toLocaleString()}</TableCell>
                          <TableCell className="text-slate-600">฿{Number(r.toll_fee_est).toLocaleString()}</TableCell>
                          <TableCell className="text-slate-600">฿{Number(r.driver_fee_est).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete('rate_cards', r.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
        </TabsContent>

        {/* ================= TAB 6: JOB TYPES REFERENCE ================= */}
        <TabsContent value="job-types">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ประเภทงานขนส่งตู้คอนเทนเนอร์ (Standard Job Types)</CardTitle>
              <CardDescription>
                มาตรฐาน 4 ประเภทงานหลักของ Connect Transport Co., Ltd. สำหรับเลือกในโมดูลรับงาน
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-xl bg-blue-50/50 border-blue-200">
                  <div className="font-bold text-blue-900 text-base">1. ลากตู้หนักไปเปิด (Heavy to Open)</div>
                  <p className="text-sm text-slate-600 mt-1">
                    รับตู้คอนเทนเนอร์ที่มีสินค้า (ตู้หนัก) จากท่าเรือหรือลานตู้ ไปส่งให้ลูกค้าที่โรงงานเพื่อเปิดถ่ายสินค้าออก (Inbound / นำเข้า)
                  </p>
                </div>
                <div className="p-4 border rounded-xl bg-emerald-50/50 border-emerald-200">
                  <div className="font-bold text-emerald-900 text-base">2. ลากตู้เปล่าไปบรรจุ (Empty to Stuff)</div>
                  <p className="text-sm text-slate-600 mt-1">
                    รับตู้คอนเทนเนอร์เปล่าจากลานตู้ ไปให้ลูกค้าบรรจุสินค้าที่โรงงาน แล้วลากตู้หนักกลับเข้าท่าเรือเพื่อส่งออก (Outbound / ส่งออก)
                  </p>
                </div>
                <div className="p-4 border rounded-xl bg-amber-50/50 border-amber-200">
                  <div className="font-bold text-amber-900 text-base">3. ลากตู้เปล่า (Empty Return)</div>
                  <p className="text-sm text-slate-600 mt-1">
                    ลากตู้เปล่าหลังจากเปิดสินค้าเสร็จแล้ว ส่งกลับไปคืนยังลานตู้ของสายการเดินเรือที่กำหนด
                  </p>
                </div>
                <div className="p-4 border rounded-xl bg-purple-50/50 border-purple-200">
                  <div className="font-bold text-purple-900 text-base">4. ย้ายลาน (Yard Move)</div>
                  <p className="text-sm text-slate-600 mt-1">
                    การขนย้ายตู้คอนเทนเนอร์ระหว่างลาน เช่น จากลานพักตู้ A ไปลานซ่อม B หรือย้ายภายในบริเวณท่าเรือ
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================= MODAL: ADD VEHICLE ================= */}
      <Dialog open={openVehicleModal} onOpenChange={setOpenVehicleModal}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleAddVehicle}>
            <DialogHeader>
              <DialogTitle>เพิ่มข้อมูลรถบรรทุกใหม่</DialogTitle>
              <DialogDescription>กรอกข้อมูลทะเบียนและวันหมดอายุของเอกสารต่างๆ</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="plate">ทะเบียนรถ *</Label>
                <Input 
                  id="plate" 
                  required 
                  placeholder="เช่น 70-9999 กทม." 
                  value={vehicleForm.plate_number}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vtype">ประเภทรถ</Label>
                <select 
                  id="vtype"
                  className="w-full border rounded-md p-2 text-sm bg-white"
                  value={vehicleForm.vehicle_type}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
                >
                  <option value="trailer">รถเทรลเลอร์ (หัวลาก)</option>
                  <option value="semi_trailer">รถกึ่งพ่วง (Semi-Trailer)</option>
                  <option value="10_wheel">รถ 10 ล้อ</option>
                  <option value="6_wheel">รถ 6 ล้อ</option>
                  <option value="4_wheel">รถ 4 ล้อ</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="capacity">ความจุ/น้ำหนักบรรทุก (ตัน)</Label>
                <Input 
                  id="capacity" 
                  type="number"
                  placeholder="32" 
                  value={vehicleForm.capacity_tons}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, capacity_tons: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="iso">วันหมดอายุ ISO 39001</Label>
                  <Input 
                    id="iso" 
                    type="date"
                    value={vehicleForm.iso_expiry_date}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, iso_expiry_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ins">วันหมดอายุประกันภัย</Label>
                  <Input 
                    id="ins" 
                    type="date"
                    value={vehicleForm.insurance_expiry_date}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, insurance_expiry_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="act">วันหมดอายุ พรบ.</Label>
                <Input 
                  id="act" 
                  type="date"
                  value={vehicleForm.act_expiry_date}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, act_expiry_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenVehicleModal(false)}>ยกเลิก</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">บันทึกข้อมูล</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: ADD DRIVER ================= */}
      <Dialog open={openDriverModal} onOpenChange={setOpenDriverModal}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleAddDriver}>
            <DialogHeader>
              <DialogTitle>เพิ่มข้อมูลพนักงานขับรถ (พขร.)</DialogTitle>
              <DialogDescription>กรอกข้อมูลชื่อ, ใบอนุญาตขับขี่ และเบี้ยเลี้ยงต่อวัน</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="dname">ชื่อ - นามสกุล *</Label>
                <Input 
                  id="dname" 
                  required 
                  placeholder="เช่น สมหมาย ใจมั่น" 
                  value={driverForm.name}
                  onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dphone">เบอร์โทรศัพท์</Label>
                <Input 
                  id="dphone" 
                  placeholder="081-xxx-xxxx" 
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="license">เลขที่ใบขับขี่</Label>
                  <Input 
                    id="license" 
                    placeholder="ท.4-xxxxxxx" 
                    value={driverForm.license_number}
                    onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lexp">วันหมดอายุใบขับขี่</Label>
                  <Input 
                    id="lexp" 
                    type="date"
                    value={driverForm.license_expiry_date}
                    onChange={(e) => setDriverForm({ ...driverForm, license_expiry_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rate">เบี้ยเลี้ยงพื้นฐาน (บาท/วัน)</Label>
                <Input 
                  id="rate" 
                  type="number"
                  placeholder="600" 
                  value={driverForm.daily_rate}
                  onChange={(e) => setDriverForm({ ...driverForm, daily_rate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenDriverModal(false)}>ยกเลิก</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">บันทึกข้อมูล</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: ADD CUSTOMER ================= */}
      <Dialog open={openCustomerModal} onOpenChange={setOpenCustomerModal}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleAddCustomer}>
            <DialogHeader>
              <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
              <DialogDescription>บันทึกชื่อบริษัทและข้อมูลติดต่อลูกค้า</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="cname">ชื่อบริษัท *</Label>
                <Input 
                  id="cname" 
                  required 
                  placeholder="บริษัท ... จำกัด" 
                  value={customerForm.company_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, company_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tax">เลขประจำตัวผู้เสียภาษี (13 หลัก)</Label>
                <Input 
                  id="tax" 
                  placeholder="010555xxxxxxx" 
                  value={customerForm.tax_id}
                  onChange={(e) => setCustomerForm({ ...customerForm, tax_id: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="contact">ชื่อผู้ติดต่อ</Label>
                  <Input 
                    id="contact" 
                    placeholder="คุณ..." 
                    value={customerForm.contact_name}
                    onChange={(e) => setCustomerForm({ ...customerForm, contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cphone">เบอร์โทร</Label>
                  <Input 
                    id="cphone" 
                    placeholder="02-xxx-xxxx" 
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cemail">อีเมล</Label>
                <Input 
                  id="cemail" 
                  type="email"
                  placeholder="contact@company.com" 
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="caddr">ที่อยู่บริษัท</Label>
                <Input 
                  id="caddr" 
                  placeholder="ที่อยู่สำหรับออกเอกสารใบกำกับภาษี" 
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCustomerModal(false)}>ยกเลิก</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">บันทึกข้อมูล</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: ADD LOCATION ================= */}
      <Dialog open={openLocationModal} onOpenChange={setOpenLocationModal}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleAddLocation}>
            <DialogHeader>
              <DialogTitle>เพิ่มสถานที่ใหม่</DialogTitle>
              <DialogDescription>บันทึกชื่อลานตู้, ท่าเรือ หรือโรงงาน</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="lname">ชื่อสถานที่ *</Label>
                <Input 
                  id="lname" 
                  required 
                  placeholder="เช่น ท่าเรือแหลมฉบัง C0, ลานตู้ บึงทองคำ" 
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ltype">ประเภทสถานที่</Label>
                <select 
                  id="ltype"
                  className="w-full border rounded-md p-2 text-sm bg-white"
                  value={locationForm.location_type}
                  onChange={(e) => setLocationForm({ ...locationForm, location_type: e.target.value as any })}
                >
                  <option value="depot">ลานฝากตู้ (Depot)</option>
                  <option value="port">ท่าเรือ (Port)</option>
                  <option value="factory">โรงงาน (Factory)</option>
                  <option value="yard">ลานจอด/ลานซ่อม (Yard)</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="lprov">จังหวัด</Label>
                <Input 
                  id="lprov" 
                  placeholder="เช่น ชลบุรี, กรุงเทพฯ, อยุธยา" 
                  value={locationForm.province}
                  onChange={(e) => setLocationForm({ ...locationForm, province: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="laddr">รายละเอียดที่อยู่</Label>
                <Input 
                  id="laddr" 
                  placeholder="ที่อยู่หรือจุดสังเกต" 
                  value={locationForm.address}
                  onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenLocationModal(false)}>ยกเลิก</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">บันทึกข้อมูล</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: ADD RATE CARD ================= */}
      <Dialog open={openRateCardModal} onOpenChange={setOpenRateCardModal}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleAddRateCard}>
            <DialogHeader>
              <DialogTitle>เพิ่มเรทราคามาตรฐาน</DialogTitle>
              <DialogDescription>กำหนดราคาและต้นทุนประมาณการแยกตามเส้นทาง</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="orig">ต้นทาง *</Label>
                  <select 
                    id="orig"
                    required
                    className="w-full border rounded-md p-2 text-sm bg-white"
                    value={rateCardForm.origin_id}
                    onChange={(e) => setRateCardForm({ ...rateCardForm, origin_id: e.target.value })}
                  >
                    <option value="">-- เลือกต้นทาง --</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dest">ปลายทาง *</Label>
                  <select 
                    id="dest"
                    required
                    className="w-full border rounded-md p-2 text-sm bg-white"
                    value={rateCardForm.destination_id}
                    onChange={(e) => setRateCardForm({ ...rateCardForm, destination_id: e.target.value })}
                  >
                    <option value="">-- เลือกปลายทาง --</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rvtype">ประเภทรถ</Label>
                <select 
                  id="rvtype"
                  className="w-full border rounded-md p-2 text-sm bg-white"
                  value={rateCardForm.vehicle_type}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, vehicle_type: e.target.value as any })}
                >
                  <option value="trailer">รถเทรลเลอร์ (หัวลาก)</option>
                  <option value="semi_trailer">รถกึ่งพ่วง (Semi-Trailer)</option>
                  <option value="10_wheel">รถ 10 ล้อ</option>
                  <option value="6_wheel">รถ 6 ล้อ</option>
                  <option value="4_wheel">รถ 4 ล้อ</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="bprice">ราคาขายเรียกเก็บลูกค้า (บาท) *</Label>
                <Input 
                  id="bprice" 
                  type="number"
                  required
                  placeholder="5500" 
                  value={rateCardForm.base_price}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, base_price: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="rfuel" className="text-xs">ค่าน้ำมัน (ประมาณ)</Label>
                  <Input 
                    id="rfuel" 
                    type="number"
                    value={rateCardForm.fuel_cost_est}
                    onChange={(e) => setRateCardForm({ ...rateCardForm, fuel_cost_est: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rtoll" className="text-xs">ค่าทางด่วน (ประมาณ)</Label>
                  <Input 
                    id="rtoll" 
                    type="number"
                    value={rateCardForm.toll_fee_est}
                    onChange={(e) => setRateCardForm({ ...rateCardForm, toll_fee_est: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rdriver" className="text-xs">ค่าแรง พขร. (ประมาณ)</Label>
                  <Input 
                    id="rdriver" 
                    type="number"
                    value={rateCardForm.driver_fee_est}
                    onChange={(e) => setRateCardForm({ ...rateCardForm, driver_fee_est: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenRateCardModal(false)}>ยกเลิก</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">บันทึกเรทราคา</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
