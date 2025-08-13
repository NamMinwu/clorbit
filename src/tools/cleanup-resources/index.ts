import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

export interface CleanupResult {
  success: boolean;
  cleanedResources: string[];
  errors: string[];
}

export function cleanupResourcesTool(server: McpServer) {
  server.tool(
    "mcp_clorbit_cleanup",
    {
      instanceId: z.string().optional(),
      securityGroupId: z.string().optional(),
      keyPairName: z.string().optional(),
      region: z.string().default("ap-northeast-2"),
      cleanupAll: z.boolean().default(false),
    },
    async ({ instanceId, securityGroupId, keyPairName, region, cleanupAll }) => {
      try {
        const result = await cleanupResources({
          instanceId,
          securityGroupId,
          keyPairName,
          region,
          cleanupAll
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
              text: `리소스 정리 실패: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}

async function cleanupResources(options: {
  instanceId?: string;
  securityGroupId?: string;
  keyPairName?: string;
  region: string;
  cleanupAll: boolean;
}): Promise<CleanupResult> {
  const { instanceId, securityGroupId, keyPairName, region, cleanupAll } = options;
  const cleanedResources: string[] = [];
  const errors: string[] = [];

  try {
    // If cleanupAll is true, discover resources automatically
    if (cleanupAll) {
      await cleanupAllSpringBootResources(region, cleanedResources, errors);
    } else {
      // Clean up specific resources
      if (instanceId) {
        await cleanupInstance(instanceId, region, cleanedResources, errors);
      }

      if (securityGroupId) {
        await cleanupSecurityGroup(securityGroupId, region, cleanedResources, errors);
      }

      if (keyPairName) {
        await cleanupKeyPair(keyPairName, region, cleanedResources, errors);
      }
    }

    return {
      success: errors.length === 0,
      cleanedResources,
      errors
    };

  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      success: false,
      cleanedResources,
      errors
    };
  }
}

async function cleanupAllSpringBootResources(
  region: string,
  cleanedResources: string[],
  errors: string[]
): Promise<void> {
  try {
    // Find all Spring Boot related instances
    const { stdout: instanceIds } = await execAsync(
      `aws ec2 describe-instances --filters "Name=tag:Name,Values=*spring-boot*" "Name=instance-state-name,Values=running,stopped" --query 'Reservations[].Instances[].InstanceId' --output text --region ${region}`
    );

    if (instanceIds.trim()) {
      const instances = instanceIds.trim().split(/\s+/);
      for (const instanceId of instances) {
        await cleanupInstance(instanceId, region, cleanedResources, errors);
      }
    }

    // Find and cleanup security groups
    try {
      const { stdout: securityGroups } = await execAsync(
        `aws ec2 describe-security-groups --filters "Name=group-name,Values=*spring-boot*" --query 'SecurityGroups[].GroupId' --output text --region ${region}`
      );

      if (securityGroups.trim()) {
        const groups = securityGroups.trim().split(/\s+/);
        for (const groupId of groups) {
          await cleanupSecurityGroup(groupId, region, cleanedResources, errors);
        }
      }
    } catch (error) {
      // Security groups might not exist
    }

    // Find and cleanup key pairs
    try {
      const { stdout: keyPairs } = await execAsync(
        `aws ec2 describe-key-pairs --filters "Name=key-name,Values=*spring-boot*" --query 'KeyPairs[].KeyName' --output text --region ${region}`
      );

      if (keyPairs.trim()) {
        const keys = keyPairs.trim().split(/\s+/);
        for (const keyName of keys) {
          await cleanupKeyPair(keyName, region, cleanedResources, errors);
        }
      }
    } catch (error) {
      // Key pairs might not exist
    }

  } catch (error) {
    errors.push(`자동 리소스 검색 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function cleanupInstance(
  instanceId: string,
  region: string,
  cleanedResources: string[],
  errors: string[]
): Promise<void> {
  try {
    // Terminate instance
    await execAsync(`aws ec2 terminate-instances --instance-ids ${instanceId} --region ${region}`);
    cleanedResources.push(`EC2 Instance: ${instanceId}`);

    // Wait for termination
    console.log(`인스턴스 ${instanceId} 종료 중...`);
    for (let i = 0; i < 30; i++) { // Max 5 minutes
      try {
        const { stdout } = await execAsync(
          `aws ec2 describe-instances --instance-ids ${instanceId} --region ${region} --query 'Reservations[0].Instances[0].State.Name' --output text`
        );
        
        if (stdout.trim() === "terminated") {
          console.log(`인스턴스 ${instanceId} 종료 완료`);
          break;
        }
      } catch (error) {
        // Instance might be already terminated
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }

  } catch (error) {
    errors.push(`인스턴스 ${instanceId} 정리 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function cleanupSecurityGroup(
  securityGroupId: string,
  region: string,
  cleanedResources: string[],
  errors: string[]
): Promise<void> {
  try {
    // Check if security group is in use
    try {
      const { stdout } = await execAsync(
        `aws ec2 describe-instances --filters "Name=instance.group-id,Values=${securityGroupId}" "Name=instance-state-name,Values=running,pending,shutting-down,stopping" --query 'Reservations[].Instances[].InstanceId' --output text --region ${region}`
      );
      
      if (stdout.trim()) {
        errors.push(`보안 그룹 ${securityGroupId}이 여전히 사용 중입니다. 인스턴스를 먼저 종료하세요.`);
        return;
      }
    } catch (error) {
      // Continue with deletion
    }

    // Delete security group
    await execAsync(`aws ec2 delete-security-group --group-id ${securityGroupId} --region ${region}`);
    cleanedResources.push(`Security Group: ${securityGroupId}`);

  } catch (error) {
    errors.push(`보안 그룹 ${securityGroupId} 정리 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function cleanupKeyPair(
  keyPairName: string,
  region: string,
  cleanedResources: string[],
  errors: string[]
): Promise<void> {
  try {
    // Delete key pair from AWS
    await execAsync(`aws ec2 delete-key-pair --key-name ${keyPairName} --region ${region}`);
    cleanedResources.push(`Key Pair: ${keyPairName}`);

    // Delete local private key file
    const keyFile = `${keyPairName}.pem`;
    if (fs.existsSync(keyFile)) {
      fs.unlinkSync(keyFile);
      cleanedResources.push(`Local Key File: ${keyFile}`);
    }

  } catch (error) {
    errors.push(`키 페어 ${keyPairName} 정리 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}
