"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { MedplumClient } from '@medplum/core';
import type { HumanName, Resource } from '@medplum/fhirtypes';

const noopStorage = {
  getString: (_key: string) => undefined,
  setString: (_key: string, _value: string) => {},
  getObject: (_key: string) => undefined,
  setObject: (_key: string, _value: unknown) => {},
  clear: () => {},
  removeString: (_key: string) => {},
};

const MEDPLUM_BASE_URL = process.env.NEXT_PUBLIC_MEDPLUM_BASE_URL || 'http://localhost:8103';
const MEDPLUM_CLIENT_ID = process.env.NEXT_PUBLIC_MEDPLUM_CLIENT_ID || '';

interface MedplumAuthContextType {
  medplum: MedplumClient;
  profile: Resource | null;
  loading: boolean;
  isAuthenticated: boolean;
  userLabel: string | null;
  isAdmin: boolean;
  clinicId: string | null;
  signIn: (
    email: string,
    password: string,
    requestedClinicId?: string | null
  ) => Promise<{ isAdmin: boolean; homeUrl?: string; clinicId?: string | null }>;
  signOut: () => Promise<void>;
  getAccessToken: () => string | undefined;
  setClinicId: (clinicId: string | null) => Promise<void>;
}

const MedplumAuthContext = createContext<MedplumAuthContextType | null>(null);

function formatHumanName(name?: HumanName): string | null {
  if (!name) return null;
  const parts = [...(name.given ?? []), name.family].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function getProfileLabel(profile: Resource | null): string | null {
  if (!profile) return null;

  if ('name' in profile && Array.isArray((profile as any).name)) {
    const displayName = formatHumanName((profile as any).name[0]);
    if (displayName) return displayName;
  }

  if ('telecom' in profile && Array.isArray((profile as any).telecom)) {
    const email = (profile as any).telecom.find((item: any) => item?.system === 'email')?.value;
    if (email) return email;
  }

  return profile.id ?? profile.resourceType;
}

function toResourceLikeProfile(data: {
  id?: string;
  resourceType?: string;
  name?: string | null;
  email?: string | null;
}): Resource | null {
  if (!data.id || !data.resourceType) {
    return null;
  }

  return {
    resourceType: data.resourceType,
    id: data.id,
    ...(data.name
      ? {
          name: [{ text: data.name }],
        }
      : undefined),
    ...(data.email
      ? {
          telecom: [{ system: 'email', value: data.email }],
        }
      : undefined),
  } as Resource;
}

export function MedplumAuthProvider({ children }: { children: React.ReactNode }) {
  const [medplum] = useState(() => new MedplumClient({
    baseUrl: MEDPLUM_BASE_URL,
    clientId: MEDPLUM_CLIENT_ID || undefined,
    storage: noopStorage,
    onUnauthenticated: () => {
      setProfile(null);
      setHasSession(false);
      setIsAdmin(false);
    },
  }));

  const [profile, setProfile] = useState<Resource | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicIdState] = useState<string | null>(null);

  const hydrateFromServerSession = async () => {
    const sessionRes = await fetch('/api/auth/medplum-session', { credentials: 'include' });

    if (!sessionRes.ok) {
      setHasSession(false);
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    const session = await sessionRes.json();
    setHasSession(session.authenticated === true);
    setIsAdmin(session.isPlatformAdmin === true);
    setClinicIdState(session.clinicId ?? null);

    const meRes = await fetch('/api/auth/me', { credentials: 'include' });
    if (!meRes.ok) {
      setProfile(null);
      return;
    }

    const me = await meRes.json();
    setProfile(toResourceLikeProfile(me));
  };

  const persistClinicId = async (nextClinicId: string | null) => {
    setClinicIdState(nextClinicId);
    try {
      const accessToken = medplum.getAccessToken();
      await fetch('/api/auth/medplum-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, clinicId: nextClinicId }),
      });
    } catch (error) {
      console.warn('Warning: Failed to persist clinicId to session cookie:', error);
    }
  };

  // Restore session from MedplumClient internal storage on mount
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await hydrateFromServerSession();
      } catch {
        if (!cancelled) {
          setProfile(null);
          setHasSession(false);
          setIsAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [medplum]);

  const signIn = async (
    email: string,
    password: string,
    nextPath?: string | null
  ): Promise<{ isAdmin: boolean; homeUrl?: string; clinicId?: string | null }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          next: nextPath || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Login failed');
      }

      await hydrateFromServerSession();

      return {
        isAdmin: payload.isAdmin === true,
        homeUrl: typeof payload.redirectUrl === 'string' ? payload.redirectUrl : undefined,
        clinicId: typeof payload.clinicId === 'string' ? payload.clinicId : null,
      };
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const signOut = async () => {
    try {
      setProfile(null);
      setHasSession(false);
      setIsAdmin(false);
      setClinicIdState(null);
      await fetch('/api/auth/medplum-session', { method: 'DELETE' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getAccessToken = () => medplum.getAccessToken();

  const value: MedplumAuthContextType = {
    medplum,
    profile,
    loading,
    isAuthenticated: hasSession,
    userLabel: getProfileLabel(profile),
    isAdmin,
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

export function useClinic() {
  const { clinicId, setClinicId } = useMedplumAuth();
  return { clinicId, setClinicId };
}
