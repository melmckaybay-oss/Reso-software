/**
 * McKay Bay Lodge — Staff Schedule
 * Gantt-style weekly view. Fixed staff list, type role+time into each day cell.
 */

const Staff = (() => {

  const CELL_W  = 130;
  const LABEL_W = 150;
  const CELL_H  = 56;

  const ROLE_COLOURS = {
    "off":            "#e5e7eb",
    "dock":           "#bfdbfe",
    "housekeeping":   "#ddd6fe",
    "hk":             "#ddd6fe",
    "serve":          "#bbf7d0",
    "srv":            "#bbf7d0",
    "server":         "#bbf7d0",
    "split":          "#fde68a",
    "dinner cook":    "#fed7aa",
    "dc":             "#fed7aa",
    "breakfast cook": "#fecaca",
    "bc":             "#fecaca",
    "guide":          "#a5f3fc",
    "gd":             "#a5f3fc",
    "dock":           "#bfdbfe",
    "dk":             "#bfdbfe",
  };

  // Abbreviation expansion map — typed shorthand → full display text
  const ABBREV = {
    "hk":   "Housekeeping",
    "bc":   "Breakfast Cook",
    "dc":   "Dinner Cook",
    "srv":  "Server",
    "srvr": "Server",
    "gd":   "Guide",
    "dk":   "Dock",
    "off":  "Off",
    "sp":   "Split",
  };

  // Legend display (full names only)
  const LEGEND_ROLES = {
    "Off":            "#e5e7eb",
    "Dock":           "#bfdbfe",
    "Housekeeping":   "#ddd6fe",
    "Server":         "#bbf7d0",
    "Split":          "#fde68a",
    "Dinner Cook":    "#fed7aa",
    "Breakfast Cook": "#fecaca",
    "Guide":          "#a5f3fc",
  };

  // Abbreviation hint shown in legend
  const ABBREV_HINTS = {
    "Off":            "off",
    "Dock":           "dk",
    "Housekeeping":   "hk",
    "Server":         "srv",
    "Split":          "sp",
    "Dinner Cook":    "dc",
    "Breakfast Cook": "bc",
    "Guide":          "gd",
  };

  function expandAbbrev(text) {
    if (!text) return text;
    // Only expand if the first word (before any space/number) is an abbreviation
    const lower = text.toLowerCase().trim();
    const firstWord = lower.split(/[\s\d]/)[0];
    if (ABBREV[firstWord]) {
      // Replace just the first word, keep the rest (e.g. time)
      return text.trim().replace(new RegExp("^" + firstWord, "i"), ABBREV[firstWord]);
    }
    return text;
  }

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

  // Tooltip element
  function getTooltip() { return document.getElementById("staff-tooltip"); }

  function showTooltip(event, text) {
    if (!text || !text.trim()) return;
    let tt = getTooltip();
    if (!tt) {
      tt = document.createElement("div");
      tt.id = "staff-tooltip";
      tt.style.cssText = `position:fixed;z-index:9999;background:#1e293b;color:white;
        padding:8px 12px;border-radius:8px;font-size:13px;max-width:260px;
        pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.3);line-height:1.5;`;
      document.body.appendChild(tt);
    }
    tt.textContent = text;
    tt.style.display = "block";
    moveTooltip(event);
    document.addEventListener("mousemove", moveTooltip);
  }

  function moveTooltip(e) {
    const tt = getTooltip();
    if (!tt || tt.style.display === "none") return;
    const x = e.clientX + 16, y = e.clientY + 16;
    const w = tt.offsetWidth || 200, h = tt.offsetHeight || 40;
    tt.style.left = (x + w > window.innerWidth  ? x - w - 32 : x) + "px";
    tt.style.top  = (y + h > window.innerHeight ? y - h - 32 : y) + "px";
  }

  function hideTooltip() {
    const tt = getTooltip();
    if (tt) tt.style.display = "none";
    document.removeEventListener("mousemove", moveTooltip);
  }

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
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const dayName   = d.toLocaleDateString("en-CA", { weekday: "short" });
      const dayNum    = d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
      return `<div style="min-width:${CELL_W}px;width:${CELL_W}px;height:48px;display:flex;flex-direction:column;
                align-items:center;justify-content:center;border-right:1px solid #e5e7eb;flex-shrink:0;
                background:${isToday ? "#fef08a" : isWeekend ? "#f3f4f6" : "white"};
                font-size:11px;font-weight:${isToday?"700":"500"};color:${isToday?"#713f12":"#374151"};">
        <span style="font-weight:600">${dayName}</span>
        <span style="opacity:0.75">${dayNum}</span>
      </div>`;
    }).join("");

    const staffRows = staffList.map((s, si) => {
      const rowBg = si % 2 === 0 ? "#ffffff" : "#f8fafc";
      const cells = days.map(d => {
        const iso     = isoDate(d);
        const key     = `${s.id}_${iso}`;
        const role    = scheduleMap[key] || "";
        const bg      = role ? roleColour(role) : (iso === todayIso ? "#fefce8" : rowBg);
        const isToday = iso === todayIso;
        const safeRole = role.replace(/'/g, "\\'").replace(/"/g, "&quot;");

        return `<div style="min-width:${CELL_W}px;width:${CELL_W}px;height:${CELL_H}px;
                  border-right:1px solid #e5e7eb;border-bottom:1px solid #f0f0f0;
                  flex-shrink:0;padding:3px;background:${isToday && !role ? "#fefce8" : "transparent"};"
                  onmouseenter="${role ? `Staff.showTooltip(event,'${safeRole}')` : ''}"
                  onmouseleave="Staff.hideTooltip()">
          <div style="width:100%;height:100%;border-radius:5px;background:${bg};
                      ${role ? 'border:1px solid rgba(0,0,0,0.08);' : ''}">
            <input type="text" value="${role.replace(/"/g, '&quot;')}"
              data-staff="${s.id}" data-date="${iso}"
              placeholder="e.g. hk, bc 7am"
              title="Shortcuts: hk=Housekeeping, bc=Breakfast Cook, dc=Dinner Cook, srv=Server, gd=Guide, dk=Dock, sp=Split, off=Off"
              style="width:100%;height:100%;border:none;border-radius:5px;padding:4px 7px;
                     font-size:12px;font-weight:500;background:transparent;
                     cursor:text;box-shadow:none;outline:none;color:#1e293b;"
              onchange="Staff.saveCell(this)"
              onkeydown="if(event.key==='Tab'){event.preventDefault();Staff.saveCell(this);Staff.focusNext(this);}"
              onfocus="this.closest('div').style.outline='2px solid #3b82f6';this.placeholder='';"
              onblur="Staff.refreshCell(this);this.closest('div').style.outline='';this.placeholder='e.g. hk, bc 7am';" />
          </div>
        </div>`;
      }).join("");

      return `<div style="display:flex;align-items:stretch;background:${rowBg};">
        <div style="min-width:${LABEL_W}px;width:${LABEL_W}px;height:${CELL_H}px;padding:0 12px;display:flex;
          align-items:center;justify-content:space-between;font-size:13px;font-weight:600;
          border-right:2px solid #d1d5db;border-bottom:1px solid #f0f0f0;
          background:${rowBg};position:sticky;left:0;z-index:10;">
          <span>${s.name}</span>
          <button onclick="Staff.removeStaff(${s.id},'${s.name}')"
            style="color:#d1d5db;font-size:18px;border:none;background:none;cursor:pointer;
                   padding:0 2px;line-height:1;opacity:0.5;"
            onmouseenter="this.style.opacity='1';this.style.color='#ef4444';"
            onmouseleave="this.style.opacity='0.5';this.style.color='#d1d5db';"
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

        <!-- Role legend with abbreviations -->
        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
            Role shortcuts — type the short code into any cell
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${Object.entries(LEGEND_ROLES).map(([role, col]) =>
              `<div style="display:flex;align-items:center;gap:5px;background:${col};
                           padding:4px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);">
                <span style="font-weight:700;font-size:12px;color:#1e293b;">${role}</span>
                <span style="font-size:11px;color:#64748b;background:rgba(255,255,255,0.6);
                             padding:1px 5px;border-radius:4px;font-family:monospace;">
                  ${ABBREV_HINTS[role]}
                </span>
              </div>`
            ).join("")}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:8px;">
            💡 Add a time after the code, e.g. <strong>bc 7am</strong>, <strong>srv 4pm</strong>, <strong>hk 9am</strong>
          </div>
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
              background:#1a535c;border-right:2px solid #0f3a42;flex-shrink:0;
              display:flex;align-items:center;padding:0 12px;font-size:12px;font-weight:700;
              color:white;text-transform:uppercase;letter-spacing:0.05em;">Staff</div>
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
        <p class="text-xs text-gray-400 mt-2">Click any cell to type a role and time • Hover a filled cell to see details • Press Tab to move to next cell</p>
      </div>
    `;
  }

  async function saveCell(input) {
    const staffId  = input.dataset.staff;
    const workDate = input.dataset.date;
    // Expand abbreviation before saving
    const expanded = expandAbbrev(input.value.trim());
    input.value = expanded;
    const role = expanded;
    const bg = roleColour(role);
    const wrapper = input.parentElement;
    if (wrapper) wrapper.style.background = bg || "#f9fafb";
    scheduleMap[`${staffId}_${workDate}`] = role;
    try {
      await API.saveShift({ staff_id: parseInt(staffId), work_date: workDate, role });
    } catch(e) { console.error("Save shift failed:", e); }
  }

  function refreshCell(input) {
    const role = input.value.trim();
    const wrapper = input.parentElement;
    if (wrapper) {
      wrapper.style.background = roleColour(role) || "#f9fafb";
      wrapper.style.outline = "";
    }
  }

  function focusNext(input) {
    // Find all inputs in the grid and focus the next one
    const inputs = Array.from(document.querySelectorAll("input[data-staff][data-date]"));
    const idx = inputs.indexOf(input);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    }
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

  return { render, navigate, goToToday, setViewDays, jumpToMonth, saveCell, refreshCell, focusNext, addStaff, removeStaff, showTooltip, hideTooltip };
})();
