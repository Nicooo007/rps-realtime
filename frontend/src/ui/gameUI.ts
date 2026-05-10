import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const EMOJI: Record<string, string> = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
};

// estado global de la UI
let currentRoomId: string | null = null;
let myAlias: string = "";
let myPlayerIndex: number = -1;
let hasChosen = false;

function getApp() {
  return document.querySelector("#app") as HTMLDivElement;
}

// pantalla 1: LOBBY / ROOM SELECTION
export function showLanding() {
  currentRoomId = null;
  hasChosen = false;
  myPlayerIndex = -1;

  getApp().innerHTML = `
    <div class="landing-wrapper">
      <h1 class="home-title">Rock Paper <span>Scissors</span></h1>
      <p class="home-subtitle">Ingresa tu alias para jugar</p>

      <input id="aliasInput" class="home-input" type="text" placeholder="Tu alias..." maxlength="20" />

      <div class="landing-actions">
        <button id="createBtn" class="home-btn">✚ Crear sala</button>
      </div>

      <div class="rooms-section">
        <h2 class="rooms-title">Salas disponibles</h2>
        <div id="roomsList" class="rooms-list">
          <p class="rooms-empty">Cargando salas...</p>
        </div>
      </div>
    </div>
  `;

  const aliasInput = document.getElementById("aliasInput") as HTMLInputElement;
  const createBtn  = document.getElementById("createBtn")  as HTMLButtonElement;

  createBtn.addEventListener("click", () => {
    const alias = aliasInput.value.trim();
    if (!alias) { aliasInput.focus(); aliasInput.classList.add("error"); return; }
    aliasInput.classList.remove("error");
    myAlias = alias;
    socket.emit("create_room", alias);
  });

  aliasInput.addEventListener("input", () => aliasInput.classList.remove("error"));
  aliasInput.addEventListener("keydown", (e) => { if (e.key === "Enter") createBtn.click(); });
}

function renderRooms(rooms: { id: string; status: string; playerCount: number }[]) {
  const list = document.getElementById("roomsList");
  if (!list) return;
  if (rooms.length === 0) {
    list.innerHTML = `<p class="rooms-empty">No hay salas disponibles. ¡Crea una!</p>`;
    return;
  }
  list.innerHTML = rooms.map((r) => {
    const isFull    = r.playerCount >= 2;
    const statusLabel = r.status === "waiting" ? "Esperando" : r.status === "playing" ? "En juego" : "Terminada";
    const canJoin   = r.status === "waiting" && r.playerCount < 2;
    return `
      <div class="room-card ${isFull ? "room-full" : ""}">
        <div class="room-info">
          <span class="room-id">${r.id}</span>
          <span class="room-status ${r.status}">${statusLabel}</span>
          <span class="room-players">${r.playerCount}/2 jugadores</span>
        </div>
        ${canJoin ? `<button class="join-btn" data-room="${r.id}">Unirse</button>` : ""}
      </div>
    `;
  }).join("");

  list.querySelectorAll<HTMLButtonElement>(".join-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const roomId = btn.dataset.room!;
      const aliasInput = document.getElementById("aliasInput") as HTMLInputElement;
      const alias = aliasInput?.value.trim() || myAlias;
      if (!alias) { aliasInput?.focus(); aliasInput?.classList.add("error"); return; }
      myAlias = alias;
      socket.emit("join_room", { roomId, alias });
    });
  });
}

// pantalla 2: PANTALLA DE JUEGO
function showGame(players: { alias: string }[]) {
  hasChosen = false;
  const opponentAlias = players[myPlayerIndex === 0 ? 1 : 0]?.alias ?? "Oponente";

  getApp().innerHTML = `
    <div class="game-wrapper">
      <div class="game-header">
        <h1 class="game-title">Rock Paper <span>Scissors</span></h1>
        <div class="game-players-bar">
          <span class="player-badge you">👤 ${myAlias}</span>
          <span class="vs-label">vs</span>
          <span class="player-badge opp">👤 ${opponentAlias}</span>
        </div>
        <p class="room-label">Sala: <strong>${currentRoomId}</strong></p>
      </div>

      <p class="status-text" id="status">¡Elige tu jugada!</p>

      <div class="moves-container">
        <button class="move-btn" data-move="rock">🪨</button>
        <button class="move-btn" data-move="paper">📄</button>
        <button class="move-btn" data-move="scissors">✂️</button>
      </div>

      <p class="choice-info" id="choiceInfo"></p>
    </div>
  `;

  const status     = document.getElementById("status")     as HTMLElement;
  const choiceInfo = document.getElementById("choiceInfo") as HTMLElement;
  const buttons    = document.querySelectorAll<HTMLButtonElement>(".move-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (hasChosen) return;
      const move = btn.getAttribute("data-move")!;
      hasChosen = true;

      buttons.forEach((b) => { b.disabled = true; b.classList.remove("selected"); });
      btn.classList.add("selected");

      socket.emit("play", { roomId: currentRoomId, choice: move });
      status.textContent = "Esperando al oponente...";
      choiceInfo.textContent = `Elegiste: ${EMOJI[move]}`;
    });
  });
}

// PANTALLA 3: RESULT / ADMIN SCREEN
function showResult(data: {
  p1: { alias: string; choice: string };
  p2: { alias: string; choice: string };
  result: "p1" | "p2" | "draw";
}) {
  const myData  = myPlayerIndex === 0 ? data.p1 : data.p2;
  const oppData = myPlayerIndex === 0 ? data.p2 : data.p1;

  let winnerText = "";
  if (data.result === "draw") {
    winnerText = "¡Empate!";
  } else {
    const winnerAlias = data.result === "p1" ? data.p1.alias : data.p2.alias;
    winnerText = `🏆 ¡Ganó ${winnerAlias}!`;
  }

  getApp().innerHTML = `
    <div class="result-wrapper">
      <h1 class="game-title">Rock Paper <span>Scissors</span></h1>

      <div class="countdown-container" id="countdown">
        <span id="countNum">3</span>
      </div>

      <div class="reveal-container hidden" id="revealSection">
        <div class="reveal-choices">
          <div class="reveal-player">
            <span class="reveal-alias">${myData.alias} (Tú)</span>
            <span class="reveal-emoji">${EMOJI[myData.choice]}</span>
            <span class="reveal-choice-name">${myData.choice}</span>
          </div>
          <span class="reveal-vs">vs</span>
          <div class="reveal-player">
            <span class="reveal-alias">${oppData.alias}</span>
            <span class="reveal-emoji">${EMOJI[oppData.choice]}</span>
            <span class="reveal-choice-name">${oppData.choice}</span>
          </div>
        </div>

        <div class="winner-banner ${data.result === "draw" ? "draw" : ""}" id="winnerBanner">
          ${winnerText}
        </div>

        <div class="result-actions">
          <button id="restartBtn" class="home-btn">🔄 Jugar de nuevo</button>
          <button id="lobbyBtn"   class="home-btn secondary">🏠 Volver al lobby</button>
        </div>
      </div>
    </div>
  `;

  // animacion conteo: 3, 2 1 y revelación de resultados
  const countNum     = document.getElementById("countNum")      as HTMLElement;
  const countdownEl  = document.getElementById("countdown")     as HTMLElement;
  const revealSection= document.getElementById("revealSection") as HTMLElement;

  let count = 3;
  const tick = setInterval(() => {
    count--;
    if (count > 0) {
      countNum.textContent = String(count);
      countNum.classList.remove("pop");
      void countNum.offsetWidth; 
      countNum.classList.add("pop");
    } else {
      clearInterval(tick);
      countdownEl.classList.add("hidden");
      revealSection.classList.remove("hidden");
      revealSection.classList.add("fade-in");
    }
  }, 800);

  document.getElementById("restartBtn")?.addEventListener("click", () => {
    socket.emit("restart", currentRoomId);
  });

  document.getElementById("lobbyBtn")?.addEventListener("click", () => {
    socket.emit("leave_room", currentRoomId);
    showLanding();
  });
}

// SOCKET EVENTS
socket.on("rooms_update", renderRooms);

socket.on("room_joined", ({ roomId, playerIndex }: { roomId: string; playerIndex: number }) => {
  currentRoomId  = roomId;
  myPlayerIndex  = playerIndex;
  // Si es el creador (p0), muestra la pantalla de espera
  if (playerIndex === 0) {
    getApp().innerHTML = `
      <div class="game-wrapper">
        <h1 class="game-title">Rock Paper <span>Scissors</span></h1>
        <p class="status-text">Sala creada: <strong>${roomId}</strong></p>
        <p class="status-text">Esperando oponente...</p>
        <button id="cancelBtn" class="home-btn secondary" style="margin-top:2rem;">Cancelar</button>
      </div>
    `;
    document.getElementById("cancelBtn")?.addEventListener("click", () => {
      socket.emit("leave_room", currentRoomId);
      showLanding();
    });
  }
});

socket.on("game_start", (data: { players: { alias: string }[] }) => {
  showGame(data.players);
});

socket.on("player_chose", (data: { alias: string }) => {
  const status = document.getElementById("status");
  if (status && data.alias !== myAlias) {
    status.textContent = `${data.alias} ya eligió. ${hasChosen ? "" : "¡Elige tú ahora!"}`;
  }
});

socket.on("reveal", (data: any) => {
  showResult(data);
});

socket.on("game_restart", () => {
  // Re-renderiza la pantalla del juego manteniendo a los mismos jugadores
  hasChosen = false;
  const status = document.getElementById("status");
  if (status) {
    status.textContent = "¡Nueva ronda! Elige tu jugada.";
  } else {
    // Volver al juego
    const buttons = document.querySelectorAll<HTMLButtonElement>(".move-btn");
    if (buttons.length === 0) {
      
      socket.emit("get_room_players", currentRoomId);
    }
  }
  // recarga la pantalla del juego
  getApp().innerHTML = `
    <div class="game-wrapper">
      <h1 class="game-title">Rock Paper <span>Scissors</span></h1>
      <p class="status-text" id="status">¡Nueva ronda! Elige tu jugada.</p>
      <div class="moves-container">
        <button class="move-btn" data-move="rock">🪨</button>
        <button class="move-btn" data-move="paper">📄</button>
        <button class="move-btn" data-move="scissors">✂️</button>
      </div>
      <p class="choice-info" id="choiceInfo"></p>
    </div>
  `;
  const statusEl   = document.getElementById("status")     as HTMLElement;
  const choiceInfo = document.getElementById("choiceInfo") as HTMLElement;
  document.querySelectorAll<HTMLButtonElement>(".move-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (hasChosen) return;
      const move = btn.getAttribute("data-move")!;
      hasChosen = true;
      document.querySelectorAll<HTMLButtonElement>(".move-btn").forEach((b) => {
        b.disabled = true; b.classList.remove("selected");
      });
      btn.classList.add("selected");
      socket.emit("play", { roomId: currentRoomId, choice: move });
      statusEl.textContent = "Esperando al oponente...";
      choiceInfo.textContent = `Elegiste: ${EMOJI[move]}`;
    });
  });
});

socket.on("opponent_left", (alias: string) => {
  getApp().innerHTML = `
    <div class="game-wrapper">
      <h1 class="game-title">Rock Paper <span>Scissors</span></h1>
      <p class="status-text">😔 ${alias} se desconectó.</p>
      <button id="lobbyBtn" class="home-btn" style="margin-top:2rem;">🏠 Volver al lobby</button>
    </div>
  `;
  document.getElementById("lobbyBtn")?.addEventListener("click", () => {
    socket.emit("leave_room", currentRoomId);
    showLanding();
  });
});

socket.on("error", (msg: string) => {
  alert(msg);
});

socket.on("connect", () => {

  if (!currentRoomId) {
    const list = document.getElementById("roomsList");
    if (list) socket.emit("get_rooms");
  }
});

export function initGameUI() {
  showLanding();
}