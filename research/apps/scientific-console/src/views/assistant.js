import { esc, icon, badge, empty, resultCards } from '../ui.js';
import { chatTitle, promptCount } from '../chats.js';
import examplePrompts from '../prompts.json';
import { chatView } from '../api.js';

// Deep research asks the same engine for more searches and more evidence; verification is unchanged.
const DEEP = { detail: 'technical', max_queries: 6, evidence_limit: 24, max_output_tokens: 6000 };
const STANDARD = { max_queries: 2, evidence_limit: 12, max_output_tokens: 3000 };

// Conversation history, newest first, grouped the way chat apps do.
function dayGroup(time) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const days = Math.floor((start - time) / 86400000) + (time >= start.getTime() ? 0 : 1);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days <= 7 ? 'Previous 7 days' : 'Older';
}
function historyItemHTML(c, active) {
  const n = promptCount(c);
  const model = c.modelLabel || [...c.messages].reverse().find(m => m.body?.generatedBy)?.body.generatedBy;
  return `<li class="history-item${active ? ' active' : ''}"><button class="history-open" data-chat="${esc(c.key)}" ${active ? 'aria-current="true"' : ''} title="${esc(chatTitle(c))}"><span class="history-title">${esc(chatTitle(c))}</span><span class="history-meta">${c.deep ? '<span class="history-deep">DEEP</span>' : ''}<span>${n} prompt${n === 1 ? '' : 's'}</span>${model ? `<span class="history-model">${esc(model)}</span>` : ''}</span></button><button class="history-del" data-chat-del="${esc(c.key)}" aria-label="Delete conversation" title="Delete conversation">${icon('trash')}</button></li>`;
}
function historyHTML(state, filter = '') {
  const q = filter.trim().toLowerCase();
  const chats = state.chats
    .filter(c => c.messages.length || c === state.session)
    .filter(c => !q || chatTitle(c).toLowerCase().includes(q))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const groups = new Map();
  for (const c of chats) {
    const g = c.messages.length ? dayGroup(c.updatedAt || c.createdAt || Date.now()) : 'Today';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  const order = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];
  return chats.length ? order.filter(g => groups.has(g)).map(g => `<section class="history-group"><h3>${g}</h3><ul>${groups.get(g).map(c => historyItemHTML(c, c === state.session)).join('')}</ul></section>`).join('')
    : `<p class="history-empty">${q ? 'No conversation matches.' : 'Your conversations will appear here.'}</p>`;
}
function historyPanelHTML(state) {
  return `<aside class="chat-history" aria-label="Conversation history"><div class="history-head"><span class="eyebrow">CONVERSATIONS</span><button class="button secondary history-new" data-chat-new>${icon('plus')} New chat</button><label class="history-search"><span class="sr-only">Search conversations</span>${icon('search')}<input type="search" id="history-search" placeholder="Search conversations"></label></div><div class="history-list" id="history-list">${historyHTML(state)}</div></aside>`;
}

// Sources the engine has retrieved so far, while it still verifies the answer.
function previewHTML(titles) {
  if (!Array.isArray(titles) || !titles.length) return '';
  return `<div class="loading-sources"><span class="eyebrow">SOURCES FOUND SO FAR · BEING CHECKED</span><ul>${titles.slice(0, 6).map(t => `<li>${icon('evidence')}<span>${esc(String(t).replace(/^ntrs-(\d+)$/i, 'NASA technical report $1'))}</span></li>`).join('')}</ul></div>`;
}

// Answers prepared earlier for the example questions (scripts/precompute_demo_answers.py): same
// engine and verification, shown instantly. Only for the first question of a chat, without Deep
// research and with the model they were prepared with.
let preparedPromise = null;
const loadPrepared = () => preparedPromise ||= fetch(`${import.meta.env.BASE_URL}data/demo-answers.json`).then(r => r.ok ? r.json() : null).catch(() => null);
async function preparedAnswer(question, session) {
  if (session.deep || session.messages.filter(m => m.role === 'user').length > 1) return null;
  const data = await loadPrepared();
  const entry = data?.answers?.[question.trim()];
  if (!entry || (session.model && entry.model && session.model !== entry.model)) return null;
  try { return { body: chatView(entry.result), generatedAt: data.generated_at }; } catch { return null; }
}

function metaHTML(message) {
  const b = message.body;
  if (!b.generatedBy && !message.deep && !message.prepared) return '';
  const v = b.verified;
  return `<div class="answer-meta">${b.generatedBy ? `<span>${icon('model')} ${esc(b.generatedBy)}</span>` : ''}${v ? `<span title="Each generated statement is located in its source and checked by the independent verifier">${icon('check')} ${v.retained} statement${v.retained === 1 ? '' : 's'} verified${v.rejected ? ` · ${v.rejected} rejected` : ''}</span>` : ''}${message.deep ? '<span class="deep-tag">DEEP RESEARCH</span>' : ''}${message.prepared ? `<span class="prepared-tag" title="Prepared in advance with the same engine and verification, so it appears instantly">PREPARED ANSWER · ${esc(String(message.prepared).slice(0, 10))}</span>` : ''}</div>`;
}

// Example questions; scripts/precompute_demo_answers.py prepares their answers from this list.
const prompts = examplePrompts;
// Light Markdown for the conversational layer only: **bold**, *italic* and "- " lists, after escaping.
function inlineMarkdown(html) {
  return html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>');
}
function answerHTML(answer, citations, { markdown = false } = {}) {
  // Representation-only backend wording is not researcher-facing product copy.
  return answer.split('\n\n').map(p => {
    p=p.replace(/^The engine retains (.+?) as a (configuration summary|session summary);/, 'Source scope: $1 is a $2;');
    let html = esc(p);
    html = html.replace(/\[(\d+)\]/g, (match,n) => { const c=citations.find(c => c.number===Number(n)); return c ? `<button class="citation" data-evidence="${esc(c.evidence_id)}" aria-label="Open source ${n}">${n}</button>` : match; });
    if (markdown) {
      html = inlineMarkdown(html);
      const lines = html.split('\n');
      if (lines.length > 1 && lines.every(l => /^\s*[-•]\s+/.test(l))) return `<ul>${lines.map(l => `<li>${l.replace(/^\s*[-•]\s+/, '')}</li>`).join('')}</ul>`;
    }
    return `<p>${html.replaceAll('\n','<br>')}</p>`;
  }).join('');
}
function messageHTML(message, index) {
  if (message.role === 'user') return `<article class="user-message"><div class="user-bubble"><span class="sr-only">Your question: </span><p>${esc(message.text)}</p></div></article>`;
  const body=message.body;
  if (!body) return `<article class="assistant-message"><span class="answer-mark" aria-hidden="true">${icon('orbit')}</span><div class="assistant-bubble"><div class="error-state" role="alert"><p>${esc(message.text)}</p></div></div></article>`;
  const records = [...body.groups.direct,...body.groups.related].filter(r => r.id);
  const verified = `${body.excerptsOnly ? '<div class="scope-note">Original excerpts are shown where a full explanation is unavailable.</div>' : ''}<div class="answer-prose">${answerHTML(body.answer,body.citations)}</div>`;
  const interp = body.interpretation;
  const v = body.verified;
  const main = interp
    ? `<div class="answer-label"><span class="eyebrow">ASSISTANT</span><span class="interp-note" title="Written by the model from the verified statements below. Sentences that introduced a value or name absent from the sources were removed.">Interpretation of verified sources · not a NASA finding</span></div>${metaHTML(message)}<div class="answer-prose interpretation-prose">${answerHTML(interp.text,body.citations,{markdown:true})}</div>
      <details class="verified-evidence"><summary>${icon('check')} Verified evidence${v ? ` · ${v.retained} statement${v.retained === 1 ? '' : 's'} checked against NASA sources` : ''}</summary>${verified}</details>`
    : `<div class="answer-label"><span class="eyebrow">EVIDENCE-GROUNDED RESPONSE</span></div>${metaHTML(message)}${verified}`;
  return `<article class="assistant-message"><span class="answer-mark" aria-hidden="true">${icon('orbit')}</span><div class="assistant-bubble">${main}
  <div class="answer-toolbar"><button class="text-button" data-show-sources="${index}">${icon('evidence')} ${body.citations.length} source references</button><button class="text-button" data-save-note="${index}">${icon('bookmark')} Save to notebook</button>${records[0] ? `<button class="text-button" data-entity="${esc(records[0].id)}">Open research record ${icon('arrow')}</button><button class="text-button" data-compare-record="${esc(records[0].id)}">Compare record ${icon('compare')}</button>` : ''}</div>
  <div class="answer-sources" id="sources-${index}" hidden>${body.citations.map(c=>`<button class="source-reference" data-evidence="${esc(c.evidence_id)}"><span class="source-number">${c.number}</span><span><strong>${esc(c.source?.title || c.document_id)}</strong><small>${esc(c.source?.source_type || 'Registered source')}${c.page ? ' · PDF page '+c.page : ''}</small></span>${icon('chevron')}</button>`).join('')}</div>
  <details class="evidence-details"><summary>Explore the retrieved evidence</summary>${resultCards(body.groups,4) || '<p>No additional evidence groups were returned.</p>'}</details>
  ${body.suggestions.filter(s=>s.query || s.question).length ? `<div class="followups"><span class="eyebrow">NEXT RESEARCH PATHS</span>${body.suggestions.filter(s=>s.query || s.question).slice(0,3).map(s=>`<button data-ask="${esc(s.query || s.question)}">${badge('EXPLORATORY')}<span>${esc(s.query || s.question)}</span>${icon('arrow')}</button>`).join('')}</div>` : ''}</div></article>`;
}
export async function renderAssistant(ctx) {
  const session=ctx.state.session;
  const active=session.messages.length>0;
  ctx.view(`<div class="assistant-shell"><div class="assistant-layout ${active ? 'has-conversation' : ''}"><div class="conversation" id="conversation" aria-live="polite">
  ${active ? session.messages.map(messageHTML).join('') : `<section class="assistant-welcome"><div class="orbital-art" aria-hidden="true"><i></i><i></i><i></i><span></span></div><span class="eyebrow orange">MICROGRAVITY COMBUSTION · SCIENTIFIC RESEARCH</span><h1>A better question.<br><span>A clearer understanding.</span></h1><p>Explore what the research actually shows. Ask a question, follow the experimental context, and trace every finding back to its source.</p><div class="welcome-tags"><span>${icon('check')} Original NASA sources</span><span>${icon('discover')} Connected scientific knowledge</span></div></section><div class="prompt-grid">${prompts.map(p=>`<button class="prompt-card" data-ask="${esc(p.text)}"><span class="prompt-icon">${icon(p.icon)}</span><span class="eyebrow">${p.tag}</span><strong>${p.title}</strong><span class="prompt-description">${esc(p.text)}</span>${icon('arrow','prompt-arrow')}</button>`).join('')}</div>`}
  ${ctx.state.chatBusy ? `<div class="chat-loading" role="status"><span class="loader"></span><div><strong id="chat-progress">${esc(ctx.state.chatProgress || "Preparing your question")}</strong><p>Source context can take a few minutes to review. You can browse while this continues.</p><div id="chat-preview">${previewHTML(ctx.state.chatPreview)}</div></div><button class="text-button" id="stop-waiting">Cancel question</button></div>` : ''}</div>
  <div class="composer-wrap"><form class="composer" id="question-form"><label for="research-question" class="sr-only">Ask a scientific question</label><textarea id="research-question" name="question" rows="2" maxlength="12000" placeholder="Ask about an experiment, a measurement, or a documented finding…" ${ctx.state.chatBusy ? 'disabled' : ''}></textarea><div class="composer-bottom"><span>${icon('evidence')} Grounded in the research library</span><div><label class="detail-select model-select" title="Model that plans and writes; every statement is still checked against its source"><span class="sr-only">Conversation model</span><select name="model" id="model-select"><option value="">Default model</option></select></label><label class="deep-toggle" title="More searches and more evidence per question, with technical detail. Takes longer."><input type="checkbox" name="deep" id="deep-toggle" ${session.deep ? 'checked' : ''}><span>Deep research</span></label><label class="detail-select" ${session.deep ? 'hidden' : ''}><span class="sr-only">Answer detail</span><select name="detail"><option value="standard">Standard detail</option><option value="concise">Concise</option><option value="technical">Technical detail</option></select></label><button class="send-button" type="submit" aria-label="Send scientific question" ${ctx.state.chatBusy ? 'disabled' : ''}>${icon('arrow')}</button></div></div></form><p class="composer-note">Evidence can be incomplete. Related research is not equivalent evidence. <button class="inline-button" data-classifications>Understand the evidence labels</button></p></div></div>${historyPanelHTML(ctx.state)}</div>`);
  const historyList=ctx.root.querySelector('#history-list');
  historyList.addEventListener('click',e=>{
    const del=e.target.closest('[data-chat-del]');
    if(del){const c=ctx.state.chats.find(c=>c.key===del.dataset.chatDel);if(c && (!c.messages.length || confirm('Delete this conversation?')))ctx.chats.remove(del.dataset.chatDel);return;}
    const open=e.target.closest('[data-chat]');if(open)ctx.chats.switchTo(open.dataset.chat);
  });
  ctx.root.querySelector('#history-search').addEventListener('input',e=>{historyList.innerHTML=historyHTML(ctx.state,e.target.value);});
  ctx.root.querySelector('[data-chat-new]')?.addEventListener('click',()=>ctx.chats.create());
  ctx.root.querySelectorAll('[data-save-note]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.saveNote);const question=session.messages.slice(0,i).reverse().find(m=>m.role==='user')?.text||'';ctx.notebook.add(question,session.messages[i].body);b.disabled=true;b.lastChild.textContent=' Saved';});
  const modelSelect=ctx.root.querySelector('#model-select');
  ctx.models().then(({default:fallback,models})=>{
    if(!ctx.active() || !models.length)return;
    const groups=[...new Set(models.map(m=>m.provider))];
    modelSelect.innerHTML=groups.map(g=>`<optgroup label="${esc(g)}">${models.filter(m=>m.provider===g).map(m=>`<option value="${esc(m.id)}" title="${esc(m.note||'')}">${esc(m.label)}${m.id===fallback?' · default':''}</option>`).join('')}</optgroup>`).join('');
    if(!models.some(m=>m.id===session.model))session.model=fallback;
    modelSelect.value=session.model||'';
  });
  modelSelect.addEventListener('change',()=>{session.model=modelSelect.value||null;ctx.save();});
  const modelLabel=()=>modelSelect.selectedOptions[0]?.textContent.replace(/ · default$/,'')||null;
  ctx.root.querySelector('#deep-toggle').addEventListener('change',e=>{session.deep=e.target.checked;ctx.save();ctx.root.querySelector('select[name="detail"]').closest('label').hidden=session.deep;});
  const form=ctx.root.querySelector('#question-form');
  form.addEventListener('submit', e=>{e.preventDefault();const f=new FormData(form);send(String(f.get('question')||'').trim(),String(f.get('detail')));});
  ctx.root.querySelector('#research-question').addEventListener('keydown',e=>{if(e.key==='Enter' && !e.shiftKey){e.preventDefault();form.requestSubmit();}});
  ctx.root.querySelectorAll('[data-show-sources]').forEach(button=>button.onclick=()=>{const panel=ctx.root.querySelector('#sources-'+button.dataset.showSources);panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));});
  ctx.root.querySelector('#stop-waiting')?.addEventListener('click',()=>{ctx.state.chatController?.abort();ctx.state.chatController=null;ctx.state.chatBusy=false;ctx.state.chatProgress=null;session.messages.push({role:'assistant',text:'Cancellation requested. The active review will stop at the next safe checkpoint. You can submit a new question now; it may wait in the queue.'});ctx.save();ctx.rerender();});
  if (ctx.state.pendingQuestion && !ctx.state.chatBusy) { const question=ctx.state.pendingQuestion;ctx.state.pendingQuestion='';send(question,'standard'); }
  async function send(question,detail) {
    if (!question || ctx.state.chatBusy) return;
    session.messages.push({role:'user',text:question});ctx.state.chatBusy=true;
    if(modelSelect.value)session.modelLabel=modelLabel();
    const controller=new AbortController();ctx.state.chatController=controller;
    ctx.save();ctx.rerender();
    try {
      const ready=await preparedAnswer(question,session);
      if(ready && ctx.state.chatController===controller && ctx.state.session===session){session.messages.push({role:'assistant',body:ready.body,deep:false,prepared:ready.generatedAt||true});if(ready.body.generatedBy)session.modelLabel=ready.body.generatedBy;return;}
      const deep=!!session.deep;
      const options=deep ? DEEP : {detail,...STANDARD};
      const result=await (ctx.chatAPI || ctx.api).chat({message:question,...options,...(session.model ? {model:session.model} : {}),...(session.id ? {conversation_id:session.id} : {})},controller.signal,progress=>{
        if(ctx.state.chatController!==controller)return;
        const labels={retrieval:'Finding source evidence',generation:'Preparing a source-backed explanation',verification:'Checking statements against their sources',context:'Reviewing experimental context',publishing:'Finalizing the response',interpretation:'Writing a conversational answer from the verified sources'};
        ctx.state.chatProgress=progress.status==='queued' ? 'Question queued · position '+progress.queue_position : progress.status==='cancellation_requested' ? 'Cancellation pending · finishing the current review stage' : labels[progress.stage] || 'Consulting the scientific evidence';
        const node=ctx.root.querySelector('#chat-progress');if(node && ctx.state.session===session)node.textContent=ctx.state.chatProgress;
        if(Array.isArray(progress.preview) && progress.preview.length){ctx.state.chatPreview=progress.preview;const box=ctx.root.querySelector('#chat-preview');if(box && ctx.state.session===session)box.innerHTML=previewHTML(progress.preview);}
      });
      if(controller.signal.aborted || ctx.state.chatController!==controller || ctx.state.session!==session)return;
      session.id=result.conversationId;session.messages.push({role:'assistant',body:result,deep});
      if(result.generatedBy)session.modelLabel=result.generatedBy;
    } catch(error) {
      if(ctx.state.chatController!==controller || ctx.state.session!==session)return;
      if (error.name==='AbortError') session.messages.push({role:'assistant',text:'Cancellation requested. The review stops at the next safe checkpoint. New questions can wait in the queue.'});
      else { if(error.status===404) session.id=null;session.messages.push({role:'assistant',text:error.message}); }
    } finally { if(ctx.state.chatController===controller){ctx.state.chatBusy=false;ctx.state.chatController=null;ctx.state.chatProgress=null;ctx.state.chatPreview=null;ctx.save();if(ctx.state.routeKey.startsWith("assistant?"))ctx.rerender();} }
  }
  if(active) {
    const focus=ctx.state.chatBusy ? ctx.root.querySelector('.chat-loading') : [...ctx.root.querySelectorAll('.assistant-message')].at(-1);
    (focus || ctx.root.querySelector('.composer-wrap'))?.scrollIntoView({block:'start',behavior:'instant'});
  }
}
