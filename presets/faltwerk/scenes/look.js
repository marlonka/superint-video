// The colours that make this volume: binding, foil, endpaper, the film's signal colour. From direction.md.
export const LOOK = {
  hide: '#1e3d33',        // the leather of the binding (painted): fir green
  leather: '#1a362d',     // the same leather as the renderer's base colour
  edge: '#1d392f',        // board edges and spine
  pit: 'rgba(2,12,9,.62)',
  gold: '#c49846',
  signal: '#2a55d4',      // cobalt: Code Mode alone (the program, its result, the words)
  signalLight: '#6f93f0', signalDark: '#18337f',
  ink: '#2b2420',
  // Marbled endpaper: cell colours and rims, as [r, g, b].
  marble: {
    cell: [[36, 74, 62], [47, 97, 80], [36, 74, 62], [26, 58, 48], [61, 122, 102], [47, 97, 80], [36, 74, 62], [75, 88, 102], [47, 97, 80], [176, 138, 72], [36, 74, 62], [26, 58, 48], [61, 122, 102], [47, 97, 80], [91, 127, 110], [36, 74, 62]],
    rim: [[26, 58, 48], [20, 44, 37], [75, 88, 102], [150, 112, 62], [26, 58, 48], [20, 44, 37], [75, 88, 102], [150, 112, 62], [26, 58, 48], [20, 44, 37], [75, 88, 102], [150, 112, 62], [26, 58, 48], [20, 44, 37], [75, 88, 102], [150, 112, 62]],
    cream: [226, 212, 184],
  },
};
