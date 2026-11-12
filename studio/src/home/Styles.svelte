<script lang="ts">
  // The styles a film can take: what each looks like, which one is the default, and copies,
  // exports and imports of them. The first place belongs to a style of one's own: made from
  // pictures the user likes, or from a film in the list below.
  import { tick } from 'svelte';
  import Icon from '../Icon.svelte';
  import MoreMenu from '../MoreMenu.svelte';
  import { format, lengthLabel, locale, t } from '../i18n';
  import type { Film, Overview, Style } from '../types';
  import { styleText } from './choices';
  import {
    announce,
    busy,
    call,
    fail,
    patch,
    reveal,
    run,
    saveSettings,
    styleFilm,
  } from './session';
  import StyleMaker from './StyleMaker.svelte';

  export let overview: Overview;

  /** The largest style file the app takes. */
  const MOST_STYLE_BYTES = 256 * 1024 * 1024;

  /** The style a copy is being named for. */
  let copying = '';
  let copyName = '';
  let picker: HTMLInputElement;
  /** A style file the user picked and has not confirmed yet. */
  let incoming: File | null = null;
  /** The form that makes a style is open: from pictures, or from the film named here. */
  let making = false;
  let makingFrom: Film | null = null;
  /** Pictures dropped on the card, on their way into the form. */
  let dropped: File[] = [];
  /** Pictures are being dragged over the card. */
  let over = false;
  /** The style that was just made stands first among the user's own. */
  let fresh = '';
  let section: HTMLElement;
  let opener: HTMLButtonElement | undefined;

  /** The style without a look of its own: what a new style starts from. The card that creates
   * a style takes its place, so it shows only while it is the default. */
  const NEUTRAL = 'blank';

  $: settings = overview.settings;
  // The user's own styles first, the one just made before the others, then the ones that come
  // with the app, the neutral one last.
  $: ordered = overview.styles
    .filter((style) => style.name !== NEUTRAL || settings.preset === NEUTRAL)
    .sort((a, b) => rank(a, fresh) - rank(b, fresh));
  // A film chosen in the films' menu opens the form for it, once.
  $: if ($styleFilm) {
    const film = overview.films.find((entry) => entry.id === $styleFilm?.id && entry.exists);
    styleFilm.set(null);
    if (film) openMaker(film);
  }

  function rank(style: Style, first: string) {
    if (style.name === first) return 0;
    if (style.own) return 1;
    return style.name === NEUTRAL ? 3 : 2;
  }
  function openMaker(film: Film | null = null, files: File[] = []) {
    // One form at a time: a second wish replaces the first only while nothing is being made.
    if (making) {
      section.querySelector('.style-maker')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    makingFrom = film;
    dropped = files;
    making = true;
  }
  async function closeMaker() {
    making = false;
    makingFrom = null;
    dropped = [];
    await tick();
    opener?.focus({ preventScroll: true });
  }
  /** The new style takes the first place; its button gets the focus, so it is in view. */
  async function made(name: string) {
    fresh = name;
    making = false;
    makingFrom = null;
    dropped = [];
    await tick();
    const card = section.querySelector<HTMLElement>(`[data-style="${name}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card?.querySelector<HTMLButtonElement>('.style-actions > .button')?.focus({
      preventScroll: true,
    });
  }
  function dropOnCard(event: DragEvent) {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    over = false;
    openMaker(null, [...event.dataTransfer.files]);
  }

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
  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (copying) copying = '';
    else if (incoming) incoming = null;
    else return;
    event.stopPropagation();
  }
</script>

<svelte:window onkeydowncapture={onKey} />

<section class="home-section" aria-labelledby="styles-title" bind:this={section}>
  <div class="home-heading">
    <h2 id="styles-title">{$t('styles.title')}</h2>
    <p class="home-summary">{$t('styles.lead')}</p>
    <span class="home-heading-actions"
      ><button class="button quiet" onclick={() => reveal('/api/app/reveal/styles')}
        ><Icon name="folder" />{$t('styles.folder')}</button
      ><button class="button quiet" onclick={() => picker.click()}
        ><Icon name="import" />{$t('style.import')}</button
      ></span
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
  {#if making}
    {#key makingFrom?.id}
      <StyleMaker {overview} film={makingFrom} first={dropped} onclose={closeMaker} ondone={made} />
    {/key}
  {/if}
  <ul class="style-grid">
    {#if !making}
      <li
        class="style style-new"
        class:over
        ondragover={(event) => {
          if (!event.dataTransfer?.types.includes('Files')) return;
          event.preventDefault();
          over = true;
        }}
        ondragleave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) over = false;
        }}
        ondrop={dropOnCard}
      >
        <button class="style-pictures" tabindex="-1" aria-hidden="true" onclick={() => openMaker()}
          ><Icon name="plus" size={28} /></button
        >
        <strong class="style-title">{$t('style.new.title')}</strong>
        <p class="style-description">{$t('style.new.card')}</p>
        <span class="style-facts">{$t('style.new.drop')}</span>
        <div class="style-actions">
          <button class="button" bind:this={opener} onclick={() => openMaker()}
            >{$t('style.new.open')}</button
          >
        </div>
      </li>
    {/if}
    {#each ordered as style (style.name)}
      {@const chosen = settings.preset === style.name}
      {@const text = styleText(style, $locale)}
      <li class="style" class:chosen data-style={style.name}>
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
</section>
