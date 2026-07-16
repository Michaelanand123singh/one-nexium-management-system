import { NextRequest } from "next/server";
import { getSessionOr401 } from "@/lib/api-guard";
import { canUseAITerminal } from "@/lib/permissions";
import { isCommandAllowed } from "@/lib/terminal-allowlist";
import { getTerminalRunner } from "@/lib/terminal-runner";

/**
 * POST body: { command: string }
 * Response: SSE stream of "data: <chunk>\n\n" (stdout and stderr combined in order).
 * Final event: "data: [DONE] exitCode=<n>\n\n"
 */
export async function POST(request: NextRequest) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  if (!canUseAITerminal(session.role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { command?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const command = typeof body.command === "string" ? body.command.trim() : "";
  if (!command) {
    return new Response(JSON.stringify({ error: "command is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isCommandAllowed(command)) {
    return new Response(
      JSON.stringify({ error: "Command not allowed by security policy" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const runner = getTerminalRunner();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        if (text) {
          const payload = "data: " + text.replace(/\n/g, "\ndata: ") + "\n\n";
          controller.enqueue(new TextEncoder().encode(payload));
        }
      };

      try {
        const { exitCode } = await runner.runStreaming(command, send);
        send(`[DONE] exitCode=${exitCode}`);
      } catch (e) {
        send("Error: " + (e instanceof Error ? e.message : "Execution failed"));
        send("[DONE] exitCode=1");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
