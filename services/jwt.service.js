const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "1d";

// Thêm tạm vào đầu jwt.service.js
console.log("JWT_SECRET loaded:", !!process.env.JWT_SECRET);

/**
 * Tạo access token — bao gồm cả role trong payload
 */
function generateToken(email, role) {
  return jwt.sign({ sub: email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

/**
 * Lấy email từ token
 */
function getUsernameFromToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.sub;
  } catch {
    return null;
  }
}

/**
 * Decode toàn bộ payload (email + role)
 */
function decodeToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET); // { sub, role, iat, exp }
  } catch {
    return null;
  }
}

/**
 * Kiểm tra token có hợp lệ không
 */
function isTokenValid(token, email) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.sub === email;
  } catch {
    return false;
  }
}

module.exports = { generateToken, getUsernameFromToken, decodeToken, isTokenValid };