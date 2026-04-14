require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const passport = require("passport");

const corsOptions = require("./config/cors");
const { initWebSocket } = require("./config/websocket");
const { initPassport, oauth2SuccessHandler } = require("./config/oauth2");
const { attachUser } = require("./middlewares/auth.middleware");
const prisma = require("./config/database");
const { setupSwagger } = require("./config/swagger");

const app = express();
const httpServer = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.body === undefined && req.method !== 'GET') {
    let raw = ''; 
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        req.body = JSON.parse(raw);
      } catch {
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
});

// ─── 2. CORS ─────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));

// ─── 3. Passport OAuth2 ──────────────────────────────────────────────────────
initPassport();
app.use(passport.initialize());

// ─── 4. JWT Middleware ───────────────────────────────────────────────────────
app.use(attachUser);

// ─── 5. WebSocket ────────────────────────────────────────────────────────────
const io = initWebSocket(httpServer);
app.set("io", io);

// ─── 6. Swagger ──────────────────────────────────────────────────────────────
setupSwagger(app);

// ─── 7. OAuth2 Routes ────────────────────────────────────────────────────────
app.get(
  "/oauth2/authorization/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get(
  "/oauth2/callback/google",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  oauth2SuccessHandler
);

// ─── 8. API Routes ───────────────────────────────────────────────────────────
const authRouter = require("./controllers/auth.controller");
app.use("/api/auth", authRouter);

const userRouter = require("./controllers/user.controller");
app.use("/api/users", userRouter);

const organizerRouter = require("./controllers/organizer.controller");
app.use("/api/organizers", organizerRouter);

const presenterRouter = require("./controllers/presenter.controller");
app.use("/api/presenters", presenterRouter);

const eventRouter = require("./controllers/event.controller");
app.use("/api/events", eventRouter);

const activityCategoryRouter = require("./controllers/activity-category.controller");
app.use("/api/activity-categories", activityCategoryRouter);

const activityRouter = require("./controllers/activity.controller");
app.use("/api/activities", activityRouter);

// ─── 9. 404 Handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route không tồn tại" });
});

// ─── 10. Global Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path} | Origin: ${req.headers.origin}`);
  next();
});

// ─── 11. Start Server ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log("✅ Kết nối TiDB Cloud thành công");
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
      console.log(`📄 Scalar UI: http://localhost:${PORT}/scalar`);
    });
  } catch (err) {
    console.error("❌ Không thể kết nối database:", err.message);
    process.exit(1);
  }
}

bootstrap();

module.exports = { app, io };