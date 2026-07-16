"use client";

import "@xterm/xterm/css/xterm.css";
import { useState, useRef, useEffect } from "react";
import type { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/layout/page-shell";
import { Sparkles, Play, Loader2, Terminal as TerminalIcon } from "lucide-react";
import { canUseAITerminal } from "@/lib/permissions";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TerminalViewProps = {
  role: Role;
  organisationId: string;
};

export function TerminalView({ role, organisationId }: TerminalViewProps) {
  void organisationId;
  const canUse = canUseAITerminal(role);
  const [prompt, setPrompt] = useState("");
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [running, setRunning] = useState(false);
  const [useXterm, setUseXterm] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<{
    terminal: { write: (s: string) => void; writeln: (s: string) => void; dispose: () => void };
    fitAddon: { fit: () => void };
  } | null>(null);

  // Phase 2: init xterm when useXterm is true and terminalRef is mounted
  useEffect(() => {
    if (!useXterm || !terminalRef.current || !canUse) return;

    let mounted = true;
    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      if (!mounted || !terminalRef.current) return;

      const term = new Terminal({
        theme: { background: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        fontFamily: "ui-monospace, monospace",
        fontSize: 13,
        cursorBlink: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      term.writeln("AI Terminal — type in plain English and click \"Suggest with AI\", then \"Run\". Or type a command and run directly.");
      term.writeln("");

      xtermRef.current = { terminal: term, fitAddon };
      const ro = new ResizeObserver(() => fitAddon.fit());
      ro.observe(terminalRef.current);

      return () => {
        mounted = false;
        ro.disconnect();
        term.dispose();
        xtermRef.current = null;
      };
    })();

    return () => { mounted = false; };
  }, [useXterm, canUse]);

  const handleSuggest = async () => {
    const text = prompt.trim();
    if (!text) {
      toast.error("Enter a description in plain English");
      return;
    }
    setSuggesting(true);
    try {
      const res = await api<{ command: string }>("/api/terminal/interpret", {
        method: "POST",
        body: { prompt: text },
      });
      setCommand(res.command);
      toast.success("Command suggested");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to suggest command");
    } finally {
      setSuggesting(false);
    }
  };

  const runCommand = async (cmd: string) => {
    const c = cmd.trim();
    if (!c) {
      toast.error("No command to run");
      return;
    }
    setRunning(true);
    if (useXterm && xtermRef.current) {
      const { terminal } = xtermRef.current;
      terminal.writeln("\r\n$ " + c);
      try {
        const res = await fetch("/api/terminal/run-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ command: c }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          terminal.writeln("Error: " + (err.error ?? res.statusText));
          return;
        }
        const reader = res.body?.getReader();
        const dec = new TextDecoder();
        let buffer = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += dec.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            for (const event of events) {
              const dataLines = event.split("\n").filter((l) => l.startsWith("data: "));
              const payload = dataLines.map((l) => l.slice(6)).join("\n").trim();
              if (payload.startsWith("[DONE]")) {
                const code = payload.replace("[DONE] exitCode=", "");
                terminal.writeln("\r\n(exit " + code + ")");
              } else if (payload) terminal.write(payload);
            }
          }
          if (buffer) {
            const dataLines = buffer.split("\n").filter((l) => l.startsWith("data: "));
            const payload = dataLines.map((l) => l.slice(6)).join("\n").trim();
            if (payload && !payload.startsWith("[DONE]")) terminal.write(payload);
          }
        }
        terminal.writeln("");
      } catch (e) {
        terminal.writeln("Error: " + (e instanceof Error ? e.message : "Request failed"));
      } finally {
        setRunning(false);
      }
    } else {
      setOutput("");
      try {
        const res = await api<{ stdout: string; stderr: string; exitCode: number }>("/api/terminal/run", {
          method: "POST",
          body: { command: c },
        });
        const out = [res.stdout, res.stderr].filter(Boolean).join("\n") || "(no output)";
        setOutput(out + "\n\n(exit " + res.exitCode + ")");
      } catch (e) {
        setOutput("Error: " + (e instanceof Error ? e.message : "Request failed"));
      } finally {
        setRunning(false);
      }
    }
  };

  const handleRun = () => {
    runCommand(command || prompt.trim());
  };

  if (!canUse) {
    return (
      <PageShell title="AI Terminal" description="Natural language to command execution">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You don’t have permission to use the AI Terminal.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="AI Terminal"
      description="Type in plain English or a command. AI suggests the command; you run it."
    >
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TerminalIcon className="h-4 w-4" />
              Input
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUseXterm((x) => !x)}
            >
              {useXterm ? "Simple output" : "Terminal output"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Natural language (e.g. &quot;list my S3 buckets&quot;)</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Describe what you want to do..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSuggest()}
                  className="font-mono text-sm"
                />
                <Button
                  variant="secondary"
                  onClick={handleSuggest}
                  disabled={suggesting}
                >
                  {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Suggest with AI</span>
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Command to run (editable)</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="aws s3 ls, docker ps, ..."
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRun()}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleRun}
                  disabled={running || (!command.trim() && !prompt.trim())}
                >
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  <span className="ml-2">Run</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Output</CardTitle>
          </CardHeader>
          <CardContent>
            {useXterm ? (
              <div
                ref={terminalRef}
                className={cn(
                  "min-h-[320px] w-full rounded-md border bg-card p-2",
                  "font-mono text-sm [&_.xterm]:min-h-[300px]"
                )}
              />
            ) : (
              <pre className="min-h-[320px] w-full overflow-auto rounded-md border bg-muted/50 p-4 font-mono text-sm whitespace-pre-wrap break-all">
                {output || "Run a command to see output."}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
