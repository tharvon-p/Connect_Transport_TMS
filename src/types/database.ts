export type VehicleType = '4_wheel' | '6_wheel' | '10_wheel' | 'trailer' | 'semi_trailer';
export type JobType = 'heavy_to_open' | 'empty_to_stuff' | 'empty_return' | 'yard_move';
export type JobStatus = 'draft' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type ContainerSize = '20' | '40' | '45';
export type ContainerType = 'DC' | 'HC' | 'OT' | 'RH';
export type CargoType = 'NON_DG' | 'DG';
export type LocationType = 'depot' | 'factory' | 'port' | 'yard' | 'other';
export type ExpenseType = 'per_diem' | 'fuel' | 'toll' | 'waiting' | 'overtime' | 'advance';

export interface Vehicle {
  id: string;
  truck_name_id: string; // เช่น รถคัน-1, รถคัน-2
  plate_number: string;
  truck_brand?: string | null; // Hino, Isuzu, Scania
  truck_model?: string | null; // Hino S700, Giga
  register_year?: string | null; // 2565
  vehicle_type: VehicleType;
  capacity_tons: number;
  driver_id?: string | null; // ผูกรถและคนขับประจำรถ
  driver?: Driver | null;
  iso_expiry_date?: string | null;
  insurance_expiry_date?: string | null;
  act_expiry_date?: string | null;
  tax_expiry_date?: string | null; // วันหมดอายุภาษีป้ายวงกลม
  gps_brand?: string | null; // DTC, Hino Connect
  status: 'active' | 'maintenance' | 'inactive';
  created_at?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  id_number?: string | null; // เลขประจำตัวประชาชน 13 หลัก
  license_number: string | null;
  license_expiry_date: string | null;
  photo?: string | null;
  daily_rate: number;
  status: 'available' | 'on_job' | 'leave' | 'inactive';
  created_at?: string;
}

export interface Customer {
  id: string;
  company_name: string;
  branch?: string | null; // สาขาที่ 00001, สำนักงานใหญ่
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_term_days?: number | null; // เช่น 15, 30
  shipper_name?: string | null;
  commodity_name?: string | null;
  created_at?: string;
}

export interface Location {
  id: string;
  name: string;
  location_type: LocationType;
  province: string | null;
  address: string | null;
  contact_name?: string | null;
  phone?: string | null;
  location_map?: string | null; // พิกัด GPS / Maps link
  location_remark?: string | null; // จุดสังเกต
  map_picture?: string | null;
  created_at?: string;
}

export interface RateCard {
  id: string;
  customer_id?: string | null;
  origin_id: string;
  destination_id: string;
  vehicle_type: VehicleType;
  container_size?: ContainerSize | null;
  container_type?: ContainerType | null;
  base_price: number;
  fuel_cost_est: number;
  toll_fee_est: number;
  driver_fee_est: number;
  customer?: Customer;
  origin?: Location;
  destination?: Location;
  created_at?: string;
}

export interface JobAssignment {
  id: string;
  job_id: string;
  leg_index: number;
  truck_name_id: string; // e.g. รถคัน-1
  vehicle_id: string;
  driver_id: string;
  driver_name?: string;
  driver_phone?: string;
  container_no?: string | null;
  seal_no?: string | null;
  temperature?: number | null;
  current_step: 'assigned' | 'at_pickup' | 'at_packing' | 'at_return' | 'completed';
  
  // Checkpoint 1: Pickup
  pickup_checkin_time?: string | null;
  pickup_gps?: string | null;
  pickup_photos?: string[]; // 5 mandatory photos (หน้า, พื้น, ซ้าย, ขวา, หลัง)
  pickup_reefer_photos?: string[]; // 3 reefer photos (รูน้ำทิ้ง, สายไฟ, จออุณหภูมิ)
  pickup_receipt_photos?: string[];
  pickup_eir_photo?: string | null;

  // Checkpoint 2: Packing
  packing_checkin_time?: string | null;
  packing_gps?: string | null;
  packing_photo_sealed?: string | null;
  packing_reefer_photo?: string | null;
  packing_receipt_photos?: string[];
  packing_eir_photo?: string | null;

  // Checkpoint 3: Return
  return_checkin_time?: string | null;
  return_gps?: string | null;
  return_photo_front?: string | null;
  return_reefer_photo?: string | null;
  return_receipt_photos?: string[];
  return_eir_photo?: string | null;

  driver_notes?: string | null;
  vehicle?: Vehicle;
  driver?: Driver;
}

export interface Job {
  id: string;
  job_no: string;
  job_date: string;
  job_type: JobType;
  customer_id: string;
  shipper_name?: string | null;
  ship_line?: string | null;
  bl_no?: string | null;
  book_no?: string | null;
  commodity_name?: string | null;

  // Route Places & Dates
  pickup_place?: string | null;
  pickup_date?: string | null;
  packing_place?: string | null;
  packing_date?: string | null;
  return_place?: string | null;
  return_date?: string | null;

  origin_id?: string;
  destination_id?: string;
  vehicle_id: string | null;
  driver_id: string | null;
  vehicle_type: VehicleType;
  container_size: ContainerSize;
  container_type: ContainerType;
  container_amount?: number; // e.g. 1, 2, 5 containers
  cargo_type: CargoType;
  status: JobStatus;

  // Multi-truck assignments (1 : N)
  assignments?: JobAssignment[];

  // Dispatch & Operational Details (primary container / legacy support)
  container_no: string | null;
  seal_no: string | null;
  temperature: number | null;
  checkin_location: string | null;
  checkin_time: string | null;
  driver_notes: string | null;

  // Financial Summary
  price?: number;
  addon_price?: number;
  revenue: number;
  fuel_cost: number;
  driver_allowance: number;
  toll_fee: number;
  waiting_fee: number;
  ot_fee: number;
  other_cost: number;
  total_cost: number;
  net_profit: number;

  // Custom documentation & Invoicing
  pat_letter_required: boolean;
  pat_letter_status: 'none' | 'pending' | 'issued' | 'completed';
  invoice_no?: string | null; // e.g. 6807-217

  // Relations (optional when joined)
  customer?: Customer;
  origin?: Location;
  destination?: Location;
  vehicle?: Vehicle;
  driver?: Driver;

  created_at?: string;
  updated_at?: string;
}

export interface DriverExpense {
  id: string;
  job_id: string;
  truck_name_id?: string | null; // e.g. รถคัน-1
  driver_id: string;
  expense_type: ExpenseType;
  amount: number;
  description: string | null;
  receipt_url?: string | null;
  expense_picture?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  created_at?: string;
}
