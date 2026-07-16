import { NextRequest, NextResponse } from "next/server";
import { getSessionOr401 } from "@/lib/api-guard";
import { canUseAITerminal } from "@/lib/permissions";
import { isCommandAllowed } from "@/lib/terminal-allowlist";
import { getTerminalRunner } from "@/lib/terminal-runner";

export async function POST(request: NextRequest) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  if (!canUseAITerminal(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { command?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const command = typeof body.command === "string" ? body.command.trim() : "";
  if (!command) {
    return NextResponse.json({ error: "command is required" }, { status: 400 });
  }

  if (!isCommandAllowed(command)) {
    return NextResponse.json(
      { error: "Command not allowed by security policy" },
      { status: 403 }
    );
  }

  const runner = getTerminalRunner();
  try {
    const { stdout, stderr, exitCode } = await runner.run(command);
    return NextResponse.json({ stdout, stderr, exitCode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Command execution failed";
    return NextResponse.json(
      { error: message, stdout: "", stderr: message, exitCode: 1 },
      { status: 500 }
    );
  }
}
