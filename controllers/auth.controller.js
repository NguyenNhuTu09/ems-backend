const express = require("express");
const router = express.Router();

const authService = require("../services/auth.service");
const { requireAuth } = require("../middlewares/auth.middleware");
const {
  validate,
  loginSchema,
  registerSchema,
  verifyAccountSchema,
  tokenExchangeSchema,
} = require("../validations/auth.validation");

/**
 * @swagger
 * tags:
 *   name: Auth Management
 *   description: Đăng ký, đăng nhập, xác thực tài khoản
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Đăng ký người dùng mới
 *     tags: [Auth Management]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Đăng ký thành công, kiểm tra email để xác thực
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Kiểm tra Email của bạn để xác thực tài khoản: nguyenvana"
 *       400:
 *         description: Email hoặc username đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/signup", validate(registerSchema), async (req, res) => {
  try {
    console.log("Body nhận được:", req.body);

    const { username, email, password, confirmPassword } = req.body; 
    const newUser = await authService.registerNewUser({ username, email, password, confirmPassword });
    return res.status(201).json({
      message: `Kiểm tra Email của bạn để xác thực tài khoản: ${newUser.username}`,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth Management]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Sai email hoặc mật khẩu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/signin", validate(loginSchema), async (req, res) => {
  try {
    const result = await authService.authenticateUser(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(401).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/auth/token/exchange:
 *   post:
 *     summary: Đổi mã dùng một lần lấy JWT Token sau khi đăng nhập OAuth2
 *     tags: [Auth Management]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TokenExchangeRequest'
 *     responses:
 *       200:
 *         description: Đổi token thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Mã không hợp lệ hoặc đã hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/token/exchange", validate(tokenExchangeSchema), async (req, res) => {
  try {
    const result = await authService.exchangeCodeForJwt(
      req.body.refreshToken,
      () => null
    );
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/auth/token/refresh:
 *   post:
 *     summary: Làm mới Access Token bằng Refresh Token
 *     tags: [Auth Management]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TokenExchangeRequest'
 *     responses:
 *       200:
 *         description: Làm mới token thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       403:
 *         description: Refresh token không hợp lệ hoặc đã hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/token/refresh", validate(tokenExchangeSchema), async (req, res) => {
  try {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(403).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Auth Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User logged out successfully!"
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/logout", requireAuth, async (req, res) => {
  try {
    await authService.logout(req.user.email);
    return res.status(200).json({ message: "User logged out successfully!" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     summary: Xác thực tài khoản qua email (OTP)
 *     tags: [Auth Management]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyAccountRequest'
 *     responses:
 *       200:
 *         description: Xác thực thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ."
 *       400:
 *         description: Mã xác thực sai hoặc tài khoản đã kích hoạt
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/verify", validate(verifyAccountSchema), async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    const success = await authService.verifyUser(email, verificationCode);

    if (success) {
      return res.status(200).json({
        message: "Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.",
      });
    } else {
      return res.status(400).json({
        message: "Mã xác thực không chính xác hoặc tài khoản đã được kích hoạt.",
      });
    }
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;