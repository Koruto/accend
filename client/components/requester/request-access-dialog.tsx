"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ResourceOption {
  id: string;
  name: string;
  type: string;
}

export function RequestAccessDialog() {
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [resourceId, setResourceId] = useState<string>("");
  const [justification, setJustification] = useState("");
  const [duration, setDuration] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/data/resources.local.json', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) {
          setResources((json.resources || []).map((r: any) => ({ id: r.id, name: r.name, type: r.type })));
        }
      } catch {}
    })();
    return () => { cancelled = true };
  }, []);

  const canSubmit = useMemo(() => resourceId && justification.trim().length > 5, [resourceId, justification]);

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
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Justification</label>
            <Textarea rows={4} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Why do you need this access?" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Duration (hours, optional)</label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration (optional)" />
              </SelectTrigger>
              <SelectContent>
                {['1','2','4','8','24'].map((h) => (
                  <SelectItem key={h} value={h}>{h}h</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={() => setOpen(false)}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 