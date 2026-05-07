import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

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

  try {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const storageRef = ref(storage, `${folder}/${name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { ok: true, url };
  } catch (err: any) {
    console.error('uploadImage error:', err);
    const msg =
      err?.code === 'storage/unauthorized'
        ? 'Sem permissão no Storage. Atualize as regras em Firebase Console → Storage → Rules.'
        : err?.code === 'storage/unknown'
        ? 'Erro de CORS ou projeto inativo. Verifique o Firebase Console.'
        : err?.message ?? 'Erro desconhecido no upload.';
    return { ok: false, error: msg };
  }
}
