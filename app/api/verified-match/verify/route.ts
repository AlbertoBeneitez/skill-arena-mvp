import { NextResponse } from "next/server";
import { processAttemptRecord } from "@/lib/server/verifiedMatch";

export const runtime = "nodejs";

const MAX_VERIFY_BODY_BYTES = 256_000;

function reject(error: string, status = 400) {
  return NextResponse.json(
    { ok: false, verified: false, error },
    { status }
  );
}

export async function POST(request: Request) {
  const declaredLength = Number(
    request.headers.get("content-length") ?? 0
  );
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_VERIFY_BODY_BYTES
  ) {
    return reject("PAYLOAD_TOO_LARGE", 413);
  }

  let raw: unknown;
  try {
    const body = await request.text();
    if (
      new TextEncoder().encode(body).byteLength >
      MAX_VERIFY_BODY_BYTES
    ) {
      return reject("PAYLOAD_TOO_LARGE", 413);
    }
    raw = JSON.parse(body);
  } catch {
    return reject("INVALID_JSON");
  }

  const { status, body } = processAttemptRecord(raw);
  return NextResponse.json(body, { status });
}
