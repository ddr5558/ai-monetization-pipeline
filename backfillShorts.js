// 지금까지 미러링된 모든 글에 대해 쇼츠 대본 일괄 생성 (이미 있는 건 건너뜀)
const a = require("axios");
const fs = require("fs");
const { generateShorts, SHORTS_DIR } = require("./shorts");

const WP = "https://public-api.wordpress.com/wp/v2/sites/cheetahfather.wordpress.com/posts";
function decode(s) {
  return s.replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/&[a-z]+;/g, "'");
}

async function main() {
  const mirrored = JSON.parse(fs.readFileSync("./mirrored.json", "utf8"));
  const existing = fs.existsSync(SHORTS_DIR) ? fs.readdirSync(SHORTS_DIR) : [];
  const haveId = new Set(existing.map((f) => (f.match(/^(\d+)_/) || [])[1]).filter(Boolean));

  let done = 0, skip = 0, fail = 0;
  for (const id of mirrored) {
    if (haveId.has(String(id))) { skip++; continue; }
    try {
      const r = await a.get(`${WP}/${id}`, { params: { _: Date.now() }, validateStatus: () => true });
      if (r.status !== 200) { console.log(`id=${id} 글 없음(${r.status}) - 건너뜀`); fail++; continue; }
      const p = r.data;
      console.log(`[생성] id=${id} ${decode(p.title.rendered).slice(0, 35)}`);
      await generateShorts({ id: String(id), title: decode(p.title.rendered), contentHtml: p.content.rendered, url: p.link });
      done++;
    } catch (e) { console.log(`id=${id} 오류:`, e.message); fail++; }
  }
  console.log(`\n=== 완료 === 생성:${done} / 이미있음:${skip} / 없음·실패:${fail}`);
}
main().catch((e) => console.log("오류:", e.message));
