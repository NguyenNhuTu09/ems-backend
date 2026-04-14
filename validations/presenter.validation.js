const Joi = require("joi");

/**
 * Tương đương PresenterRequestDTO.java với @NotBlank + @Size
 */
const presenterSchema = Joi.object({
  fullName: Joi.string().max(255).required().messages({
    "any.required": "Họ và tên diễn giả không được để trống",
    "string.empty": "Họ và tên diễn giả không được để trống",
    "string.max":   "Họ và tên không được vượt quá 255 ký tự",
  }),
  title: Joi.string().max(255).optional().allow("", null).messages({
    "string.max": "Chức danh không được vượt quá 255 ký tự",
  }),
  company: Joi.string().max(255).optional().allow("", null).messages({
    "string.max": "Tên công ty không được vượt quá 255 ký tự",
  }),
  bio: Joi.string().optional().allow("", null),
  avatarUrl: Joi.string().uri().optional().allow("", null).messages({
    "string.uri": "Avatar URL không hợp lệ",
  }),
});

/**
 * Validate danh sách ID cho updateFeaturedPresenters
 */
const featuredPresenterSchema = Joi.array()
  .items(Joi.number().integer().positive())
  .max(4)
  .required()
  .messages({
    "array.max":  "Chỉ được phép chọn tối đa 4 diễn giả nổi bật",
    "any.required": "Danh sách ID không được để trống",
  });

function validate(schema) {
  return (req, res, next) => {
    const dataToValidate = Array.isArray(req.body) ? req.body : req.body;
    const { error } = schema.validate(dataToValidate, { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: messages });
    }
    next();
  };
}

module.exports = { presenterSchema, featuredPresenterSchema, validate };