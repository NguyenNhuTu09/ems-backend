const { v4: uuidv4 } = require("uuid");
const prisma = require("../config/database");
const { hashPassword, comparePassword } = require("../utils/password.util");
const { generateToken, isTokenValid } = require("./jwt.service");
const { createRefreshToken } = require("./refreshToken.service");
const { sendVerificationEmail } = require("./email.service");

// ─── Helper: format User thành UserResponseDTO ─────────────────────────────────
// Tương đương new UserResponseDTO(...) trong Spring
function toUserDTO(user) {
  return {
    uid: user.uid,
    username: user.username,
    email: user.email,
    address: user.address,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    phoneNumber: user.phoneNumber,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

// ─── Helper: tạo OTP 6 số ──────────────────────────────────────────────────────
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Đăng ký người dùng mới
 * Tương đương registerNewUser() trong AuthService.java
 */
async function registerNewUser({ username, email, password, confirmPassword }) {
  // Kiểm tra confirm password (Joi đã validate, nhưng giữ lại để an toàn)
  if (password !== confirmPassword) {
    throw new Error("Mật khẩu và xác nhận mật khẩu không trùng khớp.");
  }

  // Kiểm tra username đã tồn tại
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    throw new Error("Lỗi: Tên đăng nhập đã được sử dụng!");
  }

  // Kiểm tra email đã tồn tại
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new Error("Lỗi: Email đã được sử dụng!");
  }

  const hashedPassword = await hashPassword(password);
  const verificationCode = generateOTP();

  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      role: "USER",
      provider: "LOCAL",
      isEnabled: false,       // Chưa kích hoạt — tương đương setEnabled(false)
      uid: uuidv4(),
      verificationCode,
    },
  });

  // Gửi email xác thực
  await sendVerificationEmail(newUser.email, newUser.username, verificationCode);

  return newUser;
}

/**
 * Xác thực tài khoản qua OTP
 * Tương đương verifyUser() trong AuthService.java
 */
async function verifyUser(email, inputCode) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng với email này.");

  if (user.isEnabled) return false; // Đã kích hoạt rồi

  if (inputCode !== user.verificationCode) return false; // Mã sai

  await prisma.user.update({
    where: { email },
    data: {
      isEnabled: true,
      verificationCode: null,
    },
  });

  return true;
}

/**
 * Đăng nhập
 * Tương đương authenticateUser() trong AuthService.java
 */
async function authenticateUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("Email hoặc mật khẩu không chính xác.");
  }

  if (!user.isEnabled) {
    throw new Error("Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email.");
  }

  if (!user.password) {
    throw new Error("Tài khoản này đăng nhập qua Google. Vui lòng dùng Google để đăng nhập.");
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    throw new Error("Email hoặc mật khẩu không chính xác.");
  }

  const accessToken = generateToken(user.email);
  const refreshToken = await createRefreshToken(user.email);

  return {
    accessToken,
    refreshToken,
    user: toUserDTO(user),
  };
}

/**
 * Làm mới Access Token bằng Refresh Token
 * Tương đương refreshToken() trong AuthService.java
 */
async function refreshAccessToken(requestRefreshToken) {
  const user = await prisma.user.findFirst({
    where: { refreshToken: requestRefreshToken },
  });

  if (!user) {
    throw new Error("Refresh Token không tồn tại hoặc không chính xác!");
  }

  if (!user.refreshTokenExpiryDate || user.refreshTokenExpiryDate < new Date()) {
    // Xóa token hết hạn
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: null, refreshTokenExpiryDate: null },
    });
    throw new Error("Refresh Token đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const newAccessToken = generateToken(user.email);
  const newRefreshToken = await createRefreshToken(user.email);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: toUserDTO(user),
  };
}

/**
 * Đăng xuất — xóa refresh token
 * Tương đương logout() trong AuthService.java
 */
async function logout(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng với email: " + email);

  await prisma.user.update({
    where: { email },
    data: { refreshToken: null, refreshTokenExpiryDate: null },
  });
}

/**
 * Xử lý đăng nhập OAuth2 (Google)
 * Tương đương processOAuthPostLogin() trong AuthService.java
 */
async function processOAuthPostLogin(email, name, avatarUrl) {
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    // Cập nhật avatar và username nếu thiếu
    return prisma.user.update({
      where: { email },
      data: {
        avatarUrl,
        ...((!existingUser.username || existingUser.username === "") && { username: name }),
      },
    });
  }

  // Tạo user mới từ Google
  return prisma.user.create({
    data: {
      email,
      username: name,
      avatarUrl,
      role: "USER",
      provider: "GOOGLE",
      isEnabled: true,
      uid: uuidv4(),
      password: await hashPassword(uuidv4()), // Random password không dùng được
    },
  });
}

/**
 * Đổi mã OTP một lần lấy JWT (sau OAuth2 redirect)
 * Tương đương exchangeCodeForJwt() trong AuthService.java
 *
 * @param {string} code  — one-time code
 * @param {Function} getEmailForCode  — từ oneTimeCodeService
 */
async function exchangeCodeForJwt(code, getEmailForCode) {
  const email = getEmailForCode(code);
  if (!email) throw new Error("Mã không hợp lệ hoặc đã hết hạn.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng với email: " + email);

  const accessToken = generateToken(user.email);
  const refreshToken = await createRefreshToken(user.email);

  return {
    accessToken,
    refreshToken,
    user: toUserDTO(user),
  };
}

module.exports = {
  registerNewUser,
  verifyUser,
  authenticateUser,
  refreshAccessToken,
  logout,
  processOAuthPostLogin,
  exchangeCodeForJwt,
};