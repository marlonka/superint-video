<script lang="ts">
  // Setup: what has to be in place before a film can be made. Shown as the whole page while
  // something required is missing (`first`), and as one line that opens afterwards.
  import Icon from '../Icon.svelte';
  import { format, t } from '../i18n';
  import { unfold } from '../motion';
  import type { Agent, KeyCheck, KeyRow, Overview, Tool } from '../types';
  import SetupItem from './SetupItem.svelte';
  import { announce, busy, call, copyText, fail, needs, patch, refresh, run } from './session';

  export let overview: Overview;
  /** Setup is the page: the first thing a new user sees. */
  export let first = false;
  export let onskip: () => void = () => {};

  let open = false;
  // Keys: what is typed stays in this page until Save sends it once. It is never read back.
  let drafts: Record<string, string> = {};
  let replacing: Record<string, boolean> = {};
  let checks: Record<string, KeyCheck | 'checking'> = {};
  /** Tools whose installation window was opened from here. */
  let installing: Record<string, boolean> = {};

  /** What a key is used for, in the order Setup lists the models. */
  const ROLES = ['voice', 'timings', 'music'] as const;

  $: setup = overview.setup;
  $: missing = needs(overview);
  $: required = setup.tools.filter((tool) => !tool.optional);
  $: optional = setup.tools.filter((tool) => tool.optional);
  // The agent, each required tool, one key.
  $: total = required.length + 2;
  $: done =
    Number(!missing.includes('agent')) +
    required.filter((tool) => tool.ok).length +
    Number(setup.can.voice);
  $: shown = first || open;
  $: next = first ? nextItem(setup, missing) : '';
  $: readyParts = (['picture', 'voice', 'music', 'soundEffects'] as const)
    .filter((part) => setup.can[part])
    .map((part) => $t(`setup.part.${part}`));
  $: readyAgents = setup.agents.filter((agent) => agent.ready).map((agent) => agent.title);
  // Agents that work, with skills the app could bring to its own version.
  $: behind = setup.agents
    .filter((agent) => agent.ready && agent.canInstall && agent.outdated.length)
    .map((agent) => agent.title);

  /** The item whose action comes next. It alone carries the primary button. */
  function nextItem(state: Overview['setup'], open: typeof missing): string {
    if (open.includes('agent')) {
      const waiting = state.agents.find((agent) => agent.found && agent.canInstall);
      return `agent-${(waiting ?? state.agents[0]).id}`;
    }
    const tool = state.tools.find((item) => !item.optional && !item.ok);
    if (tool) return `tool-${tool.id}`;
    if (!open.includes('key')) return '';
    return `key-${(state.keys.find((key) => key.recommended) ?? state.keys[0]).name}`;
  }

  function installSkills(agent: Agent) {
    void run(`agent-${agent.id}`, async () => {
      const result = await call<{ copied: string[]; updated: string[]; agents: Agent[] }>(
        `/api/app/agents/${agent.id}/skills`,
      );
      patch({ setup: { ...overview.setup, agents: result.agents } });
      const [added, updated] = [result.copied.length, result.updated.length];
      announce(
        added && updated
          ? $t('setup.agent.synced', { agent: agent.title })
          : updated
            ? $t('setup.agent.updated', { count: updated, agent: agent.title })
            : added
              ? $t('setup.agent.added', { count: added, agent: agent.title })
              : $t('setup.agent.nothing'),
      );
    });
  }

  function installTool(tool: Tool) {
    void run(`tool-${tool.id}`, async () => {
      await call(`/api/app/tools/${tool.id}/install`);
      installing = { ...installing, [tool.id]: true };
    });
  }
  async function copyCommand(command: string) {
    if (!(await copyText(command, $t('common.copied')))) fail($t('common.copyBlocked'));
  }

  function saveKey(key: KeyRow) {
    const value = (drafts[key.name] || '').trim();
    if (!value) return;
    void run(`key-${key.name}`, async () => {
      const result = await call<{ keys: KeyRow[] }>(`/api/app/keys/${key.name}`, 'POST', {
        value,
      });
      drafts = { ...drafts, [key.name]: '' };
      replacing = { ...replacing, [key.name]: false };
      patch({ setup: { ...overview.setup, keys: result.keys } });
      await checkKey(key);
      void refresh();
    });
  }
  async function checkKey(key: KeyRow) {
    checks = { ...checks, [key.name]: 'checking' };
    let result: KeyCheck;
    try {
      result = await call<KeyCheck>(`/api/app/keys/${key.name}/test`);
    } catch (cause) {
      result = {
        ok: false,
        state: 'refused',
        detail: cause instanceof Error ? cause.message : String(cause),
      };
    }
    checks = { ...checks, [key.name]: result };
  }
  function removeKey(key: KeyRow) {
    void run(`key-${key.name}`, async () => {
      const result = await call<{ keys: KeyRow[] }>(`/api/app/keys/${key.name}`, 'DELETE');
      const { [key.name]: _gone, ...rest } = checks;
      checks = rest;
      patch({ setup: { ...overview.setup, keys: result.keys } });
      announce($t('setup.key.removed', { provider: key.title }));
      void refresh();
    });
  }
  /** What a check of a key found, in the app's language. */
  function checkText(check: KeyCheck): string {
    if (check.state === 'none') return $t('setup.key.check.none');
    if (check.state === 'refused')
      return $t('setup.key.check.refused', { detail: check.detail || '' });
    if (check.state === 'partial')
      return $t('setup.key.check.partial', { models: $format.and(check.missing || []) });
    if (typeof check.creditLeft === 'number')
      return $t('setup.key.check.credit', { amount: $format.dollars(check.creditLeft) });
    return $t(
      check.creditLeft === undefined ? 'setup.key.check.worksAll' : 'setup.key.check.works',
    );
  }
</script>

<!-- A page of another site, in a tab of its own. -->
{#snippet site(href: string, label: string, primary: boolean)}<a
    class="button"
    class:primary
    {href}
    target="_blank"
    rel="noreferrer">{label}<Icon name="external" size={16} /></a
  >{/snippet}

<section class={first ? 'first-run' : 'home-section'} aria-labelledby="setup-title">
  {#if first}
    <h1 id="setup-title">{$t('setup.first.title')}</h1>
    <p class="first-lead">{$t('setup.first.lead', { done, total })}</p>
  {:else}
    <div class="home-heading">
      <h2 id="setup-title">{$t('setup.title')}</h2>
      <p class="home-summary">
        {#if missing.length}{$t('setup.incomplete')}{:else if behind.length}{$t(
            'setup.skillsOutdated',
            { agents: $format.and(behind) },
          )}{:else}{$t('setup.ready', {
            parts: $format.and(readyParts),
          })}{readyAgents.length ? ` · ${$format.and(readyAgents)}` : ''}{/if}
      </p>
      <button class="button quiet" aria-expanded={shown} onclick={() => (open = !open)}
        >{$t(shown ? 'common.hide' : 'common.show')}</button
      >
    </div>
  {/if}

  {#if shown}
    <div class="setup" transition:unfold>
      <section class="setup-group" aria-labelledby="setup-agent">
        <header>
          <h3 id="setup-agent">{$t('setup.agent.title')}</h3>
          <p>{$t('setup.agent.why')}</p>
        </header>
        <ul class="setup-list">
          {#each setup.agents as agent (agent.id)}
            {@const id = `agent-${agent.id}`}
            <SetupItem title={agent.title} done={agent.ready}>
              <span
                >{#if !agent.found}{$t('setup.agent.absent')}{:else if agent.missing.length}{$t(
                    'setup.agent.missing',
                    { count: agent.missing.length, total: agent.skills },
                  )}{:else if agent.outdated.length}{$t('setup.agent.outdated', {
                    count: agent.outdated.length,
                  })}{:else}{$t('setup.agent.ready')}{/if}</span
              >
              <svelte:fragment slot="action">
                {#if !agent.found}{@render site(
                    agent.get,
                    $t('setup.get', { name: agent.title }),
                    next === id,
                  )}{:else if (agent.missing.length || agent.outdated.length) && agent.canInstall}<button
                    class="button"
                    class:primary={next === id}
                    title={agent.missing.length ? undefined : $t('setup.agent.updateHint')}
                    disabled={$busy === id}
                    onclick={() => installSkills(agent)}
                    >{$t(agent.missing.length ? 'setup.agent.add' : 'setup.agent.update')}</button
                  >{/if}
              </svelte:fragment>
            </SetupItem>
          {/each}
        </ul>
      </section>

      <section class="setup-group" aria-labelledby="setup-tools">
        <header>
          <h3 id="setup-tools">{$t('setup.tools.title')}</h3>
          <p>{$t('setup.tools.why')}</p>
        </header>
        <ul class="setup-list">
          {#each required as tool (tool.id)}
            {@const id = `tool-${tool.id}`}
            <SetupItem title={tool.title} done={tool.ok}>
              <span>{$t(`setup.tool.${tool.id}.why`)}</span>
              {#if !tool.ok && installing[tool.id]}<span class="setup-note" role="status"
                  >{$t('setup.tool.installing', { name: tool.title })}</span
                >{/if}
              {#if !tool.ok && tool.install}<a
                  class="text-link"
                  href={tool.get}
                  target="_blank"
                  rel="noreferrer">{$t('setup.tool.page')}</a
                >{/if}
              <svelte:fragment slot="action">
                {#if !tool.ok && tool.install}<button
                    class="button"
                    class:primary={next === id}
                    disabled={$busy === id}
                    onclick={() => installTool(tool)}>{$t('setup.tool.install')}</button
                  >{:else if !tool.ok}{@render site(
                    tool.get,
                    $t('setup.tool.page'),
                    next === id,
                  )}{/if}
              </svelte:fragment>
            </SetupItem>
          {/each}
        </ul>
      </section>

      <section class="setup-group" aria-labelledby="setup-keys">
        <header>
          <h3 id="setup-keys">{$t('setup.key.title')}</h3>
          <p>{$t('setup.key.why')}</p>
        </header>
        <ul class="setup-list">
          {#each setup.keys as key (key.name)}
            {@const id = `key-${key.name}`}
            {@const check = checks[key.name]}
            {@const typed = !!(drafts[key.name] || '').trim()}
            {@const own = key.present && key.source === 'app'}
            {@const refused = typeof check === 'object' && check.state === 'refused'}
            <SetupItem title={key.title} done={key.present && !refused}>
              <span>{$t(`setup.key.${key.name}.why`)}</span>
              <dl class="setup-models">
                {#each ROLES as role (role)}
                  <dt>{$t(`setup.models.${role}`)}</dt>
                  <dd>{key.models[role]}</dd>
                {/each}
              </dl>
              {#if key.present && key.source}<span>{$t(`setup.key.source.${key.source}`)}</span
                >{/if}
              {#if check === 'checking'}<span class="setup-note" role="status"
                  ><span class="loader small"></span>{$t('setup.key.asking', {
                    provider: key.title,
                  })}</span
                >{:else if check}<span class="setup-note" class:failed={!check.ok} role="status"
                  >{checkText(check)}</span
                >{/if}
              {#if own && !replacing[key.name]}<span class="setup-links">
                  <button
                    class="text-link"
                    onclick={() => (replacing = { ...replacing, [key.name]: true })}
                    >{$t('setup.key.replace')}</button
                  >
                  <button class="text-link" disabled={$busy === id} onclick={() => removeKey(key)}
                    >{$t('setup.key.remove')}</button
                  >
                </span>{/if}
              <svelte:fragment slot="action">
                {#if key.present}<button
                    class="button"
                    disabled={check === 'checking'}
                    onclick={() => checkKey(key)}>{$t('setup.key.check')}</button
                  >{:else}{@render site(key.get, $t('setup.key.get'), next === id && !typed)}{/if}
              </svelte:fragment>
              <svelte:fragment slot="below">
                {#if !key.present || (own && replacing[key.name])}
                  <form
                    class="key-form"
                    onsubmit={(event) => {
                      event.preventDefault();
                      saveKey(key);
                    }}
                  >
                    <input
                      type="password"
                      name={id}
                      autocomplete="off"
                      spellcheck="false"
                      placeholder={$t('setup.key.placeholder')}
                      aria-label={$t('setup.key.label', { provider: key.title })}
                      bind:value={drafts[key.name]}
                    />
                    <button
                      class="button"
                      class:primary={next === id && typed}
                      type="submit"
                      disabled={!typed || $busy === id}>{$t('common.save')}</button
                    >
                    {#if replacing[key.name]}<button
                        class="text-link"
                        type="button"
                        onclick={() => (replacing = { ...replacing, [key.name]: false })}
                        >{$t('common.cancel')}</button
                      >{/if}
                  </form>
                {/if}
              </svelte:fragment>
            </SetupItem>
          {/each}
        </ul>
      </section>

      {#if optional.length}
        <section class="setup-group" aria-labelledby="setup-optional">
          <header><h3 id="setup-optional">{$t('setup.optional.title')}</h3></header>
          <ul class="setup-list">
            {#each optional as tool (tool.id)}
              <SetupItem title={tool.title} done={tool.ok}>
                <span
                  >{$t(`setup.tool.${tool.id}.why`)}{tool.ok && tool.sounds
                    ? ` ${$t('setup.tool.sounds', { count: tool.sounds })}`
                    : ''}</span
                >
                {#if !tool.ok && tool.command}<button
                    class="text-link"
                    onclick={() => copyCommand(tool.command || '')}
                    >{$t('setup.tool.copyCommand', { command: tool.command })}</button
                  >{/if}
                <svelte:fragment slot="action">
                  {#if !tool.ok}{@render site(tool.get, $t('setup.tool.page'), false)}{/if}
                </svelte:fragment>
              </SetupItem>
            {/each}
          </ul>
        </section>
      {/if}

      <div class="setup-foot">
        {#if first}<button class="text-link" onclick={onskip}>{$t('setup.skip')}</button>{/if}
        <button class="button" onclick={() => refresh(true)}>{$t('setup.checkAgain')}</button>
      </div>
    </div>
  {/if}
</section>
