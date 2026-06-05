const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "챗봇 서버가 실행 중입니다." });
});

app.post("/webhook", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "message 필드가 필요합니다." });
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: "당신은 친절한 재테크 전문 상담 챗봇입니다. 질문에 맞게 도움이 되는 답변을 해주세요.",
    messages: [
      { role: "user", content: message
 },      
    ],
  });

  const reply = response.content[0].text;  // ← blogGenerator.js 39번 줄을 참고하세요

  res.json({ reply });
});


app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
