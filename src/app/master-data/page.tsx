'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Vehicle, Driver, Customer, Location, RateCard, VehicleType, ContainerSize, ContainerType, LocationType } from '@/types/database';
import { logActivity } from '@/lib/audit-logger';
import { useAuth } from '@/lib/auth-context';
import { SortableHeader, sortArray, SortState } from '@/components/ui/table-sort';
import { 
  Truck, 
  Users, 
  Building2, 
  MapPin, 
  BadgeDollarSign, 
  Plus, 
  Trash2, 
  Edit3,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Database,
  Download,
  Printer,
  Calendar,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Search,
  Navigation,
  Crosshair,
  Copy,
  Check
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

// Google Maps URL Resolver Helper
function getGoogleMapsUrl(locationMap?: string | null, name?: string | null, province?: string | null): string {
  if (locationMap && locationMap.trim()) {
    const trimmed = locationMap.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    // Check if it's coordinates e.g. "13.1234, 100.5678"
    const coordMatch = trimmed.match(/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)[,\s]+[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/);
    if (coordMatch) {
      return `https://www.google.com/maps?q=${encodeURIComponent(trimmed.replace(/\s+/g, ''))}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
  }
  const searchQuery = [name, province, 'ประเทศไทย'].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
}

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

export default function MasterDataPage() {
  const { currentUser, currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState('vehicles');
  const [loading, setLoading] = useState(false);

  // States for Master Data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);

  // Sorting States
  const [vehicleSort, setVehicleSort] = useState<SortState>({ key: 'truck_name_id', direction: 'asc' });
  const [driverSort, setDriverSort] = useState<SortState>({ key: 'name', direction: 'asc' });
  const [customerSort, setCustomerSort] = useState<SortState>({ key: 'company_name', direction: 'asc' });
  const [locationSort, setLocationSort] = useState<SortState>({ key: 'name', direction: 'asc' });
  const [rateCardSort, setRateCardSort] = useState<SortState>({ key: 'base_price', direction: 'desc' });

  const handleSort = (
    key: string,
    currentSort: SortState,
    setSort: React.Dispatch<React.SetStateAction<SortState>>
  ) => {
    if (currentSort.key === key) {
      setSort({ key, direction: currentSort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ key, direction: 'asc' });
    }
  };

  // Memoized Sorted Arrays
  const sortedVehicles = useMemo(() => {
    return sortArray(vehicles, vehicleSort.key, vehicleSort.direction, (v) => {
      if (vehicleSort.key === 'driver') return v.driver?.name || '';
      if (vehicleSort.key === 'truck_brand') return `${v.truck_brand || ''} ${v.truck_model || ''}`;
      return (v as any)[vehicleSort.key];
    });
  }, [vehicles, vehicleSort]);

  const sortedDrivers = useMemo(() => {
    return sortArray(drivers, driverSort.key, driverSort.direction);
  }, [drivers, driverSort]);

  const sortedCustomers = useMemo(() => {
    return sortArray(customers, customerSort.key, customerSort.direction);
  }, [customers, customerSort]);

  const sortedLocations = useMemo(() => {
    return sortArray(locations, locationSort.key, locationSort.direction);
  }, [locations, locationSort]);

  const sortedRateCards = useMemo(() => {
    return sortArray(rateCards, rateCardSort.key, rateCardSort.direction, (r) => {
      if (rateCardSort.key === 'customer') return r.customer?.company_name || '';
      if (rateCardSort.key === 'origin') return r.origin?.name || '';
      if (rateCardSort.key === 'destination') return r.destination?.name || '';
      if (rateCardSort.key === 'cost') return Number(r.fuel_cost_est || 0) + Number(r.toll_fee_est || 0) + Number(r.driver_fee_est || 0);
      if (rateCardSort.key === 'profit') {
        const totalCost = Number(r.fuel_cost_est || 0) + Number(r.toll_fee_est || 0) + Number(r.driver_fee_est || 0);
        return Number(r.base_price || 0) - totalCost;
      }
      return (r as any)[rateCardSort.key];
    });
  }, [rateCards, rateCardSort]);

  // Dialog States
  const [openVehicleModal, setOpenVehicleModal] = useState(false);
  const [openDriverModal, setOpenDriverModal] = useState(false);
  const [openCustomerModal, setOpenCustomerModal] = useState(false);
  const [openLocationModal, setOpenLocationModal] = useState(false);
  const [openRateCardModal, setOpenRateCardModal] = useState(false);

  // Editing State IDs (null when creating new)
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);
  const [editDriverId, setEditDriverId] = useState<string | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editRateCardId, setEditRateCardId] = useState<string | null>(null);

  // Form States
  const [vehicleForm, setVehicleForm] = useState({
    truck_name_id: '',
    plate_number: '',
    truck_brand: 'Hino',
    truck_model: 'S700',
    register_year: '2565',
    vehicle_type: 'trailer' as VehicleType,
    capacity_tons: '32',
    driver_id: '',
    tax_expiry_date: '',
    insurance_expiry_date: '',
    act_expiry_date: '',
    gps_brand: 'DTC GPS',
    status: 'active' as 'active' | 'maintenance' | 'inactive',
  });

  const [driverForm, setDriverForm] = useState({
    name: '',
    phone: '',
    id_number: '',
    license_number: '',
    license_expiry_date: '',
    daily_rate: '600',
    status: 'available' as 'available' | 'on_job' | 'leave' | 'inactive',
  });

  const [customerForm, setCustomerForm] = useState({
    company_name: '',
    branch: 'สำนักงานใหญ่',
    tax_id: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    credit_term_days: '30',
    shipper_name: '',
    commodity_name: '',
  });

  const [locationForm, setLocationForm] = useState({
    name: '',
    location_type: 'depot' as LocationType,
    province: '',
    address: '',
    contact_name: '',
    phone: '',
    location_map: '',
    location_remark: '',
  });

  const [fetchingGps, setFetchingGps] = useState(false);

  const [rateCardForm, setRateCardForm] = useState({
    customer_id: '',
    origin_id: '',
    destination_id: '',
    container_size: '40' as ContainerSize,
    container_type: 'HC' as ContainerType,
    vehicle_type: 'trailer' as VehicleType,
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
        supabase.from('vehicles').select('*, driver:drivers(*)').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('locations').select('*').order('name', { ascending: true }),
        supabase.from('rate_cards').select('*, customer:customers(*), origin:locations!origin_id(*), destination:locations!destination_id(*)'),
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

  // -------------------------------------------------------------------
  // 1. VEHICLE HANDLERS
  // -------------------------------------------------------------------
  const handleOpenAddVehicle = () => {
    setEditVehicleId(null);
    setVehicleForm({
      truck_name_id: `รถคัน-${vehicles.length + 1}`,
      plate_number: '',
      truck_brand: 'Hino',
      truck_model: 'S700',
      register_year: '2565',
      vehicle_type: 'trailer',
      capacity_tons: '32',
      driver_id: '',
      tax_expiry_date: '',
      insurance_expiry_date: '',
      act_expiry_date: '',
      gps_brand: 'DTC GPS',
      status: 'active',
    });
    setOpenVehicleModal(true);
  };

  const handleOpenEditVehicle = (v: Vehicle) => {
    setEditVehicleId(v.id);
    setVehicleForm({
      truck_name_id: v.truck_name_id || '',
      plate_number: v.plate_number || '',
      truck_brand: v.truck_brand || 'Hino',
      truck_model: v.truck_model || '',
      register_year: v.register_year || '',
      vehicle_type: v.vehicle_type || 'trailer',
      capacity_tons: String(v.capacity_tons || 32),
      driver_id: v.driver_id || '',
      tax_expiry_date: v.tax_expiry_date || '',
      insurance_expiry_date: v.insurance_expiry_date || '',
      act_expiry_date: v.act_expiry_date || '',
      gps_brand: v.gps_brand || '',
      status: v.status || 'active',
    });
    setOpenVehicleModal(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      truck_name_id: vehicleForm.truck_name_id || `รถคัน-${vehicleForm.plate_number.slice(0, 4)}`,
      plate_number: vehicleForm.plate_number,
      truck_brand: vehicleForm.truck_brand,
      truck_model: vehicleForm.truck_model,
      register_year: vehicleForm.register_year,
      vehicle_type: vehicleForm.vehicle_type,
      capacity_tons: parseFloat(vehicleForm.capacity_tons) || 0,
      driver_id: vehicleForm.driver_id || null,
      tax_expiry_date: vehicleForm.tax_expiry_date || null,
      insurance_expiry_date: vehicleForm.insurance_expiry_date || null,
      act_expiry_date: vehicleForm.act_expiry_date || null,
      gps_brand: vehicleForm.gps_brand,
      status: vehicleForm.status,
    };

    if (editVehicleId) {
      const { error } = await supabase.from('vehicles').update(payload).eq('id', editVehicleId);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'UPDATE',
          module: 'MASTER_DATA',
          description: `แก้ไขข้อมูลรถบรรทุก: ${payload.truck_name_id} (${payload.plate_number})`,
        });
        setOpenVehicleModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาดในการแก้ไข: ' + error.message);
      }
    } else {
      const { error } = await supabase.from('vehicles').insert([payload]);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'CREATE',
          module: 'MASTER_DATA',
          description: `เพิ่มรถบรรทุกใหม่: ${payload.truck_name_id} (${payload.plate_number}) ผูกคนขับ`,
        });
        setOpenVehicleModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
      }
    }
  };

  const exportVehiclesCsv = () => {
    const headers = ['รหัสย่อ', 'ป้ายทะเบียน', 'ยี่ห้อ', 'รุ่น', 'ปีจดทะเบียน', 'ชนิดรถ', 'น้ำหนัก(ตัน)', 'คนขับประจำรถ', 'วันหมดอายุภาษี', 'พรบ.', 'ประกันภัย', 'GPS', 'สถานะ'];
    const rows = vehicles.map(v => [
      v.truck_name_id || '-',
      v.plate_number,
      v.truck_brand || '-',
      v.truck_model || '-',
      v.register_year || '-',
      vehicleTypeMap[v.vehicle_type] || v.vehicle_type,
      v.capacity_tons,
      v.driver?.name || 'ยังไม่ผูกคนขับ',
      v.tax_expiry_date || '-',
      v.act_expiry_date || '-',
      v.insurance_expiry_date || '-',
      v.gps_brand || '-',
      v.status
    ]);
    exportToCsv('Vehicles_Master', headers, rows);
  };

  // -------------------------------------------------------------------
  // 2. DRIVER HANDLERS
  // -------------------------------------------------------------------
  const handleOpenAddDriver = () => {
    setEditDriverId(null);
    setDriverForm({
      name: '',
      phone: '',
      id_number: '',
      license_number: '',
      license_expiry_date: '',
      daily_rate: '600',
      status: 'available',
    });
    setOpenDriverModal(true);
  };

  const handleOpenEditDriver = (d: Driver) => {
    setEditDriverId(d.id);
    setDriverForm({
      name: d.name || '',
      phone: d.phone || '',
      id_number: d.id_number || '',
      license_number: d.license_number || '',
      license_expiry_date: d.license_expiry_date || '',
      daily_rate: String(d.daily_rate || 600),
      status: d.status || 'available',
    });
    setOpenDriverModal(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: driverForm.name,
      phone: driverForm.phone,
      id_number: driverForm.id_number || null,
      license_number: driverForm.license_number,
      license_expiry_date: driverForm.license_expiry_date || null,
      daily_rate: parseFloat(driverForm.daily_rate) || 500,
      status: driverForm.status,
    };

    if (editDriverId) {
      const { error } = await supabase.from('drivers').update(payload).eq('id', editDriverId);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'UPDATE',
          module: 'MASTER_DATA',
          description: `แก้ไขข้อมูล พขร.: ${payload.name}`,
        });
        setOpenDriverModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    } else {
      const { error } = await supabase.from('drivers').insert([payload]);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'CREATE',
          module: 'MASTER_DATA',
          description: `เพิ่ม พขร. ใหม่: ${payload.name}`,
        });
        setOpenDriverModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    }
  };

  const exportDriversCsv = () => {
    const headers = ['ชื่อ - นามสกุล', 'เบอร์โทรศัพท์', 'เลขบัตรประชาชน', 'เลขที่ใบขับขี่', 'วันหมดอายุใบขับขี่', 'เบี้ยเลี้ยงมาตรฐาน', 'สถานะ'];
    const rows = drivers.map(d => [
      d.name,
      d.phone || '-',
      d.id_number || '-',
      d.license_number || '-',
      d.license_expiry_date || '-',
      d.daily_rate,
      d.status
    ]);
    exportToCsv('Drivers_Master', headers, rows);
  };

  // -------------------------------------------------------------------
  // 3. CUSTOMER HANDLERS
  // -------------------------------------------------------------------
  const handleOpenAddCustomer = () => {
    setEditCustomerId(null);
    setCustomerForm({
      company_name: '',
      branch: 'สำนักงานใหญ่',
      tax_id: '',
      contact_name: '',
      phone: '',
      email: '',
      address: '',
      credit_term_days: '30',
      shipper_name: '',
      commodity_name: '',
    });
    setOpenCustomerModal(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setEditCustomerId(c.id);
    setCustomerForm({
      company_name: c.company_name || '',
      branch: c.branch || 'สำนักงานใหญ่',
      tax_id: c.tax_id || '',
      contact_name: c.contact_name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      credit_term_days: String(c.credit_term_days || 30),
      shipper_name: c.shipper_name || '',
      commodity_name: c.commodity_name || '',
    });
    setOpenCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      company_name: customerForm.company_name,
      branch: customerForm.branch || 'สำนักงานใหญ่',
      tax_id: customerForm.tax_id,
      contact_name: customerForm.contact_name,
      phone: customerForm.phone,
      email: customerForm.email,
      address: customerForm.address,
      credit_term_days: parseInt(customerForm.credit_term_days) || 30,
      shipper_name: customerForm.shipper_name || null,
      commodity_name: customerForm.commodity_name || null,
    };

    if (editCustomerId) {
      const { error } = await supabase.from('customers').update(payload).eq('id', editCustomerId);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'UPDATE',
          module: 'MASTER_DATA',
          description: `แก้ไขข้อมูลลูกค้า: ${payload.company_name}`,
        });
        setOpenCustomerModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    } else {
      const { error } = await supabase.from('customers').insert([payload]);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'CREATE',
          module: 'MASTER_DATA',
          description: `เพิ่มลูกค้าใหม่: ${payload.company_name}`,
        });
        setOpenCustomerModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    }
  };

  const exportCustomersCsv = () => {
    const headers = ['ชื่อบริษัทลูกค้า', 'สาขา', 'เลขผู้เสียภาษี 13 หลัก', 'ผู้ติดต่อ', 'เบอร์โทร', 'อีเมล', 'ที่อยู่ ภ.พ.20', 'เครดิตเทอม(วัน)', 'Shipper ประจำ', 'สินค้า'];
    const rows = customers.map(c => [
      c.company_name,
      c.branch || 'สำนักงานใหญ่',
      c.tax_id || '-',
      c.contact_name || '-',
      c.phone || '-',
      c.email || '-',
      c.address || '-',
      c.credit_term_days || 30,
      c.shipper_name || '-',
      c.commodity_name || '-'
    ]);
    exportToCsv('Customers_Master', headers, rows);
  };

  // -------------------------------------------------------------------
  // 4. LOCATION HANDLERS
  // -------------------------------------------------------------------
  const handleOpenAddLocation = () => {
    setEditLocationId(null);
    setLocationForm({
      name: '',
      location_type: 'depot',
      province: '',
      address: '',
      contact_name: '',
      phone: '',
      location_map: '',
      location_remark: '',
    });
    setOpenLocationModal(true);
  };

  const handleOpenEditLocation = (l: Location) => {
    setEditLocationId(l.id);
    setLocationForm({
      name: l.name || '',
      location_type: l.location_type || 'depot',
      province: l.province || '',
      address: l.address || '',
      contact_name: l.contact_name || '',
      phone: l.phone || '',
      location_map: l.location_map || '',
      location_remark: l.location_remark || '',
    });
    setOpenLocationModal(true);
  };

  const handleGetCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('เบราว์เซอร์ไม่รองรับการดึงพิกัด Geolocation');
      return;
    }
    setFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFetchingGps(false);
        const coords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        setLocationForm((prev) => ({ ...prev, location_map: coords }));
      },
      (err) => {
        setFetchingGps(false);
        alert('ไม่สามารถดึงพิกัดได้: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleOpenGoogleMapsToPick = () => {
    const url = getGoogleMapsUrl(locationForm.location_map, locationForm.name, locationForm.province);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: locationForm.name,
      location_type: locationForm.location_type,
      province: locationForm.province,
      address: locationForm.address,
      contact_name: locationForm.contact_name || null,
      phone: locationForm.phone || null,
      location_map: locationForm.location_map || null,
      location_remark: locationForm.location_remark || null,
    };

    if (editLocationId) {
      const { error } = await supabase.from('locations').update(payload).eq('id', editLocationId);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'UPDATE',
          module: 'MASTER_DATA',
          description: `แก้ไขสถานที่: ${payload.name}`,
        });
        setOpenLocationModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    } else {
      const { error } = await supabase.from('locations').insert([payload]);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'CREATE',
          module: 'MASTER_DATA',
          description: `เพิ่มสถานที่ใหม่: ${payload.name}`,
        });
        setOpenLocationModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    }
  };

  const exportLocationsCsv = () => {
    const headers = ['ชื่อสถานที่', 'ประเภทสถานที่', 'จังหวัด', 'ที่อยู่', 'ผู้ประสานงาน', 'เบอร์โทร', 'พิกัด GPS/Map', 'จุดสังเกต'];
    const rows = locations.map(l => [
      l.name,
      locationTypeMap[l.location_type] || l.location_type,
      l.province || '-',
      l.address || '-',
      l.contact_name || '-',
      l.phone || '-',
      l.location_map || '-',
      l.location_remark || '-'
    ]);
    exportToCsv('Locations_Master', headers, rows);
  };

  // -------------------------------------------------------------------
  // 5. RATE CARD HANDLERS
  // -------------------------------------------------------------------
  const handleOpenAddRateCard = () => {
    setEditRateCardId(null);
    setRateCardForm({
      customer_id: '',
      origin_id: locations[0]?.id || '',
      destination_id: locations[1]?.id || '',
      container_size: '40',
      container_type: 'HC',
      vehicle_type: 'trailer',
      base_price: '5500',
      fuel_cost_est: '1800',
      toll_fee_est: '200',
      driver_fee_est: '600',
    });
    setOpenRateCardModal(true);
  };

  const handleOpenEditRateCard = (r: RateCard) => {
    setEditRateCardId(r.id);
    setRateCardForm({
      customer_id: r.customer_id || '',
      origin_id: r.origin_id || '',
      destination_id: r.destination_id || '',
      container_size: (r.container_size as ContainerSize) || '40',
      container_type: (r.container_type as ContainerType) || 'HC',
      vehicle_type: r.vehicle_type || 'trailer',
      base_price: String(r.base_price || 0),
      fuel_cost_est: String(r.fuel_cost_est || 0),
      toll_fee_est: String(r.toll_fee_est || 0),
      driver_fee_est: String(r.driver_fee_est || 0),
    });
    setOpenRateCardModal(true);
  };

  const handleSaveRateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateCardForm.origin_id || !rateCardForm.destination_id) {
      alert('กรุณาเลือกสถานที่ต้นทางและปลายทาง');
      return;
    }

    const payload = {
      customer_id: rateCardForm.customer_id || null,
      origin_id: rateCardForm.origin_id,
      destination_id: rateCardForm.destination_id,
      container_size: rateCardForm.container_size,
      container_type: rateCardForm.container_type,
      vehicle_type: rateCardForm.vehicle_type,
      base_price: parseFloat(rateCardForm.base_price) || 0,
      fuel_cost_est: parseFloat(rateCardForm.fuel_cost_est) || 0,
      toll_fee_est: parseFloat(rateCardForm.toll_fee_est) || 0,
      driver_fee_est: parseFloat(rateCardForm.driver_fee_est) || 0,
    };

    if (editRateCardId) {
      const { error } = await supabase.from('rate_cards').update(payload).eq('id', editRateCardId);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'UPDATE',
          module: 'MASTER_DATA',
          description: `แก้ไขเรทราคาเส้นทาง: ฿${payload.base_price}`,
        });
        setOpenRateCardModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    } else {
      const { error } = await supabase.from('rate_cards').insert([payload]);
      if (!error) {
        logActivity({
          user_id: currentUser?.id || 'sys',
          user_name: currentUser?.name || 'User',
          user_role: currentRole?.id || 'admin',
          action: 'CREATE',
          module: 'MASTER_DATA',
          description: `สร้างเรทราคาใหม่: ฿${payload.base_price}`,
        });
        setOpenRateCardModal(false);
        fetchData();
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    }
  };

  const exportRatesCsv = () => {
    const headers = ['ลูกค้า', 'ต้นทาง', 'ปลายทาง', 'ขนาดตู้', 'ชนิดตู้', 'ประเภทรถ', 'ราคาเรียกเก็บ(บาท)', 'น้ำมันประมาณการ', 'ทางด่วนประมาณการ', 'ค่าแรง พขร.', 'กำไรประมาณการ'];
    const rows = rateCards.map(r => {
      const totalCost = Number(r.fuel_cost_est || 0) + Number(r.toll_fee_est || 0) + Number(r.driver_fee_est || 0);
      const profit = Number(r.base_price || 0) - totalCost;
      return [
        r.customer?.company_name || 'เรททั่วไป (ทุกราย)',
        r.origin?.name || '-',
        r.destination?.name || '-',
        r.container_size ? `${r.container_size}'` : '-',
        r.container_type || '-',
        vehicleTypeMap[r.vehicle_type] || r.vehicle_type,
        r.base_price,
        r.fuel_cost_est,
        r.toll_fee_est,
        r.driver_fee_est,
        profit
      ];
    });
    exportToCsv('RateCards_Master', headers, rows);
  };

  // -------------------------------------------------------------------
  // DELETE HANDLER (SHARED)
  // -------------------------------------------------------------------
  const handleDelete = async (table: string, id: string, nameDesc: string) => {
    if (!confirm(`ยืนยันที่จะลบข้อมูล "${nameDesc}" หรือไม่?`)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      logActivity({
        user_id: currentUser?.id || 'sys',
        user_name: currentUser?.name || 'User',
        user_role: currentRole?.id || 'admin',
        action: 'DELETE',
        module: 'MASTER_DATA',
        description: `ลบข้อมูลใน ${table}: ${nameDesc}`,
      });
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
            Module 0: จัดการข้อมูลพื้นฐานของรถบรรทุก, การผูกรถกับคนขับประจำรถ, ลูกค้า, สถานที่ และเรทราคามาตรฐาน
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            พิมพ์รายงาน
          </Button>
        </div>
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
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">รายการรถบรรทุก (Vehicles)</CardTitle>
                <CardDescription>
                  รหัสอ้างอิงรถย่อ (เช่น รถคัน-1) ผูกกับคนขับประจำรถ, ทะเบียน, ติดตามวันหมดอายุภาษี/พรบ./ประกัน
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportVehiclesCsv} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button onClick={handleOpenAddVehicle} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
                  <Plus className="h-3.5 w-3.5" /> เพิ่มรถบรรทุก
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/80">
                      <SortableHeader title="รหัสรถย่อ" sortKey="truck_name_id" currentSort={vehicleSort} onSort={(k) => handleSort(k, vehicleSort, setVehicleSort)} className="font-bold text-blue-900" />
                      <SortableHeader title="ป้ายทะเบียน" sortKey="plate_number" currentSort={vehicleSort} onSort={(k) => handleSort(k, vehicleSort, setVehicleSort)} />
                      <SortableHeader title="ยี่ห้อ / รุ่น / ปี" sortKey="truck_brand" currentSort={vehicleSort} onSort={(k) => handleSort(k, vehicleSort, setVehicleSort)} />
                      <SortableHeader title="คนขับประจำรถ" sortKey="driver" currentSort={vehicleSort} onSort={(k) => handleSort(k, vehicleSort, setVehicleSort)} />
                      <SortableHeader title="ชนิดรถ" sortKey="vehicle_type" currentSort={vehicleSort} onSort={(k) => handleSort(k, vehicleSort, setVehicleSort)} />
                      <SortableHeader title="ภาษีป้ายวงกลม" sortKey="tax_expiry_date" currentSort={vehicleSort} onSort={(k) => handleSort(k, vehicleSort, setVehicleSort)} />
                      <SortableHeader title="พรบ. ขนส่ง" sortKey="act_expiry_date" currentSort={vehicleSort} onSort={(k) => handleSort(k, vehicleSort, setVehicleSort)} />
                      <SortableHeader title="ประกันภัย" sortKey="insurance_expiry_date" currentSort={vehicleSort} onSort={(k) => handleSort(k, vehicleSort, setVehicleSort)} />
                      <SortableHeader title="สถานะ" sortKey="status" currentSort={vehicleSort} onSort={(k) => handleSort(k, vehicleSort, setVehicleSort)} />
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVehicles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-6 text-slate-500">
                          ไม่พบข้อมูลรถบรรทุกในระบบ
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedVehicles.map((v, idx) => (
                        <TableRow key={v.id} className="hover:bg-slate-50">
                          <TableCell className="font-bold">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200 text-xs font-mono">
                              {v.truck_name_id || `รถคัน-${idx + 1}`}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900">{v.plate_number}</TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {v.truck_brand || 'Hino'} {v.truck_model || ''} {v.register_year ? `(${v.register_year})` : ''}
                          </TableCell>
                          <TableCell>
                            {v.driver ? (
                              <div className="text-xs">
                                <div className="font-semibold text-slate-900">{v.driver.name}</div>
                                <div className="text-slate-500 text-[11px]">{v.driver.phone || '-'}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-amber-600 italic">ยังไม่ผูกคนขับ</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {vehicleTypeMap[v.vehicle_type] || v.vehicle_type} ({v.capacity_tons} ตัน)
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {v.tax_expiry_date || '-'}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {v.act_expiry_date || '-'}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {v.insurance_expiry_date || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={v.status === 'active' ? 'default' : v.status === 'maintenance' ? 'destructive' : 'secondary'}
                              className="text-[11px]"
                            >
                              {v.status === 'active' ? 'พร้อมใช้' : v.status === 'maintenance' ? 'เข้าซ่อม' : 'ปิดการใช้งาน'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditVehicle(v)}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete('vehicles', v.id, v.truck_name_id || v.plate_number)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

        {/* ================= TAB 2: DRIVERS ================= */}
        <TabsContent value="drivers">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">พนักงานขับรถ / พขร. (Drivers)</CardTitle>
                <CardDescription>
                  ข้อมูลชื่อ, เบอร์โทร, เลขประจำตัวประชาชน 13 หลัก, ใบอนุญาตขับขี่ ท.4 และเบี้ยเลี้ยงมาตรฐาน
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportDriversCsv} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button onClick={handleOpenAddDriver} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
                  <Plus className="h-3.5 w-3.5" /> เพิ่ม พขร.
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/80">
                      <SortableHeader title="ชื่อ - นามสกุล" sortKey="name" currentSort={driverSort} onSort={(k) => handleSort(k, driverSort, setDriverSort)} className="font-bold text-blue-900" />
                      <SortableHeader title="เบอร์โทรศัพท์" sortKey="phone" currentSort={driverSort} onSort={(k) => handleSort(k, driverSort, setDriverSort)} />
                      <SortableHeader title="เลขบัตรประชาชน (13 หลัก)" sortKey="id_number" currentSort={driverSort} onSort={(k) => handleSort(k, driverSort, setDriverSort)} />
                      <SortableHeader title="เลขที่ใบขับขี่" sortKey="license_number" currentSort={driverSort} onSort={(k) => handleSort(k, driverSort, setDriverSort)} />
                      <SortableHeader title="วันหมดอายุใบขับขี่" sortKey="license_expiry_date" currentSort={driverSort} onSort={(k) => handleSort(k, driverSort, setDriverSort)} />
                      <SortableHeader title="เบี้ยเลี้ยงพื้นฐาน" sortKey="daily_rate" currentSort={driverSort} onSort={(k) => handleSort(k, driverSort, setDriverSort)} align="right" />
                      <SortableHeader title="สถานะ" sortKey="status" currentSort={driverSort} onSort={(k) => handleSort(k, driverSort, setDriverSort)} />
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDrivers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                          ไม่พบข้อมูลพนักงานขับรถ
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedDrivers.map((d) => (
                        <TableRow key={d.id} className="hover:bg-slate-50">
                          <TableCell className="font-semibold text-slate-900">{d.name}</TableCell>
                          <TableCell className="text-xs text-slate-600">{d.phone || '-'}</TableCell>
                          <TableCell className="text-xs font-mono text-slate-700">{d.id_number || '-'}</TableCell>
                          <TableCell className="text-xs font-mono">{d.license_number || '-'}</TableCell>
                          <TableCell className="text-xs font-mono">{d.license_expiry_date || '-'}</TableCell>
                          <TableCell className="text-right font-medium text-slate-900">
                            ฿{Number(d.daily_rate).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={d.status === 'available' ? 'default' : 'secondary'} className="text-[11px]">
                              {d.status === 'available' ? 'พร้อมวิ่งงาน' : d.status === 'on_job' ? 'กำลังวิ่งงาน' : 'ลา'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditDriver(d)}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete('drivers', d.id, d.name)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

        {/* ================= TAB 3: CUSTOMERS ================= */}
        <TabsContent value="customers">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">ลูกค้าผู้ว่าจ้าง (Customers)</CardTitle>
                <CardDescription>
                  ข้อมูลบริษัทสำหรับออกใบแจ้งหนี้ (Invoice), สาขา, เครดิตเทอม, เลขผู้เสียภาษี 13 หลัก, และ Shipper ประจำ
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportCustomersCsv} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button onClick={handleOpenAddCustomer} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
                  <Plus className="h-3.5 w-3.5" /> เพิ่มลูกค้า
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/80">
                      <SortableHeader title="ชื่อบริษัทลูกค้า" sortKey="company_name" currentSort={customerSort} onSort={(k) => handleSort(k, customerSort, setCustomerSort)} className="font-bold text-blue-900" />
                      <SortableHeader title="สาขา" sortKey="branch" currentSort={customerSort} onSort={(k) => handleSort(k, customerSort, setCustomerSort)} />
                      <SortableHeader title="เลขผู้เสียภาษี (13 หลัก)" sortKey="tax_id" currentSort={customerSort} onSort={(k) => handleSort(k, customerSort, setCustomerSort)} />
                      <SortableHeader title="เครดิตเทอม" sortKey="credit_term_days" currentSort={customerSort} onSort={(k) => handleSort(k, customerSort, setCustomerSort)} />
                      <SortableHeader title="ผู้ติดต่อ / โทรศัพท์" sortKey="contact_name" currentSort={customerSort} onSort={(k) => handleSort(k, customerSort, setCustomerSort)} />
                      <SortableHeader title="Shipper ประจำ" sortKey="shipper_name" currentSort={customerSort} onSort={(k) => handleSort(k, customerSort, setCustomerSort)} />
                      <SortableHeader title="สินค้าประจำ" sortKey="commodity_name" currentSort={customerSort} onSort={(k) => handleSort(k, customerSort, setCustomerSort)} />
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                          ไม่พบข้อมูลลูกค้า
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedCustomers.map((c) => (
                        <TableRow key={c.id} className="hover:bg-slate-50">
                          <TableCell className="font-semibold text-slate-900">
                            <div>{c.company_name}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">{c.address}</div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{c.branch || 'สำนักงานใหญ่'}</TableCell>
                          <TableCell className="text-xs font-mono text-slate-800">{c.tax_id || '-'}</TableCell>
                          <TableCell className="text-xs font-bold text-rose-600">
                            {c.credit_term_days ? `${c.credit_term_days} วัน` : '30 วัน'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            <div>{c.contact_name || '-'}</div>
                            <div className="text-slate-400 text-[11px]">{c.phone || '-'}</div>
                          </TableCell>
                          <TableCell className="text-xs text-blue-900 font-medium">{c.shipper_name || '-'}</TableCell>
                          <TableCell className="text-xs text-slate-600">{c.commodity_name || '-'}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditCustomer(c)}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete('customers', c.id, c.company_name)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

        {/* ================= TAB 4: LOCATIONS ================= */}
        <TabsContent value="locations">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">สถานที่ / ลานฝากตู้ / ท่าเรือ (Locations)</CardTitle>
                <CardDescription>
                  จุดรับตู้, จุดบรรจุสินค้า, จุดคืนตู้ (เช่น ท่าเรือคลองเตย PAT, ลานบึงทองคำ) พร้อมพิกัด GPS และจุดสังเกต
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportLocationsCsv} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button onClick={handleOpenAddLocation} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
                  <Plus className="h-3.5 w-3.5" /> เพิ่มสถานที่
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/80">
                      <SortableHeader title="ชื่อสถานที่" sortKey="name" currentSort={locationSort} onSort={(k) => handleSort(k, locationSort, setLocationSort)} className="font-bold text-blue-900" />
                      <SortableHeader title="ประเภท" sortKey="location_type" currentSort={locationSort} onSort={(k) => handleSort(k, locationSort, setLocationSort)} />
                      <SortableHeader title="จังหวัด" sortKey="province" currentSort={locationSort} onSort={(k) => handleSort(k, locationSort, setLocationSort)} />
                      <SortableHeader title="ผู้ประสานงาน / เบอร์โทร" sortKey="contact_name" currentSort={locationSort} onSort={(k) => handleSort(k, locationSort, setLocationSort)} />
                      <TableHead>พิกัด GPS / แผนที่</TableHead>
                      <TableHead>จุดสังเกตหน้างาน</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLocations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                          ไม่พบข้อมูลสถานที่
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedLocations.map((l) => (
                        <TableRow key={l.id} className="hover:bg-slate-50">
                          <TableCell className="font-semibold text-slate-900">
                            <div>{l.name}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">{l.address}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {locationTypeMap[l.location_type] || l.location_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{l.province || '-'}</TableCell>
                          <TableCell className="text-xs text-slate-600">
                            <div>{l.contact_name || '-'}</div>
                            <div className="text-slate-400 text-[11px]">{l.phone || '-'}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {l.location_map ? (
                              <a
                                href={getGoogleMapsUrl(l.location_map, l.name, l.province)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-900 border border-blue-200 transition-all font-mono text-[11px] font-medium group"
                                title="คลิกเพื่อเปิดดูตำแหน่งจริงบน Google Maps (เปิดแท็บใหม่)"
                              >
                                <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="truncate max-w-[130px]">{l.location_map}</span>
                                <ExternalLink className="h-3 w-3 text-blue-500 shrink-0 opacity-70 group-hover:opacity-100" />
                              </a>
                            ) : (
                              <a
                                href={getGoogleMapsUrl(null, l.name, l.province)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-blue-700 hover:bg-slate-100 transition-colors"
                                title="ยังไม่ระบุพิกัด - คลิกเพื่อค้นหาบน Google Maps และคัดลอกพิกัดมาใส่"
                              >
                                <Search className="h-3 w-3 text-slate-400" />
                                <span>ค้นหาบน Maps</span>
                                <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
                              </a>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{l.location_remark || '-'}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditLocation(l)}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete('locations', l.id, l.name)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

        {/* ================= TAB 5: RATES ================= */}
        <TabsContent value="rates">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">เรทราคามาตรฐานแยกเส้นทาง (Rate Cards)</CardTitle>
                <CardDescription>
                  ราคาค่าบริการเรียกเก็บ และต้นทุนประมาณการ (น้ำมัน, ทางด่วน, พขร.) สามารถระบุเฉพาะรายลูกค้าหรือเรทกลาง
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportRatesCsv} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button onClick={handleOpenAddRateCard} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
                  <Plus className="h-3.5 w-3.5" /> เพิ่มเรทราคา
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/80">
                      <SortableHeader title="ลูกค้า" sortKey="customer" currentSort={rateCardSort} onSort={(k) => handleSort(k, rateCardSort, setRateCardSort)} className="font-bold text-blue-900" />
                      <SortableHeader title="คู่เส้นทาง (ต้นทาง ➔ ปลายทาง)" sortKey="origin" currentSort={rateCardSort} onSort={(k) => handleSort(k, rateCardSort, setRateCardSort)} />
                      <SortableHeader title="สเปกตู้" sortKey="container_size" currentSort={rateCardSort} onSort={(k) => handleSort(k, rateCardSort, setRateCardSort)} />
                      <SortableHeader title="ชนิดรถ" sortKey="vehicle_type" currentSort={rateCardSort} onSort={(k) => handleSort(k, rateCardSort, setRateCardSort)} />
                      <SortableHeader title="ราคาขาย (บาท)" sortKey="base_price" currentSort={rateCardSort} onSort={(k) => handleSort(k, rateCardSort, setRateCardSort)} align="right" />
                      <SortableHeader title="ต้นทุนประมาณการ" sortKey="cost" currentSort={rateCardSort} onSort={(k) => handleSort(k, rateCardSort, setRateCardSort)} align="right" />
                      <SortableHeader title="กำไรสุทธิ" sortKey="profit" currentSort={rateCardSort} onSort={(k) => handleSort(k, rateCardSort, setRateCardSort)} align="right" />
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRateCards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                          ไม่พบข้อมูลเรทราคา
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedRateCards.map((r) => {
                        const totalCost = Number(r.fuel_cost_est || 0) + Number(r.toll_fee_est || 0) + Number(r.driver_fee_est || 0);
                        const profit = Number(r.base_price || 0) - totalCost;
                        return (
                          <TableRow key={r.id} className="hover:bg-slate-50">
                            <TableCell className="text-xs font-semibold text-slate-800">
                              {r.customer?.company_name || <span className="text-slate-400">เรททั่วไป (ทุกราย)</span>}
                            </TableCell>
                            <TableCell className="font-medium text-slate-900 text-xs">
                              {r.origin?.name} <span className="text-blue-600 font-bold">➔</span> {r.destination?.name}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {r.container_size ? `${r.container_size}' ${r.container_type || 'DC'}` : '40\' HC'}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {vehicleTypeMap[r.vehicle_type] || r.vehicle_type}
                            </TableCell>
                            <TableCell className="text-right font-bold text-blue-700">
                              ฿{Number(r.base_price).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-xs text-slate-600">
                              <div>฿{totalCost.toLocaleString()}</div>
                              <div className="text-[10px] text-slate-400">
                                นม.{r.fuel_cost_est} | ด่วน{r.toll_fee_est} | พขร.{r.driver_fee_est}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-700">
                              ฿{profit.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenEditRateCard(r)}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete('rate_cards', r.id, `เรท ฿${r.base_price}`)}
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
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
        </TabsContent>

        {/* ================= TAB 6: JOB TYPES ================= */}
        <TabsContent value="job-types">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">1. ลากตู้หนักไปเปิด (Heavy to Open)</CardTitle>
                <CardDescription>งานนำเข้าสินค้า (Import Work)</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p><strong>กระบวนการ:</strong> รับตู้หนักจากท่าเรือหรือลานตู้ ➔ ขนส่งไปยังโรงงานลูกค้าเพื่อเปิดตู้และนำสินค้าลง ➔ ลากตู้เปล่ากลับไปคืนลานตู้สายเรือ</p>
                <p className="text-blue-600 font-semibold">* มีการออกจดหมายเปลี่ยนใบเสร็จท่าเรือ (PAT) กรณีรับจากท่าเรือคลองเตย</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">2. ลากตู้เปล่าไปบรรจุ (Empty to Stuff)</CardTitle>
                <CardDescription>งานส่งออกสินค้า (Export Work)</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p><strong>กระบวนการ:</strong> รับตู้เปล่าจากลานตู้สายเรือ ➔ ขนส่งไปยังโรงงานลูกค้าเพื่อบรรจุสินค้าและล็อคซีล (Seal) ➔ ขนส่งตู้หนักไปส่งที่ท่าเรือเพื่อรอขึ้นเรือ</p>
                <p className="text-blue-600 font-semibold">* ต้องตรวจสภาพตู้ 5 มุม และถ่ายรูปหน้าตู้ที่ล็อคซีลอย่างเคร่งครัด</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">3. ลากตู้เปล่าคืน (Empty Return)</CardTitle>
                <CardDescription>ส่งคืนตู้เปล่าเข้าลานสายเรือ</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p><strong>กระบวนการ:</strong> รับตู้เปล่าที่เปิดสินค้าเสร็จแล้วจากโรงงาน ➔ ตรวจสอบสภาพความเสียหายและทำความสะอาด ➔ ส่งมอบคืนลานตู้สายเรือพร้อมรับใบ EIR</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">4. ย้ายลาน (Yard Move)</CardTitle>
                <CardDescription>การเคลื่อนย้ายภายในลานหรือระหว่างลานตู้</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p><strong>กระบวนการ:</strong> ขนย้ายตู้คอนเทนเนอร์ระหว่างลาน หรือย้ายจุดวางในท่าเรือเพื่อรอรอบการบรรจุ/ขนถ่าย</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= MODAL: VEHICLE (ADD / EDIT) ================= */}
      <Dialog open={openVehicleModal} onOpenChange={setOpenVehicleModal}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editVehicleId ? 'แก้ไขข้อมูลรถบรรทุก' : 'เพิ่มรถบรรทุกใหม่'}</DialogTitle>
            <DialogDescription>
              กำหนดรหัสรถแบบย่อ และผูกคนขับประจำรถ เพื่อความสะดวกรวดเร็วในการจ่ายงาน
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveVehicle} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-blue-900">รหัสรถย่อ (เช่น รถคัน-1) *</Label>
                <Input
                  required
                  placeholder="เช่น รถคัน-1, รถคัน-2"
                  value={vehicleForm.truck_name_id}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, truck_name_id: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold">ป้ายทะเบียนรถ *</Label>
                <Input
                  required
                  placeholder="เช่น 70-9821 กทม."
                  value={vehicleForm.plate_number}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">ยี่ห้อรถ</Label>
                <Input
                  placeholder="Hino, Isuzu, Scania"
                  value={vehicleForm.truck_brand}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, truck_brand: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">รุ่นรถ</Label>
                <Input
                  placeholder="S700, Giga"
                  value={vehicleForm.truck_model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, truck_model: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">ปีที่จดทะเบียน</Label>
                <Input
                  placeholder="2565"
                  value={vehicleForm.register_year}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, register_year: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-emerald-900">คนขับประจำรถ (ผูกรถ-คนขับอัตโนมัติ)</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={vehicleForm.driver_id}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driver_id: e.target.value })}
                >
                  <option value="">-- ยังไม่ผูกคนขับ --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.phone ? `(${d.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">ยี่ห้อ GPS</Label>
                <Input
                  placeholder="DTC, Hino Connect"
                  value={vehicleForm.gps_brand}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, gps_brand: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ชนิดรถ</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={vehicleForm.vehicle_type}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value as VehicleType })}
                >
                  <option value="trailer">รถเทรลเลอร์ (หัวลาก)</option>
                  <option value="semi_trailer">รถกึ่งพ่วง (Semi-Trailer)</option>
                  <option value="10_wheel">รถ 10 ล้อ</option>
                  <option value="6_wheel">รถ 6 ล้อ</option>
                  <option value="4_wheel">รถ 4 ล้อ</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">น้ำหนักบรรทุกสูงสุด (ตัน)</Label>
                <Input
                  type="number"
                  value={vehicleForm.capacity_tons}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, capacity_tons: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t pt-3">
              <div>
                <Label className="text-xs">วันหมดอายุภาษีป้ายวงกลม</Label>
                <Input
                  type="date"
                  value={vehicleForm.tax_expiry_date}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, tax_expiry_date: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">วันหมดอายุ พรบ.</Label>
                <Input
                  type="date"
                  value={vehicleForm.act_expiry_date}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, act_expiry_date: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">วันหมดอายุประกันภัย</Label>
                <Input
                  type="date"
                  value={vehicleForm.insurance_expiry_date}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, insurance_expiry_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">สถานะรถ</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={vehicleForm.status}
                onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value as any })}
              >
                <option value="active">พร้อมใช้งาน (Active)</option>
                <option value="maintenance">เข้าซ่อม (Maintenance)</option>
                <option value="inactive">ปิดการใช้งาน (Inactive)</option>
              </select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenVehicleModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editVehicleId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลรถ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: DRIVER (ADD / EDIT) ================= */}
      <Dialog open={openDriverModal} onOpenChange={setOpenDriverModal}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editDriverId ? 'แก้ไขข้อมูล พขร.' : 'เพิ่มพนักงานขับรถ (พขร.)'}</DialogTitle>
            <DialogDescription>
              บันทึกข้อมูลส่วนตัว เลขบัตรประชาชน และใบอนุญาตขับขี่ ท.4
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveDriver} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">ชื่อ - นามสกุล *</Label>
                <Input
                  required
                  placeholder="เช่น นายสมชาย ใจดี"
                  value={driverForm.name}
                  onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold">เบอร์โทรศัพท์ *</Label>
                <Input
                  required
                  placeholder="เช่น 081-234-5678"
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">เลขประจำตัวประชาชน (13 หลัก)</Label>
              <Input
                placeholder="เช่น 1100200345678"
                maxLength={17}
                value={driverForm.id_number}
                onChange={(e) => setDriverForm({ ...driverForm, id_number: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">เลขที่ใบขับขี่ (ท.4)</Label>
                <Input
                  placeholder="เช่น ท.4-0012984"
                  value={driverForm.license_number}
                  onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">วันหมดอายุใบขับขี่</Label>
                <Input
                  type="date"
                  value={driverForm.license_expiry_date}
                  onChange={(e) => setDriverForm({ ...driverForm, license_expiry_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">เบี้ยเลี้ยงมาตรฐานต่อวัน (บาท)</Label>
                <Input
                  type="number"
                  value={driverForm.daily_rate}
                  onChange={(e) => setDriverForm({ ...driverForm, daily_rate: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">สถานะ พขร.</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={driverForm.status}
                  onChange={(e) => setDriverForm({ ...driverForm, status: e.target.value as any })}
                >
                  <option value="available">พร้อมวิ่งงาน (Available)</option>
                  <option value="on_job">กำลังวิ่งงาน (On Job)</option>
                  <option value="leave">ลาพักร้อน/ป่วย (Leave)</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenDriverModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editDriverId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล พขร.'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: CUSTOMER (ADD / EDIT) ================= */}
      <Dialog open={openCustomerModal} onOpenChange={setOpenCustomerModal}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCustomerId ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</DialogTitle>
            <DialogDescription>
              ข้อมูลบริษัทสำหรับออกใบแจ้งหนี้ (Invoice) และหนังสือขอใบกำกับภาษีการท่าเรือฯ
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCustomer} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-bold">ชื่อบริษัทลูกค้า *</Label>
                <Input
                  required
                  placeholder="เช่น บริษัท ปทุม ทรานสปอร์ต จำกัด"
                  value={customerForm.company_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, company_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold">สาขา</Label>
                <Input
                  placeholder="สำนักงานใหญ่ หรือ สาขาที่ 00001"
                  value={customerForm.branch}
                  onChange={(e) => setCustomerForm({ ...customerForm, branch: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">เลขประจำตัวผู้เสียภาษี (13 หลัก) *</Label>
                <Input
                  required
                  placeholder="เช่น 0135563000175"
                  value={customerForm.tax_id}
                  onChange={(e) => setCustomerForm({ ...customerForm, tax_id: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-rose-600">เครดิตเทอม (วัน)</Label>
                <Input
                  type="number"
                  placeholder="30"
                  value={customerForm.credit_term_days}
                  onChange={(e) => setCustomerForm({ ...customerForm, credit_term_days: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">ที่อยู่ตาม ภ.พ.20 (สำหรับออกใบแจ้งหนี้) *</Label>
              <textarea
                required
                rows={2}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                placeholder="ที่อยู่ตามหนังสือรับรองภาษี..."
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ผู้ประสานงาน / ฝ่ายจัดส่ง</Label>
                <Input
                  placeholder="คุณมานพ"
                  value={customerForm.contact_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, contact_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">เบอร์โทรศัพท์</Label>
                <Input
                  placeholder="02-998-1122"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-blue-900">ชื่อ Shipper ประจำบน B/L</Label>
                <Input
                  placeholder="ELECTRICAL COMPONENTS CO.,LTD."
                  value={customerForm.shipper_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, shipper_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">ชื่อสินค้าประจำ</Label>
                <Input
                  placeholder="ชิ้นส่วนอิเล็กทรอนิกส์"
                  value={customerForm.commodity_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, commodity_name: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCustomerModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editCustomerId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลลูกค้า'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: LOCATION (ADD / EDIT) ================= */}
      <Dialog open={openLocationModal} onOpenChange={setOpenLocationModal}>
        <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLocationId ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่ใหม่'}</DialogTitle>
            <DialogDescription>
              ลานฝากตู้, ท่าเรือ (PAT / แหลมฉบัง), โรงงานลูกค้า พร้อมพิกัด GPS และแผนที่ดาวเทียม
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveLocation} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-bold">ชื่อสถานที่ *</Label>
                <Input
                  required
                  placeholder="เช่น ท่าเรือคลองเตย (PAT), ลานตู้บึงทองคำ"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold">ประเภท</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={locationForm.location_type}
                  onChange={(e) => setLocationForm({ ...locationForm, location_type: e.target.value as LocationType })}
                >
                  <option value="depot">ลานตู้ (Depot)</option>
                  <option value="port">ท่าเรือ (Port)</option>
                  <option value="factory">โรงงาน (Factory)</option>
                  <option value="yard">ลานจอด (Yard)</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">จังหวัด</Label>
                <Input
                  placeholder="กรุงเทพฯ, ชลบุรี, ฉะเชิงเทรา"
                  value={locationForm.province}
                  onChange={(e) => setLocationForm({ ...locationForm, province: e.target.value })}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-bold text-blue-900 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-rose-500" />
                    พิกัด GPS / ลิงก์ Google Maps
                  </Label>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={fetchingGps}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                    title="ดึงพิกัด GPS ละติจูด, ลองจิจูด จากตำแหน่งปัจจุบันของอุปกรณ์คุณ"
                  >
                    <Crosshair className={`h-3 w-3 ${fetchingGps ? 'animate-spin text-amber-500' : ''}`} />
                    <span>{fetchingGps ? 'กำลังอ่านพิกัด...' : 'ใช้ GPS ปัจจุบัน'}</span>
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Input
                    placeholder="เช่น 13.7082, 100.5786 หรือวาง Maps Link"
                    value={locationForm.location_map}
                    onChange={(e) => {
                      const val = e.target.value;
                      const atMatch = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                      const qMatch = val.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                      if (atMatch) {
                        setLocationForm({ ...locationForm, location_map: `${atMatch[1]}, ${atMatch[2]}` });
                      } else if (qMatch) {
                        setLocationForm({ ...locationForm, location_map: `${qMatch[1]}, ${qMatch[2]}` });
                      } else {
                        setLocationForm({ ...locationForm, location_map: val });
                      }
                    }}
                    className="pr-20 text-xs font-mono"
                  />
                  <div className="absolute right-1 flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleOpenGoogleMapsToPick}
                      className="h-7 px-2 text-[11px] text-blue-700 hover:bg-blue-50 gap-1 font-medium"
                      title="เปิด Google Maps เพื่อดูหรือค้นหาจุดปักหมุด"
                    >
                      <span>เปิด Maps</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Embedded Live Google Maps Preview & Pin Picker helper */}
            <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/90 border-b text-[11px]">
                <span className="font-semibold flex items-center gap-1.5 text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  พรีวิวแผนที่ Google Maps (Live Interactive Preview)
                </span>
                <button
                  type="button"
                  onClick={handleOpenGoogleMapsToPick}
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-semibold transition-colors"
                >
                  <span>เปิด Google Maps เต็มจอเพื่อเลือกจุด</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <div className="relative w-full h-[160px] bg-slate-200">
                <iframe
                  title="Google Map Live Preview"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    locationForm.location_map || `${locationForm.name} ${locationForm.province || ''}` || 'ประเทศไทย'
                  )}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                />
              </div>
              <div className="p-2 bg-white text-[11px] text-slate-500 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>📍 <strong>วิธีปักหมุด:</strong> คลิก &quot;เปิด Google Maps เต็มจอ&quot; ➔ คลิกขวาที่จุดบนแผนที่ ➔ คลิกตัวเลขพิกัดเพื่อคัดลอก (Copy) ➔ นำมาวางที่ช่องด้านบน</span>
                {locationForm.location_map && (
                  <span className="text-emerald-700 font-medium whitespace-nowrap bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ กำหนดพิกัดแล้ว
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs">ที่อยู่สถานที่</Label>
              <textarea
                rows={2}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                placeholder="เลขที่ ถนน ซอย..."
                value={locationForm.address}
                onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ผู้ประสานงาน / ฝ่ายจัดส่ง</Label>
                <Input
                  placeholder="คุณสมบัติ"
                  value={locationForm.contact_name}
                  onChange={(e) => setLocationForm({ ...locationForm, contact_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">เบอร์โทรศัพท์</Label>
                <Input
                  placeholder="02-269-3000"
                  value={locationForm.phone}
                  onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">จุดสังเกตหน้างาน / เวลาเปิด-ปิด Gate</Label>
              <Input
                placeholder="เข้าประตู 3 ตรวจ EIR, ปิดรับตู้ 22:00 น."
                value={locationForm.location_remark}
                onChange={(e) => setLocationForm({ ...locationForm, location_remark: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenLocationModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editLocationId ? 'บันทึกการแก้ไข' : 'บันทึกสถานที่'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: RATE CARD (ADD / EDIT) ================= */}
      <Dialog open={openRateCardModal} onOpenChange={setOpenRateCardModal}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>{editRateCardId ? 'แก้ไขเรทราคา' : 'เพิ่มเรทราคามาตรฐาน'}</DialogTitle>
            <DialogDescription>
              กำหนดราคาขาย และต้นทุนประมาณการประจำคู่เส้นทางและขนาดตู้
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRateCard} className="space-y-4">
            <div>
              <Label className="text-xs font-bold">ลูกค้าเฉพาะราย (ถ้ามี)</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={rateCardForm.customer_id}
                onChange={(e) => setRateCardForm({ ...rateCardForm, customer_id: e.target.value })}
              >
                <option value="">-- เรททั่วไป (ใช้ได้กับทุกลูกค้า) --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">ต้นทาง (Origin) *</Label>
                <select
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={rateCardForm.origin_id}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, origin_id: e.target.value })}
                >
                  <option value="">-- เลือกต้นทาง --</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.province})</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold">ปลายทาง (Destination) *</Label>
                <select
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={rateCardForm.destination_id}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, destination_id: e.target.value })}
                >
                  <option value="">-- เลือกปลายทาง --</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.province})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">ขนาดตู้</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={rateCardForm.container_size}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, container_size: e.target.value as ContainerSize })}
                >
                  <option value="20">20 ฟุต</option>
                  <option value="40">40 ฟุต</option>
                  <option value="45">45 ฟุต</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">ชนิดตู้</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={rateCardForm.container_type}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, container_type: e.target.value as ContainerType })}
                >
                  <option value="DC">DC (ตู้แห้งมาตรฐาน)</option>
                  <option value="HC">HC (ตู้ทรงสูง)</option>
                  <option value="OT">OT (เปิดหลังคา)</option>
                  <option value="RH">RH (ตู้แช่เย็น Reefer)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">ประเภทรถ</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={rateCardForm.vehicle_type}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, vehicle_type: e.target.value as VehicleType })}
                >
                  <option value="trailer">รถเทรลเลอร์ (หัวลาก)</option>
                  <option value="semi_trailer">รถกึ่งพ่วง</option>
                  <option value="10_wheel">รถ 10 ล้อ</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-blue-900">ราคาค่าบริการเรียกเก็บลูกค้า (บาท) *</Label>
              <Input
                required
                type="number"
                value={rateCardForm.base_price}
                onChange={(e) => setRateCardForm({ ...rateCardForm, base_price: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 border-t pt-3">
              <div>
                <Label className="text-xs">ค่าน้ำมันประมาณการ</Label>
                <Input
                  type="number"
                  value={rateCardForm.fuel_cost_est}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, fuel_cost_est: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">ค่าทางด่วนประมาณการ</Label>
                <Input
                  type="number"
                  value={rateCardForm.toll_fee_est}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, toll_fee_est: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">ค่าแรง/เบี้ยเลี้ยง พขร.</Label>
                <Input
                  type="number"
                  value={rateCardForm.driver_fee_est}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, driver_fee_est: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenRateCardModal(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editRateCardId ? 'บันทึกการแก้ไข' : 'บันทึกเรทราคา'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
