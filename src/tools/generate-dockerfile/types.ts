export interface DockerfileOptions {
  baseImage: string;
  appDir: string;
  startCommand: string;
  framework?: "spring" | "express" | "nextjs" | "python" | "custom";
  port?: number;
  buildCommand?: string;
}
