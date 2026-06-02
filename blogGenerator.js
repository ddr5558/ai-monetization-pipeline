const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const topics = [
  {
    title: "치타아빠의 재테크 노하우 전수",
    keyword: "직장인 재테크 시작하는 법",
  },
  {
    title: "월 100만원 부수입을 올린 재테크 성공 사례",
    keyword: "40대 재테크 성공 후기",
  },
];

async function generateBlogPost(topic) {
  const prompt = `
당신은 SEO 전문가입니다. 아래 주제로 블로그 글을 작성해주세요.

주제: ${topic.title}
핵심 키워드: ${topic.keyword}

작성 조건:
- 제목(H1): 핵심 키워드 포함, 클릭을 유도하는 제목
- 도입부: 독자의 공감을 이끄는 2~3문장
- 본문: 소제목(H2) 3개 이상, 각 섹션 2~3문장
- 마무리: 행동을 유도하는 CTA(Call To Action) 문장
- 총 길이: 400~600자

마크다운 형식으로 작성해주세요.
  `.trim();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content;
}

function generateImagePrompt(topic) {
  const style =
    "luxury gold premium, wealth and success atmosphere, cinematic lighting, professional photography, high-end magazine style, elegant dark background, 8k ultra detailed";
  return `${topic.keyword} concept: ${style} --ar 16:9 --v 6`;
}

async function main() {
  for (const topic of topics) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`[주제] ${topic.title}`);
    console.log("=".repeat(50));

    const post = await generateBlogPost(topic);
    console.log(post);

    const imagePrompt = generateImagePrompt(topic);
    console.log(`\n🎨 [미드저니 이미지 프롬프트]\n${imagePrompt}`);
  }
}

main().catch(console.error);
