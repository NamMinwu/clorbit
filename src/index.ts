import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { dockerfileTool } from "./tools/generate-dockerfile";
import { ec2Tool } from "./tools/generate-ec2";
import { listKeyPairsTool } from "./tools/list-keypairs";
import { listSecurityGroupsTool } from "./tools/list-security-groups";
import { setEc2Settings } from "./tools/set-ec2";
import { generateSecurityGroupTool } from "./tools/generate-security-group";

const server = new McpServer({
  name: "Hello World",
  version: "1.0.0",
});

server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a + b) }],
}));

dockerfileTool(server);
ec2Tool(server);
setEc2Settings(server);
listKeyPairsTool(server);
listSecurityGroupsTool(server);
generateSecurityGroupTool(server);
const transport = new StdioServerTransport();

(async () => {
  await server.connect(transport);
})();
