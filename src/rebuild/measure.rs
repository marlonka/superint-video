//! What `rebuild` measures on decoded pixels: how much the picture changes from one frame to
//! the next and where it changes for good, how alike two pictures are and where they part, the
//! box and colour of what is drawn on a plain ground, and how far one soundtrack runs behind
//! another. Plain functions of pixel buffers, so they are tested without FFmpeg.
use serde::{Deserialize, Serialize};

/// The size every frame is reduced to, in colour, before changes between frames are measured:
/// two shots of the same brightness but other colours still differ.
pub const FEATURE: (usize, usize) = (64, 36);
/// Cells per side of the grid that says where two pictures part.
pub const GRID: usize = 8;

/// BT.601 luma of packed RGB, one byte per pixel.
pub fn grey(rgb: &[u8]) -> Vec<u8> {
    rgb.as_chunks::<3>()
        .0
        .iter()
        .map(|p| ((77 * p[0] as u32 + 150 * p[1] as u32 + 29 * p[2] as u32) >> 8) as u8)
        .collect()
}

/// A grey picture reduced to `tw` × `th` by averaging the source pixels each target pixel covers.
pub fn shrink(px: &[u8], w: usize, h: usize, tw: usize, th: usize) -> Vec<u8> {
    let mut out = vec![0u8; tw * th];
    for ty in 0..th {
        let (y0, y1) = (ty * h / th, ((ty + 1) * h / th).max(ty * h / th + 1).min(h));
        for tx in 0..tw {
            let (x0, x1) = (tx * w / tw, ((tx + 1) * w / tw).max(tx * w / tw + 1).min(w));
            let mut sum = 0u32;
            for y in y0..y1 {
                for x in x0..x1 {
                    sum += px[y * w + x] as u32;
                }
            }
            let n = ((y1 - y0) * (x1 - x0)).max(1) as u32;
            out[ty * tw + tx] = ((sum + n / 2) / n) as u8;
        }
    }
    out
}

/// A browser level (CSS, sRGB) as the tool's render writes it into a film: through linear light
/// and back up a 2.4 power, the BT.1886 curve the film is tagged with. Measured on a grey ramp
/// through the renderer, every level lands within 1.5 of this curve.
pub fn film_level(css: u8) -> f64 {
    let x = css as f64 / 255.0;
    let linear = if x <= 0.04045 {
        x / 12.92
    } else {
        ((x + 0.055) / 1.055).powf(2.4)
    };
    255.0 * linear.powf(1.0 / 2.4)
}

/// For every level of a film, the CSS level that renders to it. A source is shown and measured
/// in these levels, so a colour read from it goes into a scene as it is and the render brings
/// it back to the source's level. Dark levels move most: the film's 23 is CSS 10.
pub fn css_levels() -> [u8; 256] {
    let mut table = [0u8; 256];
    for (film, css) in table.iter_mut().enumerate() {
        *css = (0..=255u8)
            .min_by(|&a, &b| {
                (film_level(a) - film as f64)
                    .abs()
                    .total_cmp(&(film_level(b) - film as f64).abs())
            })
            .unwrap_or(0);
    }
    table
}

/// Film levels turned into CSS levels in place.
pub fn to_css(px: &mut [u8], table: &[u8; 256]) {
    for p in px {
        *p = table[*p as usize];
    }
}

/// Packed RGB reduced to `tw` × `th`, each channel averaged like `shrink`.
pub fn shrink_rgb(rgb: &[u8], w: usize, h: usize, tw: usize, th: usize) -> Vec<u8> {
    let channels: Vec<Vec<u8>> = (0..3)
        .map(|c| {
            let plane: Vec<u8> = rgb.iter().skip(c).step_by(3).copied().collect();
            shrink(&plane, w, h, tw, th)
        })
        .collect();
    (0..tw * th)
        .flat_map(|i| [channels[0][i], channels[1][i], channels[2][i]])
        .collect()
}

/// Mean absolute difference of two buffers of the same length, 0 to 255.
pub fn mad(a: &[u8], b: &[u8]) -> f64 {
    debug_assert_eq!(a.len(), b.len());
    if a.is_empty() {
        return 0.0;
    }
    let sum: u64 = a
        .iter()
        .zip(b)
        .map(|(&x, &y)| (x as i32 - y as i32).unsigned_abs() as u64)
        .sum();
    sum as f64 / a.len() as f64
}

fn median(mut values: Vec<f64>) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mid = values.len() / 2;
    values.select_nth_unstable_by(mid, f64::total_cmp);
    values[mid]
}

/// Share of pixels whose grey level moves by more than this between two frames, for `changed`.
const MOVED: i32 = 16;

/// Share of the pixels, 0 to 1, that differ clearly between two pictures of one size.
pub fn changed(a: &[u8], b: &[u8]) -> f64 {
    if a.is_empty() {
        return 0.0;
    }
    let n = a
        .iter()
        .zip(b)
        .filter(|&(&x, &y)| (x as i32 - y as i32).abs() > MOVED)
        .count();
    n as f64 / a.len() as f64
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// Most of the picture is replaced from one frame to the next: a new shot.
    Cut,
    /// Part of the picture jumps from one frame to the next: a jump cut inside one take where
    /// the room stays, or something that pops in or out.
    Change,
    /// A few frames of another picture, then the one before comes back.
    Flash,
    /// One picture blends into the next over several frames.
    Dissolve,
}

/// A place where the picture changes: from `frame` on, through `to` (the same frame for a cut).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Change {
    pub frame: u64,
    pub kind: Kind,
    pub to: u64,
    /// Mean difference per colour channel across the change at 64 × 36, 0 to 255.
    pub strength: f64,
    /// Share of the picture that changes, 0 to 1.
    pub share: f64,
}

/// How large a jump between neighbouring frames has to be to count.
#[derive(Debug, Clone, Copy)]
pub struct Sensitivity {
    /// Smallest mean grey difference at 64 × 36 that can be a change at all.
    pub floor: f64,
    /// How many times the usual frame-to-frame difference around it a change must reach.
    pub ratio: f64,
    /// Share of the picture a jump must replace to be a cut rather than a change.
    pub whole: f64,
    /// Share of the picture that must differ across a blend for it to count as a dissolve.
    pub blend: f64,
}

/// Shots of a whole picture. A cut between two takes of the same speaker still moves a head
/// and a collar by several grey levels; footage that only moves stays near its own median.
pub const SHOTS: Sensitivity = Sensitivity {
    floor: 4.0,
    ratio: 3.5,
    whole: 0.5,
    blend: 0.4,
};
/// Changes inside a region, such as a caption swapping its words: a small region changes by
/// little when a line of text changes, so the floor is lower and the ratio higher.
pub const EVENTS: Sensitivity = Sensitivity {
    floor: 1.5,
    ratio: 5.0,
    whole: 0.5,
    blend: 0.1,
};

/// Frames on either side whose differences give the usual level a change is measured against.
const AROUND: usize = 12;
/// Frames on either side a change must be the largest jump of.
const PEAK: usize = 3;
/// Longest flash, in frames, before the picture that came before is back.
const FLASH: usize = 4;
/// Half the span over which a blend between two pictures is looked for.
const BLEND: usize = 6;
/// A frame between two pictures this close to their average, relative to how much they differ,
/// is part of a blend. A pan or a push puts a different picture in the middle, not an average.
const BLEND_RESIDUAL: f64 = 0.3;

/// Every change in a run of grey frames of one size, frame numbers counted from `first`.
pub fn changes(frames: &[Vec<u8>], first: u64, s: Sensitivity) -> Vec<Change> {
    let n = frames.len();
    if n < 2 {
        return Vec::new();
    }
    let mut d = vec![0.0; n];
    for i in 1..n {
        d[i] = mad(&frames[i - 1], &frames[i]);
    }
    let usual = |i: usize| {
        let lo = i.saturating_sub(AROUND).max(1);
        let hi = (i + AROUND).min(n - 1);
        median(
            (lo..=hi)
                .filter(|&j| j + 1 < i || j > i + 1)
                .map(|j| d[j])
                .collect(),
        )
    };
    let mut found: Vec<Change> = Vec::new();
    let mut i = 1;
    while i < n {
        let level = d[i];
        let peak = (i.saturating_sub(PEAK).max(1)..=(i + PEAK).min(n - 1))
            .all(|j| d[j] < level || (d[j] == level && j >= i));
        if level >= s.floor && level >= s.ratio * usual(i) && peak {
            // A flash: the picture before comes back within a few frames.
            let back = (1..=FLASH)
                .take_while(|k| i + k < n)
                .find(|&k| mad(&frames[i - 1], &frames[i + k]) < (0.4 * level).min(s.floor));
            let share = changed(&frames[i - 1], &frames[i]);
            if let Some(k) = back {
                found.push(Change {
                    frame: first + i as u64,
                    kind: Kind::Flash,
                    to: first + (i + k - 1) as u64,
                    strength: round(level),
                    share: round3(share),
                });
                i += k + 1;
                continue;
            }
            found.push(Change {
                frame: first + i as u64,
                kind: if share >= s.whole {
                    Kind::Cut
                } else {
                    Kind::Change
                },
                to: first + i as u64,
                strength: round(level),
                share: round3(share),
            });
        }
        i += 1;
    }
    // Blends: the middle frame is the average of the frames a few either side.
    let hard = |at: usize| {
        found.iter().any(|c| {
            let (a, b) = ((c.frame - first) as usize, (c.to - first) as usize);
            at + BLEND + 1 >= a && at <= b + BLEND + 1
        })
    };
    let mut blending = vec![false; n];
    for i in BLEND..n.saturating_sub(BLEND) {
        let (a, b) = (&frames[i - BLEND], &frames[i + BLEND]);
        let apart = mad(a, b);
        if apart < 2.0 * s.floor || hard(i) || changed(a, b) < s.blend {
            continue;
        }
        let mid: Vec<u8> = a
            .iter()
            .zip(b.iter())
            .map(|(&x, &y)| (x as u16 + y as u16).div_ceil(2) as u8)
            .collect();
        blending[i] = mad(&frames[i], &mid) < BLEND_RESIDUAL * apart;
    }
    let base = median(d[1..].to_vec());
    let mut i = 0;
    while i < n {
        if !blending[i] {
            i += 1;
            continue;
        }
        let start = i;
        while i < n && blending[i] {
            i += 1;
        }
        let centre = (start + i - 1) / 2;
        // The blend runs while the picture keeps changing faster than it usually does.
        let busy = |j: usize| d[j] > 1.5 * base + 0.3;
        let mut from = centre;
        while from > 1 && centre - from < 45 && busy(from - 1) {
            from -= 1;
        }
        let mut to = centre;
        while to + 1 < n && to - centre < 45 && busy(to + 1) {
            to += 1;
        }
        let (before, after) = (
            &frames[from.saturating_sub(1)],
            &frames[(to + 1).min(n - 1)],
        );
        found.push(Change {
            frame: first + from as u64,
            kind: Kind::Dissolve,
            to: first + to as u64,
            strength: round(mad(before, after)),
            share: round3(changed(before, after)),
        });
    }
    found.sort_by_key(|c| c.frame);
    found
}

fn round(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

/// How alike two grey pictures of one size are, overall and per grid cell.
#[derive(Debug, Clone)]
pub struct Likeness {
    /// Mean structural similarity, 1 for the same picture.
    pub score: f64,
    /// The same over what is not covered by a mask; None when the masks cover everything.
    pub rebuilt: Option<f64>,
    /// Mean similarity per cell, `GRID` × `GRID` in rows; NaN for a cell without windows.
    pub cells: Vec<f64>,
}

const WINDOW: usize = 8;
const STEP: usize = 4;

/// Structural similarity over 8 × 8 windows on a 4-pixel step. Windows whose centre lies in one
/// of `masks` (x, y, w, h in these pixels) count for `score` but not for `rebuilt`.
pub fn likeness(a: &[u8], b: &[u8], w: usize, h: usize, masks: &[[f64; 4]]) -> Likeness {
    const C1: f64 = (0.01 * 255.0) * (0.01 * 255.0);
    const C2: f64 = (0.03 * 255.0) * (0.03 * 255.0);
    let mut cells = vec![(0.0f64, 0usize); GRID * GRID];
    let (mut all, mut count, mut own, mut own_count) = (0.0, 0usize, 0.0, 0usize);
    let n = (WINDOW * WINDOW) as f64;
    let mut y = 0;
    while y + WINDOW <= h {
        let mut x = 0;
        while x + WINDOW <= w {
            let (mut sa, mut sb, mut saa, mut sbb, mut sab) = (0u64, 0u64, 0u64, 0u64, 0u64);
            for row in y..y + WINDOW {
                let at = row * w + x;
                for (&p, &q) in a[at..at + WINDOW].iter().zip(&b[at..at + WINDOW]) {
                    let (p, q) = (p as u64, q as u64);
                    sa += p;
                    sb += q;
                    saa += p * p;
                    sbb += q * q;
                    sab += p * q;
                }
            }
            let (ma, mb) = (sa as f64 / n, sb as f64 / n);
            let va = saa as f64 / n - ma * ma;
            let vb = sbb as f64 / n - mb * mb;
            let cov = sab as f64 / n - ma * mb;
            let s = ((2.0 * ma * mb + C1) * (2.0 * cov + C2))
                / ((ma * ma + mb * mb + C1) * (va + vb + C2));
            let (cx, cy) = (
                x as f64 + WINDOW as f64 / 2.0,
                y as f64 + WINDOW as f64 / 2.0,
            );
            all += s;
            count += 1;
            if !masks
                .iter()
                .any(|m| cx >= m[0] && cx < m[0] + m[2] && cy >= m[1] && cy < m[1] + m[3])
            {
                own += s;
                own_count += 1;
            }
            let cell = ((cy as usize * GRID / h).min(GRID - 1)) * GRID
                + (cx as usize * GRID / w).min(GRID - 1);
            cells[cell].0 += s;
            cells[cell].1 += 1;
            x += STEP;
        }
        y += STEP;
    }
    Likeness {
        score: if count > 0 { all / count as f64 } else { 1.0 },
        rebuilt: (own_count > 0).then(|| own / own_count as f64),
        cells: cells
            .into_iter()
            .map(|(s, c)| if c > 0 { s / c as f64 } else { f64::NAN })
            .collect(),
    }
}

/// Mean absolute difference per colour channel of two RGB buffers, 0 to 255.
pub fn colour_difference(a: &[u8], b: &[u8]) -> f64 {
    mad(a, b)
}

/// Standard deviation of a grey picture: near 0 for an empty, flat frame.
pub fn spread(px: &[u8]) -> f64 {
    if px.is_empty() {
        return 0.0;
    }
    let n = px.len() as f64;
    let mean = px.iter().map(|&p| p as f64).sum::<f64>() / n;
    (px.iter().map(|&p| (p as f64 - mean).powi(2)).sum::<f64>() / n).sqrt()
}

/// What is drawn on a plain ground inside a region: its box, its colour and how much of the box
/// it fills. The ground is the most common colour; ink is every pixel well away from it.
#[derive(Debug, Clone, Serialize)]
pub struct Ink {
    /// x, y, w, h in the region's pixels; None when nothing stands out from the ground.
    #[serde(rename = "box")]
    pub bounds: Option<[u32; 4]>,
    pub colour: String,
    pub ground: String,
    /// Share of the box's pixels that are ink: heavier type fills more.
    pub coverage: f64,
}

/// Channel distance from the ground above which a pixel counts as ink.
const INK_LEVEL: i32 = 48;

pub fn ink(rgb: &[u8], w: usize, h: usize) -> Ink {
    let mut bins = vec![(0u32, [0u64; 3]); 4096];
    for p in rgb.as_chunks::<3>().0 {
        let bin = ((p[0] as usize >> 4) << 8) | ((p[1] as usize >> 4) << 4) | (p[2] as usize >> 4);
        bins[bin].0 += 1;
        for (sum, &v) in bins[bin].1.iter_mut().zip(p) {
            *sum += v as u64;
        }
    }
    let (count, sum) = bins.iter().max_by_key(|b| b.0).copied().unwrap_or_default();
    let ground = if count > 0 {
        [0, 1, 2].map(|c| (sum[c] / count as u64) as u8)
    } else {
        [0; 3]
    };
    let is_ink = |p: &[u8]| (0..3).any(|c| (p[c] as i32 - ground[c] as i32).abs() > INK_LEVEL);
    let mut rows = vec![0u32; h];
    let mut cols = vec![0u32; w];
    for y in 0..h {
        for x in 0..w {
            if is_ink(&rgb[(y * w + x) * 3..][..3]) {
                rows[y] += 1;
                cols[x] += 1;
            }
        }
    }
    // A single stray pixel in a row or column is grain, not a stroke.
    let span = |counts: &[u32]| {
        let first = counts.iter().position(|&c| c >= 2)?;
        let last = counts.iter().rposition(|&c| c >= 2)?;
        Some((first as u32, last as u32))
    };
    let bounds = match (span(&cols), span(&rows)) {
        (Some((x0, x1)), Some((y0, y1))) => Some([x0, y0, x1 - x0 + 1, y1 - y0 + 1]),
        _ => None,
    };
    // Colour and coverage from inside the box only, so stray grain does not tint them.
    let (mut inked, mut total) = (0u64, [0u64; 3]);
    if let Some(b) = bounds {
        for y in b[1]..b[1] + b[3] {
            for x in b[0]..b[0] + b[2] {
                let p = &rgb[(y as usize * w + x as usize) * 3..][..3];
                if is_ink(p) {
                    inked += 1;
                    for c in 0..3 {
                        total[c] += p[c] as u64;
                    }
                }
            }
        }
    }
    let colour = if inked > 0 {
        [0, 1, 2].map(|c| (total[c] / inked) as u8)
    } else {
        ground
    };
    let coverage = bounds.map_or(0.0, |b| round3(inked as f64 / (b[2] as f64 * b[3] as f64)));
    Ink {
        bounds,
        colour: hex(colour),
        ground: hex(ground),
        coverage,
    }
}

fn round3(v: f64) -> f64 {
    (v * 1000.0).round() / 1000.0
}

pub fn hex(c: [u8; 3]) -> String {
    format!("#{:02x}{:02x}{:02x}", c[0], c[1], c[2])
}

/// Mean colour per cell of a `cols` × `rows` grid over an RGB picture, in rows.
pub fn colour_grid(rgb: &[u8], w: usize, h: usize, cols: usize, rows: usize) -> Vec<Vec<String>> {
    (0..rows)
        .map(|r| {
            (0..cols)
                .map(|c| {
                    let (x0, x1) = (c * w / cols, ((c + 1) * w / cols).max(c * w / cols + 1));
                    let (y0, y1) = (r * h / rows, ((r + 1) * h / rows).max(r * h / rows + 1));
                    let mut sum = [0u64; 3];
                    for y in y0..y1.min(h) {
                        for x in x0..x1.min(w) {
                            for (k, s) in sum.iter_mut().enumerate() {
                                *s += rgb[(y * w + x) * 3 + k] as u64;
                            }
                        }
                    }
                    let n = ((y1.min(h) - y0) * (x1.min(w) - x0)).max(1) as u64;
                    hex(sum.map(|s| (s / n) as u8))
                })
                .collect()
        })
        .collect()
}

/// Loudness every `hop` samples: the root mean square of each stretch.
pub fn envelope(samples: &[i16], hop: usize) -> Vec<f32> {
    samples
        .chunks(hop)
        .map(|c| {
            let sum: f64 = c.iter().map(|&s| (s as f64) * (s as f64)).sum();
            (sum / c.len() as f64).sqrt() as f32
        })
        .collect()
}

/// How many steps `b` runs behind `a` (negative: ahead), within `max` steps either way, and how
/// well the two then line up (normalised correlation, 1 for the same sound). None for silence.
pub fn lag(a: &[f32], b: &[f32], max: usize) -> Option<(i64, f64)> {
    let len = a.len().min(b.len());
    if len <= 2 * max + 10 {
        return None;
    }
    let mean = |s: &[f32]| s[..len].iter().map(|&v| v as f64).sum::<f64>() / len as f64;
    let (ma, mb) = (mean(a), mean(b));
    let ea: Vec<f64> = a[..len].iter().map(|&v| v as f64 - ma).collect();
    let eb: Vec<f64> = b[..len].iter().map(|&v| v as f64 - mb).collect();
    let mut best: Option<(i64, f64)> = None;
    for shift in -(max as i64)..=(max as i64) {
        let (mut sum, mut na, mut nb) = (0.0, 0.0, 0.0);
        let from = (max as i64 + shift) as usize;
        for (&x, &y) in ea[max..len - max].iter().zip(&eb[from..]) {
            sum += x * y;
            na += x * x;
            nb += y * y;
        }
        if na <= f64::EPSILON || nb <= f64::EPSILON {
            continue;
        }
        let r = sum / (na * nb).sqrt();
        if best.is_none_or(|(_, b)| r > b) {
            best = Some((shift, r));
        }
    }
    best.map(|(s, r)| (s, round3(r)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flat(level: u8) -> Vec<u8> {
        vec![level; FEATURE.0 * FEATURE.1]
    }
    /// A picture with a bright block whose left edge is at `x`: moving it is camera motion.
    fn block(x: usize, ground: u8) -> Vec<u8> {
        let (w, h) = FEATURE;
        let mut px = vec![ground; w * h];
        for y in 8..28 {
            for col in x..(x + 16).min(w) {
                px[y * w + col] = 220;
            }
        }
        px
    }

    #[test]
    fn a_cut_is_found_on_its_frame_and_motion_is_not_a_cut() {
        let mut frames = Vec::new();
        for i in 0..40 {
            frames.push(block(4 + i % 3, 40)); // a little drift
        }
        for i in 0..40 {
            frames.push(block(30 + i / 4, 120));
        }
        let found = changes(&frames, 100, SHOTS);
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!((found[0].frame, found[0].kind), (140, Kind::Cut));
    }

    #[test]
    fn a_jump_inside_one_take_counts_as_a_cut() {
        // The same room, the speaker a few pixels to the side from one frame to the next.
        let mut frames: Vec<_> = (0..30).map(|_| block(20, 60)).collect();
        frames.extend((0..30).map(|_| block(27, 60)));
        let found = changes(&frames, 0, SHOTS);
        assert_eq!(found.iter().map(|c| c.frame).collect::<Vec<_>>(), [30]);
        // The room stays, so it is a change inside the shot, not a new shot.
        assert_eq!(found[0].kind, Kind::Change);
    }

    #[test]
    fn a_white_flash_comes_back_to_the_picture_before() {
        let mut frames: Vec<_> = (0..30).map(|_| block(10, 50)).collect();
        frames.extend([flat(255), flat(255)]);
        frames.extend((0..30).map(|_| block(10, 50)));
        let found = changes(&frames, 0, SHOTS);
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(
            (found[0].frame, found[0].to, found[0].kind),
            (30, 31, Kind::Flash)
        );
    }

    #[test]
    fn a_blend_is_a_dissolve_and_a_pan_is_not() {
        let (a, b) = (block(4, 30), block(44, 200));
        let mut frames: Vec<_> = (0..30).map(|_| a.clone()).collect();
        for k in 1..=15 {
            frames.push(
                a.iter()
                    .zip(&b)
                    .map(|(&x, &y)| ((x as u32 * (16 - k) + y as u32 * k) / 16) as u8)
                    .collect(),
            );
        }
        frames.extend((0..30).map(|_| b.clone()));
        let found = changes(&frames, 0, SHOTS);
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(found[0].kind, Kind::Dissolve);
        assert!((28..=33).contains(&found[0].frame) && (42..=47).contains(&found[0].to));

        // A block sliding steadily across the frame changes as much, but never blends.
        let pan: Vec<_> = (0..60).map(|i| block(i * 3 / 4, 30)).collect();
        assert!(changes(&pan, 0, SHOTS).is_empty());
    }

    #[test]
    fn the_same_picture_is_alike_and_a_mask_leaves_its_part_out() {
        let (w, h) = (64, 64);
        let a: Vec<u8> = (0..w * h).map(|i| ((i * 37) % 251) as u8).collect();
        let same = likeness(&a, &a, w, h, &[]);
        assert!((same.score - 1.0).abs() < 1e-9);
        let mut b = a.clone();
        for y in 0..h {
            for x in 0..32 {
                b[y * w + x] = 0; // the left half is gone
            }
        }
        let half = likeness(&a, &b, w, h, &[]);
        assert!(half.score < 0.7, "{}", half.score);
        assert!(half.cells[0] < 0.2 && half.cells[GRID - 1] > 0.99);
        // Masking the left half (and the windows that straddle its edge) leaves only the
        // matching right half for `rebuilt`.
        let masked = likeness(&a, &b, w, h, &[[0.0, 0.0, 36.0, 64.0]]);
        assert!(masked.rebuilt.unwrap() > 0.99);
        assert!(
            likeness(&a, &b, w, h, &[[0.0, 0.0, 64.0, 64.0]])
                .rebuilt
                .is_none()
        );
    }

    #[test]
    fn ink_finds_the_box_of_a_line_on_its_ground() {
        let (w, h) = (100, 40);
        let mut rgb = vec![0u8; w * h * 3];
        for p in rgb.as_chunks_mut::<3>().0 {
            *p = [240, 240, 235];
        }
        for y in 10..30 {
            for x in 20..70 {
                rgb[(y * w + x) * 3..][..3].copy_from_slice(&[20, 20, 30]);
            }
        }
        rgb[(2 * w + 90) * 3..][..3].copy_from_slice(&[0, 0, 0]); // one speck of grain
        let found = ink(&rgb, w, h);
        assert_eq!(found.bounds, Some([20, 10, 50, 20]));
        assert_eq!(found.ground, "#f0f0eb");
        assert_eq!(found.colour, "#14141e");
        assert!(found.coverage > 0.99);
    }

    #[test]
    fn a_late_soundtrack_is_found_behind_by_its_lag() {
        let a: Vec<f32> = (0..3000)
            .map(|i| if (i / 37) % 3 == 0 { 1.0 } else { 0.1 } + ((i * 7919) % 13) as f32 * 0.01)
            .collect();
        let mut b = vec![0.1f32; 25];
        b.extend_from_slice(&a);
        let (shift, r) = lag(&a, &b, 200).unwrap();
        assert_eq!(shift, 25);
        assert!(r > 0.95);
        assert!(lag(&vec![0.5; 3000], &vec![0.5; 3000], 200).is_none());
    }

    #[test]
    fn film_levels_come_back_as_the_css_levels_that_render_to_them() {
        // Measured through the renderer: CSS 10 became 23, 23 became 34, 100 became 108.
        for (css, film) in [
            (10u8, 23.0),
            (23, 34.0),
            (100, 108.0),
            (0, 0.0),
            (255, 255.0),
        ] {
            assert!(
                (film_level(css) - film).abs() <= 1.6,
                "{css}: {}",
                film_level(css)
            );
        }
        let table = css_levels();
        assert_eq!((table[0], table[255]), (0, 255));
        assert!((9..=11).contains(&table[23]), "{}", table[23]);
        assert!(table.windows(2).all(|w| w[0] <= w[1]));
    }

    #[test]
    fn two_shots_of_one_brightness_still_cut_in_colour() {
        // Blue and dark red of nearly the same grey level, each with a box of its own.
        let shot = |ground: [u8; 3], x: usize| {
            let (w, h) = FEATURE;
            let mut rgb = vec![0u8; w * h * 3];
            for (i, p) in rgb.as_chunks_mut::<3>().0.iter_mut().enumerate() {
                let (px, py) = (i % w, i / w);
                *p = if (x..x + 12).contains(&px) && (10..24).contains(&py) {
                    [240, 240, 240]
                } else {
                    ground
                };
            }
            rgb
        };
        assert!((grey(&[32, 48, 96])[0] as i32 - grey(&[106, 28, 28])[0] as i32).abs() < 4);
        let mut frames: Vec<_> = (0..30).map(|_| shot([32, 48, 96], 10)).collect();
        frames.extend((0..30).map(|_| shot([106, 28, 28], 40)));
        let found = changes(&frames, 0, SHOTS);
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!((found[0].frame, found[0].kind), (30, Kind::Cut));
    }

    #[test]
    fn shrinking_averages_and_grey_weights_green_most() {
        assert_eq!(
            shrink_rgb(&[0, 10, 200, 255, 30, 100], 2, 1, 1, 1),
            [128, 20, 150]
        );
        assert_eq!(shrink(&[0, 255, 255, 0], 2, 2, 1, 1), [128]);
        assert_eq!(grey(&[0, 255, 0, 255, 0, 0]), [149, 76]);
        assert_eq!(
            colour_grid(&[255, 0, 0, 0, 0, 255], 2, 1, 2, 1),
            [vec!["#ff0000".to_string(), "#0000ff".to_string()]]
        );
    }
}
