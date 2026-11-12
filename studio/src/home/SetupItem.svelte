<script lang="ts">
  // One thing Setup looks at: whether it is there, what it is for, and the one action it needs.
  // Every item has the same three columns, so marks, names and buttons line up down the page.
  import Icon from '../Icon.svelte';
  import { t } from '../i18n';
  import { settle } from '../motion';

  export let title: string;
  /** Null: nothing to get done here, so no mark. */
  export let done: boolean | null;
</script>

<li class="setup-item" class:done={done === true}>
  <span class="setup-mark" class:blank={done === null} aria-hidden="true"
    >{#if done}<span in:settle><Icon name="check" size={14} /></span>{/if}</span
  >
  <div class="setup-text">
    <strong
      >{title}{#if done !== null}<span class="sr-only"
          >: {$t(done ? 'setup.done' : 'setup.todo')}</span
        >{/if}</strong
    >
    <slot />
  </div>
  <div class="setup-action"><slot name="action" /></div>
  <slot name="below" />
</li>
