import { DockerfileOptions } from "./types.js";

export function generateDockerfile({
  baseImage,
  appDir,
  startCommand,
  framework = "custom",
  port,
  buildCommand,
}: DockerfileOptions): string {
  let dockerfile = `FROM ${baseImage}\n`;
  dockerfile += `WORKDIR /${appDir}\n`;
  dockerfile += `COPY . .\n`;

  if (buildCommand) {
    dockerfile += `RUN ${buildCommand}\n`;
  }

  if (port) {
    dockerfile += `EXPOSE ${port}\n`;
  }

  if (startCommand.includes(" ")) {
    dockerfile += `CMD ["sh", "-c", "${startCommand}"]\n`;
  } else {
    dockerfile += `CMD ["${startCommand}"]\n`;
  }

  return dockerfile;
}
