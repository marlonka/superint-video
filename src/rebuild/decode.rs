//! Frames and samples out of a video file through FFmpeg, counted the way a film counts them:
//! the picture is resampled to the film's frame rate first, so frame `n` is the picture at
//! `n / fps` seconds whatever rate the file was recorded at.
use crate::{model::Fps, process};
use anyhow::{Context, Result, bail};
use std::{path::Path, process::Stdio, time::Duration};
use tokio::{
    io::AsyncReadExt,
    process::{Child, ChildStdout},
    task::JoinHandle,
};
use tokio_util::sync::CancellationToken;

/// Seconds decoded ahead of a range, so a seek lands on a keyframe before the first frame.
const LEAD_SECONDS: u64 = 2;

/// How a frame comes out of the pipe.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Pixels {
    Rgb,
    Grey,
}
impl Pixels {
    fn format(self) -> &'static str {
        match self {
            Pixels::Rgb => "rgb24",
            Pixels::Grey => "gray",
        }
    }
    fn bytes(self) -> usize {
        match self {
            Pixels::Rgb => 3,
            Pixels::Grey => 1,
        }
    }
}

/// What to take out of the picture.
#[derive(Clone, Default)]
pub struct Take {
    /// First and last frame, inclusive; the whole film without it.
    pub range: Option<(u64, u64)>,
    /// x, y, w, h in source pixels, cut before scaling.
    pub crop: Option<[u32; 4]>,
    /// The size frames come out at; the crop's (or the source's) size without it.
    pub scale: Option<(u32, u32)>,
}

/// The seconds a frame starts at, as FFmpeg reads a time.
pub fn time(fps: Fps, frame: u64) -> String {
    format!("{:.6}", fps.seconds(frame))
}

/// The input seek and the trim that bring a range into view: decoding starts a little before
/// the range, at a whole frame, so frame numbers stay those of the whole film.
pub fn seek(fps: Fps, from: u64) -> (Vec<String>, u64) {
    let lead = LEAD_SECONDS * u64::from(fps.num).div_ceil(u64::from(fps.den));
    let start = from.saturating_sub(lead);
    if start == 0 {
        (Vec::new(), from)
    } else {
        (vec!["-ss".into(), time(fps, start)], from - start)
    }
}

/// A running FFmpeg that hands out one raw frame at a time.
pub struct Stream {
    child: Child,
    out: ChildStdout,
    errors: JoinHandle<Vec<u8>>,
    /// Bytes per frame.
    pub size: usize,
    pub width: u32,
    pub height: u32,
}

impl Stream {
    /// Frames of `path` at `fps`, `full` being the source's own size.
    pub fn open(
        path: &Path,
        fps: Fps,
        full: (u32, u32),
        take: &Take,
        pixels: Pixels,
    ) -> Result<Self> {
        let (width, height) = take
            .scale
            .or(take.crop.map(|c| (c[2], c[3])))
            .unwrap_or(full);
        let mut filters = vec![format!("fps={}/{}", fps.num, fps.den)];
        let mut input = Vec::new();
        if let Some((from, to)) = take.range {
            let (args, skip) = seek(fps, from);
            input = args;
            // Restamped from zero: otherwise the raw output fills the time before the range
            // with copies of its first frame.
            filters.push(format!(
                "trim=start_frame={skip}:end_frame={},setpts=N/FRAME_RATE/TB",
                skip + to - from + 1
            ));
        }
        if let Some([x, y, w, h]) = take.crop {
            filters.push(format!("crop={w}:{h}:{x}:{y}"));
        }
        if take.scale.is_some() {
            filters.push(format!("scale={width}:{height}:flags=area"));
        }
        filters.push(format!("format={}", pixels.format()));
        let mut cmd = process::command(process::binary("ffmpeg"));
        cmd.args(["-v", "error", "-nostdin"])
            .args(&input)
            .arg("-i")
            .arg(path)
            .args(["-map", "0:v:0", "-an", "-sn", "-vf"])
            .arg(filters.join(","))
            .args(["-fps_mode", "passthrough"])
            .args(["-f", "rawvideo", "-pix_fmt", pixels.format(), "-"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = cmd
            .spawn()
            .context("Could not start FFmpeg; run superint-video doctor")?;
        let out = child.stdout.take().context("FFmpeg gave no output pipe")?;
        let mut err = child.stderr.take().context("FFmpeg gave no error pipe")?;
        let errors = tokio::spawn(async move {
            let mut bytes = Vec::new();
            let _ = err.read_to_end(&mut bytes).await;
            bytes
        });
        Ok(Self {
            child,
            out,
            errors,
            size: width as usize * height as usize * pixels.bytes(),
            width,
            height,
        })
    }

    /// The next frame into `buffer`; false once the picture has ended.
    pub async fn next(&mut self, buffer: &mut Vec<u8>) -> Result<bool> {
        buffer.resize(self.size, 0);
        let mut filled = 0;
        while filled < self.size {
            let n = self.out.read(&mut buffer[filled..]).await?;
            if n == 0 {
                if filled == 0 {
                    return Ok(false);
                }
                bail!("FFmpeg stopped in the middle of a frame");
            }
            filled += n;
        }
        Ok(true)
    }

    /// Waits for FFmpeg and says what went wrong if it failed.
    pub async fn finish(mut self) -> Result<()> {
        drop(self.out);
        let status = self.child.wait().await?;
        let errors = self.errors.await.unwrap_or_default();
        if !status.success() {
            bail!("FFmpeg failed: {}", process::diagnostic_tail(&errors));
        }
        Ok(())
    }

    /// Stops FFmpeg before the end, when enough frames have been read.
    pub async fn stop(mut self) {
        let _ = self.child.kill().await;
        self.errors.abort();
    }
}

/// One frame at the source's size, as RGB.
pub async fn picture(
    path: &Path,
    fps: Fps,
    full: (u32, u32),
    frame: u64,
) -> Result<image::RgbImage> {
    let take = Take {
        range: Some((frame, frame)),
        ..Take::default()
    };
    let mut stream = Stream::open(path, fps, full, &take, Pixels::Rgb)?;
    let mut buffer = Vec::new();
    let got = stream.next(&mut buffer).await?;
    let (w, h) = (stream.width, stream.height);
    stream.finish().await?;
    if !got {
        bail!("Frame {frame} is past the end of {}", path.display());
    }
    image::RgbImage::from_raw(w, h, buffer).context("Frame of the wrong size")
}

/// The first audio track as mono 16-bit samples at `rate`, or None when there is no sound.
pub async fn samples(
    path: &Path,
    rate: u32,
    from: f64,
    seconds: Option<f64>,
) -> Result<Option<Vec<i16>>> {
    let info = crate::media::probe(path).await?;
    let audible = info["streams"]
        .as_array()
        .is_some_and(|s| s.iter().any(|s| s["codec_type"] == "audio"));
    if !audible {
        return Ok(None);
    }
    let mut cmd = process::command(process::binary("ffmpeg"));
    cmd.args(["-v", "error", "-nostdin"]);
    if from > 0.0 {
        cmd.args(["-ss", &format!("{from:.6}")]);
    }
    cmd.arg("-i").arg(path);
    if let Some(seconds) = seconds {
        cmd.args(["-t", &format!("{seconds:.6}")]);
    }
    cmd.args(["-map", "0:a:0", "-ac", "1", "-ar", &rate.to_string()])
        .args(["-f", "s16le", "-"]);
    let bytes = process::output(cmd, &CancellationToken::new(), Duration::from_secs(600)).await?;
    Ok(Some(
        bytes
            .as_chunks::<2>()
            .0
            .iter()
            .map(|b| i16::from_le_bytes(*b))
            .collect(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_seek_starts_on_a_whole_frame_before_the_range() {
        let ntsc = Fps {
            num: 30000,
            den: 1001,
        };
        assert_eq!(seek(ntsc, 40), (Vec::new(), 40));
        let (args, skip) = seek(ntsc, 500);
        assert_eq!(skip, 60);
        assert_eq!(args, ["-ss", &time(ntsc, 440)]);
        assert_eq!(time(ntsc, 440), "14.681333");
    }
}
