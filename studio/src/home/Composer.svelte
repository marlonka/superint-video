<script lang="ts">
  // A film starts with one prompt for the coding agent. This builds it from a topic and a few
  // choices, in the language of the app.
  import Icon from '../Icon.svelte';
  import { format, lengthLabel, locale, t, type Formats, type Translate } from '../i18n';
  import type { Overview } from '../types';
  import { tick } from 'svelte';
  import { FILM_LANGUAGES, FORMATS, LENGTHS, styleText } from './choices';
  import Dictate from './Dictate.svelte';
  import { copyText, fail } from './session';

  export let overview: Overview;

  let topic = '';
  let pick = { preset: '', seconds: '', format: '', language: '' };
  let copied = false;
  let field: HTMLTextAreaElement;
  /** Where the cursor was when the field was left: dictated text goes there. */
  let caret: [number, number] | null = null;
  let dictating = false;

  /** Puts dictated text where the cursor was, else at the end, with a space where one is due. */
  async function insert(text: string) {
    const [from, to] = caret ?? [topic.length, topic.length];
    const before = topic.slice(0, from);
    const after = topic.slice(to);
    const lead = before && !/\s$/.test(before) ? ' ' : '';
    const tail = after && !/^\s/.test(after) ? ' ' : '';
    topic = `${before}${lead}${text}${tail}${after}`;
    const at = before.length + lead.length + text.length;
    caret = [at, at];
    await tick();
    field.focus();
    field.setSelectionRange(at, at);
  }

  $: settings = overview.settings;
  $: styles = overview.styles;
  $: defaultStyle = styles.find((style) => style.name === settings.preset) || null;
  $: pickedStyle = styles.find((style) => style.name === (pick.preset || settings.preset)) || null;
  // The agents that can take the prompt: those that are set up, else every one the app knows.
  $: ready = overview.setup.agents.filter((agent) => agent.ready);
  $: agents = $format.or(
    (ready.length ? ready : overview.setup.agents).map((agent) => agent.title),
  );
  $: prompt = buildPrompt(topic, pick, !settings.preset, $t, $format);

  // Everything the prompt depends on is an argument, so it is rebuilt when any of it changes,
  // the language of the app included.
  function buildPrompt(
    about: string,
    chosen: typeof pick,
    noDefaultStyle: boolean,
    say: Translate,
    write: Formats,
  ) {
    const details: string[] = [];
    if (chosen.preset) details.push(say('prompt.style', { name: chosen.preset }));
    if (chosen.seconds) {
      // "about 45 seconds" below two minutes, whole minutes above when they come out even.
      const seconds = Number(chosen.seconds);
      const length =
        seconds >= 120 && seconds % 60 === 0
          ? say('prompt.minutes', { count: seconds / 60 })
          : say('prompt.seconds', { count: seconds });
      details.push(say('prompt.length', { length }));
    }
    if (chosen.format) details.push(chosen.format);
    if (chosen.language)
      details.push(say('prompt.language', { language: write.language(chosen.language) }));
    const lines = [say('prompt.about', { topic: about.trim() || '…' })];
    if (details.length) {
      const sentence = details.join(', ');
      lines.push(`${sentence[0].toUpperCase()}${sentence.slice(1)}.`);
    }
    if (!chosen.preset && noDefaultStyle) lines.push(say('prompt.askStyle'));
    return lines.join('\n');
  }
  /** The first, empty choice of a select: the user's default, else what the style brings. */
  function inherited(own: string | null, fromStyle: string | null) {
    if (own) return $t('choice.yourDefault', { value: own });
    return fromStyle ? $t('choice.styleOwn', { value: fromStyle }) : $t('choice.fromStyle');
  }
  async function copyPrompt() {
    if (!(await copyText(prompt, $t('compose.copied', { agents }))))
      return fail($t('compose.copyBlocked'));
    copied = true;
    setTimeout(() => (copied = false), 4000);
  }
</script>

<section class="home-section" aria-labelledby="new-title">
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
    <div class="composer-options">
      <label
        ><span>{$t('field.style')}</span>
        <select bind:value={pick.preset}>
          <option value=""
            >{defaultStyle
              ? $t('choice.yourDefault', { value: styleText(defaultStyle, $locale).title })
              : $t('compose.style.ask')}</option
          >
          {#each styles.filter((style) => style.name !== settings.preset) as style (style.name)}<option
              value={style.name}>{styleText(style, $locale).title}</option
            >{/each}
        </select></label
      >
      <label
        ><span>{$t('field.length')}</span>
        <select bind:value={pick.seconds}>
          <option value=""
            >{inherited(
              settings.seconds ? lengthLabel(settings.seconds) : null,
              pickedStyle ? lengthLabel(pickedStyle.seconds) : null,
            )}</option
          >
          {#each LENGTHS as seconds (seconds)}<option value={String(seconds)}
              >{lengthLabel(seconds)}</option
            >{/each}
        </select></label
      >
      <label
        ><span>{$t('field.format')}</span>
        <select bind:value={pick.format}>
          <option value="">{inherited(settings.format, pickedStyle?.defaultFormat ?? null)}</option>
          {#each FORMATS.filter((entry) => !pickedStyle || pickedStyle.formats.includes(entry.value)) as entry (entry.value)}<option
              value={entry.value}>{$t(entry.label)}</option
            >{/each}
        </select></label
      >
      <label
        ><span>{$t('field.language')}</span>
        <select bind:value={pick.language}>
          <option value=""
            >{inherited(
              settings.language ? $format.language(settings.language) : null,
              pickedStyle ? $format.language(pickedStyle.language) : null,
            )}</option
          >
          {#each FILM_LANGUAGES as code (code)}<option value={code}>{$format.language(code)}</option
            >{/each}
        </select></label
      >
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
