# Lamar WebAssembly core

This dependency-free Rust crate is the deterministic gameplay layer for the
browser restoration of Lamar's Space Adventures. Canvas rendering, browser
input, and Web Audio stay in the web adapter; movement, difficulty rules,
projectiles, collision, health, boost, kills, pause, death, and retry live here.

```sh
cargo test --manifest-path games/lamar-core/Cargo.toml
cargo build --manifest-path games/lamar-core/Cargo.toml --target wasm32-unknown-unknown --release
```
