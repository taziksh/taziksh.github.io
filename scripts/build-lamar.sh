#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"

cargo build \
  --manifest-path "$project_dir/games/lamar-core/Cargo.toml" \
  --target wasm32-unknown-unknown \
  --release

cp -f \
  "$project_dir/games/lamar-core/target/wasm32-unknown-unknown/release/lamar_core.wasm" \
  "$project_dir/public/lamar/lamar_core.wasm"
