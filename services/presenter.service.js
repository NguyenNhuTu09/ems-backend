const prisma = require("../config/database");

// ─── Helper: format Presenter → DTO ──────────────────────────────────────────
function toPresenterDTO(presenter) {
  return {
    presenterId: presenter.presenterId,
    fullName:    presenter.fullName,
    title:       presenter.title,
    company:     presenter.company,
    bio:         presenter.bio,
    avatarUrl:   presenter.avatarUrl,
    isFeatured:  presenter.isFeatured,
  };
}

// ─── Helper: lấy Organizer từ email, kiểm tra đã approved chưa ───────────────
// Tương đương getCurrentOrganizer() trong PresenterServiceImpl.java
async function getApprovedOrganizerByEmail(email) {
  const organizer = await prisma.organizer.findFirst({
    where: { user: { email } },
  });
  if (!organizer) throw new Error("Bạn chưa đăng ký làm Organizer hoặc tài khoản không tồn tại.");
  if (!organizer.isApproved) throw new Error("Tài khoản Organizer của bạn chưa được phê duyệt.");
  return organizer;
}

/**
 * Lấy tất cả diễn giả (PUBLIC)
 */
async function getAllPresenters() {
  const list = await prisma.presenter.findMany({ orderBy: { createdAt: "desc" } });
  return list.map(toPresenterDTO);
}

/**
 * Lấy chi tiết diễn giả theo ID (PUBLIC)
 */
async function getPresenterById(presenterId) {
  const presenter = await prisma.presenter.findUnique({ where: { presenterId } });
  if (!presenter) throw new Error("Không tìm thấy diễn giả với ID: " + presenterId);
  return toPresenterDTO(presenter);
}

/**
 * Tìm kiếm diễn giả theo keyword — tên, công ty, chức danh (PUBLIC)
 * Tương đương searchByKeyword() trong PresentersRepository
 */
async function searchPresenters(keyword) {
  const list = await prisma.presenter.findMany({
    where: {
      OR: [
        { fullName: { contains: keyword } },
        { company:  { contains: keyword } },
        { title:    { contains: keyword } },
      ],
    },
  });
  return list.map(toPresenterDTO);
}

/**
 * Lấy danh sách diễn giả theo eventId (PUBLIC)
 * Tương đương getPresentersByEventId() — lấy qua Activity → Presenter, distinct
 */
async function getPresentersByEventId(eventId) {
  const activities = await prisma.activity.findMany({
    where: { eventId: Number(eventId), presenterId: { not: null } },
    include: { presenter: true },
    orderBy: { startTime: "asc" },
  });

  // Distinct theo presenterId — tương đương .distinct() trong Java stream
  const seen = new Set();
  const presenters = [];
  for (const act of activities) {
    if (act.presenter && !seen.has(act.presenter.presenterId)) {
      seen.add(act.presenter.presenterId);
      presenters.push(act.presenter);
    }
  }
  return presenters.map(toPresenterDTO);
}

/**
 * Lấy danh sách diễn giả theo slug của organizer (PUBLIC)
 */
async function getPresentersByOrganizerSlug(organizerSlug) {
  const list = await prisma.presenter.findMany({
    where: { organizer: { slug: organizerSlug } },
  });
  return list.map(toPresenterDTO);
}

/**
 * Lấy 4 diễn giả nổi bật (PUBLIC)
 */
async function getFeaturedPresenters() {
  const list = await prisma.presenter.findMany({
    where: { isFeatured: true },
    take: 4,
  });
  return list.map(toPresenterDTO);
}

/**
 * Tạo diễn giả mới (ORGANIZER hoặc ADMIN)
 * Tương đương createPresenter() — gắn organizer hiện tại vào presenter
 */
async function createPresenter(email, { fullName, title, company, bio, avatarUrl }) {
  const organizer = await getApprovedOrganizerByEmail(email);

  // Kiểm tra trùng tên + công ty — tương đương existsByFullNameAndCompany()
  const duplicate = await prisma.presenter.findFirst({
    where: { fullName, company: company ?? null },
  });
  if (duplicate) throw new Error("Diễn giả này đã tồn tại trong hệ thống (Trùng tên và công ty).");

  const presenter = await prisma.presenter.create({
    data: { fullName, title, company, bio, avatarUrl, organizerId: organizer.organizerId },
  });
  return toPresenterDTO(presenter);
}

/**
 * Cập nhật thông tin diễn giả (ORGANIZER hoặc ADMIN)
 */
async function updatePresenter(presenterId, { fullName, title, company, bio, avatarUrl }) {
  const presenter = await prisma.presenter.findUnique({ where: { presenterId } });
  if (!presenter) throw new Error("Không tìm thấy diễn giả để cập nhật.");

  const updated = await prisma.presenter.update({
    where: { presenterId },
    data: {
      fullName:  fullName  ?? presenter.fullName,
      title:     title     ?? presenter.title,
      company:   company   ?? presenter.company,
      bio:       bio       ?? presenter.bio,
      avatarUrl: avatarUrl ?? presenter.avatarUrl,
    },
  });
  return toPresenterDTO(updated);
}

/**
 * Xóa diễn giả (ORGANIZER hoặc ADMIN)
 */
async function deletePresenter(presenterId) {
  const presenter = await prisma.presenter.findUnique({ where: { presenterId } });
  if (!presenter) throw new Error("Không tìm thấy diễn giả để xóa.");
  await prisma.presenter.delete({ where: { presenterId } });
}

/**
 * Kiểm tra diễn giả có bị trùng lịch không (ORGANIZER hoặc ADMIN)
 * Tương đương existsByPresenterConflict() trong ActivityRepository
 */
async function isPresenterBusy(presenterId, startTimeStr, endTimeStr) {
  let start, end;
  try {
    start = new Date(startTimeStr);
    end   = new Date(endTimeStr);
    if (isNaN(start) || isNaN(end)) throw new Error();
  } catch {
    throw new Error("Lỗi định dạng ngày tháng. Dùng định dạng ISO 8601 (VD: 2025-01-01T09:00:00)");
  }

  const conflict = await prisma.activity.findFirst({
    where: {
      presenterId,
      startTime: { lt: end },
      endTime:   { gt: start },
    },
  });
  return !!conflict;
}

/**
 * Toggle yêu thích / bỏ yêu thích diễn giả (User đã đăng nhập)
 * Tương đương toggleFavoritePresenter()
 */
async function toggleFavoritePresenter(email, presenterId) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng: " + email);

  const presenter = await prisma.presenter.findUnique({ where: { presenterId } });
  if (!presenter) throw new Error("Không tìm thấy diễn giả với ID: " + presenterId);

  const existing = await prisma.favoritePresenter.findUnique({
    where: { userId_presenterId: { userId: user.id, presenterId } },
  });

  if (existing) {
    await prisma.favoritePresenter.delete({
      where: { userId_presenterId: { userId: user.id, presenterId } },
    });
    return { favorited: false };
  } else {
    await prisma.favoritePresenter.create({
      data: { userId: user.id, presenterId },
    });
    return { favorited: true };
  }
}

/**
 * Lấy danh sách diễn giả yêu thích của user đang đăng nhập
 */
async function getMyFavoritePresenters(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng: " + email);

  const favorites = await prisma.favoritePresenter.findMany({
    where: { userId: user.id },
    include: { presenter: true },
    orderBy: { likedAt: "desc" },
  });
  return favorites.map((fav) => toPresenterDTO(fav.presenter));
}

/**
 * Cập nhật danh sách diễn giả nổi bật — tối đa 4 (ADMIN)
 * Tương đương updateFeaturedPresenters() — reset all rồi set lại
 */
async function updateFeaturedPresenters(presenterIds) {
  if (presenterIds.length > 4) {
    throw new Error("Chỉ được phép chọn tối đa 4 diễn giả nổi bật.");
  }

  // Kiểm tra tất cả ID có tồn tại không
  const found = await prisma.presenter.findMany({
    where: { presenterId: { in: presenterIds } },
    select: { presenterId: true },
  });
  if (found.length !== presenterIds.length) {
    throw new Error("Một số ID diễn giả không tồn tại.");
  }

  // Transaction: reset all → set selected — tương đương resetAllFeaturedPresenters() + saveAll()
  await prisma.$transaction([
    prisma.presenter.updateMany({ data: { isFeatured: false } }),
    ...(presenterIds.length > 0
      ? [prisma.presenter.updateMany({
          where: { presenterId: { in: presenterIds } },
          data: { isFeatured: true },
        })]
      : []),
  ]);
}

/**
 * Lấy danh sách diễn giả do organizer hiện tại quản lý
 */
async function getMyPresenters(email) {
  const organizer = await getApprovedOrganizerByEmail(email);
  const list = await prisma.presenter.findMany({
    where: { organizerId: organizer.organizerId },
  });
  return list.map(toPresenterDTO);
}

module.exports = {
  getAllPresenters,
  getPresenterById,
  searchPresenters,
  getPresentersByEventId,
  getPresentersByOrganizerSlug,
  getFeaturedPresenters,
  createPresenter,
  updatePresenter,
  deletePresenter,
  isPresenterBusy,
  toggleFavoritePresenter,
  getMyFavoritePresenters,
  updateFeaturedPresenters,
  getMyPresenters,
};