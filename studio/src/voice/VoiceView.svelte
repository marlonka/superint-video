<script lang="ts">
  // The user's own voice, over the editor: reading the voice text aloud paragraph by paragraph,
  // or speaking over the finished picture. Needs no API key; the recordings stay in the film's
  // folder.
  import { onMount } from 'svelte';
  import Icon from '../Icon.svelte';
  import { t } from '../i18n';
  import type { Project } from '../types';
  import type { VoiceState } from './capture';
  import SpeakOver from './SpeakOver.svelte';
  import Teleprompter from './Teleprompter.svelte';

  export let project: Project;
  /** The frame the editor stands on. */
  export let frame = 0;
  export let onclose: () => void;

  type Mode = 'read' | 'over';
  let voice: VoiceState | null = null;
  let failed = '';
  /** What the user chose; before that, reading when there is a text to read. */
  let chosen: Mode | null = null;
  let part: { escape: () => boolean } | undefined;

  $: mode = chosen ?? (voice?.script ? 'read' : 'over');

  async function load() {
    try {
      const response = await fetch('/api/voice');
      if (!response.ok) throw new Error($t('common.failed', { status: response.status }));
      voice = await response.json();
      failed = '';
    } catch (cause) {
      failed = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    // Escape first stops a take; with nothing running it leaves.
    if (!part?.escape()) onclose();
  }

  onMount(() => {
    void load();
    // The coding agent may change the text while this is open.
    const again = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  });
</script>

<svelte:window {onkeydown} />

<div class="voice-layer" role="dialog" aria-modal="true" aria-labelledby="voice-title">
  <header class="app-header">
    <button class="button quiet" onclick={onclose}
      ><Icon name="arrowLeft" /><span>{$t('voice.backToFilm')}</span></button
    >
    <h1 id="voice-title" class="voice-title">{$t('voice.title')}</h1>
    <div class="header-actions">
      <button class="button quiet" aria-pressed={mode === 'read'} onclick={() => (chosen = 'read')}
        >{$t('voice.mode.read')}</button
      >
      <button class="button quiet" aria-pressed={mode === 'over'} onclick={() => (chosen = 'over')}
        >{$t('voice.mode.over')}</button
      >
    </div>
  </header>
  <main class="voice-page">
    {#if failed}
      <p class="voice-empty" role="alert">{failed}</p>
    {:else if !voice}
      <p class="voice-empty"><span class="loader"></span></p>
    {:else if mode === 'over'}
      <SpeakOver
        bind:this={part}
        {voice}
        onvoice={(next) => (voice = next)}
        manifest={project.manifest}
        previewUrl={project.previewUrl}
        startFrame={frame}
      />
    {:else if voice.script?.paragraphs.length}
      <Teleprompter bind:this={part} {voice} onvoice={(next) => (voice = next)} {onclose} />
    {:else}
      <div class="voice-empty">
        <h2>{$t('voice.noScript.title')}</h2>
        <p>{voice.problem ?? $t('voice.noScript.why')}</p>
        <button class="button" onclick={() => (chosen = 'over')}>{$t('voice.mode.over')}</button>
      </div>
    {/if}
  </main>
</div>
