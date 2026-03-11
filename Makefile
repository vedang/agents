SHELL := /bin/bash
.SHELLFLAGS := -Eeuo pipefail -c

.DEFAULT_GOAL := help

TS_SCOPE ?= pi-extensions
TS_FILES := $(shell find $(TS_SCOPE) -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.mts" -o -name "*.cts" \) -not -path "*/node_modules/*")
TEST_FILES := $(shell find $(TS_SCOPE) -type f -path "*/__tests__/*.test.ts" -not -path "*/node_modules/*")

.PHONY: help
help: ## Show available targets
	@awk '/^[a-zA-Z0-9_-]+:.*##/ { printf "%-18s # %s\n", substr($$1, 1, length($$1)-1), substr($$0, index($$0, "##") + 3) }' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install dependencies
	bun install

.PHONY: ci
ci: ## Install dependencies in CI mode
	bun install --frozen-lockfile

.PHONY: check-biome
check-biome: ## Lint TypeScript with Biome
	@if [ -n "$(strip $(TS_FILES))" ]; then bunx --yes @biomejs/biome lint --reporter=summary --files-ignore-unknown=true $(TS_FILES); else echo "No TypeScript files found under $(TS_SCOPE); skipping Biome lint"; fi

.PHONY: check-typescript
check-typescript: ## Type-check TypeScript sources
	@if [ -f tsconfig.json ]; then bunx --yes tsc --noEmit -p tsconfig.json; else echo "No tsconfig.json found; skipping TypeScript check"; fi

.PHONY: check
check: check-biome check-typescript ## Run lint and type checks
	@echo "All checks passed!"

.PHONY: format
format: ## Format TypeScript with Biome
	@if [ -n "$(strip $(TS_FILES))" ]; then bunx --yes @biomejs/biome format --write --files-ignore-unknown=true $(TS_FILES); else echo "No TypeScript files found under $(TS_SCOPE); skipping Biome format"; fi

.PHONY: test
test: ## Run repository tests
	@if [ -n "$(strip $(TEST_FILES))" ]; then bunx --yes tsx --test $(TEST_FILES); else echo "No tests found under $(TS_SCOPE); skipping tests"; fi

.git/hooks/pre-push:
	@echo "Setting up Git hooks..."
	@printf '%s\n' '#!/bin/sh' 'set -eu' '' 'exec 1>&2' '' 'echo "Running pre-push checks..."' 'make check' 'make format' 'if ! git diff --exit-code --quiet; then' '  echo "Formatting changed tracked files. Commit the results before pushing."' '  exit 1' 'fi' 'make test' > .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@echo "✅ Git hooks installed successfully!"

.PHONY: install-hooks
install-hooks: .git/hooks/pre-push ## Install pre-push hook
