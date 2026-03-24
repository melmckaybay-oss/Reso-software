# McKay Bay Lodge — Reservation Software

A custom reservation management system built for McKay Bay Lodge, Bamfield, BC.

## How to Run

**Requirements:** Python 3 (already installed on any Mac or PC — no other software needed)

```bash
# 1. Open Terminal / Command Prompt
# 2. Navigate to this folder
cd /path/to/mckaybay

# 3. Start the server
python3 server.py

# 4. Open your browser and go to:
#    http://localhost:8080
```

Press `Ctrl+C` in the terminal to stop the server.

## What's Built (Phase 1)

- **Visual Calendar** — Gantt-style grid with all 13 units (Rooms 1–10, Creekside Cabin, Forest View Cabin, Boat Shop Suite) on the Y-axis and dates on the X-axis. Reservations shown as colour-coded bars.
- **Group Bookings** — one reservation can include multiple rooms. No more creating separate bookings per room.
- **Reservation Form** — create and edit reservations including rooms, meal packages, boats, dietary requirements, and charter add-ons.
- **Pricing Calculator** — automatically calculates totals using summer/off-season rates and correct tax rates (GST + Hotel Tax for meal-package stays, GST + PST for self-contained).
- **Daily Views** — arrivals, departures, kitchen meal counts with dietary requirements, and housekeeping (rooms to turn over).
- **Guest List** — searchable guest directory.

## File Structure

```
mckaybay/
├── server.py        ← Main entry point (start here)
├── database.py      ← Database schema and helpers
├── pricing.py       ← Pricing & tax calculations
├── mckaybay.db      ← SQLite database (auto-created on first run)
├── start.sh         ← Convenience start script (Mac/Linux)
└── static/
    ├── index.html   ← Main page
    ├── app.js       ← App controller
    ├── api.js       ← API client
    ├── calendar.js  ← Gantt calendar view
    ├── form.js      ← Reservation form
    ├── daily.js     ← Daily views
    └── guests.js    ← Guest list
```

## Updating the Software

When new code is available:
```bash
git pull
python3 server.py
```

## Still To Do (Next Sessions)

- [ ] Max occupancy per room (prevents overbooking — data needed from Jordan)
- [ ] Overbooking detection on the calendar
- [ ] Pre-arrival and post-stay email timing configuration
- [ ] Automated email templates
- [ ] Reporting (occupancy rates, revenue by category)
- [ ] Cloud deployment setup (Railway)
- [ ] Multi-user roles (front of house, kitchen, housekeeping)
