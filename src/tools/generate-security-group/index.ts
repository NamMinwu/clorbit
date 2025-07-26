import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EC2Client, CreateSecurityGroupCommand } from "@aws-sdk/client-ec2";

export function generateSecurityGroupTool(server: McpServer) {
  server.tool(
    "generateSecurityGroup",
    {
      groupName: z.string(),
      description: z.string(),
      vpcId: z.string().optional(),
      region: z.string().optional(),
    },
    async ({ groupName, description, vpcId, region }) => {
      const useRegion = region || process.env.AWS_REGION || "ap-northeast-2";
      const client = new EC2Client({ region: useRegion });
      const params: any = {
        GroupName: groupName,
        Description: description,
      };
      if (vpcId) {
        params.VpcId = vpcId;
      }
      try {
        const result = await client.send(
          new CreateSecurityGroupCommand(params)
        );
        return {
          content: [
            {
              type: "text",
              text: `✅ 시큐리티 그룹이 생성되었습니다. GroupId: ${result.GroupId}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `❌ 시큐리티 그룹 생성 중 오류 발생: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
