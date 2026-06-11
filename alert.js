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
    // host가 지정되면 직접 SMTP(네이버 등), 아니면 service 약칭(gmail 등)
    const transportConfig = cfg.host
      ? { host: cfg.host, port: cfg.port || 465, secure: cfg.secure !== false }
      : { service: cfg.service || "gmail" };
    transportConfig.auth = { user: cfg.user, pass: cfg.pass };
    const transporter = nodemailer.createTransport(transportConfig);
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
