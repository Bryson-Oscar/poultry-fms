// components/CreateFarmModal.tsx
'use client';

import React, { useState } from 'react';
import { Building2, PhoneCall, Share2, Loader2, Sparkles, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createFarmWithInvite } from '@/services/farmService';
import { auth } from '@/lib/firebase';

interface CreateFarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (farmId: string) => void;
}

export default function CreateFarmModal({ isOpen, onClose, onSuccess }: CreateFarmModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<{ farmId: string; inviteCode: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    county: 'Kiambu',
    flockType: 'layers' as const,
    targetCapacity: 5000,
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.ownerPhone || !formData.ownerName) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'Farm name, owner name, and owner phone are required.'
      });
      return;
    }

    setLoading(true);
    try {
      const currentAdminId = auth.currentUser?.uid || 'admin_system';
      const result = await createFarmWithInvite({
        ...formData,
        createdByAdminId: currentAdminId,
      });

      setGeneratedInvite(result);
      toast({
        title: 'Farm Initialized',
        description: `Farm profile created with invite code #${result.inviteCode}`
      });
      if (onSuccess) onSuccess(result.farmId);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: err.message || 'Could not register farm.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!generatedInvite) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://agribuild.co.ke';
    const inviteUrl = `${origin}/invite/farm?code=${generatedInvite.inviteCode}`;
    
    const message = 
      `Habari ${formData.ownerName}! 👋\n\n` +
      `Your digital farm profile for *${formData.name}* has been set up on the *OvoCore Poultry Management Platform*.\n\n` +
      `Click the secure access link below to activate your account and access your real-time farm dashboard:\n` +
      `🔗 ${inviteUrl}\n\n` +
      `Target Capacity: ${formData.targetCapacity.toLocaleString()} Birds (${formData.flockType.toUpperCase()})\n` +
      `Location: ${formData.location}, ${formData.county}`;

    // Clean phone number (e.g. convert 07xx to 2547xx)
    let cleanPhone = formData.ownerPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.substring(1);
    }

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
      <Card className="max-w-lg w-full rounded-3xl border-border/80 shadow-2xl overflow-hidden bg-card text-card-foreground">
        <CardHeader className="bg-muted/40 p-6 border-b border-border/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> Create OvoCore Farm Profile
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registers the physical farm site and prepares an onboarding link for the owner.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {!generatedInvite ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Farm Enterprise Name</Label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ridgeview Poultry Farm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Location / Town</Label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kimbo, Ruiru"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Flock Specialization</Label>
                  <select
                    value={formData.flockType}
                    onChange={(e: any) => setFormData({ ...formData, flockType: e.target.value })}
                    className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-bold"
                  >
                    <option value="layers">Commercial Layers</option>
                    <option value="broilers">Meat Broilers</option>
                    <option value="breeders">Parent Stock / Breeders</option>
                    <option value="dual_purpose">Dual-Purpose Kienyeji</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Target Housing Bird Capacity</Label>
                <input
                  type="number"
                  required
                  value={formData.targetCapacity}
                  onChange={(e) => setFormData({ ...formData, targetCapacity: Number(e.target.value) })}
                  className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="pt-2 border-t border-border/60">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">
                  Farm Owner Invitation Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Owner Full Name</Label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Kamau"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">WhatsApp Number</Label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0712345678"
                      value={formData.ownerPhone}
                      onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                      className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl text-xs mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Generate Farm & Create WhatsApp Invite
              </Button>
            </form>
          ) : (
            <div className="space-y-4 py-2 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-black">Farm Ready for Onboarding</h3>
                <p className="text-xs text-muted-foreground">
                  Invite token <span className="font-mono font-bold text-foreground">#{generatedInvite.inviteCode}</span> generated for <strong>{formData.ownerName}</strong>.
                </p>
              </div>

              <div className="p-3 bg-muted/40 rounded-2xl border border-border/60 text-left text-xs space-y-1">
                <p className="text-muted-foreground">Direct Onboarding Link:</p>
                <p className="font-mono text-[11px] text-primary break-all">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/invite/farm?code={generatedInvite.inviteCode}
                </p>
              </div>

              <Button
                onClick={handleOpenWhatsApp}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-600/20"
              >
                <Share2 className="w-4 h-4 mr-2" /> Send Invitation via WhatsApp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
