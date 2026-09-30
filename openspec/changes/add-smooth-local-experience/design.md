# Design

## Context

See `proposal.md` for the motivation. The online client currently replays unacknowledged inputs onto every received truck snapshot, then passes that replacement position straight to the view. The view already smooths remote truck transforms. The server and shared-client artifact own authoritative simulation and protocol behavior.

## Goals / Non-Goals

**Goals:**

- Keep local input response immediate while making ordinary online reconciliation visually continuous.
- Preserve the current authoritative server result, input sequence acknowledgement and remote rendering behavior.
- Exercise the behavior with controlled delayed and dropped message delivery.

**Non-Goals:**

- Changing vehicle physics, server tick rates, shared-client APIs or race rules.
- Hiding meaningful correction events such as recovery or a major divergence.

## Decisions

### Maintain separate simulation and presentation state

Keep the predicted truck as the input-responsive simulation state. Track a local render transform separately and move it toward the predicted transform at a frame-rate-independent rate. This prevents each snapshot replacement from becoming a visible jump. Reusing the remote smoothing map would conflate a local prediction concern with view-owned remote interpolation.

### Use bounded correction thresholds

Blend normal position and angle differences. Snap presentation state when the error is large or when recovery, roster, identity or phase changes invalidate continuity. A threshold avoids showing a truck travel through barriers or across a reset grid. Exact threshold values are implementation tuning parameters, measured with the existing latency harness.

### Keep authority outside the presentation layer

The rendering offset never feeds back into `pending` input replay, HUD race calculations, sound state, or server messages. Server snapshots continue to replace the prediction baseline and acknowledgements continue to discard processed inputs.

## Risks / Trade-offs

- [Too much smoothing feels delayed] → Keep the presentation target as the already-predicted result, tune convergence with automated latency evidence, and snap material corrections.
- [Visual state survives an invalid transition] → Reset it whenever online identity, phase, local-truck existence or explicit correction conditions change.
- [Test only checks movement] → Record correction bounds and verify that delayed/drop delivery completes without console errors or runaway render offset.

## Migration Plan

The client-only change ships in the next normal Pages release. It is safe to roll back by reverting the presentation-reconciliation code; the server contract and release artifact remain unchanged.
