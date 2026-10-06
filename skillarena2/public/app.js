const games = [
  {
    id: "tower",
    title: "Tower Lab",
    status: "CANDIDATO 01",
    license: "MIT",
    tech: "HTML5 Canvas · touch",
    description: "Base de Tower Building conservada casi intacta en lógica. Menús rebrandeados, seed determinista y captura de inputs añadidos para preparar el trasplante a Skill Arena.",
    play: "./games/tower/index.html"
  }
];

const cards = document.querySelector("#cards");
const stageBody = document.querySelector("#stage-body");
const stageTitle = document.querySelector("#stage-title");
const stageMode = document.querySelector("#stage-mode");
const fullscreenButton = document.querySelector("#fullscreen");
const restartButton = document.querySelector("#restart");
const seedInput = document.querySelector("#seed");
const telemetry = document.querySelector("#telemetry");
let activeGame = null;
let activeFrame = null;

function currentSeed() {
  return (seedInput.value || "demo-001").trim() || "demo-001";
}

function renderCards() {
  cards.innerHTML = games.map((game) => `
    <article class="card">
      <div class="meta">
        <span class="pill">${game.status}</span>
        <span class="pill">${game.license}</span>
        <span class="pill">${game.tech}</span>
      </div>
      <h3>${game.title}</h3>
      <p>${game.description}</p>
      <div class="checks" aria-label="Estado del candidato">
        <span>✓ vertical/táctil</span>
        <span>✓ upstream fijado</span>
        <span>✓ branding externo retirado</span>
        <span>◐ verificación servidor pendiente</span>
      </div>
      <button class="primary" data-open="${game.id}">Probar en móvil</button>
    </article>
  `).join("");
}

function loadActiveGame() {
  if (!activeGame) return;
  const seed = encodeURIComponent(currentSeed());
  const url = `${activeGame.play}?seed=${seed}`;
  stageBody.className = "stage-body";
  stageBody.innerHTML = `<div class="phone-frame"><iframe title="${activeGame.title}" src="${url}" allow="autoplay; fullscreen"></iframe></div>`;
  activeFrame = stageBody.querySelector("iframe");
  telemetry.textContent = `seed=${currentSeed()} · esperando partida`;
  fullscreenButton.disabled = false;
  restartButton.disabled = false;
}

function openGame(id) {
  const game = games.find((item) => item.id === id);
  if (!game) return;
  activeGame = game;
  stageTitle.textContent = game.title;
  stageMode.textContent = game.status;
  loadActiveGame();
  stageBody.scrollIntoView({ behavior: "smooth", block: "start" });
}

cards.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open]");
  if (button) openGame(button.dataset.open);
});

restartButton.addEventListener("click", loadActiveGame);
seedInput.addEventListener("change", () => {
  if (activeGame) loadActiveGame();
});

fullscreenButton.addEventListener("click", async () => {
  const target = stageBody.querySelector(".phone-frame") || activeFrame;
  if (!target) return;
  try {
    await target.requestFullscreen();
  } catch {}
});

window.addEventListener("message", (event) => {
  if (event.data?.type !== "skillarena2:telemetry") return;
  const { seed, score, successCount, inputCount, replayCapture } = event.data;
  telemetry.textContent =
    `seed=${seed ?? "-"} · score=${score ?? 0} · bloques=${successCount ?? 0} · inputs=${inputCount ?? 0} · ${replayCapture ?? "sin replay"}`;
});

renderCards();
