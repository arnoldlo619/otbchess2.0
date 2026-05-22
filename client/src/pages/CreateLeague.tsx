/**
 * CreateLeague page — /league/new
 * Renders the CreateLeagueWizard full-screen overlay.
 * On close/cancel, navigates back to the previous page (or /clubs).
 */
import { useLocation } from "wouter";
import { CreateLeagueWizard } from "@/components/CreateLeagueWizard";

export default function CreateLeaguePage() {
  const [, navigate] = useLocation();

  const handleClose = () => {
    // Go back if there's history, otherwise fall back to clubs
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/clubs");
    }
  };

  return (
    <div className="min-h-screen bg-[oklch(0.12_0.04_145)]">
      <CreateLeagueWizard onClose={handleClose} />
    </div>
  );
}
