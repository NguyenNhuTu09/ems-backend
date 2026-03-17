const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "1d";

/**
 * Tạo access token
 * Tương đương jwtService.generateToken(email)
 */
function generateToken(email) {
  return jwt.sign({ sub: email }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

/**
 * Lấy email từ token
 * Tương đương jwtService.getUsernameFromToken(token)
 */
function getUsernameFromToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  return decoded.sub;
}

/**
 * Kiểm tra token có hợp lệ không
 * Tương đương jwtService.isTokenValid(token, userDetails)
 */
function isTokenValid(token, email) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.sub === email;
  } catch {
    return false;
  }
}

module.exports = { generateToken, getUsernameFromToken, isTokenValid };