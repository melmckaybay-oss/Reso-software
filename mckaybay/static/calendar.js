/**
 * McKay Bay Lodge — Visual Calendar (Gantt-style)
 */

const Calendar = (() => {

  const CELL_W  = 36;
  const LABEL_W = 140;

  let accommodations      = [];
  let reservations        = [];
  let viewStart           = null;
  let viewDays            = 56;
  let showContractorBoats = false;
  const tooltip           = () => document.getElementById("tooltip");

  // Section header colors
  const HEADER_BG = {
    "Lodge Rooms":    { bg: "#1a535c", color: "#ffffff" },
    "Cabins & Suite": { bg: "#166534", color: "#ffffff" },
    "Charter Boats":  { bg: "#9a3412", color: "#ffffff" },
  };

  // Alternating row tints — subtle, just enough to track horizontally
  const ROW_TINTS = [
    { normal: "#f8fafc", weekend: "#f1f5f9" },
    { normal: "#f0f7ff", weekend: "#e3f0ff" },
    { normal: "#f0fdf4", weekend: "#dcfce7" },
    { normal: "#fff7ed", weekend: "#ffedd5" },
    { normal: "#faf5ff", weekend: "#f3e8ff" },
    { normal: "#fff1f2", weekend: "#ffe4e6" },
    { normal: "#f0fdfa", weekend: "#ccfbf1" },
    { normal: "#fefce8", weekend: "#fef9c3" },
    { normal: "#f5f3ff", weekend: "#ede9fe" },
    { normal: "#fdf4ff", weekend: "#fae8ff" },
  ];

  // ── Date helpers ──────────────────────────────────────────────────────────

  function today() {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  }

  function addDays(d, n) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  }

  function isoDate(d) {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, "0");
    const dy = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dy}`;
  }

  function parseISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  // ── Build calendar HTML ───────────────────────────────────────────────────

  function buildGrid() {
    const t    = today();
    const days = Array.from({ length: viewDays }, (_, i) => addDays(viewStart, i));

    const lodgeRooms      = accommodations.filter(a => a.type === "lodge_room");
    const cabins          = accommodations.filter(a => a.type === "cabin");
    const suites          = accommodations.filter(a => a.type === "suite");
    const charterBoats    = accommodations.filter(a => a.type === "charter_boat");
    const contractorBoats = accommodations.filter(a => a.type === "contractor_boat");

    const rows = [
      { label: "Lodge Rooms", isHeader: true },
      ...lodgeRooms,
      { label: "Cabins & Suite", isHeader: true },
      ...cabins, ...suites,
      { label: "Charter Boats", isHeader: true },
      ...charterBoats,
      ...(showContractorBoats ? contractorBoats : []),
    ];

    // ── Date header ──
    let html = `<div style="display:flex;position:sticky;top:0;z-index:25;background:white;border-bottom:2px solid #cbd5e1;">`;
    html += `<div style="min-width:${LABEL_W}px;width:${LABEL_W}px;height:52px;position:sticky;left:0;z-index:26;background:#1a535c;border-right:2px solid #0f3a42;flex-shrink:0;"></div>`;

    days.forEach(d => {
      const isToday   = isoDate(d) === isoDate(t);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isMonthStart = d.getDate() === 1 || daysBetween(viewStart, d) === 0;
      const dayName   = d.toLocaleDateString("en-CA", { weekday: "short" });

      let headerBg = isToday ? "#fef08a" : isWeekend ? "#e5e7eb" : "#f8fafc";
      let headerColor = isToday ? "#713f12" : "#374151";

      if (isMonthStart) {
        // Month marker cell — make it pop
        html += `<div class="date-header-cell${isToday ? " today-col" : ""}${isWeekend ? " weekend" : ""}"
          style="height:52px;background:${isToday ? "#fef08a" : "#1a535c"};border-left:3px solid ${isToday ? "#f59e0b" : "#0f3a42"};">
          <span style="font-size:11px;font-weight:800;color:${isToday ? "#713f12" : "#ffffff"};line-height:1;letter-spacing:0.05em;text-transform:uppercase;">
            ${d.toLocaleDateString("en-CA", { month: "short", year: "numeric" })}
          </span>
          <span style="line-height:1;font-weight:700;color:${isToday ? "#713f12" : "#ffffff"};font-size:13px;">${d.getDate()}</span>
        </div>`;
      } else {
        html += `<div class="date-header-cell${isToday ? " today-col" : ""}${isWeekend ? " weekend" : ""}"
          style="height:52px;background:${headerBg};">
          <span style="font-size:9px;opacity:0.6;line-height:1;color:${headerColor}">${dayName}</span>
          <span style="line-height:1;font-weight:${isWeekend||isToday?'700':'500'};color:${headerColor}">${d.getDate()}</span>
        </div>`;
      }
    });
    html += `</div>`;

    // ── Rows ──
    let currentSection = null;
    let rowIndex = 0;

    rows.forEach(row => {
      if (row.isHeader) {
        currentSection = row.label;
        rowIndex = 0;
        const hStyle = HEADER_BG[row.label] || { bg: "#374151", color: "#ffffff" };
        html += `<div style="display:flex;">
          <div class="row-label section-header"
            style="min-width:${LABEL_W}px;width:${LABEL_W}px;background:${hStyle.bg};color:${hStyle.color};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-right:3px solid rgba(0,0,0,0.2);">
            ${row.label}
          </div>
          <div style="display:flex;flex:1;">
            ${days.map(d => {
              const isToday   = isoDate(d) === isoDate(t);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const bg = isToday ? "#fef9c3" : isWeekend ? "#f3f4f6" : hStyle.bg + "22";
              return `<div style="min-width:${CELL_W}px;width:${CELL_W}px;height:32px;border-right:1px solid #e5e7eb;background:${bg};flex-shrink:0;"></div>`;
            }).join("")}
          </div>
        </div>`;
        return;
      }

      const accom    = row;
      const tint     = ROW_TINTS[rowIndex % ROW_TINTS.length];
      rowIndex++;

      const isBoat = accom.type === "charter_boat" || accom.type === "contractor_boat";
      const accomRes = isBoat ? [] : reservations.filter(res =>
        res.rooms && res.rooms.some(r => r.accommodation_id === accom.id)
      );

      html += `<div style="display:flex;position:relative;">
        <div class="row-label"
          style="min-width:${LABEL_W}px;width:${LABEL_W}px;background:${tint.normal};border-right:3px solid ${HEADER_BG[currentSection]?.bg || '#e5e7eb'}44;"
          title="${accom.bed_config || ""}">${accom.name}</div>
        <div style="display:flex;position:relative;flex:1;" id="row-${accom.id}"
          ondragover="Calendar.dragOver(event,${accom.id})"
          ondragleave="Calendar.dragLeave(event,${accom.id})"
          ondrop="Calendar.dropOnRoom(event,${accom.id})">
          ${days.map(d => {
            const isToday   = isoDate(d) === isoDate(t);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const bg = isToday ? "#fef9c3" : isWeekend ? tint.weekend : tint.normal;
            return `<div class="cal-cell${isToday ? " today-col" : ""}${isWeekend ? " weekend" : ""}"
              style="min-width:${CELL_W}px;width:${CELL_W}px;flex-shrink:0;background:${bg};"
              data-date="${isoDate(d)}" data-accom="${accom.id}"
              onclick="Calendar.cellClick('${isoDate(d)}', ${accom.id})"></div>`;
          }).join("")}
          ${isBoat ? buildCharterBars(accom, days) : buildBars(accom, accomRes, days)}
        </div>
      </div>`;
    });

    return html;
  }

  function buildBars(accom, accomRes, days) {
    if (!accomRes.length) return "";
    let html       = "";
    const startISO = isoDate(days[0]);
    const endISO   = isoDate(addDays(days[days.length - 1], 1));

    accomRes.forEach(res => {
      const arr = res.arrival_date;
      const dep = res.departure_date;
      if (!arr || !dep || arr >= endISO || dep <= startISO) return;

      const visStart   = arr < startISO ? startISO : arr;
      const visEnd     = dep > endISO   ? endISO   : dep;
      const offsetDays = daysBetween(days[0], parseISO(visStart));
      const spanDays   = daysBetween(parseISO(visStart), parseISO(visEnd));
      if (spanDays <= 0) return;

      const left  = offsetDays * CELL_W;
      const width = spanDays   * CELL_W - 3;
      const name  = `${res.first_name} ${res.last_name}`;
      const hasDiet = res.dietary && res.dietary.length > 0;

      html += `<div class="res-bar status-${res.status}"
        style="left:${left}px;width:${width}px;"
        data-res-id="${res.id}"
        draggable="true"
        ondragstart="Calendar.dragStart(event,${res.id},${accom.id})"
        ondragend="Calendar.dragEnd(event)"
        onmouseenter="Calendar.showTooltip(event,${res.id})"
        onmouseleave="Calendar.hideTooltip()"
        onclick="Calendar.barClick(event,${res.id})"
      >${hasDiet ? "⚠ " : ""}${name} (${res.num_guests})</div>`;
    });
    return html;
  }

  // ── Drag & Drop room + date reassignment ────────────────────────────────────

  let _dragResId = null;
  let _dragFromAccomId = null;
  let _dragGrabOffsetX = 0;

  function dragStart(event, resId, fromAccomId) {
    _dragResId = resId;
    _dragFromAccomId = fromAccomId;
    const barRect = event.target.getBoundingClientRect();
    _dragGrabOffsetX = event.clientX - barRect.left;
    event.dataTransfer.effectAllowed = "move";
    event.target.style.opacity = "0.4";
  }

  function dragEnd(event) {
    event.target.style.opacity = "1";
    _dragResId = null;
    _dragFromAccomId = null;
    document.querySelectorAll('[id^="row-"]').forEach(r => r.style.outline = "");
  }

  function dragOver(event, accomId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const row = document.getElementById(`row-${accomId}`);
    if (row) {
      row.style.outline = "3px solid #3b82f6";
      row.style.outlineOffset = "-2px";
    }
  }

  function dragLeave(event, accomId) {
    const row = document.getElementById(`row-${accomId}`);
    if (row) row.style.outline = "";
  }

  async function dropOnRoom(event, toAccomId) {
    event.preventDefault();
    const row = document.getElementById(`row-${toAccomId}`);
    if (row) row.style.outline = "";
    if (!_dragResId) return;

    const res = reservations.find(r => r.id === _dragResId);
    if (!res) return;

    // Work out the new arrival date from where the bar's left edge landed
    const rowRect    = row.getBoundingClientRect();
    const leftEdgeX   = event.clientX - _dragGrabOffsetX;
    const relativeX   = leftEdgeX - rowRect.left;
    const dayIndex    = Math.round(relativeX / CELL_W);
    const newArrival  = addDays(viewStart, dayIndex);
    const newArrivalISO = isoDate(newArrival);

    const nights = daysBetween(parseISO(res.arrival_date), parseISO(res.departure_date));
    const newDepartureISO = isoDate(addDays(newArrival, nights));

    const roomChanged = toAccomId !== _dragFromAccomId;
    const dateChanged  = newArrivalISO !== res.arrival_date;

    if (!roomChanged && !dateChanged) return; // dropped back in same spot

    const toAccom   = accommodations.find(a => a.id === toAccomId);
    const fromAccom = accommodations.find(a => a.id === _dragFromAccomId);

    let msg = `Move ${res.first_name} ${res.last_name}`;
    if (roomChanged) msg += ` from ${fromAccom?.name || "current room"} to ${toAccom?.name}`;
    if (dateChanged)  msg += `${roomChanged ? " and" : ""} to ${newArrivalISO} → ${newDepartureISO} (${nights} night${nights!==1?"s":""})`;
    msg += "?";

    if (!confirm(msg)) return;

    try {
      const updatedRooms = (res.rooms || []).map(r =>
        r.accommodation_id === _dragFromAccomId ? { ...r, accommodation_id: toAccomId } : r
      );

      const payload = {
        guest_id: res.guest_id,
        status: res.status,
        arrival_date: newArrivalISO,
        departure_date: newDepartureISO,
        arrival_time: res.arrival_time,
        arrival_method: res.arrival_method,
        num_guests: res.num_guests,
        special_requests: res.special_requests,
        mobility: res.mobility,
        cc_on_file: res.cc_on_file,
        rooms: updatedRooms.map(r => ({
          accommodation_id: r.accommodation_id,
          num_guests: r.num_guests,
          meal_package: r.meal_package,
          extra_boats: r.extra_boats,
          single_supplement: r.single_supplement,
          room_notes: r.room_notes || "",
        })),
        dietary: res.dietary || [],
        boats: res.boats || [],
        charters: res.charters || [],
      };

      const result = await API.updateReservation(res.id, payload);
      if (result && result.conflicts) {
        const msgs = result.conflicts.map(c => `• ${c.room}: already booked by ${c.guest} (${c.dates})`).join("\n");
        alert("⚠ Cannot move — conflict:\n\n" + msgs);
        return;
      }
      refresh();
    } catch (e) {
      alert("Error moving reservation: " + e.message);
    }
  }

  function buildCharterBars(accom, days) {
    let html       = "";
    const startISO = isoDate(days[0]);
    const endISO   = isoDate(addDays(days[days.length - 1], 1));

    reservations.forEach(res => {
      (res.charters || []).forEach(ch => {
        if (ch.boat_id !== accom.id) return;
        const d = ch.charter_date;
        if (!d || d < startISO || d >= endISO) return;

        const offsetDays = daysBetween(days[0], parseISO(d));
        const left  = offsetDays * CELL_W;
        const width = CELL_W - 3;
        const name  = `${res.first_name} ${res.last_name}`;
        const durTag = ch.duration === "half_day" ? "½" : "";

        html += `<div class="res-bar status-${res.status}"
          style="left:${left}px;width:${width}px;font-size:10px;padding:0 4px;"
          data-res-id="${res.id}"
          onmouseenter="Calendar.showTooltip(event,${res.id})"
          onmouseleave="Calendar.hideTooltip()"
          onclick="Calendar.barClick(event,${res.id})"
        >${durTag} ${name} (${ch.num_guests})</div>`;
      });
    });
    return html;
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────

  function showTooltip(event, resId) {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;
    const tt     = tooltip();
    const rooms  = (res.rooms  || []).map(r => r.accommodation_name).join(", ");
    const chNum  = (res.charters || []).length;
    const diets  = (res.dietary || []).map(d => (d.guest_desc ? d.guest_desc + ": " : "") + d.requirement);
    const nights = daysBetween(parseISO(res.arrival_date), parseISO(res.departure_date));

    tt.innerHTML = `
      <div style="font-weight:700;margin-bottom:5px;font-size:14px">${res.first_name} ${res.last_name}</div>
      <div>📅 ${res.arrival_date} → ${res.departure_date} (${nights} night${nights !== 1 ? "s" : ""})</div>
      <div>👥 ${res.num_guests} guest${res.num_guests !== 1 ? "s" : ""}</div>
      <div>🛏 ${rooms || "—"}</div>
      ${chNum ? `<div>🎣 ${chNum} charter day${chNum !== 1 ? "s" : ""}</div>` : ""}
      ${res.arrival_method ? `<div>✈ Arriving by ${res.arrival_method.replace("_", " ")}</div>` : ""}
      ${diets.length ? `<div style="margin-top:5px;color:#fca5a5;font-weight:600">⚠ Dietary: ${diets.join(" | ")}</div>` : ""}
      ${res.notes    ? `<div style="margin-top:5px;color:#fde68a;font-style:italic">📝 ${res.notes.length > 80 ? res.notes.slice(0,80)+"…" : res.notes}</div>` : ""}
      <div style="margin-top:5px;opacity:0.6;font-size:11px">Click to view / edit notes</div>`;
    tt.classList.remove("hidden");
    moveTooltip(event);
    document.addEventListener("mousemove", moveTooltip);
  }

  function moveTooltip(e) {
    const tt = tooltip();
    const x = e.clientX + 16, y = e.clientY + 16;
    const w = tt.offsetWidth || 240, h = tt.offsetHeight || 120;
    tt.style.left = (x + w > window.innerWidth  ? x - w - 32 : x) + "px";
    tt.style.top  = (y + h > window.innerHeight ? y - h - 32 : y) + "px";
  }

  function hideTooltip() {
    tooltip().classList.add("hidden");
    document.removeEventListener("mousemove", moveTooltip);
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function navigate(delta) { viewStart = addDays(viewStart, delta); refresh(); }
  function jumpToToday()   { viewStart = addDays(today(), -7);      refresh(); }
  function setViewDays(n)  { viewDays  = n;                         refresh(); }
  function toggleContractorBoats() { showContractorBoats = !showContractorBoats; refresh(); }

  function jumpToDate(val) {
    if (!val) return;
    const d = new Date(val + "T12:00:00");
    if (isNaN(d)) return;
    viewStart = addDays(d, -7);
    refresh();
  }

  function cellClick(dateStr, accomId) { App.openNewReservation(dateStr, accomId); }
  function barClick(event, resId) { event.stopPropagation(); hideTooltip(); App.openReservation(resId); }

  // ── Render ────────────────────────────────────────────────────────────────

  async function refresh() {
    const container = document.getElementById("main-content");
    if (!container) return;

    const startISO = isoDate(viewStart);
    const endISO   = isoDate(addDays(viewStart, viewDays));

    try {
      reservations = await API.reservations(startISO, endISO);
    } catch (e) {
      console.error("Failed to load reservations:", e);
      reservations = [];
    }

    container.innerHTML = `
      <!-- Controls bar -->
      <div class="flex items-center gap-2 mb-3 flex-wrap">
        <button class="btn btn-secondary" onclick="Calendar.navigate(-7)">← Week</button>
        <button class="btn btn-secondary" onclick="Calendar.navigate(-30)">← Month</button>
        <button class="btn btn-secondary" onclick="Calendar.jumpToToday()">Today</button>
        <button class="btn btn-secondary" onclick="Calendar.navigate(30)">Month →</button>
        <button class="btn btn-secondary" onclick="Calendar.navigate(7)">Week →</button>
        <div style="display:flex;align-items:center;gap:6px;margin-left:8px;">
          <label style="margin:0;font-size:12px;color:#6b7280;white-space:nowrap;">Jump to:</label>
          <input type="month" id="cal-jump-month" style="width:140px;padding:4px 8px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;"
            title="Jump to a month" />
          <button class="btn btn-secondary text-xs py-1" onclick="Calendar.jumpToDate(document.getElementById('cal-jump-month').value + '-01')">Go</button>
          <input type="date" id="cal-jump-date" style="width:140px;padding:4px 8px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;"
            title="Jump to a specific date" />
          <button class="btn btn-secondary text-xs py-1" onclick="Calendar.jumpToDate(document.getElementById('cal-jump-date').value)">Go</button>
        </div>
        <div class="flex-1"></div>
        <button class="btn btn-secondary text-xs py-1" style="border:1px solid ${showContractorBoats ? '#3b82f6' : '#d1d5db'};color:${showContractorBoats ? '#2563eb' : '#374151'};background:${showContractorBoats ? '#eff6ff' : '#f1f5f9'};"
          onclick="Calendar.toggleContractorBoats()" title="Show/hide contractor charter boats">
          ⛵ ${showContractorBoats ? 'Hide' : 'Show'} Contractor Boats
        </button>
        <select onchange="Calendar.setViewDays(+this.value)"
          style="width:auto;padding:5px 10px;font-size:13px;border:1px solid #d1d5db;border-radius:6px">
          <option value="28"  ${viewDays === 28  ? "selected" : ""}>4 weeks</option>
          <option value="56"  ${viewDays === 56  ? "selected" : ""}>8 weeks</option>
          <option value="90"  ${viewDays === 90  ? "selected" : ""}>3 months</option>
        </select>
      </div>

      <!-- Legend -->
      <div class="flex items-center gap-3 mb-3 flex-wrap">
        <span class="text-xs font-medium text-gray-500">Status:</span>
        ${["pending","confirmed","checked_in","checked_out"].map(s =>
          `<span class="res-bar status-${s}" style="position:static;height:22px;font-size:11px;border-radius:3px;box-shadow:none;padding:0 8px">${s.replace("_"," ")}</span>`
        ).join("")}
        <span class="text-xs text-gray-400 ml-auto">${reservations.length} reservation${reservations.length !== 1 ? "s" : ""} in view</span>
      </div>

      <!-- Calendar -->
      <div style="overflow-x:auto;overflow-y:visible;background:white;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        ${buildGrid()}
      </div>
      <p class="text-xs text-gray-400 mt-2">Click an empty cell to create a reservation • Click a coloured bar to edit • Drag a bar to a different room or date to move the whole stay</p>`;
  }

  async function init() {
    viewStart      = addDays(today(), -7);
    accommodations = await API.accommodations();
    if (!accommodations.length) throw new Error("Could not load room data from server.");
    await refresh();
  }

  return { init, refresh, navigate, jumpToToday, jumpToDate, setViewDays, toggleContractorBoats,
    cellClick, barClick, showTooltip, hideTooltip,
    dragStart, dragEnd, dragOver, dragLeave, dropOnRoom };
})();
