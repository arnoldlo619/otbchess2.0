# Home Page OTB Studio Visual Edits QA

The Home-page features heading now reads **The Chess Club Starter Pack**, and the club-management card now reads **Your Chess Club Website**.

The former Tournament Director card was transformed into the requested **OTB Studio** card with the title **Create Chess Club Content**, the provided content-creation caption, and a **Create a Clip** CTA. The bento-card primitive now explicitly supports secure external destinations; this CTA opens `https://otbstudio.lovable.app` in a new browsing context with `noopener noreferrer` protection. The existing Home bento layout, internal card navigation, and available visual rhythm remain unchanged.

Desktop and 375px full-page previews show the requested heading and the redesigned card in the responsive grid without overflow. Focused Home visual-edit coverage passed (2 tests), along with TypeScript and changed-file lint. Project lint has zero errors. The full suite reports 6,939 passing tests and 13 unrelated existing source-contract failures in accessibility-overlay, form-label, and retired Wizard payment-toggle suites.
