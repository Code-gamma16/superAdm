/* =========================================================
   FRIGUS ADMIN — admin.js
   Só comportamento visual do painel (nada é salvo):
   - filtros das tabelas (busca + selects)
   - escolha "usuário OU empresa" / "geladeira OU frigorífico":
     um campo recebe o id e o outro vira NULL
   ========================================================= */
(function () {
  'use strict';
  var TODAY = new Date(2026, 9, 7);
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  /* ---------- filtros, ordenação e páginas ---------- */
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  var DIGIT_KEYS = { cep: 1, cnpj: 1, cpf: 1 };
  var pageOf = new WeakMap();

  function applyTable(root, keepPage) {
    var ctrls = $$('[data-f]', root), tests = [], sortEl = null;
    ctrls.forEach(function (el) {
      if (el.hasAttribute('data-sort')) { sortEl = el; return; }
      var v = (el.value || '').trim().toLowerCase();
      if (v) { tests.push({ k: el.dataset.f, v: v, text: el.tagName === 'INPUT' }); }
    });
    var tbody = $('tbody', root), rows = $$('[data-row]', root);

    if (sortEl && sortEl.value) {
      var p = sortEl.value.split(':'), key = p[0], dir = p[1] === 'desc' ? -1 : 1, num = p[2] === 'n';
      rows.sort(function (a, b) {
        var x = a.dataset[key] || '', y = b.dataset[key] || '';
        if (num) { return (parseFloat(x) - parseFloat(y)) * dir; }
        return x.localeCompare(y, 'pt-BR') * dir;
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
    }

    var matched = rows.filter(function (row) {
      return tests.every(function (t) {
        var raw = row.dataset[t.k] || '';
        if (t.text) {
          if (DIGIT_KEYS[t.k]) { var d = digits(t.v); return !d || digits(raw).indexOf(d) > -1; }
          return raw.toLowerCase().indexOf(t.v) > -1;
        }
        if (t.k === 'val') {
          var n = parseInt(row.dataset.dias, 10);
          return (t.v === 'vencidos' && n < 0) || (t.v === '7' && n >= 0 && n <= 7) || (t.v === '30' && n >= 0 && n <= 30) || (t.v === 'longa' && n > 30);
        }
        return raw.toLowerCase() === t.v;
      });
    });
    root._matched = matched;
    root._total = rows.length;
    if (!keepPage) { pageOf.set(root, 0); }
    render(root);
  }

  // quantas linhas cabem na tela sem precisar rolar a lista
  function perPage(root, matched) {
    var content = $('.content'), wrap = $('.table-wrap', root);
    if (!content || !matched.length) { return 10; }
    var sample = matched.slice(0, 8);
    $$('[data-row]', root).forEach(function (r) { r.hidden = sample.indexOf(r) === -1; });
    var h = 0;
    sample.forEach(function (r) { h += r.offsetHeight; });
    var avg = h / sample.length || 70;
    var top = wrap.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop;
    var head = $('thead', root).offsetHeight, foot = $('.table-footer', root).offsetHeight || 56;
    var avail = content.clientHeight - top - head - foot - 32;
    return Math.max(4, Math.min(15, Math.floor(avail / avg)));
  }

  function render(root) {
    var matched = root._matched || [], total = root._total || 0;
    var noun = root.dataset.noun || 'registros';
    var size = perPage(root, matched);
    var pages = Math.max(1, Math.ceil(matched.length / size));
    var page = Math.min(pageOf.get(root) || 0, pages - 1);
    pageOf.set(root, page);
    var start = page * size, end = Math.min(matched.length, start + size);
    var visible = matched.slice(start, end);
    $$('[data-row]', root).forEach(function (r) { r.hidden = visible.indexOf(r) === -1; });

    var count = $('[data-count]', root);
    if (count) {
      if (!matched.length) { count.textContent = '0 ' + noun; }
      else if (pages === 1) { count.textContent = matched.length === total ? total + ' ' + noun : matched.length + ' de ' + total + ' ' + noun; }
      else { count.textContent = 'Mostrando ' + (start + 1) + '–' + end + ' de ' + matched.length + ' ' + noun + (matched.length !== total ? ' (' + total + ' no total)' : ''); }
    }
    var wrap = $('.table-wrap', root), empty = $('[data-empty]', root);
    if (wrap) { wrap.hidden = !matched.length; }
    if (empty) { empty.hidden = !!matched.length; }
    buildPager(root, page, pages);
  }

  function pageList(page, pages) {
    if (pages <= 7) { return Array.apply(null, Array(pages)).map(function (_, i) { return i; }); }
    var set = {}; [0, pages - 1, page - 1, page, page + 1].forEach(function (i) { if (i >= 0 && i < pages) { set[i] = 1; } });
    var list = Object.keys(set).map(Number).sort(function (a, b) { return a - b; }), out = [];
    list.forEach(function (i, k) { if (k && i - list[k - 1] > 1) { out.push('…'); } out.push(i); });
    return out;
  }

  function buildPager(root, page, pages) {
    var nav = $('[data-pager]', root);
    if (!nav) { return; }
    nav.hidden = pages <= 1;
    if (pages <= 1) { nav.innerHTML = ''; return; }
    var html = '<button type="button" data-page="prev"' + (page === 0 ? ' disabled' : '') + ' aria-label="Página anterior">‹ Anterior</button>';
    pageList(page, pages).forEach(function (i) {
      html += i === '…' ? '<span class="pager-gap" aria-hidden="true">…</span>'
        : '<button type="button" data-page="' + i + '"' + (i === page ? ' aria-current="page"' : '') + ' aria-label="Página ' + (i + 1) + '">' + (i + 1) + '</button>';
    });
    html += '<button type="button" data-page="next"' + (page === pages - 1 ? ' disabled' : '') + ' aria-label="Próxima página">Próxima ›</button>';
    nav.innerHTML = html;
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-page]');
    if (!b || b.disabled) { return; }
    var root = b.closest('[data-admin-table]'), cur = pageOf.get(root) || 0, v = b.dataset.page;
    pageOf.set(root, v === 'prev' ? cur - 1 : v === 'next' ? cur + 1 : parseInt(v, 10));
    render(root);
    var focus = $('[data-page="' + (v === 'prev' || v === 'next' ? (v === 'prev' ? 'prev' : 'next') : v) + '"]:not([disabled])', root) || $('[aria-current="page"]', root);
    if (focus) { focus.focus(); }
  });

  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { $$('[data-admin-table]').forEach(function (r) { render(r); }); }, 150);
  });

  document.addEventListener('input', function (e) {
    var t = e.target, root = t.closest && t.closest('[data-admin-table]');
    if (root && t.matches('input[data-f]')) { applyTable(root); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, root = t.closest && t.closest('[data-admin-table]');
    if (root && t.matches('[data-f]')) { applyTable(root); }
    var box = t.closest && t.closest('[data-xor]');
    if (box) {
      if (t.matches('[data-xor-radio]')) { clearOther(box); }
      syncXor(box);
    }
  });
  document.addEventListener('click', function (e) {
    var clear = e.target.closest && e.target.closest('[data-admin-clear]');
    if (clear) {
      var root = clear.closest('[data-admin-table]');
      $$('[data-f]', root).forEach(function (f) { if (f.hasAttribute('data-sort')) { f.selectedIndex = 0; } else { f.value = ''; } });
      applyTable(root);
    }
    // depois que o ui.js abriu o painel, ajusta os blocos "um ou outro"
    var opener = e.target.closest && e.target.closest('[data-open]');
    if (opener) {
      var panel = document.getElementById(opener.dataset.open);
      if (panel) {
        $$('[data-xor]', panel).forEach(function (box) { pickFilledSide(box, panel); syncXor(box, panel); });
        // senha: obrigatória só ao criar (ao editar, em branco mantém a atual)
        $$('[data-pass] input', panel).forEach(function (i) { i.required = panel.dataset.mode === 'create'; });
      }
    }
  });

  /* ---------- "um ou outro" (XOR) ---------- */
  function panes(box) { return $$('[data-xor-pane]', box); }
  function currentSide(box) {
    var r = $$('[data-xor-radio]', box).filter(function (x) { return x.checked; })[0];
    return r ? r.value : 'a';
  }
  function selectOf(pane) { return $('select', pane); }
  function pickFilledSide(box, panel) {
    if (panel.dataset.mode === 'create') { return; }
    panes(box).forEach(function (p) {
      if (selectOf(p).value) {
        $$('[data-xor-radio]', box).forEach(function (r) { r.checked = r.value === p.dataset.xorPane; });
      }
    });
  }
  function clearOther(box) {
    var side = currentSide(box);
    panes(box).forEach(function (p) { if (p.dataset.xorPane !== side) { selectOf(p).value = ''; } });
  }
  function syncXor(box, panel) {
    panel = panel || box.closest('.drawer, .modal');
    var view = panel && panel.dataset.mode === 'view';
    var side = currentSide(box);
    panes(box).forEach(function (p) {
      var on = p.dataset.xorPane === side, s = selectOf(p);
      p.hidden = !on;
      if (!view) { s.disabled = !on; }
    });
  }
  $$('[data-xor]').forEach(function (b) { syncXor(b); });

  /* ---------- inicialização ---------- */
  $$('[data-admin-table]').forEach(function (t) { applyTable(t); });
  window.addEventListener('load', function () { $$('[data-admin-table]').forEach(function (t) { render(t); }); });
})();
