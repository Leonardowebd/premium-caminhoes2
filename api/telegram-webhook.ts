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
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || '';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── Telegram ──────────────────────────────────────────────────────────────────

async function send(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function downloadTelegramPhoto(fileId: string): Promise<Buffer> {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const j: any = await r.json();
  const filePath = j.result?.file_path;
  if (!filePath) throw new Error('Telegram getFile falhou');
  const photoRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  return Buffer.from(await photoRes.arrayBuffer());
}

// ── Cloudinary ────────────────────────────────────────────────────────────────

async function uploadToCloudinary(buffer: Buffer, filename: string): Promise<string> {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
    throw new Error('CLOUDINARY_CLOUD_NAME e CLOUDINARY_UPLOAD_PRESET não configurados no Vercel');
  }
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), filename);
  form.append('upload_preset', CLOUDINARY_PRESET);
  form.append('folder', 'premium-caminhoes/vehicles');
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: form }
  );
  const data: any = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || 'Upload falhou');
  return data.secure_url as string;
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
    `🖼️ Banners ativos: *${bSnap.size}*`
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
  await addDoc(collection(db, 'vehicles'), {
    brand: String(data.brand || '').trim(),
    model: String(data.model || '').trim(),
    year: Number(data.year) || new Date().getFullYear(),
    price: Number(String(data.price || '0').replace(/\D/g, '')),
    kilometers: Number(String(data.km || '0').replace(/\D/g, '')),
    transmission: String(data.transmission || 'Manual').trim(),
    power: String(data.power || '').trim(),
    traction: String(data.traction || '').trim(),
    imageUrl: images[0] || '',
    gallery: images.slice(1),
    description: String(data.description || '').trim(),
    isFeatured: false,
    sold: false,
    type: 'Caminhão',
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

// ── Gemini ────────────────────────────────────────────────────────────────────

async function detectIntent(text: string): Promise<string> {
  try {
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: `Classifique em UMA palavra:
add_vehicle | mark_sold | get_report | get_contacts_today | get_contacts_all | cancel | help

Mensagem: "${text}"
Retorne APENAS a palavra.` }] }],
    });
    return (r.text ?? '').trim().toLowerCase().replace(/[^a-z_]/g, '');
  } catch {
    const t = text.toLowerCase();
    if (t.match(/adicionar|cadastrar|novo vei|novo cam/)) return 'add_vehicle';
    if (t.match(/vendido|vender|vendeu/)) return 'mark_sold';
    if (t.match(/relat|resumo|status/)) return 'get_report';
    if (t.includes('hoje') && t.includes('contato')) return 'get_contacts_today';
    if (t.includes('contato')) return 'get_contacts_all';
    return 'help';
  }
}

async function parseVehicleFromText(text: string): Promise<Record<string, string>> {
  try {
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: `Extraia dados de veículo e retorne JSON. Use "" para campos não encontrados.
Campos: brand, model, year (só número), price (só número), km (só número), transmission, power, traction, description

Mensagem: "${text}"
Retorne APENAS JSON válido sem markdown.` }] }],
    });
    const raw = (r.text ?? '').trim();
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m?.[0] || raw);
  } catch {
    return { brand: '', model: '', year: '', price: '', km: '', transmission: '', power: '', traction: '', description: '' };
  }
}

async function extractField(field: string, text: string): Promise<string> {
  const prompts: Record<string, string> = {
    brand: `Extraia apenas a marca do caminhão. Retorne só a marca. Mensagem: "${text}"`,
    model: `Extraia apenas o modelo. Retorne só o modelo. Mensagem: "${text}"`,
    year: `Extraia apenas o ano (4 dígitos). Retorne só o número. Mensagem: "${text}"`,
    price: `Extraia o valor do preço, retorne só os dígitos sem pontos/vírgulas. Mensagem: "${text}"`,
    km: `Extraia a quilometragem, retorne só os dígitos. Mensagem: "${text}"`,
    transmission: `Extraia o tipo de câmbio. Ex: Manual, Automático. Mensagem: "${text}"`,
    power: `Extraia a potência. Ex: "540 CV". Se não houver retorne vazio. Mensagem: "${text}"`,
    traction: `Extraia a tração. Ex: "6x4". Se não houver retorne vazio. Mensagem: "${text}"`,
    description: `Retorne o texto como descrição do veículo. Mensagem: "${text}"`,
    vehicle_name: `Extraia o nome do veículo (marca + modelo) para busca. Mensagem: "${text}"`,
  };
  try {
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompts[field] || text }] }],
    });
    return (r.text ?? '').trim();
  } catch {
    return text.trim();
  }
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
  transmission: '⚙️ Qual o *câmbio*?\n_Ex: Manual, Automático, ZF_ — ou "pular"',
  power:        '💪 Qual a *potência*?\n_Ex: 540 CV_ — ou "pular"',
  traction:     '🔧 Qual a *tração*?\n_Ex: 6x4, 4x2_ — ou "pular"',
  description:  '📄 Escreva uma *descrição* do veículo — ou "pular"',
};

const PHOTOS_QUESTION =
  `📸 *Envie as fotos do veículo agora.*\n\n` +
  `Pode enviar uma ou várias fotos.\n` +
  `Quando terminar, envie *"ok"* para confirmar o cadastro.\n` +
  `Ou envie *"pular"* para cadastrar sem fotos (adicione pelo painel depois).`;

function nextMissingField(data: Record<string, any>): string | null {
  return ALL_FIELDS.find(f => data[f] === undefined || data[f] === null) ?? null;
}

function buildSummary(data: Record<string, any>): string {
  const imgs: string[] = data.images || [];
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
    `📸 Fotos: ${imgs.length > 0 ? imgs.length + ' foto(s)' : 'nenhuma'}\n\n` +
    `Confirmar e salvar? Responda *sim* ou *não*`
  );
}

// After all text fields collected, transition to photos step or confirm
async function transitionToPhotosOrConfirm(chatId: number, data: Record<string, any>) {
  const images: string[] = data.images || [];
  if (images.length > 0) {
    // Already has photos — go to confirm
    await setSession(chatId, 'add_vehicle:confirm', data);
    await send(chatId, buildSummary(data));
  } else {
    // No photos yet — ask
    await setSession(chatId, 'add_vehicle:photos', data);
    await send(chatId, PHOTOS_QUESTION);
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

    // Setup commands — no auth required
    if (text === '/start' || text === '/myid') {
      await send(chatId, `🤖 *Bot Premium Caminhões*\n\nSeu Chat ID: \`${chatId}\`\nAdicione como \`ADMIN_CHAT_ID\` no Vercel.`);
      return res.status(200).json({ ok: true });
    }

    if (ADMIN_CHAT_ID && String(chatId) !== ADMIN_CHAT_ID) {
      return res.status(200).json({ ok: true });
    }

    // ── Photo received ─────────────────────────────────────────────────────
    if (photos && photos.length > 0) {
      // Upload largest resolution
      let photoUrl = '';
      try {
        const largest = photos[photos.length - 1];
        const buffer = await downloadTelegramPhoto(largest.file_id);
        photoUrl = await uploadToCloudinary(buffer, `vehicle_${Date.now()}.jpg`);
      } catch (err: any) {
        await send(chatId, `❌ Erro no upload: ${err?.message}`);
        return res.status(200).json({ ok: true });
      }

      const session = await getSession(chatId);

      if (session?.step?.startsWith('add_vehicle')) {
        // Accumulate photo in session
        const images: string[] = [...(session.data.images || []), photoUrl];
        const newData = { ...session.data, images };

        if (session.step === 'add_vehicle:photos') {
          // Still collecting photos
          await setSession(chatId, 'add_vehicle:photos', newData);
          await send(chatId, `📸 Foto *${images.length}* recebida! ✅\nEnvie mais fotos ou *"ok"* para confirmar.`);
        } else if (session.step === 'add_vehicle:confirm') {
          // Already at confirm — refresh summary with new photo
          await setSession(chatId, 'add_vehicle:confirm', newData);
          await send(chatId, `📸 Foto *${images.length}* adicionada!\n\n${buildSummary(newData)}`);
        } else {
          // Still in text fields — save photo, continue asking fields
          const nextField = nextMissingField(newData);
          await setSession(chatId, session.step, newData);
          await send(chatId, `📸 Foto *${images.length}* salva! ✅\n\n${nextField ? QUESTIONS[nextField] : 'Continue respondendo as perguntas.'}`);
        }
      } else {
        // No active session — start vehicle flow with photo
        await setSession(chatId, 'add_vehicle:brand', { images: [photoUrl] });
        await send(chatId,
          `📸 Foto recebida! Vamos cadastrar o veículo.\nCancele com "cancelar".\n\n${QUESTIONS['brand']}`
        );
      }

      // If caption has vehicle data, process it too
      if (text) {
        const extracted = await parseVehicleFromText(text);
        const hasData = Object.values(extracted).some(v => v !== '');
        if (hasData) {
          const currentSession = await getSession(chatId);
          if (currentSession?.step?.startsWith('add_vehicle')) {
            const merged = {
              ...currentSession.data,
              ...Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== '')),
            };
            const nextField = nextMissingField(merged);
            if (nextField) {
              await setSession(chatId, `add_vehicle:${nextField}`, merged);
            } else {
              await transitionToPhotosOrConfirm(chatId, merged);
            }
          }
        }
      }

      return res.status(200).json({ ok: true });
    }

    if (!text) return res.status(200).json({ ok: true });

    // ── Cancel anywhere ────────────────────────────────────────────────────
    if (/^(cancelar|cancel|parar|sair|desistir|\/cancel)$/i.test(text)) {
      await clearSession(chatId);
      await send(chatId, '❌ Cancelado. Como posso ajudar?');
      return res.status(200).json({ ok: true });
    }

    // ── Active session ─────────────────────────────────────────────────────
    const session = await getSession(chatId);

    if (session) {
      const { step, data } = session;

      // ── Photos step ──
      if (step === 'add_vehicle:photos') {
        const skipWords = /^(pular|skip|sem foto|nao|não|continuar|pronto|ok|pronto)$/i;
        const confirmWords = /^(ok|pronto|feito|confirmar|continuar|isso)$/i;

        if (skipWords.test(text) || confirmWords.test(text)) {
          await setSession(chatId, 'add_vehicle:confirm', data);
          await send(chatId, buildSummary(data));
        } else {
          await send(chatId, `📸 Para enviar fotos, use o clipe 📎 do Telegram e selecione a imagem.\nOu envie *"pular"* para continuar sem fotos.`);
        }
        return res.status(200).json({ ok: true });
      }

      // ── Confirm step ──
      if (step === 'add_vehicle:confirm') {
        if (/^s(im)?$/i.test(text)) {
          await saveVehicle(data);
          await clearSession(chatId);
          await send(chatId,
            `✅ *Veículo salvo!*\n\n🚛 ${data.brand} ${data.model}\n` +
            (data.images?.length ? `📸 ${data.images.length} foto(s)\n` : '📸 Sem fotos — adicione no painel\n') +
            `_Acesse o painel para gerenciar._`
          );
        } else if (/^n(ão|ao)?$/i.test(text)) {
          await clearSession(chatId);
          await send(chatId, '❌ Cadastro cancelado.');
        } else {
          // Allow sending more photos at confirm stage — handled above in photo block
          await send(chatId, `Responda *sim* para salvar ou *não* para cancelar.\nAinda pode enviar mais fotos.`);
        }
        return res.status(200).json({ ok: true });
      }

      // ── Text field steps ──
      if (step.startsWith('add_vehicle:')) {
        const currentField = step.replace('add_vehicle:', '');

        // Try bulk parse first
        const extracted = await parseVehicleFromText(text);
        const filledCount = Object.values(extracted).filter(v => v !== '').length;

        let newData: Record<string, any>;
        if (filledCount > 1) {
          // Multiple fields in one message
          newData = { ...data, ...Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== '')) };
        } else {
          // Single field
          const isOptional = OPTIONAL_FIELDS.includes(currentField);
          const skipped = isOptional && /^pular$/i.test(text);
          const value = skipped ? '' : (extracted[currentField] || await extractField(currentField, text));
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

      // ── Mark sold: waiting for name ──
      if (step === 'mark_sold:ask_name') {
        const name = await extractField('vehicle_name', text);
        const sold = await markSold(name);
        await clearSession(chatId);
        await send(chatId, sold
          ? `✅ *${sold.brand} ${sold.model}* marcado como vendido!`
          : `❌ "${name}" não encontrado. Verifique o nome no estoque.`
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
          `🚛 *Cadastro de Veículo*\n\nVou guiar passo a passo.\nPode enviar tudo de uma vez ou as fotos a qualquer momento.\nCancele com "cancelar".\n\n${QUESTIONS['brand']}`
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
          await send(chatId, `❌ "${name}" não encontrado.\n\n🔍 Qual o nome exato do veículo?\n_Ex: Scania R500_`);
        }
      } else {
        await setSession(chatId, 'mark_sold:ask_name', {});
        await send(chatId, '🔍 Qual o *nome do veículo* que foi vendido?\n_Ex: Scania R500, Volvo FH_');
      }
      return res.status(200).json({ ok: true });
    }

    if (intent === 'get_report') { await send(chatId, await getReport()); return res.status(200).json({ ok: true }); }
    if (intent === 'get_contacts_today') { await send(chatId, await getContacts('today')); return res.status(200).json({ ok: true }); }
    if (intent === 'get_contacts_all') { await send(chatId, await getContacts('all')); return res.status(200).json({ ok: true }); }

    await send(chatId,
      `🤖 *Assistente Premium Caminhões*\n\n` +
      `🚛 *Adicionar veículo* — passo a passo ou tudo de uma vez\n` +
      `📸 *Fotos* — envie durante o cadastro (clipe 📎)\n` +
      `✅ *Marcar como vendido* — atualiza estoque\n` +
      `📊 *Relatório* — resumo do site\n` +
      `📩 *Contatos de hoje / recentes*\n\n` +
      `_Escreva em português informal, entendo tudo._`
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
