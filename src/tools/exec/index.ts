import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";

type ExecOpts = {
  rootDir?: string; // 작업 루트(이 경로 밖 접근 금지)
  timeoutMs?: number; // 기본 타임아웃
  maxOutputBytes?: number; // stdout+stderr 최대 바이트
  allowedCmds?: string[]; // 실행 허용 명령 화이트리스트
  denyPatterns?: RegExp[]; // 전체 커맨드라인 금지 패턴
};

export function execTool(server: McpServer, opts: ExecOpts = {}) {
  const ROOT = path.resolve(
    opts.rootDir ?? path.join(process.cwd(), "workspace")
  );
  const TIMEOUT = opts.timeoutMs ?? 120_000;
  const MAX_OUT = opts.maxOutputBytes ?? 512 * 1024; // 512KB
  const ALLOWED = (
    opts.allowedCmds ?? [
      "git",
      "docker",
      "bash",
      "sh",
      "tar",
      "sed",
      "awk",
      "ls",
      "cat",
      "cp",
      "mv",
      "mkdir",
      "chmod",
      "chown",
      "echo",
      "grep",
      "find",
    ]
  ).map((s) => s.toLowerCase());
  const DENY = opts.denyPatterns ?? [
    /rm\s+-rf\s+\/($|\s)/i,
    /\bshutdown\b/i,
    /\breboot\b/i,
    /\bmkfs\b/i,
    /\buserdel\b/i,
    /\bchpasswd\b/i,
  ];

  // 입력 스키마(추가 검증은 런타임에서 수행)
  server.tool(
    "exec",
    {
      cmd: z.string().min(1),
      args: z.array(z.string()).max(30).default([]),
      cwd: z.string().optional(), // 루트 기준 상대/절대 모두 허용하되 루트 내부만
      timeoutMs: z.number().int().positive().max(600_000).optional(),
      env: z.record(z.string()).optional(), // 필요한 최소 env만
    },
    async ({ cmd, args, cwd, timeoutMs, env }) => {
      const cmdLower = cmd.toLowerCase();
      if (!ALLOWED.includes(cmdLower)) {
        throw new Error(`command_not_allowed: ${cmd}`);
      }

      // cwd 정규화 & 루트 바깥 차단
      const workdir = (() => {
        const raw = cwd ?? ".";
        const abs = path.isAbsolute(raw)
          ? path.resolve(raw)
          : path.resolve(ROOT, raw);
        if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) {
          throw new Error(
            `path_escape_detected: cwd=${abs} is outside of ROOT=${ROOT}`
          );
        }
        return abs;
      })();

      // 작업 디렉토리 존재 보장
      await fs.mkdir(workdir, { recursive: true });

      // 전체 커맨드라인 문자열 만들어 금지 패턴 검사
      const line = [cmd, ...args].join(" ");
      for (const p of DENY) {
        if (p.test(line)) {
          throw new Error(`denied_by_policy: pattern=${p}`);
        }
      }

      const limit = timeoutMs ?? TIMEOUT;
      const maxBytes = MAX_OUT;

      const { code, stdout, stderr, truncated } = await spawnWithLimits(
        cmd,
        args,
        { cwd: workdir, env: env as Record<string, string> | undefined },
        { timeoutMs: limit, maxOutputBytes: maxBytes }
      );

      const result = {
        ok: code === 0,
        code,
        cwd: workdir,
        cmd,
        args,
        stdout,
        stderr,
        truncated,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  async function spawnWithLimits(
    cmd: string,
    args: string[],
    procOpts: { cwd: string; env?: Record<string, string> },
    limits: { timeoutMs: number; maxOutputBytes: number }
  ): Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    truncated: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: procOpts.cwd,
        env: { ...process.env, ...procOpts.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let timer: NodeJS.Timeout | null = setTimeout(() => {
        child.kill("SIGKILL");
        timer = null;
      }, limits.timeoutMs);

      let out = Buffer.alloc(0);
      let err = Buffer.alloc(0);
      let truncated = false;

      const onData = (buf: Buffer, which: "out" | "err") => {
        const current = which === "out" ? out : err;
        const next = Buffer.concat([current, buf]);
        if (next.byteLength > limits.maxOutputBytes) {
          truncated = true;
          const slice = next.subarray(0, limits.maxOutputBytes);
          if (which === "out") out = slice;
          else err = slice;
          child.stdout?.removeAllListeners("data");
          child.stderr?.removeAllListeners("data");
          return;
        }
        if (which === "out") out = next;
        else err = next;
      };

      child.stdout?.on("data", (b: Buffer) => onData(b, "out"));
      child.stderr?.on("data", (b: Buffer) => onData(b, "err"));

      child.on("error", (e) => {
        if (timer) clearTimeout(timer);
        reject(e);
      });

      child.on("close", (code) => {
        if (timer) clearTimeout(timer);
        resolve({
          code,
          stdout: out.toString("utf8"),
          stderr: err.toString("utf8"),
          truncated,
        });
      });
    });
  }
}
