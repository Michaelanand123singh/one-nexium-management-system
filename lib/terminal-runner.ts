/**
 * Terminal command execution: local (child_process) or remote (SSH).
 * When TERMINAL_SSH_HOST is set, commands run on that host so tools like aws, docker are available.
 * Otherwise they run on the same machine as the Next.js app.
 */

import { spawn } from "child_process";

export type RunResult = { stdout: string; stderr: string; exitCode: number };

export type StreamRunner = {
  run(command: string): Promise<RunResult>;
  runStreaming(
    command: string,
    onChunk: (text: string) => void
  ): Promise<{ exitCode: number }>;
};

function getSshConfig(): { host: string; port: number; username: string; privateKey: string } | null {
  const host = process.env.TERMINAL_SSH_HOST?.trim();
  const user = process.env.TERMINAL_SSH_USER?.trim();
  const key = process.env.TERMINAL_SSH_PRIVATE_KEY?.trim();
  if (!host || !user || !key) return null;
  const port = parseInt(process.env.TERMINAL_SSH_PORT ?? "22", 10);
  if (Number.isNaN(port)) return null;
  return { host, port, username: user, privateKey: key };
}

/** Returns runner: SSH if configured, else local. */
export function getTerminalRunner(): StreamRunner {
  const ssh = getSshConfig();
  if (ssh) return createSshRunner(ssh);
  return createLocalRunner();
}

function createLocalRunner(): StreamRunner {
  const isWin = process.platform === "win32";
  const shell = isWin ? "cmd.exe" : "sh";
  const getArgs = (cmd: string) => (isWin ? ["/c", cmd] : ["-c", cmd]);

  return {
    async run(command: string): Promise<RunResult> {
      return new Promise((resolve) => {
        const proc = spawn(shell, getArgs(command), {
          shell: false,
          windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        proc.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
        proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
        proc.on("close", (code, signal) => {
          resolve({ stdout, stderr, exitCode: code ?? (signal ? 1 : 0) });
        });
        proc.on("error", (err) => {
          resolve({ stdout, stderr: stderr + err.message, exitCode: 1 });
        });
      });
    },

    async runStreaming(
      command: string,
      onChunk: (text: string) => void
    ): Promise<{ exitCode: number }> {
      return new Promise((resolve) => {
        const proc = spawn(shell, getArgs(command), {
          shell: false,
          windowsHide: true,
        });
        proc.stdout?.on("data", (chunk: Buffer) => onChunk(chunk.toString()));
        proc.stderr?.on("data", (chunk: Buffer) => onChunk(chunk.toString()));
        proc.on("close", (code, signal) => {
          resolve({ exitCode: code ?? (signal ? 1 : 0) });
        });
        proc.on("error", (err) => {
          onChunk("Error: " + err.message);
          resolve({ exitCode: 1 });
        });
      });
    },
  };
}

function createSshRunner(config: {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}): StreamRunner {
  return {
    async run(command: string): Promise<RunResult> {
      const { Client } = await import("ssh2");
      return new Promise<RunResult>((resolve) => {
        const conn = new Client();
        let stdout = "";
        let stderr = "";

        conn
          .on("ready", () => {
            conn.exec(command, (err, stream) => {
              if (err) {
                conn.end();
                return resolve({ stdout: "", stderr: err.message, exitCode: 1 });
              }
              stream.on("data", (data: Buffer | string) => {
                stdout += data.toString();
              });
              stream.stderr?.on("data", (data: Buffer) => {
                stderr += data.toString();
              });
              stream.on("close", (code: number) => {
                conn.end();
                resolve({ stdout, stderr, exitCode: code ?? 0 });
              });
            });
          })
          .on("error", (err) => {
            resolve({ stdout: "", stderr: err.message, exitCode: 1 });
          })
          .connect({
            host: config.host,
            port: config.port,
            username: config.username,
            privateKey: config.privateKey,
            readyTimeout: 15000,
          });
      });
    },

    async runStreaming(
      command: string,
      onChunk: (text: string) => void
    ): Promise<{ exitCode: number }> {
      const { Client } = await import("ssh2");
      return new Promise((resolve) => {
        const conn = new Client();

        conn
          .on("ready", () => {
            conn.exec(command, (err, stream) => {
              if (err) {
                onChunk("Error: " + err.message);
                conn.end();
                return resolve({ exitCode: 1 });
              }
              stream.on("data", (data: Buffer | string) => onChunk(data.toString()));
              stream.stderr?.on("data", (data: Buffer) => onChunk(data.toString()));
              stream.on("close", (code: number) => {
                conn.end();
                resolve({ exitCode: code ?? 0 });
              });
            });
          })
          .on("error", (err) => {
            onChunk("Error: " + err.message);
            resolve({ exitCode: 1 });
          })
          .connect({
            host: config.host,
            port: config.port,
            username: config.username,
            privateKey: config.privateKey,
            readyTimeout: 15000,
          });
      });
    },
  };
}

/** True if commands will run over SSH (useful for UI hint). */
export function isTerminalRemote(): boolean {
  return getSshConfig() !== null;
}
