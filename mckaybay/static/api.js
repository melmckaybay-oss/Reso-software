/**
 * McKay Bay Lodge — API client
 * All calls go to /api/...  (same origin)
 */
const API = {
  base: "/api",

  async get(path) {
    const r = await fetch(this.base + path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(this.base + path, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    // 409 = overbooking conflict — return the JSON (not an error)
    if (r.status === 409) return r.json();
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(this.base + path, {
      method: "PUT", headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    if (r.status === 409) return r.json();
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async patch(path, body) {
    const r = await fetch(this.base + path, {
      method: "PATCH", headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del(path) {
    const r = await fetch(this.base + path, { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  // Convenience wrappers
  accommodations:    ()      => API.get("/accommodations"),
  reservations:      (s, e)  => API.get(`/reservations?start=${s}&end=${e}`),
  reservation:       (id)    => API.get(`/reservations/${id}`),
  quote:             (id)    => API.get(`/reservations/${id}/quote`),
  createReservation: (data)  => API.post("/reservations", data),
  updateReservation: (id, d) => API.put(`/reservations/${id}`, d),
  updateStatus:      (id, s) => API.patch(`/reservations/${id}/status`, {status: s}),
  deleteReservation: (id)    => API.del(`/reservations/${id}`),
  guests:            (q="")  => API.get(`/guests?q=${encodeURIComponent(q)}`),
  guest:             (id)    => API.get(`/guests/${id}`),
  createGuest:       (data)  => API.post("/guests", data),
  updateGuest:       (id, d) => API.put(`/guests/${id}`, d),
  dailyArrivals:     (date)  => API.get(`/daily/arrivals?date=${date}`),
  dailyDepartures:   (date)  => API.get(`/daily/departures?date=${date}`),
  dailyMeals:        (date)  => API.get(`/daily/meals?date=${date}`),
  dailyHousekeeping: (date)  => API.get(`/daily/housekeeping?date=${date}`),
  dailyNotes:        (date)  => API.get(`/daily/notes?date=${date}`),
  saveDailyNotes:    (date, notes) => API.post(`/daily/notes?date=${date}`, {notes}),
  reservationNotes:  (id)    => API.get(`/reservations/${id}/notes`),
  saveReservationNotes: (id, notes) => API.patch(`/reservations/${id}/notes`, {notes}),
  staff:             ()      => API.get(`/staff`),
  addStaff:          (name)  => API.post(`/staff`, {name}),
  deleteStaff:       (id)    => API.del(`/staff/${id}`),
  staffSchedule:     (s, e)  => API.get(`/staff/schedule?start=${s}&end=${e}`),
  saveShift:         (data)  => API.post(`/staff/schedule`, data),
};
