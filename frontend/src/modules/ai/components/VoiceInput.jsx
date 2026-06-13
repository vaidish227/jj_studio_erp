import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Upload, Loader2 } from 'lucide-react';
import { transcribeAudio } from '../services/aiService';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';

// Mirrors the backend/Whisper file-size cap (ai.route.js).
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// How often the streaming-Whisper mode refreshes the live preview. Keep above
// 5s — each tick is one /ai/transcribe call and aiRateLimit allows 20/min.
const LIVE_PREVIEW_INTERVAL_MS = 5000;

// Chrome/Edge expose SpeechRecognition behind the webkit prefix. Some Chromium
// derivatives (Brave, etc.) omit it or ship it without a working speech
// service — the streaming-Whisper mode below covers those.
const getSpeechRecognition = () =>
  (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

// First container the current browser can record. Chrome/Edge take webm+opus,
// Safari/iOS take mp4, Firefox takes ogg.
const RECORD_TYPES = [
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/mp4', ext: 'mp4' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
];

const pickRecordType = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  return (
    RECORD_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t.mime)) ||
    { mime: '', ext: 'webm' } // let the browser pick its default container
  );
};

const formatElapsed = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ─── WAV re-encoding ──────────────────────────────────────────────────────────
// The Whisper API is picky about browser-recorded containers — Firefox's
// ogg/opus in particular is frequently rejected as "invalid file format" even
// though ogg is nominally supported. Decoding the clip and re-encoding it as
// mono 16 kHz 16-bit PCM WAV sidesteps the container entirely and works for
// every browser. 16 kHz is Whisper's native rate, so nothing is lost.

const WAV_SAMPLE_RATE = 16000;

function encodeWavPcm16(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function blobToWav(blob) {
  const arrayBuf = await blob.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const probeCtx = new AC();
  let decoded;
  try {
    decoded = await probeCtx.decodeAudioData(arrayBuf);
  } finally {
    probeCtx.close();
  }
  const length = Math.ceil(decoded.duration * WAV_SAMPLE_RATE);
  if (!length) throw new Error('empty recording');
  const offline = new OfflineAudioContext(1, length, WAV_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded; // OfflineAudioContext downmixes + resamples for us
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return encodeWavPcm16(rendered.getChannelData(0), WAV_SAMPLE_RATE);
}

// Best-effort conversion: if the clip can't be decoded (e.g. Safari's partial
// mp4 mid-recording), fall back to uploading the original blob untouched.
async function toWavOrOriginal(blob, fallbackName) {
  try {
    const wav = await blobToWav(blob);
    return { uploadBlob: wav, uploadName: 'recording.wav' };
  } catch {
    return { uploadBlob: blob, uploadName: fallbackName };
  }
}

// Appends on a new line so dictating in several takes builds the text up.
const appendText = (current, text) =>
  current?.trim() ? `${current.replace(/\s+$/, '')}\n${text}` : text;

const pillClass =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * VoiceInput — speech-to-text for a controlled text field. Renders two compact
 * pill buttons meant to sit in the field's label row:
 *
 *   • Speak — LIVE dictation. Uses the browser SpeechRecognition API when it
 *             works (instant, free). Otherwise records and re-transcribes the
 *             growing clip through /ai/transcribe every few seconds, so text
 *             still appears while the user talks — just in small batches.
 *   • Audio — upload an existing audio file (mp3/m4a/wav/ogg/webm…),
 *             transcribed server-side via /ai/transcribe (Whisper).
 *
 * Controlled usage — the component reads and writes the host field's value:
 *
 *   <VoiceInput value={notes} onChange={setNotes} />
 *
 * Self-gates on the `ai.chat` permission — renders nothing if the user lacks it.
 */
const VoiceInput = ({ value, onChange, lang = 'en-IN', disabled = false, className = '' }) => {
  const { hasPermission } = useAuth();
  const toast = useToast();

  // idle | listening (SpeechRecognition) | recording (streaming Whisper) | transcribing
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);

  // base = field content when dictation started (live text is composed onto it).
  const baseRef = useRef('');

  // SpeechRecognition state. finals = recognized-and-final text; lastInterim =
  // current guess. Refs so they survive Chrome's silent onend restarts.
  const recognitionRef = useRef(null);
  const liveActiveRef = useRef(false);
  const finalsRef = useRef('');
  const lastInterimRef = useRef('');

  // Streaming-Whisper state.
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const previewTimerRef = useRef(null);
  const previewInFlightRef = useRef(false);
  const previewedChunksRef = useRef(0);

  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Keep latest value/onChange reachable from async handlers without
  // re-binding recognition/recorder events every render.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  // Stop hardware + timers if the host modal unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
      liveActiveRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        try { recorderRef.current.stop(); } catch { /* already stopped */ }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!hasPermission('ai.chat')) return null;

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const snapshotBase = () => {
    const original = valueRef.current || '';
    baseRef.current = original.trim() ? `${original.replace(/\s+$/, '')}\n` : '';
  };

  // ─── Live dictation (SpeechRecognition) ────────────────────────────────────

  const startLiveDictation = () => {
    const SR = getSpeechRecognition();
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    snapshotBase();
    finalsRef.current = '';
    lastInterimRef.current = '';

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalsRef.current += transcript.replace(/\s+$/, '') + ' ';
        } else {
          interim += transcript;
        }
      }
      lastInterimRef.current = interim;
      onChangeRef.current?.(`${baseRef.current}${finalsRef.current}${interim}`.replace(/\s+$/, ''));
    };

    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return; // harmless
      liveActiveRef.current = false;
      stopTimer();
      try { rec.stop(); } catch { /* already stopped */ }
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Allow mic permission and try again.');
        setPhase('idle');
        return;
      }
      // The API exists but its speech service doesn't respond (offline, or a
      // browser that ships the API without Google's backend) — switch to the
      // streaming-Whisper mode, which only needs the mic.
      setPhase('idle');
      startStreamingDictation();
    };

    // Chrome silently ends recognition after pauses — restart while active.
    rec.onend = () => {
      if (liveActiveRef.current) {
        try { rec.start(); } catch { /* restart raced a stop — fine */ }
      }
    };

    try {
      rec.start();
    } catch {
      startStreamingDictation();
      return;
    }
    recognitionRef.current = rec;
    liveActiveRef.current = true;
    startTimer();
    setPhase('listening');
  };

  const stopLiveDictation = () => {
    liveActiveRef.current = false;
    stopTimer();
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;

    // Commit: keep the trailing interim guess as final text.
    const text = `${finalsRef.current}${lastInterimRef.current}`.trim();
    if (text) {
      onChangeRef.current?.(`${baseRef.current}${text}`);
    } else {
      // Nothing recognized — restore the field exactly as it was.
      onChangeRef.current?.(baseRef.current.replace(/\n$/, ''));
      toast.error('No speech detected. Try again closer to the mic.');
    }
    setPhase('idle');
  };

  // ─── Streaming dictation (MediaRecorder + periodic Whisper) ────────────────
  // No SpeechRecognition available: record with a timeslice and, every few
  // seconds, transcribe everything recorded so far. The transcript REPLACES
  // the live region (base stays), so each pass refines the previous one.

  const startStreamingDictation = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone is not available in this browser — upload an audio file instead.');
      return;
    }
    const type = pickRecordType();
    if (!type) {
      toast.error('Recording is not supported in this browser — upload an audio file instead.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Microphone access denied. Allow mic permission and try again.');
      return;
    }

    snapshotBase();
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, type.mime ? { mimeType: type.mime } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data?.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const blob = new Blob(chunksRef.current, { type: type.mime || 'audio/webm' });
      chunksRef.current = [];
      finalizeStreamingDictation(blob, `recording.${type.ext}`);
    };

    recorderRef.current = recorder;
    // Timeslice so chunks land in chunksRef while recording — concatenating
    // from the first chunk (which holds the container header) stays decodable.
    recorder.start(3000);
    startTimer();
    startPreviewLoop(type);
    setPhase('recording');
  };

  const startPreviewLoop = (type) => {
    previewInFlightRef.current = false;
    previewedChunksRef.current = 0;
    previewTimerRef.current = setInterval(async () => {
      if (previewInFlightRef.current) return; // self-throttles as the clip grows
      const chunks = chunksRef.current;
      if (!chunks.length || chunks.length === previewedChunksRef.current) return;
      previewedChunksRef.current = chunks.length;

      const blob = new Blob(chunks, { type: type.mime || 'audio/webm' });
      if (blob.size > MAX_AUDIO_BYTES) return; // too long for previews; final pass reports it

      previewInFlightRef.current = true;
      try {
        const { uploadBlob, uploadName } = await toWavOrOriginal(blob, `recording.${type.ext}`);
        if (uploadBlob.size > MAX_AUDIO_BYTES) return;
        const res = await transcribeAudio(uploadBlob, uploadName);
        const text = (res?.text || '').trim();
        // Recording may have stopped while this was in flight — the final
        // pass owns the result then.
        if (text && recorderRef.current?.state === 'recording') {
          onChangeRef.current?.(`${baseRef.current}${text}`);
        }
      } catch {
        // Previews are best-effort (e.g. Safari's partial mp4 may not decode
        // mid-recording) — the final pass surfaces real errors.
      } finally {
        previewInFlightRef.current = false;
      }
    }, LIVE_PREVIEW_INTERVAL_MS);
  };

  const stopPreviewLoop = () => {
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  };

  const stopStreamingDictation = () => {
    stopTimer();
    stopPreviewLoop();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop(); // onstop → finalizeStreamingDictation
    } else {
      setPhase('idle');
    }
  };

  // Full-clip pass after stop. Replaces the preview text (base + transcript)
  // rather than appending, since previews already wrote into the field.
  const finalizeStreamingDictation = async (blob, filename) => {
    if (!blob || blob.size === 0) {
      toast.error('Nothing was recorded. Try again.');
      setPhase('idle');
      return;
    }
    setPhase('transcribing');
    try {
      const { uploadBlob, uploadName } = await toWavOrOriginal(blob, filename);
      if (uploadBlob.size > MAX_AUDIO_BYTES) {
        toast.error('Recording is too long to transcribe in one go. Use shorter takes.');
        return;
      }
      const res = await transcribeAudio(uploadBlob, uploadName);
      const text = (res?.text || '').trim();
      if (text) {
        onChangeRef.current?.(`${baseRef.current}${text}`);
      } else {
        onChangeRef.current?.(baseRef.current.replace(/\n$/, ''));
        toast.error('No speech detected. Try again closer to the mic.');
      }
    } catch (err) {
      toast.error(err?.message || 'Transcription failed. Please try again.');
    } finally {
      setPhase('idle');
    }
  };

  // ─── Audio file upload ─────────────────────────────────────────────────────

  const sendUploadForTranscription = async (file) => {
    if (!file || file.size === 0) {
      toast.error('That file is empty.');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      toast.error('Audio is larger than 25 MB. Use a shorter clip.');
      return;
    }
    setPhase('transcribing');
    try {
      const res = await transcribeAudio(file, file.name);
      const text = (res?.text || '').trim();
      if (!text) {
        toast.error('No speech detected in this audio.');
        return;
      }
      onChangeRef.current?.(appendText(valueRef.current, text));
    } catch (err) {
      toast.error(err?.message || 'Transcription failed. Please try again.');
    } finally {
      setPhase('idle');
    }
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleSpeak = () => {
    if (getSpeechRecognition()) startLiveDictation();
    else startStreamingDictation();
  };

  const handleStop = () => {
    if (phase === 'listening') stopLiveDictation();
    else stopStreamingDictation();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (file) sendUploadForTranscription(file);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (phase === 'transcribing') {
    return (
      <span className={`${pillClass} text-[var(--primary)] bg-[var(--primary)]/10 ${className}`}>
        <Loader2 size={13} className="animate-spin" />
        Transcribing…
      </span>
    );
  }

  if (phase === 'listening' || phase === 'recording') {
    return (
      <button
        type="button"
        onClick={handleStop}
        title="Stop dictating"
        className={`${pillClass} text-rose-700 bg-rose-100 hover:bg-rose-200 ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
        Listening · {formatElapsed(elapsed)}
        <Square size={11} fill="currentColor" />
      </button>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={handleSpeak}
        disabled={disabled}
        title="Dictate — speech becomes text as you talk"
        className={`${pillClass} text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20`}
      >
        <Mic size={13} />
        Speak
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title="Upload an audio file and convert to text"
        className={`${pillClass} text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20`}
      >
        <Upload size={13} />
        Audio
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.oga,.webm,.flac,.aac,.mp4"
        onChange={handleFileChange}
        className="hidden"
      />
    </span>
  );
};

export default VoiceInput;
