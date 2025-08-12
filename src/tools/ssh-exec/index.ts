import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Client, ConnectConfig } from "ssh2";
import fs from "node:fs/promises";

type SshExecOpts = {
  /** 허용 호스트(없으면 모든 호스트 허용) */
  allowedHosts?: string[];
  /** 허용 사용자(없으면 모든 사용자 허용) */
  allowedUsers?: string[];
  /** 금지 패턴(명령문 전체에 대해 검사) */
  denyPatterns?: RegExp[];
  /** 기본 타임아웃(ms) */
  defaultTimeoutMs?: number;
  /** 기본 최대 출력 바이트(stdout+stderr) */
  defaultMaxOutputBytes?: number;
};

export function sshExecTool(server: McpServer, opts: SshExecOpts = {}) {
  const ALLOWED_HOSTS = opts.allowedHosts ?? []; // 빈 배열이면 전체 허용
  const ALLOWED_USERS = opts.allowedUsers ?? [];
  const DENY = opts.denyPatterns ?? [
    /rm\s+-rf\s+\/($|\s)/i,
    /\bshutdown\b/i,
    /\breboot\b/i,
    /\bmkfs\b/i,
    /\buserdel\b/i,
    /\bchpasswd\b/i,
  ];
  const DEFAULT_TIMEOUT = opts.defaultTimeoutMs ?? 120_000;
  const DEFAULT_MAX_OUT = opts.defaultMaxOutputBytes ?? 512 * 1024; // 512KB

  // 입력 스키마(shape 객체)
  server.tool(
    "sshExec",
    {
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535).default(22),
      user: z.string().min(1),
      command: z.string().min(1).max(500),
      /** dryRun이면 실제 실행하지 않고 미리보기만 제공 */
      dryRun: z.boolean().default(true),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .max(600_000)
        .default(DEFAULT_TIMEOUT),
      maxOutputBytes: z
        .number()
        .int()
        .positive()
        .max(10 * 1024 * 1024)
        .default(DEFAULT_MAX_OUT),
      auth: z
        .object({
          /** 'agent' | 'privateKey' (기본: agent) */
          method: z.enum(["agent", "privateKey"]).default("agent"),
          /** SSH agent 소켓 경로(없으면 env SSH_AUTH_SOCK 사용) */
          agentSocket: z.string().optional(),
          /** 개인키 문자열(PEM) */
          privateKey: z.string().optional(),
          /** 개인키 파일 경로 */
          privateKeyPath: z.string().optional(),
          /** 개인키 패스프레이즈 */
          passphrase: z.string().optional(),
        })
        .default({ method: "agent" }),
    },
    async (input) => {
      const {
        host,
        port,
        user,
        command,
        dryRun,
        timeoutMs,
        maxOutputBytes,
        auth,
      } = input;

      // 호스트/유저 화이트리스트
      if (ALLOWED_HOSTS.length && !ALLOWED_HOSTS.includes(host)) {
        throw new Error(`host_not_allowed: ${host}`);
      }
      if (ALLOWED_USERS.length && !ALLOWED_USERS.includes(user)) {
        throw new Error(`user_not_allowed: ${user}`);
      }

      // 금지 패턴 검사
      for (const p of DENY) {
        if (p.test(command)) {
          throw new Error(`denied_by_policy: pattern=${p}`);
        }
      }

      // dryRun이면 미리보기만 반환
      if (dryRun) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  preview: `ssh -p ${port} ${user}@${host} -- ${command}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // 인증 구성
      const connectCfg: ConnectConfig = {
        host,
        port,
        username: user,
        readyTimeout: Math.min(timeoutMs, 30_000), // 연결 대기는 짧게
      };

      if (auth.method === "agent") {
        const sock = auth.agentSocket ?? process.env.SSH_AUTH_SOCK;
        if (!sock) {
          throw new Error(
            "ssh_agent_unavailable: set SSH_AUTH_SOCK or provide auth.agentSocket"
          );
        }
        (connectCfg as any).agent = sock;
      } else {
        let key = auth.privateKey;
        if (!key && auth.privateKeyPath) {
          key = await fs.readFile(auth.privateKeyPath, "utf8");
        }
        if (!key)
          throw new Error(
            "private_key_required: provide auth.privateKey or privateKeyPath"
          );
        connectCfg.privateKey = key;
        if (auth.passphrase) connectCfg.passphrase = auth.passphrase;
      }

      // 실행
      const { code, stdout, stderr, truncated } = await execOverSSH(
        connectCfg,
        command,
        { timeoutMs, maxOutputBytes }
      );

      const result = {
        ok: code === 0,
        code,
        host,
        port,
        user,
        command,
        truncated,
        stdout,
        stderr,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  function execOverSSH(
    cfg: ConnectConfig,
    command: string,
    limits: { timeoutMs: number; maxOutputBytes: number }
  ): Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    truncated: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let timer: NodeJS.Timeout | null = null;
      let resolved = false;

      const done = (val: any, isErr = false) => {
        if (resolved) return;
        resolved = true;
        if (timer) clearTimeout(timer);
        conn.end();
        isErr ? reject(val) : resolve(val);
      };

      conn.on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) return done(err, true);

          let out = Buffer.alloc(0);
          let errb = Buffer.alloc(0);
          let truncated = false;

          const append = (buf: Buffer, which: "out" | "err") => {
            const cur = which === "out" ? out : errb;
            const next = Buffer.concat([cur, buf]);
            if (next.byteLength > limits.maxOutputBytes) {
              truncated = true;
              const slice = next.subarray(0, limits.maxOutputBytes);
              if (which === "out") out = slice;
              else errb = slice;
              // 더 이상 데이터 수신하지 않도록 리스너 제거
              stream.stdout?.removeAllListeners("data");
              stream.stderr?.removeAllListeners("data");
            } else {
              if (which === "out") out = next;
              else errb = next;
            }
          };

          stream.on("data", (d: Buffer) => append(d, "out"));
          stream.stderr.on("data", (d: Buffer) => append(d, "err"));

          stream.on("close", (code: number) => {
            done({
              code,
              stdout: out.toString("utf8"),
              stderr: errb.toString("utf8"),
              truncated,
            });
          });
        });
      });

      conn.on("error", (e) => done(e, true));

      timer = setTimeout(() => {
        done(new Error(`ssh_timeout: ${limits.timeoutMs}ms`), true);
      }, limits.timeoutMs);

      conn.connect(cfg);
    });
  }
}
