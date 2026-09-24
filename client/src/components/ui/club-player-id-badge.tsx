import { lazy, Suspense, useEffect, useState } from "react";

interface ClubPlayerIdBadgeProps {
  className?: string;
}

const ClubPlayerLanyardScene = lazy(() => import("./club-player-lanyard-scene.runtime.jsx"));

function supportsDesktopLanyard() {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia("(min-width: 1024px)").matches) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function StaticClubPlayerBadge() {
  return (
    <div className="relative flex h-full w-full items-end justify-center" aria-hidden="true">
      <div className="absolute left-1/2 top-0 h-16 w-2 -translate-x-1/2 rounded-b-full border-x border-white/15 bg-[linear-gradient(90deg,#0a2811,#58ac50_48%,#0a2811)] shadow-[0_7px_14px_rgba(0,0,0,0.4)]" />
      <div className="absolute left-1/2 top-11 z-10 h-5 w-10 -translate-x-1/2 rounded-md border border-white/30 bg-[#162e1c] shadow-[0_4px_9px_rgba(0,0,0,0.42)]" />
      <img
        src="/club-assets/chess-club-player-front.svg"
        alt=""
        className="h-[19.75rem] w-[13.2rem] rounded-[1.15rem] object-cover shadow-[0_24px_48px_-16px_rgba(0,0,0,0.65)]"
        decoding="async"
      />
    </div>
  );
}

/**
 * Desktop-only entry point for the ReactBits physics lanyard. The expensive
 * WebGL scene is code-split and loaded only after desktop/WebGL/reduced-motion
 * checks pass; every other environment receives the same branded static badge.
 */
export function ClubPlayerIdBadge({ className = "" }: ClubPlayerIdBadgeProps) {
  const [render3d, setRender3d] = useState(false);

  useEffect(() => {
    setRender3d(supportsDesktopLanyard());
  }, []);

  return (
    <div
      className={`relative h-[22.5rem] w-[18rem] overflow-visible ${className}`}
      aria-label="ChessOTB Club Player credential"
    >
      {render3d ? (
        <Suspense fallback={<StaticClubPlayerBadge />}>
          <ClubPlayerLanyardScene />
        </Suspense>
      ) : (
        <StaticClubPlayerBadge />
      )}
      <span className="sr-only">Interactive 3D ChessOTB Club Player lanyard. Drag the credential to move it.</span>
    </div>
  );
}

export default ClubPlayerIdBadge;
