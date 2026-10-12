.PHONY: db-up db-down migrate downgrade revision test lint psql clean

DB_URL ?= postgresql+psycopg://postgres:root@localhost:5432/folio
TEST_DB_URL ?= postgresql+psycopg://postgres:root@localhost:5432/folio_test

db-up:
	docker compose up -d

db-down:
	docker compose down

migrate:
	alembic upgrade head

downgrade:
	alembic downgrade -1

downgrade-base:
	alembic downgrade base

revision:
	alembic revision -m "$(m)"

test:
	pytest -v

lint:
	python -m py_compile src/folio_db/*.py src/folio_db/models/*.py src/folio_db/repositories/*.py

psql:
	psql "$(DB_URL)"

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
