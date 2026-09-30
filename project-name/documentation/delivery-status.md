# Delivery status — 2026-09-30

The approved prompt is being executed with the user’s explicit 16:9 landscape requirement. This is a playable development graybox, not finished Blender artwork or a released game.

## Completed

- Shared authoritative four-truck racing backend and browser-safe track/simulation.
- Released client/backend v0.6.0; complete 23-test server regressions, typecheck, package-content check, strict specifications, public health/version and live integration verification.
- Exact released tarball pinned in client dependency/lockfile.
- Solo, local two-keyboard, online shared admission, readiness, frozen grid, results and replay.
- Keyboard/gamepad mappings, independent input, emulated concurrent touch, focus release, local pause and neutral online pause.
- 16:9 course framing and fixed camera; desktop and mobile landscape settings fit without scroll.
- Browser races reached results in about 60 seconds offline and 70 seconds online. Both local humans completed three laps. The online test humans completed two laps and were correctly ranked DNF behind AI finishers.
- Native browser WebSocket test with 150 ms delays both ways and six intentionally dropped input frames: authoritative motion continued, focus released input, and reconnect produced a fresh identity.
- Three client unit tests, production build, real WebGPU graybox screenshots, and no observed page errors in completed checks.
- Graybox measured about 60 FPS in headless Chrome; this is not final-asset or physical-device performance.
- Backend accepted specification synced to `openspec/specs/dust-racing/spec.md`; archived change `2026-09-30-add-dust-circuit-rally`. Upstream documentation edits safely merged without rewriting history.

## Required before final delivery

1. Restore the configured official Blender MCP connection at 127.0.0.1:9876. Its read-only scene query was unreachable. No auxiliary Blender process or replacement server was launched.
2. Execute scoped asset construction, refine genuine gameplay-camera previews against the target, save editable `.blend`, scoped GLBs, reimport and verify in Babylon Lite. The prepared script is not evidence of generated assets.
3. Measure final artwork performance, review missing details, and set `reviewedInEngine` only after actual inspection. The asset acceptance script deliberately blocks Release and Pages until then.
4. Release/deploy the game, verify the public client against released backend, synchronize checkout, sync/archive the client OpenSpec change, and finish template delivery gate.

Physical gamepads, real mobile hardware, and final GLB imports remain unverified. The automated gamepad checks cover mapping only. AI fillers are server controlled, and in-memory hosting resets do not preserve race progress.

## Template decisions

GitHub template generation follows the creator skill and AGENTS.md rather than the checklist’s conflicting manual-copy history instruction. `project-name/` stays the application root per AGENTS.md. Version data and four corner roles are preserved. Placeholder README content was replaced; the canonical screenshot is explicitly labeled graybox. The checklist remains open until final delivery; no cleanup is requested while acceptance is incomplete.

The final game release and public URL have not been claimed. Client change `build-dust-circuit-rally` remains active with Blender and public delivery tasks open. Final complete browser run: 2026-09-30 10:12:59–10:16:42 UTC, all included assertions passed and no page errors. Node 24.19.0 ran the verification scripts. The online test reached results with two humans marked DNF; it does not claim those humans completed three laps.
