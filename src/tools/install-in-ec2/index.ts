import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "child_process";

export function setInstallInEc2(server: McpServer) {
  server.tool(
    "setEc2Setting",
    {
      sshKeyPath: z.string(), // EC2에 접근할 SSH 키
      user: z.string().default("ec2-user"),
      host: z.string(),
      setupScript: z.string().optional(), // 기본 셋업 스크립트를 사용하거나, 사용자 정의 가능
    },
    async ({ sshKeyPath, user, host, setupScript }) => {
      const defaultScript = `
        #!/bin/bash
        set -e

        echo "📦 패키지 업데이트"
        sudo yum update -y

        echo "🐳 Docker 설치"
        sudo yum install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker

        echo "👤 ec2-user를 docker 그룹에 추가"
        sudo usermod -aG docker ec2-user

        echo "🧱 Docker Compose 설치"
        DOCKER_COMPOSE_VERSION="2.24.2"
        sudo curl -L "https://github.com/docker/compose/releases/download/v$DOCKER_COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose

        echo "✅ 모든 설치 완료"
      `.trim();

      const scriptToRun = setupScript || defaultScript;
      const command = `ssh -o StrictHostKeyChecking=no -i ${sshKeyPath} ${user}@${host} '${scriptToRun}'`;

      try {
        const result = execSync(command, { encoding: "utf-8" });
        return {
          content: [{ type: "text", text: `✅ 세팅 완료:\n${result}` }],
        };
      } catch (e: any) {
        return {
          content: [
            { type: "text", text: `❌ 세팅 중 오류:\n${e.message}` },
            { type: "text", text: `실행 명령어:\n${command}` },
          ],
        };
      }
    }
  );
}
