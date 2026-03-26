/**
 * McKay Bay Lodge — Daily views
 * Arrivals, Departures, Kitchen (meals + group list), Housekeeping
 */

const Daily = (() => {

  function isoToday() {
    return new Date().toISOString().slice(0,10);
  }

  async function render(date = null) {
    date = date || isoToday();
    const container = document.getElementById("main-content");

    const [arrivals, departures, meals, housekeeping, dailyNotesData] = await Promise.all([
      API.dailyArrivals(date).catch(()=>[]),
      API.dailyDepartures(date).catch(()=>([],[])),
      API.dailyMeals(date).catch(()=>({meal_guests:[],dietary:[]})),
      API.dailyHousekeeping(date).catch(()=>[]),
      API.dailyNotes(date).catch(()=>({notes:""})),
    ]);

    const existingNotes = (dailyNotesData && dailyNotesData.notes) || "";

    const mealGuests  = meals.meal_guests || [];
    const totalMeals  = mealGuests.reduce((s, g) => s + (g.num_guests || 0), 0);
    const humanDate   = new Date(date+"T12:00:00").toLocaleDateString("en-CA",
      {weekday:"long", year:"numeric", month:"long", day:"numeric"});

    // Group meal guests by reservation (group name + count)
    const groupMap = {};
    mealGuests.forEach(g => {
      const key = `${g.first_name} ${g.last_name}`;
      if (!groupMap[key]) groupMap[key] = { name: key, guests: 0, dietary: [] };
      groupMap[key].guests += (g.num_guests || 0);
    });
    const groups = Object.values(groupMap);

    container.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <!-- Date picker -->
        <div class="flex items-center gap-3 mb-5 flex-wrap">
          <button class="btn btn-secondary" onclick="Daily.changeDate('${date}', -1)">← Prev</button>
          <input type="date" value="${date}"
            style="width:auto;font-size:1.1rem;font-weight:600;border:1px solid #d1d5db;border-radius:6px;padding:5px 10px;background:white;"
            onchange="Daily.render(this.value)" />
          <button class="btn btn-secondary" onclick="Daily.changeDate('${date}', 1)">Next →</button>
          <button class="btn btn-secondary" onclick="Daily.render('${isoToday()}')">Today</button>
          <span class="text-gray-500 text-sm ml-2">${humanDate}</span>
        </div>

        <!-- Top summary strip -->
        <div class="grid grid-cols-4 gap-3 mb-4">
          <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-green-700">${arrivals.length}</div>
            <div class="text-xs text-green-600 font-medium mt-1">Arrivals</div>
          </div>
          <div class="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-red-700">${departures.length}</div>
            <div class="text-xs text-red-600 font-medium mt-1">Departures</div>
          </div>
          <div class="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-orange-700">${totalMeals}</div>
            <div class="text-xs text-orange-600 font-medium mt-1">Dinner Covers</div>
          </div>
          <div class="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-purple-700">${housekeeping.length}</div>
            <div class="text-xs text-purple-600 font-medium mt-1">Rooms to Turn</div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

          <!-- Arrivals -->
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 class="font-bold text-lg text-green-800 mb-3">
              ✈ Arrivals <span class="text-sm font-normal text-gray-500">(${arrivals.length})</span>
            </h3>
            ${arrivals.length === 0
              ? `<p class="text-gray-400 text-sm">No arrivals today.</p>`
              : arrivals.map(a => `
                <div class="border-b border-gray-100 py-2 last:border-0">
                  <div class="font-medium">${a.first_name} ${a.last_name}
                    ${a.arrival_time ? `<span class="text-xs text-gray-500 ml-2">~${a.arrival_time}</span>` : ""}
                    ${a.arrival_method ? `<span class="text-xs bg-blue-100 text-blue-700 rounded px-1 ml-1">${a.arrival_method.replace("_"," ")}</span>` : ""}
                  </div>
                  <div class="text-sm text-gray-500">${a.num_guests} guest${a.num_guests!==1?"s":""}
                    ${a.special_requests ? `<span class="text-orange-600 ml-2">⚠ ${a.special_requests}</span>` : ""}
                  </div>
                </div>`).join("")
            }
          </div>

          <!-- Departures -->
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 class="font-bold text-lg text-red-800 mb-3">
              🚪 Departures <span class="text-sm font-normal text-gray-500">(${departures.length})</span>
            </h3>
            ${departures.length === 0
              ? `<p class="text-gray-400 text-sm">No departures today.</p>`
              : departures.map(d => `
                <div class="border-b border-gray-100 py-2 last:border-0">
                  <div class="font-medium">${d.first_name} ${d.last_name}</div>
                  <div class="text-sm text-gray-500">${d.num_guests} guest${d.num_guests!==1?"s":""}</div>
                </div>`).join("")
            }
          </div>

          <!-- Dinner / Server List -->
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:col-span-2">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-lg text-orange-800">
                🍽 Tonight's Dinner
              </h3>
              <span class="text-2xl font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-4 py-1">
                ${totalMeals} covers
              </span>
            </div>
            ${groups.length === 0
              ? `<p class="text-gray-400 text-sm">No meal-package guests tonight.</p>`
              : `<div class="mb-3">
                  <div class="text-xs font-semibold text-gray-400 uppercase mb-2">Group List — for table setting</div>
                  <div class="space-y-1">
                    ${groups.map(g => `
                      <div class="flex justify-between items-center bg-orange-50 rounded-lg px-4 py-2">
                        <span class="font-semibold text-gray-800">${g.name}</span>
                        <span class="font-bold text-orange-700 text-lg">${g.guests} ${g.guests===1?"person":"people"}</span>
                      </div>`).join("")}
                    <div class="flex justify-between items-center bg-orange-100 rounded-lg px-4 py-2 mt-2 border border-orange-300">
                      <span class="font-bold text-orange-900">TOTAL</span>
                      <span class="font-bold text-orange-900 text-xl">${totalMeals} covers</span>
                    </div>
                  </div>
                </div>`
            }
            ${meals.dietary && meals.dietary.length > 0 ? `
              <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div class="font-semibold text-red-800 text-sm mb-2">⚠ Dietary Requirements — Alert Kitchen</div>
                ${meals.dietary.map(d => `
                  <div class="text-sm py-1 border-b border-red-100 last:border-0">
                    ${d.guest_desc ? `<strong>${d.guest_desc}:</strong> ` : ""}${d.requirement}
                  </div>`).join("")}
              </div>` : ""}
          </div>

          <!-- Housekeeping -->
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:col-span-2">
            <h3 class="font-bold text-lg text-purple-800 mb-3">
              🧹 Housekeeping — Rooms to Turn <span class="text-sm font-normal text-gray-500">(${housekeeping.length})</span>
            </h3>
            ${housekeeping.length === 0
              ? `<p class="text-gray-400 text-sm">No checkouts today — no rooms to turn.</p>`
              : `<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                  ${housekeeping.map(h => `
                    <div class="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 flex justify-between items-center">
                      <span class="font-semibold text-purple-900 text-sm">${h.room}</span>
                      <span class="text-xs text-gray-500">${h.first_name} ${h.last_name}</span>
                    </div>`).join("")}
                </div>`
            }
          </div>

          <!-- Daily Notes -->
          <div class="bg-white rounded-xl border border-yellow-200 shadow-sm p-5 md:col-span-2">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-lg text-yellow-800">📝 Day Notes</h3>
              <button onclick="Daily.saveNotes('${date}')" class="btn btn-secondary text-sm py-1.5"
                style="border-color:#fde68a;background:#fffbeb;color:#92400e;">
                Save Notes
              </button>
            </div>
            <textarea id="daily-notes-input" rows="5"
              style="font-size:13px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;resize:vertical;width:100%;padding:10px;"
              placeholder="Add notes for today… e.g. Dock pickup at 3pm for Edwards group. Kitchen running low on propane. Generator service scheduled 10am."
            >${existingNotes}</textarea>
            <p class="text-xs text-gray-400 mt-1">Day notes are for internal staff use only. They are saved per day and accessible any time you view that date.</p>
          </div>

        </div>
      </div>
    `;
  }

  async function saveNotes(date) {
    const ta = document.getElementById("daily-notes-input");
    if (!ta) return;
    try {
      await API.saveDailyNotes(date, ta.value);
      ta.style.background = "#d1fae5";
      setTimeout(() => { ta.style.background = "#fffbeb"; }, 1000);
    } catch(e) { alert("Could not save notes: " + e.message); }
  }

  function changeDate(current, delta) {
    const d = new Date(current + "T12:00:00");
    d.setDate(d.getDate() + delta);
    render(d.toISOString().slice(0,10));
  }

  return { render, changeDate, saveNotes };
})();
