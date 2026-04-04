#!/usr/bin/env python3
"""
McKay Bay Lodge — Reservation Software
Run with:  python3 server.py
Then open: http://localhost:8080
"""
import glob
import json
import os
import re
import shutil
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

from database import get_db, init_db, full_reservation, rows_to_list, row_to_dict
from pricing import calc_quote


def check_conflicts(db, arrival, departure, room_ids, exclude_reservation_id=None):
    """Return list of (accommodation_name, conflicting_guest) for any double-booked rooms."""
    conflicts = []
    for accom_id in room_ids:
        q = """
            SELECT a.name, g.first_name, g.last_name, r.arrival_date, r.departure_date
            FROM reservation_rooms rr
            JOIN reservations r ON r.id = rr.reservation_id
            JOIN accommodations a ON a.id = rr.accommodation_id
            JOIN guests g ON g.id = r.guest_id
            WHERE rr.accommodation_id = ?
              AND r.status NOT IN ('cancelled','checked_out')
              AND r.arrival_date < ? AND r.departure_date > ?
        """
        params = [accom_id, departure, arrival]
        if exclude_reservation_id:
            q += " AND r.id != ?"
            params.append(exclude_reservation_id)
        rows = db.execute(q, params).fetchall()
        for row in rows:
            conflicts.append({
                "room": row[0],
                "guest": f"{row[1]} {row[2]}",
                "dates": f"{row[3]} → {row[4]}"
            })
    return conflicts

PORT = int(os.environ.get("PORT", 8080))
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


# ── Routing helpers ────────────────────────────────────────────────────────────

def json_response(handler, data, status=200):
    body = json.dumps(data, default=str).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", len(body))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


def error_response(handler, message, status=400):
    json_response(handler, {"error": message}, status)


def serve_static(handler, path):
    if path == "/" or path == "":
        path = "/index.html"
    if path in ("/batch-entry", "/batch-entry/"):
        path = "/batch_entry.html"
    filepath = os.path.join(STATIC_DIR, path.lstrip("/"))
    if not os.path.isfile(filepath):
        filepath = os.path.join(STATIC_DIR, "index.html")
    ext = os.path.splitext(filepath)[1]
    content_types = {
        ".html": "text/html", ".js": "application/javascript",
        ".css": "text/css", ".json": "application/json",
        ".png": "image/png", ".ico": "image/x-icon",
    }
    ct = content_types.get(ext, "text/plain")
    with open(filepath, "rb") as f:
        body = f.read()
    handler.send_response(200)
    handler.send_header("Content-Type", ct)
    handler.send_header("Content-Length", len(body))
    handler.end_headers()
    handler.wfile.write(body)


# ── API handlers ───────────────────────────────────────────────────────────────

def handle_accommodations(handler, method, path_parts, qs, body):
    if method != "GET":
        return error_response(handler, "Method not allowed", 405)
    db = get_db()
    rows = db.execute(
        "SELECT * FROM accommodations WHERE status='active' ORDER BY sort_order"
    ).fetchall()
    db.close()
    json_response(handler, rows_to_list(rows))


def handle_guests(handler, method, path_parts, qs, body):
    db = get_db()
    if method == "GET" and len(path_parts) == 2:
        q = qs.get("q", [""])[0]
        rows = db.execute(
            "SELECT * FROM guests WHERE lower(first_name||' '||last_name) LIKE ? ORDER BY last_name",
            (f"%{q.lower()}%",)
        ).fetchall()
        db.close()
        return json_response(handler, rows_to_list(rows))

    if method == "GET" and len(path_parts) == 3:
        gid = int(path_parts[2])
        row = db.execute("SELECT * FROM guests WHERE id=?", (gid,)).fetchone()
        db.close()
        if row:
            return json_response(handler, row_to_dict(row))
        return error_response(handler, "Not found", 404)

    if method == "POST":
        d = body
        cur = db.execute(
            "INSERT INTO guests (first_name,last_name,phone,email,address,is_returning,notes) VALUES (?,?,?,?,?,?,?)",
            (d["first_name"], d["last_name"], d.get("phone"), d.get("email"),
             d.get("address"), d.get("is_returning", 0), d.get("notes"))
        )
        db.commit()
        row = row_to_dict(db.execute("SELECT * FROM guests WHERE id=?", (cur.lastrowid,)).fetchone())
        db.close()
        return json_response(handler, row, 201)

    if method == "PUT" and len(path_parts) == 3:
        gid = int(path_parts[2])
        d   = body
        db.execute(
            "UPDATE guests SET first_name=?,last_name=?,phone=?,email=?,address=?,is_returning=?,notes=? WHERE id=?",
            (d["first_name"], d["last_name"], d.get("phone"), d.get("email"),
             d.get("address"), d.get("is_returning", 0), d.get("notes"), gid)
        )
        db.commit()
        row = row_to_dict(db.execute("SELECT * FROM guests WHERE id=?", (gid,)).fetchone())
        db.close()
        return json_response(handler, row)

    db.close()
    error_response(handler, "Not found", 404)


def _save_reservation_children(db, rid, d):
    db.execute("DELETE FROM reservation_rooms WHERE reservation_id=?",        (rid,))
    db.execute("DELETE FROM dietary_requirements WHERE reservation_id=?",      (rid,))
    db.execute("DELETE FROM boats WHERE reservation_id=?",                     (rid,))
    db.execute("DELETE FROM charter_bookings WHERE reservation_id=?",          (rid,))

    for room in d.get("rooms", []):
        custom_rate = room.get("custom_rate")
        if custom_rate is not None:
            try:
                custom_rate = float(custom_rate)
            except (TypeError, ValueError):
                custom_rate = None
        db.execute(
            "INSERT INTO reservation_rooms (reservation_id,accommodation_id,num_guests,meal_package,extra_boats,single_supplement,custom_rate) VALUES (?,?,?,?,?,?,?)",
            (rid, room["accommodation_id"], room.get("num_guests", 1),
             1 if room.get("meal_package", True) else 0,
             room.get("extra_boats", 0),
             1 if room.get("single_supplement", False) else 0,
             custom_rate)
        )
    for diet in d.get("dietary", []):
        db.execute(
            "INSERT INTO dietary_requirements (reservation_id,guest_desc,requirement) VALUES (?,?,?)",
            (rid, diet.get("guest_desc", ""), diet["requirement"])
        )
    for boat in d.get("boats", []):
        db.execute(
            "INSERT INTO boats (reservation_id,boat_name,boat_length) VALUES (?,?,?)",
            (rid, boat.get("boat_name"), boat.get("boat_length"))
        )
    for ch in d.get("charters", []):
        db.execute(
            "INSERT INTO charter_bookings (reservation_id,charter_date,charter_type,duration,num_guests) VALUES (?,?,?,?,?)",
            (rid, ch["charter_date"], ch.get("charter_type", "fishing"),
             ch.get("duration", "full_day"), ch.get("num_guests", 1))
        )


def handle_reservations(handler, method, path_parts, qs, body):
    db = get_db()

    # GET /api/reservations  or  GET /api/reservations?start=&end=
    if method == "GET" and len(path_parts) == 2:
        start = qs.get("start", [None])[0]
        end   = qs.get("end",   [None])[0]
        if start and end:
            rows = db.execute(
                """SELECT id FROM reservations
                   WHERE status != 'cancelled' AND arrival_date < ? AND departure_date > ?
                   ORDER BY arrival_date""",
                (end, start)
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT id FROM reservations WHERE status != 'cancelled' ORDER BY arrival_date"
            ).fetchall()
        result = [full_reservation(db, r["id"]) for r in rows]
        db.close()
        return json_response(handler, result)

    # GET /api/reservations/:id
    if method == "GET" and len(path_parts) == 3 and path_parts[2].isdigit():
        rid = int(path_parts[2])
        res = full_reservation(db, rid)
        db.close()
        if res:
            return json_response(handler, res)
        return error_response(handler, "Not found", 404)

    # GET /api/reservations/:id/quote
    if method == "GET" and len(path_parts) == 4 and path_parts[3] == "quote":
        rid = int(path_parts[2])
        res = full_reservation(db, rid)
        db.close()
        if not res:
            return error_response(handler, "Not found", 404)
        quote = calc_quote(res["rooms"], res["arrival_date"], res["departure_date"],
                           res["charters"], pst_exempt=bool(res.get("pst_exempt")))
        return json_response(handler, quote)

    # POST /api/reservations
    if method == "POST" and len(path_parts) == 2:
        d        = body
        arr      = d.get("arrival_date", "")
        dep      = d.get("departure_date", "")
        room_ids = [r["accommodation_id"] for r in d.get("rooms", [])]

        # Overbooking check
        conflicts = check_conflicts(db, arr, dep, room_ids)
        if conflicts:
            db.close()
            return json_response(handler, {"conflicts": conflicts}, 409)

        guest_id = d.get("guest_id")
        if not guest_id:
            g   = d["guest"]
            cur = db.execute(
                "INSERT INTO guests (first_name,last_name,phone,email,address,is_returning,notes) VALUES (?,?,?,?,?,?,?)",
                (g["first_name"], g["last_name"], g.get("phone"), g.get("email"),
                 g.get("address"), g.get("is_returning", 0), g.get("notes"))
            )
            guest_id = cur.lastrowid

        cur = db.execute(
            """INSERT INTO reservations
<<<<<<< Updated upstream
               (guest_id,status,arrival_date,departure_date,arrival_time,arrival_method,num_guests,special_requests,mobility,cc_on_file,how_heard)
=======
               (guest_id,status,arrival_date,departure_date,arrival_time,arrival_method,num_guests,special_requests,how_heard,cc_on_file,pst_exempt)
>>>>>>> Stashed changes
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (guest_id, d.get("status", "confirmed"),
             d["arrival_date"], d["departure_date"],
             d.get("arrival_time"), d.get("arrival_method"),
<<<<<<< Updated upstream
             d.get("num_guests", 1), d.get("special_requests"),
             d.get("mobility"), d.get("cc_on_file", 0), d.get("how_heard"))
=======
             d.get("num_guests", 1), d.get("special_requests"), d.get("how_heard"),
             1 if d.get("cc_on_file") else 0,
             1 if d.get("pst_exempt") else 0)
>>>>>>> Stashed changes
        )
        rid = cur.lastrowid
        _save_reservation_children(db, rid, d)
        db.commit()
        res = full_reservation(db, rid)
        db.close()
        return json_response(handler, res, 201)

    # PUT /api/reservations/:id
    if method == "PUT" and len(path_parts) == 3 and path_parts[2].isdigit():
        rid      = int(path_parts[2])
        d        = body
        arr      = d.get("arrival_date", "")
        dep      = d.get("departure_date", "")
        room_ids = [r["accommodation_id"] for r in d.get("rooms", [])]

        # Overbooking check (exclude self)
        conflicts = check_conflicts(db, arr, dep, room_ids, exclude_reservation_id=rid)
        if conflicts:
            db.close()
            return json_response(handler, {"conflicts": conflicts}, 409)

        db.execute(
            """UPDATE reservations SET status=?,arrival_date=?,departure_date=?,arrival_time=?,
<<<<<<< Updated upstream
               arrival_method=?,num_guests=?,special_requests=?,mobility=?,cc_on_file=?,how_heard=? WHERE id=?""",
            (d.get("status", "confirmed"), d["arrival_date"], d["departure_date"],
             d.get("arrival_time"), d.get("arrival_method"),
             d.get("num_guests", 1), d.get("special_requests"),
             d.get("mobility"), d.get("cc_on_file", 0), d.get("how_heard"), rid)
=======
               arrival_method=?,num_guests=?,special_requests=?,how_heard=?,
               cc_on_file=?,pst_exempt=? WHERE id=?""",
            (d.get("status", "confirmed"), d["arrival_date"], d["departure_date"],
             d.get("arrival_time"), d.get("arrival_method"),
             d.get("num_guests", 1), d.get("special_requests"), d.get("how_heard"),
             1 if d.get("cc_on_file") else 0,
             1 if d.get("pst_exempt") else 0, rid)
>>>>>>> Stashed changes
        )
        _save_reservation_children(db, rid, d)
        db.commit()
        res = full_reservation(db, rid)
        db.close()
        return json_response(handler, res)

    # PATCH /api/reservations/:id/status
    if method == "PATCH" and len(path_parts) == 4 and path_parts[3] == "status":
        rid    = int(path_parts[2])
        status = body.get("status")
        allowed = ("pending", "confirmed", "checked_in", "checked_out", "cancelled")
        if status not in allowed:
            db.close()
            return error_response(handler, "Invalid status")
        db.execute("UPDATE reservations SET status=? WHERE id=?", (status, rid))
        db.commit()
        res = full_reservation(db, rid)
        db.close()
        return json_response(handler, res)

    # DELETE /api/reservations/:id
    if method == "DELETE" and len(path_parts) == 3 and path_parts[2].isdigit():
        rid = int(path_parts[2])
        db.execute("DELETE FROM reservations WHERE id=?", (rid,))
        db.commit()
        db.close()
        return json_response(handler, {"deleted": rid})

    db.close()
    error_response(handler, "Not found", 404)


def handle_daily(handler, method, path_parts, qs, body):
    if method not in ("GET", "POST", "PUT"):
        return error_response(handler, "Method not allowed", 405)
    date_param = qs.get("date", [None])[0]
    if not date_param:
        return error_response(handler, "date param required")
    view = path_parts[2] if len(path_parts) > 2 else ""
    db   = get_db()

    if view == "arrivals":
        rows = db.execute(
            """SELECT r.id, g.first_name, g.last_name, r.arrival_time, r.arrival_method,
                      r.num_guests, r.special_requests
               FROM reservations r JOIN guests g ON g.id = r.guest_id
               WHERE r.arrival_date = ? AND r.status NOT IN ('cancelled','checked_out')
               ORDER BY r.arrival_time""",
            (date_param,)
        ).fetchall()
        db.close()
        return json_response(handler, rows_to_list(rows))

    if view == "departures":
        rows = db.execute(
            """SELECT r.id, g.first_name, g.last_name, r.num_guests
               FROM reservations r JOIN guests g ON g.id = r.guest_id
               WHERE r.departure_date = ? AND r.status NOT IN ('cancelled')
               ORDER BY g.last_name""",
            (date_param,)
        ).fetchall()
        db.close()
        return json_response(handler, rows_to_list(rows))

    if view == "meals":
        rows = db.execute(
            """SELECT r.id, g.first_name, g.last_name, rr.num_guests,
                      a.name AS accommodation_name
               FROM reservations r
               JOIN guests g ON g.id = r.guest_id
               JOIN reservation_rooms rr ON rr.reservation_id = r.id
               JOIN accommodations a ON a.id = rr.accommodation_id
               WHERE r.arrival_date <= ? AND r.departure_date > ?
               AND r.status NOT IN ('cancelled')
               AND rr.meal_package = 1
               ORDER BY a.sort_order""",
            (date_param, date_param)
        ).fetchall()
        res_ids = list({r["id"] for r in rows})
        diets   = []
        for rid in res_ids:
            diets += rows_to_list(db.execute(
                "SELECT * FROM dietary_requirements WHERE reservation_id=?", (rid,)
            ).fetchall())
        db.close()
        return json_response(handler, {"meal_guests": rows_to_list(rows), "dietary": diets})

    if view == "housekeeping":
        checkouts = db.execute(
            """SELECT a.name AS room, g.first_name, g.last_name
               FROM reservations r
               JOIN guests g ON g.id = r.guest_id
               JOIN reservation_rooms rr ON rr.reservation_id = r.id
               JOIN accommodations a ON a.id = rr.accommodation_id
               WHERE r.departure_date = ? AND r.status NOT IN ('cancelled')
               ORDER BY a.sort_order""",
            (date_param,)
        ).fetchall()
        db.close()
        return json_response(handler, rows_to_list(checkouts))

    if view == "notes":
        if method == "GET":
            row = db.execute(
                "SELECT * FROM daily_notes WHERE date=?", (date_param,)
            ).fetchone()
            db.close()
            return json_response(handler, row_to_dict(row) or {"date": date_param, "notes": ""})
        if method in ("POST", "PUT"):
            notes = body.get("notes", "")
            db.execute(
                "INSERT INTO daily_notes (date, notes) VALUES (?,?) ON CONFLICT(date) DO UPDATE SET notes=excluded.notes",
                (date_param, notes)
            )
            db.commit()
            db.close()
            return json_response(handler, {"date": date_param, "notes": notes})

    db.close()
    error_response(handler, "Unknown daily view", 404)


def handle_staff(handler, method, path_parts, qs, body):
    db = get_db()

    if method == "GET" and len(path_parts) == 2:
        rows = db.execute("SELECT * FROM staff ORDER BY sort_order, name").fetchall()
        db.close()
        return json_response(handler, rows_to_list(rows))

    if method == "POST" and len(path_parts) == 2:
        name = body.get("name", "").strip()
        if not name:
            db.close()
            return error_response(handler, "Name required")
        max_order = db.execute("SELECT COALESCE(MAX(sort_order),0) FROM staff").fetchone()[0]
        cur = db.execute("INSERT INTO staff (name, sort_order) VALUES (?,?)", (name, max_order+1))
        db.commit()
        row = row_to_dict(db.execute("SELECT * FROM staff WHERE id=?", (cur.lastrowid,)).fetchone())
        db.close()
        return json_response(handler, row, 201)

    if method == "DELETE" and len(path_parts) == 3:
        sid = int(path_parts[2])
        db.execute("DELETE FROM staff WHERE id=?", (sid,))
        db.execute("DELETE FROM staff_schedule WHERE staff_id=?", (sid,))
        db.commit()
        db.close()
        return json_response(handler, {"deleted": sid})

    if method == "GET" and len(path_parts) == 3 and path_parts[2] == "schedule":
        start = qs.get("start", [None])[0]
        end   = qs.get("end",   [None])[0]
        if not start or not end:
            db.close()
            return error_response(handler, "start and end required")
        rows = db.execute(
            "SELECT * FROM staff_schedule WHERE work_date >= ? AND work_date <= ?",
            (start, end)
        ).fetchall()
        db.close()
        return json_response(handler, rows_to_list(rows))

    if method == "POST" and len(path_parts) == 3 and path_parts[2] == "schedule":
        sid   = body.get("staff_id")
        date  = body.get("work_date")
        role  = body.get("role", "").strip()
        if not sid or not date:
            db.close()
            return error_response(handler, "staff_id and work_date required")
        if role:
            db.execute(
                "INSERT INTO staff_schedule (staff_id, work_date, role) VALUES (?,?,?) "
                "ON CONFLICT(staff_id, work_date) DO UPDATE SET role=excluded.role",
                (sid, date, role)
            )
        else:
            db.execute("DELETE FROM staff_schedule WHERE staff_id=? AND work_date=?", (sid, date))
        db.commit()
        db.close()
        return json_response(handler, {"staff_id": sid, "work_date": date, "role": role})

    db.close()
    return error_response(handler, "Not found", 404)


def handle_reservation_notes(handler, method, path_parts, qs, body):
    """GET/POST /api/reservations/<id>/notes"""
    db  = get_db()
    rid = int(path_parts[2])
    if method == "GET":
        row = db.execute("SELECT notes FROM reservations WHERE id=?", (rid,)).fetchone()
        db.close()
        return json_response(handler, {"notes": row["notes"] if row else ""})
    if method in ("POST", "PUT", "PATCH"):
        notes = body.get("notes", "")
        db.execute("UPDATE reservations SET notes=? WHERE id=?", (notes, rid))
        db.commit()
        db.close()
        return json_response(handler, {"notes": notes})
    db.close()
    return error_response(handler, "Method not allowed", 405)


def handle_quote(handler, method, path_parts, qs, body):
    """POST /api/quote/preview — calculate a price quote without saving."""
    if method != "POST":
        return error_response(handler, "Method not allowed", 405)
    arrival   = body.get("arrival_date")
    departure = body.get("departure_date")
    if not arrival or not departure:
        return error_response(handler, "arrival_date and departure_date required")

    # Rooms from the form include accommodation_id; look up name/type from DB
    db    = get_db()
    rooms = []
    for r in body.get("rooms", []):
        accom_id = r.get("accommodation_id")
        row = db.execute("SELECT name, accommodation_type FROM accommodations WHERE id=?",
                         (accom_id,)).fetchone() if accom_id else None
        rooms.append({
            "accommodation_name": row["name"] if row else r.get("accommodation_name", ""),
            "accommodation_type": row["accommodation_type"] if row else r.get("accommodation_type", "lodge_room"),
            "num_guests":        r.get("num_guests", 1),
            "meal_package":      r.get("meal_package", True),
            "extra_boats":       r.get("extra_boats", 0),
            "single_supplement": r.get("single_supplement", False),
            "custom_rate":       r.get("custom_rate"),
        })
    db.close()

    charters   = body.get("charters", [])
    pst_exempt = bool(body.get("pst_exempt", False))
    try:
        quote = calc_quote(rooms, arrival, departure, charters, pst_exempt=pst_exempt)
        return json_response(handler, quote)
    except Exception as e:
        return error_response(handler, str(e))


def handle_backup(handler, method, path_parts, qs, body):
    """
    GET /api/backup/create   — copy DB to timestamped backup, keep last 14
    GET /api/backup/list     — list available backup filenames
    GET /api/backup/download?file=FILENAME — stream a backup file
    """
    if method != "GET":
        return error_response(handler, "Method not allowed", 405)

    action = path_parts[2] if len(path_parts) > 2 else ""

    # Locate the database file
    from database import DB_PATH
    db_dir     = os.path.dirname(DB_PATH)
    backup_dir = os.path.join(db_dir, "backups")
    os.makedirs(backup_dir, exist_ok=True)

    if action == "create":
        stamp   = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
        dest    = os.path.join(backup_dir, f"mckaybay_{stamp}.db")
        shutil.copy2(DB_PATH, dest)
        # Keep only the 14 most recent backups
        backups = sorted(glob.glob(os.path.join(backup_dir, "mckaybay_*.db")))
        for old in backups[:-14]:
            try:
                os.remove(old)
            except OSError:
                pass
        return json_response(handler, {"status": "ok", "file": os.path.basename(dest)})

    if action == "list":
        backups = sorted(glob.glob(os.path.join(backup_dir, "mckaybay_*.db")), reverse=True)
        return json_response(handler, {"backups": [os.path.basename(b) for b in backups]})

    if action == "download":
        filename = qs.get("file", [None])[0]
        if not filename or "/" in filename or ".." in filename:
            return error_response(handler, "Invalid filename")
        filepath = os.path.join(backup_dir, filename)
        if not os.path.isfile(filepath):
            return error_response(handler, "File not found", 404)
        with open(filepath, "rb") as f:
            data = f.read()
        handler.send_response(200)
        handler.send_header("Content-Type", "application/octet-stream")
        handler.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        handler.send_header("Content-Length", len(data))
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.end_headers()
        handler.wfile.write(data)
        return

    return error_response(handler, "Unknown backup action", 404)


# ── Main request handler ───────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  {self.address_string()} {fmt % args}")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length:
            return json.loads(self.rfile.read(length))
        return {}

    def _dispatch(self, method):
        parsed     = urlparse(self.path)
        path       = parsed.path.rstrip("/")
        qs         = parse_qs(parsed.query)
        path_parts = [p for p in path.split("/") if p]
        body       = self._read_body() if method in ("POST", "PUT", "PATCH") else {}

        # Static files — must check /api/ (with slash) so /api.js is served as a file
        if not path.startswith("/api/") and path != "/api":
            return serve_static(self, path)

        # API routing
        if len(path_parts) >= 2:
            resource = path_parts[1]
            if resource == "accommodations":
                return handle_accommodations(self, method, path_parts, qs, body)
            if resource == "guests":
                return handle_guests(self, method, path_parts, qs, body)
            if resource == "reservations":
                if len(path_parts) == 4 and path_parts[3] == "notes":
                    return handle_reservation_notes(self, method, path_parts, qs, body)
                return handle_reservations(self, method, path_parts, qs, body)
            if resource == "daily":
                return handle_daily(self, method, path_parts, qs, body)
            if resource == "staff":
                return handle_staff(self, method, path_parts, qs, body)
            if resource == "quote":
                return handle_quote(self, method, path_parts, qs, body)
            if resource == "backup":
                return handle_backup(self, method, path_parts, qs, body)

        error_response(self, "Not found", 404)

    def do_GET(self):    self._dispatch("GET")
    def do_POST(self):   self._dispatch("POST")
    def do_PUT(self):    self._dispatch("PUT")
    def do_PATCH(self):  self._dispatch("PATCH")
    def do_DELETE(self): self._dispatch("DELETE")


if __name__ == "__main__":
    import os as _os
    _db_dir = _os.path.dirname(_os.environ.get("DB_PATH", "/app/data/mckaybay.db"))
    if _db_dir:
        _os.makedirs(_db_dir, exist_ok=True)
    init_db()
    print(f"\n🏔  McKay Bay Lodge — Reservation Software")
    print(f"   Running at http://localhost:{PORT}")
    print(f"   Press Ctrl+C to stop\n")
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
