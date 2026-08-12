const modeDescription = document.querySelector("#mode-description");
const statusText = document.querySelector("#status-text");
const modeButtons = document.querySelectorAll("[data-mode]");

const setMode = (mode) => {
  const isGamepad = mode === "gamepad";

  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });

  modeDescription.textContent = isGamepad
    ? "Gamepad mode is selected. Connect a controller to continue."
    : "Standard mode uses mouse and keyboard.";

  statusText.textContent = `Switched to ${isGamepad ? "gamepad" : "standard"} mode.`;
};

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key.length !== 1 && !event.key.startsWith("Arrow")) {
    return;
  }

  statusText.textContent = `Last keyboard input: ${event.key}`;
});

window.addEventListener("pointerdown", (event) => {
  const modeButton = event.target?.closest?.("[data-mode]");

  if (modeButton) {
    return;
  }

  statusText.textContent = `Pointer input at ${Math.round(event.clientX)}, ${Math.round(event.clientY)}`;
});
