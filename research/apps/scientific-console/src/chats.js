/**
 * Browser-side chat history and research notebook.
 *
 * Chats keep the server conversation id, the chosen model and Deep Research setting, and the
 * displayed messages. The server forgets a conversation after one hour; an old chat stays
 * readable and continues as a new server conversation. Storage can be unavailable (private
 * tabs, quota): everything keeps working in memory.
 */
const CHATS_KEY = 'flame-research-chats-v1';
const NOTEBOOK_KEY = 'flame-research-notebook-v1';
const MAX_CHATS = 20;
const MAX_MESSAGES = 24;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

export function newChat({ model = null, deep = false } = {}) {
  const now = Date.now();
  return { key: uid(), id: null, title: '', model, deep, messages: [], createdAt: now, updatedAt: now };
}
export const promptCount = (chat) => chat.messages.filter((m) => m.role === 'user').length;
export const chatTitle = (chat) => chat.title || chat.messages.find((m) => m.role === 'user')?.text || 'New conversation';

/** Keep what the conversation view needs; drop bulky passage text from stored answers. */
function slim(message) {
  if (!message.body) return message;
  const b = message.body;
  return { ...message, body: { ...b,
    citations: b.citations.map((c) => ({ ...c, text: undefined, supports: undefined })),
    groups: Object.fromEntries(Object.entries(b.groups).map(([k, v]) => [k, v.slice(0, 4)])) } };
}

export function loadChats() {
  const saved = read(CHATS_KEY);
  let chats = Array.isArray(saved?.chats) ? saved.chats.filter((c) => c && Array.isArray(c.messages)) : [];
  if (!chats.length) {
    // The console used to keep one session in sessionStorage; carry it over once.
    let legacy = null;
    try { legacy = JSON.parse(sessionStorage.getItem('flame-research-session')); } catch { /* none */ }
    const chat = newChat();
    if (legacy && Array.isArray(legacy.messages)) Object.assign(chat, { id: legacy.id || null, messages: legacy.messages });
    chats = [chat];
  }
  const active = chats.find((c) => c.key === saved?.active) || chats[0];
  return { chats, active };
}

export function saveChats(chats, active) {
  const kept = chats.filter((c) => c === active || c.messages.length).slice(0, MAX_CHATS)
    .map((c) => ({ ...c, messages: c.messages.slice(-MAX_MESSAGES).map(slim) }));
  if (!write(CHATS_KEY, { active: active.key, chats: kept })) {
    // Over quota: keep the active chat only.
    write(CHATS_KEY, { active: active.key, chats: kept.filter((c) => c.key === active.key) });
  }
}

export function loadNotebook() {
  const saved = read(NOTEBOOK_KEY);
  return Array.isArray(saved) ? saved : [];
}
export function saveNotebook(items) { return write(NOTEBOOK_KEY, items); }

/** A notebook entry: the question, the verified answer and its source references. */
export function notebookEntry(question, body, chat) {
  return {
    id: uid(), savedAt: Date.now(), question, answer: body.answer, interpretation: body.interpretation?.text || null,
    model: body.generatedBy || null, deep: !!chat?.deep, verified: body.verified || null,
    citations: body.citations.map((c) => ({ number: c.number, evidence_id: c.evidence_id,
      title: c.source?.title || c.document_id, source_type: c.source?.source_type, page: c.page,
      url: c.source?.url, nasa_id: c.source?.nasa_id })),
  };
}

export function notebookMarkdown(items) {
  const lines = ['# Flame in Freefall — Research notebook', '',
    `Exported ${new Date().toISOString().slice(0, 10)}. Every answer was checked against the cited NASA sources; scientists make new inferences.`, ''];
  for (const item of items) {
    lines.push(`## ${item.question}`, '');
    lines.push(`*${new Date(item.savedAt).toLocaleString()}${item.model ? ' · ' + item.model : ''}${item.deep ? ' · Deep research' : ''}*`, '');
    if (item.interpretation) lines.push(item.interpretation, '', '*Assistant interpretation of the verified sources; not a NASA finding.*', '', '**Verified evidence**', '');
    lines.push(item.answer, '', '**Sources**', '');
    for (const c of item.citations) {
      const where = [c.source_type, c.nasa_id, c.page ? 'PDF page ' + c.page : ''].filter(Boolean).join(' · ');
      lines.push(`${c.number}. ${c.title}${where ? ' — ' + where : ''}${c.url ? ' <' + c.url + '>' : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
