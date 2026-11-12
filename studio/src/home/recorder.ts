/**
 * The microphone. It records the user, says how loud they are while they speak (for the
 * waveform or the level meter), and hands back the recording as mono WAV: 16 kHz for dictation,
 * the one format every transcription model takes, or the full rate of the device for a voice
 * that goes into a film. The recording lives in this page until it is sent once.
 */

/** Why the microphone did not start. The page words it. */
export type MicrophoneProblem = 'denied' | 'absent' | 'busy' | 'other';

export class MicrophoneError extends Error {
  constructor(
    readonly problem: MicrophoneProblem,
    detail: string,
  ) {
    super(detail);
  }
}

export interface Recording {
  /** How loud it is right now, from 0 (silence) to 1 (very loud), on a scale that looks right. */
  level(): number;
  /** Seconds since the recording began. */
  elapsed(): number;
  /** Ends the recording and returns it as WAV, without its first `skip` seconds. The
   * microphone is free again at once. */
  stop(skip?: number): Promise<Blob>;
  /** Ends the recording and throws it away. */
  discard(): void;
}

/** What a recording is for. */
type Purpose =
  /** Words to be written down: the browser may clean the signal, and 16 kHz is all a
   * transcription model uses. */
  | 'dictation'
  /** A voice for a film: the signal as the microphone hears it, at the rate of the device.
   * The browser's echo and noise filters are made for calls and can be heard on a voice. */
  | 'narration';

/** The rate transcription models are made for; more only makes the file larger. */
const DICTATION_RATE = 16_000;
/** Opus at this rate is past the point where a spoken voice gains from more. */
const NARRATION_BITS = 256_000;
/** The formats MediaRecorder may write, best first. Any of them decodes in the same browser. */
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

/** The page can record here: a secure page in a browser with a microphone interface. */
export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Starts recording. Call it from the click that asks for it: the sound is only analysed in an
 * audio context the user started, so the context is made before the permission question.
 */
export async function record(purpose: Purpose = 'dictation'): Promise<Recording> {
  const context = new AudioContext();
  const cleaned = purpose === 'dictation';
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: cleaned,
        noiseSuppression: cleaned,
        autoGainControl: cleaned,
      },
    });
  } catch (cause) {
    void context.close();
    const name = cause instanceof DOMException ? cause.name : '';
    const detail = cause instanceof Error ? cause.message : String(cause);
    const problem: MicrophoneProblem =
      name === 'NotAllowedError' || name === 'SecurityError'
        ? 'denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'absent'
          : name === 'NotReadableError' || name === 'AbortError'
            ? 'busy'
            : 'other';
    throw new MicrophoneError(problem, detail);
  }
  if (context.state === 'suspended') await context.resume().catch(() => {});
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  const type = TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  const recorder = new MediaRecorder(stream, {
    ...(type ? { mimeType: type } : {}),
    ...(cleaned ? {} : { audioBitsPerSecond: NARRATION_BITS }),
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start(250);
  const started = performance.now();

  /** The microphone light goes off as soon as the recording ends, whatever happens next. */
  const freeMicrophone = () => stream.getTracks().forEach((track) => track.stop());

  return {
    level() {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      // Loudness is heard in decibels: −55 dB is a quiet room, −10 dB a raised voice.
      const decibels = 20 * Math.log10(rms || 1e-6);
      return Math.min(1, Math.max(0, (decibels + 55) / 45));
    },
    elapsed: () => (performance.now() - started) / 1000,
    stop(skip = 0) {
      return new Promise<Blob>((resolve, reject) => {
        recorder.onstop = async () => {
          freeMicrophone();
          try {
            const blob = new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' });
            resolve(
              await toWav(blob, context, cleaned ? DICTATION_RATE : context.sampleRate, skip),
            );
          } catch (cause) {
            reject(cause);
          } finally {
            void context.close();
          }
        };
        if (recorder.state === 'inactive') recorder.onstop(new Event('stop'));
        else recorder.stop();
      });
    },
    discard() {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      freeMicrophone();
      void context.close();
    },
  };
}

/** Decodes what MediaRecorder wrote and renders it again at `rate` in one channel, from
 * `skip` seconds in. */
async function toWav(
  recorded: Blob,
  context: BaseAudioContext,
  rate: number,
  skip: number,
): Promise<Blob> {
  const decoded = await context.decodeAudioData(await recorded.arrayBuffer());
  const from = Math.min(Math.max(0, skip), decoded.duration);
  const length = Math.max(1, Math.ceil((decoded.duration - from) * rate));
  const offline = new OfflineAudioContext(1, length, rate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0, from);
  const rendered = await offline.startRendering();
  return new Blob([wav(rendered.getChannelData(0), rate)], { type: 'audio/wav' });
}

/** 16-bit PCM in a WAV header. */
function wav(samples: Float32Array, rate: number): ArrayBuffer {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return bytes;
}
