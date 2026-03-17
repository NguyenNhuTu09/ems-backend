const { getUsernameFromToken, isTokenValid } = require("../services/jwt.service");
const WHITE_LIST_PATHS =[
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/token/refresh",
  "/api/auth/token/exchange",
  "/api/auth/verify",
  "/oauth2/",
  "/swagger-ui/",
  "/v3/api-docs/",
  "/ws/",
];

async function attachUser(req, res, next) {
  console.log("[attachUser] path:", req.path);
  console.log("[attachUser] auth header:", req.headers["authorization"]);
  const path = req.path;

  const isWhitelisted = WHITE_LIST_PATHS.some((p) => path.startsWith(p));
  if (isWhitelisted) return next();

  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) return next();

  const token = authHeader.substring(7);

  try {
    const email = getUsernameFromToken(token);
    if (email) {
      req.user = { email }; // Gắn user vào request
    }
  } catch (err) {
    console.error("JWT verification failed:", err.message);
  }

  next();
}

/**
 * Middleware bắt buộc phải đăng nhập (401 nếu chưa login)
 * Tương đương .anyRequest().authenticated() trong SecurityConfig
 *
 * Dùng cho từng router:
 *   router.use(requireAuth)
 * Hoặc từng route:
 *   router.get("/profile", requireAuth, handler)
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: Vui lòng đăng nhập" });
  }
  next();
}

/**
 * Middleware kiểm tra role
 * Tương đương @PreAuthorize("hasRole('ADMIN')") trong Spring
 *
 * Ví dụ: router.delete("/admin/x", requireAuth, requireRole("ADMIN"), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Không có quyền truy cập" });
    }
    next();
  };
}

// ─── Danh sách PUBLIC routes (tham khảo từ SecurityConfig.java) ────────────────
//
// Các route này KHÔNG cần requireAuth, chỉ cần attachUser:
//
//   GET  /api/events/public
//   GET  /api/events/featured
//   GET  /api/events/upcoming-selected
//   GET  /api/events/:slug
//   GET  /api/presenters
//   GET  /api/presenters/search
//   GET  /api/presenters/featured
//   GET  /api/presenters/:presenterId
//   GET  /api/presenters/by-organizer/:slug
//   GET  /api/activities/:activityId
//   GET  /api/activities/search
//   GET  /api/activities/by-event/:eventId
//   GET  /api/posts
//   GET  /api/posts/:slug
//   POST /api/auth/**
//   POST /api/users/forgot-password
//   POST /api/users/reset-password
//   GET  /api/users/verify
//
// Route yêu cầu đăng nhập:
//   POST /api/auth/logout  → requireAuth bắt buộc
//   Tất cả route còn lại   → thêm requireAuth vào router

module.exports = { attachUser, requireAuth, requireRole };