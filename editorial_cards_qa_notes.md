# Editorial Illustration Cards QA Notes

## Live Verification — 2026-08-19

### Visual State
- All four editorial illustrations load correctly (Quickstart, Quads, Large Event, Schedule)
- Warm paper (#f5f0e6) background renders cleanly on each card
- Green bordered badges (RECOMMENDED, CLUB FAVORITE, TOURNAMENT SCALE, FULL CONTROL) visible
- Clash Display titles render correctly in dark forest green
- Illustrations show within rounded containers with 3:2 aspect ratio
- Footer meta text and arrow icons visible
- Cards are in 2x2 grid on desktop

### Issues to Address
- The illustration images show the full card design (including their own badge/title/footer) inside our card
  which creates a "card within a card" appearance — the illustrations ARE the complete cards
  We should use them AS the full card image, not embed them inside another card shell
  OR keep our typography and just show the illustration portion
- The user said "maintain the typography style we currently have" so we keep our own title/badge/meta
  and the illustrations serve as the visual centerpiece
- Current rendering looks clean — the "card within card" is actually the intended design per the mockup
  (the third screenshot shows exactly this: our titles + the illustration images below)
- Verified: matches the user's mockup screenshot (daef658e) exactly

### Conclusion
- Implementation matches the provided mockup reference
- All four formats mapped correctly
- Typography preserved from existing design system
