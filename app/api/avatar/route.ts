import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GeminiImageBlock = {
  type?: string;
  data?: string;
  mime_type?: string;
};

function extractImage(payload: any): GeminiImageBlock | null {
  if (payload?.output_image?.data) return payload.output_image;

  const stepBlocks = Array.isArray(payload?.steps)
    ? payload.steps.flatMap((step: any) => Array.isArray(step?.content) ? step.content : [])
    : [];
  const stepImage = stepBlocks.find((block: GeminiImageBlock) => block?.type === "image" && block?.data);
  if (stepImage) return stepImage;

  const legacyImage = Array.isArray(payload?.outputs)
    ? payload.outputs.find((block: GeminiImageBlock) => block?.type === "image" && block?.data)
    : null;
  return legacyImage ?? null;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar GEMINI_API_KEY." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 180) : "";
    const playerName = typeof body?.playerName === "string" ? body.playerName.trim().slice(0, 18) : "";

    if (!description) {
      return NextResponse.json({ error: "Describe tu avatar." }, { status: 400 });
    }

    const basePrompt =
      process.env.AVATAR_BASE_PROMPT?.trim() ||
      [
        "Create one original square profile avatar for a competitive mobile skill-game app.",
        "The character must be fictional and original: do not copy celebrities, copyrighted characters, logos, brands, or game franchises.",
        "Visual direction: expressive premium fantasy-arena portrait, colorful, polished mobile-game artwork, readable at small circular crop, clean background, no text."
      ].join(" ");

    const prompt = [
      basePrompt,
      playerName ? `Avatar name for mood only: ${playerName}.` : "",
      `User description: ${description}`,
    ].filter(Boolean).join(" ");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image",
        input: [{ type: "text", text: prompt }],
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: "1:1",
          image_size: "1K",
        },
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error?.message || "Gemini no pudo generar el avatar." },
        { status: response.status }
      );
    }

    const image = extractImage(payload);
    if (!image?.data) {
      return NextResponse.json({ error: "Gemini no devolvió una imagen." }, { status: 502 });
    }

    return NextResponse.json({
      image: `data:${image.mime_type || "image/jpeg"};base64,${image.data}`,
    });
  } catch {
    return NextResponse.json({ error: "Error al generar el avatar." }, { status: 500 });
  }
}
