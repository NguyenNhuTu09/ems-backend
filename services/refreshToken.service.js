const crypto = require("crypto");
const prisma = require("../config/database");

const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS) || 7;

/**
 * Tạo và lưu refresh token vào user
 * Tương đương refreshTokenService.createRefreshToken(email)
 */
async function createRefreshToken(email) {
  const token = crypto.randomBytes(64).toString("hex");

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.user.update({
    where: { email },
    data: {
      refreshToken: token,
      refreshTokenExpiryDate: expiryDate,
    },
  });

  return token;
}

/**
 * Xóa refresh token khi logout
 */
async function revokeRefreshToken(email) {
  await prisma.user.update({
    where: { email },
    data: { refreshToken: null, refreshTokenExpiryDate: null },
  });
}

module.exports = { createRefreshToken, revokeRefreshToken };