import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";

type TemplateGenOpts = {
  rootDir?: string; // 파일 생성 루트 (기본 workspace)
  allowedExts?: string[]; // 허용 확장자 (".md", ".yaml" 등)
  templates?: Record<string, string>; // 템플릿 목록 { 이름: 내용 }
};

export function templateGenerateTool(
  server: McpServer,
  opts?: TemplateGenOpts
) {
  // ✅ opts가 null/undefined여도 안전하게 기본값 세팅
  const ROOT = path.resolve(
    opts?.rootDir ?? path.join(process.cwd(), "workspace")
  );
  const ALLOWED = opts?.allowedExts ?? [
    ".md",
    ".txt",
    ".yaml",
    ".yml",
    ".json",
    "Dockerfile",
  ];
  const TEMPLATES = opts?.templates ?? {}; // 없으면 빈 객체

  server.tool(
    "templateGenerate",
    {
      templateName: z.string().min(1), // TEMPLATES 키 중 하나
      targetPath: z.string().min(1), // 생성할 파일 경로
      variables: z.record(z.string()).optional(), // {{var}} 치환 변수
      overwrite: z.boolean().default(false),
      mkdirp: z.boolean().default(true),
    },
    async ({ templateName, targetPath, variables, overwrite, mkdirp }) => {
      // 1) 템플릿 존재 확인 (opts가 null이어도 여기서 친절히 안내)
      const tpl = TEMPLATES[templateName];
      if (!tpl) {
        const keys = Object.keys(TEMPLATES);
        const hint = keys.length
          ? `available=[${keys.join(", ")}]`
          : "no templates configured";
        throw new Error(
          `template_not_found: "${templateName}" (${hint}). Pass templates in opts.templates when registering this tool.`
        );
      }

      // 2) 변수 치환
      let content = tpl;
      if (variables) {
        for (const [key, val] of Object.entries(variables)) {
          const re = new RegExp(`{{\\s*${key}\\s*}}`, "g");
          content = content.replace(re, val);
        }
      }

      // 3) 파일 경로 검증 (루트 밖 금지)
      const normalized = targetPath.replace(/\\/g, "/");
      const abs = path.isAbsolute(normalized)
        ? path.resolve(normalized)
        : path.resolve(ROOT, normalized);

      if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) {
        throw new Error(
          `path_escape_detected: ${abs} is outside of ROOT: ${ROOT}`
        );
      }

      // 4) 확장자/파일명 화이트리스트
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

      // 5) 디렉토리 생성
      if (mkdirp) {
        await fs.mkdir(path.dirname(abs), { recursive: true });
      }

      // 6) 기존 파일 체크
      try {
        await fs.stat(abs);
        if (!overwrite) throw new Error(`file_exists: ${abs}`);
      } catch {
        /* not exists → OK */
      }

      // 7) 작성
      await fs.writeFile(abs, content, "utf8");

      const rel = path.relative(ROOT, abs) || ".";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                path: abs,
                relative: rel,
                bytes: Buffer.byteLength(content, "utf8"),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
