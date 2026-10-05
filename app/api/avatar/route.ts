import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type AvatarBody = {
  description?: unknown;
  playerName?: unknown;
};

function buildPrompt(playerName: string, description: string) {
  const basePrompt =
    process.env.AVATAR_BASE_PROMPT?.trim() ||
    [
      "Create one square original avatar portrait for Skill Arena.",
      "Competitive fantasy-sport aesthetic, polished mobile-game quality, colorful and readable at small size.",
      "Head-and-shoulders composition centered for a circular crop.",
      "Clean background, no text, no logo, no watermark.",
      "The character must be entirely original and fictional.",
      "Do not copy or imitate protected characters, celebrities, brands, franchises, or copyrighted artwork.",
    ].join(" ");

  return [
    basePrompt,
    playerName ? `Avatar name: ${playerName}.` : "",
    `Player description: ${description}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function generateWithCloudflare(prompt: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) return null;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        steps: 4,
      }),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    const message =
      data?.errors?.[0]?.message ||
      data?.result?.error ||
      "Cloudflare no pudo generar el avatar.";
    throw new Error(message);
  }

  const imageBase64 = data?.result?.image;
  if (typeof imageBase64 !== "string" || !imageBase64) {
    throw new Error("Cloudflare no devolvió una imagen válida.");
  }

  return {
    image: `data:image/jpeg;base64,${imageBase64}`,
    provider: "cloudflare",
  };
}

async function generateWithVercelGateway(prompt: string) {
  // Vercel automatically exposes VERCEL_OIDC_TOKEN in deployments.
  // Locally, AI_GATEWAY_API_KEY can be used instead.
  const token =
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;

  if (!token) return null;

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

  const imageBase64 = data?.data?.[0]?.b64_json;
  if (typeof imageBase64 !== "string" || !imageBase64) {
    throw new Error("Vercel AI Gateway no devolvió una imagen válida.");
  }

  return {
    image: `data:image/png;base64,${imageBase64}`,
    provider: "vercel-ai-gateway",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AvatarBody;

    const description =
      typeof body?.description === "string"
        ? body.description.trim().slice(0, 180)
        : "";

    const playerName =
      typeof body?.playerName === "string"
        ? body.playerName.trim().slice(0, 18)
        : "";

    if (!description) {
      return NextResponse.json(
        { error: "Describe tu avatar." },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(playerName, description);

    // Prefer the originally configured Cloudflare provider when credentials exist.
    const cloudflareResult = await generateWithCloudflare(prompt);
    if (cloudflareResult) {
      return NextResponse.json(cloudflareResult);
    }

    // On Vercel, use the project's OIDC identity through AI Gateway.
    const vercelResult = await generateWithVercelGateway(prompt);
    if (vercelResult) {
      return NextResponse.json(vercelResult);
    }

    return NextResponse.json(
      {
        error:
          "La generación IA no está configurada en este entorno. No se sustituirá por un avatar aleatorio.",
      },
      { status: 503 }
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Error al generar el avatar.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
