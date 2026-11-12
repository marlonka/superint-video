/**
 * A recognisable outline of Germany (rough border points in degrees, equirectangular with a
 * cos(latitude) correction), smoothed with a Catmull-Rom spline.
 */
const DE = [
  [8.6, 54.9], [9.6, 54.85], [10.0, 54.6], [11.0, 54.45], [10.9, 54.05], [11.6, 54.15], [12.3, 54.45], [13.0, 54.55],
  [13.6, 54.45], [14.2, 53.95], [14.4, 53.3], [14.6, 52.6], [14.7, 52.1], [14.75, 51.6], [15.0, 51.15], [14.8, 50.88],
  [14.3, 51.05], [13.6, 50.72], [12.9, 50.4], [12.2, 50.3], [12.5, 49.8], [12.9, 49.4], [13.8, 48.8], [13.4, 48.55],
  [13.0, 48.25], [12.85, 47.7], [12.2, 47.62], [11.3, 47.42], [10.45, 47.5], [9.7, 47.58], [8.6, 47.65], [7.6, 47.6],
  [7.65, 48.1], [7.95, 48.65], [8.2, 48.97], [7.0, 49.12], [6.45, 49.45], [6.15, 50.1], [6.2, 50.6], [6.0, 50.85],
  [6.05, 51.3], [6.2, 51.85], [6.8, 52.1], [7.0, 52.45], [7.1, 53.25], [7.4, 53.7], [8.25, 53.6], [8.6, 53.9],
  [8.95, 54.0], [8.8, 54.5],
];

/** Germany as an SVG path, centred on 0,0, `size` px tall (north–south). Returns {d, project}. */
export function germany(size) {
  const lat0 = 51.15, lon0 = 10.45, k = size / (55.1 - 47.27), c = Math.cos((lat0 * Math.PI) / 180);
  const project = ([lon, lat]) => [(lon - lon0) * c * k, -(lat - lat0) * k];
  const pts = DE.map(project);
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return { d: d + 'Z', project };
}

/** Rough positions of cities in degrees, for pins. */
export const CITIES = {
  Berlin: [13.4, 52.52], Hamburg: [10.0, 53.55], München: [11.58, 48.14], Köln: [6.96, 50.94], Frankfurt: [8.68, 50.11],
  Stuttgart: [9.18, 48.78], Leipzig: [12.37, 51.34], Hannover: [9.73, 52.37], Dresden: [13.74, 51.05], Nürnberg: [11.08, 49.45],
  Bremen: [8.8, 53.08], Dortmund: [7.46, 51.51], Kiel: [10.13, 54.32], Erfurt: [11.03, 50.98], Dietzenbach: [8.78, 50.01],
};
