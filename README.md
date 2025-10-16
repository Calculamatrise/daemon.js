# daemon.js
A lightweight and customizable daemon registry which allows you to create and manage daemons on Windows with the help of [WinSW](https://github.com/winsw/winsw).

## Features
- Minimal and easy-to-use API
- Fully modular and ES Module ready
- TypeScript type definitions included

## Installation
```cmd
npm install daemon.js
```

## Usage
```js
import Daemon from "daemon.js";
import { resolve } from "path";

const daemon = new Daemon({
	name: 'MyDaemon',
	displayName: 'My Daemon',
	script: resolve('index.js')
});

await daemon.install();
```
**Example with DaemonRegistry:**
```js
import { DaemonRegistry } from "daemon.js";
import { resolve } from "path";

const daemon = DaemonRegistry.register('MyDaemon', {
	displayName: 'My Daemon',
	script: resolve('index.js')
});
```

## License
GNU General Public License v2.0. See [LICENCE](https://github.com/zenginlimited/server/LICENSE) for details.