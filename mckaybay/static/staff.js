/**
 * McKay Bay Lodge — Staff Schedule
 * Gantt-style weekly view. Fixed staff list, type role+time into each day cell.
 * Features: normal/compact (macro) view, print schedule, email schedule.
 */

const Staff = (() => {

  const CELL_W  = 130;
  const LABEL_W = 150;
  const CELL_H  = 56;

  // Compact mode dimensions — narrow cells, more days visible
  const COMPACT_CW = 48;
  const COMPACT_LW = 110;
  const COMPACT_CH = 38;

  const ROLE_COLOURS = {
    "off":            "#e5e7eb",
    "dock":           "#bfdbfe",
    "dk":             "#bfdbfe",
    "housekeeping":   "#ddd6fe",
    "hk":             "#ddd6fe",
    "serve":          "#bbf7d0",
    "srv":            "#bbf7d0",
    "server":         "#bbf7d0",
    "split":          "#fde68a",
    "sp":             "#fde68a",
    "dinner cook":    "#fed7aa",
    "dc":             "#fed7aa",
    "breakfast cook": "#fecaca",
    "bc":             "#fecaca",
    "guide":          "#a5f3fc",
    "gd":             "#a5f3fc",
  };

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
    const lower = text.toLowerCase().trim();
    const firstWord = lower.split(/[\s\d]/)[0];
    if (ABBREV[firstWord]) {
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

  // Short display label for compact cells
  function roleShort(text) {
    if (!text) return "";
    const lower = text.toLowerCase().trim();
    const firstWord = lower.split(/[\s\d]/)[0];
    const shorts = { housekeeping:"HK", "breakfast cook":"BC", "dinner cook":"DC",
      server:"SRV", split:"SP", dock:"DK", guide:"GD", off:"—" };
    for (const [k, v] of Object.entries(shorts)) {
      if (lower.startsWith(k)) return v;
    }
    // fallback: first 3 chars uppercase
    return text.slice(0,3).toUpperCase();
  }

  let staffList    = [];
  let scheduleMap  = {};
  let viewStart    = null;
  let viewDays     = 14;
  let compactMode  = false;

  // ── Tooltip ──────────────────────────────────────────────────────────────

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

  // ── Date helpers ─────────────────────────────────────────────────────────

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

  function fmtDate(d) {
    return d.toLocaleDateString("en-CA", { weekday:"short", month:"short", day:"numeric" });
  }

  // ── Data loading ─────────────────────────────────────────────────────────

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

  // ── UI builder ────────────────────────────────────────────────────────────

  function buildUI(container) {
    const CW = compactMode ? COMPACT_CW : CELL_W;
    const CH = compactMode ? COMPACT_CH : CELL_H;
    const LW = compactMode ? COMPACT_LW : LABEL_W;

    const days     = Array.from({ length: viewDays }, (_, i) => addDays(viewStart, i));
    const todayIso = isoDate(today());

    // Day header cells
    const dayHeaders = days.map(d => {
      const iso       = isoDate(d);
      const isToday   = iso === todayIso;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (compactMode) {
        return `<div style="min-width:${CW}px;width:${CW}px;height:40px;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;border-right:1px solid #e5e7eb;flex-shrink:0;
                  background:${isToday?"#fef08a":isWeekend?"#f3f4f6":"white"};
                  font-size:10px;font-weight:${isToday?"700":"500"};color:${isToday?"#713f12":"#374151"};">
          <span style="font-weight:600">${d.toLocaleDateString("en-CA",{weekday:"short"})}</span>
          <span style="opacity:0.75">${d.toLocaleDateString("en-CA",{month:"numeric",day:"numeric"})}</span>
        </div>`;
      }
      return `<div style="min-width:${CW}px;width:${CW}px;height:48px;display:flex;flex-direction:column;
                align-items:center;justify-content:center;border-right:1px solid #e5e7eb;flex-shrink:0;
                background:${isToday?"#fef08a":isWeekend?"#f3f4f6":"white"};
                font-size:11px;font-weight:${isToday?"700":"500"};color:${isToday?"#713f12":"#374151"};">
        <span style="font-weight:600">${d.toLocaleDateString("en-CA",{weekday:"short"})}</span>
        <span style="opacity:0.75">${d.toLocaleDateString("en-CA",{month:"numeric",day:"numeric"})}</span>
      </div>`;
    }).join("");

    // Staff rows
    const staffRows = staffList.map((s, si) => {
      const rowBg = si % 2 === 0 ? "#ffffff" : "#f8fafc";

      const cells = days.map(d => {
        const iso      = isoDate(d);
        const key      = `${s.id}_${iso}`;
        const role     = scheduleMap[key] || "";
        const bg       = role ? roleColour(role) : (iso === todayIso ? "#fefce8" : rowBg);
        const isToday  = iso === todayIso;
        const safeRole = role.replace(/'/g, "\\'").replace(/"/g, "&quot;");

        if (compactMode) {
          return `<div style="min-width:${CW}px;width:${CW}px;height:${CH}px;
                    border-right:1px solid #e5e7eb;border-bottom:1px solid #f0f0f0;
                    flex-shrink:0;padding:2px;background:${isToday&&!role?"#fefce8":"transparent"};"
                    onmouseenter="${role?`Staff.showTooltip(event,'${safeRole}')`:''}"
                    onmouseleave="Staff.hideTooltip()">
            <div style="width:100%;height:100%;border-radius:4px;background:${bg};
                        ${role?"border:1px solid rgba(0,0,0,0.08);":""}
                        display:flex;align-items:center;justify-content:center;overflow:hidden;">
              <input type="text" value="${role.replace(/"/g,"&quot;")}"
                data-staff="${s.id}" data-date="${iso}"
                placeholder=""
                style="width:100%;height:100%;border:none;border-radius:4px;padding:1px 3px;
                       font-size:9px;font-weight:600;background:transparent;
                       cursor:text;box-shadow:none;outline:none;color:#1e293b;text-align:center;
                       white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                onchange="Staff.saveCell(this)"
                onkeydown="if(event.key==='Tab'){event.preventDefault();Staff.saveCell(this);Staff.focusNext(this);}"
                onfocus="this.closest('div').style.outline='2px solid #3b82f6';"
                onblur="Staff.refreshCell(this);this.closest('div').style.outline='';" />
            </div>
          </div>`;
        }

        return `<div style="min-width:${CW}px;width:${CW}px;height:${CH}px;
                  border-right:1px solid #e5e7eb;border-bottom:1px solid #f0f0f0;
                  flex-shrink:0;padding:3px;background:${isToday&&!role?"#fefce8":"transparent"};"
                  onmouseenter="${role?`Staff.showTooltip(event,'${safeRole}')`:''}"
                  onmouseleave="Staff.hideTooltip()">
          <div style="width:100%;height:100%;border-radius:5px;background:${bg};
                      ${role?"border:1px solid rgba(0,0,0,0.08);":""}">
            <input type="text" value="${role.replace(/"/g,"&quot;")}"
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
        <div style="min-width:${LW}px;width:${LW}px;height:${CH}px;padding:0 12px;display:flex;
          align-items:center;justify-content:space-between;font-size:${compactMode?"11":"13"}px;font-weight:600;
          border-right:2px solid #d1d5db;border-bottom:1px solid #f0f0f0;
          background:${rowBg};position:sticky;left:0;z-index:10;">
          <span>${s.name}</span>
          ${compactMode ? "" : `<button onclick="Staff.removeStaff(${s.id},'${s.name}')"
            style="color:#d1d5db;font-size:18px;border:none;background:none;cursor:pointer;
                   padding:0 2px;line-height:1;opacity:0.5;"
            onmouseenter="this.style.opacity='1';this.style.color='#ef4444';"
            onmouseleave="this.style.opacity='0.5';this.style.color='#d1d5db';"
            title="Remove ${s.name}">×</button>`}
        </div>
        ${cells}
      </div>`;
    }).join("");

    const rangeLabel = `${fmtDate(viewStart)} – ${fmtDate(addDays(viewStart, viewDays-1))}`;

    container.innerHTML = `
      <div class="max-w-full">
        <!-- Controls row 1: navigation -->
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <button class="btn btn-secondary" onclick="Staff.navigate(-7)">← Week</button>
          <button class="btn btn-secondary" onclick="Staff.navigate(-14)">← 2 Wks</button>
          <button class="btn btn-secondary" onclick="Staff.goToToday()">Today</button>
          <button class="btn btn-secondary" onclick="Staff.navigate(14)">2 Wks →</button>
          <button class="btn btn-secondary" onclick="Staff.navigate(7)">Week →</button>
          <div style="display:flex;align-items:center;gap:6px;margin-left:4px;">
            <label style="margin:0;font-size:12px;color:#6b7280;white-space:nowrap;">Jump to:</label>
            <input type="month" style="width:145px;padding:4px 8px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;"
              onchange="Staff.jumpToMonth(this.value)" title="Jump to month" />
          </div>
          <div class="flex-1"></div>

          <!-- View size selector -->
          <select onchange="Staff.setViewDays(+this.value)"
            style="width:auto;padding:5px 10px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;">
            <option value="7"  ${viewDays===7?"selected":""}>1 week</option>
            <option value="14" ${viewDays===14?"selected":""}>2 weeks</option>
            <option value="28" ${viewDays===28?"selected":""}>4 weeks</option>
            <option value="42" ${viewDays===42?"selected":""}>6 weeks</option>
            <option value="56" ${viewDays===56?"selected":""}>8 weeks</option>
          </select>

          <!-- Compact toggle -->
          <button onclick="Staff.toggleCompact()"
            style="padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;
                   background:${compactMode?"#1a535c":"#f1f5f9"};
                   color:${compactMode?"white":"#374151"};
                   border:1px solid ${compactMode?"#1a535c":"#d1d5db"};"
            title="${compactMode?"Switch to normal editable view":"Switch to compact overview (more days visible)"}">
            ${compactMode?"✏ Normal View":"📊 Compact View"}
          </button>

          <!-- Print -->
          <button onclick="Staff.printSchedule()"
            style="padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;
                   background:#f1f5f9;color:#374151;border:1px solid #d1d5db;"
            title="Print the current schedule">
            🖨 Print
          </button>

          <!-- Email -->
          <button onclick="Staff.emailSchedule()"
            style="padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;
                   background:#f1f5f9;color:#374151;border:1px solid #d1d5db;"
            title="Copy schedule as HTML to paste into an email">
            ✉ Email Schedule
          </button>
        </div>

        ${compactMode ? `<div style="font-size:12px;color:#6b7280;margin-bottom:8px;">
          📊 <strong>Compact view</strong> — ${rangeLabel} — same as normal view but scaled down to show more days at once
        </div>` : ""}

        <!-- Role legend -->
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

        <!-- Add staff (hidden in compact mode) -->
        ${compactMode ? "" : `
        <div class="flex items-center gap-2 mb-3">
          <input type="text" id="new-staff-name" placeholder="New staff member name…"
            style="width:220px;padding:6px 10px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;"
            onkeydown="if(event.key==='Enter')Staff.addStaff()" />
          <button class="btn btn-primary text-sm py-1.5" onclick="Staff.addStaff()">+ Add Staff</button>
        </div>`}

        <!-- Schedule grid -->
        <div id="staff-grid" style="overflow-x:auto;background:white;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <!-- Header -->
          <div style="display:flex;position:sticky;top:0;z-index:25;background:white;border-bottom:2px solid #cbd5e1;">
            <div style="min-width:${LW}px;width:${LW}px;height:${compactMode?40:48}px;position:sticky;left:0;z-index:26;
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
            : staffRows}
        </div>
        <p class="text-xs text-gray-400 mt-2">
          ${compactMode
            ? "Compact view — same editing as normal, just smaller • Hover for full text • Tab moves to next cell"
            : "Click any cell to type a role and time • Hover a filled cell to see details • Press Tab to move to next cell"}
        </p>
      </div>
    `;
  }

  // ── Cell editing ─────────────────────────────────────────────────────────

  async function saveCell(input) {
    const staffId  = input.dataset.staff;
    const workDate = input.dataset.date;
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
    const inputs = Array.from(document.querySelectorAll("input[data-staff][data-date]"));
    const idx = inputs.indexOf(input);
    if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
  }

  // Clicking a compact cell switches to normal view and focuses that cell
  function switchToNormalAndFocus(staffId, date) {
    compactMode = false;
    // Find which day offset this date is from viewStart
    const targetDate = new Date(date + "T12:00:00");
    const dayOffset = Math.round((targetDate - viewStart) / 86400000);
    buildUI(document.getElementById("main-content"));
    // Focus the input after render
    setTimeout(() => {
      const input = document.querySelector(`input[data-staff="${staffId}"][data-date="${date}"]`);
      if (input) input.focus();
    }, 50);
  }

  // ── Staff management ─────────────────────────────────────────────────────

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

  // ── Navigation ───────────────────────────────────────────────────────────

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

  function toggleCompact() {
    compactMode = !compactMode;
    if (compactMode && viewDays < 28) viewDays = 28;
    if (!compactMode && viewDays > 14) viewDays = 14;
    loadSchedule().then(() => buildUI(document.getElementById("main-content")));
  }

  // ── Print ────────────────────────────────────────────────────────────────

  function printSchedule() {
    const days = Array.from({ length: viewDays }, (_, i) => addDays(viewStart, i));
    const rangeLabel = `${fmtDate(viewStart)} – ${fmtDate(addDays(viewStart, viewDays-1))}`;

    // Build a simple print-friendly HTML table
    const headerCells = days.map(d => {
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const label = d.toLocaleDateString("en-CA", { weekday:"short", month:"numeric", day:"numeric" });
      return `<th style="background:${isWeekend?"#f3f4f6":"#1a535c"};color:${isWeekend?"#374151":"white"};
                  padding:5px 3px;font-size:10px;border:1px solid #d1d5db;min-width:52px;">${label}</th>`;
    }).join("");

    const bodyRows = staffList.map((s, si) => {
      const rowBg = si % 2 === 0 ? "#ffffff" : "#f8fafc";
      const cells = days.map(d => {
        const role = scheduleMap[`${s.id}_${isoDate(d)}`] || "";
        const bg   = role ? roleColour(role) : rowBg;
        return `<td style="background:${bg};padding:4px 3px;font-size:10px;font-weight:${role?"600":"400"};
                    border:1px solid #e5e7eb;text-align:center;">${role || ""}</td>`;
      }).join("");
      return `<tr>
        <td style="padding:5px 8px;font-size:11px;font-weight:700;border:1px solid #d1d5db;
                   background:${rowBg};white-space:nowrap;">${s.name}</td>
        ${cells}
      </tr>`;
    }).join("");

    const legendHtml = Object.entries(LEGEND_ROLES).map(([role, col]) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;background:${col};
                    padding:2px 8px;border-radius:4px;border:1px solid rgba(0,0,0,0.08);
                    font-size:10px;font-weight:600;">${role}</span>`
    ).join(" ");

    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html>
<html><head>
  <title>McKay Bay Lodge — Staff Schedule</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 20px; color: #1e293b; }
    h1 { font-size: 16px; margin: 0 0 2px; }
    h2 { font-size: 13px; font-weight: normal; color: #64748b; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; }
    .legend { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
    @media print {
      body { margin: 10px; }
      button { display: none; }
    }
  </style>
</head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
    <div>
      <h1>🏔 McKay Bay Lodge — Staff Schedule</h1>
      <h2>${rangeLabel}</h2>
    </div>
    <button onclick="window.print()" style="padding:6px 16px;background:#1a535c;color:white;
      border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">🖨 Print</button>
  </div>
  <table>
    <thead>
      <tr>
        <th style="background:#1a535c;color:white;padding:5px 8px;font-size:11px;border:1px solid #0f3a42;text-align:left;">Staff</th>
        ${headerCells}
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="legend">${legendHtml}</div>
  <p style="font-size:9px;color:#94a3b8;margin-top:8px;">Printed from McKay Bay Lodge Reservations — ${new Date().toLocaleDateString("en-CA")}</p>
</body></html>`);
    win.document.close();
    // Auto-trigger print dialog after a short delay
    setTimeout(() => win.print(), 400);
  }

  // ── Email Schedule ───────────────────────────────────────────────────────

  function emailSchedule() {
    const days = Array.from({ length: viewDays }, (_, i) => addDays(viewStart, i));
    const rangeLabel = `${fmtDate(viewStart)} – ${fmtDate(addDays(viewStart, viewDays-1))}`;

    // Build HTML table for pasting into email
    const headerCells = days.map(d => {
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const label = d.toLocaleDateString("en-CA", { weekday:"short", month:"numeric", day:"numeric" });
      return `<th style="background:${isWeekend?"#f3f4f6":"#1a535c"};color:${isWeekend?"#374151":"white"};
                  padding:5px 4px;font-size:11px;border:1px solid #d1d5db;min-width:56px;text-align:center;">${label}</th>`;
    }).join("");

    const bodyRows = staffList.map((s, si) => {
      const rowBg = si % 2 === 0 ? "#ffffff" : "#f8fafc";
      const cells = days.map(d => {
        const role = scheduleMap[`${s.id}_${isoDate(d)}`] || "";
        const bg   = role ? roleColour(role) : rowBg;
        return `<td style="background:${bg};padding:5px 4px;font-size:11px;font-weight:${role?"600":"400"};
                    border:1px solid #e5e7eb;text-align:center;">${role || "—"}</td>`;
      }).join("");
      return `<tr>
        <td style="padding:5px 10px;font-size:12px;font-weight:700;border:1px solid #d1d5db;
                   background:${rowBg};white-space:nowrap;">${s.name}</td>
        ${cells}
      </tr>`;
    }).join("");

    const emailHtml = `<div style="font-family:system-ui,sans-serif;max-width:900px;">
  <h2 style="color:#1a535c;margin:0 0 4px;">McKay Bay Lodge — Staff Schedule</h2>
  <p style="color:#64748b;margin:0 0 14px;font-size:13px;">${rangeLabel}</p>
  <table style="border-collapse:collapse;width:100%;">
    <thead>
      <tr>
        <th style="background:#1a535c;color:white;padding:6px 10px;font-size:12px;
                   border:1px solid #0f3a42;text-align:left;">Staff</th>
        ${headerCells}
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p style="font-size:10px;color:#94a3b8;margin-top:8px;">McKay Bay Lodge, Bamfield BC — ${new Date().toLocaleDateString("en-CA")}</p>
</div>`;

    // Show a modal with copy-to-clipboard button
    const overlay = document.createElement("div");
    overlay.id = "email-schedule-overlay";
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:9999;display:flex;align-items:center;justify-content:center;`;
    overlay.innerHTML = `
      <div style="background:white;border-radius:12px;padding:24px;width:520px;max-width:95vw;
                  box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:16px;font-weight:700;">✉ Email Schedule</h3>
          <button onclick="document.getElementById('email-schedule-overlay').remove()"
            style="border:none;background:none;font-size:22px;cursor:pointer;color:#9ca3af;">&times;</button>
        </div>
        <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">
          Click <strong>Copy Schedule</strong> to copy a formatted HTML table to your clipboard,
          then paste it directly into Gmail, Outlook, or Apple Mail.
        </p>
        <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:#64748b;">
          <strong>Schedule range:</strong> ${rangeLabel}<br>
          <strong>Staff members:</strong> ${staffList.length}<br>
          <strong>Days:</strong> ${viewDays}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="copy-schedule-btn" onclick="Staff._copyScheduleHtml()"
            style="padding:10px 16px;background:#1a535c;color:white;border:none;border-radius:8px;
                   font-size:14px;font-weight:700;cursor:pointer;">
            📋 Copy Schedule to Clipboard
          </button>
          <button onclick="Staff._openPrintForEmail()"
            style="padding:10px 16px;background:#f1f5f9;color:#374151;border:1px solid #d1d5db;
                   border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
            🖨 Open Print-Friendly Version Instead
          </button>
          <button onclick="document.getElementById('email-schedule-overlay').remove()"
            style="padding:8px 16px;background:white;color:#6b7280;border:1px solid #e2e8f0;
                   border-radius:8px;font-size:13px;cursor:pointer;">
            Cancel
          </button>
        </div>
        <div id="copy-status" style="margin-top:10px;font-size:13px;text-align:center;color:#16a34a;display:none;">
          ✅ Copied! Now paste into your email (Ctrl+V or Cmd+V)
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // Store HTML for the copy function
    Staff._pendingEmailHtml = emailHtml;
  }

  async function _copyScheduleHtml() {
    const html = Staff._pendingEmailHtml;
    if (!html) return;
    try {
      // Use ClipboardItem for rich HTML copy
      const blob = new Blob([html], { type: "text/html" });
      await navigator.clipboard.write([new ClipboardItem({ "text/html": blob })]);
      const status = document.getElementById("copy-status");
      const btn = document.getElementById("copy-schedule-btn");
      if (status) { status.style.display = "block"; }
      if (btn) { btn.textContent = "✅ Copied!"; btn.style.background = "#16a34a"; }
    } catch(e) {
      // Fallback: open print version
      alert("Clipboard copy not supported in this browser — opening print version instead.");
      printSchedule();
    }
  }

  function _openPrintForEmail() {
    document.getElementById("email-schedule-overlay")?.remove();
    printSchedule();
  }

  return {
    render, navigate, goToToday, setViewDays, jumpToMonth, toggleCompact,
    saveCell, refreshCell, focusNext, switchToNormalAndFocus,
    addStaff, removeStaff,
    showTooltip, hideTooltip,
    printSchedule, emailSchedule,
    _copyScheduleHtml, _openPrintForEmail,
    _pendingEmailHtml: null,
  };
})();
