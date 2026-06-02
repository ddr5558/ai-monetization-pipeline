const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "당신은 친절한 재테크 전문 상담 챗봇입니다. 질문에 맞게 도움이 되는 답변을 해주세요."
 },  // ← 챗봇 역할을 직접 써보세요
      { role: "user", content: message
       }              // ← 사용자 메시지를 넣어보세요
    ],
  });

  const reply = response.choices[0].message.content;  // ← blogGenerator.js 39번 줄을 참고하세요

  res.json({ reply });
});


app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
