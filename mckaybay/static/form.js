/**
 * McKay Bay Lodge — Reservation Form (create & edit)
 */

const Form = (() => {

  let accommodations    = [];
  let currentRes        = null;   // null = new, object = editing
  let presetDate        = null;
  let presetAccom       = null;
  let guestSearchTimer  = null;

  // Rooms, dietary, boats, charters are stored as arrays and rendered dynamically
  let rooms     = [];
  let dietary   = [];
  let boats     = [];
  let charters  = [];

  // ── Open helpers ────────────────────────────────────────────────────────────

  async function openNew(date = null, accomId = null) {
    accommodations = await API.accommodations();
    currentRes  = null;
    presetDate  = date;
    presetAccom = accomId;

    // Default one room
    rooms = [{
      accommodation_id: accomId || (accommodations[0] && accommodations[0].id),
      num_guests: 2, meal_package: true, extra_boats: 0,
      single_supplement: false, custom_rate: null,
    }];
    dietary  = [];
    boats    = [];
    charters = [];

    render();
  }

  async function openEdit(resId) {
    accommodations = await API.accommodations();
    const res = await API.reservation(resId);
    currentRes = res;

    rooms = res.rooms.map(r => ({
      accommodation_id:  r.accommodation_id,
      num_guests:        r.num_guests,
      meal_package:      !!r.meal_package,
      extra_boats:       r.extra_boats || 0,
      single_supplement: !!r.single_supplement,
      custom_rate:       r.custom_rate != null ? r.custom_rate : null,
    }));
    dietary  = res.dietary.map(d => ({...d}));
    boats    = res.boats.map(b => ({...b}));
    charters = res.charters.map(c => ({...c}));

    render();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  function render() {
    const res   = currentRes;
    const isNew = !res;
    const title = isNew ? "New Reservation" : `Edit Reservation — ${res.first_name} ${res.last_name}`;

    document.getElementById("modal-content").innerHTML = `
      <div class="p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-xl font-bold text-gray-900">${title}</h2>
          <button onclick="App.closeModal()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <!-- Guest -->
        <div class="mb-5 p-4 bg-blue-50 rounded-lg">
          <h3 class="font-semibold text-blue-900 mb-3">👤 Primary Contact</h3>
          ${isNew ? `<p class="text-xs text-blue-600 mb-2">Start typing a name to find a returning guest, or fill in new guest details below.</p>` : ""}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label>First Name *</label>
              <input id="f-first" value="${esc(res?.first_name||"")}" placeholder="First name"
                oninput="Form.searchGuests()" />
            </div>
            <div style="position:relative">
              <label>Last Name *</label>
              <input id="f-last" value="${esc(res?.last_name||"")}" placeholder="Last name"
                oninput="Form.searchGuests()"
                onblur="Form.hideGuestSuggestions()" />
              <div id="guest-suggestions"
                style="display:none;position:absolute;top:100%;left:0;right:0;z-index:50;
                       background:white;border:1px solid #d1d5db;border-radius:6px;
                       box-shadow:0 4px 12px rgba(0,0,0,0.15);max-height:210px;overflow-y:auto"
                onmousedown="event.preventDefault()"></div>
            </div>
            <div>
              <label>Phone</label>
              <input id="f-phone" value="${esc(res?.phone||"")}" placeholder="e.g. 604-555-0123" />
            </div>
            <div>
              <label>Email</label>
              <input id="f-email" type="email" value="${esc(res?.email||"")}" placeholder="email@example.com" />
            </div>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <input type="checkbox" id="f-returning" ${res?.is_returning?"checked":""} style="width:auto" />
            <label for="f-returning" style="margin:0">Returning guest</label>
          </div>
        </div>

        <!-- Stay Dates -->
        <div class="mb-5 p-4 bg-green-50 rounded-lg">
          <h3 class="font-semibold text-green-900 mb-3">📅 Stay Details</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label>Arrival Date *</label>
              <input id="f-arrival" type="date" value="${res?.arrival_date||presetDate||""}" />
            </div>
            <div>
              <label>Departure Date *</label>
              <input id="f-departure" type="date" value="${res?.departure_date||""}" />
            </div>
            <div>
              <label>Arrival Time</label>
              <input id="f-arrtime" value="${esc(res?.arrival_time||"")}" placeholder="e.g. 2:00 PM" />
            </div>
            <div>
              <label>Arrival Method</label>
              <select id="f-arrmethod">
                <option value="">— Select —</option>
                <option value="boat"        ${res?.arrival_method==="boat"       ?"selected":""}>Boat</option>
                <option value="road"        ${res?.arrival_method==="road"       ?"selected":""}>Road</option>
                <option value="float_plane" ${res?.arrival_method==="float_plane"?"selected":""}>Float Plane</option>
              </select>
            </div>
            <div>
              <label>Total Guests in Party *</label>
              <input id="f-numguests" type="number" min="1" value="${res?.num_guests||rooms.reduce((s,r)=>s+r.num_guests,0)||1}" />
            </div>
            <div>
              <label>Status</label>
              <select id="f-status">
                <option value="pending"    ${(res?.status||"confirmed")==="pending"    ?"selected":""}>Pending</option>
                <option value="confirmed"  ${(res?.status||"confirmed")==="confirmed"  ?"selected":""}>Confirmed</option>
                <option value="checked_in" ${res?.status==="checked_in" ?"selected":""}>Checked In</option>
                <option value="checked_out"${res?.status==="checked_out"?"selected":""}>Checked Out</option>
                <option value="cancelled"  ${res?.status==="cancelled"  ?"selected":""}>Cancelled</option>
              </select>
            </div>
          </div>
          <!-- Flags row -->
          <div class="mt-3 flex flex-wrap items-center gap-5">
            <label class="flex items-center gap-2 cursor-pointer" style="margin:0">
              <input type="checkbox" id="f-cc-on-file" ${res?.cc_on_file?"checked":""} style="width:auto" />
              <span class="text-sm font-medium">💳 Credit card on file</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer" style="margin:0">
              <input type="checkbox" id="f-pst-exempt" ${res?.pst_exempt?"checked":""} style="width:auto" />
              <span class="text-sm font-medium">🏷 PST exempt</span>
            </label>
          </div>
        </div>

        <!-- Rooms -->
        <div class="mb-5 p-4 bg-purple-50 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-purple-900">🛏 Rooms & Accommodation</h3>
            <button class="btn btn-secondary text-xs py-1" onclick="Form.addRoom()">+ Add Room</button>
          </div>
          <div id="rooms-list">${renderRoomsList()}</div>
        </div>

        <!-- Dietary -->
        <div class="mb-5 p-4 bg-orange-50 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-orange-900">🍽 Dietary Requirements</h3>
            <button class="btn btn-secondary text-xs py-1" onclick="Form.addDietary()">+ Add</button>
          </div>
          <div id="dietary-list">${renderDietaryList()}</div>
          ${dietary.length===0?`<p class="text-sm text-gray-400">No dietary requirements.</p>`:""}
        </div>

        <!-- Boats -->
        <div class="mb-5 p-4 bg-cyan-50 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-cyan-900">⛵ Boats / Moorage</h3>
            <button class="btn btn-secondary text-xs py-1" onclick="Form.addBoat()">+ Add Boat</button>
          </div>
          <div id="boats-list">${renderBoatsList()}</div>
          ${boats.length===0?`<p class="text-sm text-gray-400">No boats.</p>`:""}
        </div>

        <!-- Charters -->
        <div class="mb-5 p-4 bg-teal-50 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-teal-900">🎣 Charter Add-Ons</h3>
            <button class="btn btn-secondary text-xs py-1" onclick="Form.addCharter()">+ Add Charter</button>
          </div>
          <div id="charters-list">${renderChartersList()}</div>
          ${charters.length===0?`<p class="text-sm text-gray-400">No charters.</p>`:""}
        </div>

        <!-- Special Requests -->
        <div class="mb-5">
          <label>Special Requests / Notes</label>
          <textarea id="f-special" rows="2" placeholder="Occasions, accessibility needs, etc.">${esc(res?.special_requests||"")}</textarea>
        </div>

        <!-- Quote (always shown) -->
        <div class="mb-5 p-4 bg-gray-50 rounded-lg">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">💰 Estimated Total</h3>
            <button class="btn btn-secondary text-xs py-1" onclick="Form.loadQuote()">Calculate</button>
          </div>
          <div id="quote-result" class="mt-2 text-sm text-gray-500">Fill in dates &amp; rooms, then click Calculate for a price estimate.</div>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-3 justify-between pt-4 border-t">
          <div class="flex gap-2">
            ${!isNew ? `<button class="btn btn-danger" onclick="Form.deleteRes(${res.id})">Delete</button>` : ""}
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="Form.save()">
              ${isNew ? "Create Reservation" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderRoomsList() {
    if (rooms.length === 0) return `<p class="text-sm text-gray-400">No rooms added.</p>`;
    return rooms.map((r, i) => {
      const accomOptions = accommodations.map(a =>
        `<option value="${a.id}" ${a.id===r.accommodation_id?"selected":""}>${a.name}</option>`
      ).join("");
      const customRateVal = r.custom_rate != null ? r.custom_rate : "";
      const ratePlaceholder = r.meal_package ? "e.g. 235" : "e.g. 150";
      const rateLabel = r.meal_package ? "Custom meal rate ($/person·night)" : "Custom no-meals rate ($/night)";
      return `
      <div class="flex flex-wrap items-end gap-2 mb-3 p-3 bg-white rounded-lg border border-purple-100">
        <div style="min-width:160px;flex:2">
          <label>Room / Unit</label>
          <select onchange="Form.updateRoom(${i},'accommodation_id',+this.value)">${accomOptions}</select>
        </div>
        <div style="min-width:70px;flex:1">
          <label>Guests</label>
          <input type="number" min="1" value="${r.num_guests}"
            onchange="Form.updateRoom(${i},'num_guests',+this.value)" />
        </div>
        <div style="min-width:90px;flex:1">
          <label>Extra Boats</label>
          <input type="number" min="0" value="${r.extra_boats}"
            onchange="Form.updateRoom(${i},'extra_boats',+this.value)" />
        </div>
        <div style="min-width:120px;flex:1">
          <label>${rateLabel}</label>
          <input type="number" min="0" step="0.01" value="${customRateVal}"
            placeholder="${ratePlaceholder}"
            oninput="Form.updateRoom(${i},'custom_rate',this.value===''?null:+this.value)" />
        </div>
        <div class="flex items-center gap-3 pb-1">
          <label class="flex items-center gap-1 cursor-pointer" style="margin:0">
            <input type="checkbox" ${r.meal_package?"checked":""} style="width:auto"
              onchange="Form.updateRoom(${i},'meal_package',this.checked)" />
            <span class="text-sm">Meal pkg</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer" style="margin:0">
            <input type="checkbox" ${r.single_supplement?"checked":""} style="width:auto"
              onchange="Form.updateRoom(${i},'single_supplement',this.checked)" />
            <span class="text-sm">No meals rate</span>
          </label>
          <button class="text-red-400 hover:text-red-600 text-lg" onclick="Form.removeRoom(${i})">✕</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderDietaryList() {
    return dietary.map((d, i) => `
      <div class="flex gap-2 mb-2 items-center">
        <input value="${esc(d.guest_desc||"")}" placeholder="Guest (e.g. 'John')"
          onchange="Form.updateDietary(${i},'guest_desc',this.value)" style="flex:1" />
        <input value="${esc(d.requirement)}" placeholder="Requirement (e.g. 'nut allergy')"
          onchange="Form.updateDietary(${i},'requirement',this.value)" style="flex:2" />
        <button class="text-red-400 hover:text-red-600" onclick="Form.removeDietary(${i})">✕</button>
      </div>`).join("");
  }

  function renderBoatsList() {
    return boats.map((b, i) => `
      <div class="flex gap-2 mb-2 items-center">
        <input value="${esc(b.boat_name||"")}" placeholder="Boat name"
          onchange="Form.updateBoat(${i},'boat_name',this.value)" style="flex:2" />
        <input value="${esc(b.boat_length||"")}" placeholder="Length (e.g. 22ft)"
          onchange="Form.updateBoat(${i},'boat_length',this.value)" style="flex:1" />
        <button class="text-red-400 hover:text-red-600" onclick="Form.removeBoat(${i})">✕</button>
      </div>`).join("");
  }

  function renderChartersList() {
    return charters.map((ch, i) => `
      <div class="flex flex-wrap gap-2 mb-2 items-end">
        <div style="flex:1;min-width:130px">
          <label>Date</label>
          <input type="date" value="${ch.charter_date||""}"
            onchange="Form.updateCharter(${i},'charter_date',this.value)" />
        </div>
        <div style="flex:1;min-width:110px">
          <label>Type</label>
          <select onchange="Form.updateCharter(${i},'charter_type',this.value)">
            <option value="fishing"  ${ch.charter_type==="fishing" ?"selected":""}>Fishing</option>
            <option value="wildlife" ${ch.charter_type==="wildlife"?"selected":""}>Wildlife</option>
          </select>
        </div>
        <div style="flex:1;min-width:110px">
          <label>Duration</label>
          <select onchange="Form.updateCharter(${i},'duration',this.value)">
            <option value="full_day" ${(ch.duration||"full_day")==="full_day"?"selected":""}>Full Day (8h)</option>
            <option value="half_day" ${ch.duration==="half_day"?"selected":""}>Half Day (4h)</option>
          </select>
        </div>
        <div style="flex:1;min-width:70px">
          <label>Guests</label>
          <input type="number" min="1" max="4" value="${ch.num_guests||1}"
            onchange="Form.updateCharter(${i},'num_guests',+this.value)" />
        </div>
        <button class="text-red-400 hover:text-red-600 pb-1" onclick="Form.removeCharter(${i})">✕</button>
      </div>`).join("");
  }

  // ── Mutators (called from inline onchange handlers) ──────────────────────────

  function updateRoom(i, field, val) {
    rooms[i][field] = val;
    refreshSection("rooms-list", renderRoomsList);
  }
  function updateDietary(i, field, val)  { dietary[i][field]  = val; }
  function updateBoat(i, field, val)     { boats[i][field]    = val; }
  function updateCharter(i, field, val)  { charters[i][field] = val; }

  function addRoom()    { rooms.push({accommodation_id: accommodations[0]?.id, num_guests:2, meal_package:true, extra_boats:0, single_supplement:false, custom_rate:null}); refreshSection("rooms-list", renderRoomsList); }
  function removeRoom(i){ rooms.splice(i,1);    refreshSection("rooms-list",    renderRoomsList); }
  function addDietary() { dietary.push({guest_desc:"",requirement:""}); refreshSection("dietary-list", renderDietaryList); }
  function removeDietary(i){ dietary.splice(i,1); refreshSection("dietary-list", renderDietaryList); }
  function addBoat()    { boats.push({boat_name:"",boat_length:""}); refreshSection("boats-list", renderBoatsList); }
  function removeBoat(i){ boats.splice(i,1); refreshSection("boats-list", renderBoatsList); }
  function addCharter() { charters.push({charter_date:"",charter_type:"fishing",duration:"full_day",num_guests:1}); refreshSection("charters-list", renderChartersList); }
  function removeCharter(i){ charters.splice(i,1); refreshSection("charters-list", renderChartersList); }

  function refreshSection(id, renderFn) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = renderFn();
  }

  // ── Guest autocomplete ────────────────────────────────────────────────────────

  function searchGuests() {
    clearTimeout(guestSearchTimer);
    const first = (document.getElementById("f-first")?.value || "").trim();
    const last  = (document.getElementById("f-last")?.value  || "").trim();
    const q = (first + " " + last).trim();
    if (q.length < 2) { hideGuestSuggestions(); return; }
    guestSearchTimer = setTimeout(async () => {
      try {
        const results = await API.guests(q);
        showGuestSuggestions(results);
      } catch(e) { /* silent */ }
    }, 280);
  }

  function showGuestSuggestions(guests) {
    const el = document.getElementById("guest-suggestions");
    if (!el) return;
    if (!guests || !guests.length) { el.style.display = "none"; return; }
    el.innerHTML = guests.slice(0, 8).map(g => `
      <div onclick="Form.selectGuest(${JSON.stringify(g).replace(/"/g,"&quot;")})"
        style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;font-size:13px"
        onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background=''">
        <span style="font-weight:600">${esc(g.first_name)} ${esc(g.last_name)}</span>
        ${g.is_returning ? `<span style="color:#d97706;margin-left:4px">⭐</span>` : ""}
        ${g.phone ? `<span style="color:#9ca3af;margin-left:8px;font-size:12px">${esc(g.phone)}</span>` : ""}
        ${g.email ? `<span style="color:#9ca3af;margin-left:8px;font-size:12px">${esc(g.email)}</span>` : ""}
      </div>`).join("");
    el.style.display = "block";
  }

  function hideGuestSuggestions(delayMs) {
    if (delayMs) {
      setTimeout(() => {
        const el = document.getElementById("guest-suggestions");
        if (el) el.style.display = "none";
      }, delayMs);
    } else {
      const el = document.getElementById("guest-suggestions");
      if (el) el.style.display = "none";
    }
  }

  function selectGuest(g) {
    if (typeof g === "string") g = JSON.parse(g);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
    set("f-first", g.first_name);
    set("f-last",  g.last_name);
    set("f-phone", g.phone);
    set("f-email", g.email);
    const ret = document.getElementById("f-returning");
    if (ret) ret.checked = !!g.is_returning;
    hideGuestSuggestions();
    if (currentRes === null) currentRes = {};
    currentRes._linked_guest_id = g.id;
  }

  // ── Quote ────────────────────────────────────────────────────────────────────

  async function loadQuote() {
    const el = document.getElementById("quote-result");
    if (!el) return;
    el.textContent = "Calculating…";
    try {
      const data = readForm();
      const q = await API.quotePreview(data);
      renderQuote(el, q);
    } catch(e) {
      el.textContent = "Error calculating quote: " + (e.message || "check dates and rooms.");
    }
  }

  function renderQuote(el, q) {
    if (!q || !q.lines) { el.textContent = "Could not calculate quote."; return; }
    let html = `<table class="w-full text-sm mt-1">
      <thead><tr class="border-b text-gray-500">
        <th class="text-left py-1">Description</th>
        <th class="text-right py-1">Subtotal</th>
        <th class="text-right py-1">Tax</th>
        <th class="text-right py-1">Total</th>
      </tr></thead><tbody>`;
    q.lines.forEach(l => {
      html += `<tr class="border-b border-gray-100">
        <td class="py-1">${l.description}</td>
        <td class="text-right py-1">$${(l.subtotal||0).toFixed(2)}</td>
        <td class="text-right py-1">$${(l.tax||0).toFixed(2)}</td>
        <td class="text-right font-medium py-1">$${(l.total||0).toFixed(2)}</td>
      </tr>`;
    });
    html += `</tbody><tfoot><tr class="font-bold text-base">
      <td class="pt-2">TOTAL (${q.nights} night${q.nights!==1?"s":""})</td>
      <td class="text-right pt-2">$${(q.subtotal||0).toFixed(2)}</td>
      <td class="text-right pt-2">$${(q.tax||0).toFixed(2)}</td>
      <td class="text-right pt-2 text-green-700">$${(q.grand_total||0).toFixed(2)}</td>
    </tr></tfoot></table>`;
    if (q.pst_exempt) {
      html += `<p class="text-xs text-blue-600 mt-1">PST exempt applied — GST only on self-contained units.</p>`;
    }
    el.innerHTML = html;
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  function readForm() {
    return {
      guest: {
        first_name:   document.getElementById("f-first")?.value.trim() || "",
        last_name:    document.getElementById("f-last")?.value.trim()  || "",
        phone:        document.getElementById("f-phone")?.value.trim() || "",
        email:        document.getElementById("f-email")?.value.trim() || "",
        is_returning: document.getElementById("f-returning")?.checked ? 1 : 0,
      },
      guest_id:         currentRes?._linked_guest_id || currentRes?.guest_id || null,
      status:           document.getElementById("f-status")?.value || "confirmed",
      arrival_date:     document.getElementById("f-arrival")?.value || "",
      departure_date:   document.getElementById("f-departure")?.value || "",
      arrival_time:     document.getElementById("f-arrtime")?.value.trim() || "",
      arrival_method:   document.getElementById("f-arrmethod")?.value || null,
      num_guests:       parseInt(document.getElementById("f-numguests")?.value) || 1,
      special_requests: document.getElementById("f-special")?.value.trim() || "",
      cc_on_file:       document.getElementById("f-cc-on-file")?.checked ? 1 : 0,
      pst_exempt:       document.getElementById("f-pst-exempt")?.checked ? 1 : 0,
      rooms, dietary, boats, charters,
    };
  }

  async function save() {
    const data = readForm();

    if (!data.guest.first_name || !data.guest.last_name) {
      return alert("Please enter the guest's first and last name.");
    }
    if (!data.arrival_date || !data.departure_date) {
      return alert("Please enter arrival and departure dates.");
    }
    if (data.arrival_date >= data.departure_date) {
      return alert("Departure must be after arrival.");
    }
    if (rooms.length === 0) {
      return alert("Please add at least one room.");
    }

    const isActualEdit = currentRes && currentRes.id;
    if (isActualEdit) {
      data.guest_id = currentRes.guest_id;
    }

    try {
      let result;
      if (isActualEdit) {
        result = await API.updateReservation(currentRes.id, data);
      } else {
        result = await API.createReservation(data);
      }

      if (result && result.conflicts) {
        const msgs = result.conflicts.map(c =>
          `• ${c.room}: already booked by ${c.guest} (${c.dates})`
        ).join("\n");
        return alert("⚠ Overbooking conflict — those dates are already booked:\n\n" + msgs +
          "\n\nPlease choose different rooms or dates.");
      }

      App.closeModal();
      Calendar.refresh();
    } catch(e) {
      alert("Error saving reservation: " + e.message);
    }
  }

  async function deleteRes(resId) {
    if (!confirm("Delete this reservation? This cannot be undone.")) return;
    try {
      await API.deleteReservation(resId);
      App.closeModal();
      Calendar.refresh();
    } catch(e) {
      alert("Error deleting reservation: " + e.message);
    }
  }

  // ── Utility ──────────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
  }

  return {
    openNew, openEdit,
    addRoom, removeRoom, updateRoom,
    addDietary, removeDietary, updateDietary,
    addBoat, removeBoat, updateBoat,
    addCharter, removeCharter, updateCharter,
    searchGuests, showGuestSuggestions, hideGuestSuggestions, selectGuest,
    loadQuote, save, deleteRes,
  };
})();
