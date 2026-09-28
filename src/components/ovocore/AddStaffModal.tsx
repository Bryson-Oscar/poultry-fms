"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Phone, Lock, User, Shield } from "lucide-react";
import { auth } from '@/lib/firebase';

interface AddStaffModalProps {
  farmId: string;
}

export function AddStaffModal({ farmId }: AddStaffModalProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    phoneNumber: '', // e.g. 0712345678 or +254712345678
    pinOrPassword: '', // 4-6 digit PIN or secure password
    role: 'farm_operator' // 'farm_operator' or 'supervisor'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    // Validate phone number format (Kenyan mobile standard check or general digits)
    const cleanPhone = formData.phoneNumber.replace(/\s+/g, '');
    if (cleanPhone.length < 9) {
      toast({
        variant: "destructive",
        title: "Invalid Phone Number",
        description: "Please enter a valid active mobile phone number.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await auth.currentUser.getIdToken();

      // Construct a Firebase-safe pseudo email from the phone number
      // e.g. 254712345678@staff.ovocore.app
      const formattedPhoneForAuth = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone.startsWith('0') ? `254${cleanPhone.slice(1)}` : cleanPhone;
      const pseudoEmail = `${formattedPhoneForAuth}@staff.ovocore.app`;

      const response = await fetch('/api/admin/provision-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          farmId,
          displayName: formData.displayName,
          email: pseudoEmail, // Backend creates Firebase auth using this email
          phoneNumber: cleanPhone,
          tempPassword: formData.pinOrPassword, // Used as initial login credential
          role: formData.role,
          assignedHouses: []
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to provision staff account');
      }

      toast({
        title: "Operator Account Created",
        description: `Successfully provisioned ${formData.displayName}. They can log in using phone: ${cleanPhone}`,
      });

      setIsOpen(false);
      setFormData({ displayName: '', phoneNumber: '', pinOrPassword: '', role: 'farm_operator' });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Provisioning Failed",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 rounded-xl font-bold">
          <Plus className="h-4 w-4" /> Add Farm Operator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px] rounded-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Provision Farm Operator</DialogTitle>
            <DialogDescription className="text-xs">
              Create a secure account for field staff. Operators log in using their registered mobile phone number and PIN or password.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="font-bold">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g. Peter Kiprop"
                  required
                  className="pl-9 h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="font-bold">Mobile Phone Number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="e.g. 0712345678"
                  required
                  className="pl-9 h-10 rounded-xl font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Used as the operator's login username.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pin" className="font-bold">Login PIN or Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="pin"
                  type="password"
                  value={formData.pinOrPassword}
                  onChange={(e) => setFormData({ ...formData, pinOrPassword: e.target.value })}
                  placeholder="4-6 digit PIN or secure password"
                  required
                  minLength={4}
                  className="pl-9 h-10 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl font-bold">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Operator Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}