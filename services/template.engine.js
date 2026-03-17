const fs = require("fs");
const path = require("path");

const TEMPLATES_DIR = path.join(__dirname, "../templates");

/**
 * Render template HTML với các biến được truyền vào
 * Tương đương templateEngine.process("template-name", context) trong Thymeleaf
 *
 * @param {string} templateName  — tên file trong /templates (không cần .html)
 * @param {Object} variables     — tương đương Context context trong Thymeleaf
 * @returns {string}             — HTML đã render
 */
function processTemplate(templateName, variables = {}) {
  const filePath = path.join(TEMPLATES_DIR, `${templateName}.html`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Template không tồn tại: ${templateName}.html`);
  }

  let html = fs.readFileSync(filePath, "utf-8");

  // Thay thế tất cả {{variableName}} bằng giá trị thực
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    html = html.replace(regex, value ?? "");
  }

  return html;
}

module.exports = { processTemplate };