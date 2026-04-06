/**
 * NavLogo — shared OTB!! logo image used in every page header.
 *
 * Renders the OTB!! logo image with consistent sizing and hover behaviour.
 * Wraps in a Link to "/" by default so clicking always returns home.
 */
import { Link } from "wouter";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png";

interface NavLogoProps {
  /** Extra Tailwind classes to apply to the <img> element */
  className?: string;
  /** If false, renders without a Link wrapper (e.g. when already on home) */
  linked?: boolean;
}

export function NavLogo({ className = "", linked = true }: NavLogoProps) {
  const img = (
    <img
      src={LOGO_URL}
      alt="OTB Chess"
      className={`h-8 w-auto object-contain transition-opacity hover:opacity-80 active:opacity-60 ${className}`}
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
