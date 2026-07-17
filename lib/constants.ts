import type { Role } from "@prisma/client";

// ─── Shared domain constants ─────────────────────────────────────────────
/** Roadmap and OKR stages (phase-wise). Used when org phases are not yet loaded. */
export const PHASES = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5", "Phase 6"];

/** Kanban column order for Sprint board */
export const TASK_STATUSES = [
  "BACKLOG",
  "TO_DO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
] as const;

export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  BACKLOG: "Backlog",
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export const TASK_TYPES = ["FEATURE", "BUG", "TECH_DEBT", "RESEARCH"] as const;

export const TASK_TYPE_LABELS: Record<(typeof TASK_TYPES)[number], string> = {
  FEATURE: "Feature",
  BUG: "Bug",
  TECH_DEBT: "Tech Debt",
  RESEARCH: "Research",
};

/** Bug status for list/filters */
export const BUG_STATUSES = [
  "NEW",
  "CONFIRMED",
  "IN_PROGRESS",
  "FIXED",
  "VERIFIED",
  "CLOSED",
  "WONT_FIX",
] as const;

export const BUG_STATUS_LABELS: Record<(typeof BUG_STATUSES)[number], string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  FIXED: "Fixed",
  VERIFIED: "Verified",
  CLOSED: "Closed",
  WONT_FIX: "Won't fix",
};

export const BUG_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export const BUG_SEVERITY_LABELS: Record<(typeof BUG_SEVERITIES)[number], string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/** OKR level for company / team / individual */
export const OKR_LEVELS = ["COMPANY", "TEAM", "INDIVIDUAL"] as const;
export const OKR_LEVEL_LABELS: Record<(typeof OKR_LEVELS)[number], string> = {
  COMPANY: "Company",
  TEAM: "Team",
  INDIVIDUAL: "Individual",
};

/** Key result confidence */
export const OKR_CONFIDENCE = ["ON_TRACK", "AT_RISK", "OFF_TRACK"] as const;
export const OKR_CONFIDENCE_LABELS: Record<(typeof OKR_CONFIDENCE)[number], string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
};

/** GTM Campaign */
export const CAMPAIGN_TYPES = ["CONTENT", "PARTNERSHIP", "PAID", "EVENT", "COMMUNITY", "REFERRAL"] as const;
export const CAMPAIGN_TYPE_LABELS: Record<(typeof CAMPAIGN_TYPES)[number], string> = {
  CONTENT: "Content",
  PARTNERSHIP: "Partnership",
  PAID: "Paid",
  EVENT: "Event",
  COMMUNITY: "Community",
  REFERRAL: "Referral",
};
export const CAMPAIGN_STATUSES = ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"] as const;
export const CAMPAIGN_STATUS_LABELS: Record<(typeof CAMPAIGN_STATUSES)[number], string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

/** GTM Partner */
export const PARTNER_TYPES = ["RESELLER", "REFERRAL", "AGENCY", "INFLUENCER", "INTEGRATION", "COMMUNITY"] as const;
export const PARTNER_TYPE_LABELS: Record<(typeof PARTNER_TYPES)[number], string> = {
  RESELLER: "Reseller",
  REFERRAL: "Referral",
  AGENCY: "Agency",
  INFLUENCER: "Influencer",
  INTEGRATION: "Integration",
  COMMUNITY: "Community",
};
export const PARTNER_TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;
export const PARTNER_TIER_LABELS: Record<(typeof PARTNER_TIERS)[number], string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};
export const PARTNER_PIPELINE_STAGES = ["IDENTIFIED", "CONTACTED", "IN_DISCUSSION", "AGREEMENT_SIGNED", "ACTIVE"] as const;
export const PARTNER_PIPELINE_LABELS: Record<(typeof PARTNER_PIPELINE_STAGES)[number], string> = {
  IDENTIFIED: "Identified",
  CONTACTED: "Contacted",
  IN_DISCUSSION: "In discussion",
  AGREEMENT_SIGNED: "Agreement signed",
  ACTIVE: "Active",
};
export const PARTNER_STATUSES = ["APPLIED", "ACTIVE", "PAUSED", "CHURNED"] as const;
export const PARTNER_STATUS_LABELS: Record<(typeof PARTNER_STATUSES)[number], string> = {
  APPLIED: "Applied",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CHURNED: "Churned",
};

// ─── Customer Success ────────────────────────────────────────────────────
export const CUSTOMER_PLANS = ["FREE", "PRO", "BUSINESS"] as const;
export const CUSTOMER_PLAN_LABELS: Record<(typeof CUSTOMER_PLANS)[number], string> = {
  FREE: "Free",
  PRO: "Pro",
  BUSINESS: "Business",
};

export const CHURN_RISKS = ["LOW", "MEDIUM", "HIGH"] as const;
export const CHURN_RISK_LABELS: Record<(typeof CHURN_RISKS)[number], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export const TICKET_STATUS_LABELS: Record<(typeof TICKET_STATUSES)[number], string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const FEEDBACK_TYPES = [
  "POSITIVE",
  "NEGATIVE",
  "FEATURE_REQUEST",
  "BUG_REPORT",
] as const;
export const FEEDBACK_TYPE_LABELS: Record<(typeof FEEDBACK_TYPES)[number], string> = {
  POSITIVE: "Positive",
  NEGATIVE: "Negative",
  FEATURE_REQUEST: "Feature request",
  BUG_REPORT: "Bug report",
};

export const ROLES: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  PRODUCT_MANAGER: "Product Manager",
  ENGINEERING_LEAD: "Engineering Lead",
  DEVELOPER: "Developer",
  GTM_MANAGER: "GTM Manager",
  CUSTOMER_SUCCESS: "Customer Success",
};

/** Roles offered when adding/editing team members in Settings. */
export const TEAM_ASSIGNABLE_ROLES = [
  "SUPER_ADMIN",
  "PRODUCT_MANAGER",
  "ENGINEERING_LEAD",
  "DEVELOPER",
  "CUSTOMER_SUCCESS",
] as const satisfies readonly Role[];

/** Shared allow-list for primary product modules (Roadmap, Sprint, Backlog, etc.). */
export const PRIMARY_NAV_ROLES = [
  "SUPER_ADMIN",
  "PRODUCT_MANAGER",
  "ENGINEERING_LEAD",
  "DEVELOPER",
] as const satisfies readonly Role[];


/** Team member status (OrganisationMember) */
export const MEMBER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const MEMBER_STATUS_LABELS: Record<(typeof MEMBER_STATUSES)[number], string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

/** Department for team members */
export const DEPARTMENTS = ["PRODUCT", "ENGINEERING", "GTM", "CUSTOMER_SUCCESS", "LEADERSHIP"] as const;
export const DEPARTMENT_LABELS: Record<(typeof DEPARTMENTS)[number], string> = {
  PRODUCT: "Product",
  ENGINEERING: "Engineering",
  GTM: "GTM",
  CUSTOMER_SUCCESS: "Customer Success",
  LEADERSHIP: "Leadership",
};

/** Document types (Document model) */
export const DOCUMENT_TYPES = [
  "PRODUCT_SPEC",
  "TECHNICAL_ARCHITECTURE",
  "MEETING_NOTES",
  "RUNBOOK",
  "GTM_PLAYBOOK",
  "BRAND_GUIDELINES",
  "ONBOARDING_GUIDE",
] as const;
export const DOCUMENT_TYPE_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  PRODUCT_SPEC: "Product spec",
  TECHNICAL_ARCHITECTURE: "Technical architecture",
  MEETING_NOTES: "Meeting notes",
  RUNBOOK: "Runbook",
  GTM_PLAYBOOK: "GTM playbook",
  BRAND_GUIDELINES: "Brand guidelines",
  ONBOARDING_GUIDE: "Onboarding guide",
};

/** Document source (where file was uploaded from) */
export const DOCUMENT_SOURCE_LABELS: Record<string, string> = {
  library: "Document library",
  bug: "Bug attachment",
  task: "Task",
  gtm: "GTM asset",
  backlog: "Backlog",
};

export const NAV_MODULES: {
  label: string;
  href: string;
  icon: string;
  roles: readonly Role[];
}[] = [
  {
    label: "Command Centre",
    href: "/",
    icon: "LayoutDashboard",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: "Mail",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "Planning",
    href: "/planning",
    icon: "CalendarDays",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "Roadmap",
    href: "/roadmap",
    icon: "Map",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "Backlog",
    href: "/backlog",
    icon: "ListTodo",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "Sprint Board",
    href: "/sprint",
    icon: "Kanban",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "Bug Tracker",
    href: "/bugs",
    icon: "Bug",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    // Kept for Super Admin only (CS role still valid in DB; not assignable in Settings).
    label: "Customer Success",
    href: "/customers",
    icon: "Users",
    roles: ["SUPER_ADMIN", "CUSTOMER_SUCCESS"] as const,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: "FileText",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    icon: "GitBranch",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "Infrastructure",
    href: "/infrastructure",
    icon: "Server",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "Architecture",
    href: "/architecture",
    icon: "Network",
    roles: PRIMARY_NAV_ROLES,
  },
  {
    label: "AI Terminal",
    href: "/terminal",
    icon: "Terminal",
    roles: ["SUPER_ADMIN", "ENGINEERING_LEAD"] as const,
  },
  {
    label: "HR",
    href: "/hr",
    icon: "Users",
    roles: ["SUPER_ADMIN", "PRODUCT_MANAGER", "ENGINEERING_LEAD"] as const,
  },
  {
    label: "Workstation",
    href: "/workstation",
    icon: "Laptop",
    roles: ["SUPER_ADMIN", "ENGINEERING_LEAD", "PRODUCT_MANAGER"] as const,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "Settings",
    roles: PRIMARY_NAV_ROLES,
  },
];

/**
 * Soft-archived modules (YAGNI): pages redirect home; APIs/components kept so seed/dashboard data still works.
 * Do not re-add to NAV_MODULES unless product re-enables them.
 */
export const ARCHIVED_MODULE_HREFS = ["/gtm", "/okrs"] as const;
