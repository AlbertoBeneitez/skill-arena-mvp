import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: "Falta configurar Cloudflare Workers AI." },
        { status: 503 }
      );
    }

    const body = await request.json();

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

    const basePrompt =
      process.env.AVATAR_BASE_PROMPT?.trim() ||
      [
        "Crea un avatar cuadrado original para Skill Arena.",
        "Debe ser un retrato de fantasía para una arena competitiva, atractivo, colorido y pulido.",
        "Debe funcionar bien en recorte circular y a tamaño pequeño.",
        "Fondo limpio, sin texto ni logotipos.",
        "El personaje debe ser completamente original y ficticio.",
        "No copies ni imites personajes protegidos, celebridades, marcas, franquicias ni obras con derechos de autor.",
        "Evita cualquier contenido ilegal o que infrinja derechos de terceros."
      ].join(" ");

    const prompt = [
      basePrompt,
      playerName ? `Nombre del avatar: ${playerName}.` : "",
      `Descripción del jugador: ${description}`,
    ]
      .filter(Boolean)
      .join(" ");

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
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      const message =
        data?.errors?.[0]?.message ||
        data?.result?.error ||
        "Cloudflare no pudo generar el avatar.";

      return NextResponse.json(
        { error: message },
        { status: response.status || 502 }
      );
    }

    const imageBase64 = data?.result?.image;

    if (typeof imageBase64 !== "string" || !imageBase64) {
      return NextResponse.json(
        { error: "Cloudflare no devolvió una imagen válida." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      image: `data:image/jpeg;base64,${imageBase64}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Error al generar el avatar." },
      { status: 500 }
    );
  }
}
