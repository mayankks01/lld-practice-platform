const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
let problems = [], attempts = [], active = null, dirty = false, busy = false, pollTimer, toastTimer, routeToken = 0;
let reviewTab = 'feedback', deferredRoute = false;
const fieldSpecs = [
  ['assumptions', 'Scope & assumptions', 'Required · 30 characters minimum', 'Which requirements are you solving? State your assumptions and boundaries.', 'Example: One parking lot with multiple floors. Pricing uses whole hours; payment processing is outside this design.'],
  ['responsibilities', 'Objects & responsibilities', 'Required · 30 characters minimum', 'Name your objects and the decisions each one owns.', 'ParkingLot: coordinates entry and exit.\nParkingSpot: protects occupancy and vehicle compatibility.\n…'],
  ['relationships', 'Relationships & interfaces', 'Recommended', 'Describe ownership, dependencies, and method contracts.', 'Caller → method(arguments) → result\nWho creates each object? Which dependencies can be replaced?'],
  ['walkthrough', 'Behaviour & edge cases', 'Required · 30 characters minimum', 'Follow an operation through your objects. Include state changes and a failure path.', '1. The caller asks…\n2. The owner validates…\n3. State changes only when…\nIf the operation fails…'],
  ['tradeoffs', 'Decisions & trade-offs', 'Recommended', 'Explain one choice, one alternative, and what would make you change your mind.', 'I chose … because …\nAn alternative is … but …'],
  ['tests', 'How would you test it?', 'Recommended', 'Describe inputs, expected results, and invariants for success and failure.', 'Given …\nWhen …\nThen …'],
  ['code', 'Code or diagram notes', 'Optional · not executed', 'Paste pseudocode, class signatures, or a textual diagram. The current checks use the sections above.', 'class …\n  method(input): result']
];

async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not complete the request.');
  return data;
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000); }
const date = value => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const statusText = status => ({ draft: 'Draft', queued: 'Queued', evaluating: 'In review', completed: 'Reviewed', failed: 'Needs retry' }[status]);
const statusBadge = status => `<span class="status ${escape(status)}">${statusText(status)}</span>`;
const problemFor = id => problems.find(p => p.id === id);
function shell(content, page = 'library', crumb = 'Problem library') {
  $('#app').innerHTML = `<div class="shell">
    <aside class="sidebar"><div><a class="brand" href="#library" aria-label="Design Lab home"><img src="/favicon.svg" alt="">design<span>lab</span></a><div class="edition">LOW-LEVEL DESIGN</div></div>
      <nav class="nav" aria-label="Main navigation"><a href="#library" class="${page === 'library' ? 'active' : ''}"><span class="nav-icon">▦</span> Problem library</a><a href="#history" class="${page === 'history' ? 'active' : ''}"><span class="nav-icon">↶</span> My attempts</a><button data-action="guide"><span class="nav-icon">☷</span> Practice guide</button></nav>
      <div class="sidebar-bottom"><strong><span class="local-dot"></span>Your local workspace</strong><p>Saved on this computer.<br>No account or API key needed.</p></div></aside>
    <div><header class="topbar"><div>Workspace <span class="slash">/</span><strong>${escape(crumb)}</strong></div><div class="topbar-right"><span class="local-label">A little practice, a better design.</span><span class="avatar" aria-label="Personal workspace">you</span></div></header><main id="main" class="content" tabindex="-1">${content}</main></div></div>`;
}
function row(a) {
  return `<a class="attempt-row" href="#attempt/${a.id}"><div><h3>${escape(problemFor(a.problemId)?.title ?? 'Problem')}</h3><small>${a.parentId ? 'Revision' : 'First draft'} · ${escape(a.id.slice(0, 8))}</small></div><div>${statusBadge(a.status)}</div><span class="date">${date(a.updatedAt)}</span><span class="arrow" aria-hidden="true">↗</span></a>`;
}
function renderLibrary() {
  shell(`<section class="hero"><div><span class="eyebrow">YOUR DESIGN PRACTICE, ONE ITERATION AT A TIME</span><h1>Good design comes from<br><em>another iteration.</em></h1><p>Take a small problem. Make your decisions visible.<br>Get feedback you can question, use, and build on.</p></div><aside class="loop-note"><span class="eyebrow">THE PRACTICE LOOP</span><div class="loop-line">Think. Design.<br>Reflect. Repeat. ↻</div><p>Better reasoning over perfect answers.</p></aside></section>
    <section><div class="section-heading"><h2>Choose your next challenge <small>3 focused problems</small></h2><span class="pill">All levels</span></div><div class="cards">${problems.map(p => {
      const draft = attempts.find(a => a.problemId === p.id && a.status === 'draft');
      return `<article class="problem-card"><div class="card-top"><div class="problem-icon ${p.color}" aria-hidden="true">${p.symbol}</div><span class="number">/ ${p.number}</span></div><h3>${p.title}</h3><p>${p.summary}</p><div class="tags"><span class="tag ${p.level.toLowerCase()}">${p.level}</span><span class="time">◷ ${p.minutes} min</span></div><div class="card-focus">${p.focus}</div>${draft ? `<a class="button secondary" href="#attempt/${draft.id}">Continue draft <span>→</span></a>` : `<button class="button secondary" data-action="start" data-problem="${p.id}">Start designing <span>→</span></button>`}</article>`;
    }).join('')}</div></section>
    <aside class="practice-note"><div><h3>No single right answer. Just better questions.</h3><p>Our review shows what it found, why it matters, and what to try next. No mystery score.</p></div><button class="text-button sample-button" data-action="sample">Explore a sample attempt ↗</button></aside>
    <section class="recent"><div class="section-heading"><h2>Pick up where you left off</h2><a class="text-button" href="#history">All attempts →</a></div>${attempts.length ? attempts.slice(0, 3).map(row).join('') : '<div class="empty"><h3>Your first iteration starts here.</h3><p>Choose a problem above. Your drafts and reviews will live here.</p></div>'}</section>
    <footer class="footer"><span>Made for thoughtful practice.</span><span>Local-first · Explainable feedback · Your own pace</span></footer>`);
}
function renderHistory(filter = 'all') {
  const selected = attempts.filter(a => filter === 'all' || a.problemId === filter);
  shell(`<section class="history-title"><span class="eyebrow">A RECORD OF YOUR REASONING</span><h1>Every iteration counts.</h1><p>Revisit a decision, resume a draft, or see what changed in your next attempt.</p></section><label class="filter">Problem <select id="history-filter"><option value="all">All problems</option>${problems.map(p => `<option value="${p.id}" ${p.id === filter ? 'selected' : ''}>${p.title}</option>`).join('')}</select><span>${selected.length} attempt${selected.length === 1 ? '' : 's'}</span></label>${selected.length ? `<div class="history-table">${selected.map(row).join('')}</div>` : '<div class="empty"><h3>No attempts yet.</h3><p>Start a problem and build a history of your thinking.</p><br><a class="button secondary" href="#library">Choose a problem →</a></div>'}`, 'history', 'My attempts');
}
function brief(p) {
  return `<aside class="brief"><span class="eyebrow">THE BRIEF / ${p.number}</span><h2>${p.title}</h2><p>${p.context}</p><h3>Requirements</h3><ol>${p.requirements.map(r => `<li>${r}</li>`).join('')}</ol><h3>Keep it focused</h3><div class="tags">${p.constraints.map(c => `<span class="tag">${c}</span>`).join('')}</div><div class="challenge"><span class="eyebrow">A CHANGE TO DESIGN FOR</span><p>${p.change}</p></div><details><summary>Need a nudge?</summary>${p.hints.map(h => `<p>${h}</p>`).join('')}</details></aside>`;
}
function renderAttempt() {
  const a = active, p = a.problemSnapshot;
  const drafting = a.status === 'draft';
  shell(`<div class="workspace-heading"><div><span class="eyebrow">${p.focus} / ${a.parentId ? 'REVISION' : 'PRACTICE'}</span><h1>${p.title}</h1><p>${p.level} · About ${p.minutes} minutes · ${escape(a.id.slice(0, 8))}</p></div><div class="workspace-actions">${statusBadge(a.status)}${drafting ? '<button class="button secondary" data-action="save">Save draft</button>' : ['completed', 'failed'].includes(a.status) ? '<button class="button" data-action="revise">Revise this design ↗</button>' : ''}</div></div><div class="steps"><span><span class="step-num">1</span>Read the brief</span><span>→</span><${drafting ? 'strong' : 'span'}><span class="step-num">2</span>Make a design</${drafting ? 'strong' : 'span'}><span>→</span><${drafting ? 'span' : 'strong'}><span class="step-num">3</span>Reflect & revise</${drafting ? 'span' : 'strong'}></div><div id="inline-error" role="alert"></div><div class="work-grid">${brief(p)}<div>${drafting ? editor(a) : review(a)}</div></div>`, 'library', p.title);
  if (drafting) {
    for (const [key] of fieldSpecs) $(`#field-${key}`).value = a.solution[key];
    $('#design-form').addEventListener('input', () => { dirty = true; $('.save-state').textContent = 'Unsaved changes'; });
    $('#design-form').addEventListener('submit', event => { event.preventDefault(); action('submit'); });
  }
}
function editor(a) {
  const placeholderFor = (key, fallback) => {
    if (a.problemId === 'parking-lot') return fallback;
    if (key === 'assumptions') return 'State the actors, boundaries, and assumptions that make this problem manageable.';
    if (key === 'responsibilities') return 'ObjectName: the decision this object owns.\n…';
    return fallback;
  };
  return `<section class="editor-panel">
    <header class="panel-header">
      <div><h2>Your design notebook</h2><p>Plain text, pseudocode, and honest trade-offs.</p></div>
      <span class="save-state" role="status">${a.version ? 'Saved on this computer' : 'Draft created'}</span>
    </header>
    <form id="design-form"><div class="editor-form">
      ${fieldSpecs.map(([key, label, required, hint, placeholder]) => `
        <div class="field">
          <label for="field-${key}">${label} <span>${required}</span></label>
          <p class="hint" id="hint-${key}">${hint}</p>
          <textarea id="field-${key}" name="${key}"
            ${['assumptions', 'responsibilities', 'walkthrough'].includes(key) ? 'required minlength="30"' : ''}
            maxlength="12000" aria-describedby="hint-${key}"
            placeholder="${escape(placeholderFor(key, placeholder))}"
            class="${key === 'code' ? 'code' : ''}"></textarea>
        </div>`).join('')}
    </div><footer class="editor-footer">
      <p>Your submitted design stays intact. You can create a revision after the review.</p>
      <button class="button" type="submit" data-submit>Submit for review <span>→</span></button>
    </footer></form>
  </section>`;
}
function review(a) {
  if (['queued', 'evaluating'].includes(a.status)) return `<section class="review-panel pending"><div class="spinner" aria-hidden="true"></div><h2>${a.status === 'queued' ? 'Your review is queued.' : 'Looking through your design…'}</h2><p role="status">Your solution is saved. You can leave this page and return from My attempts.<br>The status will update automatically.</p></section>`;
  if (a.status === 'failed') return `<section class="review-panel pending"><span class="eyebrow">REVIEW INTERRUPTED</span><h2>Your design is safe.</h2><p>${escape(a.error)}</p><button class="button" data-action="retry">Retry evaluation ↻</button></section><br>${submission(a)}`;
  return `<nav class="subnav" aria-label="Attempt views">${[['feedback', 'Design review'], ['submission', 'Your submission'], ['comparison', 'What changed']].map(([id, label]) => `<button data-action="tab" data-tab="${id}" class="${reviewTab === id ? 'active' : ''}" aria-current="${reviewTab === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>${reviewTab === 'submission' ? submission(a) : reviewTab === 'comparison' ? comparison(a) : feedback(a)}`;
}
function submission(a) { return `<section class="review-panel"><header class="panel-header"><div><h2>Submitted design</h2><p>Saved ${date(a.submittedAt)} · Read-only</p></div></header>${fieldSpecs.map(([key, label]) => `<section class="submission-section"><h3>${label}</h3><pre>${escape(a.solution[key] || 'Not provided.')}</pre></section>`).join('')}</section>`; }
function feedback(a) {
  const f = a.feedback;
  return `<section class="review-panel"><div class="review-intro"><span class="eyebrow">RULE-BASED REVIEW · ${escape(f.evaluator)}</span><h2>A starting point for your next iteration.</h2><p>${escape(f.summary)}</p><div class="notice">${escape(f.limitation)}</div><div class="review-counter"><strong>${f.findings.filter(x => x.status === 'signal').length}<small> / ${f.findings.length}</small></strong><span>review areas contain a matching phrase.<br>This measures text signals, not design quality.</span></div></div><div class="next-steps"><h3>Three things to think through next</h3><ol>${f.priorities.map(id => f.findings.find(x => x.id === id)).map(x => `<li>${escape(x.action)}</li>`).join('')}</ol></div>${f.findings.map(x => `<article class="finding"><div class="finding-top"><h3>${escape(x.title)}</h3><span class="review-badge ${x.status}">${x.status === 'signal' ? 'Phrase found' : 'Review this area'}</span></div>${x.evidence ? `<blockquote>${escape(x.evidence)}</blockquote><span class="source">From: ${escape(fieldSpecs.find(s => s[0] === x.field)?.[1] ?? x.field)}</span>` : ''}<p>${escape(x.explanation)}</p><p class="action"><strong>Try this →</strong> ${escape(x.action)}</p></article>`).join('')}</section>`;
}
function comparison(a) {
  if (!a.parentId) return '<section class="review-panel comparison"><h3>This is your first iteration.</h3><p>Use “Revise this design” to build on your submission. Your next review will show which text signals changed.</p></section>';
  if (!a.comparison) return `<section class="review-panel comparison"><h3>These reviews cannot be compared.</h3><p>The earlier attempt has no review, or the evaluator versions differ.</p><a class="text-button" href="#attempt/${a.parentId}">Open previous attempt →</a></section>`;
  return `<section class="review-panel comparison"><h3>Small changes, visible progress.</h3><p>Comparing with the parent attempt. A changed phrase signal is not proof that a design issue was resolved.</p><div class="compare-row"><strong>Review area</strong><strong>Previous</strong><span></span><strong>Current</strong></div>${a.comparison.map(c => `<div class="compare-row"><span>${escape(c.title)}</span><span>${c.before === 'signal' ? 'Phrase found' : 'Review'}</span><span>→</span><span>${c.after === 'signal' ? 'Phrase found' : 'Review'}${c.changed ? ' *' : ''}</span></div>`).join('')}<p>* Signal changed. Read both explanations before deciding whether the design improved.</p><a class="text-button" href="#attempt/${a.parentId}">Open previous attempt →</a></section>`;
}
function collectSolution() { return Object.fromEntries(fieldSpecs.map(([key]) => [key, $(`#field-${key}`).value])); }
async function save() {
  if (!active || active.status !== 'draft') return;
  const solution = $('#design-form') ? collectSolution() : active.solution;
  const saved = await api(`/api/attempts/${active.id}`, 'PUT', { solution, version: active.version });
  active = saved;
  // Edits typed while a save request is in flight must stay dirty.
  dirty = $('#design-form') ? JSON.stringify(collectSolution()) !== JSON.stringify(solution) : false;
  if ($('.save-state')) $('.save-state').textContent = dirty ? 'Unsaved changes' : 'Saved on this computer';
}
function showError(error) {
  if ($('#inline-error')) $('#inline-error').innerHTML = `<div class="alert">${escape(error.message)}${/another tab|latest draft/.test(error.message) ? '<br>Copy your unsaved text before reloading to preserve it.' : ''}</div>`;
  toast(error.message);
}
async function action(name, element) {
  if (name === 'guide') { $('#guide').showModal(); return; }
  if (busy) return;
  busy = true;
  try {
    if (name === 'start' || name === 'sample') {
      const created = await api('/api/attempts', 'POST', { problemId: name === 'sample' ? 'parking-lot' : element.dataset.problem });
      if (name === 'sample') await api(`/api/attempts/${created.id}`, 'PUT', { version: created.version, solution: {
        assumptions: 'One parking lot, with motorcycles and cars. Data stays in memory and payment processing is outside the scope.',
        responsibilities: 'ParkingLot manages entry and exit.\nParkingSpot owns occupancy and vehicle compatibility.\nTicket tracks the vehicle, spot, and entry time.\nFeeCalculator calculates the fee from duration and vehicle type.',
        relationships: 'ParkingLot contains floors and uses FeeCalculator. A Ticket references one ParkingSpot.',
        walkthrough: 'On entry the lot selects a compatible free spot, marks it occupied, and issues a ticket. On exit it calculates the fee, closes the ticket, and releases the spot.',
        tradeoffs: '', tests: '', code: ''
      } });
      location.hash = `attempt/${created.id}`;
      if (name === 'sample') toast('Sample loaded. It deliberately leaves failure cases, trade-offs, and tests for you to improve.');
    }
    if (name === 'save') { await save(); toast(dirty ? 'Saved. Newer edits still need saving.' : 'Draft saved.'); }
    if (name === 'submit') {
      // Freeze the visible form while saving + submitting to avoid losing edits between requests.
      document.querySelectorAll('#design-form textarea, [data-submit]').forEach(e => e.disabled = true);
      await save();
      active = await api(`/api/attempts/${active.id}/submit`, 'POST', { version: active.version });
      dirty = false; reviewTab = 'feedback'; renderAttempt(); startPolling(active.id);
    }
    if (name === 'retry') { active = await api(`/api/attempts/${active.id}/retry`, 'POST', {}); renderAttempt(); startPolling(active.id); }
    if (name === 'revise') { const created = await api('/api/attempts', 'POST', { problemId: active.problemId, parentId: active.id }); location.hash = `attempt/${created.id}`; }
    if (name === 'tab') { reviewTab = element.dataset.tab; renderAttempt(); }
  } catch (error) { showError(error); }
  finally {
    busy = false;
    document.querySelectorAll('#design-form textarea, [data-submit]').forEach(e => e.disabled = false);
    if (deferredRoute) { deferredRoute = false; await route(); }
  }
}
function startPolling(id) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    if (location.hash !== `#attempt/${id}` || active?.id !== id) return;
    try {
      const latest = await api(`/api/attempts/${id}`);
      if (active?.id !== id || location.hash !== `#attempt/${id}`) return;
      if (latest.status !== active.status) { active = latest; renderAttempt(); }
      if (['queued', 'evaluating'].includes(latest.status)) startPolling(id);
    } catch { toast('Connection interrupted. Your submission is saved; reconnecting…'); startPolling(id); }
  }, 900);
}
async function route() {
  if (busy) { deferredRoute = true; return; }
  const token = ++routeToken;
  clearTimeout(pollTimer);
  const hash = location.hash.slice(1) || 'library';
  try {
    if (dirty && active?.status === 'draft') {
      try { await save(); } catch (error) { history.replaceState(null, '', `#attempt/${active.id}`); showError(error); return; }
      if (dirty) { history.replaceState(null, '', `#attempt/${active.id}`); toast('New edits are not saved yet. Save again before leaving.'); return; }
    }
    attempts = await api('/api/attempts');
    if (token !== routeToken) return;
    if (hash.startsWith('attempt/')) {
      const loaded = await api(`/api/attempts/${encodeURIComponent(hash.split('/')[1])}`);
      if (token !== routeToken) return;
      active = loaded; dirty = false; reviewTab = 'feedback'; renderAttempt();
      if (['queued', 'evaluating'].includes(active.status)) startPolling(active.id);
    } else { active = null; dirty = false; hash === 'history' ? renderHistory() : renderLibrary(); }
    window.scrollTo(0, 0);
  } catch (error) { shell(`<div class="error-page"><h1>Could not open this workspace.</h1><p>${escape(error.message)}</p><button class="button" data-action="reload">Try again</button> <a class="text-button" href="#library">Back to library</a></div>`); }
}
document.addEventListener('click', event => {
  if (event.target.closest('.skip')) { event.preventDefault(); $('#main')?.focus(); return; }
  if (busy && event.target.closest('a[href^="#"]')) { event.preventDefault(); return; }
  const element = event.target.closest('[data-action]');
  if (!element) return;
  if (element.dataset.action === 'reload') { route(); return; }
  action(element.dataset.action, element);
});
document.addEventListener('change', event => { if (event.target.id === 'history-filter') renderHistory(event.target.value); });
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && active?.status === 'draft') { event.preventDefault(); action('save'); } });
$('#close-guide').addEventListener('click', () => $('#guide').close());
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('hashchange', route);
async function boot() {
  try { problems = await api('/api/problems'); await route(); }
  catch (error) { $('#app').innerHTML = `<main class="error-page"><h1>Design Lab could not connect.</h1><p>${escape(error.message)}</p><p>Start the local server and refresh this page.</p><button class="button" id="reconnect">Reconnect</button></main>`; $('#reconnect').onclick = boot; }
}
boot();
