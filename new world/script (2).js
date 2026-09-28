/* ==========================================================================
   Sypher Coffee Joint — site logic
   ========================================================================== */

(function () {
  "use strict";

  const DEPOSIT_RATE = 0.25;
  const fmt = (n) => "KSh " + n.toLocaleString("en-KE");

  const state = {
    catalog: [],       // loaded from /api/catalog
    selected: new Set(),
    step: 1,
    lastReservationId: null,
  };

  /* ---- Tabs ------------------------------------------------------------ */
  const panels = document.querySelectorAll("[data-panel]");

  function showTab(name) {
    panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
    document.querySelectorAll(".tabs__btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.addEventListener("click", (e) => {
    const tabEl = e.target.closest("[data-tab]");
    if (tabEl) {
      e.preventDefault();
      showTab(tabEl.dataset.tab);
    }
  });

  /* ---- Load catalog from the backend ------------------------------------ */
  async function loadCatalog() {
    try {
      const res = await fetch("/api/catalog");
      const data = await res.json();
      state.catalog = data.items || [];
    } catch (err) {
      // Fallback message if PHP isn't running (e.g. opened as a static file).
      document.getElementById("products-showcase").innerHTML =
        '<p style="color:#C1272D;">Could not load the menu — this needs to run via `vercel dev` or a deployed Vercel URL, not as a static file (see README.md).</p>';
      return;
    }
    renderShowcase();
    renderReserveSelection();
    renderPricingTable();
  }

  function groupBy(items, key) {
    return items.reduce((acc, item) => {
      const k = item[key] || "Other";
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  }

  /* ---- Showcase (Our Products & Services — display only) ---------------- */
  function renderShowcase() {
    const groups = groupBy(state.catalog, "group");
    const el = document.getElementById("products-showcase");
    el.innerHTML = Object.entries(groups)
      .map(([groupName, items]) => {
        const isFacility = items[0].category === "facility";
        return `
        <div class="category-head">
          <h3>${groupName}</h3>
          <span class="tag ${isFacility ? "tag--facility" : ""}">${isFacility ? "Facility" : "Menu"}</span>
        </div>
        <div class="item-grid">
          ${items.map(showcaseCardHTML).join("")}
        </div>`;
      })
      .join("");
  }

  function showcaseCardHTML(item) {
    return `
      <article class="item-card">
        <div class="item-card__img"><img src="${item.image}" alt="${item.name}" loading="lazy"></div>
        <div class="item-card__body">
          <div class="item-card__top">
            <h4>${item.name}</h4>
            <span class="item-card__price">${fmt(item.price)}</span>
          </div>
          <p>${item.description || ""} <span style="color:var(--text-soft)">(${item.unit || ""})</span></p>
        </div>
      </article>`;
  }

  /* ---- Reserve selection (Reserve a Table — with checkboxes) ------------- */
  function renderReserveSelection() {
    const groups = groupBy(state.catalog, "group");
    const el = document.getElementById("reserve-selection");
    el.innerHTML = Object.entries(groups)
      .map(([groupName, items]) => {
        const isFacility = items[0].category === "facility";
        return `
        <div class="category-head">
          <h3>${groupName}</h3>
          <span class="tag ${isFacility ? "tag--facility" : ""}">${isFacility ? "Facility" : "Menu"}</span>
        </div>
        <div class="item-grid">
          ${items.map(selectableCardHTML).join("")}
        </div>`;
      })
      .join("");
  }

  function selectableCardHTML(item) {
    return `
      <article class="item-card" data-item-card="${item.id}">
        <div class="item-card__img"><img src="${item.image}" alt="${item.name}" loading="lazy"></div>
        <div class="item-card__body">
          <div class="item-card__top">
            <h4>${item.name}</h4>
            <span class="item-card__price">${fmt(item.price)}</span>
          </div>
          <p>${item.description || ""} <span style="color:var(--text-soft)">(${item.unit || ""})</span></p>
          <button type="button" class="select-toggle" data-select="${item.id}" aria-pressed="false">
            <span class="select-toggle__box"></span>
            <span class="select-toggle__label">Select</span>
          </button>
        </div>
      </article>`;
  }

  /* ---- Pricing table ------------------------------------------------------ */
  function renderPricingTable() {
    const body = document.querySelector("#pricing-table tbody");
    body.innerHTML = state.catalog
      .map(
        (item) => `<tr>
          <td>${item.name}</td>
          <td class="cat">${item.category === "facility" ? "Facility" : "Menu"}</td>
          <td>${item.unit || ""}</td>
          <td class="price">${fmt(item.price)}</td>
        </tr>`
      )
      .join("");
  }

  /* ---- Selection handling ------------------------------------------------- */
  function toggleItem(id) {
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    syncSelectionUI();
  }

  function syncSelectionUI() {
    document.querySelectorAll("[data-select]").forEach((btn) => {
      const on = state.selected.has(btn.dataset.select);
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.querySelector(".select-toggle__label").textContent = on ? "Selected" : "Select";
      btn.closest(".item-card").classList.toggle("is-selected", on);
    });

    const count = state.selected.size;
    const total = totalAmount();
    document.getElementById("bar-count").textContent = count === 0 ? "0 items selected" : `${count} item${count > 1 ? "s" : ""} selected`;
    document.getElementById("bar-total").textContent = fmt(total);
    document.getElementById("booking-bar").classList.toggle("is-visible", count > 0);
  }

  function totalAmount() {
    return state.catalog.filter((i) => state.selected.has(i.id)).reduce((sum, i) => sum + i.price, 0);
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-select]");
    if (btn) toggleItem(btn.dataset.select);
  });

  /* ---- Reserve Now → jump to Reserve tab, step 1 -------------------------- */
  document.getElementById("reserve-now-btn").addEventListener("click", () => {
    showTab("reserve");
    goToStep(state.selected.size > 0 ? 2 : 1);
  });

  /* ---- Steps --------------------------------------------------------------- */
  const stepEls = document.querySelectorAll("[data-step]");
  const stepPills = document.querySelectorAll("[data-step-pill]");

  function goToStep(n) {
    if (n === 2 && state.selected.size === 0) {
      alert("Please select at least one product, food item or facility first.");
      return;
    }
    state.step = n;
    stepEls.forEach((el) => (el.style.display = Number(el.dataset.step) === n ? "" : "none"));
    stepPills.forEach((p) => p.classList.toggle("is-current", Number(p.dataset.stepPill) === n));
    if (n === 2) renderSummary();
    if (n === 3) renderPayment();
    window.scrollTo({ top: (document.getElementById("summary-step2")?.offsetTop || 0) - 140, behavior: "smooth" });
  }

  document.querySelectorAll("[data-back-to]").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(Number(btn.dataset.backTo)));
  });

  document.getElementById("to-payment-btn").addEventListener("click", async () => {
    const form = document.getElementById("reserve-form");
    if (!form.reportValidity()) return;
    await submitReservation();
  });

  function renderSummary() {
    const chosen = state.catalog.filter((i) => state.selected.has(i.id));
    const total = totalAmount();
    const rows = chosen.map((i) => `<div class="booking-summary__row"><span>${i.name}</span><span>${fmt(i.price)}</span></div>`).join("");
    document.getElementById("summary-step2").innerHTML = `
      <h3 style="margin-bottom:12px; font-size:1.05rem;">Your selection</h3>
      ${rows}
      <div class="booking-summary__total"><span>Total</span><span>${fmt(total)}</span></div>`;
  }

  function renderPayment() {
    const total = totalAmount();
    const deposit = Math.round(total * DEPOSIT_RATE);
    document.getElementById("full-amount").textContent = fmt(total);
    document.getElementById("deposit-amount").textContent = fmt(deposit);
  }

  /* ---- Submit reservation, then move to payment step ----------------------- */
  async function submitReservation() {
    const form = document.getElementById("reserve-form");
    const formData = new FormData(form);
    const payload = {
      full_name: formData.get("full_name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      visit_date: formData.get("visit_date"),
      visit_time: formData.get("visit_time"),
      party_size: formData.get("party_size"),
      notes: formData.get("notes"),
      items: Array.from(state.selected).map((id) => ({ id })),
    };

    const btn = document.getElementById("to-payment-btn");
    btn.disabled = true;
    btn.textContent = "Saving…";

    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Could not save reservation.");

      state.lastReservationId = data.reservation_id;
      goToStep(3);
    } catch (err) {
      alert("Couldn't save your reservation: " + err.message + "\n\nIf you're previewing this file directly, run `vercel dev` instead — see README.md.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Continue to payment";
    }
  }

  /* ---- Payment (Payzaapi) --------------------------------------------------- */
  document.getElementById("pay-btn").addEventListener("click", async () => {
    const statusEl = document.getElementById("pay-status");
    const payBtn = document.getElementById("pay-btn");

    if (!state.lastReservationId) {
      showStatus(statusEl, "err", "No reservation found — please go back and re-submit your details.");
      return;
    }

    payBtn.disabled = true;
    payBtn.textContent = "Processing…";
    showStatus(statusEl, "pending", "Requesting payment…");

    try {
      const email = document.getElementById("email").value;
      const phone = document.getElementById("phone").value;
      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: state.lastReservationId, phone, email }),
      });
      const data = await res.json();

      if (data.success) {
        showStatus(statusEl, "ok", `${data.message} A receipt will be emailed to you once payment is confirmed. Reservation ref: ${state.lastReservationId}`);
        payBtn.textContent = "Payment requested";
      } else {
        throw new Error(data.message || "Payment could not be started.");
      }
    } catch (err) {
      showStatus(statusEl, "err", "Couldn't reach the payment server (" + err.message + ").");
      payBtn.disabled = false;
      payBtn.textContent = "Proceed with payment";
    }
  });

  function showStatus(el, kind, msg) {
    el.className = "status-msg is-visible status-msg--" + kind;
    el.textContent = msg;
  }

  /* ---- Misc ------------------------------------------------------------------ */
  document.getElementById("year").textContent = new Date().getFullYear();
  loadCatalog();
})();
