import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "child_process";

// AWS CLI 설치 확인 함수
function checkAwsCliInstalled() {
  try {
    execSync("aws --version", { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

export function generateEc2Command({
  amiId,
  instanceType,
  keyName,
  securityGroup,
  region,
}: {
  amiId: string;
  instanceType: string;
  keyName: string;
  securityGroup: string;
  region: string;
}) {
  return `aws ec2 run-instances --image-id ${amiId} --instance-type ${instanceType} --key-name ${keyName} --security-group-ids ${securityGroup} --region ${region}`;
}

// AWS CLI 자격 증명 설정 함수
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
    {
      amiId: z.string(),
      instanceType: z.string(),
      keyName: z.string(),
      securityGroup: z.string(),
      region: z.string(),
    },
    async ({ amiId, instanceType, keyName, securityGroup, region }) => {
      if (!checkAwsCliInstalled()) {
        return {
          content: [
            {
              type: "text",
              text: "❌ AWS CLI가 설치되어 있지 않습니다. https://docs.aws.amazon.com/ko_kr/cli/latest/userguide/getting-started-install.html 를 참고해 설치해주세요.",
            },
          ],
        };
      }
      const command = generateEc2Command({
        amiId,
        instanceType,
        keyName,
        securityGroup,
        region,
      });
      try {
        const result = execSync(command, { encoding: "utf-8" });
        return {
          content: [
            { type: "text", text: `✅ 명령어 실행 결과:\n${result}` },
            { type: "text", text: `실행된 명령어:\n${command}` },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text", text: `❌ 명령어 실행 중 오류:\n${error.message}` },
            { type: "text", text: `실행된 명령어:\n${command}` },
          ],
        };
      }
    }
  );

  // awsConfigureCommand 툴 등록
  server.tool(
    "awsConfigureCommand",
    {
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
      region: z.string(),
    },
    async ({ accessKeyId, secretAccessKey, region }) => {
      if (!checkAwsCliInstalled()) {
        return {
          content: [
            {
              type: "text",
              text: "❌ AWS CLI가 설치되어 있지 않습니다. https://docs.aws.amazon.com/ko_kr/cli/latest/userguide/getting-started-install.html 를 참고해 설치해주세요.",
            },
          ],
        };
      }
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
