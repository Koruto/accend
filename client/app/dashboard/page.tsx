'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout, me } from '@/lib/auth';
import type { PublicUser } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface ResourceEntry {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

interface RequestEntry {
  id: string;
  resourceId: string;
  resourceName: string;
  type:
    | 'deployment_env_lock'
    | 'feature_flag_change'
    | 'db_readonly'
    | 'dwh_dataset_viewer'
    | 'cloud_console_role'
    | 'object_store_write_window'
    | 'k8s_namespace_access'
    | 'secrets_read'
    | 'github_repo_permission'
    | 'cicd_bypass'
    | 'monitoring_edit'
    | 'logging_query';
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestedAt: string;
  durationHours: number;
  expiresAt: string | null;
  approver: string | null;
  decisionNote: string | null;
  justification: string;
  approvedAt?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [resources, setResources] = useState<ResourceEntry[]>([]);
  const [requests, setRequests] = useState<RequestEntry[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resRes = await fetch('/data/resources.local.json', { cache: 'no-store' });
        const resJson = (await resRes.json()) as { resources: ResourceEntry[] };
        const reqRes = await fetch('/data/my_requests.local.json', { cache: 'no-store' });
        const reqJson = (await reqRes.json()) as { requests: RequestEntry[] };
        if (!cancelled) {
          setResources(resJson.resources || []);
          setRequests(reqJson.requests || []);
        }
      } catch {
        // ignore prototype data load errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = useMemo(() => new Date(), []);

  const metrics = useMemo(() => {
    const approvedActive = requests.filter((r) => r.status === 'approved' && (!r.expiresAt || new Date(r.expiresAt) > now)).length;
    const pending = requests.filter((r) => r.status === 'pending').length;
    const expiring7d = requests.filter((r) => r.expiresAt && new Date(r.expiresAt) > now && new Date(r.expiresAt) < new Date(now.getTime() + 7 * 24 * 3600 * 1000)).length;
    const activeLocks = requests.filter((r) => r.type === 'deployment_env_lock' && r.status === 'approved' && r.expiresAt && new Date(r.expiresAt) > now).length;
    return { approvedActive, pending, expiring7d, activeLocks };
  }, [requests, now]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  }

  function renderStatusBadge(status: RequestEntry['status']) {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-100 text-emerald-700 border-transparent">approved</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 border-transparent">pending</Badge>;
      case 'denied':
        return <Badge className="bg-rose-100 text-rose-700 border-transparent">denied</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-transparent">expired</Badge>;
    }
  }

  return (
    <main className="min-h-screen flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {user ? (
            <span className="text-sm text-muted-foreground">{user.name}</span>
          ) : null}
          <Button variant="outline" onClick={handleLogout}>Sign out</Button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Accesses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.approvedActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expiring in 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.expiring7d}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Deployment Locks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.activeLocks}</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">My Requests</h2>
          <Button>Request Access</Button>
        </div>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested On</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Expires At</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No requests yet. Create your first access request.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.resourceName}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.type}</TableCell>
                    <TableCell>{renderStatusBadge(r.status)}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(r.requestedAt).toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.durationHours ? `${r.durationHours}h` : '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.approver ?? '—'}</TableCell>
                    <TableCell className="max-w-[320px] truncate" title={r.decisionNote || r.justification}>
                      {r.decisionNote || r.justification}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
} 