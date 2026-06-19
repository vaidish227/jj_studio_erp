import React, { useEffect, useState } from 'react';
import { Music, Video as VideoIcon, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Plays a private-S3 audio/video clip. Files are served via expiring signed
 * URLs, so we fetch the URL once on mount via `loadUrl` (resolves to { url })
 * and render the appropriate player. `preload="none"` for video keeps large
 * clips from auto-downloading until the user hits play.
 */
const SignedMedia = ({ kind, loadUrl, fileName = '' }) => {
  const [url, setUrl]       = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null); setFailed(false);
    Promise.resolve()
      .then(() => loadUrl())
      .then((res) => { if (!cancelled) setUrl(res?.url || null); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] text-[var(--error)]">
        <AlertCircle size={13} /> Couldn’t load {fileName || 'media'}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] text-[var(--text-muted)]">
        <Loader2 size={13} className="animate-spin" /> Loading {fileName || (kind === 'video' ? 'video' : 'audio')}…
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={url} controls preload="metadata" className="w-full max-h-64 bg-black" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
      {kind === 'video' ? <VideoIcon size={14} className="text-[var(--primary)] shrink-0" /> : <Music size={14} className="text-[var(--primary)] shrink-0" />}
      {fileName && <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[120px]" title={fileName}>{fileName}</span>}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio src={url} controls preload="none" className="h-8 flex-1 min-w-0" />
    </div>
  );
};

export default SignedMedia;
