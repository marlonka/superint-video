<script lang="ts">
  // Where new films are saved and how the app opens them: rows of Setup, set once.
  import Icon from '../Icon.svelte';
  import { t } from '../i18n';
  import type { Overview } from '../types';
  import SetupItem from './SetupItem.svelte';
  import { busy, refresh, reveal, saveSettings } from './session';

  export let overview: Overview;

  let changing = false;
  let draft = '';

  $: settings = overview.settings;

  function change() {
    draft = overview.filmsFolder ?? '';
    changing = true;
  }
  /** Saves the folder; none goes back to the usual one. */
  function save(folder: string | null) {
    changing = false;
    if (folder !== (settings.projectsDir ?? null))
      void saveSettings({ projectsDir: folder }).then(() => refresh());
  }
</script>

<ul class="setup-list">
  <SetupItem title={$t('setup.films.folder')} done={null}>
    <span class="setup-path">{overview.filmsFolder ?? '–'}</span>
    <span>{$t('setup.films.folderNote')}</span>
    {#if !changing}<span class="setup-links"
        ><button class="text-link" onclick={change}>{$t('setup.films.change')}</button
        >{#if settings.projectsDir}<button class="text-link" onclick={() => save(null)}
            >{$t('setup.films.folderReset')}</button
          >{/if}</span
      >{/if}
    <svelte:fragment slot="action">
      {#if overview.filmsFolder}<button
          class="button"
          onclick={() => reveal('/api/app/reveal/films')}
          ><Icon name="folder" />{$t('films.showFolder')}</button
        >{/if}
    </svelte:fragment>
    <svelte:fragment slot="below">
      {#if changing}
        <form
          class="key-form"
          onsubmit={(event) => {
            event.preventDefault();
            save(draft.trim() || null);
          }}
        >
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            spellcheck="false"
            autofocus
            aria-label={$t('setup.films.folder')}
            bind:value={draft}
            onkeydown={(event) => {
              if (event.key !== 'Escape') return;
              changing = false;
              event.stopPropagation();
            }}
          />
          <button class="button" type="submit" disabled={$busy === 'settings'}
            >{$t('common.save')}</button
          >
          <span class="setup-links"
            ><button class="text-link" type="button" onclick={() => (changing = false)}
              >{$t('common.cancel')}</button
            ></span
          >
        </form>
      {/if}
    </svelte:fragment>
  </SetupItem>
  <SetupItem title={$t('setup.films.opening')} done={null}>
    <label class="setup-check"
      ><input
        type="checkbox"
        checked={settings.follow}
        onchange={(event) => saveSettings({ follow: event.currentTarget.checked })}
      /><span>{$t('setup.films.follow')}</span></label
    >
    <label class="setup-check"
      ><input
        type="checkbox"
        checked={settings.window === 'app'}
        onchange={(event) =>
          saveSettings({ window: event.currentTarget.checked ? 'app' : 'browser' })}
      /><span>{$t('setup.films.window')}</span></label
    >
  </SetupItem>
</ul>
