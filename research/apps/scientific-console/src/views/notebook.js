import { esc, icon, empty, pageHeading } from '../ui.js';
import { notebookMarkdown } from '../chats.js';

/** Saved, source-checked answers with their references. Kept in this browser; exportable as Markdown. */
export async function renderNotebook(ctx) {
  const items = ctx.state.notebook;
  const md = (html) => html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>');
  const prose = (text, citations) => text.split('\n\n').map(p => `<p>${md(esc(p)).replace(/\[(\d+)\]/g, (m, n) => {
    const c = citations.find(c => c.number === Number(n));
    return c?.evidence_id ? `<button class="citation" data-evidence="${esc(c.evidence_id)}" aria-label="Open source ${n}">${n}</button>` : m;
  }).replaceAll('\n', '<br>')}</p>`).join('');
  ctx.view(`${pageHeading('RESEARCH NOTEBOOK', 'Notebook', 'Answers you saved from the assistant, each with the NASA sources it was checked against. Stored in this browser.',
    items.length ? `<div class="notebook-actions"><button class="button secondary" data-nb-export>${icon('download')} Export Markdown</button><button class="text-button" data-nb-clear>${icon('trash')} Clear</button></div>` : '')}
  ${items.length ? `<div class="notebook-list">${items.map(item => `<article class="notebook-entry">
    <header><span class="eyebrow">${esc(new Date(item.savedAt).toLocaleString())}${item.model ? ' · ' + esc(item.model) : ''}${item.deep ? ' · DEEP RESEARCH' : ''}</span><h2>${esc(item.question || 'Saved answer')}</h2></header>
    ${item.interpretation ? `<div class="answer-prose interpretation-prose">${prose(item.interpretation, item.citations)}</div><details class="verified-evidence"><summary>${icon('check')} Verified evidence</summary><div class="answer-prose">${prose(item.answer, item.citations)}</div></details>` : `<div class="answer-prose">${prose(item.answer, item.citations)}</div>`}
    <details class="notebook-sources"><summary>${item.citations.length} source references${item.verified ? ` · ${item.verified.retained} statement${item.verified.retained === 1 ? '' : 's'} verified` : ''}</summary><ol>${item.citations.map(c => `<li><button class="text-button" data-evidence="${esc(c.evidence_id)}">${esc(c.title || c.evidence_id)}</button><small>${esc([c.source_type, c.nasa_id, c.page ? 'PDF page ' + c.page : ''].filter(Boolean).join(' · '))}</small></li>`).join('')}</ol></details>
    <div class="card-actions"><button class="text-button" data-ask="${esc(item.question)}">${icon('assistant')} Ask again</button><button class="text-button" data-nb-remove="${esc(item.id)}">${icon('trash')} Remove</button></div>
  </article>`).join('')}</div>` : empty('Nothing saved yet', 'Use “Save to notebook” under an assistant answer to keep it here with its sources.', '<a class="button secondary" href="#/assistant">Open the assistant</a>')}`);
  ctx.root.querySelectorAll('[data-nb-remove]').forEach(b => b.onclick = () => { ctx.notebook.remove(b.dataset.nbRemove); ctx.rerender(); });
  ctx.root.querySelector('[data-nb-clear]')?.addEventListener('click', () => { if (confirm('Remove every saved answer from this notebook?')) { ctx.notebook.clear(); ctx.rerender(); } });
  ctx.root.querySelector('[data-nb-export]')?.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([notebookMarkdown(ctx.state.notebook)], { type: 'text/markdown' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `flame-in-freefall-notebook-${new Date().toISOString().slice(0, 10)}.md` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
