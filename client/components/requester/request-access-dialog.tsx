"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@apollo/client";
import { CREATE_REQUEST_MUTATION, RESOURCES_QUERY, MY_REQUESTS_QUERY } from "@/lib/gql";

interface ResourceOption {
  id: string;
  name: string;
  type: string;
}

export function RequestAccessDialog() {
  const [open, setOpen] = useState(false);
  const [resourceId, setResourceId] = useState<string>("");
  const [justification, setJustification] = useState("");
  const [duration, setDuration] = useState<string>("");

  const { data, loading: resourcesLoading } = useQuery<{ resources: ResourceOption[] }>(RESOURCES_QUERY);
  const resources = data?.resources ?? [];

  useEffect(() => {
    if (!resourceId && resources.length > 0) {
      setResourceId(resources[0].id);
    }
  }, [resources, resourceId]);

  const [createRequest, { loading: creating }] = useMutation(CREATE_REQUEST_MUTATION, {
    update(cache, { data }) {
      const created = data?.createRequest;
      if (!created) return;
      const existing = cache.readQuery<{ myRequests: any[] }>({ query: MY_REQUESTS_QUERY });
      if (existing?.myRequests) {
        cache.writeQuery({
          query: MY_REQUESTS_QUERY,
          data: { myRequests: [created, ...existing.myRequests] },
        });
      }
    },
  });

  const justificationLen = justification.trim().length;
  const canSubmit = useMemo(() => !!resourceId && justificationLen >= 6, [resourceId, justificationLen]);

  async function handleSubmit() {
    if (!canSubmit) return;
    await createRequest({
      variables: {
        input: {
          resourceId,
          justification,
          durationHours: duration ? Number(duration) : undefined,
        },
      },
    });
    setOpen(false);
    setResourceId("");
    setJustification("");
    setDuration("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Request Access</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Access</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Resource</label>
            {resourcesLoading ? (
              <div className="text-sm text-muted-foreground">Loading resources…</div>
            ) : resources.length === 0 ? (
              <div className="text-sm text-muted-foreground">No resources available. Please contact your manager.</div>
            ) : (
              <Select value={resourceId} onValueChange={setResourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a resource" />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Justification</label>
            <Textarea rows={4} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Why do you need this access?" />
            {justification.length > 0 && justificationLen < 6 ? (
              <div className="text-xs text-rose-600">Please enter at least 6 characters</div>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Duration (hours, optional)</label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration (optional)" />
              </SelectTrigger>
              <SelectContent>
                {["1","2","4","8","24"].map((h) => (
                  <SelectItem key={h} value={h}>{h}h</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!canSubmit || creating} onClick={handleSubmit}>{creating ? 'Submitting…' : 'Submit'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 