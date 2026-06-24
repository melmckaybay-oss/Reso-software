/**
 * McKay Bay Lodge — Daily Staff Sheet (ledger / spreadsheet style)
 * Mirrors the paper binder sheet. Auto-fills names, rooms, numbers, dietary
 * from reservations. Blank cells are left for handwriting or on-screen typing.
 */

const DailySheet = (() => {

  let currentDate = null;
  let occupied      = [];
  let arrivalsRaw    = [];
  let departuresRaw  = [];
  let mealGuests     = [];
  let dietaryAll     = [];
  let tasks          = { hot_tub:0, main_toilet:0, porch:0, sandwiches_count:0, staff_notes:"" };
  let sheetRows      = {};

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
      dinner_530:0, dinner_700:0, payment_done:0, cleaning_status:"", room_notes:""
    };
  }

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
    return dietaryAll
      .filter(d => d.reservation_id === resId)
      .map(d => (d.guest_desc ? d.guest_desc+": " : "") + d.requirement)
      .join("; ");
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

  function TH(color) { return `style="border:1px solid #333;padding:7px 8px;background:${color||'#e5e7eb'};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;text-align:left;color:#1f2937;"`; }
  function TD(tint) { return `style="border:1px solid #333;padding:9px 8px;font-size:13px;height:30px;${tint?`background:${tint};`:''}"`; }
  function blankInput(value, onchange, width) {
    return `<input type="text" value="${value||""}" onchange="${onchange}"
      style="border:none;background:transparent;width:${width||'100%'};font-size:13px;padding:0;" />`;
  }

  function buildUI(date) {
    const container = document.getElementById("main-content");
    const dayName   = new Date(date+"T12:00:00").toLocaleDateString("en-CA",{weekday:"long"});
    const humanDate = new Date(date+"T12:00:00").toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"});
    const mealRows  = mealPlanRows();
    const roomRows  = occupiedRoomsList();
    const total530  = mealRows.reduce((s,g)=>s+(parseInt(sheetFor(g.id).dinner_530)||0),0);
    const total700  = mealRows.reduce((s,g)=>s+(parseInt(sheetFor(g.id).dinner_700)||0),0);
    const totalCovers = total530 + total700;

    container.innerHTML = `
    <div id="staff-sheet-print" class="max-w-5xl mx-auto bg-white" style="font-family:Arial,Helvetica,sans-serif;">

      <div class="no-print flex items-center gap-3 mb-4 flex-wrap">
        <button class="btn btn-secondary" onclick="Daily.render('${date}')">← Back to Overview</button>
        <input type="date" value="${date}"
          style="width:auto;font-size:1rem;font-weight:600;border:1px solid #d1d5db;border-radius:6px;padding:5px 10px;"
          onchange="DailySheet.render(this.value)" />
        <button class="btn btn-primary" onclick="window.print()">🖨 Print Sheet</button>
        <span class="text-xs text-gray-400 ml-auto">On-screen edits save automatically — blank cells print for handwriting</span>
      </div>

      <!-- Header bar -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <tr>
          <td ${TH('#1a535c')} style="color:white;width:14%">Day</td>
          <td ${TH('#1a535c')} style="color:white;width:18%">Date</td>
          <td ${TH('#1a535c')} style="color:white;width:16%">Hot Tub</td>
          <td ${TH('#1a535c')} style="color:white;width:16%">Main Toilet</td>
          <td ${TH('#1a535c')} style="color:white;width:16%">Porch</td>
        </tr>
        <tr>
          <td ${TD('#f0f7f8')} style="font-weight:800;font-size:16px;">${dayName}</td>
          <td ${TD('#f0f7f8')} style="font-weight:800;font-size:16px;">${humanDate}</td>
          <td ${TD('#f0f7f8')} style="text-align:center;"><input type="checkbox" style="transform:scale(1.3)" ${tasks.hot_tub?"checked":""} onchange="DailySheet.saveTask('hot_tub',this.checked?1:0)" /></td>
          <td ${TD('#f0f7f8')} style="text-align:center;"><input type="checkbox" style="transform:scale(1.3)" ${tasks.main_toilet?"checked":""} onchange="DailySheet.saveTask('main_toilet',this.checked?1:0)" /></td>
          <td ${TD('#f0f7f8')} style="text-align:center;"><input type="checkbox" style="transform:scale(1.3)" ${tasks.porch?"checked":""} onchange="DailySheet.saveTask('porch',this.checked?1:0)" /></td>
        </tr>
      </table>

      <!-- ARRIVALS -->
      <div style="font-size:13px;font-weight:800;color:#166534;text-transform:uppercase;margin-bottom:4px;">✈ Arrivals</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr><td ${TH('#dcfce7')} style="width:8%">Check In</td><td ${TH('#dcfce7')} style="width:10%">Room #</td>
          <td ${TH('#dcfce7')} style="width:26%">Name</td><td ${TH('#dcfce7')} style="width:12%">Time</td>
          <td ${TH('#dcfce7')} style="width:10%">Numbers</td><td ${TH('#dcfce7')}>Dietary Restrictions</td></tr>
        ${arrivalsRaw.length === 0 ? `<tr><td ${TD()} colspan="6" style="color:#9ca3af;">No arrivals.</td></tr>` :
          arrivalsRaw.map(a => `
          <tr>
            <td ${TD('#f0fdf4')} style="text-align:center;"><input type="checkbox" style="transform:scale(1.2)" onchange="DailySheet.checkIn(${a.id},this.checked)" /></td>
            <td ${TD('#f0fdf4')}></td>
            <td ${TD('#f0fdf4')} style="font-weight:700;">${a.first_name} ${a.last_name}</td>
            <td ${TD('#f0fdf4')}>${a.arrival_time||""}</td>
            <td ${TD('#f0fdf4')} style="text-align:center;">${a.num_guests}</td>
            <td ${TD('#f0fdf4')}>${a.special_requests||""}</td>
          </tr>`).join("")}
      </table>

      <!-- BREAKFAST — combined Cooked / Continental columns -->
      <div style="font-size:13px;font-weight:800;color:#9a3412;text-transform:uppercase;margin-bottom:4px;">🍳 Breakfast</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <tr><td ${TH('#fed7aa')} style="width:24%">Name</td><td ${TH('#fed7aa')} style="width:9%">Numbers</td>
          <td ${TH('#fed7aa')} style="width:16%;text-align:center;">Cooked — write time</td>
          <td ${TH('#fed7aa')} style="width:14%;text-align:center;">Continental — check</td>
          <td ${TH('#fed7aa')}>Dietary Restrictions</td></tr>
        ${mealRows.length === 0 ? `<tr><td ${TD()} colspan="5" style="color:#9ca3af;">No meal-package guests.</td></tr>` :
          mealRows.map(g => { const s = sheetFor(g.id); return `
          <tr>
            <td ${TD('#fff7ed')} style="font-weight:700;">${g.name}</td>
            <td ${TD('#fff7ed')} style="text-align:center;">${g.guests}</td>
            <td ${TD('#fffbeb')} style="text-align:center;">${blankInput(s.breakfast_time, `DailySheet.saveField(${g.id},'breakfast_time',this.value)`,'80px')}</td>
            <td ${TD('#fffbeb')} style="text-align:center;">
              <input type="checkbox" style="transform:scale(1.3)" ${s.breakfast_type==='Continental'?'checked':''}
                onchange="DailySheet.saveField(${g.id},'breakfast_type',this.checked?'Continental':'')" />
            </td>
            <td ${TD('#fff7ed')} style="font-size:12px;color:#b45309;">${dietaryFor(g.id)}</td>
          </tr>`; }).join("")}
      </table>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:18px;">
        <span style="font-size:12px;font-weight:700;">Today's Menu:</span>
        ${blankInput(tasks.breakfast_menu, `DailySheet.saveTask('breakfast_menu',this.value)`, '65%')}
      </div>

      <!-- LUNCH — combined Take-away / In-Lunch columns -->
      <div style="font-size:13px;font-weight:800;color:#1e40af;text-transform:uppercase;margin-bottom:4px;">🥪 Packed Lunch — for Next Day</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <tr><td ${TH('#bfdbfe')} style="width:24%">Name</td><td ${TH('#bfdbfe')} style="width:9%">Numbers</td>
          <td ${TH('#bfdbfe')} style="width:18%;text-align:center;">Take-away — time</td>
          <td ${TH('#bfdbfe')} style="width:18%;text-align:center;">In-Lodge — time</td>
          <td ${TH('#bfdbfe')}>Notes</td></tr>
        ${mealRows.length === 0 ? `<tr><td ${TD()} colspan="5" style="color:#9ca3af;">No guests to plan for.</td></tr>` :
          mealRows.map(g => { const s = sheetFor(g.id); return `
          <tr>
            <td ${TD('#eff6ff')} style="font-weight:700;">${g.name}</td>
            <td ${TD('#eff6ff')} style="text-align:center;">${g.guests}</td>
            <td ${TD('#f8fafc')} style="text-align:center;">${blankInput(s.lunch_time,`DailySheet.saveField(${g.id},'lunch_time',this.value)`,'80px')}</td>
            <td ${TD('#f8fafc')} style="text-align:center;">${blankInput(s.lunch_numbers,`DailySheet.saveField(${g.id},'lunch_numbers',this.value)`,'80px')}</td>
            <td ${TD('#eff6ff')}></td>
          </tr>`; }).join("")}
      </table>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:18px;">
        <span style="font-size:12px;font-weight:700;">Special:</span>
        ${blankInput(tasks.lunch_special, `DailySheet.saveTask('lunch_special',this.value)`, '50%')}
        <span style="font-size:12px;font-weight:700;margin-left:16px;">Sandwiches to make:</span>
        <input type="number" min="0" value="${tasks.sandwiches_count||0}"
          onchange="DailySheet.saveTask('sandwiches_count', this.value)"
          style="width:55px;font-size:13px;padding:4px;border:1px solid #ccc;" />
      </div>

      <!-- DEPARTURES -->
      <div style="font-size:13px;font-weight:800;color:#991b1b;text-transform:uppercase;margin-bottom:4px;">🚪 Departures</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <tr><td ${TH('#fecaca')} style="width:40%">Name</td><td ${TH('#fecaca')} style="width:15%">Room #</td>
          <td ${TH('#fecaca')} style="width:15%">Time</td><td ${TH('#fecaca')}>Payment Done</td></tr>
        ${departuresRaw.length === 0 ? `<tr><td ${TD()} colspan="4" style="color:#9ca3af;">No departures.</td></tr>` :
          departuresRaw.map(d => { const s = sheetFor(d.id); return `
          <tr>
            <td ${TD('#fef2f2')} style="font-weight:700;">${d.first_name} ${d.last_name}</td>
            <td ${TD('#fef2f2')}></td>
            <td ${TD('#fef2f2')}></td>
            <td ${TD('#fef2f2')} style="text-align:center;">
              <input type="checkbox" style="transform:scale(1.3)" ${s.payment_done?"checked":""}
                onchange="DailySheet.saveField(${d.id},'payment_done',this.checked?1:0)" />
            </td>
          </tr>`; }).join("")}
      </table>

      <!-- ROOM STAY-OVER MAINTENANCE -->
      <div style="font-size:13px;font-weight:800;color:#6d28d9;text-transform:uppercase;margin-bottom:4px;">🧹 Room Stay-over — Maintenance</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <tr><td ${TH('#ede9fe')} style="width:14%">Room #</td><td ${TH('#ede9fe')} style="width:26%">Guest</td>
          <td ${TH('#ede9fe')} style="width:20%">Cleaning Status</td><td ${TH('#ede9fe')}>Notes</td></tr>
        ${roomRows.length === 0 ? `<tr><td ${TD()} colspan="4" style="color:#9ca3af;">No occupied rooms.</td></tr>` :
          roomRows.map(r => { const s = sheetFor(r.resId); return `
          <tr>
            <td ${TD('#f5f3ff')} style="font-weight:700;">${r.room}</td>
            <td ${TD('#f5f3ff')}>${r.name}</td>
            <td ${TD('#f5f3ff')}>${blankInput(s.cleaning_status,`DailySheet.saveField(${r.resId},'cleaning_status',this.value)`)}</td>
            <td ${TD('#f5f3ff')}>${blankInput(s.room_notes,`DailySheet.saveField(${r.resId},'room_notes',this.value)`)}</td>
          </tr>`; }).join("")}
      </table>

      <!-- DINNER -->
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:800;color:#9a3412;text-transform:uppercase;">🍽 Dinner</span>
        <span style="font-size:13px;font-weight:700;color:#9a3412;">Total: ${totalCovers} covers &nbsp; (5:30 → ${total530} &nbsp;|&nbsp; 7:00 → ${total700})</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <tr><td ${TH('#fed7aa')} style="width:24%">Name</td><td ${TH('#fed7aa')} style="width:9%">Numbers</td>
          <td ${TH('#fed7aa')} style="width:10%;text-align:center;">5:30</td><td ${TH('#fed7aa')} style="width:10%;text-align:center;">7:00</td>
          <td ${TH('#fed7aa')} style="width:18%">Dietary Restrictions</td><td ${TH('#fed7aa')}>Menu</td></tr>
        ${mealRows.length === 0 ? `<tr><td ${TD()} colspan="6" style="color:#9ca3af;">No meal-package guests tonight.</td></tr>` :
          mealRows.map(g => { const s = sheetFor(g.id); return `
          <tr>
            <td ${TD('#fff7ed')} style="font-weight:700;">${g.name}</td>
            <td ${TD('#fff7ed')} style="text-align:center;">${g.guests}</td>
            <td ${TD('#fffbeb')} style="text-align:center;">
              <input type="number" min="0" max="${g.guests}" value="${s.dinner_530||""}"
                onchange="DailySheet.saveField(${g.id},'dinner_530',this.value)"
                style="width:42px;text-align:center;border:1px solid #fde68a;background:white;font-size:13px;border-radius:4px;" />
            </td>
            <td ${TD('#fffbeb')} style="text-align:center;">
              <input type="number" min="0" max="${g.guests}" value="${s.dinner_700||""}"
                onchange="DailySheet.saveField(${g.id},'dinner_700',this.value)"
                style="width:42px;text-align:center;border:1px solid #fde68a;background:white;font-size:13px;border-radius:4px;" />
            </td>
            <td ${TD('#fff7ed')} style="font-size:12px;color:#b45309;">${dietaryFor(g.id)}</td>
            <td ${TD('#fff7ed')}></td>
          </tr>`; }).join("")}
        <tr style="background:#fed7aa;font-weight:800;">
          <td ${TD()}>TOTAL</td>
          <td ${TD()} style="text-align:center;">${mealRows.reduce((s,g)=>s+g.guests,0)}</td>
          <td ${TD()} style="text-align:center;">${total530}</td>
          <td ${TD()} style="text-align:center;">${total700}</td>
          <td ${TD()} colspan="2"></td>
        </tr>
      </table>

      <!-- NOTES -->
      <div style="font-size:13px;font-weight:800;color:#92400e;text-transform:uppercase;margin-bottom:4px;">📝 Notes</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td ${TD('#fffbeb')} style="height:80px;vertical-align:top;">
          <textarea rows="4" onchange="DailySheet.saveTask('staff_notes', this.value)"
            style="width:100%;border:none;background:transparent;font-size:13px;resize:vertical;"
            placeholder="Anything else staff should know…">${tasks.staff_notes||""}</textarea>
        </td></tr>
      </table>
    </div>

    <style>
      @media print {
        .no-print, nav { display:none !important; }
        body { background:white; }
        table { page-break-inside:auto; }
        tr { page-break-inside:avoid; }
        input[type=checkbox] { transform:scale(1.2) !important; }
      }
    </style>
    `;
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
