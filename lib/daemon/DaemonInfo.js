import { existsSync } from "fs";
import { State } from "../utils/enum.js";

export default class DaemonInfo {
	binaryPath = null;
	dependencies = new Set();
	displayName = null;
	id = null;
	logOnAs = { account: null, domain: null };
	pid = null;
	startType = null;
	state = null;
	constructor(raw) {
		Object.defineProperties(this, {
			_waitHint: { value: null, writable: true },
			dependencies: { enumerable: false },
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
			case 'binaryPathName': this.binaryPath = value; break;
			case 'waitHint':
				this['_' + key] = Number(value);
				break;
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
			case 'startType':
			case 'state':
				this[key] = parseInt(value);
				break;
			case 'winsw': break;
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

	static from(raw) {
		return new DaemonInfo(parseRawInfo(raw))
	}
}

function parseRawInfo(raw) {
	const lines = raw.split(/\s*[\n\r]+\s*/)
		.filter(line => line.includes(':'));
	return Object.fromEntries(lines.map(line => {
		let [key, ...rest] = line.split(/\s*:\s*/)
			, value = rest.join(':')
		key = key.toLowerCase();
		if (key.includes('_')) key = key.replace(/_(\w)/g, (_, c) => c.toUpperCase());
		if (value.length === 0) value = null;
		else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
		else {
			let float = parseFloat(value);
			if (isFinite(float)) value = float;
		}
		return [key, value]
	}))
}