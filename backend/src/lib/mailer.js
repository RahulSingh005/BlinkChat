import nodemailer from "nodemailer";

let transporter = null;

const isEmailConfigured = () =>
  Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const getTransporter = () => {
  if (!isEmailConfigured()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

/**
 * Sends the password-reset OTP email.
 * Falls back to logging the OTP to the server console when SMTP
 * credentials are not configured, so the flow is still testable
 * locally without setting up a real mailbox.
 */
export const sendOtpEmail = async (toEmail, otp) => {
  const t = getTransporter();

  if (!t) {
    console.log(
      `\n[BlinkChat] EMAIL_USER/EMAIL_PASS not configured — printing OTP instead of emailing it.\n` +
        `[BlinkChat] Password reset OTP for ${toEmail}: ${otp} (valid for 10 minutes)\n`
    );
    return { delivered: false };
  }

  await t.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: toEmail,
    subject: "Your BlinkChat password reset code",
    text: `Your BlinkChat verification code is ${otp}. It expires in 10 minutes. If you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color:#7c3aed;">BlinkChat password reset</h2>
        <p>Use the code below to reset your password. This code expires in 10 minutes.</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; background: #f4f4f7; padding: 16px; border-radius: 12px;">${otp}</p>
        <p style="color: #888; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return { delivered: true };
};
