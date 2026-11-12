<script lang="ts">
  // Reading the voice text aloud, one paragraph at a time. The paragraph to read is large, the
  // next one waits dimmed below it. A take is counted in, recorded, listened to and accepted
  // or done again; a file can stand in for the microphone. The keyboard does all of it.
  import { onDestroy, tick } from 'svelte';
  import Icon from '../Icon.svelte';
  import { filmClock, t } from '../i18n';
  import { canRecord, record, type Recording } from '../home/recorder';
  import { call } from '../home/session';
  import {
    AUDIO_FILES,
    countdown,
    microphoneProblem,
    typing,
    type ScriptParagraph,
    type VoiceState,
  } from './capture';
  import LevelMeter from './LevelMeter.svelte';

  export let voice: VoiceState;
  /** Takes the state every change returns. */
  export let onvoice: (next: VoiceState) => void;
  /** Back to the film. */
  export let onclose: () => void;

  /** A little of the room before the first word, so the clean-up has silence to measure. */
  const LEAD_SECONDS = 0.25;
  const microphone = canRecord();

  let phase: 'idle' | 'counting' | 'recording' | 'saving' = 'idle';
  let count = 0;
  let recording: Recording | null = null;
  let giveUp: AbortController | null = null;
  /** Where in the recording the countdown ended. */
  let startedAt = 0;
  let seconds = 0;
  let clock: ReturnType<typeof setInterval> | undefined;
  let problem = '';
  let player: HTMLAudioElement;
  let playing = false;
  let paragraphFile: HTMLInputElement;
  let wholeFile: HTMLInputElement;
  /** What a screen reader hears about the take. */
  let said = '';

  $: script = voice.script!;
  $: paragraphs = script.paragraphs;
  /** The paragraph in front: the first one still to record, until the user picks another. */
  let picked: number | null = null;
  $: current =
    paragraphs.find((p) => p.paragraph === picked) ??
    paragraphs.find((p) => p.state !== 'accepted') ??
    paragraphs[paragraphs.length - 1];
  $: index = paragraphs.indexOf(current);
  $: following = paragraphs[index + 1] ?? null;
  $: busy = phase !== 'idle';
  // A new take waits to be accepted; an accepted one can be heard again.
  $: review = !busy && !!current.draft;
  $: heard = current.draft ?? current.accepted;
  $: notes = heard?.notes ?? [];

  function go(to: number) {
    if (busy) return;
    const next = paragraphs[Math.max(0, Math.min(paragraphs.length - 1, to))];
    silence();
    problem = '';
    picked = next.paragraph;
  }

  async function begin() {
    if (busy || !microphone) return;
    silence();
    problem = '';
    phase = 'counting';
    count = 0;
    const stop = new AbortController();
    giveUp = stop;
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
    startedAt = opened.elapsed();
    seconds = 0;
    phase = 'recording';
    said = $t('voice.recording');
    clock = setInterval(() => (seconds = opened.elapsed() - startedAt), 250);
  }

  async function finish() {
    if (phase !== 'recording' || !recording) return;
    clearInterval(clock);
    const taken = recording;
    recording = null;
    phase = 'saving';
    try {
      const audio = await taken.stop(Math.max(0, startedAt - LEAD_SECONDS));
      await save(audio, current);
    } catch (cause) {
      problem = cause instanceof Error ? cause.message : String(cause);
    } finally {
      phase = 'idle';
    }
  }

  /** Escape: stops a countdown or a take. False when there was nothing to stop. */
  export function escape(): boolean {
    if (phase !== 'counting' && phase !== 'recording') return false;
    cancel();
    return true;
  }

  /** Stops a countdown or a take without keeping anything. */
  function cancel() {
    clearInterval(clock);
    giveUp?.abort();
    recording?.discard();
    recording = null;
    phase = 'idle';
    said = $t('voice.cancelled');
  }

  async function save(audio: Blob, paragraph: ScriptParagraph) {
    onvoice(await call<VoiceState>(`/api/voice/paragraph/${paragraph.paragraph}`, 'POST', audio));
    picked = paragraph.paragraph;
    said = $t('voice.recorded');
  }

  async function upload(input: HTMLInputElement, whole: boolean) {
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    silence();
    problem = '';
    phase = 'saving';
    try {
      if (whole) {
        onvoice(await call<VoiceState>('/api/voice/whole', 'POST', file));
        picked = paragraphs[0].paragraph;
        said = $t('voice.wholeDone', { count: paragraphs.length });
      } else await save(file, current);
    } catch (cause) {
      problem = cause instanceof Error ? cause.message : String(cause);
    } finally {
      phase = 'idle';
    }
  }

  async function accept() {
    if (!review) return;
    silence();
    const done = current.paragraph;
    try {
      const next = await call<VoiceState>(`/api/voice/paragraph/${done}/accept`);
      onvoice(next);
      // On to the next paragraph that still needs a voice; the last one stays in front.
      picked = next.script?.paragraphs.find((p) => p.state !== 'accepted')?.paragraph ?? done;
      said = $t('voice.accepted');
    } catch (cause) {
      problem = cause instanceof Error ? cause.message : String(cause);
    }
  }

  /** Throws the new take away and counts in the next one. */
  async function redo() {
    if (busy) return;
    silence();
    if (current.draft) {
      try {
        onvoice(await call<VoiceState>(`/api/voice/paragraph/${current.paragraph}`, 'DELETE'));
      } catch (cause) {
        problem = cause instanceof Error ? cause.message : String(cause);
        return;
      }
    }
    await tick();
    void begin();
  }

  function listen() {
    if (!heard || busy) return;
    if (playing) return silence();
    const draft = current.draft ? '?draft=1&' : '?';
    // The file keeps its name through a new take: the length tells the two apart.
    player.src = `/api/voice/paragraph/${current.paragraph}/audio${draft}v=${heard.seconds}-${Date.now()}`;
    void player.play().catch(() => (playing = false));
  }

  function silence() {
    if (!player) return;
    player.pause();
    playing = false;
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
      else if (phase === 'idle' && !review) act(() => void begin());
      else if (review) act(listen);
      return;
    }
    if (busy) return;
    if (event.key === 'Enter' && review) act(() => void accept());
    else if (event.key.toLowerCase() === 'r' && heard) act(() => void redo());
    else if (event.key.toLowerCase() === 'l' && heard) act(listen);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') act(() => go(index + 1));
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') act(() => go(index - 1));
  }

  onDestroy(() => {
    clearInterval(clock);
    giveUp?.abort();
    recording?.discard();
  });
</script>

<svelte:window {onkeydown} />

<div class="voice-prompter">
  <nav class="voice-steps" aria-label={$t('voice.paragraphs')}>
    {#each paragraphs as paragraph, at (paragraph.paragraph)}<button
        class="voice-step"
        class:current={paragraph === current}
        class:done={paragraph.state === 'accepted'}
        aria-current={paragraph === current ? 'step' : undefined}
        aria-label={$t(`voice.step.${paragraph.state}`, { number: paragraph.paragraph })}
        title={$t(`voice.step.${paragraph.state}`, { number: paragraph.paragraph })}
        disabled={busy}
        onclick={() => go(at)}
        >{#if paragraph.state === 'accepted'}<Icon
            name="check"
            size={16}
          />{:else}{paragraph.paragraph}{/if}</button
      >{/each}
    <span class="voice-steps-count"
      >{$t('voice.progress', { recorded: script.recorded, total: script.total })}</span
    >
  </nav>

  <div
    class="voice-reading"
    class:live={phase === 'recording'}
    class:waiting={phase === 'counting'}
  >
    {#key current.paragraph}
      <p class="voice-line">{current.text}</p>
      {#if following}<p class="voice-line next" aria-hidden="true">{following.text}</p>{/if}
    {/key}
    {#if current.state === 'stale' && !current.draft}<p class="voice-note">
        {$t('voice.stale')}
      </p>{/if}
  </div>

  <div class="voice-dock">
    {#if problem}<p class="voice-problem" role="alert">
        <Icon name="alert" /><span>{problem}</span>
      </p>{/if}
    {#if notes.length && !busy}<p class="voice-note">
        {notes.map((note) => $t(`voice.note.${note}`)).join(' ')}
      </p>{/if}
    <LevelMeter level={recording ? () => recording!.level() : null} />
    <div class="voice-controls">
      {#if phase === 'counting' || phase === 'recording'}
        <button class="voice-record live" onclick={phase === 'recording' ? finish : cancel}
          >{#if phase === 'counting'}<span class="voice-count" aria-hidden="true"
              >{count || ''}</span
            >{:else}<span class="voice-stop" aria-hidden="true"></span>{/if}<span class="sr-only"
            >{$t(phase === 'recording' ? 'voice.stop' : 'voice.cancel')}</span
          ></button
        >
        <span class="voice-status"
          >{phase === 'counting' ? $t('voice.getReady') : filmClock(seconds)}</span
        >
      {:else if phase === 'saving'}
        <span class="voice-status"><span class="loader small"></span>{$t('voice.saving')}</span>
      {:else if review}
        <button class="button" onclick={listen}
          ><Icon name={playing ? 'pause' : 'play'} />{$t(
            playing ? 'voice.listenStop' : 'voice.listen',
          )}</button
        >
        <button class="button" onclick={redo}><Icon name="refresh" />{$t('voice.redo')}</button>
        <button class="button primary" onclick={accept}
          ><Icon name="check" />{$t('voice.accept')}</button
        >
      {:else}
        {#if heard}<button class="button" onclick={listen}
            ><Icon name={playing ? 'pause' : 'play'} />{$t(
              playing ? 'voice.listenStop' : 'voice.listen',
            )}</button
          >{/if}
        <button
          class="button"
          class:primary={!script.complete}
          disabled={!microphone}
          onclick={heard ? redo : begin}
          ><Icon name="mic" />{$t(heard ? 'voice.again' : 'voice.record')}</button
        >
        {#if script.complete}<button class="button primary" onclick={onclose}
            >{$t('voice.backToFilm')}</button
          >{/if}
      {/if}
    </div>
    <p class="voice-keys" aria-hidden="true">
      {#if phase === 'recording'}{$t('voice.keys.recording')}{:else if phase === 'counting'}{$t(
          'voice.keys.counting',
        )}{:else if review}{$t('voice.keys.review')}{:else}{$t('voice.keys.idle')}{/if}
    </p>
    <p class="voice-fine">
      {#if script.complete}<strong>{$t('voice.complete')}</strong>{/if}
      {#if !microphone}{$t('voice.noMicrophone')}{/if}
      {script.timing === 'measured'
        ? $t('voice.privacy.measured', { model: script.transcription ?? '' })
        : $t('voice.privacy.estimated')}
      {#if script.source !== 'own'}{$t('voice.notOwn')}{/if}
    </p>
    <p class="voice-files">
      <button class="text-link" disabled={busy} onclick={() => paragraphFile.click()}
        >{$t('voice.fileParagraph')}</button
      >
      <button class="text-link" disabled={busy} onclick={() => wholeFile.click()}
        >{$t('voice.fileWhole')}</button
      >
    </p>
    <input
      bind:this={paragraphFile}
      type="file"
      accept={AUDIO_FILES}
      hidden
      onchange={() => upload(paragraphFile, false)}
    />
    <input
      bind:this={wholeFile}
      type="file"
      accept={AUDIO_FILES}
      hidden
      onchange={() => upload(wholeFile, true)}
    />
    <audio
      bind:this={player}
      onplaying={() => (playing = true)}
      onended={() => (playing = false)}
      onpause={() => (playing = false)}
    ></audio>
    <span class="sr-only" role="status" aria-live="polite">{said}</span>
  </div>
</div>
