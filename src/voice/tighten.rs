//! Silence detection, pause tightening and joining takes with short crossfades.
//! Pauses are only ever shortened; the voice is never padded to fit the picture.
use crate::audio::window_db;

/// Window for level analysis: 10 ms.
const WINDOW_SECONDS: f64 = 0.01;

pub struct Analysis {
    levels: Vec<f64>,
    window: usize,
    len: usize,
    pub threshold_db: f64,
}

impl Analysis {
    /// Silence is anything 32 dB under the loud parts of the take, within −60…−30 dBFS.
    pub fn new(samples: &[f32], rate: u32) -> Self {
        let window = ((f64::from(rate) * WINDOW_SECONDS) as usize).max(1);
        let levels = window_db(samples, window);
        let mut loud: Vec<f64> = levels.iter().copied().filter(|&l| l > -70.0).collect();
        loud.sort_by(f64::total_cmp);
        let reference = loud
            .get((loud.len() as f64 * 0.95) as usize)
            .or(loud.last())
            .copied()
            .unwrap_or(-20.0);
        Self {
            levels,
            window,
            len: samples.len(),
            threshold_db: (reference - 32.0).clamp(-60.0, -30.0),
        }
    }

    fn silent(&self, index: usize) -> bool {
        self.levels[index] < self.threshold_db
    }

    /// First and last sample of speech.
    pub fn speech(&self) -> Option<(usize, usize)> {
        let first = (0..self.levels.len()).find(|&i| !self.silent(i))?;
        let last = (0..self.levels.len()).rev().find(|&i| !self.silent(i))?;
        Some((
            first * self.window,
            ((last + 1) * self.window).min(self.len),
        ))
    }

    /// Silent runs inside the speech of at least `min` samples, as sample ranges.
    pub fn pauses(&self, min: usize) -> Vec<(usize, usize)> {
        let Some((start, end)) = self.speech() else {
            return Vec::new();
        };
        let (first, last) = (start / self.window, end.div_ceil(self.window));
        let mut out = Vec::new();
        let mut run = None;
        for index in first..last {
            match (self.silent(index), run) {
                (true, None) => run = Some(index),
                (false, Some(from)) => {
                    let (a, b) = (from * self.window, index * self.window);
                    if b - a >= min {
                        out.push((a, b));
                    }
                    run = None;
                }
                _ => {}
            }
        }
        out
    }

    /// Linear RMS over the windows with speech.
    pub fn active_rms(&self) -> f64 {
        let active: Vec<f64> = (0..self.levels.len())
            .filter(|&i| !self.silent(i))
            .map(|i| 10f64.powf(self.levels[i] / 10.0))
            .collect();
        if active.is_empty() {
            0.0
        } else {
            (active.iter().sum::<f64>() / active.len() as f64).sqrt()
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Plan {
    /// Silence before the first word.
    pub lead: f64,
    /// Silence after the last word.
    pub tail: f64,
    /// Longest pause inside a paragraph.
    pub sentence: f64,
    /// Pause between paragraphs.
    pub paragraph: f64,
    pub crossfade: f64,
    pub tighten: bool,
}

/// A range of one take; positions outside the take read as silence.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Segment {
    pub take: usize,
    pub start: i64,
    pub end: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct Placed {
    pub segment: Segment,
    pub out_start: usize,
}

/// Cuts per take: trims to the plan's lead, tail and paragraph pauses, and shortens long pauses.
pub fn segments(takes: &[Analysis], rate: u32, plan: &Plan) -> (Vec<Segment>, usize) {
    let samples = |seconds: f64| (seconds * f64::from(rate)).round() as i64;
    let crossfade = samples(plan.crossfade);
    let keep_a = (samples(plan.sentence) + crossfade) / 2;
    let keep_b = samples(plan.sentence) + crossfade - keep_a;
    let half = (samples(plan.paragraph) + crossfade) / 2;
    let mut out = Vec::new();
    let mut shortened = 0;
    for (take, analysis) in takes.iter().enumerate() {
        let (a, b) = analysis
            .speech()
            .map(|(a, b)| (a as i64, b as i64))
            .unwrap_or((0, analysis.len as i64));
        let first = take == 0;
        let last = take + 1 == takes.len();
        // Two joined halves give exactly one paragraph pause after the crossfade.
        let head = if first {
            samples(plan.lead)
        } else {
            samples(plan.paragraph) + crossfade - half
        };
        let tail = if last { samples(plan.tail) } else { half };
        let mut cursor = a - head;
        if plan.tighten {
            let min = (samples(plan.sentence) + crossfade + 1).max(1) as usize;
            for (s0, s1) in analysis.pauses(min) {
                let (s0, s1) = (s0 as i64, s1 as i64);
                if s0 <= a || s1 >= b {
                    continue;
                }
                out.push(Segment {
                    take,
                    start: cursor,
                    end: s0 + keep_a,
                });
                cursor = s1 - keep_b;
                shortened += 1;
            }
        }
        out.push(Segment {
            take,
            start: cursor,
            end: b + tail,
        });
    }
    (out, shortened)
}

/// Joins the segments with linear crossfades of `crossfade` samples.
pub fn render(
    takes: &[Vec<f32>],
    segments: &[Segment],
    crossfade: usize,
) -> (Vec<f32>, Vec<Placed>) {
    let mut out: Vec<f32> = Vec::new();
    let mut placed = Vec::new();
    for &segment in segments {
        let source = &takes[segment.take];
        let piece: Vec<f32> = (segment.start..segment.end)
            .map(|k| {
                usize::try_from(k)
                    .ok()
                    .and_then(|k| source.get(k))
                    .copied()
                    .unwrap_or(0.0)
            })
            .collect();
        let overlap = if out.is_empty() {
            0
        } else {
            crossfade.min(out.len()).min(piece.len())
        };
        let at = out.len() - overlap;
        for k in 0..overlap {
            let w = (k as f32 + 0.5) / overlap as f32;
            out[at + k] = out[at + k] * (1.0 - w) + piece[k] * w;
        }
        out.extend_from_slice(&piece[overlap..]);
        placed.push(Placed {
            segment,
            out_start: at,
        });
    }
    (out, placed)
}

/// Where a moment of a take lands in the output. Moments inside a removed pause land on the cut.
pub fn remap(placed: &[Placed], take: usize, seconds: f64, rate: u32) -> f64 {
    let sample = (seconds * f64::from(rate)).round() as i64;
    let mut position = None;
    for p in placed.iter().filter(|p| p.segment.take == take) {
        if sample < p.segment.start {
            position.get_or_insert(p.out_start as i64);
            break;
        }
        if sample < p.segment.end {
            position = Some(p.out_start as i64 + sample - p.segment.start);
            break;
        }
        position = Some(p.out_start as i64 + p.segment.end - p.segment.start);
    }
    position.unwrap_or(0).max(0) as f64 / f64::from(rate)
}

/// Shortest silence that counts as a pause for snapping; stop-consonant closures are shorter.
const SNAP_PAUSE: f64 = 0.1;

/// Moves word edges next to a pause onto the measured edge of the speech. Transcribers place
/// them up to about 0.1 s off: Gemini in 0.1 s steps, MAI at the vowel instead of the consonant.
/// Edges inside connected speech stay where the transcriber put them. Returns how far each
/// snapped edge moved, in seconds.
pub fn snap(times: &mut [(f64, f64)], analysis: &Analysis, rate: u32, reach: f64) -> Vec<f64> {
    let Some((first, last)) = analysis.speech() else {
        return Vec::new();
    };
    let seconds = |sample: usize| sample as f64 / f64::from(rate);
    let pauses = analysis.pauses((SNAP_PAUSE * f64::from(rate)) as usize);
    let onsets = std::iter::once(first).chain(pauses.iter().map(|p| p.1));
    let offsets = pauses.iter().map(|p| p.0).chain(std::iter::once(last));
    let nearest = |edge: f64, of: &dyn Fn(&(f64, f64)) -> f64| {
        times
            .iter()
            .enumerate()
            .map(|(i, t)| (i, (of(t) - edge).abs()))
            .filter(|(_, d)| *d <= reach)
            .min_by(|a, b| a.1.total_cmp(&b.1))
            .map(|(i, _)| i)
    };
    let starts: Vec<(usize, f64)> = onsets
        .map(seconds)
        .filter_map(|edge| nearest(edge, &|t| t.0).map(|i| (i, edge)))
        .collect();
    let ends: Vec<(usize, f64)> = offsets
        .map(seconds)
        .filter_map(|edge| nearest(edge, &|t| t.1).map(|i| (i, edge)))
        .collect();
    let mut moved = Vec::new();
    for (i, edge) in starts {
        if edge < times[i].1 && (i == 0 || edge >= times[i - 1].0) {
            moved.push(edge - times[i].0);
            times[i].0 = edge;
            if i > 0 && times[i - 1].1 > edge {
                times[i - 1].1 = edge;
            }
        }
    }
    for (i, edge) in ends {
        if edge > times[i].0 && times.get(i + 1).is_none_or(|next| edge <= next.0) {
            moved.push(edge - times[i].1);
            times[i].1 = edge;
        }
    }
    moved
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 1000;

    /// `pattern` in 10 ms steps: '#' tone, '.' silence.
    fn take(pattern: &str) -> Vec<f32> {
        pattern
            .chars()
            .flat_map(|c| {
                (0..10).map(move |i| {
                    if c == '#' {
                        if i % 2 == 0 { 0.5 } else { -0.5 }
                    } else {
                        0.0
                    }
                })
            })
            .collect()
    }

    fn plan() -> Plan {
        Plan {
            lead: 0.1,
            tail: 0.3,
            sentence: 0.24,
            paragraph: 0.36,
            crossfade: 0.02,
            tighten: true,
        }
    }

    #[test]
    fn finds_speech_and_pauses() {
        let samples = take("....####..........####......");
        let analysis = Analysis::new(&samples, RATE);
        assert_eq!(analysis.speech(), Some((40, 220)));
        assert_eq!(analysis.pauses(50), vec![(80, 180)]);
        assert!(analysis.active_rms() > 0.4);
    }

    #[test]
    fn long_pauses_shrink_to_the_sentence_pause_and_short_ones_stay() {
        // 0.5 s pause → 0.24 s; 0.1 s pause untouched.
        let samples = take("####")
            .into_iter()
            .chain(take(&".".repeat(50)))
            .chain(take("####"))
            .chain(take(".........."))
            .chain(take("####"))
            .collect::<Vec<f32>>();
        let analysis = Analysis::new(&samples, RATE);
        let (segments, shortened) = segments(&[analysis], RATE, &plan());
        assert_eq!(shortened, 1);
        let (out, placed) = render(std::slice::from_ref(&samples), &segments, 20);
        let after = Analysis::new(&out, RATE);
        let pauses: Vec<usize> = after.pauses(50).iter().map(|(a, b)| b - a).collect();
        assert_eq!(pauses, vec![240, 100]);
        // Lead 0.1 s before the first word, 0.3 s of silence after the last.
        assert_eq!(after.speech().unwrap().0, 100);
        assert_eq!(out.len() - after.speech().unwrap().1, 300);
        // A word after the cut moves earlier by the removed time.
        let second_word = 0.54;
        let mapped = remap(&placed, 0, second_word, RATE);
        assert!((mapped - (0.1 + 0.04 + 0.24)).abs() < 0.011, "{mapped}");
    }

    #[test]
    fn word_edges_at_pauses_snap_to_the_measured_speech() {
        // Speech 0.1–0.4 and 0.6–0.9 s; the transcriber is 0.1 s off at every pause edge.
        let pattern = [
            ".".repeat(10),
            "#".repeat(30),
            ".".repeat(20),
            "#".repeat(30),
            ".".repeat(10),
        ];
        let samples = take(&pattern.concat());
        let analysis = Analysis::new(&samples, RATE);
        let mut times = vec![(0.0, 0.25), (0.25, 0.5), (0.5, 0.7), (0.72, 0.8)];
        let moved = snap(&mut times, &analysis, RATE, 0.12);
        // Edges between words in connected speech (0.25, 0.7) stay.
        assert_eq!(
            times,
            vec![(0.1, 0.25), (0.25, 0.4), (0.6, 0.7), (0.72, 0.9)]
        );
        assert_eq!(moved.len(), 4);
        assert!(moved.iter().all(|m| (m.abs() - 0.1).abs() < 1e-9));
    }

    #[test]
    fn paragraphs_join_with_the_paragraph_pause_even_without_silence_around() {
        let a = take("####");
        let b = take("....####");
        let analyses = [Analysis::new(&a, RATE), Analysis::new(&b, RATE)];
        let (segments, _) = segments(&analyses, RATE, &plan());
        let (out, placed) = render(&[a, b], &segments, 20);
        let after = Analysis::new(&out, RATE);
        let pauses: Vec<usize> = after.pauses(50).iter().map(|(a, b)| b - a).collect();
        assert_eq!(pauses, vec![360]);
        // The second take's first word starts after lead + word + pause.
        let start = remap(&placed, 1, 0.04, RATE);
        assert!((start - (0.1 + 0.04 + 0.36)).abs() < 0.011, "{start}");
    }
}
