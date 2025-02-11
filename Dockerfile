# Use an official JDK runtime as a parent image
FROM eclipse-temurin:17-jdk

# Set the working directory
WORKDIR /app

# Copy Maven wrapper and project descriptor files
COPY .mvn/ .mvn
COPY mvnw pom.xml ./

# Grant execute permissions to Maven Wrapper
RUN chmod +x mvnw

# Resolve dependencies before copying the source code
RUN ./mvnw dependency:resolve

# Copy the source code into the container
COPY src ./src

# Build the application (ensure JAR is generated in target/)
RUN ./mvnw clean package -DskipTests

# Set an explicit variable for the jar file
ARG JAR_FILE=target/*.jar

# Copy the JAR file to the container
RUN ls -la target  # Debugging: Check if JAR is built
RUN cp target/stockease-0.0.1-SNAPSHOT.jar /app/app.jar

# Expose port 8081 (since your app runs on this port)
EXPOSE 8081

# Run the application specifying the correct port
CMD ["java", "-jar", "app.jar", "--server.port=8081"]

