/* =========================================================
   FRIGUS UI — ui.js
   Único JavaScript do protótipo. Só faz interações visuais:
   abrir/fechar drawer e modal, menus ⋮, toast, preencher o
   formulário em modo "editar", filtros simples e checklist.
   Nada aqui persiste dados — em JSP/Servlet o servidor assume.
   ========================================================= */
(function () {
  'use strict';

  // Data fixa do protótipo (os dados fictícios foram montados em torno dela)
  var TODAY = new Date(2026, 9, 7);

  var body = document.body;
  var overlay = document.getElementById('overlay');
  var lastTrigger = null;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------- Estado vazio de demonstração (?vazio) ---------- */
  if (/[?&]vazio/.test(location.search)) { body.classList.add('is-empty-demo'); }

  /* ---------- Toast ---------- */
  function toast(message) {
    var region = document.getElementById('toasts');
    if (!region || !message) { return; }
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-circle-check"/></svg><span></span>';
    el.querySelector('span').textContent = message;
    region.appendChild(el);
    setTimeout(function () { el.remove(); }, 3800);
  }

  /* ---------- Drawer / Modal ---------- */
  function closePanels(keepOverlay) {
    $$('.drawer.is-open, .modal.is-open').forEach(function (p) {
      p.classList.remove('is-open');
      p.setAttribute('aria-hidden', 'true');
    });
    if (!keepOverlay) {
      overlay.classList.remove('is-open');
      body.classList.remove('no-scroll');
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    }
  }

  function openPanel(id, trigger) {
    var panel = document.getElementById(id);
    if (!panel) { return null; }
    closePanels(true);
    if (trigger) { lastTrigger = trigger; }
    preparePanel(panel, trigger);
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');
    body.classList.add('no-scroll');
    var first = $('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])', panel);
    (first || $('button', panel)).focus();
    return panel;
  }

  // Ajusta título, botão e campos conforme o modo: create | edit | view
  function preparePanel(panel, trigger) {
    var mode = (trigger && trigger.dataset.mode) || 'create';
    panel.dataset.mode = mode;
    panel.classList.toggle('is-view', mode === 'view');

    $$('[data-title-create]', panel).forEach(function (el) {
      el.textContent = el.getAttribute('data-title-' + mode) || el.getAttribute('data-title-create');
    });
    $$('[data-label-create]', panel).forEach(function (el) {
      el.textContent = el.getAttribute('data-label-' + mode) || el.getAttribute('data-label-create');
    });

    var form = $('form', panel);
    if (form) {
      form.reset();
      var list = $('[data-ingredients]', form);
      if (list) { list.innerHTML = ''; }
      var fill = null;
      if (trigger && trigger.dataset.fill) { fill = JSON.parse(trigger.dataset.fill); }
      if (fill) { fillForm(form, fill); }
      if (list) {
        var rows = (fill && fill.ingredientes) || [{}, {}];
        rows.forEach(function (r) { addIngredient(list, r); });
      }
      $$('input, select, textarea', form).forEach(function (f) {
        if (f.type !== 'hidden') { f.disabled = (mode === 'view'); }
      });
      $$('[data-status-preview]', form).forEach(updateStatusPreview);
    }

    // textos dinâmicos (ex.: nome do item no modal de exclusão)
    if (trigger) {
      $$('[data-slot]', panel).forEach(function (slot) {
        var v = trigger.dataset[slot.dataset.slot];
        if (v !== undefined) { slot.textContent = v; }
      });
    }
  }

  function fillForm(form, data) {
    Object.keys(data).forEach(function (key) {
      var field = form.elements[key];
      if (field && !(field instanceof RadioNodeList) && field.type !== 'file') {
        var v = data[key];
        if (field.hasAttribute('data-date') && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) { v = String(v).split('-').reverse().join('/'); }
        field.value = v;
      }
    });
  }

  /* ---------- Ingredientes (formulário de receita) ---------- */
  function addIngredient(list, data) {
    var tpl = $('template[data-ingredient-template]');
    var node = tpl.content.firstElementChild.cloneNode(true);
    var sel = $('select', node);
    if (data && data.produto) { sel.value = data.produto; }
    if (data && data.quantidade) { $('input[type=number]', node).value = data.quantidade; }
    list.appendChild(node);
    syncIngredient(node);
  }

  function syncIngredient(item) {
    var sel = $('select', item);
    var opt = sel.options[sel.selectedIndex];
    var unit = $('.unit-chip', item);
    var hint = $('[data-stock-hint]', item);
    unit.textContent = (opt && opt.dataset.unit) || '—';
    var stock = opt && opt.dataset.stock !== undefined ? parseInt(opt.dataset.stock, 10) : null;
    var need = parseInt($('input[type=number]', item).value, 10) || 0;
    hint.className = 'stock-hint';
    if (!opt || !opt.value) { hint.textContent = ''; return; }
    if (stock === 0) {
      hint.textContent = 'Sem estoque — pode ser adicionado à lista de compras depois.';
      hint.classList.add('is-none');
    } else if (stock < need) {
      hint.textContent = 'Estoque insuficiente: você tem ' + stock + ' ' + opt.dataset.unit + '.';
      hint.classList.add('is-low');
    } else {
      hint.textContent = 'Em estoque: ' + stock + ' ' + opt.dataset.unit + '.';
    }
  }

  /* ---------- Prévia do status calculado pela validade ---------- */
  function statusFor(dateStr) {
    var p = dateStr.indexOf('/') > -1 ? dateStr.split('/').reverse() : dateStr.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var dias = Math.round((d - TODAY) / 86400000);
    // Mesmas regras de StatusProduto.calcularStatus()
    if (dias < 0) { return ['Vencido', 'badge-danger']; }
    if (dias <= 3) { return ['Atenção', 'badge-orange']; }
    if (dias <= 7) { return ['Próximo do vencimento', 'badge-warning']; }
    if (dias <= 20) { return ['Regular', 'badge-success']; }
    return ['Validade longa', 'badge-info'];
  }
  function updateStatusPreview(box) {
    var form = box.closest('form');
    var input = form.elements.dtValidade;
    var badge = $('.badge', box);
    if (!input || !/^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/.test(input.value)) {
      badge.className = 'badge badge-neutral';
      badge.textContent = 'Aguardando data';
      return;
    }
    var s = statusFor(input.value);
    badge.className = 'badge ' + s[1];
    badge.textContent = s[0];
  }

  /* ---------- Menus (⋮ e conta) ---------- */
  function closeMenus(except) {
    $$('.menu.is-open').forEach(function (m) {
      if (m !== except) {
        m.classList.remove('is-open');
        var b = $('[data-menu-toggle]', m);
        if (b) { b.setAttribute('aria-expanded', 'false'); }
      }
    });
  }

  /* ---------- Filtros da tabela de produtos ---------- */
  function applyFilters(root) {
    var q = ($('[data-filter="q"]', root) || {}).value || '';
    var cat = ($('[data-filter="cat"]', root) || {}).value || '';
    var st = ($('[data-filter="status"]', root) || {}).value || '';
    var val = ($('[data-filter="val"]', root) || {}).value || '';
    var arm = ($('[data-filter="arm"]', root) || {}).value || '';
    q = q.trim().toLowerCase();
    var shown = 0;
    $$('[data-row]', root).forEach(function (row) {
      var dias = parseInt(row.dataset.dias, 10);
      var ok = (!q || row.dataset.search.indexOf(q) > -1) &&
        (!cat || row.dataset.cat === cat) &&
        (!st || row.dataset.status === st) &&
        (!arm || row.dataset.arm === arm) &&
        (!val ||
          (val === 'vencidos' && dias < 0) ||
          (val === '7' && dias >= 0 && dias <= 7) ||
          (val === '30' && dias >= 0 && dias <= 30) ||
          (val === 'longa' && dias > 30));
      row.hidden = !ok;
      if (ok) { shown++; }
    });
    var count = $('[data-count]', root);
    if (count) { count.textContent = shown + (shown === 1 ? ' produto' : ' produtos'); }
    var empty = $('[data-empty-search]', root);
    var wrap = $('.table-wrap', root);
    if (empty) { empty.classList.toggle('is-visible', shown === 0); }
    if (wrap) { wrap.hidden = shown === 0; }
  }

  /* ---------- Filtros por chip (receitas) ---------- */
  function applyRecipeFilters() {
    var active = $('[data-chip][aria-pressed="true"]');
    var mode = active ? active.dataset.chip : 'all';
    var q = (($('[data-recipe-search]') || {}).value || '').trim().toLowerCase();
    var shown = 0;
    $$('[data-recipe]').forEach(function (card) {
      var ok = (mode === 'all' || card.dataset.recipe.split(' ').indexOf(mode) > -1) &&
        (!q || card.dataset.name.indexOf(q) > -1);
      card.hidden = !ok;
      if (ok) { shown++; }
    });
    var empty = $('[data-empty-search]');
    if (empty) { empty.classList.toggle('is-visible', shown === 0); }
  }

  /* ---------- Checklist da lista de compras ---------- */
  function updateShoppingCounts() {
    var pending = $$('.shop-item:not(.is-done)').length;
    $$('[data-pending-count]').forEach(function (el) {
      el.textContent = pending + (pending === 1 ? ' item pendente' : ' itens pendentes');
    });
    $$('.shop-group').forEach(function (g) {
      var n = $$('.shop-item', g).length;
      var c = $('.count', g);
      if (c) { c.textContent = n + (n === 1 ? ' item' : ' itens'); }
      g.hidden = n === 0;
    });
  }

  /* ---------- Eventos (delegados) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;

    var opener = t.closest('[data-open]');
    if (opener) {
      e.preventDefault();
      closeMenus();
      openPanel(opener.dataset.open, opener);
      return;
    }
    if (t.closest('[data-close]') || t === overlay) { closePanels(); return; }

    var menuBtn = t.closest('[data-menu-toggle]');
    if (menuBtn) {
      var menu = menuBtn.closest('.menu');
      var willOpen = !menu.classList.contains('is-open');
      closeMenus(menu);
      menu.classList.toggle('is-open', willOpen);
      menuBtn.setAttribute('aria-expanded', String(willOpen));
      return;
    }
    if (!t.closest('.menu')) { closeMenus(); }

    var toasty = t.closest('[data-toast]');
    if (toasty) { toast(toasty.dataset.toast); closePanels(); }

    var pw = t.closest('[data-toggle-password]');
    if (pw) {
      var input = pw.parentElement.querySelector('input');
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      pw.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      var use = $('use', pw);
      if (use) { use.setAttribute('href', show ? '#i-eye-off' : '#i-eye'); }
    }

    if (t.closest('[data-sidebar-toggle]')) { $('.sidebar').classList.toggle('is-open'); }

    var addIng = t.closest('[data-add-ingredient]');
    if (addIng) { addIngredient($('[data-ingredients]', addIng.closest('form')), {}); }

    var rmIng = t.closest('[data-remove-ingredient]');
    if (rmIng) {
      var list = rmIng.closest('[data-ingredients]');
      if ($$('.ingredient-item', list).length > 1) { rmIng.closest('.ingredient-item').remove(); }
    }

    var chip = t.closest('[data-chip]');
    if (chip) {
      $$('[data-chip]').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      applyRecipeFilters();
    }

    if (t.closest('[data-clear-filters]')) {
      var tbl = t.closest('[data-filter-table]');
      $$('[data-filter]', tbl).forEach(function (f) { f.value = ''; });
      applyFilters(tbl);
    }

    if (t.closest('[data-clear-done]')) {
      $$('.shop-item.is-done').forEach(function (i) { i.remove(); });
      updateShoppingCounts();
      toast('Itens concluídos removidos da lista.');
    }

    var removeItem = t.closest('[data-remove-item]');
    if (removeItem) {
      removeItem.closest('.shop-item').remove();
      updateShoppingCounts();
      toast('Item removido da lista.');
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('[data-ingredients] select, [data-ingredients] input')) { syncIngredient(t.closest('.ingredient-item')); }
    if (t.matches('input[name="dtValidade"]')) { $$('[data-status-preview]', t.form).forEach(updateStatusPreview); }
    if (t.matches('[data-fill-from-select]')) {
      var opt = t.options[t.selectedIndex];
      if (opt && opt.dataset.fill) { fillForm(t.form, JSON.parse(opt.dataset.fill)); }
    }
    if (t.matches('.shop-item input[type=checkbox]')) {
      t.closest('.shop-item').classList.toggle('is-done', t.checked);
      updateShoppingCounts();
    }
    var tbl = t.closest('[data-filter-table]');
    if (tbl && t.matches('[data-filter]')) { applyFilters(tbl); }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    var tbl = t.closest('[data-filter-table]');
    if (tbl && t.matches('[data-filter="q"]')) { applyFilters(tbl); }
    if (t.matches('[data-recipe-search]')) { applyRecipeFilters(); }
    if (t.matches('[data-ingredients] input')) { syncIngredient(t.closest('.ingredient-item')); }
    if (t.matches('input[name="dtValidade"]')) { $$('[data-status-preview]', t.form).forEach(updateStatusPreview); }
  });

  /* ---------- Cor do menu lateral conforme o plano pessoal ----------
     Gratuito = azul claro; pago = azul escuro original. A escolha feita no modal
     "Mudar de plano" vale só nesta aba (sessionStorage) e só em conta pessoal. */
  function applyPlanTheme(plano) {
    if (!body.classList.contains('theme-gratis') && !body.classList.contains('theme-pago')) { return; }
    try {
      if (plano) { sessionStorage.setItem('frigus-plano', plano); } else { plano = sessionStorage.getItem('frigus-plano'); }
    } catch (err) { /* sem storage: segue com o tema da página */ }
    if (!plano) { return; }
    var free = plano === 'FREE';
    body.classList.toggle('theme-gratis', free);
    body.classList.toggle('theme-pago', !free);
    var label = $('.sidebar-user small');
    if (label) { label.textContent = 'Plano ' + ({ FREE: 'Free', PLUS: 'Plus', FAMILIA: 'Família' }[plano] || plano); }
  }
  applyPlanTheme(null);

  // Formulários de demonstração: não enviam nada, só mostram o feedback
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches('[data-demo]')) { return; }
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (form.dataset.next) { location.href = form.dataset.next; return; }
    applyPlanTheme(form.elements && form.elements.plano ? form.elements.plano.value : null);
    var panel = form.closest('.drawer, .modal');
    var mode = panel ? panel.dataset.mode : 'create';
    var msg = form.getAttribute('data-toast-' + mode) || form.getAttribute('data-toast');
    closePanels();
    toast(msg || 'Alterações salvas.');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closePanels(); closeMenus(); $('.sidebar') && $('.sidebar').classList.remove('is-open'); }
  });

  /* ---------- Inicialização ---------- */
  $$('[data-filter-table]').forEach(applyFilters);
  if ($('.shop-item')) { updateShoppingCounts(); }
})();
