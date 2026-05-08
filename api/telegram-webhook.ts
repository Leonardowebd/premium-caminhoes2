import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, addDoc, getDocs,
  updateDoc, doc, query, orderBy, limit, setDoc, getDoc, deleteDoc,
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
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUDINARY_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── Telegram ─────────────────────────────────────────────────────────────────

async function send(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function downloadTelegramPhoto(fileId: string): Promise<Buffer> {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const j = await r.json();
  const filePath = j.result?.file_path;
  if (!filePath) throw new Error('No file path from Telegram');
  const photoRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  const ab = await photoRes.arrayBuffer();
  return Buffer.from(ab);
}

// ── Cloudinary ────────────────────────────────────────────────────────────────

async function uploadToCloudinary(buffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), filename);
  form.append('upload_preset', CLOUDINARY_PRESET);
  form.append('folder', 'premium-caminhoes/vehicles');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || 'Cloudinary upload failed');
  return data.secure_url;
}

// ── Session ───────────────────────────────────────────────────────────────────

interface Session {
  step: string;
  data: Record<string, any>;
  updatedAt: number;
}

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
    `🚛 Veículos disponíveis: *${available}*\n` +
    `✅ Vendidos: *${sold}*\n` +
    `📩 Leads total: *${cSnap.size}*\n` +
    `📩 Leads hoje: *${todayLeads.length}*\n` +
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

// ── Gemini helpers ─────────────────────────────────────────────────────────────

async function detectIntent(text: string): Promise<string> {
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: `Classifique a mensagem em UMA palavra exata:
- add_vehicle (quer adicionar/cadastrar veículo/caminhão)
- mark_sold (quer marcar como vendido)
- get_report (quer relatório/resumo/status)
- get_contacts_today (contatos/leads de hoje)
- get_contacts_all (contatos/leads em geral)
- cancel (cancelar/parar/sair)
- help (qualquer outra coisa)

Mensagem: "${text}"
Retorne APENAS uma das palavras acima.` }] }],
    });
    return (result.text ?? '').trim().toLowerCase().replace(/[^a-z_]/g, '');
  } catch {
    const t = text.toLowerCase();
    if (t.match(/adicionar|cadastrar|novo vei|novo cam/)) return 'add_vehicle';
    if (t.match(/vendido|vender|vendeu/)) return 'mark_sold';
    if (t.match(/relat|resumo|status|como t[aá]/)) return 'get_report';
    if (t.includes('hoje')) return 'get_contacts_today';
    if (t.includes('contato')) return 'get_contacts_all';
    return 'help';
  }
}

// Extract all vehicle fields at once from any free-form message
async function parseVehicleFromText(text: string): Promise<Record<string, string>> {
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: `Extraia dados de um caminhão/veículo desta mensagem e retorne JSON.
Use string vazia "" para campos não encontrados.
Campos obrigatórios: brand (marca), model (modelo), year (ano, só número), price (preço, só número sem pontos/vírgulas/R$), km (quilometragem, só número)
Campos opcionais: transmission (câmbio), power (potência, ex: "540 CV"), traction (tração, ex: "6x4"), description (descrição)

Mensagem: "${text}"

Retorne APENAS JSON válido, sem markdown, sem explicação:
{"brand":"","model":"","year":"","price":"","km":"","transmission":"","power":"","traction":"","description":""}` }] }],
    });
    const raw = (result.text ?? '').trim();
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m?.[0] || raw);
  } catch {
    return { brand: '', model: '', year: '', price: '', km: '', transmission: '', power: '', traction: '', description: '' };
  }
}

async function extractField(field: string, text: string): Promise<string> {
  const prompts: Record<string, string> = {
    brand: `Extraia apenas a marca do caminhão. Retorne só a marca. Ex: "Scania". Mensagem: "${text}"`,
    model: `Extraia apenas o modelo do caminhão. Retorne só o modelo. Ex: "R500". Mensagem: "${text}"`,
    year: `Extraia apenas o ano (4 dígitos). Retorne só o número. Mensagem: "${text}"`,
    price: `Extraia apenas o valor numérico do preço sem formatação. Ex: "850000". Mensagem: "${text}"`,
    km: `Extraia apenas a quilometragem numérica sem formatação. Ex: "150000". Mensagem: "${text}"`,
    transmission: `Extraia o tipo de câmbio. Ex: "Manual", "Automático". Mensagem: "${text}"`,
    power: `Extraia a potência. Ex: "540 CV". Se não há, retorne "". Mensagem: "${text}"`,
    traction: `Extraia a tração. Ex: "6x4". Se não há, retorne "". Mensagem: "${text}"`,
    description: `Retorne o texto como descrição do veículo, limpo e direto. Mensagem: "${text}"`,
    vehicle_name: `Extraia o nome do veículo (marca + modelo) para busca. Ex: "Scania R500". Mensagem: "${text}"`,
  };
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompts[field] || text }] }],
    });
    return (result.text ?? '').trim();
  } catch {
    return text.trim();
  }
}

// ── Vehicle conversation steps ────────────────────────────────────────────────

const REQUIRED_FIELDS = ['brand', 'model', 'year', 'price', 'km'];
const OPTIONAL_FIELDS = ['transmission', 'power', 'traction', 'description'];

const QUESTIONS: Record<string, string> = {
  brand:        '🚛 Qual a *marca* do caminhão?\n\n_Ex: Scania, Volvo, Mercedes, DAF_',
  model:        '📝 Qual o *modelo*?\n\n_Ex: R500, FH540, Axor 2544_',
  year:         '📅 Qual o *ano* de fabricação?',
  price:        '💰 Qual o *preço*?\n\n_Ex: 850000 ou R$ 850.000_',
  km:           '🔢 Quantos *quilômetros*?\n\n_Ex: 150000 ou 150.000 km_',
  transmission: '⚙️ Qual o *câmbio*?\n\n_Ex: Manual, Automático, ZF — ou "pular"_',
  power:        '💪 Qual a *potência*?\n\n_Ex: 540 CV — ou "pular"_',
  traction:     '🔧 Qual a *tração*?\n\n_Ex: 6x4, 4x2 — ou "pular"_',
  description:  '📄 Descrição do veículo — ou "pular"',
};

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

function nextMissingField(data: Record<string, any>): string | null {
  return ALL_FIELDS.find(f => !data[f] && data[f] !== 0) ?? null;
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
    `📸 Fotos: ${imgs.length > 0 ? imgs.length : 'nenhuma (adicione no painel)'}\n` +
    `\nConfirmar e salvar? Responda *sim* ou *não*\n_Ainda pode enviar fotos antes de confirmar._`
  );
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const msg = req.body?.message;
    if (!msg) return res.status(200).json({ ok: true });

    const chatId: number = msg.chat.id;
    const text: string = (msg.text || msg.caption || '').trim();
    const photos = msg.photo as any[] | undefined; // Telegram sends photo array (multiple sizes)

    if (text === '/start' || text === '/myid') {
      await send(chatId, `🤖 *Bot Premium Caminhões*\n\nSeu Chat ID: \`${chatId}\`\n\nCopie e adicione como \`ADMIN_CHAT_ID\` no Vercel.`);
      return res.status(200).json({ ok: true });
    }

    if (ADMIN_CHAT_ID && String(chatId) !== ADMIN_CHAT_ID) {
      return res.status(200).json({ ok: true });
    }

    // ── Photo received ─────────────────────────────────────────────────────
    if (photos && photos.length > 0) {
      const session = await getSession(chatId);
      const isAddingVehicle = session?.step?.startsWith('add_vehicle');

      // Upload to Cloudinary
      let photoUrl = '';
      try {
        const largest = photos[photos.length - 1]; // Telegram provides multiple resolutions
        const buffer = await downloadTelegramPhoto(largest.file_id);
        photoUrl = await uploadToCloudinary(buffer, `vehicle_${Date.now()}.jpg`);
      } catch (err: any) {
        await send(chatId, `❌ Erro ao fazer upload da foto: ${err?.message}. Tente novamente.`);
        return res.status(200).json({ ok: true });
      }

      if (isAddingVehicle && session) {
        const images: string[] = session.data.images || [];
        images.push(photoUrl);
        const newData = { ...session.data, images };
        await setSession(chatId, session.step, newData);

        const nextField = nextMissingField(newData);
        if (session.step === 'add_vehicle:confirm') {
          await send(chatId, `📸 Foto ${images.length} adicionada!\n\n${buildSummary(newData)}`);
        } else if (nextField) {
          await send(chatId, `📸 Foto ${images.length} adicionada! ✅\n\n${QUESTIONS[nextField]}`);
        } else {
          await setSession(chatId, 'add_vehicle:confirm', newData);
          await send(chatId, `📸 Foto ${images.length} adicionada! ✅\n\n${buildSummary(newData)}`);
        }
      } else {
        // Not in a session — start vehicle flow with photo already saved
        const newData: Record<string, any> = { images: [photoUrl] };
        await setSession(chatId, `add_vehicle:brand`, newData);
        await send(chatId, `📸 Foto recebida e salva!\n\nVamos cadastrar o veículo. Pode cancelar enviando "cancelar".\n\n${QUESTIONS['brand']}`);
      }

      // Also parse caption if it has vehicle data
      if (text) {
        const extracted = await parseVehicleFromText(text);
        const hasData = Object.values(extracted).some(v => v !== '');
        if (hasData) {
          const currentSession = await getSession(chatId);
          if (currentSession) {
            const merged = { ...currentSession.data, ...Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== '')) };
            const nextField = nextMissingField(merged);
            if (nextField) {
              await setSession(chatId, `add_vehicle:${nextField}`, merged);
              await send(chatId, `✅ Dados extraídos da legenda!\n\n${QUESTIONS[nextField]}`);
            } else {
              await setSession(chatId, 'add_vehicle:confirm', merged);
              await send(chatId, buildSummary(merged));
            }
          }
        }
      }

      return res.status(200).json({ ok: true });
    }

    if (!text) return res.status(200).json({ ok: true });

    // ── Cancel ─────────────────────────────────────────────────────────────
    if (/cancelar|cancel|parar|sair|desistir|\/cancel/.test(text.toLowerCase())) {
      await clearSession(chatId);
      await send(chatId, '❌ Operação cancelada. Como posso ajudar?');
      return res.status(200).json({ ok: true });
    }

    // ── Active session ─────────────────────────────────────────────────────
    const session = await getSession(chatId);

    if (session) {
      const { step, data } = session;

      // Add vehicle confirm step
      if (step === 'add_vehicle:confirm') {
        if (/^s/i.test(text)) {
          await saveVehicle(data);
          await clearSession(chatId);
          await send(chatId,
            `✅ *Veículo salvo com sucesso!*\n\n🚛 ${data.brand} ${data.model}\n` +
            (data.images?.length ? `📸 ${data.images.length} foto(s) salva(s)\n` : '📸 Sem fotos — adicione no painel\n') +
            `_Acesse o painel para gerenciar._`
          );
        } else {
          await clearSession(chatId);
          await send(chatId, '❌ Cadastro cancelado.');
        }
        return res.status(200).json({ ok: true });
      }

      // Add vehicle field steps
      if (step.startsWith('add_vehicle:')) {
        const currentField = step.replace('add_vehicle:', '');

        // Try to parse multiple fields from this message
        const extracted = await parseVehicleFromText(text);
        const hasMultiple = Object.values(extracted).filter(v => v !== '').length > 1;

        let newData: Record<string, any>;

        if (hasMultiple) {
          // User sent multiple fields at once — merge
          newData = { ...data, ...Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== '')) };
        } else {
          // Single field response
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
          await setSession(chatId, 'add_vehicle:confirm', newData);
          await send(chatId, buildSummary(newData));
        }
        return res.status(200).json({ ok: true });
      }

      // Mark sold: waiting for vehicle name
      if (step === 'mark_sold:ask_name') {
        const name = await extractField('vehicle_name', text);
        const sold = await markSold(name);
        await clearSession(chatId);
        await send(chatId, sold
          ? `✅ *${sold.brand} ${sold.model}* marcado como vendido!`
          : `❌ Veículo "${name}" não encontrado. Verifique o nome.`
        );
        return res.status(200).json({ ok: true });
      }
    }

    // ── No session: detect intent and check for inline data ────────────────
    const intent = await detectIntent(text);

    if (intent === 'add_vehicle') {
      // Try to extract vehicle data from the same message
      const extracted = await parseVehicleFromText(text);
      const filledData = Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== ''));
      const nextField = nextMissingField(filledData);

      if (!nextField) {
        // All fields found in one message — go straight to confirm
        await setSession(chatId, 'add_vehicle:confirm', filledData);
        await send(chatId, `✅ Extraí todos os dados!\n\n${buildSummary(filledData)}`);
      } else if (Object.keys(filledData).length > 0) {
        // Partial data found — continue from next missing field
        await setSession(chatId, `add_vehicle:${nextField}`, filledData);
        const filled = ALL_FIELDS.filter(f => filledData[f]).join(', ');
        await send(chatId, `✅ Já peguei: *${filled}*\n\n${QUESTIONS[nextField]}`);
      } else {
        // No data — start from scratch
        await setSession(chatId, `add_vehicle:brand`, {});
        await send(chatId,
          `🚛 *Cadastro de Veículo*\n\nVou te guiar passo a passo.\nPode enviar tudo de uma vez ou me mandar as fotos a qualquer momento!\nCancele enviando "cancelar".\n\n${QUESTIONS['brand']}`
        );
      }
      return res.status(200).json({ ok: true });
    }

    if (intent === 'mark_sold') {
      const name = await extractField('vehicle_name', text);
      if (name && name.length > 2) {
        const sold = await markSold(name);
        await send(chatId, sold
          ? `✅ *${sold.brand} ${sold.model}* marcado como vendido!`
          : `❌ "${name}" não encontrado. Qual o nome exato?`
        );
        if (!sold) await setSession(chatId, 'mark_sold:ask_name', {});
      } else {
        await setSession(chatId, 'mark_sold:ask_name', {});
        await send(chatId, '🔍 Qual o *nome do veículo* que foi vendido?\n\n_Ex: Scania R500, Volvo FH_');
      }
      return res.status(200).json({ ok: true });
    }

    if (intent === 'get_report') { await send(chatId, await getReport()); return res.status(200).json({ ok: true }); }
    if (intent === 'get_contacts_today') { await send(chatId, await getContacts('today')); return res.status(200).json({ ok: true }); }
    if (intent === 'get_contacts_all') { await send(chatId, await getContacts('all')); return res.status(200).json({ ok: true }); }

    await send(chatId,
      `🤖 *Assistente Premium Caminhões*\n\n` +
      `Posso te ajudar com:\n\n` +
      `🚛 *Adicionar veículo* — pode enviar tudo de uma vez ou passo a passo\n` +
      `📸 *Fotos* — envie a qualquer momento durante o cadastro\n` +
      `✅ *Marcar como vendido* — atualiza o estoque\n` +
      `📊 *Relatório* — resumo do site\n` +
      `📩 *Contatos de hoje / recentes* — leads\n\n` +
      `_Escreva de forma natural, entendo português informal._`
    );
    return res.status(200).json({ ok: true });

  } catch (err: any) {
    console.error('telegram webhook error:', err);
    try {
      const chatId = req.body?.message?.chat?.id;
      if (chatId) await send(chatId, `❌ Erro: ${err?.message || 'tente novamente'}`);
    } catch {}
    return res.status(200).json({ ok: true });
  }
}
