const Joi = require("joi");

/**
 * Tương đương OrganizersRequestDTO.java
 */
const organizerSchema = Joi.object({
  name: Joi.string().max(255).required().messages({
    "any.required": "Tên nhà tổ chức không được để trống",
    "string.empty": "Tên nhà tổ chức không được để trống",
    "string.max": "Tên nhà tổ chức không được vượt quá 255 ký tự",
  }),
  description: Joi.string().optional().allow("", null),
  logoUrl: Joi.string().uri().optional().allow("", null).messages({
    "string.uri": "Logo URL không hợp lệ",
  }),
  contactPhoneNumber: Joi.string().pattern(/^[0-9]{9,11}$/).optional().allow("", null).messages({
    "string.pattern.base": "Số điện thoại không hợp lệ (9–11 chữ số)",
  }),
  contactEmail: Joi.string().email().optional().allow("", null).messages({
    "string.email": "Email liên hệ không hợp lệ",
  }),
});

/**
 * Tương đương OrganizerUnlockRequestDTO.java
 */
const unlockRequestSchema = Joi.object({
  reason: Joi.string().min(10).required().messages({
    "any.required": "Lý do yêu cầu mở khóa không được để trống",
    "string.empty": "Lý do yêu cầu mở khóa không được để trống",
    "string.min": "Lý do phải có ít nhất 10 ký tự",
  }),
});

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: messages });
    }
    next();
  };
}

module.exports = { organizerSchema, unlockRequestSchema, validate };