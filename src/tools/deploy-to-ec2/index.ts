import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

export interface DeploymentResult {
  success: boolean;
  instanceId: string;
  publicIp: string;
  deploymentUrl: string;
  securityGroupId: string;
  keyPairName: string;
  error?: string;
}

export function deployToEc2Tool(server: McpServer) {
  server.tool(
    "mcp_clorbit_deployToEc2",
    "Docker 이미지를 AWS EC2에 자동으로 배포합니다 (원본 버전)",
    {
      dockerImage: z.string(),
      instanceType: z.string().default("t2.micro"),
      region: z.string().default("ap-northeast-2"),
      keyPairName: z.string().default("spring-boot-key"),
      securityGroupName: z.string().default("spring-boot-sg"),
      port: z.number().default(8080),
      autoCleanup: z.boolean().default(false),
    },
    async ({ 
      dockerImage, 
      instanceType, 
      region, 
      keyPairName, 
      securityGroupName, 
      port,
      autoCleanup 
    }) => {
      try {
        const result = await deployToEc2({
          dockerImage,
          instanceType,
          region,
          keyPairName,
          securityGroupName,
          port,
          autoCleanup
        });
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text", 
              text: `EC2 배포 실패: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}

async function deployToEc2(options: {
  dockerImage: string;
  instanceType: string;
  region: string;
  keyPairName: string;
  securityGroupName: string;
  port: number;
  autoCleanup: boolean;
}): Promise<DeploymentResult> {
  const { dockerImage, instanceType, region, keyPairName, securityGroupName, port } = options;

  try {
    // 1. Create Key Pair if not exists
    await ensureKeyPair(keyPairName, region);

    // 2. Create Security Group if not exists
    const securityGroupId = await ensureSecurityGroup(securityGroupName, port, region);

    // 3. Create user data script
    const userData = createUserDataScript(dockerImage, port);
    
    // 4. Launch EC2 instance
    const instanceId = await launchEc2Instance({
      instanceType,
      keyPairName,
      securityGroupId,
      userData,
      region
    });

    // 5. Wait for instance to be running
    await waitForInstanceRunning(instanceId, region);

    // 6. Get public IP
    const publicIp = await getInstancePublicIp(instanceId, region);

    // 7. Wait for application to be ready
    await waitForApplicationReady(`http://${publicIp}:${port}`);

    return {
      success: true,
      instanceId,
      publicIp,
      deploymentUrl: `http://${publicIp}:${port}`,
      securityGroupId,
      keyPairName,
    };

  } catch (error) {
    return {
      success: false,
      instanceId: "",
      publicIp: "",
      deploymentUrl: "",
      securityGroupId: "",
      keyPairName: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function ensureKeyPair(keyPairName: string, region: string): Promise<void> {
  try {
    // Check if key pair exists
    await execAsync(`aws ec2 describe-key-pairs --key-names ${keyPairName} --region ${region}`);
  } catch (error) {
    // Key pair doesn't exist, create it
    const { stdout } = await execAsync(
      `aws ec2 create-key-pair --key-name ${keyPairName} --region ${region} --query 'KeyMaterial' --output text`
    );
    
    // Save private key
    fs.writeFileSync(`${keyPairName}.pem`, stdout);
    
    // Set correct permissions on Unix systems
    if (process.platform !== "win32") {
      await execAsync(`chmod 400 ${keyPairName}.pem`);
    }
  }
}

async function ensureSecurityGroup(groupName: string, port: number, region: string): Promise<string> {
  try {
    // Check if security group exists
    const { stdout } = await execAsync(
      `aws ec2 describe-security-groups --group-names ${groupName} --region ${region} --query 'SecurityGroups[0].GroupId' --output text`
    );
    return stdout.trim();
  } catch (error) {
    // Security group doesn't exist, create it
    const { stdout: groupId } = await execAsync(
      `aws ec2 create-security-group --group-name ${groupName} --description "Security group for Spring Boot application" --region ${region} --query 'GroupId' --output text`
    );

    const securityGroupId = groupId.trim();

    // Add HTTP port rule
    await execAsync(
      `aws ec2 authorize-security-group-ingress --group-id ${securityGroupId} --protocol tcp --port ${port} --cidr 0.0.0.0/0 --region ${region}`
    );

    // Add SSH port rule
    await execAsync(
      `aws ec2 authorize-security-group-ingress --group-id ${securityGroupId} --protocol tcp --port 22 --cidr 0.0.0.0/0 --region ${region}`
    );

    return securityGroupId;
  }
}

function createUserDataScript(dockerImage: string, port: number): string {
  return `#!/bin/bash
yum update -y
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Pull and run Docker image
docker pull ${dockerImage}
docker run -d -p ${port}:${port} --name spring-boot-app ${dockerImage}

# Create startup script for auto-restart
cat > /etc/systemd/system/spring-boot.service << EOF
[Unit]
Description=Spring Boot Application
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker start spring-boot-app
ExecStop=/usr/bin/docker stop spring-boot-app
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl enable spring-boot.service
systemctl start spring-boot.service
`;
}

async function launchEc2Instance(options: {
  instanceType: string;
  keyPairName: string;
  securityGroupId: string;
  userData: string;
  region: string;
}): Promise<string> {
  const { instanceType, keyPairName, securityGroupId, userData, region } = options;

  // Encode user data
  const userDataBase64 = Buffer.from(userData).toString('base64');

  // Get latest Amazon Linux 2023 AMI
  const { stdout: amiId } = await execAsync(
    `aws ec2 describe-images --owners amazon --filters "Name=name,Values=al2023-ami-*" "Name=architecture,Values=x86_64" --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' --output text --region ${region}`
  );

  // Launch instance
  const { stdout: instanceId } = await execAsync(
    `aws ec2 run-instances --image-id ${amiId.trim()} --count 1 --instance-type ${instanceType} --key-name ${keyPairName} --security-group-ids ${securityGroupId} --user-data ${userDataBase64} --region ${region} --query 'Instances[0].InstanceId' --output text`
  );

  return instanceId.trim();
}

async function waitForInstanceRunning(instanceId: string, region: string): Promise<void> {
  console.log("인스턴스가 시작될 때까지 대기 중...");
  
  for (let i = 0; i < 30; i++) { // Max 5 minutes
    try {
      const { stdout } = await execAsync(
        `aws ec2 describe-instances --instance-ids ${instanceId} --region ${region} --query 'Reservations[0].Instances[0].State.Name' --output text`
      );
      
      if (stdout.trim() === "running") {
        console.log("인스턴스가 실행 중입니다.");
        return;
      }
    } catch (error) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
  }
  
  throw new Error("인스턴스 시작 시간 초과");
}

async function getInstancePublicIp(instanceId: string, region: string): Promise<string> {
  const { stdout } = await execAsync(
    `aws ec2 describe-instances --instance-ids ${instanceId} --region ${region} --query 'Reservations[0].Instances[0].PublicIpAddress' --output text`
  );
  
  return stdout.trim();
}

async function waitForApplicationReady(url: string): Promise<void> {
  console.log("애플리케이션이 준비될 때까지 대기 중...");
  
  for (let i = 0; i < 60; i++) { // Max 10 minutes
    try {
      const { stdout } = await execAsync(`curl -f ${url}/actuator/health || curl -f ${url}`, {
        timeout: 5000
      });
      
      if (stdout) {
        console.log("애플리케이션이 준비되었습니다.");
        return;
      }
    } catch (error) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
  }
  
  console.warn("애플리케이션 준비 상태 확인 시간 초과 (애플리케이션이 아직 시작 중일 수 있습니다)");
}
