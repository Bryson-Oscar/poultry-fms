'use client';

import React, { useState, useEffect, useId } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Crown,
  PhoneCall,
  Share2,
  Loader2,
  AlertCircle,
  X,
  Copy,
  Check,
  Briefcase,
  ClipboardList,
  ExternalLink,
  RefreshCw,
  Clock,
  Sparkles,
  Bot,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getFarmTeamStatus, generateTeamInvites } from '@/services/farmService';

export type TeamRole = 'owner' | 'manager' | 'supervisor';

interface OperatorInput {
  id: string;
  name: string;
  phone: string;
  role: 'manager' | 'supervisor';
}

interface GeneratedInvite {
  name: string;
  role: string;
  url: string;
  phone: string;
  code?: string;
}

interface FarmTeamOnboardingModalProps {
  farmId: string;
  isOpen: boolean;
  onClose: () => void;
  onTeamUpdated?: () => void;
}

// Helper: Format and sanitize Kenyan and international phone numbers
function formatToWhatsAppNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 13;
}

export default function FarmTeamOnboardingModal({
  farmId,
  isOpen,
  onClose,
  onTeamUpdated
}: FarmTeamOnboardingModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'invite' | 'roster'>('invite');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teamStatus, setTeamStatus] = useState<any>(null);

  // Form State
  const [ownerInput, setOwnerInput] = useState({ name: '', phone: '' });
  const [operatorInputs, setOperatorInputs] = useState<OperatorInput[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedInvite[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && farmId) {
      loadTeamStatus();
    }
  }, [isOpen, farmId]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadTeamStatus = async () => {
    setLoading(true);
    try {
      const status = await getFarmTeamStatus(farmId);
      setTeamStatus(status);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not load farm team status.'
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchAITutor = (role: string, name: string, code?: string, phone?: string) => {
    if (!code) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No invite code found for this member.'
      });
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://agribuild.co.ke';
    const tutorUrl = `${origin}/auth?tutorToken=${code}&role=${role}`;
    
    const message = 
      `Habari ${name}! 👋\n\n` +
      `Welcome to *${teamStatus?.farmName || 'OvoCore Poultry Farm'}*.\n\n` +
      `Click the link below to meet your *AI Onboarding Tutor* and complete your interactive training session for your role (*${role.toUpperCase()}*):\n` +
      `🔗 ${tutorUrl}\n\n` +
      `Let's get your farm telemetry and daily log procedures initialized!`;

    // Copy to clipboard as fallback
    navigator.clipboard.writeText(message);

    // Format phone and open WhatsApp
    let waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    if (phone && isValidPhone(phone)) {
      const cleanPhone = formatToWhatsAppNumber(phone);
      waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    }

    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank');
    }
    
    toast({
      title: "Opening WhatsApp Dispatch...",
      description: `Training link dispatched to ${name}. Message copied to clipboard.`,
    });
  };

  const handleAddOperatorField = () => {
    setOperatorInputs([
      ...operatorInputs,
      { id: Math.random().toString(36).substring(2, 9), name: '', phone: '', role: 'supervisor' }
    ]);
  };

  const handleRemoveOperatorField = (id: string) => {
    setOperatorInputs(operatorInputs.filter((op: OperatorInput) => op.id !== id));
  };

  const handleUpdateOperator = (id: string, field: keyof OperatorInput, value: string) => {
    setOperatorInputs((prev: OperatorInput[]) =>
      prev.map((op: OperatorInput) => (op.id === id ? { ...op, [field]: value } : op))
    );
  };

  const handleSubmit = async () => {
    const isOwnerSet = teamStatus?.hasOwner || teamStatus?.pendingOwnerInvite;

    // 1. Validate Owner requirement
    if (!isOwnerSet && (!ownerInput.name.trim() || !isValidPhone(ownerInput.phone))) {
      toast({
        variant: 'destructive',
        title: 'Principal Owner Required',
        description: 'Please provide a valid name and phone number for the Farm Owner.'
      });
      return;
    }

    // 2. Validate Operators
    for (const op of operatorInputs as OperatorInput[]) {
      if (!op.name.trim()) {
        toast({
          variant: 'destructive',
          title: 'Missing Operator Name',
          description: 'Please ensure every team member has a name.'
        });
        return;
      }
      if (!isValidPhone(op.phone)) {
        toast({
          variant: 'destructive',
          title: 'Invalid Phone Number',
          description: `Please enter a valid phone number for ${op.name}.`
        });
        return;
      }
    }

    // 3. Prevent duplicate phone numbers
    const allPhones = [
      ...(!isOwnerSet && ownerInput.phone ? [formatToWhatsAppNumber(ownerInput.phone)] : []),
      ...operatorInputs.map((o: OperatorInput) => formatToWhatsAppNumber(o.phone))
    ];
    const uniquePhones = new Set(allPhones);
    if (uniquePhones.size !== allPhones.length) {
      toast({
        variant: 'destructive',
        title: 'Duplicate Phone Numbers',
        description: 'Each team member must have a unique phone number.'
      });
      return;
    }

    // 4. Build payload
    const payloadToGenerate: Array<{ name: string; phone: string; role: TeamRole }> = [];
    if (!isOwnerSet && ownerInput.name && ownerInput.phone) {
      payloadToGenerate.push({
        name: ownerInput.name.trim(),
        phone: formatToWhatsAppNumber(ownerInput.phone),
        role: 'owner'
      });
    }

    operatorInputs.forEach((op: OperatorInput) => {
      payloadToGenerate.push({
        name: op.name.trim(),
        phone: formatToWhatsAppNumber(op.phone),
        role: op.role
      });
    });

    if (payloadToGenerate.length === 0) {
      toast({
        title: 'No Invites to Generate',
        description: 'Please add at least one operator or configure the owner.'
      });
      return;
    }

    setSubmitting(true);
    try {
      const farmDisplayName = teamStatus?.farmName || 'OvoCore Farm';
      const links = await generateTeamInvites(farmId, farmDisplayName, payloadToGenerate);
      setGeneratedLinks(links);
      toast({
        title: 'Invites Generated Successfully',
        description: 'Dispatch the customized WhatsApp onboarding links below.'
      });
      if (onTeamUpdated) onTeamUpdated();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Invitation Error',
        description: err.message || 'Failed to generate onboarding links.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getInviteMessage = (linkObj: GeneratedInvite): string => {
    const farmName = teamStatus?.farmName || 'OvoCore Poultry Farm';
    const roleTitle = linkObj.role.toUpperCase();

    return (
      `Habari ${linkObj.name}! 👋\n\n` +
      `You have been designated as *${roleTitle}* for *${farmName}* on the OvoCore Poultry Management System.\n\n` +
      `Please activate your account and access your live farm control room using this secure invite link:\n` +
      `🔗 ${linkObj.url}\n\n` +
      `_Note: Keep this link confidential as it grants direct access to farm logs and flock records._`
    );
  };

  const shareViaWhatsApp = (linkObj: GeneratedInvite) => {
    const message = getInviteMessage(linkObj);
    const cleanPhone = formatToWhatsAppNumber(linkObj.phone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({ title: 'Link Copied', description: 'Invite URL copied to clipboard.' });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="max-w-2xl w-full rounded-3xl border-border/80 shadow-2xl overflow-hidden bg-card text-card-foreground flex flex-col max-h-[92vh]">
        {/* Header */}
        <CardHeader className="bg-muted/40 p-5 sm:p-6 border-b border-border/60 flex flex-row items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Users className="w-4 h-4" />
              </div>
              <CardTitle className="text-base sm:text-lg font-black tracking-tight">
                Farm Team Onboarding & Governance
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              {teamStatus?.farmName ? (
                <span>
                  Site: <strong className="text-foreground">{teamStatus.farmName}</strong> • Onboard trusted farm personnel
                </span>
              ) : (
                'Securely assign roles and dispatch role-scoped credentials via WhatsApp.'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>

        {/* Tab Controls (When not viewing generated links) */}
        {generatedLinks.length === 0 && !loading && (
          <div className="flex border-b border-border/60 bg-muted/20 px-6 pt-2 shrink-0">
            <button
              onClick={() => setActiveTab('invite')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'invite'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite Team Members
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'roster'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Current Roster & Status
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <CardContent className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-semibold">
                Verifying farm security hierarchy & roster...
              </p>
            </div>
          ) : generatedLinks.length > 0 ? (
            /* GENERATED LINKS SUCCESS VIEW */
            <div className="space-y-5 animate-in fade-in-50">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    Onboarding Links Generated ({generatedLinks.length})
                  </h3>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
                    Send each invite directly to the member's WhatsApp. When they click the link, their
                    account will be linked to <strong>{teamStatus?.farmName}</strong> with their assigned privileges.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {generatedLinks.map((link: any, idx: number) => {
                  const isOwner = link.role === 'owner';
                  const isManager = link.role === 'manager';

                  return (
                    <div
                      key={idx}
                      className="p-4 border border-border/80 rounded-2xl bg-card hover:border-primary/50 transition-all flex flex-col sm:flex-row gap-3 sm:items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${isOwner
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                : isManager
                                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                  : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
                              }`}
                          >
                            {link.role}
                          </span>
                          <span className="font-bold text-sm text-foreground">{link.name}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1">
                          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                            <PhoneCall className="w-3 h-3 text-muted-foreground" /> {link.phone}
                          </p>
                          {link.code && (
                            <p className="text-[11px] font-mono font-bold text-primary flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-md w-fit">
                              Code: {link.code}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 sm:pt-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(link.url, idx)}
                          className="h-9 px-3 rounded-xl text-xs font-bold"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          {copiedIndex === idx ? 'Copied' : 'Copy Link'}
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => shareViaWhatsApp(link)}
                          className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20"
                        >
                          <Share2 className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setGeneratedLinks([]);
                    loadTeamStatus();
                  }}
                  className="flex-1 h-11 rounded-xl text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Back to Team Management
                </Button>
                <Button
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-primary dark:text-primary-foreground"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : activeTab === 'roster' ? (
            /* ROSTER & EXISTING TEAM VIEW */
            <div className="space-y-5 animate-in fade-in-50">
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Principal Farm Ownership
                  </h4>
                </div>

                {teamStatus?.hasOwner || teamStatus?.pendingOwnerInvite ? (
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                        <Crown className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {teamStatus.ownerName || 'Designated Owner'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {teamStatus.ownerPhone || 'Owner Account'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {teamStatus.pendingOwnerInvite && (
                        <Button 
                          onClick={() => handleDispatchAITutor('owner', teamStatus.ownerName, teamStatus.ownerInviteCode, teamStatus.ownerPhone)}
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/20"
                        >
                          <Bot className="w-3.5 h-3.5 mr-1" /> Tutor & Train
                        </Button>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${teamStatus.hasOwner
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          }`}
                      >
                        {teamStatus.hasOwner ? 'Active Owner' : 'Pending Acceptance'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-muted/40 border border-dashed border-border/80 text-center space-y-1">
                    <p className="text-xs font-bold text-amber-600">No Owner Assigned</p>
                    <p className="text-[11px] text-muted-foreground">
                      Switch to the Invite tab to designate the primary farm owner.
                    </p>
                  </div>
                )}
              </div>

              {/* Operators list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Operators & Supervisors ({teamStatus?.operators?.length || 0})
                    </h4>
                  </div>
                </div>

                {teamStatus?.operators && teamStatus.operators.length > 0 ? (
                  <div className="space-y-2">
                    {teamStatus.operators.map((member: any, i: number) => (
                      <div
                        key={i}
                        className="p-3 bg-muted/30 border border-border/70 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-foreground">{member.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{member.phone}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="capitalize font-bold text-[10px] bg-background border px-2 py-0.5 rounded-md">
                            {member.role}
                          </span>
                          <div className="flex items-center gap-2">
                            {member.status === 'pending' && (
                              <Button 
                                onClick={() => handleDispatchAITutor(member.role, member.name, member.inviteCode, member.phone)}
                                size="sm" 
                                variant="ghost" 
                                className="h-5 px-1.5 text-[9px] text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10"
                              >
                                <Bot className="w-3 h-3 mr-1" /> Tutor
                              </Button>
                            )}
                            <span className={`text-[9px] font-black uppercase tracking-wider ${member.status === 'active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {member.status === 'active' ? 'Active User' : 'Invite Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    No additional farm managers or supervisors added yet.
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => setActiveTab('invite')}
                className="w-full text-xs font-bold h-10 rounded-xl"
              >
                <UserPlus className="w-3.5 h-3.5 mr-2" /> Add Team Members Now
              </Button>
            </div>
          ) : (
            /* INVITE FORM VIEW */
            <div className="space-y-6">
              {/* 1. Owner Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      1. Principal Farm Owner
                    </h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Required for billing & legal control
                  </span>
                </div>

                {teamStatus?.hasOwner || teamStatus?.pendingOwnerInvite ? (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          {teamStatus.hasOwner ? 'Owner Account Active' : 'Owner Invitation Pending'}
                        </p>
                        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                          {teamStatus.ownerName} ({teamStatus.ownerPhone || 'Registered'})
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      Locked
                    </span>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3">
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Every farm must have an established Owner before adding field staff.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold">Owner Full Name</Label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. John Mwangi"
                          value={ownerInput.name}
                          onChange={(e) => setOwnerInput({ ...ownerInput, name: e.target.value })}
                          className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold">Owner WhatsApp / Phone</Label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 0712345678"
                          value={ownerInput.phone}
                          onChange={(e) => setOwnerInput({ ...ownerInput, phone: e.target.value })}
                          className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Operators Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      2. Operational Staff & Supervisors
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOperatorField}
                    disabled={
                      !teamStatus?.hasOwner &&
                      !teamStatus?.pendingOwnerInvite &&
                      (!ownerInput.name || !ownerInput.phone)
                    }
                    className="h-8 text-xs font-bold rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Staff Member
                  </Button>
                </div>

                {operatorInputs.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-2xl border-border/80 space-y-1.5">
                    <ClipboardList className="w-6 h-6 text-muted-foreground mx-auto" />
                    <p className="text-xs font-medium text-muted-foreground">
                      No additional staff added to this onboarding batch.
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Click <strong>Add Staff Member</strong> to invite Farm Managers or Egg Collection Supervisors.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {operatorInputs.map((op: OperatorInput, idx: number) => (
                      <div
                        key={op.id}
                        className="p-3.5 bg-muted/30 border border-border/70 rounded-2xl relative group space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                            Member #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveOperatorField(op.id)}
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          <div className="sm:col-span-5 space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                              Full Name
                            </Label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Mary Wanjiku"
                              value={op.name}
                              onChange={(e) => handleUpdateOperator(op.id, 'name', e.target.value)}
                              className="w-full p-2 bg-background border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          <div className="sm:col-span-4 space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                              WhatsApp / Phone
                            </Label>
                            <input
                              type="tel"
                              required
                              placeholder="07XXXXXXXX"
                              value={op.phone}
                              onChange={(e) => handleUpdateOperator(op.id, 'phone', e.target.value)}
                              className="w-full p-2 bg-background border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                              Role
                            </Label>
                            <select
                              value={op.role}
                              onChange={(e) =>
                                handleUpdateOperator(op.id, 'role', e.target.value as any)
                              }
                              className="w-full p-2 bg-background border border-border/80 rounded-xl text-xs font-bold"
                            >
                              <option value="manager">Manager</option>
                              <option value="supervisor">Supervisor</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Role Matrix Reference Card */}
              <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60 text-[11px] space-y-2 text-muted-foreground">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Role Access Hierarchy:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl bg-background/80 border border-border/50">
                    <p className="font-bold text-blue-600 dark:text-blue-400">🛡️ Farm Manager</p>
                    <p className="text-[10px] mt-0.5">
                      Flock batch setup, feed formulation, financial records, inventory approvals.
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-background/80 border border-border/50">
                    <p className="font-bold text-slate-700 dark:text-slate-300">📋 Flock Supervisor</p>
                    <p className="text-[10px] mt-0.5">
                      Daily egg collections, mortality logging, feed distribution, health inspection checks.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        {/* Action Footer */}
        {!loading && generatedLinks.length === 0 && activeTab === 'invite' && (
          <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-xs font-bold rounded-xl h-11"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                (!teamStatus?.hasOwner &&
                  !teamStatus?.pendingOwnerInvite &&
                  (!ownerInput.name || !ownerInput.phone))
              }
              className="flex-1 sm:flex-initial sm:min-w-[240px] font-bold text-xs h-11 rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating Access Credentials...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" /> Generate & Dispatch Invites
                </>
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}