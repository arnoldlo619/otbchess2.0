import { useEffect } from "react";

const HOME_URL = "https://chessotb.club/";
const ORGANIZATION_ID = `${HOME_URL}#organization`;
const WEBSITE_ID = `${HOME_URL}#website`;

// Describe the platform, not a physical club or an invented event listing.
const HOMEPAGE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "ChessOTB.club",
      alternateName: "OTB Chess",
      url: HOME_URL,
      logo: `${HOME_URL}brand/otb-retro-cream-green-wordmark.webp`,
      description: "ChessOTB.club helps chess clubs organize over-the-board tournaments and leagues.",
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: "ChessOTB.club",
      alternateName: "OTB Chess",
      url: HOME_URL,
      inLanguage: "en",
      publisher: { "@id": ORGANIZATION_ID },
    },
    {
      "@type": "WebPage",
      "@id": `${HOME_URL}#webpage`,
      url: HOME_URL,
      // Keep these aligned with Home's metadata; parity is covered by tests.
      name: "ChessOTB.club | Chess Tournaments & Clubs Over the Board",
      description: "Host over-the-board chess tournaments, grow your chess club, and run leagues with smart pairings, live standings, player profiles, and easy QR check-in.",
      inLanguage: "en",
      isPartOf: { "@id": WEBSITE_ID },
      mainEntity: { "@id": ORGANIZATION_ID },
      about: [
        { "@type": "Thing", name: "Chess clubs" },
        { "@type": "Thing", name: "Over-the-board chess tournaments" },
        { "@type": "Thing", name: "Chess leagues" },
      ],
    },
  ],
};

/** One graph per homepage mount; never leak homepage markup to other routes. */
export function useHomepageStructuredData() {
  useEffect(() => {
    document.getElementById("jsonld-homepage")?.remove();
    const script = document.createElement("script");
    script.id = "jsonld-homepage";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(HOMEPAGE_STRUCTURED_DATA);
    document.head.appendChild(script);

    // Remove this instance only, leaving Article and other page schemas intact.
    return () => script.remove();
  }, []);
}
