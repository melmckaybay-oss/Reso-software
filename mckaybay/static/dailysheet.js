/**
 * McKay Bay Lodge — Daily Staff Sheet
 * Auto-pulls arrivals, departures, in-house guests, dietary, room numbers
 * from reservations. Staff fill in meal choices, times, maintenance notes.
 * Fill-in on screen (saved) + printable.
 */

const DailySheet = (() => {

  let currentDate = null;
  let occupied    = [];   // all reservations active that night
  let arrivalsRaw = [];
  let departuresRaw = [];
  let mealGuests  = [];
  let dietaryAll  = [];
  let tasks       = { hot_tub:0, main_toilet:0, porch:0, sandwiches_count:0, staff_notes:"" };
  let sheetRows   = {};   // reservation_id -> guest_daily_sheet row

  function addDaysISO(dateStr, n) {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0,10);
  }

  async function load(date) {
    currentDate = date;
    const nextDay = addDaysISO(date, 1);

    const [occRes, arr, dep, meals, tasksRes, sheetRes] = await Promise.all([
      fetch(`/api/reservations?start=${date}&end=${nextDay}`).then(r=>r.json()).catch(()=>[]),
      API.dailyArrivals(date).catch(()=>[]),
      API.dailyDepartures(date).catch(()=>[]),
      API.dailyMeals(date).catch(()=>({meal_guests:[],dietary:[]})),
      fetch(`/api/daily-tasks?date=${date}`).then(r=>r.json()).catch(()=>null),
      fetch(`/api/daily-sheet?date=${date}`).then(r=>r.json()).catch(()=>[]),
    ]);

    occupied      = Array.isArray(occRes) ? occRes : [];
    arrivalsRaw   = arr;
    departuresRaw = dep;
    mealGuests    = meals.meal_guests || [];
    dietaryAll    = meals.dietary || [];
    tasks         = tasksRes || { hot_tub:0, main_toilet:0, porch:0, sandwiches_count:0, staff_notes:"" };
    sheetRows     = {};
    (Array.isArray(sheetRes) ? sheetRes : []).forEach(r => { sheetRows[r.reservation_id] = r; });
  }

  function sheetFor(resId) {
    return sheetRows[resId] || {
      breakfast_type:"", breakfast_time:"", lunch_type:"", lunch_time:"",
      dinner_time:"", payment_done:0, cleaning_status:"", room_notes:""
    };
  }

  // Build a guest-by-room list for meal planning (meal-package guests only)
  function mealPlanRows() {
    const byRes = {};
    mealGuests.forEach(g => {
      if (!byRes[g.id]) byRes[g.id] = { id:g.id, name:`${g.first_name} ${g.last_name}`, rooms:[], guests:0 };
      byRes[g.id].rooms.push(g.accommodation_name);
      byRes[g.id].guests += g.num_guests || 0;
    });
    return Object.values(byRes);
  }

  function dietaryFor(resId) {
    // dietaryAll doesn't carry reservation_id directly from this endpoint, so show all as a flat reference
    return dietaryAll.map(d => (d.guest_desc ? d.guest_desc+": " : "") + d.requirement).join("; ");
  }

  function occupiedRoomsList() {
    const rows = [];
    occupied.forEach(res => {
      (res.rooms || []).forEach(r => {
        rows.push({ resId: res.id, room: r.accommodation_name, name: `${res.first_name} ${res.last_name}` });
      });
    });
    return rows.sort((a,b) => a.room.localeCompare(b.room));
  }

  async function render(date) {
    date = date || currentDate || new Date().toISOString().slice(0,10);
    await load(date);
    buildUI(date);
  }

  function buildUI(date) {
    const container = document.getElementById("main-content");
    const dayName = new Date(date+"T12:00:00").toLocaleDateString("en-CA",{weekday:"long"});
    const humanDate = new Date(date+"T12:00:00").toLocaleDateString("en-CA",{month:"long",day:"numeric",year:"numeric"});
    const mealRows  = mealPlanRows();
    const roomRows  = occupiedRoomsList();
    const totalCovers = mealRows.reduce((s,r)=>s+r.guests,0);

    container.innerHTML = `
    <div id="staff-sheet-print" class="max-w-5xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6">

      <!-- Controls (hidden on print) -->
      <div class="no-print flex items-center gap-3 mb-5 flex-wrap">
        <button class="btn btn-secondary" onclick="Daily.render('${date}')">← Back to Overview</button>
        <input type="date" value="${date}"
          style="width:auto;font-size:1rem;font-weight:600;border:1px solid #d1d5db;border-radius:6px;padding:5px 10px;"
          onchange="DailySheet.render(this.value)" />
        <button class="btn btn-primary" onclick="window.print()">🖨 Print Sheet</button>
        <span class="text-xs text-gray-400 ml-auto">Changes save automatically as you type</span>
      </div>

      <!-- Header -->
      <div style="border:2px solid #1a535c;border-radius:8px;padding:12px 16px;margin-bottom:16px;
                  display:flex;justify-content:space-between;align-items:center;background:#f0f7f8;">
        <div>
          <div style="font-size:20px;font-weight:800;color:#1a535c;">${dayName}</div>
          <div style="font-size:14px;color:#475569;">${humanDate}</div>
        </div>
        <div style="display:flex;gap:18px;">
          ${taskCheckbox("hot_tub", "🛁 Hot Tub")}
          ${taskCheckbox("main_toilet", "🚽 Main Toilet")}
          ${taskCheckbox("porch", "🚪 Porch")}
        </div>
      </div>

      <!-- Arrivals -->
      <div style="margin-bottom:18px;">
        <h3 style="font-size:14px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">✈ Arrivals (${arrivalsRaw.length})</h3>
        ${arrivalsRaw.length === 0 ? `<p style="color:#9ca3af;font-size:13px;">No arrivals today.</p>` : `
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <thead><tr style="background:#f0fdf4;text-align:left;">
            <th style="padding:5px 8px;">Name</th><th style="padding:5px 8px;">Time</th>
            <th style="padding:5px 8px;">Guests</th><th style="padding:5px 8px;">Dietary / Notes</th>
            <th style="padding:5px 8px;">Checked In</th>
          </tr></thead>
          <tbody>
            ${arrivalsRaw.map(a => `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:5px 8px;font-weight:600;">${a.first_name} ${a.last_name}</td>
                <td style="padding:5px 8px;">${a.arrival_time||""}</td>
                <td style="padding:5px 8px;">${a.num_guests}</td>
                <td style="padding:5px 8px;color:#b45309;">${a.special_requests||""}</td>
                <td style="padding:5px 8px;">
                  <input type="checkbox" class="no-print-hide" ${a.id===undefined?"":""}
                    onchange="DailySheet.checkIn(${a.id||0}, this.checked)" />
                </td>
              </tr>`).join("")}
          </tbody>
        </table>`}
      </div>

      <!-- Breakfast Plan -->
      <div style="margin-bottom:18px;">
        <h3 style="font-size:14px;font-weight:800;color:#9a3412;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">🍳 Breakfast</h3>
        ${mealRows.length === 0 ? `<p style="color:#9ca3af;font-size:13px;">No meal-package guests.</p>` : `
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <thead><tr style="background:#fff7ed;text-align:left;">
            <th style="padding:5px 8px;">Name</th><th style="padding:5px 8px;">Room(s)</th>
            <th style="padding:5px 8px;">Guests</th><th style="padding:5px 8px;">Type</th>
            <th style="padding:5px 8px;">Time (if cooked)</th><th style="padding:5px 8px;">Dietary</th>
          </tr></thead>
          <tbody>
            ${mealRows.map(g => { const s = sheetFor(g.id); return `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:5px 8px;font-weight:600;">${g.name}</td>
                <td style="padding:5px 8px;">${g.rooms.join(", ")}</td>
                <td style="padding:5px 8px;">${g.guests}</td>
                <td style="padding:5px 8px;">
                  <select onchange="DailySheet.saveField(${g.id},'breakfast_type',this.value)" style="font-size:12px;padding:3px;">
                    <option value="" ${!s.breakfast_type?"selected":""}>—</option>
                    <option value="Continental" ${s.breakfast_type==="Continental"?"selected":""}>Continental</option>
                    <option value="Cooked" ${s.breakfast_type==="Cooked"?"selected":""}>Cooked</option>
                  </select>
                </td>
                <td style="padding:5px 8px;">
                  <input type="text" placeholder="e.g. 8:30" value="${s.breakfast_time||""}"
                    onchange="DailySheet.saveField(${g.id},'breakfast_time',this.value)"
                    style="font-size:12px;padding:3px;width:70px;" />
                </td>
                <td style="padding:5px 8px;color:#b45309;font-size:11px;">${dietaryFor(g.id)}</td>
              </tr>`; }).join("")}
          </tbody>
        </table>`}
      </div>

      <!-- Packed Lunches for Next Day -->
      <div style="margin-bottom:18px;">
        <h3 style="font-size:14px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">🥪 Lunch Plan</h3>
        <div style="margin-bottom:8px;font-size:13px;">
          Sandwiches to make: <input type="number" min="0" value="${tasks.sandwiches_count||0}"
            onchange="DailySheet.saveTask('sandwiches_count', this.value)"
            style="width:60px;font-size:13px;padding:3px;display:inline-block;" />
        </div>
        ${mealRows.length === 0 ? `<p style="color:#9ca3af;font-size:13px;">No guests to plan for.</p>` : `
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <thead><tr style="background:#eff6ff;text-align:left;">
            <th style="padding:5px 8px;">Name</th><th style="padding:5px 8px;">Type</th>
            <th style="padding:5px 8px;">Time</th>
          </tr></thead>
          <tbody>
            ${mealRows.map(g => { const s = sheetFor(g.id); return `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:5px 8px;font-weight:600;">${g.name}</td>
                <td style="padding:5px 8px;">
                  <select onchange="DailySheet.saveField(${g.id},'lunch_type',this.value)" style="font-size:12px;padding:3px;">
                    <option value="" ${!s.lunch_type?"selected":""}>—</option>
                    <option value="Take-away" ${s.lunch_type==="Take-away"?"selected":""}>Take-away</option>
                    <option value="In-Lodge" ${s.lunch_type==="In-Lodge"?"selected":""}>In-Lodge</option>
                  </select>
                </td>
                <td style="padding:5px 8px;">
                  <input type="text" placeholder="e.g. 12:00" value="${s.lunch_time||""}"
                    onchange="DailySheet.saveField(${g.id},'lunch_time',this.value)"
                    style="font-size:12px;padding:3px;width:70px;" />
                </td>
              </tr>`; }).join("")}
          </tbody>
        </table>`}
      </div>

      <!-- Departures -->
      <div style="margin-bottom:18px;">
        <h3 style="font-size:14px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">🚪 Departures (${departuresRaw.length})</h3>
        ${departuresRaw.length === 0 ? `<p style="color:#9ca3af;font-size:13px;">No departures today.</p>` : `
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <thead><tr style="background:#fef2f2;text-align:left;">
            <th style="padding:5px 8px;">Name</th><th style="padding:5px 8px;">Guests</th>
            <th style="padding:5px 8px;">Payment Done</th>
          </tr></thead>
          <tbody>
            ${departuresRaw.map(d => { const s = sheetFor(d.id); return `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:5px 8px;font-weight:600;">${d.first_name} ${d.last_name}</td>
                <td style="padding:5px 8px;">${d.num_guests}</td>
                <td style="padding:5px 8px;">
                  <input type="checkbox" ${s.payment_done?"checked":""}
                    onchange="DailySheet.saveField(${d.id},'payment_done',this.checked?1:0)" />
                </td>
              </tr>`; }).join("")}
          </tbody>
        </table>`}
      </div>

      <!-- Room Stay-over Maintenance -->
      <div style="margin-bottom:18px;">
        <h3 style="font-size:14px;font-weight:800;color:#6d28d9;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">🧹 Room Stay-over / Maintenance</h3>
        ${roomRows.length === 0 ? `<p style="color:#9ca3af;font-size:13px;">No occupied rooms.</p>` : `
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <thead><tr style="background:#f5f3ff;text-align:left;">
            <th style="padding:5px 8px;">Room</th><th style="padding:5px 8px;">Guest</th>
            <th style="padding:5px 8px;">Cleaning Status</th><th style="padding:5px 8px;">Notes</th>
          </tr></thead>
          <tbody>
            ${roomRows.map(r => { const s = sheetFor(r.resId); return `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:5px 8px;font-weight:600;">${r.room}</td>
                <td style="padding:5px 8px;">${r.name}</td>
                <td style="padding:5px 8px;">
                  <select onchange="DailySheet.saveField(${r.resId},'cleaning_status',this.value)" style="font-size:12px;padding:3px;">
                    <option value="" ${!s.cleaning_status?"selected":""}>—</option>
                    <option value="Full Service" ${s.cleaning_status==="Full Service"?"selected":""}>Full Service</option>
                    <option value="Towels Only" ${s.cleaning_status==="Towels Only"?"selected":""}>Towels Only</option>
                    <option value="Don't Need Service" ${s.cleaning_status==="Don't Need Service"?"selected":""}>Don't Need Service</option>
                  </select>
                </td>
                <td style="padding:5px 8px;">
                  <input type="text" value="${s.room_notes||""}" placeholder="notes…"
                    onchange="DailySheet.saveField(${r.resId},'room_notes',this.value)"
                    style="font-size:12px;padding:3px;width:160px;" />
                </td>
              </tr>`; }).join("")}
          </tbody>
        </table>`}
      </div>

      <!-- Dinner -->
      <div style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h3 style="font-size:14px;font-weight:800;color:#9a3412;text-transform:uppercase;letter-spacing:.05em;margin:0;">🍽 Dinner</h3>
          <span style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:4px 12px;font-weight:700;color:#9a3412;font-size:13px;">
            ${totalCovers} total covers
          </span>
        </div>
        ${mealRows.length === 0 ? `<p style="color:#9ca3af;font-size:13px;">No meal-package guests tonight.</p>` : `
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <thead><tr style="background:#fff7ed;text-align:left;">
            <th style="padding:5px 8px;">Name</th><th style="padding:5px 8px;">Guests</th>
            <th style="padding:5px 8px;">Seating Time</th><th style="padding:5px 8px;">Dietary</th>
          </tr></thead>
          <tbody>
            ${mealRows.map(g => { const s = sheetFor(g.id); return `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:5px 8px;font-weight:600;">${g.name}</td>
                <td style="padding:5px 8px;">${g.guests}</td>
                <td style="padding:5px 8px;">
                  <select onchange="DailySheet.saveField(${g.id},'dinner_time',this.value)" style="font-size:12px;padding:3px;">
                    <option value="" ${!s.dinner_time?"selected":""}>—</option>
                    <option value="5:30" ${s.dinner_time==="5:30"?"selected":""}>5:30</option>
                    <option value="7:00" ${s.dinner_time==="7:00"?"selected":""}>7:00</option>
                  </select>
                </td>
                <td style="padding:5px 8px;color:#b45309;font-size:11px;">${dietaryFor(g.id)}</td>
              </tr>`; }).join("")}
            <tr style="background:#fff7ed;font-weight:800;">
              <td style="padding:6px 8px;" colspan="1">TOTAL</td>
              <td style="padding:6px 8px;">${totalCovers}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>`}
      </div>

      <!-- Notes -->
      <div>
        <h3 style="font-size:14px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">📝 Notes</h3>
        <textarea rows="3" placeholder="Anything else staff should know…"
          onchange="DailySheet.saveTask('staff_notes', this.value)"
          style="width:100%;font-size:13px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px;resize:vertical;"
        >${tasks.staff_notes||""}</textarea>
      </div>
    </div>

    <style>
      @media print {
        .no-print, nav { display:none !important; }
        body { background:white; }
        #staff-sheet-print { box-shadow:none !important; border:none !important; }
        select, input { border:none !important; background:transparent !important; -webkit-appearance:none; }
      }
    </style>
    `;
  }

  function taskCheckbox(key, label) {
    const checked = tasks[key] ? "checked" : "";
    return `<label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer;">
      <input type="checkbox" ${checked} onchange="DailySheet.saveTask('${key}', this.checked?1:0)" />
      ${label}
    </label>`;
  }

  async function saveTask(key, value) {
    tasks[key] = value;
    try {
      await fetch("/api/daily-tasks", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ date: currentDate, ...tasks, [key]: value })
      });
    } catch(e) { console.error("save task failed", e); }
  }

  async function saveField(resId, field, value) {
    const existing = sheetFor(resId);
    const updated = { ...existing, [field]: value, date: currentDate, reservation_id: resId };
    sheetRows[resId] = updated;
    try {
      await fetch("/api/daily-sheet", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(updated)
      });
    } catch(e) { console.error("save field failed", e); }
  }

  async function checkIn(resId, checked) {
    if (!resId || !checked) return;
    try {
      await fetch(`/api/reservations/${resId}/status`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ status: "checked_in" })
      });
    } catch(e) { console.error("check-in failed", e); }
  }

  return { render, saveTask, saveField, checkIn };
})();
