<script lang="ts">
  // The start page: setup, a new film, the films, the defaults. While something required is
  // missing, Setup is the whole page, so nobody starts a film that cannot be made.
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import Logo from './Logo.svelte';
  import Composer from './home/Composer.svelte';
  import Defaults from './home/Defaults.svelte';
  import Films from './home/Films.svelte';
  import Setup from './home/Setup.svelte';
  import SetupBanner from './home/SetupBanner.svelte';
  import {
    announce,
    call,
    needs,
    problem,
    refresh,
    reveal,
    run,
    setLanguage,
    setupSkipped,
    skipSetup,
  } from './home/session';
  import { LOCALES, isLocale, locale, t } from './i18n';
  import { theme, toggleTheme } from './theme';
  import type { Film, Overview } from './types';

  export let overview: Overview;
  /** Set when a film is open underneath: the way back to it. */
  export let onclose: (() => void) | null = null;

  const openedAt = Date.now();
  const followed = new Set<string>();
  let now = Date.now();
  let page: HTMLElement;

  $: missing = needs(overview);
  $: gate = missing.length > 0 && !$setupSkipped;
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
  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && onclose) onclose();
  }

  onMount(() => {
    const titleBefore = document.title;
    void poll();
    const timer = setInterval(() => {
      now = Date.now();
      // A hidden page asks rarely: nobody is looking and the app should be able to rest.
      if (document.visibilityState === 'visible' || Date.now() % 15000 < 3000) void poll();
    }, 3000);
    const visible = () => document.visibilityState === 'visible' && void poll();
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      document.title = titleBefore;
      document.removeEventListener('visibilitychange', visible);
    };
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="home">
  <header class="app-header">
    <span class="wordmark"><Logo /></span>
    <div class="header-actions">
      {#if onclose}<button class="button" onclick={onclose}
          ><Icon name="arrowLeft" /><span
            >{overview.project?.name
              ? $t('home.back', { name: overview.project.name })
              : $t('home.backToFilm')}</span
          ></button
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
    {#if $problem}<div class="home-problem" role="alert">
        <Icon name="alert" /><span>{$problem}</span><button
          class="icon-button"
          aria-label={$t('common.dismiss')}
          onclick={() => problem.set('')}><Icon name="close" /></button
        >
      </div>{/if}

    {#if gate}
      <Setup {overview} first onskip={() => skipSetup(true)} />
    {:else}
      {#if missing.length}<SetupBanner {missing} onfinish={finishSetup} />{/if}
      <Setup {overview} />
      <Composer {overview} />
      <Films {overview} {now} onopen={openFilm} />
      <Defaults {overview} />
    {/if}

    <footer class="home-foot">
      <span>Superint Video {overview.version}</span>
      <button class="text-link" onclick={() => reveal('/api/app/reveal/home')}
        >{$t('foot.settingsFolder')}</button
      >
      <button class="text-link" onclick={() => reveal('/api/app/reveal/styles')}
        >{$t('foot.stylesFolder')}</button
      >
    </footer>
  </main>
</div>
