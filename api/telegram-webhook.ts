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
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── Session state ────────────────────────────────────────────────────────────

interface Session {
  step: string;
  data: Record<string, any>;
  updatedAt: number;
}

async function getSession(chatId: number): Promise<Session | null> {
  const ref = doc(db, 'bot_sessions', String(chatId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const s = snap.data() as Session;
  if (Date.now() - (s.updatedAt || 0) > 30 * 60 * 1000) {
    await deleteDoc(ref);
    return null;
  }
  return s;
}

async function setSession(chatId: number, step: string, data: Record<string, any>) {
  await setDoc(doc(db, 'bot_sessions', String(chatId)), { step, data, updatedAt: Date.now() });
}

async function clearSession(chatId: number) {
  await deleteDoc(doc(db, 'bot_sessions', String(chatId)));
}

// ── Telegram helpers ─────────────────────────────────────────────────────────

async function send(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

// ── Firestore actions ────────────────────────────────────────────────────────

async function getReport() {
  const [vSnap, cSnap, bSnap] = await Promise.all([
    getDocs(collection(db, 'vehicles')),
    getDocs(query(collection(db, 'contacts'), orderBy('createdAt', 'desc'))),
    getDocs(collection(db, 'banners')),
  ]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLeads = cSnap.docs.filter(d => (d.data().createdAt || 0) >= today.getTime());
  return (
    `📊 *RELATÓRIO — PREMIUM CAMINHÕES*\n\n` +
    `🚛 Veículos no estoque: *${vSnap.size}*\n` +
    `📩 Leads total: *${cSnap.size}*\n` +
    `📩 Leads hoje: *${todayLeads.length}*\n` +
    `🖼️ Banners ativos: *${bSnap.size}*`
  );
}

async function getContacts(filter: 'today' | 'all') {
  const snap = await getDocs(query(collection(db, 'contacts'), orderBy('createdAt', 'desc'), limit(20)));
  let contacts = snap.docs.map(d => d.data() as any);
  if (filter === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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
  await addDoc(collection(db, 'vehicles'), {
    brand: String(data.brand || '').trim(),
    model: String(data.model || '').trim(),
    year: Number(data.year) || new Date().getFullYear(),
    price: Number(String(data.price || '0').replace(/\D/g, '')),
    kilometers: Number(String(data.km || '0').replace(/\D/g, '')),
    transmission: String(data.transmission || 'Manual').trim(),
    power: String(data.power || '').trim(),
    traction: String(data.traction || '').trim(),
    imageUrl: '',
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

// ── Intent detection via Gemini ──────────────────────────────────────────────

async function detectIntent(text: string): Promise<string> {
  const prompt = `Classifique a mensagem em uma categoria. Retorne APENAS uma palavra:
- "add_vehicle" se o usuário quer adicionar/cadastrar um veículo/caminhão
- "mark_sold" se quer marcar veículo como vendido
- "get_report" se quer relatório, resumo ou status do site
- "get_contacts_today" se quer contatos/leads de hoje
- "get_contacts_all" se quer contatos/leads em geral
- "cancel" se quer cancelar ou parar
- "help" para qualquer outra coisa

Mensagem: "${text}"`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return (result.text ?? '').trim().toLowerCase().replace(/[^a-z_]/g, '');
  } catch {
    const t = text.toLowerCase();
    if (t.includes('adicionar') || t.includes('cadastrar') || t.includes('novo veiculo') || t.includes('novo caminhão')) return 'add_vehicle';
    if (t.includes('vendido') || t.includes('vender')) return 'mark_sold';
    if (t.includes('relat') || t.includes('resumo') || t.includes('status')) return 'get_report';
    if (t.includes('contato') && t.includes('hoje')) return 'get_contacts_today';
    if (t.includes('contato')) return 'get_contacts_all';
    if (t.includes('cancel') || t.includes('parar')) return 'cancel';
    return 'help';
  }
}

async function extractWithGemini(field: string, text: string): Promise<string> {
  const prompts: Record<string, string> = {
    brand: `Extraia apenas o nome da marca do caminhão desta mensagem. Retorne só a marca, sem mais nada. Ex: "Scania", "Volvo", "Mercedes". Mensagem: "${text}"`,
    model: `Extraia apenas o modelo do caminhão desta mensagem. Retorne só o modelo. Ex: "R500", "FH540", "Atego 2430". Mensagem: "${text}"`,
    year: `Extraia apenas o ano (4 dígitos) desta mensagem. Retorne só o número. Mensagem: "${text}"`,
    price: `Extraia apenas o valor numérico do preço desta mensagem, sem pontos, vírgulas ou R$. Ex: se "R$ 850.000" retorne "850000". Mensagem: "${text}"`,
    km: `Extraia apenas o número de quilômetros desta mensagem, sem pontos ou "km". Ex: se "150.000 km" retorne "150000". Mensagem: "${text}"`,
    transmission: `Extraia o tipo de câmbio desta mensagem. Retorne "Manual", "Automático" ou o que foi dito. Mensagem: "${text}"`,
    power: `Extraia a potência do motor desta mensagem. Ex: "540 CV", "480 HP". Se não há potência, retorne vazio. Mensagem: "${text}"`,
    traction: `Extraia a tração desta mensagem. Ex: "6x4", "4x2". Se não há tração, retorne vazio. Mensagem: "${text}"`,
    description: `Esta é uma descrição de veículo. Retorne o texto limpo e direto. Mensagem: "${text}"`,
    vehicle_name: `Extraia o nome do veículo (marca + modelo) desta mensagem para buscar no estoque. Ex: "Scania R500", "Volvo FH". Mensagem: "${text}"`,
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

// ── Conversation steps ───────────────────────────────────────────────────────

const STEPS = [
  { key: 'brand',        question: '🚛 Qual a *marca* do caminhão?\n\n_Ex: Scania, Volvo, Mercedes, DAF_' },
  { key: 'model',        question: '📝 Qual o *modelo*?\n\n_Ex: R500, FH540, Axor 2544_' },
  { key: 'year',         question: '📅 Qual o *ano* de fabricação?' },
  { key: 'price',        question: '💰 Qual o *preço*?\n\n_Ex: 850000 ou R$ 850.000_' },
  { key: 'km',           question: '🔢 Quantos *quilômetros*?\n\n_Ex: 150000 ou 150.000 km_' },
  { key: 'transmission', question: '⚙️ Qual o *câmbio*?\n\n_Ex: Manual, Automático, ZF_' },
  { key: 'power',        question: '💪 Qual a *potência*?\n\n_Ex: 540 CV — ou envie "pular"_' },
  { key: 'traction',     question: '🔧 Qual a *tração*?\n\n_Ex: 6x4, 4x2 — ou envie "pular"_' },
  { key: 'description',  question: '📄 Escreva uma *descrição* do veículo — ou envie "pular"' },
];

function buildSummary(data: Record<string, any>): string {
  return (
    `📋 *RESUMO DO VEÍCULO*\n\n` +
    `🚛 *${data.brand} ${data.model}*\n` +
    `📅 Ano: ${data.year}\n` +
    `💰 R$ ${Number(data.price).toLocaleString('pt-BR')}\n` +
    `📍 ${Number(data.km).toLocaleString('pt-BR')} km\n` +
    `⚙️ Câmbio: ${data.transmission}\n` +
    (data.power ? `💪 Potência: ${data.power}\n` : '') +
    (data.traction ? `🔧 Tração: ${data.traction}\n` : '') +
    (data.description ? `📄 ${data.description}\n` : '') +
    `\nConfirmar e salvar? Responda *sim* ou *não*`
  );
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const msg = req.body?.message;
    if (!msg) return res.status(200).json({ ok: true });

    const chatId: number = msg.chat.id;
    const text: string = (msg.text || '').trim();

    if (text === '/start' || text === '/myid') {
      await send(chatId, `🤖 *Bot Premium Caminhões*\n\nSeu Chat ID: \`${chatId}\`\n\nCopie esse ID e adicione como \`ADMIN_CHAT_ID\` no Vercel.`);
      return res.status(200).json({ ok: true });
    }

    if (ADMIN_CHAT_ID && String(chatId) !== ADMIN_CHAT_ID) {
      return res.status(200).json({ ok: true });
    }

    // ── Check active session ──
    const session = await getSession(chatId);

    // Handle cancel at any point
    const cancelWords = ['cancelar', 'cancel', 'parar', 'sair', 'desistir', '/cancel'];
    if (cancelWords.some(w => text.toLowerCase().includes(w))) {
      await clearSession(chatId);
      await send(chatId, '❌ Operação cancelada. Como posso ajudar?');
      return res.status(200).json({ ok: true });
    }

    // ── Active session: continue conversation ──
    if (session) {
      const { step, data } = session;

      // Add vehicle flow
      if (step.startsWith('add_vehicle:')) {
        const currentField = step.replace('add_vehicle:', '');

        // Confirm step
        if (currentField === 'confirm') {
          if (text.toLowerCase().startsWith('s')) {
            await saveVehicle(data);
            await clearSession(chatId);
            await send(chatId,
              `✅ *Veículo salvo com sucesso!*\n\n` +
              `🚛 ${data.brand} ${data.model}\n` +
              `_Acesse o painel para adicionar fotos._`
            );
          } else {
            await clearSession(chatId);
            await send(chatId, '❌ Cadastro cancelado. Envie "adicionar veículo" para tentar novamente.');
          }
          return res.status(200).json({ ok: true });
        }

        // Extract value for current field
        const isSkippable = ['power', 'traction', 'description'].includes(currentField);
        const skipped = isSkippable && text.toLowerCase() === 'pular';
        const value = skipped ? '' : await extractWithGemini(currentField, text);

        const newData = { ...data, [currentField]: value };

        // Find next step
        const currentIdx = STEPS.findIndex(s => s.key === currentField);
        const nextStep = STEPS[currentIdx + 1];

        if (nextStep) {
          await setSession(chatId, `add_vehicle:${nextStep.key}`, newData);
          await send(chatId, nextStep.question);
        } else {
          await setSession(chatId, 'add_vehicle:confirm', newData);
          await send(chatId, buildSummary(newData));
        }
        return res.status(200).json({ ok: true });
      }

      // Mark sold flow
      if (step === 'mark_sold:ask_name') {
        const name = await extractWithGemini('vehicle_name', text);
        const sold = await markSold(name);
        await clearSession(chatId);
        if (sold) {
          await send(chatId, `✅ *${sold.brand} ${sold.model}* marcado como vendido!`);
        } else {
          await send(chatId, `❌ Veículo "${name}" não encontrado. Verifique o nome no estoque.`);
        }
        return res.status(200).json({ ok: true });
      }
    }

    // ── No active session: detect intent ──
    const intent = await detectIntent(text);

    switch (intent) {
      case 'add_vehicle':
        await setSession(chatId, `add_vehicle:${STEPS[0].key}`, {});
        await send(chatId, `🚛 *Cadastro de Veículo*\n\nVou te guiar passo a passo.\nPode cancelar a qualquer hora enviando "cancelar".\n\n${STEPS[0].question}`);
        break;

      case 'mark_sold':
        await setSession(chatId, 'mark_sold:ask_name', {});
        await send(chatId, '🔍 Qual o *nome do veículo* que foi vendido?\n\n_Ex: Scania R500, Volvo FH_');
        break;

      case 'get_report':
        await send(chatId, await getReport());
        break;

      case 'get_contacts_today':
        await send(chatId, await getContacts('today'));
        break;

      case 'get_contacts_all':
        await send(chatId, await getContacts('all'));
        break;

      default:
        await send(chatId,
          `🤖 *Assistente Premium Caminhões*\n\n` +
          `Posso te ajudar com:\n\n` +
          `🚛 *Adicionar veículo* — cadastro passo a passo\n` +
          `✅ *Marcar como vendido* — atualiza o estoque\n` +
          `📊 *Relatório* — resumo do site\n` +
          `📩 *Contatos de hoje* — leads do dia\n` +
          `📩 *Contatos recentes* — últimos leads\n\n` +
          `_Pode escrever de forma natural, entendo português informal._`
        );
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('telegram webhook error:', err);
    try {
      const chatId = req.body?.message?.chat?.id;
      if (chatId) await send(chatId, `❌ Erro interno: ${err?.message || 'desconhecido'}`);
    } catch {}
    return res.status(200).json({ ok: true });
  }
}
