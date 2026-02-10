.DEFAULT_GOAL := help

TEST_FILES := pi-extensions/__tests__/*.ts pi-extensions/*/__tests__/*.ts pi-extensions/**/__tests__/*.ts

.PHONY: help test check format

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"; print "Available targets:"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-8s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

test: ## Run repository tests
	@bunx --yes tsx --test $(TEST_FILES)

check: ## Run repository checks (currently no-op)
	@echo "No repository-wide linter configured yet"

format: ## Run formatter (currently no-op)
	@echo "No repository-wide formatter configured yet"
