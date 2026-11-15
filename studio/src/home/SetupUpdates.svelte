<script lang="ts">
  // The version of this app and whether it looks for new ones by itself: a row of Setup.
  import { format, t } from '../i18n';
  import type { Overview } from '../types';
  import SetupItem from './SetupItem.svelte';
  import { busy, checkUpdate, saveSettings, updateOpen } from './session';

  export let overview: Overview;

  $: update = overview.update;
</script>

<ul class="setup-list">
  <SetupItem title={$t('setup.updates.version', { version: overview.version })} done={null}>
    <span
      >{#if update.available}<button class="text-link" onclick={() => updateOpen.set(true)}
          >{$t('update.buttonTitle', { version: update.available.version })}</button
        >{:else}{$t('setup.updates.newest')}{/if}
      {update.checkedAt
        ? $t('update.checked', { when: $format.ago(update.checkedAt, Date.now()) })
        : $t('update.neverChecked')}</span
    >
    <label class="setup-check"
      ><input
        type="checkbox"
        checked={overview.settings.checkForUpdates}
        onchange={(event) => saveSettings({ checkForUpdates: event.currentTarget.checked })}
      /><span>{$t('setup.updates.auto')}</span></label
    >
    <span>{$t('setup.updates.note')}</span>
    <svelte:fragment slot="action">
      <button class="button" disabled={$busy === 'update-check'} onclick={() => checkUpdate()}
        >{$busy === 'update-check' ? $t('update.checking') : $t('update.checkNow')}</button
      >
    </svelte:fragment>
  </SetupItem>
</ul>
