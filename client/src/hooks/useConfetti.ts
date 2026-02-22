/*
 * OTB Chess — useConfetti hook
 * Lightweight canvas confetti burst — zero external dependencies.
 * Chess-themed: uses green, cream, gold, and dark tones from the OTB palette.
 * Call `fireConfetti()` to trigger a celebratory burst from the top-center.
 */

import { useCallback, useRef } from "react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS = [
  "#3D6B47", // OTB forest green
  "#4CAF50", // bright green
  "#86EFAC", // light mint
  "#EEEED2", // chess cream
  "#F5F0E8", // warm ivory
  "#F4C430", // gold
  "#FBBF24", // amber
  "#1A1A1A", // near-black (chess piece)
  "#FFFFFF", // white
];

// ─── Particle ─────────────────────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  width: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: "rect" | "circle" | "diamond";
  gravity: number;
  drag: number;
}

function createParticle(canvasW: number, originX: number, originY: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 6 + Math.random() * 10;
  const shapes: Particle["shape"][] = ["rect", "circle", "diamond"];
  return {
    x: originX,
    y: originY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 8, // bias upward
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    width: 6 + Math.random() * 8,
    height: 4 + Math.random() * 6,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.25,
    opacity: 1,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    gravity: 0.28 + Math.random() * 0.12,
    drag: 0.985,
  };
  void canvasW; // suppress unused warning
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.globalAlpha = p.opacity;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.fillStyle = p.color;

  if (p.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(0, -p.height);
    ctx.lineTo(p.width / 2, 0);
    ctx.lineTo(0, p.height);
    ctx.lineTo(-p.width / 2, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
  }

  ctx.restore();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useConfetti() {
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fireConfetti = useCallback((
    count = 120,
    originX?: number,
    originY?: number,
  ) => {
    // Clean up any previous run
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (canvasRef.current) {
      document.body.removeChild(canvasRef.current);
      canvasRef.current = null;
    }

    // Create canvas overlay
    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    Object.assign(canvas.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: "9999",
    });
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d")!;
    const ox = originX ?? canvas.width / 2;
    const oy = originY ?? canvas.height * 0.35;

    // Spawn particles in two bursts for a more natural feel
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push(createParticle(canvas.width, ox, oy));
    }
    // Second smaller burst slightly delayed — simulate via offset velocities
    setTimeout(() => {
      for (let i = 0; i < Math.floor(count * 0.4); i++) {
        const p = createParticle(canvas.width, ox + (Math.random() - 0.5) * 60, oy);
        p.vy -= 4;
        particles.push(p);
      }
    }, 180);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = 0;
      for (const p of particles) {
        if (p.opacity <= 0) continue;
        alive++;

        // Physics
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Fade out when below mid-screen or after enough travel
        if (p.y > canvas.height * 0.7 || p.opacity < 1) {
          p.opacity = Math.max(0, p.opacity - 0.018);
        }

        drawParticle(ctx, p);
      }

      if (alive > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Clean up canvas
        if (canvasRef.current) {
          document.body.removeChild(canvasRef.current);
          canvasRef.current = null;
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  return { fireConfetti };
}
