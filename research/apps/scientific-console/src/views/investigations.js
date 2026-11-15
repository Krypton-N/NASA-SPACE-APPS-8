import { esc, human, icon, badge, loading, empty, errorState, pageHeading, option, evidenceButton, fieldLabel, fieldValue, fieldRole, recordLabel } from '../ui.js';
import { measurementGroups, measurementChart } from '../visualizations.js';
import { groupInvestigations, placeOf, shortTitle } from '../library.js';

const sectionNames={hasObjective:'Study objectives',hasHypothesis:'Documented research hypotheses',hasDocumentedMethod:'Methods and experimental scope',usesApparatus:'Apparatus',usesInstrument:'Diagnostic instruments',hasReportedFinding:'Source-reported findings',hasDocumentation:'Source documentation',hasPublicationReference:'Publication references'};
const heading=()=>pageHeading('RESEARCH LIBRARY','Investigations','Browse the PSI investigations by combustion family. Open one to read its source records, values and documentation.');
const materialsOf=p=>[...new Set([...(p.features?.hasMaterial || []),...(p.features?.hasMaterialDescription || [])].map(m=>String(m.title).trim()))];

/* ---------------- library tree (left) ---------------- */
function itemHTML(s, selected) {
  const docsOnly=!s.record_count;
  const haystack=[s.id,s.title,placeOf(s.id).program?.label,placeOf(s.id).family?.label,...materialsOf(s)].join(' ').toLowerCase();
  return `<li><a class="library-item investigation-card${s.id===selected ? ' active' : ''}${docsOnly ? ' docs-only' : ''}" href="#/investigations?id=${encodeURIComponent(s.id)}" ${s.id===selected ? 'aria-current="page"' : ''} data-search="${esc(haystack)}" title="${esc(s.title)}"><span class="item-id mono">${esc(s.id.toUpperCase())}</span><span class="item-title">${esc(shortTitle(s.title))}</span><span class="item-count" title="${docsOnly ? 'Documentation only: no source records are registered' : esc(s.record_count+' source records · '+s.measurement_count+' indexed measurements')}">${docsOnly ? 'docs' : s.record_count}</span></a></li>`;
}
function treeHTML(items, collapsed, selected) {
  return `<nav class="library-tree" aria-label="Investigations by family">${groupInvestigations(items).map(g=>{
    const open=!collapsed.has(g.family.key);
    return `<section class="tree-family" data-family="${g.family.key}"><button type="button" class="tree-toggle" data-toggle-family="${g.family.key}" aria-expanded="${open}">${icon('chevron')}<span>${esc(g.family.label)}</span><small>${g.count}</small></button><div class="tree-branch" ${open ? '' : 'hidden'}>${g.programs.map(p=>`<div class="tree-program"><span class="tree-program-label">${esc(p.program.label)}</span><ul>${p.items.map(s=>itemHTML(s,selected)).join('')}</ul></div>`).join('')}</div></section>`;
  }).join('')}<p class="tree-nomatch small muted" hidden>No investigation in this list matches. Press Enter to search the whole library.</p></nav>`;
}
function filtersHTML(overview, filters) {
  const materials=[...(overview.facets.hasMaterial || []),...(overview.facets.hasMaterialDescription || [])];
  const facets=key=>overview.facets[key] || [];
  const active=['material','record_class','instrument','method','property_id'].filter(k=>filters[k]).length+(filters.measurements ? 1 : 0);
  return `<form class="library-filters" id="study-filters"><div class="library-search"><label class="search-field">${icon('search')}<input name="query" aria-label="Search investigations" placeholder="Search name, acronym or PSI id" value="${esc(filters.query || '')}" autocomplete="off"></label><button class="icon-button" type="submit" aria-label="Apply filters" title="Search the library (Enter)">${icon('arrow')}</button></div>
  <details class="library-more" ${active ? 'open' : ''}><summary>${icon('filter')} Filters${active ? `<span class="filter-count">${active}</span>` : ''}</summary><div class="filter-stack">
  <label>Fuel or material wording<select name="material">${option('','All documented materials')}${materials.map(m=>option(m.id,m.title,filters.material)).join('')}</select></label>
  <label>Record type<select name="record_class">${option('','All record types')}${overview.record_classes.map(c=>option(c,human(c),filters.record_class)).join('')}</select></label>
  <label>Instrument<select name="instrument">${option('','All registered instruments')}${facets('usesInstrument').map(m=>option(m.id,m.title,filters.instrument)).join('')}</select></label>
  <label>Documented method<select name="method">${option('','All documented methods')}${facets('hasDocumentedMethod').map(m=>option(m.id,m.title,filters.method)).join('')}</select></label>
  <label>Available property<select name="property_id">${option('','Any available property')}${overview.properties.map(p=>option(p.id,human(p.label),filters.property_id)).join('')}</select></label>
  <label class="checkbox-label"><input type="checkbox" name="measurements" ${filters.measurements ? 'checked' : ''}> Has recorded measurements</label>
  <div class="filter-actions"><button class="button primary" type="submit">Apply</button><button class="text-button" type="button" id="clear-study-filters">Reset filters</button></div>
  <p class="small muted">Filters describe available source records. Matching material wording does not establish equivalent composition or experimental conditions.</p></div></details></form>`;
}

/* ---------------- library home (right, nothing selected) ---------------- */
function homeHTML(overview, items) {
  const groups=groupInvestigations(items);
  const kpis=[[overview.investigations,'investigations'],[overview.source_records,'source records'],[overview.measurements,'indexed measurements'],[overview.registered_sources,'registered sources']];
  return `<div class="library-home"><div class="kpi-strip">${kpis.map(([n,label])=>`<div class="kpi"><strong>${Number(n).toLocaleString('en-US')}</strong><span>${label}</span></div>`).join('')}</div>
  <div class="section-heading"><h2>Browse by family</h2><span class="small muted">Select an investigation on the left to open it</span></div>
  <div class="family-grid">${groups.map(g=>{const records=g.programs.flatMap(p=>p.items).reduce((n,s)=>n+s.record_count,0);return `<button class="family-card" data-focus-family="${g.family.key}"><span class="family-name">${esc(g.family.label)}</span><span class="family-blurb">${esc(g.family.blurb || '')}</span><span class="family-stats"><span><strong>${g.count}</strong> investigations</span><span><strong>${records.toLocaleString('en-US')}</strong> records</span></span><span class="family-programs">${g.programs.map(p=>`<span class="chip">${esc(p.program.label)}<small>${p.items.length}</small></span>`).join('')}</span></button>`;}).join('')}</div>
  <p class="small muted library-scope">${esc(overview.scope || 'Counts describe this registered library, not all NASA research.')}</p></div>`;
}

export async function renderInvestigations(ctx) {
  const selected=ctx.params.id || '';
  ctx.view(heading()+loading());
  try {
    const overview=await ctx.overview();if(!ctx.active())return;
    const filters=ctx.state.investigationFilters || {};
    const collapsed=ctx.state.libraryCollapsed || (ctx.state.libraryCollapsed=new Set());
    ctx.view(heading()+`<div class="library-layout"><aside class="library-nav panel" aria-label="Investigation library">${filtersHTML(overview,filters)}<p class="library-count mono" id="library-count"></p><div class="library-scroll" id="investigation-results">${loading('Finding investigations…')}</div></aside><section class="library-main" id="library-main">${loading()}</section></div>`);
    const form=ctx.root.querySelector('#study-filters');
    const results=ctx.root.querySelector('#investigation-results');
    const search=form.querySelector('input[name="query"]');
    let items=[];
    form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);ctx.state.investigationFilters=Object.fromEntries(f);ctx.state.investigationFilters.measurements=f.has('measurements');load();};
    form.querySelector('#clear-study-filters').onclick=()=>{ctx.state.investigationFilters={};ctx.state.libraryCache=null;ctx.rerender();};
    // Typing narrows the visible tree at once; Enter or "Apply" asks the server (acronyms, materials…).
    function narrow() {
      const q=search.value.trim().toLowerCase();let visible=0;
      results.querySelectorAll('.library-item').forEach(a=>{const show=!q || a.dataset.search.includes(q);a.parentElement.hidden=!show;if(show)visible++;});
      results.querySelectorAll('.tree-program').forEach(p=>p.hidden=![...p.querySelectorAll('li')].some(li=>!li.hidden));
      results.querySelectorAll('.tree-family').forEach(f=>{f.hidden=![...f.querySelectorAll('.tree-program')].some(p=>!p.hidden);if(q && !f.hidden){f.querySelector('.tree-branch').hidden=false;f.querySelector('.tree-toggle').setAttribute('aria-expanded','true');}});
      const none=results.querySelector('.tree-nomatch');if(none)none.hidden=visible>0;
    }
    search.addEventListener('input',narrow);
    results.addEventListener('click',e=>{
      const toggle=e.target.closest('[data-toggle-family]');if(!toggle)return;
      const key=toggle.dataset.toggleFamily;const open=toggle.getAttribute('aria-expanded')!=='true';
      toggle.setAttribute('aria-expanded',String(open));toggle.nextElementSibling.hidden=!open;open?collapsed.delete(key):collapsed.add(key);
    });
    results.addEventListener('scroll',()=>{ctx.state.libraryScroll=results.scrollTop;},{passive:true});
    function paint(result) {
      items=result.items;
      const filtered=Object.entries(ctx.state.investigationFilters || {}).some(([k,v])=>v && k!=='query') || !!(ctx.state.investigationFilters || {}).query;
      ctx.root.querySelector('#library-count').textContent=`${result.total} investigation${result.total===1 ? '' : 's'}${filtered ? ' match your filters' : ' in the library'}`;
      results.innerHTML=items.length ? treeHTML(items,collapsed,selected) : empty('No investigations match these filters','Try a different material description or remove a constraint. This result describes this library only.');
      if(ctx.state.libraryScroll!=null)results.scrollTop=ctx.state.libraryScroll;
      else{const active=results.querySelector('.library-item.active');if(active)results.scrollTop=active.offsetTop-results.clientHeight/3;}
      narrow();
    }
    async function load() {
      const query={...(ctx.state.investigationFilters || {}),offset:0,limit:100};const key=JSON.stringify(query);
      if(ctx.state.libraryCache?.key===key){paint(ctx.state.libraryCache.result);return;}
      const fresh=ctx.latest('load');results.innerHTML=loading('Finding investigations…');
      try { const result=await fresh.api.investigations(query);if(!ctx.active() || !fresh())return;ctx.state.libraryCache={key,result};ctx.state.libraryScroll=null;paint(result); }
      catch(e) { if(ctx.active() && fresh()){results.innerHTML=errorState(e);results.querySelector('[data-retry]').onclick=()=>load();} }
    }
    await load();if(!ctx.active())return;
    const main=ctx.root.querySelector('#library-main');
    if(selected) return renderDetail(ctx,selected,main);
    main.innerHTML=homeHTML(overview,items);
    main.querySelectorAll('[data-focus-family]').forEach(b=>b.onclick=()=>{
      const family=results.querySelector(`[data-family="${b.dataset.focusFamily}"]`);if(!family)return;
      const toggle=family.querySelector('.tree-toggle');if(toggle.getAttribute('aria-expanded')!=='true')toggle.click();
      results.scrollTop=family.offsetTop;family.querySelector('.library-item')?.focus();
    });
  }catch(e){ctx.view(errorState(e));}
}

/* ---------------- source records ---------------- */
const KEY_FIELD=/oxygen|^o |o2|pressure|diameter|flow|velocity|temperature|thickness|width|length|fuel|sample/i;
function shortLabel(f) { const label=fieldLabel(f).split(';')[0].trim(); return label.length>30 ? label.slice(0,28)+'…' : label; }
function keyFields(r) {
  return (r.fields || []).filter(f=>{const v=fieldValue(f);return v!=='Not recorded' && KEY_FIELD.test(fieldLabel(f)) && !/identifier|date|gmt|time of|#/i.test(fieldLabel(f));}).slice(0,3);
}
function outcomeOf(r) { const f=(r.fields || []).find(f=>/test end|outcome|result|extinguish/i.test(fieldLabel(f)));return f ? fieldValue(f) : ''; }
// `labAccession`: when the host has a 3D lab that can replay this campaign's tests (FLEX droplets).
export function recordsHTML(records, selected='', labAccession='') {
  return `<div class="records-head" aria-hidden="true"><span>Record</span><span>Material</span><span>Key values</span><span>Outcome</span><span></span></div>`+records.map(r=>{
    const id=r.record?.reported_identifier || recordLabel(r).split(' · ')[0];const end=outcomeOf(r);
    const lab=labAccession && r.record?.reported_identifier ? `test/${labAccession}:${r.record.reported_identifier}` : '';
    return `<details class="record-card" ${selected && r.record?.reported_identifier===selected ? 'open' : ''}><summary><span class="rec-id"><strong class="mono">${esc(id)}</strong><small>${esc(human(r.classes[0] || 'Source record'))}</small></span><span class="rec-material">${esc(r.record?.reported_material_description || 'Not recorded')}</span><span class="rec-keys">${keyFields(r).map(f=>`<span class="kv"><small>${esc(shortLabel(f))}</small> ${esc(fieldValue(f))}</span>`).join('')}</span><span class="rec-end">${end ? `<span class="chip">${esc(end)}</span>` : ''}${lab ? `<button class="rec-3d" data-go="lab3d" data-sub="${esc(lab)}" title="Replay this test in the 3D lab" aria-label="Replay ${esc(id)} in the 3D lab">${icon('lab3d')}</button>` : ''}</span>${icon('chevron')}</summary><div class="record-body"><p class="small mono muted">${esc(recordLabel(r))}</p><p class="small mono muted">${esc(r.id)}${r.evidence?.[0]?.structured_location?.row_ordinal ? " · Source row "+r.evidence[0].structured_location.row_ordinal : ""}</p><p class="scope-note">${r.classes.includes('ExperimentalSession') ? 'A session entry can include multiple ignitions. These fields do not reconstruct individual runs.' : r.classes.includes('ConfigurationSummary') ? 'A summary of configuration alternatives. These entries do not enumerate actual runs.' : 'Values belong to this source record. Repeated labels do not reconcile physical identities across documents.'}</p><div class="table-scroll"><table class="data-table"><thead><tr><th>Source field</th><th>Original value</th><th>Reported unit</th><th>Scientific role</th><th>Source</th></tr></thead><tbody>${r.fields.map(f=>`<tr><td>${esc(fieldLabel(f))}</td><td class="mono">${esc(fieldValue(f))}</td><td class="mono muted">${esc(f.value?.reported_unit || 'Not stated')}</td><td>${esc(fieldRole(f))}</td><td>${evidenceButton(f.evidence_ids?.[0],'View')}</td></tr>`).join('')}</tbody></table></div><div class="card-actions">${lab ? `<button class="button primary" data-go="lab3d" data-sub="${esc(lab)}">${icon('lab3d')} Replay in 3D lab</button>` : ''}${evidenceButton(r.evidence?.[0]?.evidence_id,'Original record')}<button class="text-button" data-compare-record="${esc(r.id)}">Compare record ${icon('compare')}</button><button class="text-button" data-ask="${esc('Explain the source-backed fields and limitations of source record '+r.id+'.')}">Ask about this record ${icon('assistant')}</button></div></div></details>`;
  }).join('');
}

/* ---------------- investigation detail (right) ---------------- */
function sectionHTML(section) {
  return `<section class="doc-section"><div class="section-heading"><h3>${esc(sectionNames[section.relation] || human(section.relation))} <small class="muted mono">${section.items.length}</small></h3>${badge(section.relation==='hasPublicationReference' ? 'DISCOVERY' : 'DOCUMENTARY')}</div>${section.items.map(item=>`<details class="documentary-item"><summary>${esc(item.title || human(item.classes[0]))}</summary>${item.text ? `<blockquote>${esc(item.text)}</blockquote>` : ''}${item.instrument_attributes ? `<dl class="attribute-list">${Object.entries(item.instrument_attributes).map(([k,v])=>`<div><dt>${esc(human(k))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}${item.instruments?.map(i=>`<div class="instrument-item"><strong>${esc(i.title)}</strong><p>${esc(i.text || '')}</p>${evidenceButton(i.evidence_ids[0])}</div>`).join('') || ''}<div class="card-actions">${evidenceButton(item.evidence_ids?.[0])}<button class="text-button" data-entity="${esc(item.id)}">Explore connections ${icon('discover')}</button></div></details>`).join('')}${section.total>section.items.length ? '<p class="small muted">Additional entries are available through the relationship explorer.</p>' : ''}</section>`;
}
async function renderDetail(ctx,id,host) {
  host.innerHTML=loading('Opening investigation and original records…');
  try {
    const study=await ctx.api.investigation(id);
    if(!ctx.active())return;
    const {family,program,platform}=placeOf(id);
    const primary=study.sections.filter(s=>['hasObjective','hasReportedFinding','hasDocumentedMethod','usesInstrument','usesApparatus','hasHypothesis','hasDocumentation','hasPublicationReference'].includes(s.relation));
    const docCount=primary.reduce((n,s)=>n+s.items.length,0);
    const tabs=[['records','Records & values',study.record_count],['docs','Documentation',docCount],['related','Related',study.related.length]];
    const tab=tabs.some(([k])=>k===ctx.params.tab) ? ctx.params.tab : 'records';
    host.innerHTML=`<header class="study-head"><div class="study-head-main"><div class="study-crumbs"><span class="mono">${esc(study.id.toUpperCase())}</span>${family ? `<span>${esc(family.label)}</span>` : ''}${program ? `<span>${esc(program.label)}</span>` : ''}${platform ? `<span>${esc(platform.label)}</span>` : ''}</div><h2>${esc(study.title)}</h2><div class="study-stats"><span><strong>${study.record_count}</strong> source records</span><span><strong>${study.measurement_count}</strong> indexed measurements</span><span class="info-tip" tabindex="0" title="Measurement counts cover indexed measurements only. Source fields, configuration alternatives and documentary findings can contain additional scientific information.">${icon('info')}<span class="sr-only">About these counts</span></span></div></div>
    <div class="study-head-actions"><button class="button secondary" data-compare-study="${esc(id)}">${icon('compare')} Compare</button><button class="button secondary" data-entity="${esc(id)}">${icon('discover')} Relationships</button><button class="button primary" data-ask="${esc('What does the original documentation report about the objectives, methods, findings and limitations of '+study.title+'?')}">${icon('assistant')} Ask about it</button></div></header>
    <div class="tabs" role="tablist" aria-label="Investigation sections">${tabs.map(([key,label,n])=>`<button role="tab" id="study-tab-${key}" aria-controls="study-panel-${key}" aria-selected="${key===tab}" data-tab="${key}">${label} <small>${n}</small></button>`).join('')}</div>
    <div role="tabpanel" id="study-panel-records" aria-labelledby="study-tab-records" ${tab==='records' ? '' : 'hidden'}>
      <section class="values-panel" id="measurements-panel" hidden><div class="section-heading"><h3>Values in context</h3><label><span class="sr-only">Chart variable</span><select id="chart-variable"></select></label></div><div id="measurement-plot"></div></section>
      <form class="record-lookup" id="record-lookup"><label class="sr-only" for="record-identifier">Printed record identifier</label><input id="record-identifier" name="identifier" placeholder="Find a printed test, run, or session identifier" value="${esc(ctx.params.record || '')}"><button class="button secondary">Find record ${icon('search')}</button><button class="text-button" type="button" id="all-records">Show all</button></form>
      <div id="study-records">${loading('Loading source records…')}</div>
    </div>
    <div role="tabpanel" id="study-panel-docs" aria-labelledby="study-tab-docs" ${tab==='docs' ? '' : 'hidden'}>${primary.map(sectionHTML).join('') || empty('No additional descriptions registered','Original source records remain accessible in Records & values.')}
      <details class="disclosure context-note"><summary>${icon('info')} Keep the context</summary><p class="small">Objectives describe what researchers intended to investigate. Findings describe what the cited sources report.</p><p class="small">Conditions and instruments are not automatically inherited by every run in an investigation.</p>${evidenceButton(study.evidence_ids[0],'Inspect an original source')}</details></div>
    <div role="tabpanel" id="study-panel-related" aria-labelledby="study-tab-related" ${tab==='related' ? '' : 'hidden'}><p class="small muted">Based on shared registered entities. An association is not an equivalent experiment.</p>${study.related.length ? `<div class="related-list">${study.related.map(r=>`<a class="related-study" href="#/investigations?id=${encodeURIComponent(r.id)}">${badge(r.classification)}<strong>${esc(r.title)}</strong><small>${esc(human(r.shared[0]?.relation || 'Registered association'))}</small>${icon('chevron')}</a>`).join('')}</div>` : '<p class="small">No shared registered entity was found in this bounded view. Search the library to discover further candidates.</p>'}<a class="text-button" href="#/discover?entity=${encodeURIComponent(id)}">Open relationship explorer ${icon('arrow')}</a></div>`;
    host.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{
      const key=button.dataset.tab;
      host.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));
      host.querySelectorAll('[role="tabpanel"]').forEach(p=>p.hidden=p.id!=='study-panel-'+key);
      const params=new URLSearchParams({...ctx.params,tab:key});history.replaceState(null,'','#/investigations?'+params);
    });
    async function loadRecords(identifier='',offset=0) {
      const fresh=ctx.latest('loadRecords');
      const target=host.querySelector('#study-records');if(!target)return;target.innerHTML=loading('Loading source records…');
      try { const result=await fresh.api.records({investigation:id, identifier:identifier || undefined,offset,limit:20});if(!ctx.active() || !fresh())return;
        const labAccession=id==='psi-69' && ctx.hasView?.('lab3d') ? 'PSI-69' : '';
        target.innerHTML=result.items.length ? `<div class="records-list">${recordsHTML(result.items,identifier,labAccession)}</div><div class="pagination"><button class="button secondary" id="records-prev" ${offset===0?'disabled':''}>Previous</button><span>${offset+1}–${offset+result.items.length} of ${result.total}</span><button class="button secondary" id="records-next" ${offset+20>=result.total?'disabled':''}>Next</button></div>` : empty('No source records found',identifier ? 'Try the exact identifier printed in the original table, or show all available records.' : 'This investigation has documentary evidence without registered source records in this view.');
        target.querySelector('#records-prev')?.addEventListener('click',()=>loadRecords(identifier,Math.max(0,offset-20)));target.querySelector('#records-next')?.addEventListener('click',()=>loadRecords(identifier,offset+20));
        const groups=measurementGroups(result.items);const panel=host.querySelector('#measurements-panel');panel.hidden=!groups.length;
        const select=host.querySelector('#chart-variable');select.innerHTML=groups.map((g,i)=>option(i,g.label+' · '+g.unit)).join('');
        // open on the most informative variable: a reported measurement with the most distinct values
        const score=g=>(g.role==='Reported measurement' ? 1000 : 0)+new Set(g.points.map(p=>p.value)).size;
        const best=groups.reduce((b,g,i)=>score(g)>score(groups[b]) ? i : b,0);select.value=String(best);
        const plot=host.querySelector('#measurement-plot');plot.innerHTML=groups.length ? measurementChart(groups[best]) : '';select.onchange=()=>plot.innerHTML=measurementChart(groups[Number(select.value)]);
        if(identifier)target.querySelector('details[open]')?.scrollIntoView({block:'nearest'});
      }catch(e){if(ctx.active() && fresh()){target.innerHTML=errorState(e);target.querySelector('[data-retry]').onclick=()=>loadRecords(identifier,offset);}}
    }
    host.querySelector('#record-lookup').onsubmit=e=>{e.preventDefault();loadRecords(String(new FormData(e.target).get('identifier')).trim());};host.querySelector('#all-records').onclick=()=>{host.querySelector('#record-identifier').value='';loadRecords();};
    await loadRecords(ctx.params.record || '');
  }catch(e){host.innerHTML=errorState(e);}
}
