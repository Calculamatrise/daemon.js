import { basename, dirname, extname, isAbsolute } from 'path';
import { existsSync } from 'fs';
import DaemonInfo from './DaemonInfo.js';
import DaemonRegistry from "../registry.js";
import OSAdapter from '../adapters/index.js';
import { State } from '../utils/enum.js';

export default class Daemon extends DaemonInfo {
	static normalizeOpts(path = process.argv[1], options = {}) {
		if (arguments.length == 0) return;
		if (path instanceof Object) options = path;
		else if (!(options instanceof Object)) {
			if (typeof path == 'string' && typeof options == 'string') {
				const _path = options;
				options = { id: path };
				path = _path;
			} else options = {};
		}

		if (typeof path == 'string') {
			const isPath = isAbsolute(path);
			if (!isPath) options.id = path;
			else if (!existsSync(path)) throw new ReferenceError(`No file found at "${options}"`);
			// else if (extname(options) != '.exe') throw new Error('Unsupported file type');
			else {
				const pathKey = extname(path) == '.exe' ? 'binaryPath' : 'entry';
				options[pathKey] = path;

				const displayName = basename(dirname(path));
				options = Object.assign({
					displayName,
					id: OSAdapter.normalizeName(displayName)
				}, options);
			}
		}

		return options
	}

	constructor() {
		super(Daemon.normalizeOpts(...arguments))
	}

	async fetch() {
		const info = await DaemonRegistry.get(this.id);
		return info ? this._patch(info) : null
	}

	async install(...args) {
		if (!this.id) throw new Error('id is required for install');
		if (!this.binaryPath) throw new Error('binaryPath is required for install');
		await DaemonRegistry.register(this.id, this.binaryPath, this, ...args)
	}

	async kill() {
		await this.fetch();
		if (!this.pid) throw new Error('Cannot kill process: PID is unknown or service is not running');
		await OSAdapter.terminate(this.pid);
		this.state = State.Stopped
	}

	async restart(wait = true) {
		await OSAdapter.restart(this.id, wait);
		this.state = wait ? State.Running : State.StartPending
	}

	async start(wait = true) {
		await OSAdapter.start(this.id, wait);
		this.state = wait ? State.Running : State.StartPending
	}

	async stop(wait = true) {
		await OSAdapter.stop(this.id, wait);
		this.state = wait ? State.Stopped : State.StopPending
	}

	async uninstall({ force = false, purge = false } = {}) {
		await DaemonRegistry.unregister(this.id, {
			force,
			isRunning: this.isRunning,
			purge
		});
		this.state = State.Stopped
	}

	async update(info = null) {
		await OSAdapter.config(this.id, info || this);
		if (info) this._patch(info)
	}
}