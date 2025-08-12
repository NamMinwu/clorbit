import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

type FileWriteOpts = {
  rootDir?: string; // 작업 루트(이 경로 밖은 금지)
  maxBytes?: number; // 최대 크기 (기본 500KB)
  allowedExts?: string[]; // 허용 확장자 또는 파일명(예: ".txt", ".json", "Dockerfile")
};

export function fileWriteTool(server: McpServer, opts: FileWriteOpts = {}) {
  const ROOT = path.resolve(
    opts.rootDir ?? path.join(process.cwd(), "workspace")
  );
  const MAX = opts.maxBytes ?? 500_000;
  const ALLOWED = opts.allowedExts; // 예: [".txt",".md",".json",".yaml",".yml","Dockerfile"]

  server.tool(
    "fileWrite",
    {
      targetPath: z.string().min(1),
      content: z.string().superRefine((val, ctx) => {
        const bytes = Buffer.byteLength(val, "utf8");
        if (bytes > MAX) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `size_exceeded: ${bytes} > ${MAX}`,
          });
        }
      }),
      overwrite: z.boolean().default(false),
      mkdirp: z.boolean().default(true),
    },
    async ({ targetPath, content, overwrite, mkdirp }) => {
      // 1) 경로 정규화 & 루트 내부 강제
      const normalized = targetPath.replace(/\\/g, "/");
      const abs = path.isAbsolute(normalized)
        ? path.resolve(normalized)
        : path.resolve(ROOT, normalized);

      if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) {
        throw new Error(
          `path_escape_detected: ${abs} is outside of ROOT: ${ROOT}`
        );
      }

      // 2) 확장자/파일명 화이트리스트(옵션)
      if (ALLOWED && ALLOWED.length > 0) {
        const base = path.basename(normalized).toLowerCase();
        const ext = path.extname(normalized).toLowerCase(); // "" (없을 수도)
        const allowed = ALLOWED.some((a) => {
          const aLow = a.toLowerCase();
          return aLow.startsWith(".") ? aLow === ext : aLow === base; // ".json" 또는 "dockerfile"
        });
        if (!allowed) {
          throw new Error(
            `extension_not_allowed: "${ext || base}" allowed=${ALLOWED.join(
              ","
            )}`
          );
        }
      }

      // 3) 디렉토리 준비
      const dir = path.dirname(abs);
      if (mkdirp) {
        await fs.mkdir(dir, { recursive: true });
      }

      // 4) 존재 & overwrite 체크
      let existed = false;
      try {
        await fs.stat(abs);
        existed = true;
      } catch {
        /* not exists */
      }

      if (existed && !overwrite) {
        throw new Error(`file_exists: ${abs}`);
      }

      // 5) 쓰기
      await fs.writeFile(abs, content, { encoding: "utf8", flag: "w" });

      // 6) 결과 반환 (MCP 메시지 형식)
      const rel = path.relative(ROOT, abs) || ".";
      const bytes = Buffer.byteLength(content, "utf8");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ok: true, path: abs, relative: rel, bytes, existed },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
