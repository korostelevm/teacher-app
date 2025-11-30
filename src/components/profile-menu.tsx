"use client";

import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface User {
  displayName: string;
  email: string;
  photo?: string;
}

export function ProfileMenu({ user }: { user: User | null }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const initials = user.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 hover:bg-secondary rounded-lg transition"
      >
        <Avatar className="h-8 w-8">
          {user.photo && <AvatarImage src={user.photo} alt={user.displayName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-secondary border border-border rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10">
              {user.photo && <AvatarImage src={user.photo} alt={user.displayName} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded transition"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

