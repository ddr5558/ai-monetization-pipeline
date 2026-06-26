// 티스토리 발행 공유 모듈
// - 로그인된 Whale(원격 디버깅 9222)에 connect해서 글을 발행한다.
// - Whale이 없으면 자동 실행, '복구' 알림 차단, 세션 만료 시 깔끔히 건너뜀.
const puppeteer = require("puppeteer-core");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const { WHALE_PATH } = require("./whalePath"); // 자동 탐지 (업데이트 대응)
const TISTORY_BLOG = "ddr5558.tistory.com";

// 9222 디버깅 포트가 응답하는지 확인 (= Whale이 떠 있는지)
function isDebugPortUp() {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:9222/json/version", (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 프로필에 "정상 종료됨" 표시를 심어 다음 실행 시 '복구' 알림이 안 뜨게 한다.
function markProfileExitedClean() {
  const pref = path.resolve("./whale-profile/Default/Preferences");
  try {
    const data = JSON.parse(fs.readFileSync(pref, "utf8"));
    if (data.profile) {
      data.profile.exit_type = "Normal";
      data.profile.exited_cleanly = true;
      fs.writeFileSync(pref, JSON.stringify(data));
    }
  } catch {
    // Preferences가 없거나 파싱 실패 시 무시 (첫 실행 등)
  }
}

// Whale(9222)이 안 떠 있으면 자동으로 띄우고, 포트가 응답할 때까지 대기
async function ensureWhaleRunning() {
  if (await isDebugPortUp()) return; // 이미 떠 있음

  // Whale 실행 파일이 없으면(예: 리눅스 서버) 깔끔히 건너뛴다.
  if (!fs.existsSync(WHALE_PATH)) {
    throw new Error("Whale 실행 파일 없음 - 티스토리는 로컬 PC에서만 발행 가능");
  }

  console.log("Whale(9222)이 없어 자동으로 실행합니다...");
  markProfileExitedClean(); // 띄우기 직전에 복구 알림 차단
  const profile = path.resolve("./whale-profile");
  const child = spawn(
    WHALE_PATH,
    [`--remote-debugging-port=9222`, `--user-data-dir=${profile}`],
    { detached: true, stdio: "ignore" }
  );
  child.on("error", () => {}); // spawn 실패해도 프로세스가 죽지 않도록
  child.unref();

  // 포트가 살아날 때까지 최대 30초 폴링
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isDebugPortUp()) return;
  }
  throw new Error("Whale(9222) 자동 실행 실패");
}

// 제목을 max자(띄어쓰기 포함) 이내로 축약.
// 날짜 꼬리표는 제거하고, 자연스러운 절(節) 경계(쉼표·말줄임표 등)에서 끊어
// '완성된 구문'이 되도록 한다. 절 경계가 없을 때만 최후 수단으로 '…'을 붙인다.
function shortenTitle(title, max = 40) {
  // 끝의 날짜 꼬리표 [2026년 6월 8일] 같은 건 항상 제거 (티스토리엔 날짜 미표시)
  const t = title.replace(/\.\.\./g, "…").replace(/\s*\[[^\]]*\]\s*$/, "").trim();
  if (t.length <= max) return t;

  // 절 구분자(… , — · : ; ·) 뒤에서 절 단위로 분리하고, 40자 안에 들어가는
  // 완성된 절들을 최대한 채운다. (공백은 보존)
  const parts = t.split(/(?<=[…,—·:;])/);
  let result = "";
  for (const part of parts) {
    if (part.trim() && (result + part).trim().length <= max) {
      result += part;
    } else {
      break;
    }
  }
  // 끝에 남은 구분자/공백 제거 → 완성된 구문
  result = result.replace(/[\s,·—:;…]+$/, "").trim();
  if (result) return result;

  // 절 경계가 전혀 없거나 첫 절이 너무 길면: 단어 경계로 자르고 '…'(최후 수단)
  let cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace >= max - 10) cut = cut.slice(0, lastSpace);
  return cut.trim() + "…";
}

// 제목/본문을 티스토리에 공개 발행
async function postToTistory(title, content) {
  // PC가 켜져 있으면 Whale(9222)을 알아서 띄운다 (없을 때만).
  await ensureWhaleRunning();

  const browser = await puppeteer.connect({
    browserURL: "http://localhost:9222",
    defaultViewport: null,
  });
  const page = await browser.newPage();

  // '이어쓰기' 네이티브 confirm 팝업이 뜨면 자동 취소(= 새 글로 시작)
  page.on("dialog", async (d) => {
    try { await d.dismiss(); } catch {}
  });

  try {
    await page.goto(`https://${TISTORY_BLOG}/manage/newpost/`, {
      waitUntil: "domcontentloaded",
    });

    // 세션이 만료되면 로그인 페이지로 튕긴다. 2FA는 자동화 불가하므로 건너뜀.
    if (/auth\/login|kakao/.test(page.url())) {
      throw new Error("티스토리 로그인 세션 만료 - Whale에서 수동 로그인 필요");
    }

    // 에디터(TinyMCE) 준비 대기
    await page.waitForSelector("#post-title-inp");
    await page.waitForFunction(() => window.tinymce && window.tinymce.activeEditor);

    // 워드프레스 전용 블록 주석(<!-- wp:... -->) 제거 → 순수 HTML
    const cleanContent = content.replace(/<!--[\s\S]*?-->/g, "");

    // 제목 입력 (티스토리에서 잘리지 않게 40자 이내로 축약)
    await page.click("#post-title-inp");
    await page.type("#post-title-inp", shortenTitle(title, 40));

    // 본문 입력 (TinyMCE API)
    // setContent만 하면 화면엔 보이지만 숨은 textarea에 동기화가 안 돼
    // 발행 시 본문이 빈 것으로 처리된다. change 이벤트 + save()로 동기화한다.
    await page.evaluate((html) => {
      const ed = window.tinymce.activeEditor;
      ed.setContent(html);
      ed.fire("change"); // 변경 알림 → 티스토리가 '본문 있음'으로 인식
      ed.save();         // 내용을 원본 textarea(#editor-tistory)로 동기화
    }, cleanContent);
    await new Promise((r) => setTimeout(r, 1000)); // 동기화 안정화

    // 본문에서 해시태그 추출 → 티스토리 태그칸(#tagText)에 입력
    // (중복 제거 후 최대 10개, 각 태그 입력 후 Enter)
    // (?<!&) → &#8230; 같은 HTML 숫자 엔티티를 태그로 오인하지 않게 제외
    // 추가로 순수 숫자 태그도 거른다.
    const tags = [
      ...new Set(
        (cleanContent.match(/(?<!&)#[가-힣A-Za-z0-9_]+/g) || [])
          .map((t) => t.slice(1))
          .filter((t) => !/^\d+$/.test(t))
      ),
    ].slice(0, 10);
    if (tags.length > 0) {
      // 태그는 부가 요소 → 실패해도 발행은 계속되도록 try/catch.
      // click 대신 focus를 써서 레이아웃 가림에 영향받지 않게 한다.
      try {
        await page.focus("#tagText");
        for (const tag of tags) {
          await page.type("#tagText", tag);
          await page.keyboard.press("Enter"); // 각 태그를 칩으로 등록
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch (e) {
        console.log("태그 입력 건너뜀:", e.message);
      }
    }

    // 태그 추천 드롭다운 등이 떠 있으면 닫기 (발행 버튼 가림 방지)
    await page.keyboard.press("Escape").catch(() => {});

    // 발행: 완료 → 공개 선택 → 발행
    // page.click 대신 JS 클릭을 써서 오버레이에 가려져도 동작하게 한다.
    await page.evaluate(() => document.querySelector("#publish-layer-btn").click());
    await page.waitForSelector("#open20", { visible: true });
    await page.evaluate(() => document.querySelector("#open20").click());
    await page.evaluate(() => document.querySelector("#publish-btn").click());
    await page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {});

    console.log("티스토리 발행 완료!");
  } finally {
    // connect한 브라우저는 close하면 사용자 창이 꺼진다. disconnect만.
    browser.disconnect();
  }
}

module.exports = { postToTistory };
