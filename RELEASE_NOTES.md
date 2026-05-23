# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-05-16

### Features

- Add Invites tab to AdminPage and prefill signup form from URL params (NEU-188) (#99)
- Add /admin route with Users tab and conditional UserMenu link (NEU-186) (#98)
- Polish Friends tab with nav link, icons, infinite scroll, empty + loading states (NEU-182) (#97)
- Add activity privacy toggles to Settings and ShowDetailPage (NEU-181) (#96)
- Add useFeed hook and minimal /friends page (NEU-179) (#95)
- Surface my-rating across cards and library sort/filter (NEU-172) (#94)
- Show friend ratings on show + episode pages (#93)
- Add half-star rating input on show + episode pages (#92)
- Add 'Download my data' button (NEU-159) (#91)
- Add session revoke + log-out-everywhere controls (NEU-156) (#90)
- Add active-sessions list (NEU-153) (#89)
- Add /forgot-password + /reset-password pages (NEU-147) (#88)
- Add change-email UI + confirm page (NEU-144) (#87)
- Add unverified-email banner + /verify-email landing page (NEU-141) (#86)
- Add /settings page with display-name edit (NEU-150) (#85)

## [2026-05-10] - 2026-05-10

### Bug Fixes

- Disable spellcheck on search inputs (NEU-133) (#80)
- Remove redundant "n/a" tag on disabled options (NEU-132) (#78)
- Disable In My Shows picker on Active tabs (NEU-131) (#77)
- Drop per-show watched fetch in list rows (NEU-100) (#56)
- Hide mobile bottom nav while a text input is focused (#50)
- Send local today on watch-next/upcoming/my-shows requests (#49)

### Features

- Add Seasons and Shows tabs to Upcoming page (NEU-136) (#81)
- Collapse long show/episode/season summaries with toggle (NEU-125) (#79)
- Add caller watch-state filter on friend tabs (NEU-130) (#76)
- Add caller-relative My Library filter on friend tabs (NEU-129) (#75)
- Add caller-relative row indicators on friend lists (NEU-128) (#74)
- Wire FriendProfilePage tabs to shared library views (NEU-127) (#73)
- Align Active and All Watched toolbars (NEU-123) (#71)
- Add To Be Determined filter; rename Upcoming to In Development (NEU-119) (#69)
- Add Upcoming status filter (NEU-118) (#68)
- Align Watched sort picker with Active (NEU-115) (#67)
- Surface friend engagement on show + episode pages (NEU-112) (#66)
- Add Remove from history action on Watched rows (NEU-105) (#65)
- Add Watched row UI with In My Shows quick-toggle (NEU-104) (#64)
- Add Watched sub-tab on MyShowsPage (NEU-103) (#63)
- Add friend profile page (NEU-109) (#62)
- Add blocked list and block actions (NEU-83) (#61)
- Add connections list and remove flow (NEU-82) (#60)
- Add requests inbox with optimistic actions (NEU-81) (#59)
- Add user search + connect flow (NEU-80) (#58)
- Add connections route shell and API client (NEU-79) (#57)
- Fix Last Aired sort and add Newest Unwatched option (#45)

### Refactor

- Extract Library{Active,Watched}List shared components (NEU-126) (#72)
- Polish My Shows + All Watched list rows (#70)

## [2026-05-06] - 2026-05-06

### Bug Fixes

- Hide mobile bottom nav while a text input is focused (#50)
- Send local today on watch-next/upcoming/my-shows requests (#49)

## [2026-05-05] - 2026-05-05

### Features

- Fix Last Aired sort and add Newest Unwatched option (#45)

## [2026-05-04] - 2026-05-05

### Bug Fixes

- Keep overlay open when interacting with filter sheet (#42)
- Keep footer visible above mobile nav and search overlay (#41)
- Stop iOS Safari auto-zoom on search input focus (#39)

### Features

- Link site title back to home (#40)
- Show matched AKA on foreign-titled results (#38)

## [2026-05-03] - 2026-05-03

### Features

- Overhaul show/season/episode pages and add header search (#35)
- Show episode thumbnail with title above row (#34)
- Restructure Watch Next/Upcoming/My Shows with filters and sort (#33)
- Align Upcoming with Watch Next layout and add watch progress bar
- Make Watch Next the home page and overhaul its UI (#25)


