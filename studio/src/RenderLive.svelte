<script lang="ts">
  // A render shown while it runs: the frame being made, how far it is, and the film at the end.
  import Icon from './Icon.svelte';
  import { filmClock, format, t, type MessageKey } from './i18n';
  import type { LiveRender } from './types';

  export let render: LiveRender;
  export let onclose: () => void;
  export let onopen: () => void;

  let shown = '';
  let loaded: number | null = null;
  let pinned: number | null = null;
  let strip: HTMLElement | undefined;
  let lastStrip = 0;
  let videoFailed = false;

  const STOPPED: Record<string, MessageKey> = {
    lost: 'render.lost',
    cancelled: 'render.cancelled',
  };

  $: running = render.status === 'running';
  $: finished = render.status === 'completed';
  $: share = render.total ? Math.min(1, render.completed / render.total) : 0;
  $: fps = render.fps || 30;
  $: if (render.latestFrame != null && render.latestFrame !== loaded)
    showLatest(render.latestFrame);
  $: if (render.strip.length !== lastStrip) followStrip(render.strip.length);
  $: picture = pinned !== null ? `/api/live/strip/${pinned}` : shown;
  $: soundLevel = render.result?.audio?.integratedLufs;
  // Platforms play films at about -14 LUFS and turn louder ones down.
  $: loudness =
    typeof soundLevel !== 'number'
      ? ''
      : $t(
          soundLevel > -13
            ? 'render.loudness.louder'
            : soundLevel < -15.5
              ? 'render.loudness.quieter'
              : 'render.loudness.right',
        );
  $: progress = { done: render.completed, total: render.total };

  function showLatest(value: number) {
    loaded = value;
    const url = `/api/live/latest?frame=${value}`;
    const image = new Image();
    // Swap only when decoded, so the picture never flashes empty.
    image.onload = () => (shown = url);
    image.src = url;
  }
  function followStrip(count: number) {
    lastStrip = count;
    const element = strip;
    if (!element) return;
    const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 140;
    if (atEnd) requestAnimationFrame(() => (element.scrollLeft = element.scrollWidth));
  }
  const filmTime = (frame: number) => filmClock(frame / fps);
  /** A stretch of time in the units every language shares: "1 h 05 min", "12 min", "40 s". */
  function span(seconds: number) {
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
    return minutes ? `${minutes} min` : `${total} s`;
  }
</script>

<div class="render-live" aria-label={$t('render.label')}>
  <div class="render-picture">
    {#if finished && !videoFailed && render.outputInProject}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        controls
        preload="metadata"
        src={`/api/live/video?t=${render.finishedAt}`}
        onerror={() => (videoFailed = true)}
      ></video>
    {:else if picture}
      <img src={picture} alt={$t('render.frame', { frame: pinned ?? render.latestFrame ?? 0 })} />
      {#if pinned !== null}<button class="button render-back" onclick={() => (pinned = null)}
          >{$t('render.backToLive')}</button
        >{/if}
    {:else}
      <div class="preview-loading">
        <span class="loader"></span><span>{render.stage}</span>
      </div>
    {/if}
  </div>

  <div class="render-info" role="status" aria-live="off">
    {#if running}
      <div class="render-headline">
        <strong>{$t('state.rendering', { percent: $format.percent(share) })}</strong>
        <span>{$t('render.frames', progress)}</span>
        <span
          >{$t('render.filmTime', {
            done: filmTime(render.completed),
            total: filmTime(render.total),
          })}</span
        >
        {#if render.framesPerSecond}<span
            >{$t('render.speed', { value: $format.number(render.framesPerSecond, 2) })}</span
          >{/if}
        {#if render.etaSeconds != null}<span class="render-eta"
            >{$t('render.eta', {
              span: span(render.etaSeconds),
              time: $format.clock(render.updatedAt + render.etaSeconds * 1000),
            })}</span
          >{:else}<span class="render-eta">{render.stage}</span>{/if}
      </div>
      <progress max="1" value={share}></progress>
    {:else if finished}
      <div class="render-headline">
        <strong><Icon name="check" size={18} /> {$t('state.filmReady')}</strong>
        <span>{$t('render.minutes', { time: filmTime(render.total) })}</span>
        {#if render.finishedAt}<span
            >{$t('render.took', {
              span: span((render.finishedAt - render.startedAt) / 1000),
            })}</span
          >{/if}
        {#if typeof soundLevel === 'number'}<span title={$t('render.loudnessHint')}
            >{$t('render.loudness', {
              value: $format.number(soundLevel, 1),
              verdict: loudness,
            })}</span
          >{/if}
        <span class="render-path">{render.output}</span>
      </div>
      {#if videoFailed}<p class="field-note">{$t('render.cannotPlay')}</p>{/if}
      <div class="render-actions">
        <button class="button primary" onclick={onopen}
          ><Icon name="external" />{$t('export.open')}</button
        >
        <button class="button" onclick={onclose}>{$t('render.backToTimeline')}</button>
      </div>
    {:else}
      <div class="render-headline">
        <strong>{$t(STOPPED[render.status] ?? 'render.failed')}</strong>
        <span>{$t('render.stoppedAt', progress)}</span>
      </div>
      {#if render.status === 'lost'}<p class="field-note">{$t('render.lostNote')}</p>{/if}
      {#if render.error}<p class="render-error">{render.error}</p>{/if}
      <div class="render-actions">
        <button class="button" onclick={onclose}>{$t('render.backToTimeline')}</button>
      </div>
    {/if}
  </div>

  {#if render.strip.length}
    <div class="render-strip" bind:this={strip} aria-label={$t('render.strip')}>
      {#each render.strip as value (value)}
        <button
          class:chosen={pinned === value}
          title={$t('render.filmTimeAt', { time: filmTime(value) })}
          onclick={() => (pinned = pinned === value ? null : value)}
          ><img loading="lazy" src={`/api/live/strip/${value}`} alt={filmTime(value)} /></button
        >
      {/each}
    </div>
  {/if}
</div>
