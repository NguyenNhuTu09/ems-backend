const prisma = require("../config/database");
const { v4: uuidv4 } = require("uuid");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVITY_INCLUDE = {
  event:    { include: { organizer: true } },
  category: true,
  presenter: true,
};

function toActivityDTO(activity, registeredIds = []) {
  let accessibleTo = [];
  try {
    if (activity.accessibleTo) {
      accessibleTo = JSON.parse(activity.accessibleTo);
    }
  } catch { accessibleTo = []; }

  return {
    activityId:      activity.activityId,
    activityName:    activity.activityName,
    description:     activity.description,
    startTime:       activity.startTime,
    endTime:         activity.endTime,
    maxAttendees:    activity.maxAttendees ? Number(activity.maxAttendees) : null,
    accessibleTo,
    roomOrVenue:     activity.roomOrVenue,
    materialsUrl:    activity.materialsUrl,
    activityImageUrl: activity.activityImageUrl,
    eventId:         activity.event?.eventId?.toString() ?? null,
    category:        activity.category
      ? { categoryId: activity.category.categoryId, categoryName: activity.category.categoryName, description: activity.category.description }
      : null,
    presenter:       activity.presenter
      ? { presenterId: activity.presenter.presenterId, fullName: activity.presenter.fullName, title: activity.presenter.title, company: activity.presenter.company, bio: activity.presenter.bio, avatarUrl: activity.presenter.avatarUrl, isFeatured: activity.presenter.isFeatured }
      : null,
    isRegistered: registeredIds.includes(activity.activityId),
  };
}

// Lấy email từ req.user — trả null nếu chưa login (public routes)
function getEmailSafe(req) {
  return req?.user?.email ?? null;
}

async function getApprovedOrganizerByEmail(email) {
  const organizer = await prisma.organizer.findFirst({
    where: { user: { email } },
    include: { user: true },
  });
  if (!organizer) throw new Error("Bạn chưa đăng ký làm Organizer.");
  if (!organizer.isApproved) throw new Error("Tài khoản Organizer của bạn chưa được phê duyệt.");
  return organizer;
}

// Kiểm tra event có bị lock không — tương đương checkEventLock()
function checkEventLock(event) {
  if (event.status === "PUBLISHED" && event.isEditLocked) {
    let msg = "Sự kiện đang bị khóa chỉnh sửa. ";
    if (event.editRequestStatus === "PENDING") {
      msg += "Yêu cầu chỉnh sửa của bạn đang chờ Admin duyệt.";
    } else if (event.editRequestStatus === "REJECTED") {
      msg += "Yêu cầu chỉnh sửa trước đó đã bị từ chối. Vui lòng gửi yêu cầu mới.";
    } else {
      msg += "Bạn cần gửi yêu cầu chỉnh sửa Event trước khi thay đổi Activity.";
    }
    throw new Error(msg);
  }
}

// Nếu event PUBLISHED và không bị lock → đưa về PENDING_APPROVAL sau khi thay đổi activity
// Tương đương updateEventStatusAfterActivityChange()
async function updateEventStatusAfterChange(event) {
  if (event.status === "PUBLISHED" && !event.isEditLocked) {
    await prisma.event.update({
      where: { eventId: event.eventId },
      data: { status: "PENDING_APPROVAL", editRequestStatus: "NONE", editRequestReason: null },
    });
  }
}

// Kiểm tra presenter bị trùng lịch — tương đương existsByPresenterConflict()
async function checkPresenterConflict(presenterId, startTime, endTime, excludeActivityId = null) {
  const conflict = await prisma.activity.findFirst({
    where: {
      presenterId,
      activityId: excludeActivityId ? { not: excludeActivityId } : undefined,
      startTime: { lt: new Date(endTime) },
      endTime:   { gt: new Date(startTime) },
    },
  });
  return !!conflict;
}

// Kiểm tra phòng bị trùng lịch — tương đương existsByRoomConflict()
async function checkRoomConflict(eventId, roomOrVenue, startTime, endTime, excludeActivityId = null) {
  if (!roomOrVenue) return false;
  const conflict = await prisma.activity.findFirst({
    where: {
      eventId: BigInt(eventId),
      roomOrVenue,
      activityId: excludeActivityId ? { not: excludeActivityId } : undefined,
      startTime: { lt: new Date(endTime) },
      endTime:   { gt: new Date(startTime) },
    },
  });
  return !!conflict;
}

// Lấy danh sách activityId đã đăng ký của user trong event
// Tương đương findRegisteredActivityIds()
async function getRegisteredActivityIds(email, eventId) {
  if (!email || !eventId) return [];
  const regs = await prisma.activityRegistration.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      eventRegistration: {
        eventId: BigInt(eventId),
        user: { email },
      },
    },
    select: { activityId: true },
  });
  return regs.map(r => r.activityId);
}

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

async function getActivityById(activityId) {
  const activity = await prisma.activity.findUnique({
    where: { activityId },
    include: ACTIVITY_INCLUDE,
  });
  if (!activity) throw new Error("Không tìm thấy hoạt động với ID: " + activityId);
  return toActivityDTO(activity);
}

async function getActivitiesByEventId(eventId, email = null) {
  const activities = await prisma.activity.findMany({
    where: { eventId: BigInt(eventId) },
    include: ACTIVITY_INCLUDE,
    orderBy: { startTime: "asc" },
  });
  const registeredIds = await getRegisteredActivityIds(email, eventId);
  return activities.map(a => toActivityDTO(a, registeredIds));
}

async function getActivitiesByPresenterId(presenterId) {
  const activities = await prisma.activity.findMany({
    where: { presenterId },
    include: ACTIVITY_INCLUDE,
    orderBy: { startTime: "asc" },
  });
  return activities.map(a => toActivityDTO(a));
}

async function searchActivitiesInEvent(eventId, keyword, email = null) {
  const activities = await prisma.activity.findMany({
    where: {
      eventId: BigInt(eventId),
      OR: [
        { activityName: { contains: keyword } },
        { description:  { contains: keyword } },
      ],
    },
    include: ACTIVITY_INCLUDE,
    orderBy: { startTime: "asc" },
  });
  const registeredIds = await getRegisteredActivityIds(email, eventId);
  return activities.map(a => toActivityDTO(a, registeredIds));
}

// ─── ORGANIZER / ADMIN ────────────────────────────────────────────────────────

async function createActivity(email, dto) {
  const event = await prisma.event.findUnique({
    where: { eventId: BigInt(dto.eventId) },
    include: { organizer: true },
  });
  if (!event) throw new Error("Không tìm thấy sự kiện với ID: " + dto.eventId);
  checkEventLock(event);

  const category = await prisma.activityCategory.findUnique({ where: { categoryId: dto.categoryId } });
  if (!category) throw new Error("Không tìm thấy loại hoạt động.");

  // Validate thời gian nằm trong event
  const start = new Date(dto.startTime);
  const end   = new Date(dto.endTime);
  if (start < event.startDate || end > event.endDate) {
    throw new Error(`Thời gian hoạt động phải nằm trong khoảng thời gian của sự kiện (${event.startDate.toISOString()} - ${event.endDate.toISOString()})`);
  }

  // Kiểm tra presenter conflict
  if (dto.presenterId) {
    const presenter = await prisma.presenter.findUnique({ where: { presenterId: dto.presenterId } });
    if (!presenter) throw new Error("Không tìm thấy diễn giả.");
    const busy = await checkPresenterConflict(dto.presenterId, dto.startTime, dto.endTime);
    if (busy) throw new Error(`Diễn giả ${presenter.fullName} đã có lịch khác trong khung giờ này.`);
  }

  // Kiểm tra room conflict
  if (dto.roomOrVenue) {
    const roomBusy = await checkRoomConflict(dto.eventId, dto.roomOrVenue, dto.startTime, dto.endTime);
    if (roomBusy) throw new Error(`Phòng ${dto.roomOrVenue} đã có hoạt động khác trong khung giờ này.`);
  }

  const activity = await prisma.activity.create({
    data: {
      activityName:    dto.activityName,
      description:     dto.description,
      startTime:       start,
      endTime:         end,
      maxAttendees:    dto.maxAttendees ?? null,
      accessibleTo:    JSON.stringify(dto.accessibleTo ?? []),
      roomOrVenue:     dto.roomOrVenue,
      materialsUrl:    dto.materialsUrl,
      activityImageUrl: dto.activityImageUrl,
      activityQrCode:  `ACT-${uuidv4()}`,
      eventId:         BigInt(dto.eventId),
      categoryId:      dto.categoryId,
      presenterId:     dto.presenterId ?? null,
    },
    include: ACTIVITY_INCLUDE,
  });

  await updateEventStatusAfterChange(event);
  return toActivityDTO(activity);
}

async function updateActivity(activityId, email, dto) {
  const existing = await prisma.activity.findUnique({
    where: { activityId },
    include: ACTIVITY_INCLUDE,
  });
  if (!existing) throw new Error("Không tìm thấy hoạt động để cập nhật.");

  const event = existing.event;
  checkEventLock(event);

  const start = new Date(dto.startTime);
  const end   = new Date(dto.endTime);

  if (start < event.startDate || end > event.endDate) {
    throw new Error(`Thời gian hoạt động phải nằm trong khoảng thời gian của sự kiện.`);
  }

  // Kiểm tra category đổi
  if (dto.categoryId !== existing.categoryId) {
    const category = await prisma.activityCategory.findUnique({ where: { categoryId: dto.categoryId } });
    if (!category) throw new Error("Loại hoạt động không tồn tại.");
  }

  // Kiểm tra presenter conflict (bỏ qua chính nó)
  if (dto.presenterId) {
    const presenterChanged = existing.presenterId !== dto.presenterId;
    const timeChanged = existing.startTime?.getTime() !== start.getTime() || existing.endTime?.getTime() !== end.getTime();
    if (presenterChanged || timeChanged) {
      const busy = await checkPresenterConflict(dto.presenterId, dto.startTime, dto.endTime, activityId);
      if (busy) throw new Error("Diễn giả bị trùng lịch trong khung giờ mới.");
      const presenter = await prisma.presenter.findUnique({ where: { presenterId: dto.presenterId } });
      if (!presenter) throw new Error("Diễn giả không tồn tại.");
    }
  }

  // Kiểm tra room conflict (bỏ qua chính nó)
  const roomChanged = dto.roomOrVenue !== existing.roomOrVenue;
  const timeChanged = existing.startTime?.getTime() !== start.getTime() || existing.endTime?.getTime() !== end.getTime();
  if ((roomChanged || timeChanged) && dto.roomOrVenue) {
    const roomBusy = await checkRoomConflict(event.eventId.toString(), dto.roomOrVenue, dto.startTime, dto.endTime, activityId);
    if (roomBusy) throw new Error(`Phòng ${dto.roomOrVenue} bị trùng lịch.`);
  }

  const updated = await prisma.activity.update({
    where: { activityId },
    data: {
      activityName:    dto.activityName,
      description:     dto.description,
      startTime:       start,
      endTime:         end,
      maxAttendees:    dto.maxAttendees ?? null,
      accessibleTo:    JSON.stringify(dto.accessibleTo ?? []),
      roomOrVenue:     dto.roomOrVenue,
      materialsUrl:    dto.materialsUrl,
      activityImageUrl: dto.activityImageUrl,
      categoryId:      dto.categoryId,
      presenterId:     dto.presenterId ?? null,
    },
    include: ACTIVITY_INCLUDE,
  });

  await updateEventStatusAfterChange(event);
  return toActivityDTO(updated);
}

async function deleteActivity(activityId, email) {
  const activity = await prisma.activity.findUnique({
    where: { activityId },
    include: { event: true },
  });
  if (!activity) throw new Error("Không tìm thấy hoạt động.");
  checkEventLock(activity.event);

  await prisma.activity.delete({ where: { activityId } });
  await updateEventStatusAfterChange(activity.event);
}

async function getActivityQrCode(activityId, email) {
  const organizer = await getApprovedOrganizerByEmail(email);
  const activity = await prisma.activity.findUnique({
    where: { activityId },
    include: { event: { include: { organizer: true } } },
  });
  if (!activity) throw new Error("Không tìm thấy hoạt động.");
  if (activity.event.organizer.organizerId !== organizer.organizerId) {
    throw new Error("Bạn không có quyền xem mã QR của hoạt động này.");
  }
  return activity.activityQrCode;
}

async function getRegisteredActivitiesByEvent(eventId, email) {
  if (!email) throw new Error("Bạn cần đăng nhập để xem danh sách hoạt động đã đăng ký.");

  const actRegs = await prisma.activityRegistration.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      eventRegistration: {
        eventId: BigInt(eventId),
        user: { email },
      },
    },
    include: { activity: { include: ACTIVITY_INCLUDE } },
  });

  return actRegs.map(ar => toActivityDTO(ar.activity, [ar.activity.activityId]));
}

async function getActivityParticipants(activityId, email) {
  const organizer = await getApprovedOrganizerByEmail(email);
  const activity = await prisma.activity.findUnique({
    where: { activityId },
    include: { event: { include: { organizer: true } } },
  });
  if (!activity) throw new Error("Không tìm thấy hoạt động với ID: " + activityId);
  if (activity.event.organizer.organizerId !== organizer.organizerId) {
    throw new Error("Bạn không có quyền xem danh sách tham gia của hoạt động này.");
  }

  const registrations = await prisma.activityRegistration.findMany({
    where: { activityId },
    include: {
      eventRegistration: { include: { user: true } },
    },
  });

  return registrations.map(ar => ({
    activityAttendeeId: ar.id.toString(),
    userId:             ar.eventRegistration.user.id,
    username:           ar.eventRegistration.user.username,
    email:              ar.eventRegistration.user.email,
    phoneNumber:        ar.eventRegistration.user.phoneNumber,
    avatarUrl:          ar.eventRegistration.user.avatarUrl,
    registrationStatus: ar.status,
    checkInStatus:      ar.actCheckInStatus,
    checkInTime:        ar.checkInTime,
    registeredAt:       ar.registeredAt,
  }));
}

module.exports = {
  getActivityById,
  getActivitiesByEventId,
  getActivitiesByPresenterId,
  searchActivitiesInEvent,
  createActivity,
  updateActivity,
  deleteActivity,
  getActivityQrCode,
  getRegisteredActivitiesByEvent,
  getActivityParticipants,
};