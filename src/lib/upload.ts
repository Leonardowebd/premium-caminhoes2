export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;
const MAX_SIZE_MB = 15;

export async function uploadImage(
  file: File,
  folder: string
): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Apenas imagens são permitidas.' };
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { ok: false, error: `Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.` };
  }

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return {
      ok: false,
      error: 'Cloudinary não configurado. Adicione VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env',
    };
  }

  try {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', `premium-caminhoes/${folder}`);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: form }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err?.error?.message ?? `Erro HTTP ${res.status}` };
    }

    const data = await res.json();
    return { ok: true, url: data.secure_url as string };
  } catch (err: any) {
    console.error('uploadImage error:', err);
    return { ok: false, error: err?.message ?? 'Erro de rede no upload.' };
  }
}
