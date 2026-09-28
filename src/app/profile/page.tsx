"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User as UserIcon, Save, Sparkles, Building, MapPin, Briefcase, Languages, Bell, Phone, ShieldCheck } from 'lucide-react';
import { UserProfile } from '@/types/user';
import { Checkbox } from '@/components/ui/checkbox';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';

export default function OvoCoreProfilePage() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | any | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    displayName: '',
    phoneNumber: '',
    companyName: '',
    location: '',
    jobTitle: '',
    specialization: '',
    preferredLanguage: 'English',
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
            // Fallback to global profile if no farmId is associated yet
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
      // If user has a farmId, fetch from staff_members, else fetch global user profile
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
      });
      toast({ title: 'Profile Updated', description: 'Your profile has been saved successfully.' });
      setProfile((prev: any) => prev ? { ...prev, ...formData, notificationPreferences: formData.notifications } : null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error saving profile', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
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
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to view and edit your profile.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20">

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border/50 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <UserIcon className="w-8 h-8 text-emerald-600" />
            My Profile
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Manage your personal information, roles, and preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile.isProUser ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-sm font-bold rounded-full border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" /> Pro Account
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-sm font-bold rounded-full border border-slate-200 dark:border-slate-700">
              Free Tier
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Core Info */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="E.g. Juma Said"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input value={profile.email} disabled className="bg-muted/50 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" /> Phone Number
                  </label>
                  <Input
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+254 711 637374"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" /> Location
                  </label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="County, Country"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Professional Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" /> Company / Farm Name
                  </label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Farm Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" /> Role / Title
                  </label>
                  <Input
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    placeholder="e.g. Farm Manager"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Specialization</label>
                  <Input
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    placeholder="e.g. Layers, Hatchery"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Compliance / Staff Code</label>
                  <Input
                    value={formData.staffCode}
                    onChange={(e) => setFormData({ ...formData, staffCode: e.target.value })}
                    placeholder="e.g. EMP-001"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preferences & Status */}
        <div className="space-y-6">

          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Languages className="w-5 h-5 text-emerald-600" /> Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Preferred Language</label>
                <select
                  className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.preferredLanguage}
                  onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                >
                  <option value="English">English</option>
                  <option value="Swahili">Swahili</option>
                  <option value="French">French</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" /> Notifications
                </label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notif-email"
                      checked={formData.notifications.email}
                      onCheckedChange={(checked: boolean | 'indeterminate') => setFormData({ ...formData, notifications: { ...formData.notifications, email: !!checked } })}
                    />
                    <label htmlFor="notif-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Email Alerts
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notif-sms"
                      checked={formData.notifications.sms}
                      onCheckedChange={(checked: boolean | 'indeterminate') => setFormData({ ...formData, notifications: { ...formData.notifications, sms: !!checked } })}
                    />
                    <label htmlFor="notif-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      SMS Notifications
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notif-inapp"
                      checked={formData.notifications.inApp}
                      onCheckedChange={(checked: boolean | 'indeterminate') => setFormData({ ...formData, notifications: { ...formData.notifications, inApp: !!checked } })}
                    />
                    <label htmlFor="notif-inapp" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      In-App Alerts
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 bg-emerald-500/5 dark:bg-emerald-500/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Sparkles className="w-5 h-5" /> Referral Program
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Your Invite Code</p>
                <div className="px-3 py-2 bg-background border border-emerald-500/30 rounded-lg font-mono text-sm font-bold text-center">
                  {profile.ownReferralCode || 'Not Generated'}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this code with fellow farmers to earn up to 12% off your next renewal!
              </p>
            </CardContent>
          </Card>

        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 px-8 rounded-xl"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Save Profile Changes
        </Button>
      </div>

    </div>
  );
}
