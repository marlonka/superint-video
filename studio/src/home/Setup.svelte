<script lang="ts">
  // Setup: what has to be in place before a film can be made, and the choices made once. It is
  // the whole page while something required is missing (`first`), and a page of its own the
  // header opens afterwards.
  import Icon from '../Icon.svelte';
  import { format, t, type MessageKey } from '../i18n';
  import { unfold } from '../motion';
  import type { Agent, KeyCheck, KeyRow, Overview, Settings, Tool, UsualModels } from '../types';
  import SetupFilms from './SetupFilms.svelte';
  import SetupItem from './SetupItem.svelte';
  import SetupPolish from './SetupPolish.svelte';
  import VoiceChoice from './VoiceChoice.svelte';
  import {
    announce,
    busy,
    call,
    copyText,
    fail,
    needs,
    patch,
    refresh,
    reveal,
    run,
    saveSettings,
    skillsBehind,
  } from './session';

  export let overview: Overview;
  /** Setup is the page: the first thing a new user sees. */
  export let first = false;
  export let onskip: () => void = () => {};
  /** Leaves Setup once everything required is there: the first film is next. */
  export let oncontinue: () => void = () => {};
  /** Back to the start page, when Setup was opened from the header. */
  export let onclose: (() => void) | null = null;

  type Location = 'eu' | 'us' | 'global';
  type Step = 'agent' | 'tools' | 'keys';
  type ModelSetting =
    | 'narrationModel'
    | 'narrationVoice'
    | 'transcriptionModel'
    | 'musicModel'
    | 'dictationModel'
    | 'styleModel';

  /** What a key is used for, in the order Setup lists the models. */
  const ROLES = ['voice', 'timings', 'music', 'dictation', 'style'] as const;
  /** Google Cloud's regions; the EU is the default. */
  const LOCATIONS: Location[] = ['eu', 'us', 'global'];
  /** The fields of the models form: the setting, its label and the usual value it shows. */
  const MODEL_FIELDS: { setting: ModelSetting; label: MessageKey; usual: keyof UsualModels }[] = [
    { setting: 'narrationModel', label: 'setup.models.field.narration', usual: 'narration' },
    { setting: 'narrationVoice', label: 'setup.models.field.voice', usual: 'voice' },
    { setting: 'transcriptionModel', label: 'setup.models.timings', usual: 'transcription' },
    { setting: 'musicModel', label: 'setup.models.music', usual: 'music' },
    { setting: 'dictationModel', label: 'setup.models.dictation', usual: 'dictation' },
    { setting: 'styleModel', label: 'setup.models.style', usual: 'style' },
  ];

  // Keys: what is typed stays in this page until Save sends it once. It is never read back.
  let drafts: Record<string, string> = {};
  let replacing: Record<string, boolean> = {};
  let checks: Record<string, KeyCheck | 'checking'> = {};
  /** Tools whose installation window was opened from here. */
  let installing: Record<string, boolean> = {};
  /** The providers few people need are folded away until asked for or holding a key. */
  let moreOpen = false;
  /** Google Cloud: the user chose a key over the Google sign-in. */
  let cloudByKey = false;
  /** Google Cloud: the sign-in window was opened from here. */
  let signingIn = false;
  // Google Cloud's project and region, while they are being changed.
  let placeOpen = false;
  let placeProject = '';
  let placeLocation: Location = 'eu';
  // The models form, for people who know the exact model IDs.
  let modelsOpen = false;
  let modelDrafts: Record<ModelSetting, string> = {
    narrationModel: '',
    narrationVoice: '',
    transcriptionModel: '',
    musicModel: '',
    dictationModel: '',
    styleModel: '',
  };

  $: setup = overview.setup;
  $: settings = overview.settings;
  $: missing = needs(overview);
  $: required = setup.tools.filter((tool) => !tool.optional);
  $: optional = setup.tools.filter((tool) => tool.optional);
  // Three steps before the first film: an agent with the skills, the tools, a key. What comes
  // after them is optional and has no number.
  $: steps = {
    agent: !missing.includes('agent'),
    tools: required.every((tool) => tool.ok),
    keys: setup.can.voice,
  };
  $: total = Object.keys(steps).length;
  $: done = Object.values(steps).filter(Boolean).length;
  $: current = (Object.keys(steps) as Step[]).find((step) => !steps[step]);
  $: next = first ? nextItem(setup, missing) : '';
  $: readyParts = (['picture', 'voice', 'music', 'soundEffects'] as const)
    .filter((part) => setup.can[part])
    .map((part) => $t(`setup.part.${part}`));
  $: readyAgents = setup.agents.filter((agent) => agent.ready).map((agent) => agent.title);
  $: behind = skillsBehind(setup).map((agent) => agent.title);
  $: mainKeys = setup.keys.filter((key) => !key.more);
  $: moreKeys = setup.keys.filter((key) => key.more);
  // A provider with a key stays in sight.
  $: moreHeld = moreKeys.some((key) => key.present);
  $: moreShown = moreOpen || moreHeld;
  $: chosenModels = MODEL_FIELDS.filter((field) => settings[field.setting]);

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
  /** Chrome DevTools MCP: its project, and the coding agents that have it or lack it. */
  const BROWSER_PAGE = 'https://github.com/ChromeDevTools/chrome-devtools-mcp';
  $: agentsHere = setup.agents.filter((agent) => agent.found);
  $: withBrowser = agentsHere.filter((agent) => agent.browser).map((agent) => agent.title);
  $: withoutBrowser = agentsHere.filter((agent) => !agent.browser).map((agent) => agent.title);
  async function copyBrowserTask() {
    const task = $t('setup.browser.task', { url: BROWSER_PAGE });
    if (!(await copyText(task, $t('setup.tool.taskCopied')))) fail($t('common.copyBlocked'));
  }

  /** A task the coding agent can carry out instead of the user typing commands. */
  async function copyTask(tool: Tool) {
    // Earshot is the one tool that comes with a command of its own.
    const task = $t('setup.tool.earshot.task', { command: tool.command || '', url: tool.get });
    if (!(await copyText(task, $t('setup.tool.taskCopied')))) fail($t('common.copyBlocked'));
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
  function checkText(key: KeyRow, check: KeyCheck): string {
    if (check.state === 'none') return $t('setup.key.check.none');
    if (check.state === 'refused')
      return [
        $t('setup.key.check.refused', { detail: check.detail || '' }),
        // The EU address takes only projects that live in the EU, which most do not.
        key.region === 'eu' ? $t('setup.openai.euRefused') : '',
      ]
        .filter(Boolean)
        .join(' ');
    if (check.state === 'partial')
      return $t('setup.key.check.partial', { models: $format.and(check.missing || []) });
    if (typeof check.creditLeft === 'number')
      return $t('setup.key.check.credit', { amount: $format.dollars(check.creditLeft) });
    if (check.creditLeft !== undefined) return $t('setup.key.check.works');
    if (key.name === 'OPENAI_API_KEY') return $t('setup.key.check.worksDictation');
    if (key.name === 'GOOGLE_CLOUD_API_KEY') return $t('setup.key.check.worksCloud');
    return $t('setup.key.check.worksAll');
  }

  /** Opens the window that signs the user in with Google; the app notices the sign-in itself. */
  function signIn() {
    void run('google-sign-in', async () => {
      await call('/api/app/google/sign-in');
      signingIn = true;
    });
  }
  function openPlace() {
    placeProject = settings.googleCloudProject ?? '';
    placeLocation = settings.googleCloudLocation ?? 'eu';
    placeOpen = true;
  }
  /** Saves where a key's requests go and asks the provider again; says whether it was saved. */
  async function saveAndCheck(key: KeyRow, changes: Partial<Settings>, said: string) {
    const saved = await saveSettings(changes, said);
    if (saved) {
      await refresh();
      if (key.present) await checkKey(key);
    }
    return saved;
  }
  function savePlace(key: KeyRow) {
    // The server cleans the project ID; the EU is the default and is saved as no choice.
    void saveAndCheck(
      key,
      {
        googleCloudProject: placeProject || null,
        googleCloudLocation: placeLocation === 'eu' ? null : placeLocation,
      },
      $t('setup.cloud.saved'),
    ).then((saved) => {
      if (saved) placeOpen = false;
    });
  }
  function setOpenAiRegion(key: KeyRow, eu: boolean) {
    void saveAndCheck(
      key,
      { openAiRegion: eu ? 'eu' : null },
      $t('setup.openai.saved', { address: eu ? 'eu.api.openai.com' : 'api.openai.com' }),
    );
  }

  function openModels() {
    for (const field of MODEL_FIELDS) modelDrafts[field.setting] = settings[field.setting] ?? '';
    modelsOpen = true;
  }
  /** Saves the typed models; an empty field keeps the usual one. */
  function saveModels(reset = false) {
    // The server cleans what was pasted: spaces, quotes, the `models/` Google puts in front.
    const changes: Partial<Record<ModelSetting, string | null>> = {};
    for (const field of MODEL_FIELDS)
      changes[field.setting] = (!reset && modelDrafts[field.setting]) || null;
    // A model the server refused leaves the form open with what was typed.
    void saveSettings(changes, $t('setup.models.saved')).then(async (saved) => {
      if (!saved) return;
      modelsOpen = false;
      // The key checks name the dictation model.
      await refresh();
    });
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

<!-- One provider's key: what it is for, the models it serves, its check and its field. -->
{#snippet keyItem(key: KeyRow)}
  {@const id = `key-${key.name}`}
  {@const check = checks[key.name]}
  {@const typed = !!(drafts[key.name] || '').trim()}
  {@const own = key.present && key.source === 'app'}
  {@const refused = typeof check === 'object' && check.state === 'refused'}
  {@const google = !!key.place && !key.present}
  <SetupItem title={key.title} done={key.present && key.ready !== false && !refused}>
    <span>{$t(`setup.key.${key.name}.why`)}</span>
    <dl class="setup-models">
      {#each ROLES.filter((role) => key.models[role]) as role (role)}
        <dt>{$t(`setup.models.${role}`)}</dt>
        <dd>{key.models[role]}</dd>
      {/each}
    </dl>
    {#if google}<span>{$t('setup.cloud.signInWhy')}</span>
      {#if signingIn}<span class="setup-note" role="status">{$t('setup.cloud.signingIn')}</span
        >{/if}
      {#if !cloudByKey}<button class="text-link" onclick={() => (cloudByKey = true)}
          >{$t('setup.cloud.useKey')}</button
        >{/if}
    {/if}
    {#if key.place && (key.present || cloudByKey)}
      {#if key.source === 'google' && !key.place.project}<span class="setup-note failed"
          >{$t('setup.cloud.needsProject')}</span
        >{:else}<span
          >{key.place.project
            ? $t('setup.cloud.place', {
                project: key.place.project,
                location: key.place.location,
              })
            : $t('setup.cloud.express')}
          {#if key.place.fixed}{$t('setup.cloud.fixed')}{/if}</span
        >{/if}
      {#if !key.place.fixed && !placeOpen}<button
          class="text-link"
          aria-label={$t('setup.cloud.changeFor')}
          onclick={openPlace}>{$t('setup.cloud.change')}</button
        >{/if}
    {/if}
    {#if key.region}
      <label class="setup-check"
        ><input
          type="checkbox"
          checked={key.region === 'eu'}
          disabled={$busy === 'settings'}
          onchange={(event) => setOpenAiRegion(key, event.currentTarget.checked)}
        /><span>{$t('setup.openai.eu')}</span></label
      >
      <span class="model-hint">{$t('setup.openai.euHint')}</span>
    {/if}
    {#if key.present && key.source}<span>{$t(`setup.key.source.${key.source}`)}</span>{/if}
    {#if check === 'checking'}<span class="setup-note" role="status"
        ><span class="loader small"></span>{$t('setup.key.asking', {
          provider: key.title,
        })}</span
      >{:else if check}<span class="setup-note" class:failed={!check.ok} role="status"
        >{checkText(key, check)}</span
      >{/if}
    {#if own && !replacing[key.name]}<span class="setup-links">
        <button class="text-link" onclick={() => (replacing = { ...replacing, [key.name]: true })}
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
        >{:else if google}<button
          class="button"
          disabled={$busy === 'google-sign-in'}
          onclick={signIn}>{$t('setup.cloud.signIn')}</button
        >{:else}{@render site(key.get, $t('setup.key.get'), next === id && !typed)}{/if}
    </svelte:fragment>
    <svelte:fragment slot="below">
      {#if (!key.present && (!google || cloudByKey)) || (own && replacing[key.name])}
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
      {#if key.place && placeOpen}
        <form
          class="key-form place-form"
          transition:unfold
          onsubmit={(event) => {
            event.preventDefault();
            savePlace(key);
          }}
        >
          <div class="place-fields">
            <input
              type="text"
              name="google-cloud-project"
              autocomplete="off"
              spellcheck="false"
              placeholder={$t('setup.cloud.project')}
              aria-label={$t('setup.cloud.project')}
              aria-describedby="place-hint"
              bind:value={placeProject}
            />
            <select aria-label={$t('setup.cloud.location')} bind:value={placeLocation}>
              {#each LOCATIONS as location (location)}<option value={location}
                  >{$t(`setup.cloud.location.${location}`)}</option
                >{/each}
            </select>
          </div>
          <button class="button" type="submit" disabled={$busy === 'settings'}
            >{$t('common.save')}</button
          >
          <span class="model-hint" id="place-hint">{$t('setup.cloud.hint')}</span>
          <span class="setup-links"
            ><button class="text-link" type="button" onclick={() => (placeOpen = false)}
              >{$t('common.cancel')}</button
            ></span
          >
        </form>
      {/if}
    </svelte:fragment>
  </SetupItem>
{/snippet}

<!-- A group's title and what it is for. The three required steps carry their number, or a
     check once done; optional groups keep the column free, so every title starts in one line. -->
{#snippet heading(step: Step | null, id: string, title: string, why: string)}
  <header class="setup-heading">
    <span
      class="setup-step"
      class:numbered={step}
      class:done={step && steps[step]}
      class:current={step && current === step}
      aria-hidden="true"
      >{#if step && steps[step]}<Icon name="check" size={14} />{:else if step}{Object.keys(
          steps,
        ).indexOf(step) + 1}{/if}</span
    >
    <h3 {id}>
      {title}{#if step}<span class="sr-only">: {$t(steps[step] ? 'setup.done' : 'setup.todo')}</span
        >{/if}
    </h3>
    <p>{why}</p>
  </header>
{/snippet}

<section class={first ? 'first-run' : 'home-section'} aria-labelledby="setup-title">
  {#if first}
    <h1 id="setup-title">{$t('setup.first.title')}</h1>
    <p class="first-lead">
      {done === total ? $t('setup.first.ready') : $t('setup.first.lead', { done, total })}
    </p>
    <div class="setup-progress" aria-hidden="true">
      {#each Object.values(steps) as step, index (index)}<span class:done={step}></span>{/each}
    </div>
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
    </div>
  {/if}

  <div class="setup">
    <section class="setup-group" aria-labelledby="setup-agent">
      {@render heading('agent', 'setup-agent', $t('setup.agent.title'), $t('setup.agent.why'))}
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
      {@render heading('tools', 'setup-tools', $t('setup.tools.title'), $t('setup.tools.why'))}
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
      {@render heading('keys', 'setup-keys', $t('setup.key.title'), $t('setup.key.why'))}
      <div class="setup-keys">
        <ul class="setup-list">
          {#each mainKeys as key (key.name)}{@render keyItem(key)}{/each}
        </ul>
        {#if moreKeys.length && !moreHeld}<button
            class="text-link setup-more"
            aria-expanded={moreShown}
            aria-controls="setup-more-keys"
            onclick={() => (moreOpen = !moreOpen)}
            >{$t('setup.more.toggle', {
              providers: $format.and(moreKeys.map((key) => key.title)),
            })}</button
          >{/if}
        {#if moreShown}
          <ul class="setup-list" id="setup-more-keys" transition:unfold>
            {#each moreKeys as key (key.name)}{@render keyItem(key)}{/each}
          </ul>
        {/if}
      </div>
    </section>

    {#if !first}
      <section class="setup-group" aria-labelledby="setup-films">
        {@render heading(null, 'setup-films', $t('setup.films.title'), $t('setup.films.why'))}
        <SetupFilms {overview} />
      </section>

      <section class="setup-group" aria-labelledby="setup-polish">
        {@render heading(null, 'setup-polish', $t('setup.polish.title'), $t('setup.polish.why'))}
        <SetupPolish {overview} />
      </section>

      <section class="setup-group" aria-labelledby="setup-models">
        {@render heading(null, 'setup-models', $t('setup.models.title'), $t('setup.models.why'))}
        <ul class="setup-list">
          <SetupItem
            title={$t(chosenModels.length ? 'setup.models.own' : 'setup.models.usual')}
            done={null}
          >
            <span
              >{chosenModels.length
                ? chosenModels
                    .map((field) => `${$t(field.label)} ${settings[field.setting]}`)
                    .join(' · ')
                : $t('setup.models.usualWhy')}</span
            >
            <svelte:fragment slot="action">
              <button
                class="button"
                aria-expanded={modelsOpen}
                aria-controls="models-form"
                onclick={() => (modelsOpen ? (modelsOpen = false) : openModels())}
                >{$t('setup.models.change')}</button
              >
            </svelte:fragment>
            <svelte:fragment slot="below">
              {#if modelsOpen}
                <form
                  class="models-form"
                  id="models-form"
                  transition:unfold
                  onsubmit={(event) => {
                    event.preventDefault();
                    saveModels();
                  }}
                >
                  <div class="models-fields">
                    {#each MODEL_FIELDS as field (field.setting)}
                      <label
                        ><span>{$t(field.label)}</span>
                        {#if field.setting === 'narrationVoice'}<VoiceChoice
                            model={modelDrafts.narrationModel.trim() || setup.models.narration}
                            voices={setup.voices}
                            name={field.setting}
                            placeholder={setup.models.voice}
                            describedby="models-hint"
                            bind:value={modelDrafts.narrationVoice}
                          />{:else}<input
                            type="text"
                            class="model-id"
                            name={field.setting}
                            autocomplete="off"
                            spellcheck="false"
                            placeholder={setup.models[field.usual]}
                            aria-describedby="models-hint"
                            bind:value={modelDrafts[field.setting]}
                          />{/if}</label
                      >
                    {/each}
                  </div>
                  <p class="model-hint" id="models-hint">{$t('setup.models.hint')}</p>
                  <button class="button" type="submit" disabled={$busy === 'settings'}
                    >{$t('common.save')}</button
                  >
                  <span class="setup-links">
                    {#if chosenModels.length}<button
                        class="text-link"
                        type="button"
                        disabled={$busy === 'settings'}
                        onclick={() => saveModels(true)}>{$t('setup.models.reset')}</button
                      >{/if}
                    <button class="text-link" type="button" onclick={() => (modelsOpen = false)}
                      >{$t('common.cancel')}</button
                    >
                  </span>
                </form>
              {/if}
            </svelte:fragment>
          </SetupItem>
        </ul>
      </section>
    {/if}

    {#if optional.length}
      <section class="setup-group" aria-labelledby="setup-optional">
        {@render heading(
          null,
          'setup-optional',
          $t('setup.optional.title'),
          $t('setup.optional.why'),
        )}
        <ul class="setup-list">
          {#each optional as tool (tool.id)}
            <SetupItem title={tool.title} done={tool.ok}>
              <span
                >{$t(`setup.tool.${tool.id}.why`)}{tool.ok && tool.sounds
                  ? ` ${$t('setup.tool.sounds', { count: tool.sounds })}`
                  : ''}</span
              >
              {#if !tool.ok && installing[tool.id]}<span class="setup-note" role="status"
                  >{$t('setup.tool.installing', { name: tool.title })}</span
                >{/if}
              {#if !tool.ok}<span class="setup-links">
                  {#if tool.command}<button class="text-link" onclick={() => copyTask(tool)}
                      >{$t('setup.tool.copyTask')}</button
                    >{/if}
                  <a class="text-link" href={tool.get} target="_blank" rel="noreferrer"
                    >{$t('setup.tool.project')}</a
                  >
                </span>{/if}
              <svelte:fragment slot="action">
                {#if !tool.ok && tool.install}<button
                    class="button"
                    disabled={$busy === `tool-${tool.id}`}
                    onclick={() => installTool(tool)}>{$t('setup.tool.install')}</button
                  >{:else if !tool.ok}{@render site(tool.get, $t('setup.tool.page'), false)}{/if}
              </svelte:fragment>
            </SetupItem>
          {/each}
          <SetupItem
            title="Chrome DevTools MCP"
            done={agentsHere.length > 0 && withoutBrowser.length === 0}
          >
            <span
              >{$t('setup.browser.why')}{withBrowser.length
                ? ` ${$t('setup.browser.has', { agents: $format.and(withBrowser) })}`
                : ''}{withBrowser.length && withoutBrowser.length
                ? ` ${$t('setup.browser.lacks', { agents: $format.and(withoutBrowser) })}`
                : ''}</span
            >
            {#if !agentsHere.length || withoutBrowser.length}<span class="setup-links"
                ><a class="text-link" href={BROWSER_PAGE} target="_blank" rel="noreferrer"
                  >{$t('setup.tool.project')}</a
                ></span
              >{/if}
            <svelte:fragment slot="action">
              {#if !agentsHere.length || withoutBrowser.length}<button
                  class="button"
                  onclick={copyBrowserTask}>{$t('setup.browser.copy')}</button
                >{/if}
            </svelte:fragment>
          </SetupItem>
        </ul>
      </section>
    {/if}

    <div class="setup-foot">
      {#if first && done < total}<button class="text-link" onclick={onskip}
          >{$t('setup.skip')}</button
        >{:else if !first}<button class="text-link" onclick={() => reveal('/api/app/reveal/home')}
          >{$t('setup.settingsFolder')}</button
        >{/if}
      <span class="setup-foot-actions">
        <button class="button" onclick={() => refresh(true)}>{$t('setup.checkAgain')}</button>
        {#if first && done === total}<button class="button primary" onclick={oncontinue}
            >{$t('setup.continue')}</button
          >{:else if onclose}<button class="button primary" onclick={onclose}
            >{$t('setup.close')}</button
          >{/if}
      </span>
    </div>
  </div>
</section>
