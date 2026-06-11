// 클라우드(GitHub Actions) 워드프레스 글 생성 워크플로를 트리거한다.
// GitHub 예약(cron)이 불안정해서, 로컬에서 직접 트리거해 안정성 확보.
const { execSync } = require("child_process");
const https = require("https");

function getToken() {
  try {
    const url = execSync("git remote get-url origin", { cwd: __dirname }).toString().trim();
    const m = url.match(/:\/\/[^:]+:([^@]+)@/);
    return m ? m[1] : null;
  } catch { return null; }
}

function dispatch(token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ ref: "main" });
    const req = https.request({
      hostname: "api.github.com",
      path: "/repos/ddr5558/ai-monetization-pipeline/actions/workflows/blog-generator.yml/dispatches",
      method: "POST",
      headers: {
        Authorization: "token " + token,
        Accept: "application/vnd.github+json",
        "User-Agent": "local-trigger",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const token = getToken();
  if (!token) { console.log("토큰 없음 - 생성 트리거 생략"); return; }
  const code = await dispatch(token);
  console.log("워드프레스 생성 트리거:", code === 204 ? "✅ 성공" : "응답코드 " + code);
})().catch((e) => console.log("트리거 오류:", e.message));
