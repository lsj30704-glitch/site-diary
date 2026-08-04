// 카톡 캡쳐 이미지 → 텍스트 판독 (Google Cloud Vision)
// API 키는 브라우저에 노출되면 안 되므로 서버(Vercel 함수)에서만 사용한다.
// Vercel > Settings > Environment Variables 에 GOOGLE_VISION_API_KEY 등록 필요.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) {
    res.status(500).json({ error: "서버에 GOOGLE_VISION_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요." });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const image = (body.image || "").replace(/^data:image\/\w+;base64,/, "");
    if (!image) {
      res.status(400).json({ error: "이미지 데이터가 비어 있습니다." });
      return;
    }
    const gr = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: image },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["ko"] },
        }],
      }),
    });
    const data = await gr.json();
    if (!gr.ok) {
      res.status(gr.status).json({ error: (data && data.error && data.error.message) || "Vision API 호출 실패" });
      return;
    }
    const r = (data.responses && data.responses[0]) || {};
    if (r.error) {
      res.status(500).json({ error: r.error.message || "Vision API 오류" });
      return;
    }
    const text = (r.fullTextAnnotation && r.fullTextAnnotation.text) || "";
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
