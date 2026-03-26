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

  // ── Date helpers ──────────────────────────────────────────────────────────

  function today() {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  }

  function addDays(d, n) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  }

  function isoDate(d) {
    // Format as YYYY-MM-DD in local time (avoid UTC offset issues)
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
    html += `<div style="min-width:${LABEL_W}px;width:${LABEL_W}px;height:36px;position:sticky;left:0;z-index:26;background:#f8fafc;border-right:2px solid #d1d5db;flex-shrink:0;"></div>`;
    days.forEach(d => {
      const isToday   = isoDate(d) === isoDate(t);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const showMonth = d.getDate() === 1 || daysBetween(viewStart, d) === 0;
      html += `<div class="date-header-cell${isToday ? " today-col" : ""}${isWeekend ? " weekend" : ""}">
        <span style="font-size:9px;opacity:0.6;line-height:1">${showMonth ? d.toLocaleDateString("en-CA", { month: "short" }) : ""}</span>
        <span style="line-height:1">${d.getDate()}</span>
      </div>`;
    });
    html += `</div>`;

    // ── Rows ──
    rows.forEach(row => {
      if (row.isHeader) {
        html += `<div style="display:flex;">
          <div class="row-label section-header" style="min-width:${LABEL_W}px;width:${LABEL_W}px;">${row.label}</div>
          <div style="display:flex;flex:1;">
            ${days.map(d => {
              const isToday   = isoDate(d) === isoDate(t);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return `<div style="min-width:${CELL_W}px;width:${CELL_W}px;height:40px;border-right:1px solid #e5e7eb;background:${isToday ? "#fefce8" : isWeekend ? "#f3f4f6" : "#f1f5f9"};flex-shrink:0;"></div>`;
            }).join("")}
          </div>
        </div>`;
        return;
      }

      const accom    = row;
      const accomRes = reservations.filter(res =>
        res.rooms && res.rooms.some(r => r.accommodation_id === accom.id)
      );

      html += `<div style="display:flex;position:relative;">
        <div class="row-label" style="min-width:${LABEL_W}px;width:${LABEL_W}px;" title="${accom.bed_config || ""}">${accom.name}</div>
        <div style="display:flex;position:relative;flex:1;" id="row-${accom.id}">
          ${days.map(d => {
            const isToday   = isoDate(d) === isoDate(t);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return `<div class="cal-cell${isToday ? " today-col" : ""}${isWeekend ? " weekend" : ""}"
              style="min-width:${CELL_W}px;width:${CELL_W}px;flex-shrink:0;"
              data-date="${isoDate(d)}" data-accom="${accom.id}"
              onclick="Calendar.cellClick('${isoDate(d)}', ${accom.id})"></div>`;
          }).join("")}
          ${buildBars(accom, accomRes, days)}
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

      // Flag dietary requirements
      const hasDiet = res.dietary && res.dietary.length > 0;

      html += `<div class="res-bar status-${res.status}"
        style="left:${left}px;width:${width}px;"
        data-res-id="${res.id}"
        onmouseenter="Calendar.showTooltip(event,${res.id})"
        onmouseleave="Calendar.hideTooltip()"
        onclick="Calendar.barClick(event,${res.id})"
      >${hasDiet ? "⚠ " : ""}${name} (${res.num_guests})</div>`;
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

    const inHouseCount = new Set(reservations.flatMap(r => (r.rooms || []).map(rm => rm.accommodation_id))).size;

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
          <input type="month" style="width:150px;padding:4px 8px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;"
            onchange="Calendar.jumpToDate(this.value + '-01')"
            title="Jump to a month" />
          <input type="date" style="width:150px;padding:4px 8px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;"
            onchange="Calendar.jumpToDate(this.value)"
            title="Jump to a specific date" />
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
      <p class="text-xs text-gray-400 mt-2">Click an empty cell to create a reservation • Click a coloured bar to edit</p>`;
  }

  async function init() {
    viewStart      = addDays(today(), -7);
    accommodations = await API.accommodations();
    if (!accommodations.length) throw new Error("Could not load room data from server.");
    await refresh();
  }

  return { init, refresh, navigate, jumpToToday, jumpToDate, setViewDays, toggleContractorBoats, cellClick, barClick, showTooltip, hideTooltip };
})();
