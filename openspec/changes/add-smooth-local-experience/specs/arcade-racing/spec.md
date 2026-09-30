# Spec Delta

## MODIFIED Requirements

### Requirement: Play modes and controls
The game SHALL provide online four-human racing, local 2–4 shared-screen racing and offline solo practice with AI fillers. Keyboard, multiple gamepads and concurrent touch controls SHALL support steering, acceleration, brake/reverse, nitro and recovery. Online pause SHALL clear only local inputs; local pause SHALL stop the simulation. During online racing, the controlled truck SHALL respond immediately to local controls and smoothly converge from small authoritative corrections without changing server-owned race state. Large corrections, recovery, roster changes and race-phase transitions SHALL take effect immediately.

#### Scenario: Local simultaneous input
- **WHEN** two humans use independent keyboard controls
- **THEN** both trucks respond independently in the same race

#### Scenario: Online interruption
- **WHEN** connection is lost
- **THEN** the game shows recovery status and rejoins with a fresh identity without promising retained progress

#### Scenario: Small authoritative correction
- **WHEN** an online snapshot differs slightly from the predicted controlled-truck state
- **THEN** the local truck moves continuously toward the authoritative result while the server remains the source of race state

#### Scenario: Large correction
- **WHEN** recovery, a phase transition, roster change or a materially divergent authoritative state arrives
- **THEN** the controlled truck immediately uses the authoritative position and state
