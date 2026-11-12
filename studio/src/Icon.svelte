<script lang="ts">
  export let name: string;
  export let size = 20;
  const paths: Record<string, string> = {
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    production: 'M4 5h16M4 12h10M4 19h7M18 14l2 2 4-4',
    moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
    play: 'm8 5 11 7-11 7Z',
    pause: 'M8 5v14M16 5v14',
    back: 'm14 6-6 6 6 6',
    chevron: 'm6 9 6 6 6-6',
    next: 'm10 6 6 6-6 6',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    close: 'm6 6 12 12M6 18 18 6',
    check: 'm5 12 4 4L19 6',
    import: 'M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4',
    export: 'M12 15V3m-5 5 5-5 5 5M5 16v4h14v-4',
    undo: 'M8 4 3 9l5 5M4 9h10a6 6 0 0 1 0 12',
    redo: 'm16 4 5 5-5 5m4-5H10a6 6 0 0 0 0 12',
    split: 'M12 3v18M5 5h3v14H5M19 5h-3v14h3',
    duplicate: 'M8 8h12v12H8ZM4 15V4h11',
    trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    hidden: 'm3 3 18 18M10 5h2c6 0 10 7 10 7a23 23 0 0 1-4 4M6 6c-3 2-4 6-4 6s4 7 10 7c1 0 3 0 4-1',
    volume: 'M3 9h4l5-4v14l-5-4H3ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    muted: 'M3 9h4l5-4v14l-5-4H3Zm13 0 6 6m-6 0 6-6',
    scene: 'm8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14',
    image: 'M3 4h18v16H3Zm0 12 6-6 5 5 3-3 4 4M16 7h.01',
    video: 'M3 5h18v14H3Zm0 4h18M7 5l3 4m4-4 3 4m-7 3 5 2-5 2Z',
    audio: 'M9 17V5l11-2v12M9 7l11-2M9 17a3 3 0 1 0-3 3c2 0 3-1 3-3m11-2a3 3 0 1 0-3 3c2 0 3-1 3-3',
    folder: 'M3 5h7l2 3h9v12H3Z',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',
    copy: 'M8 8h12v13H8ZM16 8V3H3v13h5',
    snap: 'M5 4v9a7 7 0 0 0 14 0V4h-5v9a2 2 0 0 1-4 0V4ZM5 8h5m4 0h5',
    settings: 'M4 7h16M4 17h16M9 4v6M15 14v6',
    refresh: 'M20 7V3m0 4h-4M4 17v4m0-4h4M4 10a8 8 0 0 1 14-5l2 2M4 17l2 2a8 8 0 0 0 14-5',
    alert: 'M12 3 2 21h20ZM12 9v5m0 3v.01',
    external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
    keyboard:
      'M2 5h20v14H2Zm4 4h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M7 16h10',
    arrowLeft: 'M19 12H5m6-6-6 6 6 6',
    film: 'M3 5h18v14H3ZM7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4',
    globe:
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z',
    download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
    mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8',
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'more'}
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  {:else}
    <path d={paths[name] || paths.folder} />
  {/if}
</svg>
