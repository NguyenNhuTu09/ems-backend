const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { apiReference } = require("@scalar/express-api-reference");
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "EMS API Documentation",
      version: "1.0.0",
      description: "Event Management System - API docs (migrated from Spring Boot)",
    },
    servers: [
      {
        url: "http://localhost:8080",
        description: "Local server",
      },
      {
        url: "https://ems-backend-jkjx.onrender.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Nhập Access Token vào đây (không cần 'Bearer ' prefix)",
        },
      },
      schemas: {
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "user@example.com" },
            password: { type: "string", example: "password123" },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["username", "email", "password", "confirmPassword"],
          properties: {
            username: { type: "string", example: "nguyenvana" },
            email: { type: "string", format: "email", example: "user@example.com" },
            password: { type: "string", minLength: 6, example: "password123" },
            confirmPassword: { type: "string", example: "password123" },
          },
        },
        VerifyAccountRequest: {
          type: "object",
          required: ["email", "verificationCode"],
          properties: {
            email: { type: "string", format: "email", example: "user@example.com" },
            verificationCode: { type: "string", example: "924103" },
          },
        },
        TokenExchangeRequest: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string", example: "abc123..." },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            accessToken: { type: "string", example: "eyJhbGci..." },
            refreshToken: { type: "string", example: "abc123..." },
            user: { $ref: "#/components/schemas/UserDTO" },
          },
        },
        UserDTO: {
          type: "object",
          properties: {
            uid: { type: "string", example: "uuid-here" },
            username: { type: "string", example: "nguyenvana" },
            email: { type: "string", example: "user@example.com" },
            address: { type: "string", example: "Ha Noi" },
            gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] },
            dateOfBirth: { type: "string", format: "date", example: "2000-01-01" },
            phoneNumber: { type: "string", example: "0901234567" },
            avatarUrl: { type: "string", example: "https://..." },
            role: { type: "string", enum: ["USER", "ADMIN", "ORGANIZER"] },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Loi xay ra" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [path.join(__dirname, "../controllers/*.js")],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.get("/v3/api-docs", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  app.use("/swagger-ui", swaggerUi.serve);

  app.get(
    "/swagger-ui",
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      swaggerOptions: {
        spec: swaggerSpec,           // Truyền thẳng spec — không fetch lại qua URL
        persistAuthorization: true,  // Giữ token sau khi reload
        displayRequestDuration: true,
        tryItOutEnabled: true,
      },
    })
  );
  app.use("/scalar", apiReference({
    spec: {
      content: swaggerSpec,
    },
  }));
}

module.exports = { setupSwagger };