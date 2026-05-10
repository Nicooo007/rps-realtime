export function HomePage() {
  const app = document.querySelector("#app") as HTMLDivElement;

  app.innerHTML = `
    <div class="home-wrapper">
      <h1 class="home-title">Rock Paper <span>Scissors</span></h1>
      <p class="home-subtitle">Ingresa tu nombre para jugar</p>
      <input id="nameInput" class="home-input" type="text" placeholder="Tu nombre..." />
      <button id="startBtn" class="home-btn">Jugar →</button>
    </div>
  `;

  const input = document.getElementById("nameInput") as HTMLInputElement;
  const button = document.getElementById("startBtn") as HTMLButtonElement;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") button.click();
  });

  button.addEventListener("click", () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      input.style.borderColor = "#ff3b8b";
      return;
    }
    localStorage.setItem("playerName", name);
    window.location.hash = "#game";
  });
}