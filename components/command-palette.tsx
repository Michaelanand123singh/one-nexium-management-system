"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import {
  LayoutDashboard,
  Map,
  ListTodo,
  Kanban,
  Bug,
  Users,
  FileText,
  Settings,
  Laptop,
  Mail,
  CalendarDays,
  GitBranch,
  Server,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { NAV_MODULES } from "@/lib/constants";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Mail,
  CalendarDays,
  Map,
  ListTodo,
  Kanban,
  Bug,
  Users,
  FileText,
  GitBranch,
  Server,
  Terminal,
  Laptop,
  Settings,
};

export function CommandPalette({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const links = useMemo(
    () => NAV_MODULES.filter((m) => (m.roles as readonly string[]).includes(role)),
    [role]
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} label="Global search">
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Go to">
          {links.map(({ href, label, icon }) => {
            const Icon = ICON_MAP[icon] ?? LayoutDashboard;
            return (
              <CommandItem
                key={href}
                value={label}
                onSelect={() => {
                  router.push(href);
                  setOpen(false);
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
