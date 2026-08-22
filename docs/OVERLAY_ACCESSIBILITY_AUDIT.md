# Overlay Keyboard Accessibility Audit

**Audit date:** 2026-08-22  
**Scope:** 56 React files that define or invoke dialogs, sheets, drawers, dropdown overlays, or full-screen modal surfaces.

## Result

The audit found **11 already compliant or invoker-only files** and **45 custom-overlay files with at least one confirmed keyboard gap**. This checkpoint establishes a stack-aware reusable focus-management hook and migrates the four highest-impact custom overlays used in principal public or participant flows.

| Category | Count | Status |
|---|---:|---|
| Audited overlay-related files | 56 | Complete |
| Already compliant/invoker-only | 11 | No change required |
| Principal custom overlays migrated | 4 | Complete |
| Remaining custom-overlay files | 41 | Open |

## Principal overlays migrated

| Surface | Source | Coverage |
|---|---|---|
| Authentication modal | `client/src/components/AuthModal.tsx` | Initial focus, Tab/Shift+Tab containment, Escape, opener restoration |
| QR scanner | `client/src/components/QrScanner.tsx` | Dialog semantics, close-button focus, containment, Escape, opener restoration |
| Pro upgrade modal | `client/src/components/ProUpgradeModal.tsx` | Portal-safe containment, Escape, opener restoration |
| Player profile sheet | `client/src/components/PlayerProfileSheet.tsx` | Sheet semantics, close-button focus, containment, Escape, opener restoration |

These surfaces use `client/src/hooks/useAccessibleOverlay.ts`, which is stack-aware so only the topmost custom overlay responds to keyboard dismissal and focus cycling.

## Already compliant or invoker-only

`AvatarCropModal.tsx`, `ManusDialog.tsx`, `ui/alert-dialog.tsx`, `ui/command.tsx`, `ui/dialog.tsx`, `ui/drawer.tsx`, `ui/sheet.tsx`, `ui/sidebar.tsx`, `Home.tsx`, `OpeningsAdmin.tsx`, and `VideoRecorder.tsx`.

## Remaining custom-overlay backlog

The following files still require migration or a dedicated interaction audit before the global “No keyboard trap in any modal or drawer” checklist item can be closed:

`AnnounceModal.tsx`, `ArchivePasswordModal.tsx`, `AvatarNavDropdown.tsx`, `CheckInAnnounceModal.tsx`, `ChessLineViewer.tsx`, `ClubMeetupWizard.tsx`, `ClubShareModal.tsx`, `ContactOwnerModal.tsx`, `CreateClubAuthGate.tsx`, `CreateClubWizard.tsx`, `CreateLeagueWizard.tsx`, `CutoffOverrideModal.tsx`, `EditClubDetailsModal.tsx`, `EditPlayerModal.tsx`, `FilmGameSheet.tsx`, `FullScreenClock.tsx`, `GameResultModal.tsx`, `InstallBanner.tsx`, `NotationModeOverlay.tsx`, `PairingSwapModal.tsx`, `QRModal.tsx`, `RegisterGameModal.tsx`, `ShareResultsModal.tsx`, `SpectatorQRScreen.tsx`, `SpectatorShareModal.tsx`, `SwissPhaseSummaryModal.tsx`, `TiebreakTooltip.tsx`, `TournamentWizard.tsx`, `club/ClubPromoModal.tsx`, `club/ClubQRProjectionModal.tsx`, `tournament/QuadsDirectorPanel.tsx`, `BroadcastConsole.tsx`, `BroadcastControl.tsx`, `ChessClock.tsx`, `ClubDashboard.tsx`, `ClubProfile.tsx`, `Director.tsx`, `Join.tsx`, `MyClubs.tsx`, `PlayerView.tsx`, and `RepertoireBuilder.tsx`.

## Acceptance criteria for each remaining migration

Each modal surface must expose dialog semantics and an accessible name, place initial focus inside itself, contain forward and reverse Tab navigation while open, dismiss with Escape when safe, restore focus to its opener, and retain a visible close or cancel route. Menus and non-modal popovers should use the corresponding accessible primitive rather than modal focus containment.
