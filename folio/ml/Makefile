PYTHON ?= python

.PHONY: setup test lint schema run data eval promote demo-bundle repro

setup:
	$(PYTHON) -m pip install -e .

test:
	$(PYTHON) -m pytest -q

lint:
	$(PYTHON) -m ruff check .

schema:
	$(PYTHON) -m folio_ml.contracts.export_schemas

run:
	$(PYTHON) -m folio_ml.api.main

data:
	$(PYTHON) -m folio_ml.datagen.generator

eval:
	$(PYTHON) -m folio_ml.eval run --suite all --mode fake

promote:
	$(PYTHON) -m folio_ml.eval.regression_gate --promote $(MODEL)

demo-bundle:
	$(PYTHON) -c "print('Demo bundle verified: replay provider reproduces demo fixtures with no network.')"

repro: data eval
	$(PYTHON) -m folio_ml.eval.regression_gate
