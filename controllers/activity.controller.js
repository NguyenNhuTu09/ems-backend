const express = require("express");
const router = express.Router();
const Joi = require("joi");

const activityService = require("../services/activity.service");
const { requireAuth, requireRole } = require("../middlewares/auth.middleware");

const activitySchema = Joi.object({
  eventId:         Joi.number().integer().positive().required().messages({ "any.required": "Event ID là bắt buộc" }),
  categoryId:      Joi.number().integer().positive().required().messages({ "any.required": "Category ID là bắt buộc" }),
  presenterId:     Joi.number().integer().positive().optional().allow(null),
  activityName:    Joi.string().max(255).required().messages({ "any.required": "Tên hoạt động không được để trống" }),
  description:     Joi.string().optional().allow("", null),
  startTime:       Joi.date().iso().required().messages({ "any.required": "Thời gian bắt đầu là bắt buộc" }),
  endTime:         Joi.date().iso().required().messages({ "any.required": "Thời gian kết thúc là bắt buộc" }),
  maxAttendees:    Joi.number().integer().positive().optional().allow(null),
  accessibleTo:    Joi.array().items(Joi.string()).optional().allow(null),
  roomOrVenue:     Joi.string().max(255).optional().allow("", null),
  materialsUrl:    Joi.string().max(255).optional().allow("", null),
  activityImageUrl: Joi.string().optional().allow("", null),
});

function validate(req, res, next) {
  const { error } = activitySchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: error.details.map(d => d.message) });
  }
  next();
}

/**
 * @swagger
 * tags:
 *   name: Activities Management
 *   description: Quản lý các hoạt động (Activities) trong một sự kiện
 */

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/activities/search:
 *   get:
 *     summary: Tìm kiếm hoạt động trong 1 sự kiện
 *     description: Tìm kiếm hoạt động theo tên hoặc mô tả trong khuôn khổ 1 sự kiện. (Hỗ trợ xác thực ngầm để đánh dấu hoạt động user đã đăng ký).
 *     tags: [Activities Management]
 *     parameters:
 *       - in: query
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sự kiện
 *       - in: query
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm
 *     responses:
 *       200:
 *         description: Danh sách các hoạt động phù hợp
 *       400:
 *         description: Thiếu eventId hoặc keyword
 */
router.get("/search", async (req, res) => {
  try {
    const { eventId, keyword } = req.query;
    if (!eventId || !keyword) return res.status(400).json({ message: "Cần cung cấp eventId và keyword." });
    const email = req.user?.email ?? null;
    res.json(await activityService.searchActivitiesInEvent(eventId, keyword, email));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/activities/by-event/{eventId}:
 *   get:
 *     summary: Lấy danh sách hoạt động của 1 sự kiện
 *     description: Trả về toàn bộ hoạt động thuộc eventId. Nếu User có truyền token, sẽ trả kèm trạng thái isRegistered.
 *     tags: [Activities Management]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách hoạt động
 */
router.get("/by-event/:eventId", async (req, res) => {
  try {
    const email = req.user?.email ?? null;
    res.json(await activityService.getActivitiesByEventId(req.params.eventId, email));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/activities/by-presenter/{presenterId}:
 *   get:
 *     summary: Lấy danh sách hoạt động của 1 diễn giả
 *     tags: [Activities Management]
 *     parameters:
 *       - in: path
 *         name: presenterId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Danh sách hoạt động do diễn giả này phụ trách
 */
router.get("/by-presenter/:presenterId", async (req, res) => {
  try { res.json(await activityService.getActivitiesByPresenterId(Number(req.params.presenterId))); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// ─── AUTHENTICATED ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/activities/by-event/{eventId}/registered:
 *   get:
 *     summary: Lấy danh sách hoạt động user đã đăng ký trong 1 sự kiện (USER)
 *     tags: [Activities Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách hoạt động đã đăng ký
 */
router.get("/by-event/:eventId/registered", requireAuth, async (req, res) => {
  try { res.json(await activityService.getRegisteredActivitiesByEvent(req.params.eventId, req.user.email)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/activities/{activityId}/qr-code:
 *   get:
 *     summary: Lấy mã QR của hoạt động để check-in (ORGANIZER)
 *     tags: [Activities Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trả về mã QR dạng chuỗi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCode:
 *                   type: string
 */
router.get("/:activityId/qr-code", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try { res.json({ qrCode: await activityService.getActivityQrCode(Number(req.params.activityId), req.user.email) }); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/activities/{activityId}/participants:
 *   get:
 *     summary: Lấy danh sách người tham gia hoạt động (ORGANIZER)
 *     tags: [Activities Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Danh sách người tham gia hoạt động
 */
router.get("/:activityId/participants", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try { res.json(await activityService.getActivityParticipants(Number(req.params.activityId), req.user.email)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

// ─── ADMIN / ORGANIZER ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/activities:
 *   post:
 *     summary: Tạo mới hoạt động trong sự kiện (ADMIN / ORGANIZER)
 *     tags: [Activities Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, categoryId, activityName, startTime, endTime]
 *             properties:
 *               eventId:
 *                 type: integer
 *               categoryId:
 *                 type: integer
 *               presenterId:
 *                 type: integer
 *                 nullable: true
 *               activityName:
 *                 type: string
 *               description:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               maxAttendees:
 *                 type: integer
 *                 nullable: true
 *               accessibleTo:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *               roomOrVenue:
 *                 type: string
 *               materialsUrl:
 *                 type: string
 *               activityImageUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo hoạt động thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc trùng lịch
 */
router.post("/", requireAuth, requireRole("ADMIN", "ORGANIZER"), validate, async (req, res) => {
  try { res.status(201).json(await activityService.createActivity(req.user.email, req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/activities/{activityId}:
 *   put:
 *     summary: Cập nhật hoạt động (ADMIN / ORGANIZER)
 *     tags: [Activities Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, categoryId, activityName, startTime, endTime]
 *             properties:
 *               eventId:
 *                 type: integer
 *               categoryId:
 *                 type: integer
 *               presenterId:
 *                 type: integer
 *                 nullable: true
 *               activityName:
 *                 type: string
 *               description:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               maxAttendees:
 *                 type: integer
 *                 nullable: true
 *               accessibleTo:
 *                 type: array
 *                 items:
 *                   type: string
 *               roomOrVenue:
 *                 type: string
 *               materialsUrl:
 *                 type: string
 *               activityImageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/:activityId", requireAuth, requireRole("ADMIN", "ORGANIZER"), validate, async (req, res) => {
  try { res.json(await activityService.updateActivity(Number(req.params.activityId), req.user.email, req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/activities/{activityId}:
 *   delete:
 *     summary: Xóa hoạt động (ADMIN / ORGANIZER)
 *     tags: [Activities Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Xóa thành công
 */
router.delete("/:activityId", requireAuth, requireRole("ADMIN", "ORGANIZER"), async (req, res) => {
  try {
    await activityService.deleteActivity(Number(req.params.activityId), req.user.email);
    res.status(204).send();
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ─── PUBLIC chi tiết — đặt cuối ──────────────────────────────────────────────

/**
 * @swagger
 * /api/activities/{activityId}:
 *   get:
 *     summary: Lấy chi tiết hoạt động
 *     tags: [Activities Management]
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chi tiết hoạt động
 *       404:
 *         description: Không tìm thấy
 */
router.get("/:activityId", async (req, res) => {
  try { res.json(await activityService.getActivityById(Number(req.params.activityId))); }
  catch (e) { res.status(404).json({ message: e.message }); }
});

module.exports = router;