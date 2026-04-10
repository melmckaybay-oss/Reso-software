/**
 * McKay Bay Lodge — Reservation Form (create & edit)
 * Includes: guest autocomplete, detailed price breakdown, custom rates,
 * CC on file, mobility field, email shortcut, "No meals rate" label
 */

const Form = (() => {

  let accommodations = [];
  let currentRes     = null;
  let presetDate     = null;
  let presetAccom    = null;
  let rooms     = [];
  let dietary   = [];
  let boats     = [];
  let charters  = [];

  async function openNew(date = null, accomId = null) {
    accommodations = await API.accommodations();
    currentRes  = null;
    presetDate  = date;
    presetAccom = accomId;
    rooms = [{
      accommodation_id: accomId || (accommodations.filter(a=>!["charter_boat","contractor_boat"].includes(a.type))[0]?.id),
      num_guests: 2, meal_package: true, extra_boats: 0, single_supplement: false,
      custom_meal_rate: "", custom_nomeal_rate: ""
    }];
    dietary = []; boats = []; charters = [];
    render();
  }

  async function openEdit(resId) {
    accommodations = await API.accommodations();
    const res = await API.reservation(resId);
    currentRes = res;
    rooms = res.rooms.map(r => ({
      accommodation_id: r.accommodation_id,
      num_guests: r.num_guests,
      meal_package: !!r.meal_package,
      extra_boats: r.extra_boats || 0,
      single_supplement: !!r.single_supplement,
      custom_meal_rate: r.custom_meal_rate || "",
      custom_nomeal_rate: r.custom_nomeal_rate || "",
    }));
    dietary  = res.dietary.map(d => ({...d}));
    boats    = res.boats.map(b => ({...b}));
    charters = res.charters.map(c => ({...c}));
    render();
  }

  function render() {
    const res   = currentRes;
    const isNew = !res;
    const title = isNew ? "New Reservation" : `Edit Reservation — ${res.first_name} ${res.last_name}`;

    document.getElementById("modal-content").innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-xl font-bold text-gray-900">${title}</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="voice-btn" onclick="App.startVoiceInput('voice-btn')" title="Voice input — speak your reservation details"
              style="background:#f1f5f9;border:1px solid #d1d5db;border-radius:8px;padding:6px 12px;
                     font-size:16px;cursor:pointer;transition:background 0.2s;">🎤</button>
            <button onclick="App.closeModal()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        <!-- Voice status -->
        <div id="voice-status" style="font-size:12px;color:#6b7280;margin-bottom:8px;min-height:16px;padding:4px 8px;background:#f8fafc;border-radius:6px;"></div>

        <!-- Guest -->
        <div class="mb-5 p-4 bg-blue-50 rounded-lg">
          <h3 class="font-semibold text-blue-900 mb-3">👤 Primary Contact</h3>
          <div class="grid grid-cols-2 gap-3">
            <div style="position:relative;">
              <label>First Name *</label>
              <input id="f-first" value="${esc(res?.first_name||"")}" placeholder="Type name to search existing guests…"
                oninput="Form.searchGuests()" autocomplete="off" />
              <div id="guest-autocomplete" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:50;
                background:white;border:1px solid #d1d5db;border-radius:6px;
                box-shadow:0 4px 12px rgba(0,0,0,0.15);max-height:200px;overflow-y:auto;"></div>
            </div>
            <div>
              <label>Last Name *</label>
              <input id="f-last" value="${esc(res?.last_name||"")}" placeholder="Last name" />
            </div>
            <div>
              <label>Phone</label>
              <input id="f-phone" value="${esc(res?.phone||"")}" placeholder="e.g. 604-555-0123" />
            </div>
            <div>
              <label>Email</label>
              <input id="f-email" type="email" value="${esc(res?.email||"")}" placeholder="email@example.com" />
            </div>
            <div>
              <label>Mailing Address</label>
              <input id="f-address" value="${esc(res?.address||"")}" placeholder="City, Province" />
            </div>
            <div class="flex flex-col gap-2 justify-end pb-1">
              <label class="flex items-center gap-2 cursor-pointer" style="margin:0">
                <input type="checkbox" id="f-returning" ${res?.is_returning?"checked":""} style="width:auto" />
                <span class="text-sm">⭐ Returning guest</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer" style="margin:0">
                <input type="checkbox" id="f-cc-on-file" ${res?.cc_on_file?"checked":""} style="width:auto" />
                <span class="text-sm">💳 Credit card on file</span>
              </label>
            </div>
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
                <option value="boat"            ${res?.arrival_method==="boat"           ?"selected":""}>Private Boat</option>
                <option value="road"            ${res?.arrival_method==="road"           ?"selected":""}>Driving In</option>
                <option value="frances_barkley" ${res?.arrival_method==="frances_barkley"?"selected":""}>MV Frances Barkley</option>
                <option value="float_plane"     ${res?.arrival_method==="float_plane"    ?"selected":""}>Float Plane</option>
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
            <div>
              <label>Mobility Requirements</label>
              <input id="f-mobility" value="${esc(res?.mobility||"")}" placeholder="e.g. wheelchair access needed, none" />
            </div>
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

        <!-- Price Estimate -->
        <div class="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold text-gray-800">💰 Price Estimate</h3>
            <button class="btn btn-secondary text-xs py-1" onclick="Form.calcLiveQuote()">Calculate</button>
          </div>
          <p class="text-xs text-gray-400 mb-2">Fill in dates and rooms, then click Calculate. Custom rates in rooms section override defaults.</p>
          <div id="live-quote-result" class="text-sm text-gray-400">Click Calculate to see a full breakdown with taxes.</div>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-3 justify-between pt-4 border-t">
          <div class="flex gap-2">
            ${!isNew ? `<button class="btn btn-danger" onclick="Form.deleteRes(${res.id})">Delete</button>` : ""}
          </div>
          <div class="flex gap-2">
            ${!isNew ? `<button class="btn btn-secondary" onclick="App.openEmailForReservation(${res.id})">✉ Email Guest</button>` : ""}
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
      const accomOptions = accommodations
        .filter(a => !["charter_boat","contractor_boat"].includes(a.type))
        .map(a => `<option value="${a.id}" ${a.id===r.accommodation_id?"selected":""}>${a.name}</option>`)
        .join("");
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
        <div style="min-width:80px;flex:1">
          <label>Extra Boats</label>
          <input type="number" min="0" value="${r.extra_boats}"
            onchange="Form.updateRoom(${i},'extra_boats',+this.value)" />
        </div>
        <div style="min-width:130px;flex:1">
          <label>Custom Meal Rate/person/night</label>
          <input type="number" min="0" step="1" value="${r.custom_meal_rate||""}" placeholder="Default: $235 summer"
            onchange="Form.updateRoom(${i},'custom_meal_rate',this.value)" />
        </div>
        <div style="min-width:130px;flex:1">
          <label>Custom No-Meals Rate/night</label>
          <input type="number" min="0" step="1" value="${r.custom_nomeal_rate||""}" placeholder="Default: $550 summer"
            onchange="Form.updateRoom(${i},'custom_nomeal_rate',this.value)" />
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
            <option value="full_day" ${(ch.duration||"full_day")==="full_day"?"selected":""}>Full Day (8h) — $1,400</option>
            <option value="half_day" ${ch.duration==="half_day"?"selected":""}>Half Day (4h) — $750</option>
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

  // ── Guest Autocomplete ───────────────────────────────────────────────────────

  let _autocompleteTimer = null;
  async function searchGuests() {
    clearTimeout(_autocompleteTimer);
    _autocompleteTimer = setTimeout(async () => {
      const first = (document.getElementById("f-first")?.value || "").trim();
      const last  = (document.getElementById("f-last")?.value  || "").trim();
      const q     = (first + " " + last).trim();
      const dropdown = document.getElementById("guest-autocomplete");
      if (!dropdown || q.length < 2) { if(dropdown) dropdown.style.display="none"; return; }
      try {
        const guests = await API.guests(q);
        if (!guests.length) { dropdown.style.display="none"; return; }
        dropdown.innerHTML = guests.slice(0,8).map(g => `
          <div onclick="Form.fillGuest(${g.id})"
            style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;font-size:13px;"
            onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='white'">
            <span style="font-weight:600">${g.first_name} ${g.last_name}</span>
            <span style="color:#9ca3af;margin-left:8px;">${g.email||g.phone||""}</span>
            ${g.is_returning?`<span style="color:#d97706;margin-left:6px;font-size:11px">⭐ Returning</span>`:""}
          </div>`).join("");
        dropdown.style.display = "block";
      } catch(e) { dropdown.style.display="none"; }
    }, 250);
  }

  async function fillGuest(gid) {
    try {
      const g = await API.guest(gid);
      const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val||""; };
      setVal("f-first",   g.first_name);
      setVal("f-last",    g.last_name);
      setVal("f-phone",   g.phone);
      setVal("f-email",   g.email);
      setVal("f-address", g.address);
      const ret = document.getElementById("f-returning");
      if (ret) ret.checked = !!g.is_returning;
      const dropdown = document.getElementById("guest-autocomplete");
      if (dropdown) dropdown.style.display = "none";
      currentRes = currentRes || {};
      currentRes.guest_id = g.id;
    } catch(e) { console.error("fillGuest error", e); }
  }

  // ── Live Quote Calculator ─────────────────────────────────────────────────────

  async function calcLiveQuote() {
    const el = document.getElementById("live-quote-result");
    if (!el) return;
    const arrival   = document.getElementById("f-arrival")?.value;
    const departure = document.getElementById("f-departure")?.value;
    if (!arrival || !departure || arrival >= departure) {
      el.innerHTML = `<span style="color:#ef4444">Please enter valid arrival and departure dates first.</span>`;
      return;
    }
    el.innerHTML = `<span style="color:#9ca3af">Calculating…</span>`;

    const nights = Math.round((new Date(departure) - new Date(arrival)) / 86400000);
    const arr = new Date(arrival + "T12:00:00");
    let summerNights = 0, offNights = 0;
    for (let i = 0; i < nights; i++) {
      const d = new Date(arr); d.setDate(d.getDate() + i);
      const m = d.getMonth() + 1, dy = d.getDate();
      const isSummer = (m > 5 || (m === 5 && dy >= 1)) && (m < 10 || (m === 9 && dy <= 30));
      if (isSummer) summerNights++; else offNights++;
    }

    const CABIN_RATES = {
      "Creekside Cabin":   {summer:550, offseason:400},
      "Forest View Cabin": {summer:550, offseason:400},
      "Boat Shop Suite":   {summer:325, offseason:250},
    };

    let lines = [], subtotal = 0, taxTotal = 0;

    rooms.forEach(r => {
      const accom = accommodations.find(a => a.id === r.accommodation_id);
      const name  = accom?.name || "";
      const type  = accom?.type || "lodge_room";
      const ng    = r.num_guests || 1;
      const isLodge = type === "lodge_room" || r.meal_package;
      let sub = 0, tax = 0, label = "", taxLabel = "";

      if (isLodge) {
        const mealS = r.custom_meal_rate ? parseFloat(r.custom_meal_rate) : 235;
        const mealO = r.custom_meal_rate ? parseFloat(r.custom_meal_rate) : 200;
        sub = ng * (summerNights * mealS + offNights * mealO);
        tax = sub * 0.098;
        taxLabel = "GST 5% + Hotel Tax 4.8%";
        label = `${name} — ${ng} guest${ng!==1?"s":""} × meal pkg`;
        if (summerNights > 0 && offNights > 0)
          label += ` (${summerNights} nts @ $${mealS} + ${offNights} nts @ $${mealO}/person)`;
        else if (summerNights > 0) label += ` (${summerNights} nights @ $${mealS}/person/night)`;
        else label += ` (${offNights} nights @ $${mealO}/person/night)`;
      } else {
        const rates = CABIN_RATES[name] || {summer:550, offseason:400};
        const rS = r.custom_nomeal_rate ? parseFloat(r.custom_nomeal_rate) : rates.summer;
        const rO = r.custom_nomeal_rate ? parseFloat(r.custom_nomeal_rate) : rates.offseason;
        sub = summerNights * rS + offNights * rO;
        tax = sub * 0.13;
        taxLabel = "GST 5% + PST 8%";
        label = `${name} — self-contained`;
        if (summerNights > 0 && offNights > 0) label += ` (${summerNights} × $${rS} + ${offNights} × $${rO}/night)`;
        else if (summerNights > 0) label += ` (${summerNights} nights @ $${rS}/night)`;
        else label += ` (${offNights} nights @ $${rO}/night)`;
      }
      if (r.extra_boats) { sub += r.extra_boats * nights * 25; label += ` + ${r.extra_boats} extra boat${r.extra_boats!==1?"s":""}`; }
      lines.push({ label, sub, tax, taxLabel });
      subtotal += sub; taxTotal += tax;
    });

    charters.forEach(ch => {
      if (ch.charter_type === "fishing") {
        const rate = ch.duration === "half_day" ? 750 : 1400;
        const tax  = rate * 0.05;
        lines.push({ label:`Fishing charter — ${ch.duration?.replace("_"," ")} (${ch.charter_date||"TBD"})`, sub:rate, tax, taxLabel:"GST 5%" });
        subtotal += rate; taxTotal += tax;
      } else {
        lines.push({ label:`Wildlife charter (${ch.charter_date||"TBD"}) — contact for pricing`, sub:null, tax:null, taxLabel:"" });
      }
    });

    const grand = subtotal + taxTotal;
    el.innerHTML = `
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <thead><tr style="border-bottom:2px solid #e5e7eb;color:#6b7280;">
          <th style="text-align:left;padding:4px 0;font-weight:600">Description</th>
          <th style="text-align:right;padding:4px 6px;font-weight:600">Subtotal</th>
          <th style="text-align:right;padding:4px 6px;font-weight:600">Tax</th>
          <th style="text-align:right;padding:4px 0;font-weight:600">Total</th>
        </tr></thead>
        <tbody>${lines.map(l => `
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:5px 0;">
              <div>${l.label}</div>
              ${l.taxLabel?`<div style="color:#9ca3af;font-size:10px">${l.taxLabel}</div>`:""}
            </td>
            <td style="text-align:right;padding:5px 6px">${l.sub!=null?"$"+l.sub.toFixed(2):"—"}</td>
            <td style="text-align:right;padding:5px 6px;color:#6b7280">${l.tax!=null?"$"+l.tax.toFixed(2):"—"}</td>
            <td style="text-align:right;padding:5px 0;font-weight:600">${l.sub!=null?"$"+(l.sub+l.tax).toFixed(2):"—"}</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr style="border-top:2px solid #e5e7eb;font-weight:700;font-size:14px;">
          <td style="padding-top:8px">TOTAL — ${nights} night${nights!==1?"s":""}</td>
          <td style="text-align:right;padding-top:8px">$${subtotal.toFixed(2)}</td>
          <td style="text-align:right;padding-top:8px;color:#6b7280">$${taxTotal.toFixed(2)}</td>
          <td style="text-align:right;padding-top:8px;color:#16a34a">$${grand.toFixed(2)}</td>
        </tr></tfoot>
      </table>`;
  }

  // ── Mutators ─────────────────────────────────────────────────────────────────

  function updateRoom(i, field, val)     { rooms[i][field]    = val; refreshSection("rooms-list",    renderRoomsList); }
  function updateDietary(i, field, val)  { dietary[i][field]  = val; }
  function updateBoat(i, field, val)     { boats[i][field]    = val; }
  function updateCharter(i, field, val)  { charters[i][field] = val; }

  function addRoom()       { rooms.push({accommodation_id:accommodations.filter(a=>!["charter_boat","contractor_boat"].includes(a.type))[0]?.id,num_guests:2,meal_package:true,extra_boats:0,single_supplement:false,custom_meal_rate:"",custom_nomeal_rate:""}); refreshSection("rooms-list",renderRoomsList); }
  function removeRoom(i)   { rooms.splice(i,1); refreshSection("rooms-list",renderRoomsList); }
  function addDietary()    { dietary.push({guest_desc:"",requirement:""}); refreshSection("dietary-list",renderDietaryList); }
  function removeDietary(i){ dietary.splice(i,1); refreshSection("dietary-list",renderDietaryList); }
  function addBoat()       { boats.push({boat_name:"",boat_length:""}); refreshSection("boats-list",renderBoatsList); }
  function removeBoat(i)   { boats.splice(i,1); refreshSection("boats-list",renderBoatsList); }
  function addCharter()    { charters.push({charter_date:"",charter_type:"fishing",duration:"full_day",num_guests:1}); refreshSection("charters-list",renderChartersList); }
  function removeCharter(i){ charters.splice(i,1); refreshSection("charters-list",renderChartersList); }

  function refreshSection(id, renderFn) { const el=document.getElementById(id); if(el) el.innerHTML=renderFn(); }

  // ── Save ─────────────────────────────────────────────────────────────────────

  function readForm() {
    return {
      guest: {
        first_name:   document.getElementById("f-first").value.trim(),
        last_name:    document.getElementById("f-last").value.trim(),
        phone:        document.getElementById("f-phone").value.trim(),
        email:        document.getElementById("f-email").value.trim(),
        address:      document.getElementById("f-address")?.value.trim() || "",
        is_returning: document.getElementById("f-returning").checked ? 1 : 0,
      },
      guest_id:        currentRes?.guest_id || null,
      status:          document.getElementById("f-status").value,
      arrival_date:    document.getElementById("f-arrival").value,
      departure_date:  document.getElementById("f-departure").value,
      arrival_time:    document.getElementById("f-arrtime").value.trim(),
      arrival_method:  document.getElementById("f-arrmethod").value || null,
      num_guests:      parseInt(document.getElementById("f-numguests").value) || 1,
      special_requests:document.getElementById("f-special").value.trim(),
      mobility:        document.getElementById("f-mobility")?.value.trim() || "",
      cc_on_file:      document.getElementById("f-cc-on-file")?.checked ? 1 : 0,
      rooms, dietary, boats, charters,
    };
  }

  async function save() {
    const data = readForm();
    if (!data.guest.first_name || !data.guest.last_name) return alert("Please enter the guest's first and last name.");
    if (!data.arrival_date || !data.departure_date)      return alert("Please enter arrival and departure dates.");
    if (data.arrival_date >= data.departure_date)        return alert("Departure must be after arrival.");
    if (rooms.length === 0)                              return alert("Please add at least one room.");
    if (currentRes) data.guest_id = currentRes.guest_id;
    try {
      let result;
      if (currentRes) {
        result = await API.updateReservation(currentRes.id, data);
      } else {
        result = await API.createReservation(data);
      }
      if (result && result.conflicts) {
        const msgs = result.conflicts.map(c=>`• ${c.room}: already booked by ${c.guest} (${c.dates})`).join("\n");
        return alert("⚠ Overbooking conflict:\n\n" + msgs + "\n\nPlease choose different rooms or dates.");
      }
      App.closeModal();
      Calendar.refresh();
    } catch(e) { alert("Error saving reservation: " + e.message); }
  }

  async function deleteRes(resId) {
    if (!confirm("Delete this reservation? This cannot be undone.")) return;
    try { await API.deleteReservation(resId); App.closeModal(); Calendar.refresh(); }
    catch(e) { alert("Error deleting reservation: " + e.message); }
  }

  function esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

  return {
    openNew, openEdit,
    addRoom, removeRoom, updateRoom,
    addDietary, removeDietary, updateDietary,
    addBoat, removeBoat, updateBoat,
    addCharter, removeCharter, updateCharter,
    searchGuests, fillGuest, calcLiveQuote, save, deleteRes,
  };
})();
