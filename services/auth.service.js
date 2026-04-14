const { v4: uuidv4 } = require("uuid");
const prisma = require("../config/database");
const { hashPassword, comparePassword } = require("../utils/password.util");
const { generateToken, isTokenValid } = require("./jwt.service");
const { createRefreshToken } = require("./refreshToken.service");
const { sendVerificationEmail } = require("./email.service");

// ─── Helper: format User thành UserResponseDTO ─────────────────────────────────
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
 */
async function registerNewUser({ username, email, password, confirmPassword }) {
  if (password !== confirmPassword) {
    throw new Error("Mật khẩu và xác nhận mật khẩu không trùng khớp.");
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    throw new Error("Lỗi: Tên đăng nhập đã được sử dụng!");
  }

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
      isEnabled: false,
      uid: uuidv4(),
      verificationCode,
    },
  });

  await sendVerificationEmail(newUser.email, newUser.username, verificationCode);

  return newUser;
}

/**
 * Xác thực tài khoản qua OTP
 */
async function verifyUser(email, inputCode) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng với email này.");

  if (user.isEnabled) return false;
  if (inputCode !== user.verificationCode) return false;

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

  // ✅ Truyền role vào token để middleware đọc được
  const accessToken = generateToken(user.email, user.role);
  const refreshToken = await createRefreshToken(user.email);

  return {
    accessToken,
    refreshToken,
    user: toUserDTO(user),
  };
}

/**
 * Làm mới Access Token bằng Refresh Token
 */
async function refreshAccessToken(requestRefreshToken) {
  const user = await prisma.user.findFirst({
    where: { refreshToken: requestRefreshToken },
  });

  if (!user) {
    throw new Error("Refresh Token không tồn tại hoặc không chính xác!");
  }

  if (!user.refreshTokenExpiryDate || user.refreshTokenExpiryDate < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: null, refreshTokenExpiryDate: null },
    });
    throw new Error("Refresh Token đã hết hạn. Vui lòng đăng nhập lại.");
  }

  // ✅ Truyền role vào token mới
  const newAccessToken = generateToken(user.email, user.role);
  const newRefreshToken = await createRefreshToken(user.email);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: toUserDTO(user),
  };
}

/**
 * Đăng xuất — xóa refresh token
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
 */
async function processOAuthPostLogin(email, name, avatarUrl) {
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return prisma.user.update({
      where: { email },
      data: {
        avatarUrl,
        ...((!existingUser.username || existingUser.username === "") && { username: name }),
      },
    });
  }

  return prisma.user.create({
    data: {
      email,
      username: name,
      avatarUrl,
      role: "USER",
      provider: "GOOGLE",
      isEnabled: true,
      uid: uuidv4(),
      password: await hashPassword(uuidv4()),
    },
  });
}

/**
 * Đổi mã OTP một lần lấy JWT (sau OAuth2 redirect)
 */
async function exchangeCodeForJwt(code, getEmailForCode) {
  const email = getEmailForCode(code);
  if (!email) throw new Error("Mã không hợp lệ hoặc đã hết hạn.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng với email: " + email);

  // ✅ Truyền role vào token
  const accessToken = generateToken(user.email, user.role);
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