"use client";

import Link from "next/link";
import { ROLES } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";
import { usePhase } from "@/lib/phase-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, Menu, PanelLeftClose, User } from "lucide-react";

const ALL_PHASES_VALUE = "__all__";

export function Navbar({
  session,
  sidebarOpen,
  onSidebarToggle,
}: {
  session: SessionUser;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
}) {
  const { phases, selectedPhase, setSelectedPhase, loading } = usePhase();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const phaseValue = selectedPhase ?? ALL_PHASES_VALUE;

  return (
    <header
      className="flex h-14 w-full shrink-0 items-center justify-between border-b border-border bg-card px-4"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSidebarToggle}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
        <Link
          href="/"
          className="font-semibold tracking-tight text-foreground hover:opacity-80"
        >
          Nexium OS
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {!loading && (
          <Select
            value={phaseValue}
            onValueChange={(v) =>
              setSelectedPhase(v === ALL_PHASES_VALUE ? null : v)
            }
          >
            <SelectTrigger
              className="w-[130px] border-border bg-background"
              aria-label="Select phase"
            >
              <SelectValue placeholder="Phase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PHASES_VALUE}>All phases</SelectItem>
              {phases.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {session.organisationName}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Profile menu"
            >
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">{session.name || session.email}</p>
                <p className="text-xs text-muted-foreground">{session.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ROLES[session.role]} · {session.organisationName}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
