// 티스토리 발행 공유 모듈
// - 로그인된 Whale(원격 디버깅 9222)에 connect해서 글을 발행한다.
// - Whale이 없으면 자동 실행, '복구' 알림 차단, 세션 만료 시 깔끔히 건너뜀.
const puppeteer = require("puppeteer-core");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const WHALE_PATH =
  "C:\\Program Files\\Naver\\Naver Whale\\Application\\4.37.378.12\\whale.exe";
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

    // 제목 입력
    await page.click("#post-title-inp");
    await page.type("#post-title-inp", title);

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
      await page.click("#tagText");
      for (const tag of tags) {
        await page.type("#tagText", tag);
        await page.keyboard.press("Enter");
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    // 발행: 완료 → 공개 선택 → 발행
    await page.click("#publish-layer-btn");
    await page.waitForSelector("#open20", { visible: true });
    await page.click("#open20");
    await page.click("#publish-btn");
    await page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {});

    console.log("티스토리 발행 완료!");
  } finally {
    // connect한 브라우저는 close하면 사용자 창이 꺼진다. disconnect만.
    browser.disconnect();
  }
}

module.exports = { postToTistory };
