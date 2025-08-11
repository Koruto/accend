'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, signup, me } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BackgroundBeams } from '@/components/ui/background-beams';

type Mode = 'login' | 'signup';
const CATEGORIES = [
  { value: 'developer', label: 'Developer' },
  { value: 'qa', label: 'QA Engineer' },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]['value'];

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-svh flex items-center justify-center">Loading…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = useMemo(() => search.get('redirect') || '/dashboard', [search]);

  const [mode, setMode] = useState<Mode>('login');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await me();
        if (!cancelled && data.user) router.replace('/dashboard');
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // New role selection UX
  const [roleType, setRoleType] = useState<'requestor' | 'admin'>('requestor');
  const [category, setCategory] = useState<CategoryValue>('developer');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        const role = roleType === 'admin' ? 'admin' : category;
        await signup({ name, email, password, role: role as 'developer' | 'qa' | 'admin' });
      }
      router.push(redirectTo);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-svh flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <BackgroundBeams className="-z-10" />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex text-primary-foreground items-center gap-2 self-center font-medium">
          <div className="bg-primary flex size-6 items-center justify-center rounded-md">
            A
          </div>
          Accend
        </a>
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-semibold">
              {mode === 'login' ? 'Login' : 'Create account'}
            </h1>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-red-600 text-sm mb-2" role="alert">
                {error}
              </p>
            ) : null}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-1">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {mode === 'signup' && (
                <>
                  <div className="space-y-2">
                    <Label>Account type</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant={roleType === 'requestor' ? 'default' : 'outline'} onClick={() => setRoleType('requestor')}>
                        Requestor
                      </Button>
                      <Button type="button" variant={roleType === 'admin' ? 'default' : 'outline'} onClick={() => setRoleType('admin')}>
                        Admin
                      </Button>
                    </div>
                  </div>

                  {roleType === 'requestor' && (
                    <div className="space-y-1">
                      <Label htmlFor="category">Persona</Label>
                      <Select value={category} onValueChange={(v) => setCategory(v as CategoryValue)}>
                        <SelectTrigger id="category">
                          <SelectValue placeholder="Select persona" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (mode === 'login' ? 'Signing in…' : 'Creating…') : mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>

              <p className="text-sm text-center">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <a
                      href="#signup"
                      className="underline"
                      onClick={(e) => {
                        e.preventDefault();
                        setMode('signup');
                      }}
                    >
                      Sign up
                    </a>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <a
                      href="#login"
                      className="underline"
                      onClick={(e) => {
                        e.preventDefault();
                        setMode('login');
                      }}
                    >
                      Sign in
                    </a>
                  </>
                )}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 