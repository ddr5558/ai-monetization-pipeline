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
    pageSize: 10,
    apiKey: NEWS_API_KEY,
  },
});


const articles = response.data.articles
  // 수정
.filter((article) => !article.title.match(/정치|대통령|국회|선거|여당|야당/))
    .slice(0, 1);

  return articles.map((article) => ({
    title: `오늘의 메인 이슈 : ${article.title.replace(/ - [^-]+$/, "")} [${today}]`,  // 뉴스 제목에 날짜 추가
    keyword: article.title.replace(/ - [^-]+$/, ""),           // 뉴스 제목에서 날짜 제거 후 키워드로 활용
  }));
}


async function generateBlogPost(topic) {
  const prompt = `
당신은 10년 경력의 뉴스 블로그 기자입니다. 아래 주제로 기사를 작성해주세요.

주제: ${topic.title}
핵심 키워드: ${topic.keyword}

작성 조건:
- AI가 쓴 티가 나지 않는 자연스러운 한국어 문체
- 실제 기자가 쓴 것처럼 사실 중심, 간결하고 명확하게
- "~할 수 있습니다", "~하는 것이 중요합니다" 같은 AI 특유의 표현 금지
- 이모티콘 사용 금지
- 제목(H1)은 핵심 키워드를 포함하고, 클릭을 유도하는 제목으로 작성
- 소제목(H2)으로 섹션을 명확히 구분, 최소 4개 이상, 각 섹션은 10문장 이상의 충분한 문단으로 작성
- 소제목은 "1. 제목", "2. 제목" 형식으로 번호를 앞에 붙여서 작성
- 총 길이: 1000자 ~ 1500자
- 마무리는 나는 이런식으로 생각한다는 결론 으로
- 뉴스 제목도 한국어로 번역해서 제목을 작성해줘
- 글 마지막에 3줄 공백 후 본문 내용과 관련된 해시태그 10개를 자동 생성할 것 (예: #재테크 #투자 #경제 ...)
- 소제목은 반드시 새 줄에 단독으로 작성 (예: "1. 소제목 제목")
- 소제목 앞뒤로 빈 줄 하나씩 추가
- 소제목 아래는 번호 없이 자연스러운 2~3문장 문단으로 작성
- 신문 기사처럼 사실을 서술하되, 인과관계와 흐름이 느껴지도록 작성
- 문단과 문단 사이 한 줄 공백으로 가독성 확보

  `.trim();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text;
}

async function searchImage(keyword, page = 1) {
  const response = await axios.get("https://api.pexels.com/v1/search", {
    headers: {
      Authorization: process.env.PEXELS_API_KEY,
    },
    params: {
      query: keyword,
      per_page: 10,        // 1 → 10으로 변경
    },
  });
  const photos = response.data.photos;
  const index = (page - 1) % (photos?.length || 1);  // 인덱스로 선택
  return photos?.[index]?.src?.large || null;
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
    const cleanTitle = post.split('\n')[0].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
    const postLines = post.split('\n');
    postLines[0] = `<!-- wp:heading {"level":3} --><h3>${cleanTitle}</h3><!-- /wp:heading -->`;
    const processedPost = postLines.join('\n');
    const postWithImages = await insertImages(processedPost, topic.keyword);
    console.log(postWithImages);

    const koreanTitle = cleanTitle + ` [${today}]`;
    await postToWordPress(koreanTitle, postWithImages);
    console.log("워드프레스 업로드 완료!");
  }
}
async function postToWordPress(title, content) {
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
main().catch(console.error);
