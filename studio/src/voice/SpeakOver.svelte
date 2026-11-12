<script lang="ts">
  // Speaking over the finished picture. The film plays without its sound from a chosen point
  // while the user talks; the take is listened to against the picture, done again or kept.
  // Kept, it is the voice of the film from that point on. One take at a time.
  import { onDestroy, onMount } from 'svelte';
  import Icon from '../Icon.svelte';
  import { filmClock, t } from '../i18n';
  import { canRecord, record, type Recording } from '../home/recorder';
  import { announce, call } from '../home/session';
  import type { Manifest } from '../types';
  import { countdown, microphoneProblem, typing, type VoiceState } from './capture';
  import LevelMeter from './LevelMeter.svelte';

  export let voice: VoiceState;
  export let onvoice: (next: VoiceState) => void;
  export let manifest: Manifest;
  /** Where the film's own preview is served. */
  export let previewUrl: string;
  /** The frame the editor stood on: the take starts there unless the user moves. */
  export let startFrame = 0;

  const microphone = canRecord();
  const origin = new URL(previewUrl).origin;

  let film: HTMLIFrameElement;
  let stage: HTMLDivElement;
  let scale = 0.2;
  let ready = false;
  let frame = startFrame;
  let playing = false;
  /** Called with every state the film reports. */
  let watch: ((at: number, plays: boolean) => void) | null = null;

  let phase: 'idle' | 'counting' | 'recording' | 'saving' | 'listening' = 'idle';
  let count = 0;
  let recording: Recording | null = null;
  let giveUp: AbortController | null = null;
  /** The frame the running take began on, and where in the recording the film started. */
  let from = startFrame;
  let filmStartedAt = 0;
  let problem = '';
  let player: HTMLAudioElement;

  $: fps = manifest.fps.num / manifest.fps.den;
  $: last = manifest.durationFrames - 1;
  $: busy = phase !== 'idle';
  $: review = phase === 'idle' && !!voice.over;
  $: notes = voice.over?.notes ?? [];
  $: cues = voice.cues.filter((cue) => cue.seconds !== null) as {
    paragraph: number;
    text: string;
    seconds: number;
  }[];
  // The paragraph the film is in, for the cue that is due.
  $: due = [...cues].reverse().find((cue) => cue.seconds <= frame / fps + 0.05)?.paragraph;

  function send(action: 'seek' | 'play' | 'pause', extra: Record<string, unknown> = {}) {
    film?.contentWindow?.postMessage({ source: 'superint-studio', action, ...extra }, origin);
  }

  function onmessage(event: MessageEvent) {
    if (event.source !== film?.contentWindow || event.origin !== origin) return;
    const data = event.data;
    if (!data || data.source !== 'superint-player') return;
    if (data.type === 'ready') {
      ready = true;
      send('seek', { frame });
    }
    if (data.type !== 'state') return;
    if (Number.isFinite(data.frame)) frame = Math.max(0, Math.min(last, Math.round(data.frame)));
    if (typeof data.playing === 'boolean') playing = data.playing;
    watch?.(frame, playing);
  }

  /** Puts the film on a frame and waits until it stands there. */
  function seek(to: number): Promise<void> {
    const target = Math.max(0, Math.min(last, Math.round(to)));
    return new Promise((resolve) => {
      const timer = setTimeout(done, 800);
      function done() {
        clearTimeout(timer);
        watch = null;
        resolve();
      }
      watch = (at, plays) => at === target && !plays && done();
      frame = target;
      send('seek', { frame: target });
    });
  }

  /** Starts the picture alone and resolves once it runs; false when it did not. */
  function roll(): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => settle(false), 6000);
      function settle(runs: boolean) {
        clearTimeout(timer);
        watch = null;
        resolve(runs);
      }
      watch = (_, plays) => plays && settle(true);
      send('play', { silent: true });
    });
  }

  async function begin() {
    if (busy || !microphone || !ready) return;
    problem = '';
    phase = 'counting';
    count = 0;
    const stop = new AbortController();
    giveUp = stop;
    from = frame;
    await seek(from);
    let opened: Recording;
    try {
      opened = await record('narration');
    } catch (cause) {
      phase = 'idle';
      problem = microphoneProblem(cause, $t);
      return;
    }
    if (stop.signal.aborted) return opened.discard();
    recording = opened;
    if (!(await countdown((left) => (count = left), stop.signal))) return;
    if (!(await roll()) || stop.signal.aborted) {
      if (!stop.signal.aborted) {
        cancel();
        problem = $t('over.filmStuck');
      }
      return;
    }
    // The message that the film runs comes a moment after it started; the frames it already
    // played say how long ago that was.
    filmStartedAt = Math.max(0, opened.elapsed() - Math.max(0, frame - from) / fps);
    phase = 'recording';
    // The film ends the take when it runs out.
    watch = (_, plays) => !plays && void finish();
  }

  async function finish() {
    if (phase !== 'recording' || !recording) return;
    watch = null;
    send('pause');
    const taken = recording;
    recording = null;
    phase = 'saving';
    try {
      const audio = await taken.stop(filmStartedAt);
      onvoice(await call<VoiceState>(`/api/voice/over?frame=${from}`, 'POST', audio));
      await seek(from);
    } catch (cause) {
      problem = cause instanceof Error ? cause.message : String(cause);
    } finally {
      phase = 'idle';
    }
  }

  /** Escape: stops a countdown, a take or the listening. False when nothing was running. */
  export function escape(): boolean {
    if (phase === 'listening') quiet();
    else if (phase === 'counting' || phase === 'recording') cancel();
    else return false;
    return true;
  }

  function cancel() {
    giveUp?.abort();
    watch = null;
    recording?.discard();
    recording = null;
    send('pause');
    phase = 'idle';
  }

  /** The take against the picture: the film without its sound, the take over it. */
  async function listen() {
    if (phase === 'listening') return quiet();
    if (!review || !voice.over) return;
    phase = 'listening';
    await seek(voice.over.startFrame);
    player.src = `/api/voice/over/audio?v=${voice.over.seconds}-${Date.now()}`;
    if (!(await roll())) return quiet();
    void player.play().catch(quiet);
  }

  function quiet() {
    if (phase !== 'listening') return;
    player.pause();
    send('pause');
    phase = 'idle';
  }

  async function redo() {
    if (!review || !voice.over) return;
    const again = voice.over.startFrame;
    try {
      onvoice(await call<VoiceState>('/api/voice/over', 'DELETE'));
      await seek(again);
      void begin();
    } catch (cause) {
      problem = cause instanceof Error ? cause.message : String(cause);
    }
  }

  async function keep() {
    if (!review || !voice.over) return;
    const at = filmClock(voice.over.startFrame / fps);
    try {
      onvoice(await call<VoiceState>('/api/voice/over/keep'));
      announce($t('over.kept', { time: at }));
    } catch (cause) {
      problem = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || typing(event) || event.ctrlKey || event.metaKey || event.altKey)
      return;
    const act = (work: () => void) => {
      event.preventDefault();
      work();
    };
    if (event.key === ' ') {
      if (phase === 'recording') act(() => void finish());
      else if (phase === 'listening') act(quiet);
      else if (review) act(() => void listen());
      else if (phase === 'idle') act(() => void begin());
      return;
    }
    if (busy) return;
    if (event.key === 'Enter' && review) act(() => void keep());
    else if (event.key.toLowerCase() === 'r' && review) act(() => void redo());
    else if (event.key === 'ArrowRight' && !review) act(() => void seek(frame + fps));
    else if (event.key === 'ArrowLeft' && !review) act(() => void seek(frame - fps));
  }

  onMount(() => {
    window.addEventListener('message', onmessage);
    const fit = new ResizeObserver(() => {
      scale = Math.min(stage.clientWidth / manifest.width, stage.clientHeight / manifest.height);
    });
    fit.observe(stage);
    return () => {
      window.removeEventListener('message', onmessage);
      fit.disconnect();
    };
  });
  onDestroy(() => {
    giveUp?.abort();
    recording?.discard();
  });
</script>

<svelte:window {onkeydown} />

<div class="voice-over">
  <div class="voice-over-film">
    <div
      class="voice-over-stage"
      style={`aspect-ratio:${manifest.width}/${manifest.height}`}
      bind:this={stage}
    >
      <div
        class="voice-over-frame"
        style={`width:${manifest.width * scale}px;height:${manifest.height * scale}px`}
      >
        <iframe
          bind:this={film}
          src={new URL('/player.html', previewUrl).href}
          title={$t('preview.frameTitle')}
          allow="autoplay"
          sandbox="allow-scripts allow-same-origin"
          style={`width:${manifest.width}px;height:${manifest.height}px;transform:scale(${scale})`}
        ></iframe>
        {#if phase === 'counting' && count}{#key count}<span
              class="voice-over-count"
              aria-hidden="true">{count}</span
            >{/key}{/if}
      </div>
    </div>
    <div class="voice-over-place">
      <span class="timecode">{filmClock(frame / fps)}</span>
      <input
        type="range"
        min="0"
        max={last}
        value={frame}
        disabled={busy || review || !ready}
        aria-label={$t('over.place')}
        oninput={(event) => void seek(Number(event.currentTarget.value))}
      />
      <span class="timecode">{filmClock(manifest.durationFrames / fps)}</span>
    </div>
  </div>

  {#if cues.length}<ol class="voice-over-cues" aria-label={$t('over.cues')}>
      {#each cues as cue (cue.paragraph)}<li class:due={cue.paragraph === due}>
          <button
            disabled={busy || review}
            title={$t('over.cueJump')}
            onclick={() => void seek(cue.seconds * fps)}
            ><span class="timecode">{filmClock(cue.seconds)}</span><span>{cue.text}</span></button
          >
        </li>{/each}
    </ol>{/if}

  <div class="voice-dock">
    {#if problem}<p class="voice-problem" role="alert">
        <Icon name="alert" /><span>{problem}</span>
      </p>{/if}
    {#if notes.length && review}<p class="voice-note">
        {notes.map((note) => $t(`voice.note.${note}`)).join(' ')}
      </p>{/if}
    <LevelMeter level={recording ? () => recording!.level() : null} />
    <div class="voice-controls">
      {#if phase === 'counting' || phase === 'recording'}
        <button class="voice-record live" onclick={phase === 'recording' ? finish : cancel}
          ><span class="voice-stop" aria-hidden="true"></span><span class="sr-only"
            >{$t(phase === 'recording' ? 'voice.stop' : 'voice.cancel')}</span
          ></button
        >
        <span class="voice-status"
          >{phase === 'counting' ? $t('voice.getReady') : $t('over.speaking')}</span
        >
      {:else if phase === 'saving'}
        <span class="voice-status"><span class="loader small"></span>{$t('voice.saving')}</span>
      {:else if review || phase === 'listening'}
        <button class="button" onclick={listen}
          ><Icon name={phase === 'listening' ? 'pause' : 'play'} />{$t(
            phase === 'listening' ? 'voice.listenStop' : 'over.listen',
          )}</button
        >
        <button class="button" disabled={phase === 'listening'} onclick={redo}
          ><Icon name="refresh" />{$t('voice.redo')}</button
        >
        <button class="button primary" disabled={phase === 'listening'} onclick={keep}
          ><Icon name="check" />{$t('over.keep')}</button
        >
      {:else}
        <button class="button primary" disabled={!microphone || !ready} onclick={begin}
          ><Icon name="mic" />{$t('over.record', { time: filmClock(frame / fps) })}</button
        >
      {/if}
    </div>
    <p class="voice-keys" aria-hidden="true">
      {#if phase === 'recording'}{$t('voice.keys.recording')}{:else if phase === 'counting'}{$t(
          'voice.keys.counting',
        )}{:else if review}{$t('over.keys.review')}{:else if phase === 'idle'}{$t(
          'over.keys.idle',
        )}{/if}
    </p>
    <p class="voice-fine">
      {#if !microphone}{$t('voice.noMicrophone')}{/if}
      {$t('over.how')}
    </p>
    <audio bind:this={player} onended={quiet}></audio>
  </div>
</div>
