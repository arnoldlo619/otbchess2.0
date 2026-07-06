/**
 * ClubHero — Contained premium hero card for the club profile page.
 *
 * Replaces the full-bleed banner with a contained rounded module that aligns
 * to the same grid as the content cards below. All existing data props and
 * action handlers are threaded through unchanged.
 */
import React from "react";
import {
  MapPin, Globe, Lock, Users, Trophy, Award, Bell,
  CheckCircle2, Camera, X, Instagram, Sparkles, QrCode,
} from "lucide-react";

export interface ClubHeroProps {
  // Club data
  name: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  avatarBroken: boolean;
  flag: string;
  accent: string;
  isVerified?: boolean;
  beginnerFriendly?: boolean;
  isPublic: boolean;
  location?: string | null;
  memberCount: number;
  tournamentCount?: number | null;
  leagueCount?: number;
  followerCount: number;
  onlineCount?: number;
  // Social links
  website?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  discord?: string | null;
  youtube?: string | null;
  // Membership state
  isOwner: boolean;
  isDirector: boolean;
  joined: boolean;
  joining: boolean;
  following: boolean;
  followingLoading: boolean;
  // Handlers
  onJoin: () => void;
  onLeave: () => void;
  onFollow: () => void;
  // Banner upload (owners only)
  bannerUploading?: boolean;
  bannerDragOver?: boolean;
  onBannerFile?: (file: File) => void;
  onRemoveBanner?: () => void;
  onBannerDragOver?: (over: boolean) => void;
  // Avatar nav dropdown slot
  avatarDropdown?: React.ReactNode;
  // Dark mode
  isDark: boolean;
  // Owner-only: open the promo graphic creator
  onCreatePromo?: () => void;
  // Share Club QR projection
  onShareQR?: () => void;
}

export function ClubHero({
  name, avatarUrl, bannerUrl, avatarBroken, flag, accent,
  isVerified, beginnerFriendly, isPublic, location,
  memberCount, tournamentCount, leagueCount = 0, followerCount, onlineCount,
  website, instagram, twitter, discord, youtube,
  isOwner, isDirector, joined, joining, following, followingLoading,
  onJoin, onLeave, onFollow,
  bannerUploading, bannerDragOver, onBannerFile, onRemoveBanner, onBannerDragOver,
  avatarDropdown, isDark, onCreatePromo, onShareQR,
}: ClubHeroProps) {

  return (
    <div
      className="relative rounded-[28px] overflow-hidden"
      style={{
        minHeight: "220px",
        border: `1px solid rgba(118,255,136,0.10)`,
        background: bannerUrl
          ? undefined
          : `radial-gradient(circle at 18% 20%, rgba(84,190,100,0.18), transparent 360px),
             linear-gradient(135deg, rgba(10,45,20,0.96), rgba(2,12,6,0.98))`,
        boxShadow: `0 24px 80px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Custom banner image */}
      {bannerUrl && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${bannerUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: bannerUrl
            ? `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.42) 40%, rgba(0,0,0,0.78) 100%)`
            : undefined,
        }}
      />

      {/* Micro-grid checkered pattern (no banner only) — matches landing page hero */}
      {!bannerUrl && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse 85% 80% at 50% 50%, black 40%, transparent 100%)",
          }}
        />
      )}

      {/* Radial glow behind avatar area */}
      {!bannerUrl && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 40% 60% at 12% 50%, ${accent}28, transparent 70%)`,
          }}
        />
      )}

      {/* ── Content ── */}
      <div className="relative z-10 p-6 sm:p-8 flex flex-col gap-5">

        {/* Top row: action buttons (avatar dropdown moved to sidebar) */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-shrink-0" />
          {/* Action buttons — right-aligned in hero */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!isOwner && (
              <button
                onClick={onFollow}
                disabled={followingLoading}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={following
                  ? { borderColor: "rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.65)", background: "rgba(0,0,0,0.40)", backdropFilter: "blur(8px)" }
                  : { borderColor: `${accent}88`, color: accent, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(8px)", outlineColor: accent }
                }
                aria-label={following ? "Unfollow club" : "Follow club"}
              >
                {followingLoading
                  ? <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
                  : <Bell size={11} />
                }
                {following ? "Following" : "Follow"}
                {followerCount > 0 && (
                  <span className="opacity-60 tabular-nums">
                    {followerCount >= 1000 ? `${(followerCount / 1000).toFixed(1)}k` : followerCount}
                  </span>
                )}
              </button>
            )}
            {!isOwner && !isDirector && (
              joined ? (
                <button
                  onClick={onLeave}
                  disabled={joining}
                  className="text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ borderColor: "rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.65)", background: "rgba(0,0,0,0.40)", backdropFilter: "blur(8px)" }}
                  aria-label="Leave club"
                >
                  {joining ? "…" : "Leave"}
                </button>
              ) : (
                <button
                  onClick={onJoin}
                  disabled={joining}
                  className="text-xs font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    background: accent,
                    color: "#fff",
                    boxShadow: `0 4px 16px ${accent}44`,
                    outlineColor: accent,
                  }}
                  aria-label={isPublic ? "Join club" : "Request to join club"}
                >
                  {joining ? "…" : isPublic ? "Join" : "Request"}
                </button>
              )
            )}
            {(isOwner || isDirector) && (
              <>
                {onCreatePromo && (
                  <button
                    onClick={onCreatePromo}
                    className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      borderColor: "rgba(76,175,80,0.40)",
                      color: "#4CAF50",
                      background: "rgba(76,175,80,0.12)",
                      backdropFilter: "blur(8px)",
                      outlineColor: "#4CAF50",
                    }}
                    aria-label="Create promotional graphic"
                  >
                    <Sparkles size={11} />
                    Promo
                  </button>
                )}
                {onShareQR && (
                  <button
                    onClick={onShareQR}
                    className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      borderColor: "rgba(59,130,246,0.40)",
                      color: "#93C5FD",
                      background: "rgba(59,130,246,0.12)",
                      backdropFilter: "blur(8px)",
                      outlineColor: "#3B82F6",
                    }}
                    aria-label="Share Club QR code projection"
                  >
                    <QrCode size={11} />
                    Share QR
                  </button>
                )}
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                  style={{
                    background: "rgba(245,197,66,0.12)",
                    borderColor: "rgba(245,197,66,0.30)",
                    color: "#f5c542",
                  }}
                >
                  {isOwner ? "Owner" : "Director"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Main identity row: avatar + name + meta */}
        <div className="flex items-end gap-4 sm:gap-5">
          {/* Club avatar */}
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-2xl"
            style={{
              background: accent,
              border: `2px solid ${accent}55`,
              boxShadow: `0 8px 32px ${accent}44`,
            }}
          >
            {avatarUrl && !avatarBroken ? (
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl sm:text-4xl">{flag}</span>
            )}
          </div>

          {/* Name + badges + location */}
          <div className="flex-1 min-w-0 pb-0.5">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h1
                className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight"
                style={{ fontFamily: "'Clash Display', 'Inter', sans-serif", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
              >
                {name}
              </h1>
              {isVerified && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: "oklch(0.25 0.10 220)", color: "oklch(0.75 0.14 220)" }}>
                  <CheckCircle2 size={9} /> Verified
                </span>
              )}
              {beginnerFriendly && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: "oklch(0.28 0.10 80)", color: "oklch(0.80 0.14 80)" }}>
                  Beginner Friendly
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: "rgba(255,255,255,0.52)" }}>
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} /> {flag} {location}
                </span>
              )}
              <span className="flex items-center gap-1">
                {isPublic
                  ? <><Globe size={10} /> Public</>
                  : <><Lock size={10} /> Private</>
                }
              </span>
              {onlineCount !== undefined && onlineCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {onlineCount} online
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            <Users size={12} style={{ color: accent }} />
            <span className="font-bold text-white tabular-nums">{memberCount}</span>
            <span>members</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            <Trophy size={12} style={{ color: accent }} />
            <span className="font-bold text-white tabular-nums">{tournamentCount ?? 0}</span>
            <span>tournaments</span>
          </div>
          {leagueCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              <Award size={12} style={{ color: accent }} />
              <span className="font-bold text-white tabular-nums">{leagueCount}</span>
              <span>league{leagueCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Social links */}
        {(website || instagram || twitter || discord || youtube) && (
          <div className="flex items-center gap-4 flex-wrap">
            {website && (
              <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: "#82aad3" }}>
                <Globe size={11} />
                {website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 28)}
              </a>
            )}
            {instagram && (
              <a href={`https://instagram.com/${instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: "oklch(0.75 0.14 0)" }}>
                <Instagram size={11} /> @{instagram.replace(/^@/, "")}
              </a>
            )}
            {twitter && (
              <a href={twitter.startsWith("http") ? twitter : `https://x.com/${twitter.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: "oklch(0.80 0.05 220)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                @{twitter.replace(/^@/, "")}
              </a>
            )}
            {discord && (
              <a href={discord} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: "oklch(0.70 0.14 270)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>
                Discord
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Banner upload overlay (owners/directors only) ── */}
      {(isOwner || isDirector) && onBannerFile && (
        <>
          {/* Drag-and-drop highlight */}
          <div
            className="absolute inset-0 z-30 pointer-events-none transition-all duration-200 rounded-[28px]"
            style={{
              background: bannerDragOver ? "rgba(0,0,0,0.55)" : "transparent",
              border: bannerDragOver ? `2px dashed ${accent}` : "2px dashed transparent",
            }}
          >
            {bannerDragOver && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Camera size={28} style={{ color: accent }} />
                <span className="text-sm font-bold text-white">Drop to upload banner</span>
              </div>
            )}
          </div>
          {/* Invisible drag target */}
          <div
            className="absolute inset-0 z-20"
            onDragOver={(e) => { e.preventDefault(); onBannerDragOver?.(true); }}
            onDragLeave={() => onBannerDragOver?.(false)}
            onDrop={(e) => {
              e.preventDefault();
              onBannerDragOver?.(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onBannerFile(file);
            }}
          />
          {/* Banner action buttons */}
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
            {bannerUploading ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(0,0,0,0.55)", color: "#fff", backdropFilter: "blur(4px)" }}>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Uploading…
              </div>
            ) : (
              <>
                <label htmlFor="banner-upload-hero"
                  className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-90"
                  style={{ background: "rgba(0,0,0,0.55)", color: "#fff", backdropFilter: "blur(4px)" }}
                  title="Change banner image">
                  <Camera size={13} />
                  {bannerUrl ? "Change Banner" : "Add Banner"}
                </label>
                {bannerUrl && onRemoveBanner && (
                  <button onClick={onRemoveBanner}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-90"
                    style={{ background: "rgba(180,0,0,0.65)", color: "#fff", backdropFilter: "blur(4px)" }}
                    title="Remove banner image">
                    <X size={13} /> Remove
                  </button>
                )}
              </>
            )}
          </div>
          <input id="banner-upload-hero" type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) onBannerFile(file); e.target.value = ""; }} />
        </>
      )}
    </div>
  );
}
