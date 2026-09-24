import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const badgeSource = readFileSync(
  resolve(process.cwd(), "client/src/components/ui/club-player-id-badge.tsx"),
  "utf8",
);
const lanyardSource = readFileSync(
  resolve(process.cwd(), "client/src/components/ui/club-player-lanyard-scene.runtime.jsx"),
  "utf8",
);

const assetPath = (name: string) => resolve(process.cwd(), "client/public/club-assets", name);

describe("Club Player lanyard", () => {
  it("uses a code-split ReactBits physics scene only when desktop WebGL and motion preferences allow it", () => {
    expect(badgeSource).toContain('lazy(() => import("./club-player-lanyard-scene.runtime.jsx"))');
    expect(badgeSource).toContain('window.matchMedia("(min-width: 1024px)")');
    expect(badgeSource).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(badgeSource).toContain('canvas.getContext("webgl2") || canvas.getContext("webgl")');
    expect(badgeSource).toContain("<Suspense fallback={<StaticClubPlayerBadge />}>");
  });

  it("keeps a branded static fallback instead of leaving non-WebGL visitors without a credential", () => {
    expect(badgeSource).toContain('src="/club-assets/chess-club-player-front.svg"');
    expect(badgeSource).toContain("ChessOTB Club Player credential");
    expect(badgeSource).toContain("Interactive 3D ChessOTB Club Player lanyard");
  });

  it("integrates ReactBits lanyard physics with bespoke ChessOTB card surfaces", () => {
    expect(lanyardSource).toContain('from "@react-three/fiber"');
    expect(lanyardSource).toContain('from "@react-three/drei"');
    expect(lanyardSource).toContain('from "@react-three/rapier"');
    expect(lanyardSource).toContain('from "meshline"');
    expect(lanyardSource).toContain('import cardGLB from "./lanyard-assets/card.glb"');
    expect(lanyardSource).toContain('const FRONT_IMAGE = "/club-assets/chess-club-player-front.svg"');
    expect(lanyardSource).toContain('const BACK_IMAGE = "/club-assets/chess-club-player-back.svg"');
    expect(lanyardSource).toContain('const LANYARD_IMAGE = "/club-assets/chessotb-lanyard-band.svg"');
    expect(lanyardSource).toContain("useRopeJoint");
    expect(lanyardSource).toContain("useSphericalJoint");
    expect(lanyardSource).toContain("onPointerDown");
    expect(lanyardSource).toContain("onPointerUp");
  });

  it("ships all local ReactBits and ChessOTB lanyard assets", () => {
    expect(() => readFileSync(resolve(process.cwd(), "client/src/components/ui/lanyard-assets/card.glb"))).not.toThrow();
    expect(() => readFileSync(resolve(process.cwd(), "client/src/components/ui/lanyard-assets/reactbits-lanyard.png"))).not.toThrow();
    expect(() => readFileSync(assetPath("chess-club-player-front.svg"), "utf8")).not.toThrow();
    expect(() => readFileSync(assetPath("chess-club-player-back.svg"), "utf8")).not.toThrow();
    expect(() => readFileSync(assetPath("chessotb-lanyard-band.svg"), "utf8")).not.toThrow();
  });
});
