<script lang="ts">
  // The notice wherever Setup is unfinished but not in front: on the start page and in Studio.
  import Icon from '../Icon.svelte';
  import { t } from '../i18n';
  import type { SetupNeed } from './session';

  export let missing: SetupNeed[];
  export let onfinish: () => void;
  /** Puts the notice away for now. Without it the notice stays. */
  export let onlater: (() => void) | null = null;
</script>

<div class="setup-banner" role="status">
  <Icon name="alert" size={24} />
  <div>
    <strong>{$t('setup.banner.title')}</strong>
    <span>{missing.map((need) => $t(`setup.effect.${need}`)).join(' ')}</span>
  </div>
  <button class="button primary" onclick={onfinish}>{$t('setup.banner.action')}</button>
  {#if onlater}<button class="button quiet" onclick={onlater}>{$t('setup.banner.later')}</button
    >{/if}
</div>
