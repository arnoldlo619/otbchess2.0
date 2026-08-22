/**
 * NavLogo — shared OTB!! logo image used in every page header.
 *
 * Renders the OTB!! logo image with consistent sizing and hover behaviour.
 * Wraps in a Link to "/" by default so clicking always returns home.
 */
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";

const LOGO_URL =
  "/manus-storage/otb-logo-exclamation-256_9b50f5ee.webp";

interface NavLogoProps {
  /** Extra Tailwind classes to apply to the <img> element */
  className?: string;
  /** If false, renders without a Link wrapper (e.g. when already on home) */
  linked?: boolean;
}

export function NavLogo({ className = "", linked = true }: NavLogoProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const img = (
    <img
      src={LOGO_URL}
      alt="OTB Chess"
      className={`h-9 w-auto object-contain transition-opacity hover:opacity-90 active:opacity-70 ${className}`}
      style={{ mixBlendMode: isDark ? "screen" : "normal" }}
      draggable={false}
    />
  );

  if (!linked) return img;

  return (
    <Link href="/" className="flex items-center">
      {img}
    </Link>
  );
}
