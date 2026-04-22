import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/medplum-auth";
import { handleRouteError } from "@/lib/server/route-helpers";

/**
 * Server-side API route to create Medplum ClientApplication
 * This avoids CORS issues by making requests from the server
 */
export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const body = await req.json();
    const { medplumUrl, email, password } = body;

    if (!medplumUrl || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🔐 Logging into Medplum...');

    // Step 1: Login to Medplum
    const loginResp = await fetch(`${medplumUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResp.ok) {
      const errorText = await loginResp.text();
      return NextResponse.json(
        { error: `Login failed: ${errorText}` },
        { status: 400 }
      );
    }

    const loginData = await loginResp.json();
    
    // Handle PKCE flow if needed
    let accessToken = loginData.access_token;
    
    if (!accessToken && loginData.code && loginData.login) {
      console.log('🔄 Exchanging code for token...');
      
      // Exchange code for token
      const tokenResp = await fetch(`${medplumUrl}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: loginData.code,
          code_verifier: loginData.login,
        }).toString(),
      });

      if (tokenResp.ok) {
        const tokenData = await tokenResp.json();
        accessToken = tokenData.access_token;
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Could not get access token' },
        { status: 400 }
      );
    }

    console.log('✅ Authenticated');

    // Step 2: Get user profile to find project ID
    const profileResp = await fetch(`${medplumUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResp.ok) {
      return NextResponse.json(
        { error: 'Could not get user profile' },
        { status: 400 }
      );
    }

    const profile = await profileResp.json();
    const projectId = profile.project?.id;

    if (!projectId) {
      return NextResponse.json(
        { error: 'No project ID found in profile' },
        { status: 400 }
      );
    }

    console.log(`✅ Project ID: ${projectId}`);

    // Step 3: Create ClientApplication
    const clientResp = await fetch(`${medplumUrl}/admin/projects/${projectId}/client`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'EMR Backend Client',
        description: 'Server-to-server authentication for EMR backend',
      }),
    });

    if (!clientResp.ok) {
      const errorText = await clientResp.text();
      return NextResponse.json(
        { error: `Failed to create client: ${errorText}` },
        { status: 400 }
      );
    }

    const client = await clientResp.json();

    console.log('✅ ClientApplication created!');

    return NextResponse.json({
      success: true,
      clientId: client.id,
      clientSecret: client.secret,
    });

  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/create-medplum-client');
  }
}









