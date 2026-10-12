# Cadence roadmap

Cadence is built spec-first with [GitHub Spec Kit](https://github.com/github/spec-kit). Each feature below becomes a folder under `specs/`.

## Decisions

| Item | Decision |
|---|---|
| Process | GitHub Spec Kit (`specify`), Claude Code integration |
| Language | TypeScript (strict) |
| License | Apache-2.0, `Copyright 2026 Abhishek Sao` (LICENSE + NOTICE) |
| Bundle ID | `io.github.abhisheksao.cadence` (Android + iOS) |
| Git | `main` = releases (tagged), `develop` = integration; one branch/PR per spec off `develop` |
| Builds | Local only (Gradle APK), no EAS |

## Steps

1. **Scaffold**: `create-expo-app` (blank-typescript, SDK 57), `git init`, `specify init --here --ai claude`, LICENSE/NOTICE, README, CONTRIBUTING, `.gitignore` (android/, ios/, keystores, .env), carry over AGENTS.md/CLAUDE.md.
2. **Constitution** (`/speckit.constitution`):
   - Screen-off reliability: foreground service + wall-clock timing
   - Audio ducks music, never pauses it
   - Local builds only, no EAS/cloud
   - CNG: native config only via app.json/plugins
   - Android-first, iOS-ready
   - Offline, no analytics, on-device data only
   - TypeScript strict; lint + typecheck + tests pass before done
   - Every PR traces to a spec
3. **Per feature**: specify → clarify → plan (reviewed) → tasks → implement → lint/typecheck/tests → local APK → on-device test → PR.
4. **Publish**: scan for secrets and personal paths, create the public GitHub repo, push, tag the first release.

## Specs

| # | Spec | Scope |
|---|---|---|
| 001 | Cue engine & background session | wall-clock engine, foreground service, TTS + beeps, audio ducking, sounds, expo-router shell |
| 002 | Morning routine | editable timed/untimed steps, 1-min/10-s warnings, 3-s beeps, Done |
| 003 | Run / walk | warm-up, rounds, cool-down, "ends in 5…1" countdown |
| 004 | Breathe | presets (4-7-8, 3-4-7, 4-4-4, box, coherent), custom, beep or count aloud |
| 005 | Tests & CI | engine tests on a fake clock, RNTL tests, Maestro end-to-end test (screen off), GitHub Actions lint/typecheck/test/APK, release APKs on tag, spec-link check |
| 006 | Native foreground service | custom Kotlin Expo Module replacing react-native-background-actions; notification pause/skip |
| 007 | Workout DSL & sharing | text format parser/validator, import/export, `cadence://` deep links |
| 008 | iOS | silent-audio keep-alive + Live Activities (Swift widget via config plugin); see `ios-live-activities.md` |

Ongoing: ADRs in `docs/adr/` (no EAS, CNG, foreground service vs alarms, OnePlus kills), README with demo GIF + architecture diagram, issue/PR templates, Conventional Commits, Renovate/Dependabot.

Roadmap only (not now): Wear OS haptics, SQLite history/stats, i18n cues, Health Connect/HealthKit, F-Droid listing.
