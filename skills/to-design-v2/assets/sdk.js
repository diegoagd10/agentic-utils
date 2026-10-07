// Injected by design-ui into the review page. Adds option picking,
// element/selection notes, a chat box, and the send controls to the
// active part, then reloads when the agent rewrites the file.
(() => {
  const parts = [...document.querySelectorAll("section[data-part]")];
  const active = parts.filter((p) => !p.hasAttribute("data-approved")).pop();
  const rows = active ? [...active.querySelectorAll("[data-row]")] : [];
  const storeKey = `dui:${location.port}:${active?.dataset.part}`;

  const state = load() ?? { selections: {}, notes: [], message: "" };
  let version = null;
  let working = false;
  let ended = false;

  injectStyles();
  const bar = buildBar();
  if (active) wireActivePart();
  render();
  watch();

  // ------------------------------------------------------------ parts

  function wireActivePart() {
    active.classList.add("dui-active");

    for (const option of active.querySelectorAll("[data-option]")) {
      const pick = el("button", "dui-pick", "Elegir esta");
      pick.type = "button";
      pick.dataset.duiUi = "";
      pick.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        choose(option);
      });
      option.prepend(pick);
      if (option.dataset.approach) {
        const tag = el("div", "dui-approach", option.dataset.approach);
        tag.dataset.duiUi = "";
        pick.after(tag);
      }
    }

    // Notes on any element of the active part, mockups included.
    let hovered = null;
    active.addEventListener("mouseover", (e) => {
      hovered?.classList.remove("dui-hover");
      hovered = ui(e.target) || working || ended ? null : e.target;
      hovered?.classList.add("dui-hover");
    });
    active.addEventListener("mouseleave", () => {
      hovered?.classList.remove("dui-hover");
      hovered = null;
    });
    active.addEventListener(
      "click",
      (e) => {
        if (ui(e.target) || working || ended) return;
        e.preventDefault();
        e.stopPropagation();
        if (String(getSelection()).trim()) return;
        openNote({ element: e.target });
      },
      true,
    );
    active.addEventListener("mouseup", (e) => {
      if (ui(e.target) || working || ended) return;
      const sel = getSelection();
      const text = String(sel).trim();
      if (!text || !active.contains(sel.anchorNode)) return;
      const node = sel.anchorNode.parentElement;
      openNote({ element: node, excerpt: text });
    });
  }

  function choose(option) {
    if (working || ended) return;
    const row = option.closest("[data-row]");
    const id = row.dataset.row;
    if (state.notes.some((n) => n.row === id)) {
      flash("Esta fila tiene notas: quítalas para elegir una opción.");
      return;
    }
    const current = state.selections[id];
    if (current?.option === option.dataset.option) {
      delete state.selections[id];
    } else {
      state.selections[id] = {
        option: option.dataset.option,
        approach: option.dataset.approach ?? "",
      };
    }
    save();
    render();
  }

  // ------------------------------------------------------------ notes

  function openNote({ element, excerpt }) {
    closeNote();
    const row = element.closest("[data-row]");
    const option = element.closest("[data-option]");
    const card = el("div", "dui-card");
    card.dataset.duiUi = "";
    const quote = excerpt ?? describe(element);
    card.append(el("div", "dui-quote", clip(quote, 160)));
    const input = el("textarea", "dui-input");
    input.placeholder = "Tu nota…";
    card.append(input);
    const actions = el("div", "dui-actions");
    const add = el("button", "dui-btn dui-primary", "Añadir a la cola");
    const cancel = el("button", "dui-btn", "Cancelar");
    actions.append(cancel, add);
    card.append(actions);

    const rect = element.getBoundingClientRect();
    card.style.top = `${scrollY + rect.bottom + 6}px`;
    card.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 360))}px`;
    document.body.append(card);
    element.classList.add("dui-target");
    input.focus();

    cancel.onclick = closeNote;
    add.onclick = () => {
      const comment = input.value.trim();
      if (!comment) return closeNote();
      const note = {
        row: row?.dataset.row ?? null,
        option: option?.dataset.option ?? null,
        target: excerpt ? "selection" : element.tagName.toLowerCase(),
        selector: selectorOf(element),
        excerpt: clip(quote, 300),
        comment,
      };
      if (note.row && state.selections[note.row]) {
        delete state.selections[note.row];
        flash("Quité la opción elegida de esa fila: o eliges o comentas.");
      }
      state.notes.push(note);
      save();
      closeNote();
      render();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNote();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add.onclick();
    });
  }

  function closeNote() {
    document.querySelector(".dui-card")?.remove();
    for (const t of document.querySelectorAll(".dui-target")) {
      t.classList.remove("dui-target");
    }
  }

  // -------------------------------------------------------------- bar

  function buildBar() {
    const root = el("div", "dui-bar");
    root.dataset.duiUi = "";
    root.innerHTML = `
      <div class="dui-status"></div>
      <ul class="dui-queue"></ul>
      <div class="dui-row">
        <textarea class="dui-input dui-chat"
          placeholder="Comentario general de esta parte…"></textarea>
        <div class="dui-buttons">
          <button type="button" class="dui-btn dui-send">Enviar feedback</button>
          <button type="button" class="dui-btn dui-primary dui-go"></button>
        </div>
      </div>`;
    document.body.append(root);
    const chat = root.querySelector(".dui-chat");
    chat.value = state.message;
    chat.addEventListener("input", () => {
      state.message = chat.value;
      save();
      render();
    });
    root.querySelector(".dui-send").onclick = () => submit("feedback");
    root.querySelector(".dui-go").onclick = () =>
      submit(rows.length ? "continue" : "approve");
    return root;
  }

  function render() {
    for (const row of rows) {
      const chosen = state.selections[row.dataset.row]?.option;
      for (const option of row.querySelectorAll("[data-option]")) {
        option.classList.toggle(
          "dui-chosen",
          option.dataset.option === chosen,
        );
        option.querySelector(".dui-pick").textContent =
          option.dataset.option === chosen ? "✓ Elegida" : "Elegir esta";
      }
    }

    const queue = bar.querySelector(".dui-queue");
    queue.replaceChildren(
      ...state.notes.map((note, i) => {
        const item = el("li", "dui-note");
        const where = note.row
          ? `${note.row}${note.option ? ` · ${note.option}` : ""}`
          : "parte";
        item.append(
          el("span", "dui-where", where),
          el("span", "", ` “${clip(note.excerpt, 50)}” — ${note.comment}`),
        );
        const remove = el("button", "dui-x", "×");
        remove.type = "button";
        remove.onclick = () => {
          state.notes.splice(i, 1);
          save();
          render();
        };
        item.append(remove);
        return item;
      }),
    );

    const hasFeedback = state.notes.length > 0 || state.message.trim() !== "";
    const allChosen = rows.every((r) => state.selections[r.dataset.row]);
    const go = bar.querySelector(".dui-go");
    go.textContent = active?.hasAttribute("data-final")
      ? "Aprobar y generar design.md"
      : rows.length
        ? "Continuar"
        : "Aprobar";
    go.disabled = !active || working || ended || hasFeedback || !allChosen;
    go.title = hasFeedback
      ? "Hay feedback en cola: envíalo o quítalo para continuar."
      : allChosen
        ? ""
        : "Elige una opción en cada fila o envía feedback.";
    bar.querySelector(".dui-send").disabled =
      !active || working || ended || !hasFeedback;
    bar.querySelector(".dui-chat").disabled = working || ended;
    bar.classList.toggle("dui-busy", working);
  }

  async function submit(action) {
    if (working || ended) return;
    const payload = {
      action,
      part: active.dataset.part,
      title: active.dataset.title ?? "",
      selections: state.selections,
      notes: state.notes,
      message: state.message.trim(),
    };
    try {
      const res = await fetch("/__feedback", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch (err) {
      flash(`No se pudo enviar (${err.message}). Tu feedback sigue en cola.`);
      return;
    }
    localStorage.removeItem(storeKey);
    working = true;
    status("Agente trabajando…");
    render();
  }

  // ------------------------------------------------------------ watch

  async function watch() {
    for (;;) {
      try {
        const res = await fetch("/__version", { cache: "no-store" });
        const v = await res.json();
        if (version !== null && v.mtime !== version) return location.reload();
        version = v.mtime;
        if (v.ended) {
          ended = true;
          status(v.ended.message || "Sesión terminada.");
          render();
          return;
        }
        if (!working) {
          status(
            v.listening
              ? ""
              : "El agente no está escuchando; tu feedback se entregará en su próximo wait.",
          );
        }
      } catch {
        if (!ended) status("Sin conexión con el servidor.");
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // ---------------------------------------------------------- helpers

  function status(text) {
    const node = bar.querySelector(".dui-status");
    if (node.textContent === text) return;
    node.textContent = text;
    node.hidden = !text;
  }

  function flash(text) {
    const toast = el("div", "dui-toast", text);
    toast.dataset.duiUi = "";
    document.body.append(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function ui(node) {
    return node instanceof Element && node.closest("[data-dui-ui]");
  }

  function describe(element) {
    const copy = element.cloneNode(true);
    for (const n of copy.querySelectorAll("[data-dui-ui]")) n.remove();
    const text = copy.textContent.trim().replace(/\s+/g, " ");
    return `<${element.tagName.toLowerCase()}> ${text}`;
  }

  function selectorOf(element) {
    const steps = [];
    for (let n = element; n && n !== active; n = n.parentElement) {
      const same = [...(n.parentElement?.children ?? [])].filter(
        (c) => c.tagName === n.tagName && !c.hasAttribute("data-dui-ui"),
      );
      const tag = n.tagName.toLowerCase();
      steps.unshift(
        same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(n) + 1})` : tag,
      );
    }
    return `section[data-part="${active.dataset.part}"] > ${steps.join(" > ")}`;
  }

  function clip(text, n) {
    return text.length > n ? text.slice(0, n - 1) + "…" : text;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(storeKey));
    } catch {
      return null;
    }
  }

  function save() {
    localStorage.setItem(storeKey, JSON.stringify(state));
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      body { padding-bottom: 14rem; }
      .dui-hover { outline: 1px dashed #94a3b8; outline-offset: 2px;
        cursor: text; }
      .dui-target { outline: 2px solid #6366f1 !important; }
      .dui-chosen { outline: 3px solid #059669 !important;
        outline-offset: 3px; }
      .dui-pick { font: 600 12px system-ui; padding: 4px 10px;
        border-radius: 999px; border: 1px solid #cbd5e1; background: #fff;
        margin-bottom: 8px; cursor: pointer; }
      .dui-chosen .dui-pick { background: #059669; color: #fff;
        border-color: #059669; }
      .dui-approach { font: 600 11px system-ui; text-transform: uppercase;
        letter-spacing: .06em; color: #64748b; margin-bottom: 8px; }
      .dui-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
        background: #fff; border-top: 1px solid #e2e8f0; padding: 10px 16px;
        font: 14px system-ui; box-shadow: 0 -4px 16px rgba(0,0,0,.05); }
      .dui-bar.dui-busy { opacity: .7; }
      .dui-status { color: #b45309; font-weight: 600; margin-bottom: 6px; }
      .dui-queue { list-style: none; margin: 0 0 6px; padding: 0;
        max-height: 7rem; overflow: auto; }
      .dui-note { display: flex; gap: 6px; align-items: baseline;
        padding: 2px 0; color: #334155; }
      .dui-where { font: 600 11px ui-monospace, monospace; color: #6366f1; }
      .dui-x { margin-left: auto; border: 0; background: none;
        cursor: pointer; color: #94a3b8; font-size: 16px; }
      .dui-row { display: flex; gap: 10px; align-items: stretch; }
      .dui-input { flex: 1; min-height: 3rem; font: 14px system-ui;
        padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;
        resize: vertical; width: 100%; box-sizing: border-box; }
      .dui-buttons { display: flex; flex-direction: column; gap: 6px; }
      .dui-btn { font: 600 13px system-ui; padding: 6px 14px;
        border-radius: 6px; border: 1px solid #cbd5e1; background: #fff;
        cursor: pointer; }
      .dui-btn:disabled { opacity: .45; cursor: not-allowed; }
      .dui-primary { background: #0f172a; color: #fff; border-color: #0f172a; }
      .dui-card { position: absolute; z-index: 60; width: 340px;
        background: #fff; border: 1px solid #cbd5e1; border-radius: 8px;
        padding: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.12);
        font: 14px system-ui; }
      .dui-quote { color: #64748b; font-size: 12px; margin-bottom: 6px;
        border-left: 3px solid #cbd5e1; padding-left: 6px; }
      .dui-actions { display: flex; justify-content: flex-end; gap: 6px;
        margin-top: 6px; }
      .dui-toast { position: fixed; top: 16px; left: 50%; z-index: 70;
        transform: translateX(-50%); background: #0f172a; color: #fff;
        padding: 8px 14px; border-radius: 6px; font: 13px system-ui; }`;
    document.head.append(style);
  }
})();
