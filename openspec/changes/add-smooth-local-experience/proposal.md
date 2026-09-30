# Proposal

## Why

The online controlled truck visibly jumps whenever an authoritative snapshot replaces the locally predicted state, while remote trucks are already visually smoothed. The game needs local correction presentation that feels as continuous as the remote-player experience without weakening server authority.

## What Changes

- Add render-only smoothing for small authoritative corrections to the online local truck.
- Preserve immediate visual response to local input and snap safely for large corrections, recovery, grid changes, and phase transitions.
- Add deterministic checks for correction convergence and latency-impaired online play.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `arcade-racing`: Online local-player presentation will smoothly reconcile small authoritative corrections while retaining server-owned race outcomes.

## Impact

- Affects `project-name/src/main.js` prediction/reconciliation and the existing view presentation boundary.
- Extends browser verification for delayed and dropped online messages.
- Does not change the shared client protocol, racing server, collision rules, race standings, or dependencies.
