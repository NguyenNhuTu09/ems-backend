const express = require("express");
const router = express.Router();

const organizerService = require("../services/organizer.service");
const { requireAuth, requireRole } = require("../middlewares/auth.middleware");
const { validate, organizerSchema, unlockRequestSchema } = require("../validations/organizer.validation");

/**
 * @swagger
 * tags:
 *   name: Organizers Management
 *   description: Quản lý nhà tổ chức sự kiện
 */

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/organizers/{slug}:
 *   get:
 *     summary: Lấy thông tin nhà tổ chức theo slug (PUBLIC)
 *     tags: [Organizers Management]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin organizer
 *       404:
 *         description: Không tìm thấy
 */
router.get("/by-organizer/:slug", async (req, res) => {
  try {
    const organizer = await organizerService.getOrganizerBySlug(req.params.slug);
    return res.status(200).json(organizer);
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

// ─── AUTHENTICATED ROUTES ─────────────────────────────────────────────────────

/**
 * @swagger
 * /api/organizers:
 *   post:
 *     summary: Đăng ký làm nhà tổ chức sự kiện (User đang đăng nhập)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrganizerRequest'
 *     responses:
 *       201:
 *         description: Đăng ký thành công, chờ phê duyệt
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc đã đăng ký rồi
 */
router.post("/", requireAuth, validate(organizerSchema), async (req, res) => {
  try {
    const organizer = await organizerService.createOrganizer(req.user.email, req.body);
    return res.status(201).json(organizer);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/organizers/me/status:
 *   get:
 *     summary: Kiểm tra trạng thái tài khoản Organizer của tôi
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trạng thái organizer
 *       404:
 *         description: Chưa đăng ký Organizer
 */
router.get("/me/status", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try {
    const status = await organizerService.getMyOrganizerStatus(req.user.email);
    return res.status(200).json(status);
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/organizers/me/request-unlock:
 *   post:
 *     summary: Gửi yêu cầu mở khóa kèm lý do (ORGANIZER đang bị khóa)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Tôi đã khắc phục vi phạm và muốn tiếp tục hoạt động"
 *     responses:
 *       200:
 *         description: Gửi yêu cầu thành công
 *       400:
 *         description: Tài khoản không bị khóa hoặc đã gửi yêu cầu rồi
 */
router.post("/me/request-unlock", requireAuth, requireRole("ORGANIZER"), validate(unlockRequestSchema), async (req, res) => {
  try {
    await organizerService.requestUnlock(req.user.email, req.body.reason);
    return res.status(200).json({ message: "Đã gửi yêu cầu mở khóa thành công. Vui lòng chờ ADMIN phê duyệt." });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/organizers/{slug}:
 *   put:
 *     summary: Cập nhật thông tin nhà tổ chức (ADMIN hoặc ORGANIZER)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrganizerRequest'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy organizer
 */
router.put("/:slug", requireAuth, requireRole("ADMIN", "ORGANIZER"), validate(organizerSchema), async (req, res) => {
  try {
    const updated = await organizerService.updateOrganizer(req.params.slug, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/organizers:
 *   get:
 *     summary: Lấy danh sách tất cả nhà tổ chức (ADMIN)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách organizer
 */
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const organizers = await organizerService.getAllOrganizers();
    return res.status(200).json(organizers);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/organizers/{organizerId}/approve:
 *   put:
 *     summary: Phê duyệt đăng ký Organizer (ADMIN)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizerId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Phê duyệt thành công
 */
router.put("/:organizerId/approve", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await organizerService.approveOrganizer(Number(req.params.organizerId));
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/organizers/{organizerId}/reject:
 *   put:
 *     summary: Từ chối đăng ký Organizer (ADMIN)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizerId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Từ chối thành công
 */
router.put("/:organizerId/reject", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await organizerService.rejectOrganizer(Number(req.params.organizerId), req.query.reason);
    return res.status(200).json({ message: "Đã từ chối đơn đăng ký Organizer và gửi email thông báo." });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/organizers/{organizerId}/lock:
 *   put:
 *     summary: Khóa tạm thời Organizer (ADMIN)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizerId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Khóa thành công
 */
router.put("/:organizerId/lock", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await organizerService.lockOrganizer(Number(req.params.organizerId));
    return res.status(200).json({ message: "Đã khóa tài khoản Organizer thành công." });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/organizers/{organizerId}/unlock:
 *   put:
 *     summary: Mở khóa Organizer (ADMIN)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizerId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Mở khóa thành công
 */
router.put("/:organizerId/unlock", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await organizerService.unlockOrganizer(Number(req.params.organizerId));
    return res.status(200).json({ message: "Đã mở khóa tài khoản Organizer thành công." });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/organizers/{slug}:
 *   delete:
 *     summary: Xóa nhà tổ chức (ADMIN)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Xóa thành công
 */
router.delete("/:slug", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await organizerService.deleteOrganizer(req.params.slug);
    return res.status(204).send();
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

module.exports = router;