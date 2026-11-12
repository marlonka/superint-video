<script lang="ts">
  // A film starts with one prompt for the coding agent. This builds it from a topic and a few
  // choices, in the language of the app. Left alone, the agent picks style and length to suit
  // the topic, the picture is wide and the film speaks the language the topic is written in.
  // A film chosen as the base in its menu makes the prompt start from a copy of it.
  import Icon from '../Icon.svelte';
  import { format, locale, t, type Formats, type Translate } from '../i18n';
  import type { Film, Overview } from '../types';
  import { onMount, tick } from 'svelte';
  import {
    FILM_LANGUAGES,
    FORMATS,
    USUAL_FORMAT,
    spliceSpoken,
    styleText,
    topicLanguage,
  } from './choices';
  import Dictate from './Dictate.svelte';
  import LengthField from './LengthField.svelte';
  import { baseFilm, copyText, fail } from './session';

  export let overview: Overview;

  /** Style choices that are not a style: the agent picks one to suit the topic, or asks, or
   * the base film keeps its own. */
  const FIT = ':fit';
  const ASK = ':ask';
  const BASE = ':base';
  /** Who speaks the film: a TTS model, the user themselves, or nobody. */
  type Narration = 'ai' | 'own' | 'none';
  const NARRATIONS: Narration[] = ['ai', 'own', 'none'];

  let topic = '';
  /** Empty is the first choice of a list: the default style, or the one the topic suits. */
  let pick: { style: string; format: string; language: string; narration: Narration | '' } = {
    style: '',
    format: '',
    language: '',
    narration: '',
  };
  let seconds: number | null = null;
  let copied = false;
  let field: HTMLTextAreaElement;
  /** Where the cursor was when the field was left: dictated text goes there. */
  let caret: [number, number] | null = null;
  let dictating = false;

  /** Puts dictated text where the cursor was, else at the end, with a space where one is due. */
  async function insert(text: string) {
    const spoken = spliceSpoken(topic, caret, text);
    topic = spoken.text;
    const at = spoken.at;
    caret = [at, at];
    await tick();
    field.focus();
    field.setSelectionRange(at, at);
  }

  // The base film as the list knows it now; one whose folder is gone is no base.
  $: base = $baseFilm
    ? overview.films.find((film) => film.id === $baseFilm.id && film.exists) || null
    : null;
  // Choosing a base, the same one again too, brings this section into view, ready for the
  // topic. A base still chosen when the page comes back leaves the page where it is.
  let section: HTMLElement;
  onMount(() => {
    let mounted = false;
    const stop = baseFilm.subscribe((film) => {
      if (film && mounted) void tick().then(showBase);
    });
    mounted = true;
    return stop;
  });
  function showBase() {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    field.focus({ preventScroll: true });
  }
  $: styles = overview.styles;
  $: defaultStyle = styles.find((style) => style.name === overview.settings.preset) || null;
  /** The style the prompt names, or FIT, ASK or BASE. */
  $: style = base ? BASE : pick.style || defaultStyle?.name || FIT;
  $: pickedStyle = styles.find((entry) => entry.name === style) || null;
  // Only the formats the style can make; wide unless someone picks another. A copy keeps the
  // format of its base unless someone picks another.
  $: formats = FORMATS.filter((entry) => !pickedStyle || pickedStyle.formats.includes(entry.value));
  $: usualFormat = base
    ? ''
    : formats.some((entry) => entry.value === USUAL_FORMAT)
      ? USUAL_FORMAT
      : pickedStyle?.defaultFormat || USUAL_FORMAT;
  $: pictureFormat = formats.some((entry) => entry.value === pick.format)
    ? pick.format
    : usualFormat;
  // The voice a film gets unless someone picks another: the AI voice when an API key reaches
  // one, else the user's own, which needs no key.
  $: aiVoice = overview.setup.can.voice;
  $: usualNarration = (aiVoice ? 'ai' : 'own') as Narration;
  $: narration = pick.narration || usualNarration;
  $: written = topicLanguage(topic);
  $: language = pick.language || written;
  // The languages by their names in the app's language, as a list is read.
  $: languages = FILM_LANGUAGES.map((code) => ({ code, name: $format.language(code) })).sort(
    (a, b) => a.name.localeCompare(b.name, $locale),
  );
  // The agents that can take the prompt: those that are set up, else every one the app knows.
  $: ready = overview.setup.agents.filter((agent) => agent.ready);
  $: agents = $format.or(
    (ready.length ? ready : overview.setup.agents).map((agent) => agent.title),
  );
  // Off the search path the agent learns where the program is; on it, the prompt stays short.
  $: program = overview.cli.onPath ? null : overview.cli.path;
  $: prompt = buildPrompt(
    topic,
    base,
    style,
    seconds,
    pictureFormat,
    language,
    narration,
    program,
    $t,
    $format,
  );

  // Everything the prompt depends on is an argument, so it is rebuilt when any of it changes,
  // the language of the app included.
  function buildPrompt(
    about: string,
    from: Film | null,
    style: string,
    seconds: number | null,
    picture: string,
    language: string | null,
    narration: Narration,
    program: string | null,
    say: Translate,
    write: Formats,
  ) {
    const details: string[] = [];
    if (![FIT, ASK, BASE].includes(style)) details.push(say('prompt.style', { name: style }));
    if (seconds) {
      // "about 45 seconds" below two minutes, whole minutes above when they come out even.
      const length =
        seconds >= 120 && seconds % 60 === 0
          ? say('prompt.minutes', { count: seconds / 60 })
          : say('prompt.seconds', { count: seconds });
      details.push(say('prompt.length', { length }));
    }
    if (picture) details.push(say('prompt.format', { format: picture }));
    details.push(
      language
        ? say('prompt.language', { language: write.language(language) })
        : say('prompt.topicLanguage'),
    );
    const sentence = details.join(', ');
    const lines = [say('prompt.about', { topic: about.trim() || '…' })];
    if (from) lines.push(say('prompt.base', { name: from.name, path: from.path }));
    lines.push(`${sentence[0].toUpperCase()}${sentence.slice(1)}.`);
    const fitStyle = style === FIT;
    if (fitStyle && !seconds) lines.push(say('prompt.fitBoth'));
    else if (fitStyle) lines.push(say('prompt.fitStyle'));
    else if (!seconds) lines.push(say('prompt.fitLength'));
    if (style === ASK) lines.push(say('prompt.askStyle'));
    lines.push(say(`prompt.voice.${narration}`));
    if (program) lines.push(say('prompt.program', { path: program }));
    return lines.join('\n');
  }
  async function copyPrompt() {
    if (!(await copyText(prompt, $t('compose.copied', { agents }))))
      return fail($t('compose.copyBlocked'));
    copied = true;
    setTimeout(() => (copied = false), 4000);
  }
</script>

<section class="home-section" aria-labelledby="new-title" bind:this={section}>
  <div class="home-heading">
    <h2 id="new-title">{$t('compose.title')}</h2>
    <p class="home-summary">{$t('compose.lead', { agents })}</p>
  </div>
  <div class="composer">
    <div class="composer-field" class:dictating>
      <textarea
        rows="3"
        placeholder={$t('compose.placeholder')}
        aria-label={$t('compose.topicLabel')}
        readonly={dictating}
        bind:this={field}
        bind:value={topic}
        onblur={() => (caret = [field.selectionStart, field.selectionEnd])}></textarea>
      <Dictate available={overview.setup.can.dictate} oninsert={insert} bind:active={dictating} />
    </div>
    {#if base}<p class="composer-base">
        <Icon name="film" size={18} /><span>{$t('compose.base', { name: base.name })}</span><button
          class="text-link"
          onclick={() => baseFilm.set(null)}>{$t('compose.baseClear')}</button
        >
      </p>{/if}
    <div class="composer-options">
      <div class="composer-choice">
        <label for="film-style">{$t('field.style')}</label>
        {#if base}<select id="film-style" disabled><option>{$t('choice.likeBase')}</option></select
          >{:else}<select id="film-style" bind:value={pick.style}>
            <option value=""
              >{defaultStyle
                ? $t('choice.yourDefault', { value: styleText(defaultStyle, $locale).title })
                : $t('choice.fit')}</option
            >
            {#if defaultStyle}<option value={FIT}>{$t('choice.fit')}</option>{/if}
            {#each styles.filter((entry) => entry.name !== defaultStyle?.name) as entry (entry.name)}<option
                value={entry.name}>{styleText(entry, $locale).title}</option
              >{/each}
            <option value={ASK}>{$t('choice.ask')}</option>
          </select>{/if}
      </div>
      <div class="composer-choice">
        <label for="film-length">{$t('field.length')}</label>
        <LengthField id="film-length" empty={$t('choice.fit')} bind:seconds />
      </div>
      <div class="composer-choice">
        <label for="film-format">{$t('field.format')}</label>
        <select
          id="film-format"
          value={pictureFormat}
          onchange={(event) => (pick.format = event.currentTarget.value)}
        >
          {#if base}<option value="">{$t('choice.likeBase')}</option>{/if}
          {#each formats as entry (entry.value)}<option value={entry.value}
              >{$t(entry.label)}</option
            >{/each}
        </select>
      </div>
      <div class="composer-choice">
        <label for="film-language">{$t('field.language')}</label>
        <select id="film-language" bind:value={pick.language}>
          <option value=""
            >{written
              ? $t('choice.topicLanguage', { language: $format.language(written) })
              : $t('choice.topicLanguageOpen')}</option
          >
          {#each languages as entry (entry.code)}<option value={entry.code}>{entry.name}</option
            >{/each}
        </select>
      </div>
      <div class="composer-choice">
        <label for="film-voice">{$t('field.voice')}</label>
        <select id="film-voice" bind:value={pick.narration}>
          <option value="">{$t(`choice.voice.${usualNarration}`)}</option>
          {#each NARRATIONS.filter((entry) => entry !== usualNarration) as entry (entry)}<option
              value={entry}
              disabled={entry === 'ai' && !aiVoice}
              >{$t(
                entry === 'ai' && !aiVoice ? 'choice.voice.aiNeedsKey' : `choice.voice.${entry}`,
              )}</option
            >{/each}
        </select>
      </div>
    </div>
    <div class="composer-prompt">
      <pre aria-label={$t('compose.promptLabel')}>{prompt}</pre>
      <button class="button primary" disabled={!topic.trim()} onclick={copyPrompt}
        ><Icon name={copied ? 'check' : 'copy'} />{$t(
          copied ? 'common.copied' : 'compose.copy',
        )}</button
      >
    </div>
  </div>
</section>
