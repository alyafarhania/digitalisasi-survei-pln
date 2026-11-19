.DEFAULT_GOAL := help
COMPOSE := docker compose
# Ambil HTTP_PORT dari .env (bawaan 8080) untuk pesan alamat
HTTP_PORT := $(shell grep -s '^HTTP_PORT=' .env | tail -1 | cut -d= -f2)
HTTP_PORT := $(if $(HTTP_PORT),$(HTTP_PORT),8080)

.PHONY: help setup up down restart build logs ps psql adminer clean dev install mock health test test-watch e2e e2e-docker test-all browsers

help: ## Tampilkan daftar perintah
	@awk 'BEGIN{FS=":.*## "} /^[a-zA-Z0-9_-]+:.*## /{printf "  \033[36m%-10s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)

.env:
	@cp .env.example .env
	@echo ">> .env dibuat dari .env.example — ganti DB_PASSWORD sebelum dipakai di server."

setup: .env ## Buat file .env bila belum ada

up: .env ## Build dan jalankan semua (nextjs + postgres + nginx)
	$(COMPOSE) up --build -d
	@echo ">> Buka http://localhost:$(HTTP_PORT)"

down: ## Hentikan semua (data database tetap aman)
	$(COMPOSE) down

restart: ## Restart semua layanan
	$(COMPOSE) restart

build: .env ## Build ulang image tanpa menjalankan
	$(COMPOSE) build

logs: ## Lihat log (make logs s=app untuk satu layanan)
	$(COMPOSE) logs -f --tail=100 $(s)

ps: ## Status layanan
	$(COMPOSE) ps

health: ## Cek aplikasi lewat nginx
	@curl -fsS http://localhost:$(HTTP_PORT)/api/health && echo

psql: ## Masuk ke psql di container database
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

adminer: .env ## Jalankan Adminer di http://localhost:8081
	$(COMPOSE) --profile tools up -d adminer

clean: ## Hentikan semua DAN hapus data database (volume) — minta konfirmasi
	@read -p "Ini menghapus semua data PostgreSQL. Lanjut? [y/N] " a; [ "$$a" = "y" ] && $(COMPOSE) down -v || echo "Dibatalkan."

install: ## Pasang dependensi untuk pengembangan lokal
	npm install

dev: install ## Jalankan mode pengembangan tanpa Docker (http://localhost:3000)
	npm run dev

mock: install ## Bangun ulang public/mock/master.json dari data/*.xlsx
	npm run mock:build

test: install ## Tes unit (Vitest, ±10 dtk)
	npm test

test-watch: install ## Tes unit mode pantau
	npm run test:watch

browsers: install ## Pasang browser Chromium untuk tes E2E (sekali)
	npx playwright install chromium

e2e: install ## Tes E2E (Playwright) — menyalakan server dev otomatis di :3100
	npm run test:e2e

e2e-docker: install ## Tes E2E terhadap stack Docker yang sedang jalan (http://localhost:$(HTTP_PORT))
	E2E_BASE_URL=http://localhost:$(HTTP_PORT) npm run test:e2e

test-all: test e2e ## Unit + E2E
