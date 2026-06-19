import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';

/**
 * Renders a thumbnail for a private-S3 image. Files are served via expiring
 * signed URLs, so we fetch the URL once on mount via `loadUrl` (a function that
 * resolves to { url }) and render it.
 */
const SignedImageThumb = ({ loadUrl, alt = '', onClick, className = '' }) => {
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

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)]
                  flex items-center justify-center ${onClick ? 'cursor-pointer hover:border-[var(--primary)]/40' : ''} ${className}`}
      title={alt}
    >
      {url && !failed ? (
        // eslint-disable-next-line jsx-a11y/img-redundant-alt
        <img src={url} alt={alt} onError={() => setFailed(true)} className="w-full h-full object-cover" />
      ) : (
        <div className="text-[var(--text-muted)]">
          {failed ? <AlertCircle size={18} /> : <ImageIcon size={18} />}
        </div>
      )}
    </div>
  );
};

export default SignedImageThumb;
