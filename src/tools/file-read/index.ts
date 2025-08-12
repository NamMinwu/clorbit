import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";

type FileReadOpts = {
  rootDir?: string; // 읽기 루트 경로
  allowedExts?: string[]; // 허용 확장자 / 파일명
  maxBytes?: number; // 최대 읽기 크기 (바이트)
};

export function fileReadTool(server: McpServer, opts?: FileReadOpts) {
  const ROOT = path.resolve(
    opts?.rootDir ?? path.join(process.cwd(), "workspace")
  );
  const ALLOWED = opts?.allowedExts ?? [
    ".txt",
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".log",
  ];
  const MAX_BYTES = opts?.maxBytes ?? 1024 * 1024; // 기본 1MB 제한

  server.tool(
    "fileRead",
    {
      filePath: z.string().min(1), // 읽을 파일 경로
      encoding: z.enum(["utf8", "base64"]).default("utf8"), // 기본 utf8
    },
    async ({ filePath, encoding }) => {
      // 1) 경로 정규화 & ROOT 제한
      const normalized = filePath.replace(/\\/g, "/");
      const abs = path.isAbsolute(normalized)
        ? path.resolve(normalized)
        : path.resolve(ROOT, normalized);

      if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) {
        throw new Error(
          `path_escape_detected: ${abs} is outside of ROOT: ${ROOT}`
        );
      }

      // 2) 확장자 화이트리스트
      const base = path.basename(normalized).toLowerCase();
      const ext = path.extname(normalized).toLowerCase();
      const allowed = ALLOWED.some((a) => {
        const aLow = a.toLowerCase();
        return aLow.startsWith(".") ? aLow === ext : aLow === base;
      });
      if (!allowed) {
        throw new Error(
          `extension_not_allowed: "${ext || base}" allowed=${ALLOWED.join(",")}`
        );
      }

      // 3) 파일 크기 제한
      const stat = await fs.stat(abs);
      if (stat.size > MAX_BYTES) {
        throw new Error(
          `file_too_large: ${stat.size} bytes > limit ${MAX_BYTES} bytes`
        );
      }

      // 4) 파일 읽기
      const data = await fs.readFile(abs);
      const content =
        encoding === "utf8" ? data.toString("utf8") : data.toString("base64");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ok: true, path: abs, bytes: stat.size, encoding, content },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
