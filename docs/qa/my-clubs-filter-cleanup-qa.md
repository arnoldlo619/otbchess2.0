# My Clubs Filter Cleanup QA

The stale visual-edit targets were confirmed as the desktop **Sort clubs** select and the desktop **All Countries** country select. Both controls were removed from the My Clubs search bar.

The desktop layout now presents only search and category chips, removing the extra controls that interrupted the filter hierarchy. Responsive filter access remains available through the existing mobile filter drawer, retaining sort, country, and city choices for compact viewports rather than removing discovery capabilities.

Desktop and 375px full-page checks show the simplified filter region without horizontal overflow. Focused My Clubs visual-edit coverage passed (2 tests), as did TypeScript, changed-file lint, and project lint with zero errors. The full suite has 6,941 passing tests and 13 unrelated existing source-contract failures in accessibility-overlay, form-label, and retired Wizard payment-toggle suites.
