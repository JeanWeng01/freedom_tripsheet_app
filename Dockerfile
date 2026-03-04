# Stage 1: Build React app
FROM node:20-alpine AS builder
WORKDIR /build
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.13-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/*.py ./

# Copy Excel template (read-only, baked into image)
COPY "Freedom Trip Sheet Template - ADAPTED FOR APP.xlsx" ./template.xlsx

# Copy built React SPA from stage 1
COPY --from=builder /build/dist ./static

ENV DATA_DIR=/data
ENV PORT=8000

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
