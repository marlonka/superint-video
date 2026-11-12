//! Audio through FFmpeg: decode to f32, write WAV, and level and loudness measurements.
use crate::{process, project::atomic_write};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{io::Cursor, path::Path, time::Duration};
use tokio_util::sync::CancellationToken;

/// Working rate for voice and music.
pub const RATE: u32 = 48_000;

pub async fn decode(path: &Path, rate: u32) -> Result<Vec<f32>> {
    decode_channels(path, rate, 1).await
}

/// Interleaved f32 samples with `channels` channels (FFmpeg up- or downmixes).
pub async fn decode_channels(path: &Path, rate: u32, channels: u32) -> Result<Vec<f32>> {
    let mut cmd = process::command(process::binary("ffmpeg"));
    cmd.args(["-nostdin", "-v", "error", "-i"]).arg(path).args([
        "-ac",
        &channels.to_string(),
        "-ar",
        &rate.to_string(),
        "-f",
        "f32le",
        "-",
    ]);
    let bytes = process::output(cmd, &CancellationToken::new(), Duration::from_secs(300))
        .await
        .with_context(|| format!("Decoding {}", path.display()))?;
    Ok(bytes
        .as_chunks::<4>()
        .0
        .iter()
        .map(|c| f32::from_le_bytes(*c))
        .collect())
}

/// 16 kHz mono 16-bit WAV, the input MAI-Transcribe expects.
pub async fn wav_16k(path: &Path) -> Result<Vec<u8>> {
    Ok(wav_bytes(&decode(path, 16_000).await?, 16_000, 16))
}

pub fn wav_bytes(samples: &[f32], rate: u32, bits: u16) -> Vec<u8> {
    wav_bytes_channels(samples, rate, bits, 1)
}

/// `samples` interleaved with `channels` channels.
pub fn wav_bytes_channels(samples: &[f32], rate: u32, bits: u16, channels: u16) -> Vec<u8> {
    let spec = hound::WavSpec {
        channels,
        sample_rate: rate,
        bits_per_sample: bits,
        sample_format: hound::SampleFormat::Int,
    };
    let scale = f64::from((1u32 << (bits - 1)) - 1);
    let mut cursor = Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec).expect("valid WAV spec");
        for &sample in samples {
            let value = (f64::from(sample.clamp(-1.0, 1.0)) * scale).round() as i32;
            writer.write_sample(value).expect("in-memory write");
        }
        writer.finalize().expect("in-memory write");
    }
    cursor.into_inner()
}

/// Writes 24-bit mono WAV atomically.
pub fn write_wav(path: &Path, samples: &[f32], rate: u32) -> Result<()> {
    atomic_write(path, &wav_bytes(samples, rate, 24))
}

/// BS.1770 measurement of interleaved samples.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loudness {
    /// Gated integrated loudness in LUFS; −70 when everything is below the absolute gate.
    pub integrated_lufs: f64,
    /// Four times oversampled peak of the loudest channel.
    pub true_peak_db: f64,
    pub range_lu: f64,
}

pub fn loudness(samples: &[f32], rate: u32, channels: u32) -> Result<Loudness> {
    use ebur128::{EbuR128, Mode};
    let mut meter = EbuR128::new(channels, rate, Mode::I | Mode::LRA | Mode::TRUE_PEAK)
        .context("loudness meter")?;
    meter
        .add_frames_f32(samples)
        .context("loudness meter input")?;
    let integrated = meter.loudness_global().context("integrated loudness")?;
    let mut peak = 0f64;
    for channel in 0..channels {
        peak = peak.max(meter.true_peak(channel).context("true peak")?);
    }
    Ok(Loudness {
        integrated_lufs: round(integrated.max(-70.0), 2),
        true_peak_db: round(db(peak), 2),
        range_lu: round(meter.loudness_range().unwrap_or(0.0), 2),
    })
}

pub fn db(linear: f64) -> f64 {
    if linear <= 1e-10 {
        -200.0
    } else {
        20.0 * linear.log10()
    }
}

/// RMS level in dBFS per window of `window` samples.
pub fn window_db(samples: &[f32], window: usize) -> Vec<f64> {
    samples
        .chunks(window.max(1))
        .map(|chunk| {
            let power = chunk
                .iter()
                .map(|&s| f64::from(s) * f64::from(s))
                .sum::<f64>()
                / chunk.len() as f64;
            db(power.sqrt())
        })
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Levels {
    pub seconds: f64,
    pub peak_db: f64,
    /// RMS over the windows above −60 dBFS, so pauses do not lower it.
    pub rms_db: f64,
    pub clipped: usize,
}

pub fn levels(samples: &[f32], rate: u32) -> Levels {
    let peak = samples.iter().fold(0f32, |m, &s| m.max(s.abs()));
    let window = (rate / 100) as usize;
    let active: Vec<f64> = samples
        .chunks(window.max(1))
        .map(|chunk| {
            chunk
                .iter()
                .map(|&s| f64::from(s) * f64::from(s))
                .sum::<f64>()
                / chunk.len() as f64
        })
        .filter(|&power| db(power.sqrt()) > -60.0)
        .collect();
    let rms = if active.is_empty() {
        0.0
    } else {
        (active.iter().sum::<f64>() / active.len() as f64).sqrt()
    };
    Levels {
        seconds: round(samples.len() as f64 / f64::from(rate), 3),
        peak_db: round(db(f64::from(peak)), 2),
        rms_db: round(db(rms), 2),
        clipped: samples.iter().filter(|s| s.abs() >= 0.999).count(),
    }
}

pub fn round(value: f64, digits: i32) -> f64 {
    let scale = 10f64.powi(digits);
    (value * scale).round() / scale
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wav_round_trip_and_levels() {
        let samples: Vec<f32> = (0..4800)
            .map(|i| 0.5 * (i as f32 * 0.05).sin())
            .chain(std::iter::repeat_n(0.0, 4800))
            .collect();
        let bytes = wav_bytes(&samples, RATE, 24);
        let reader = hound::WavReader::new(Cursor::new(bytes)).unwrap();
        assert_eq!(reader.spec().bits_per_sample, 24);
        assert_eq!(reader.len() as usize, samples.len());
        let levels = levels(&samples, RATE);
        assert_eq!(levels.seconds, 0.2);
        assert!((levels.peak_db - db(0.5)).abs() < 0.1);
        // The silent half does not count towards the RMS.
        assert!((levels.rms_db - db(0.5 / 2f64.sqrt())).abs() < 0.3);
        assert_eq!(levels.clipped, 0);
    }

    #[test]
    fn loudness_of_a_reference_sine() {
        // BS.1770: a 997 Hz sine peaking at −20 dBFS in both channels reads −20 LUFS.
        let amplitude = 10f32.powf(-20.0 / 20.0);
        let samples: Vec<f32> = (0..RATE as usize * 3)
            .flat_map(|i| {
                let s = amplitude * (i as f32 * 997.0 * std::f32::consts::TAU / RATE as f32).sin();
                [s, s]
            })
            .collect();
        let measured = loudness(&samples, RATE, 2).unwrap();
        assert!((measured.integrated_lufs + 20.0).abs() < 0.3);
        assert!((measured.true_peak_db - (-20.0)).abs() < 0.2);
    }
}
