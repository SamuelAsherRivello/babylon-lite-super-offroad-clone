# Delivery status — 2026-09-30

The approved Dust Circuit Rally prompt is implemented with the user's 16:9 landscape requirement. The normal production URL uses original Blender GLBs. Public release verification is in progress; client finalization remains open until it passes.

## Verified implementation

- Released authoritative backend/client v0.6.0, 23 server regressions, typecheck, package checks, strict specs and public health/live integration verification. Exact release artifact is pinned in the client dependency and lockfile.
- Editable Blender 5.2.2 LTS source, representative truck/tabletop prototype, genuine full-course render, nine scoped GLBs and final reimport audit. Actual engine frames were inspected and the acceptance manifest marked reviewed afterward.
- Full solo/local/online race results with real production GLBs. Verification ran on Node 24.19.0, Chrome WebGPU, 11:20:49–11:24:30 UTC. Solo completed in 60.47 seconds with the human finishing three laps at 49.50 seconds; both local humans finished at 49.97/55.50 seconds. Online reached synchronized results at 71.07 seconds; both test humans completed two laps and were correctly ranked DNF behind AI finishers.
- Static camera, full-course framing, pause/replay, keyboard input/focus release, original synthesized audio and mute/volume controls. Portrait emulation preserves landscape; 844 × 390 landscape emulation fits without scrolling.
- Concurrent emulated touch gas/steer/nitro and cancellation. Two keyboard racers plus two virtual controllers filled the four-human local grid with independent simultaneous motion; controller disconnect released input.
- WebSocket shim imposed 150 ms delay each direction and dropped six input frames. Authoritative motion continued, focus released controls, and transport interruption rejoined with a fresh identity.
- Three client unit tests, reviewed asset check and production build pass; no page errors in completed suites.

## Performance and limits

Actual asset solo/local browser races averaged 50.66/52.57 FPS on this workstation, with transient lower samples. Running two WebGPU browser contexts concurrently averaged 20.06 FPS. A smaller emulated landscape viewport measured approximately 60 FPS. These are automated workstation measurements; physical mobile hardware and physical gamepads remain untested. Virtual gamepad verification covers bindings/admission/input, not hardware compatibility.

One initial online lobby wait timed out; two independent connection probes and the full subsequent race succeeded with a correctly configured 60-second startup allowance. Online play uses the existing in-memory host; interrupted sessions may reset and progress is not durable. Reconnect is fresh admission. No persistent progression or private/mixed local-online rooms are provided.

## Template and specification decisions

GitHub template generation follows the creator skill and AGENTS.md over the checklist's conflicting manual-copy history instruction. project-name/ remains the Vite application root per AGENTS.md. Version data and all four corner roles are retained. OpenSpec 1.13.1 reports a healthy project root. Backend accepted spec was synced and archived as 2026-09-30-add-dust-circuit-rally; client change build-dust-circuit-rally awaits public verification and sync/archive.

Evidence: browser-verification.json, input-network-verification.json, actual game screenshots, ../artwork/reimport-audit.json and ../artwork/asset-review.md.
