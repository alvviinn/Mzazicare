'use client';

import { useEffect, useState } from 'react';
import { fetchProofPhoto } from '@/lib/api';
import { useToken } from '@/lib/auth';

// The photo a caretaker took to show a task was done. It is fetched with the sign-in token
// (it has no public link), shown as a thumbnail, and opens full size on click.
export function ProofPhoto({ completionId, caption, size = 48 }: { completionId: number; caption?: string; size?: number }) {
  const token = useToken();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchProofPhoto(token, completionId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, completionId]);

  if (failed) return <span className="proof missing" style={{ width: size, height: size }} title="Photo unavailable">×</span>;
  if (!url) return <span className="proof" style={{ width: size, height: size }} />;
  return (
    <>
      <button className="proof" style={{ width: size, height: size }} onClick={() => setOpen(true)} title="See the proof photo">
        {/* eslint-disable-next-line @next/next/no-img-element -- a private blob URL, not an optimisable asset */}
        <img src={url} alt={caption ? `Proof photo: ${caption}` : 'Proof photo'} />
      </button>
      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={caption ? `Proof photo: ${caption}` : 'Proof photo'} />
          {caption && <p>{caption}</p>}
          <span className="small">Click anywhere to close</span>
        </div>
      )}
    </>
  );
}
