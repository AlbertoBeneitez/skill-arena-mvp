export type ReplayInput = {
  seq: number;
  tick: number;
  action: string;
};

export type InputProtocolDefinition = {
  version: number;
  allowedActions: readonly string[];
  maxInputs: number;
  maxFinalTick: number;
};

export type InputValidationError =
  | "INVALID_INPUT"
  | "INVALID_INPUT_SEQUENCE"
  | "INPUT_AFTER_FINAL"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_FINAL_TICK";

export function validateInputSequence(
  inputs: unknown,
  finalTick: unknown,
  protocol: InputProtocolDefinition
): InputValidationError | null {
  if (
    !Number.isInteger(finalTick) ||
    (finalTick as number) < 0 ||
    (finalTick as number) > protocol.maxFinalTick
  ) {
    return "INVALID_FINAL_TICK";
  }

  if (!Array.isArray(inputs)) return "INVALID_INPUT";
  if (inputs.length > protocol.maxInputs) return "PAYLOAD_TOO_LARGE";

  const allowed = new Set(protocol.allowedActions);
  let previousTick = -1;

  for (let index = 0; index < inputs.length; index += 1) {
    const raw = inputs[index];
    if (!raw || typeof raw !== "object") return "INVALID_INPUT";

    const input = raw as Record<string, unknown>;
    if (
      input.seq !== index ||
      !Number.isInteger(input.tick) ||
      typeof input.action !== "string" ||
      !allowed.has(input.action)
    ) {
      return "INVALID_INPUT";
    }

    const tick = input.tick as number;
    if (tick > (finalTick as number)) return "INPUT_AFTER_FINAL";
    if (tick < 0 || tick <= previousTick) {
      return "INVALID_INPUT_SEQUENCE";
    }

    previousTick = tick;
  }

  return null;
}
