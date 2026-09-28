"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';
import { ensureUserDocument } from '@/services/userService';
import {
  Egg,
  ShieldCheck,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  KeyRound
} from 'lucide-react';
import Link from 'next/link';

function OvoCoreAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirectTarget = rawRedirect === '/ovocore' ? '/' : rawRedirect;

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'creator' | 'manager' | 'operator'>('creator');
  const [flockFocus, setFlockFocus] = useState<'commercial_layers' | 'broilers' | 'dual_purpose_kienyeji'>('commercial_layers');

  useEffect(() => {
    if (!auth) {
      setIsInitializing(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace(redirectTarget);
      } else {
        setIsInitializing(false);
      }
    });

    return () => unsubscribe();
  }, [redirectTarget, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Credentials",
        description: "Please enter both your email address and password."
      });
      return;
    }

    setIsLoading(true);
    try {
      const signInCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserDocument(signInCred.user);
      toast({
        title: "Authentication Successful",
        description: "Welcome back to your OvoCore workspace."
      });
      router.replace(redirectTarget);
    } catch (error: any) {
      console.error("Sign in error:", error);
      let errorMsg = "Failed to sign in. Please check your credentials.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        errorMsg = "Invalid email or password. Please verify and try again.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = "Access temporarily blocked due to many failed attempts. Try resetting your password or try again later.";
      }
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: errorMsg
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Required Fields",
        description: "Full Name, Email, and Password are required to create an account."
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Weak Password",
        description: "Password must be at least 6 characters long."
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Password Mismatch",
        description: "Passwords do not match. Please check and re-enter."
      });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Update Display Name
      await updateProfile(user, {
        displayName: fullName.trim()
      });

      // 3. Automatically Create User's Personal Isolated Farm in Firestore
      const farmRef = doc(collection(db, 'farms'));
      const farmId = farmRef.id;
      const farmName = companyName.trim() || `${fullName.trim()}'s Poultry Farm`;

      await setDoc(farmRef, {
        id: farmId,
        name: farmName,
        location: 'Kenya',
        county: 'Kiambu',
        flockType: flockFocus || 'layers',
        targetCapacity: 5000,
        ownerUserId: user.uid,
        ownerName: fullName.trim(),
        ownerPhone: phoneNumber.trim() || '',
        ownerContact: {
          name: fullName.trim(),
          email: user.email,
          phone: phoneNumber.trim() || ''
        },
        status: 'active',
        activeFlockCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 4. Automatically initialize User Document in 'users' collection linked to their Farm
      await ensureUserDocument(user, {
        displayName: fullName.trim(),
        phoneNumber: phoneNumber.trim() || null,
        companyName: companyName.trim() || null,
        role: 'farmer',
        assignedFarmId: farmId,
        flockFocus: flockFocus,
        onboarded: true,
        plan: 'trial'
      });

      toast({
        title: "Farm Registered & Account Initialized!",
        description: `Created your active farm '${farmName}'. Opening control room...`
      });

      router.replace(`/farm/${farmId}`);
    } catch (error: any) {
      console.error("Sign up error:", error);
      if (error.code === 'auth/email-already-in-use') {
        // Attempt auto-login using entered password to backfill missing user document
        try {
          const signInCred = await signInWithEmailAndPassword(auth, email.trim(), password);
          const existingUser = signInCred.user;

          // Check if user already has an assigned farm or user document
          const userDocRef = doc(db, 'users', existingUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          let farmId = userDocSnap.exists() ? userDocSnap.data().assignedFarmId : null;

          if (!farmId) {
            // Check if a farm document exists where ownerUserId or ownerContact.email matches
            const farmsRef = collection(db, 'farms');
            const ownerQuery = query(farmsRef, where('ownerUserId', '==', existingUser.uid));
            const ownerSnap = await getDocs(ownerQuery);

            if (!ownerSnap.empty) {
              farmId = ownerSnap.docs[0].id;
            } else {
              // Create default isolated farm for backfilled user
              const farmRef = doc(collection(db, 'farms'));
              farmId = farmRef.id;
              const farmName = companyName.trim() || `${fullName.trim() || existingUser.displayName || 'Mkulima'}'s Poultry Farm`;

              await setDoc(farmRef, {
                id: farmId,
                name: farmName,
                location: 'Kenya',
                county: 'Kiambu',
                flockType: flockFocus || 'layers',
                targetCapacity: 5000,
                ownerUserId: existingUser.uid,
                ownerName: fullName.trim() || existingUser.displayName || 'Farm Manager',
                ownerPhone: phoneNumber.trim() || '',
                ownerContact: {
                  name: fullName.trim() || existingUser.displayName || 'Farm Manager',
                  email: existingUser.email,
                  phone: phoneNumber.trim() || ''
                },
                status: 'active',
                activeFlockCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            }
          }

          // Backfill/sync user document in 'users' collection
          await ensureUserDocument(existingUser, {
            displayName: fullName.trim() || existingUser.displayName || 'Poultry Farmer',
            phoneNumber: phoneNumber.trim() || existingUser.phoneNumber || null,
            companyName: companyName.trim() || null,
            role: 'farmer',
            assignedFarmId: farmId,
            flockFocus: flockFocus || 'layers',
            onboarded: true,
            plan: 'trial'
          });

          toast({
            title: "User Profile Restored & Document Backfilled!",
            description: `Backfilled your missing user document. Opening control room...`
          });

          router.replace(`/farm/${farmId}`);
          return;
        } catch (signInErr: any) {
          console.warn("Backfill auto-login failed (password mismatch):", signInErr);
          toast({
            variant: "destructive",
            title: "Email Already Registered",
            description: "An account with this email address already exists. Please verify your password to sign in."
          });
          setMode('signin');
          return;
        }
      }

      let errorMsg = error.message || "Failed to create account.";
      if (error.code === 'auth/invalid-email') {
        errorMsg = "Please enter a valid email address.";
      }
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: errorMsg
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Sync user profile to Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const farmRef = doc(collection(db, 'farms'));
        const farmId = farmRef.id;
        const farmName = `${user.displayName || 'Mkulima'}'s Poultry Farm`;

        await setDoc(farmRef, {
          id: farmId,
          name: farmName,
          location: 'Kenya',
          county: 'Kiambu',
          flockType: 'layers',
          targetCapacity: 5000,
          ownerUserId: user.uid,
          ownerName: user.displayName || 'Farm Manager',
          ownerPhone: user.phoneNumber || '',
          ownerContact: {
            name: user.displayName || 'Farm Manager',
            email: user.email,
            phone: user.phoneNumber || ''
          },
          status: 'active',
          activeFlockCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        await ensureUserDocument(user, {
          displayName: user.displayName || 'Poultry Manager',
          phoneNumber: user.phoneNumber || null,
          role: 'farmer',
          assignedFarmId: farmId,
          onboarded: true,
          plan: 'trial'
        });

        router.replace(`/farm/${farmId}`);
        return;
      }

      toast({
        title: "Google Authentication Successful",
        description: `Logged in as ${user.email}`
      });

      router.replace(redirectTarget);
    } catch (error: any) {
      console.error("Google Auth error:", error);
      if (error.code !== 'auth/popup-closed-by-user') {
        toast({
          variant: "destructive",
          title: "Google Sign-In Failed",
          description: error.message || "Could not complete Google authentication."
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your registered email address to receive password reset instructions."
      });
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      toast({
        title: "Reset Email Sent",
        description: `Password reset link sent to ${resetEmail.trim()}. Check your inbox.`
      });
      setIsResetModalOpen(false);
      setResetEmail('');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: error.message || "Could not send password reset email."
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white space-y-4">
        <PeckingChickenLoader />
        <p className="text-xs font-mono text-slate-400 animate-pulse">
          Connecting to OvoCore Auth Gate...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[300px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 shadow-xl shadow-amber-500/20 mb-2">
            <Egg className="w-8 h-8 text-slate-950 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            OvoCore <span className="text-amber-400">Portal</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Autonomous Poultry Enterprise Engine & Multi-Farm Console
          </p>
        </div>

        {/* Auth Toggle Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`py-2 text-xs font-extrabold rounded-xl transition-all ${
              mode === 'signin'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`py-2 text-xs font-extrabold rounded-xl transition-all ${
              mode === 'signup'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register Farm
          </button>
        </div>

        {/* Main Form Card */}
        <Card className="bg-slate-900/90 border-slate-800 text-white shadow-2xl rounded-3xl overflow-hidden backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              {mode === 'signin' ? (
                <>
                  <Lock className="w-4 h-4 text-amber-400" /> Sign In to Your Workspace
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" /> Create Enterprise Account
                </>
              )}
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              {mode === 'signin'
                ? 'Enter your credentials to access your active poultry telemetry & control room.'
                : 'Register your farm management account to monitor flocks, feeds, and financial metrics.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Google Quick Login Button */}
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              variant="outline"
              className="w-full bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-200 font-bold rounded-xl h-11 text-xs"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              Continue with Google
            </Button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest absolute">
                Or Email
              </span>
            </div>

            {/* Sign In Form */}
            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <Input
                      type="email"
                      required
                      placeholder="mkulima@ovocore.co.ke"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs h-11"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-300">Password</Label>
                    <button
                      type="button"
                      onClick={() => setIsResetModalOpen(true)}
                      className="text-[11px] text-amber-400 hover:underline font-semibold"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-9 bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl h-11 text-xs shadow-lg shadow-amber-500/20"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  Sign In to Control Room
                </Button>
              </form>
            ) : (
              /* Sign Up Form */
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <Input
                      type="text"
                      required
                      placeholder="Joseph Mkulima"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs h-11"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Work Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <Input
                      type="email"
                      required
                      placeholder="joseph@kukuborafarms.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-300">Password</Label>
                    <Input
                      type="password"
                      required
                      placeholder="Min. 6 chars"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-300">Confirm Password</Label>
                    <Input
                      type="password"
                      required
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-300">Phone (WhatsApp)</Label>
                    <Input
                      type="tel"
                      placeholder="+254712345678"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs h-11 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-300">Farm / Enterprise Name</Label>
                    <Input
                      type="text"
                      placeholder="Kuku Bora Farm"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs h-11"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl h-11 text-xs shadow-lg shadow-amber-500/20 pt-1"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Create Account & Register Farm
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="bg-slate-950/60 border-t border-slate-800/80 p-4 text-center justify-center">
            <p className="text-[11px] text-slate-400">
              {mode === 'signin' ? (
                <>
                  Don't have a registered farm yet?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="text-amber-400 font-bold hover:underline"
                  >
                    Register Farm
                  </button>
                </>
              ) : (
                <>
                  Already registered your farm?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className="text-amber-400 font-bold hover:underline"
                  >
                    Sign In
                  </button>
                </>
              )}
            </p>
          </CardFooter>
        </Card>

        {/* Footer Note */}
        <p className="text-[10px] text-slate-500 text-center font-mono">
          Protected by Firebase Authentication & SSL 256-bit Encryption
        </p>

      </div>

      {/* Password Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-white rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Password</h3>
                <p className="text-xs text-slate-400">Receive a secure link to reset your account password.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Registered Email Address</Label>
                <Input
                  type="email"
                  required
                  placeholder="mkulima@ovocore.co.ke"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs h-11"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResetModalOpen(false)}
                  className="border-slate-800 text-slate-400 hover:bg-slate-800 rounded-xl text-xs h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingReset}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs h-10"
                >
                  {isSendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

    </div>
  );
}

export default function OvoCoreAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <PeckingChickenLoader />
      </div>
    }>
      <OvoCoreAuthContent />
    </Suspense>
  );
}
