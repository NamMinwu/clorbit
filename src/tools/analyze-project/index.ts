import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export interface ProjectAnalysis {
  projectType: string;
  buildTool: "maven" | "gradle" | "unknown";
  javaVersion: string;
  dependencies: string[];
  hasDockerfile: boolean;
  recommendedDockerfile: "simple" | "multi-stage";
  springBootVersion?: string;
}

export function analyzeProjectTool(server: McpServer) {
  server.tool(
    "mcp_clorbit_analyzeProject",
    {
      projectPath: z.string().default("."),
    },
    async ({ projectPath }) => {
      try {
        const analysis = await analyzeProject(projectPath);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(analysis, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text", 
              text: `프로젝트 분석 실패: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}

async function analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
  const analysis: ProjectAnalysis = {
    projectType: "unknown",
    buildTool: "unknown",
    javaVersion: "17",
    dependencies: [],
    hasDockerfile: false,
    recommendedDockerfile: "simple"
  };

  // Check if Dockerfile exists
  analysis.hasDockerfile = fs.existsSync(path.join(projectPath, "Dockerfile"));

  // Check for Maven
  const pomPath = path.join(projectPath, "pom.xml");
  if (fs.existsSync(pomPath)) {
    analysis.buildTool = "maven";
    analysis.projectType = "java";
    
    try {
      const pomContent = fs.readFileSync(pomPath, "utf-8");
      
      // Extract Spring Boot version
      const springBootMatch = pomContent.match(/<spring-boot-starter-parent>[\s\S]*?<version>(.*?)<\/version>/);
      if (springBootMatch) {
        analysis.springBootVersion = springBootMatch[1];
        analysis.projectType = "spring-boot";
      }
      
      // Extract Java version
      const javaVersionMatch = pomContent.match(/<java\.version>(.*?)<\/java\.version>/);
      if (javaVersionMatch) {
        analysis.javaVersion = javaVersionMatch[1];
      }
      
      // Extract dependencies
      const webDep = pomContent.includes("spring-boot-starter-web");
      const actuatorDep = pomContent.includes("spring-boot-starter-actuator");
      const dataDep = pomContent.includes("spring-boot-starter-data");
      
      if (webDep) analysis.dependencies.push("web");
      if (actuatorDep) analysis.dependencies.push("actuator");
      if (dataDep) analysis.dependencies.push("data");
      
    } catch (error) {
      console.warn("Failed to parse pom.xml:", error);
    }
  }

  // Check for Gradle
  const gradlePath = path.join(projectPath, "build.gradle");
  if (fs.existsSync(gradlePath)) {
    analysis.buildTool = "gradle";
    analysis.projectType = "java";
    
    try {
      const gradleContent = fs.readFileSync(gradlePath, "utf-8");
      
      // Extract Spring Boot version
      const springBootMatch = gradleContent.match(/org\.springframework\.boot.*version\s*['"`](.*?)['"`]/);
      if (springBootMatch) {
        analysis.springBootVersion = springBootMatch[1];
        analysis.projectType = "spring-boot";
      }
      
      // Extract Java version
      const javaVersionMatch = gradleContent.match(/sourceCompatibility\s*=\s*['"`]?(\d+)['"`]?/);
      if (javaVersionMatch) {
        analysis.javaVersion = javaVersionMatch[1];
      }
      
      // Extract dependencies
      const webDep = gradleContent.includes("spring-boot-starter-web");
      const actuatorDep = gradleContent.includes("spring-boot-starter-actuator");
      const dataDep = gradleContent.includes("spring-boot-starter-data");
      
      if (webDep) analysis.dependencies.push("web");
      if (actuatorDep) analysis.dependencies.push("actuator");
      if (dataDep) analysis.dependencies.push("data");
      
    } catch (error) {
      console.warn("Failed to parse build.gradle:", error);
    }
  }

  // Recommend Docker strategy
  if (analysis.projectType === "spring-boot" && analysis.dependencies.length > 1) {
    analysis.recommendedDockerfile = "multi-stage";
  }

  return analysis;
}
