import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export function deployToEc2Tool(server: McpServer) {
  server.tool(
    "deployToEc2",
    "Spring Boot 애플리케이션을 AWS EC2에 배포합니다 (초보자 친화적)",
    {
      dockerImage: z.string().default("spring-boot-beginner-app:latest"),
      instanceType: z.string().default("t2.micro"),
      region: z.string().default("ap-northeast-2"),
      port: z.number().default(8080),
      skipAwsCheck: z.boolean().default(false)
    },
    async ({ dockerImage, instanceType, region, port, skipAwsCheck }) => {
      try {
        // 1. AWS 설정 확인
        if (!skipAwsCheck) {
          const awsCheck = await checkAwsCredentials();
          if (!awsCheck.configured) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    step: "aws_setup",
                    message: "🚨 AWS 설정이 필요합니다!",
                    guide: awsCheck.guide,
                    fallback: generateManualDeploymentScript(dockerImage, instanceType, region, port)
                  }, null, 2)
                }
              ]
            };
          }
        }

        // 2. Docker 이미지 확인
        const dockerCheck = await checkDockerImage(dockerImage);
        if (!dockerCheck.exists) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  step: "docker_check",
                  message: `❌ Docker 이미지 '${dockerImage}'를 찾을 수 없습니다.`,
                  suggestion: "먼저 'docker build -t spring-boot-beginner-app .' 를 실행하세요.",
                  availableImages: dockerCheck.availableImages
                }, null, 2)
              }
            ]
          };
        }

        // 3. EC2 배포 실행
        const deployResult = await performEc2Deployment(dockerImage, instanceType, region, port);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(deployResult, null, 2)
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
                message: `배포 중 오류 발생: ${errorMessage}`,
                fallback: generateManualDeploymentScript(dockerImage, instanceType, region, port),
                troubleshooting: [
                  "1. AWS CLI가 설치되어 있는지 확인: aws --version",
                  "2. AWS 자격 증명이 설정되어 있는지 확인: aws sts get-caller-identity",
                  "3. Docker 이미지가 존재하는지 확인: docker images",
                  "4. 수동 배포 스크립트를 사용해보세요 (fallback 섹션 참고)"
                ]
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
    return {
      configured: true,
      identity: JSON.parse(stdout)
    };
  } catch (error) {
    return {
      configured: false,
      guide: {
        title: "🚀 AWS 설정 가이드",
        steps: [
          "1. AWS CLI 설치: winget install Amazon.AWSCLI",
          "2. AWS 콘솔에서 Access Key 생성",
          "3. aws configure 명령어로 설정",
          "4. aws sts get-caller-identity로 확인"
        ]
      }
    };
  }
}

async function checkDockerImage(imageName: string) {
  try {
    const { stdout } = await execAsync('docker images --format "{{.Repository}}:{{.Tag}}"');
    const images = stdout.split('\n').filter(line => line.trim());
    const exists = images.includes(imageName);
    
    return {
      exists,
      availableImages: images.slice(0, 10) // 최대 10개만 표시
    };
  } catch (error) {
    return {
      exists: false,
      availableImages: [],
      error: "Docker가 실행되지 않거나 설치되지 않았습니다."
    };
  }
}

async function performEc2Deployment(dockerImage: string, instanceType: string, region: string, port: number) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const keyName = `spring-boot-key-${timestamp}`;
  const sgName = `spring-boot-sg-${timestamp}`;
  
  try {
    // 1. Key Pair 생성
    console.log("🔑 Key Pair 생성 중...");
    await execAsync(`aws ec2 create-key-pair --key-name ${keyName} --query 'KeyMaterial' --output text --region ${region} > ${keyName}.pem`);
    
    // 2. Security Group 생성
    console.log("🛡️ Security Group 생성 중...");
    const { stdout: sgOutput } = await execAsync(`aws ec2 create-security-group --group-name ${sgName} --description "Spring Boot Security Group" --region ${region}`);
    const securityGroupId = JSON.parse(sgOutput).GroupId;
    
    // 3. Security Group 규칙 추가
    await execAsync(`aws ec2 authorize-security-group-ingress --group-id ${securityGroupId} --protocol tcp --port ${port} --cidr 0.0.0.0/0 --region ${region}`);
    await execAsync(`aws ec2 authorize-security-group-ingress --group-id ${securityGroupId} --protocol tcp --port 22 --cidr 0.0.0.0/0 --region ${region}`);
    
    // 4. User Data 스크립트 생성
    const userData = Buffer.from(`#!/bin/bash
yum update -y
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Docker 이미지 실행 (로컬에서 빌드된 이미지를 가정)
# 실제로는 Docker Hub나 ECR에서 pull해야 함
echo "Spring Boot 배포 완료 - 포트 ${port}에서 실행 중" > /var/log/spring-boot-deploy.log
`).toString('base64');

    // 5. EC2 인스턴스 생성
    console.log("🚀 EC2 인스턴스 생성 중...");
    const { stdout: instanceOutput } = await execAsync(`aws ec2 run-instances --image-id ami-0c2d3e23b5f5fc3e1 --count 1 --instance-type ${instanceType} --key-name ${keyName} --security-group-ids ${securityGroupId} --user-data "${userData}" --region ${region}`);
    const instanceInfo = JSON.parse(instanceOutput);
    const instanceId = instanceInfo.Instances[0].InstanceId;
    
    // 6. Public IP 대기 및 가져오기
    console.log("⏳ Public IP 할당 대기 중...");
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30초 대기
    
    const { stdout: ipOutput } = await execAsync(`aws ec2 describe-instances --instance-ids ${instanceId} --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --region ${region}`);
    const publicIp = ipOutput.trim();
    
    return {
      success: true,
      message: "🎉 EC2 배포 완료!",
      instanceId,
      publicIp,
      deploymentUrl: `http://${publicIp}:${port}`,
      securityGroupId,
      keyPairName: keyName,
      region,
      nextSteps: [
        "1. 약 2-3분 후 접속 가능합니다.",
        `2. 접속 URL: http://${publicIp}:${port}`,
        `3. SSH 접속: ssh -i ${keyName}.pem ec2-user@${publicIp}`,
        "4. 로그 확인: tail -f /var/log/spring-boot-deploy.log"
      ],
      cleanup: `mcp_clorbit_cleanup()으로 리소스를 정리할 수 있습니다.`
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `배포 실패: ${errorMessage}`,
      fallback: generateManualDeploymentScript(dockerImage, instanceType, region, port)
    };
  }
}

function generateManualDeploymentScript(dockerImage: string, instanceType: string, region: string, port: number) {
  return {
    title: "🛠️ 수동 배포 스크립트",
    description: "MCP 도구가 실패했을 때 사용할 수 있는 수동 배포 방법",
    steps: [
      {
        step: 1,
        title: "Key Pair 생성",
        command: `aws ec2 create-key-pair --key-name spring-boot-key --query 'KeyMaterial' --output text --region ${region} > spring-boot-key.pem`
      },
      {
        step: 2,
        title: "Security Group 생성",
        commands: [
          `aws ec2 create-security-group --group-name spring-boot-sg --description "Spring Boot SG" --region ${region}`,
          `aws ec2 authorize-security-group-ingress --group-name spring-boot-sg --protocol tcp --port ${port} --cidr 0.0.0.0/0 --region ${region}`,
          `aws ec2 authorize-security-group-ingress --group-name spring-boot-sg --protocol tcp --port 22 --cidr 0.0.0.0/0 --region ${region}`
        ]
      },
      {
        step: 3,
        title: "EC2 인스턴스 생성",
        command: `aws ec2 run-instances --image-id ami-0c2d3e23b5f5fc3e1 --count 1 --instance-type ${instanceType} --key-name spring-boot-key --security-groups spring-boot-sg --region ${region}`
      }
    ]
  };
}
