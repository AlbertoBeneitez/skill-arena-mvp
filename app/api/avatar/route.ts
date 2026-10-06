import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type AvatarBody = {
  description?: unknown;
  playerName?: unknown;
};

function buildPrompt(playerName: string, description: string) {
  return [
    "Create one square original avatar portrait for Skill Arena.",
    "Polished competitive fantasy-sport mobile game aesthetic.",
    "Head-and-shoulders portrait centered for a circular crop.",
    "Readable at small size, clean background, no text, no logo, no watermark.",
    "Entirely original fictional character; do not copy celebrities, brands, franchises, or protected characters.",
    playerName ? `Avatar name: ${playerName}.` : "",
    `Player description: ${description}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function generateWithVercelGateway(prompt: string) {
  const token =
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_AI_GATEWAY_KEY ||
    process.env.VERCEL_OIDC_TOKEN;

  if (!token) {
    throw new Error("Vercel AI Gateway no está autenticado en este deployment.");
  }

  const response = await fetch(
    "https://ai-gateway.vercel.sh/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt,
        n: 1,
        size: "1024x1024",
      }),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Vercel AI Gateway respondió con ${response.status}.`;
    throw new Error(message);
  }

  const item = data?.data?.[0];
  const imageBase64 = item?.b64_json;
  const imageUrl = item?.url;

  if (typeof imageBase64 === "string" && imageBase64) {
    return `data:image/png;base64,${imageBase64}`;
  }

  if (typeof imageUrl === "string" && imageUrl) {
    return imageUrl;
  }

  throw new Error("Vercel AI Gateway no devolvió una imagen válida.");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AvatarBody;

    const description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, 180)
        : "";

    const playerName =
      typeof body.playerName === "string"
        ? body.playerName.trim().slice(0, 18)
        : "";

    if (!description) {
      return NextResponse.json(
        { error: "Describe tu avatar." },
        { status: 400 }
      );
    }

    const image = await generateWithVercelGateway(
      buildPrompt(playerName, description)
    );

    return NextResponse.json({
      image,
      provider: "vercel-ai-gateway",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Error al generar el avatar.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
