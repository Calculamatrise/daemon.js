import { existsSync } from "fs";
import { normalize } from "path";
import { State } from "../utils/enum.js";

export default class DaemonInfo {
	binaryPath = null;
	displayName = null;
	id = null;
	logOnAs = { account: null, domain: null };
	pid = null;
	startType = null;
	state = null;
	constructor(raw) {
		Object.defineProperties(this, {
			dependencies: { value: new Set() },
			exitCode: { value: null, writable: true }
		});
		raw && this._patch(raw)
	}

	_patch(data) {
		if (typeof data == 'string') data = parseRawInfo(data);
		if (!data || typeof data != 'object') return;
		for (const key in data) {
			const value = data[key];
			if (value == null) continue;
			switch (key) {
			case 'binaryPathName': this.binaryPath = normalize(value); break;
			case 'dependencies':
				const oldSize = this.dependencies.size;
				this.dependencies.clear();
				for (const dependency of value
					? value instanceof Set
					? value[Symbol.iterator]()
					: value.split(/[\s,]+/).filter(Boolean)
					: []) this.dependencies.add(dependency);
				if (oldSize !== this.dependencies.size) Object.defineProperty(this, key, { enumerable: this.dependencies.size > 0 });
				break;
			case 'displayName':
			case 'startType':
				this[key] = value;
				break;
			case 'pid':
				this[key] = isFinite(value) ? parseInt(value) : value;
				break;
			case 'serviceExitCode':
				this.exitCode = parseInt(value);
				break;
			case 'serviceName': this.id = value; break;
			case 'serviceStartName':
				if (value.includes('\\')) {
					[this.logOnAs.domain, this.logOnAs.account] = value.split('\\');
				} else {
					this.logOnAs.account = value;
				}
				break;
			case 'state':
				this[key] = parseInt(value);
				break;
			default:
				if (!Object.hasOwn(this, key)) break;
				if (this[key] instanceof Object) {
					Object.assign(this[key], value);
					break;
				}
				this[key] = value
			}
		}
	}

	get binaryExists() { return existsSync(this.binaryPath) }
	get isRunning() { return this.state === State.Running }
}