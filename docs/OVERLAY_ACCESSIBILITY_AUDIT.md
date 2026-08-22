# Overlay Keyboard Accessibility Audit

**Audit date:** 2026-08-22  
**Scope:** 56 React files that define or invoke dialogs, sheets, drawers, dropdown overlays, or full-screen modal surfaces.

## Result

The audit found **11 already compliant or invoker-only files** and **45 custom-overlay files with at least one confirmed keyboard gap**. The shared stack-aware focus-management hook now covers four principal public overlays, nine tournament-director operational overlays, and eight participant/gameplay overlays.

| Category | Count | Status |
|---|---:|---|
| Audited overlay-related files | 56 | Complete |
| Already compliant/invoker-only | 11 | No change required |
| Custom overlays migrated | 21 | Complete |
| Remaining custom-overlay files | 24 | Open |

## Principal overlays migrated

| Surface | Source | Coverage |
|---|---|---|
| Authentication modal | `client/src/components/AuthModal.tsx` | Initial focus, Tab/Shift+Tab containment, Escape, opener restoration |
| QR scanner | `client/src/components/QrScanner.tsx` | Dialog semantics, close-button focus, containment, Escape, opener restoration |
| Pro upgrade modal | `client/src/components/ProUpgradeModal.tsx` | Portal-safe containment, Escape, opener restoration |
| Player profile sheet | `client/src/components/PlayerProfileSheet.tsx` | Sheet semantics, close-button focus, containment, Escape, opener restoration |

These surfaces use `client/src/hooks/useAccessibleOverlay.ts`, which is stack-aware so only the topmost custom overlay responds to keyboard dismissal and focus cycling.

## Director operational overlays migrated

`AnnounceModal.tsx`, `CheckInAnnounceModal.tsx`, `CutoffOverrideModal.tsx`, `EditPlayerModal.tsx`, `GameResultModal.tsx`, `PairingSwapModal.tsx`, `ShareResultsModal.tsx` including its nested QR projection, `SwissPhaseSummaryModal.tsx`, and `tournament/QuadsDirectorPanel.tsx`.

## Participant and gameplay overlays migrated

`ChessLineViewer.tsx`, `FilmGameSheet.tsx`, `FullScreenClock.tsx`, `NotationModeOverlay.tsx`, `QRModal.tsx`, `RegisterGameModal.tsx`, `SpectatorQRScreen.tsx`, and `SpectatorShareModal.tsx`.

## Already compliant or invoker-only

`AvatarCropModal.tsx`, `ManusDialog.tsx`, `ui/alert-dialog.tsx`, `ui/command.tsx`, `ui/dialog.tsx`, `ui/drawer.tsx`, `ui/sheet.tsx`, `ui/sidebar.tsx`, `Home.tsx`, `OpeningsAdmin.tsx`, and `VideoRecorder.tsx`.

## Remaining custom-overlay backlog

The following files still require migration or a dedicated interaction audit before the global “No keyboard trap in any modal or drawer” checklist item can be closed:

`ArchivePasswordModal.tsx`, `AvatarNavDropdown.tsx`, `ClubMeetupWizard.tsx`, `ClubShareModal.tsx`, `ContactOwnerModal.tsx`, `CreateClubAuthGate.tsx`, `CreateClubWizard.tsx`, `CreateLeagueWizard.tsx`, `EditClubDetailsModal.tsx`, `InstallBanner.tsx`, `TiebreakTooltip.tsx`, `TournamentWizard.tsx`, `club/ClubPromoModal.tsx`, `club/ClubQRProjectionModal.tsx`, `BroadcastConsole.tsx`, `BroadcastControl.tsx`, `ChessClock.tsx`, `ClubDashboard.tsx`, `ClubProfile.tsx`, `Director.tsx`, `Join.tsx`, `MyClubs.tsx`, `PlayerView.tsx`, and `RepertoireBuilder.tsx`.

## Acceptance criteria for each remaining migration

Each modal surface must expose dialog semantics and an accessible name, place initial focus inside itself, contain forward and reverse Tab navigation while open, dismiss with Escape when safe, restore focus to its opener, and retain a visible close or cancel route. Menus and non-modal popovers should use the corresponding accessible primitive rather than modal focus containment.
