import { useEffect, useRef, useState } from 'react';
import { Trash2, ImagePlus } from 'lucide-react';
import { api } from '../lib/api.js';

/** Upload (click, drag-drop or paste) and view screenshots stored on the server. */
export default function Screenshots({ items, uploadUrl, onChange }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [view, setView] = useState(null);
  const input = useRef(null);

  async function upload(files) {
    const list = [...files].filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    const fd = new FormData();
    list.forEach(f => fd.append('files', f, f.name || 'pasted.png'));
    setBusy(true); setErr(null);
    try { await api.post(uploadUrl, fd); await onChange(); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  useEffect(() => {
    const h = e => { const files = [...(e.clipboardData?.files || [])]; if (files.length) { e.preventDefault(); upload(files); } };
    window.addEventListener('paste', h);
    return () => window.removeEventListener('paste', h);
  });

  async function remove(id) {
    if (!confirm('Delete this screenshot?')) return;
    await api.del(`/api/attachments/${id}`);
    await onChange();
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {err && <div className="banner lock">{err}</div>}
      {items.length > 0 && (
        <div className="shots">
          {items.map(a => (
            <div key={a.id} className="shot">
              <img src={`/uploads/${a.filename}`} alt={a.original_name || 'screenshot'} onClick={() => setView(a)} />
              <button onClick={() => remove(a.id)} title="Delete"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className={'dropzone' + (drag ? ' drag' : '')} onClick={() => input.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}>
        <ImagePlus size={22} /><div>{busy ? 'Uploading…' : 'Drop screenshots here, click to choose, or paste (Ctrl/⌘+V)'}</div>
        <div className="small">PNG, JPEG, GIF, WebP · up to 20 MB each · stored in your data folder</div>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { upload(e.target.files); e.target.value = ''; }} />
      </div>
      {view && <div className="lightbox" onClick={() => setView(null)}><img src={`/uploads/${view.filename}`} alt="" /></div>}
    </div>
  );
}
