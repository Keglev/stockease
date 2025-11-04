# StockEase Backend

**Enterprise Stock Management System - Java Spring Boot & PostgreSQL**<!-- Last workflow trigger: 2025-10-30 09:45 UTC -->

## About

StockEase is a backend service for managing stock-related data efficiently. Built with **Spring Boot** and integrated with **PostgreSQL**, this project showcases authentication, role-based access control, and CRUD operations for products.StockEase is a backend service for managing stock-related data efficiently. Built with **Spring Boot** and integrated with **PostgreSQL**, this project showcases authentication, role-based access control, and CRUD operations for products. 

## Description 

This project demonstrates a production-ready backend system for stock inventory management with comprehensive documentation, security architecture, and CI/CD integration. It includes modern technologies, JWT authentication, automated CI/CD pipelines, comprehensive testing, and enterprise-level architectural patterns.

![CI Backend](https://github.com/Keglev/inventory-service/actions/workflows/ci-build.yml/badge.svg) 

**📅 Last Updated:** November 4, 2025 - Updates in Architecture documents

## 📖 Table of Contents

1. [Screenshots](#screenshots)  

2. [Project Status](#project-status)  

3. [Features](#features)  

4. [Security](#security)  

5. [Documentation](#documentation)  

   - [Architecture Overview](#architecture-overview) 

   - [API Integration Guides](#api-integration-guides)

   - [API Documentation Hub](#api-documentation-hub)

6. [Testing & Code Quality](#testing-code-quality)

7. [Tech Stack](#tech-stack)

8. [Environment Profiles](#environment-profiles)

9. [CI/CD](#cicd)

10. [Available Scripts](#available-scripts)

11. [Deployment](#deployment)

12. [Contributing](#contributing)

---

<a id="screenshots"></a>
## Screenshots

Here are some screenshots from Postman showing API responses:

### Adding a Product

<img src="./src/assets/imgs/project-image.png" alt="Adding Product" width="600" height="300"/>

### Example of a missing input from the user.

<img src="./src/assets/imgs/Missingquantity.png" alt="Missing quantity" width="600" height="300"/>

### Updating Product Quantity

<img src="./src/assets/imgs/updateQuantity.png" alt="Update Quantity" width="600" height="300"/>

---

<a id="project-status"></a>
## Project Status 

### ✅ Backend Development - Complete 

- ✅ Enterprise-level documentation with architecture diagrams 

- ✅ Professional API documentation with OpenAPI specifications

- ✅ Complete backend architecture with security patternsReplace placeholders with actual values.

- ✅ Working CI/CD pipeline for build, test, and deployment

- ✅ Controller layer testing architecture complete

- ✅ JWT authentication with role-based access controlUse Maven to build and start the application:

### 📚 Documentation Status 

- ✅ Complete backend architecture documentation

- ✅ Security architecture and patterns

- ✅ Testing strategy documentation

- ✅ Deployment and CI/CD documentation

---

<a id="features"></a>
## 🚀 Features

### 🎯 Core Modules## 🧑‍💻 Available Scripts

- ✅ **Authentication** with JWT (JSON Web Tokens)- `mvn spring-boot:run` - Runs the application.

- ✅ **Role-Based Access Control** (Admin & User roles)- `mvn test` - Runs unit tests with **Mockito**.

- ✅ **Product Management** – CRUD operations, quantity tracking- `mvn package` - Builds the application.

- ✅ **Advanced Querying** – Pagination, filtering, sorting

- ✅ **Stock Calculations** – Total stock value computation 

---

<a id="security"></a>
## 🛡️ Security- 

- **JWT** (JSON Web Token) 

StockEase implements enterprise-grade security with JWT authentication, role-based access control, and secure endpoint protection. All API endpoints are secured with Spring Security, and fine-grained access control uses `@PreAuthorize` annotations for authorization.- **Mockito**  

📖 **[View Security Architecture Documentation](https://keglev.github.io/stockease/architecture/security.html)

---

<a id="documentation"></a>
## 📘 Documentation 

<a id="architecture-overview"></a>
### 🏗️ Architecture Overview 

- **[Index for Backend Architecture Documentation](https://keglev.github.io/stockease/architecture/overview.html)** — Complete architecture documentation with service catalog and design patterns

- **[Deployment Overview](https://keglev.github.io/stockease/architecture/deployment.html)** — Infrastructure, deployment strategy, and environment configuration

---

## 🔗 API Integration

<a id="api-integration-guides"></a>
### 📡 API Integration Guides

This backend provides compreensive documentation for interacting with stock data. 

It also provides: 

- Service patterns and abstractions

- Exception handling and error management

- Data mapping and DTO patterns

- Configuration best practices

- Security patterns and JWT integration

---

<a id="api-documentation-hub"></a>
### 🚀 API Documentation Hub

- **[Interactive API Documentation](https://keglev.github.io/stockease/api-docs.html)** — Complete OpenAPI specification

- **[Authentication Endpoints](https://keglev.github.io/stockease/api-docs.html#tag/Authentication)** — Login, registration, token management

- **[Product Management Endpoints](https://keglev.github.io/stockease/api-docs.html#tag/Products)** — CRUD operations and product queries

---

<a id="testing-code-quality"></a>
## 🧪 Testing & Code Quality

StockEase includes comprehensive testing architecture with automated test execution and code quality analysis:

- **JUnit 5** with Mockito for unit testing
- **Spring MockMvc** for controller layer testing with Spring Security integration
- **Testcontainers** for integration testing with PostgreSQL
- **JaCoCo** for code coverage analysis

📚 **[View Testing Architecture Documentation](https://keglev.github.io/stockease/architecture/testing-architecture.html)**

**📊 Coverage Reports:** 🚧 *Under Construction* - Coverage dashboard coming soon

---
<a id="tech-stack"></a>
## 🧰 Tech Stack

### Backend
- **Java 17+** with **Spring Boot 3.x**
- **Spring Security** (JWT Authentication + Role-Based Access Control)
- **PostgreSQL** for data persistence
- **REST APIs** documented via OpenAPI YAML specifications
- **Docker** containerization with multi-stage builds
- **JUnit 5** + **Mockito** for comprehensive testing
- **JaCoCo** for code coverage reporting

### DevOps & Infrastructure
- **GitHub Actions** for automated CI/CD pipelines
- **Docker** for containerization
- **Koyeb** for serverless container deployment
- **GitHub Pages** for documentation and coverage reporting

---

<a id="environment-profiles"></a>
## 🌐 Environment Profiles

StockEase supports multiple environment configurations:

- `application.properties` — Default configuration for development
- `application-prod.yml` — Production deployment profile (Docker + CI/CD)
- `application-docs.yml` — For updating the docs in gh-branch

---

<a id="cicd"></a>
## CI/CD

StockEase includes automated CI/CD pipelines for continuous integration and deployment:

### 🔄 Automated Pipelines

**Backend Build & Deployment:**
- ✅ Builds and tests Spring Boot application using Maven
- ✅ Runs comprehensive test suite with code coverage
- ✅ Generates and publishes documentation to GitHub Pages
- ✅ Builds Docker image and deploys to Koyeb
- ✅ Automated health checks and service verification

> 📖 **[View CI/CD Pipeline Documentation](https://keglev.github.io/stockease/architecture/deployment/ci-pipeline.html)**

---

<a id="available-scripts"></a>
## 🧑‍💻 Available Scripts

Common commands for development and deployment:

- **`./mvnw spring-boot:run`** — Runs the application in development mode
- **`./mvnw test`** — Executes the complete test suite with coverage
- **`./mvnw verify`** — Builds and verifies the application package
- **`./mvnw clean package`** — Creates production-ready JAR file

---

<a id="deployment"></a>
## Deployment

### Production Deployment

StockEase is deployed to Koyeb, a serverless container platform:

**Deployment Features:**
- ✅ **Automated CI/CD**: Push to main → Automatic build, test, and deployment
- ✅ **Container Deployment**: Docker image builds and deploys via GitHub Actions
- ✅ **Health Checks**: Automated service verification after deployment
- ✅ **Live Service**: Deployed and monitoring at [StockEase Backend](https://stockease-backend.koyeb.app)

**Deployment Architecture:**

GitHub Push → Build & Test → Docker Build → Push to Registry → Koyeb Deploy → Health Verification

> 📖 **[View Complete Deployment Strategy](https://keglev.github.io/stockease/architecture/deployment.html)**

---
<a id="contributing"></a>
## 🤝 Contributing

Contributions are welcome! To improve this project:

1. Fork the repository
2. Create a new branch for your feature
3. Make your changes
4. Submit a pull request

For issues or feature requests, please [open a GitHub issue](https://github.com/Keglev/stockease/issues).

---

**Last Updated:** November 4, 2025  
**Repository:** [Keglev/stockease](https://github.com/Keglev/stockease)
