"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User as UserIcon, Save, Sparkles, Building, MapPin, Briefcase, Languages, Bell, Phone, ShieldCheck, Check, ChevronsUpDown, Settings } from 'lucide-react';
import { UserProfile } from '@/types/user';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';
import AITutorOnboardingWidget from '@/components/ovocore/AITutorOnboardingWidget';
import { EllaInfrastructureAuditWidget } from '@/components/ovocore/EllaInfrastructureAuditWidget';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const ROLE_OPTIONS = [
  "Farm Owner",
  "Farm Manager",
  "Supervisor",
  "Veterinarian",
  "Farm Operator",
  "Data Analyst",
  "Consultant",
  "Accountant",
  "Agri-Extension Officer"
];

const SPECIALIZATION_OPTIONS = [
  "Commercial Layers",
  "Broilers",
  "Breeders",
  "Dual-Purpose Kienyeji",
  "Hatchery Operations",
  "Feed Milling",
  "Veterinary Care",
  "General Operations",
  "Sales & Logistics"
];

function SearchableCombobox({ options, value, onChange, placeholder }: { options: string[], value: string, onChange: (v: string) => void, placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-card text-card-foreground border-input font-normal h-11 px-3.5 py-2 text-sm text-left rounded-xl shadow-sm hover:bg-muted/40 transition-all"
        >
          <span className="truncate flex-1">{value ? value : <span className="text-muted-foreground">{placeholder}</span>}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-card border border-border shadow-2xl rounded-2xl opacity-100 z-50 overflow-hidden" align="start">
        <Command className="bg-transparent">
          <CommandInput
            placeholder={`Search ${placeholder.toLowerCase()}...`}
            value={inputValue}
            onValueChange={setInputValue}
            className="h-11 border-none focus:ring-0 px-3 bg-muted/20"
          />
          <CommandList className="p-1">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-2 p-3">
                <span>"{inputValue}" not found.</span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full text-xs font-bold rounded-lg"
                  onClick={() => {
                    onChange(inputValue);
                    setOpen(false);
                  }}
                >
                  Use "{inputValue}"
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className="rounded-lg py-2.5 px-3 text-sm font-medium cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100 text-emerald-500 font-bold" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function OvoCoreProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | any | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    displayName: '',
    phoneNumber: '',
    companyName: '',
    location: '',
    jobTitle: '',
    specialization: '',
    preferredLanguage: 'English',
    currency: 'KES',
    eggUnit: 'trays',
    colorScheme: 'system',
    staffCode: '',
    notifications: {
      sms: false,
      email: true,
      inApp: true,
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const tokenResult = await currentUser.getIdTokenResult();
          const userFarmId = tokenResult.claims.farmId as string;

          if (userFarmId) {
            setFarmId(userFarmId);
            fetchProfile(currentUser.uid, userFarmId);
          } else {
            fetchProfile(currentUser.uid, null);
          }
        } catch (error) {
          console.error("Error getting token claims", error);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchProfile = async (uid: string, userFarmId: string | null) => {
    try {
      const docRef = userFarmId
        ? doc(db, 'farms', userFarmId, 'staff_members', uid)
        : doc(db, 'users', uid);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        setFormData({
          displayName: data.displayName || '',
          phoneNumber: data.phoneNumber || '',
          companyName: data.companyName || '',
          location: data.location || '',
          jobTitle: data.jobTitle || data.role || '',
          specialization: data.specialization || '',
          preferredLanguage: data.preferredLanguage || 'English',
          currency: data.currency || 'KES',
          eggUnit: data.eggUnit || 'trays',
          colorScheme: data.colorScheme || 'system',
          staffCode: data.staffCode || '',
          notifications: data.notificationPreferences || {
            sms: false,
            email: true,
            inApp: true,
          }
        });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error loading profile', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const docRef = farmId
        ? doc(db, 'farms', farmId, 'staff_members', user.uid)
        : doc(db, 'users', user.uid);

      await updateDoc(docRef, {
        displayName: formData.displayName,
        phoneNumber: formData.phoneNumber,
        companyName: formData.companyName,
        location: formData.location,
        jobTitle: formData.jobTitle,
        specialization: formData.specialization,
        preferredLanguage: formData.preferredLanguage,
        staffCode: formData.staffCode,
        notificationPreferences: formData.notifications,
        hasCompletedOnboarding: true,
      });
      toast({ title: 'Profile Updated', description: 'Your profile has been saved successfully.' });
      setProfile((prev: any) => prev ? { ...prev, ...formData, notificationPreferences: formData.notifications, hasCompletedOnboarding: true } : null);
      
      // Redirect to the house (farm dashboard)
      if (farmId) {
        router.push(`/farm/${farmId}`);
      } else {
        router.push('/');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error saving profile', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Not Supported', description: 'Geolocation is not supported by this browser.' });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();

          if (data && data.address) {
            const region = data.address.county || data.address.state || data.address.city || "";
            const country = data.address.country || "";
            const locString = [region, country].filter(Boolean).join(", ");
            setFormData(prev => ({ ...prev, location: locString || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` }));
            toast({ title: 'Location Retrieved', description: 'Automatically updated location.' });
          } else {
            setFormData(prev => ({ ...prev, location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` }));
          }
        } catch (error) {
          setFormData(prev => ({ ...prev, location: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}` }));
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        let message = 'Failed to retrieve location.';
        if (error.code === 1) message = 'Location access was denied. Please check device permissions.';
        toast({ variant: 'destructive', title: 'Location Error', description: message });
      },
      { enableHighAccuracy: true }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6 bg-card  rounded-3xl my-6">
        <PeckingChickenLoader
          size="lg"
          message="Loading profile and authorization roles..."
        />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-4">
        <Card className="w-full max-w-md text-center bg-card border border-border shadow-xl rounded-3xl p-6">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Authentication Required</CardTitle>
            <CardDescription className="text-xs">Please sign in to view and edit your profile.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-24">

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border/60 pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-foreground">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <UserIcon className="w-6 h-6" />
            </div>
            My Profile
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage your personal credentials, operational roles, and notification preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile.isProUser ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider rounded-full border border-emerald-500/30 shadow-sm">
              <ShieldCheck className="w-4 h-4" /> Pro Account
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-muted text-muted-foreground text-xs font-black uppercase tracking-wider rounded-full border border-border shadow-sm">
              Free Tier
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Core Info */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm border-border/80 bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60 pb-4">
              <CardTitle className="text-base font-bold">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Full Name</label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="E.g. Bryson Oscar"
                    className="h-11 rounded-xl bg-card border-input font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Email Address</label>
                  <Input value={profile.email} disabled className="h-11 rounded-xl bg-muted/40 text-muted-foreground font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone Number
                  </label>
                  <Input
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+254 711 637374"
                    className="h-11 rounded-xl bg-card border-input font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Location
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="County, Country"
                      className="h-11 rounded-xl bg-card border-input font-medium flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGetLocation}
                      disabled={isGettingLocation}
                      className="h-11 px-3.5 border-border bg-muted/30 hover:bg-muted rounded-xl"
                      title="Use Device GPS"
                    >
                      {isGettingLocation ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <MapPin className="w-4 h-4 text-emerald-600" />}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/80 bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60 pb-4">
              <CardTitle className="text-base font-bold">Professional Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-muted-foreground" /> Company / Farm Name
                  </label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Farm Name"
                    className="h-11 rounded-xl bg-card border-input font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> Role / Title
                  </label>
                  <SearchableCombobox
                    options={ROLE_OPTIONS}
                    value={formData.jobTitle}
                    onChange={(val) => setFormData({ ...formData, jobTitle: val })}
                    placeholder="Select or type role..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Specialization</label>
                  <SearchableCombobox
                    options={SPECIALIZATION_OPTIONS}
                    value={formData.specialization}
                    onChange={(val) => setFormData({ ...formData, specialization: val })}
                    placeholder="Select or type specialization..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Compliance / Staff Code</label>
                  <Input
                    value={formData.staffCode}
                    onChange={(e) => setFormData({ ...formData, staffCode: e.target.value })}
                    placeholder="e.g. EMP-001"
                    className="h-11 rounded-xl bg-card border-input font-mono text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preferences & Status */}
        <div className="space-y-6">

          <Card className="shadow-sm border-border/80 bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Languages className="w-4 h-4 text-emerald-600" /> Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Preferred Language</label>
                <select
                  className="w-full flex h-11 items-center justify-between rounded-xl border border-input bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={formData.preferredLanguage}
                  onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                >
                  <option value="English">English</option>
                  <option value="Swahili">Swahili</option>
                  <option value="French">French</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-muted-foreground" /> Notification Channels
                </label>
                <div className="space-y-2.5 bg-muted/20 p-3.5 rounded-2xl border border-border/60">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="notif-email"
                      checked={formData.notifications.email}
                      onCheckedChange={(checked: boolean | 'indeterminate') => setFormData({ ...formData, notifications: { ...formData.notifications, email: !!checked } })}
                    />
                    <label htmlFor="notif-email" className="text-xs font-semibold cursor-pointer">
                      Email Alerts
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="notif-sms"
                      checked={formData.notifications.sms}
                      onCheckedChange={(checked: boolean | 'indeterminate') => setFormData({ ...formData, notifications: { ...formData.notifications, sms: !!checked } })}
                    />
                    <label htmlFor="notif-sms" className="text-xs font-semibold cursor-pointer">
                      SMS Notifications
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="notif-inapp"
                      checked={formData.notifications.inApp}
                      onCheckedChange={(checked: boolean | 'indeterminate') => setFormData({ ...formData, notifications: { ...formData.notifications, inApp: !!checked } })}
                    />
                    <label htmlFor="notif-inapp" className="text-xs font-semibold cursor-pointer">
                      In-App Dashboard Alerts
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Farm & App Preferences */}
          <Card className="border border-border/80 shadow-sm rounded-3xl bg-card overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> App & Regional Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Language Selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interface Language</Label>
                  <Select 
                    value={formData.preferredLanguage}
                    onValueChange={(v) => setFormData({...formData, preferredLanguage: v})}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">🇬🇧 English</SelectItem>
                      <SelectItem value="Swahili">🇰🇪 Kiswahili</SelectItem>
                      <SelectItem value="French">🇫🇷 Français</SelectItem>
                      <SelectItem value="Spanish">🇪🇸 Español</SelectItem>
                      <SelectItem value="Arabic">🇦🇪 Arabic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Currency */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base Currency</Label>
                  <Select 
                    value={formData.currency}
                    onValueChange={(v) => setFormData({...formData, currency: v})}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KES">🇰🇪 KES - Kenyan Shilling</SelectItem>
                      <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                      <SelectItem value="NGN">🇳🇬 NGN - Nigerian Naira</SelectItem>
                      <SelectItem value="ZAR">🇿🇦 ZAR - South African Rand</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Egg Unit */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Egg Counting Unit</Label>
                  <Select 
                    value={formData.eggUnit}
                    onValueChange={(v) => setFormData({...formData, eggUnit: v})}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trays">Trays (30 eggs)</SelectItem>
                      <SelectItem value="crates">Crates (360 eggs)</SelectItem>
                      <SelectItem value="individual">Individual Eggs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Color Scheme */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Color Theme</Label>
                  <Select 
                    value={formData.colorScheme}
                    onValueChange={(v) => setFormData({...formData, colorScheme: v})}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">Auto (System)</SelectItem>
                      <SelectItem value="light">Light Mode</SelectItem>
                      <SelectItem value="dark">Dark Mode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-3xl overflow-hidden">
            <CardHeader className="bg-emerald-500/10 border-b border-emerald-500/20 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" /> Referral Program
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">Your Invite Code</p>
                <div className="px-3 py-2.5 bg-card border border-emerald-500/30 rounded-xl font-mono text-sm font-black text-center shadow-sm">
                  {profile.ownReferralCode || (farmId ? `OVO-${farmId.substring(0, 6).toUpperCase()}-REF` : `OVO-${user?.uid.substring(0, 6).toUpperCase()}-REF`)}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Share this code with fellow farmers to earn up to 12% off your next module subscription renewal.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 px-8 rounded-2xl shadow-lg transition-all"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Save Profile Changes
        </Button>
      </div>

      <div className="pt-4">
        <EllaInfrastructureAuditWidget
          onTierUnlocked={async (tier) => {
            if (user) {
              let plan = 'trial';
              if (tier === 'Tier 1') plan = 'operator';
              else if (tier === 'Tier 2') plan = 'pro';
              else if (tier === 'Tier 3') plan = 'syndicate';

              try {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, { plan });
                toast({ title: 'Plan Updated', description: `Features for ${tier} unlocked successfully.` });
              } catch (e) {
                console.error(e);
              }
            }
          }}
        />
      </div>
    </div>
  );
}