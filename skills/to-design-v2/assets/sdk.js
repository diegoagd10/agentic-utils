// Injected by design-ui into the review page. Adds option picking,
// element/selection notes, a chat box, and the send controls to the
// active part, then reloads when the agent rewrites the file.
(() => {
  const STRINGS = {
    en: {
      pick: "Pick this one",
      picked: "✓ Picked",
      rowHasNotes: "This row has notes: remove them to pick an option.",
      pickCleared: "Removed the picked option in that row: pick or comment, not both.",
      notePlaceholder: "Your note…",
      queueNote: "Add to queue",
      cancel: "Cancel",
      chatPlaceholder: "General comment on this part…",
      send: "Send feedback",
      finish: "Approve and write design.md",
      continue: "Continue",
      approve: "Approve",
      part: "part",
      feedbackQueued: "Feedback is queued: send or remove it to continue.",
      pickEachRow: "Pick an option in every row or send feedback.",
      sendFailed: "Could not send ({error}). Your feedback is still queued.",
      working: "Agent working…",
      ended: "Session ended.",
      notListening: "The agent is not listening; your feedback arrives on its next wait.",
      offline: "No connection to the server.",
    },
    es: {
      pick: "Elegir esta",
      picked: "✓ Elegida",
      rowHasNotes: "Esta fila tiene notas: quítalas para elegir una opción.",
      pickCleared: "Quité la opción elegida de esa fila: o eliges o comentas.",
      notePlaceholder: "Tu nota…",
      queueNote: "Añadir a la cola",
      cancel: "Cancelar",
      chatPlaceholder: "Comentario general de esta parte…",
      send: "Enviar feedback",
      finish: "Aprobar y generar design.md",
      continue: "Continuar",
      approve: "Aprobar",
      part: "parte",
      feedbackQueued: "Hay feedback en cola: envíalo o quítalo para continuar.",
      pickEachRow: "Elige una opción en cada fila o envía feedback.",
      sendFailed: "No se pudo enviar ({error}). Tu feedback sigue en cola.",
      working: "Agente trabajando…",
      ended: "Sesión terminada.",
      notListening: "El agente no está escuchando; tu feedback se entregará en su próximo wait.",
      offline: "Sin conexión con el servidor.",
    },
  };
  // The page's lang picks the strings; a data-dui-strings JSON block in
  // the page overrides them for any other language.
  const lang = document.documentElement.lang.slice(0, 2).toLowerCase();
  const strings = {
    ...STRINGS.en,
    ...STRINGS[lang],
    ...JSON.parse(
      document.querySelector("script[data-dui-strings]")?.textContent || "{}",
    ),
  };
  const t = (key, vars = {}) =>
    strings[key].replace(/\{(\w+)\}/g, (_, k) => vars[k]);

  const parts = [...document.querySelectorAll("section[data-part]")];
  const active = parts.filter((p) => !p.hasAttribute("data-approved")).pop();
  const rows = active ? [...active.querySelectorAll("[data-row]")] : [];
  const storeKey = `dui:${location.port}:${active?.dataset.part}`;
  const sentKey = `dui:${location.port}:sent`;

  const state = load() ?? { selections: {}, notes: [], message: "" };
  // The server stamps the file's mtime into the page it serves.
  const version = window.__DUI_MTIME__;
  // Feedback sent for this version stays "working" across reloads.
  let working = sessionStorage.getItem(sentKey) === String(version);
  let ended = false;
  let selecting = false;

  injectStyles();
  const bar = buildBar();
  if (active) wireActivePart();
  render();
  watch();

  // ------------------------------------------------------------ parts

  function wireActivePart() {
    active.classList.add("dui-active");

    for (const option of active.querySelectorAll("[data-option]")) {
      const pick = el("button", "dui-pick", t("pick"));
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
        // The click that ends a text selection already opened its note.
        if (selecting) return void (selecting = false);
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
      selecting = true;
      openNote({ element: node, excerpt: text });
    });
  }

  function choose(option) {
    if (working || ended) return;
    const row = option.closest("[data-row]");
    const id = row.dataset.row;
    if (state.notes.some((n) => n.row === id)) {
      flash(t("rowHasNotes"));
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
    input.placeholder = t("notePlaceholder");
    card.append(input);
    const actions = el("div", "dui-actions");
    const add = el("button", "dui-btn dui-primary", t("queueNote"));
    const cancel = el("button", "dui-btn", t("cancel"));
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
        flash(t("pickCleared"));
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
        <textarea class="dui-input dui-chat"></textarea>
        <div class="dui-buttons">
          <button type="button" class="dui-btn dui-send"></button>
          <button type="button" class="dui-btn dui-primary dui-go"></button>
        </div>
      </div>`;
    document.body.append(root);
    const chat = root.querySelector(".dui-chat");
    chat.placeholder = t("chatPlaceholder");
    root.querySelector(".dui-send").textContent = t("send");
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
          option.dataset.option === chosen ? t("picked") : t("pick");
      }
    }

    const queue = bar.querySelector(".dui-queue");
    queue.replaceChildren(
      ...state.notes.map((note, i) => {
        const item = el("li", "dui-note");
        const where = note.row
          ? `${note.row}${note.option ? ` · ${note.option}` : ""}`
          : t("part");
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
      ? t("finish")
      : rows.length
        ? t("continue")
        : t("approve");
    go.disabled = !active || working || ended || hasFeedback || !allChosen;
    go.title = hasFeedback
      ? t("feedbackQueued")
      : allChosen
        ? ""
        : t("pickEachRow");
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
      flash(t("sendFailed", { error: err.message }));
      return;
    }
    localStorage.removeItem(storeKey);
    sessionStorage.setItem(sentKey, String(version));
    working = true;
    status(t("working"));
    render();
  }

  // ------------------------------------------------------------ watch

  async function watch() {
    for (;;) {
      try {
        const res = await fetch("/__version", { cache: "no-store" });
        const v = await res.json();
        if (v.mtime !== version) return location.reload();
        if (v.ended) {
          ended = true;
          status(v.ended.message || t("ended"));
          render();
          return;
        }
        if (working) {
          status(t("working"));
        } else {
          status(
            v.listening
              ? ""
              : t("notListening"),
          );
        }
      } catch {
        if (!ended) status(t("offline"));
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
      .dui-hover { outline: 1px dashed #64748b; outline-offset: 2px;
        cursor: text; }
      .dui-target { outline: 2px solid #818cf8 !important; }
      .dui-chosen { outline: 3px solid #10b981 !important;
        outline-offset: 3px; }
      .dui-pick { font: 600 12px system-ui; padding: 4px 10px;
        border-radius: 999px; border: 1px solid #334155; background: #1e293b;
        color: #e2e8f0; margin-bottom: 8px; cursor: pointer; }
      .dui-chosen .dui-pick { background: #059669; color: #fff;
        border-color: #10b981; }
      .dui-approach { font: 600 11px system-ui; text-transform: uppercase;
        letter-spacing: .06em; color: #94a3b8; margin-bottom: 8px; }
      .dui-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
        background: #0f172a; border-top: 1px solid #1e293b; padding: 10px 16px;
        color: #cbd5e1; font: 14px system-ui;
        box-shadow: 0 -4px 16px rgba(0,0,0,.4); }
      .dui-bar.dui-busy { opacity: .7; }
      .dui-status { color: #fbbf24; font-weight: 600; margin-bottom: 6px; }
      .dui-queue { list-style: none; margin: 0 0 6px; padding: 0;
        max-height: 7rem; overflow: auto; }
      .dui-note { display: flex; gap: 6px; align-items: baseline;
        padding: 2px 0; color: #cbd5e1; }
      .dui-where { font: 600 11px ui-monospace, monospace; color: #a5b4fc; }
      .dui-x { margin-left: auto; border: 0; background: none;
        cursor: pointer; color: #64748b; font-size: 16px; }
      .dui-row { display: flex; gap: 10px; align-items: stretch; }
      .dui-input { flex: 1; min-height: 3rem; font: 14px system-ui;
        padding: 6px 8px; border: 1px solid #334155; border-radius: 6px;
        background: #020617; color: #e2e8f0;
        resize: vertical; width: 100%; box-sizing: border-box; }
      .dui-buttons { display: flex; flex-direction: column; gap: 6px; }
      .dui-btn { font: 600 13px system-ui; padding: 6px 14px;
        border-radius: 6px; border: 1px solid #334155; background: #1e293b;
        color: #e2e8f0; cursor: pointer; }
      .dui-btn:disabled { opacity: .45; cursor: not-allowed; }
      .dui-primary { background: #e2e8f0; color: #0f172a; border-color: #e2e8f0; }
      .dui-card { position: absolute; z-index: 60; width: 340px;
        background: #0f172a; border: 1px solid #334155; border-radius: 8px;
        padding: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.5);
        color: #e2e8f0; font: 14px system-ui; }
      .dui-quote { color: #94a3b8; font-size: 12px; margin-bottom: 6px;
        border-left: 3px solid #334155; padding-left: 6px; }
      .dui-actions { display: flex; justify-content: flex-end; gap: 6px;
        margin-top: 6px; }
      .dui-toast { position: fixed; top: 16px; left: 50%; z-index: 70;
        transform: translateX(-50%); background: #e2e8f0; color: #0f172a;
        padding: 8px 14px; border-radius: 6px; font: 13px system-ui; }`;
    document.head.append(style);
  }
})();
