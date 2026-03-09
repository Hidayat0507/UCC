"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { MedplumClient } from '@medplum/core';
import type { Resource } from '@medplum/fhirtypes';
import { AUTH_DISABLED } from './auth-config';

const MEDPLUM_BASE_URL = process.env.NEXT_PUBLIC_MEDPLUM_BASE_URL || 'http://localhost:8103';
const MEDPLUM_CLIENT_ID = process.env.NEXT_PUBLIC_MEDPLUM_CLIENT_ID || '';
const MEDPLUM_PROJECT_ID = process.env.NEXT_PUBLIC_MEDPLUM_PROJECT_ID || '';

interface MedplumAuthContextType {
  medplum: MedplumClient;
  profile: Resource | null;
  loading: boolean;
  isAuthenticated: boolean;
  clinicId: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => string | undefined;
  setClinicId: (clinicId: string | null) => Promise<void>;
}

const MedplumAuthContext = createContext<MedplumAuthContextType | null>(null);

export function MedplumAuthProvider({ children }: { children: React.ReactNode }) {
  const [medplum] = useState(() => new MedplumClient({
    baseUrl: MEDPLUM_BASE_URL,
    clientId: MEDPLUM_CLIENT_ID || undefined,
    onUnauthenticated: () => {
      setProfile(null);
      // Clear stored token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('medplum-access-token');
        sessionStorage.removeItem('medplum-access-token');
      }
    },
  }));

  const [profile, setProfile] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicIdState] = useState<string | null>(null);

  const persistClinicId = async (nextClinicId: string | null) => {
    setClinicIdState(nextClinicId);
    if (typeof window !== 'undefined') {
      if (nextClinicId) {
        localStorage.setItem('clinic-id', nextClinicId);
      } else {
        localStorage.removeItem('clinic-id');
      }
    }

    try {
      const accessToken = medplum.getAccessToken();
      await fetch('/api/auth/medplum-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, clinicId: nextClinicId }),
      });
    } catch (error) {
      console.warn('⚠️ [EMR] Failed to persist clinicId to session cookie:', error);
    }
  };

  useEffect(() => {
    const storedClinic = localStorage.getItem('clinic-id');
    if (storedClinic) {
      setClinicIdState(storedClinic);
    }

    if (AUTH_DISABLED) {
      setProfile({ resourceType: 'Practitioner', id: 'dev' } as Resource);
      setLoading(false);
      return;
    }

    const storedToken = localStorage.getItem('medplum-access-token');
    if (!storedToken) {
      setLoading(false);
      return;
    }

    medplum.setAccessToken(storedToken);
    setProfile({ resourceType: 'Practitioner', id: 'token-auth' } as Resource);
    setLoading(false);

    medplum.getProfileAsync()
      .then((p) => { if (p) setProfile(p as Resource); })
      .catch(() => {
        localStorage.removeItem('medplum-access-token');
        setProfile(null);
      });
  }, [medplum]);

  const signIn = async (email: string, password: string) => {
    if (AUTH_DISABLED) return;
    try {
      const loginResponse = await medplum.startLogin({
        email,
        password,
        projectId: MEDPLUM_PROJECT_ID || undefined,
      });

      // If startLogin returned a code but the SDK didn't auto-process it,
      // explicitly process it to complete the token exchange.
      if (loginResponse?.code && !medplum.getAccessToken()) {
        await medplum.processCode(loginResponse.code);
      }

      // Try to load the user profile
      try {
        const maybeProfile = await medplum.getProfile();
        if (maybeProfile) {
          setProfile(maybeProfile as Resource | null);
        }
      } catch {
        setProfile(null);
      }

      const accessToken = medplum.getAccessToken();
      if (!accessToken) {
        throw new Error('Login succeeded but no access token was returned');
      }

      localStorage.setItem('medplum-access-token', accessToken);

      await fetch('/api/auth/medplum-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const signOut = async () => {
    if (AUTH_DISABLED) {
      setProfile(null);
      setClinicIdState(null);
      localStorage.removeItem('clinic-id');
      return;
    }
    try {
      // Clear Medplum session
      medplum.signOut();
      setProfile(null);
      setClinicIdState(null);

      // Clear stored tokens
      localStorage.removeItem('medplum-access-token');
      sessionStorage.removeItem('medplum-access-token');
      localStorage.removeItem('clinic-id');

      // Clear server session cookie
      await fetch('/api/auth/medplum-session', {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getAccessToken = () => {
    return medplum.getAccessToken();
  };

  const value: MedplumAuthContextType = {
    medplum,
    profile,
    loading,
    isAuthenticated: AUTH_DISABLED ? true : profile !== null,
    clinicId,
    signIn,
    signOut,
    getAccessToken,
    setClinicId: persistClinicId,
  };

  return (
    <MedplumAuthContext.Provider value={value}>
      {children}
    </MedplumAuthContext.Provider>
  );
}

export function useMedplumAuth() {
  const context = useContext(MedplumAuthContext);
  if (!context) {
    throw new Error('useMedplumAuth must be used within MedplumAuthProvider');
  }
  return context;
}

// Helper to get user role from profile
export function getUserRole(profile: Resource | null): string | null {
  if (!profile) return null;

  // Profile can be Practitioner, Patient, RelatedPerson, etc.
  const resourceType = profile.resourceType;

  // For practitioners, check their role
  if (resourceType === 'Practitioner') {
    // Role would come from PractitionerRole or custom extension
    // For now, return a default or check extensions
    return 'practitioner';
  }

  if (resourceType === 'Patient') {
    return 'patient';
  }

  // Check for admin role (typically in extensions or project membership)
  return 'user';
}

// Check if user has specific role
export function hasRole(profile: Resource | null, roles: string[]): boolean {
  const userRole = getUserRole(profile);
  return userRole ? roles.includes(userRole) : false;
}

// Shortcut hook to access clinic context without exposing full auth details
export function useClinic() {
  const { clinicId, setClinicId } = useMedplumAuth();
  return { clinicId, setClinicId };
}
