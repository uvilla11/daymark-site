const paperButton = document.querySelector("[data-paper-toggle]");

if (paperButton) {
  paperButton.hidden = false;
  paperButton.addEventListener("click", () => {
    const night = document.documentElement.dataset.paper !== "night";
    document.documentElement.dataset.paper = night ? "night" : "day";
    paperButton.setAttribute("aria-pressed", String(night));
    paperButton.textContent = night ? "Return to day paper" : "Try night paper";
  });
}
