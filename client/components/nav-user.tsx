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

export function NavUser() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-2 text-left outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{user?.name ?? "User"}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-56">
          <DropdownMenuLabel className="text-xs">Signed in as</DropdownMenuLabel>
          <div className="px-2 pb-2 text-sm">
            <div className="truncate font-medium">{user?.name ?? "User"}</div>
            <div className="truncate text-muted-foreground">{user?.email ?? ""}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>Profile</DropdownMenuItem>
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

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.name ?? 'User'}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email ?? ''}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 