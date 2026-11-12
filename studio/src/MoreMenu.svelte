<script lang="ts">
  // A "more" button and the menu of actions it opens. Arrow keys, Home and End move through the
  // actions; Escape, a chosen action or a click anywhere else closes it.
  import Icon from './Icon.svelte';

  export let label: string;
  export let open = false;
  /** The wrapper's class, which places the menu. */
  export let place = '';
  export let button = 'icon-button';

  let wrapper: HTMLElement;
  let toggle: HTMLButtonElement;

  const items = () =>
    Array.from(wrapper.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));

  function close() {
    open = false;
    toggle.focus();
  }
  function key(event: KeyboardEvent) {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const moves: Record<string, number> = {
      ArrowDown: at + 1,
      ArrowUp: at - 1 + list.length,
      Home: 0,
      End: list.length - 1,
    };
    if (event.key === 'Escape') close();
    else if (event.key in moves) list[moves[event.key] % list.length]?.focus();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }
  function chosen(event: MouseEvent) {
    if ((event.target as Element).closest('[role="menuitem"]')) close();
  }
  /** The first action has the focus as soon as the menu is there. */
  function focusFirst(_node: HTMLElement) {
    queueMicrotask(() => items()[0]?.focus());
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    if (open && !wrapper.contains(event.target as Node)) open = false;
  }}
/>

<div class={place} bind:this={wrapper}>
  <button
    bind:this={toggle}
    class={button}
    aria-label={label}
    title={label}
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={() => (open = !open)}><Icon name="more" /><slot name="badge" /></button
  >
  {#if open}<div
      class="more-menu"
      role="menu"
      aria-label={label}
      tabindex="-1"
      use:focusFirst
      onkeydown={key}
      onclick={chosen}
    >
      <slot />
    </div>{/if}
</div>
