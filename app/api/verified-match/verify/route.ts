import { NextRequest, NextResponse } from "next/server";
import { processAttemptRecord } from "@/lib/server/verifiedMatch";

import {
  persistentMatchesRequested,
  getPublicMatchService,
  actorFromRequest,
  sameOrigin,
  readBoundedJson,
  publicMatchError,
  requireLegacyStatelessTraining,
} from "@/lib/server/publicMatchHttp";
export const runtime = "nodejs";

import { MAX_ATTEMPT_RECORD_BYTES } from "@/lib/publicMatch";

export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const raw = await readBoundedJson(request, MAX_ATTEMPT_RECORD_BYTES);
    if (persistentMatchesRequested()) {
      const result = await getPublicMatchService().submit(
        actorFromRequest(request),
        raw,
      );
      return NextResponse.json(result.body, {
        status: result.status,
        headers: { "Cache-Control": "no-store" },
      });
    }
    requireLegacyStatelessTraining();
    const { status, body } = processAttemptRecord(raw);
    return NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return publicMatchError(e);
  }
}
