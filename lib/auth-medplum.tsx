"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { MedplumClient } from '@medplum/core';
import type { Resource } from '@medplum/fhirtypes';

const MEDPLUM_BASE_URL = process.env.NEXT_PUBLIC_MEDPLUM_BASE_URL || 'http://localhost:8103';
const MEDPLUM_CLIENT_ID = process.env.NEXT_PUBLIC_MEDPLUM_CLIENT_ID || '';
interface MedplumAuthContextType {
  medplum: MedplumClient;
  profile: Resource | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  clinicId: string | null;
  signIn: (email: string, password: string) => Promise<{ isAdmin: boolean }>;
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
      setIsAdmin(false);
    },
  }));

  const [profile, setProfile] = useState<Resource | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicIdState] = useState<string | null>(null);

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

  // Keep the server-side session cookie in sync with the client-side access
  // token. MedplumClient manages its own token refresh via localStorage; when
  // it refreshes (typically at ~55 min for a 1-hour token), we need to push
  // the new token back to the httpOnly cookie so server routes keep working.
  useEffect(() => {
    const syncServerCookie = async () => {
      const token = medplum.getAccessToken();
      if (!token) return;
      try {
        await fetch('/api/auth/medplum-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token }),
        });
      } catch {
        // Non-fatal — cookie will eventually expire naturally
      }
    };

    // Sync immediately on mount (picks up any token that was refreshed while
    // the tab was in the background)
    syncServerCookie();

    // Re-sync every 10 minutes so the server cookie is always within 10
    // minutes of the latest client-side token.
    const syncInterval = setInterval(syncServerCookie, 10 * 60 * 1000);
    return () => clearInterval(syncInterval);
  }, [medplum]);

  // Restore session from MedplumClient internal storage on mount
  useEffect(() => {
    // Read clinic from cookie (set by middleware)
    const clinicCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('medplum-clinic='))
      ?.split('=')[1];
    if (clinicCookie) setClinicIdState(decodeURIComponent(clinicCookie));

    // MedplumClient persists its own session via @medplum:* localStorage keys
    medplum.getProfileAsync()
      .then(async (p) => {
        if (p) {
          setProfile(p as Resource);
          try {
            const me = await medplum.get('auth/me');
            setIsAdmin(me?.membership?.admin === true);
          } catch {
            setIsAdmin(false);
          }
        }
      })
      .catch(() => {
        setProfile(null);
        setIsAdmin(false);
      })
      .finally(() => setLoading(false));
  }, [medplum]);

  const signIn = async (email: string, password: string): Promise<{ isAdmin: boolean }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`${payload?.code || 'AUTH_UNKNOWN'}: ${payload?.error || 'Login failed.'}`);
      }

      const accessToken = payload?.accessToken;
      if (typeof accessToken !== 'string' || !accessToken) {
        throw new Error('AUTH_CONFIG: Login succeeded but no session was created.');
      }

      medplum.setAccessToken(accessToken);

      try {
        const maybeProfile = await medplum.getProfileAsync();
        if (maybeProfile) setProfile(maybeProfile as Resource);
      } catch {
        setProfile(null);
      }

      const adminStatus = payload?.isAdmin === true;
      setIsAdmin(adminStatus);

      if (typeof payload?.clinicId === 'string' || payload?.clinicId === null) {
        setClinicIdState(payload.clinicId ?? null);
      }

      return { isAdmin: adminStatus };
    } catch (error: any) {
      throw classifyAuthError(error);
    }
  };

  const signOut = async () => {
    try {
      medplum.signOut();
      setProfile(null);
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
    isAuthenticated: profile !== null,
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

// ── Error classification ────────────────────────────────────────────────────

/**
 * Maps low-level fetch / auth errors to clear, user-facing messages.
 * Distinguishes network/server issues from wrong credentials so the UI can
 * show the right guidance instead of a single "Invalid email or password."
 */
function classifyAuthError(error: unknown): Error {
  const msg =
    error instanceof Error ? error.message : String(error ?? '');
  const lower = msg.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('cors')
  ) {
    return new Error(
      'AUTH_NETWORK: Unable to reach the authentication server. ' +
      'Check your internet connection or contact support.'
    );
  }

  if (
    lower.includes('401') ||
    lower.includes('invalid') ||
    lower.includes('unauthorized') ||
    lower.includes('bad credentials') ||
    lower.includes('incorrect password') ||
    lower.includes('auth_credentials')
  ) {
    return new Error('AUTH_CREDENTIALS: Incorrect email or password. Please try again.');
  }

  if (
    lower.includes('auth_clinic_required') ||
    lower.includes('auth_clinic_forbidden') ||
    lower.includes('not assigned to clinic') ||
    lower.includes('multiple clinics')
  ) {
    return new Error(
      'AUTH_CLINIC: This account must sign in from the correct clinic subdomain.'
    );
  }

  if (lower.includes('auth_forbidden')) {
    return new Error(
      'AUTH_FORBIDDEN: Your account does not have access to this area.'
    );
  }

  if (lower.includes('no access token')) {
    return new Error(
      'AUTH_CONFIG: Login completed but no session was created. ' +
      'This is usually a server configuration issue — please contact support.'
    );
  }

  return new Error(`AUTH_UNKNOWN: ${msg || 'An unexpected error occurred. Please try again.'}`);
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
