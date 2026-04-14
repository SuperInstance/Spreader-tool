<!--
Reasoning: Identify repo structure, need title, description, what it does, installation, usage. Keep under 40 lines. Use markdown headings. Provide npm commands. Mention examples and tests.
-->
# Spreader-tool
A lightweight TypeScript library for spreading data across multiple targets.

## What it does
Efficiently distributes items from a source collection to one or more async handlers, with back‑pressure support and pluggable strategies.

## Installation
```bash
npm install spreader-tool
```

## Usage
```ts
import { spread } from "spreader-tool";

const src = [1, 2, 3, 4];
const dest = [
  async i => console.log("A:", i),
  async i => console.log("B:", i),
];

await spread(src, dest);
```

See `examples/` for scripts and `tests/` for Vitest cases.

## Scripts
```bash
npm run build   # compile
npm test        # run Vitest
```

## License
MIT – see [LICENSE](LICENSE).