"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Single label + value row for detail sheets. Keeps alignment consistent. */
export function SheetDetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/** Section with optional title for grouping in detail sheets. */
export function SheetDetailSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      )}
      {children}
    </div>
  );
}

/** List block with consistent spacing and alignment for detail sheets. */
export function SheetDetailList({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SheetDetailSection title={title} className={className}>
      <ul className="list-inside list-disc space-y-1.5 text-sm text-foreground">
        {children}
      </ul>
    </SheetDetailSection>
  );
}

/** Wrapper for the main content area of a detail sheet. Use inside SheetBody. */
export function SheetDetailContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {children}
    </div>
  );
}
