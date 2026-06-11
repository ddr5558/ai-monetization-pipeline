// 메일 알림 모듈 — .alert-config.json 설정을 읽어 메일 발송
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

async function sendAlert(subject, text) {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(path.resolve("./.alert-config.json"), "utf8"));
  } catch {
    console.log("알림 설정(.alert-config.json) 없음 — 메일 생략");
    return;
  }
  if (!cfg.user || !cfg.pass) {
    console.log("알림 설정 불완전(user/pass 없음) — 메일 생략");
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: cfg.service || "gmail",
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
      from: cfg.user,
      to: cfg.to || cfg.user,
      subject,
      text,
    });
    console.log("📧 알림 메일 발송됨 →", cfg.to || cfg.user);
  } catch (e) {
    console.log("알림 메일 발송 실패:", e.message);
  }
}

module.exports = { sendAlert };
