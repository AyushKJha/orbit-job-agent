# Changelog

## 2026-10-16 · Follow-up repair

- Added the newly supplied 193852 recording as the separate intro and placed the 193740 lamp recording on the login page, with the pull-cord interaction and an illustrated fallback.
- Fixed production static routes for the imported lamp/theme modules and both videos, including byte-range video playback. These missing routes previously prevented the login/app JavaScript from loading and left the visible workspace inert.
- Increased dark-theme surface contrast and strengthened the raised/recessed neumorphic treatment while retaining Ivory as the optional light theme.
- Added HTTP regression coverage for all browser modules and intro-video range requests.

## 2026-10-16

- Added a first-visit Orbit introduction using the supplied muted video, with skip, continue, and replay controls.
- Reworked sign-in as an accessible standing-floor-lamp scene. Pulling the cord reveals Orbit’s existing username/password form; no authentication or account-isolation behavior was replaced.
- Added persistent Midnight and Ivory themes, visible translucent glass surfaces, softened neumorphic controls, reduced-motion support, and a no-backdrop-filter fallback.
- Added focused UI tests for lamp state and keyboard behavior, theme persistence, login validation, and accessibility fallbacks.
