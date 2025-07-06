// 이 파일을 실행하기 전에 다음 명령어로 AWS SDK를 설치하세요:
// npm install @aws-sdk/client-ec2

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  EC2Client,
  DescribeKeyPairsCommand,
  KeyPairInfo,
} from "@aws-sdk/client-ec2";

export function listKeyPairsTool(server: McpServer) {
  server.tool(
    "listKeyPairs",
    {
      region: z.string().optional(),
    },
    async ({ region }) => {
      const useRegion = region || process.env.AWS_REGION || "ap-northeast-2";
      const client = new EC2Client({ region: useRegion });
      const command = new DescribeKeyPairsCommand({});
      try {
        const result = await client.send(command);
        if (result.KeyPairs && result.KeyPairs.length > 0) {
          return {
            content: [
              {
                type: "text",
                text:
                  "키 페어 목록:\n" +
                  (result.KeyPairs as KeyPairInfo[])
                    .map((kp) => `- ${kp.KeyName}`)
                    .join("\n"),
              },
            ],
          };
        } else {
          return {
            content: [{ type: "text", text: "키 페어가 없습니다." }],
          };
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `키 페어 목록을 가져오는 중 오류 발생: ${err}`,
            },
          ],
        };
      }
    }
  );
}
