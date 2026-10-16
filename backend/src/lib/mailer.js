import nodemailer from "nodemailer";
import { env, features } from "../config/env.js";

let transporter = null;

const getTransporter = () => {
  if (!features.email) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
    });
  }
  return transporter;
};

/** Password reset is available when SMTP is set up (or always in development). */
export const passwordResetAvailable = () => features.email || !env.isProd;

const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Sends the password-reset code. In development without SMTP the code is
 * printed to the server console so the flow can still be tested. In
 * production the code is never logged.
 */
export async function sendOtpEmail(toEmail, otp, name = "") {
  const t = getTransporter();
  if (!t) {
    if (env.isProd) throw new Error("Email is not configured");
    console.log(`\n[mail] SMTP not configured — password reset code for ${toEmail}: ${otp} (valid 10 minutes)\n`);
    return { delivered: false };
  }

  const greeting = name ? `Hi ${escapeHtml(name.split(" ")[0])},` : "Hi,";
  await t.sendMail({
    from: env.EMAIL_FROM || `BlinkChat <${env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${otp} is your BlinkChat verification code`,
    text: `${greeting.replace(/<[^>]+>/g, "")}\n\nYour BlinkChat verification code is ${otp}. It expires in 10 minutes.\n\nIf you didn't request a password reset, you can ignore this email — your password won't change.`,
    html: `
      <div style="background:#f4f6fb;padding:32px 16px;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <div style="max-width:460px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e6e9f2;">
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:24px;">
            <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#3b5bfd,#0ea5e9);vertical-align:middle;margin-right:8px;"></span>BlinkChat
          </div>
          <p style="color:#0f172a;font-size:15px;margin:0 0 8px;">${greeting}</p>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">Use this code to reset your password. It expires in <strong>10 minutes</strong>.</p>
          <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;background:#f1f4ff;color:#2f47d6;padding:18px 0;border-radius:12px;">${otp}</div>
          <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:24px 0 0;">If you didn't request this, you can safely ignore this email. Never share this code with anyone — BlinkChat will never ask for it.</p>
        </div>
      </div>`,
  });
  return { delivered: true };
}
