/* Museum Heist — drag-n-drop seat-shuffle game */

(() => {
  // ---- Data ----
  const CHARACTERS = [
    { id: 1, name: 'Harry',   slot: 1 },
    { id: 2, name: 'Tony',    slot: 2 },
    { id: 3, name: 'Joker',   slot: 3 },
    { id: 4, name: 'Bella',   slot: 4 },
    { id: 5, name: 'Sophie',  slot: 5 },
    { id: 6, name: 'Charles', slot: 6 },
    { id: 7, name: 'Maya',    slot: 7 },
    { id: 8, name: 'Dan',     slot: 8 },
  ];

  const HINTS = [
    { id: 1, type: 'open',   slots: [1,2,3,4,5,6,7,8],
      text: 'A gang is robbing the museum. Catch them all!' },
    { id: 2, type: 'open',   slots: [8],
      text: 'The museum curator, Dan, is lying in a pool of blood.' },
    { id: 3, type: 'open',   slots: [2],
      text: 'A young vandal has defaced a painting!' },
    { id: 4, type: 'open',   slots: [4],
      text: 'None of the male robbers wanted to steal the valuable rooster statue. Guess they don\u2019t know much about art\u2026' },
    { id: 8, type: 'open',   slots: [5],
      text: 'Sophie is trying to read the ancient runes. She believes something even more valuable is hidden somewhere\u2026' },
    { id: 5, type: 'hidden', slots: [7], item: 'Gun',
      text: 'A single long red hair was found near the gun.' },
    { id: 6, type: 'hidden', slots: [6], item: 'Crown',
      text: 'Someone is planning to steal another crown.' },
    { id: 7, type: 'hidden', slots: [3], item: 'Painting1',
      text: 'Joker found a hidden safe behind a painting. Lucky him!' },
  ];

  // ---- State ----
  const placedSlots = new Set();          // numbers (slot ids) that are filled
  const revealedHints = new Set();        // hint ids that are visible (open hints auto-revealed)
  const solvedHints = new Set();          // hint ids that have been crossed out

  HINTS.forEach(h => { if (h.type === 'open') revealedHints.add(h.id); });

  // ---- DOM refs ----
  const stage      = document.getElementById('stage');
  const stripEl    = document.getElementById('strip');
  const stripArea  = document.getElementById('strip-area');
  const stripView  = document.getElementById('strip-viewport');
  const btnPrev    = document.getElementById('strip-prev');
  const btnNext    = document.getElementById('strip-next');
  const hintsList  = document.getElementById('hints-list');
  const winOverlay = document.getElementById('win');

  // ---- Build character strip ----
  CHARACTERS.forEach(ch => {
    const el = document.createElement('div');
    el.className = 'char';
    el.dataset.charId = ch.id;
    el.innerHTML = `
      <img src="Assests/${ch.name}.png" alt="${ch.name}" draggable="false" />
      <div class="name">${ch.name}</div>
    `;
    stripEl.appendChild(el);
  });

  // ---- Strip layout: paged with arrow buttons (5 chars per page) ----
  const PER_PAGE = 5;
  let pageIndex = 0; // 0 = first page (chars 1..5), 1 = next (chars 6..8)

  function pageCount() {
    return Math.max(1, Math.ceil(CHARACTERS.length / PER_PAGE));
  }

  function sizeStrip() {
    const w = stripView.clientWidth;
    const charW = w / PER_PAGE;
    stripEl.querySelectorAll('.char').forEach(c => { c.style.width = charW + 'px'; });
    applyPage();
  }

  function applyPage() {
    const w = stripView.clientWidth;
    // Clamp page index in case it became invalid (e.g. after resize).
    const maxPage = pageCount() - 1;
    if (pageIndex > maxPage) pageIndex = maxPage;
    if (pageIndex < 0) pageIndex = 0;
    stripEl.style.transform = `translateX(${-pageIndex * w}px)`;
    btnPrev.classList.toggle('hidden', pageIndex === 0);
    btnNext.classList.toggle('hidden', pageIndex >= maxPage);
  }

  sizeStrip();
  window.addEventListener('resize', sizeStrip);

  btnPrev.addEventListener('click', () => { pageIndex--; applyPage(); });
  btnNext.addEventListener('click', () => { pageIndex++; applyPage(); });

  // ---- Build hints list ----
  function renderHints() {
    hintsList.innerHTML = '';
    // ordering: unsolved first (in original order), solved at the bottom
    const ordered = HINTS.slice().sort((a, b) => {
      const sa = solvedHints.has(a.id) ? 1 : 0;
      const sb = solvedHints.has(b.id) ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return a.id - b.id;
    });
    ordered.forEach(h => {
      const li = document.createElement('li');
      li.className = 'hint';
      li.dataset.hintId = h.id;

      const isRevealed = revealedHints.has(h.id);
      const isSolved   = solvedHints.has(h.id);

      let icon, text;
      if (isSolved)            { icon = '\u2705'; }            // green check
      else if (!isRevealed)    { icon = '\uD83D\uDD12'; }      // lock
      else                     { icon = '\uD83D\uDC46'; }      // pointing finger ("fingerprint" stand-in)

      // Better fingerprint-ish icon set: try the actual fingerprint codepoint U+1FAC6
      if (!isSolved && isRevealed) icon = '\uD83E\uDEC6';

      if (isRevealed) text = h.text;
      else            text = 'Top secret hint';

      li.innerHTML = `
        <span class="icon">${icon}</span>
        <span class="text">${text}</span>
      `;
      if (!isRevealed) li.classList.add('locked');
      if (isSolved)    li.classList.add('solved');
      hintsList.appendChild(li);
    });
  }
  renderHints();

  // ---- Helpers ----
  function getStageRect() { return stage.getBoundingClientRect(); }

  function slotCenterPct(slotId) {
    const el = stage.querySelector(`.slot[data-slot="${slotId}"]`);
    // values stored in inline left/top as percentages
    return {
      leftPct: parseFloat(el.style.left),
      topPct:  parseFloat(el.style.top)
    };
  }

  function placeCharacter(charId, slotId) {
    placedSlots.add(slotId);
    // hide strip card
    const card = stripEl.querySelector(`.char[data-char-id="${charId}"]`);
    if (card) card.classList.add('placed-out');

    // create permanent placed sprite at slot
    const ch = CHARACTERS.find(c => c.id === charId);
    const { leftPct, topPct } = slotCenterPct(slotId);
    const placed = document.createElement('div');
    placed.className = 'placed';
    placed.style.left = leftPct + '%';
    placed.style.top  = (topPct + 5) + '%';   // anchor near feet
    placed.dataset.slot = slotId;
    placed.innerHTML = `<img src="Assests/${ch.name}.png" alt="${ch.name}" draggable="false" />`;
    stage.appendChild(placed);

    checkHintsAfterPlacement();
    if (placedSlots.size === CHARACTERS.length) {
      setTimeout(showWin, 600);
    }
  }

  function checkHintsAfterPlacement() {
    let changed = false;
    HINTS.forEach(h => {
      if (solvedHints.has(h.id)) return;
      const allPlaced = h.slots.every(s => placedSlots.has(s));
      if (!allPlaced) return;
      // Auto-reveal hidden hint if it wasn't yet, then mark solved.
      if (!revealedHints.has(h.id)) revealedHints.add(h.id);
      solvedHints.add(h.id);
      changed = true;
    });
    if (changed) renderHints();
  }

  function showWin() { winOverlay.classList.add('show'); }

  // ---- Drag & drop ----
  let drag = null; // { ghost, charId, pointerId }

  function moveGhost(clientX, clientY) {
    if (!drag) return;
    const r = getStageRect();
    const xPct = ((clientX - r.left) / r.width)  * 100;
    const yPct = ((clientY - r.top)  / r.height) * 100;
    drag.ghost.style.left = xPct + '%';
    drag.ghost.style.top  = yPct + '%';
  }

  function onPointerDown(ev) {
    const card = ev.target.closest('.char');
    if (!card) return;
    if (card.classList.contains('placed-out')) return;
    if (ev.pointerType === 'touch' && ev.isPrimary === false) return;
    ev.preventDefault();

    const charId = parseInt(card.dataset.charId, 10);
    const ch = CHARACTERS.find(c => c.id === charId);

    const ghost = document.createElement('div');
    ghost.className = 'dragging';
    ghost.innerHTML = `<img src="Assests/${ch.name}.png" alt="${ch.name}" draggable="false" />`;
    stage.appendChild(ghost);

    drag = { ghost, charId, pointerId: ev.pointerId };
    moveGhost(ev.clientX, ev.clientY);
    try { card.setPointerCapture(ev.pointerId); } catch (_) {}

    function move(e) {
      if (e.pointerId !== ev.pointerId) return;
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
    }
    function up(e) {
      if (e.pointerId !== ev.pointerId) return;
      try { card.releasePointerCapture(ev.pointerId); } catch (_) {}
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerup', up);
      card.removeEventListener('pointercancel', up);
      finishDrag(e);
    }
    card.addEventListener('pointermove', move, { passive: false });
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', up);
  }

  function finishDrag(ev) {
    const ch = CHARACTERS.find(c => c.id === drag.charId);
    const r = getStageRect();
    const dropX = ev.clientX, dropY = ev.clientY;

    const correctSlot = stage.querySelector(`.slot[data-slot="${ch.slot}"]`);
    const sr = correctSlot.getBoundingClientRect();
    const inside = dropX >= sr.left && dropX <= sr.right && dropY >= sr.top && dropY <= sr.bottom;
    const slotAlreadyTaken = placedSlots.has(ch.slot);

    if (inside && !slotAlreadyTaken) {
      drag.ghost.remove();
      drag = null;
      placeCharacter(ch.id, ch.slot);
      return;
    }

    const ghost = drag.ghost;
    drag = null;
    const cardCard = stripEl.querySelector(`.char[data-char-id="${ch.id}"]`);
    const cr = cardCard.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top  + cr.height;
    const xPct = ((cx - r.left) / r.width)  * 100;
    const yPct = ((cy - r.top)  / r.height) * 100;
    ghost.classList.add('fall-back');
    requestAnimationFrame(() => {
      ghost.style.left = xPct + '%';
      ghost.style.top  = yPct + '%';
      ghost.style.opacity = '0';
    });
    setTimeout(() => ghost.remove(), 320);
  }

  stripEl.addEventListener('pointerdown', onPointerDown);

  // ---- Tooltip ----
  const tooltipEl = document.getElementById('tooltip');
  let tooltipTimer = null;
  function showTooltip() {
    tooltipEl.classList.add('show');
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => tooltipEl.classList.remove('show'), 1800);
  }

  // Tap on a locked hint → show tooltip prompting to look for clues
  hintsList.addEventListener('pointerdown', (ev) => {
    const li = ev.target.closest('.hint.locked');
    if (!li) return;
    showTooltip();
  });

  // ---- Items: tap → bounce; reveal hidden hints if linked ----
  stage.querySelectorAll('.item').forEach(itemEl => {
    itemEl.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      // bounce
      itemEl.classList.remove('bounce');
      // force reflow
      void itemEl.offsetWidth;
      itemEl.classList.add('bounce');

      const itemName = itemEl.dataset.item;
      // find any hidden hint linked to this item that's still locked
      const hint = HINTS.find(h => h.item === itemName && !revealedHints.has(h.id));
      if (hint) {
        revealedHints.add(hint.id);
        renderHints();
        // scroll into view + reveal-anim + confetti
        const li = hintsList.querySelector(`.hint[data-hint-id="${hint.id}"]`);
        if (li) {
          li.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // wait for scroll, then play
          setTimeout(() => {
            li.classList.add('reveal-anim');
            spawnConfetti(li);
            setTimeout(() => li.classList.remove('reveal-anim'), 1300);
          }, 280);
        }
        // After unlocking, the hint may be auto-solved if its slot is already placed
        checkHintsAfterPlacement();

        // Painting1 — vanish after revealing its hint (let bounce play first)
        if (itemName === 'Painting1') {
          setTimeout(() => {
            itemEl.classList.remove('bounce');
            itemEl.classList.add('vanish');
            setTimeout(() => { itemEl.style.display = 'none'; }, 400);
          }, 380);
        }
      }
    });
  });

  // ---- Restart ----
  document.getElementById('restart').addEventListener('click', () => {
    location.reload();
  });

  // ---- Confetti ----
  function spawnConfetti(hintLi) {
    const colors = ['#ff5252', '#ffcc33', '#33d17a', '#3aa0ff', '#c065ff', '#ff77c8', '#ffffff'];
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    hintLi.appendChild(layer);

    const COUNT = 28;
    for (let i = 0; i < COUNT; i++) {
      const c = document.createElement('span');
      const isStar = i % 4 === 0;
      c.className = 'confetti' + (isStar ? ' star' : '');
      const angle = (Math.PI * 2) * (i / COUNT) + (Math.random() - 0.5) * 0.6;
      const dist  = 80 + Math.random() * 90;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 20; // slight upward bias
      const rot = (Math.random() * 720 - 360) + 'deg';
      c.style.setProperty('--dx', dx + 'px');
      c.style.setProperty('--dy', dy + 'px');
      c.style.setProperty('--rot', rot);
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 80) + 'ms';
      c.style.animationDuration = (900 + Math.random() * 500) + 'ms';
      layer.appendChild(c);
    }
    setTimeout(() => layer.remove(), 1700);
  }
})();
