import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { promises as fs } from "fs";
import path from "path";
import { generateDockerfile } from "./builder";

export function dockerfileTool(server: McpServer) {
  server.tool(
    "generateDockerfile",
    "애플리케이션을 위한 Dockerfile을 생성합니다",
    {
      baseImage: z.string(),
      appDir: z.string(),
      startCommand: z.string(),
      framework: z
        .enum(["spring", "express", "nextjs", "python", "custom"])
        .optional(),
      port: z.number().optional(),
      buildCommand: z.string().optional(),
    },
    async ({
      baseImage,
      appDir,
      startCommand,
      framework,
      port,
      buildCommand,
    }) => {
      const dockerfile = await generateDockerfile({
        baseImage,
        appDir,
        startCommand,
        framework,
        port,
        buildCommand,
      });
      const dockerfilePath = path.join(process.cwd(), appDir, "Dockerfile");
      await fs.writeFile(dockerfilePath, dockerfile, "utf-8");

      return {
        content: [
          { type: "text", text: `✅ Dockerfile created at: ${dockerfilePath}` },
        ],
      };
    }
  );
}
