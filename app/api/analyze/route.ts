import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function cleanString(value: unknown, fallback = "Not clear from this image"): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 1200) : fallback;
}

function cleanList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string").slice(0, 8).map(item => item.slice(0, 400));
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server. Add it to Vercel Environment Variables and redeploy." }, { status: 503 });
    }

    const body = await request.json();
    const imageData = body?.imageData;
    const region = cleanString(body?.region, "India").slice(0, 100);
    const district = typeof body?.district === "string" ? body.district.trim().slice(0, 80) : "";

    if (typeof imageData !== "string") return NextResponse.json({ error: "Please upload an image first." }, { status: 400 });
    const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match || !ALLOWED_TYPES.has(match[1])) return NextResponse.json({ error: "Unsupported image. Use JPG, PNG, or WebP." }, { status: 400 });
    const estimatedBytes = Math.floor(match[2].length * 3 / 4);
    if (estimatedBytes > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Image exceeds the 8 MB limit." }, { status: 413 });

    const prompt = `You are a cautious soil-image observation assistant for India. Analyze only what is reasonably visible in the supplied photograph. User-reported location: ${region}${district ? ", " + district + " district" : ""}. Never claim that a photo can measure laboratory soil chemistry or actual water content.

Return ONLY valid JSON with these keys:
{
 "soil_type": "likely visual soil class, or 'Uncertain — more evidence needed'",
 "texture": "visual texture/particle-size impression, not a lab texture test",
 "color": "observed dominant color",
 "moisture_visual": "Dry-looking / Slightly moist-looking / Wet-looking / Indeterminate, with one short reason",
 "drainage_visual": "visible clues only; otherwise 'Cannot infer from photo'",
 "organic_matter_visual": "visible organic matter clues or not discernible",
 "visible_properties": ["3 to 6 concise visual observations"],
 "cannot_determine": ["state that exact moisture percentage, pH, N-P-K, salinity/EC and contaminants cannot be determined from image alone; include any other relevant uncertainty"],
 "confidence": "Low / Moderate / High (visual confidence only; be conservative)",
 "explanation": "2 short sentences explaining visible evidence and uncertainty",
 "regional_context": "brief cautious context for the supplied Indian region; do not infer the sample's origin or assert a local soil group solely from location"
}
Rules:
- Distinguish visual appearance from measured soil science.
- Moisture is apparent surface wetness only; never provide a numeric moisture percentage.
- Do not invent soil properties, test results, crop suitability, fertilizer advice, or exact soil taxonomy.
- If the image is not clearly soil, say so and use low confidence.
- Mention that lighting, camera, recent rain and sample preparation can change appearance.
- Regional context is general context, not proof of sample identity.
- Use short farmer-friendly English.`;

    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("Gemini API error", upstream.status, detail.slice(0, 500));
      if (upstream.status === 400 || upstream.status === 403 || upstream.status === 401) {
        return NextResponse.json({ error: "The image AI provider rejected the request. Check that GEMINI_API_KEY is valid and has Gemini API access enabled." }, { status: 502 });
      }
      if (upstream.status === 429) return NextResponse.json({ error: "The AI provider rate limit was reached. Please wait a little and try again." }, { status: 429 });
      return NextResponse.json({ error: "The image analysis provider is temporarily unavailable. Please try again later." }, { status: 502 });
    }

    const payload = await upstream.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("").trim();
    if (!raw) return NextResponse.json({ error: "The AI provider returned no analysis. Try a clearer soil photo." }, { status: 502 });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start < 0 || end <= start) return NextResponse.json({ error: "The AI response could not be interpreted. Please try again." }, { status: 502 });
      parsed = JSON.parse(raw.slice(start, end + 1));
    }

    const analysis = {
      soil_type: cleanString(parsed.soil_type, "Uncertain — more evidence needed"),
      texture: cleanString(parsed.texture),
      color: cleanString(parsed.color),
      moisture_visual: cleanString(parsed.moisture_visual),
      drainage_visual: cleanString(parsed.drainage_visual),
      organic_matter_visual: cleanString(parsed.organic_matter_visual),
      visible_properties: cleanList(parsed.visible_properties, ["No reliable visual observations returned."]),
      cannot_determine: cleanList(parsed.cannot_determine, [
        "Exact soil moisture percentage requires a calibrated moisture sensor.",
        "pH, N-P-K nutrients, electrical conductivity/salinity and contaminants require appropriate soil tests."
      ]),
      confidence: cleanString(parsed.confidence, "Low"),
      explanation: cleanString(parsed.explanation),
      regional_context: cleanString(parsed.regional_context, "Regional context is not enough to identify a soil sample.")
    };
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Soil image analysis failed", error);
    return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError" ? "Image analysis timed out. Try a smaller image or try again later." : "Unexpected server error while analyzing the image." }, { status: 500 });
  }
}
