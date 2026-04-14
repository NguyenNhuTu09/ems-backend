const express = require("express");
const router = express.Router();

const presenterService = require("../services/presenter.service");
const { requireAuth, requireRole } = require("../middlewares/auth.middleware");
const { validate, presenterSchema, featuredPresenterSchema } = require("../validations/presenter.validation");

/**
 * @swagger
 * tags:
 *   name: Presenters Management
 *   description: Quản lý diễn giả
 */

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/presenters:
 *   get:
 *     summary: Lấy danh sách tất cả diễn giả
 *     tags: [Presenters Management]
 *     security: []
 */
router.get("/", async (req, res) => {
  try {
    return res.status(200).json(await presenterService.getAllPresenters());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/search:
 *   get:
 *     summary: Tìm kiếm diễn giả theo tên, công ty, chức danh
 *     tags: [Presenters Management]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 */
router.get("/search", async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ message: "Vui lòng cung cấp từ khóa tìm kiếm." });
    return res.status(200).json(await presenterService.searchPresenters(keyword));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/featured:
 *   get:
 *     summary: Lấy danh sách 4 diễn giả nổi bật (hiển thị trang chủ)
 *     tags: [Presenters Management]
 *     security: []
 */
router.get("/featured", async (req, res) => {
  try {
    return res.status(200).json(await presenterService.getFeaturedPresenters());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/featured:
 *   put:
 *     summary: Cập nhật danh sách diễn giả nổi bật — tối đa 4 (ADMIN)
 *     tags: [Presenters Management]
 *     security:
 *       - bearerAuth: []
 */
router.put("/featured", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { error } = featuredPresenterSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    await presenterService.updateFeaturedPresenters(req.body);
    return res.status(200).json({ message: "Đã cập nhật danh sách diễn giả nổi bật thành công." });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/by-organizer/{slug}:
 *   get:
 *     summary: Lấy danh sách diễn giả theo nhà tổ chức (slug)
 *     tags: [Presenters Management]
 *     security: []
 */
router.get("/by-organizer/:slug", async (req, res) => {
  try {
    return res.status(200).json(await presenterService.getPresentersByOrganizerSlug(req.params.slug));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/by-event/{eventId}:
 *   get:
 *     summary: Lấy danh sách diễn giả theo sự kiện (dựa vào lịch trình)
 *     tags: [Presenters Management]
 */
router.get("/by-event/:eventId", async (req, res) => {
  try {
    return res.status(200).json(await presenterService.getPresentersByEventId(req.params.eventId));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/check-availability:
 *   get:
 *     summary: Kiểm tra diễn giả có bận trong khung giờ không (ORGANIZER/ADMIN)
 *     tags: [Presenters Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: presenterId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startTime
 *         required: true
 *         schema:
 *           type: string
 *         example: "2025-01-01T09:00:00"
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *         example: "2025-01-01T11:00:00"
 */
router.get("/check-availability", requireAuth, requireRole("ADMIN", "ORGANIZER"), async (req, res) => {
  try {
    const { presenterId, startTime, endTime } = req.query;
    if (!presenterId || !startTime || !endTime) {
      return res.status(400).json({ message: "Cần cung cấp presenterId, startTime và endTime." });
    }
    const isBusy = await presenterService.isPresenterBusy(Number(presenterId), startTime, endTime);
    return res.status(200).json({ isBusy });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/favorites:
 *   get:
 *     summary: Lấy danh sách diễn giả yêu thích của tôi
 *     tags: [Presenters Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/favorites", requireAuth, async (req, res) => {
  try {
    return res.status(200).json(await presenterService.getMyFavoritePresenters(req.user.email));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/my-presenters:
 *   get:
 *     summary: Lấy danh sách diễn giả do tôi quản lý (ORGANIZER)
 *     tags: [Presenters Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/my-presenters", requireAuth, requireRole("ORGANIZER"), async (req, res) => {
  try {
    return res.status(200).json(await presenterService.getMyPresenters(req.user.email));
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/{presenterId}:
 *   get:
 *     summary: Xem chi tiết thông tin diễn giả
 *     tags: [Presenters Management]
 *     security: []
 */
router.get("/:presenterId", async (req, res) => {
  try {
    return res.status(200).json(await presenterService.getPresenterById(Number(req.params.presenterId)));
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

// ─── AUTHENTICATED ROUTES ─────────────────────────────────────────────────────

/**
 * @swagger
 * /api/presenters:
 *   post:
 *     summary: Tạo diễn giả mới (ORGANIZER hoặc ADMIN)
 *     tags: [Presenters Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/", requireAuth, requireRole("ADMIN", "ORGANIZER"), validate(presenterSchema), async (req, res) => {
  try {
    const presenter = await presenterService.createPresenter(req.user.email, req.body);
    return res.status(201).json(presenter);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/{presenterId}/favorite:
 *   post:
 *     summary: Yêu thích / Bỏ yêu thích diễn giả (User đã đăng nhập)
 *     tags: [Presenters Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/:presenterId/favorite", requireAuth, async (req, res) => {
  try {
    const result = await presenterService.toggleFavoritePresenter(req.user.email, Number(req.params.presenterId));
    const msg = result.favorited ? "Đã thêm vào danh sách yêu thích." : "Đã xóa khỏi danh sách yêu thích.";
    return res.status(200).json({ message: msg, favorited: result.favorited });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/{presenterId}:
 *   put:
 *     summary: Cập nhật thông tin diễn giả (ORGANIZER hoặc ADMIN)
 *     tags: [Presenters Management]
 *     security:
 *       - bearerAuth: []
 */
router.put("/:presenterId", requireAuth, requireRole("ADMIN", "ORGANIZER"), validate(presenterSchema), async (req, res) => {
  try {
    const updated = await presenterService.updatePresenter(Number(req.params.presenterId), req.body);
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/presenters/{presenterId}:
 *   delete:
 *     summary: Xóa diễn giả (ORGANIZER hoặc ADMIN)
 *     tags: [Presenters Management]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:presenterId", requireAuth, requireRole("ADMIN", "ORGANIZER"), async (req, res) => {
  try {
    await presenterService.deletePresenter(Number(req.params.presenterId));
    return res.status(204).send();
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
});

module.exports = router;