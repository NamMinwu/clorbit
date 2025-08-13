import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export function awsHelperTool(server: McpServer) {
  server.tool(
    "awsConfigureCommand",
    "AWS 설정 상태를 확인하고 설정 가이드를 제공합니다",
    {
      action: z.enum(["check", "guide", "setup"]).optional().default("check"),
    },
    async ({ action }) => {
      try {
        let result;
        switch (action) {
          case "check":
            result = await checkAwsCredentials();
            break;
          case "guide":
            result = provideAwsSetupGuide();
            break;
          case "setup":
            result = await setupAwsCredentials();
            break;
          default:
            result = { success: false, message: "Unknown action" };
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                message: `AWS 설정 도구 오류: ${errorMessage}`,
                guide: provideAwsSetupGuide()
              }, null, 2)
            }
          ]
        };
      }
    }
  );
}

async function checkAwsCredentials() {
  try {
    const { stdout } = await execAsync('aws sts get-caller-identity');
    const identity = JSON.parse(stdout);
    
    return {
      success: true,
      configured: true,
      message: "✅ AWS 자격 증명이 올바르게 설정되어 있습니다!",
      account: identity.Account,
      arn: identity.Arn
    };
  } catch (error) {
    return {
      success: false,
      configured: false,
      message: "❌ AWS 자격 증명이 설정되지 않았습니다.",
      guide: provideAwsSetupGuide()
    };
  }
}

function provideAwsSetupGuide() {
  return {
    title: "🚀 초보자를 위한 AWS 설정 가이드",
    steps: [
      {
        step: 1,
        title: "AWS CLI 설치",
        windows: "winget install Amazon.AWSCLI",
        mac: "brew install awscli",
        linux: "curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
      },
      {
        step: 2,
        title: "AWS 계정 키 생성",
        description: [
          "1. AWS 콘솔(https://console.aws.amazon.com)에 로그인",
          "2. 우상단 계정명 클릭 → 'Security credentials' 선택",
          "3. 'Access keys' 섹션에서 'Create access key' 클릭",
          "4. 'Command Line Interface (CLI)' 선택 후 'Next'",
          "5. Access Key ID와 Secret Access Key 복사"
        ]
      },
      {
        step: 3,
        title: "AWS CLI 설정",
        command: "aws configure",
        inputs: [
          "AWS Access Key ID: [2단계에서 복사한 Access Key ID]",
          "AWS Secret Access Key: [2단계에서 복사한 Secret Access Key]",
          "Default region name: ap-northeast-2",
          "Default output format: json"
        ]
      },
      {
        step: 4,
        title: "설정 확인",
        command: "aws sts get-caller-identity",
        expected: "계정 정보가 JSON 형태로 출력되면 성공!"
      }
    ],
    troubleshooting: [
      {
        problem: "winget을 찾을 수 없다고 나올 때",
        solution: "Microsoft Store에서 'App Installer' 설치"
      },
      {
        problem: "Access Denied 오류가 날 때",
        solution: "IAM 사용자에게 적절한 권한(EC2FullAccess 등) 부여"
      },
      {
        problem: "Invalid credentials 오류가 날 때",
        solution: "Access Key와 Secret Key를 다시 확인하고 재입력"
      }
    ]
  };
}

async function setupAwsCredentials() {
  return {
    message: "🔧 AWS 자동 설정은 보안상 제공되지 않습니다.",
    guide: provideAwsSetupGuide(),
    recommendation: "위의 가이드를 따라 수동으로 설정해주세요."
  };
}
