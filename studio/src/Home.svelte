<script lang="ts">
  // The start page: a new film, the styles, the films. Setup is a page of its own, one button in
  // the header away; while something required is missing it is the whole page, so nobody
  // starts a film that cannot be made.
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import Logo from './Logo.svelte';
  import Composer from './home/Composer.svelte';
  import Films from './home/Films.svelte';
  import Setup from './home/Setup.svelte';
  import SetupBanner from './home/SetupBanner.svelte';
  import Styles from './home/Styles.svelte';
  import {
    announce,
    call,
    needs,
    problem,
    reachable,
    refresh,
    run,
    setLanguage,
    setupSkipped,
    skillsBehind,
    skipSetup,
  } from './home/session';
  import { LOCALES, isLocale, locale, t } from './i18n';
  import { theme, toggleTheme } from './theme';
  import type { Film, Overview } from './types';

  export let overview: Overview;
  /** Set when a film is open underneath: the way back to it. */
  export let onclose: (() => void) | null = null;

  const TYPING = 'textarea, input:not([type="checkbox"], [type="radio"])';
  const openedAt = Date.now();
  const followed = new Set<string>();
  let now = Date.now();
  let page: HTMLElement;

  $: missing = needs(overview);
  // Setup is the page while something required is missing, and stays so after the last step
  // until the user moves on: finishing it does not pull the page away.
  let welcoming = false;
  $: if (missing.length > 0 && !$setupSkipped) welcoming = true;
  $: gate = welcoming && !$setupSkipped;
  /** Setup opened from the header. */
  let setupOpen = false;
  // Something in Setup wants a look: a missing part, or skills older than the app.
  $: attention = missing.length > 0 || skillsBehind(overview.setup).length > 0;
  $: if (!overview.project || onclose) document.title = 'Superint Video';

  /** Opens a film: the editor underneath when it is this one, its own Studio otherwise. */
  function openFilm(film: Film) {
    if (film.current && onclose) return onclose();
    void run(`film-${film.id}`, async () => {
      const result = await call<{ url: string }>(`/api/app/films/${film.id}/open`);
      location.href = result.url;
    });
  }
  /** A film the coding agent just began is shown without anyone clicking. */
  function follow(next: Overview) {
    if (!next.settings.follow) return;
    const film = next.films.find(
      (item) =>
        item.exists && !item.current && item.createdAt > openedAt - 1500 && !followed.has(item.id),
    );
    if (!film) return;
    followed.add(film.id);
    announce($t('films.new', { name: film.name }));
    openFilm(film);
  }
  async function poll(fresh = false) {
    const next = await refresh(fresh);
    if (next) follow(next);
  }
  function finishSetup() {
    skipSetup(false);
    page?.scrollTo({ top: 0 });
  }
  function toggleSetup(open = !setupOpen) {
    setupOpen = open;
    page?.scrollTo({ top: 0 });
  }
  /** From the finished Setup to the first film. */
  function moveOn() {
    welcoming = false;
    setupOpen = false;
    page?.scrollTo({ top: 0 });
  }
  /** Escape leaves Setup, else goes back to the film; not while someone types, so nothing
   * typed is lost to a stray key. */
  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (event.target instanceof Element && event.target.matches(TYPING)) return;
    if (setupOpen && !gate) toggleSetup(false);
    else if (onclose) onclose();
  }

  onMount(() => {
    const titleBefore = document.title;
    void poll();
    const timer = setInterval(() => {
      now = Date.now();
      // A hidden page asks rarely: nobody is looking at what the answer would change.
      if (document.visibilityState === 'visible' || Date.now() % 15000 < 3000) void poll();
    }, 3000);
    const visible = () => document.visibilityState === 'visible' && void poll();
    document.addEventListener('visibilitychange', visible);
    // Held for as long as this page is open: it tells the app that somebody will come back,
    // also while the page is hidden and the browser slows its timers. It connects again by
    // itself, so it is also the first to know that the app is back.
    const held = new EventSource('/api/app/open');
    held.onopen = () => void poll();
    return () => {
      held.close();
      clearInterval(timer);
      document.title = titleBefore;
      document.removeEventListener('visibilitychange', visible);
    };
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="home">
  <header class="app-header">
    <span class="wordmark"><Logo /><small class="app-version">{overview.version}</small></span>
    <div class="header-actions">
      {#if onclose}<button class="button" onclick={onclose}
          ><Icon name="arrowLeft" /><span
            >{overview.project?.name
              ? $t('home.back', { name: overview.project.name })
              : $t('home.backToFilm')}</span
          ></button
        >{/if}
      {#if !gate}<button
          class="button quiet labelled"
          aria-pressed={setupOpen}
          title={$t('setup.title')}
          onclick={() => toggleSetup()}
          ><Icon name="settings" /><span>{$t('setup.title')}</span>{#if attention}<span
              class="production-indicator"
              aria-hidden="true"
            ></span>{/if}</button
        >{/if}
      <label class="language-select" title={$t('language.label')}
        ><Icon name="globe" /><span class="sr-only">{$t('language.label')}</span><select
          value={$locale}
          onchange={(event) =>
            isLocale(event.currentTarget.value) && setLanguage(event.currentTarget.value)}
          >{#each LOCALES as entry (entry.code)}<option value={entry.code}>{entry.name}</option
            >{/each}</select
        ></label
      >
      <button
        class="icon-button"
        aria-label={$t($theme === 'dark' ? 'theme.toLight' : 'theme.toDark')}
        title={$t($theme === 'dark' ? 'theme.toLight' : 'theme.toDark')}
        onclick={toggleTheme}><Icon name={$theme === 'dark' ? 'sun' : 'moon'} /></button
      >
    </div>
  </header>

  <main class="home-page" bind:this={page}>
    {#if !$reachable}<div class="home-problem" role="alert">
        <Icon name="alert" /><span>{$t('common.unreachable')}</span>
      </div>{:else if $problem}<div class="home-problem" role="alert">
        <Icon name="alert" /><span>{$problem}</span><button
          class="icon-button"
          aria-label={$t('common.dismiss')}
          onclick={() => problem.set('')}><Icon name="close" /></button
        >
      </div>{/if}

    {#if gate}
      <Setup {overview} first onskip={() => skipSetup(true)} oncontinue={moveOn} />
    {:else if setupOpen}
      <Setup {overview} onclose={() => toggleSetup(false)} />
    {:else}
      {#if missing.length}<SetupBanner {missing} onfinish={finishSetup} />{/if}
      <Composer {overview} />
      <Styles {overview} />
      <Films {overview} {now} onopen={openFilm} />
    {/if}
  </main>
</div>
