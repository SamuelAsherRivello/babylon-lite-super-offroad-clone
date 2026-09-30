# Arcade Racing Specification

## Purpose
Provide a readable original fixed-camera off-road racer playable online, locally or in solo practice.

## Requirements

### Requirement: Landscape course presentation
The game SHALL show the full Copper Basin circuit from a fixed elevated orthographic camera in a 16:9 landscape viewport. Original Blender assets SHALL include four numbered truck variants, articulated rigid wheels, terrain, tabletop jump, washboard, mud, shortcut, prop kit and two pickup types. Narrow displays SHALL retain the entire course.

#### Scenario: Resize during race
- **WHEN** the viewport becomes narrow
- **THEN** the landscape course remains visible without camera following, rotation or zoom toward a truck

### Requirement: Play modes and controls
The game SHALL provide online four-human racing, local 2–4 shared-screen racing and offline solo practice with AI fillers. Keyboard, multiple gamepads and concurrent touch controls SHALL support steering, acceleration, brake/reverse, nitro and recovery. Online pause SHALL clear only local inputs; local pause SHALL stop the simulation.

#### Scenario: Local simultaneous input
- **WHEN** two humans use independent keyboard controls
- **THEN** both trucks respond independently in the same race

#### Scenario: Online interruption
- **WHEN** connection is lost
- **THEN** the game shows recovery status and rejoins with a fresh identity without promising retained progress

### Requirement: Full race loop and delivery
The game SHALL implement waiting/ready, countdown, three-lap racing, authoritative online standings/results, pickups and replay using the released shared racing rules. Audio SHALL begin after interaction and support mute/volume. Unsupported WebGPU or asset initialization SHALL show actionable errors. Delivery SHALL include editable sources, actual gameplay evidence and verified public game/backend versions.

#### Scenario: Replay
- **WHEN** a race completes and players ready again
- **THEN** the next race resets the grid, nitro and temporary effects with equal base performance
