#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { dockerfileTool } from "./tools/generate-dockerfile/index.js";
import { ec2Tool } from "./tools/generate-ec2/index.js";
import { setEc2Settings } from "./tools/set-ec2/index.js";
import { listKeyPairsTool } from "./tools/list-keypairs/index.js";
import { listSecurityGroupsTool } from "./tools/list-security-groups/index.js";
import { generateSecurityGroupTool } from "./tools/generate-security-group/index.js";
import { fileWriteTool } from "./tools/file-writer/index.js";
import { execTool } from "./tools/exec/index.js";
import { templateGenerateTool } from "./tools/template-generate/index.js";
import { sshExecTool } from "./tools/ssh-exec/index.js";
import { fileReadTool } from "./tools/file-read/index.js";

// ⬇ 너의 툴들 import

async function main() {
  const server = new McpServer({ name: "clorbit", version: "0.1.0" });

  // 샘플 툴
  server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }],
  }));

  // 네가 만든 MCP 툴들 등록
  dockerfileTool(server);
  ec2Tool(server);
  setEc2Settings(server);
  listKeyPairsTool(server);
  listSecurityGroupsTool(server);
  generateSecurityGroupTool(server);
  // ai agent가 알아서 할 수 있도록 하는 tool
  fileWriteTool(server);
  execTool(server);
  templateGenerateTool(server);
  sshExecTool(server);
  fileReadTool(server);

  // STDIO Transport로 연결 (포트 필요 없음)
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("[clorbit-mcp] fatal:", e);
  process.exit(1);
});
