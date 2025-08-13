import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

export interface BuildResult {
  success: boolean;
  buildTool: string;
  outputFile: string;
  buildTime: string;
  error?: string;
}

export function buildApplicationTool(server: McpServer) {
  server.tool(
    "mcp_clorbit_buildApplication",
    {
      projectPath: z.string().default("."),
      buildTool: z.enum(["maven", "gradle", "auto"]).default("auto"),
      skipTests: z.boolean().default(true),
      profile: z.string().optional(),
    },
    async ({ projectPath, buildTool, skipTests, profile }) => {
      try {
        const result = await buildApplication({
          projectPath,
          buildTool,
          skipTests,
          profile
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
              text: `빌드 실패: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}

async function buildApplication(options: {
  projectPath: string;
  buildTool: "maven" | "gradle" | "auto";
  skipTests: boolean;
  profile?: string;
}): Promise<BuildResult> {
  const { projectPath, buildTool, skipTests, profile } = options;
  const startTime = Date.now();

  // Auto-detect build tool
  let detectedBuildTool = buildTool;
  if (buildTool === "auto") {
    if (fs.existsSync(path.join(projectPath, "pom.xml"))) {
      detectedBuildTool = "maven";
    } else if (fs.existsSync(path.join(projectPath, "build.gradle"))) {
      detectedBuildTool = "gradle";
    } else {
      throw new Error("빌드 도구를 찾을 수 없습니다. pom.xml 또는 build.gradle 파일이 필요합니다.");
    }
  }

  let command: string;
  let expectedOutputPath: string;

  if (detectedBuildTool === "maven") {
    const mvnCommand = process.platform === "win32" ? "mvn.cmd" : "mvn";
    command = `${mvnCommand} clean package`;
    
    if (skipTests) {
      command += " -DskipTests";
    }
    
    if (profile) {
      command += ` -P${profile}`;
    }
    
    expectedOutputPath = path.join(projectPath, "target", "*.jar");
  } else {
    // Gradle
    const gradleCommand = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
    command = `${gradleCommand} clean bootJar`;
    
    if (skipTests) {
      command += " -x test";
    }
    
    if (profile) {
      command += ` -Pspring.profiles.active=${profile}`;
    }
    
    expectedOutputPath = path.join(projectPath, "build", "libs", "*.jar");
  }

  try {
    // Execute build command
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectPath,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    const buildTime = `${Math.round((Date.now() - startTime) / 1000)}s`;

    // Find output JAR file
    let outputFile = "";
    try {
      if (detectedBuildTool === "maven") {
        const targetDir = path.join(projectPath, "target");
        if (fs.existsSync(targetDir)) {
          const jarFiles = fs.readdirSync(targetDir).filter(f => f.endsWith(".jar") && !f.includes("sources"));
          if (jarFiles.length > 0) {
            outputFile = path.join("target", jarFiles[0]);
          }
        }
      } else {
        const libsDir = path.join(projectPath, "build", "libs");
        if (fs.existsSync(libsDir)) {
          const jarFiles = fs.readdirSync(libsDir).filter(f => f.endsWith(".jar"));
          if (jarFiles.length > 0) {
            outputFile = path.join("build", "libs", jarFiles[0]);
          }
        }
      }
    } catch (fileError) {
      console.warn("Failed to find output JAR file:", fileError);
    }

    return {
      success: true,
      buildTool: detectedBuildTool,
      outputFile,
      buildTime,
    };

  } catch (error) {
    const buildTime = `${Math.round((Date.now() - startTime) / 1000)}s`;
    
    return {
      success: false,
      buildTool: detectedBuildTool,
      outputFile: "",
      buildTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
