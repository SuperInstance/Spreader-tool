# Spreader-tool

A TypeScript utility for efficient data spreading, part of the **Cocapn Fleet**.

## Description
Spreader-tool provides a simple API to distribute data across multiple targets with type‑safe guarantees. Ideal for projects that need scalable broadcasting or message routing.

## Installation
```bash
npm install spreader-tool
```

## Usage
```ts
import { spread } from 'spreader-tool';

const data = { foo: 'bar' };
spread(data, ['targetA', 'targetB']);
```

Run the examples:
```bash
npm run build
node examples/index.js
```

## Related
- **Cocapn Fleet** – https://github.com/SuperInstance  
- **Message-in-a-bottle** (example implementation) – `message-in-a-bottle/`  

---  
© 2024 SuperInstance. Licensed under the MIT License.