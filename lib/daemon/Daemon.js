import { basename } from 'path';
import DaemonInfo from './DaemonInfo.js';
import DaemonRegistry from "../registry.js";
import { execute } from '../utils/exec.js';
import { escape } from '../utils/utils.js';

export default class Daemon extends DaemonInfo {
	constructor() {
		super(normalizeOpts(...arguments))
	}

	#exec(cmd, ...args) {
		if (!this.id) throw new Error('Daemon name is not defined');
		// if (!this.exists) throw Error(`Failed to start: No binary found at "${this.binaryPath}"`);
		return DaemonRegistry._exec(`${cmd} ${escape(this.id)} ${args.join(' ')}`)
	}

	async install() {
		if (!this.binaryPath) throw new Error('binaryPath is required for install');
		const bin = escape(this.binaryPath);
		await execute(`sc create ${escape(this.id)} binPath= ${bin} DisplayName= "${this.displayName}" start= auto`)
	}

	kill() {
		return execute(`taskkill /F /IM ${basename(this.binaryPath)}`)
	}

	async refresh() {
		const info = await DaemonRegistry.get(this.id)
		info && this._patch(info)
	}

	async restart() {
		await this.stop();
		await new Promise(r => setTimeout(r, this.waitHint ?? 500));
		return this.start()
	}

	async start() {
		return this.#exec('start')
			.then(() => true)
			.catch(err => {
				if (err.code !== 1056) throw err;
				return false
			})
	}

	async stop() {
		return this.#exec('stop')
			.then(() => true)
			.catch(err => {
				if (err.code !== 1062) throw err;
				return false
			})
	}

	async uninstall(force = false) {
		if (!await DaemonRegistry.isRegistered(this.id)) return;

		await this.#exec('stop', `& sc delete ${escape(this.id)}`);

		if (force) {
			await new Promise(r => setTimeout(r, this._waitHint ?? 500));
			await execute(`reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Services\\${this.id}" /f`);
		}

		return true
	}
}

export function normalizeName(name) {
	if (typeof name != 'string') {
		if (typeof name != 'number') throw new TypeError('Daemon name must be a string');
		name = String(name);
	}
	return name
		.replace(/[^A-Za-z0-9_.-]+/g, '')
		.trim()
		.slice(0, 256)
}

import { existsSync } from 'fs';
import { dirname, extname, isAbsolute } from 'path';

export function normalizeOpts(path = process.argv[1], options = {}) {
	if (arguments.length == 0) return;
	if (path instanceof Object) options = path;
	else if (!(options instanceof Object)) options = {};

	if (typeof path == 'string') {
		const isPath = isAbsolute(path);
		if (!isPath) options.id = path;
		else if (!existsSync(path)) throw new ReferenceError(`No file found at "${options}"`);
		// else if (extname(options) != '.exe') throw new Error('Unsupported file type');
		else {
			const pathKey = extname(path) == '.exe' ? 'binaryPath' : 'targetPath';
			options[pathKey] = path;

			const displayName = basename(dirname(path));
			options = Object.assign({
				displayName,
				id: normalizeName(displayName)
			}, options);
		}
	}

	return options
}