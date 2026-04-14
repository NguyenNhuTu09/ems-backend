const prisma = require("../config/database");
const slugify = require("slugify");
const { v4: uuidv4 } = require("uuid");
const {
  sendRegistrationPendingEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendEventSubmissionPending,
  sendEventApprovedEmail,
  sendEventRejectedEmail,
  sendEditRequestPendingEmail,
  sendEditRequestApprovedEmail,
  sendEditRequestRejectedEmail,
} = require("./email.service");

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateUniqueSlug(name) {
  const base = slugify(name, { lower: true, strict: true, locale: "vi" });
  let final = base;
  let count = 1;
  while (await prisma.event.findUnique({ where: { slug: final } })) {
    final = `${base}-${count}`;
    count++;
  }
  return final;
}

async function getApprovedOrganizerByEmail(email) {
  const organizer = await prisma.organizer.findFirst({
    where: { user: { email } },
    include: { user: true },
  });
  if (!organizer) throw new Error("Bạn chưa đăng ký làm Organizer hoặc tài khoản không tồn tại.");
  if (!organizer.isApproved) throw new Error("Tài khoản Organizer của bạn chưa được phê duyệt.");
  return organizer;
}

function toEventDTO(event) {
  return {
    eventId:           event.eventId.toString(),
    slug:              event.slug,
    eventName:         event.eventName,
    description:       event.description,
    startDate:         event.startDate,
    endDate:           event.endDate,
    location:          event.location,
    bannerImageUrl:    event.bannerImageUrl,
    status:            event.status,
    visibility:        event.visibility,
    registrationDeadline: event.registrationDeadline,
    organizerId:       event.organizer?.organizerId ?? null,
    organizerName:     event.organizer?.name ?? null,
    isFeatured:        event.isFeatured,
    isUpcoming:        event.isUpcoming,
    isEditLocked:      event.isEditLocked,
    editRequestStatus: event.editRequestStatus,
    editRequestReason: event.editRequestReason,
  };
}

function toAttendeeDTO(reg) {
  return {
    id:                  reg.id.toString(),
    userId:              reg.user.id,
    username:            reg.user.username,
    email:               reg.user.email,
    phoneNumber:         reg.user.phoneNumber,
    avatarUrl:           reg.user.avatarUrl,
    registrationDate:    reg.registrationDate,
    status:              reg.status,
    ticketCode:          reg.status === "APPROVED" ? reg.ticketCode : null,
    eventCheckInStatus:  reg.eventCheckInStatus,
  };
}

// Format giờ hoạt động cho email — tương đương mapActivityToDTO()
function formatActivityForEmail(actReg) {
  const act = actReg.activity;
  let timeDisplay = "Chưa cập nhật";
  if (act.startTime && act.endTime) {
    const fmt = (d) => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const fmtDate = (d) => d.toLocaleDateString("vi-VN");
    const sameDay = act.startTime.toDateString() === act.endTime.toDateString();
    timeDisplay = sameDay
      ? `${fmt(act.startTime)} - ${fmt(act.endTime)} (${fmtDate(act.startTime)})`
      : `${fmt(act.startTime)} ${fmtDate(act.startTime)} đến ${fmt(act.endTime)} ${fmtDate(act.endTime)}`;
  }
  return {
    name:        act.activityName,
    timeRange:   timeDisplay,
    location:    act.roomOrVenue ?? "Chưa cập nhật",
    description: act.description ?? "",
  };
}

function validateEventDates({ startDate, endDate, registrationDeadline }) {
  const now = new Date();
  if (!startDate || !endDate) throw new Error("Thời gian bắt đầu và kết thúc là bắt buộc.");
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) throw new Error("Thời gian bắt đầu phải trước thời gian kết thúc.");
  if (start <= now) throw new Error("Thời gian bắt đầu phải ở tương lai.");
  if (registrationDeadline) {
    const deadline = new Date(registrationDeadline);
    if (deadline > start) throw new Error("Deadline đăng ký phải trước hoặc bằng thời gian bắt đầu sự kiện.");
    if (deadline <= now) throw new Error("Deadline đăng ký phải ở tương lai.");
  }
}

async function safeSend(fn, label) {
  try { await fn(); } catch (e) { console.error(`[Email] Lỗi ${label}:`, e.message); }
}

const EVENT_INCLUDE = { organizer: { include: { user: true } } };

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

async function getPublicEvents() {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED", visibility: "PUBLIC", endDate: { gt: now } },
    include: EVENT_INCLUDE,
    orderBy: { startDate: "asc" },
  });
  return events.map(toEventDTO);
}

async function getEventBySlug(slug) {
  const event = await prisma.event.findUnique({ where: { slug }, include: EVENT_INCLUDE });
  if (!event) throw new Error("Không tìm thấy sự kiện với slug: " + slug);
  return toEventDTO(event);
}

async function getFeaturedEvents() {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { isFeatured: true, status: "PUBLISHED", visibility: "PUBLIC", endDate: { gt: now } },
    include: EVENT_INCLUDE,
  });
  return events.map(toEventDTO);
}

async function getUpcomingEvents() {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { isUpcoming: true, status: "PUBLISHED", visibility: "PUBLIC", endDate: { gt: now } },
    include: EVENT_INCLUDE,
  });
  return events.map(toEventDTO);
}

// ─── ORGANIZER ────────────────────────────────────────────────────────────────

async function createEvent(email, dto) {
  const organizer = await getApprovedOrganizerByEmail(email);
  if (organizer.isLocked) throw new Error("Tài khoản Organizer đang bị tạm khóa. Vui lòng gửi yêu cầu mở khóa để tiếp tục.");

  validateEventDates(dto);
  const slug = await generateUniqueSlug(dto.eventName);

  const event = await prisma.event.create({
    data: {
      eventName:           dto.eventName,
      slug,
      description:         dto.description,
      startDate:           new Date(dto.startDate),
      endDate:             new Date(dto.endDate),
      location:            dto.location,
      bannerImageUrl:      dto.bannerImageUrl,
      registrationDeadline: dto.registrationDeadline ? new Date(dto.registrationDeadline) : null,
      visibility:          dto.visibility ?? "PUBLIC",
      status:              "DRAFT",
      isEditLocked:        false,
      editRequestStatus:   "NONE",
      eventQrCode:         `EVT-${uuidv4()}`,
      organizerId:         organizer.organizerId,
    },
    include: EVENT_INCLUDE,
  });
  return toEventDTO(event);
}

async function updateEvent(email, slug, dto) {
  const event = await prisma.event.findUnique({ where: { slug }, include: EVENT_INCLUDE });
  if (!event) throw new Error("Không tìm thấy sự kiện với slug: " + slug);

  const organizer = await getApprovedOrganizerByEmail(email);
  if (organizer.isLocked) throw new Error("Tài khoản Organizer đang bị tạm khóa.");
  if (event.organizer.organizerId !== organizer.organizerId) throw new Error("Bạn không có quyền chỉnh sửa sự kiện này.");
  if (event.status === "PUBLISHED" && event.isEditLocked) throw new Error("Sự kiện đã công bố và đang bị khóa. Vui lòng gửi yêu cầu cấp quyền chỉnh sửa.");

  validateEventDates(dto);

  let newSlug = slug;
  if (dto.eventName && dto.eventName !== event.eventName) {
    newSlug = await generateUniqueSlug(dto.eventName);
  }

  // Status logic — tương đương Spring
  let newStatus = event.status;
  if (event.status === "PUBLISHED") {
    newStatus = "PENDING_APPROVAL";
  } else if (dto.status) {
    newStatus = dto.status === "PUBLISHED" ? "PENDING_APPROVAL" : dto.status;
  }

  const updated = await prisma.event.update({
    where: { slug },
    data: {
      eventName:           dto.eventName ?? event.eventName,
      slug:                newSlug,
      description:         dto.description,
      startDate:           new Date(dto.startDate),
      endDate:             new Date(dto.endDate),
      location:            dto.location,
      bannerImageUrl:      dto.bannerImageUrl,
      registrationDeadline: dto.registrationDeadline ? new Date(dto.registrationDeadline) : null,
      visibility:          dto.visibility ?? event.visibility,
      status:              newStatus,
      ...(newStatus === "PENDING_APPROVAL" && event.status === "PUBLISHED"
        ? { editRequestStatus: "NONE", editRequestReason: null }
        : {}),
    },
    include: EVENT_INCLUDE,
  });
  return toEventDTO(updated);
}

async function deleteEvent(email, slug) {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: { ...EVENT_INCLUDE, _count: { select: { registrations: true } } },
  });
  if (!event) throw new Error("Không tìm thấy sự kiện với slug: " + slug);

  const organizer = await getApprovedOrganizerByEmail(email);
  if (organizer.isLocked) throw new Error("Tài khoản Organizer đang bị tạm khóa.");
  if (event.organizer.organizerId !== organizer.organizerId) throw new Error("Bạn không có quyền xóa sự kiện này.");
  if (event.status === "PUBLISHED" && event.isEditLocked) throw new Error("Sự kiện đã công bố và đang bị khóa. Không thể xóa trực tiếp.");
  if (event._count.registrations > 0) throw new Error(`Không thể xóa sự kiện đã có ${event._count.registrations} người đăng ký. Vui lòng hủy sự kiện thay vì xóa.`);

  await prisma.event.delete({ where: { slug } });
}

async function getMyEvents(email) {
  const organizer = await getApprovedOrganizerByEmail(email);
  const events = await prisma.event.findMany({
    where: { organizerId: organizer.organizerId },
    include: EVENT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return events.map(toEventDTO);
}

async function submitEventForApproval(email, slug) {
  const organizer = await getApprovedOrganizerByEmail(email);
  if (organizer.isLocked) throw new Error("Tài khoản Organizer đang bị tạm khóa.");

  const event = await prisma.event.findUnique({ where: { slug }, include: EVENT_INCLUDE });
  if (!event) throw new Error("Không tìm thấy sự kiện.");
  if (event.organizer.organizerId !== organizer.organizerId) throw new Error("Bạn không có quyền gửi yêu cầu duyệt cho sự kiện này.");
  if (!["DRAFT", "REJECTED"].includes(event.status)) throw new Error("Sự kiện đang chờ duyệt hoặc đã được công bố, không thể gửi yêu cầu.");

  const updated = await prisma.event.update({
    where: { slug },
    data: { status: "PENDING_APPROVAL" },
    include: EVENT_INCLUDE,
  });

  await safeSend(() => sendEventSubmissionPending(organizer.user.email, {
    username:      organizer.user.username,
    eventName:     updated.eventName,
    submittedDate: new Date(),
  }), "Event Submission Pending");

  return toEventDTO(updated);
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────

async function getAllEvents() {
  const events = await prisma.event.findMany({
    where: { status: { not: "DRAFT" } },
    include: EVENT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return events.map(toEventDTO);
}

async function approveEvent(eventId) {
  const event = await prisma.event.findUnique({
    where: { eventId: BigInt(eventId) },
    include: EVENT_INCLUDE,
  });
  if (!event) throw new Error("Không tìm thấy sự kiện.");
  if (event.status === "PUBLISHED") throw new Error("Sự kiện này đã được công bố rồi.");

  const updated = await prisma.event.update({
    where: { eventId: BigInt(eventId) },
    data: { status: "PUBLISHED", isEditLocked: true, editRequestStatus: "NONE", editRequestReason: null },
    include: EVENT_INCLUDE,
  });

  await safeSend(() => sendEventApprovedEmail(event.organizer.user.email, {
    username:       event.organizer.user.username,
    eventName:      updated.eventName,
    eventStartDate: updated.startDate,
    eventSlug:      updated.slug,
  }), "Event Approved");

  return toEventDTO(updated);
}

async function rejectEvent(eventId, reason) {
  const event = await prisma.event.findUnique({
    where: { eventId: BigInt(eventId) },
    include: EVENT_INCLUDE,
  });
  if (!event) throw new Error("Không tìm thấy sự kiện.");
  if (event.status === "PUBLISHED") throw new Error("Không thể từ chối sự kiện đã công bố.");

  const updated = await prisma.event.update({
    where: { eventId: BigInt(eventId) },
    data: { status: "REJECTED", isEditLocked: false },
    include: EVENT_INCLUDE,
  });

  const finalReason = reason?.trim() || "Không đáp ứng tiêu chuẩn cộng đồng.";
  await safeSend(() => sendEventRejectedEmail(event.organizer.user.email, {
    username:  event.organizer.user.username,
    eventName: updated.eventName,
    reason:    finalReason,
  }), "Event Rejected");

  return toEventDTO(updated);
}

async function updateFeaturedEvents(eventIds) {
  if (eventIds.length > 4) throw new Error("Chỉ được chọn tối đa 4 sự kiện nổi bật.");
  const now = new Date();

  const found = await prisma.event.findMany({ where: { eventId: { in: eventIds.map(BigInt) } }, include: EVENT_INCLUDE });
  if (found.length !== eventIds.length) throw new Error("Một hoặc nhiều ID sự kiện không tồn tại.");
  for (const e of found) {
    if (e.status !== "PUBLISHED") throw new Error(`Sự kiện "${e.eventName}" chưa được công bố, không thể set nổi bật.`);
    if (e.endDate < now) throw new Error(`Sự kiện "${e.eventName}" đã kết thúc, không thể chọn làm sự kiện Nổi bật.`);
  }

  const [, updated] = await prisma.$transaction([
    prisma.event.updateMany({ data: { isFeatured: false } }),
    ...(eventIds.length > 0 ? [prisma.event.updateMany({ where: { eventId: { in: eventIds.map(BigInt) } }, data: { isFeatured: true } })] : []),
  ]);

  const result = await prisma.event.findMany({ where: { isFeatured: true }, include: EVENT_INCLUDE });
  return result.map(toEventDTO);
}

async function updateUpcomingEvents(eventIds) {
  if (eventIds.length > 8) throw new Error("Chỉ được chọn tối đa 8 sự kiện sắp diễn ra.");
  const now = new Date();

  const found = await prisma.event.findMany({ where: { eventId: { in: eventIds.map(BigInt) } }, include: EVENT_INCLUDE });
  if (found.length !== eventIds.length) throw new Error("Một hoặc nhiều ID sự kiện không tồn tại.");
  for (const e of found) {
    if (e.status !== "PUBLISHED") throw new Error(`Sự kiện "${e.eventName}" chưa được công bố.`);
    if (e.endDate < now) throw new Error(`Sự kiện "${e.eventName}" đã kết thúc, không thể chọn làm sự kiện Sắp diễn ra.`);
  }

  await prisma.$transaction([
    prisma.event.updateMany({ data: { isUpcoming: false } }),
    ...(eventIds.length > 0 ? [prisma.event.updateMany({ where: { eventId: { in: eventIds.map(BigInt) } }, data: { isUpcoming: true } })] : []),
  ]);

  const result = await prisma.event.findMany({ where: { isUpcoming: true }, include: EVENT_INCLUDE });
  return result.map(toEventDTO);
}

// ─── REGISTRATION ─────────────────────────────────────────────────────────────

async function registerForEvent(email, { eventId, activityIds }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng.");

  const event = await prisma.event.findUnique({ where: { eventId: BigInt(eventId) } });
  if (!event) throw new Error("Không tìm thấy sự kiện.");
  if (event.status !== "PUBLISHED") throw new Error("Sự kiện chưa được công bố.");

  const now = new Date();
  if (event.endDate < now) throw new Error("Sự kiện đã kết thúc, không thể đăng ký.");
  if (event.registrationDeadline && event.registrationDeadline < now) throw new Error("Đã hết thời hạn đăng ký tham gia sự kiện này.");

  const existing = await prisma.eventRegistration.findUnique({
    where: { userId_eventId: { userId: user.id, eventId: BigInt(eventId) } },
  });
  if (existing) throw new Error("Bạn đã đăng ký sự kiện này rồi.");

  const registration = await prisma.eventRegistration.create({
    data: { userId: user.id, eventId: BigInt(eventId), status: "PENDING" },
  });

  // Đăng ký các activity kèm theo
  if (activityIds?.length > 0) {
    for (const activityId of activityIds) {
      const activity = await prisma.activity.findUnique({ where: { activityId } });
      if (!activity) throw new Error("Không tìm thấy hoạt động ID: " + activityId);
      if (activity.eventId.toString() !== eventId.toString()) throw new Error(`Hoạt động ${activity.activityName} không thuộc sự kiện này.`);
      if (activity.maxAttendees) {
        const count = await prisma.activityRegistration.count({ where: { activityId } });
        if (count >= Number(activity.maxAttendees)) throw new Error(`Hoạt động ${activity.activityName} đã hết chỗ.`);
      }
      await prisma.activityRegistration.create({
        data: { eventRegistrationId: registration.id, activityId, status: "PENDING" },
      });
    }
  }

  await safeSend(() => sendRegistrationPendingEmail(user.email, {
    username:      user.username,
    eventName:     event.eventName,
    startDateTime: event.startDate,
    endDateTime:   event.endDate,
    location:      event.location,
  }), "Registration Pending");
}

async function getEventRegistrations(email, eventId) {
  const organizer = await getApprovedOrganizerByEmail(email);
  const event = await prisma.event.findUnique({ where: { eventId: BigInt(eventId) } });
  if (!event) throw new Error("Không tìm thấy sự kiện.");
  if (event.organizerId !== organizer.organizerId) throw new Error("Bạn không có quyền xem danh sách đăng ký của sự kiện này.");

  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId: BigInt(eventId) },
    include: { user: true },
  });
  return registrations.map(toAttendeeDTO);
}

async function approveRegistration(email, registrationId) {
  const organizer = await getApprovedOrganizerByEmail(email);
  if (organizer.isLocked) throw new Error("Tài khoản Organizer đang bị tạm khóa.");

  const reg = await prisma.eventRegistration.findUnique({
    where: { id: BigInt(registrationId) },
    include: { user: true, event: { include: { organizer: true } }, activityRegistrations: { include: { activity: true } } },
  });
  if (!reg) throw new Error("Không tìm thấy thông tin đăng ký.");
  if (reg.event.organizer.organizerId !== organizer.organizerId) throw new Error("Bạn không có quyền duyệt vé này.");

  // Tạo ticketCode nếu chưa có
  const ticketCode = reg.ticketCode ?? `TKT-${uuidv4().substring(0, 8).toUpperCase()}`;

  // Approve registration + tất cả activity PENDING
  await prisma.$transaction([
    prisma.eventRegistration.update({
      where: { id: BigInt(registrationId) },
      data: { status: "APPROVED", ticketCode },
    }),
    ...reg.activityRegistrations
      .filter(a => a.status === "PENDING")
      .map(a => prisma.activityRegistration.update({
        where: { id: a.id },
        data: { status: "APPROVED" },
      })),
  ]);

  const approvedActivities = reg.activityRegistrations
    .filter(a => a.status === "APPROVED" || a.status === "PENDING")
    .map(formatActivityForEmail);

  await safeSend(() => sendRegistrationApprovedEmail(reg.user.email, {
    username:           reg.user.username,
    eventName:          reg.event.eventName,
    eventStartDateTime: reg.event.startDate,
    eventEndDateTime:   reg.event.endDate,
    location:           reg.event.location,
    ticketCode,
    activityList:       approvedActivities,
  }), "Registration Approved");
}

async function rejectRegistration(email, registrationId, reason) {
  const organizer = await getApprovedOrganizerByEmail(email);
  if (organizer.isLocked) throw new Error("Tài khoản Organizer đang bị tạm khóa.");

  const reg = await prisma.eventRegistration.findUnique({
    where: { id: BigInt(registrationId) },
    include: { user: true, event: { include: { organizer: true } } },
  });
  if (!reg) throw new Error("Không tìm thấy thông tin đăng ký.");
  if (reg.event.organizer.organizerId !== organizer.organizerId) throw new Error("Bạn không có quyền từ chối vé này.");

  await prisma.eventRegistration.update({
    where: { id: BigInt(registrationId) },
    data: { status: "REJECTED" },
  });

  await safeSend(() => sendRegistrationRejectedEmail(reg.user.email, {
    username:      reg.user.username,
    eventName:     reg.event.eventName,
    startDateTime: reg.event.startDate,
    location:      reg.event.location,
    reason:        reason ?? "Đơn đăng ký không đáp ứng các tiêu chuẩn của ban tổ chức.",
  }), "Registration Rejected");
}

async function getAttendeeDetail(email, registrationId) {
  const organizer = await getApprovedOrganizerByEmail(email);

  const reg = await prisma.eventRegistration.findUnique({
    where: { id: BigInt(registrationId) },
    include: {
      user: true,
      event: { include: { organizer: true } },
      activityRegistrations: { include: { activity: true } },
    },
  });
  if (!reg) throw new Error("Không tìm thấy thông tin đăng ký (Vé) với ID: " + registrationId);
  if (reg.event.organizer.organizerId !== organizer.organizerId) throw new Error("Bạn không có quyền xem chi tiết vé của sự kiện này.");

  return {
    id:                 reg.id.toString(),
    ticketCode:         reg.ticketCode,
    status:             reg.status,
    registrationDate:   reg.registrationDate,
    eventCheckInStatus: reg.eventCheckInStatus,
    userId:             reg.user.id,
    username:           reg.user.username,
    email:              reg.user.email,
    phoneNumber:        reg.user.phoneNumber,
    avatarUrl:          reg.user.avatarUrl,
    activities:         reg.activityRegistrations.map(aa => ({
      activityId:          aa.activity.activityId,
      activityName:        aa.activity.activityName,
      startTime:           aa.activity.startTime,
      endTime:             aa.activity.endTime,
      roomOrVenue:         aa.activity.roomOrVenue,
      activityStatus:      aa.status,
      activityCheckInStatus: aa.actCheckInStatus,
      activityImageUrl:    aa.activity.activityImageUrl,
    })),
  };
}

async function getMyRegistrationHistory(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng.");

  const registrations = await prisma.eventRegistration.findMany({
    where: { userId: user.id },
    include: { event: { include: { organizer: true } } },
    orderBy: { registrationDate: "desc" },
  });

  return registrations.map(reg => ({
    eventId:            reg.event.eventId.toString(),
    eventName:          reg.event.eventName,
    slug:               reg.event.slug,
    bannerImageUrl:     reg.event.bannerImageUrl,
    location:           reg.event.location,
    startDate:          reg.event.startDate,
    endDate:            reg.event.endDate,
    organizerName:      reg.event.organizer.name,
    registrationId:     reg.id.toString(),
    status:             reg.status,
    ticketCode:         reg.status === "APPROVED" ? reg.ticketCode : null,
    registrationDate:   reg.registrationDate,
    eventCheckInStatus: reg.eventCheckInStatus,
  }));
}

async function toggleNewsletterSubscription(email, subscribe) {
  await prisma.user.update({
    where: { email },
    data: { isSubscribedNews: subscribe },
  });
}

async function addActivitiesToRegistration(email, eventId, activityIds) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Không tìm thấy người dùng.");

  const event = await prisma.event.findUnique({ where: { eventId: BigInt(eventId) } });
  if (!event) throw new Error("Không tìm thấy sự kiện.");
  if (new Date() > event.endDate) throw new Error("Sự kiện đã kết thúc.");

  const reg = await prisma.eventRegistration.findUnique({
    where: { userId_eventId: { userId: user.id, eventId: BigInt(eventId) } },
  });
  if (!reg) throw new Error("Bạn chưa đăng ký tham gia sự kiện này. Vui lòng đăng ký vé trước.");
  if (reg.status === "REJECTED") throw new Error("Vé của bạn đã bị từ chối, không thể đăng ký thêm hoạt động.");

  let hasNewPending = false;
  for (const activityId of activityIds) {
    const activity = await prisma.activity.findUnique({ where: { activityId } });
    if (!activity) throw new Error("Không tìm thấy hoạt động ID: " + activityId);
    if (activity.eventId.toString() !== eventId.toString()) throw new Error(`Hoạt động ${activity.activityName} không thuộc sự kiện này.`);

    const alreadyReg = await prisma.activityRegistration.findUnique({
      where: { eventRegistrationId_activityId: { eventRegistrationId: reg.id, activityId } },
    });
    if (alreadyReg) continue;

    if (activity.maxAttendees) {
      const count = await prisma.activityRegistration.count({ where: { activityId } });
      if (count >= Number(activity.maxAttendees)) throw new Error(`Hoạt động ${activity.activityName} đã hết chỗ.`);
    }

    const status = reg.eventCheckInStatus === "CHECKED_IN" ? "APPROVED" : "PENDING";
    await prisma.activityRegistration.create({
      data: { eventRegistrationId: reg.id, activityId, status },
    });
    if (status === "PENDING") hasNewPending = true;
  }

  // Nếu có activity mới PENDING và user đã có vé APPROVED → đưa vé về PENDING để organizer duyệt lại
  if (hasNewPending && reg.status === "APPROVED" && reg.eventCheckInStatus !== "CHECKED_IN") {
    await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { status: "PENDING" },
    });
  }
}

// ─── EDIT PERMISSION ──────────────────────────────────────────────────────────

async function requestEditPermission(email, eventId, reason) {
  const organizer = await getApprovedOrganizerByEmail(email);
  const event = await prisma.event.findUnique({
    where: { eventId: BigInt(eventId) },
    include: EVENT_INCLUDE,
  });
  if (!event) throw new Error("Không tìm thấy sự kiện.");
  if (event.organizer.organizerId !== organizer.organizerId) throw new Error("Bạn không có quyền gửi yêu cầu cho sự kiện này.");
  if (event.status !== "PUBLISHED") throw new Error("Chỉ có thể gửi yêu cầu chỉnh sửa cho sự kiện ĐÃ CÔNG BỐ.");
  if (new Date() > event.startDate) throw new Error("Sự kiện đã hoặc đang diễn ra, không thể yêu cầu chỉnh sửa.");
  if (event.editRequestStatus === "PENDING") throw new Error("Đang có một yêu cầu chờ duyệt, vui lòng đợi.");
  if (event.editRequestStatus === "APPROVED" && !event.isEditLocked) throw new Error("Bạn đã được cấp quyền chỉnh sửa. Vui lòng thực hiện chỉnh sửa và submit lại.");
  if (!reason?.trim()) throw new Error("Vui lòng cung cấp lý do yêu cầu chỉnh sửa.");

  await prisma.event.update({
    where: { eventId: BigInt(eventId) },
    data: { editRequestStatus: "PENDING", editRequestReason: reason },
  });

  await safeSend(() => sendEditRequestPendingEmail(organizer.user.email, {
    username:  organizer.user.username,
    eventName: event.eventName,
    reason,
  }), "Edit Request Pending");
}

async function approveEditPermission(eventId) {
  const event = await prisma.event.findUnique({
    where: { eventId: BigInt(eventId) },
    include: EVENT_INCLUDE,
  });
  if (!event) throw new Error("Không tìm thấy sự kiện.");
  if (event.editRequestStatus !== "PENDING") throw new Error("Không có yêu cầu chỉnh sửa nào đang chờ duyệt.");

  await prisma.event.update({
    where: { eventId: BigInt(eventId) },
    data: { isEditLocked: false, editRequestStatus: "APPROVED", editRequestReason: null },
  });

  await safeSend(() => sendEditRequestApprovedEmail(event.organizer.user.email, {
    username:  event.organizer.user.username,
    eventName: event.eventName,
    eventSlug: event.slug,
  }), "Edit Request Approved");
}

async function rejectEditPermission(eventId, reason) {
  const event = await prisma.event.findUnique({
    where: { eventId: BigInt(eventId) },
    include: EVENT_INCLUDE,
  });
  if (!event) throw new Error("Không tìm thấy sự kiện.");
  if (event.editRequestStatus !== "PENDING") throw new Error("Không có yêu cầu chỉnh sửa nào đang chờ duyệt.");

  await prisma.event.update({
    where: { eventId: BigInt(eventId) },
    data: { editRequestStatus: "REJECTED", editRequestReason: null },
  });

  await safeSend(() => sendEditRequestRejectedEmail(event.organizer.user.email, {
    username:  event.organizer.user.username,
    eventName: event.eventName,
    reason:    reason ?? "",
  }), "Edit Request Rejected");
}

module.exports = {
  getPublicEvents,
  getEventBySlug,
  getFeaturedEvents,
  getUpcomingEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getMyEvents,
  submitEventForApproval,
  getAllEvents,
  approveEvent,
  rejectEvent,
  updateFeaturedEvents,
  updateUpcomingEvents,
  registerForEvent,
  getEventRegistrations,
  approveRegistration,
  rejectRegistration,
  getAttendeeDetail,
  getMyRegistrationHistory,
  toggleNewsletterSubscription,
  addActivitiesToRegistration,
  requestEditPermission,
  approveEditPermission,
  rejectEditPermission,
};