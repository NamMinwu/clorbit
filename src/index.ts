import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { dockerfileTool } from "./tools/generate-dockerfile";
import { ec2Tool } from "./tools/generate-ec2";
import { listKeyPairsTool } from "./tools/list-keypairs";
import { listSecurityGroupsTool } from "./tools/list-security-groups";
import { setEc2Settings } from "./tools/set-ec2";
import { generateSecurityGroupTool } from "./tools/generate-security-group";
import { analyzeProjectTool } from "./tools/analyze-project";
import { buildApplicationTool } from "./tools/build-application";
import { deployToEc2Tool } from "./tools/deploy-to-ec2-improved";
import { deployToEc2Tool as deployToEc2OriginalTool } from "./tools/deploy-to-ec2";
import { setInstallInEc2 } from "./tools/install-in-ec2";
import { cleanupResourcesTool } from "./tools/cleanup-resources";
import { awsHelperTool } from "./tools/aws-helper";
import { smartAwsSetupTool } from "./tools/smart-aws-setup";
import { smartDeployTool } from "./tools/smart-deploy";

const server = new McpServer({
  name: "Clorbit MCP Server",
  version: "4.0.0",
});

server.tool("add", "두 숫자를 더합니다", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a + b) }],
}));

// 기존 MCP Tools
dockerfileTool(server);
ec2Tool(server);
setEc2Settings(server);
setInstallInEc2(server);
listKeyPairsTool(server);
listSecurityGroupsTool(server);
generateSecurityGroupTool(server);

// 개선된 핵심 배포 MCP Tools
analyzeProjectTool(server);
buildApplicationTool(server);
deployToEc2Tool(server); // 개선된 버전
deployToEc2OriginalTool(server); // 원본 버전
cleanupResourcesTool(server);

// 스마트 AWS 설정 도구들
awsHelperTool(server);
smartAwsSetupTool(server);
smartDeployTool(server);

const transport = new StdioServerTransport();

(async () => {
  await server.connect(transport);
})();
