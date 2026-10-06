const games = [
  {
    id: "tower",
    title: "Tower Building",
    mode: "PLAYABLE · COPY",
    license: "MIT",
    tech: "HTML5 Canvas",
    description: "Upstream de iamkun prácticamente intacto. Es el candidato más directo para estudiar integración real en Skill Arena.",
    play: "./games/tower/index.html",
    repo: "https://github.com/iamkun/tower_game"
  },
  {
    id: "hexgl",
    title: "HexGL",
    mode: "PLAYABLE · COPY",
    license: "MIT",
    tech: "WebGL",
    description: "Copia estática del upstream para estudiar control, precisión, tiempo y un juego 3D mucho más pesado que Tower.",
    play: "./games/hexgl/index.html",
    repo: "https://github.com/BKcore/HexGL"
  },
  {
    id: "agar",
    title: "Agar.io clone",
    mode: "SERVER LAB",
    license: "MIT",
    tech: "Node + Socket.IO",
    description: "Se conserva el proyecto como banco de pruebas de servidor autoritativo, movimiento y colisiones. No se propone como juego final.",
    command: "npm run dev:agar",
    repo: "https://github.com/owenashurst/agar.io-clone"
  },
  {
    id: "osu",
    title: "osu! lazer code lab",
    mode: "SOURCE LAB",
    license: "MIT · código",
    tech: "C#",
    description: "Se importa la parte de código relevante para estudiar timing, scoring, inputs y replay. No se reutilizan marca ni recursos de osu!.",
    command: "vendor/osu/",
    repo: "https://github.com/ppy/osu"
  }
];

const cards = document.querySelector("#cards");
const stageBody = document.querySelector("#stage-body");
const stageTitle = document.querySelector("#stage-title");
const stageMode = document.querySelector("#stage-mode");
const closeButton = document.querySelector("#close");
const fullscreenButton = document.querySelector("#fullscreen");
const telemetry = document.querySelector("#telemetry");
let activeFrame = null;

function renderCards() {
  cards.innerHTML = games.map((game) => `
    <article class="card">
      <div class="meta">
        <span class="pill">${game.mode}</span>
        <span class="pill">${game.license}</span>
        <span class="pill">${game.tech}</span>
      </div>
      <h3>${game.title}</h3>
      <p>${game.description}</p>
      <div class="card-actions">
        <button class="primary" data-open="${game.id}">${game.play ? "Probar" : "Abrir ficha"}</button>
        <a class="button secondary" href="${game.repo}" target="_blank" rel="noreferrer">Upstream</a>
      </div>
    </article>
  `).join("");
}

function openGame(id) {
  const game = games.find((item) => item.id === id);
  if (!game) return;

  stageTitle.textContent = game.title;
  stageMode.textContent = game.mode;
  closeButton.disabled = false;

  if (game.play) {
    stageBody.className = "stage-body";
    stageBody.innerHTML = `<iframe title="${game.title}" src="${game.play}" allow="autoplay; fullscreen; gamepad"></iframe>`;
    activeFrame = stageBody.querySelector("iframe");
    fullscreenButton.disabled = false;
  } else {
    activeFrame = null;
    fullscreenButton.disabled = true;
    stageBody.className = "stage-body";
    stageBody.innerHTML = `
      <div class="source-panel">
        <div class="meta">
          <span class="pill">${game.license}</span>
          <span class="pill">${game.tech}</span>
        </div>
        <h3>${game.title}</h3>
        <p>${game.description}</p>
        <p>Este bloque está incorporado al laboratorio como upstream fijado por commit, pero no se fuerza dentro de un iframe porque no comparte la arquitectura web estática de Tower/HexGL.</p>
        <strong>Entrada del laboratorio</strong>
        <code class="command">${game.command}</code>
      </div>`;
  }

  stageBody.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeStage() {
  activeFrame = null;
  stageTitle.textContent = "Banco de pruebas";
  stageMode.textContent = "SELECCIONA UN JUEGO";
  stageBody.className = "stage-body empty";
  stageBody.innerHTML = "<div><strong>Objetivo</strong><p>Probar primero el upstream prácticamente tal cual. Las adaptaciones competitivas —seed, replay, verificación, score normalizado y anti-cheat— vienen después.</p></div>";
  closeButton.disabled = true;
  fullscreenButton.disabled = true;
  telemetry.textContent = "sin sesión";
}

cards.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open]");
  if (button) openGame(button.dataset.open);
});

closeButton.addEventListener("click", closeStage);
fullscreenButton.addEventListener("click", async () => {
  if (!activeFrame) return;
  try {
    await activeFrame.requestFullscreen();
  } catch {}
});

window.addEventListener("message", (event) => {
  if (event.data?.type !== "skillarena2:telemetry") return;
  telemetry.textContent = JSON.stringify(event.data);
});

renderCards();
