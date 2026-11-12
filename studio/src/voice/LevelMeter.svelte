<script lang="ts">
  // How loud the microphone hears the user, as one thin line that follows the voice at once
  // and falls back gently. It says so in words when the voice is too loud.
  import { onDestroy } from 'svelte';
  import { t } from '../i18n';

  /** The current level from 0 to 1; null while no microphone is open. */
  export let level: (() => number) | null;

  /** From here on the recording is close to clipping. */
  const LOUD = 0.94;
  let shown = 0;
  let loud = false;
  let loudUntil = 0;
  let frame = 0;

  $: if (level) {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(follow);
  } else {
    cancelAnimationFrame(frame);
    shown = 0;
    loud = false;
  }

  function follow(now: number) {
    if (!level) return;
    const heard = level();
    // Up at once, down slowly: a meter that flickers cannot be read.
    shown = heard > shown ? heard : shown + (heard - shown) * 0.12;
    if (heard >= LOUD) loudUntil = now + 1500;
    loud = now < loudUntil;
    frame = requestAnimationFrame(follow);
  }

  onDestroy(() => cancelAnimationFrame(frame));
</script>

<div class="voice-meter" class:open={!!level} class:loud>
  <div class="voice-meter-track" aria-hidden="true">
    <span style={`transform:scaleX(${shown.toFixed(3)})`}></span>
  </div>
  <span class="voice-meter-note" role="status">{loud ? $t('voice.tooLoud') : ''}</span>
</div>
