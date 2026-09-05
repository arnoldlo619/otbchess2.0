import type { ReactNode } from "react";

import { clubProfileNavigationTabs, type ClubProfileTabId } from "@/lib/clubProfileNavigation";

type ClubProfileNavigationItemsProps = {
  joined: boolean;
  children: (tab: ClubProfileTabId) => ReactNode;
};

/** Shared tab policy for the Club Profile desktop rail and mobile navigation. */
export function ClubProfileNavigationItems({ joined, children }: ClubProfileNavigationItemsProps) {
  return <>{clubProfileNavigationTabs(joined).map(children)}</>;
}
