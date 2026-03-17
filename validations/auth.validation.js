const Joi = require("joi");

/**
 * Tương đương LoginRequest.java
 */
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email không được để trống",
    "string.empty": "Email không được để trống",
  }),
  password: Joi.string().required().messages({
    "any.required": "Mật khẩu không được để trống",
    "string.empty": "Mật khẩu không được để trống",
  }),
});

/**
 * Tương đương RegistrationRequest.java
 */
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required().messages({
    "any.required": "Tên đăng nhập không được để trống",
    "string.min": "Tên đăng nhập phải có ít nhất 3 ký tự",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email không được để trống",
  }),
  password: Joi.string().min(6).required().messages({
    "any.required": "Mật khẩu không được để trống",
    "string.min": "Mật khẩu phải có ít nhất 6 ký tự",
  }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Mật khẩu và xác nhận mật khẩu không trùng khớp",
    "any.required": "Xác nhận mật khẩu không được để trống",
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
 * Tương đương VerifyAccountRequest.java
 */
const verifyAccountSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email không được để trống",
  }),
  verificationCode: Joi.string().length(6).required().messages({
    "any.required": "Mã xác thực không được để trống",
    "string.length": "Mã xác thực phải có 6 ký tự",
  }),
});

/**
 * Tương đương TokenExchangeRequest.java
 */
const tokenExchangeSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token không được để trống",
  }),
});

/**
 * Middleware factory để validate request body
 * Dùng: router.post("/signin", validate(loginSchema), handler)
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
  loginSchema,
  registerSchema,
  changePasswordSchema,
  verifyAccountSchema,
  tokenExchangeSchema,
  validate,
};