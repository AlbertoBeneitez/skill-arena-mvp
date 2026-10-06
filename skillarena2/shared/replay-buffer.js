export class ReplayBuffer {
  constructor({ seed, version = 1 } = {}) {
    this.seed = seed;
    this.version = version;
    this.startedAt = null;
    this.inputs = [];
  }

  push({ kind, x = 0, y = 0, now = performance.now() }) {
    if (this.startedAt === null) this.startedAt = now;
    this.inputs.push({
      kind,
      t: Math.round((now - this.startedAt) * 1000) / 1000,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000
    });
  }

  export(extra = {}) {
    return {
      version: this.version,
      seed: this.seed,
      inputs: this.inputs.map((item) => ({ ...item })),
      ...extra
    };
  }
}
