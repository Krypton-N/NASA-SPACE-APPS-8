import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/unbounded/500.css';
import './styles.css';
import { createAPI } from './api.js';
import { esc, icon, human, categories, badge, loading, errorState, evidenceButton, sourceText } from './ui.js';
import { renderAssistant } from './views/assistant.js';
import { renderInvestigations } from './views/investigations.js';
import { renderCompare } from './views/compare.js';
import { renderDiscover } from './views/discover.js';
import { renderEvidence } from './views/evidence.js';
import { renderNotebook } from './views/notebook.js';
import { loadChats, saveChats, newChat, loadNotebook, saveNotebook, notebookEntry } from './chats.js';
import './extensions.css';
import './workspace.css';

const navigation=[['assistant','Research Assistant'],['investigations','Investigations'],['compare','Compare'],['discover','Discover'],['evidence','Evidence'],['notebook','Notebook']];
const renderers={assistant:renderAssistant,investigations:renderInvestigations,compare:renderCompare,discover:renderDiscover,evidence:renderEvidence,notebook:renderNotebook};

/**
 * Mount independently; future dashboard integration can supply its own API base.
 * `sections` adds sidebar groups whose views the host renders itself, outside <main>:
 * [{label, items:[{key, label, icon}]}]. `onExternal(key, params, panel)` is called when one
 * of them opens, and `onExternal(null)` when the console returns to its own views.
 */
export function mountScientificConsole(target,{apiBase=import.meta.env.VITE_API_BASE || '/api/v1',sections=[],onExternal=()=>{}}={}) {
  const external=new Map(sections.flatMap(s=>s.items.map(i=>[i.key,{...i,section:s.label}])));
  const labelOf=name=>external.get(name)?.label || navigation.find(([key])=>key===name)?.[1] || '';
  const sectionsHTML=sections.map(s=>`<div class="sidebar-rule"></div><span class="sidebar-label">${esc(s.label)}</span><nav aria-label="${esc(s.label)}">${s.items.map(i=>`<a class="nav-link" href="#/${i.key}" data-nav="${i.key}" data-label="${esc(i.label)}">${icon(i.icon || i.key)}<span>${esc(i.label)}</span></a>`).join('')}</nav>`).join('');
  // Several browser-kept chats; state.session is the active one (same shape as before plus model/deep).
  const stored=loadChats();
  const state={session:stored.active,chats:stored.chats,notebook:loadNotebook(),chatBusy:false,pendingQuestion:'',menuOpen:false,routeKey:'',compare:{},connected:false};
  const api=createAPI(apiBase);
  const modelsPromise=api.models();
  const chats={
    switchTo(key){const chat=state.chats.find(c=>c.key===key);if(!chat || chat===state.session)return;stopChat();state.session=chat;save();navigate('assistant');},
    create(){stopChat();if(!state.session.messages.length)return navigate('assistant');const chat=newChat({model:state.session?.model||null,deep:false});state.chats.unshift(chat);state.session=chat;save();navigate('assistant');},
    remove(key){const i=state.chats.findIndex(c=>c.key===key);if(i<0)return;if(state.chats[i]===state.session)stopChat();state.chats.splice(i,1);if(!state.chats.length)state.chats.push(newChat());if(!state.chats.includes(state.session))state.session=state.chats[0];save();navigate('assistant');},
  };
  const notebook={
    add(question,body){state.notebook.unshift(notebookEntry(question,body,state.session));saveNotebook(state.notebook);toast('Saved to the research notebook.');},
    remove(id){state.notebook=state.notebook.filter(n=>n.id!==id);saveNotebook(state.notebook);},
    clear(){state.notebook=[];saveNotebook(state.notebook);},
  };
  function stopChat(){state.chatController?.abort();state.chatController=null;state.chatBusy=false;state.chatProgress=null;}
  target.innerHTML=`<button class="nav-overlay" aria-label="Close navigation" hidden></button><aside class="sidebar" id="research-sidebar"><a class="brand" href="#/assistant" aria-label="Flame in Freefall, Research Assistant"><span class="brand-mark">${icon('flame')}</span><span>FLAME IN<br>FREEFALL<small>SCIENTIFIC INTELLIGENCE</small></span></a><button class="icon-button mobile-nav-close" aria-label="Close navigation">${icon('close')}</button><div class="sidebar-rule"></div><span class="sidebar-label">RESEARCH WORKSPACE</span><nav aria-label="Primary research navigation">${navigation.map(([key,label])=>`<a class="nav-link" href="#/${key}" data-nav="${key}" data-label="${label}">${icon(key)}<span>${label}</span>${key==='assistant' ? '<i class="nav-spark" aria-hidden="true"></i>' : ''}</a>`).join('')}</nav><button class="sidebar-new" id="new-conversation" data-label="New conversation">${icon('plus')}<span>New conversation</span></button>${sectionsHTML}</aside><div class="workspace"><header class="topbar"><div><button class="icon-button menu-toggle" id="menu-toggle" aria-label="Open navigation" aria-controls="research-sidebar" aria-expanded="false">${icon('menu')}</button><button class="icon-button sidebar-toggle" id="sidebar-toggle" aria-controls="research-sidebar" aria-expanded="true" aria-label="Collapse sidebar" title="Collapse sidebar (Ctrl+B)">${icon('sidebar')}</button><span class="workspace-label" id="workspace-label">RESEARCH WORKSPACE</span><span class="breadcrumb-divider">/</span><span id="breadcrumb">Research Assistant</span></div><div class="topbar-right"><span class="research-context">MICROGRAVITY · COMBUSTION SCIENCE</span><button class="icon-button" data-classifications aria-label="Understand scientific evidence classifications">${icon('evidence')}</button></div></header><main id="main-content" tabindex="-1"></main><section class="external-panel" id="external-panel" hidden></section><footer class="workspace-footer"><span>FLAME IN FREEFALL <i></i> SCIENTIFIC INTELLIGENCE</span><button class="inline-button" data-about>About this research tool</button></footer></div><aside class="evidence-drawer" id="evidence-drawer" aria-label="Evidence inspector" hidden></aside><div class="toast" role="status" hidden></div>`;
  const root=target.querySelector('main');const drawer=target.querySelector('#evidence-drawer');const panel=target.querySelector('#external-panel');let externalOpen=false;
  let current={name:'assistant',params:{}};let overviewPromise=null;let drawerOrigin=null;let drawerVersion=0;let drawerController=null;
  const save=()=>{state.session.updatedAt=Date.now();saveChats(state.chats,state.session);};
  const navigate=(name,params={})=>{const query=new URLSearchParams(params).toString();const next='#/'+name+(query?'?'+query:'');if(location.hash===next)render();else location.hash=next;};
  const overview=()=>overviewPromise ||= api.overview().catch(e=>{overviewPromise=null;throw e;});
  let renderVersion=0;let viewController=null;
  function render(){
    const version=++renderVersion;viewController?.abort();viewController=new AbortController();
    const route=(location.hash || '#/assistant').slice(2);const [name,query='']=route.split('?');current={name:renderers[name] || external.has(name)?name:'assistant',params:Object.fromEntries(new URLSearchParams(query))};state.routeKey=current.name+'?'+query;
    target.querySelectorAll('[data-nav]').forEach(link=>{const selected=link.dataset.nav===current.name;link.classList.toggle('active',selected);selected?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current');});target.querySelector('#breadcrumb').textContent=labelOf(current.name);
    const ext=external.get(current.name);
    target.dataset.view=current.name;
    target.querySelector('#workspace-label').textContent=ext ? ext.section : 'RESEARCH WORKSPACE';
    target.classList.toggle('external-mode',!!ext);root.hidden=!!ext;panel.hidden=!ext;
    if(ext){externalOpen=true;onExternal(current.name,current.params,panel);return;}
    if(externalOpen){externalOpen=false;onExternal(null,{},panel);}
    const key=state.routeKey;const versions=new Map();const controllers=new Map();const scopeSignal=viewController.signal;
    const ctx={latest:channel=>{controllers.get(channel)?.abort();const controller=new AbortController();controllers.set(channel,controller);const n=(versions.get(channel)||0)+1;versions.set(channel,n);const fresh=()=>versions.get(channel)===n;fresh.api=api.scoped(AbortSignal.any([scopeSignal,controller.signal]));return fresh;},state,api:api.scoped(viewController.signal),chatAPI:api,root,params:current.params,overview,save,navigate,active:()=>version===renderVersion,view:html=>{if(version===renderVersion)root.innerHTML=html;},rerender:()=>{if(current.name===name || !renderers[name])render();},ask:question=>ask(question),evidence:openEvidence,chats,notebook,models:()=>modelsPromise,toast};
    renderers[current.name](ctx).catch(e=>{if(ctx.active())root.innerHTML=errorState(e);});
  }
  function ask(question){if(state.chatBusy){toast('A scientific question is already being reviewed.');return;}state.pendingQuestion=question;navigate('assistant');}
  function toast(text){const node=target.querySelector('.toast');node.textContent=text;node.hidden=false;clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>node.hidden=true,6000);}
  function menu(open){state.menuOpen=open;target.classList.toggle('nav-open',open);target.querySelector('.nav-overlay').hidden=!open;target.querySelector('#menu-toggle').setAttribute('aria-expanded',String(open));updateMenu();if(open)target.querySelector('[aria-current="page"]')?.focus();else target.querySelector('#menu-toggle').focus();}
  // Desktop sidebar can collapse to an icon rail; the choice is remembered in this browser.
  const COLLAPSE_KEY='flame.sidebar.collapsed';
  let collapsed=false;try{collapsed=localStorage.getItem(COLLAPSE_KEY)==='1';}catch{}
  function setCollapsed(on,remember=true){collapsed=on;target.classList.toggle('sidebar-collapsed',on);const b=target.querySelector('#sidebar-toggle');const label=on?'Expand sidebar':'Collapse sidebar';b.setAttribute('aria-expanded',String(!on));b.setAttribute('aria-label',label);b.title=label+' (Ctrl+B)';if(remember)try{localStorage.setItem(COLLAPSE_KEY,on?'1':'0');}catch{}}
  setCollapsed(collapsed,false);
  const mobile=matchMedia('(max-width: 900px)');
  function updateMenu(){target.querySelector('.sidebar').inert=mobile.matches && !state.menuOpen;root.inert=mobile.matches && state.menuOpen;}
  mobile.addEventListener('change',updateMenu);
  function closeEvidence(){drawer.hidden=true;drawerVersion++;drawerController?.abort();drawerOrigin?.focus();}
  async function openEvidence(id){
    drawerOrigin=document.activeElement;const version=++drawerVersion;drawerController?.abort();drawerController=new AbortController();const drawerAPI=api.scoped(drawerController.signal);drawer.hidden=false;drawer.innerHTML=`<div class="drawer-header"><span class="eyebrow">ORIGINAL EVIDENCE</span><button class="icon-button" data-close-evidence aria-label="Close evidence inspector">${icon('close')}</button></div>${loading('Opening the original source record…')}`;drawer.querySelector('button').focus();
    try {
      const evidence=await drawerAPI.evidence(id);const source=evidence.source?.source_id ? await drawerAPI.source(evidence.source.source_id) : evidence.source;
      if(version!==drawerVersion)return;
      const context=state.session.messages.filter(m=>m.body).flatMap(m=>m.body.citations).find(c=>c.evidence_id===id);
      const supports=context?.supports?.filter(s=>s.evidence_id===id && s.support_role!=='section_heading') || [];
      const place=evidence.page ? 'Physical PDF page '+evidence.page : evidence.structured_location?.row_ordinal ? 'Original table record '+evidence.structured_location.row_ordinal : 'Registered source location';
      drawer.innerHTML=`<div class="drawer-header"><span class="eyebrow">ORIGINAL EVIDENCE</span><button class="icon-button" data-close-evidence aria-label="Close evidence inspector">${icon('close')}</button></div><div class="drawer-body">${badge(context?.category || evidence.category)}<h2>${esc(source?.title || evidence.document_id)}</h2><dl class="source-metadata"><div><dt>Source</dt><dd>${esc(source?.source_type || 'Registered source')}</dd></div>${source?.nasa_id ? `<div><dt>Document reference</dt><dd class="mono">${esc(source.nasa_id)}</dd></div>` : ''}<div><dt>Location</dt><dd>${esc(place)}</dd></div></dl>${supports.length ? `<section><span class="eyebrow">CITED PROPOSITIONS & SUPPORT</span>${supports.slice(0,8).map(s=>`<article class="support-proposition"><p>${esc(s.claim_text)}</p><blockquote>${esc(s.passage)}</blockquote></article>`).join('')}</section>` : ''}<section><span class="eyebrow">REGISTERED ORIGINAL EXCERPT</span><blockquote class="original-excerpt">${esc(sourceText(evidence))}</blockquote></section>${evidence.source_cells?.length ? `<section><span class="eyebrow">ORIGINAL TABLE CELLS</span><table><thead><tr><th>Original header</th><th>Original value</th></tr></thead><tbody>${evidence.source_cells.map(c=>`<tr><td>${esc(c.original_header)}</td><td class="mono">${esc(c.original_value === '' ? 'Not recorded' : c.original_value)}</td></tr>`).join('')}</tbody></table></section>` : ''}<div class="drawer-actions">${source?.url ? `<a class="button primary full-width" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Open original source ${icon('external')}</a>` : '<p class="small muted">No original URL is registered for this source.</p>'}<button class="button secondary full-width" data-evidence-query="${esc(source?.nasa_id || source?.title || evidence.document_id)}">Find related source passages ${icon('search')}</button></div><p class="small muted">An excerpt can supply context without establishing every condition in a research question. Inspect its experimental scope before applying a finding.</p></div>`;
      drawer.querySelector('[data-close-evidence]').focus();
    }catch(e){if(version===drawerVersion)drawer.innerHTML=`<div class="drawer-header"><h2>Evidence inspector</h2><button class="icon-button" data-close-evidence aria-label="Close evidence inspector">${icon('close')}</button></div>${errorState(e)}`;}
  }
  function classificationPanel(){drawerOrigin=document.activeElement;drawerVersion++;drawer.hidden=false;drawer.innerHTML=`<div class="drawer-header"><span class="eyebrow">READ THE EVIDENCE</span><button class="icon-button" data-close-evidence aria-label="Close evidence classifications">${icon('close')}</button></div><div class="drawer-body"><h2>Different kinds of evidence.<br>Different scientific meaning.</h2><p>These labels describe how evidence relates to a research question. They are not confidence percentages or fire-safety scores.</p>${Object.entries(categories).map(([key,meaning])=>`<section class="classification-explanation">${badge(key)}<p>${esc(meaning)}</p></section>`).join('')}<p class="scope-note">An information gap in this library is not proof of a NASA knowledge gap. A shared fuel or instrument is not proof of equivalent outcomes.</p></div>`;drawer.querySelector('button').focus();}
  async function openRecord(id,compare=false){
    try{const data=await api.neighbors(id,{limit:20});const owner=data.edges.find(e=>e.relation==='belongsToInvestigation' && e.from===id)?.to;
      if(owner && data.center.reported_identifier){if(compare){state.compare.left=owner;state.compare.leftRecord=id;navigate('compare',{left:owner});}else navigate('investigations',{id:owner,record:data.center.reported_identifier});}
      else navigate('discover',{entity:id});
    }catch(e){toast(e.message);}
  }
  const onClick=e=>{
    const button=e.target.closest('button,a,[data-evidence]');if(!button)return;
    if(button.matches('[data-close-evidence]'))return closeEvidence();
    if(button.matches('[data-classifications]'))return classificationPanel();
    if(button.matches('[data-about]')){classificationPanel();drawer.querySelector('.drawer-body').insertAdjacentHTML('afterbegin','<p>Independent research tool. Not an official NASA service.</p>');return;}
    if(button.matches('[data-evidence]'))return openEvidence(button.dataset.evidence);
    if(button.matches('[data-ask]'))return ask(button.dataset.ask);
    if(button.matches('[data-evidence-query]')){closeEvidence();return navigate('evidence',{query:button.dataset.evidenceQuery});}
    if(button.matches('[data-graph-entity]'))return navigate('discover',{entity:button.dataset.graphEntity});
    if(button.matches('[data-entity]'))return openRecord(button.dataset.entity);
    if(button.matches('[data-compare-record]'))return openRecord(button.dataset.compareRecord,true);
    if(button.matches('[data-compare-study]')){state.compare.left=button.dataset.compareStudy;state.compare.leftRecord=null;return navigate('compare',{left:button.dataset.compareStudy});}
    if(button.matches('[data-retry]') && !button.onclick)return render();
    if(button.matches('#new-conversation'))return chats.create();
    if(button.matches('#menu-toggle'))return menu(!state.menuOpen);
    if(button.matches('#sidebar-toggle'))return setCollapsed(!collapsed);
    if(button.matches('.mobile-nav-close,.nav-overlay'))return menu(false);
    if(button.matches('[data-nav]') && mobile.matches)menu(false);
  };
  const onKey=e=>{if((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase()==='b' && !mobile.matches){e.preventDefault();setCollapsed(!collapsed);return;}if(e.key==='Escape'){if(!drawer.hidden)closeEvidence();else if(state.menuOpen)menu(false);}if(['Enter',' '].includes(e.key) && e.target.matches('g[data-evidence]')){e.preventDefault();openEvidence(e.target.dataset.evidence);}if(e.key==='Tab' && mobile.matches && state.menuOpen){const nodes=[...target.querySelector('.sidebar').querySelectorAll('a,button')].filter(n=>n.offsetParent!==null);if(e.shiftKey && document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey && document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}}};
  const onLeave=()=>state.chatController?.abort();
  window.addEventListener('pagehide',onLeave);
  const onHash=()=>{render();if(!root.hidden)root.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});};
  target.addEventListener('click',onClick);target.addEventListener('keydown',onKey);window.addEventListener('hashchange',onHash);
  updateMenu();render();overview().catch(()=>{});
  return ()=>{state.chatController?.abort();target.removeEventListener('click',onClick);target.removeEventListener('keydown',onKey);window.removeEventListener('hashchange',onHash);window.removeEventListener('pagehide',onLeave);mobile.removeEventListener('change',updateMenu);clearTimeout(state.toastTimer);target.replaceChildren();};
}
