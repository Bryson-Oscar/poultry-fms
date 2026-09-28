export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string;
  phoneNumber?: string;
  companyName?: string;
  location?: string;
  jobTitle?: string;
  specialization?: string;
  preferredLanguage?: string;
  staffCode?: string;
  role?: string;
  assignedFarmId?: string;
  onboarded?: boolean;
  hasCompletedOnboarding?: boolean;
  notifications?: {
    sms?: boolean;
    email?: boolean;
    inApp?: boolean;
  };
  createdAt?: any;
  updatedAt?: any;
}
