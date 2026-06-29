// 네이버 블로그용 이미지 다운로드 모듈
// 글 본문의 외부(Pexels) 이미지를 JPG 파일로 내려받아 바탕화면 폴더에 저장한다.
// (네이버는 외부 핫링크 이미지를 못 가져오므로, 로컬 파일로 드래그 업로드용)
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 실제 바탕화면 경로 (OneDrive 리디렉션 대응)
function getDesktop() {
  const home = os.homedir();
  const c = [];
  if (process.env.OneDrive) {
    c.push(path.join(process.env.OneDrive, "바탕 화면"));
    c.push(path.join(process.env.OneDrive, "Desktop"));
  }
  c.push(path.join(home, "OneDrive", "바탕 화면"));
  c.push(path.join(home, "OneDrive", "Desktop"));
  c.push(path.join(home, "Desktop"));
  for (const p of c) { try { if (fs.existsSync(p)) return p; } catch {} }
  return path.join(home, "Desktop");
}

const BASE_DIR = path.join(getDesktop(), "네이버이미지");

function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 50) || "untitled";
}

// Pexels URL에 JPG 강제
function forceJpg(url) {
  let u = url.replace(/([?&])fm=[^&]*/g, "$1").replace(/[?&]+$/, "");
  return u + (u.includes("?") ? "&" : "?") + "fm=jpg";
}

// 해당 글(id)의 이미지 폴더가 이미 있고 파일이 들어있는지
function imagesExist(id) {
  try {
    if (!fs.existsSync(BASE_DIR)) return false;
    const dir = fs.readdirSync(BASE_DIR).find((d) => d.startsWith(String(id) + "_"));
    if (!dir) return false;
    return fs.readdirSync(path.join(BASE_DIR, dir)).length > 0;
  } catch {
    return false;
  }
}

// 글 본문에서 Pexels 이미지를 추출해 JPG로 저장. 실패해도 throw 안 함.
async function downloadNaverImages({ id, title, contentHtml }) {
  try {
    const urls = [
      ...new Set(
        [...contentHtml.matchAll(/https:\/\/images\.pexels\.com\/[^\s"'<>\\]+/g)]
          .map((m) => m[0].replace(/&amp;/g, "&"))
      ),
    ];
    if (urls.length === 0) return;
    if (imagesExist(id)) return; // 이미 받음

    const dir = path.join(BASE_DIR, `${id}_${sanitize(title)}`);
    fs.mkdirSync(dir, { recursive: true });
    let i = 1;
    for (const u of urls) {
      try {
        const res = await axios.get(forceJpg(u), {
          responseType: "arraybuffer",
          headers: { Accept: "image/jpeg,image/*" },
          timeout: 20000,
        });
        fs.writeFileSync(path.join(dir, `${i}.jpg`), Buffer.from(res.data));
        i++;
      } catch (e) {
        console.log("이미지 다운로드 실패(건너뜀):", e.message);
      }
    }
    if (i > 1) console.log(`🖼️ 네이버용 이미지 ${i - 1}개 저장:`, dir);
  } catch (e) {
    console.log("네이버 이미지 처리 실패(건너뜀):", e.message);
  }
}

module.exports = { downloadNaverImages, imagesExist, BASE_DIR };
