const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10; // BCryptPasswordEncoder mặc định strength = 10

/**
 * Hash mật khẩu
 * Tương đương passwordEncoder.encode(rawPassword)
 */
async function hashPassword(rawPassword) {
  return bcrypt.hash(rawPassword, SALT_ROUNDS);
}

/**
 * So sánh mật khẩu
 * Tương đương passwordEncoder.matches(rawPassword, encodedPassword)
 */
async function comparePassword(rawPassword, hashedPassword) {
  return bcrypt.compare(rawPassword, hashedPassword);
}

module.exports = { hashPassword, comparePassword };