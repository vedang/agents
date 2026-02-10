.DEFAULT_GOAL := help

BIOME := bunx --yes @biomejs/biome
TEST_FILES := $(shell find pi-extensions -type f -path "*/__tests__/*.test.ts")

.PHONY: help test check format

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"; print "Available targets:"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-8s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

test: ## Run repository tests
	@bunx --yes tsx --test $(TEST_FILES)

check: ## Lint TypeScript in pi-extensions using Biome
	@$(BIOME) lint --reporter=summary --files-ignore-unknown=true $$(find pi-extensions -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.mts" -o -name "*.cts" \))

format: ## Format TypeScript in pi-extensions using Biome
	@$(BIOME) format --write --files-ignore-unknown=true $$(find pi-extensions -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.mts" -o -name "*.cts" \))
