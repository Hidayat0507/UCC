import { unstable_cache } from 'next/cache';
import { env } from '@/lib/env';
import { MedplumClient } from '@medplum/core';

/**
 * Returns true if an Organization with identifier `clinic|<subdomain>`
 * exists in Medplum. Result is cached for 5 minutes per subdomain so
 * this check adds no meaningful overhead to page loads.
 *
 * Falls back to `true` (allow) when admin credentials are absent, so
 * a misconfigured admin secret does not break every page load.
 */
export const clinicExists = unstable_cache(
  async (subdomain: string): Promise<boolean> => {
    const { MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET, MEDPLUM_BASE_URL } = env;

    if (!MEDPLUM_CLIENT_ID || !MEDPLUM_CLIENT_SECRET) {
      // Can't validate without admin credentials — allow through
      return true;
    }

    try {
      const medplum = new MedplumClient({
        baseUrl: MEDPLUM_BASE_URL,
        clientId: MEDPLUM_CLIENT_ID,
        clientSecret: MEDPLUM_CLIENT_SECRET,
      });
      await medplum.startClientLogin(MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET);

      const orgs = await medplum.searchResources('Organization', {
        identifier: `clinic|${subdomain}`,
        _count: '1',
      });

      return (orgs?.length ?? 0) > 0;
    } catch {
      // Network/auth failure — allow through rather than blocking all users
      return true;
    }
  },
  ['clinic-exists'],
  { revalidate: 300 } // 5-minute cache per subdomain
);
