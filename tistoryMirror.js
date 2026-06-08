// 워드프레스 → 티스토리 미러링 (로컬 PC에서 작업 스케줄러로 실행)
// 워드프레스 최신 글을 가져와, 아직 티스토리에 안 올린 글만 발행한다.
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { postToTistory } = require("./tistory");

const WP_SITE = "cheetahfather.wordpress.com";
const MIRRORED_FILE = path.resolve("./mirrored.json");
const FETCH_COUNT = 5; // 최근 몇 개를 확인할지
const MAX_PER_RUN = 3; // 한 번 실행에 최대 몇 개까지 올릴지 (도배 방지)

// 제목에 섞인 HTML 엔티티(&amp; &#8230; &nbsp; 등)를 일반 텍스트로 디코딩
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&"); // &amp;는 이중 디코딩 방지 위해 마지막에
}

// 워드프레스 최신 글 가져오기 (공개 REST API — 인증 불필요)
async function getRecentPosts(num) {
  const url = `https://public-api.wordpress.com/wp/v2/sites/${WP_SITE}/posts`;
  const res = await axios.get(url, { params: { per_page: num } });
  // REST 응답을 { post_id, post_title, post_content } 형태로 정규화
  return res.data.map((p) => ({
    post_id: String(p.id),
    post_title: decodeEntities(p.title.rendered),
    post_content: p.content.rendered,
  }));
}

// 이미 미러링한 글 ID 목록 로드/저장
function loadMirrored() {
  try {
    return JSON.parse(fs.readFileSync(MIRRORED_FILE, "utf8"));
  } catch {
    return [];
  }
}
function saveMirrored(ids) {
  fs.writeFileSync(MIRRORED_FILE, JSON.stringify(ids, null, 2));
}

async function main() {
  const posts = await getRecentPosts(FETCH_COUNT);
  const mirrored = loadMirrored();

  // 아직 안 올린 글 중 '최근' 것부터 MAX_PER_RUN개를 고르고,
  // 올릴 때는 오래된 것부터(시간순) 올리도록 reverse.
  // (API는 최신순(desc)으로 주므로 slice가 '최근 N개', reverse로 시간순 발행)
  const toMirror = posts
    .filter((p) => !mirrored.includes(p.post_id))
    .slice(0, MAX_PER_RUN)
    .reverse();

  if (toMirror.length === 0) {
    console.log("미러링할 새 글이 없습니다.");
    return;
  }

  console.log(`미러링 대상 ${toMirror.length}개`);
  for (const p of toMirror) {
    try {
      console.log(`\n[티스토리 발행] ${p.post_title}`);
      await postToTistory(p.post_title, p.post_content);
      mirrored.push(p.post_id);
      saveMirrored(mirrored); // 한 건 성공할 때마다 즉시 기록 (중복 방지)
    } catch (e) {
      console.log("발행 건너뜀:", p.post_title, "-", e.message);
      // 세션 만료/Whale 없음 등은 다음 실행에서 재시도되도록 기록하지 않음
    }
  }
  console.log("\n미러링 작업 종료.");
}

main().catch((e) => {
  console.error("오류:", e);
  process.exit(1);
});
