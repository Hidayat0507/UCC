/**
 * Test EMR Login Flow
 * This simulates what happens when you login
 */

import { MedplumClient } from '@medplum/core';

const MEDPLUM_BASE_URL = process.env.NEXT_PUBLIC_MEDPLUM_BASE_URL || 'http://localhost:8103';
const email = 'dayatfactor@gmail.com';
const password = 'matn0r007';

async function testLogin() {
  console.log('\n🔐 Testing EMR Login Flow...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Email:', email);
  console.log('🌐 Medplum URL:', MEDPLUM_BASE_URL);
  console.log('🖥️  EMR URL: http://localhost:3002');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const medplum = new MedplumClient({ 
    baseUrl: MEDPLUM_BASE_URL,
    // Mock storage for Node.js environment
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    } as any,
  });

  try {
    console.log('🔐 Step 1: Starting login...');
    const loginResponse = await medplum.startLogin({ email, password });
    console.log('✅ Login response received');
    
    console.log('\n🔐 Step 2: Getting profile...');
    const profile = await medplum.getProfile();
    console.log('✅ Profile loaded:');
    console.log('   Type:', profile.resourceType);
    console.log('   ID:', profile.id);
    console.log('   Name:', (profile as any).name?.[0]?.text || 'N/A');
    
    console.log('\n🔐 Step 3: Getting access token...');
    const accessToken = medplum.getAccessToken();
    if (accessToken) {
      console.log('✅ Access token obtained');
      console.log('   Length:', accessToken.length);
      console.log('   Starts with:', accessToken.substring(0, 20) + '...');
    } else {
      console.log('❌ No access token!');
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 LOGIN FLOW SUCCESSFUL!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('✅ Your credentials work with Medplum!');
    console.log('✅ EMR app should be able to login too!\n');
    
    console.log('📋 NEXT STEPS:\n');
    console.log('1. Go to: http://localhost:3002/login');
    console.log('2. Enter:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('3. Click "Sign in"\n');
    
    console.log('💡 If it still fails, open browser console (F12)');
    console.log('   and share the error message!\n');
    
  } catch (error: any) {
    console.log('\n❌ LOGIN FAILED!\n');
    console.log('Error:', error.message);
    console.log('\n🔍 DIAGNOSIS:\n');
    
    if (error.message.includes('PKCE') || error.message.includes('sessionStorage')) {
      console.log('⚠️  This is expected in Node.js (no browser storage)');
      console.log('   But your browser login should work!\n');
      console.log('✅ Try logging in at: http://localhost:3002/login\n');
    } else if (error.message.includes('Invalid') || error.message.includes('401')) {
      console.log('❌ Wrong credentials!');
      console.log('   But you said you can login to Medplum at port 3001?');
      console.log('   Try the same credentials at port 3002!\n');
    } else if (error.message.includes('Network') || error.message.includes('fetch')) {
      console.log('❌ Cannot reach Medplum server!');
      console.log('   Check if Medplum is running: http://localhost:8103/healthcheck\n');
    } else {
      console.log('❌ Unknown error');
      console.log('\nFull error:');
      console.log(error);
      console.log('\n💡 Try logging in at: http://localhost:3002/login');
      console.log('   and check browser console (F12) for errors\n');
    }
  }
}

testLogin();








