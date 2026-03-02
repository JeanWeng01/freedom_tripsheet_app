#!/usr/bin/env bash
# Start the Freedom Trip Sheet backend
# Run from the project root: bash backend/start.sh

set -e
cd "$(dirname "$0")"

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python -m venv venv
fi

# Activate venv
source venv/Scripts/activate 2>/dev/null || source venv/bin/activate

# Install / upgrade dependencies
pip install -r requirements.txt --quiet

echo ""
echo "Starting Freedom Trip Sheet backend on http://localhost:8000"
echo "API docs: http://localhost:8000/docs"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
