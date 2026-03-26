/**
 * McKay Bay Lodge — Main app controller
 */

const App = (() => {

  let currentView = "calendar";

  function showView(view) {
    currentView = view;
    ["calendar","daily","guests","emails","staff"].forEach(v => {
      const btn = document.getElementById(`nav-${v}`);
      if (!btn) return;
      btn.style.background = (v === view) ? "#1e40af" : "";
      btn.style.fontWeight = (v === view) ? "600" : "";
    });
    if (view === "calendar") return Calendar.init().catch(showError);
    if (view === "daily")    return Daily.render().catch(showError);
    if (view === "guests")   return Guests.render().catch(showError);
    if (view === "emails")   return Emails.render().catch(showError);
    if (view === "staff")    return Staff.render().catch(showError);
  }

  function showLoading() {
    document.getElementById("main-content").innerHTML = `
      <div class="flex flex-col items-center justify-center py-24 text-gray-400">
        <div style="font-size:2rem;animation:spin 1s linear infinite;display:inline-block">⟳</div>
        <p class="mt-3 text-sm">Loading…</p>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  }

  function showError(err) {
    console.error(err);
    document.getElementById("main-content").innerHTML = `
      <div class="max-w-md mx-auto mt-16 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <div class="text-3xl mb-3">⚠️</div>
        <h3 class="font-bold text-red-800 mb-2">Could not load</h3>
        <p class="text-red-600 text-sm mb-4">${err.message || err}</p>
        <button class="btn btn-secondary" onclick="App.showView('${currentView}')">Try again</button>
      </div>`;
  }

  // ── Reservation detail panel (quick view before edit) ──────────────────────

  async function openReservation(resId) {
    openModal(`<div class="p-10 text-center text-gray-400">Loading…</div>`);
    try {
      const res   = await API.reservation(resId);
      const quote = await API.quote(resId).catch(() => null);
      showDetailPanel(res, quote);
    } catch (e) {
      document.getElementById("modal-content").innerHTML =
        `<div class="p-6 text-red-500">Error: ${e.message}</div>`;
    }
  }

  function showDetailPanel(res, quote) {
    const nights   = daysBetween(res.arrival_date, res.departure_date);
    const rooms    = (res.rooms    || []);
    const dietary  = (res.dietary  || []);
    const charters = (res.charters || []);
    const boats    = (res.boats    || []);

    const statusColour = {
      pending:     "bg-yellow-100 text-yellow-800",
      confirmed:   "bg-blue-100 text-blue-800",
      checked_in:  "bg-green-100 text-green-800",
      checked_out: "bg-gray-100 text-gray-700",
      cancelled:   "bg-red-100 text-red-700",
    }[res.status] || "bg-gray-100 text-gray-700";

    document.getElementById("modal-content").innerHTML = `
      <div class="p-6">
        <!-- Header -->
        <div class="flex items-start justify-between mb-5">
          <div>
            <h2 class="text-xl font-bold text-gray-900">${res.first_name} ${res.last_name}
              ${res.is_returning ? `<span class="text-sm font-normal text-yellow-600 ml-2">⭐ Returning guest</span>` : ""}
            </h2>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-sm px-2 py-0.5 rounded-full font-medium ${statusColour}">${res.status.replace("_"," ")}</span>
              <span class="text-sm text-gray-500">#${res.id} · created ${(res.created_at||"").slice(0,10)}</span>
            </div>
          </div>
          <button onclick="App.closeModal()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">&times;</button>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-5">
          <!-- Stay info -->
          <div class="bg-green-50 rounded-lg p-4">
            <div class="text-xs font-semibold text-green-700 uppercase mb-2">Stay</div>
            <div class="font-semibold">${res.arrival_date} → ${res.departure_date}</div>
            <div class="text-sm text-gray-600">${nights} night${nights !== 1 ? "s" : ""} · ${res.num_guests} guest${res.num_guests !== 1 ? "s" : ""}</div>
            ${res.arrival_time   ? `<div class="text-sm text-gray-500 mt-1">Arrival: ${res.arrival_time}</div>` : ""}
            ${res.arrival_method ? `<div class="text-sm text-gray-500">By ${res.arrival_method.replace("_"," ")}</div>` : ""}
          </div>
          <!-- Contact -->
          <div class="bg-blue-50 rounded-lg p-4">
            <div class="text-xs font-semibold text-blue-700 uppercase mb-2">Contact</div>
            ${res.phone ? `<div class="text-sm">📞 ${res.phone}</div>` : ""}
            ${res.email ? `<div class="text-sm">✉ ${res.email}</div>` : ""}
            ${!res.phone && !res.email ? `<div class="text-sm text-gray-400">No contact info</div>` : ""}
          </div>
        </div>

        <!-- Rooms -->
        <div class="mb-4">
          <div class="text-xs font-semibold text-gray-500 uppercase mb-2">Rooms</div>
          <div class="space-y-1">
            ${rooms.map(r => `
              <div class="flex justify-between items-center text-sm bg-gray-50 rounded px-3 py-2">
                <span class="font-medium">${r.accommodation_name}</span>
                <span class="text-gray-500">${r.num_guests} guest${r.num_guests!==1?"s":""}
                  · ${r.meal_package ? "🍽 meal package" : "🏠 self-contained"}
                  ${r.extra_boats ? ` · ${r.extra_boats} extra boat${r.extra_boats!==1?"s":""}` : ""}
                </span>
              </div>`).join("")}
          </div>
        </div>

        <!-- Dietary -->
        ${dietary.length ? `
        <div class="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-lg">
          <div class="text-xs font-semibold text-orange-700 uppercase mb-2">⚠ Dietary Requirements</div>
          ${dietary.map(d => `<div class="text-sm">${d.guest_desc ? `<strong>${d.guest_desc}:</strong> ` : ""}${d.requirement}</div>`).join("")}
        </div>` : ""}

        <!-- Boats -->
        ${boats.length ? `
        <div class="mb-4">
          <div class="text-xs font-semibold text-gray-500 uppercase mb-2">Boats</div>
          ${boats.map(b => `<div class="text-sm text-gray-600">⛵ ${b.boat_name || "Unnamed"} ${b.boat_length ? `(${b.boat_length})` : ""}</div>`).join("")}
        </div>` : ""}

        <!-- Charters -->
        ${charters.length ? `
        <div class="mb-4">
          <div class="text-xs font-semibold text-gray-500 uppercase mb-2">Charters</div>
          ${charters.map(c => `<div class="text-sm text-gray-600">🎣 ${c.charter_date} · ${c.charter_type} · ${c.duration.replace("_"," ")} · ${c.num_guests} guest${c.num_guests!==1?"s":""}</div>`).join("")}
        </div>` : ""}

        <!-- Special requests -->
        ${res.special_requests ? `
        <div class="mb-4 text-sm text-gray-600 bg-gray-50 rounded p-3">
          📝 ${res.special_requests}
        </div>` : ""}

        <!-- Quote -->
        ${quote ? `
        <div class="mb-5 border-t pt-4">
          <div class="text-xs font-semibold text-gray-500 uppercase mb-2">Estimated Total</div>
          <table class="w-full text-sm">
            ${quote.lines.map(l => `
              <tr class="border-b border-gray-100">
                <td class="py-1 text-gray-600">${l.description}</td>
                <td class="text-right py-1 font-medium">$${l.total.toFixed(2)}</td>
              </tr>`).join("")}
            <tr class="font-bold">
              <td class="pt-2">Total incl. tax (${quote.nights} nights)</td>
              <td class="text-right pt-2 text-green-700 text-base">$${quote.grand_total.toFixed(2)}</td>
            </tr>
          </table>
        </div>` : ""}

        <!-- Action buttons -->
        <div class="flex items-center justify-between pt-4 border-t gap-3 flex-wrap">
          <!-- Quick status change -->
          <div class="flex gap-2 flex-wrap">
            ${res.status !== "checked_in"  ? `<button class="btn btn-success text-xs py-1.5" onclick="App.changeStatus(${res.id},'checked_in')">✓ Check In</button>` : ""}
            ${res.status === "checked_in"  ? `<button class="btn btn-secondary text-xs py-1.5" onclick="App.changeStatus(${res.id},'checked_out')">Check Out</button>` : ""}
            ${res.status !== "cancelled" && res.status !== "checked_out" ? `<button class="btn btn-danger text-xs py-1.5" onclick="App.changeStatus(${res.id},'cancelled')">Cancel</button>` : ""}
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
            <button class="btn btn-primary" onclick="App.editReservation(${res.id})">✏ Edit</button>
          </div>
        </div>

        <!-- Internal notes (staff only — not visible to guest) -->
        <div class="mt-5 pt-4 border-t">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-semibold text-gray-500 uppercase">🔒 Internal Notes <span class="font-normal text-gray-400">(staff only — not sent to guest)</span></div>
            <button onclick="App.saveResNotes(${res.id})" class="btn btn-secondary text-xs py-1">Save Notes</button>
          </div>
          <textarea id="res-notes-${res.id}" rows="4"
            style="font-size:13px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;resize:vertical;"
            placeholder="Add internal notes here… e.g. John wants lunch at 1pm on Tuesday, requests extra towels, prefers room facing the water, etc."
          >${res.notes || ""}</textarea>
          <p class="text-xs text-gray-400 mt-1">These notes are visible to staff only and will never appear on guest-facing emails.</p>
        </div>
      </div>`;
  }

  function daysBetween(isoA, isoB) {
    return Math.round((new Date(isoB) - new Date(isoA)) / 86400000);
  }

  async function changeStatus(resId, status) {
    try {
      const res = await API.updateStatus(resId, status);
      const quote = await API.quote(resId).catch(() => null);
      showDetailPanel(res, quote);
      Calendar.refresh();
    } catch (e) { alert("Error: " + e.message); }
  }

  function openModal(html) {
    document.getElementById("modal-content").innerHTML = html;
    document.getElementById("modal").classList.remove("hidden");
  }

  function editReservation(resId) {
    openModal(`<div class="p-10 text-center text-gray-400">Loading…</div>`);
    Form.openEdit(resId).catch(err => {
      document.getElementById("modal-content").innerHTML =
        `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    });
  }

  function openNewReservation(date = null, accomId = null) {
    openModal(`<div class="p-10 text-center text-gray-400">Loading…</div>`);
    Form.openNew(date, accomId).catch(err => {
      document.getElementById("modal-content").innerHTML =
        `<div class="p-6 text-red-500">Error: ${err.message}</div>`;
    });
  }

  function closeModal(event) {
    if (event && event.target !== document.getElementById("modal")) return;
    document.getElementById("modal").classList.add("hidden");
    document.getElementById("modal-content").innerHTML = "";
  }

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.getElementById("modal").classList.add("hidden");
      document.getElementById("modal-content").innerHTML = "";
    }
  });

  function init() {
    showLoading();
    showView("calendar");
  }

  async function saveResNotes(resId) {
    const ta = document.getElementById(`res-notes-${resId}`);
    if (!ta) return;
    try {
      await API.saveReservationNotes(resId, ta.value);
      // Flash the textarea green briefly
      ta.style.background = "#d1fae5";
      setTimeout(() => { ta.style.background = "#fffbeb"; }, 1000);
      // Update the in-memory reservation so tooltip reflects new notes
      const cached = reservations ? reservations.find(r => r.id === resId) : null;
      if (cached) cached.notes = ta.value;
    } catch(e) { alert("Could not save notes: " + e.message); }
  }

  return {
    showView, showLoading, showError,
    openReservation, openNewReservation, editReservation, changeStatus,
    closeModal, init, saveResNotes,
  };
})();

App.init();
