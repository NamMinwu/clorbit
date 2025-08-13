import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export function smartAwsSetupTool(server: McpServer) {
  server.tool(
    "smartAwsSetup",
    "사용자가 AWS 배포를 원할 때 자동으로 설정을 확인하고 가이드를 제공합니다",
    {
      userMessage: z.string().describe("사용자가 입력한 메시지"),
      autoSetup: z.boolean().default(true).describe("자동 설정 시도 여부"),
      verbose: z.boolean().default(true).describe("자세한 설명 제공 여부")
    },
    async ({ userMessage, autoSetup, verbose }) => {
      try {
        // 1. 사용자 메시지 분석
        const needsAws = analyzeUserIntent(userMessage);
        
        if (!needsAws) {
          return {
            content: [
              {
                type: "text",
                text: "이 요청에는 AWS 설정이 필요하지 않은 것 같습니다."
              }
            ]
          };
        }

        // 2. 현재 AWS 설정 상태 확인
        const awsStatus = await checkCurrentAwsStatus();
        
        // 3. 설정 상태에 따른 응답 생성
        const response = await generateSmartResponse(awsStatus, autoSetup, verbose);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
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
                message: `AWS 설정 확인 중 오류: ${errorMessage}`,
                fallback: generateOfflineGuide()
              }, null, 2)
            }
          ]
        };
      }
    }
  );
}

function analyzeUserIntent(message: string): boolean {
  const awsKeywords = ['aws', 'ec2', '배포', 'deploy', '클라우드', 'cloud'];
  const springKeywords = ['spring', 'boot', '스프링', '스프링부트'];
  
  const lowerMessage = message.toLowerCase();
  const hasAwsKeyword = awsKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasSpringKeyword = springKeywords.some(keyword => lowerMessage.includes(keyword));
  
  return hasAwsKeyword || hasSpringKeyword;
}

async function checkCurrentAwsStatus() {
  const status = {
    awsCliInstalled: false,
    awsCliVersion: null as string | null,
    credentialsConfigured: false,
    defaultRegion: null as string | null,
    accountInfo: null as any,
    configPath: null as string | null,
    credentialsPath: null as string | null,
    profiles: [] as string[]
  };

  try {
    // AWS CLI 설치 확인
    const { stdout: versionOutput } = await execAsync('aws --version');
    status.awsCliInstalled = true;
    status.awsCliVersion = versionOutput.trim();
  } catch (error) {
    status.awsCliInstalled = false;
  }

  if (status.awsCliInstalled) {
    try {
      // 자격 증명 확인
      const { stdout: identityOutput } = await execAsync('aws sts get-caller-identity');
      status.credentialsConfigured = true;
      status.accountInfo = JSON.parse(identityOutput);
    } catch (error) {
      status.credentialsConfigured = false;
    }

    try {
      // 기본 리전 확인
      const { stdout: regionOutput } = await execAsync('aws configure get region');
      status.defaultRegion = regionOutput.trim();
    } catch (error) {
      status.defaultRegion = null;
    }

    // 설정 파일 경로 확인
    const homeDir = os.homedir();
    status.configPath = path.join(homeDir, '.aws', 'config');
    status.credentialsPath = path.join(homeDir, '.aws', 'credentials');

    try {
      // 프로필 목록 확인
      const { stdout: profileOutput } = await execAsync('aws configure list-profiles');
      status.profiles = profileOutput.split('\n').filter(p => p.trim());
    } catch (error) {
      status.profiles = ['default'];
    }
  }

  return status;
}

async function generateSmartResponse(awsStatus: any, autoSetup: boolean, verbose: boolean) {
  if (!awsStatus.awsCliInstalled) {
    return generateAwsCliInstallGuide(verbose);
  }

  if (!awsStatus.credentialsConfigured) {
    return generateCredentialsSetupGuide(awsStatus, verbose);
  }

  if (awsStatus.credentialsConfigured) {
    return generateSuccessResponse(awsStatus, verbose);
  }

  return generateTroubleshootingGuide(awsStatus, verbose);
}

function generateAwsCliInstallGuide(verbose: boolean) {
  const guide: any = {
    status: "aws_cli_not_installed",
    title: "🚨 AWS CLI가 설치되지 않았습니다!",
    message: "Spring Boot를 AWS EC2에 배포하려면 먼저 AWS CLI를 설치해야 합니다.",
    quickStart: {
      windows: "winget install Amazon.AWSCLI",
      mac: "brew install awscli",
      linux: "curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
    },
    nextStep: "설치 후 다시 '배포하고 싶어'라고 말씀해주세요!"
  };

  if (verbose) {
    guide.detailedSteps = [
      {
        step: 1,
        title: "AWS CLI 설치",
        description: "운영체제에 맞는 명령어를 실행하세요",
        windows: {
          method1: "winget install Amazon.AWSCLI",
          method2: "https://awscli.amazonaws.com/AWSCLIV2.msi 다운로드 후 설치"
        },
        verification: "aws --version"
      },
      {
        step: 2,
        title: "설치 확인",
        command: "aws --version",
        expectedOutput: "aws-cli/2.x.x Python/3.x.x ..."
      }
    ];
  }

  return guide;
}

function generateCredentialsSetupGuide(awsStatus: any, verbose: boolean) {
  const guide: any = {
    status: "credentials_not_configured",
    title: "🔑 AWS 액세스 키 설정이 필요합니다!",
    message: "AWS에 접근하기 위한 액세스 키를 설정해야 합니다.",
    quickStart: {
      command: "aws configure",
      required: [
        "AWS Access Key ID",
        "AWS Secret Access Key", 
        "Default region name (ap-northeast-2 권장)",
        "Default output format (json 권장)"
      ]
    },
    whereToGetKeys: {
      title: "🏠 AWS 액세스 키는 어디서 가져오나요?",
      steps: [
        "1. AWS 콘솔(https://console.aws.amazon.com)에 로그인",
        "2. 우상단의 계정명 클릭",
        "3. 'Security credentials' 선택",
        "4. 'Access keys' 섹션에서 'Create access key' 클릭",
        "5. 'Command Line Interface (CLI)' 선택 후 'Next'",
        "6. 설명 입력 (예: 'Spring Boot 배포용') 후 'Create access key'",
        "7. Access Key ID와 Secret Access Key 복사 (⚠️ 이 화면에서만 볼 수 있음!)"
      ]
    }
  };

  if (verbose) {
    guide.detailedGuide = {
      securityTips: [
        "🔒 액세스 키는 절대 GitHub 등에 올리지 마세요",
        "🔄 정기적으로 키를 회전(rotation) 하세요",
        "👥 개인 계정과 회사 계정을 분리하세요",
        "⚡ 최소 권한 원칙을 적용하세요"
      ],
      requiredPermissions: [
        "EC2FullAccess (또는 EC2 관련 권한)",
        "IAMReadOnlyAccess (선택사항, 권한 확인용)"
      ],
      configurationExample: {
        "AWS Access Key ID": "AKIAIOSFODNN7EXAMPLE",
        "AWS Secret Access Key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "Default region name": "ap-northeast-2",
        "Default output format": "json"
      }
    };
  }

  return guide;
}

function generateSuccessResponse(awsStatus: any, verbose: boolean) {
  const response: any = {
    status: "ready_to_deploy",
    title: "✅ AWS 설정이 완료되었습니다!",
    message: "Spring Boot 애플리케이션을 EC2에 배포할 준비가 되었습니다.",
    currentSetup: {
      account: awsStatus.accountInfo?.Account,
      arn: awsStatus.accountInfo?.Arn,
      region: awsStatus.defaultRegion || "ap-northeast-2",
      awsCliVersion: awsStatus.awsCliVersion
    },
    nextSteps: [
      "1. Docker 이미지가 준비되었는지 확인",
      "2. 'ec2에 배포해줘'라고 말씀하시면 자동 배포 시작",
      "3. 또는 수동으로 배포 명령어 실행"
    ]
  };

  if (verbose) {
    response.deploymentOptions = {
      automatic: {
        description: "우리의 MCP 도구를 사용한 자동 배포",
        command: "deployToEc2",
        estimatedTime: "5-10분",
        benefits: ["자동 인프라 생성", "에러 처리", "정리 기능"]
      },
      manual: {
        description: "AWS CLI 명령어를 직접 사용",
        estimatedTime: "15-30분",
        benefits: ["세밀한 제어", "학습 효과", "커스터마이징 가능"]
      }
    };

    response.quickHealthCheck = {
      commands: [
        { check: "AWS 연결", command: "aws sts get-caller-identity" },
        { check: "Docker 상태", command: "docker --version" },
        { check: "이미지 확인", command: "docker images" }
      ]
    };
  }

  return response;
}

function generateTroubleshootingGuide(awsStatus: any, verbose: boolean) {
  return {
    status: "needs_troubleshooting",
    title: "🔧 AWS 설정에 문제가 있습니다",
    message: "설정을 다시 확인해보겠습니다.",
    currentStatus: awsStatus,
    commonIssues: [
      {
        problem: "Access Denied 오류",
        solution: "IAM 사용자에게 EC2 권한 부여 필요",
        command: "aws sts get-caller-identity"
      },
      {
        problem: "Region not set",
        solution: "기본 리전 설정",
        command: "aws configure set region ap-northeast-2"
      },
      {
        problem: "Invalid credentials",
        solution: "액세스 키 재설정",
        command: "aws configure"
      }
    ]
  };
}

function generateOfflineGuide() {
  return {
    title: "📖 오프라인 AWS 설정 가이드",
    description: "인터넷 연결 없이도 참고할 수 있는 설정 방법",
    steps: [
      "1. AWS 계정 생성 (aws.amazon.com)",
      "2. IAM 사용자 생성 및 액세스 키 발급",
      "3. AWS CLI 설치",
      "4. aws configure로 설정",
      "5. aws sts get-caller-identity로 확인"
    ]
  };
}
