# Club Profile Navigation Visibility QA

## Visitor navigation

The public The OTB Club profile was reviewed at desktop and 375px widths while the account presented the **Join** action. Both the desktop rail and mobile navigation omit direct Album and League destinations for visitors, leaving Home, Feed, Events, and Members as the stable core destinations. The contextual Feed and Events actions remain the visitor pathways to the public Album and League experiences.

## Member policy

The centralized `clubProfileNavigationTabs` policy returns Album and Leagues only for joined members. Focused regressions cover both direct member visibility and visitor omission, and prevent the desktop rail and mobile navigation from drifting apart.
