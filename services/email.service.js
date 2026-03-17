const { Resend } = require("resend");
const { processTemplate } = require("./template.engine");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL; 

function formatDateTime(date) {
  if (!date) return "";
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

async function sendEmail({ to, subject, html }) {
  console.log("[DEBUG] FROM_EMAIL:", FROM_EMAIL); 
  console.log("[DEBUG] TO:", to);
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    console.error(`[Email] Gửi thất bại tới ${to}:`, err.message);
    throw err;
  }
}


async function sendVerificationEmail(to, username, otpCode) {
  const html = processTemplate("verify-account", { username, otpCode });
  await sendEmail({ to, subject: "Mã xác thực tài khoản Webie Event", html });
  console.log(`[Email] OTP đã gửi tới ${to}`);
}


async function sendPasswordChangedEmail(to, username) {
  const html = processTemplate("password-changed", { username });
  await sendEmail({ to, subject: "Mật khẩu của bạn đã được thay đổi", html });
  console.log(`[Email] Thông báo đổi mật khẩu gửi tới ${to}`);
}
async function sendForgotPasswordEmail(to, username, otpCode) {
  const html = processTemplate("forgot-password", { username, otpCode });
  await sendEmail({ to, subject: "Mã xác nhận đặt lại mật khẩu - Webie Event", html });
  console.log(`[Email] OTP quên mật khẩu đã gửi tới ${to}`);
}

async function sendRegistrationPendingEmail(to, { username, eventName, startDateTime, endDateTime, location }) {
  const html = processTemplate("event-registration-pending", {
    username,
    eventName,
    eventStartFull: formatDateTime(startDateTime),
    eventEndFull: formatDateTime(endDateTime),
    location: location ?? "",
  });
  await sendEmail({ to, subject: `Xác nhận đăng ký: ${eventName}`, html });
}


async function sendRegistrationApprovedEmail(to, {
  username, eventName, eventStartDateTime, eventEndDateTime,
  location, ticketCode, activityList = [],
}) {
  let qrCodeUrl = "";
  if (ticketCode) {
    const encoded = encodeURIComponent(ticketCode);
    qrCodeUrl = `https://quickchart.io/qr?text=${encoded}&size=300&margin=1`;
  }

  const activityRows = activityList
    .map((a) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #222;color:#aaa;">${a.name ?? ""}</td>
      <td style="padding:8px;border-bottom:1px solid #222;color:#aaa;">${formatDateTime(a.startTime)}</td>
      <td style="padding:8px;border-bottom:1px solid #222;color:#aaa;">${a.location ?? ""}</td>
    </tr>`)
    .join("");

  const html = processTemplate("event-registration-approved", {
    username,
    eventName,
    eventStartFull: formatDateTime(eventStartDateTime),
    eventEndFull: formatDateTime(eventEndDateTime),
    location: location ?? "",
    ticketCode: ticketCode ?? "",
    qrCodeUrl,
    activityRows, // template dùng {{activityRows}} thay vì th:each
  });

  await sendEmail({ to, subject: `Vé tham dự sự kiện: ${eventName}`, html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Đăng ký sự kiện — bị từ chối
//    Tương đương sendRegistrationRejectedEmail()
// ─────────────────────────────────────────────────────────────────────────────
async function sendRegistrationRejectedEmail(to, { username, eventName, startDateTime, location, reason }) {
  const html = processTemplate("event-registration-rejected", {
    username,
    eventName,
    eventStartFull: formatDateTime(startDateTime),
    location: location ?? "",
    reason: reason ?? "",
  });
  await sendEmail({ to, subject: `Thông báo kết quả đăng ký: ${eventName}`, html });
  console.log(`[Email] Từ chối đăng ký gửi tới ${to}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Organizer gửi sự kiện — đang chờ duyệt
//    Tương đương sendEventSubmissionPending()
// ─────────────────────────────────────────────────────────────────────────────
async function sendEventSubmissionPending(to, { username, eventName, submittedDate }) {
  const html = processTemplate("event-submission-pending", {
    username,
    eventName,
    submittedDate: formatDateTime(submittedDate),
  });
  await sendEmail({ to, subject: `Xác nhận gửi yêu cầu duyệt: ${eventName}`, html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Sự kiện được Admin duyệt
//    Tương đương sendEventApprovedEmail()
// ─────────────────────────────────────────────────────────────────────────────
async function sendEventApprovedEmail(to, { username, eventName, eventStartDate, eventSlug }) {
  const eventLink = `${process.env.FRONTEND_URL}/events/${eventSlug}`;
  const html = processTemplate("event-submission-approved", {
    username,
    eventName,
    eventDate: formatDateTime(eventStartDate),
    eventLink,
  });
  await sendEmail({ to, subject: `Sự kiện của bạn đã được duyệt: ${eventName}`, html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Sự kiện bị Admin từ chối
//    Tương đương sendEventRejectedEmail()
// ─────────────────────────────────────────────────────────────────────────────
async function sendEventRejectedEmail(to, { username, eventName, reason }) {
  const html = processTemplate("event-submission-rejected", { username, eventName, reason: reason ?? "" });
  await sendEmail({ to, subject: `Thông báo từ chối sự kiện: ${eventName}`, html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Đăng ký Organizer — đang chờ duyệt
//    Tương đương sendOrganizerRegistrationPending()
// ─────────────────────────────────────────────────────────────────────────────
async function sendOrganizerRegistrationPending(to, { username, organizerName }) {
  const html = processTemplate("organizer-pending", { username, organizerName });
  await sendEmail({ to, subject: `Xác nhận đăng ký Organizer: ${organizerName}`, html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Đăng ký Organizer — được duyệt
//     Tương đương sendOrganizerApproved()
// ─────────────────────────────────────────────────────────────────────────────
async function sendOrganizerApproved(to, { username, organizerName }) {
  const html = processTemplate("organizer-approved", { username, organizerName });
  await sendEmail({ to, subject: "Chúc mừng! Bạn đã trở thành Organizer", html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Đăng ký Organizer — bị từ chối
//     Tương đương sendOrganizerRejected()
// ─────────────────────────────────────────────────────────────────────────────
async function sendOrganizerRejected(to, { username, organizerName, reason }) {
  const html = processTemplate("organizer-rejected", { username, organizerName, reason: reason ?? "" });
  await sendEmail({ to, subject: "Thông báo kết quả đăng ký Organizer", html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Nhắc nhở sự kiện (1 ngày trước)
//     Tương đương sendEventReminderEmail()
// ─────────────────────────────────────────────────────────────────────────────
async function sendEventReminderEmail(to, { username, eventName, startDate, location, ticketCode, eventSlug }) {
  const eventLink = `https://ems.webie.com.vn/event/${eventSlug}`;
  const html = processTemplate("event-reminder", {
    username,
    eventName,
    startTime: formatDateTime(startDate),
    location: location ?? "",
    ticketCode: ticketCode ?? "",
    eventLink,
  });
  await sendEmail({ to, subject: `Nhắc nhở: Sự kiện ${eventName} diễn ra vào ngày mai!`, html });
  console.log(`[Email] Reminder gửi tới ${to}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Newsletter hàng tuần
//     Tương đương sendWeeklyNewsletter()
// ─────────────────────────────────────────────────────────────────────────────
async function sendWeeklyNewsletter(to, events = []) {
  // Render danh sách sự kiện thành HTML rows
  const eventRows = events
    .map((e) => `<tr>
      <td style="padding:12px;border-bottom:1px solid #222;">
        <a href="${process.env.FRONTEND_URL}/events/${e.slug}" style="color:#d4af37;font-weight:bold;text-decoration:none;">
          ${e.name ?? ""}
        </a>
      </td>
      <td style="padding:12px;border-bottom:1px solid #222;color:#aaa;">${formatDateTime(e.startDateTime)}</td>
      <td style="padding:12px;border-bottom:1px solid #222;color:#aaa;">${e.location ?? ""}</td>
    </tr>`)
    .join("");

  const html = processTemplate("weekly-newsletter", { eventRows });
  await sendEmail({ to, subject: "🔥 Tổng hợp sự kiện mới tuần qua - Webie Event", html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Yêu cầu chỉnh sửa sự kiện — đang chờ duyệt
//     Tương đương sendEditRequestPendingEmail()
// ─────────────────────────────────────────────────────────────────────────────
async function sendEditRequestPendingEmail(to, { username, eventName, reason }) {
  const html = processTemplate("event-edit-request-pending", {
    username,
    eventName,
    reason: reason ?? "",
    submittedDate: formatDateTime(new Date()),
  });
  await sendEmail({ to, subject: `Đã tiếp nhận yêu cầu chỉnh sửa: ${eventName}`, html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. Yêu cầu chỉnh sửa sự kiện — được chấp thuận
//     Tương đương sendEditRequestApprovedEmail()
// ─────────────────────────────────────────────────────────────────────────────
async function sendEditRequestApprovedEmail(to, { username, eventName, eventSlug }) {
  const editLink = `${process.env.FRONTEND_URL}/organizer/events/${eventSlug}/edit`;
  const html = processTemplate("event-edit-request-approved", { username, eventName, editLink });
  await sendEmail({ to, subject: `Yêu cầu chỉnh sửa được CHẤP THUẬN: ${eventName}`, html });
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. Yêu cầu chỉnh sửa sự kiện — bị từ chối
//     Tương đương sendEditRequestRejectedEmail()
// ─────────────────────────────────────────────────────────────────────────────
async function sendEditRequestRejectedEmail(to, { username, eventName, reason }) {
  const html = processTemplate("event-edit-request-rejected", { username, eventName, reason: reason ?? "" });
  await sendEmail({ to, subject: `Yêu cầu chỉnh sửa BỊ TỪ CHỐI: ${eventName}`, html });
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple text email (tương đương sendSimpleMail())
// ─────────────────────────────────────────────────────────────────────────────
async function sendSimpleMail(to, subject, text) {
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, text });
    if (error) throw new Error(error.message);
    console.log(`[Email] Gửi thành công! ID: ${data.id}`);
    return `Gửi mail thành công! ID: ${data.id}`;
  } catch (err) {
    console.error(`[Email] Lỗi: ${err.message}`);
    return `Lỗi khi gửi mail: ${err.message}`;
  }
}

module.exports = {
  sendForgotPasswordEmail,
  sendVerificationEmail,
  sendPasswordChangedEmail,
  sendRegistrationPendingEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendEventSubmissionPending,
  sendEventApprovedEmail,
  sendEventRejectedEmail,
  sendOrganizerRegistrationPending,
  sendOrganizerApproved,
  sendOrganizerRejected,
  sendEventReminderEmail,
  sendWeeklyNewsletter,
  sendEditRequestPendingEmail,
  sendEditRequestApprovedEmail,
  sendEditRequestRejectedEmail,
  sendSimpleMail,
};