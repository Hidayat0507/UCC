"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

type AuthMeResponse = {
  authenticated: boolean;
  isAdmin: boolean;
  profile: Resource | null;
};

/** Align with lib/server/subdomain-host (host-derived; no cookie forgery for subdomain). */
function clinicIdFromBrowserHostname(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN || '';
  if (host.startsWith('localhost') || /^\d{1,3}(\.\d{1,3}){3}/.test(host)) {
    return null;
  }
  const parts = host.split('.');
  if (parts.length < 3) return null;
  const [sub, ...rest] = parts;
  if (base && rest.join('.') !== base) return null;
  if (sub === 'admin') return null;
  if (['www', 'app', 'auth'].includes(sub)) return null;
  return sub;
}

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

  const refreshAuthState = useCallback(async (): Promise<AuthMeResponse> => {
    const [sessionRes, authMeRes] = await Promise.all([
      fetch('/api/auth/medplum-session', { credentials: 'include' }),
      fetch('/api/auth/me', { credentials: 'include' }),
    ]);

    const sessionPayload = sessionRes.ok
      ? await sessionRes.json().catch(() => ({}))
      : {};

    const accessToken = sessionPayload?.accessToken;
    if (typeof accessToken === 'string' && accessToken) {
      medplum.setAccessToken(accessToken);
    }

    if (typeof sessionPayload?.clinicId === 'string' || sessionPayload?.clinicId === null) {
      setClinicIdState(sessionPayload?.clinicId ?? null);
    }

    if (!authMeRes.ok) {
      setProfile(null);
      setIsAdmin(false);
      return { authenticated: false, isAdmin: false, profile: null };
    }

    const authMePayload = await authMeRes.json().catch(() => ({}));
    const nextProfile =
      authMePayload?.profile && typeof authMePayload.profile === 'object'
        ? (authMePayload.profile as Resource)
        : null;
    const nextIsAdmin = authMePayload?.isAdmin === true;

    setProfile(nextProfile);
    setIsAdmin(nextIsAdmin);

    return {
      authenticated: nextProfile !== null,
      isAdmin: nextIsAdmin,
      profile: nextProfile,
    };
  }, [medplum]);

  const persistClinicId = async (nextClinicId: string | null) => {
    setClinicIdState(nextClinicId);
    try {
      const accessToken = medplum.getAccessToken();
      await fetch('/api/auth/medplum-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, clinicId: nextClinicId }),
      });
    } catch (error) {
      console.warn('Warning: Failed to persist clinicId to session cookie:', error);
    }
  };

  // Periodically push MedplumClient token (incl. after silent refresh) to the
  // httpOnly cookie so server routes stay authorized. Initial mount sync runs
  // in the effect below *before* refreshAuthState to avoid racing /api/* calls.
  useEffect(() => {
    const syncServerCookie = async () => {
      const token = medplum.getAccessToken();
      if (!token) return;
      try {
        await fetch('/api/auth/medplum-session', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token }),
        });
      } catch {
        // Non-fatal — cookie will eventually expire naturally
      }
    };

    const syncInterval = setInterval(syncServerCookie, 10 * 60 * 1000);
    return () => clearInterval(syncInterval);
  }, [medplum]);

  // Restore session from MedplumClient internal storage on mount
  useEffect(() => {
    const fromHost = clinicIdFromBrowserHostname();
    if (fromHost) {
      setClinicIdState(fromHost);
    } else {
      const clinicCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('medplum-clinic='))
        ?.split('=')[1];
      if (clinicCookie) setClinicIdState(decodeURIComponent(clinicCookie));
    }

    let cancelled = false;

    (async () => {
      // Server API routes read the httpOnly cookie. MedplumClient may already
      // have a valid token in localStorage before the cookie is written — sync
      // first so the first /api/patients (etc.) from child components succeeds.
      try {
        const token = medplum.getAccessToken();
        if (token) {
          await fetch('/api/auth/medplum-session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token }),
          });
        }
      } catch {
        // non-fatal
      }

      if (cancelled) return;

      await refreshAuthState()
        .catch(() => {
          setProfile(null);
          setIsAdmin(false);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [medplum, refreshAuthState]);

  const signIn = async (email: string, password: string): Promise<{ isAdmin: boolean }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`${payload?.code || 'AUTH_UNKNOWN'}: ${payload?.error || 'Login failed.'}`);
      }

      const sessionState = await refreshAuthState();
      if (!sessionState.authenticated) {
        throw new Error('AUTH_CONFIG: Login succeeded but no session was created.');
      }

      const adminStatus = payload?.isAdmin === true || sessionState.isAdmin === true;

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
      await fetch('/api/auth/medplum-session', { method: 'DELETE', credentials: 'include' });
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
