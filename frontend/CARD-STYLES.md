# Scopa card presentation

Modern remains the default and retains the original markup, suit glyphs, colors and dimensions. The gameplay Cards selector switches to Traditional immediately and saves `scopa.cardStyle` locally. Storage failures fall back gracefully. This preference never enters the session, API or WebSocket payloads.

`CardStyleProvider` wraps the game without changing its key or authoritative snapshot. `ScopaCardButton` owns the same card ID, selected state and handlers; `CardFace` owns only the appearance. Move animation cards use that same renderer. Opponent card backs consume the same preference, without receiving hidden identities. Screenshot scenes use a nonpersistent provider and start in Modern.

The four original Sicilian scans in `public/cards/sicilian/` are by Matsoftware, licensed CC BY-SA 3.0. Source links, licensing and modifications are in `public/cards/sicilian/ATTRIBUTION.html`, accessible from the Traditional selector and homepage. No external artwork requests occur during play. Images are CSS-cropped from a four-column, three-row sheet: values 1–8 run across the first two rows, then 9 (cavallo) and 10 (re) occupy columns 2–3 of the last row. Backend suits GOLD/CUPS/SWORDS/CLUBS map to denari/coppe/spade/bastoni. The original scans remain unchanged. The landing SVG embeds cropped copies of the same artwork in its previous decorative positions; that adaptation is CC BY-SA 3.0 as well.

Validation: `npm run build`, `npm test`, and the screenshot scenes documented in `SCREENSHOTS.md`. `tests/cardStyle.test.mjs` covers all 40 identities, interaction props, defaults, preference persistence, blocked storage and nonpersistent fixture behavior.
