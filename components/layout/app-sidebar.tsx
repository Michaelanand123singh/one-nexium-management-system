"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  Map,
  ListTodo,
  Kanban,
  Bug,
  Users,
  FileText,
  GitBranch,
  Server,
  Terminal,
  Settings,
  CalendarDays,
  Laptop,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_MODULES } from "@/lib/constants";
import type { Role } from "@prisma/client";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Mail,
  Map,
  ListTodo,
  Kanban,
  Bug,
  Users,
  FileText,
  GitBranch,
  Server,
  Terminal,
  Settings,
  CalendarDays,
  Laptop,
  Network,
};

export function AppSidebar({
  role,
  open,
}: {
  role: Role;
  /** When true, sidebar is expanded (full width with labels). When false, collapsed (icon-only) or hidden on small screens. */
  open: boolean;
}) {
  const pathname = usePathname();
  const allowed = NAV_MODULES.filter((m) => m.roles.includes(role));

  return (
    <aside
      className={cn(
        "sidebar flex h-full min-h-0 flex-col border-r border-border bg-card text-card-foreground transition-[width] duration-200",
        open ? "w-56" : "w-[56px]"
      )}
    >
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2">
        {allowed.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {open && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
