/**
 * usePageMeta — lightweight per-page SEO metadata hook
 *
 * Sets <title>, meta description, Open Graph, Twitter Card, and canonical URL
 * for any page that calls it. Falls back to site-wide defaults from index.html
 * if no override is provided.
 *
 * Usage:
 *   usePageMeta({
 *     title: "Pricing — ChessOTB.club",
 *     description: "Free for clubs. Pro for serious organizers.",
 *     image: "https://chessotb.club/og-pricing.jpg",
 *     path: "/pricing",
 *   });
 */

import { useEffect } from "react";

interface PageMetaOptions {
  /** Full page title, e.g. "Pricing — ChessOTB.club" */
  title?: string;
  /** Meta description (≤ 160 chars recommended) */
  description?: string;
  /** Absolute URL to OG image (1200×630 recommended) */
  image?: string;
  /** Canonical path, e.g. "/pricing" — will be resolved to full URL */
  path?: string;
  /** OG type, defaults to "website" */
  type?: "website" | "article";
  /** Article publish date (ISO string) — only used when type="article" */
  publishedTime?: string;
  /** Article author name */
  author?: string;
}

const SITE_NAME = "ChessOTB.club";
const SITE_URL = "https://chessotb.club";
const DEFAULT_OG_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png";
const DEFAULT_PAGE_TITLE = "Play Chess OTB";

function setMeta(name: string, content: string, property = false) {
  const attr = property ? "property" : "name";
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function usePageMeta(opts: PageMetaOptions = {}) {
  useEffect(() => {
    const {
      title,
      description,
      image = DEFAULT_OG_IMAGE,
      path,
      type = "website",
      publishedTime,
      author,
    } = opts;

    // ── Title ──
    if (title) {
      document.title = title;
      setMeta("og:title", title, true);
      setMeta("twitter:title", title);
    }

    // ── Description ──
    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, true);
      setMeta("twitter:description", description);
    }

    // ── Image ──
    setMeta("og:image", image, true);
    setMeta("twitter:image", image);
    setMeta("twitter:card", "summary_large_image");

    // ── Site name ──
    setMeta("og:site_name", SITE_NAME, true);

    // ── Type ──
    setMeta("og:type", type, true);

    // ── Article-specific ──
    if (type === "article" && publishedTime) {
      setMeta("article:published_time", publishedTime, true);
    }
    if (type === "article" && author) {
      setMeta("article:author", author, true);
    }

    // ── Canonical + og:url ──
    if (path) {
      const canonical = `${SITE_URL}${path}`;
      setCanonical(canonical);
      setMeta("og:url", canonical, true);
    }

    // Cleanup: restore defaults on unmount
    return () => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, [opts.title, opts.description, opts.image, opts.path, opts.type, opts.publishedTime, opts.author]);
}
