<script lang="ts">
  // The film's length, typed freely ("3 min", "90 s", "2:30", or minutes alone) or picked from
  // suggestions, in a field that looks and opens like the lists beside it. Empty leaves the
  // length to the topic. Arrow keys move through the suggestions, Enter takes one, Escape
  // closes them; a typed length is written out the usual way when the field is left.
  import { tick } from 'svelte';
  import Icon from '../Icon.svelte';
  import { lengthLabel, t } from '../i18n';
  import { LENGTHS, parseLength } from './choices';

  /** The field's id, for the label in front of it. */
  export let id: string;
  /** What the field says when it is empty, which is also the first suggestion. */
  export let empty: string;
  export let text = '';
  /** The seconds the text stands for; null while it is empty or not a length. */
  export let seconds: number | null = null;

  $: seconds = parseLength(text);
  $: invalid = !!text.trim() && !seconds;
  // While someone types, the line under the field says how the app reads it.
  $: note =
    text.trim() && (!seconds || lengthLabel(seconds) !== text.trim())
      ? seconds
        ? $t('compose.lengthIs', { length: lengthLabel(seconds) })
        : $t('compose.lengthHelp')
      : '';

  /** The suggestions: the empty choice first, then the lengths. */
  const choices: (number | null)[] = [null, ...LENGTHS];
  let open = false;
  let active = 0;
  let field: HTMLInputElement;
  let list: HTMLElement;
  let wrapper: HTMLElement;

  /** The suggestion that stands for what the field holds now; -1 for a length of its own. */
  $: selected = !text.trim() ? 0 : seconds ? choices.indexOf(seconds) : -1;

  /** Opens the list on what the field holds, or on the next longer suggestion. */
  function show() {
    const wanted = seconds;
    const longer = wanted ? choices.findIndex((choice) => choice !== null && choice >= wanted) : 0;
    active = selected >= 0 ? selected : Math.max(0, longer);
    open = true;
    void tick().then(reveal);
  }
  function toggle() {
    if (open) open = false;
    else show();
  }
  function move(step: number) {
    active = Math.min(choices.length - 1, Math.max(0, active + step));
    reveal();
  }
  /** Scrolls the list, and only the list, so the highlighted suggestion is in view. */
  function reveal() {
    const option = list?.querySelector<HTMLElement>(`#${id}-${active}`);
    if (!option) return;
    const [top, bottom] = [option.offsetTop, option.offsetTop + option.offsetHeight];
    if (top < list.scrollTop) list.scrollTop = top - 6;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight + 6;
  }
  function take(index: number) {
    const value = choices[index];
    text = value ? lengthLabel(value) : '';
    open = false;
    field.focus();
  }
  /** A typed length is written the way the suggestions are: "90 s" becomes "1 min 30 s". */
  function tidy() {
    if (seconds) text = lengthLabel(seconds);
  }
  function key(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (open) move(event.key === 'ArrowDown' ? 1 : -1);
      else show();
    } else if (event.key === 'Enter') {
      if (open) take(active);
      else tidy();
    } else if (event.key === 'Escape' && open) {
      open = false;
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    if (open && !wrapper.contains(event.target as Node)) open = false;
  }}
/>

<div class="length-field" bind:this={wrapper}>
  <input
    bind:this={field}
    {id}
    type="text"
    role="combobox"
    autocomplete="off"
    spellcheck="false"
    placeholder={empty}
    aria-autocomplete="none"
    aria-expanded={open}
    aria-controls={`${id}-list`}
    aria-activedescendant={open ? `${id}-${active}` : undefined}
    aria-invalid={invalid}
    aria-describedby={note ? `${id}-note` : undefined}
    bind:value={text}
    oninput={() => (open = false)}
    onclick={toggle}
    onkeydown={key}
    onblur={() => {
      open = false;
      tidy();
    }}
  />
  <button
    class="length-toggle"
    type="button"
    tabindex="-1"
    aria-label={$t('compose.lengthSuggestions')}
    onpointerdown={(event) => event.preventDefault()}
    onclick={() => {
      toggle();
      field.focus();
    }}><Icon name="chevron" size={18} /></button
  >
  {#if open}<div
      class="length-list"
      id={`${id}-list`}
      role="listbox"
      aria-label={$t('compose.lengthSuggestions')}
      bind:this={list}
    >
      {#each choices as choice, index (choice ?? 0)}
        {@const chosen = index === selected}
        <!-- The field keeps the focus; the arrow keys drive the list. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          id={`${id}-${index}`}
          role="option"
          tabindex="-1"
          aria-selected={chosen}
          class:active={index === active}
          onpointerdown={(event) => event.preventDefault()}
          onpointermove={() => (active = index)}
          onclick={() => take(index)}
        >
          <span>{choice ? lengthLabel(choice) : empty}</span>{#if chosen}<Icon
              name="check"
              size={18}
            />{/if}
        </div>
      {/each}
    </div>{/if}
</div>
{#if note}<small id={`${id}-note`} class="length-note" class:failed={invalid}>{note}</small>{/if}
