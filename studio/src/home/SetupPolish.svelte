<script lang="ts">
  // How many rounds of polish the coding agent runs before a render: a row of Setup, set once.
  // The app runs no polish itself; the CLI tells the agent the number and `render` waits for it.
  // Native radios give the keyboard its usual way through a choice of three: Tab to the group,
  // arrows to choose.
  import { onDestroy } from 'svelte';
  import { t, type MessageKey } from '../i18n';
  import type { Overview } from '../types';
  import SetupItem from './SetupItem.svelte';
  import { saveSettings } from './session';

  export let overview: Overview;

  const ROUNDS = [1, 2, 3] as const;
  /** What each choice brings and what it costs in time. */
  const WHAT: Record<(typeof ROUNDS)[number], MessageKey> = {
    1: 'setup.polish.what1',
    2: 'setup.polish.what2',
    3: 'setup.polish.what3',
  };
  /** Arrows move through the choice quickly; only the round they stop at is saved. */
  const SETTLE_MS = 250;

  /** What was chosen here and is not saved yet; null shows the saved choice. */
  let chosen: (typeof ROUNDS)[number] | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  $: saved = ROUNDS.find((rounds) => rounds === overview.settings.polishRounds) ?? 1;
  $: shown = chosen ?? saved;

  function save(rounds: (typeof ROUNDS)[number]) {
    timer = undefined;
    if (rounds === saved) {
      chosen = null;
      return;
    }
    void saveSettings(
      { polishRounds: rounds },
      $t('setup.polish.saved', { rounds: $t('setup.polish.rounds', { count: rounds }) }),
    ).then(() => {
      // Saved, the settings say it; refused, they still hold what was there before.
      if (chosen === rounds) chosen = null;
    });
  }
  function choose(rounds: (typeof ROUNDS)[number]) {
    chosen = rounds;
    clearTimeout(timer);
    timer = setTimeout(() => save(rounds), SETTLE_MS);
  }
  // Leaving Setup right after a choice still saves it.
  onDestroy(() => {
    if (timer === undefined || chosen === null) return;
    clearTimeout(timer);
    save(chosen);
  });
</script>

<ul class="setup-list">
  <SetupItem title={$t('setup.polish.choice')} done={null}>
    <span id="polish-rounds-what">{$t(WHAT[shown])}</span>
    <svelte:fragment slot="action">
      <div
        class="segmented"
        role="radiogroup"
        aria-label={$t('setup.polish.choice')}
        aria-describedby="polish-rounds-what"
      >
        {#each ROUNDS as rounds (rounds)}<label class:checked={shown === rounds}
            ><input
              type="radio"
              name="polish-rounds"
              value={rounds}
              checked={shown === rounds}
              aria-label={$t('setup.polish.rounds', { count: rounds })}
              onchange={() => choose(rounds)}
            /><span aria-hidden="true">{rounds}</span></label
          >{/each}
      </div>
    </svelte:fragment>
  </SetupItem>
</ul>
