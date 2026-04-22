#!/usr/bin/env tsx
/**
 * Test script to debug patient registration
 */

import { MedplumClient } from '@medplum/core';
import type { Patient as FHIRPatient } from '@medplum/fhirtypes';

const MEDPLUM_BASE_URL = process.env.MEDPLUM_BASE_URL || 'http://localhost:8103';
const MEDPLUM_CLIENT_ID = process.env.MEDPLUM_CLIENT_ID;
const MEDPLUM_CLIENT_SECRET = process.env.MEDPLUM_CLIENT_SECRET;


async function testPatientCreation() {
    console.log('🔍 Testing Patient Registration...\n');

    // Check environment variables
    console.log('📋 Environment Check:');
    console.log(`   MEDPLUM_BASE_URL: ${MEDPLUM_BASE_URL}`);
    console.log(`   MEDPLUM_CLIENT_ID: ${MEDPLUM_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`   MEDPLUM_CLIENT_SECRET: ${MEDPLUM_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}\n`);

    if (!MEDPLUM_CLIENT_ID || !MEDPLUM_CLIENT_SECRET) {
        console.error('❌ Missing Medplum credentials in .env.local');
        console.log('\nRequired variables:');
        console.log('  - MEDPLUM_CLIENT_ID');
        console.log('  - MEDPLUM_CLIENT_SECRET');
        console.log('  - MEDPLUM_BASE_URL (optional, defaults to http://localhost:8103)');
        process.exit(1);
    }

    try {
        // Initialize Medplum client
        console.log('🔐 Authenticating with Medplum...');
        const medplum = new MedplumClient({
            baseUrl: MEDPLUM_BASE_URL,
            clientId: MEDPLUM_CLIENT_ID,
            clientSecret: MEDPLUM_CLIENT_SECRET,
        });

        await medplum.startClientLogin(MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET);
        console.log('✅ Authentication successful\n');

        // Create test patient
        console.log('👤 Creating test patient...');
        const testPatient: FHIRPatient = {
            resourceType: 'Patient',
            identifier: [
                { system: 'nric', value: '880705-56-5975' },
            ],
            name: [
                {
                    text: 'Test Patient',
                    family: 'Patient',
                    given: ['Test'],
                },
            ],
            birthDate: '1988-07-05',
            gender: 'male',
            telecom: [
                { system: 'phone', value: '+60123456789' },
                { system: 'email', value: 'test@example.com' },
            ],
            address: [
                {
                    text: '123 Test Street',
                    postalCode: '12345',
                },
            ],
        };

        const savedPatient = await medplum.createResource(testPatient);
        console.log('✅ Patient created successfully!');
        console.log(`   Patient ID: ${savedPatient.id}`);
        console.log(`   Name: ${savedPatient.name?.[0]?.text}`);
        console.log(`   NRIC: ${savedPatient.identifier?.[0]?.value}\n`);

        // Verify patient can be retrieved
        console.log('🔍 Verifying patient retrieval...');
        const retrievedPatient = await medplum.readResource('Patient', savedPatient.id!);
        console.log('✅ Patient retrieved successfully!');
        console.log(`   Retrieved ID: ${retrievedPatient.id}`);
        console.log(`   Retrieved Name: ${retrievedPatient.name?.[0]?.text}\n`);

        console.log('✅ All tests passed! Patient registration is working correctly.');
        console.log('\n💡 If the web form is not working, check:');
        console.log('   1. Browser console for errors');
        console.log('   2. Network tab for failed API requests');
        console.log('   3. Server logs (npm run dev output)');
        console.log('   4. Ensure the API route is being called correctly');

    } catch (error: any) {
        console.error('\n❌ Test failed with error:');
        console.error(error.message);
        if (error.outcome) {
            console.error('\nFHIR Outcome:', JSON.stringify(error.outcome, null, 2));
        }
        console.error('\nFull error:', error);
        process.exit(1);
    }
}

testPatientCreation();
