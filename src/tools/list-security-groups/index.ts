import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  SecurityGroup,
} from "@aws-sdk/client-ec2";

export function listSecurityGroupsTool(server: McpServer) {
  server.tool(
    "listSecurityGroups",
    {
      region: z.string().optional(),
    },
    async ({ region }) => {
      const useRegion = region || process.env.AWS_REGION || "ap-northeast-2";
      const client = new EC2Client({ region: useRegion });
      const command = new DescribeSecurityGroupsCommand({});
      try {
        const result = await client.send(command);
        if (result.SecurityGroups && result.SecurityGroups.length > 0) {
          return {
            content: [
              {
                type: "text",
                text:
                  "시큐리티 그룹 목록:\n" +
                  (result.SecurityGroups as SecurityGroup[])
                    .map(
                      (sg) => `- ${sg.GroupId} (${sg.GroupName || "이름 없음"})`
                    )
                    .join("\n"),
              },
            ],
          };
        } else {
          return {
            content: [{ type: "text", text: "시큐리티 그룹이 없습니다." }],
          };
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `시큐리티 그룹 목록을 가져오는 중 오류 발생: ${err}`,
            },
          ],
        };
      }
    }
  );
}
