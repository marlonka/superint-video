<script lang="ts">
  // Speaking instead of typing. While the user speaks, a waveform shows that the microphone
  // hears them; when they are done, the model of their API key writes it down and the text goes
  // into the field where the cursor was. Escape or the cross throws the recording away.
  import { onDestroy, tick } from 'svelte';
  import Icon from '../Icon.svelte';
  import { filmClock, t } from '../i18n';
  import type { Dictation } from '../types';
  import { MicrophoneError, canRecord, record, type Recording } from './recorder';
  import { announce, call, fail } from './session';

  /** An API key is there to write the recording down with. */
  export let available: boolean;
  /** Takes the written text. */
  export let oninsert: (text: string) => void;
  /** A recording is running or being written down; the field waits meanwhile. */
  export let active = false;

  /** The longest recording. It is written down when it gets there. The server takes up to ten
   * minutes, so a recording that arrives a little late still fits. */
  const MOST_SECONDS = 300;
  /** Shorter than this is a slip of the finger, not a sentence (the server refuses below 0.2 s). */
  const LEAST_SECONDS = 0.5;
  /** One bar of the waveform stands for this long, and is this wide with this gap. */
  const BAR_MS = 70;
  const BAR = 3;
  const GAP = 2;

  const supported = canRecord();
  let phase: 'idle' | 'starting' | 'recording' | 'writing' = 'idle';
  let recording: Recording | null = null;
  let controller: AbortController | null = null;
  let seconds = 0;
  /** The loudest moment of each bar so far, oldest first. */
  let levels: number[] = [];
  let peak = 0;
  let barAt = 0;
  let frame = 0;
  let canvas: HTMLCanvasElement | undefined;
  /** One button starts and ends a recording, so it never moves and focus stays on it. */
  let mic: HTMLButtonElement | undefined;
  /** The waveform's colour, and the phase it was read for. */
  let ink = '';
  let inkFor = '';
  /** The last thing a screen reader heard about the dictation. */
  let said = '';

  $: active = phase !== 'idle';
  $: spoken =
    phase === 'recording'
      ? $t('dictate.listening')
      : phase === 'writing'
        ? $t('dictate.writing')
        : said;

  async function begin() {
    if (phase !== 'idle' || !available) return;
    phase = 'starting';
    levels = [];
    seconds = 0;
    peak = 0;
    said = '';
    await tick();
    draw();
    let started: Recording;
    try {
      started = await record();
    } catch (cause) {
      phase = 'idle';
      fail(problem(cause));
      return;
    }
    // Thrown away while the browser was still asking for the microphone.
    if (phase !== 'starting') return started.discard();
    recording = started;
    phase = 'recording';
    await tick();
    mic?.focus();
    barAt = performance.now();
    frame = requestAnimationFrame(listen);
  }

  function listen(now: number) {
    if (phase !== 'recording' || !recording) return;
    peak = Math.max(peak, recording.level());
    // One bar per step of time, also when the browser drew fewer frames (a window in the
    // background): the waveform keeps the length of the recording.
    const due = Math.floor((now - barAt) / BAR_MS);
    if (due > 0) {
      for (let bar = Math.min(due, 60); bar > 0; bar--) levels.push(peak);
      if (levels.length > 1200) levels.splice(0, levels.length - 1200);
      peak = 0;
      barAt += due * BAR_MS;
    }
    const elapsed = recording.elapsed();
    // The clock shows whole seconds: the page changes once a second, not with every frame.
    if (Math.floor(elapsed) !== Math.floor(seconds)) seconds = elapsed;
    if (elapsed >= MOST_SECONDS) {
      void finish();
      return;
    }
    draw();
    frame = requestAnimationFrame(listen);
  }

  async function finish() {
    if (phase !== 'recording' || !recording) return;
    cancelAnimationFrame(frame);
    const taken = recording;
    recording = null;
    const length = taken.elapsed();
    phase = 'writing';
    await tick();
    draw();
    let audio: Blob;
    try {
      audio = await taken.stop();
    } catch (cause) {
      return stopWith(() => fail(cause));
    }
    if (length < LEAST_SECONDS) return stopWith(() => announce($t('dictate.tooShort')));
    const asking = new AbortController();
    controller = asking;
    try {
      const result = await call<Dictation>('/api/app/dictate', 'POST', audio, asking.signal);
      if (asking.signal.aborted) return;
      const text = result.text.trim();
      if (!text) return stopWith(() => announce($t('dictate.empty')));
      phase = 'idle';
      said = $t('dictate.written', { model: result.model });
      oninsert(text);
    } catch (cause) {
      if (!asking.signal.aborted) stopWith(() => fail(cause));
    } finally {
      if (controller === asking) controller = null;
    }
  }

  /** Back to the button, saying why nothing was written. */
  function stopWith(tell: () => void) {
    phase = 'idle';
    tell();
    void tick().then(() => mic?.focus());
  }

  /** Throws the recording away, or the answer that is still on its way. */
  function discard() {
    if (phase === 'idle') return;
    cancelAnimationFrame(frame);
    recording?.discard();
    recording = null;
    controller?.abort();
    controller = null;
    phase = 'idle';
    said = $t('dictate.discarded');
    void tick().then(() => mic?.focus());
  }

  function problem(cause: unknown): string {
    if (cause instanceof MicrophoneError) {
      return cause.problem === 'other'
        ? $t('dictate.problem.other', { detail: cause.message })
        : $t(`dictate.problem.${cause.problem}`);
    }
    return cause instanceof Error ? cause.message : String(cause);
  }

  /** The waveform: the newest bar on the right, older ones moving left, dots before the start. */
  function draw() {
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const pen = canvas.getContext('2d');
    if (!pen) return;
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen.clearRect(0, 0, width, height);
    // The colour follows the phase (CSS); it is read again only when the phase changes.
    if (inkFor !== phase) {
      ink = getComputedStyle(canvas).color;
      inkFor = phase;
    }
    pen.fillStyle = ink;
    const step = BAR + GAP;
    const count = Math.max(1, Math.floor((width + GAP) / step));
    const left = width - count * step + GAP;
    const first = levels.length - count;
    for (let slot = 0; slot < count; slot++) {
      const level = levels[first + slot];
      const heard = level !== undefined;
      const tall = heard ? Math.max(BAR, level * height) : 2;
      pen.globalAlpha = heard ? 1 : 0.35;
      pen.beginPath();
      pen.roundRect(left + slot * step, (height - tall) / 2, BAR, tall, BAR / 2);
      pen.fill();
    }
    pen.globalAlpha = 1;
  }

  function onkeydown(event: KeyboardEvent) {
    if (phase !== 'idle' && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      discard();
    }
  }

  onDestroy(() => {
    cancelAnimationFrame(frame);
    recording?.discard();
    controller?.abort();
  });
</script>

<svelte:window {onkeydown} onresize={draw} />

{#if supported}
  <div class="dictate" class:active>
    {#if active}
      <button
        class="icon-button"
        aria-label={$t('dictate.discard')}
        title={$t('dictate.discard')}
        onclick={discard}><Icon name="close" /></button
      >
      <canvas
        class="dictate-wave"
        class:writing={phase !== 'recording'}
        aria-hidden="true"
        bind:this={canvas}
      ></canvas>
      <span class="dictate-time"
        >{#if phase === 'writing'}{$t('dictate.writing')}{:else if phase === 'starting'}{$t(
            'dictate.starting',
          )}{:else}{filmClock(seconds)}{/if}</span
      >
    {:else if !available}
      <span class="dictate-hint">{$t('dictate.needsKey')}</span>
    {/if}
    <button
      bind:this={mic}
      class="dictate-mic"
      class:live={phase === 'recording'}
      class:writing={phase === 'writing'}
      aria-label={$t(phase === 'recording' ? 'dictate.done' : 'dictate.start')}
      title={phase === 'recording'
        ? $t('dictate.done')
        : available && phase === 'idle'
          ? $t('dictate.startHint')
          : undefined}
      disabled={!available || phase === 'starting' || phase === 'writing'}
      onclick={phase === 'recording' ? finish : begin}
      >{#if phase === 'writing'}<span class="loader small"></span>{:else}<Icon
          name="mic"
        />{/if}</button
    >
    <span class="sr-only" role="status" aria-live="polite">{spoken}</span>
  </div>
{/if}
