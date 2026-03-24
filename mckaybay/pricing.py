"""
McKay Bay Lodge — Pricing & tax calculations.
"""
from datetime import date, timedelta

SUMMER_START = (5, 1)   # (month, day)  May 1
SUMMER_END   = (9, 30)  # September 30

MEAL_SUMMER    = 235.00
MEAL_OFFSEASON = 200.00
SINGLE_SUPPL   = 300.00

CABIN_RATES = {
    "Creekside Cabin":   {"summer": 550.00, "offseason": 400.00},
    "Forest View Cabin": {"summer": 550.00, "offseason": 400.00},
    "Boat Shop Suite":   {"summer": 325.00, "offseason": 250.00},
}

CHARTER_RATES = {
    "fishing": {"full_day": 1400.00, "half_day": 750.00},
    "wildlife": None,
}

EXTRA_BOAT  = 25.00
GST         = 0.05
HOTEL_TAX   = 0.048   # meal-package stays
PST         = 0.08    # self-contained stays


def _is_summer(d: date) -> bool:
    sm, sd = SUMMER_START
    em, ed = SUMMER_END
    after_start = (d.month > sm) or (d.month == sm and d.day >= sd)
    before_end  = (d.month < em) or (d.month == em and d.day <= ed)
    return after_start and before_end


def _season_nights(arrival: date, departure: date) -> dict:
    s = o = 0
    d = arrival
    while d < departure:
        if _is_summer(d):
            s += 1
        else:
            o += 1
        d += timedelta(days=1)
    return {"summer": s, "offseason": o}


def calc_quote(rooms: list, arrival: str, departure: str, charters: list = None) -> dict:
    arr = date.fromisoformat(arrival)
    dep = date.fromisoformat(departure)
    sn  = _season_nights(arr, dep)
    total_nights = sn["summer"] + sn["offseason"]

    lines      = []
    subtotal   = 0.0
    tax_total  = 0.0

    for room in rooms:
        name  = room.get("accommodation_name", "")
        atype = room.get("accommodation_type", "lodge_room")
        ng    = int(room.get("num_guests", 1))
        mp    = bool(room.get("meal_package", True))
        extra = int(room.get("extra_boats", 0))
        solo  = bool(room.get("single_supplement", False))

        if atype == "lodge_room" or mp:
            rs = SINGLE_SUPPL if solo else MEAL_SUMMER
            ro = SINGLE_SUPPL if solo else MEAL_OFFSEASON
            sub = ng * (sn["summer"] * rs + sn["offseason"] * ro)
            tax = sub * (GST + HOTEL_TAX)
            label = f"{name} — {ng} guest{'s' if ng!=1 else ''} × meal package"
        else:
            rates = CABIN_RATES.get(name, {"summer": 0, "offseason": 0})
            sub   = sn["summer"] * rates["summer"] + sn["offseason"] * rates["offseason"]
            tax   = sub * (GST + PST)
            label = f"{name} — self-contained"

        if extra:
            sub   += extra * total_nights * EXTRA_BOAT
            label += f" + {extra} extra boat{'s' if extra!=1 else ''}"

        lines.append({"description": label, "subtotal": round(sub, 2), "tax": round(tax, 2),
                       "total": round(sub + tax, 2)})
        subtotal  += sub
        tax_total += tax

    for ch in (charters or []):
        ctype = ch.get("charter_type", "fishing")
        dur   = ch.get("duration", "full_day")
        if ctype == "fishing":
            rate  = CHARTER_RATES["fishing"][dur]
            tax   = rate * GST
            label = f"Fishing charter — {dur.replace('_', ' ')} ({ch.get('charter_date','')})"
            lines.append({"description": label, "subtotal": round(rate, 2),
                           "tax": round(tax, 2), "total": round(rate + tax, 2)})
            subtotal  += rate
            tax_total += tax
        else:
            lines.append({"description": f"Wildlife charter ({ch.get('charter_date','')}) — contact for pricing",
                           "subtotal": 0, "tax": 0, "total": 0})

    grand = subtotal + tax_total
    return {
        "nights":           total_nights,
        "nights_summer":    sn["summer"],
        "nights_offseason": sn["offseason"],
        "lines":            lines,
        "subtotal":         round(subtotal, 2),
        "tax":              round(tax_total, 2),
        "grand_total":      round(grand, 2),
    }
