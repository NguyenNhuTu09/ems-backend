const { decodeToken } = require("../services/jwt.service");

const WHITE_LIST_PATHS = [
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/token/refresh",
  "/api/auth/token/exchange",
  "/api/auth/verify",
  "/oauth2/",
  "/swagger-ui/",
  "/v3/api-docs/",
  "/scalar/",
  "/ws/",
];

/**
 * Đọc JWT từ header, decode email + role, gắn vào req.user
 * Không reject ở đây — để requireAuth / requireRole xử lý
 */
function attachUser(req, res, next) {
  console.log("=== attachUser CALLED ===", req.method, req.path);

  const authHeader = req.headers["authorization"];
  console.log("authHeader:", authHeader);

  if (!authHeader?.startsWith("Bearer ")) return next();

  const token = authHeader.substring(7);
  const decoded = decodeToken(token);
  console.log("decoded:", decoded);

  if (decoded?.sub) {
    req.user = { email: decoded.sub, role: decoded.role ?? null };
    console.log("req.user set:", req.user);
  }

  next();
}
/**
 * Bắt buộc phải đăng nhập — trả 401 nếu chưa có req.user
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: Vui lòng đăng nhập" });
  }
  next();
}

/**
 * Kiểm tra role — trả 403 nếu không đủ quyền
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

module.exports = { attachUser, requireAuth, requireRole };