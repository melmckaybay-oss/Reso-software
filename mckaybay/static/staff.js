/**
 * McKay Bay Lodge — Staff Schedule
 * Gantt-style weekly view. Fixed staff list, type role+time into each day cell.
 */

const Staff = (() => {

  const CELL_W  = 110;
  const LABEL_W = 140;

  const ROLE_COLOURS = {
    "off":         "#e5e7eb",
    "dock":        "#bfdbfe",
    "housekeeping":"#ddd6fe",
    "serve":       "#bbf7d0",
    "split":       "#fde68a",
    "dinner cook": "#fed7aa",
    "breakfast cook":"#fecaca",
    "guide":       "#a5f3fc",
  };

  function roleColour(text) {
    if (!text) return "#f9fafb";
    const lower = text.toLowerCase();
    for (const [key, col] of Object.entries(ROLE_COLOURS)) {
      if (lower.startsWith(key)) return col;
    }
    return "#e0f2fe";
  }

  let staffList    = [];
  let scheduleMap  = {};  // "staffId_date" -> role
  let viewStart    = null;
  let viewDays     = 14;

  function monday(d) {
    const day = new Date(d);
    const diff = (day.getDay() + 6) % 7;
    day.setDate(day.getDate() - diff);
    return day;
  }

  function addDays(d, n) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  }

  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function today() {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  }

  async function loadSchedule() {
    const start = isoDate(viewStart);
    const end   = isoDate(addDays(viewStart, viewDays - 1));
    try {
      const rows = await API.staffSchedule(start, end);
      scheduleMap = {};
      rows.forEach(r => { scheduleMap[`${r.staff_id}_${r.work_date}`] = r.role; });
    } catch(e) { scheduleMap = {}; }
  }

  async function render(startDate = null) {
    const container = document.getElementById("main-content");
    if (!staffList.length) {
      try { staffList = await API.staff(); } catch(e) { staffList = []; }
    }
    viewStart = startDate || monday(today());
    await loadSchedule();
    buildUI(container);
  }

  function buildUI(container) {
    const days    = Array.from({ length: viewDays }, (_, i) => addDays(viewStart, i));
    const todayIso = isoDate(today());

    const dayHeaders = days.map(d => {
      const iso       = isoDate(d);
      const isToday   = iso === todayIso;
      const dayName   = d.toLocaleDateString("en-CA", { weekday: "short" });
      const dayNum    = d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
      return `<div style="min-width:${CELL_W}px;width:${CELL_W}px;height:48px;display:flex;flex-direction:column;
                align-items:center;justify-content:center;border-right:1px solid #e5e7eb;flex-shrink:0;
                background:${isToday ? "#fef08a" : d.getDay()===0||d.getDay()===6 ? "#f3f4f6" : "white"};
                font-size:11px;font-weight:${isToday?"700":"500"};color:${isToday?"#713f12":"#374151"};">
        <span>${dayName}</span><span>${dayNum}</span>
      </div>`;
    }).join("");

    const staffRows = staffList.map(s => {
      const cells = days.map(d => {
        const iso   = isoDate(d);
        const key   = `${s.id}_${iso}`;
        const role  = scheduleMap[key] || "";
        const bg    = roleColour(role);
        const isToday = iso === todayIso;
        return `<div style="min-width:${CELL_W}px;width:${CELL_W}px;height:44px;border-right:1px solid #e5e7eb;
                  border-bottom:1px solid #e5e7eb;flex-shrink:0;padding:2px;
                  background:${isToday ? "#fefce8" : "white"};">
          <input type="text" value="${role}"
            data-staff="${s.id}" data-date="${iso}"
            placeholder="Role / time"
            style="width:100%;height:100%;border:none;border-radius:4px;padding:3px 6px;font-size:12px;
                   background:${bg};cursor:text;box-shadow:none;outline:none;"
            onchange="Staff.saveCell(this)"
            onfocus="this.style.outline='2px solid #3b82f6';this.style.background='white';"
            onblur="Staff.refreshCell(this,'${role}')" />
        </div>`;
      }).join("");

      return `<div style="display:flex;align-items:stretch;">
        <div style="min-width:${LABEL_W}px;width:${LABEL_W}px;height:44px;padding:0 10px;display:flex;
          align-items:center;justify-content:space-between;font-size:13px;font-weight:500;
          border-right:2px solid #d1d5db;border-bottom:1px solid #e5e7eb;
          background:white;position:sticky;left:0;z-index:10;">
          <span>${s.name}</span>
          <button onclick="Staff.removeStaff(${s.id},'${s.name}')"
            style="color:#d1d5db;font-size:16px;border:none;background:none;cursor:pointer;padding:0 2px;line-height:1;"
            title="Remove ${s.name}">×</button>
        </div>
        ${cells}
      </div>`;
    }).join("");

    container.innerHTML = `
      <div class="max-w-full">
        <!-- Controls -->
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          <button class="btn btn-secondary" onclick="Staff.navigate(-7)">← Week</button>
          <button class="btn btn-secondary" onclick="Staff.navigate(-14)">← 2 Weeks</button>
          <button class="btn btn-secondary" onclick="Staff.goToToday()">Today</button>
          <button class="btn btn-secondary" onclick="Staff.navigate(14)">2 Weeks →</button>
          <button class="btn btn-secondary" onclick="Staff.navigate(7)">Week →</button>
          <div style="display:flex;align-items:center;gap:6px;margin-left:8px;">
            <label style="margin:0;font-size:12px;color:#6b7280;white-space:nowrap;">Jump to:</label>
            <input type="month" style="width:150px;padding:4px 8px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;"
              onchange="Staff.jumpToMonth(this.value)" title="Jump to month" />
          </div>
          <div class="flex-1"></div>
          <select onchange="Staff.setViewDays(+this.value)"
            style="width:auto;padding:5px 10px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;">
            <option value="7"  ${viewDays===7?"selected":""}>1 week</option>
            <option value="14" ${viewDays===14?"selected":""}>2 weeks</option>
            <option value="28" ${viewDays===28?"selected":""}>4 weeks</option>
          </select>
        </div>

        <!-- Role legend -->
        <div class="flex items-center gap-2 mb-3 flex-wrap text-xs">
          <span class="text-gray-400 font-medium">Roles:</span>
          ${Object.entries(ROLE_COLOURS).map(([role, col]) =>
            `<span style="background:${col};padding:2px 8px;border-radius:4px;font-weight:500;text-transform:capitalize;">${role}</span>`
          ).join("")}
        </div>

        <!-- Add staff -->
        <div class="flex items-center gap-2 mb-3">
          <input type="text" id="new-staff-name" placeholder="New staff member name…"
            style="width:220px;padding:6px 10px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;"
            onkeydown="if(event.key==='Enter')Staff.addStaff()" />
          <button class="btn btn-primary text-sm py-1.5" onclick="Staff.addStaff()">+ Add Staff</button>
        </div>

        <!-- Schedule grid -->
        <div style="overflow-x:auto;background:white;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <!-- Header row -->
          <div style="display:flex;position:sticky;top:0;z-index:25;background:white;border-bottom:2px solid #cbd5e1;">
            <div style="min-width:${LABEL_W}px;width:${LABEL_W}px;height:48px;position:sticky;left:0;z-index:26;
              background:#f8fafc;border-right:2px solid #d1d5db;flex-shrink:0;
              display:flex;align-items:center;padding:0 10px;font-size:12px;font-weight:700;
              color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Staff</div>
            ${dayHeaders}
          </div>
          ${staffList.length === 0
            ? `<div class="p-10 text-center text-gray-400">
                <div class="text-4xl mb-3">👤</div>
                <p class="text-sm">No staff members yet. Add your first staff member above.</p>
              </div>`
            : staffRows
          }
        </div>
        <p class="text-xs text-gray-400 mt-2">Click any cell to type a role and start time (e.g. "Serve 4pm", "Guide 6am", "OFF"). Press Tab to move to the next cell.</p>
      </div>
    `;
  }

  async function saveCell(input) {
    const staffId  = input.dataset.staff;
    const workDate = input.dataset.date;
    const role     = input.value.trim();
    const bg       = roleColour(role);
    input.style.background = bg || "#f9fafb";
    scheduleMap[`${staffId}_${workDate}`] = role;
    try {
      await API.saveShift({ staff_id: parseInt(staffId), work_date: workDate, role });
    } catch(e) { console.error("Save shift failed:", e); }
  }

  function refreshCell(input, originalRole) {
    const role = input.value.trim();
    input.style.outline  = "";
    input.style.background = roleColour(role) || "#f9fafb";
  }

  async function addStaff() {
    const input = document.getElementById("new-staff-name");
    const name  = input ? input.value.trim() : "";
    if (!name) return;
    try {
      const s = await API.addStaff(name);
      staffList.push(s);
      input.value = "";
      buildUI(document.getElementById("main-content"));
    } catch(e) { alert("Could not add staff: " + e.message); }
  }

  async function removeStaff(id, name) {
    if (!confirm(`Remove ${name} from the staff list? This will also delete their schedule.`)) return;
    try {
      await API.deleteStaff(id);
      staffList = staffList.filter(s => s.id !== id);
      buildUI(document.getElementById("main-content"));
    } catch(e) { alert("Could not remove staff: " + e.message); }
  }

  function navigate(delta) {
    viewStart = addDays(viewStart, delta);
    loadSchedule().then(() => buildUI(document.getElementById("main-content")));
  }

  function goToToday() {
    viewStart = monday(today());
    loadSchedule().then(() => buildUI(document.getElementById("main-content")));
  }

  function setViewDays(n) {
    viewDays = n;
    loadSchedule().then(() => buildUI(document.getElementById("main-content")));
  }

  function jumpToMonth(val) {
    if (!val) return;
    const d = new Date(val + "-01T12:00:00");
    viewStart = monday(d);
    loadSchedule().then(() => buildUI(document.getElementById("main-content")));
  }

  return { render, navigate, goToToday, setViewDays, jumpToMonth, saveCell, refreshCell, addStaff, removeStaff };
})();
