# Multi-stage Dockerfile for Spring Boot with Maven
FROM eclipse-temurin:17-jdk AS build

WORKDIR /app

# Copy Maven project files
COPY pom.xml .
COPY src ./src

# Build with Maven
RUN apt-get update && apt-get install -y maven && \
    mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create a non-root user
RUN addgroup -S spring && adduser -S spring -G spring

# Copy the built JAR from build stage
COPY --from=build /app/target/app.jar app.jar

# Change ownership to spring user
RUN chown spring:spring app.jar

USER spring:spring

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
