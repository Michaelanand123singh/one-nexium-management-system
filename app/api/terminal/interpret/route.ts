import { NextRequest, NextResponse } from "next/server";
import { getSessionOr401 } from "@/lib/api-guard";
import { canUseAITerminal } from "@/lib/permissions";
import { interpretPromptToCommand } from "@/lib/terminal-llm";

export async function POST(request: NextRequest) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  if (!canUseAITerminal(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const result = await interpretPromptToCommand(prompt);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ command: result.command });
}
