/**
 * McKay Bay Lodge — Email Templates
 * Manual use: select a reservation, fill fields, copy & send.
 */

const Emails = (() => {

  let allReservations = [];

  async function render() {
    const container = document.getElementById("main-content");
    container.innerHTML = `
      <div class="max-w-3xl mx-auto">
        <div class="mb-5">
          <h2 class="text-xl font-bold text-gray-800 mb-1">✉ Email Templates</h2>
          <p class="text-sm text-gray-500">Select a reservation, choose a template, then copy and send from your email client.</p>
        </div>

        <!-- Reservation search -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <label class="block text-sm font-semibold text-gray-700 mb-2">Select Reservation</label>
          <input type="text" id="email-guest-search" placeholder="Type guest name to search…"
            class="w-full mb-3" oninput="Emails.searchGuest(this.value)" />
          <div id="email-guest-results" class="space-y-1 max-h-48 overflow-y-auto"></div>
        </div>

        <!-- Template selector -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4" id="template-selector" style="display:none">
          <label class="block text-sm font-semibold text-gray-700 mb-3">Choose Template</label>
          <div class="grid grid-cols-3 gap-3">
            <button onclick="Emails.showTemplate('confirmation')"
              class="btn btn-secondary text-sm py-3 flex-col text-center" id="tpl-btn-confirmation"
              style="height:auto;flex-direction:column;gap:4px;">
              <span class="text-lg">📋</span>
              <span>Booking Confirmation</span>
              <span class="text-xs text-gray-400 font-normal">Send on booking</span>
            </button>
            <button onclick="Emails.showTemplate('prearrival')"
              class="btn btn-secondary text-sm py-3 flex-col text-center" id="tpl-btn-prearrival"
              style="height:auto;flex-direction:column;gap:4px;">
              <span class="text-lg">🧳</span>
              <span>Pre-Arrival</span>
              <span class="text-xs text-gray-400 font-normal">3 days before</span>
            </button>
            <button onclick="Emails.showTemplate('poststay')"
              class="btn btn-secondary text-sm py-3 flex-col text-center" id="tpl-btn-poststay"
              style="height:auto;flex-direction:column;gap:4px;">
              <span class="text-lg">⭐</span>
              <span>Post-Stay Follow-Up</span>
              <span class="text-xs text-gray-400 font-normal">48 hrs after departure</span>
            </button>
          </div>
        </div>

        <!-- Email output -->
        <div id="email-output"></div>
      </div>
    `;
    // Pre-load recent reservations
    try {
      const today = new Date().toISOString().slice(0,10);
      const future = new Date(Date.now() + 365*86400000).toISOString().slice(0,10);
      allReservations = await API.reservations(
        new Date(Date.now() - 90*86400000).toISOString().slice(0,10), future
      );
    } catch(e) { allReservations = []; }
  }

  let selectedRes = null;

  async function searchGuest(query) {
    const resultsEl = document.getElementById("email-guest-results");
    if (!query || query.length < 2) { resultsEl.innerHTML = ""; return; }
    const q = query.toLowerCase();
    const matches = allReservations.filter(r =>
      (`${r.first_name} ${r.last_name}`).toLowerCase().includes(q)
    ).slice(0, 8);
    if (!matches.length) {
      resultsEl.innerHTML = `<p class="text-sm text-gray-400 px-2">No reservations found.</p>`;
      return;
    }
    resultsEl.innerHTML = matches.map(r => `
      <div class="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-blue-50 cursor-pointer border border-transparent hover:border-blue-200"
        onclick="Emails.selectReservation(${r.id})">
        <div>
          <span class="font-medium text-sm">${r.first_name} ${r.last_name}</span>
          <span class="text-xs text-gray-400 ml-2">${r.arrival_date} → ${r.departure_date}</span>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">${r.status}</span>
      </div>`).join("");
  }

  async function selectReservation(resId) {
    try {
      selectedRes = await API.reservation(resId);
      document.getElementById("template-selector").style.display = "block";
      document.getElementById("email-guest-search").value =
        `${selectedRes.first_name} ${selectedRes.last_name} — ${selectedRes.arrival_date} → ${selectedRes.departure_date}`;
      document.getElementById("email-guest-results").innerHTML = "";
      document.getElementById("email-output").innerHTML = "";
      // Highlight selected template buttons
      ["confirmation","prearrival","poststay"].forEach(t => {
        const btn = document.getElementById(`tpl-btn-${t}`);
        if (btn) { btn.style.background = ""; btn.style.borderColor = ""; }
      });
    } catch(e) { alert("Could not load reservation: " + e.message); }
  }

  function showTemplate(type) {
    if (!selectedRes) return;
    // Highlight active button
    ["confirmation","prearrival","poststay"].forEach(t => {
      const btn = document.getElementById(`tpl-btn-${t}`);
      if (btn) {
        btn.style.background   = t === type ? "#eff6ff" : "";
        btn.style.borderColor  = t === type ? "#3b82f6" : "";
        btn.style.color        = t === type ? "#1d4ed8" : "";
      }
    });
    const r        = selectedRes;
    const nights   = Math.round((new Date(r.departure_date) - new Date(r.arrival_date)) / 86400000);
    const rooms    = (r.rooms    || []);
    const dietary  = (r.dietary  || []);
    const charters = (r.charters || []);
    const boats    = (r.boats    || []);

    const cabinUnits  = rooms.filter(rm => ["cabin","suite"].includes(rm.accommodation_type));
    const hasCabin    = cabinUnits.length > 0;
    const unitNames   = hasCabin ? cabinUnits.map(c => c.accommodation_name).join(", ") : "";
    const onMeals     = rooms.some(rm => rm.meal_package);
    const dietStr     = dietary.length ? dietary.map(d => (d.guest_desc ? d.guest_desc+": " : "") + d.requirement).join("; ") : "None noted";
    const boatStr     = boats.length ? boats.map(b => `${b.boat_name||"unnamed"} (${b.boat_length||"?"})`).join(", ") : "No";
    const charterStr  = charters.length
      ? charters.map(c => `${c.charter_date} — ${c.charter_type} ${c.duration.replace("_"," ")}`).join(", ")
      : "None";
    const arrMethod   = (r.arrival_method||"").replace(/_/g," ") || "[arrival method]";

    let subject = "", body = "";

    if (type === "confirmation") {
      subject = `Your McKay Bay Lodge Reservation — ${r.arrival_date}`;
      body = `Dear ${r.first_name},

We're delighted to confirm your reservation at McKay Bay Lodge. We look forward to welcoming you to Bamfield!

─────────────────────────────
YOUR RESERVATION AT A GLANCE
─────────────────────────────
Arrival:       ${r.arrival_date}  (check-in from 3:00 PM)
Departure:     ${r.departure_date}  (check-out by 11:00 AM)
Booking Name:  ${r.first_name} ${r.last_name}
Guests:        ${r.num_guests} guest${r.num_guests!==1?"s":""}
${hasCabin ? `Staying In:    ${unitNames}` : "Staying In:    McKay Bay Lodge"}
Meal Package:  ${onMeals ? "All-Inclusive ($235/person/night)" : "Self-Contained"}

─────────────────────────────
FISHING & ACTIVITIES
─────────────────────────────
Own Boat:      ${boatStr}
Charter:       ${charterStr}

─────────────────────────────
GUEST DETAILS
─────────────────────────────
Dietary Needs: ${dietStr}
Arriving By:   ${arrMethod}
${r.special_requests ? `Special Notes: ${r.special_requests}` : ""}

If any details need updating, please don't hesitate to reach out. We'll be in touch a few days before your arrival with travel tips and a couple of quick questions.

Warm regards,
The McKay Family & Team
McKay Bay Lodge, Bamfield, BC
📞 250-728-3323  |  mckaybay@island.net`;

    } else if (type === "prearrival") {
      subject = `See You in 3 Days! — McKay Bay Lodge`;
      body = `Dear ${r.first_name},

Your stay at McKay Bay Lodge is just 3 days away — how exciting! A couple of quick things before you arrive.

─────────────────────────────
YOUR ARRIVAL
─────────────────────────────
Arrival Date:  ${r.arrival_date}  (check-in from 3:00 PM)
Arriving By:   ${arrMethod}

👉 Please reply with your estimated arrival time.

For dinner that evening, we offer two seatings:
    · Early: 5:30 PM
    · Late:  7:00 PM

Please let us know which you'd prefer.

─────────────────────────────
DIETARY REMINDERS
─────────────────────────────
On File: ${dietStr}

If anything has changed or you'd like to add something, just reply and let us know.

─────────────────────────────
GETTING TO BAMFIELD
─────────────────────────────
By Boat:            We offer pickup from Bamfield East Dock. Let us know your ETA and we'll be there.
By Road:            Gravel logging road — drive to conditions, watch for logging trucks (especially weekday mornings).
MV Frances Barkley: Confirm your schedule with the operator in advance.

─────────────────────────────
WHAT TO PACK
─────────────────────────────
Rain gear & layers, rubber boots or water shoes, sunscreen, fishing licence (if fishing independently), and your camera — the wildlife is spectacular.

We're looking forward to seeing you soon!

Warm regards,
The McKay Family & Team
McKay Bay Lodge, Bamfield, BC
📞 250-728-3323  |  mckaybay@island.net`;

    } else if (type === "poststay") {
      subject = `Thank You for Staying at McKay Bay Lodge`;
      body = `Dear ${r.first_name},

It was such a pleasure having you at McKay Bay Lodge. We hope the fishing was good, the food was even better, and that Bamfield worked its magic on you.

─────────────────────────────
SHARE YOUR EXPERIENCE
─────────────────────────────
Your feedback means a lot to us and helps other guests find their way here. If you enjoyed your stay, a quick review goes a long way:

  · Google:      [Your Google Review Link]
  · TripAdvisor: [Your TripAdvisor Link]

Or simply reply to this email — we read every message personally.

─────────────────────────────
COME BACK NEXT YEAR
─────────────────────────────
Our July and August dates fill up approximately one year in advance. As a returning guest, you have priority access.

FIRST CHOICE — Same dates as this year:
  Dates:  ${r.arrival_date}  →  ${r.departure_date}
  Guests: ${r.num_guests}
  ${hasCabin ? `Unit: ${unitNames}` : ""}

SECOND CHOICE — Alternate dates or accommodation:
  Preferred dates:  _______________
  Flexible on dates: Yes / No
  Alternate unit preference:  _______________
  Expected number of guests:  _______________

⚠ Please note: Submitting a date request does not confirm your booking. We will be in touch to confirm availability and finalize your reservation.

Simply reply to this email with your preferred dates and we'll get back to you as soon as possible.

─────────────────────────────

Thank you again for choosing McKay Bay Lodge. Seven generations of welcoming guests to this special corner of the coast — and we hope to welcome you back for many more.

With warm wishes,
The McKay Family & Team
McKay Bay Lodge, Bamfield, BC
📞 250-728-3323  |  mckaybay@island.net`;
    }

    const outputEl = document.getElementById("email-output");
    outputEl.innerHTML = `
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-800">
            ${type === "confirmation" ? "📋 Booking Confirmation" : type === "prearrival" ? "🧳 Pre-Arrival Email" : "⭐ Post-Stay Follow-Up"}
          </h3>
          <button onclick="Emails.copyEmail()" class="btn btn-primary text-sm py-1.5">📋 Copy Email</button>
        </div>
        <div class="mb-3">
          <label class="text-xs font-semibold text-gray-500 uppercase">Subject Line</label>
          <div class="mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium" id="email-subject">${subject}</div>
        </div>
        <div>
          <label class="text-xs font-semibold text-gray-500 uppercase">Email Body</label>
          <textarea id="email-body" rows="24" class="mt-1 font-mono text-sm bg-gray-50"
            style="resize:vertical;font-family:monospace;font-size:12px;line-height:1.6;">${body}</textarea>
        </div>
        <div class="mt-3 flex gap-2 justify-end">
          <button onclick="Emails.copyEmail()" class="btn btn-primary">📋 Copy to Clipboard</button>
          ${r.email ? `<a href="mailto:${r.email}?subject=${encodeURIComponent(subject)}" class="btn btn-secondary">Open in Mail App ↗</a>` : ""}
        </div>
        <p class="text-xs text-gray-400 mt-2">Review and edit the text above before sending. Click "Copy to Clipboard" then paste into your email client.</p>
      </div>
    `;
    outputEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function copyEmail() {
    const subject = document.getElementById("email-subject")?.textContent || "";
    const body    = document.getElementById("email-body")?.value || "";
    const full    = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(full).then(() => {
      const btn = document.querySelector("[onclick='Emails.copyEmail()']");
      if (btn) { const orig = btn.textContent; btn.textContent = "✓ Copied!"; setTimeout(() => btn.textContent = orig, 2000); }
    }).catch(() => {
      document.getElementById("email-body").select();
      document.execCommand("copy");
    });
  }

  return { render, searchGuest, selectReservation, showTemplate, copyEmail };
})();
