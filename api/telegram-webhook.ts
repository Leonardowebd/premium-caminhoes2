import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, addDoc, getDocs,
  updateDoc, doc, query, orderBy, limit,
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

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

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

async function addVehicle(data: any) {
  await addDoc(collection(db, 'vehicles'), {
    brand: String(data.brand || '').trim(),
    model: String(data.model || '').trim(),
    year: Number(data.year) || new Date().getFullYear(),
    price: Number(String(data.price || '0').replace(/\D/g, '')),
    kilometers: Number(String(data.kilometers || '0').replace(/\D/g, '')),
    transmission: String(data.transmission || 'Manual').trim(),
    power: String(data.power || '').trim(),
    traction: String(data.traction || '').trim(),
    imageUrl: '',
    description: String(data.description || '').trim(),
    isFeatured: false,
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
    await updateDoc(doc(db, 'vehicles', found.id), { isFeatured: false, sold: true });
    return found;
  }
  return null;
}

const SYSTEM_PROMPT = `Você é o assistente administrativo da Premium Caminhões. Interprete a mensagem e retorne SOMENTE JSON válido, sem markdown:

{"action":"add_vehicle","data":{...},"confirm":"..."}
{"action":"mark_sold","data":{"vehicle_name":"..."},"confirm":"..."}
{"action":"get_report","data":{},"confirm":"..."}
{"action":"get_contacts","data":{"filter":"today"|"all"},"confirm":"..."}
{"action":"help","data":{},"confirm":"..."}

Para add_vehicle extraia: brand, model, year (número), price (número sem R$/pontos), kilometers (número), transmission, power, traction, description.
Para mark_sold extraia: vehicle_name.
Para get_contacts: filter "today" se mencionar hoje/dia, senão "all".
get_report: "relatório", "resumo", "status", "como tá".
Seja flexível com linguagem informal brasileira. Retorne APENAS o JSON, nada mais.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const msg = req.body?.message;
    if (!msg) return res.status(200).json({ ok: true });

    const chatId: number = msg.chat.id;
    const text: string = msg.text || '';

    // Setup command — returns chat ID so user can set ADMIN_CHAT_ID
    if (text === '/start' || text === '/myid') {
      await sendMessage(chatId, `🤖 *Bot Premium Caminhões*\n\nSeu Chat ID: \`${chatId}\`\n\nCopie esse ID e adicione como variável \`ADMIN_CHAT_ID\` no Vercel.`);
      return res.status(200).json({ ok: true });
    }

    // Restrict to admin only
    if (ADMIN_CHAT_ID && String(chatId) !== ADMIN_CHAT_ID) {
      return res.status(200).json({ ok: true });
    }

    // Help command
    if (text === '/help' || text === '/ajuda') {
      await sendMessage(chatId,
        `🤖 *Comandos disponíveis:*\n\n` +
        `📊 /relatorio — resumo do site\n` +
        `📩 /contatos — últimos 5 leads\n` +
        `📩 /contatoshoje — leads do dia\n` +
        `🚛 /adicionar — adicionar veículo\n` +
        `✅ /vendido — marcar como vendido\n\n` +
        `_Ou escreva normalmente, ex:_\n"Adicionar Scania R500, 850000, 150km, 2021"\n"Relatório"\n"Contatos hoje"`
      );
      return res.status(200).json({ ok: true });
    }

    // Parse intent with Gemini
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: SYSTEM_PROMPT + '\n\nMensagem: ' + text,
    });

    const aiText = (result.text || '').trim();

    let parsed: any;
    try {
      const m = aiText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m?.[0] || aiText);
    } catch {
      await sendMessage(chatId,
        '❓ Não entendi. Use /help para ver os comandos.'
      );
      return res.status(200).json({ ok: true });
    }

    let reply = '';

    switch (parsed.action) {
      case 'get_report':
        reply = await getReport();
        break;

      case 'get_contacts':
        reply = await getContacts(parsed.data?.filter || 'all');
        break;

      case 'add_vehicle':
        await addVehicle(parsed.data);
        reply =
          `✅ *Veículo adicionado!*\n\n` +
          `🚛 ${parsed.data.brand} ${parsed.data.model}\n` +
          `📅 Ano: ${parsed.data.year}\n` +
          `💰 R$ ${Number(parsed.data.price).toLocaleString('pt-BR')}\n` +
          `📍 ${Number(parsed.data.kilometers).toLocaleString('pt-BR')} km\n\n` +
          `_Acesse o painel para adicionar fotos._`;
        break;

      case 'mark_sold': {
        const sold = await markSold(parsed.data?.vehicle_name || '');
        reply = sold
          ? `✅ *${sold.brand} ${sold.model}* marcado como vendido!`
          : `❌ Veículo "${parsed.data?.vehicle_name}" não encontrado.`;
        break;
      }

      default:
        reply =
          `🤖 *Assistente Premium Caminhões*\n\n` +
          `📊 "Relatório" — resumo do site\n` +
          `📩 "Contatos hoje" — leads do dia\n` +
          `🚛 "Adicionar [marca, modelo, preço, km, ano]"\n` +
          `✅ "Vendido [modelo]"\n\n` +
          `Ou use /help`;
    }

    await sendMessage(chatId, reply);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('telegram webhook error:', err);
    try {
      const chatId = req.body?.message?.chat?.id;
      if (chatId) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Erro interno: ${err?.message || 'desconhecido'}`,
          }),
        });
      }
    } catch {}
    return res.status(200).json({ ok: true });
  }
}
