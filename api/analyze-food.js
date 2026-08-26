/**
 * ใช้ Gemini API (Google AI Studio) แทน Anthropic — มี free tier จริง
 * ขอ API key ฟรีได้ที่ https://aistudio.google.com/apikey (ไม่ต้องผูกบัตรเครดิต)
 *
 * โมเดลที่ใช้: gemini-2.5-flash (อยู่ใน free tier ปัจจุบัน)
 * หมายเหตุ: Google มีการปรับ/เลิกใช้โมเดลเป็นระยะ ถ้าเจอ error ว่าโมเดลนี้ใช้ไม่ได้แล้ว
 * ให้เช็กชื่อโมเดล free-tier ล่าสุดที่ https://ai.google.dev/gemini-api/docs/pricing
 * แล้วเปลี่ยนค่า MODEL ด้านล่างได้เลย
 */

const MODEL = "gemini-1.5-flash";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    const { image, mediaType } = req.body || {};
    if (!image) {
      res.status(400).json({ error: "missing image" });
      return;
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mediaType || "image/jpeg", data: image } },
                {
                  text:
                    'วิเคราะห์รูปอาหารนี้ ประมาณชื่ออาหาร แคลอรี่ โปรตีน คาร์บ ไขมัน (กรัม) ตอบเป็น JSON เท่านั้น รูปแบบ: {"food_name":"...","estimated_calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}',
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    const data = await r.json();
    if (data.error) {
      res.status(500).json({ error: data.error.message || "gemini api error" });
      return;
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "analysis failed" });
  }
};
