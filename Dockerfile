## Multi-stage Dockerfile
## Stage 1: build the application using Maven
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /workspace

# Copy Maven wrapper and maven files first to cache dependencies
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw

# Try to download dependencies (offline/parallel friendly)
RUN ./mvnw -B -ntp dependency:go-offline

# Copy sources and build the app
COPY src ./src
RUN ./mvnw -B -ntp -DskipTests clean package

## Stage 2: runtime image (smaller JRE base)
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Copy jar from build stage (use wildcard to avoid hardcoding artifact name)
COPY --from=build /workspace/target/*.jar /app/app.jar

# Create a non-root user for running the app
RUN addgroup --system app && adduser --system --ingroup app app || true
USER app

# Expose application port
EXPOSE 8081

# Use a fixed entrypoint; allow overriding server.port via env or args
ENTRYPOINT ["java", "-jar", "/app/app.jar", "--server.port=8081"]

