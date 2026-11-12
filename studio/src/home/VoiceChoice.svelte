<script lang="ts">
  // The narration voice in Setup. Where the app knows the voices the chosen model takes by
  // name, they are a list, each with how it sounds; elsewhere a field takes any name.
  import { t, type MessageKey } from '../i18n';
  import type { Voice, Voices } from '../types';

  /** The narration model the voice is for: the one typed above, else the usual one. */
  export let model: string;
  export let voices: Voices;
  export let value: string;
  export let name: string;
  /** What the field shows while empty, where it is a field. */
  export let placeholder = '';
  export let describedby: string | undefined = undefined;

  /** Google's word for how each voice sounds, as the app says it. */
  const SOUNDS: Record<string, MessageKey> = {
    bright: 'voice.sound.bright',
    upbeat: 'voice.sound.upbeat',
    informative: 'voice.sound.informative',
    firm: 'voice.sound.firm',
    excitable: 'voice.sound.excitable',
    youthful: 'voice.sound.youthful',
    breezy: 'voice.sound.breezy',
    'easy-going': 'voice.sound.easyGoing',
    breathy: 'voice.sound.breathy',
    clear: 'voice.sound.clear',
    smooth: 'voice.sound.smooth',
    gravelly: 'voice.sound.gravelly',
    soft: 'voice.sound.soft',
    even: 'voice.sound.even',
    mature: 'voice.sound.mature',
    forward: 'voice.sound.forward',
    friendly: 'voice.sound.friendly',
    casual: 'voice.sound.casual',
    gentle: 'voice.sound.gentle',
    lively: 'voice.sound.lively',
    knowledgeable: 'voice.sound.knowledgeable',
    warm: 'voice.sound.warm',
  };

  // As the tool reads a model: Gemini's voices for Google's models and for Gemini through
  // OpenRouter, the ElevenLabs voices for ElevenLabs there, none it knows for any other.
  $: kind =
    !model.includes('/') || model.includes('gemini')
      ? ('gemini' as const)
      : model.startsWith('elevenlabs/')
        ? ('elevenlabs' as const)
        : null;
  $: family = kind ? voices[kind] : null;
  // A voice belongs to its model's family: another family starts at its usual voice.
  let shownKind: typeof kind | undefined;
  $: if (kind !== shownKind) {
    if (shownKind !== undefined) value = '';
    shownKind = kind;
  }
  $: sorted = family ? [...family.voices].sort((a, b) => a.name.localeCompare(b.name)) : [];
  // A voice the list does not have, such as one from Google's larger library, stays choosable.
  $: listed = !value || sorted.some((voice) => same(voice.name, value));

  function same(a: string, b: string) {
    return a.toLowerCase() === b.toLowerCase();
  }
  /** A voice by its name, as names are written ("daniel" is Daniel). */
  function named(name: string) {
    return name[0].toUpperCase() + name.slice(1);
  }
  function label(voice: Voice) {
    const sound = voice.sound && SOUNDS[voice.sound];
    return sound ? `${named(voice.name)} · ${$t(sound)}` : named(voice.name);
  }
</script>

{#if family}
  <select {name} aria-describedby={describedby} bind:value>
    <!-- Short, so it fits the field closed; the list shows the voice with how it sounds. -->
    <option value="">{$t('setup.models.usualVoice', { voice: named(family.usual) })}</option>
    {#if !listed}<option {value}>{value}</option>{/if}
    {#each sorted as voice (voice.name)}<option value={voice.name}>{label(voice)}</option>{/each}
  </select>
{:else}
  <input
    type="text"
    {name}
    autocomplete="off"
    spellcheck="false"
    {placeholder}
    aria-describedby={describedby}
    bind:value
  />
{/if}
