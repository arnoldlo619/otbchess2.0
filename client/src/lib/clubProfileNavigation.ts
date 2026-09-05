export const MEMBER_CLUB_PROFILE_TABS = ["home", "feed", "events", "members", "album", "leagues"] as const;
export const VISITOR_CLUB_PROFILE_TABS = ["home", "feed", "events", "members"] as const;

export type ClubProfileTabId = (typeof MEMBER_CLUB_PROFILE_TABS)[number];

/** Keeps desktop rail and mobile navigation aligned with the member access model. */
export function clubProfileNavigationTabs(joined: boolean): readonly ClubProfileTabId[] {
  return joined ? MEMBER_CLUB_PROFILE_TABS : VISITOR_CLUB_PROFILE_TABS;
}
