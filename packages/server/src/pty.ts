import pty from "node-pty";

export interface PtySessionOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  piScript?: string;
}

import { execSync } from "node:child_process";
import { realpathSync } from "node:fs";

function resolvePiScript(): string {
  try {
    // which pi -> symlink -> realpath -> actual cli.js
    const whichResult = execSync("which pi", { encoding: "utf-8" }).trim();
    return realpathSync(whichResult);
  } catch {
    throw new Error(
      "Could not resolve 'pi' CLI. Set PI_SCRIPT env var to the path of pi's cli.js."
    );
  }
}

export class PtySession {
  private ptyProcess: pty.IPty;

  constructor(options: PtySessionOptions = {}) {
    const cols = options.cols || 80;
    const rows = options.rows || 24;
    const cwd = options.cwd || process.cwd();

    // Resolve pi CLI path: symlink + shebang scripts can fail with posix_spawnp,
    // so we spawn node directly with the resolved script path as argument.
    const piScript = options.piScript || process.env.PI_SCRIPT;
    const [file, args] = piScript
      ? [process.execPath, [piScript]]
      : [process.execPath, [resolvePiScript()]];

    // Preserve user environment, ensure proper term settings
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    };

    this.ptyProcess = pty.spawn(file, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env,
    });
  }

  onData(listener: (data: string) => void) {
    return this.ptyProcess.onData(listener);
  }

  onExit(listener: (event: { exitCode: number; signal?: number }) => void) {
    return this.ptyProcess.onExit(listener);
  }

  write(data: string) {
    this.ptyProcess.write(data);
  }

  resize(cols: number, rows: number) {
    if (cols > 0 && rows > 0) {
      try {
        this.ptyProcess.resize(cols, rows);
      } catch (err) {
        console.error("Failed to resize PTY:", err);
      }
    }
  }

  kill() {
    try {
      this.ptyProcess.kill();
    } catch {
      // Ignore if already dead
    }
  }
}
