import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EC2Client, RunInstancesCommand } from "@aws-sdk/client-ec2";

// AWS CLI 자격 증명 설정 함수 (유지)
export function awsConfigureCommand({
  accessKeyId,
  secretAccessKey,
  region,
}: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}) {
  return [
    `aws configure set aws_access_key_id ${accessKeyId}`,
    `aws configure set aws_secret_access_key ${secretAccessKey}`,
    `aws configure set region ${region}`,
    `aws configure set output json`,
  ].join(" && ");
}

export function ec2Tool(server: McpServer) {
  server.tool(
    "generateEc2Command",
    "EC2 인스턴스를 생성하는 AWS 명령어를 생성합니다",
    {
      amiId: z.string().optional,
      instanceType: z.string().optional,
      keyName: z.string(),
      securityGroup: z.string(),
      region: z.string().optional,
    },
    async ({ amiId, instanceType, keyName, securityGroup, region }) => {
      const useRegion = region || "ap-northeast-2";
      const client = new EC2Client({ region: useRegion });
      const params = {
        ImageId: amiId || "ami-0c9c942bd7bf113a2",
        InstanceType: instanceType || "t2.micro", // Fix type error
        KeyName: keyName,
        SecurityGroupIds: [securityGroup],
        MinCount: 1,
        MaxCount: 1,
      };
      try {
        const result = await client.send(new RunInstancesCommand(params));
        const instanceIds = result.Instances?.map((i) => i.InstanceId).filter(
          Boolean
        );
        if (instanceIds && instanceIds.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: `✅ EC2 인스턴스가 생성되었습니다. InstanceId: ${instanceIds.join(
                  ", "
                )}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: "❌ 인스턴스 생성 결과에서 InstanceId를 찾을 수 없습니다.",
              },
            ],
          };
        }
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `❌ EC2 인스턴스 생성 중 오류 발생: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // awsConfigureCommand 툴 등록 (유지)
  server.tool(
    "awsConfigureCommand",
    "AWS CLI 자격 증명을 설정하는 명령어를 생성합니다",
    {
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
      region: z.string(),
    },
    async ({ accessKeyId, secretAccessKey, region }) => {
      const command = awsConfigureCommand({
        accessKeyId,
        secretAccessKey,
        region,
      });
      return {
        content: [
          { type: "text", text: `AWS CLI 자격 증명 설정 명령어:\n${command}` },
        ],
      };
    }
  );
}
