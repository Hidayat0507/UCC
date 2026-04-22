#!/usr/bin/env node

/**
 * Seed one test patient to verify Medplum-first flow
 * This uses Firebase Admin SDK to bypass auth requirements
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountBase64) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT not found in environment');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountBase64, 'base64').toString('utf8')
);

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function createTestPatient() {
  console.log('🧪 Creating Test Patient (Medplum-First)\n');
  console.log('==========================================\n');

  const patientData = {
    fullName: 'Ahmed TestPatient',
    nric: '880808-08-8888',
    dateOfBirth: new Date('1988-08-08'),
    gender: 'male',
    email: 'ahmed.test@example.com',
    phone: '+60199999999',
    address: '789 Test Road',
    postalCode: '43000',
    emergencyContact: {
      name: 'Sara TestContact',
      relationship: 'Wife',
      phone: '+60188888888',
    },
    medicalHistory: {
      allergies: [],
      conditions: [],
      medications: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    console.log('📝 Patient details:');
    console.log(`   Name: ${patientData.fullName}`);
    console.log(`   NRIC: ${patientData.nric}`);
    console.log(`   Phone: ${patientData.phone}\n`);

    // This will trigger the Medplum-first logic in createPatient
    // But we need to call it through the app's API, not directly
    
    console.log('⚠️  Note: Direct seeding bypasses the Medplum-first logic');
    console.log('   The createPatient() function needs to run in the Next.js context\n');
    
    // Save to Firestore directly (old way) for now
    const docRef = await db.collection('patients').add({
      ...patientData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ Patient created in Firestore: ' + docRef.id);
    console.log('⚠️  NOT exported to Medplum (would need EMR app context)\n');
    console.log('To test Medplum-first properly:');
    console.log('1. Open: http://localhost:3000/patients/new');
    console.log('2. Create a patient through the UI');
    console.log('3. Check console for Medplum export logs\n');
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createTestPatient()
  .then(() => {
    console.log('✅ Done!\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });









