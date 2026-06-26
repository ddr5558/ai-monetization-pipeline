// Whale 브라우저 실행 파일 경로 자동 탐지
// 업데이트로 버전 폴더가 바뀌어도 깨지지 않도록 자동으로 찾는다.
// 우선순위: (1) 환경변수 WHALE_BROWSER_PATH → (2) 버전 독립 런처 → (3) 최신 버전 폴더
const fs = require("fs");
const path = require("path");

function cmpVersionDesc(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] || 0) - (pa[i] || 0);
    if (d) return d;
  }
  return 0;
}

function findWhalePath() {
  // (1) 환경변수로 직접 지정한 경우 최우선
  if (process.env.WHALE_BROWSER_PATH && fs.existsSync(process.env.WHALE_BROWSER_PATH)) {
    return process.env.WHALE_BROWSER_PATH;
  }
  const bases = [
    "C:\\Program Files\\Naver\\Naver Whale\\Application",
    "C:\\Program Files (x86)\\Naver\\Naver Whale\\Application",
    path.join(process.env.LOCALAPPDATA || "", "Naver", "Naver Whale", "Application"),
  ];
  for (const base of bases) {
    // (2) 버전 독립 런처 — 업데이트돼도 경로가 안 바뀜 (최선)
    const launcher = path.join(base, "whale.exe");
    if (fs.existsSync(launcher)) return launcher;
    // (3) 버전 폴더 중 최신 whale.exe
    try {
      const versions = fs
        .readdirSync(base)
        .filter((d) => /^\d+(\.\d+)+$/.test(d) && fs.existsSync(path.join(base, d, "whale.exe")))
        .sort(cmpVersionDesc);
      if (versions.length) return path.join(base, versions[0], "whale.exe");
    } catch {}
  }
  return null;
}

const WHALE_PATH = findWhalePath();

module.exports = { WHALE_PATH, findWhalePath };
