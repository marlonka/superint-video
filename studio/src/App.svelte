<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Icon from './Icon.svelte';
  import Logo from './Logo.svelte';
  import MoreMenu from './MoreMenu.svelte';
  import RenderLive from './RenderLive.svelte';
  import SetupBanner from './home/SetupBanner.svelte';
  import { announce, call, setLanguage, trust, type SetupNeed } from './home/session';
  import { LOCALES, filmClock, format, locale, t, type MessageKey } from './i18n';
  import { theme, toggleTheme } from './theme';
  import type {
    Asset,
    Clip,
    Diagnostic,
    Live,
    Polish,
    PolishRow,
    Project,
    PropDefinition,
    RenderJob,
    TextSpot,
    Track,
    Transform,
  } from './types';

  /** Opens the start page; null when this Studio has none. */
  export let onhome: (() => void) | null = null;
  /** The start page is in front: keys belong to it. */
  export let inactive = false;
  /** What Setup still misses; a notice nobody can overlook leads there. */
  export let setupNeeds: SetupNeed[] = [];

  let project: Project | null = null;
  let live: Live = { render: null, running: [] };
  let closedRender = 0;
  try {
    closedRender = Number(localStorage.getItem('superint-closed-render')) || 0;
  } catch {
    /* Without storage a finished film simply shows again after a reload. */
  }
  let loading = true;
  let saving = false;
  type SaveState =
    'saved' | 'saving' | 'conflict' | 'unsaved' | 'updated' | 'invalid' | 'reconnecting';
  let saveState: SaveState = 'saved';
  /** The setup notice was put aside until this page is loaded again. */
  let setupLater = false;
  let error = '';
  let conflict = false;
  let recovery = '';
  let selection = '';
  let selectedAsset = '';
  let frame = 0;
  let playing = false;
  let playerReady = false;
  /** Where the paused picture shows texts the user can retype, from the player. */
  let texts: TextSpot[] = [];
  let editingText: TextSpot | null = null;
  let textDraft = '';
  let textEditor: HTMLTextAreaElement | undefined;
  let player: HTMLIFrameElement;
  let importInput: HTMLInputElement;
  let timeline: HTMLDivElement;
  let previewViewport: HTMLDivElement;
  let timelineViewportWidth = 1000;
  let previewWidth = 800;
  let previewHeight = 450;
  let previewPaddingX = 48;
  let previewPaddingY = 48;
  let propDefinitions: Record<string, Record<string, PropDefinition>> = {};
  let search = '';
  let assetFilter = 'all';
  let snapping = true;
  let zoom = 1;
  let previewScale = 'fit';
  let leftOpen = false;
  let rightOpen = false;
  let inspectorMode: 'clip' | 'project' | 'production' = 'clip';
  let documentView: { path: string; text: string } | null = null;
  let polishOpen = false;
  let polishFilter: 'all' | 'defect' | 'open' | 'fine' = 'all';
  let polishFile = '';
  let clock = Date.now();
  let productionShown = false;
  let leftWidth = 300;
  let rightWidth = 320;
  let timelineHeight = 280;
  let moreOpen = false;
  let lastCheckFrames: number | null = null;
  let snapFrame: number | null = null;
  let draftClip: Clip | null = null;
  let drag: { kind: 'move' | 'left' | 'right'; clip: Clip; x: number; startTrack: string } | null =
    null;
  let scrub = false;
  let resize: {
    kind: 'left' | 'right' | 'timeline';
    x: number;
    y: number;
    initial: number;
  } | null = null;
  let diagnostics: Diagnostic[] = [];
  let checking = false;
  let diagnosticsOpen = false;
  let exportOpen = false;
  let shortcutsOpen = false;
  let output = 'renders/video.mp4';
  let quality: 'draft' | 'final' = 'final';
  let overwrite = false;
  let job: RenderJob | null = null;
  let exportStarting = false;
  let exportError = '';
  let renderTimer: ReturnType<typeof setTimeout>;
  let importBusy = false;
  let droppedFiles = false;
  let contextDialog = '';
  let contextArea: HTMLTextAreaElement;
  let headerTitle: HTMLInputElement;
  let metadataRequested = new Set<string>();
  let assetMetadata: Record<string, Partial<Asset>> = {};
  type EditOperation = Record<string, unknown>;
  type PendingEdit = {
    operation: EditOperation | (() => EditOperation);
    resolve: (succeeded: boolean) => void;
  };
  let pendingEdits: PendingEdit[] = [];
  let drainingEdits = false;
  type EditorDraft = {
    element: HTMLInputElement | HTMLTextAreaElement;
    value: string;
    clipId: string;
    label: string;
  };
  const dirtyDrafts = new Map<HTMLElement, EditorDraft>();

  $: manifest = project?.manifest;
  $: fps = manifest ? manifest.fps.num / manifest.fps.den : 30;
  $: duration = manifest?.durationFrames || 1;
  $: selected =
    draftClip?.id === selection ? draftClip : manifest?.clips.find((clip) => clip.id === selection);
  $: selectedDefinitions = propDefinitions[selection] || {};
  $: inspectorVisible = rightOpen && (inspectorMode !== 'clip' || !!selected);
  $: production = project?.production;
  $: polish = production?.polish || null;
  $: polishRows = (polish?.rows || []).filter((row) =>
    polishFilter === 'all'
      ? true
      : polishFilter === 'fine'
        ? row.verdict === 'ok' || row.verdict === 'kept'
        : row.verdict === polishFilter,
  );
  $: polishRow = polishRows.find((row) => row.file === polishFile) || polishRows[0] || null;
  $: polishState = polish ? $t(polishStateKey(polish)) : '';
  function polishStateKey(pass: Polish): MessageKey {
    if (pass.capturing) return 'polish.state.capturing';
    if (pass.record.state === 'accepted') return 'polish.state.accepted';
    if (pass.counts && pass.counts.defects + pass.counts.open === 0)
      return 'polish.state.nothingLeft';
    return pass.record.state === 'stale' ? 'polish.state.stale' : 'polish.state.working';
  }
  // A render fills the preview: the film appears there frame by frame, and the live preview unloads,
  // which leaves the graphics card to the render.
  $: liveRender = live.render;
  $: liveRunning = liveRender?.status === 'running';
  $: renderViewOpen = !!liveRender && closedRender !== liveRender.startedAt;
  $: if (renderViewOpen) playerReady = false;
  $: livePercent = liveRender?.total
    ? Math.floor(Math.min(100, (liveRender.completed / liveRender.total) * 100))
    : 0;
  $: if (typeof document !== 'undefined' && manifest) {
    const name = manifest.name || 'Studio';
    document.title = liveRunning
      ? `${$format.percent(livePercent / 100)} · ${name}`
      : liveRender?.status === 'completed' && renderViewOpen
        ? $t('studio.title.ready', { name })
        : $t('studio.title.film', { name });
  }
  function closeRenderView() {
    if (!liveRender) return;
    closedRender = liveRender.startedAt;
    try {
      localStorage.setItem('superint-closed-render', String(closedRender));
    } catch {
      /* See above. */
    }
  }
  function toggleRenderView() {
    if (renderViewOpen) {
      closeRenderView();
      return;
    }
    closedRender = 0;
    try {
      localStorage.removeItem('superint-closed-render');
    } catch {
      /* See above. */
    }
  }
  async function openLiveVideo() {
    try {
      await request('/api/live/open', {});
    } catch (openError) {
      error = openError instanceof Error ? openError.message : String(openError);
    }
  }
  // A project made with `new` opens on the production panel once, so you can watch it being built.
  $: if (project && !productionShown) {
    productionShown = true;
    if (production?.brief && !rightOpen && window.innerWidth >= 1100) {
      inspectorMode = 'production';
      rightOpen = true;
    }
  }
  $: matchingAssets = (project?.assets || [])
    .map((asset) => ({ ...asset, ...assetMetadata[asset.path] }))
    .filter(
      (asset) =>
        (assetFilter === 'all' || asset.kind === assetFilter) &&
        `${asset.name} ${asset.path}`.toLowerCase().includes(search.toLowerCase()),
    );
  $: visibleAssets = matchingAssets;
  $: pixelsPerFrame = Math.max(
    timelineViewportWidth < 600 ? 0.5 : 0.02,
    ((timelineViewportWidth - 182 - 32) / duration) * zoom,
  );
  $: laneWidth = Math.max(timelineViewportWidth - 182, duration * pixelsPerFrame + 40);
  $: rulerInterval = chooseInterval(pixelsPerFrame, fps);
  $: rulerTicks = Array.from(
    { length: Math.ceil(duration / fps / rulerInterval) + 1 },
    (_, i) => i * rulerInterval,
  );
  $: fitScale = manifest
    ? Math.min(
        (previewWidth - previewPaddingX) / manifest.width,
        (previewHeight - previewPaddingY) / manifest.height,
      )
    : 1;
  $: actualScale = previewScale === 'fit' ? Math.max(0.05, fitScale) : Number(previewScale) / 100;
  $: stageWidth = (manifest?.width || 1920) * actualScale;
  $: stageHeight = (manifest?.height || 1080) * actualScale;
  $: renderActive = !!job && (job.status === 'running' || job.status === 'queued');
  $: progress = job?.total ? Math.min(100, (job.completed / job.total) * 100) : 0;
  $: if (selected?.type === 'audio') void loadAssetMetadata(selected.src);

  function selectClip(id: string) {
    commitActiveEditor();
    selection = id;
    inspectorMode = 'clip';
    rightOpen = true;
  }
  function toggleProjectSettings() {
    commitActiveEditor();
    if (rightOpen && inspectorMode === 'project') rightOpen = false;
    else {
      rightOpen = true;
      inspectorMode = 'project';
    }
  }
  function toggleProduction() {
    commitActiveEditor();
    if (rightOpen && inspectorMode === 'production') rightOpen = false;
    else {
      rightOpen = true;
      inspectorMode = 'production';
    }
  }
  async function openDocument(path: string) {
    try {
      const response = await fetch(`/api/doc?path=${encodeURIComponent(path)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || response.statusText);
      documentView = body;
    } catch (cause) {
      error = message(cause);
    }
  }
  const isImage = (path: string) => /\.(png|jpe?g|webp|gif|avif)$/i.test(path);
  const polishUrl = (file: string) => (polish ? assetUrl(`${polish.folder}/${file}`) : '');
  /** "Cut at 0:18": what a picture of a polish pass shows and where in the film. */
  const polishName = (row: Pick<PolishRow, 'kind' | 'time'>) =>
    $t('polish.at', { kind: $t(`polish.kind.${row.kind}`), time: filmClock(row.time) });
  const SHORTCUTS: [MessageKey, string][] = [
    ['shortcut.playPause', 'Space'],
    ['shortcut.frame', '← / →'],
    ['shortcut.tenFrames', 'Shift + ← / →'],
    ['shortcut.ends', 'Home / End'],
    ['shortcut.move', 'Alt + ← / →'],
    ['shortcut.trim', 'Alt + Shift + ← / →'],
    ['shortcut.split', 'S'],
    ['shortcut.duplicate', 'D'],
    ['shortcut.delete', 'Delete'],
    ['shortcut.snap', 'N'],
    ['timeline.undo', 'Ctrl + Z'],
    ['timeline.redo', 'Ctrl + Shift + Z'],
    ['shortcut.closeDialog', 'Esc'],
  ];
  /** The filters of the polish viewer, each with how many pictures it shows. */
  function polishFilters(counts: Polish['counts']): [typeof polishFilter, number][] {
    return [
      ['all', counts?.listed ?? 0],
      ['defect', counts?.defects ?? 0],
      ['open', counts?.open ?? 0],
      ['fine', (counts?.ok ?? 0) + (counts?.kept ?? 0)],
    ];
  }
  /** What the button at the head of a track does next. */
  function trackToggle(track: Track) {
    if (track.kind === 'audio')
      return $t(track.muted ? 'timeline.unmuteTrack' : 'timeline.muteTrack');
    return $t(track.hidden ? 'timeline.showTrack' : 'timeline.hideTrack');
  }
  function commitActiveEditor() {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active.matches('.inspector input, .inspector textarea, .project-name')
    )
      active.blur();
  }
  function onEditorInput(event: Event) {
    const element = event.target;
    if (
      !(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) ||
      !element.matches(
        '.inspector input[type="number"], .inspector input[type="text"], .inspector textarea, .project-name',
      )
    )
      return;
    dirtyDrafts.set(element, {
      element,
      value: element.value,
      clipId: selection,
      label:
        element.getAttribute('aria-label') ||
        element.closest('label')?.textContent?.trim() ||
        $t('studio.field'),
    });
  }
  function clearEditorDraft(event: FocusEvent) {
    if (event.target instanceof HTMLElement) dirtyDrafts.delete(event.target);
  }
  function focusedDraft(): EditorDraft | undefined {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return;
    const draft = dirtyDrafts.get(element);
    return draft ? { ...draft, value: draft.element.value } : undefined;
  }
  async function acceptProject(next: Project) {
    const draft = focusedDraft();
    const selectionStart = draft?.element.selectionStart;
    const selectionEnd = draft?.element.selectionEnd;
    project = next;
    trust(next.token);
    await tick();
    if (
      draft &&
      draft.element.isConnected &&
      document.activeElement === draft.element &&
      selection === draft.clipId
    ) {
      draft.element.value = draft.value;
      if (
        selectionStart !== null &&
        selectionStart !== undefined &&
        selectionEnd !== null &&
        selectionEnd !== undefined
      )
        draft.element.setSelectionRange(selectionStart, selectionEnd);
    }
  }

  function chooseInterval(pixelWidth: number, frameRate: number) {
    const desired = 76 / Math.max(0.1, pixelWidth * frameRate);
    return (
      [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((v) => v >= desired) || 600
    );
  }
  function timecode(value: number) {
    const seconds = Math.floor(value / fps);
    const f = Math.floor(value - seconds * fps);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  }
  function rulerLabel(seconds: number) {
    return seconds < 60 ? `${Number(seconds.toFixed(2))}s` : filmClock(seconds);
  }
  function clipName(clip: Clip) {
    return (
      clip.src
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') || clip.id
    );
  }
  function sizeLabel(bytes: number) {
    return bytes >= 1048576
      ? `${(bytes / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  function assetUrl(path: string) {
    if (!project) return '';
    return `${new URL(project.previewUrl).origin}/asset/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  function thumbnailUrl(asset: Asset) {
    if (asset.kind === 'image') return assetUrl(asset.path);
    const clip = manifest?.clips.find((item) => item.type === 'video' && item.src === asset.path);
    return clip && project
      ? `${new URL(project.previewUrl).origin}/frame/${encodeURIComponent(clip.id)}/${clip.sourceOffsetFrames || 0}.png`
      : '';
  }
  function waveformPath(clip: Clip, metadata: Partial<Asset> | undefined) {
    if (!metadata?.waveform?.length || !metadata.duration) return '';
    const samples = metadata.waveform;
    const sourceFrames = metadata.duration * fps;
    const count = Math.max(
      4,
      Math.min(100, Math.floor((clip.durationFrames * pixelsPerFrame) / 3)),
    );
    return Array.from({ length: count }, (_, i) => {
      const index = Math.min(
        samples.length - 1,
        Math.max(
          0,
          Math.floor(
            (((clip.sourceOffsetFrames || 0) + (i / count) * clip.durationFrames) / sourceFrames) *
              samples.length,
          ),
        ),
      );
      const amplitude = Math.max(0.025, Math.min(1, samples[index]));
      const x = ((i + 0.5) / count) * 100;
      return `M${x.toFixed(2)},${(10 - amplitude * 9).toFixed(2)}v${(amplitude * 18).toFixed(2)}`;
    }).join('');
  }
  /** A call of the editor. A refused revision means the files changed underneath it. */
  async function request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    try {
      return await call<T>(path, method, body);
    } catch (cause) {
      if ((cause as { status?: number }).status === 409) conflict = true;
      throw cause;
    }
  }
  async function loadProject(external = false) {
    try {
      const next = await request<Project>('/api/project', undefined, 'GET');
      const oldRevision = project?.revision;
      const draft = focusedDraft();
      if (external && oldRevision && next.revision !== oldRevision && draft) {
        conflict = true;
        saveState = 'conflict';
        error = $t('studio.changedWhileEditing');
        recovery = JSON.stringify(
          {
            revision: oldRevision,
            pendingField: { clipId: draft.clipId, label: draft.label, value: draft.value },
            manifest: project?.manifest,
          },
          null,
          2,
        );
        return;
      }
      await acceptProject(next);
      loading = false;
      conflict = false;
      error = '';
      frame = Math.min(frame, next.manifest.durationFrames - 1);
      if (selection && !next.manifest.clips.some((clip) => clip.id === selection)) selection = '';
      if (oldRevision && oldRevision !== next.revision) {
        sendPlayer('reload');
        saveState = external ? 'updated' : 'saved';
        if (external) announce($t('studio.updated'));
      }
    } catch (cause) {
      error = message(cause);
      loading = false;
    }
  }
  function message(cause: unknown) {
    return cause instanceof Error ? cause.message : String(cause);
  }
  function sameValue(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = Object.keys(leftRecord);
    return (
      keys.length === Object.keys(rightRecord).length &&
      keys.every(
        (key) => Object.hasOwn(rightRecord, key) && sameValue(leftRecord[key], rightRecord[key]),
      )
    );
  }
  function operationChangesModel(operation: Record<string, unknown>): boolean {
    const current =
      operation.type === 'updateClip'
        ? project?.manifest.clips.find((clip) => clip.id === operation.id)
        : operation.type === 'updateTrack'
          ? project?.manifest.tracks.find((track) => track.id === operation.id)
          : operation.type === 'updateProject'
            ? project?.manifest
            : undefined;
    if (!current || !operation.changes || typeof operation.changes !== 'object') return true;
    return Object.entries(operation.changes).some(([key, value]) => {
      const existing = (current as unknown as Record<string, unknown>)[key];
      if (
        key === 'transform' &&
        value &&
        typeof value === 'object' &&
        existing &&
        typeof existing === 'object'
      )
        return Object.entries(value).some(
          ([coordinate, amount]) =>
            !sameValue((existing as Record<string, unknown>)[coordinate], amount),
        );
      return !sameValue(existing, value);
    });
  }
  function edit(operation: EditOperation | (() => EditOperation)): Promise<boolean> {
    return new Promise((resolve) => {
      pendingEdits.push({ operation, resolve });
      void drainEdits();
    });
  }
  async function drainEdits() {
    if (drainingEdits) return;
    drainingEdits = true;
    while (pendingEdits.length) {
      const next = pendingEdits.shift()!;
      const operation = typeof next.operation === 'function' ? next.operation() : next.operation;
      const succeeded = await performEdit(operation);
      next.resolve(succeeded);
      if (!succeeded) {
        if (pendingEdits.length)
          recovery = JSON.stringify(
            {
              failedOperation: operation,
              pendingOperations: pendingEdits.map((item) =>
                typeof item.operation === 'function' ? item.operation() : item.operation,
              ),
              manifest: project?.manifest,
            },
            null,
            2,
          );
        for (const pending of pendingEdits.splice(0)) pending.resolve(false);
        break;
      }
    }
    drainingEdits = false;
  }
  async function performEdit(operation: EditOperation): Promise<boolean> {
    if (!project) return false;
    if (conflict) {
      recovery = JSON.stringify(
        { revision: project.revision, pendingOperation: operation, manifest: project.manifest },
        null,
        2,
      );
      return false;
    }
    if (!operationChangesModel(operation)) return true;
    saving = true;
    saveState = 'saving';
    const current = project;
    try {
      const next = await request<Project>('/api/edit', { revision: current.revision, operation });
      await acceptProject(next);
      if (operation.type === 'splitClip' || operation.type === 'duplicateClip') {
        const created = project.manifest.clips.filter(
          (clip) => !current.manifest.clips.some((old) => old.id === clip.id),
        );
        selection =
          created.find(
            (clip) => frame >= clip.startFrame && frame < clip.startFrame + clip.durationFrames,
          )?.id ||
          created[0]?.id ||
          '';
      }
      saveState = 'saved';
      error = '';
      sendPlayer('reload');
      return true;
    } catch (cause) {
      error = message(cause);
      saveState = conflict ? 'conflict' : 'unsaved';
      recovery = JSON.stringify(
        {
          projectPath: current.projectPath,
          revision: current.revision,
          pendingOperation: operation,
          manifest: current.manifest,
        },
        null,
        2,
      );
      return false;
    } finally {
      saving = false;
      if (!drag) draftClip = null;
    }
  }
  async function history(action: 'undo' | 'redo') {
    if (!project || saving || conflict || !(action === 'undo' ? project.canUndo : project.canRedo))
      return;
    saving = true;
    try {
      project = await request<Project>('/api/history', { revision: project.revision, action });
      if (selection && !project.manifest.clips.some((clip) => clip.id === selection))
        selection = '';
      sendPlayer('reload');
      saveState = 'saved';
    } catch (cause) {
      error = message(cause);
    } finally {
      saving = false;
    }
  }
  function sendPlayer(action: 'seek' | 'play' | 'pause' | 'reload', targetFrame?: number) {
    if (!project || renderViewOpen || !player?.contentWindow) return;
    player.contentWindow.postMessage(
      {
        source: 'superint-studio',
        action,
        ...(targetFrame !== undefined ? { frame: targetFrame } : {}),
      },
      new URL(project.previewUrl).origin,
    );
  }
  function seek(value: number) {
    frame = Math.max(0, Math.min(duration - 1, Math.round(value)));
    playing = false;
    sendPlayer('seek', frame);
  }
  function togglePlayback() {
    if (!playerReady) return;
    sendPlayer(playing ? 'pause' : 'play');
    playing = !playing;
  }
  function onPlayerMessage(event: MessageEvent) {
    if (
      !project ||
      event.source !== player?.contentWindow ||
      event.origin !== new URL(project.previewUrl).origin
    )
      return;
    const data = event.data;
    if (!data || data.source !== 'superint-player') return;
    if (data.type === 'ready') {
      playerReady = true;
      sendPlayer('seek', frame);
    }
    if (data.type === 'ready' || data.type === 'state') {
      if (data.type === 'state' && playerReady && Number.isFinite(data.frame) && !scrub)
        frame = Math.min(duration - 1, Math.max(0, Math.round(data.frame)));
      if (typeof data.playing === 'boolean') playing = data.playing;
      // State messages arrive while typing; unchanged schemas must not reset field values.
      if (data.propDefinitions && !sameValue(propDefinitions, data.propDefinitions))
        propDefinitions = data.propDefinitions;
      if (Array.isArray(data.texts) && !sameValue(texts, data.texts)) texts = data.texts;
    }
    if (data.type === 'error') {
      diagnostics = [
        ...diagnostics.filter((d) => d.code !== (data.code || 'SCENE_RUNTIME')),
        {
          severity: 'error',
          code: data.code || 'SCENE_RUNTIME',
          message: data.message || $t('studio.sceneFailed'),
          path: data.path,
          clipId: data.clipId,
        },
      ];
      playing = false;
    }
  }
  async function inspectAsset(asset: Asset) {
    selectedAsset = asset.path;
    if (asset.kind !== 'scene') await loadAssetMetadata(asset.path);
  }
  async function loadAssetMetadata(path: string) {
    if (metadataRequested.has(path)) return;
    metadataRequested.add(path);
    try {
      const metadata = await request<Partial<Asset>>(
        `/api/media?path=${encodeURIComponent(path)}`,
        undefined,
        'GET',
      );
      assetMetadata = { ...assetMetadata, [path]: metadata };
    } catch (cause) {
      announce(message(cause));
    }
  }
  async function addAsset(asset: Asset) {
    if (!manifest || saving || asset.kind === 'other') return;
    const clipType = asset.kind;
    if (asset.kind === 'audio' || asset.kind === 'video') {
      await loadAssetMetadata(asset.path);
      asset = { ...asset, ...assetMetadata[asset.path] };
      if (!asset.duration) {
        error = $t('media.noDuration', { name: asset.name });
        return;
      }
    }
    let track = manifest.tracks.find(
      (entry) => entry.kind === (asset.kind === 'audio' ? 'audio' : 'visual'),
    );
    if (!track) {
      track = {
        id: `${asset.kind === 'audio' ? 'audio' : 'visual'}-${crypto.randomUUID().slice(0, 8)}`,
        kind: asset.kind === 'audio' ? 'audio' : 'visual',
        name: $t(asset.kind === 'audio' ? 'timeline.audioTrack' : 'timeline.visualTrack'),
      };
      const addedTrack = await edit({ type: 'addTrack', track });
      if (!addedTrack) return;
    }
    const sourceFrames = asset.duration
      ? Math.max(1, Math.floor(asset.duration * fps))
      : Math.round(fps * 5);
    const clip: Clip = {
      id: `clip-${crypto.randomUUID().slice(0, 8)}`,
      type: clipType,
      src: asset.path,
      track: track.id,
      startFrame: frame,
      durationFrames: Math.max(1, Math.min(sourceFrames, duration - frame)),
      sourceOffsetFrames: 0,
      props: {},
    };
    if (!(await edit({ type: 'addClip', clip }))) return;
    selectClip(clip.id);
    announce($t('media.added', { name: asset.name }));
  }
  async function importFiles(files: FileList | File[]) {
    if (!project || importBusy) return;
    importBusy = true;
    try {
      for (const file of Array.from(files)) {
        const path = `/api/import?name=${encodeURIComponent(file.name)}`;
        selectedAsset = (await call<{ path: string }>(path, 'POST', file)).path;
      }
      await loadProject();
      announce($t('media.imported', { count: files.length }));
    } catch (cause) {
      error = message(cause);
    } finally {
      importBusy = false;
      if (importInput) importInput.value = '';
    }
  }
  function changeClip(changes: Partial<Clip>) {
    if (selected) void edit({ type: 'updateClip', id: selected.id, changes });
  }
  function numberValue(event: Event, fallback = 0) {
    const v = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(v) ? v : fallback;
  }
  function changeNumber(key: keyof Clip, event: Event) {
    changeClip({ [key]: Math.round(numberValue(event)) });
  }
  function setTransform(key: keyof Transform, event: Event) {
    if (!selected) return;
    changeClip({ transform: { [key]: numberValue(event) } });
  }
  function changeProp(key: string, value: string | number | boolean) {
    if (selected) changePropOf(selected.id, key, value);
  }
  function changePropOf(id: string, key: string, value: string | number | boolean) {
    void edit(() => ({
      type: 'updateClip',
      id,
      changes: {
        props: { ...project?.manifest.clips.find((clip) => clip.id === id)?.props, [key]: value },
      },
    }));
  }

  // Texts in the picture: a click opens a field right where the text stands, filled with it.
  // Enter keeps the new words, Escape the old ones; the inspector shows the same prop.
  function textName(text: TextSpot) {
    return propDefinitions[text.clipId]?.[text.prop]?.label || text.prop;
  }
  function textValue(text: TextSpot) {
    const clip = manifest?.clips.find((item) => item.id === text.clipId);
    return String(
      clip?.props?.[text.prop] ?? propDefinitions[text.clipId]?.[text.prop]?.default ?? '',
    );
  }
  async function editText(text: TextSpot) {
    selectClip(text.clipId);
    editingText = text;
    textDraft = textValue(text);
    await tick();
    textEditor?.focus();
    textEditor?.select();
  }
  function closeText(keep: boolean) {
    const text = editingText;
    editingText = null;
    if (keep && text && textDraft !== textValue(text))
      changePropOf(text.clipId, text.prop, textDraft);
  }
  function onTextKey(event: KeyboardEvent) {
    if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      closeText(event.key === 'Enter');
    }
  }
  /** The field stands on the text, at least wide enough to type in, and inside the picture. */
  function editorPlace(text: TextSpot, scale: number, width: number, height: number) {
    const wide = Math.min(width, Math.max(text.w * scale, 280));
    const left = Math.max(0, Math.min(text.x * scale, width - wide));
    const top = Math.max(0, Math.min(text.y * scale, height - 112));
    return `left:${left}px;top:${top}px;width:${wide}px`;
  }
  function split() {
    if (
      selected &&
      frame > selected.startFrame &&
      frame < selected.startFrame + selected.durationFrames
    )
      void edit({ type: 'splitClip', id: selected.id, frame });
  }
  function duplicate() {
    if (selected) void edit({ type: 'duplicateClip', id: selected.id });
  }
  function remove() {
    if (selected) {
      const id = selected.id;
      selection = '';
      void edit({ type: 'deleteClip', id });
    }
  }
  function snap(value: number, clip: Clip, endOffset = 0) {
    if (!snapping || !manifest) return value;
    const points = [
      0,
      duration,
      frame,
      ...manifest.clips
        .filter((item) => item.id !== clip.id)
        .flatMap((item) => [item.startFrame, item.startFrame + item.durationFrames]),
    ];
    let best = value;
    let distance = 7 / pixelsPerFrame;
    for (const target of points) {
      for (const offset of [0, endOffset]) {
        const delta = Math.abs(value + offset - target);
        if (delta < distance) {
          distance = delta;
          best = target - offset;
          snapFrame = target;
        }
      }
    }
    return best;
  }
  function beginDrag(event: PointerEvent, clip: Clip, kind: 'move' | 'left' | 'right') {
    if (event.button !== 0 || saving || conflict) return;
    event.stopPropagation();
    event.preventDefault();
    selectClip(clip.id);
    sendPlayer('pause');
    playing = false;
    drag = { kind, clip: structuredClone(clip), x: event.clientX, startTrack: clip.track };
    draftClip = { ...clip };
    (event.currentTarget as HTMLElement).focus();
  }
  function beginScrub(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    commitActiveEditor();
    scrub = true;
    if ((event.currentTarget as HTMLElement).classList.contains('track-lane')) selection = '';
    scrubAt(event.clientX);
  }
  function scrubAt(x: number) {
    const box = timeline.getBoundingClientRect();
    seek((x - box.left + timeline.scrollLeft - 182) / pixelsPerFrame);
  }
  function onPointerMove(event: PointerEvent) {
    if (resize) {
      if (resize.kind === 'left')
        leftWidth = Math.max(260, Math.min(380, resize.initial + event.clientX - resize.x));
      if (resize.kind === 'right')
        rightWidth = Math.max(300, Math.min(420, resize.initial - event.clientX + resize.x));
      if (resize.kind === 'timeline')
        timelineHeight = Math.max(
          180,
          Math.min(window.innerHeight * 0.65, resize.initial - event.clientY + resize.y),
        );
      return;
    }
    if (scrub) {
      scrubAt(event.clientX);
      return;
    }
    if (!drag || !draftClip) return;
    const original = drag.clip;
    const delta = Math.round((event.clientX - drag.x) / pixelsPerFrame);
    snapFrame = null;
    if (drag.kind === 'move') {
      let startFrame = snap(original.startFrame + delta, original, original.durationFrames);
      startFrame = Math.max(0, Math.min(duration - original.durationFrames, startFrame));
      const lane = document
        .elementsFromPoint(event.clientX, event.clientY)
        .find((element) => element instanceof HTMLElement && element.dataset.track) as
        HTMLElement | undefined;
      const candidate = manifest?.tracks.find(
        (track) =>
          track.id === lane?.dataset.track &&
          track.kind === (original.type === 'audio' ? 'audio' : 'visual'),
      );
      draftClip = { ...original, startFrame, track: candidate?.id || draftClip.track };
    } else if (drag.kind === 'left') {
      const target = snap(original.startFrame + delta, original);
      const amount = Math.max(
        -original.startFrame,
        -(original.sourceOffsetFrames || 0),
        Math.min(original.durationFrames - 1, target - original.startFrame),
      );
      draftClip = {
        ...original,
        startFrame: original.startFrame + amount,
        durationFrames: original.durationFrames - amount,
        sourceOffsetFrames: (original.sourceOffsetFrames || 0) + amount,
      };
    } else {
      const target = snap(original.startFrame + original.durationFrames + delta, original);
      draftClip = {
        ...original,
        durationFrames: Math.max(
          1,
          Math.min(duration - original.startFrame, target - original.startFrame),
        ),
      };
    }
  }
  function onPointerUp() {
    resize = null;
    scrub = false;
    snapFrame = null;
    if (!drag || !draftClip) return;
    const original = drag.clip;
    const next = draftClip;
    drag = null;
    if (
      next.startFrame !== original.startFrame ||
      next.durationFrames !== original.durationFrames ||
      next.track !== original.track ||
      next.sourceOffsetFrames !== original.sourceOffsetFrames
    ) {
      void edit({
        type: 'updateClip',
        id: next.id,
        changes: {
          startFrame: next.startFrame,
          durationFrames: next.durationFrames,
          sourceOffsetFrames: next.sourceOffsetFrames || 0,
          track: next.track,
        },
      });
    } else draftClip = null;
  }
  function beginResize(event: PointerEvent, kind: 'left' | 'right' | 'timeline') {
    event.preventDefault();
    resize = {
      kind,
      x: event.clientX,
      y: event.clientY,
      initial: kind === 'left' ? leftWidth : kind === 'right' ? rightWidth : timelineHeight,
    };
  }
  function resizeKey(event: KeyboardEvent, kind: 'left' | 'right' | 'timeline') {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 16
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -16
          : 0;
    if (!delta) return;
    event.preventDefault();
    if (kind === 'left') leftWidth = Math.max(260, Math.min(380, leftWidth + delta));
    else if (kind === 'right') rightWidth = Math.max(300, Math.min(420, rightWidth - delta));
    else
      timelineHeight = Math.max(180, Math.min(window.innerHeight * 0.65, timelineHeight - delta));
  }
  function onKey(event: KeyboardEvent) {
    if (inactive) return;
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      if (polishOpen) polishOpen = false;
      else if (documentView) documentView = null;
      else if (contextDialog) contextDialog = '';
      else if (shortcutsOpen) shortcutsOpen = false;
      else if (exportOpen) exportOpen = false;
      else if (diagnosticsOpen) diagnosticsOpen = false;
      else if (moreOpen) moreOpen = false;
      else if (inspectorVisible) {
        commitActiveEditor();
        rightOpen = false;
      } else if (leftOpen) leftOpen = false;
      if (drag) {
        drag = null;
        draftClip = null;
      }
      return;
    }
    const target = event.target as HTMLElement;
    if (
      event.key === 'Enter' &&
      target instanceof HTMLInputElement &&
      ['text', 'number'].includes(target.type)
    ) {
      event.preventDefault();
      target.blur();
      return;
    }
    if (
      event.key === 'Enter' &&
      (event.ctrlKey || event.metaKey) &&
      target instanceof HTMLTextAreaElement
    ) {
      event.preventDefault();
      target.blur();
      return;
    }
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable ||
      exportOpen ||
      contextDialog ||
      documentView ||
      polishOpen ||
      shortcutsOpen ||
      moreOpen ||
      diagnosticsOpen
    )
      return;
    const modifier = event.ctrlKey || event.metaKey;
    if (
      !modifier &&
      !event.altKey &&
      target.closest('button, a, summary, [role="menuitem"]') &&
      [' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
    )
      return;
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      void history(event.shiftKey ? 'redo' : 'undo');
    } else if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      void history('redo');
    } else if (event.code === 'Space') {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const amount =
        (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey && !event.altKey ? 10 : 1);
      if (event.altKey && selected) {
        const id = selected.id;
        const trim = event.shiftKey;
        void edit(() => {
          const clip = project?.manifest.clips.find((item) => item.id === id);
          if (!clip) return { type: 'updateClip', id, changes: {} };
          const end = project!.manifest.durationFrames;
          return {
            type: 'updateClip',
            id,
            changes: trim
              ? {
                  durationFrames: Math.max(
                    1,
                    Math.min(end - clip.startFrame, clip.durationFrames + amount),
                  ),
                }
              : {
                  startFrame: Math.max(
                    0,
                    Math.min(end - clip.durationFrames, clip.startFrame + amount),
                  ),
                },
          };
        });
      } else seek(frame + amount);
    } else if (event.key === 'Home') {
      event.preventDefault();
      seek(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      seek(duration - 1);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove();
    } else if (event.key.toLowerCase() === 's' && !modifier) {
      event.preventDefault();
      split();
    } else if (event.key.toLowerCase() === 'd' && !modifier) {
      event.preventDefault();
      duplicate();
    } else if (event.key.toLowerCase() === 'n' && !modifier) {
      snapping = !snapping;
    } else if (event.key === '?') shortcutsOpen = true;
  }
  async function copyContext() {
    if (!project) return;
    const payload = {
      project: project.projectPath,
      revision: project.revision,
      frame,
      time: timecode(frame),
      fps: manifest?.fps,
      ...(selected ? { clip: selected, sceneProps: selectedDefinitions } : {}),
      diagnostics: diagnostics.filter(
        (item) => !selected || !item.clipId || item.clipId === selected.id,
      ),
    };
    const text = `Superint Video context\n\n${JSON.stringify(payload, null, 2)}`;
    try {
      await navigator.clipboard.writeText(text);
      announce($t('context.copied'));
    } catch {
      contextDialog = text;
      await tick();
      contextArea?.focus();
      contextArea?.select();
    }
  }
  function downloadRecovery() {
    const url = URL.createObjectURL(new Blob([recovery], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'superint-unsaved-edit.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function checkProject() {
    checking = true;
    diagnosticsOpen = true;
    try {
      const result = await request<{
        ok: boolean;
        diagnostics: Diagnostic[];
        sampledFrames: number[] | number;
      }>('/api/check', undefined, 'GET');
      diagnostics = result.diagnostics;
      lastCheckFrames = Array.isArray(result.sampledFrames)
        ? result.sampledFrames.length
        : result.sampledFrames;
      if (!diagnostics.length) announce($t('diagnostics.passed', { count: lastCheckFrames ?? 0 }));
    } catch (cause) {
      error = message(cause);
    } finally {
      checking = false;
    }
  }
  async function startRender() {
    exportStarting = true;
    exportError = '';
    try {
      const result = await request<{ id: string }>('/api/render', { output, quality, overwrite });
      job = {
        id: result.id,
        status: 'queued',
        stage: $t('export.preparing'),
        completed: 0,
        total: duration,
        output,
      };
      pollRender();
    } catch (cause) {
      exportError = message(cause);
    } finally {
      exportStarting = false;
    }
  }
  async function pollRender() {
    if (!job) return;
    try {
      job = await request<RenderJob>(`/api/render/${job.id}`, undefined, 'GET');
      if (job.status === 'queued' || job.status === 'running')
        renderTimer = setTimeout(pollRender, 700);
      if (job.status === 'completed') announce($t('export.complete'));
    } catch (cause) {
      error = message(cause);
    }
  }
  async function cancelRender() {
    if (!job) return;
    try {
      await request(`/api/render/${job.id}/cancel`, {});
      await pollRender();
    } catch (cause) {
      error = message(cause);
    }
  }
  async function openRender() {
    if (!job) return;
    try {
      await request(`/api/render/${job.id}/open`, {});
    } catch (cause) {
      exportError = message(cause);
    }
  }
  function dropFiles(event: DragEvent) {
    event.preventDefault();
    droppedFiles = false;
    if (event.dataTransfer?.files.length) void importFiles(event.dataTransfer.files);
  }
  function modalFocus(node: HTMLElement) {
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea, [tabindex="0"]',
        ),
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          !element.matches(':disabled, [aria-hidden="true"]'),
      );
    queueMicrotask(() => (focusables()[0] || node).focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusables();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    node.addEventListener('keydown', trap);
    return {
      destroy() {
        node.removeEventListener('keydown', trap);
        if (previous?.isConnected) previous.focus();
      },
    };
  }
  onMount(() => {
    void loadProject();
    void fetch('/api/live')
      .then((response) => response.json())
      .then((state) => (live = state))
      .catch(() => {});
    const ticker = setInterval(() => (clock = Date.now()), 20000);
    window.addEventListener('message', onPlayerMessage);
    window.addEventListener('input', onEditorInput);
    window.addEventListener('focusout', clearEditorDraft);
    const events = new EventSource('/api/events');
    events.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'live') live = data.live;
        if (data.type === 'production' && project)
          project = { ...project, production: data.production };
        if (data.type === 'invalid') {
          error = data.message;
          saveState = 'invalid';
        }
        if (data.type === 'changed' && data.revision !== project?.revision && !saving) {
          if (drag) {
            conflict = true;
            error = $t('studio.changedDuringEdit');
            recovery = JSON.stringify({ draft: draftClip, manifest }, null, 2);
          } else void loadProject(true);
        }
      } catch {
        /* A partial event is ignored; reconnection is handled by EventSource. */
      }
    };
    events.onerror = () => {
      if (!loading) saveState = 'reconnecting';
    };
    events.onopen = () => {
      if (saveState === 'reconnecting') {
        saveState = 'saved';
        void loadProject(true);
      }
    };
    const observer = new ResizeObserver(() => {
      if (timeline) timelineViewportWidth = timeline.clientWidth;
      if (previewViewport) {
        previewWidth = previewViewport.clientWidth;
        previewHeight = previewViewport.clientHeight;
        const padding = getComputedStyle(previewViewport);
        previewPaddingX = parseFloat(padding.paddingLeft) + parseFloat(padding.paddingRight);
        previewPaddingY = parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom);
      }
    });
    const observe = setInterval(() => {
      if (timeline && previewViewport) {
        observer.observe(timeline);
        observer.observe(previewViewport);
        clearInterval(observe);
      }
    }, 100);
    return () => {
      events.close();
      clearInterval(ticker);
      observer.disconnect();
      clearInterval(observe);
      clearTimeout(renderTimer);
      window.removeEventListener('message', onPlayerMessage);
      window.removeEventListener('input', onEditorInput);
      window.removeEventListener('focusout', clearEditorDraft);
    };
  });
</script>

<svelte:window
  onkeydown={onKey}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onblur={onPointerUp}
/>

<div
  class="studio"
  class:resizing={!!resize}
  class:dragging={!!drag}
  style={`--left-width:${leftOpen ? leftWidth : 0}px;--right-width:${inspectorVisible ? rightWidth : 0}px;--timeline-height:${timelineHeight}px`}
>
  <header class="app-header">
    {#if onhome}<button class="wordmark" title={$t('studio.startPage')} onclick={onhome}
        ><Logo /></button
      >{:else}<a class="wordmark" href="/" aria-label="Superint Video"><Logo /></a>{/if}
    <div class="project-identity">
      <input
        bind:this={headerTitle}
        class="project-name"
        aria-label={$t('studio.projectName')}
        title={$t('studio.rename')}
        value={manifest?.name || project?.name || $t('studio.untitled')}
        disabled={!project || saving}
        onblur={(event) =>
          edit({ type: 'updateProject', changes: { name: event.currentTarget.value } })}
      /><span class="sr-only" role="status" aria-live="polite"
        >{project ? $t(`save.${saveState}`) : ''}</span
      >
    </div>
    <div class="header-actions">
      <button
        class="button quiet media-toggle"
        class:active={leftOpen}
        aria-expanded={leftOpen}
        aria-controls="media-panel"
        onclick={() => (leftOpen = !leftOpen)}
        disabled={!project}><Icon name="folder" /><span>{$t('studio.media')}</span></button
      >
      <button
        class="button quiet labelled production-toggle"
        class:active={inspectorVisible && inspectorMode === 'production'}
        aria-label={$t('studio.progress')}
        title={$t('studio.progressHint')}
        aria-expanded={inspectorVisible && inspectorMode === 'production'}
        onclick={toggleProduction}
        disabled={!project}
        ><Icon name="production" /><span>{$t('studio.progress')}</span
        >{#if production?.status?.step}<span class="production-indicator" aria-hidden="true"
          ></span>{/if}</button
      >
      <button
        class="button quiet labelled settings-toggle"
        class:active={inspectorVisible && inspectorMode === 'project'}
        aria-label={$t('studio.filmSettings')}
        title={$t('studio.filmSettingsHint')}
        aria-expanded={inspectorVisible && inspectorMode === 'project'}
        onclick={toggleProjectSettings}
        disabled={!project}><Icon name="settings" /><span>{$t('studio.film')}</span></button
      >
      <MoreMenu
        place="more-wrapper"
        button="icon-button more-toggle"
        label={$t('studio.more')}
        bind:open={moreOpen}
      >
        <svelte:fragment slot="badge"
          >{#if diagnostics.length}<span
              class="diagnostic-indicator"
              aria-label={$t('studio.diagnosticsCount', { count: diagnostics.length })}
            ></span>{/if}</svelte:fragment
        >
        <button role="menuitem" disabled={!project} onclick={() => void copyContext()}
          ><Icon name="copy" />{$t('studio.copyContext')}</button
        >
        <button role="menuitem" disabled={!project || checking} onclick={() => void checkProject()}
          ><Icon name="check" />{$t(checking ? 'studio.checking' : 'studio.check')}</button
        >
        <button role="menuitem" onclick={() => (diagnosticsOpen = true)}
          ><Icon name="alert" />{$t('studio.diagnostics')}{#if diagnostics.length}<span
              >{diagnostics.length}</span
            >{/if}</button
        >
        <button role="menuitem" onclick={() => (shortcutsOpen = true)}
          ><Icon name="keyboard" />{$t('studio.shortcuts')}</button
        >
        <button role="menuitem" onclick={toggleTheme}
          ><Icon name={$theme === 'dark' ? 'sun' : 'moon'} />{$t(
            $theme === 'dark' ? 'theme.toLight' : 'theme.toDark',
          )}</button
        >
        {#each LOCALES.filter((entry) => entry.code !== $locale) as entry (entry.code)}<button
            role="menuitem"
            lang={entry.code}
            aria-label={$t('language.switch', { language: entry.name })}
            onclick={() => void setLanguage(entry.code)}><Icon name="globe" />{entry.name}</button
          >{/each}
      </MoreMenu>
      {#if liveRender && (liveRunning || !renderViewOpen)}<button
          class="button quiet live-pill"
          class:running={liveRunning}
          title={$t('studio.renderToggle')}
          onclick={toggleRenderView}
          >{#if liveRunning}<span class="live-dot" aria-hidden="true"></span>{$t(
              'state.rendering',
              {
                percent: $format.percent(livePercent / 100),
              },
            )}{:else if liveRender.status === 'completed'}<Icon name="check" />{$t(
              'state.filmReady',
            )}{:else}<Icon name="alert" />{$t('studio.renderStopped')}{/if}</button
        >{/if}
      <button class="button primary" onclick={() => (exportOpen = true)} disabled={!project}
        ><Icon name="export" /><span
          >{renderActive
            ? $t('studio.exporting', { percent: $format.percent(progress / 100) })
            : $t('studio.export')}</span
        ></button
      >
    </div>
  </header>

  {#if setupNeeds.length && onhome && !setupLater}
    <SetupBanner missing={setupNeeds} onfinish={onhome} onlater={() => (setupLater = true)} />
  {/if}

  {#if error}
    <div class="error-banner" role="alert">
      <Icon name="alert" /><span>{error}</span>
      <div class="banner-actions">
        {#if recovery}<button onclick={downloadRecovery}>{$t('studio.recovery')}</button
          >{/if}<button onclick={() => loadProject()}>{$t('studio.reload')}</button
        >{#if !conflict}<button
            class="icon-button"
            aria-label={$t('studio.dismissError')}
            onclick={() => (error = '')}><Icon name="close" /></button
          >{/if}
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="loading-state">
      <div class="loader"></div>
      <p>{$t('studio.opening')}</p>
    </div>
  {:else if !project || !manifest}
    <div class="loading-state">
      <Icon name="alert" size={30} />
      <p>{$t('studio.unavailable')}</p>
      <button class="button" onclick={() => loadProject()}>{$t('common.retry')}</button>
    </div>
  {:else}
    <main class="workspace">
      {#if leftOpen}
        <aside id="media-panel" class="library" aria-label={$t('studio.media')}>
          <div class="panel-heading">
            <h2>{$t('studio.media')}</h2>
            <button
              class="icon-button"
              aria-label={$t('media.close')}
              onclick={() => (leftOpen = false)}><Icon name="close" /></button
            >
          </div>
          <div class="library-controls">
            <label class="search-field"
              ><Icon name="search" /><span class="sr-only">{$t('media.search')}</span><input
                placeholder={$t('media.search')}
                bind:value={search}
              /></label
            ><label class="asset-filter"
              ><span class="sr-only">{$t('media.type')}</span><select bind:value={assetFilter}
                ><option value="all">{$t('media.all')}</option><option value="scene"
                  >{$t('media.scenes')}</option
                ><option value="video">{$t('media.video')}</option><option value="image"
                  >{$t('media.images')}</option
                ><option value="audio">{$t('media.audio')}</option></select
              ></label
            >
          </div>
          <!-- Import is also available through a native file picker. -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="asset-list"
            class:drop-active={droppedFiles}
            ondragover={(event) => {
              event.preventDefault();
              droppedFiles = true;
            }}
            ondragleave={() => (droppedFiles = false)}
            ondrop={dropFiles}
          >
            {#each visibleAssets as asset (asset.path)}<div
                class="asset-row"
                class:selected={selectedAsset === asset.path}
              >
                <button
                  class="asset-main"
                  onclick={() => inspectAsset(asset)}
                  aria-label={$t('media.inspect', { name: asset.name })}
                  ><span class={`asset-thumbnail ${asset.kind}`}
                    >{#if thumbnailUrl(asset)}<img
                        src={thumbnailUrl(asset)}
                        alt=""
                        loading="lazy"
                      />{:else}<Icon name={asset.kind} />{/if}</span
                  ><span class="asset-description"
                    ><span class="asset-name">{asset.name}</span><span class="asset-meta"
                      >{asset.kind === 'scene'
                        ? $t('media.htmlScene')
                        : asset.width && asset.height
                          ? `${asset.width} × ${asset.height}`
                          : sizeLabel(asset.size)}{asset.duration
                        ? ` · ${asset.duration.toFixed(1)}s`
                        : ''}</span
                    ></span
                  ></button
                >
                <button
                  class="button quiet add-asset"
                  aria-label={$t('media.addAt', { name: asset.name })}
                  onclick={() => addAsset(asset)}
                  disabled={saving || asset.kind === 'other'}>{$t('media.add')}</button
                >
              </div>{/each}
            {#if !visibleAssets.length}<div class="empty-assets">
                <Icon name="folder" size={28} />
                <p>{$t(search || assetFilter !== 'all' ? 'media.noMatch' : 'media.none')}</p>
                {#if search || assetFilter !== 'all'}<button
                    class="button quiet"
                    onclick={() => {
                      search = '';
                      assetFilter = 'all';
                    }}>{$t('media.clearFilters')}</button
                  >{:else}<button class="button" onclick={() => importInput.click()}
                    >{$t('media.import')}</button
                  >{/if}
              </div>{/if}
          </div>
          <div class="library-footer">
            <button class="button full" onclick={() => importInput.click()} disabled={importBusy}
              ><Icon name="import" />{$t(importBusy ? 'media.importing' : 'media.import')}</button
            >
          </div>
        </aside>
        <div
          class="resize-handle vertical left-resize"
          role="slider"
          aria-valuemin="180"
          aria-valuemax="380"
          aria-label={$t('media.resize')}
          aria-orientation="vertical"
          aria-valuenow={leftWidth}
          tabindex="0"
          onpointerdown={(event) => beginResize(event, 'left')}
          onkeydown={(event) => resizeKey(event, 'left')}
        ></div>
      {/if}

      <section class="preview-panel" aria-label={$t('preview.label')}>
        {#if renderViewOpen && liveRender}<RenderLive
            render={liveRender}
            onclose={closeRenderView}
            onopen={openLiveVideo}
          />{/if}
        <div
          class="preview-viewport"
          style:display={renderViewOpen ? 'none' : undefined}
          bind:this={previewViewport}
        >
          <div
            class="preview-stage"
            style={`width:${stageWidth}px;height:${stageHeight}px;aspect-ratio:${manifest.width}/${manifest.height}`}
          >
            <iframe
              bind:this={player}
              src={renderViewOpen
                ? 'about:blank'
                : new URL('/player.html', project.previewUrl).href}
              title={$t('preview.frameTitle')}
              allow="autoplay"
              sandbox="allow-scripts allow-same-origin"
              style={`width:${manifest.width}px;height:${manifest.height}px;transform:scale(${actualScale})`}
            ></iframe>
            {#if playerReady && !playing && !scrub && texts.length}<div class="text-spots">
                {#each texts as text (`${text.clipId}:${text.prop}`)}<button
                    type="button"
                    class="text-spot"
                    class:current={editingText?.clipId === text.clipId &&
                      editingText?.prop === text.prop}
                    style={`left:${text.x * actualScale}px;top:${text.y * actualScale}px;width:${text.w * actualScale}px;height:${text.h * actualScale}px`}
                    aria-label={$t('preview.editText', { name: textName(text) })}
                    title={$t('preview.editText', { name: textName(text) })}
                    onclick={() => editText(text)}
                  ></button>{/each}
                {#if editingText}<div
                    class="text-editor"
                    style={editorPlace(editingText, actualScale, stageWidth, stageHeight)}
                  >
                    <textarea
                      bind:this={textEditor}
                      bind:value={textDraft}
                      rows={Math.min(4, Math.max(1, textDraft.split('\n').length))}
                      aria-label={$t('preview.editText', { name: textName(editingText) })}
                      onkeydown={onTextKey}
                      onblur={() => closeText(true)}></textarea>
                    <span>{$t('preview.editHint')}</span>
                  </div>{/if}
              </div>{/if}
            {#if !playerReady}<div class="preview-loading">
                <span class="loader"></span><span>{$t('preview.loading')}</span>
              </div>{/if}
          </div>
        </div>
        <div class="transport" style:display={renderViewOpen ? 'none' : undefined}>
          <div class="playback-controls">
            <button
              class="icon-button"
              onclick={() => seek(frame - 1)}
              aria-label={$t('preview.previous')}
              title={`${$t('preview.previous')} · ←`}><Icon name="back" /></button
            ><button
              class="play-button"
              onclick={togglePlayback}
              disabled={!playerReady}
              aria-label={$t(playing ? 'preview.pause' : 'preview.play')}
              title={`${$t('preview.playPause')} · Space`}
              ><Icon name={playing ? 'pause' : 'play'} size={22} /></button
            ><button
              class="icon-button"
              onclick={() => seek(frame + 1)}
              aria-label={$t('preview.next')}
              title={`${$t('preview.next')} · →`}><Icon name="next" /></button
            >
          </div>
          <div
            class="transport-readout"
            aria-label={$t('preview.time', {
              current: timecode(frame),
              total: timecode(duration),
            })}
          >
            <span class="timecode">{timecode(frame)}</span><span class="duration-time"
              >/ {timecode(duration)}</span
            >
          </div>
          <label class="frame-readout"
            ><span>{$t('preview.frame')}</span><input
              type="number"
              aria-label={$t('preview.currentFrame')}
              min="0"
              max={duration - 1}
              value={frame}
              oninput={(event) => seek(numberValue(event))}
            /></label
          >
          <label class="transport-scale"
            ><span>{$t('preview.zoom')}</span><select bind:value={previewScale}
              ><option value="fit">{$t('preview.whole')}</option
              >{#each [25, 50, 100] as percent (percent)}<option value={String(percent)}
                  >{$format.percent(percent / 100)}</option
                >{/each}</select
            ></label
          >
        </div>
      </section>

      {#if inspectorVisible}
        <div
          class="resize-handle vertical right-resize"
          role="slider"
          aria-valuemin="300"
          aria-valuemax="420"
          aria-label={$t('panel.resize')}
          aria-orientation="vertical"
          aria-valuenow={rightWidth}
          tabindex="0"
          onpointerdown={(event) => beginResize(event, 'right')}
          onkeydown={(event) => resizeKey(event, 'right')}
        ></div>
        <aside
          class="inspector"
          aria-label={$t(
            inspectorMode === 'project'
              ? 'studio.filmSettings'
              : inspectorMode === 'production'
                ? 'studio.progress'
                : 'panel.clipProperties',
          )}
        >
          <div class="panel-heading">
            <h2>
              {inspectorMode === 'project'
                ? $t('studio.filmSettings')
                : inspectorMode === 'production'
                  ? $t('studio.progress')
                  : selected
                    ? clipName(selected)
                    : $t('panel.clip')}
            </h2>
            <button
              class="icon-button"
              aria-label={$t('panel.close')}
              onclick={() => (rightOpen = false)}><Icon name="close" /></button
            >
          </div>
          <div class="inspector-content">
            {#if inspectorMode === 'production'}
              {#if live.running.length}<section
                  class="inspector-section"
                  aria-label={$t('progress.running')}
                  aria-live="polite"
                >
                  <div class="section-label">{$t('progress.running')}</div>
                  <ul class="doc-list">
                    {#each live.running as command (command.startedAt + command.label)}<li
                        class="activity-row running-row"
                      >
                        <span><span class="live-dot" aria-hidden="true"></span>{command.label}</span
                        ><span
                          >{$t('progress.since', {
                            time: $format.clock(command.startedAt),
                          })}</span
                        >
                      </li>{/each}
                  </ul>
                </section>{/if}
              {#if production?.status}<section
                  class="inspector-section production-now"
                  aria-label={$t('progress.currentStep')}
                  aria-live="polite"
                >
                  <div class="section-label">
                    {$t('progress.now')}{#if production.status.step}<span
                        >{production.status.step}</span
                      >{/if}
                  </div>
                  {#if production.status.note}<p class="production-note">
                      {production.status.note}
                    </p>{/if}
                  {#if production.status.steps?.length}<ol class="step-list">
                      {#each production.status.steps as step (step.name)}<li
                          class={`step ${step.state || 'todo'}`}
                        >
                          <span class="step-dot" aria-hidden="true"></span><span>{step.name}</span
                          >{#if step.state === 'done'}<span class="sr-only"
                              >{$t('progress.stepDone')}</span
                            >{:else if step.state === 'active'}<span class="sr-only"
                              >{$t('progress.stepActive')}</span
                            >{/if}
                        </li>{/each}
                    </ol>{/if}
                </section>{/if}
              {#if polish}<section class="inspector-section" aria-label={$t('polish.title')}>
                  <div class="section-label">
                    {$t('polish.title')}<span>{$t('polish.pass', { pass: polish.pass })}</span>
                  </div>
                  <p class="polish-line">
                    {#if polish.record.state === 'accepted'}<Icon
                        name="check"
                        size={16}
                      />{/if}{polishState}
                  </p>
                  {#if polish.counts}
                    {@const counts = polish.counts}
                    {@const fine = counts.ok + counts.kept}
                    <div
                      class="polish-bar"
                      role="img"
                      aria-label={$t('polish.summary', {
                        fine,
                        listed: counts.listed,
                        defects: counts.defects,
                      })}
                    >
                      <span style={`flex:${fine}`}></span><span
                        class="defect"
                        style={`flex:${counts.defects}`}
                      ></span><span style={`flex:${counts.open};background:transparent`}></span>
                    </div>
                    <div class="details-row">
                      <span>{$t('polish.lookedAt')}</span><span
                        >{$t('polish.lookedAtCount', {
                          seen: counts.listed - counts.open,
                          listed: counts.listed,
                        })}</span
                      >
                    </div>
                    <div class="details-row">
                      <span>{$t('polish.toFix')}</span><span>{counts.defects}</span>
                    </div>
                    {#if counts.settled}<div class="details-row">
                        <span>{$t('polish.settled')}</span><span>{counts.settled}</span>
                      </div>{/if}
                    <button class="button full polish-open" onclick={() => (polishOpen = true)}
                      >{$t('polish.open')}</button
                    >
                  {/if}
                </section>{/if}
              {#if production?.latestLook}<section
                  class="inspector-section"
                  aria-label={$t('progress.lookedLastLabel')}
                >
                  <div class="section-label">
                    {$t('progress.lookedLast')}<span
                      >{$format.ago(production.latestLook.modified, clock)}</span
                    >
                  </div>
                  <a
                    href={assetUrl(production.latestLook.path)}
                    target="_blank"
                    rel="noreferrer"
                    title={production.latestLook.path}
                    ><img
                      class="latest-look"
                      src={`${assetUrl(production.latestLook.path)}?v=${production.latestLook.modified}`}
                      alt={$t('progress.contactSheet')}
                    /></a
                  >
                </section>{/if}
              {#if production?.brief}
                <section class="inspector-section" aria-label={$t('progress.brief')}>
                  <div class="section-label">{$t('progress.brief')}</div>
                  {#if production.brief.topic}<p class="production-topic">
                      {production.brief.topic.replaceAll('*', '')}
                    </p>{/if}
                  {#if production.brief.message}<p class="production-message">
                      {production.brief.message}
                    </p>{/if}
                  {#if production.brief.seconds}<div class="details-row">
                      <span>{$t('field.length')}</span><span
                        >{$t('progress.aboutSeconds', { seconds: production.brief.seconds })}</span
                      >
                    </div>{/if}
                  {#if production.brief.format}<div class="details-row">
                      <span>{$t('field.format')}</span><span>{production.brief.format}</span>
                    </div>{/if}
                  {#if production.brief.language}<div class="details-row">
                      <span>{$t('field.language')}</span><span
                        >{$format.language(production.brief.language)}</span
                      >
                    </div>{/if}
                  <div class="details-row">
                    <span>{$t('progress.scenes')}</span><span>{production.scenes}</span>
                  </div>
                </section>
                <section class="inspector-section" aria-label={$t('progress.styleAndSkills')}>
                  <div class="section-label">{$t('field.style')}</div>
                  {#if production.preset}<p class="production-topic">
                      {production.preset.title || production.preset.name}
                    </p>
                    {#if production.preset.description}<p class="field-note">
                        {production.preset.description}
                      </p>{/if}{/if}
                  {#if production.skills.length}<p
                      class="field-note"
                      aria-label={$t('progress.skills')}
                    >
                      {$format.and(production.skills)}
                    </p>{/if}
                </section>
                {#if production.references.length}<section
                    class="inspector-section"
                    aria-label={$t('progress.references')}
                  >
                    <div class="section-label">
                      {$t('progress.references')}<span>{production.references.length}</span>
                    </div>
                    <div class="reference-grid">
                      {#each production.references as reference (reference)}{#if isImage(reference)}<img
                            src={assetUrl(reference)}
                            alt={reference.split('/').pop()}
                            title={reference.split('/').pop()}
                            loading="lazy"
                          />{:else}<span class="reference-file">{reference.split('/').pop()}</span
                          >{/if}{/each}
                    </div>
                  </section>{/if}
                {#if production.documents.length}<section
                    class="inspector-section"
                    aria-label={$t('progress.documents')}
                  >
                    <div class="section-label">{$t('progress.documents')}</div>
                    <ul class="doc-list">
                      {#each production.documents as doc (doc.path)}<li>
                          <button class="doc-link" onclick={() => openDocument(doc.path)}
                            ><span>{doc.path}</span><span>{$format.ago(doc.modified, clock)}</span
                            ></button
                          >
                        </li>{/each}
                    </ul>
                  </section>{/if}
                <section class="inspector-section" aria-label={$t('progress.changes')}>
                  <div class="section-label">{$t('progress.changes')}</div>
                  <ul class="doc-list">
                    {#each production.activity as change (change.path)}<li class="activity-row">
                        <span>{change.path}</span><span>{$format.ago(change.modified, clock)}</span>
                      </li>{/each}
                  </ul>
                </section>
              {:else}
                <section class="inspector-section">
                  <p class="field-note">{$t('progress.noBrief')}</p>
                </section>
              {/if}
            {:else if inspectorMode === 'clip' && selected}
              {#if Object.keys(selectedDefinitions).length}<section
                  class="inspector-section scene-properties"
                  aria-label={$t('clip.sceneProperties')}
                >
                  {#each Object.entries(selectedDefinitions) as [key, definition] (key)}<label
                      class:checkbox-field={definition.type === 'boolean'}
                      class:wide-field={definition.type !== 'boolean'}
                    >
                      {#if definition.type !== 'boolean'}<span>{definition.label || key}</span>{/if}
                      {#if definition.type === 'boolean'}<input
                          type="checkbox"
                          checked={Boolean(selected.props?.[key] ?? definition.default)}
                          onchange={(event) => changeProp(key, event.currentTarget.checked)}
                        /><span>{definition.label || key}</span>
                      {:else if definition.type === 'color'}<div class="color-field">
                          <input
                            type="color"
                            value={String(selected.props?.[key] ?? definition.default)}
                            onchange={(event) => changeProp(key, event.currentTarget.value)}
                          /><span>{String(selected.props?.[key] ?? definition.default)}</span>
                        </div>
                      {:else if definition.type === 'number'}<input
                          type="number"
                          min={definition.min}
                          max={definition.max}
                          step="any"
                          value={Number(selected.props?.[key] ?? definition.default)}
                          onblur={(event) => changeProp(key, numberValue(event))}
                        />
                      {:else}<textarea
                          rows="3"
                          value={String(selected.props?.[key] ?? definition.default)}
                          onblur={(event) => changeProp(key, event.currentTarget.value)}
                        ></textarea>{/if}
                    </label>{/each}
                </section>{/if}
              <section class="inspector-section">
                <h3 class="section-label">{$t('clip.timing')} <span>{$t('unit.frames')}</span></h3>
                <div class="field-grid">
                  <label
                    >{$t('clip.start')}<input
                      type="number"
                      min="0"
                      max={duration - selected.durationFrames}
                      value={selected.startFrame}
                      onblur={(event) => changeNumber('startFrame', event)}
                    /></label
                  ><label
                    >{$t('clip.duration')}<input
                      type="number"
                      min="1"
                      max={duration - selected.startFrame}
                      value={selected.durationFrames}
                      onblur={(event) => changeNumber('durationFrames', event)}
                    /></label
                  >
                </div>
              </section>
              {#if selected.type === 'audio' || selected.type === 'video'}<section
                  class="inspector-section"
                >
                  <h3 class="section-label">{$t('clip.audio')}</h3>
                  {#if selected.type === 'video'}<label class="checkbox-field"
                      ><input
                        type="checkbox"
                        checked={selected.includeAudio || false}
                        onchange={(event) =>
                          changeClip({ includeAudio: event.currentTarget.checked })}
                      /><span>{$t('clip.useVideoAudio')}</span></label
                    >{/if}<label class="range-label"
                    >{$t('clip.volume')}<span>{$format.percent(selected.gain ?? 1)}</span><input
                      type="range"
                      min="0"
                      max="2"
                      step="0.01"
                      value={selected.gain ?? 1}
                      onchange={(event) => changeClip({ gain: numberValue(event, 1) })}
                    /></label
                  ><label class="checkbox-field"
                    ><input
                      type="checkbox"
                      checked={selected.muted || false}
                      onchange={(event) => changeClip({ muted: event.currentTarget.checked })}
                    /><span>{$t('clip.mute')}</span></label
                  >
                </section>{/if}
              <details class="advanced-settings">
                <summary><span>{$t('clip.advanced')}</span></summary>
                {#if selected.type !== 'audio'}<section class="inspector-section">
                    <h3 class="section-label">
                      {$t('clip.transform')}<button
                        class="text-button"
                        onclick={() =>
                          changeClip({
                            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
                            opacity: 1,
                          })}>{$t('clip.reset')}</button
                      >
                    </h3>
                    <div class="field-grid">
                      <label
                        ><span>X (px)</span><input
                          type="number"
                          value={selected.transform?.x || 0}
                          onblur={(event) => setTransform('x', event)}
                        /></label
                      ><label
                        ><span>Y (px)</span><input
                          type="number"
                          value={selected.transform?.y || 0}
                          onblur={(event) => setTransform('y', event)}
                        /></label
                      ><label
                        >{$t('clip.scale')}<input
                          type="number"
                          min="0.01"
                          step="0.05"
                          value={selected.transform?.scale ?? 1}
                          onblur={(event) => setTransform('scale', event)}
                        /></label
                      ><label
                        ><span>{$t('clip.rotation')} (°)</span><input
                          type="number"
                          value={selected.transform?.rotation || 0}
                          onblur={(event) => setTransform('rotation', event)}
                        /></label
                      >
                    </div>
                    <label class="range-label"
                      >{$t('clip.opacity')}<span>{$format.percent(selected.opacity ?? 1)}</span
                      ><input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selected.opacity ?? 1}
                        onchange={(event) => changeClip({ opacity: numberValue(event, 1) })}
                      /></label
                    >
                  </section>{/if}
                <section class="inspector-section">
                  <h3 class="section-label">
                    {$t('clip.fades')} <span>{$t('unit.frames')}</span>
                  </h3>
                  <div class="field-grid">
                    <label
                      >{$t('clip.fadeIn')}<input
                        type="number"
                        min="0"
                        max={selected.durationFrames}
                        value={selected.fadeInFrames || 0}
                        onblur={(event) => changeNumber('fadeInFrames', event)}
                      /></label
                    ><label
                      >{$t('clip.fadeOut')}<input
                        type="number"
                        min="0"
                        max={selected.durationFrames}
                        value={selected.fadeOutFrames || 0}
                        onblur={(event) => changeNumber('fadeOutFrames', event)}
                      /></label
                    >
                  </div>
                </section>
                <section class="inspector-section">
                  <label class="wide-field"
                    ><span>{$t('clip.sourceOffset')} ({$t('unit.frames')})</span><input
                      type="number"
                      min="0"
                      value={selected.sourceOffsetFrames || 0}
                      onblur={(event) => changeNumber('sourceOffsetFrames', event)}
                    /></label
                  ><label class="wide-field"
                    >{$t('clip.track')}<select
                      value={selected.track}
                      onchange={(event) => changeClip({ track: event.currentTarget.value })}
                      >{#each manifest.tracks.filter((track) => track.kind === (selected?.type === 'audio' ? 'audio' : 'visual')) as track}<option
                          value={track.id}>{track.name || track.id}</option
                        >{/each}</select
                    ></label
                  >{#if selected.type !== 'audio'}<label class="checkbox-field"
                      ><input
                        type="checkbox"
                        checked={selected.hidden || false}
                        onchange={(event) => changeClip({ hidden: event.currentTarget.checked })}
                      /><span>{$t('clip.hide')}</span></label
                    >{/if}
                  <div class="source-detail">
                    <span>{$t('clip.source')}</span><code>{selected.src}</code>
                  </div>
                  <button class="button quiet full" onclick={copyContext}
                    ><Icon name="copy" />{$t('clip.copyContext')}</button
                  >
                </section>
              </details>
            {:else}
              <section class="inspector-section">
                <div class="field-grid">
                  <label
                    ><span>{$t('film.width')} (px)</span><input
                      type="number"
                      min="2"
                      step="2"
                      value={manifest.width}
                      onblur={(event) =>
                        edit({
                          type: 'updateProject',
                          changes: { width: Math.round(numberValue(event)) },
                        })}
                    /></label
                  ><label
                    ><span>{$t('film.height')} (px)</span><input
                      type="number"
                      min="2"
                      step="2"
                      value={manifest.height}
                      onblur={(event) =>
                        edit({
                          type: 'updateProject',
                          changes: { height: Math.round(numberValue(event)) },
                        })}
                    /></label
                  >
                </div>
                <label class="wide-field"
                  ><span>{$t('clip.duration')} ({$t('unit.frames')})</span><input
                    type="number"
                    min="1"
                    value={duration}
                    onblur={(event) =>
                      edit({
                        type: 'updateProject',
                        changes: { durationFrames: Math.round(numberValue(event)) },
                      })}
                  /></label
                >
                <div class="details-row">
                  <span>{$t('film.frameRate')}</span><span
                    >{manifest.fps.num}{manifest.fps.den !== 1 ? ` / ${manifest.fps.den}` : ''} fps</span
                  >
                </div>
                <label class="wide-field"
                  >{$t('film.background')}
                  <div class="color-field">
                    <input
                      type="color"
                      value={manifest.background?.slice(0, 7) || '#101113'}
                      onchange={(event) =>
                        edit({
                          type: 'updateProject',
                          changes: { background: event.currentTarget.value },
                        })}
                    /><span>{manifest.background || '#101113'}</span>
                  </div></label
                >
              </section>
              <details class="advanced-settings">
                <summary><span>{$t('film.location')}</span></summary>
                <div class="inspector-section">
                  <p class="project-location">{project.projectPath}</p>
                </div>
              </details>
            {/if}
          </div>
        </aside>
      {/if}
    </main>

    <div
      class="resize-handle horizontal"
      role="slider"
      aria-valuemin="180"
      aria-valuemax="1000"
      aria-label={$t('timeline.resize')}
      aria-orientation="horizontal"
      aria-valuenow={timelineHeight}
      tabindex="0"
      onpointerdown={(event) => beginResize(event, 'timeline')}
      onkeydown={(event) => resizeKey(event, 'timeline')}
    ></div>
    <section class="timeline-panel" aria-label={$t('timeline.label')}>
      <div class="timeline-toolbar">
        <div class="timeline-tools" role="group" aria-label={$t('timeline.editing')}>
          <button
            class="icon-button"
            aria-label={$t('timeline.undo')}
            title={`${$t('timeline.undo')} · Ctrl Z`}
            disabled={!project.canUndo || saving || conflict}
            onclick={() => history('undo')}><Icon name="undo" /></button
          ><button
            class="icon-button"
            aria-label={$t('timeline.redo')}
            title={`${$t('timeline.redo')} · Ctrl Shift Z`}
            disabled={!project.canRedo || saving || conflict}
            onclick={() => history('redo')}><Icon name="redo" /></button
          ><span class="toolbar-divider"></span><button
            class="button quiet tool"
            aria-label={$t('timeline.splitHint')}
            title={`${$t('timeline.splitHint')} · S`}
            disabled={!selected ||
              frame <= selected.startFrame ||
              frame >= selected.startFrame + selected.durationFrames ||
              saving}
            onclick={split}><Icon name="split" /><span>{$t('timeline.split')}</span></button
          ><button
            class="button quiet tool"
            aria-label={$t('timeline.duplicateHint')}
            title={`${$t('timeline.duplicateHint')} · D`}
            disabled={!selected || saving}
            onclick={duplicate}
            ><Icon name="duplicate" /><span>{$t('timeline.duplicate')}</span></button
          ><button
            class="button quiet tool"
            aria-label={$t('timeline.deleteHint')}
            title={`${$t('timeline.deleteHint')} · Backspace`}
            disabled={!selected || saving}
            onclick={remove}><Icon name="trash" /><span>{$t('timeline.delete')}</span></button
          >
        </div>
        <div class="timeline-secondary">
          <button
            class="button quiet tool"
            aria-pressed={snapping}
            title={`${$t('timeline.snapHint')} · N`}
            onclick={() => (snapping = !snapping)}
            ><Icon name="snap" /><span>{$t('timeline.snap')}</span></button
          ><span class="toolbar-divider"></span>
          <div class="timeline-zoom">
            <button
              class="icon-button"
              aria-label={$t('timeline.zoomOut')}
              title={$t('timeline.zoomOut')}
              disabled={zoom <= 1}
              onclick={() => (zoom = Math.max(1, zoom / 1.5))}><Icon name="minus" /></button
            ><input
              type="range"
              aria-label={$t('timeline.zoom')}
              title={$t('timeline.zoom')}
              min="1"
              max="12"
              step="0.1"
              bind:value={zoom}
            /><button
              class="icon-button"
              aria-label={$t('timeline.zoomIn')}
              title={$t('timeline.zoomIn')}
              disabled={zoom >= 12}
              onclick={() => (zoom = Math.min(12, zoom * 1.5))}><Icon name="plus" /></button
            ><button
              class="button quiet"
              title={$t('timeline.wholeHint')}
              disabled={zoom === 1}
              onclick={() => {
                zoom = 1;
                timeline.scrollLeft = 0;
              }}>{$t('timeline.whole')}</button
            >
          </div>
        </div>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable timeline is an intentional keyboard-accessible work region.) -->
      <div
        class="timeline-scroll"
        bind:this={timeline}
        tabindex="0"
        role="region"
        aria-label={$t('timeline.tracksLabel')}
      >
        <div class="timeline-content" style={`width:${laneWidth + 182}px;min-height:100%`}>
          <div class="ruler-row">
            <div class="ruler-label">
              <span>{$t('timeline.tracks')}</span><button
                class="icon-button"
                aria-label={$t('timeline.addTrack')}
                title={$t('timeline.addTrack')}
                onclick={() =>
                  edit({
                    type: 'addTrack',
                    track: {
                      id: `visual-${crypto.randomUUID().slice(0, 8)}`,
                      name: $t('timeline.newVisualTrack', {
                        number:
                          manifest!.tracks.filter((track) => track.kind === 'visual').length + 1,
                      }),
                      kind: 'visual',
                    },
                  })}><Icon name="plus" size={18} /></button
              >
            </div>
            <div
              class="ruler"
              role="slider"
              aria-label={$t('timeline.playhead')}
              aria-valuemin="0"
              aria-valuemax={duration - 1}
              aria-valuenow={frame}
              aria-valuetext={$t('timeline.playheadAt', { time: timecode(frame), frame })}
              tabindex="0"
              onpointerdown={beginScrub}
              style={`width:${laneWidth}px`}
            >
              {#each rulerTicks as seconds}<span
                  class="ruler-tick"
                  style={`left:${seconds * fps * pixelsPerFrame}px`}>{rulerLabel(seconds)}</span
                >{/each}
            </div>
          </div>
          {#each manifest.tracks as track (track.id)}
            <div class="track-row" class:audio-track={track.kind === 'audio'}>
              <div class="track-label">
                <Icon name={track.kind === 'audio' ? 'audio' : 'video'} size={20} /><span
                  class="track-name"
                  title={track.name || track.id}>{track.name || track.id}</span
                ><button
                  class="icon-button track-toggle"
                  class:muted={track.hidden || track.muted}
                  aria-label={`${trackToggle(track)}: ${track.name || track.id}`}
                  title={trackToggle(track)}
                  onclick={() =>
                    edit({
                      type: 'updateTrack',
                      id: track.id,
                      changes:
                        track.kind === 'audio'
                          ? { muted: !track.muted }
                          : { hidden: !track.hidden },
                    })}
                  ><Icon
                    name={track.kind === 'audio'
                      ? track.muted
                        ? 'muted'
                        : 'volume'
                      : track.hidden
                        ? 'hidden'
                        : 'eye'}
                    size={20}
                  /></button
                >
              </div>
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="track-lane"
                data-track={track.id}
                class:track-disabled={track.hidden || track.muted}
                onpointerdown={beginScrub}
                style={`width:${laneWidth}px;background-size:${rulerInterval * fps * pixelsPerFrame}px 100%`}
              >
                {#each manifest.clips.filter((clip) => (draftClip?.id === clip.id ? draftClip.track : clip.track) === track.id) as clip (clip.id)}
                  {@const item = draftClip?.id === clip.id ? draftClip : clip}
                  <div
                    class={`timeline-clip ${item.type}`}
                    class:selected={selection === item.id}
                    class:clip-disabled={item.hidden || item.muted}
                    style={`left:${item.startFrame * pixelsPerFrame}px;width:${Math.max(4, item.durationFrames * pixelsPerFrame)}px`}
                  >
                    <button
                      class="clip-body"
                      aria-label={$t('timeline.clip', {
                        name: clipName(item),
                        type: item.type,
                        start: item.startFrame,
                        duration: item.durationFrames,
                      })}
                      title={`${item.src}\n${timecode(item.startFrame)} → ${timecode(item.startFrame + item.durationFrames)}\n${$t('timeline.clipFrames', { count: item.durationFrames })}`}
                      onpointerdown={(event) => beginDrag(event, item, 'move')}
                      onclick={(event) => {
                        event.stopPropagation();
                        selectClip(item.id);
                      }}
                      ondblclick={() => seek(item.startFrame)}
                      ><span class="clip-title"
                        ><Icon name={item.type} size={18} /><span>{clipName(item)}</span
                        >{#if item.hidden || item.muted}<Icon
                            name={item.hidden ? 'hidden' : 'muted'}
                            size={18}
                          />{/if}</span
                      >{#if item.type === 'image'}<span
                          class="clip-image-strip"
                          style={`background-image:url("${assetUrl(item.src)}")`}
                        ></span>{:else if item.type === 'audio'}<span class="audio-line"
                          >{#if waveformPath(item, assetMetadata[item.src])}<svg
                              viewBox="0 0 100 20"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                              ><path
                                d={waveformPath(item, assetMetadata[item.src])}
                                fill="none"
                                stroke="currentColor"
                                stroke-width="0.55"
                              /></svg
                            >{/if}</span
                        >{/if}</button
                    >
                    <button
                      class="trim-handle left"
                      aria-label={$t('timeline.trimStartOf', { name: clipName(item) })}
                      title={$t('timeline.trimStart')}
                      onpointerdown={(event) => beginDrag(event, item, 'left')}
                      tabindex={selection === item.id ? 0 : -1}
                    ></button><button
                      class="trim-handle right"
                      aria-label={$t('timeline.trimEndOf', { name: clipName(item) })}
                      title={$t('timeline.trimEnd')}
                      onpointerdown={(event) => beginDrag(event, item, 'right')}
                      tabindex={selection === item.id ? 0 : -1}
                    ></button>
                    {#if item.fadeInFrames}<span
                        class="fade-indicator in"
                        style={`width:${Math.min(item.durationFrames, item.fadeInFrames) * pixelsPerFrame}px`}
                      ></span>{/if}{#if item.fadeOutFrames}<span
                        class="fade-indicator out"
                        style={`width:${Math.min(item.durationFrames, item.fadeOutFrames) * pixelsPerFrame}px`}
                      ></span>{/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
          {#if !manifest.clips.length}<div class="timeline-empty">
              <button class="button" onclick={() => (leftOpen = true)}
                ><Icon name="plus" />{$t('media.addFirst')}</button
              >
            </div>{/if}
          <div class="timeline-bottom-space"></div>
          {#if snapFrame !== null}<div
              class="snap-line"
              style={`left:${182 + snapFrame * pixelsPerFrame}px`}
            ></div>{/if}
          <div class="playhead" style={`left:${182 + frame * pixelsPerFrame}px`}>
            <span class="playhead-head"></span>
          </div>
        </div>
      </div>
    </section>
  {/if}
  <input
    type="file"
    multiple
    bind:this={importInput}
    class="sr-only"
    tabindex="-1"
    accept=".html,.htm,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp4,.mov,.mkv,.webm,.wav,.mp3,.m4a,.aac,.ogg,.flac"
    onchange={(event) => event.currentTarget.files && importFiles(event.currentTarget.files)}
  />
</div>

{#if diagnosticsOpen}<div class="modal-backdrop">
    <div
      class="modal diagnostics-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-title"
      tabindex="-1"
      use:modalFocus
    >
      <div class="modal-heading">
        <h2 id="diagnostics-title">{$t('studio.diagnostics')}</h2>
        <button
          class="icon-button"
          aria-label={$t('diagnostics.close')}
          onclick={() => (diagnosticsOpen = false)}><Icon name="close" /></button
        >
      </div>
      {#if checking}<div class="diagnostics-empty">
          <span class="loader"></span>{$t('diagnostics.checking')}
        </div>{:else if diagnostics.length}{#each diagnostics as diagnostic}<div
            class="diagnostic"
            class:warning={diagnostic.severity === 'warning'}
          >
            <Icon name="alert" />
            <div>
              <p>{diagnostic.message}</p>
              {#if diagnostic.path}<code>{diagnostic.path}</code>{/if}{#if diagnostic.clipId}<button
                  class="text-button"
                  onclick={() => {
                    selectClip(diagnostic.clipId!);
                    diagnosticsOpen = false;
                  }}>{$t('diagnostics.selectClip')}</button
                >{/if}<span class="diagnostic-code">{diagnostic.code}</span>
            </div>
          </div>{/each}{:else}<p class="diagnostics-empty">
          {lastCheckFrames === null
            ? $t('diagnostics.never')
            : $t('diagnostics.clean', { count: lastCheckFrames })}
        </p>{/if}
      <div class="modal-actions">
        <button class="button" onclick={() => (diagnosticsOpen = false)}
          >{$t('common.close')}</button
        ><button class="button primary" onclick={checkProject} disabled={checking}
          >{$t(checking ? 'studio.checking' : 'studio.check')}</button
        >
      </div>
    </div>
  </div>{/if}
{#if exportOpen}
  <div class="modal-backdrop">
    <div
      class="modal export-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
      tabindex="-1"
      use:modalFocus
    >
      <div class="modal-heading">
        <div>
          <span class="eyebrow">MP4 · H.265</span>
          <h2 id="export-title">{$t('export.title')}</h2>
        </div>
        <button
          class="icon-button"
          aria-label={$t('export.close')}
          onclick={() => (exportOpen = false)}><Icon name="close" size={20} /></button
        >
      </div>
      <div class="export-summary">
        <span>{manifest?.width} × {manifest?.height}</span><span>{Number(fps.toFixed(3))} fps</span
        ><span>{$t('export.seconds', { seconds: $format.number(duration / fps, 2) })}</span>
      </div>
      <label class="wide-field"
        >{$t('export.path')}<input
          type="text"
          bind:value={output}
          disabled={renderActive}
          placeholder="renders/video.mp4"
        /><span class="field-note">{$t('export.pathNote')}</span></label
      >
      <fieldset class="quality-options" disabled={renderActive}>
        <legend>{$t('export.quality')}</legend><label class:chosen={quality === 'draft'}
          ><input type="radio" bind:group={quality} value="draft" /><span
            ><strong>{$t('export.draft')}</strong><small>{$t('export.draftNote')}</small></span
          ></label
        ><label class:chosen={quality === 'final'}
          ><input type="radio" bind:group={quality} value="final" /><span
            ><strong>{$t('export.final')}</strong><small>{$t('export.finalNote')}</small></span
          ></label
        >
      </fieldset>
      <label class="checkbox-field overwrite-label"
        ><input type="checkbox" bind:checked={overwrite} disabled={renderActive} /><span
          >{$t('export.overwrite')}</span
        ></label
      >{#if exportError}<p class="render-error" role="alert">{exportError}</p>{/if}{#if job}<div
          class="render-status"
          role="status"
        >
          <div>
            <span
              >{job.status === 'completed'
                ? $t('export.complete')
                : job.status === 'failed'
                  ? $t('export.failed')
                  : job.status === 'cancelled'
                    ? $t('export.cancelled')
                    : job.stage}</span
            ><span>{renderActive ? $format.percent(progress / 100) : ''}</span>
          </div>
          {#if renderActive}<progress max="100" value={progress}></progress><span
              class="render-frames"
              >{$t('export.frames', { completed: job.completed, total: job.total })}</span
            >{/if}{#if job.error}<p class="render-error">
              {job.error}
            </p>{/if}{#if job.status === 'completed'}<p class="completed-path">{job.output}</p>{/if}
        </div>{/if}
      <div class="modal-actions">
        {#if renderActive}<button class="button" onclick={cancelRender}
            >{$t('export.cancel')}</button
          >{:else if job?.status === 'completed'}<button class="button" onclick={startRender}
            >{$t('export.again')}</button
          ><button class="button primary" onclick={openRender}
            ><Icon name="external" />{$t('export.open')}</button
          >{:else}<button class="button" onclick={() => (exportOpen = false)}
            >{$t('common.close')}</button
          ><button
            class="button primary"
            onclick={startRender}
            disabled={exportStarting || !output.trim()}
            ><Icon name="export" />{$t(exportStarting ? 'export.starting' : 'export.title')}</button
          >{/if}
      </div>
    </div>
  </div>
{/if}

{#if shortcutsOpen}
  <div class="modal-backdrop">
    <div
      class="modal shortcuts-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      tabindex="-1"
      use:modalFocus
    >
      <div class="modal-heading">
        <h2 id="shortcuts-title">{$t('studio.shortcuts')}</h2>
        <button
          class="icon-button"
          aria-label={$t('shortcuts.close')}
          onclick={() => (shortcutsOpen = false)}><Icon name="close" /></button
        >
      </div>
      {#each SHORTCUTS as [action, keys] (action)}<div class="shortcut-row">
          <span>{$t(action)}</span><kbd>{keys}</kbd>
        </div>{/each}
    </div>
  </div>
{/if}

{#if polishOpen && polish}
  <div class="modal-backdrop">
    <div
      class="modal polish-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="polish-title"
      use:modalFocus
    >
      <div class="modal-heading">
        <div>
          <h2 id="polish-title">{$t('polish.heading', { pass: polish.pass })}</h2>
          <p>{$t('polish.lead')} {polishState}.</p>
        </div>
        <button
          class="icon-button"
          aria-label={$t('common.close')}
          onclick={() => (polishOpen = false)}><Icon name="close" /></button
        >
      </div>
      <div class="polish-filters" role="group" aria-label={$t('polish.filters')}>
        {#each polishFilters(polish.counts) as [value, count] (value)}<button
            class="button small"
            aria-pressed={polishFilter === value}
            onclick={() => (polishFilter = value)}>{$t(`polish.filter.${value}`, { count })}</button
          >{/each}
      </div>
      <div class="polish-body">
        <ul class="polish-list">
          {#each polishRows as row (row.file)}<li>
              <button
                aria-current={polishRow?.file === row.file}
                onclick={() => (polishFile = row.file)}
                ><img src={polishUrl(row.file)} alt="" loading="lazy" /><span
                  ><strong
                    ><span class={`verdict ${row.verdict}`} aria-hidden="true"></span>{polishName(
                      row,
                    )}</strong
                  ><span class="said"
                    >{row.verdict === 'open' ? $t('polish.notLooked') : row.said}</span
                  ></span
                ></button
              >
            </li>{:else}<li class="field-note polish-empty">{$t('polish.empty')}</li>{/each}
        </ul>
        <div class="polish-view">
          {#if polishRow}
            <img src={polishUrl(polishRow.file)} alt={polishName(polishRow)} />
            <dl>
              <dt>{$t('polish.found')}</dt>
              <dd>{polishRow.verdict === 'open' ? $t('polish.notLooked') : polishRow.said}</dd>
              {#if polishRow.fix}<dt>{$t('polish.fix')}</dt>
                <dd>{polishRow.fix}</dd>{/if}
            </dl>
            {#if polishRow.closeUps.length}<div class="polish-closeups">
                {#each polishRow.closeUps as close (close)}<img
                    src={polishUrl(close)}
                    alt={$t('polish.closeUp')}
                    loading="lazy"
                  />{/each}
              </div>{/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if documentView}
  <div class="modal-backdrop">
    <div
      class="modal document-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-title"
      tabindex="-1"
      use:modalFocus
    >
      <div class="modal-heading">
        <h2 id="document-title">{documentView.path}</h2>
        <button
          class="icon-button"
          aria-label={$t('document.close')}
          onclick={() => (documentView = null)}><Icon name="close" /></button
        >
      </div>
      <pre class="document-text">{documentView.text}</pre>
    </div>
  </div>
{/if}

{#if contextDialog}
  <div class="modal-backdrop">
    <div
      class="modal context-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="context-title"
      tabindex="-1"
      use:modalFocus
    >
      <div class="modal-heading">
        <h2 id="context-title">{$t('studio.copyContext')}</h2>
        <button
          class="icon-button"
          aria-label={$t('context.close')}
          onclick={() => (contextDialog = '')}><Icon name="close" /></button
        >
      </div>
      <p class="field-note">{$t('context.blocked')}</p>
      <textarea
        bind:this={contextArea}
        aria-label={$t('context.label')}
        readonly
        value={contextDialog}></textarea>
      <div class="modal-actions">
        <button
          class="button primary"
          onclick={() => {
            contextArea.focus();
            contextArea.select();
          }}>{$t('context.selectAll')}</button
        >
      </div>
    </div>
  </div>
{/if}
