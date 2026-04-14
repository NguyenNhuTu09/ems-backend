const prisma = require("../config/database");

function toCategoryDTO(category) {
  return {
    categoryId:   category.categoryId,
    categoryName: category.categoryName,
    description:  category.description,
  };
}

async function getAllCategories() {
  const list = await prisma.activityCategory.findMany({ orderBy: { categoryName: "asc" } });
  return list.map(toCategoryDTO);
}

async function getCategoryById(id) {
  const category = await prisma.activityCategory.findUnique({ where: { categoryId: id } });
  if (!category) throw new Error("Không tìm thấy loại hoạt động với ID: " + id);
  return toCategoryDTO(category);
}

async function createCategory({ categoryName, description }) {
  const exists = await prisma.activityCategory.findUnique({ where: { categoryName } });
  if (exists) throw new Error("Tên loại hoạt động đã tồn tại.");

  const category = await prisma.activityCategory.create({
    data: { categoryName, description },
  });
  return toCategoryDTO(category);
}

async function updateCategory(id, { categoryName, description }) {
  const category = await prisma.activityCategory.findUnique({ where: { categoryId: id } });
  if (!category) throw new Error("Không tìm thấy loại hoạt động để cập nhật.");

  if (categoryName !== category.categoryName) {
    const exists = await prisma.activityCategory.findUnique({ where: { categoryName } });
    if (exists) throw new Error("Tên loại hoạt động mới đã tồn tại.");
  }

  const updated = await prisma.activityCategory.update({
    where: { categoryId: id },
    data: { categoryName, description },
  });
  return toCategoryDTO(updated);
}

async function deleteCategory(id) {
  const category = await prisma.activityCategory.findUnique({ where: { categoryId: id } });
  if (!category) throw new Error("Không tìm thấy loại hoạt động để xóa.");
  await prisma.activityCategory.delete({ where: { categoryId: id } });
}

module.exports = { getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory };