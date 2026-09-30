export class RallySound {
  constructor() {
    this.volume = 0.25;
    this.muted = false;
    this.lastEvent = -1;
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.engine = this.context.createOscillator();
      this.engine.type = "sawtooth";
      this.engine.frequency.value = 45;
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engine.start();
    }
    await this.context.resume();
  }
  setVolume(v) {
    this.volume = v;
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : v,
        this.context.currentTime,
        0.05,
      );
  }
  mute(v) {
    this.muted = v;
    this.setVolume(this.volume);
  }
  tone(frequency, duration = 0.12, type = "sine") {
    if (!this.context || this.context.state !== "running") return;
    const t = this.context.currentTime,
      o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(30, frequency * 0.6),
      t + duration,
    );
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(t + duration);
  }
  update(state, player, paused) {
    const speed = player ? Math.hypot(player.vx, player.vz) : 0;
    if (this.context) {
      const t = this.context.currentTime;
      this.engine.frequency.setTargetAtTime(
        38 + speed * 7 + (player?.boosting ? 40 : 0),
        t,
        0.08,
      );
      this.engineGain.gain.setTargetAtTime(
        state?.phase === "racing" && !paused ? 0.035 : 0,
        t,
        0.08,
      );
      if (player && state.phase === "racing" && !paused) {
        const old = this.previous;
        if (old?.id === player.id) {
          if (player.boosting && !old.boosting) this.tone(170, 0.2, "sawtooth");
          if (player.grounded && !old.grounded) this.tone(65, 0.14, "triangle");
          if (old.speed - speed > 3) this.tone(80, 0.1, "square");
          const slip = Math.abs(
            player.vx * Math.cos(player.angle) -
              player.vz * Math.sin(player.angle),
          );
          if (slip > 3 && t > (this.nextSkid || 0)) {
            this.tone(130, 0.06, "sawtooth");
            this.nextSkid = t + 0.2;
          }
        }
        this.previous = { ...player, speed };
      } else this.previous = null;
    }
    if (state?.phase === "countdown") {
      const count = Math.ceil(state.countdown);
      if (count !== this.lastCount) this.tone(440, 0.1);
      this.lastCount = count;
    } else this.lastCount = null;
    if (state?.event.serial !== this.lastEvent) {
      this.lastEvent = state?.event.serial;
      if (state?.event.text.includes("collected"))
        this.tone(680, 0.18, "triangle");
      else if (state?.event.text === "GO!") this.tone(880, 0.3);
      else if (state?.phase === "results") this.tone(520, 0.5, "triangle");
      else if (state?.event.text.includes("recovered"))
        this.tone(100, 0.2, "square");
    }
  }
  dispose() {
    void this.context?.close();
  }
}
