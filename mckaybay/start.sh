#!/bin/bash
# McKay Bay Lodge — Start the reservation software
# Usage: ./start.sh
echo ""
echo "🏔  McKay Bay Lodge Reservation Software"
echo "==========================================="
cd "$(dirname "$0")"
python3 server.py
