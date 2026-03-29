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
import { NodeDaemon } from "daemon.js";
import { resolve } from "path";

const daemon = new NodeDaemon('MyDaemon', {
	displayName: 'My Daemon',
	targetPath: resolve('index.js')
});

await daemon.install();
```
**Example with Script argument:**
```js
import { NodeDaemon } from "daemon.js";
import { resolve } from "path";

const daemon = new NodeDaemon(resolve('MyDaemon.js'));

await daemon.install();
```

## License
GNU General Public License v2.0. See [LICENCE](https://github.com/Calculamatrise/daemon.js/LICENSE) for details.