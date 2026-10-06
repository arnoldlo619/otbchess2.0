export const TOURNAMENT_WIZARD_ACTIVE_KEY = "otb-tournament-wizard-active-v1";
export const TOURNAMENT_WIZARD_ACTIVITY_EVENT = "otb:tournament-wizard-activity";

function notifyTournamentWizardActivity() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOURNAMENT_WIZARD_ACTIVITY_EVENT));
  }
}

export function isTournamentWizardActive(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.sessionStorage.getItem(TOURNAMENT_WIZARD_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTournamentWizardActive(active: boolean) {
  if (typeof window === "undefined") return;

  try {
    if (active) {
      window.sessionStorage.setItem(TOURNAMENT_WIZARD_ACTIVE_KEY, "1");
    } else {
      window.sessionStorage.removeItem(TOURNAMENT_WIZARD_ACTIVE_KEY);
    }
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }

  notifyTournamentWizardActivity();
}
