'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CreateMedplumClientPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    clientId?: string;
    clientSecret?: string;
    error?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    medplumUrl: 'http://localhost:8103',
    email: 'dayatfactor@gmail.com',
    password: '',
  });

  const createClient = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Call our server-side API to avoid CORS issues
      const response = await fetch('/api/admin/create-medplum-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medplumUrl: formData.medplumUrl,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create client');
      }

      setResult({
        success: true,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create Medplum ClientApplication</CardTitle>
          <CardDescription>
            Generate client credentials for backend authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="medplumUrl">Medplum URL</Label>
            <Input
              id="medplumUrl"
              value={formData.medplumUrl}
              onChange={(e) => setFormData({ ...formData, medplumUrl: e.target.value })}
              placeholder="http://localhost:8103"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Your Medplum password"
            />
          </div>

          <Button onClick={createClient} disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Create Client Credentials'}
          </Button>

          {result && result.success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-green-900">✅ Client Created!</p>
                  <div className="bg-white p-4 rounded border border-green-200 font-mono text-sm space-y-1">
                    <div>
                      <span className="text-gray-600">MEDPLUM_CLIENT_ID=</span>
                      <span className="select-all">{result.clientId}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">MEDPLUM_CLIENT_SECRET=</span>
                      <span className="select-all">{result.clientSecret}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Copy these to your .env.local and remove the MEDPLUM_EMAIL/PASSWORD lines.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {result && !result.success && (
            <Alert variant="destructive">
              <AlertDescription>
                ❌ Error: {result.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

