<script lang="ts">
  import { onMount } from 'svelte';
  import App from './App.svelte';
  import Home from './Home.svelte';
  import Icon from './Icon.svelte';
  import { accept, needs, overview, toast } from './home/session';
  import type { Overview } from './types';

  // The app is the same page everywhere: with a project it is the editor with the start page
  // one click away, without one it is the start page alone.
  let mode: 'loading' | 'home' | 'studio' = 'loading';
  let homeOpen = location.hash === '#home';
  /** The last confirmation, kept so its words stay while it fades out. */
  let said = '';
  $: if ($toast) said = $toast;

  onMount(async () => {
    try {
      const response = await fetch('/api/app');
      if (!response.ok) throw new Error('No start page');
      const first: Overview = await response.json();
      accept(first);
      mode = first.project ? 'studio' : 'home';
    } catch {
      // A Studio without a user folder is the editor alone.
      mode = 'studio';
    }
  });
</script>

{#if mode === 'home' && $overview}
  <Home overview={$overview} />
{:else if mode === 'studio'}
  <App
    inactive={homeOpen && !!$overview}
    onhome={$overview ? () => (homeOpen = true) : null}
    setupNeeds={$overview ? needs($overview) : []}
  />
  {#if homeOpen && $overview}
    <div class="home-layer">
      <Home overview={$overview} onclose={() => (homeOpen = false)} />
    </div>
  {/if}
{/if}
<div class="toast" class:visible={!!$toast} role="status" aria-live="polite">
  <Icon name="check" size={20} />{said}
</div>
