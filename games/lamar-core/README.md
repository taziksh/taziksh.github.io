# Lamar WebAssembly core

This dependency-free Rust crate is the faithful gameplay layer for the browser
restoration of Lamar's Space Adventures. It reconstructs the fixed legacy loop
and intentionally preserves the original discrete input, timing, projectiles,
collision, health, boost, pause, death, and retry quirks. Canvas rendering,
browser input adaptation, and Web Audio stay in the web adapter.

Do not normalize legacy behavior in this crate. Timing, balance, control, and
quality-of-life improvements belong to the separately tracked remaster phase.
The faithful page likewise must not add an external HUD, buttons, mouse/touch
controls, instructions, or decorative site shell around the original 640×500
game. Browser-only compatibility code must remain invisible and preserve the
Java program's keyboard sequence and separate 250×600 Info window.

```sh
cargo test --manifest-path games/lamar-core/Cargo.toml
cargo build --manifest-path games/lamar-core/Cargo.toml --target wasm32-unknown-unknown --release
```
