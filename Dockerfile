FROM node:20-alpine AS fe-build
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx supervisor \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app
COPY --from=fe-build /frontend/dist /var/www/html
COPY deploy/nginx.single.conf /etc/nginx/conf.d/default.conf
COPY deploy/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 18766

CMD ["/usr/bin/supervisord", "-n"]
