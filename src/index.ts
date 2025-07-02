import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { dockerfileTool } from "./tools/generate-dockerfile";

const server = new McpServer({
  name: "Hello World",
  version: "1.0.0",
});

server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a + b) }],
}));

dockerfileTool(server);

const transport = new StdioServerTransport();

(async () => {
  await server.connect(transport);
})();
