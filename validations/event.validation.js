const Joi = require("joi");

const VALID_STATUSES = ["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "REJECTED", "ONGOING", "ENDED", "CANCELLED"];
const VALID_VISIBILITIES = ["PUBLIC", "PRIVATE"];

const eventSchema = Joi.object({
  eventName: Joi.string().max(255).required().messages({
    "any.required": "Tên sự kiện không được để trống",
    "string.empty": "Tên sự kiện không được để trống",
  }),
  description:          Joi.string().optional().allow("", null),
  startDate:            Joi.date().iso().required().messages({ "any.required": "Thời gian bắt đầu là bắt buộc" }),
  endDate:              Joi.date().iso().required().messages({ "any.required": "Thời gian kết thúc là bắt buộc" }),
  location:             Joi.string().max(255).required().messages({ "any.required": "Địa điểm không được để trống" }),
  bannerImageUrl:       Joi.string().uri().optional().allow("", null),
  status:               Joi.string().valid(...VALID_STATUSES).optional(),
  visibility:           Joi.string().valid(...VALID_VISIBILITIES).optional(),
  registrationDeadline: Joi.date().iso().optional().allow(null),
});

const registrationSchema = Joi.object({
  eventId:     Joi.number().integer().positive().required().messages({ "any.required": "eventId không được để trống" }),
  activityIds: Joi.array().items(Joi.number().integer().positive()).optional(),
});

const editPermissionSchema = Joi.object({
  reason: Joi.string().min(10).required().messages({
    "any.required": "Vui lòng nhập lý do cần chỉnh sửa",
    "string.min":   "Lý do phải có ít nhất 10 ký tự",
  }),
});

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: error.details.map(d => d.message) });
    }
    next();
  };
}

module.exports = { eventSchema, registrationSchema, editPermissionSchema, validate };