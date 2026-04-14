const express = require("express");
const router = express.Router();

const eventService = require("../services/event.service");
const { requireAuth, requireRole } = require("../middlewares/auth.middleware");
const { validate, eventSchema, registrationSchema, editPermissionSchema } = require("../validations/event.validation");

/**
 * @swagger
 * tags:
 *   name: Events Management
 *   description: Quản lý sự kiện (Events, Registrations, Edit Permissions)
 */

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events/public:
 *   get:
 *     summary: Lấy danh sách sự kiện công khai
 *     description: Trả về các sự kiện có trạng thái PUBLISHED, visibility PUBLIC và chưa kết thúc.
 *     tags: [Events Management]
 *     responses:
 *       200:
 *         description: Danh sách sự kiện công khai
 */
router.get("/public", async (req, res) => {
  try { res.json(await eventService.getPublicEvents()); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/featured:
 *   get:
 *     summary: Lấy danh sách sự kiện nổi bật (Featured)
 *     tags: [Events Management]
 *     responses:
 *       200:
 *         description: Danh sách sự kiện nổi bật
 */
router.get("/featured", async (req, res) => {
  try { res.json(await eventService.getFeaturedEvents()); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/upcoming-selected:
 *   get:
 *     summary: Lấy danh sách sự kiện sắp diễn ra
 *     tags: [Events Management]
 *     responses:
 *       200:
 *         description: Danh sách sự kiện sắp diễn ra
 */
router.get("/upcoming-selected", async (req, res) => {
  try { res.json(await eventService.getUpcomingEvents()); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events/all:
 *   get:
 *     summary: Lấy tất cả sự kiện (ADMIN)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách tất cả sự kiện (Trừ DRAFT)
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 */
router.get("/all", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try { res.json(await eventService.getAllEvents()); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/featured:
 *   put:
 *     summary: Cập nhật danh sách sự kiện nổi bật (ADMIN)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *             example: ["1", "2"]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/featured", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try { res.json(await eventService.updateFeaturedEvents(req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/upcoming-selected:
 *   put:
 *     summary: Cập nhật danh sách sự kiện sắp diễn ra (ADMIN)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *             example: ["3", "4"]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/upcoming-selected", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try { res.json(await eventService.updateUpcomingEvents(req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{eventId}/approve:
 *   put:
 *     summary: Duyệt sự kiện (ADMIN)
 *     tags: [Events Management]
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
 *         description: Duyệt sự kiện thành công
 */
router.put("/:eventId/approve", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try { res.json(await eventService.approveEvent(req.params.eventId)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{eventId}/reject:
 *   put:
 *     summary: Từ chối sự kiện (ADMIN)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *         description: Lý do từ chối
 *     responses:
 *       200:
 *         description: Từ chối sự kiện thành công
 */
router.put("/:eventId/reject", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try { res.json(await eventService.rejectEvent(req.params.eventId, req.query.reason)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{eventId}/approve-edit-request:
 *   put:
 *     summary: Duyệt yêu cầu chỉnh sửa sự kiện (ADMIN)
 *     tags: [Events Management]
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
 *         description: Đã cấp quyền chỉnh sửa cho Organizer
 */
router.put("/:eventId/approve-edit-request", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await eventService.approveEditPermission(req.params.eventId);
    res.json({ message: "Đã cấp quyền chỉnh sửa cho Organizer." });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{eventId}/reject-edit-request:
 *   put:
 *     summary: Từ chối yêu cầu chỉnh sửa sự kiện (ADMIN)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã từ chối yêu cầu chỉnh sửa
 */
router.put("/:eventId/reject-edit-request", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await eventService.rejectEditPermission(req.params.eventId, req.query.reason);
    res.json({ message: "Đã từ chối yêu cầu chỉnh sửa." });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ─── ORGANIZER ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events/my-events:
 *   get:
 *     summary: Lấy danh sách sự kiện của tôi (ORGANIZER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách sự kiện do Organizer tổ chức
 */
router.get("/my-events", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try { res.json(await eventService.getMyEvents(req.user.email)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Tạo sự kiện mới (ORGANIZER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventName:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *               bannerImageUrl:
 *                 type: string
 *               visibility:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo sự kiện thành công (DRAFT)
 */
router.post("/", requireAuth, requireRole("ORGANIZER"), validate(eventSchema), async (req, res) => {
  try { res.status(201).json(await eventService.createEvent(req.user.email, req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{slug}/submit:
 *   put:
 *     summary: Gửi yêu cầu duyệt sự kiện (ORGANIZER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã chuyển trạng thái sang PENDING_APPROVAL
 */
router.put("/:slug/submit", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try { res.json(await eventService.submitEventForApproval(req.user.email, req.params.slug)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{slug}:
 *   put:
 *     summary: Cập nhật sự kiện (ORGANIZER)
 *     tags: [Events Management]
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
 *             type: object
 *             properties:
 *               eventName:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/:slug", requireAuth, requireRole("ORGANIZER"), validate(eventSchema), async (req, res) => {
  try { res.json(await eventService.updateEvent(req.user.email, req.params.slug, req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{slug}:
 *   delete:
 *     summary: Xóa sự kiện (ADMIN / ORGANIZER)
 *     tags: [Events Management]
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
router.delete("/:slug", requireAuth, requireRole("ADMIN", "ORGANIZER"), async (req, res) => {
  try {
    await eventService.deleteEvent(req.user.email, req.params.slug);
    res.status(204).send();
  } catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{eventId}/registrations:
 *   get:
 *     summary: Lấy danh sách đăng ký của 1 sự kiện (ORGANIZER)
 *     tags: [Events Management]
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
 *         description: Danh sách Attendee
 */
router.get("/:eventId/registrations", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try { res.json(await eventService.getEventRegistrations(req.user.email, req.params.eventId)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/registrations/{registrationId}/approve:
 *   put:
 *     summary: Duyệt vé đăng ký (ORGANIZER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã duyệt vé thành công
 */
router.put("/registrations/:registrationId/approve", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try {
    await eventService.approveRegistration(req.user.email, req.params.registrationId);
    res.json({ message: "Đã duyệt vé thành công." });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/registrations/{registrationId}/reject:
 *   put:
 *     summary: Từ chối vé đăng ký (ORGANIZER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã từ chối vé
 */
router.put("/registrations/:registrationId/reject", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try {
    const reason = req.query.reason || "Đơn đăng ký không đáp ứng các tiêu chuẩn của ban tổ chức.";
    await eventService.rejectRegistration(req.user.email, req.params.registrationId, reason);
    res.json({ message: "Đã từ chối vé." });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/registrations/{registrationId}/detail:
 *   get:
 *     summary: Xem chi tiết 1 đơn đăng ký / vé (ORGANIZER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin chi tiết vé và các hoạt động
 */
router.get("/registrations/:registrationId/detail", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try { res.json(await eventService.getAttendeeDetail(req.user.email, req.params.registrationId)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{eventId}/request-edit:
 *   post:
 *     summary: Gửi yêu cầu xin quyền chỉnh sửa sự kiện đã PUBLISHED (ORGANIZER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Cần đổi lại địa điểm do mưa lớn"
 *     responses:
 *       200:
 *         description: Đã gửi yêu cầu chỉnh sửa thành công
 */
router.post("/:eventId/request-edit", requireAuth, requireRole("ORGANIZER"), validate(editPermissionSchema), async (req, res) => {
  try {
    await eventService.requestEditPermission(req.user.email, req.params.eventId, req.body.reason);
    res.json({ message: "Đã gửi yêu cầu chỉnh sửa thành công. Vui lòng chờ ADMIN duyệt." });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ─── USER (đã đăng nhập) ─────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events/register:
 *   post:
 *     summary: Đăng ký tham gia sự kiện (USER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventId:
 *                 type: string
 *               activityIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Đăng ký thành công chờ duyệt
 */
router.post("/register", requireAuth, validate(registrationSchema), async (req, res) => {
  try {
    await eventService.registerForEvent(req.user.email, req.body);
    res.json({ message: "Đăng ký thành công! Vui lòng chờ Organizer duyệt." });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/my-registrations:
 *   get:
 *     summary: Xem lịch sử đăng ký tham gia sự kiện của tôi (USER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách vé/sự kiện đã đăng ký
 */
router.get("/my-registrations", requireAuth, async (req, res) => {
  try { res.json(await eventService.getMyRegistrationHistory(req.user.email)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/newsletter/subscribe:
 *   post:
 *     summary: Đăng ký / Hủy đăng ký nhận bản tin sự kiện (USER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subscribe
 *         required: true
 *         schema:
 *           type: boolean
 *         description: true để đăng ký, false để hủy
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post("/newsletter/subscribe", requireAuth, async (req, res) => {
  try {
    const subscribe = req.query.subscribe === "true";
    await eventService.toggleNewsletterSubscription(req.user.email, subscribe);
    res.json({ message: subscribe ? "Đăng ký nhận tin thành công!" : "Đã hủy đăng ký nhận tin." });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/events/{eventId}/add-activities:
 *   post:
 *     summary: Đăng ký thêm hoạt động cho sự kiện đã có vé (USER)
 *     tags: [Events Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *             example: ["act_1", "act_2"]
 *     responses:
 *       200:
 *         description: Đăng ký thêm hoạt động thành công
 */
router.post("/:eventId/add-activities", requireAuth, async (req, res) => {
  try {
    await eventService.addActivitiesToRegistration(req.user.email, req.params.eventId, req.body);
    res.json({ message: "Yêu cầu đăng ký thêm hoạt động đã được gửi. Vui lòng chờ Organizer duyệt." });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ─── PUBLIC chi tiết — để cuối tránh conflict ─────────────────────────────────

/**
 * @swagger
 * /api/events/{slug}:
 *   get:
 *     summary: Lấy chi tiết sự kiện theo slug
 *     tags: [Events Management]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin chi tiết sự kiện
 *       404:
 *         description: Không tìm thấy
 */
router.get("/:slug", async (req, res) => {
  try { res.json(await eventService.getEventBySlug(req.params.slug)); }
  catch (e) { res.status(404).json({ message: e.message }); }
});

module.exports = router;