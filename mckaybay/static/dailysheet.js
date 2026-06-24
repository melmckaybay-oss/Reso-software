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

  function dietaryText() {
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

  const TH = `style="border:1px solid #333;padding:4px 6px;background:#e5e7eb;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;text-align:left;"`;
  const TD = `style="border:1px solid #333;padding:4px 6px;font-size:12px;"`;
  function blankInput(value, onchange, width) {
    return `<input type="text" value="${value||""}" onchange="${onchange}"
      style="border:none;background:transparent;width:${width||'100%'};font-size:12px;padding:0;" />`;
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

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <tr>
          <td ${TH} style="width:14%">Day</td>
          <td ${TH} style="width:18%">Date</td>
          <td ${TH} style="width:16%">Hot Tub</td>
          <td ${TH} style="width:16%">Main Toilet</td>
          <td ${TH} style="width:16%">Porch</td>
        </tr>
        <tr>
          <td ${TD} style="font-weight:700;font-size:14px;">${dayName}</td>
          <td ${TD} style="font-weight:700;font-size:14px;">${humanDate}</td>
          <td ${TD} style="text-align:center;"><input type="checkbox" ${tasks.hot_tub?"checked":""} onchange="DailySheet.saveTask('hot_tub',this.checked?1:0)" /></td>
          <td ${TD} style="text-align:center;"><input type="checkbox" ${tasks.main_toilet?"checked":""} onchange="DailySheet.saveTask('main_toilet',this.checked?1:0)" /></td>
          <td ${TD} style="text-align:center;"><input type="checkbox" ${tasks.porch?"checked":""} onchange="DailySheet.saveTask('porch',this.checked?1:0)" /></td>
        </tr>
      </table>

      <div style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;margin-bottom:3px;">Arrivals</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr><td ${TH} style="width:8%">Check In</td><td ${TH} style="width:10%">Room #</td>
          <td ${TH} style="width:26%">Name</td><td ${TH} style="width:12%">Time</td>
          <td ${TH} style="width:10%">Numbers</td><td ${TH}>Dietary Restrictions</td></tr>
        ${arrivalsRaw.length === 0 ? `<tr><td ${TD} colspan="6" style="color:#9ca3af;">No arrivals.</td></tr>` :
          arrivalsRaw.map(a => `
          <tr>
            <td ${TD} style="text-align:center;"><input type="checkbox" onchange="DailySheet.checkIn(${a.id},this.checked)" /></td>
            <td ${TD}></td>
            <td ${TD} style="font-weight:600;">${a.first_name} ${a.last_name}</td>
            <td ${TD}>${a.arrival_time||""}</td>
            <td ${TD} style="text-align:center;">${a.num_guests}</td>
            <td ${TD}>${a.special_requests||""}</td>
          </tr>`).join("")}
      </table>

      <div style="font-size:11px;font-weight:800;color:#9a3412;text-transform:uppercase;margin-bottom:3px;">Breakfast — Cooked</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <tr><td ${TH} style="width:28%">Name</td><td ${TH} style="width:10%">Numbers</td>
          <td ${TH} style="width:14%">Time</td><td ${TH}>Dietary Restrictions</td></tr>
        ${mealRows.length === 0 ? `<tr><td ${TD} colspan="4" style="color:#9ca3af;">No meal-package guests.</td></tr>` :
          mealRows.map(g => { const s = sheetFor(g.id); return `
          <tr>
            <td ${TD} style="font-weight:600;">${g.name}</td>
            <td ${TD} style="text-align:center;">${g.guests}</td>
            <td ${TD}>${blankInput(s.breakfast_time, `DailySheet.saveField(${g.id},'breakfast_time',this.value)`)}</td>
            <td ${TD} style="font-size:11px;color:#b45309;">${dietaryText()}</td>
          </tr>`; }).join("")}
      </table>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">
        <span style="font-size:11px;font-weight:700;">Menu:</span>
        ${blankInput(tasks.breakfast_menu, `DailySheet.saveTask('breakfast_menu',this.value)`, '60%')}
      </div>

      <div style="font-size:11px;font-weight:800;color:#9a3412;text-transform:uppercase;margin-bottom:3px;">Breakfast — Continental</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <tr><td ${TH} style="width:40%">Name</td><td ${TH} style="width:15%">Numbers</td><td ${TH}>Menu / Notes</td></tr>
        <tr><td ${TD}></td><td ${TD}></td><td ${TD}></td></tr>
        <tr><td ${TD}></td><td ${TD}></td><td ${TD}></td></tr>
      </table>

      <div style="font-size:11px;font-weight:800;color:#1e40af;text-transform:uppercase;margin-bottom:3px;">Packed Lunches for Next Day — Out-Lunch</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <tr><td ${TH} style="width:40%">Name</td><td ${TH} style="width:15%">Numbers</td><td ${TH}>Menu</td></tr>
        ${mealRows.length === 0 ? `<tr><td ${TD} colspan="3" style="color:#9ca3af;">—</td></tr>` :
          mealRows.map(g => { const s = sheetFor(g.id); return `
          <tr>
            <td ${TD} style="font-weight:600;">${g.name}</td>
            <td ${TD} style="text-align:center;">${blankInput(s.lunch_numbers,`DailySheet.saveField(${g.id},'lunch_numbers',this.value)`,'40px')}</td>
            <td ${TD}>${blankInput(s.lunch_type,`DailySheet.saveField(${g.id},'lunch_type',this.value)`)}</td>
          </tr>`; }).join("")}
      </table>

      <div style="font-size:11px;font-weight:800;color:#1e40af;text-transform:uppercase;margin-bottom:3px;">In-Lunch</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <tr><td ${TH} style="width:40%">Name</td><td ${TH} style="width:15%">Numbers</td><td ${TH}>Menu</td></tr>
        <tr><td ${TD}></td><td ${TD}></td><td ${TD}></td></tr>
        <tr><td ${TD}></td><td ${TD}></td><td ${TD}></td></tr>
      </table>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">
        <span style="font-size:11px;font-weight:700;">Special:</span>
        ${blankInput(tasks.lunch_special, `DailySheet.saveTask('lunch_special',this.value)`, '60%')}
        <span style="font-size:11px;font-weight:700;margin-left:16px;">Sandwiches to make:</span>
        <input type="number" min="0" value="${tasks.sandwiches_count||0}"
          onchange="DailySheet.saveTask('sandwiches_count', this.value)"
          style="width:50px;font-size:12px;padding:2px;border:1px solid #ccc;" />
      </div>

      <div style="font-size:11px;font-weight:800;color:#991b1b;text-transform:uppercase;margin-bottom:3px;">Departures</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <tr><td ${TH} style="width:40%">Name</td><td ${TH} style="width:15%">Room #</td>
          <td ${TH} style="width:15%">Time</td><td ${TH}>Payment Done</td></tr>
        ${departuresRaw.length === 0 ? `<tr><td ${TD} colspan="4" style="color:#9ca3af;">No departures.</td></tr>` :
          departuresRaw.map(d => { const s = sheetFor(d.id); return `
          <tr>
            <td ${TD} style="font-weight:600;">${d.first_name} ${d.last_name}</td>
            <td ${TD}></td>
            <td ${TD}></td>
            <td ${TD} style="text-align:center;">
              <input type="checkbox" ${s.payment_done?"checked":""}
                onchange="DailySheet.saveField(${d.id},'payment_done',this.checked?1:0)" />
            </td>
          </tr>`; }).join("")}
      </table>

      <div style="font-size:11px;font-weight:800;color:#6d28d9;text-transform:uppercase;margin-bottom:3px;">Room Stay-over — Maintenance</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <tr><td ${TH} style="width:14%">Room #</td><td ${TH} style="width:26%">Guest</td>
          <td ${TH} style="width:20%">Cleaning Status</td><td ${TH}>Notes</td></tr>
        ${roomRows.length === 0 ? `<tr><td ${TD} colspan="4" style="color:#9ca3af;">No occupied rooms.</td></tr>` :
          roomRows.map(r => { const s = sheetFor(r.resId); return `
          <tr>
            <td ${TD} style="font-weight:600;">${r.room}</td>
            <td ${TD}>${r.name}</td>
            <td ${TD}>${blankInput(s.cleaning_status,`DailySheet.saveField(${r.resId},'cleaning_status',this.value)`)}</td>
            <td ${TD}>${blankInput(s.room_notes,`DailySheet.saveField(${r.resId},'room_notes',this.value)`)}</td>
          </tr>`; }).join("")}
      </table>

      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
        <span style="font-size:11px;font-weight:800;color:#9a3412;text-transform:uppercase;">Dinner</span>
        <span style="font-size:12px;font-weight:700;color:#9a3412;">Total: ${totalCovers} covers (5:30 → ${total530} &nbsp;|&nbsp; 7:00 → ${total700})</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <tr><td ${TH} style="width:26%">Name</td><td ${TH} style="width:10%">Numbers</td>
          <td ${TH} style="width:10%;text-align:center;">5:30</td><td ${TH} style="width:10%;text-align:center;">7:00</td>
          <td ${TH} style="width:18%">Dietary Restrictions</td><td ${TH}>Menu</td></tr>
        ${mealRows.length === 0 ? `<tr><td ${TD} colspan="6" style="color:#9ca3af;">No meal-package guests tonight.</td></tr>` :
          mealRows.map(g => { const s = sheetFor(g.id); return `
          <tr>
            <td ${TD} style="font-weight:600;">${g.name}</td>
            <td ${TD} style="text-align:center;">${g.guests}</td>
            <td ${TD} style="text-align:center;">
              <input type="number" min="0" max="${g.guests}" value="${s.dinner_530||""}"
                onchange="DailySheet.saveField(${g.id},'dinner_530',this.value)"
                style="width:36px;text-align:center;border:none;background:transparent;font-size:12px;" />
            </td>
            <td ${TD} style="text-align:center;">
              <input type="number" min="0" max="${g.guests}" value="${s.dinner_700||""}"
                onchange="DailySheet.saveField(${g.id},'dinner_700',this.value)"
                style="width:36px;text-align:center;border:none;background:transparent;font-size:12px;" />
            </td>
            <td ${TD} style="font-size:11px;color:#b45309;">${dietaryText()}</td>
            <td ${TD}></td>
          </tr>`; }).join("")}
        <tr style="background:#fff7ed;font-weight:800;">
          <td ${TD}>TOTAL</td>
          <td ${TD} style="text-align:center;">${mealRows.reduce((s,g)=>s+g.guests,0)}</td>
          <td ${TD} style="text-align:center;">${total530}</td>
          <td ${TD} style="text-align:center;">${total700}</td>
          <td ${TD} colspan="2"></td>
        </tr>
      </table>

      <div style="font-size:11px;font-weight:800;color:#92400e;text-transform:uppercase;margin-bottom:3px;">Notes</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td ${TD} style="height:70px;vertical-align:top;">
          <textarea rows="4" onchange="DailySheet.saveTask('staff_notes', this.value)"
            style="width:100%;border:none;background:transparent;font-size:12px;resize:vertical;"
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
        input[type=checkbox] { transform:scale(1.1); }
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
