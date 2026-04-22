#!/usr/bin/env bun
/**
 * Quick test to verify Medplum auth is working
 * Run: bun run tests/dev-scripts/quick-medplum-test.ts
 */

import { MedplumClient } from '@medplum/core';

const MEDPLUM_BASE_URL = process.env.MEDPLUM_BASE_URL || 'http://localhost:8103';
const MEDPLUM_CLIENT_ID = process.env.MEDPLUM_CLIENT_ID;
const MEDPLUM_CLIENT_SECRET = process.env.MEDPLUM_CLIENT_SECRET;

async function testMedplumAuth() {
  console.log('🧪 Testing Medplum Authentication...\n');

  // Test 1: Check connection
  console.log('1️⃣  Testing connection to Medplum...');
  try {
    const response = await fetch(`${MEDPLUM_BASE_URL}/healthcheck`);
    if (response.ok) {
      console.log('   ✅ Medplum server is running\n');
    } else {
      console.error('   ❌ Medplum server returned error:', response.status);
      return;
    }
  } catch (error) {
    console.error('   ❌ Cannot connect to Medplum. Is it running?');
    console.error('   Start Medplum: cd ~/Documents/Projects/medplum && docker-compose up -d');
    return;
  }

  // Test 2: Check credentials
  console.log('2️⃣  Testing admin credentials...');
  if (!MEDPLUM_CLIENT_ID || !MEDPLUM_CLIENT_SECRET) {
    console.error('   ❌ Missing MEDPLUM_CLIENT_ID or MEDPLUM_CLIENT_SECRET');
    console.error('   Add these to your .env.local file');
    return;
  }
  console.log('   ✅ Credentials found\n');

  // Test 3: Login
  console.log('3️⃣  Testing admin login...');
  try {
    const medplum = new MedplumClient({
      baseUrl: MEDPLUM_BASE_URL,
      clientId: MEDPLUM_CLIENT_ID,
      clientSecret: MEDPLUM_CLIENT_SECRET,
    });

    await medplum.startClientLogin(MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET);
    const profile = medplum.getProfile();
    console.log('   ✅ Successfully authenticated');
    console.log(`   Profile: ${profile?.resourceType}/${profile?.id}\n`);
  } catch (error: any) {
    console.error('   ❌ Login failed:', error.message);
    return;
  }

  // Test 4: Check Access Policies
  console.log('4️⃣  Checking Access Policies...');
  try {
    const medplum = new MedplumClient({
      baseUrl: MEDPLUM_BASE_URL,
      clientId: MEDPLUM_CLIENT_ID,
      clientSecret: MEDPLUM_CLIENT_SECRET,
    });
    await medplum.startClientLogin(MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET);

    const policies = await medplum.searchResources('AccessPolicy', {
      _count: 100,
    });

    console.log(`   Found ${policies.length} access policies:`);
    policies.forEach((policy: any) => {
      console.log(`   - ${policy.name} (${policy.id})`);
    });
    console.log('');
  } catch (error: any) {
    console.error('   ❌ Failed to fetch policies:', error.message);
  }

  // Test 5: Check Practitioners
  console.log('5️⃣  Checking Practitioners...');
  try {
    const medplum = new MedplumClient({
      baseUrl: MEDPLUM_BASE_URL,
      clientId: MEDPLUM_CLIENT_ID,
      clientSecret: MEDPLUM_CLIENT_SECRET,
    });
    await medplum.startClientLogin(MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET);

    const practitioners = await medplum.searchResources('Practitioner', {
      _count: 10,
    });

    console.log(`   Found ${practitioners.length} practitioners:`);
    practitioners.forEach((prac: any) => {
      console.log(`   - ${prac.name?.[0]?.text || 'Unknown'} (${prac.id})`);
    });
    console.log('');
  } catch (error: any) {
    console.error('   ❌ Failed to fetch practitioners:', error.message);
  }

  // Test 6: Check Users
  console.log('6️⃣  Checking Users...');
  try {
    const medplum = new MedplumClient({
      baseUrl: MEDPLUM_BASE_URL,
      clientId: MEDPLUM_CLIENT_ID,
      clientSecret: MEDPLUM_CLIENT_SECRET,
    });
    await medplum.startClientLogin(MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET);

    const users = await medplum.searchResources('User', {
      _count: 10,
    });

    console.log(`   Found ${users.length} users:`);
    users.forEach((user: any) => {
      console.log(`   - ${user.email || 'No email'} (${user.id})`);
    });
    console.log('');
  } catch (error: any) {
    console.error('   ⚠️  Failed to fetch users (may require higher permissions):', error.message);
    console.log('');
  }

  console.log('✅ Medplum auth test complete!\n');
  console.log('📋 Next steps:');
  console.log('1. If no access policies found, run: bun run scripts/setup-medplum-access-policies.ts');
  console.log('2. If no practitioners found, run: bun run scripts/migrate-firebase-users-to-medplum.ts');
  console.log('3. Create user accounts in Medplum UI: http://localhost:3001');
  console.log('4. Test login at: http://localhost:3000/login');
}

testMedplumAuth().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
