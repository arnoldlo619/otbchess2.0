/**
 * fireTournamentConfetti
 *
 * Shared 5-wave celebration sequence used on both the FinalStandings page
 * (auto-fires on load) and the Director page (fires when the tournament is
 * finalized).  Uses canvas-confetti's create() API with an explicit canvas
 * element to avoid the getBoundingClientRect error that occurs when the
 * library tries to use a detached/virtual canvas.
 */
import confettiLib from "canvas-confetti";

export function fireTournamentConfetti(): void {
  // Create an explicit full-screen canvas
  const canvas = document.createElement("canvas");
  canvas.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:100%",
    "height:100%",
    "pointer-events:none",
    "z-index:9999",
  ].join(";");
  document.body.appendChild(canvas);

  const fire = confettiLib.create(canvas, { resize: true, useWorker: false });

  // Brand palette — greens, gold, cream, white, plus vivid pops
  const colors = [
    "#3D6B47", "#4CAF50", "#769656", "#EEEED2",
    "#FFD700", "#FFC107", "#FFFFFF", "#A8E6CF",
    "#FF6B6B", "#4ECDC4",
  ];

  // ── Wave 1: big double-cannon from bottom corners ──────────────────────────
  fire({
    particleCount: 120, spread: 80, startVelocity: 55,
    gravity: 0.85, ticks: 280, colors,
    origin: { x: 0.1, y: 0.9 }, angle: 70,
    shapes: ["square", "circle"],
  });
  fire({
    particleCount: 120, spread: 80, startVelocity: 55,
    gravity: 0.85, ticks: 280, colors,
    origin: { x: 0.9, y: 0.9 }, angle: 110,
    shapes: ["square", "circle"],
  });

  const timers: ReturnType<typeof setTimeout>[] = [];

  // ── Wave 2: center explosion (350ms) ──────────────────────────────────────
  timers.push(setTimeout(() => {
    fire({
      particleCount: 150, spread: 360, startVelocity: 40,
      gravity: 0.6, ticks: 320, colors,
      origin: { x: 0.5, y: 0.55 },
      shapes: ["star", "circle", "square"],
      scalar: 1.1,
    });
  }, 350));

  // ── Wave 3: side cannons inward (650ms) ───────────────────────────────────
  timers.push(setTimeout(() => {
    fire({
      particleCount: 80, spread: 65, startVelocity: 48,
      gravity: 0.9, ticks: 260, colors,
      origin: { x: 0.25, y: 0.88 }, angle: 78,
      shapes: ["circle", "square"],
    });
    fire({
      particleCount: 80, spread: 65, startVelocity: 48,
      gravity: 0.9, ticks: 260, colors,
      origin: { x: 0.75, y: 0.88 }, angle: 102,
      shapes: ["circle", "square"],
    });
  }, 650));

  // ── Wave 4: gold star shower from top (1000ms) ────────────────────────────
  timers.push(setTimeout(() => {
    fire({
      particleCount: 60, spread: 100, startVelocity: 20,
      gravity: 0.4, ticks: 400,
      colors: ["#FFD700", "#FFC107", "#FFFFFF", "#4CAF50"],
      origin: { x: 0.5, y: 0.0 },
      shapes: ["star"],
      scalar: 1.3,
      drift: 0,
    });
  }, 1000));

  // ── Wave 5: final corner burst (1400ms) ───────────────────────────────────
  timers.push(setTimeout(() => {
    fire({
      particleCount: 70, spread: 55, startVelocity: 42,
      gravity: 1.0, ticks: 220, colors,
      origin: { x: 0.05, y: 0.95 }, angle: 60,
      shapes: ["square", "circle"],
    });
    fire({
      particleCount: 70, spread: 55, startVelocity: 42,
      gravity: 1.0, ticks: 220, colors,
      origin: { x: 0.95, y: 0.95 }, angle: 120,
      shapes: ["square", "circle"],
    });
  }, 1400));

  // Remove canvas after all particles settle (~4.5s total)
  timers.push(setTimeout(() => canvas.remove(), 4500));
}
