export type HostContext =
  | { type: 'admin' }
  | { type: 'clinic'; clinicId: string }
  | { type: 'none' };

export function deriveHostContext(host: string | null, baseDomain?: string): HostContext {
  if (!host) {
    return { type: 'none' };
  }

  const hostname = host.split(':')[0];

  if (hostname.startsWith('localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { type: 'none' };
  }

  const parts = hostname.split('.');
  if (parts.length < 3) {
    return { type: 'none' };
  }

  const [subdomain, ...rest] = parts;

  if (baseDomain) {
    const normalizedBase = baseDomain.replace(/^\./, '');
    if (rest.join('.') !== normalizedBase) {
      return { type: 'none' };
    }
  }

  if (subdomain === 'admin') {
    return { type: 'admin' };
  }

  if (['www', 'app', 'auth'].includes(subdomain)) {
    return { type: 'none' };
  }

  return { type: 'clinic', clinicId: subdomain };
}

export function isBaseDomainHost(host: string | null, baseDomain?: string): boolean {
  if (!host) {
    return false;
  }

  const hostname = host.split(':')[0];

  if (hostname.startsWith('localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  if (baseDomain) {
    return hostname === baseDomain.replace(/^\./, '');
  }

  return hostname.split('.').length === 2;
}
