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
  plate_number: string;
  vehicle_type: VehicleType;
  capacity_tons: number;
  iso_expiry_date: string | null;
  insurance_expiry_date: string | null;
  act_expiry_date: string | null;
  status: 'active' | 'maintenance' | 'inactive';
  created_at?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  license_number: string | null;
  license_expiry_date: string | null;
  daily_rate: number;
  status: 'available' | 'on_job' | 'leave' | 'inactive';
  created_at?: string;
}

export interface Customer {
  id: string;
  company_name: string;
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at?: string;
}

export interface Location {
  id: string;
  name: string;
  location_type: LocationType;
  province: string | null;
  address: string | null;
  created_at?: string;
}

export interface RateCard {
  id: string;
  origin_id: string;
  destination_id: string;
  vehicle_type: VehicleType;
  base_price: number;
  fuel_cost_est: number;
  toll_fee_est: number;
  driver_fee_est: number;
  origin?: Location;
  destination?: Location;
  created_at?: string;
}

export interface Job {
  id: string;
  job_no: string;
  job_date: string;
  job_type: JobType;
  customer_id: string;
  origin_id: string;
  destination_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  vehicle_type: VehicleType;
  container_size: ContainerSize;
  container_type: ContainerType;
  cargo_type: CargoType;
  status: JobStatus;

  // Dispatch & Operational Details
  container_no: string | null;
  seal_no: string | null;
  temperature: number | null;
  checkin_location: string | null;
  checkin_time: string | null;
  driver_notes: string | null;

  // Financial Summary
  revenue: number;
  fuel_cost: number;
  driver_allowance: number;
  toll_fee: number;
  waiting_fee: number;
  ot_fee: number;
  other_cost: number;
  total_cost: number;
  net_profit: number;

  // Custom documentation
  pat_letter_required: boolean;
  pat_letter_status: 'none' | 'pending' | 'issued' | 'completed';

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
  driver_id: string;
  expense_type: ExpenseType;
  amount: number;
  description: string | null;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  created_at?: string;
}
