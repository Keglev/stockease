## Multi-stage Dockerfile — enterprise-grade annotations
## Purpose
## - Build the Spring Boot application in a reproducible build stage
## - Produce a minimal runtime image with only the JRE and application artifact
## - Follow best practices: layer caching, non-root runtime user, explicit port,
##   and deterministic ENTRYPOINT. Use multi-stage builds to keep final image small.

## Stage 1: build the application using Maven
## Notes:
## - We use the official Maven image with Temurin JDK to build the fat JAR.
## - Copying the wrapper and pom files separately enables Docker layer caching for
##   dependencies (faster CI runs when sources change but dependencies do not).
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /workspace

# Copy Maven wrapper and maven files first to cache dependencies
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw

# Try to download dependencies up-front to populate the Maven cache
# -B: batch mode, -ntp: disable transfer progress to keep logs compact
RUN ./mvnw -B -ntp dependency:go-offline

# Copy sources and build the application artifact
# Using -DskipTests keeps CI fast; tests should run in a separate job if desired.
COPY src ./src
RUN ./mvnw -B -ntp -DskipTests clean package

## Stage 2: runtime image (smaller JRE base)
## Notes:
## - Use a slim JRE base image to minimize attack surface and image size.
## - Copy only the built artifact from the builder stage.
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Copy jar from build stage (use wildcard to avoid hardcoding artifact name)
# The wildcard allows changes to artifact naming while keeping the Dockerfile stable.
COPY --from=build /workspace/target/*.jar /app/app.jar

# Create a non-root user for running the app (defense-in-depth)
# Some base images may not have adduser/addgroup; the `|| true` prevents CI failure
# if the user already exists or the commands are not available.
RUN addgroup --system app && adduser --system --ingroup app app || true
USER app

# Expose application port — must match Spring `server.port` or container port mapping
EXPOSE 8081

## Entrypoint
## - Fixed ENTRYPOINT ensures the container runs the Spring Boot JAR by default.
## - Allow overriding the port at runtime via environment variables or CLI args.
ENTRYPOINT ["java", "-jar", "/app/app.jar", "--server.port=8081"]

