<script lang="ts">
  // The header's Update button, there while a newer version is out, and the panel it opens: the
  // new version, what is new in it, and the one action this copy has, to update itself or to
  // download. The version beside the name opens the same panel at any time.
  import { onDestroy } from 'svelte';
  import Icon from '../Icon.svelte';
  import { format, t } from '../i18n';
  import type { MessageKey } from '../i18n/types';
  import type { Overview } from '../types';
  import {
    busy,
    checkUpdate,
    installUpdate,
    refresh,
    skipUpdate,
    updateOpen,
    updating,
  } from './session';

  export let overview: Overview;

  /** What this copy does with a new version, by how it came onto the computer. */
  const HINTS: Record<Overview['update']['kind'], MessageKey> = {
    installed: 'update.hint.installed',
    portable: 'update.hint.portable',
    dev: 'update.hint.dev',
    mac: 'update.hint.mac',
  };

  let panel: HTMLElement;
  let toggle: HTMLButtonElement | undefined;
  let now = Date.now();

  $: update = overview.update;
  $: available = update.available;
  $: offered = !!available && !available.skipped;
  $: progress = update.progress;
  $: renders = update.busy.filter((film) => film.what === 'render');
  $: working = update.busy.filter((film) => film.what !== 'render');
  $: canInstall = update.canInstall && !!available && !available.failed;
  $: percent =
    progress?.phase === 'downloading' && progress.total
      ? $format.percent((progress.received ?? 0) / progress.total)
      : '';
  $: hint = available?.failed ? ('update.hint.failed' as const) : HINTS[update.kind];

  // While an update runs, the page asks more often, so the download moves.
  let quick: ReturnType<typeof setInterval> | undefined;
  $: if (progress && !quick) quick = setInterval(() => void refresh(), 700);
  $: if (!progress && quick) {
    clearInterval(quick);
    quick = undefined;
  }
  onDestroy(() => clearInterval(quick));
  // When the update is over, the page says how it went; the panel has done its part.
  let hadProgress = false;
  $: {
    if (hadProgress && !progress) updateOpen.set(false);
    hadProgress = !!progress;
  }

  function published(at: string | null) {
    const moment = at ? Date.parse(at) : NaN;
    return Number.isNaN(moment) ? '' : $t('update.published', { date: $format.date(moment) });
  }
  function close() {
    updateOpen.set(false);
    (toggle ?? document.querySelector<HTMLElement>('.app-version'))?.focus();
  }
  function key(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }
  /** The panel's title has the focus when it opens, so a screen reader starts there. */
  function focusTitle(node: HTMLElement) {
    now = Date.now();
    queueMicrotask(() => node.focus());
  }
  async function install() {
    await installUpdate();
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    const target = event.target as Element;
    if ($updateOpen && !panel?.contains(target) && !target.closest('.app-version, .update-button'))
      updateOpen.set(false);
  }}
/>

{#if offered && available}<button
    bind:this={toggle}
    class="button quiet labelled update-button"
    title={$t('update.buttonTitle', { version: available.version })}
    aria-haspopup="dialog"
    aria-expanded={$updateOpen}
    onclick={() => updateOpen.update((open) => !open)}
    ><Icon name="update" /><span>{$t('update.button')}</span><span
      class="production-indicator"
      aria-hidden="true"
    ></span></button
  >{/if}

{#if $updateOpen}
  <div
    class="update-panel"
    role="dialog"
    aria-labelledby="update-title"
    tabindex="-1"
    bind:this={panel}
    onkeydown={key}
  >
    <header class="update-head">
      <div>
        <h2 id="update-title" tabindex="-1" use:focusTitle>
          {available ? $t('update.title', { version: available.version }) : $t('update.dialog')}
        </h2>
        {#if available?.publishedAt}<p class="update-meta">
            {published(available.publishedAt)}
          </p>{/if}
      </div>
      <button class="icon-button" aria-label={$t('common.close')} onclick={close}
        ><Icon name="close" /></button
      >
    </header>

    {#if available}
      <!-- The notes scroll when they are long; the actions below them stay in view. -->
      <div class="update-body">
        {#if available.notes.length}<div class="update-notes">
            {#each available.notes as note, index (index)}
              {#if note.kind === 'heading'}<h3>{note.text}</h3>
              {:else if note.kind === 'item'}<p class="update-item">{note.text}</p>
              {:else}<p>{note.text}</p>{/if}
            {/each}
          </div>{/if}
        <a class="text-link update-all" href={available.url} target="_blank" rel="noreferrer"
          >{$t('update.allChanges')}<Icon name="external" size={16} /></a
        >
      </div>

      <div class="update-foot">
        {#if progress}
          <div class="update-progress" role="status">
            <span
              >{progress.phase === 'downloading'
                ? $t('update.downloading', { percent })
                : progress.phase === 'installing'
                  ? $t('update.installing')
                  : $t('update.preparing')}</span
            >
            {#if progress.phase === 'downloading' && progress.total}<progress
                max={progress.total}
                value={progress.received ?? 0}
              ></progress>{/if}
          </div>
        {:else}
          {#if canInstall && renders.length}<p class="update-busy">
              {$t('update.busyRender', { name: renders[0].name })}
            </p>{:else if canInstall && working.length}<p class="update-busy">
              {$t('update.busyRunning', { name: working[0].name })}
            </p>{/if}
          <div class="update-actions">
            {#if canInstall}<button
                class="button primary"
                disabled={update.busy.length > 0 || $busy === 'update-install' || $updating}
                onclick={install}>{$t('update.install')}</button
              >{:else}<a
                class="button primary"
                href={available.url}
                target="_blank"
                rel="noreferrer"
                onclick={() => updateOpen.set(false)}
                ><Icon name="download" />{$t('update.download')}</a
              >{/if}
            {#if !available.skipped}<button
                class="text-link"
                disabled={$busy === 'update-skip'}
                onclick={() => available && skipUpdate(available.version)}
                >{$t('update.skip')}</button
              >{/if}
          </div>
          <p class="update-hint">{$t(hint)}</p>
        {/if}
      </div>
    {:else}
      <p>{$t('update.current', { version: update.current })}</p>
      <p class="update-meta">
        {update.checkedAt
          ? $t('update.checked', { when: $format.ago(update.checkedAt, now) })
          : $t('update.neverChecked')}
        {#if !update.checks}{$t('update.off')}{/if}
      </p>
      <div class="update-actions">
        <button
          class="button"
          disabled={$busy === 'update-check'}
          onclick={() => checkUpdate().then(() => (now = Date.now()))}
          ><Icon name="refresh" />{$busy === 'update-check'
            ? $t('update.checking')
            : $t('update.checkNow')}</button
        >
      </div>
    {/if}
  </div>
{/if}
