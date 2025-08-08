'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout, me } from '@/lib/auth';
import type { PublicUser } from '@/types/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await me();
        if (!cancelled) setUser(data.user);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Card>
          <CardHeader>
            <p className="font-medium">Session</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : user ? (
              <div className="space-y-1">
                <p>
                  Signed in as <span className="font-medium">{user.name}</span>
                </p>
                <p className="text-sm text-gray-600">Role: {user.role}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-red-600">Not authenticated</p>
                <a className="underline" href="/login">
                  Go to login
                </a>
              </div>
            )}
            {error ? (
              <p className="text-red-600 text-sm mt-2" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Button onClick={handleLogout}>Sign out</Button>
        </div>
      </div>
    </main>
  );
} 