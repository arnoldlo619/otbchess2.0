# QR Join Manual ELO — Visual QA Observations

- Mobile 375px screenshot confirms that the default QR Join form no longer displays an always-open manual-rating field. It presents the name field, Chess.com username field, and a separate 44px opt-in checkbox labeled **I don't have a Chess.com username**.
- The narrow form stays within the viewport with no horizontal overflow. Numeric ELO entry remains hidden until the opt-in is chosen.
- A separate desktop browser review confirmed the same default content, hierarchy, and checkbox presence on the QR Join demo route. The server-backed tournament resolver was intermittently unavailable in the development preview; the UI retained its established recovery state and no registration was submitted.

After selecting the opt-in in the browser, the Chess.com username field was removed from the QR Join card and replaced with a labelled numeric **Your ELO rating** input. The checkbox retains a visible checked state and the explanatory manual-rating provenance is shown directly below the field. This confirms the intended mutually exclusive provider-lookup and manual-ELO paths at the presentation layer; no tournament registration was submitted during review.
