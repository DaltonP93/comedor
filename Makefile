.PHONY: help setup setup-local up down restart logs seed migrate build test lint typecheck clean

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Instalación de un comando con Docker (stack completo + migraciones + seed)
	@bash scripts/setup.sh

setup-local: ## Instalación local sin Docker (requiere Postgres propio)
	@bash scripts/setup-local.sh

up: ## Levanta el stack con Docker
	@docker compose up -d --build

down: ## Detiene el stack
	@docker compose down

restart: ## Reinicia la API
	@docker compose restart api

logs: ## Sigue los logs de la API
	@docker compose logs -f api

seed: ## Corre el seed dentro del contenedor de la API
	@docker compose exec -T api sh -c 'cd /app/packages/database && npx ts-node prisma/seed.ts'

migrate: ## Aplica migraciones dentro del contenedor de la API
	@docker compose exec -T api sh -c 'cd /app/packages/database && npx prisma migrate deploy'

build: ## Compila las 3 apps
	@npm run build

test: ## Corre los tests de la API
	@npm run test

lint: ## Lint de api y web-admin
	@npm run lint

typecheck: ## Typecheck de las 3 apps
	@npm run typecheck

clean: ## Detiene el stack y borra volúmenes (¡borra la base!)
	@docker compose down -v
