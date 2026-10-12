// Injected by design-ui into the review page. Adds option picking, own
// answers, comment threads pinned where they were made, a collapsible
// threads panel, and the send controls. Reloads when the agent rewrites
// the file and redraws the threads when the agent replies.
(() => {
  const STRINGS = {
    en: {
      pick: "Pick this one",
      picked: "✓ Picked",
      ownAnswer: "Or write your own answer…",
      rowHasChanges: "This row has a change queued: remove it to pick an option.",
      pickCleared: "Removed the picked option in that row: a change replaces the pick.",
      notePlaceholder: "Your comment…",
      queueNote: "Add to queue",
      cancel: "Cancel",
      question: "Question",
      change: "Change",
      chatPlaceholder: "Comment on the whole part…",
      send: "Send feedback",
      finish: "Approve and write design.md",
      continue: "Continue",
      approve: "Approve",
      wholePart: "whole part",
      threads: "Threads",
      hide: "Hide",
      noThreads: "Select text or click an element to start a thread.",
      queued: "queued",
      open: "open",
      answered: "answered",
      done: "done",
      declined: "declined",
      you: "You",
      agent: "Agent",
      reply: "Reply…",
      outdated: "On an earlier version of this part",
      showChange: "See where it changed",
      partN: "Part {n}",
      openQuestions: "Questions without an answer: {n}",
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
      ownAnswer: "O escribe tu propia respuesta…",
      rowHasChanges: "Esta fila tiene un cambio en cola: quítalo para elegir una opción.",
      pickCleared: "Quité la opción elegida de esa fila: un cambio reemplaza la elección.",
      notePlaceholder: "Tu comentario…",
      queueNote: "Añadir a la cola",
      cancel: "Cancelar",
      question: "Pregunta",
      change: "Cambio",
      chatPlaceholder: "Comentario sobre toda la parte…",
      send: "Enviar feedback",
      finish: "Aprobar y generar design.md",
      continue: "Continuar",
      approve: "Aprobar",
      wholePart: "toda la parte",
      threads: "Hilos",
      hide: "Ocultar",
      noThreads: "Selecciona texto o haz clic en un elemento para abrir un hilo.",
      queued: "en cola",
      open: "abierto",
      answered: "respondido",
      done: "hecho",
      declined: "rechazado",
      you: "Tú",
      agent: "Agente",
      reply: "Responder…",
      outdated: "Sobre una versión anterior de esta parte",
      showChange: "Ver dónde cambió",
      partN: "Parte {n}",
      openQuestions: "Preguntas sin respuesta: {n}",
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

  // The server stamps the file's mtime and the threads into the page.
  const boot = window.__DUI__ ?? {
    mtime: 0,
    busy: false,
    threadsRev: 0,
    threads: [],
  };
  const version = boot.mtime;
  let threads = boot.threads;
  let threadsRev = boot.threadsRev;
  let working = boot.busy;
  let listening = true;
  let offline = false;
  let ended = null;
  let selecting = false;

  const parts = [...document.querySelectorAll("section[data-part]")];
  const active = parts.filter((p) => !p.hasAttribute("data-approved")).pop();
  const partId = active?.dataset.part;
  const rows = active ? [...active.querySelectorAll("[data-row]")] : [];
  const storeKey = `dui:${location.port}:${partId}`;
  const panelKey = "dui:panel";

  const state = {
    selections: {},
    pending: [],
    followUps: {},
    message: "",
    kind: "change",
    ...load(),
  };

  injectStyles();
  colorDiffs();
  const layer = uiNode(el("div", "dui-pins"));
  document.body.append(layer);
  const bar = buildBar();
  const { panel, tab } = buildPanel();
  if (active) wireActivePart();
  render();
  let frame = 0;
  const relayout = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      document.documentElement.style.setProperty(
        "--dui-bar",
        `${bar.offsetHeight}px`,
      );
      placePins();
    });
  };
  new ResizeObserver(relayout).observe(document.body);
  new ResizeObserver(relayout).observe(bar);
  document.addEventListener("toggle", relayout, true);
  watch();

  // ------------------------------------------------------------ parts

  function wireActivePart() {
    active.classList.add("dui-active");

    for (const option of active.querySelectorAll("[data-option]")) {
      const pick = uiNode(el("button", "dui-pick", t("pick")));
      pick.type = "button";
      pick.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        choose(option);
      });
      option.prepend(pick);
      if (option.dataset.approach) {
        pick.after(uiNode(el("div", "dui-approach", option.dataset.approach)));
      }
    }

    // Rows marked data-own-answer also take a typed answer of the
    // user's own, sent as the row's selection with option "own".
    for (const row of active.querySelectorAll("[data-row][data-own-answer]")) {
      const own = uiNode(el("textarea", "dui-input dui-own"));
      own.placeholder = t("ownAnswer");
      own.dataset.ownFor = row.dataset.row;
      own.addEventListener("input", () => answer(row, own));
      row.after(own);
    }

    // Threads on any element of the active part, mockups included.
    let hovered = null;
    active.addEventListener("mouseover", (e) => {
      hovered?.classList.remove("dui-hover");
      hovered = isUi(e.target) || working || ended ? null : e.target;
      hovered?.classList.add("dui-hover");
    });
    active.addEventListener("mouseleave", () => {
      hovered?.classList.remove("dui-hover");
      hovered = null;
    });
    active.addEventListener(
      "click",
      (e) => {
        if (isUi(e.target) || working || ended) return;
        e.preventDefault();
        e.stopPropagation();
        // The click that ends a text selection already opened its note.
        if (selecting) return void (selecting = false);
        openNote({ element: e.target });
      },
      true,
    );
    active.addEventListener("mouseup", (e) => {
      if (isUi(e.target) || working || ended) return;
      const sel = getSelection();
      const text = String(sel).trim();
      if (!text || !active.contains(sel.anchorNode)) return;
      const node = sel.anchorNode.parentElement;
      selecting = true;
      openNote({ element: node, excerpt: text });
    });
  }

  function hasChange(row) {
    return state.pending.some((n) => n.row === row && n.kind === "change");
  }

  function choose(option) {
    if (working || ended) return;
    const row = option.closest("[data-row]");
    const id = row.dataset.row;
    if (hasChange(id)) return flash(t("rowHasChanges"));
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
    renderPicks();
    renderBar();
  }

  function answer(row, own) {
    const id = row.dataset.row;
    if (hasChange(id)) {
      own.value = "";
      return flash(t("rowHasChanges"));
    }
    const text = own.value.trim();
    if (text) {
      state.selections[id] = { option: "own", answer: text };
    } else if (state.selections[id]?.option === "own") {
      delete state.selections[id];
    }
    save();
    renderPicks();
    renderBar();
  }

  // ------------------------------------------------------------ notes

  function openNote({ element, excerpt }) {
    closeNote();
    const row = element.closest("[data-row]");
    const option = element.closest("[data-option]");
    const card = uiNode(el("div", "dui-card"));
    const quote = excerpt ?? describe(element);
    card.append(el("div", "dui-quote", clip(quote, 160)));
    const input = el("textarea", "dui-input");
    input.placeholder = t("notePlaceholder");
    card.append(input);
    const actions = el("div", "dui-actions");
    const add = el("button", "dui-btn dui-primary", t("queueNote"));
    const cancel = el("button", "dui-btn", t("cancel"));
    actions.append(kindToggle(), cancel, add);
    card.append(actions);

    const rect = element.getBoundingClientRect();
    const right = innerWidth - (panelOpen() ? 380 : 0) - 380;
    card.style.top = `${scrollY + rect.bottom + 6}px`;
    card.style.left = `${Math.max(8, Math.min(rect.left, right))}px`;
    document.body.append(card);
    syncKinds();
    element.classList.add("dui-target");
    input.focus();

    cancel.onclick = closeNote;
    add.onclick = () => {
      const comment = input.value.trim();
      if (!comment) return closeNote();
      const note = {
        kind: state.kind,
        row: row?.dataset.row ?? null,
        option: option?.dataset.option ?? null,
        target: excerpt ? "selection" : element.tagName.toLowerCase(),
        selector: selectorOf(element),
        excerpt: clip(quote, 300),
        comment,
      };
      if (note.kind === "change" && note.row && state.selections[note.row]) {
        delete state.selections[note.row];
        flash(t("pickCleared"));
      }
      state.pending.push(note);
      save();
      closeNote();
      setPanel(true);
      render();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNote();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add.onclick();
    });
  }

  function closeNote() {
    document.querySelector(".dui-card")?.remove();
    for (const n of document.querySelectorAll(".dui-target")) {
      n.classList.remove("dui-target");
    }
  }

  function kindToggle() {
    const box = el("div", "dui-seg");
    for (const kind of ["question", "change"]) {
      const button = el("button", "", t(kind));
      button.type = "button";
      button.dataset.kind = kind;
      button.onclick = () => {
        state.kind = kind;
        save();
        syncKinds();
      };
      box.append(button);
    }
    return box;
  }

  function syncKinds() {
    for (const button of document.querySelectorAll(".dui-seg button")) {
      button.setAttribute("aria-pressed", String(button.dataset.kind === state.kind));
    }
  }

  // ---------------------------------------------------------- threads

  // Sent threads from the server, then this part's queued ones.
  function entries() {
    const sent = threads.map((th) => ({
      ...th,
      key: th.id,
      label: th.id.slice(1),
    }));
    const queued = state.pending.map((n, index) => ({
      ...n,
      key: `p${index}`,
      label: "+",
      index,
      part: partId,
      status: "queued",
      messages: [{ from: "user", text: n.comment }],
    }));
    return [...sent, ...queued];
  }

  // Finds what a thread is about on the current page, or null when the
  // agent has since rewritten it.
  function locate(entry) {
    if (entry.target === "part") return null;
    const node = resolve(entry.selector);
    if (!node) return null;
    if (entry.target !== "selection") {
      return clip(describe(node), 300) === entry.excerpt ? { node } : null;
    }
    // A selection can run past the element it started in, but not past
    // the option it was made on.
    const stop =
      node.closest("[data-option]") ??
      node.closest("[data-row]") ??
      node.closest("section[data-part]");
    for (let n = node; n; n = n === stop ? null : n.parentElement) {
      const range = findText(n, entry.excerpt);
      if (range) return { node: n, range };
    }
    return null;
  }

  function changedAt(entry) {
    return entry.id ? [...document.querySelectorAll(`[data-thread~="${entry.id}"]`)] : [];
  }

  function placePins() {
    for (const n of document.querySelectorAll(".dui-anchored")) {
      n.classList.remove("dui-anchored");
    }
    const ranges = [];
    const pins = [];
    for (const entry of entries()) {
      const at = locate(entry);
      if (at) {
        if (at.range) ranges.push(at.range);
        else at.node.classList.add("dui-anchored");
        pins.push(pin(entry, at.range ?? at.node, false));
      }
      for (const node of changedAt(entry)) pins.push(pin(entry, node, true));
    }
    layer.replaceChildren(...pins.filter(Boolean));
    if (globalThis.Highlight && CSS.highlights) {
      CSS.highlights.set("dui-thread", new Highlight(...ranges));
    }
  }

  function pin(entry, target, done) {
    // Hidden, e.g. inside a collapsed approved part: Chrome still lays
    // out closed <details> content, so ask for visibility directly.
    const node =
      target instanceof Range ? target.startContainer.parentElement : target;
    if (node.closest("details:not([open]) > :not(summary)")) return null;
    if (node.checkVisibility && !node.checkVisibility()) return null;
    const rect =
      target instanceof Range
        ? [...target.getClientRects()].at(-1)
        : target.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    const badge = el(
      "button",
      `dui-pin dui-k-${entry.kind}${done ? " dui-pin-done" : ""}`,
      done ? `${entry.label} ✓` : entry.label,
    );
    badge.type = "button";
    badge.style.top = `${scrollY + rect.top - 9}px`;
    // The original spot gets its pin top-right; where it changed, just
    // left of the element, clear of its text.
    badge.style.left = `${scrollX + (done ? rect.left - 4 : rect.right - 4)}px`;
    badge.onclick = () => focusThread(entry.key);
    return badge;
  }

  function focusThread(key) {
    setPanel(true);
    const card = panel.querySelector(`[data-key="${key}"]`);
    if (!card) return;
    card.closest("details")?.setAttribute("open", "");
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    pulse(card);
  }

  function showInPage(nodeOrRange) {
    const node =
      nodeOrRange instanceof Range
        ? nodeOrRange.startContainer.parentElement
        : nodeOrRange;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    pulse(node);
  }

  // ------------------------------------------------------------ panel

  function buildPanel() {
    const panel = uiNode(el("aside", "dui-panel"));
    const head = el("div", "dui-panel-head");
    const hide = el("button", "dui-btn", `${t("hide")} »`);
    hide.type = "button";
    hide.onclick = () => setPanel(false);
    head.append(el("span", "dui-panel-title"), hide);
    panel.append(head, el("div", "dui-threads"));
    const tab = uiNode(el("button", "dui-tab"));
    tab.type = "button";
    tab.onclick = () => setPanel(true);
    document.body.append(panel, tab);
    setPanel(localStorage.getItem(panelKey) !== "closed");
    return { panel, tab };
  }

  function panelOpen() {
    return document.documentElement.classList.contains("dui-panel-open");
  }

  function setPanel(open) {
    document.documentElement.classList.toggle("dui-panel-open", open);
    localStorage.setItem(panelKey, open ? "open" : "closed");
  }

  function renderPanel() {
    // Keep the caret in a reply being typed across redraws.
    const typing = document.activeElement?.dataset?.followFor;
    const caret = document.activeElement?.selectionStart;

    const list = panel.querySelector(".dui-threads");
    const all = entries();
    const mine = all.filter((e) => active && e.part === partId);
    list.replaceChildren(...mine.map((e) => threadCard(e, true)));
    if (active && !mine.length) {
      list.append(el("p", "dui-empty", t("noThreads")));
    }
    for (const part of parts) {
      if (part === active) continue;
      const group = all.filter((e) => e.part === part.dataset.part);
      if (!group.length) continue;
      const box = el("details", "dui-group");
      const n = part.dataset.part;
      box.append(
        el("summary", "", `${t("partN", { n })} · ${part.dataset.title ?? ""} (${group.length})`),
        ...group.map((e) => threadCard(e, false)),
      );
      list.append(box);
    }

    const title = `${t("threads")} (${mine.length})`;
    panel.querySelector(".dui-panel-title").textContent = title;
    tab.textContent = `« ${title}`;

    if (typing) {
      const input = list.querySelector(`[data-follow-for="${typing}"]`);
      input?.focus();
      input?.setSelectionRange(caret, caret);
    }
  }

  function threadCard(entry, live) {
    const card = el("div", `dui-thread${entry.status === "queued" ? " dui-queued" : ""}`);
    card.dataset.key = entry.key;

    const head = el("div", "dui-thread-head");
    head.append(
      el("span", `dui-num dui-k-${entry.kind}`, entry.label),
      el("span", "dui-kind", t(entry.kind)),
      el("span", `dui-state dui-s-${entry.status}`, t(entry.status)),
      el("span", "dui-where", where(entry)),
    );
    if (entry.status === "queued") {
      const remove = el("button", "dui-x", "×");
      remove.type = "button";
      remove.onclick = () => {
        state.pending.splice(entry.index, 1);
        save();
        render();
      };
      head.append(remove);
    }
    card.append(head);

    if (entry.excerpt) card.append(el("div", "dui-quote", clip(entry.excerpt, 160)));
    const at = locate(entry);
    if (live && entry.target !== "part" && !at) {
      card.append(el("div", "dui-outdated", t("outdated")));
    }
    for (const m of entry.messages) {
      const msg = el("div", `dui-msg dui-from-${m.from}`);
      msg.append(el("b", "", t(m.from === "agent" ? "agent" : "you")), m.text);
      card.append(msg);
    }

    const changed = changedAt(entry);
    if (changed.length) {
      const link = el("button", "dui-link", t("showChange"));
      link.type = "button";
      link.onclick = () => showInPage(changed[0]);
      card.append(link);
    }

    if (live && entry.id) {
      const input = el("textarea", "dui-input dui-follow");
      input.placeholder = t("reply");
      input.dataset.followFor = entry.id;
      input.value = state.followUps[entry.id] ?? "";
      input.disabled = working || Boolean(ended);
      input.addEventListener("input", () => {
        if (input.value.trim()) state.followUps[entry.id] = input.value;
        else delete state.followUps[entry.id];
        save();
        renderBar();
      });
      card.append(input);
    }

    card.addEventListener("click", (e) => {
      if (e.target.closest("button, textarea")) return;
      if (at) showInPage(at.range ?? at.node);
      else if (changed.length) showInPage(changed[0]);
    });
    return card;
  }

  function where(entry) {
    if (entry.row) return `${entry.row}${entry.option ? ` · ${entry.option}` : ""}`;
    return entry.target === "part" ? t("wholePart") : "";
  }

  // -------------------------------------------------------------- bar

  function buildBar() {
    const root = uiNode(el("div", "dui-bar"));
    root.innerHTML = `
      <div class="dui-status"></div>
      <div class="dui-warn"></div>
      <div class="dui-row">
        <textarea class="dui-input dui-chat"></textarea>
        <div class="dui-buttons">
          <button type="button" class="dui-btn dui-send"></button>
          <button type="button" class="dui-btn dui-primary dui-go"></button>
        </div>
      </div>`;
    root.querySelector(".dui-buttons").prepend(kindToggle());
    document.body.append(root);
    const chat = root.querySelector(".dui-chat");
    chat.placeholder = t("chatPlaceholder");
    root.querySelector(".dui-send").textContent = t("send");
    chat.value = state.message;
    chat.addEventListener("input", () => {
      state.message = chat.value;
      save();
      renderBar();
    });
    root.querySelector(".dui-send").onclick = () => submit("feedback");
    root.querySelector(".dui-go").onclick = () =>
      submit(rows.length ? "continue" : "approve");
    return root;
  }

  function render() {
    renderPicks();
    renderBar();
    renderPanel();
    placePins();
  }

  function renderPicks() {
    for (const row of rows) {
      const chosen = state.selections[row.dataset.row]?.option;
      for (const option of row.querySelectorAll("[data-option]")) {
        option.classList.toggle("dui-chosen", option.dataset.option === chosen);
        option.querySelector(".dui-pick").textContent =
          option.dataset.option === chosen ? t("picked") : t("pick");
      }
    }
    for (const own of document.querySelectorAll(".dui-own")) {
      const selection = state.selections[own.dataset.ownFor];
      const text = selection?.option === "own" ? selection.answer : "";
      // Leave what is being typed alone, trailing spaces included.
      if (own.value.trim() !== text) own.value = text;
      own.classList.toggle("dui-chosen", Boolean(text));
      own.disabled = working || Boolean(ended);
    }
  }

  function renderBar() {
    const off = !active || working || Boolean(ended);
    const hasFeedback =
      state.pending.length > 0 ||
      Object.keys(state.followUps).length > 0 ||
      state.message.trim() !== "";
    const allChosen = rows.every((r) => state.selections[r.dataset.row]);
    const go = bar.querySelector(".dui-go");
    go.textContent = active?.hasAttribute("data-final")
      ? t("finish")
      : rows.length
        ? t("continue")
        : t("approve");
    go.disabled = off || hasFeedback || !allChosen;
    go.title = hasFeedback ? t("feedbackQueued") : allChosen ? "" : t("pickEachRow");
    bar.querySelector(".dui-send").disabled = off || !hasFeedback;
    bar.querySelector(".dui-chat").disabled = working || Boolean(ended);
    bar.classList.toggle("dui-busy", working && !ended);

    // Open questions only warn: the user may approve without answers.
    const unanswered = threads.filter(
      (th) => th.part === partId && th.kind === "question" && th.status === "open",
    ).length;
    show(".dui-warn", unanswered && !working ? t("openQuestions", { n: unanswered }) : "");
    show(
      ".dui-status",
      ended
        ? ended.message || t("ended")
        : offline
          ? t("offline")
          : working
            ? t("working")
            : listening
              ? ""
              : t("notListening"),
    );
    syncKinds();
  }

  async function submit(action) {
    if (working || ended) return;
    const payload = {
      action,
      part: partId,
      title: active.dataset.title ?? "",
      selections: state.selections,
    };
    if (action === "feedback") {
      const fresh = [...state.pending];
      if (state.message.trim()) {
        fresh.push({
          kind: state.kind,
          row: null,
          option: null,
          target: "part",
          selector: `section[data-part="${partId}"]`,
          excerpt: "",
          comment: state.message.trim(),
        });
      }
      const followUps = Object.entries(state.followUps).map(([thread, comment]) => ({
        thread,
        comment: comment.trim(),
      }));
      const kinds = [
        ...fresh.map((n) => n.kind),
        ...followUps.map((f) => threads.find((th) => th.id === f.thread)?.kind),
      ];
      // Questions alone are answered in their threads; the part stays.
      payload.action = kinds.every((k) => k === "question") ? "ask" : "feedback";
      payload.threads = fresh;
      payload.followUps = followUps;
    }

    let reply;
    try {
      const res = await fetch("/__feedback", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      reply = await res.json();
    } catch (err) {
      flash(t("sendFailed", { error: err.message }));
      return;
    }
    if (action === "feedback") {
      // Picks stay: an answered question leaves the part as it is.
      state.pending = [];
      state.followUps = {};
      state.message = "";
      bar.querySelector(".dui-chat").value = "";
      save();
    } else {
      localStorage.removeItem(storeKey);
    }
    threads = reply.threads;
    threadsRev = reply.threadsRev;
    working = true;
    render();
  }

  // ------------------------------------------------------------ watch

  async function watch() {
    for (;;) {
      try {
        const res = await fetch("/__version", { cache: "no-store" });
        const v = await res.json();
        if (v.mtime !== version) return location.reload();
        const wasWorking = working;
        offline = false;
        listening = v.listening;
        working = v.busy;
        ended = v.ended;
        if (v.threadsRev !== threadsRev) {
          const r = await fetch("/__threads", { cache: "no-store" });
          ({ threads, threadsRev } = await r.json());
          render();
        } else if (wasWorking !== working || ended) {
          render();
        } else {
          renderBar();
        }
        if (ended) return;
      } catch {
        offline = true;
        renderBar();
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // ---------------------------------------------------------- helpers

  function show(selector, text) {
    const node = bar.querySelector(selector);
    if (node.textContent !== text) node.textContent = text;
    node.hidden = !text;
  }

  function flash(text) {
    const toast = uiNode(el("div", "dui-toast", text));
    document.body.append(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function pulse(node) {
    node.classList.remove("dui-pulse");
    void node.offsetWidth;
    node.classList.add("dui-pulse");
  }

  // Trees are written as diffs: color + and - lines like a diff viewer.
  // Works through markup the agent put inside the <pre>, such as a
  // data-thread span around changed lines.
  function colorDiffs() {
    // Tree lines glue the sign to the branch (`+├──`, `+test/`); a
    // leading `--` is a flag, not a removal.
    const kindOf = (line) =>
      /^\+/.test(line) ? "dui-add" : /^-(?!-)/.test(line) ? "dui-del" : null;
    for (const pre of document.querySelectorAll("pre")) {
      const kinds = pre.textContent.split("\n").map(kindOf);
      if (!kinds.some(Boolean)) continue;
      const nodes = [];
      const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode()); ) nodes.push(n);
      let line = 0;
      for (const node of nodes) {
        const pieces = el("span");
        node.data.split("\n").forEach((piece, i) => {
          if (i) {
            pieces.append("\n");
            line++;
          }
          if (piece) pieces.append(kinds[line] ? el("span", kinds[line], piece) : piece);
        });
        node.replaceWith(...pieces.childNodes);
      }
    }
  }

  // Finds text in root, whitespace-insensitive, skipping injected UI.
  function findText(root, excerpt) {
    const want = excerpt.replace(/…$/, "").replace(/\s+/g, " ").trim();
    if (!want) return null;
    const map = [];
    let all = "";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      if (isUi(n.parentElement)) continue;
      for (let i = 0; i < n.data.length; i++) {
        const c = /\s/.test(n.data[i]) ? " " : n.data[i];
        if (c === " " && all.endsWith(" ")) continue;
        all += c;
        map.push([n, i]);
      }
    }
    const at = all.indexOf(want);
    if (at < 0) return null;
    const [startNode, startOffset] = map[at];
    const [endNode, endOffset] = map[at + want.length - 1];
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset + 1);
    return range;
  }

  function isUi(node) {
    return node instanceof Element && node.closest("[data-dui-ui]");
  }

  function uiNode(node) {
    node.dataset.duiUi = "";
    return node;
  }

  function describe(element) {
    const copy = element.cloneNode(true);
    for (const n of copy.querySelectorAll("[data-dui-ui]")) n.remove();
    const text = copy.textContent.trim().replace(/\s+/g, " ");
    return `<${element.tagName.toLowerCase()}> ${text}`;
  }

  // Counts siblings without injected UI, so resolve() finds the same
  // element before and after the controls are added.
  function selectorOf(element) {
    const steps = [`section[data-part="${partId}"]`];
    const path = [];
    for (let n = element; n && n !== active; n = n.parentElement) {
      const same = [...(n.parentElement?.children ?? [])].filter(
        (c) => c.tagName === n.tagName && !c.hasAttribute("data-dui-ui"),
      );
      const tag = n.tagName.toLowerCase();
      path.unshift(
        same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(n) + 1})` : tag,
      );
    }
    return [...steps, ...path].join(" > ");
  }

  function resolve(selector) {
    const [head, ...steps] = selector.split(" > ");
    let node;
    try {
      node = document.querySelector(head);
    } catch {
      return null;
    }
    for (const step of steps) {
      if (!node) return null;
      const [, tag, nth] = step.match(/^([\w-]+)(?::nth-of-type\((\d+)\))?$/) ?? [];
      if (!tag) return null;
      const same = [...node.children].filter(
        (c) => c.tagName.toLowerCase() === tag && !c.hasAttribute("data-dui-ui"),
      );
      node = same[(Number(nth) || 1) - 1];
    }
    return node ?? null;
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
      html.dui-panel-open body { padding-right: 380px; }
      .dui-add { color: #86efac; background: rgba(34,197,94,.12); }
      .dui-del { color: #fca5a5; background: rgba(239,68,68,.12); }
      .dui-hover { outline: 1px dashed #64748b; outline-offset: 2px;
        cursor: text; }
      .dui-target { outline: 2px solid #818cf8 !important; }
      .dui-anchored { outline: 1px dotted #818cf8; outline-offset: 2px; }
      ::highlight(dui-thread) { background-color: rgba(129,140,248,.3); }
      .dui-chosen { outline: 3px solid #10b981 !important;
        outline-offset: 3px; }
      .dui-pick { font: 600 12px system-ui; padding: 4px 10px;
        border-radius: 999px; border: 1px solid #334155; background: #1e293b;
        color: #e2e8f0; margin-bottom: 8px; cursor: pointer; }
      .dui-chosen .dui-pick { background: #059669; color: #fff;
        border-color: #10b981; }
      .dui-input.dui-own { display: block; min-height: 2.5rem; margin-top: 12px; }
      .dui-own.dui-chosen { outline-offset: 0; }
      .dui-approach { font: 600 11px system-ui; text-transform: uppercase;
        letter-spacing: .06em; color: #94a3b8; margin-bottom: 8px; }
      .dui-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
        background: #0f172a; border-top: 1px solid #1e293b; padding: 10px 16px;
        color: #cbd5e1; font: 14px system-ui;
        box-shadow: 0 -4px 16px rgba(0,0,0,.4); }
      .dui-bar.dui-busy .dui-row { opacity: .7; }
      .dui-status { color: #fbbf24; font-weight: 600; margin-bottom: 6px; }
      .dui-warn { color: #7dd3fc; font-size: 12px; margin-bottom: 6px; }
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
      .dui-seg { display: flex; border: 1px solid #334155; border-radius: 6px;
        overflow: hidden; }
      .dui-seg button { flex: 1; font: 600 12px system-ui; padding: 4px 8px;
        border: 0; background: #1e293b; color: #94a3b8; cursor: pointer; }
      .dui-seg button[aria-pressed="true"] { background: #475569; color: #f8fafc; }
      .dui-card { position: absolute; z-index: 60; width: 360px;
        background: #0f172a; border: 1px solid #334155; border-radius: 8px;
        padding: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.5);
        color: #e2e8f0; font: 14px system-ui; }
      .dui-quote { color: #94a3b8; font-size: 12px; margin-bottom: 6px;
        border-left: 3px solid #334155; padding-left: 6px; }
      .dui-actions { display: flex; justify-content: flex-end; gap: 6px;
        margin-top: 6px; }
      .dui-actions .dui-seg { margin-right: auto; }
      .dui-panel { position: fixed; top: 0; right: 0; z-index: 55;
        bottom: var(--dui-bar, 0px); width: 360px; display: none;
        flex-direction: column; background: #0f172a; color: #cbd5e1;
        border-left: 1px solid #1e293b; font: 13px system-ui;
        box-shadow: -4px 0 16px rgba(0,0,0,.4); }
      html.dui-panel-open .dui-panel { display: flex; }
      .dui-panel-head { display: flex; align-items: center;
        justify-content: space-between; padding: 10px 12px;
        border-bottom: 1px solid #1e293b; font-weight: 600; color: #e2e8f0; }
      .dui-threads { overflow: auto; padding: 10px 12px; display: flex;
        flex-direction: column; gap: 10px; }
      .dui-tab { position: fixed; right: 0; top: 40%; z-index: 55;
        writing-mode: vertical-rl; padding: 12px 6px; cursor: pointer;
        border: 1px solid #334155; border-right: 0;
        border-radius: 6px 0 0 6px; background: #1e293b; color: #e2e8f0;
        font: 600 12px system-ui; }
      html.dui-panel-open .dui-tab { display: none; }
      .dui-thread { border: 1px solid #1e293b; border-radius: 8px;
        padding: 8px; background: #020617; cursor: pointer; }
      .dui-thread.dui-queued { border-style: dashed; border-color: #475569; }
      .dui-thread-head { display: flex; gap: 6px; align-items: center;
        flex-wrap: wrap; margin-bottom: 6px; }
      .dui-num, .dui-pin { display: inline-flex; align-items: center;
        justify-content: center; min-width: 18px; height: 18px;
        padding: 0 5px; border-radius: 999px; font: 700 11px system-ui;
        color: #0f172a; }
      .dui-k-question { background: #7dd3fc; }
      .dui-k-change { background: #fbbf24; }
      .dui-kind { font-weight: 600; color: #e2e8f0; }
      .dui-state { font: 600 10px system-ui; text-transform: uppercase;
        letter-spacing: .05em; padding: 1px 6px; border-radius: 999px;
        border: 1px solid currentColor; }
      .dui-s-queued { color: #a5b4fc; }
      .dui-s-open { color: #fbbf24; }
      .dui-s-answered { color: #7dd3fc; }
      .dui-s-done { color: #34d399; }
      .dui-s-declined { color: #94a3b8; }
      .dui-outdated { font-size: 11px; font-style: italic; color: #f59e0b;
        margin-bottom: 4px; }
      .dui-msg { margin-top: 4px; white-space: pre-wrap; }
      .dui-msg b { color: #94a3b8; margin-right: 6px; }
      .dui-from-agent b { color: #34d399; }
      .dui-link { border: 0; background: none; padding: 0; margin-top: 6px;
        color: #a5b4fc; text-decoration: underline; cursor: pointer;
        font: 12px system-ui; }
      .dui-input.dui-follow { min-height: 2rem; margin-top: 6px;
        font-size: 13px; }
      .dui-group summary { cursor: pointer; color: #94a3b8; font-weight: 600;
        margin: 4px 0 8px; }
      .dui-group .dui-thread { margin-bottom: 8px; }
      .dui-empty { color: #64748b; }
      .dui-pins { position: absolute; top: 0; left: 0; width: 0; height: 0; }
      .dui-pin { position: absolute; z-index: 45; cursor: pointer;
        border: 2px solid #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,.5);
        white-space: nowrap; }
      .dui-pin-done { background: #34d399; transform: translateX(-100%); }
      .dui-pulse { animation: dui-pulse 1.4s ease-out; }
      @keyframes dui-pulse { from { box-shadow: 0 0 0 4px #818cf8; }
        to { box-shadow: 0 0 0 4px transparent; } }
      .dui-toast { position: fixed; top: 16px; left: 50%; z-index: 70;
        transform: translateX(-50%); background: #e2e8f0; color: #0f172a;
        padding: 8px 14px; border-radius: 6px; font: 13px system-ui; }`;
    document.head.append(style);
  }
})();
