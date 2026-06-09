const Anthropic = require("@anthropic-ai/sdk");

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

const xmlrpc = require("xmlrpc");
const WP_USERNAME = process.env.WP_USERNAME;
const WP_PASSWORD = process.env.WP_PASSWORD;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const axios = require("axios");
const NEWS_API_KEY = process.env.NEWS_API_KEY;

const today = new Date().toLocaleDateString("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});


async function getTrendingTopics() {
  const response = await axios.get("https://newsapi.org/v2/top-headlines", {
    params: {
      country: "us",
      category: "business", // 경제·재테크 중심 뉴스
      pageSize: 20,
      apiKey: NEWS_API_KEY,
    },
  });

  // 정치 기사 제외
  const candidates = response.data.articles.filter(
    (article) =>
      article.title &&
      !/정치|대통령|국회|선거|여당|야당|trump|election|politic/i.test(article.title)
  );
  if (candidates.length === 0) {
    throw new Error("적합한 경제 뉴스를 찾지 못했습니다.");
  }

  // 매번 다른 주제가 나오도록 무작위 선택 → 이전 글과 동일 주제 반복 방지
  const article = candidates[Math.floor(Math.random() * candidates.length)];
  const keyword = article.title.replace(/ - [^-]+$/, "");

  return [
    {
      title: `오늘의 경제·재테크 이슈 : ${keyword} [${today}]`,
      keyword,
    },
  ];
}


async function generateBlogPost(topic) {
  const prompt = `
당신은 15년 경력의 경제·재테크 전문 기자이자 시장 애널리스트입니다.
아래 뉴스를 단순 요약하는 것이 아니라, 독자가 다른 곳에서 얻기 어려운 "고유한 분석과 실용적 인사이트"를 담은 깊이 있는 기사를 작성하세요.

주제: ${topic.title}
핵심 키워드: ${topic.keyword}

[가장 중요한 원칙 — 반드시 지킬 것]
- 뉴스 재탕 금지. "이 사건이 왜 중요하고, 투자자와 일반 독자에게 어떤 의미인지"를 깊이 있게 분석할 것
- 구체적 수치, 배경, 인과관계를 제시해 전문성과 신뢰감을 줄 것 (추측은 추측으로 명확히 구분)
- 독자가 바로 활용할 수 있는 실용 정보(판단 기준, 체크포인트)를 반드시 포함할 것
- 차별화된 관점 — 같은 뉴스를 다룬 다른 글과 똑같이 읽히면 실패

[글 구성 — 순서대로]
1) 첫 줄에 한국어 제목만 단독으로 작성 (말머리·기호 없이). 핵심 키워드 포함, 클릭을 부르되 과장·낚시는 금지.
2) 도입부: 2~3문장으로 핵심을 압축하고 "왜 지금 중요한지" 후킹
3) 본문: "1. 소제목" 형식의 번호 소제목을 4개 이상 사용. 각 소제목 아래 6문장 이상의 충실한 분석 문단.
   흐름: 사실/배경 → 원인·맥락 → 시장·산업에 미치는 영향 → 투자·재테크 관점의 의미
4) 실용 섹션: 독자가 적용할 체크포인트나 유의점을 하나의 번호 소제목으로 정리
5) 마무리: 기자 본인의 전망과 견해를 담은 결론 ("나는 이렇게 본다"는 식의 고유한 관점)
6) 그다음 줄에 투자 유의 문구 한 줄: "본 글은 정보 제공 목적이며 특정 종목·상품에 대한 투자 권유가 아닙니다. 투자 판단과 책임은 본인에게 있습니다."
7) 본문 관련 경제·재테크 해시태그 10개 (예: #재테크 #투자 #경제 ...)
8) 맨 마지막 줄에 "META: " 뒤 검색 최적화된 메타 설명(150자 이내)

[문체·형식 규칙]
- 자연스러운 한국어. "~할 수 있습니다", "~하는 것이 중요합니다" 같은 AI 특유 표현과 상투구 금지
- 이모티콘 금지
- 소제목은 반드시 새 줄에 "1. 제목" 형태로 단독 작성, 소제목 앞뒤로 빈 줄 하나씩
- 소제목 아래는 번호 없는 문단, 문단 사이 한 줄 공백으로 가독성 확보
- 전체 길이 1500자 ~ 2200자
- 뉴스 제목이 영어면 한국어로 자연스럽게 번역해 제목에 반영
  `.trim();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text;
}

async function searchImage(keyword, page = 1) {
  // 이미지는 부가 요소 → 실패해도 글 발행은 계속되도록 null 반환
  // 시크릿 이름이 PEXELS/PIXELS 어느 쪽이든 인식 (오타 호환)
  const pexelsKey = process.env.PEXELS_API_KEY || process.env.PIXELS_API_KEY;
  try {
    if (!pexelsKey) {
      console.log("Pexels 키 없음 - 이미지 건너뜀");
      return null;
    }
    const response = await axios.get("https://api.pexels.com/v1/search", {
      headers: {
        Authorization: pexelsKey,
      },
      params: {
        query: keyword,
        per_page: 10,
      },
    });
    const photos = response.data.photos;
    const index = (page - 1) % (photos?.length || 1);
    return photos?.[index]?.src?.large || null;
  } catch (e) {
    console.log("이미지 검색 실패(건너뜀):", e.message);
    return null;
  }
}

async function insertImages(content, englishKeyword) {
  content = content.replace(/^#+\s*/gm, '');
  content = content.replace(/([^\n])((\d+)\. )/g, '$1\n\n$2');
  const lines = content.split('\n');
  const result = [];
  let imageIndex = 1;  // ← 추가

  for (const line of lines) {
  if (line.match(/^\d+\. /)) {
    result.push('<!-- wp:paragraph --><p>&nbsp;</p><!-- /wp:paragraph -->');
    result.push('<!-- wp:paragraph --><p>&nbsp;</p><!-- /wp:paragraph -->');
  }
 if (line.match(/^\d+\. /)) {
    result.push(`<!-- wp:paragraph --><p><strong>${line}</strong></p><!-- /wp:paragraph -->`);
} else {
  result.push(line);
}
  if (line.match(/^\d+\. /)) {
      const keyword = line.replace(/^\d+\. /, '').trim();
      const shortKeyword = englishKeyword.split(' ').slice(0, 3).join(' ');
      const imageUrl = await searchImage(shortKeyword, imageIndex);
      imageIndex++;
      if (imageUrl) {
    result.push(`\n<!-- wp:image -->\n<figure class="wp-block-image"><img src="${imageUrl}" alt="${keyword}"/></figure>\n<!-- /wp:image -->\n<!-- wp:paragraph --><p>&nbsp;</p><!-- /wp:paragraph -->\n`);
      }
    }
  }
  const finalContent = result.join('\n');
  const withSpacing = finalContent.replace(
  /(#[가-힣\w]+(\s+#[가-힣\w]+)+)/,
  '<!-- wp:paragraph --><p>&nbsp;</p><!-- /wp:paragraph -->\n<!-- wp:paragraph --><p>&nbsp;</p><!-- /wp:paragraph -->\n$1'
);
return withSpacing;
}

async function main() {
  const topics = await getTrendingTopics();
  for (const topic of topics) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`[주제] ${topic.title}`);
    console.log("=".repeat(50));

    const post = await generateBlogPost(topic);
    const metaMatch = post.match(/META:\s*(.+)/);
    const metaDescription = metaMatch ? metaMatch[1].trim() : '';
    const cleanPost = post.replace(/META:\s*.+/, '').trim();
    const cleanTitle = cleanPost.split('\n')[0].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim(); // 141
    const postLines = cleanPost.split('\n');
    postLines[0] = `<!-- wp:heading {"level":3} --><h3>${cleanTitle}</h3><!-- /wp:heading -->`;
    const processedPost = postLines.join('\n');
    const postWithImages = await insertImages(processedPost, topic.keyword);
    console.log(postWithImages);

    const koreanTitle = cleanTitle + ` [${today}]`;

    // 워드프레스에 발행 (티스토리는 로컬 tistoryMirror.js가 미러링)
    await postToWordPress(koreanTitle, postWithImages, metaDescription);
    console.log("워드프레스 업로드 완료!");
  }
}

async function postToWordPress(title, content, metaDescription) {
  return new Promise((resolve, reject) => {
    const client = xmlrpc.createSecureClient({
      host: "cheetahfather.wordpress.com",
      path: "/xmlrpc.php",
      port: 443,
    });

    const post = {
      post_title: title,
      post_content: content,
      post_status: "publish",
      post_excerpt: metaDescription,           
    };

    client.methodCall(
      "wp.newPost",
      [0, WP_USERNAME, WP_PASSWORD, post],
      (error, value) => {
        if (error) reject(error);
        else resolve(value);
      }
    );
  });
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1; // 실패 시 워크플로가 빨간 X로 표시되도록 (조용한 실패 방지)
});
