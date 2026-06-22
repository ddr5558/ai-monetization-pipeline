// 유튜브 쇼츠 대본 생성 모듈
// 기사 내용을 읽고 브루(Vrew)용 60초 쇼츠 대본을 만들어 바탕화면 폴더에 저장한다.
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 실제 바탕화면 경로 찾기 (OneDrive 리디렉션 대응)
function getDesktop() {
  const home = os.homedir();
  const candidates = [];
  if (process.env.OneDrive) {
    candidates.push(path.join(process.env.OneDrive, "바탕 화면"));
    candidates.push(path.join(process.env.OneDrive, "Desktop"));
  }
  candidates.push(path.join(home, "OneDrive", "바탕 화면"));
  candidates.push(path.join(home, "OneDrive", "Desktop"));
  candidates.push(path.join(home, "Desktop"));
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return path.join(home, "Desktop");
}

// 저장 폴더: 실제 바탕화면\쇼츠대본
const SHORTS_DIR = path.join(getDesktop(), "쇼츠대본");

// Anthropic 키: 로컬 설정 파일(.shorts-config.json) 또는 환경변수
function getApiKey() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.resolve("./.shorts-config.json"), "utf8"));
    return cfg.anthropicKey || process.env.ANTHROPIC_API_KEY;
  } catch {
    return process.env.ANTHROPIC_API_KEY;
  }
}

// 파일명에 못 쓰는 문자 제거
function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 50) || "untitled";
}

// 쇼츠 대본 생성 + 저장. 실패해도 미러링은 계속되도록 throw 안 함.
async function generateShorts({ id, title, contentHtml, url }) {
  const key = getApiKey();
  if (!key) {
    console.log("Anthropic 키 없음(.shorts-config.json) — 쇼츠 대본 생략");
    return;
  }
  try {
    const articleText = contentHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);

    const prompt = `${url ? url + "의 " : ""}아래 블로그 글을 읽고, 브루(Vrew) '텍스트로 비디오 만들기'에 바로 붙여넣을 수 있는 60초 쇼츠 대본을 만들어줘.

[글 제목] ${title}
[글 내용]
${articleText}

조건:
- 구어체, 친근한 톤
- 첫 문장은 3초 안에 주목 끄는 후킹 멘트
- 한 문단(빈 줄로 구분) = 한 장면, 문단당 1~2문장 이내로 짧게
- 전체 350~450자 내외 (60초 내레이션 기준)
- 어려운 용어는 풀어서 설명
- 마지막은 질문이나 한 줄 정리로 마무리

대본 본문만 출력해줘 (설명·머리말·따옴표 없이, 브루에 바로 붙여넣게).`;

    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const script = res.content[0].text.trim();

    if (!fs.existsSync(SHORTS_DIR)) fs.mkdirSync(SHORTS_DIR, { recursive: true });
    const file = path.join(SHORTS_DIR, `${id}_${sanitize(title)}.txt`);
    fs.writeFileSync(file, script, "utf8");
    console.log("📝 쇼츠 대본 저장:", file);
  } catch (e) {
    console.log("쇼츠 대본 생성 실패(건너뜀):", e.message);
  }
}

module.exports = { generateShorts, SHORTS_DIR };
