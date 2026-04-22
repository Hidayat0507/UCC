#!/usr/bin/env node
/**
 * Test the patient API endpoint directly
 */

const testPatientData = {
    fullName: "Test Patient",
    nric: "880705-56-5975",
    dateOfBirth: new Date("1988-07-05"),
    gender: "male",
    phone: "+60123456789",
    email: "test@example.com",
    address: "123 Test Street",
    postalCode: "12345",
    emergencyContact: {
        name: "Emergency Contact",
        relationship: "Spouse",
        phone: "+60987654321"
    },
    medicalHistory: {
        allergies: ["Penicillin"],
        conditions: [],
        medications: []
    }
};

async function testAPI() {
    console.log('🧪 Testing Patient API Endpoint...\n');

    try {
        console.log('📤 Sending POST request to /api/patients');
        console.log('Data:', JSON.stringify(testPatientData, null, 2));

        const response = await fetch('http://localhost:3000/api/patients', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPatientData),
        });

        console.log('\n📥 Response Status:', response.status, response.statusText);

        const data = await response.json();
        console.log('Response Data:', JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
            console.log('\n✅ SUCCESS! Patient created with ID:', data.patientId);
        } else {
            console.log('\n❌ FAILED! Error:', data.error);
        }
    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
        console.error('Make sure the dev server is running on http://localhost:3000');
    }
}

testAPI();
