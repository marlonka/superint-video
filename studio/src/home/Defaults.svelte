<script lang="ts">
  // What a new film starts from when the prompt does not say: the style, and a few values.
  import Icon from '../Icon.svelte';
  import MoreMenu from '../MoreMenu.svelte';
  import { format, lengthLabel, locale, t } from '../i18n';
  import type { Overview, Style } from '../types';
  import { FILM_LANGUAGES, FORMATS, LENGTHS, styleText } from './choices';
  import { announce, busy, call, fail, patch, refresh, reveal, run, saveSettings } from './session';

  export let overview: Overview;

  /** The largest style file the app takes. */
  const MOST_STYLE_BYTES = 256 * 1024 * 1024;

  let folderDraft: string | null = null;
  /** The style a copy is being named for. */
  let copying = '';
  let copyName = '';
  let picker: HTMLInputElement;
  /** A style file the user picked and has not confirmed yet. */
  let incoming: File | null = null;

  $: settings = overview.settings;
  // A value set from the command line may not be among the usual choices; it is offered too.
  $: lengths =
    settings.seconds && !LENGTHS.includes(settings.seconds)
      ? [...LENGTHS, settings.seconds].sort((a, b) => a - b)
      : LENGTHS;
  $: languages =
    settings.language && !FILM_LANGUAGES.includes(settings.language)
      ? [...FILM_LANGUAGES, settings.language]
      : FILM_LANGUAGES;

  function facts(style: Style) {
    return [
      style.formats.join(', '),
      $t('style.about', { length: lengthLabel(style.seconds) }),
      $format.language(style.language),
      style.voice ? $t('style.voice', { name: style.voice }) : '',
      style.music ? $t('style.music') : '',
      style.own ? $t('style.yours') : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  function toggleDefault(style: Style, chosen: boolean) {
    void saveSettings(
      { preset: chosen ? null : style.name },
      chosen
        ? $t('style.defaultCleared')
        : $t('style.defaultSet', { name: styleText(style, $locale).title }),
    );
  }
  function makeCopy(style: Style) {
    const name = copyName.trim().toLowerCase();
    if (!name) return;
    void run('copy-style', async () => {
      const result = await call<{ styles: Style[] }>('/api/app/styles', 'POST', {
        from: style.name,
        name,
      });
      copying = '';
      copyName = '';
      patch({ styles: result.styles });
      announce($t('style.created', { name }));
    });
  }
  function startCopy(style: Style) {
    copying = style.name;
    copyName = `${style.name}-mine`;
  }
  function exportStyle(style: Style) {
    void run('export-style', async () => {
      const result = await call<{ file: string }>(`/api/app/styles/${style.name}/export`);
      announce($t('style.exported', { file: result.file.split(/[\\/]/).pop() || result.file }));
    });
  }
  function pick(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0] ?? null;
    // The same file can be picked again after a cancel.
    event.currentTarget.value = '';
    if (file && file.size > MOST_STYLE_BYTES) fail($t('style.import.tooLarge'));
    else incoming = file;
  }
  function importStyle() {
    const file = incoming;
    if (!file) return;
    void run('import-style', async () => {
      const result = await call<{ title: string; styles: Style[] }>(
        '/api/app/styles/import',
        'POST',
        file,
      ).catch((cause) => {
        throw new Error(
          $t('style.import.failed', {
            file: file.name,
            detail: cause instanceof Error ? cause.message : String(cause),
          }),
        );
      });
      incoming = null;
      patch({ styles: result.styles });
      announce($t('style.imported', { name: result.title }));
    });
  }
  /** Saves the films folder; an empty field goes back to the usual one. */
  function saveFolder() {
    if (folderDraft === null) return;
    const value = folderDraft.trim();
    folderDraft = null;
    if (value !== (overview.filmsFolder || '')) setFolder(value || null);
  }
  function setFolder(folder: string | null) {
    void saveSettings({ projectsDir: folder }).then(() => refresh());
  }
  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (copying) copying = '';
    else if (incoming) incoming = null;
    else return;
    event.stopPropagation();
  }
</script>

<svelte:window onkeydowncapture={onKey} />

<section class="home-section" aria-labelledby="defaults-title">
  <div class="home-heading">
    <h2 id="defaults-title">{$t('defaults.title')}</h2>
    <p class="home-summary">{$t('defaults.lead')}</p>
  </div>
  <div class="home-subheading-row">
    <h3 class="home-subheading">{$t('field.style')}</h3>
    <button class="button quiet" onclick={() => picker.click()}
      ><Icon name="import" />{$t('style.import')}</button
    >
    <input type="file" accept=".zip,application/zip" hidden bind:this={picker} onchange={pick} />
  </div>
  {#if incoming}
    <div class="style-import" role="group" aria-labelledby="style-import-title">
      <p>
        <strong id="style-import-title">{$t('style.import.ask', { file: incoming.name })}</strong>
        {$t('style.import.trust')}
      </p>
      <button class="button" disabled={$busy === 'import-style'} onclick={importStyle}
        >{$t('style.import.confirm')}</button
      >
      <button class="button quiet" onclick={() => (incoming = null)}>{$t('common.cancel')}</button>
    </div>
  {/if}
  <ul class="style-grid">
    {#each overview.styles as style (style.name)}
      {@const chosen = settings.preset === style.name}
      {@const text = styleText(style, $locale)}
      <li class="style" class:chosen>
        <div class="style-pictures">
          {#each style.references.slice(0, 3) as reference (reference)}<img
              src={`/api/app/styles/${style.name}/reference/${encodeURIComponent(reference)}`}
              alt=""
              loading="lazy"
            />{:else}<button
              class="text-link"
              onclick={() => reveal(`/api/app/styles/${style.name}/reveal`)}
              >{$t('style.menu.references')}</button
            >{/each}
        </div>
        <strong class="style-title">{text.title}</strong>
        <p class="style-description">{text.description}</p>
        <span class="style-facts">{facts(style)}</span>
        {#if copying === style.name}
          <form
            class="style-actions"
            onsubmit={(event) => {
              event.preventDefault();
              makeCopy(style);
            }}
          >
            <!-- svelte-ignore a11y_autofocus -->
            <input
              type="text"
              autofocus
              placeholder={$t('style.copyPlaceholder')}
              aria-label={$t('style.copyLabel')}
              title={$t('style.copyLabel')}
              pattern="[a-z0-9][a-z0-9-]*"
              maxlength="40"
              bind:value={copyName}
            />
            <button
              class="button"
              type="submit"
              disabled={!copyName.trim() || $busy === 'copy-style'}>{$t('style.create')}</button
            >
            <button class="button quiet" type="button" onclick={() => (copying = '')}
              >{$t('common.cancel')}</button
            >
          </form>
        {:else}
          <div class="style-actions">
            <button
              class="button"
              aria-pressed={chosen}
              disabled={$busy === 'settings'}
              onclick={() => toggleDefault(style, chosen)}
              >{#if chosen}<Icon name="check" />{$t('style.isDefault')}{:else}{$t(
                  'style.makeDefault',
                )}{/if}</button
            >
            <MoreMenu place="style-more" label={$t('menu.moreFor', { name: text.title })}>
              <button
                role="menuitem"
                onclick={() => void reveal(`/api/app/styles/${style.name}/reveal`)}
                ><Icon name="folder" />{$t('style.menu.references')}</button
              >
              <button role="menuitem" onclick={() => startCopy(style)}
                ><Icon name="duplicate" />{$t('style.menu.copy')}</button
              >
              <button
                role="menuitem"
                disabled={$busy === 'export-style'}
                onclick={() => exportStyle(style)}
                ><Icon name="export" />{$t('style.menu.export')}</button
              >
            </MoreMenu>
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="default-fields">
    <label
      ><span>{$t('field.length')}</span>
      <select
        value={settings.seconds ? String(settings.seconds) : ''}
        onchange={(event) => saveSettings({ seconds: Number(event.currentTarget.value) || null })}
      >
        <option value="">{$t('choice.fromStyle')}</option>
        {#each lengths as seconds (seconds)}<option value={String(seconds)}
            >{lengthLabel(seconds)}</option
          >{/each}
      </select><small>{$t('defaults.length.note')}</small></label
    >
    <label
      ><span>{$t('field.format')}</span>
      <select
        value={settings.format || ''}
        onchange={(event) => saveSettings({ format: event.currentTarget.value || null })}
      >
        <option value="">{$t('choice.fromStyle')}</option>
        {#each FORMATS as entry (entry.value)}<option value={entry.value}>{$t(entry.label)}</option
          >{/each}
      </select><small>{$t('defaults.format.note')}</small></label
    >
    <label
      ><span>{$t('field.language')}</span>
      <select
        value={settings.language || ''}
        onchange={(event) => saveSettings({ language: event.currentTarget.value || null })}
      >
        <option value="">{$t('choice.fromStyle')}</option>
        {#each languages as code (code)}<option value={code}>{$format.language(code)}</option
          >{/each}
      </select><small>{$t('defaults.language.note')}</small></label
    >
    <label class="wide"
      ><span>{$t('defaults.folder')}</span>
      <span class="folder-field"
        ><input
          type="text"
          spellcheck="false"
          value={folderDraft ?? overview.filmsFolder ?? ''}
          oninput={(event) => (folderDraft = event.currentTarget.value)}
          onblur={saveFolder}
          onkeydown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />{#if overview.filmsFolder}<button
            class="button"
            type="button"
            onclick={() => reveal('/api/app/reveal/films')}
            ><Icon name="folder" />{$t('common.show')}</button
          >{/if}</span
      ><small
        >{$t('defaults.folder.note')}
        {#if settings.projectsDir}<button
            class="text-link"
            type="button"
            onclick={() => setFolder(null)}>{$t('defaults.folder.reset')}</button
          >{/if}</small
      ></label
    >
    <label class="check"
      ><input
        type="checkbox"
        checked={settings.follow}
        onchange={(event) => saveSettings({ follow: event.currentTarget.checked })}
      /><span>{$t('defaults.follow')}</span></label
    >
    <label class="check"
      ><input
        type="checkbox"
        checked={settings.window === 'app'}
        onchange={(event) =>
          saveSettings({ window: event.currentTarget.checked ? 'app' : 'browser' })}
      /><span>{$t('defaults.window')}</span></label
    >
  </div>
</section>
