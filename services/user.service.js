const prisma = require("../config/database");
const { hashPassword, comparePassword } = require("../utils/password.util");
const {
  sendPasswordChangedEmail,
  sendForgotPasswordEmail,
} = require("./email.service");

// ─── Helper: format User → UserResponseDTO ────────────────────────────────────
// Tương đương convertToDto() trong UserServiceImpl.java
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

// ─── Helper: tạo OTP 6 số ─────────────────────────────────────────────────────
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Lấy danh sách tất cả người dùng
 * Tương đương getAllUsers() trong UserServiceImpl.java
 */
async function getAllUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });
  return users.map(toUserDTO);
}

/**
 * Lấy thông tin người dùng theo UID
 * Tương đương getUserById() trong UserServiceImpl.java
 */
async function getUserById(uid) {
  const user = await prisma.user.findUnique({ where: { uid } });
  if (!user) throw new Error("Không tìm thấy người dùng với UID: " + uid);
  return toUserDTO(user);
}

/**
 * Lấy thông tin người dùng đang đăng nhập
 * Tương đương getCurrentUserProfile() — lấy email từ req.user thay vì SecurityContextHolder
 */
async function getCurrentUserProfile(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng: " + email);
  return toUserDTO(user);
}

/**
 * Cập nhật thông tin người dùng đang đăng nhập
 * Tương đương updateCurrentUserProfile() trong UserServiceImpl.java
 */
async function updateCurrentUserProfile(email, userUpdateDTO) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng: " + email);

  const updated = await prisma.user.update({
    where: { email },
    data: {
      username:    userUpdateDTO.username    ?? user.username,
      address:     userUpdateDTO.address     ?? user.address,
      gender:      userUpdateDTO.gender      ?? user.gender,
      dateOfBirth: userUpdateDTO.dateOfBirth ? new Date(userUpdateDTO.dateOfBirth) : user.dateOfBirth,
      phoneNumber: userUpdateDTO.phoneNumber ?? user.phoneNumber,
      avatarUrl:   userUpdateDTO.avatarUrl   ?? user.avatarUrl,
    },
  });

  return toUserDTO(updated);
}

/**
 * Xóa người dùng theo UID (ADMIN only)
 * Tương đương deleteUser() trong UserServiceImpl.java
 */
async function deleteUser(uid) {
  const user = await prisma.user.findUnique({ where: { uid } });
  if (!user) throw new Error("Không tìm thấy người dùng với UID: " + uid);
  await prisma.user.delete({ where: { uid } });
}

/**
 * Tìm người dùng theo email (ADMIN only)
 * Tương đương findUserByEmail() trong UserServiceImpl.java
 */
async function findUserByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng với email: " + email);
  return toUserDTO(user);
}

/**
 * Đổi mật khẩu người dùng đang đăng nhập
 * Tương đương changeCurrentUserPassword() trong UserServiceImpl.java
 * Gửi email thông báo đổi mật khẩu thành công qua sendPasswordChangedEmail()
 */
async function changeCurrentUserPassword(email, { oldPassword, newPassword, confirmPassword }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng: " + email);

  if (!user.password) {
    throw new Error("Tài khoản này đăng nhập qua Google, không thể đổi mật khẩu.");
  }

  const isMatch = await comparePassword(oldPassword, user.password);
  if (!isMatch) throw new Error("Mật khẩu cũ không chính xác.");

  if (newPassword !== confirmPassword) {
    throw new Error("Mật khẩu mới và xác nhận không trùng khớp.");
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { email },
    data: { password: hashed },
  });

  // Gửi email thông báo — tương đương emailService.sendNotificationEmail() trong Spring
  // Template: "password-changed" — cần file templates/password-changed.html
  await sendPasswordChangedEmail(user.email, user.username);
}

/**
 * Quên mật khẩu — tạo OTP và gửi email
 * Tương đương forgotPassword() trong UserServiceImpl.java
 * NOTE: Cần bạn cung cấp template email "forgot-password" để gửi OTP
 */
async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Email không tồn tại trong hệ thống.");

  const otp = generateOTP();
  const expiryDate = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

  await prisma.user.update({
    where: { email },
    data: {
      resetPasswordToken: otp,
      tokenExpiryDate: expiryDate,
    },
  });

  await sendForgotPasswordEmail(user.email, user.username, otp);
}

/**
 * Đặt lại mật khẩu bằng OTP
 * Tương đương resetPassword() trong UserServiceImpl.java
 */
async function resetPassword({ email, otp, newPassword, confirmPassword }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Email không tồn tại.");

  if (!user.resetPasswordToken || user.resetPasswordToken !== otp) {
    throw new Error("Mã OTP không chính xác.");
  }

  if (!user.tokenExpiryDate || user.tokenExpiryDate < new Date()) {
    throw new Error("Mã OTP đã hết hạn. Vui lòng yêu cầu lại.");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Mật khẩu xác nhận không trùng khớp.");
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { email },
    data: {
      password: hashed,
      resetPasswordToken: null,
      tokenExpiryDate: null,
    },
  });
}

/**
 * Cập nhật thông tin người dùng theo UID (ADMIN only)
 * Tương đương updateUserByUid() trong UserServiceImpl.java
 */
async function updateUserByUid(uid, userUpdateDTO) {
  const user = await prisma.user.findUnique({ where: { uid } });
  if (!user) throw new Error("Không tìm thấy người dùng với UID: " + uid);

  const updated = await prisma.user.update({
    where: { uid },
    data: {
      username:    userUpdateDTO.username    ?? user.username,
      address:     userUpdateDTO.address     ?? user.address,
      gender:      userUpdateDTO.gender      ?? user.gender,
      dateOfBirth: userUpdateDTO.dateOfBirth ? new Date(userUpdateDTO.dateOfBirth) : user.dateOfBirth,
      phoneNumber: userUpdateDTO.phoneNumber ?? user.phoneNumber,
      avatarUrl:   userUpdateDTO.avatarUrl   ?? user.avatarUrl,
    },
  });

  return toUserDTO(updated);
}

/**
 * Lấy danh sách người dùng theo role (ADMIN only)
 * Tương đương getUsersByRole() trong UserServiceImpl.java
 */
async function getUsersByRole(roleName) {
  const validRoles = ["USER", "ADMIN", "ORGANIZER"];
  const role = roleName.toUpperCase();

  if (!validRoles.includes(role)) {
    throw new Error("Role không hợp lệ. Các role hỗ trợ: " + validRoles.join(", "));
  }

  const users = await prisma.user.findMany({ where: { role } });
  return users.map(toUserDTO);
}

module.exports = {
  getAllUsers,
  getUserById,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  deleteUser,
  findUserByEmail,
  changeCurrentUserPassword,
  forgotPassword,
  resetPassword,
  updateUserByUid,
  getUsersByRole,
};