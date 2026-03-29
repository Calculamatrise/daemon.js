import { basename, extname, resolve } from 'path';
import { existsSync } from "fs";

const WRAPPER_PATH = resolve(import.meta.dirname, '../wrapper/index.js');
if (!existsSync(WRAPPER_PATH)) throw new ReferenceError('Wrapper not found!');

import Daemon, { normalizeOpts } from './Daemon.js';
import IntegratedWinSW from '../winsw/integrated.js';

export default class NodeDaemon extends Daemon {
	targetPath = null;
	options = {
		execFlags: null,
		maxAttempts: 3,
		nodeOptions: '--harmony',
		winsw: { installDir: null },
		wrap: false,
		wrapper: {
			abortOnError: true,
			commandArguments: {
				grow: .5,
				wait: 1
			},
			maxRestarts: 3
		}
	};
	winsw = new IntegratedWinSW({}, this);

	constructor() {
		const options = normalizeOpts(...arguments);
		super();
		Object.defineProperties(this, {
			options: { enumerable: false },
			winsw: { enumerable: false }
		});
		this._patch(options);
		this.winsw.config.id = this.id;
		// this.winsw.config.executable = this.binaryPath
	}

	_patch(info) {
		super._patch(info);
		if (!info || !(info instanceof Object)) return;
		for (const key in info) {
			let value = info[key];
			if (value == null) continue;
			switch (key) {
			case 'binaryPath': if (extname(this.binaryPath) == '.exe') break;
			case 'script':
			case 'scriptPath':
			case 'target':
			case 'targetPath':
				if (!existsSync(value)) throw new ReferenceError(`No file found at "${value}"`);
				this.targetPath = value;
				this.displayName ||= basename(value);
				this.winsw._patch({ [key]: value });
				break;
			case 'installDir':
				if (!existsSync(value)) throw new ReferenceError(`Dir not found: "${value}"`);
				this.options.installDir = value;
				break;
			// case 'winsw': Object.assign(this.options.winsw, value); break;
			case 'winsw': this.winsw._patch(value); break;
			case 'wrap': {
				if (typeof value != 'boolean') throw new TypeError(`options[${key}] must be of type: boolean`);
				this.options[key] = value;
				break;
			}

			// Wrapper Options
			case 'grow':
			case 'wait': this.options.wrapper.commandArguments[key] = Math.max(0, Number(value) || 1)
			}
		}
	}

	async install() {
		await this.winsw.createBinary();
		return super.install(...arguments)
	}

	async uninstall() {
		await super.uninstall(...arguments);
		await this.winsw.unlinkBinary()
	}

	static test(name, config) {
		if (typeof name == 'string') config = { targetPath: name };
		let ext = config.targetPath && extname(config.targetPath);
		if (ext === '.js') return true;
		const binaryPath = config.binaryPathName || config.binaryPath;
		ext = binaryPath && extname(basename(binaryPath, extname(binaryPath)));
		if (ext === '.winsw') return true;
		return false
	}
}