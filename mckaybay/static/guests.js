/**
 * McKay Bay Lodge — Guest list view
 */

const Guests = (() => {

  async function render(query = "") {
    const container = document.getElementById("main-content");
    const guests = await API.guests(query);

    container.innerHTML = `
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center gap-3 mb-4">
          <input type="text" placeholder="Search guests by name…" value="${query}"
            class="flex-1" oninput="Guests.render(this.value)" id="guest-search" />
          <span class="text-sm text-gray-500">${guests.length} guest(s)</span>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
          ${guests.length === 0
            ? `<p class="p-6 text-gray-400 text-center">No guests found.</p>`
            : guests.map(g => `
              <div class="flex items-center px-5 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                onclick="Guests.openGuest(${g.id})">
                <div class="flex-1">
                  <div class="font-medium">${g.first_name} ${g.last_name}
                    ${g.is_returning?`<span class="text-xs bg-yellow-100 text-yellow-700 rounded px-1 ml-1">⭐ Returning</span>`:""}
                  </div>
                  <div class="text-sm text-gray-500">${g.email||""}${g.phone?` · ${g.phone}`:""}</div>
                </div>
                <div class="text-xs text-gray-400">
                  Since ${(g.created_at||"").slice(0,10)}
                </div>
              </div>`).join("")
          }
        </div>
      </div>
    `;
  }

  async function openGuest(gid) {
    const g = await API.guest(gid);
    document.getElementById("modal-content").innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold">${g.first_name} ${g.last_name}</h2>
          <button onclick="App.closeModal()" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div class="space-y-2 text-sm">
          ${g.phone ?`<div>📞 ${g.phone}</div>`:""}
          ${g.email ?`<div>✉ ${g.email}</div>`:""}
          ${g.address?`<div>📍 ${g.address}</div>`:""}
          ${g.is_returning?`<div>⭐ Returning guest</div>`:""}
          ${g.notes?`<div class="bg-gray-50 p-3 rounded mt-2">📝 ${g.notes}</div>`:""}
        </div>
        <div class="flex justify-end gap-2 mt-5 pt-4 border-t">
          <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
        </div>
      </div>`;
    document.getElementById("modal").classList.remove("hidden");
  }

  return { render, openGuest };
})();
