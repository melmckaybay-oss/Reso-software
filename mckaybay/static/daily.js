/**
 * McKay Bay Lodge — Daily views
 * Arrivals, Departures, Kitchen (meals), Housekeeping
 */

const Daily = (() => {

  function isoToday() {
    return new Date().toISOString().slice(0,10);
  }

  async function render(date = null) {
    date = date || isoToday();
    const container = document.getElementById("main-content");

    // Fetch all four at once
    const [arrivals, departures, meals, housekeeping] = await Promise.all([
      API.dailyArrivals(date).catch(()=>[]),
      API.dailyDepartures(date).catch(()=>[]),
      API.dailyMeals(date).catch(()=>({meal_guests:[],dietary:[]})),
      API.dailyHousekeeping(date).catch(()=>[]),
    ]);

    const totalMeals = meals.meal_guests.reduce((s, g) => s + g.num_guests, 0);
    const humanDate  = new Date(date+"T12:00:00").toLocaleDateString("en-CA",
      {weekday:"long", year:"numeric", month:"long", day:"numeric"});

    container.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <!-- Date picker -->
        <div class="flex items-center gap-3 mb-5">
          <button class="btn btn-secondary" onclick="Daily.changeDate('${date}', -1)">← Prev</button>
          <input type="date" value="${date}" class="text-lg font-semibold border-0 bg-transparent"
            style="width:auto;font-size:1.1rem;font-weight:600;border:none;box-shadow:none;background:transparent"
            onchange="Daily.render(this.value)" />
          <button class="btn btn-secondary" onclick="Daily.changeDate('${date}', 1)">Next →</button>
          <button class="btn btn-secondary" onclick="Daily.render('${isoToday()}')">Today</button>
          <span class="text-gray-500 text-sm ml-2">${humanDate}</span>
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
                    <span class="text-xs text-gray-500 ml-2">${a.arrival_time||""}</span>
                    ${a.arrival_method?`<span class="text-xs bg-blue-100 text-blue-700 rounded px-1 ml-1">${a.arrival_method.replace("_"," ")}</span>`:""}
                  </div>
                  <div class="text-sm text-gray-500">${a.num_guests} guest(s)
                    ${a.special_requests?`<span class="text-orange-600 ml-2">⚠ ${a.special_requests}</span>`:""}
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
                  <div class="text-sm text-gray-500">${d.num_guests} guest(s)</div>
                </div>`).join("")
            }
          </div>

          <!-- Kitchen / Meals -->
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 class="font-bold text-lg text-orange-800 mb-3">
              🍽 Kitchen — Meal Guests <span class="text-sm font-normal text-gray-500">(${totalMeals} covers)</span>
            </h3>
            ${meals.meal_guests.length === 0
              ? `<p class="text-gray-400 text-sm">No meal-package guests tonight.</p>`
              : meals.meal_guests.map(g => `
                <div class="border-b border-gray-100 py-1.5 last:border-0 flex justify-between">
                  <span class="text-sm">${g.accommodation_name}</span>
                  <span class="font-medium text-sm">${g.first_name} ${g.last_name} (${g.num_guests})</span>
                </div>`).join("")
            }
            ${meals.dietary && meals.dietary.length > 0 ? `
              <div class="mt-3 p-3 bg-orange-50 rounded-lg">
                <div class="font-semibold text-orange-800 text-sm mb-1">⚠ Dietary Requirements</div>
                ${meals.dietary.map(d => `
                  <div class="text-sm">${d.guest_desc ? `<strong>${d.guest_desc}:</strong> ` : ""}${d.requirement}</div>
                `).join("")}
              </div>` : ""}
          </div>

          <!-- Housekeeping -->
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 class="font-bold text-lg text-purple-800 mb-3">
              🧹 Housekeeping — Rooms to Turn <span class="text-sm font-normal text-gray-500">(${housekeeping.length})</span>
            </h3>
            ${housekeeping.length === 0
              ? `<p class="text-gray-400 text-sm">No checkouts today — no rooms to turn.</p>`
              : housekeeping.map(h => `
                <div class="border-b border-gray-100 py-1.5 last:border-0 flex justify-between items-center">
                  <span class="font-medium text-sm">${h.room}</span>
                  <span class="text-sm text-gray-500">${h.first_name} ${h.last_name} checking out</span>
                </div>`).join("")
            }
          </div>
        </div>
      </div>
    `;
  }

  function changeDate(current, delta) {
    const d = new Date(current + "T12:00:00");
    d.setDate(d.getDate() + delta);
    render(d.toISOString().slice(0,10));
  }

  return { render, changeDate };
})();
