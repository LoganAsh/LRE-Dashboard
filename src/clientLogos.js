import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { clientKey } from './clientStats.js';

const BUCKET = 'client-logos';
const TABLE = 'lre_client_logos';
export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
const OK_TYPES = ACCEPT.split(',');
export const MAX_INPUT_BYTES = 8 * 1024 * 1024;

const SETUP_MESSAGE = "Logo storage isn't set up yet. Run the setup script in supabase/client_logos.sql once, then try again.";

function explain(err) {
  const msg = String((err && (err.message || err.error || err)) || '');
  const code = err && err.code;
  if (code === 'PGRST205' || code === '42P01' || /could not find the table|does not exist|schema cache/i.test(msg)) return SETUP_MESSAGE;
  if (/bucket not found/i.test(msg) || (err && (err.statusCode === '404' || err.status === 404))) return SETUP_MESSAGE;
  if (/row-level security|violates|not authorized|unauthorized|403/i.test(msg)) return "You don't have permission to save logos. Check the storage policies in supabase/client_logos.sql.";
  if (/mime|not supported|invalid file type/i.test(msg)) return 'That image type is not allowed. Please use PNG, JPG or WebP.';
  if (/exceeded|too large|payload/i.test(msg)) return 'That image is too large to save. Please choose a smaller one.';
  return msg || 'Something went wrong saving the logo. Please try again.';
}

function loadViaImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image. Try a PNG or JPG."));};
    img.src = url;
  });
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

// Checks the file, shrinks it to fit 256 x 256 (keeping its proportions), and returns a small WebP (or PNG) blob.
export async function prepareLogo(file, max = 256) {
  if (!file) throw new Error('No file selected.');
  if (!OK_TYPES.includes(file.type)) throw new Error('Please choose a PNG, JPG, WebP, GIF or SVG image.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is over 8 MB. Please choose a smaller one.');

  let source;
  try { source = await createImageBitmap(file); } catch { source = await loadViaImage(file); }   // SVGs and a few formats need the fallback
  const w0 = source.width || source.naturalWidth || max;
  const h0 = source.height || source.naturalHeight || max;
  const isVector = file.type === 'image/svg+xml';
  const scale = isVector ? max / Math.max(w0, h0) : Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);                         // keep transparency
  ctx.drawImage(source, 0, 0, w, h);
  if (source.close) source.close();

  let blob = await toBlob(canvas, 'image/webp', 0.9);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/png');   // older Safari can't write WebP
  if (!blob) throw new Error("Couldn't process that image.");
  return { blob, ext: blob.type === 'image/webp' ? 'webp' : 'png' };
}

export function useClientLogos() {
  const [logos, setLogos] = useState({});       // client key -> { url, path }
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    supabase.from(TABLE).select('*').then(({ data, error: err }) => {
      if (!alive || err || !data) return;       // table not created yet: just show initials
      setLogos(Object.fromEntries(data.map((r) => [r.client_key, { url: r.logo_url, path: r.logo_path }])));
    });
    return () => { alive = false; };
  }, []);

  const upload = useCallback(async (name, file) => {
    const key = clientKey(name);
    setError(''); setBusyKey(key);
    try {
      const { blob, ext } = await prepareLogo(file);
      const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';
      const path = `${slug}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
      if (upErr) throw upErr;
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      const { error: dbErr } = await supabase.from(TABLE).upsert(
        { client_key: key, client_name: name, logo_url: url, logo_path: path, updated_at: new Date().toISOString() },
        { onConflict: 'client_key' }
      );
      if (dbErr) { await supabase.storage.from(BUCKET).remove([path]); throw dbErr; }

      const previous = logos[key];
      if (previous && previous.path && previous.path !== path) supabase.storage.from(BUCKET).remove([previous.path]);   // tidy up the old file
      setLogos((prev) => ({ ...prev, [key]: { url, path } }));
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusyKey(null);
    }
  }, [logos]);

  const remove = useCallback(async (name) => {
    const key = clientKey(name);
    const current = logos[key];
    if (!current) return;
    setError(''); setBusyKey(key);
    try {
      const { error: dbErr } = await supabase.from(TABLE).delete().eq('client_key', key);
      if (dbErr) throw dbErr;
      if (current.path) supabase.storage.from(BUCKET).remove([current.path]);
      setLogos((prev) => { const next = { ...prev }; delete next[key]; return next; });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusyKey(null);
    }
  }, [logos]);

  return { logos, busyKey, error, clearError: () => setError(''), upload, remove };
}
