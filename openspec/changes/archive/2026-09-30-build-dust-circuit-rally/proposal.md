# Proposal

## Why
Create a replayable original arcade off-road racer with a landscape view, readable whole-circuit action and shared online racing.

## What Changes
- Build Copper Basin with original Blender vehicles, terrain, props and pickups.
- Integrate released authoritative server v0.6.0 and reusable offline rules.
- Add online, local 2–4 and solo modes, independent keyboard/gamepad/touch controls, effects, audio, HUD and recovery states.
- Verify full races, publish a release and GitHub Pages game, then sync and archive.

## Capabilities
### New Capabilities
- `arcade-racing`: landscape presentation, controls, modes and full race loop.
### Modified Capabilities
None.

## Impact
Template app remains project-name; Babylon Lite WebGPU and exact shared-client v0.6.0 dependency. Racing support was released and verified in backend v0.6.0; public compatibility is also tested against the newer shared server. Original Blender source, scoped GLBs and real previews are generated, reimported and reviewed. Release v0.0.3 and its Pages deployment are live.
