'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout, me } from '@/lib/auth';
import type { PublicUser } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { RequestAccessDialog } from '@/components/requester/request-access-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useQuery } from '@apollo/client';
import { RESOURCES_QUERY, MY_REQUESTS_QUERY } from '@/lib/gql';

interface ResourceEntry {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

interface RequestEntry {
  id: string;
  userId: string;
  resourceId: string;
  resourceType: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  justification: string;
  createdAt: string;
  durationHours?: number | null;
  approvedAt?: string | null;
  expiresAt?: string | null;
  approverId?: string | null;
  approverName?: string | null;
  decisionNote?: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: resourcesData } = useQuery<{ resources: ResourceEntry[] }>(RESOURCES_QUERY);
  const { data: requestsData, loading: requestsLoading } = useQuery<{ myRequests: RequestEntry[] }>(MY_REQUESTS_QUERY, { fetchPolicy: 'no-cache' });

  const resources = resourcesData?.resources ?? [];
  const requests = requestsData?.myRequests ?? [];

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

  const now = useMemo(() => new Date(), []);

  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('30d');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<RequestEntry['status']>>(new Set());
  const [selectedType, setSelectedType] = useState<string>('all');
  const [keyword, setKeyword] = useState('');

  const uniqueTypes = useMemo(() => Array.from(new Set(requests.map((r) => r.resourceType))), [requests]);

  function toggleStatus(s: RequestEntry['status']) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function resetFilters() {
    setDateRange('30d');
    setSelectedStatuses(new Set());
    setSelectedType('all');
    setKeyword('');
  }

  const filteredRequests = useMemo(() => {
    let start: Date | null = null;
    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      start = new Date(now.getTime() - days * 24 * 3600 * 1000);
    }
    const kw = keyword.trim().toLowerCase();

    return requests.filter((r) => {
      const createdAt = new Date(r.createdAt);
      if (start && createdAt < start) return false;
      if (selectedStatuses.size > 0 && !selectedStatuses.has(r.status)) return false;
      if (selectedType !== 'all' && r.resourceType !== selectedType) return false;
      if (kw) {
        const res = resources.find((x) => x.id === r.resourceId);
        const resourceName = res?.name ?? '';
        const hay = [resourceName, r.justification, r.approverName || '', r.decisionNote || '']
          .join(' ')
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [requests, resources, dateRange, selectedStatuses, selectedType, keyword, now]);

  const metrics = useMemo(() => {
    const approvedActive = filteredRequests.filter((r) => r.status === 'approved' && (!r.expiresAt || new Date(r.expiresAt) > now)).length;
    const pending = filteredRequests.filter((r) => r.status === 'pending').length;
    const expiring7d = filteredRequests.filter((r) => r.expiresAt && new Date(r.expiresAt) > now && new Date(r.expiresAt) < new Date(now.getTime() + 7 * 24 * 3600 * 1000)).length;
    const activeLocks = filteredRequests.filter((r) => r.resourceType === 'deployment_env_lock' && r.status === 'approved' && r.expiresAt && new Date(r.expiresAt) > now).length;
    return { approvedActive, pending, expiring7d, activeLocks };
  }, [filteredRequests, now]);

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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
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
              <RequestAccessDialog />
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Date range</label>
                <Select value={dateRange} onValueChange={(v) => setDateRange(v as 'all' | '7d' | '30d' | '90d')}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Resource type</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {uniqueTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Keyword</label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="h-8"
                  placeholder="Search resource, justification, approver, notes"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <div className="flex flex-wrap gap-2">
                  {(['pending', 'approved', 'denied', 'expired'] as RequestEntry['status'][]).map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={selectedStatuses.has(s) ? 'default' : 'outline'}
                      onClick={() => toggleStatus(s)}
                    >
                      {s}
                    </Button>
                  ))}
                  <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                    Clear
                  </Button>
                </div>
              </div>
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
                  {requestsLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Loading…</TableCell>
                    </TableRow>
                  ) : filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No matching requests. Try adjusting your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((r) => {
                      const res = resources.find((x) => x.id === r.resourceId);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap">{res?.name ?? r.resourceId}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.resourceType}</TableCell>
                          <TableCell>{renderStatusBadge(r.status)}</TableCell>
                          <TableCell className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.durationHours ? `${r.durationHours}h` : '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.approverName ?? '—'}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.decisionNote || r.justification}>
                            {r.decisionNote || r.justification}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 