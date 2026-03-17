const Joi = require("joi");

/**
 * Tương đương UserUpdateDTO.java với @Past validation
 */
const updateProfileSchema = Joi.object({
  username: Joi.string().min(3).max(50).optional().messages({
    "string.min": "Tên đăng nhập phải có ít nhất 3 ký tự",
    "string.max": "Tên đăng nhập không được vượt quá 50 ký tự",
  }),
  address: Joi.string().max(255).optional().allow("", null),
  gender: Joi.string().valid("MALE", "FEMALE", "OTHER").optional().allow(null).messages({
    "any.only": "Giới tính không hợp lệ. Chỉ chấp nhận: MALE, FEMALE, OTHER",
  }),
  dateOfBirth: Joi.date().iso().max("now").optional().allow(null).messages({
    "date.max": "Ngày sinh phải là một ngày trong quá khứ",
    "date.format": "Ngày sinh không hợp lệ (định dạng: YYYY-MM-DD)",
  }),
  phoneNumber: Joi.string()
    .pattern(/^[0-9]{9,11}$/)
    .optional()
    .allow("", null)
    .messages({
      "string.pattern.base": "Số điện thoại không hợp lệ (9–11 chữ số)",
    }),
  avatarUrl: Joi.string().uri().optional().allow("", null).messages({
    "string.uri": "Avatar URL không hợp lệ",
  }),
});

/**
 * Tương đương ChangePasswordRequestDTO.java
 */
const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    "any.required": "Mật khẩu cũ không được để trống",
    "string.empty": "Mật khẩu cũ không được để trống",
  }),
  newPassword: Joi.string().min(6).required().messages({
    "any.required": "Mật khẩu mới không được để trống",
    "string.min": "Mật khẩu mới phải có ít nhất 6 ký tự",
  }),
  confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
    "any.only": "Xác nhận mật khẩu không trùng khớp",
    "any.required": "Xác nhận mật khẩu không được để trống",
  }),
});

/**
 * Tương đương ForgotPasswordRequestDTO.java
 */
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email không được để trống",
    "string.empty": "Email không được để trống",
  }),
});

/**
 * Tương đương ResetPasswordRequestDTO.java
 */
const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email không được để trống",
  }),
  otp: Joi.string().length(6).required().messages({
    "any.required": "Mã OTP không được để trống",
    "string.length": "Mã OTP phải có đúng 6 ký tự",
  }),
  newPassword: Joi.string().min(6).required().messages({
    "any.required": "Mật khẩu mới không được để trống",
    "string.min": "Mật khẩu mới phải có ít nhất 6 ký tự",
  }),
  confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
    "any.only": "Mật khẩu xác nhận không trùng khớp",
    "any.required": "Xác nhận mật khẩu không được để trống",
  }),
});

/**
 * Middleware factory — tương đương @Valid trong Spring
 */
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

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validate,
};