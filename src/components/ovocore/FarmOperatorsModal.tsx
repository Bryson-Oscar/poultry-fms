import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCircle2, Loader2, Settings } from 'lucide-react';
import { AddStaffModal } from './AddStaffModal';
import { ProvisionOwnerModal } from './ProvisionOwnerModal';
import { auth } from '@/lib/firebase';
import { FarmStaffMember } from '@/types/farm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface FarmOperatorsModalProps {
  farmId: string;
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

export function FarmOperatorsModal({ farmId, isOpen: propIsOpen, onClose, trigger }: FarmOperatorsModalProps) {
  const [staff, setStaff] = useState<FarmStaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    setInternalOpen(val);
    if (!val && onClose) onClose();
  };
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      auth.currentUser.getIdTokenResult().then(idTokenResult => {
        setIsAdmin(idTokenResult.claims.role === 'admin');
      }).catch(console.error);
    }
  }, [auth.currentUser]);

  useEffect(() => {
    if (!farmId || !isOpen) return;

    setIsLoading(true);
    const staffRef = collection(db, `farms/${farmId}/staff_members`);
    const q = query(staffRef);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const staffData = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as FarmStaffMember[];
        
        setStaff(staffData);
        setIsLoading(false);
      },
      (err) => {
        console.error("Staff listener error:", err);
        setError("Failed to load staff members.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [farmId, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" /> Manage Operators
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Farm Operators</DialogTitle>
              <DialogDescription>
                Manage staff access and roles for this farm.
              </DialogDescription>
            </div>
            <div className="mr-4 flex items-center gap-2">
              {isAdmin && <ProvisionOwnerModal farmId={farmId} />}
              <AddStaffModal farmId={farmId} />
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
              {error}
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center py-10 border rounded-xl bg-card/20 space-y-3">
              <Users className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="font-semibold text-lg">No Operators Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                You haven't added any staff members yet. Provision accounts for your workers so they can log daily operations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staff.map((member) => (
                <Card key={member.uid} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                        <UserCircle2 className="h-6 w-6 text-slate-500" />
                      </div>
                      <div className="max-w-[150px]">
                        <CardTitle className="text-base font-semibold truncate">{member.displayName}</CardTitle>
                        <CardDescription className="text-xs truncate">{member.email}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={member.role === 'portfolio_manager' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                      {member.role.replace('_', ' ')}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                      <span>Status: <span className="font-medium text-emerald-600">{member.status || 'ACTIVE'}</span></span>
                      <span>Joined: {new Date(member.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
