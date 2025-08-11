"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PublicUser } from "@/types/auth";
import { logout, me } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation } from "@apollo/client";
import { UPDATE_ME_NAME } from "@/lib/gql";

export function NavUser() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [updateName] = useMutation(UPDATE_ME_NAME);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await me();
        if (!cancelled) setUser(data.user);
      } catch {}
    })();
    return () => { cancelled = true };
  }, []);

  const initials = user?.name
    ? user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")
    : "U";

  const accountType = user?.role === 'admin' ? 'Admin' : 'Requestor';
  const category = user?.role === 'admin' ? '—' : user?.role === 'developer' ? 'Developer' : user?.role === 'qa' ? 'QA Engineer' : '—';
  const accessLevelLabel = user ? `${user.accessLevel} / 5` : '—';

  function handleOpenChange(open: boolean) {
    setProfileOpen(open);
    if (!open) {
      setEditing(false);
      setNameDraft(user?.name ?? "");
      setError("");
      setSaving(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-2 text-left outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <Avatar className="size-6">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{user?.name ?? "User"}</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-56">
          <DropdownMenuLabel className="text-xs">Signed in as</DropdownMenuLabel>
          <div className="px-2 pb-2 text-sm">
            <div className="truncate font-medium">{user?.name ?? "User"}</div>
            <div className="truncate text-muted-foreground">{user?.email ?? ""}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setNameDraft(user?.name ?? ""); setError(""); setEditing(false); setProfileOpen(true); }}>Profile</DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              await logout();
              window.location.href = '/login';
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={profileOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center text-center gap-3">
            <Avatar className="size-20">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Name</div>
            <div className="text-right">
              {editing ? (
                <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="h-8" placeholder="Enter your name" />
              ) : (
                <span>{user?.name ?? 'User'}</span>
              )}
            </div>
            <div className="text-muted-foreground">Email</div>
            <div className="text-right">{user?.email ?? ''}</div>
            <div className="text-muted-foreground">Role</div>
            <div className="text-right">{accountType}</div>
            <div className="text-muted-foreground">Category</div>
            <div className="text-right">{category}</div>
            <div className="text-muted-foreground">Access level</div>
            <div className="text-right">{accessLevelLabel}</div>
          </div>
          {error ? <div className="mt-2 text-xs text-rose-600">{error}</div> : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            {!editing ? (
              <>
                <Button variant="outline" onClick={() => handleOpenChange(false)} className="cursor-pointer">Close</Button>
                <Button
                  className="bg-accend-primary text-white hover:bg-accend-primary hover:opacity-90 cursor-pointer"
                  onClick={() => { setEditing(true); setNameDraft(user?.name ?? ""); }}
                >
                  Edit
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setEditing(false); setNameDraft(user?.name ?? ""); setError(""); }} className="cursor-pointer">Cancel</Button>
                <Button
                  className="bg-accend-primary text-white hover:bg-accend-primary hover:opacity-90 cursor-pointer"
                  disabled={saving || !nameDraft.trim() || nameDraft.trim().length < 2}
                  onClick={async () => {
                    setError("");
                    setSaving(true);
                    try {
                      const res = await updateName({ variables: { name: nameDraft.trim() } });
                      const updated = res?.data?.updateMeName as PublicUser | undefined;
                      if (updated) setUser(updated);
                      setEditing(false);
                    } catch (e: any) {
                      setError(e?.message || 'Failed to save');
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Save
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 