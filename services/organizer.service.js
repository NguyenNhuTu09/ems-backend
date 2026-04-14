const prisma = require("../config/database");
const slugify = require("slugify");
const {
  sendOrganizerRegistrationPending,
  sendOrganizerApproved,
  sendOrganizerRejected,
} = require("./email.service");

// ─── Helper: tạo slug unique ──────────────────────────────────────────────────
async function generateUniqueSlug(name) {
  const base = slugify(name, { lower: true, strict: true, locale: "vi" });
  let final = base;
  let count = 1;
  while (await prisma.organizer.findUnique({ where: { slug: final } })) {
    final = `${base}-${count}`;
    count++;
  }
  return final;
}

// ─── Helper: format → DTO ─────────────────────────────────────────────────────
function toOrganizerDTO(organizer) {
  return {
    organizerId:         organizer.organizerId,
    slug:                organizer.slug,
    name:                organizer.name,
    description:         organizer.description,
    logoUrl:             organizer.logoUrl,
    contactPhoneNumber:  organizer.contactPhoneNumber,
    contactEmail:        organizer.contactEmail,
    isApproved:          organizer.isApproved,
    isLocked:            organizer.isLocked,
    isUnlockRequested:   organizer.isUnlockRequested,
    unlockRequestReason: organizer.unlockRequestReason,
    userId:              organizer.user?.id   ?? null,
    username:            organizer.user?.username ?? null,
  };
}

// ─── Safe email sender — không crash nếu gửi lỗi ─────────────────────────────
async function safeSendEmail(fn, label) {
  try {
    await fn();
  } catch (e) {
    console.error(`[Email] Lỗi gửi ${label}:`, e.message);
  }
}

/**
 * Lấy danh sách tất cả organizer (ADMIN)
 */
async function getAllOrganizers() {
  const list = await prisma.organizer.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return list.map(toOrganizerDTO);
}

/**
 * Lấy thông tin organizer theo slug (PUBLIC)
 */
async function getOrganizerBySlug(slug) {
  const organizer = await prisma.organizer.findUnique({
    where: { slug },
    include: { user: true },
  });
  if (!organizer) throw new Error("Không tìm thấy Organizer với slug: " + slug);
  return toOrganizerDTO(organizer);
}

/**
 * Đăng ký làm organizer (User đang đăng nhập)
 * Tương đương createOrganizer() trong OrganizerServiceImpl.java
 */
async function createOrganizer(email, { name, description, logoUrl, contactPhoneNumber, contactEmail }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng: " + email);

  const existing = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (existing) throw new Error("Bạn đã đăng ký làm Nhà tổ chức rồi. Vui lòng chờ phê duyệt hoặc cập nhật thông tin.");

  const nameExists = await prisma.organizer.findUnique({ where: { name } });
  if (nameExists) throw new Error("Tên nhà tổ chức đã tồn tại: " + name);

  if (contactEmail) {
    const emailExists = await prisma.organizer.findUnique({ where: { contactEmail } });
    if (emailExists) throw new Error("Email nhà tổ chức đã tồn tại: " + contactEmail);
  }

  const slug = await generateUniqueSlug(name);

  const organizer = await prisma.organizer.create({
    data: { name, slug, description, logoUrl, contactPhoneNumber, contactEmail, userId: user.id, isApproved: false },
    include: { user: true },
  });

  await safeSendEmail(
    () => sendOrganizerRegistrationPending(user.email, { username: user.username, organizerName: organizer.name }),
    "Organizer Pending"
  );

  return toOrganizerDTO(organizer);
}

/**
 * Phê duyệt organizer + nâng role user lên ORGANIZER (ADMIN)
 * Tương đương approveOrganizer() trong OrganizerServiceImpl.java
 */
async function approveOrganizer(organizerId) {
  const organizer = await prisma.organizer.findUnique({
    where: { organizerId },
    include: { user: true },
  });
  if (!organizer) throw new Error("Không tìm thấy Organizer với id: " + organizerId);
  if (organizer.isApproved) throw new Error("Organizer này đã được duyệt trước đó.");

  // Transaction: duyệt organizer + nâng role user
  const [updatedOrganizer] = await prisma.$transaction([
    prisma.organizer.update({
      where: { organizerId },
      data: { isApproved: true },
      include: { user: true },
    }),
    prisma.user.update({
      where: { id: organizer.userId },
      data: { role: "ORGANIZER" },
    }),
  ]);

  await safeSendEmail(
    () => sendOrganizerApproved(organizer.user.email, { username: organizer.user.username, organizerName: updatedOrganizer.name }),
    "Organizer Approved"
  );

  return toOrganizerDTO(updatedOrganizer);
}

/**
 * Từ chối đăng ký → xóa record + gửi email (ADMIN)
 * Tương đương rejectOrganizer() trong OrganizerServiceImpl.java
 */
async function rejectOrganizer(organizerId, reason) {
  const organizer = await prisma.organizer.findUnique({
    where: { organizerId },
    include: { user: true },
  });
  if (!organizer) throw new Error("Không tìm thấy Organizer với id: " + organizerId);
  if (organizer.isApproved) throw new Error("Không thể từ chối Organizer đã được duyệt. Hãy dùng chức năng Khóa/Xóa.");

  const { user, name } = organizer;
  await prisma.organizer.delete({ where: { organizerId } });

  const finalReason = reason?.trim() || "Thông tin đăng ký không hợp lệ.";
  await safeSendEmail(
    () => sendOrganizerRejected(user.email, { username: user.username, organizerName: name, reason: finalReason }),
    "Organizer Rejected"
  );
}

/**
 * Cập nhật thông tin organizer (ADMIN hoặc ORGANIZER)
 * Tương đương updateOrganizer() trong OrganizerServiceImpl.java
 */
async function updateOrganizer(slug, { name, description, logoUrl, contactPhoneNumber, contactEmail }) {
  const organizer = await prisma.organizer.findUnique({ where: { slug } });
  if (!organizer) throw new Error("Không tìm thấy Organizer với slug: " + slug);

  if (name && name !== organizer.name) {
    const nameExists = await prisma.organizer.findUnique({ where: { name } });
    if (nameExists && nameExists.organizerId !== organizer.organizerId) {
      throw new Error("Tên nhà tổ chức đã tồn tại: " + name);
    }
  }

  if (contactEmail && contactEmail !== organizer.contactEmail) {
    const emailExists = await prisma.organizer.findUnique({ where: { contactEmail } });
    if (emailExists && emailExists.organizerId !== organizer.organizerId) {
      throw new Error("Email nhà tổ chức đã tồn tại: " + contactEmail);
    }
  }

  const newSlug = (name && name !== organizer.name)
    ? await generateUniqueSlug(name)
    : organizer.slug;

  const updated = await prisma.organizer.update({
    where: { slug },
    data: {
      name:               name               ?? organizer.name,
      slug:               newSlug,
      description:        description        ?? organizer.description,
      logoUrl:            logoUrl            ?? organizer.logoUrl,
      contactPhoneNumber: contactPhoneNumber ?? organizer.contactPhoneNumber,
      contactEmail:       contactEmail       ?? organizer.contactEmail,
    },
    include: { user: true },
  });

  return toOrganizerDTO(updated);
}

/**
 * Xóa organizer theo slug (ADMIN)
 */
async function deleteOrganizer(slug) {
  const organizer = await prisma.organizer.findUnique({ where: { slug } });
  if (!organizer) throw new Error("Không tìm thấy Organizer với slug: " + slug);
  await prisma.organizer.delete({ where: { slug } });
}

/**
 * Khóa organizer (ADMIN)
 * Spring Boot chưa implement gửi email → ở đây cũng bỏ qua
 */
async function lockOrganizer(organizerId) {
  const organizer = await prisma.organizer.findUnique({ where: { organizerId } });
  if (!organizer) throw new Error("Không tìm thấy Organizer với id: " + organizerId);
  if (organizer.isLocked) throw new Error("Organizer này đã bị khóa rồi.");

  await prisma.organizer.update({
    where: { organizerId },
    data: { isLocked: true },
  });
}

/**
 * Mở khóa organizer — reset toàn bộ trạng thái lock (ADMIN)
 */
async function unlockOrganizer(organizerId) {
  const organizer = await prisma.organizer.findUnique({ where: { organizerId } });
  if (!organizer) throw new Error("Không tìm thấy Organizer với id: " + organizerId);
  if (!organizer.isLocked) throw new Error("Organizer này đang hoạt động bình thường, không cần mở khóa.");

  await prisma.organizer.update({
    where: { organizerId },
    data: { isLocked: false, isUnlockRequested: false, unlockRequestReason: null },
  });
}

/**
 * Organizer đang bị khóa gửi yêu cầu mở khóa kèm lý do
 */
async function requestUnlock(email, reason) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng: " + email);

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) throw new Error("Không tìm thấy thông tin Organizer của bạn.");
  if (!organizer.isLocked) throw new Error("Tài khoản của bạn đang hoạt động bình thường, không cần mở khóa.");
  if (organizer.isUnlockRequested) throw new Error("Bạn đã gửi yêu cầu rồi. Vui lòng chờ ADMIN phê duyệt.");

  await prisma.organizer.update({
    where: { userId: user.id },
    data: { isUnlockRequested: true, unlockRequestReason: reason },
  });
}

/**
 * Kiểm tra trạng thái organizer của user đang đăng nhập
 */
async function getMyOrganizerStatus(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng: " + email);

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) throw new Error("Bạn chưa đăng ký làm Organizer.");

  return {
    organizerName:     organizer.name,
    slug:              organizer.slug,
    isApproved:        organizer.isApproved,
    isLocked:          organizer.isLocked,
    isUnlockRequested: organizer.isUnlockRequested,
  };
}

module.exports = {
  getAllOrganizers,
  getOrganizerBySlug,
  createOrganizer,
  approveOrganizer,
  rejectOrganizer,
  updateOrganizer,
  deleteOrganizer,
  lockOrganizer,
  unlockOrganizer,
  requestUnlock,
  getMyOrganizerStatus,
};