/**
 * Contrato objetivo para que un candidato pueda trasladarse a Skill Arena.
 * Los candidatos no se consideran "ready" hasta poder implementar este contrato
 * sin depender del launcher de SkillArena2.
 */
export class SkillArenaGameAdapter {
  constructor() {
    if (new.target === SkillArenaGameAdapter) {
      throw new Error("SkillArenaGameAdapter is abstract");
    }
  }

  async init(_config) {
    throw new Error("init(config) not implemented");
  }

  start(_seed) {
    throw new Error("start(seed) not implemented");
  }

  input(_event) {
    throw new Error("input(event) not implemented");
  }

  getScore() {
    throw new Error("getScore() not implemented");
  }

  exportReplay() {
    throw new Error("exportReplay() not implemented");
  }

  finish() {
    throw new Error("finish() not implemented");
  }

  destroy() {
    throw new Error("destroy() not implemented");
  }
}
