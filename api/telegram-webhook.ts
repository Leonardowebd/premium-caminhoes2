import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, addDoc, getDocs, updateDoc,
  doc, query, orderBy, limit, setDoc, getDoc, deleteDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'gen-lang-client-0791558691',
  appId: '1:671021797730:web:ba158167e16386e3a01c3b',
  apiKey: 'AIzaSyCX52NLcwl57CnpNnN_5SdnERCuEJPz_jY',
  authDomain: 'gen-lang-client-0791558691.firebaseapp.com',
  storageBucket: 'gen-lang-client-0791558691.firebasestorage.app',
  messagingSenderId: '671021797730',
};
const DB_ID = 'ai-studio-00d52f2c-1bad-4538-971c-e963f0ca9abb';

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(firebaseApp, DB_ID);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'https://premium-caminhoes2.vercel.app';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── Telegram ──────────────────────────────────────────────────────────────────

async function send(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const j: any = await r.json();
  if (!j.ok) {
    const desc: string = j.description || '';
    if (desc.toLowerCase().includes('too big') || desc.includes('FILE_TOO_BIG')) {
      throw new Error('Vídeo muito grande para o Telegram Bot API (limite 20MB). Comprima o vídeo antes de enviar.');
    }
    throw new Error(`Telegram API erro: ${desc}`);
  }
  const filePath = j.result?.file_path;
  if (!filePath) throw new Error('Telegram não retornou caminho do arquivo — provavelmente maior que 20MB.');
  const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Cloudinary ────────────────────────────────────────────────────────────────

interface UploadResult { url: string; publicId: string; }

async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  resourceType: 'image' | 'video' = 'image',
  mimeType = 'image/jpeg',
): Promise<UploadResult> {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
    throw new Error('Configure CLOUDINARY_CLOUD_NAME (ou VITE_CLOUDINARY_CLOUD_NAME) e CLOUDINARY_UPLOAD_PRESET no Vercel');
  }
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  form.append('upload_preset', CLOUDINARY_PRESET);
  form.append('folder', 'premium-caminhoes/vehicles');
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`,
    { method: 'POST', body: form },
  );
  const data: any = await res.json();
  if (!data.secure_url) throw new Error(`${data.error?.message || 'Upload Cloudinary falhou'} [cloud=${CLOUDINARY_CLOUD}, preset=${CLOUDINARY_PRESET}]`);
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

// ── Session ───────────────────────────────────────────────────────────────────

interface Session { step: string; data: Record<string, any>; updatedAt: number; }

async function getSession(chatId: number): Promise<Session | null> {
  const snap = await getDoc(doc(db, 'bot_sessions', String(chatId)));
  if (!snap.exists()) return null;
  const s = snap.data() as Session;
  if (Date.now() - (s.updatedAt || 0) > 30 * 60 * 1000) {
    await deleteDoc(doc(db, 'bot_sessions', String(chatId)));
    return null;
  }
  return s;
}

async function setSession(chatId: number, step: string, data: Record<string, any>) {
  await setDoc(doc(db, 'bot_sessions', String(chatId)), { step, data, updatedAt: Date.now() });
}

async function clearSession(chatId: number) {
  try { await deleteDoc(doc(db, 'bot_sessions', String(chatId))); } catch {}
}

// ── Firestore actions ─────────────────────────────────────────────────────────

async function getReport() {
  const [vSnap, cSnap, bSnap] = await Promise.all([
    getDocs(collection(db, 'vehicles')),
    getDocs(query(collection(db, 'contacts'), orderBy('createdAt', 'desc'))),
    getDocs(collection(db, 'banners')),
  ]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayLeads = cSnap.docs.filter(d => (d.data().createdAt || 0) >= today.getTime());
  const available = vSnap.docs.filter(d => !d.data().sold).length;
  const sold = vSnap.docs.filter(d => d.data().sold).length;
  return (
    `📊 *RELATÓRIO — PREMIUM CAMINHÕES*\n\n` +
    `🚛 Disponíveis: *${available}* | Vendidos: *${sold}*\n` +
    `📩 Leads total: *${cSnap.size}* | Hoje: *${todayLeads.length}*\n` +
    `🖼️ Banners: *${bSnap.size}*`
  );
}

async function getContacts(filter: 'today' | 'all') {
  const snap = await getDocs(query(collection(db, 'contacts'), orderBy('createdAt', 'desc'), limit(20)));
  let contacts = snap.docs.map(d => d.data() as any);
  if (filter === 'today') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    contacts = contacts.filter((c: any) => (c.createdAt || 0) >= today.getTime());
  } else {
    contacts = contacts.slice(0, 5);
  }
  if (!contacts.length) return '📩 Nenhum contato encontrado.';
  return (
    `📩 *CONTATOS${filter === 'today' ? ' DE HOJE' : ' RECENTES'}*\n\n` +
    contacts.map((c: any, i: number) =>
      `*${i + 1}. ${c.name}*\n📱 ${c.whatsapp}\n✉️ ${c.email || '—'}\n💬 ${(c.message || '').slice(0, 80)}`
    ).join('\n\n')
  );
}

async function saveVehicle(data: Record<string, any>) {
  const images: string[] = data.images || [];
  const videoUrl: string = data.videoUrl || '';
  await addDoc(collection(db, 'vehicles'), {
    brand: String(data.brand || '').trim(),
    model: String(data.model || '').trim(),
    year: Number(data.year) || new Date().getFullYear(),
    price: Number(String(data.price || '0').replace(/,\d{1,2}$/, '').replace(/\./g, '').replace(/[^\d]/g, '')) || 0,
    kilometers: Number(String(data.km || '0').replace(/\./g, '').replace(/[^\d]/g, '')) || 0,
    transmission: String(data.transmission || 'Manual').trim(),
    power: String(data.power || '').trim(),
    traction: String(data.traction || '').trim(),
    imageUrl: images[0] || '',
    gallery: images.slice(1),
    videoUrl,
    description: String(data.description || '').trim(),
    isFeatured: false,
    sold: false,
    type: 'Caminhão',
    // Cloudinary public IDs stored for cleanup on delete
    cloudinaryImageIds: data.imagePublicIds || [],
    cloudinaryVideoIds: data.videoPublicIds || [],
    createdAt: Date.now(),
  });
}

async function markSold(name: string) {
  const snap = await getDocs(collection(db, 'vehicles'));
  const vehicles = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const found = vehicles.find(v =>
    `${v.brand} ${v.model}`.toLowerCase().includes(name.toLowerCase())
  );
  if (found) {
    await updateDoc(doc(db, 'vehicles', found.id), { sold: true, isFeatured: false });
    return found;
  }
  return null;
}

async function deleteVehicle(name: string): Promise<{ found: boolean; label?: string }> {
  const snap = await getDocs(collection(db, 'vehicles'));
  const vehicles = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const found = vehicles.find(v =>
    `${v.brand} ${v.model}`.toLowerCase().includes(name.toLowerCase())
  );
  if (!found) return { found: false };
  // Delegate to delete-vehicle endpoint — handles Cloudinary cleanup atomically
  try {
    await fetch(`${SITE_URL}/api/delete-vehicle?id=${found.id}`, { method: 'DELETE' });
  } catch {
    // Fallback: delete only from Firestore if endpoint unreachable
    await deleteDoc(doc(db, 'vehicles', found.id));
  }
  return { found: true, label: `${found.brand} ${found.model}` };
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function detectIntent(text: string): Promise<string> {
  try {
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: `Classifique em UMA palavra exata:
add_vehicle | mark_sold | delete_vehicle | get_report | get_contacts_today | get_contacts_all | cancel | help

add_vehicle = adicionar/cadastrar veículo/caminhão
mark_sold = marcar como vendido
delete_vehicle = apagar/excluir/remover veículo do estoque
get_report = relatório/resumo/status
get_contacts_today = contatos/leads de hoje
get_contacts_all = contatos/leads geral

Mensagem: "${text}"
Retorne APENAS a palavra.` }] }],
    });
    return (r.text ?? '').trim().toLowerCase().replace(/[^a-z_]/g, '');
  } catch {
    const t = text.toLowerCase();
    if (t.match(/adicionar|cadastrar|novo vei|novo cam/)) return 'add_vehicle';
    if (t.match(/apagar|excluir|remover|deletar/)) return 'delete_vehicle';
    if (t.match(/vendido|vender|vendeu/)) return 'mark_sold';
    if (t.match(/relat|resumo|status/)) return 'get_report';
    if (t.includes('hoje') && t.includes('contato')) return 'get_contacts_today';
    if (t.includes('contato')) return 'get_contacts_all';
    return 'help';
  }
}

const EMPTY_VEHICLE = { brand: '', model: '', year: '', price: '', km: '', transmission: '', power: '', traction: '', description: '' };

function regexExtract(text: string): Record<string, string> {
  const up = text.toUpperCase();
  const BRANDS: Record<string, string> = {
    SCANIA: 'Scania', VOLVO: 'Volvo', MERCEDES: 'Mercedes-Benz',
    DAF: 'DAF', MAN: 'MAN', IVECO: 'Iveco', FORD: 'Ford',
    VOLKSWAGEN: 'Volkswagen', VW: 'Volkswagen', AGRALE: 'Agrale',
  };
  const brandKey = Object.keys(BRANDS).find(k => up.includes(k)) || '';
  const brand = BRANDS[brandKey] || '';

  let model = '';
  if (brandKey) {
    const mm = text.match(new RegExp(brandKey + '\\s+([\\w./ ]+?)(?:[,\\n*]|$)', 'i'));
    if (mm) model = mm[1].trim().split(/\s+/).slice(0, 4).join(' ');
  }

  // year: handles "1997/98" or "2020" etc.
  const yearMatch = text.match(/\b(19[5-9]\d|20[0-2]\d)(?:\/\d{2,4})?\b/);
  const year = yearMatch?.[1] || '';

  // price: R$ 85.000,00 → remove decimal part first, then thousands dots
  const priceMatch = text.match(/R\$\s*([\d.,]+)/i) || text.match(/\b(\d{3}[.,]\d{3}(?:[.,]\d{2})?)\b/);
  const price = priceMatch
    ? priceMatch[1].replace(/,\d{1,2}$/, '').replace(/\./g, '').replace(/[^\d]/g, '')
    : '';

  // km
  const kmMatch = text.match(/([\d.,]+)\s*km/i);
  const km = kmMatch ? kmMatch[1].replace(/[.,]/g, '') : '';

  const transmission = /autom[aá]t/i.test(text) ? 'Automático' : /manual|\d+\s*march/i.test(text) ? 'Manual' : '';

  const tractionMatch = text.match(/\b(\d[xX]\d)\b/);
  const traction = tractionMatch?.[1] || '';

  return { ...EMPTY_VEHICLE, brand, model, year, price, km, transmission, traction };
}

async function parseVehicleFromText(text: string): Promise<Record<string, string>> {
  try {
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: `Extraia dados de veículo do texto e retorne JSON puro sem markdown.
Use "" para campos não encontrados. Campos obrigatórios: brand, model, year, price, km, transmission, power, traction, description.
year e price e km devem ser só dígitos (ex: year="1997", price="172000", km="").

Texto: "${text}"` }] }],
    });
    const raw = (r.text ?? '').trim();
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m?.[0] || raw);
    // Normalize: null → '', numbers → string
    const normalized: Record<string, string> = {};
    for (const k of Object.keys(EMPTY_VEHICLE)) {
      const v = parsed[k];
      normalized[k] = v == null ? '' : String(v);
    }
    // Blend with regex if Gemini got < 2 required fields
    const filled = REQUIRED_FIELDS.filter(f => normalized[f] !== '').length;
    if (filled < 2) {
      const regex = regexExtract(text);
      return { ...regex, ...Object.fromEntries(Object.entries(normalized).filter(([, v]) => v !== '')) };
    }
    return normalized;
  } catch {
    return regexExtract(text);
  }
}

async function extractField(field: string, text: string): Promise<string> {
  const prompts: Record<string, string> = {
    brand: `Extraia a marca do caminhão. Retorne só a marca. Mensagem: "${text}"`,
    model: `Extraia o modelo do caminhão. Retorne só o modelo. Mensagem: "${text}"`,
    year: `Extraia o ano (4 dígitos). Retorne só o número. Mensagem: "${text}"`,
    price: `Extraia o preço, retorne só os dígitos. Mensagem: "${text}"`,
    km: `Extraia a quilometragem, retorne só os dígitos. Mensagem: "${text}"`,
    transmission: `Extraia o câmbio. Ex: Manual, Automático. Mensagem: "${text}"`,
    power: `Extraia a potência ex "540 CV". Se não houver retorne "". Mensagem: "${text}"`,
    traction: `Extraia a tração ex "6x4". Se não houver retorne "". Mensagem: "${text}"`,
    description: `Retorne o texto como descrição. Mensagem: "${text}"`,
    vehicle_name: `Extraia o nome do veículo (marca + modelo) para busca. Mensagem: "${text}"`,
  };
  try {
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompts[field] || text }] }],
    });
    return (r.text ?? '').trim();
  } catch { return text.trim(); }
}

// ── Vehicle flow ──────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['brand', 'model', 'year', 'price', 'km'];
const OPTIONAL_FIELDS = ['transmission', 'power', 'traction', 'description'];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const QUESTIONS: Record<string, string> = {
  brand:        '🚛 Qual a *marca* do caminhão?\n_Ex: Scania, Volvo, Mercedes, DAF_',
  model:        '📝 Qual o *modelo*?\n_Ex: R500, FH540, Axor 2544_',
  year:         '📅 Qual o *ano* de fabricação?',
  price:        '💰 Qual o *preço*?\n_Ex: 850000 ou R$ 850.000_',
  km:           '🔢 Quantos *quilômetros*?\n_Ex: 150000 ou 150.000 km_',
  transmission: '⚙️ Qual o *câmbio*?\n_Ex: Manual, Automático_ — ou "pular"',
  power:        '💪 Qual a *potência*?\n_Ex: 540 CV_ — ou "pular"',
  traction:     '🔧 Qual a *tração*?\n_Ex: 6x4, 4x2_ — ou "pular"',
  description:  '📄 Descrição do veículo — ou "pular"',
};

const PHOTOS_QUESTION =
  `📸 *Envie as fotos e/ou vídeos do veículo.*\n\n` +
  `• Pode enviar várias fotos de uma vez\n` +
  `• Pode enviar vídeos (mp4, até 20MB)\n\n` +
  `Quando terminar: *"ok"*\nSem mídia: *"pular"*`;

function nextMissingField(data: Record<string, any>): string | null {
  return ALL_FIELDS.find(f => data[f] === undefined || data[f] === null) ?? null;
}

function buildSummary(data: Record<string, any>): string {
  const imgs: string[] = data.images || [];
  const hasVideo = !!data.videoUrl;
  return (
    `📋 *RESUMO DO VEÍCULO*\n\n` +
    `🚛 *${data.brand} ${data.model}*\n` +
    `📅 Ano: ${data.year}\n` +
    `💰 R$ ${Number(data.price).toLocaleString('pt-BR')}\n` +
    `📍 ${Number(data.km).toLocaleString('pt-BR')} km\n` +
    `⚙️ Câmbio: ${data.transmission || 'Manual'}\n` +
    (data.power ? `💪 Potência: ${data.power}\n` : '') +
    (data.traction ? `🔧 Tração: ${data.traction}\n` : '') +
    (data.description ? `📄 ${data.description}\n` : '') +
    `📸 Fotos: ${imgs.length > 0 ? imgs.length + ' foto(s)' : 'nenhuma'}\n` +
    (hasVideo ? `🎬 Vídeo: incluído\n` : '') +
    `\nConfirmar e salvar? *sim* ou *não*`
  );
}

async function transitionToPhotosOrConfirm(chatId: number, data: Record<string, any>) {
  const hasMedia = (data.images?.length || 0) > 0 || !!data.videoUrl;
  if (hasMedia) {
    await setSession(chatId, 'add_vehicle:confirm', data);
    await send(chatId, buildSummary(data));
  } else {
    await setSession(chatId, 'add_vehicle:photos', data);
    await send(chatId, PHOTOS_QUESTION);
  }
}

// Shared handler for photo/video uploads during any step
async function handleMediaUpload(
  chatId: number,
  url: string,
  publicId: string,
  type: 'image' | 'video',
  captionText: string,
  mediaGroupId?: string,
) {
  const session = await getSession(chatId);

  let data: Record<string, any> = session?.data || {};
  let step: string = session?.step || '';

  // Detect if this photo belongs to same album already being accumulated
  const sameGroup = !!mediaGroupId && data._mediaGroupId === mediaGroupId;

  // New album while session has data from a different (abandoned) flow → start fresh
  const isNewAlbum = !!mediaGroupId && !!session && !!data._mediaGroupId && data._mediaGroupId !== mediaGroupId;
  if (isNewAlbum) {
    data = {};
    step = '';
    await clearSession(chatId);
  }

  // Add media to data
  if (type === 'image') {
    data = { ...data, images: [...(data.images || []), url], imagePublicIds: [...(data.imagePublicIds || []), publicId] };
  } else {
    data = { ...data, videoUrl: url, videoPublicIds: [...(data.videoPublicIds || []), publicId] };
  }

  // Parse caption BEFORE any session logic (only on first photo of group or single photo)
  if (captionText && !sameGroup) {
    const extracted = await parseVehicleFromText(captionText);
    const filled = Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== ''));
    if (Object.keys(filled).length > 0) {
      data = { ...data, ...filled };
    }
  }

  // Track media group
  if (mediaGroupId) data = { ...data, _mediaGroupId: mediaGroupId };

  // Same album: accumulate silently (no message spam)
  if (sameGroup) {
    await setSession(chatId, step || 'add_vehicle:photos', data);
    return;
  }

  const photoCount = (data.images || []).length;
  const mediaLabel = type === 'image'
    ? `📸 ${photoCount === 1 ? 'Foto recebida' : `${photoCount} fotos recebidas`}! ✅`
    : `🎬 Vídeo recebido! ✅`;

  // Already in confirm step
  if (step === 'add_vehicle:confirm') {
    await setSession(chatId, 'add_vehicle:confirm', data);
    await send(chatId, `${mediaLabel}\n\n${buildSummary(data)}`);
    return;
  }

  // In photos step
  if (step === 'add_vehicle:photos') {
    await setSession(chatId, 'add_vehicle:photos', data);
    await send(chatId, `${mediaLabel}\nEnvie mais mídias ou *"ok"* para confirmar.`);
    return;
  }

  // No session or in text-field step — figure out next missing field
  const nextField = nextMissingField(data);
  if (!nextField) {
    await setSession(chatId, 'add_vehicle:confirm', data);
    await send(chatId, `${mediaLabel}\n\n${buildSummary(data)}`);
  } else {
    const filledFields = ALL_FIELDS.filter(f => data[f] !== undefined && data[f] !== '');
    const filledMsg = filledFields.length > 0
      ? `✅ Peguei: *${filledFields.join(', ')}*\n\n`
      : '';
    await setSession(chatId, `add_vehicle:${nextField}`, data);
    await send(chatId, `${mediaLabel}\n${filledMsg}${QUESTIONS[nextField]}`);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const msg = req.body?.message;
    if (!msg) return res.status(200).json({ ok: true });

    const chatId: number = msg.chat.id;
    const text: string = (msg.text || msg.caption || '').trim();
    const photos: any[] | undefined = msg.photo;
    const videoMsg: any = msg.video || msg.video_note;
    const docMsg: any = msg.document?.mime_type?.startsWith('video/') ? msg.document : null;

    // Setup commands
    if (text === '/start' || text === '/myid') {
      await send(chatId, `🤖 *Bot Premium Caminhões*\n\nChat ID: \`${chatId}\`\nAdicione como \`ADMIN_CHAT_ID\` no Vercel.`);
      return res.status(200).json({ ok: true });
    }

    if (ADMIN_CHAT_ID && String(chatId) !== ADMIN_CHAT_ID) {
      return res.status(200).json({ ok: true });
    }

    // ── Photo received ─────────────────────────────────────────────────────
    if (photos && photos.length > 0) {
      try {
        const largest = photos[photos.length - 1];
        const buffer = await downloadTelegramFile(largest.file_id);
        const uploaded = await uploadToCloudinary(buffer, `photo_${Date.now()}.jpg`, 'image', 'image/jpeg');
        await handleMediaUpload(chatId, uploaded.url, uploaded.publicId, 'image', text, msg.media_group_id);
      } catch (err: any) {
        await send(chatId, `❌ Erro na foto: ${err?.message}`);
      }
      return res.status(200).json({ ok: true });
    }

    // ── Video received ─────────────────────────────────────────────────────
    if (videoMsg || docMsg) {
      const media = videoMsg || docMsg;
      const fileSize = media.file_size || 0;
      if (fileSize > 20 * 1024 * 1024) {
        await send(chatId, '❌ Vídeo muito grande (máx 20MB via Telegram). Compacte e tente novamente.');
        return res.status(200).json({ ok: true });
      }
      try {
        const buffer = await downloadTelegramFile(media.file_id);
        const mimeType = media.mime_type || 'video/mp4';
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
        const uploaded = await uploadToCloudinary(buffer, `video_${Date.now()}.${ext}`, 'video', mimeType);
        await handleMediaUpload(chatId, uploaded.url, uploaded.publicId, 'video', text);
      } catch (err: any) {
        await send(chatId, `❌ Erro no vídeo: ${err?.message}`);
      }
      return res.status(200).json({ ok: true });
    }

    if (!text) return res.status(200).json({ ok: true });

    // ── Cancel / Reset ─────────────────────────────────────────────────────
    if (/^(cancelar|cancel|parar|sair|desistir|\/cancel|reset|reiniciar|recomeçar|recomecar|novo|\/reset)$/i.test(text)) {
      await clearSession(chatId);
      await send(chatId, '🔄 Reiniciado. Como posso ajudar?');
      return res.status(200).json({ ok: true });
    }

    // ── Active session ─────────────────────────────────────────────────────
    const session = await getSession(chatId);

    if (session) {
      const { step, data } = session;

      // Photos/video collection step
      if (step === 'add_vehicle:photos') {
        if (/^(ok|pronto|feito|confirmar|continuar|sim|isso)$/i.test(text)) {
          const imgCount = (data.images || []).length;
          if (imgCount > 1) {
            await setSession(chatId, 'add_vehicle:select_main', data);
            await send(chatId,
              `📸 *${imgCount} fotos recebidas!*\n\nQual é a *foto principal* (exibida em destaque no site)?\n\nDigite o número: *1* a *${imgCount}*`
            );
          } else {
            await setSession(chatId, 'add_vehicle:confirm', data);
            await send(chatId, buildSummary(data));
          }
        } else if (/^(pular|skip|sem foto|nao|não)$/i.test(text)) {
          await setSession(chatId, 'add_vehicle:confirm', data);
          await send(chatId, buildSummary(data));
        } else {
          await send(chatId,
            `Use o clipe 📎 para enviar fotos ou vídeos.\nOu envie *"ok"* para confirmar, *"pular"* para continuar sem mídia.`
          );
        }
        return res.status(200).json({ ok: true });
      }

      // Select main photo step
      if (step === 'add_vehicle:select_main') {
        const num = parseInt(text.trim(), 10) - 1;
        const imgs: string[] = data.images || [];
        const pids: string[] = data.imagePublicIds || [];
        if (!isNaN(num) && num >= 0 && num < imgs.length) {
          const newImgs = [...imgs];
          const newPids = [...pids];
          const [mainImg] = newImgs.splice(num, 1);
          const [mainPid] = newPids.splice(num, 1);
          newImgs.unshift(mainImg);
          newPids.unshift(mainPid);
          const newData = { ...data, images: newImgs, imagePublicIds: newPids };
          await setSession(chatId, 'add_vehicle:confirm', newData);
          await send(chatId, `✅ Foto *${num + 1}* definida como principal.\n\n${buildSummary(newData)}`);
        } else {
          await send(chatId, `❌ Digite um número entre *1* e *${imgs.length}*`);
        }
        return res.status(200).json({ ok: true });
      }

      // Confirm step
      if (step === 'add_vehicle:confirm') {
        if (/^s(im)?$/i.test(text)) {
          await saveVehicle(data);
          await clearSession(chatId);
          await send(chatId,
            `✅ *Veículo salvo!*\n\n🚛 ${data.brand} ${data.model}\n` +
            (data.images?.length ? `📸 ${data.images.length} foto(s)\n` : '') +
            (data.videoUrl ? `🎬 Vídeo incluído\n` : '') +
            `_Acesse o painel para gerenciar._`
          );
        } else if (/^n(ão|ao)?$/i.test(text)) {
          await clearSession(chatId);
          await send(chatId, '❌ Cadastro cancelado.');
        } else {
          await send(chatId, `Responda *sim* para salvar ou *não* para cancelar.\nAinda pode enviar fotos ou vídeos.`);
        }
        return res.status(200).json({ ok: true });
      }

      // Text fields
      if (step.startsWith('add_vehicle:')) {
        const currentField = step.replace('add_vehicle:', '');
        const extracted = await parseVehicleFromText(text);
        const filledCount = Object.values(extracted).filter(v => v !== '').length;

        let newData: Record<string, any>;
        if (filledCount > 1) {
          newData = { ...data, ...Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== '')) };
        } else {
          const isOptional = OPTIONAL_FIELDS.includes(currentField);
          const skipped = isOptional && /^pular$/i.test(text);
          let value = skipped ? '' : (extracted[currentField] || await extractField(currentField, text));

          // Validate required numeric fields — ask again if result is clearly wrong
          if (!skipped && currentField === 'year') {
            const y = parseInt(value, 10);
            if (isNaN(y) || y < 1950 || y > new Date().getFullYear() + 1) {
              await send(chatId, `❌ Ano inválido. ${QUESTIONS['year']}`);
              return res.status(200).json({ ok: true });
            }
          }
          if (!skipped && currentField === 'price') {
            const p = Number(String(value).replace(/\D/g, ''));
            if (isNaN(p) || p <= 0) {
              await send(chatId, `❌ Preço inválido. ${QUESTIONS['price']}`);
              return res.status(200).json({ ok: true });
            }
          }
          if (!skipped && currentField === 'km') {
            const k = Number(String(value).replace(/\D/g, ''));
            if (isNaN(k) || k < 0) {
              await send(chatId, `❌ Quilometragem inválida. ${QUESTIONS['km']}`);
              return res.status(200).json({ ok: true });
            }
          }
          newData = { ...data, [currentField]: value };
        }

        const nextField = nextMissingField(newData);
        if (nextField) {
          await setSession(chatId, `add_vehicle:${nextField}`, newData);
          await send(chatId, QUESTIONS[nextField]);
        } else {
          await transitionToPhotosOrConfirm(chatId, newData);
        }
        return res.status(200).json({ ok: true });
      }

      // Mark sold: waiting for name
      if (step === 'mark_sold:ask_name') {
        const name = await extractField('vehicle_name', text);
        const sold = await markSold(name);
        await clearSession(chatId);
        await send(chatId, sold
          ? `✅ *${sold.brand} ${sold.model}* marcado como vendido!`
          : `❌ "${name}" não encontrado. Verifique o nome.`
        );
        return res.status(200).json({ ok: true });
      }

      // Delete: waiting for name
      if (step === 'delete_vehicle:ask_name') {
        const name = await extractField('vehicle_name', text);
        const result = await deleteVehicle(name);
        await clearSession(chatId);
        await send(chatId, result.found
          ? `✅ *${result.label}* excluído do estoque e mídias removidas!`
          : `❌ "${name}" não encontrado. Verifique o nome.`
        );
        return res.status(200).json({ ok: true });
      }
    }

    // ── No session: detect intent ──────────────────────────────────────────
    const intent = await detectIntent(text);

    if (intent === 'add_vehicle') {
      const extracted = await parseVehicleFromText(text);
      const filledData = Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== ''));
      const nextField = nextMissingField(filledData);

      if (!nextField) {
        await transitionToPhotosOrConfirm(chatId, filledData);
      } else if (Object.keys(filledData).length > 0) {
        await setSession(chatId, `add_vehicle:${nextField}`, filledData);
        const filled = ALL_FIELDS.filter(f => filledData[f] !== undefined).join(', ');
        await send(chatId, `✅ Peguei: *${filled}*\n\n${QUESTIONS[nextField]}`);
      } else {
        await setSession(chatId, 'add_vehicle:brand', {});
        await send(chatId,
          `🚛 *Cadastro de Veículo*\n\nPasso a passo ou tudo de uma vez.\nFotos e vídeos: envie a qualquer momento.\nCancele: "cancelar".\n\n${QUESTIONS['brand']}`
        );
      }
      return res.status(200).json({ ok: true });
    }

    if (intent === 'mark_sold') {
      const name = await extractField('vehicle_name', text);
      if (name && name.length > 3) {
        const sold = await markSold(name);
        if (sold) {
          await send(chatId, `✅ *${sold.brand} ${sold.model}* marcado como vendido!`);
        } else {
          await setSession(chatId, 'mark_sold:ask_name', {});
          await send(chatId, `❌ "${name}" não encontrado.\n\n🔍 Qual o nome exato do veículo?`);
        }
      } else {
        await setSession(chatId, 'mark_sold:ask_name', {});
        await send(chatId, '🔍 Qual o *nome do veículo* que foi vendido?\n_Ex: Scania R500, Volvo FH_');
      }
      return res.status(200).json({ ok: true });
    }

    if (intent === 'delete_vehicle') {
      const name = await extractField('vehicle_name', text);
      if (name && name.length > 3) {
        const result = await deleteVehicle(name);
        if (result.found) {
          await send(chatId, `✅ *${result.label}* excluído e mídias removidas do Cloudinary!`);
        } else {
          await setSession(chatId, 'delete_vehicle:ask_name', {});
          await send(chatId, `❌ "${name}" não encontrado.\n\n🔍 Qual o nome exato do veículo para excluir?`);
        }
      } else {
        await setSession(chatId, 'delete_vehicle:ask_name', {});
        await send(chatId, '🗑️ Qual o *nome do veículo* que deseja excluir?\n_Ex: Scania R500_\n\n⚠️ Esta ação remove o veículo e todas as mídias permanentemente.');
      }
      return res.status(200).json({ ok: true });
    }

    if (intent === 'get_report') { await send(chatId, await getReport()); return res.status(200).json({ ok: true }); }
    if (intent === 'get_contacts_today') { await send(chatId, await getContacts('today')); return res.status(200).json({ ok: true }); }
    if (intent === 'get_contacts_all') { await send(chatId, await getContacts('all')); return res.status(200).json({ ok: true }); }

    await send(chatId,
      `🤖 *Assistente Premium Caminhões*\n\n` +
      `🚛 *Adicionar veículo* — passo a passo ou tudo de uma vez\n` +
      `📸 *Fotos/vídeos* — envie durante o cadastro\n` +
      `✅ *Marcar como vendido*\n` +
      `🗑️ *Apagar veículo* — remove estoque e mídias\n` +
      `📊 *Relatório*\n` +
      `📩 *Contatos de hoje / recentes*\n\n` +
      `_Escreva em português informal._`
    );
    return res.status(200).json({ ok: true });

  } catch (err: any) {
    console.error('webhook error:', err);
    try {
      const chatId = req.body?.message?.chat?.id;
      if (chatId) await send(chatId, `❌ Erro: ${err?.message || 'tente novamente'}`);
    } catch {}
    return res.status(200).json({ ok: true });
  }
}
