<script lang="ts">
  // The films this computer knows, each with what is happening to it right now.
  import Icon from '../Icon.svelte';
  import MoreMenu from '../MoreMenu.svelte';
  import { format, t } from '../i18n';
  import type { Film, Overview } from '../types';
  import { announce, baseFilm, busy, call, patch, reveal, run } from './session';

  export let overview: Overview;
  /** The time, kept by the page, so "5 minutes ago" moves on. */
  export let now: number;
  /** Opens a film; the page decides whether that is a new address or the editor underneath. */
  export let onopen: (film: Film) => void;

  /** Copies a film into the films folder, then opens the copy once the copying is done. */
  async function duplicate(film: Film) {
    let copy: Film | undefined;
    const done = await run(`film-${film.id}`, async () => {
      const result = await call<{ id: string; films: Film[] }>(
        `/api/app/films/${film.id}/duplicate`,
        'POST',
        { name: $t('films.copyName', { name: film.name }) },
      );
      patch({ films: result.films });
      copy = result.films.find((entry) => entry.id === result.id);
      announce($t('films.copied', { name: copy?.name ?? film.name }));
    });
    if (done && copy) onopen(copy);
  }
  /** Names the film as the start of the next one, in the prompt under "New film". */
  function startFrom(film: Film) {
    baseFilm.set(film);
    document
      .querySelector('[aria-labelledby="new-title"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function forget(film: Film) {
    void run(`film-${film.id}`, async () => {
      const result = await call<{ films: Film[] }>(`/api/app/films/${film.id}/forget`);
      patch({ films: result.films });
      announce($t('films.removed'));
    });
  }
  /** What a film is doing: rendering, a running command, finished, or its step. */
  function state(film: Film): { text: string; live: boolean } {
    if (!film.exists) return { text: $t('films.gone'), live: false };
    const render = film.render;
    if (render?.status === 'running') {
      const share = render.total ? render.completed / render.total : 0;
      return { text: $t('state.rendering', { percent: $format.percent(share) }), live: true };
    }
    if (film.running) return { text: film.running, live: true };
    if (film.ready) return { text: $t('state.filmReady'), live: false };
    return { text: film.step || '', live: false };
  }
</script>

<section class="home-section" aria-labelledby="films-title">
  <div class="home-heading">
    <h2 id="films-title">{$t('films.title')}</h2>
  </div>
  {#if overview.films.length}
    <ul class="film-grid">
      {#each overview.films as film (film.id)}
        {@const doing = state(film)}
        <li class="film" class:gone={!film.exists}>
          <button
            class="film-open"
            disabled={!film.exists || $busy === `film-${film.id}`}
            onclick={() => onopen(film)}
            aria-label={$t('films.open', { name: film.name })}
          >
            <span class="film-picture"
              >{#if film.picture}<img
                  src={`/api/app/films/${film.id}/picture?v=${film.picture}`}
                  alt=""
                  loading="lazy"
                />{:else}<Icon name="film" size={28} />{/if}</span
            >
            <span class="film-name">{film.name}</span>
            <span class="film-state" title={film.note || ''}
              >{#if doing.live}<span class="live-dot" aria-hidden="true"></span>{/if}{doing.text
                ? `${doing.text} · `
                : ''}{film.current
                ? $t('time.openNow')
                : $format.ago(Math.max(film.seenAt, film.createdAt), now)}</span
            >
          </button>
          <MoreMenu place="film-more" label={$t('menu.moreFor', { name: film.name })}>
            {#if film.exists}<button role="menuitem" onclick={() => startFrom(film)}
                ><Icon name="film" />{$t('films.startFrom')}</button
              ><button
                role="menuitem"
                disabled={$busy === `film-${film.id}`}
                onclick={() => duplicate(film)}
                ><Icon name="duplicate" />{$t('films.duplicate')}</button
              ><button
                role="menuitem"
                onclick={() => void reveal(`/api/app/films/${film.id}/reveal`)}
                ><Icon name="folder" />{$t('films.showFolder')}</button
              >{/if}
            <button role="menuitem" onclick={() => forget(film)}
              ><Icon name="close" />{$t('films.remove')}</button
            >
          </MoreMenu>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="home-empty">
      {$t('films.empty')}
      {#if overview.filmsFolder}{$t('films.where', { folder: overview.filmsFolder })}{/if}
    </p>
  {/if}
</section>
