/**
 * Allowlist for AI Terminal command execution.
 * Designed for full AWS infra management from the dashboard: EC2, RDS, S3, ECR, CloudWatch, ECS, Secrets Manager, etc.
 * Commands run on the configured host (SSH or local); only clearly dangerous patterns are blocked.
 */

const BLOCKED_PATTERNS = [
  /\brm\s+(-rf?|-\s*rf?)/i,
  /\bsudo\b/i,
  /\bchmod\s+[0-7]{3,4}\s+/i,
  /\bchown\b/i,
  /\bmkfs\./i,
  /\bdd\b/i,
  /\$\([^)]*\)/,  // command substitution
  /`[^`]*`/,       // backticks
  /\|\s*>/i,       // pipe to overwrite
  />\s*[^\s&|]+/,  // redirect to file
  />>\s*[^\s&|]+/i,
  /\bcurl\s+(-o|--output)\s+/i,
  /\bwget\b/i,
  /\bnc\s+-[el]/i,
  /\bssh\s+[^\s]+@/i,
  /\bbash\s+-c\s+['"]/i,
  /\bsh\s+-c\s+['"]/i,
];

/** Irreversible or high-impact AWS operations — block by default; user can run via direct command if needed. */
const BLOCKED_AWS_PATTERNS = [
  /\baws\s+[^;]*\bterminate-instances\b/i,
  /\baws\s+[^;]*\bdelete-db-instance\b/i,
  /\baws\s+[^;]*\bdelete-db-cluster\b/i,
  /\baws\s+[^;]*\bderegister-task-definition\b/i,
];

/** Base commands allowed (first token or after env). */
const ALLOWED_BASES = new Set([
  "aws",   // full AWS CLI — EC2, RDS, S3, ECR, CloudWatch, ECS, Secrets Manager, IAM, Lambda, etc.
  "docker",
  "tail",
  "head",
  "grep",
  "cat",
  "ls",
  "pwd",
  "echo",
  "env",
  "whoami",
  "date",
  "hostname",
  "node",
  "npm",
  "npx",
  "dir",
  "cd",
]);

/** Docker subcommands allowed. */
const ALLOWED_DOCKER_SUBCOMMANDS = new Set([
  "ps", "logs", "images", "inspect", "version", "info", "stats", "top", "events",
  "start", "stop", "restart", "exec",
]);

const ALLOWED_NPM_SUBCOMMANDS = new Set(["run", "ls", "view", "whoami", "version", "help", "install", "ci"]);

/**
 * Returns true if the command is allowed to run. False otherwise.
 */
export function isCommandAllowed(rawCommand: string): boolean {
  const cmd = rawCommand.trim();
  if (!cmd || cmd.length > 8192) return false;

  for (const re of BLOCKED_PATTERNS) {
    if (re.test(cmd)) return false;
  }

  if (cmd.toLowerCase().startsWith("aws ")) {
    for (const re of BLOCKED_AWS_PATTERNS) {
      if (re.test(cmd)) return false;
    }
  }

  const parts = cmd.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;

  let base = parts[0].toLowerCase();
  if (base === "env") {
    parts.shift();
    while (parts.length > 0 && parts[0].includes("=")) parts.shift();
    base = parts[0]?.toLowerCase() ?? "";
  }
  if (!ALLOWED_BASES.has(base)) return false;

  if (base === "docker") {
    const sub = parts[1]?.toLowerCase();
    if (!sub || !ALLOWED_DOCKER_SUBCOMMANDS.has(sub)) return false;
  }

  if (base === "npm" || base === "npx") {
    const sub = parts[1]?.toLowerCase();
    if (!sub || !ALLOWED_NPM_SUBCOMMANDS.has(sub)) return false;
  }

  return true;
}
