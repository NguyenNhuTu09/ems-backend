const express = require("express");
const router = express.Router();

const userService = require("../services/user.service");
const { requireAuth, requireRole } = require("../middlewares/auth.middleware");
const {
  validate,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validations/user.validation");

/**
 * @swagger
 * tags:
 *   name: User Management
 *   description: Quản lý thông tin người dùng
 */

// ─── PUBLIC ROUTES (không cần đăng nhập) ─────────────────────────────────────

/**
 * @swagger
 * /api/users/forgot-password:
 *   post:
 *     summary: Yêu cầu quên mật khẩu (Gửi OTP qua email)
 *     tags: [User Management]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Mã xác nhận đã được gửi
 *       404:
 *         description: Email không tồn tại
 */
router.post("/forgot-password", validate(forgotPasswordSchema), async (req, res) => {
  try {
    await userService.forgotPassword(req.body.email);
    return res.status(200).json({ message: "Mã xác nhận đã được gửi đến email của bạn." });
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/users/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu bằng OTP
 *     tags: [User Management]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword, confirmPassword]
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *       400:
 *         description: OTP sai, hết hạn hoặc mật khẩu không trùng khớp
 */
router.post("/reset-password", validate(resetPasswordSchema), async (req, res) => {
  try {
    await userService.resetPassword(req.body);
    return res.status(200).json({
      message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay bây giờ.",
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ─── AUTHENTICATED ROUTES (cần đăng nhập) ────────────────────────────────────

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Lấy thông tin người dùng hiện tại
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin người dùng
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await userService.getCurrentUserProfile(req.user.email);
    return res.status(200).json(user);
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     summary: Cập nhật thông tin người dùng hiện tại
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.put("/me", requireAuth, validate(updateProfileSchema), async (req, res) => {
  try {
    const updated = await userService.updateCurrentUserProfile(req.user.email, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/users/me/change-password:
 *   post:
 *     summary: Thay đổi mật khẩu người dùng đang đăng nhập
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword, confirmPassword]
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu cũ sai hoặc xác nhận không trùng
 */
router.post("/me/change-password", requireAuth, validate(changePasswordSchema), async (req, res) => {
  try {
    await userService.changeCurrentUserPassword(req.user.email, req.body);
    return res.status(200).json({ message: "Đổi mật khẩu thành công." });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ─── ADMIN ROUTES (cần role ADMIN) ───────────────────────────────────────────
// Tương đương @PreAuthorize("hasAuthority('SADMIN')") trong Spring

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lấy danh sách tất cả người dùng (ADMIN)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách người dùng
 *       403:
 *         description: Không có quyền truy cập
 */
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    return res.status(200).json(users);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Tìm người dùng theo email (ADMIN)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         example: user@example.com
 *     responses:
 *       200:
 *         description: Thông tin người dùng tìm được
 *       404:
 *         description: Không tìm thấy
 */
router.get("/search", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Vui lòng cung cấp email cần tìm." });
    }
    const user = await userService.findUserByEmail(email);
    return res.status(200).json(user);
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/users/role/{roleName}:
 *   get:
 *     summary: Lấy danh sách người dùng theo Role (ADMIN)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleName
 *         required: true
 *         schema:
 *           type: string
 *         example: ORGANIZER
 *     responses:
 *       200:
 *         description: Danh sách người dùng theo role
 *       400:
 *         description: Role không hợp lệ
 */
router.get("/role/:roleName", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const users = await userService.getUsersByRole(req.params.roleName);
    return res.status(200).json(users);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/users/{uid}:
 *   get:
 *     summary: Lấy thông tin người dùng theo UID (ADMIN)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin người dùng
 *       404:
 *         description: Không tìm thấy người dùng
 */
router.get("/:uid", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.uid);
    return res.status(200).json(user);
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/users/{uid}:
 *   put:
 *     summary: Cập nhật thông tin người dùng theo UID (ADMIN)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy người dùng
 */
router.put("/:uid", requireAuth, requireRole("ADMIN"), validate(updateProfileSchema), async (req, res) => {
  try {
    const updated = await userService.updateUserByUid(req.params.uid, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/users/{uid}:
 *   delete:
 *     summary: Xóa người dùng theo UID (ADMIN)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       404:
 *         description: Không tìm thấy người dùng
 */
router.delete("/:uid", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await userService.deleteUser(req.params.uid);
    return res
      .status(200)
      .json({ message: `Người dùng với UID ${req.params.uid} đã được xóa thành công.` });
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

module.exports = router;