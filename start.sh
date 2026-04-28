#!/bin/bash
echo "=========================================="
echo "  HOSTEL MANAGER v10 - Starting..."
echo "=========================================="
cd "$(dirname "$0")"
echo "[1/3] Installing server dependencies..."
cd server && npm install && cd ..
echo "[2/3] Installing client dependencies..."
cd client && npm install && cd ..
echo "[3/3] Starting servers..."
echo "  Backend:  http://localhost:5000"
echo "  Frontend: http://localhost:3000"
cd server && npm start &
sleep 3
cd ../client && npm start
