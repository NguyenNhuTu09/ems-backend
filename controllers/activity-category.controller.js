const express = require("express");
const router = express.Router();
const Joi = require("joi");

const categoryService = require("../services/activity-category.service");
const { requireAuth, requireRole } = require("../middlewares/auth.middleware");

const categorySchema = Joi.object({
  categoryName: Joi.string().max(100).required().messages({
    "any.required": "Tên loại hoạt động không được để trống",
    "string.empty": "Tên loại hoạt động không được để trống",
    "string.max":   "Tên loại hoạt động tối đa 100 ký tự",
  }),
  description: Joi.string().optional().allow("", null),
});

function validate(req, res, next) {
  const { error } = categorySchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: error.details.map(d => d.message) });
  }
  next();
}

/**
 * @swagger
 * tags:
 *   name: Activity Categories
 *   description: Quản lý loại hoạt động (Ví dụ: Workshop, Talkshow, Minigame,...)
 */

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/activity-categories:
 *   get:
 *     summary: Lấy danh sách tất cả loại hoạt động
 *     description: Trả về danh sách tất cả các loại hoạt động đang có trong hệ thống (sắp xếp theo tên).
 *     tags: [Activity Categories]
 *     responses:
 *       200:
 *         description: Danh sách loại hoạt động
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   categoryId:
 *                     type: integer
 *                   categoryName:
 *                     type: string
 *                   description:
 *                     type: string
 */
router.get("/", async (req, res) => {
  try { res.json(await categoryService.getAllCategories()); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/activity-categories/{id}:
 *   get:
 *     summary: Lấy chi tiết 1 loại hoạt động theo ID
 *     tags: [Activity Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của loại hoạt động
 *     responses:
 *       200:
 *         description: Thông tin chi tiết loại hoạt động
 *       404:
 *         description: Không tìm thấy loại hoạt động
 */
router.get("/:id", async (req, res) => {
  try { res.json(await categoryService.getCategoryById(Number(req.params.id))); }
  catch (e) { res.status(404).json({ message: e.message }); }
});

// ─── ADMIN hoặc ORGANIZER ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/activity-categories:
 *   post:
 *     summary: Tạo mới loại hoạt động (ADMIN / ORGANIZER)
 *     tags: [Activity Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryName
 *             properties:
 *               categoryName:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Workshop"
 *               description:
 *                 type: string
 *                 example: "Các buổi hội thảo chuyên đề"
 *     responses:
 *       201:
 *         description: Tạo mới thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc tên loại hoạt động đã tồn tại
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 */
router.post("/", requireAuth, requireRole("ADMIN", "ORGANIZER"), validate, async (req, res) => {
  try { res.status(201).json(await categoryService.createCategory(req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/activity-categories/{id}:
 *   put:
 *     summary: Cập nhật loại hoạt động (ADMIN / ORGANIZER)
 *     tags: [Activity Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của loại hoạt động cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryName
 *             properties:
 *               categoryName:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Talkshow"
 *               description:
 *                 type: string
 *                 example: "Giao lưu chia sẻ kinh nghiệm"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc tên mới đã bị trùng
 *       404:
 *         description: Không tìm thấy loại hoạt động
 */
router.put("/:id", requireAuth, requireRole("ADMIN", "ORGANIZER"), validate, async (req, res) => {
  try { res.json(await categoryService.updateCategory(Number(req.params.id), req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

/**
 * @swagger
 * /api/activity-categories/{id}:
 *   delete:
 *     summary: Xóa loại hoạt động (ADMIN / ORGANIZER)
 *     tags: [Activity Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của loại hoạt động cần xóa
 *     responses:
 *       204:
 *         description: Xóa thành công (Không trả về dữ liệu)
 *       404:
 *         description: Không tìm thấy loại hoạt động
 */
router.delete("/:id", requireAuth, requireRole("ADMIN", "ORGANIZER"), async (req, res) => {
  try {
    await categoryService.deleteCategory(Number(req.params.id));
    res.status(204).send();
  } catch (e) { res.status(404).json({ message: e.message }); }
});

module.exports = router;