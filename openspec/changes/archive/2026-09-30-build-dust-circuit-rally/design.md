# Design

## Context
The required template is generated into this repository; app root stays project-name per AGENTS. Server v0.6.0 provides isolated racing, 30Hz simulation, 20Hz snapshots and fresh reconnect. Original Blender assets have been exported, reimported and reviewed in the actual game.

## Goals / Non-Goals
Goals: full readable landscape circuit, responsive arcade handling, coherent original assets, online and offline shared rules. Non-goals: persistent progression, private rooms, full rigid-body wheels or extra tracks.

## Decisions
- Render Blender GLBs through Babylon Lite WebGPU with a locked orthographic camera. Match exported track geometry to the versioned shared route/terrain definition.
- Keep app layers separate: input, view, sound and session controller. Online prediction replays unacknowledged local controls against authoritative snapshots. Remote trucks interpolate without camera motion.
- Local/solo use released RacingSimulation; distinct keyboard layouts and dynamically joined gamepads. Online uses existing MultiplayerClient and exact release tarball.
- Preserve four template corner UI roles. Warm charcoal shell, ochre accents, landscape arena with an uncluttered HUD, waiting/results overlays and external touch controls.
- Use synthesized original Web Audio sounds, no external licensed audio.

## Risks / Trade-offs
- GPU/browser availability: actionable initialization error and explicit verification limits.
- Blender assets: use the configured official MCP and reviewed bounded windowless runner. Preserve editable parts while merging export copies by material. Opt into mirrored meshes and shadow scene registration in Lite. Continuous sampled terrain avoids folded strips at tight curves.
- Hosting lifetime: short independent races with visible fresh reconnect; no offline fallback for online mode.
- No physical gamepads available to automation: test mappings synthetically and report physical hardware as unverified.

## Migration Plan
Build/test and browser-verify before game release; use existing Actions Pages/release flows. Pin backend/client 0.6.0 and version.txt source of truth. Preserve source template provenance and original prompt.
