# FortisExam — Makefile
# One-command setup, run, test, demo, reset.

.PHONY: setup run run-cloud run-edge test demo reset clean help

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## First-time project setup
	bash scripts/setup.sh

run: run-cloud run-edge ## Start all services

run-cloud: ## Start cloud server (PostgreSQL)
	docker compose -f docker/docker-compose.yml up -d postgres cloud-server

run-edge: ## Start edge server (SQLite)
	docker compose -f docker/docker-compose.yml up -d edge-server

run-web: ## Start admin portal (Vite dev server)
	cd web && npm run dev

run-desktop: ## Start desktop kiosk (Electron dev)
	cd desktop && npm run dev:electron

test: ## Run all tests
	python -m pytest tests/ -v

test-unit: ## Run unit tests only
	python -m pytest tests/unit/ -v

test-integration: ## Run integration tests only
	python -m pytest tests/integration/ -v

test-security: ## Run security tests only
	python -m pytest tests/security/ -v

demo: ## Start full demo environment
	make run
	@echo "⏳ Waiting for services..."
	@sleep 5
	@echo "✅ Demo ready!"
	@echo "   Cloud:   http://localhost:8000/health"
	@echo "   Edge:    http://localhost:8001/health"
	@echo "   Admin:   cd web && npm run dev"
	@echo "   Desktop: cd desktop && npm run dev:electron"

reset: ## Reset demo to clean state
	bash scripts/demo-reset.sh

seed: ## Seed demo data
	python scripts/seed-demo-data.py

keys: ## Generate RSA key pairs
	bash scripts/generate-keys.sh

clean: ## Stop all containers and remove data
	docker compose -f docker/docker-compose.yml down -v
	rm -rf keys/ data/

logs-cloud: ## Tail cloud server logs
	docker logs -f fortis-cloud-server

logs-edge: ## Tail edge server logs
	docker logs -f fortis-edge-server
