/**
 * Practitioner Service - FHIR Practitioner Management
 * 
 * Manages healthcare practitioners in the FHIR system
 */

import { MedplumClient } from '@medplum/core';
import { getAdminMedplum } from '@/lib/server/medplum-admin';
import type { Practitioner } from '@medplum/fhirtypes';
import { applyMyCoreProfile, MY_CORE_IDENTIFIERS } from './mycore';

const getMedplumClient = getAdminMedplum;

/**
 * Get or create a practitioner by user ID
 */
export async function getOrCreatePractitioner(
    userId: string,
    name: string,
    qualification?: string,
    mmcNumber?: string,
): Promise<string> {
    const medplum = await getMedplumClient();

    let practitioner = await medplum.searchOne('Practitioner', {
        identifier: `user|${userId}`,
    });

    if (!practitioner) {
        const identifiers: Practitioner['identifier'] = [
            {
                system: 'user',
                value: userId,
                use: 'official',
            },
        ];
        if (mmcNumber) {
            identifiers.push({
                system: MY_CORE_IDENTIFIERS.MMC_NO,
                value: mmcNumber,
                use: 'official',
                type: {
                    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MD', display: 'Medical License Number' }],
                    text: 'MMC Registration Number',
                },
            });
        }

        practitioner = await medplum.createResource<Practitioner>(applyMyCoreProfile({
            resourceType: 'Practitioner',
            active: true,
            identifier: identifiers,
            name: [
                {
                    text: name,
                    use: 'official',
                },
            ],
            qualification: qualification ? [{
                code: {
                    text: qualification,
                },
            }] : undefined,
        }));

        console.log(`✅ Created Practitioner: ${practitioner.id}`);
    }

    return `Practitioner/${practitioner.id}`;
}

/**
 * Get practitioner by ID
 */
export async function getPractitionerById(practitionerId: string): Promise<Practitioner | null> {
    try {
        const medplum = await getMedplumClient();
        return await medplum.readResource('Practitioner', practitionerId);
    } catch (error) {
        console.error('Failed to get practitioner:', error);
        return null;
    }
}

/**
 * Get all practitioners
 */
export async function getAllPractitioners(): Promise<Practitioner[]> {
    try {
        const medplum = await getMedplumClient();
        return await medplum.searchResources('Practitioner', {
            active: 'true',
            _sort: 'name'
        });
    } catch (error) {
        console.error('Failed to get practitioners:', error);
        return [];
    }
}
