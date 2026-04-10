"""
McKay Bay Lodge — Database setup and helpers.
Uses Python's built-in sqlite3 — no installation required.
"""

import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "/app/data/mckaybay.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS accommodations (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            type          TEXT NOT NULL,
            floor         TEXT,
            bed_config    TEXT,
            max_occupancy INTEGER,
            features      TEXT,
            sort_order    INTEGER DEFAULT 0,
            status        TEXT NOT NULL DEFAULT 'active'
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS guests (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name   TEXT NOT NULL,
            last_name    TEXT NOT NULL,
            phone        TEXT,
            email        TEXT,
            address      TEXT,
            is_returning INTEGER DEFAULT 0,
            notes        TEXT,
            created_at   TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS reservations (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id         INTEGER NOT NULL,
            status           TEXT NOT NULL DEFAULT 'confirmed',
            arrival_date     TEXT NOT NULL,
            departure_date   TEXT NOT NULL,
            arrival_time     TEXT,
            arrival_method   TEXT,
            num_guests       INTEGER NOT NULL DEFAULT 1,
            special_requests TEXT,
            mobility         TEXT,
            cc_on_file       INTEGER NOT NULL DEFAULT 0,
            how_heard        TEXT,
            created_at       TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS reservation_rooms (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            reservation_id   INTEGER NOT NULL,
            accommodation_id INTEGER NOT NULL,
            num_guests       INTEGER NOT NULL DEFAULT 1,
            meal_package     INTEGER NOT NULL DEFAULT 1,
            extra_boats      INTEGER NOT NULL DEFAULT 0,
            single_supplement INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
            FOREIGN KEY (accommodation_id) REFERENCES accommodations(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS dietary_requirements (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            reservation_id INTEGER NOT NULL,
            guest_desc     TEXT NOT NULL DEFAULT '',
            requirement    TEXT NOT NULL,
            FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS boats (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            reservation_id INTEGER NOT NULL,
            boat_name      TEXT,
            boat_length    TEXT,
            FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS charter_bookings (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            reservation_id INTEGER NOT NULL,
            charter_date   TEXT NOT NULL,
            charter_type   TEXT NOT NULL DEFAULT 'fishing',
            duration       TEXT NOT NULL DEFAULT 'full_day',
            num_guests     INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS daily_notes (
            date  TEXT PRIMARY KEY,
            notes TEXT NOT NULL DEFAULT ''
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS staff (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS staff_schedule (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id   INTEGER NOT NULL,
            work_date  TEXT NOT NULL,
            role       TEXT NOT NULL DEFAULT '',
            UNIQUE(staff_id, work_date),
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
        )
    """)


    c.execute("""
        CREATE TABLE IF NOT EXISTS room_charges (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            reservation_id INTEGER NOT NULL,
            category       TEXT NOT NULL DEFAULT 'misc',
            description    TEXT NOT NULL,
            qty            REAL NOT NULL DEFAULT 1,
            unit_price     REAL NOT NULL DEFAULT 0,
            tax_rate       REAL NOT NULL DEFAULT 0.05,
            tax_label      TEXT NOT NULL DEFAULT 'GST 5%',
            subtotal       REAL NOT NULL DEFAULT 0,
            tax_amount     REAL NOT NULL DEFAULT 0,
            total          REAL NOT NULL DEFAULT 0,
            created_at     TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
        )
    """)

    # Seed accommodation data if empty
    c.execute("SELECT COUNT(*) FROM accommodations")
    if c.fetchone()[0] == 0:
        rooms = [
            ("Room 1",  "lodge_room", "Upper",  "1 Queen + 1 Twin",                       None, "Ocean view, ensuite",              1),
            ("Room 2",  "lodge_room", "Upper",  "1 Queen + 1 Twin",                       None, "Ensuite",                          2),
            ("Room 3",  "lodge_room", "Upper",  "2 Twins",                                None, "Ensuite",                          3),
            ("Room 4",  "lodge_room", "Upper",  "2 Twins",                                None, "Ensuite",                          4),
            ("Room 5",  "lodge_room", "Upper",  "1 Double + 1 Twin",                      None, "Ocean view, ensuite",              5),
            ("Room 6",  "lodge_room", "Main",   "1 Queen + 1 Twin",                       None, "Ensuite, off kitchen",             6),
            ("Room 7",  "lodge_room", "Ground", "2 Twins + 1 Double + pullout couch",     None, "Under deck, private entrance",     7),
            ("Room 8",  "lodge_room", "Ground", "2 Twins + 1 Queen",                      None, "Under deck, private entrance",     8),
            ("Room 9",  "lodge_room", "Ground", "2 Twins + 1 Queen",                      None, "Under deck, private entrance",     9),
            ("Room 10", "lodge_room", "Ground", "1 Queen + twin bunkbed",                 None, "Back of lodge, private entrance", 10),
            ("Creekside Cabin",   "cabin", None, "3 rooms / 5 beds",        None, "Full kitchen, BBQ, 2 bathrooms",  11),
            ("Forest View Cabin", "cabin", None, "4 bedrooms / 4 ensuites", None, "Full kitchen, BBQ",               12),
            ("Boat Shop Suite",   "suite", None, "3 beds / 1 bathroom",     None, "Full kitchen, BBQ, above workshop", 13),
        ]
        c.executemany(
            "INSERT INTO accommodations (name,type,floor,bed_config,max_occupancy,features,sort_order) VALUES (?,?,?,?,?,?,?)",
            rooms
        )

    # Migrations — add new columns to existing databases safely
    migrations = [
        "ALTER TABLE reservations ADD COLUMN notes TEXT",
        "ALTER TABLE reservations ADD COLUMN mobility TEXT",
        "ALTER TABLE reservations ADD COLUMN cc_on_file INTEGER NOT NULL DEFAULT 0",
    ]
    for sql in migrations:
        try:
            c.execute(sql)
        except Exception:
            pass  # Column already exists

    # Always ensure charter boats exist (insert if missing)
    existing_names = [r[0] for r in c.execute("SELECT name FROM accommodations").fetchall()]
    charter_boats = [
        ("MB1",                "charter_boat",    None, None, 4, "McKay Bay charter boat 1", 14),
        ("MB2",                "charter_boat",    None, None, 4, "McKay Bay charter boat 2", 15),
        ("Contractor Boat #1", "contractor_boat", None, None, 4, "Contractor charter boat",  16),
        ("Contractor Boat #2", "contractor_boat", None, None, 4, "Contractor charter boat",  17),
        ("Contractor Boat #3", "contractor_boat", None, None, 4, "Contractor charter boat",  18),
    ]
    for boat in charter_boats:
        if boat[0] not in existing_names:
            c.execute(
                "INSERT INTO accommodations (name,type,floor,bed_config,max_occupancy,features,sort_order) VALUES (?,?,?,?,?,?,?)",
                boat
            )

    conn.commit()
    conn.close()


def rows_to_list(rows):
    return [dict(r) for r in rows]


def row_to_dict(row):
    return dict(row) if row else None


def full_reservation(db, rid):
    res = row_to_dict(db.execute(
        """SELECT r.*, g.first_name, g.last_name, g.phone, g.email, g.is_returning
           FROM reservations r JOIN guests g ON g.id = r.guest_id
           WHERE r.id = ?""",
        (rid,)
    ).fetchone())
    if not res:
        return None
    res["rooms"] = rows_to_list(db.execute(
        """SELECT rr.*, a.name AS accommodation_name, a.type AS accommodation_type, a.sort_order
           FROM reservation_rooms rr
           JOIN accommodations a ON a.id = rr.accommodation_id
           WHERE rr.reservation_id = ?
           ORDER BY a.sort_order""",
        (rid,)
    ).fetchall())
    res["dietary"] = rows_to_list(db.execute(
        "SELECT * FROM dietary_requirements WHERE reservation_id = ?", (rid,)
    ).fetchall())
    res["boats"] = rows_to_list(db.execute(
        "SELECT * FROM boats WHERE reservation_id = ?", (rid,)
    ).fetchall())
    res["charters"] = rows_to_list(db.execute(
        "SELECT * FROM charter_bookings WHERE reservation_id = ? ORDER BY charter_date", (rid,)
    ).fetchall())
    return res
