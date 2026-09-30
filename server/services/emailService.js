import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cấu hình Transporter gửi email qua Gmail SMTP
 * Hỗ trợ các biến môi trường:
 * - GMAIL_USER hoặc EMAIL_USER: Địa chỉ Gmail (vd: 42tuana2k46@gmail.com)
 * - GMAIL_APP_PASSWORD hoặc EMAIL_PASS: Mật khẩu ứng dụng 16 ký tự do Google cấp
 */
function createTransporter() {
  const user = process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || process.env.MAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ''), // Xóa khoảng trắng do copy
    },
  });
}

/**
 * Gửi email chứa mã xác thực OTP
 */
export async function sendOtpEmail({ toEmail, otpCode, username = 'Quý khách' }) {
  const transporter = createTransporter();
  const fromUser = process.env.GMAIL_USER || process.env.EMAIL_USER || 'no-reply@trustwarranty.io';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background-color: #0f172a; color: #e2e8f0; border-radius: 18px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px 28px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
          TrustWarranty System
        </h1>
        <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 13px;">
          Hệ thống Quản lý Bảo hành & Lịch sử Dịch vụ On-Chain
        </p>
      </div>

      <div style="padding: 32px 28px; background-color: #0f172a;">
        <h2 style="margin: 0 0 14px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
          Xác thực Đăng Ký Tài Khoản
        </h2>
        <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Xin chào <strong>${username}</strong>,<br>
          Bạn đang thực hiện thao tác tạo tài khoản mới trên hệ thống TrustWarranty. Vui lòng sử dụng mã xác thực OTP bên dưới để hoàn tất đăng ký:
        </p>

        <div style="background: #1e293b; border: 2px dashed #3b82f6; border-radius: 14px; padding: 22px; text-align: center; margin: 26px 0;">
          <div style="font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
            Mã Xác Thực OTP Của Bạn
          </div>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #60a5fa; text-shadow: 0 0 12px rgba(96, 165, 250, 0.4);">
            ${otpCode}
          </div>
          <div style="margin-top: 10px; font-size: 12px; color: #f59e0b;">
            ⏱ Có hiệu lực trong vòng <strong>5 phút</strong>
          </div>
        </div>

        <div style="background-color: rgba(30, 41, 59, 0.6); border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.5;">
            🔒 <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã OTP này cho bất kỳ ai. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.
          </p>
        </div>

        <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
          Trân trọng,<br>
          <strong style="color: #94a3b8;">Đội ngũ Phát triển TrustWarranty</strong>
        </p>
      </div>

      <div style="background-color: #0b1120; padding: 18px 28px; text-align: center; border-top: 1px solid #1e293b;">
        <p style="margin: 0; color: #475569; font-size: 11px;">
          Đây là email tự động từ hệ thống. Vui lòng không trả lời trực tiếp email này.
        </p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"TrustWarranty System" <${fromUser}>`,
        to: toEmail,
        subject: `[TrustWarranty] Mã OTP xác thực tài khoản của bạn: ${otpCode}`,
        text: `Mã OTP xác thực tài khoản TrustWarranty của bạn là: ${otpCode}. Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này.`,
        html: htmlContent,
      });

      console.log(`\n📧 [EMAIL OTP SENT] Đã gửi thành công OTP (${otpCode}) tới: ${toEmail} | MessageID: ${info.messageId}`);
      return { success: true, mode: 'smtp' };
    } catch (err) {
      console.error(`\n❌ [EMAIL SMTP ERROR] Lỗi gửi email tới ${toEmail}:`, err.message);
      printDevOtpBox(toEmail, otpCode, err.message);
      return {
        success: true,
        mode: 'dev',
        devOtp: otpCode,
        warning: `Không thể kết nối Gmail SMTP: ${err.message}. Mã OTP đã được in tại terminal máy chủ.`
      };
    }
  } else {
    printDevOtpBox(toEmail, otpCode, 'Chưa cấu hình GMAIL_USER và GMAIL_APP_PASSWORD trong file .env');
    return {
      success: true,
      mode: 'dev',
      devOtp: otpCode,
      message: 'Chưa cấu hình Gmail SMTP. Mã OTP được cung cấp trực tiếp phục vụ kiểm thử.'
    };
  }
}

/**
 * Gửi email xác nhận kích hoạt bảo hành điện tử thành công
 */
export async function sendWarrantyActivationEmail({
  toEmail,
  customerName = 'Quý khách',
  serialNumber,
  modelCode = 'Thiết bị chính hãng',
  productName = 'Sản phẩm chính hãng',
  brand = 'TrustWarranty Partner',
  expiryDate,
  txHash,
}) {
  const transporter = createTransporter();
  const fromUser = process.env.GMAIL_USER || process.env.EMAIL_USER || 'no-reply@trustwarranty.io';

  const formattedExpiry = expiryDate
    ? (typeof expiryDate === 'number' ? new Date(expiryDate * 1000).toLocaleDateString('vi-VN') : expiryDate)
    : '24 tháng kể từ ngày kích hoạt';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b1120; color: #e2e8f0; border-radius: 20px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.6);">
      
      <!-- Top Brand Header -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 34px 28px; text-align: center;">
        <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
          BẢO CHỨNG BLOCKCHAIN • CHÍNH HÃNG 100%
        </span>
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">
          Kích Hoạt Bảo Hành Thành Công!
        </h1>
        <p style="margin: 6px 0 0 0; color: #d1fae5; font-size: 13px;">
          Hợp đồng bảo hành điện tử của bạn đã được ghi nhận vĩnh viễn trên sổ cái phi tập trung.
        </p>
      </div>

      <!-- Main Body -->
      <div style="padding: 30px 28px; background-color: #0b1120;">
        <p style="margin: 0 0 18px 0; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Kính chào <strong>${customerName}</strong>,<br>
          Hệ thống xin thông báo thiết bị của bạn đã được kích hoạt bảo hành điện tử chính thức. Dưới đây là thông tin chi tiết hợp đồng bảo hành:
        </p>

        <!-- Product Specs Card -->
        <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 14px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 7px 0; color: #94a3b8; width: 38%;">Thiết bị:</td>
              <td style="padding: 7px 0; color: #ffffff; font-weight: 700;">${productName}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Thương hiệu:</td>
              <td style="padding: 7px 0; color: #e2e8f0; font-weight: 600;">${brand}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Số Serial (S/N):</td>
              <td style="padding: 7px 0; font-family: monospace; color: #fde047; font-weight: 700; font-size: 14px;">${serialNumber}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Mã Model:</td>
              <td style="padding: 7px 0; font-family: monospace; color: #93c5fd;">${modelCode}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Hạn bảo hành:</td>
              <td style="padding: 7px 0; color: #34d399; font-weight: 700;">${formattedExpiry}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Tx Hash On-Chain:</td>
              <td style="padding: 7px 0; font-family: monospace; color: #a78bfa; font-size: 11px; word-break: break-all;">
                ${txHash || '0x' + Math.random().toString(16).slice(2)}
              </td>
            </tr>
          </table>
        </div>

        <!-- Call to Action -->
        <div style="text-align: center; margin: 28px 0 20px 0;">
          <a href="http://localhost:3000/?serial=${encodeURIComponent(serialNumber)}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 12px; font-weight: 700; font-size: 13px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4);">
            Tra Cứu & Tải Giấy Chứng Nhận PDF
          </a>
        </div>

        <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5; text-align: center;">
          Giấy chứng nhận có thể in trực tiếp hoặc xuất thành file PDF chuẩn A4 có dấu mộc mật mã.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #070d19; padding: 18px 28px; text-align: center; border-top: 1px solid #1e293b;">
        <p style="margin: 0; color: #475569; font-size: 11px;">
          TrustWarranty Protocol • Dịch vụ bảo hành phân tán chống gian lận thương mại.
        </p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"TrustWarranty Service" <${fromUser}>`,
        to: toEmail,
        subject: `[TrustWarranty] Xác nhận Kích hoạt Bảo hành Thành công: Thiết bị ${serialNumber}`,
        text: `Kính chào ${customerName}, Thiết bị ${serialNumber} đã được kích hoạt bảo hành thành công với thời hạn đến ${formattedExpiry}. TxHash: ${txHash}`,
        html: htmlContent,
      });
      console.log(`\n📧 [EMAIL ACTIVATION SENT] Đã gửi biên nhận kích hoạt (${serialNumber}) tới: ${toEmail} | MessageID: ${info.messageId}`);
      return { success: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error(`\n❌ [EMAIL ACTIVATION ERROR] Lỗi gửi email tới ${toEmail}:`, err.message);
      return { success: false, mode: 'dev', error: err.message };
    }
  } else {
    console.log(`\nℹ️ [EMAIL MOCK] Kích hoạt bảo hành cho ${serialNumber} đã gửi thông báo ảo tới ${toEmail} (Chưa bật SMTP).`);
    return { success: true, mode: 'dev', message: 'Chế độ mô phỏng email thành công' };
  }
}

/**
 * Gửi email biên bản hoàn tất dịch vụ sửa chữa / bảo dưỡng
 */
export async function sendRepairCompletedEmail({
  toEmail,
  customerName = 'Quý khách',
  serialNumber,
  serviceType = 'Bảo dưỡng / Sửa chữa',
  notes = 'Hoàn tất kiểm tra kỹ thuật',
  replacedPart = 'Không thay thế',
  technicianId = 'TECH-VERIFIED',
  txHash,
}) {
  const transporter = createTransporter();
  const fromUser = process.env.GMAIL_USER || process.env.EMAIL_USER || 'no-reply@trustwarranty.io';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b1120; color: #e2e8f0; border-radius: 20px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.6);">
      
      <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 32px 28px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">
          Biên Bản Dịch Vụ Hoàn Tất
        </h1>
        <p style="margin: 6px 0 0 0; color: #fef3c7; font-size: 13px;">
          Lịch sử sửa chữa đã được khắc bất biến vào Sổ cái Blockchain
        </p>
      </div>

      <div style="padding: 30px 28px; background-color: #0b1120;">
        <p style="margin: 0 0 18px 0; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Kính chào <strong>${customerName}</strong>,<br>
          Trạm Dịch vụ Ủy quyền xin trân trọng thông báo thiết bị mang số Serial <strong>${serialNumber}</strong> của bạn đã hoàn tất quy trình kỹ thuật.
        </p>

        <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 14px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 7px 0; color: #94a3b8; width: 40%;">Thiết bị (Serial):</td>
              <td style="padding: 7px 0; font-family: monospace; color: #fde047; font-weight: 700;">${serialNumber}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Hạng mục dịch vụ:</td>
              <td style="padding: 7px 0; color: #ffffff; font-weight: 600;">${serviceType}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Linh kiện thay thế:</td>
              <td style="padding: 7px 0; color: #38bdf8;">${replacedPart}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Kỹ thuật viên phụ trách:</td>
              <td style="padding: 7px 0; font-family: monospace; color: #a78bfa;">${technicianId}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Ghi chú kỹ thuật:</td>
              <td style="padding: 7px 0; color: #e2e8f0; font-style: italic;">${notes}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Mã băm giao dịch (Tx):</td>
              <td style="padding: 7px 0; font-family: monospace; color: #94a3b8; font-size: 11px; word-break: break-all;">
                ${txHash || '0x' + Math.random().toString(16).slice(2)}
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 26px 0 16px 0;">
          <a href="http://localhost:3000/?serial=${encodeURIComponent(serialNumber)}" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 12px; font-weight: 700; font-size: 13px;">
            Xem Toàn Bộ Nhật Ký Dịch Vụ Của Máy
          </a>
        </div>
      </div>

      <div style="background-color: #070d19; padding: 16px 28px; text-align: center; border-top: 1px solid #1e293b;">
        <p style="margin: 0; color: #475569; font-size: 11px;">
          Mọi dữ liệu sửa chữa trên hệ thống được ký số bằng Ethereum Smart Contract để chống gian lận linh kiện.
        </p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"TrustWarranty Service" <${fromUser}>`,
        to: toEmail,
        subject: `[TrustWarranty] Biên bản Hoàn tất Sửa chữa Thiết bị ${serialNumber}`,
        text: `Kính chào ${customerName}, Thiết bị ${serialNumber} đã hoàn tất ${serviceType}. Kỹ thuật viên: ${technicianId}.`,
        html: htmlContent,
      });
      console.log(`\n📧 [EMAIL REPAIR SENT] Đã gửi biên bản sửa chữa (${serialNumber}) tới: ${toEmail} | MessageID: ${info.messageId}`);
      return { success: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error(`\n❌ [EMAIL REPAIR ERROR] Lỗi gửi email tới ${toEmail}:`, err.message);
      return { success: false, mode: 'dev', error: err.message };
    }
  } else {
    console.log(`\nℹ️ [EMAIL MOCK] Hoàn tất sửa chữa ${serialNumber} đã gửi thông báo ảo tới ${toEmail}`);
    return { success: true, mode: 'dev', message: 'Chế độ mô phỏng email thành công' };
  }
}

/**
 * Gửi email cảnh báo thời hạn bảo hành sắp kết thúc (còn dưới 30 ngày)
 */
export async function sendWarrantyExpiringEmail({
  toEmail,
  customerName = 'Quý khách',
  serialNumber,
  productName = 'Sản phẩm chính hãng',
  brand = 'TrustWarranty Partner',
  expiryDate,
  daysRemaining = 30,
}) {
  const transporter = createTransporter();
  const fromUser = process.env.GMAIL_USER || process.env.EMAIL_USER || 'no-reply@trustwarranty.io';

  const formattedExpiry = expiryDate
    ? (typeof expiryDate === 'number' ? new Date(expiryDate * 1000).toLocaleDateString('vi-VN') : expiryDate)
    : 'Trong 30 ngày tới';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b1120; color: #e2e8f0; border-radius: 20px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.6);">
      
      <!-- Top Brand Header (Amber Warning) -->
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%); padding: 34px 28px; text-align: center;">
        <span style="display: inline-block; background-color: rgba(0, 0, 0, 0.25); color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
          ⚠️ THÔNG BÁO BẢO HÀNH SẮP HẾT HẠN
        </span>
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">
          Còn ${daysRemaining} Ngày Bảo Hành!
        </h1>
        <p style="margin: 6px 0 0 0; color: #fef3c7; font-size: 13px;">
          Gói bảo hành chính hãng của thiết bị sắp hết thời gian hiệu lực on-chain.
        </p>
      </div>

      <!-- Main Body -->
      <div style="padding: 30px 28px; background-color: #0b1120;">
        <p style="margin: 0 0 18px 0; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Kính chào <strong>${customerName}</strong>,<br>
          Hệ thống TrustWarranty ghi nhận thiết bị <strong>${productName}</strong> của bạn chỉ còn <strong>${daysRemaining} ngày</strong> bảo hành chính hãng. Để đảm bảo quyền lợi sửa chữa và bảo dưỡng miễn phí, bạn có thể liên hệ đại lý ủy quyền để tham gia chương trình <strong>Gia hạn bảo hành mở rộng</strong>.
        </p>

        <!-- Product Specs Card -->
        <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 14px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 7px 0; color: #94a3b8; width: 40%;">Thiết bị:</td>
              <td style="padding: 7px 0; color: #ffffff; font-weight: 700;">${productName}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Số Serial (S/N):</td>
              <td style="padding: 7px 0; font-family: monospace; color: #fde047; font-weight: 700;">${serialNumber}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Ngày hết hạn dự kiến:</td>
              <td style="padding: 7px 0; color: #f87171; font-weight: 700;">${formattedExpiry}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #94a3b8;">Thời gian còn lại:</td>
              <td style="padding: 7px 0; color: #fbbf24; font-weight: 700;">${daysRemaining} ngày</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 26px 0 16px 0;">
          <a href="http://localhost:3000/?serial=${encodeURIComponent(serialNumber)}" style="display: inline-block; background: #d97706; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 12px; font-weight: 700; font-size: 13px;">
            Tra Cứu Chi Tiết & Đăng Ký Gia Hạn
          </a>
        </div>
      </div>

      <div style="background-color: #070d19; padding: 16px 28px; text-align: center; border-top: 1px solid #1e293b;">
        <p style="margin: 0; color: #475569; font-size: 11px;">
          Hợp đồng bảo hành điện tử được theo dõi tự động trên sổ cái phi tập trung.
        </p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"TrustWarranty Alert" <${fromUser}>`,
        to: toEmail,
        subject: `[Cảnh báo] Bảo hành thiết bị ${serialNumber} sắp hết hạn (Còn ${daysRemaining} ngày)`,
        text: `Kính chào ${customerName}, Bảo hành thiết bị ${serialNumber} (${productName}) chỉ còn ${daysRemaining} ngày (Hết hạn: ${formattedExpiry}).`,
        html: htmlContent,
      });
      console.log(`\n📧 [EMAIL EXPIRY ALERT SENT] Đã gửi cảnh báo hết hạn (${serialNumber}) tới: ${toEmail} | MessageID: ${info.messageId}`);
      return { success: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error(`\n❌ [EMAIL EXPIRY ALERT ERROR] Lỗi gửi email tới ${toEmail}:`, err.message);
      return { success: false, mode: 'dev', error: err.message };
    }
  } else {
    console.log(`\nℹ️ [EMAIL MOCK] Cảnh báo hết hạn ${serialNumber} (còn ${daysRemaining} ngày) đã gửi thông báo ảo tới ${toEmail}`);
    return { success: true, mode: 'dev', message: 'Chế độ mô phỏng email thành công' };
  }
}

function printDevOtpBox(toEmail, otpCode, reason) {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║               📧 TRUSTWARRANTY EMAIL OTP SERVICE                 ║');
  console.log('╠═══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Gửi tới Email:  ${toEmail.padEnd(48)}║`);
  console.log(`║  MÃ XÁC THỰC:    ${otpCode} (Hiệu lực: 5 phút)                      ║`);
  console.log(`║  Trạng thái:     [CHẾ ĐỘ MÃ THỬ NGHIỆM TỰ ĐỘNG]                  ║`);
  console.log(`║  Ghi chú:        ${reason.slice(0, 48).padEnd(48)}║`);
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
}
