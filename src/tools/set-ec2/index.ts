import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "child_process";

export function setEc2Settings(server: McpServer) {
  server.tool(
    "setEc2Setting",
    "EC2 인스턴스에 SSH로 접속하여 설정 스크립트를 실행합니다",
    {
      sshKeyPath: z.string(), // EC2에 접근할 SSH 키
      user: z.string().default("ec2-user"),
      host: z.string(),
      setupScript: z.string(), // 전달받은 셋업 스크립트 (bash)
    },
    async ({ sshKeyPath, user, host, setupScript }) => {
      const command = `ssh -i ${sshKeyPath} ${user}@${host} '${setupScript}'`;

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
