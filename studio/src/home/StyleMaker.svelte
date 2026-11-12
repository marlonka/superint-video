<script lang="ts">
  // A style of one's own: pictures whose look the user likes and a few words about it, or a
  // finished film. The model of their API key looks and writes the rules; the pictures become
  // the style's references. While the model works the form stays as it is, says who is at
  // work and for how long, and has a way out.
  import { onDestroy, onMount, tick } from 'svelte';
  import Icon from '../Icon.svelte';
  import { filmClock, locale, t } from '../i18n';
  import type { Film, MadeStyle, Overview } from '../types';
  import { spliceSpoken } from './choices';
  import Dictate from './Dictate.svelte';
  import { announce, call, fail, patch } from './session';

  export let overview: Overview;
  /** The film the style is made from; none for a style from pictures. */
  export let film: Film | null = null;
  /** Pictures that were dropped on the card that opened the form. */
  export let first: File[] = [];
  export let onclose: () => void;
  /** Says which style was made. */
  export let ondone: (name: string) => void;

  /** What the server takes: so many pictures, each so large, of these kinds. */
  const MOST_PICTURES = 12;
  const MOST_BYTES = 20 * 1024 * 1024;
  const KINDS = ['image/png', 'image/jpeg', 'image/webp'];
  /** A description without pictures needs this much to go on. */
  const LEAST_WORDS = 12;

  let pictures: { file: File; url: string }[] = [];
  let describe = '';
  let name = '';
  let panel: HTMLElement;
  let field: HTMLTextAreaElement;
  let picker: HTMLInputElement;
  /** Where the cursor was when the field was left: dictated text goes there. */
  let caret: [number, number] | null = null;
  let dictating = false;
  /** Pictures are being dragged over the form. */
  let over = false;
  let working = false;
  let seconds = 0;
  let clock: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | null = null;

  $: can = overview.setup.can.style;
  $: writer = overview.setup.style;
  $: enough = !!film || pictures.length > 0 || describe.trim().length >= LEAST_WORDS;
  $: values = { model: writer?.model ?? '', provider: writer?.provider ?? '' };

  /** Takes the pictures among some files, up to the most a style takes, and says what it left. */
  function add(files: Iterable<File>) {
    if (film || working) return;
    for (const file of files) {
      if (!KINDS.includes(file.type)) fail($t('maker.notPicture', { name: file.name }));
      else if (file.size > MOST_BYTES) fail($t('maker.tooLarge', { name: file.name }));
      else if (pictures.length >= MOST_PICTURES)
        return fail($t('maker.tooMany', { count: MOST_PICTURES }));
      else pictures = [...pictures, { file, url: URL.createObjectURL(file) }];
    }
  }
  function remove(index: number) {
    URL.revokeObjectURL(pictures[index].url);
    pictures = pictures.filter((_, at) => at !== index);
  }
  function pick(event: Event & { currentTarget: HTMLInputElement }) {
    add(event.currentTarget.files ?? []);
    // The same file can be picked again after it was removed.
    event.currentTarget.value = '';
  }
  function carriesFiles(event: DragEvent) {
    return !film && !!event.dataTransfer?.types.includes('Files');
  }
  function drop(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    over = false;
    add(event.dataTransfer?.files ?? []);
  }
  /** A picture on the clipboard goes to the pictures, wherever on the form the cursor is. */
  function paste(event: ClipboardEvent) {
    const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
      file.type.startsWith('image/'),
    );
    if (!files.length || film) return;
    event.preventDefault();
    add(files);
  }

  /** Puts dictated text where the cursor was, else at the end. */
  async function insert(text: string) {
    const spoken = spliceSpoken(describe, caret, text);
    describe = spoken.text;
    caret = [spoken.at, spoken.at];
    await tick();
    field.focus();
    field.setSelectionRange(spoken.at, spoken.at);
  }

  async function create() {
    if (working || !can || !enough) return;
    working = true;
    seconds = 0;
    const started = Date.now();
    clock = setInterval(() => (seconds = (Date.now() - started) / 1000), 1000);
    const asking = new AbortController();
    controller = asking;
    try {
      let made: MadeStyle;
      if (film) {
        made = await call<MadeStyle>(
          `/api/app/films/${film.id}/style`,
          'POST',
          { name: name.trim(), describe: describe.trim() },
          asking.signal,
        );
      } else {
        const form = new FormData();
        form.set('name', name.trim());
        form.set('describe', describe.trim());
        form.set('language', $locale);
        for (const picture of pictures) form.append('reference', picture.file, picture.file.name);
        made = await call<MadeStyle>('/api/app/styles/create', 'POST', form, asking.signal);
      }
      patch({ styles: made.styles });
      announce($t('maker.done', { name: made.title, model: made.model }));
      ondone(made.name);
    } catch (cause) {
      // Stopped by the user: nothing to report. Anything else is said where failures are read.
      if (!asking.signal.aborted) fail(cause);
    } finally {
      clearInterval(clock);
      working = false;
      if (controller === asking) controller = null;
    }
  }
  /** Gives up on the answer; the server writes no style once nobody waits for it. */
  function stop() {
    controller?.abort();
    announce($t('maker.stopped'));
  }
  /** Escape in the form closes it. While the style is being made, Escape anywhere does
   * nothing, so the page is not left and the work not lost by a stray key. */
  function onKey(event: KeyboardEvent) {
    // While the microphone listens, Escape belongs to it.
    if (event.key !== 'Escape' || dictating) return;
    if (!working && !panel.contains(event.target as Node | null)) return;
    event.stopPropagation();
    if (!working) onclose();
  }

  onMount(() => {
    add(first);
    field.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  onDestroy(() => {
    clearInterval(clock);
    controller?.abort();
    for (const picture of pictures) URL.revokeObjectURL(picture.url);
  });
</script>

<svelte:window onkeydowncapture={onKey} />

<div
  class="style-maker"
  class:over
  role="group"
  aria-labelledby="maker-title"
  bind:this={panel}
  onpaste={paste}
  ondragover={(event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    over = true;
  }}
  ondragleave={(event) => {
    if (!panel.contains(event.relatedTarget as Node | null)) over = false;
  }}
  ondrop={drop}
>
  <div class="maker-heading">
    <h3 id="maker-title">
      {film ? $t('maker.filmTitle', { name: film.name }) : $t('style.new.title')}
    </h3>
    <p>{$t(film ? 'maker.filmLead' : 'maker.lead')}</p>
  </div>
  {#if film}
    {#if film.picture}<div class="maker-pictures">
        <span class="maker-picture"
          ><img src={`/api/app/films/${film.id}/picture?v=${film.picture}`} alt="" /></span
        >
      </div>{/if}
  {:else}
    <ul class="maker-pictures" aria-label={$t('maker.pictures')}>
      {#each pictures as picture, index (picture.url)}
        <li class="maker-picture">
          <img src={picture.url} alt={picture.file.name} />
          <button
            class="icon-button"
            aria-label={$t('maker.remove', { name: picture.file.name })}
            title={$t('maker.remove', { name: picture.file.name })}
            disabled={working}
            onclick={() => remove(index)}><Icon name="close" size={16} /></button
          >
        </li>
      {/each}
      {#if pictures.length < MOST_PICTURES}
        <li>
          <button class="maker-add" disabled={working} onclick={() => picker.click()}
            ><Icon name="plus" /><span>{$t(pictures.length ? 'maker.addMore' : 'maker.add')}</span
            ></button
          >
        </li>
      {/if}
    </ul>
    <input
      type="file"
      accept={KINDS.join(',')}
      multiple
      hidden
      bind:this={picker}
      onchange={pick}
    />
  {/if}
  <div class="composer-field" class:dictating>
    <textarea
      rows="3"
      maxlength="6000"
      placeholder={$t(film ? 'maker.filmDescribe' : 'maker.describe')}
      aria-label={$t('maker.describeLabel')}
      readonly={dictating || working}
      bind:this={field}
      bind:value={describe}
      onblur={() => (caret = [field.selectionStart, field.selectionEnd])}></textarea>
    <Dictate
      available={overview.setup.can.dictate}
      paused={working}
      hint={$t('maker.dictateHint')}
      listening={$t('maker.dictateListening')}
      oninsert={insert}
      bind:active={dictating}
    />
  </div>
  <div class="maker-foot">
    <div class="composer-choice">
      <label for="maker-name">{$t('maker.name')}</label>
      <input
        id="maker-name"
        type="text"
        maxlength="60"
        autocomplete="off"
        placeholder={$t('maker.namePlaceholder')}
        disabled={working}
        bind:value={name}
        onkeydown={(event) => event.key === 'Enter' && create()}
      />
    </div>
    <div class="maker-actions">
      <button class="button quiet" onclick={working ? stop : onclose}>{$t('common.cancel')}</button>
      <button class="button primary" disabled={working || !can || !enough} onclick={create}
        >{$t('maker.create')}</button
      >
    </div>
  </div>
  <p class="maker-note" class:working role="status">
    {#if working}<span class="loader small"></span><span
        >{$t(film ? 'maker.filmWorking' : 'maker.working', values)}</span
      ><span class="maker-clock">{filmClock(seconds)}</span>{:else if !can}{$t(
        'maker.needsKey',
      )}{:else}{$t(film ? 'maker.filmWho' : 'maker.who', values)}{/if}
  </p>
</div>
