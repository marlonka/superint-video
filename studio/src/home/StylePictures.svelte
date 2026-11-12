<script lang="ts">
  // The picture on a style's card: one at a time, 16:9, cropped to fill. Up to three take turns
  // with the other cards' (turns.ts): the next fades in over the last, and the one in front
  // drifts a little closer while it stays. Less motion keeps the first picture, still.
  import { onDestroy, onMount } from 'svelte';
  import { lessMotion } from '../motion';
  import { FADE, STAY, join } from './turns';

  /** Picture addresses, the first one first. */
  export let sources: string[];

  /** Where each picture drifts towards, by its place. */
  const TOWARDS = ['50% 45%', '35% 55%', '65% 50%'];

  let frame: HTMLElement;
  let failed: string[] = [];
  /** The picture in front, and the one it is fading in over. */
  let shown = 0;
  let under = -1;
  let settled: ReturnType<typeof setTimeout> | undefined;
  let leave = () => {};

  $: pictures = sources.filter((source) => !failed.includes(source)).slice(0, $lessMotion ? 1 : 3);
  $: if (shown >= pictures.length) {
    shown = 0;
    under = -1;
  }

  /** Moves on to the next picture that has loaded; false when there is none yet. */
  function next() {
    const images = [...frame.querySelectorAll('img')];
    for (let step = 1; step < images.length; step++) {
      const index = (shown + step) % images.length;
      const image = images[index];
      if (!image.complete || !image.naturalWidth) continue;
      clearTimeout(settled);
      under = shown;
      shown = index;
      // Once the new one covers it, the old one leaves, ready to fade in again later.
      settled = setTimeout(() => (under = -1), FADE + 100);
      return true;
    }
    return false;
  }

  onMount(() => {
    leave = join(frame, () => pictures.length > 1, next);
  });
  onDestroy(() => {
    leave();
    clearTimeout(settled);
  });
</script>

<div
  class="style-pictures"
  class:turning={pictures.length > 1}
  style:--fade="{FADE}ms"
  style:--drift="{STAY + 2 * FADE + 2000}ms"
  bind:this={frame}
>
  {#each pictures as source, index (source)}<img
      class="style-picture"
      class:shown={index === shown}
      class:under={index === under}
      style:transform-origin={TOWARDS[index]}
      src={source}
      alt=""
      loading="lazy"
      decoding="async"
      draggable="false"
      onerror={() => (failed = [...failed, source])}
    />{/each}<slot />
</div>
