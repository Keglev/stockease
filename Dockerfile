# Use an official JDK runtime as a parent image
FROM eclipse-temurin:17-jdk

# Set the working directory
WORKDIR /app

# Copy Maven wrapper and project descriptor files
COPY .mvn/ .mvn
COPY mvnw pom.xml ./

# Resolve dependencies before copying the source code
RUN ./mvnw dependency:resolve

# Copy the source code into the container
COPY src ./src

# Build the application
RUN ./mvnw clean package -DskipTests

# Expose port 8081 (since your app runs on this port)
EXPOSE 8081

# Run the application specifying the correct port
CMD ["java", "-jar", "target/*.jar", "--server.port=8081"]

