<script lang="ts">
  // One thing Setup looks at: whether it is there, what it is for, and the one action it needs.
  // Every item has the same three columns, so marks, names and buttons line up down the page.
  import Icon from '../Icon.svelte';
  import { t } from '../i18n';
  import { settle } from '../motion';

  export let title: string;
  export let done: boolean;
</script>

<li class="setup-item" class:done>
  <span class="setup-mark" aria-hidden="true"
    >{#if done}<span in:settle><Icon name="check" size={14} /></span>{/if}</span
  >
  <div class="setup-text">
    <strong>{title}<span class="sr-only">: {$t(done ? 'setup.done' : 'setup.todo')}</span></strong>
    <slot />
  </div>
  <div class="setup-action"><slot name="action" /></div>
  <slot name="below" />
</li>
