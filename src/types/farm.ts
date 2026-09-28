export interface FarmStaffMember {
  id?: string;
  uid?: string;
  userId?: string;
  name: string;
  displayName?: string;
  email?: string;
  phone?: string;
  role: 'owner' | 'manager' | 'supervisor' | 'operator' | 'consultant' | 'portfolio_manager';
  status: 'active' | 'invited' | 'inactive';
  staffCode?: string;
  assignedHouseIds?: string[];
  joinedAt?: any;
  createdAt?: any;
}
