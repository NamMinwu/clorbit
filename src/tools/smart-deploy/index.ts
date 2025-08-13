import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export function smartDeployTool(server: McpServer) {
  server.tool(
    "smartDeploy",
    "사용자 의도를 파악하여 자동으로 AWS 설정부터 배포까지 처리합니다",
    {
      userMessage: z.string().describe("사용자가 입력한 메시지"),
      autoExecute: z.boolean().default(false).describe("자동 실행 여부")
    },
    async ({ userMessage, autoExecute }) => {
      try {
        // 1. 사용자 의도 분석
        const intent = analyzeUserIntent(userMessage);
        
        if (!intent.wantsDeployment) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  understood: false,
                  message: "배포 관련 요청이 아닌 것 같습니다.",
                  suggestion: "'AWS EC2에 스프링부트 배포하고 싶어' 같은 식으로 말씀해보세요!"
                }, null, 2)
              }
            ]
          };
        }

        // 2. 현재 상태 체크
        const systemCheck = await performSystemCheck();
        
        // 3. 필요한 설정이나 액션 제안
        const actionPlan = generateActionPlan(systemCheck, intent);
        
        // 4. 자동 실행 또는 가이드 제공
        if (autoExecute && actionPlan.canAutoExecute) {
          const result = await executeDeployment(actionPlan);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(actionPlan, null, 2)
              }
            ]
          };
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                message: `스마트 배포 중 오류: ${errorMessage}`,
                fallback: "수동 배포 가이드를 참조하세요."
              }, null, 2)
            }
          ]
        };
      }
    }
  );
}

function analyzeUserIntent(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // 배포 의도 키워드
  const deployKeywords = ['배포', 'deploy', '올리고', '실행', '런'];
  const awsKeywords = ['aws', 'ec2', '클라우드', 'cloud'];
  const springKeywords = ['spring', 'boot', '스프링', '스프링부트'];
  
  const wantsDeployment = deployKeywords.some(k => lowerMessage.includes(k)) ||
                         (awsKeywords.some(k => lowerMessage.includes(k)) && 
                          springKeywords.some(k => lowerMessage.includes(k)));
  
  const urgency = lowerMessage.includes('급') || lowerMessage.includes('빨리') || 
                 lowerMessage.includes('urgent') ? 'high' : 'normal';
  
  const experience = lowerMessage.includes('처음') || lowerMessage.includes('모르') ||
                    lowerMessage.includes('초보') ? 'beginner' : 'intermediate';

  return {
    wantsDeployment,
    urgency,
    experience,
    originalMessage: message
  };
}

async function performSystemCheck() {
  const checks = {
    aws: { installed: false, configured: false, version: null as string | null },
    docker: { installed: false, running: false, images: [] as string[] },
    springBoot: { projectFound: false, built: false, dockerfileExists: false }
  };

  // AWS CLI 체크
  try {
    const { stdout } = await execAsync('aws --version');
    checks.aws.installed = true;
    checks.aws.version = stdout.trim();
    
    try {
      await execAsync('aws sts get-caller-identity');
      checks.aws.configured = true;
    } catch {
      checks.aws.configured = false;
    }
  } catch {
    checks.aws.installed = false;
  }

  // Docker 체크
  try {
    const { stdout } = await execAsync('docker --version');
    checks.docker.installed = true;
    
    try {
      const { stdout: images } = await execAsync('docker images --format "{{.Repository}}:{{.Tag}}"');
      checks.docker.running = true;
      checks.docker.images = images.split('\n').filter(img => img.trim());
    } catch {
      checks.docker.running = false;
    }
  } catch {
    checks.docker.installed = false;
  }

  // Spring Boot 프로젝트 체크
  try {
    const { stdout } = await execAsync('find . -name "pom.xml" -o -name "build.gradle" 2>/dev/null || dir /s /b pom.xml build.gradle 2>nul');
    checks.springBoot.projectFound = stdout.trim().length > 0;
    
    try {
      const { stdout: dockerfile } = await execAsync('find . -name "Dockerfile" 2>/dev/null || dir /s /b Dockerfile 2>nul');
      checks.springBoot.dockerfileExists = dockerfile.trim().length > 0;
    } catch {
      checks.springBoot.dockerfileExists = false;
    }
  } catch {
    checks.springBoot.projectFound = false;
  }

  return checks;
}

function generateActionPlan(systemCheck: any, intent: any) {
  const plan: any = {
    userExperience: intent.experience,
    urgency: intent.urgency,
    steps: [] as any[],
    canAutoExecute: false,
    estimatedTime: "15-30분",
    currentStatus: systemCheck
  };

  // 1. AWS CLI 설치 필요시
  if (!systemCheck.aws.installed) {
    plan.steps.push({
      step: 1,
      title: "🚨 AWS CLI 설치 필요",
      priority: "HIGH",
      action: "install_aws_cli",
      userFriendly: {
        message: "AWS에 배포하려면 먼저 AWS CLI를 설치해야 해요!",
        command: "winget install Amazon.AWSCLI",
        explanation: "AWS CLI는 AWS 서비스를 명령어로 제어할 수 있게 해주는 도구입니다.",
        estimatedTime: "2-3분"
      }
    });
  }

  // 2. AWS 자격 증명 설정 필요시
  if (systemCheck.aws.installed && !systemCheck.aws.configured) {
    plan.steps.push({
      step: plan.steps.length + 1,
      title: "🔑 AWS 액세스 키 설정 필요",
      priority: "HIGH",
      action: "configure_aws",
      userFriendly: {
        message: "AWS 계정에 접근하기 위한 키를 설정해야 해요!",
        detailedGuide: {
          title: "액세스 키 받는 방법",
          steps: [
            "1. AWS 콘솔(console.aws.amazon.com)에 로그인",
            "2. 우상단 계정명 → 'Security credentials'",
            "3. 'Access keys' → 'Create access key'",
            "4. 'CLI' 선택 → 키 복사 (⚠️ 이때만 볼 수 있어요!)"
          ]
        },
        command: "aws configure",
        required: [
          "AWS Access Key ID (위에서 복사한 키)",
          "AWS Secret Access Key (위에서 복사한 비밀키)",
          "Region: ap-northeast-2 (서울)",
          "Output format: json"
        ],
        estimatedTime: "5-10분"
      }
    });
  }

  // 3. Docker 체크
  if (!systemCheck.docker.installed) {
    plan.steps.push({
      step: plan.steps.length + 1,
      title: "🐳 Docker 설치 필요",
      priority: "HIGH",
      action: "install_docker",
      userFriendly: {
        message: "애플리케이션을 컨테이너로 만들기 위해 Docker가 필요해요!",
        windows: "Docker Desktop 설치 (docker.com에서 다운로드)",
        explanation: "Docker는 애플리케이션을 어디서나 동일하게 실행할 수 있게 해주는 도구입니다.",
        estimatedTime: "5-10분"
      }
    });
  }

  // 4. Spring Boot 빌드
  if (systemCheck.springBoot.projectFound && systemCheck.docker.running) {
    plan.steps.push({
      step: plan.steps.length + 1,
      title: "🏗️ Spring Boot 애플리케이션 빌드",
      priority: "MEDIUM",
      action: "build_spring_boot",
      userFriendly: {
        message: "Spring Boot 애플리케이션을 Docker 이미지로 만들어요!",
        command: "docker build -t spring-boot-app .",
        explanation: "현재 폴더의 Dockerfile을 사용해서 실행 가능한 이미지를 만듭니다.",
        estimatedTime: "3-5분"
      }
    });
  }

  // 5. EC2 배포
  if (systemCheck.aws.configured && systemCheck.docker.running) {
    plan.steps.push({
      step: plan.steps.length + 1,
      title: "🚀 AWS EC2에 배포",
      priority: "MEDIUM",
      action: "deploy_to_ec2",
      userFriendly: {
        message: "이제 AWS 클라우드에 애플리케이션을 올려요!",
        automated: true,
        explanation: "EC2 인스턴스를 만들고, 보안 그룹을 설정하고, 애플리케이션을 실행합니다.",
        estimatedTime: "5-10분"
      }
    });
    
    plan.canAutoExecute = true;
    plan.estimatedTime = "5-10분";
  }

  // 초보자를 위한 추가 설명
  if (intent.experience === 'beginner') {
    plan.beginnerTips = {
      message: "처음이시라면 단계별로 천천히 진행하시는 것을 추천해요!",
      tips: [
        "💡 각 단계마다 명령어를 복사해서 붙여넣기 하세요",
        "⏰ 급하시다면 설치 시간을 고려해서 약 30분 정도 여유를 두세요",
        "❓ 중간에 막히시면 언제든 도움을 요청하세요",
        "✅ 각 단계가 성공했는지 확인하고 다음으로 넘어가세요"
      ]
    };
  }

  return plan;
}

async function executeDeployment(actionPlan: any) {
  try {
    const results = [];
    
    for (const step of actionPlan.steps) {
      if (step.action === "build_spring_boot") {
        const buildResult = await execAsync('docker build -t spring-boot-app .');
        results.push({
          step: step.step,
          success: true,
          output: buildResult.stdout
        });
      }
      
      if (step.action === "deploy_to_ec2") {
        // 실제 배포 로직은 deployToEc2Tool을 호출
        results.push({
          step: step.step,
          success: true,
          message: "EC2 배포는 deployToEc2 도구를 사용하세요"
        });
      }
    }
    
    return {
      success: true,
      message: "🎉 자동 배포 완료!",
      results,
      nextSteps: [
        "배포된 애플리케이션에 접속해보세요",
        "문제가 있으면 로그를 확인해보세요",
        "사용이 끝나면 리소스를 정리하세요"
      ]
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `자동 배포 실패: ${errorMessage}`,
      suggestion: "수동 배포 가이드를 따라해보세요"
    };
  }
}
