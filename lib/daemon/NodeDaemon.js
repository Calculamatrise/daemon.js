import { basename, extname, isAbsolute, resolve } from 'path';
import { existsSync } from "fs";

import Daemon from './Daemon.js';
import IntegratedWinSW from '../winsw/integrated.js';

export default class NodeDaemon extends Daemon {
	options = { /* maxAttempts: 3 */ };
	winsw = new IntegratedWinSW({}, this);
	constructor() {
		const options = Daemon.normalizeOpts(...arguments);
		super();
		Object.defineProperties(this, {
			options: { enumerable: false },
			winsw: { enumerable: false }
		});

		if (typeof options == 'object' && options != null) {
			if (options.args) this.options.args = options.args;
			if (options.execArgv) this.options.execArgv = options.execArgv;
			// this.options.maxAttempts = options.maxAttempts ?? this.options.maxAttempts;
			// this.options.runtimeExecutable
		}

		this._patch(options);
		this.winsw.config._patch(options)
	}

	get entry() {
		let path = this.winsw.config.arguments.at(-1);
		// Search for actual JavaScript file
		// if (path && extname(path) != '.js' && extname(path) != '.mjs') path = this.winsw.config.arguments.find(a => extname(a) === '.js' || extname(a) === '.mjs');
		if (!isAbsolute(path || '')) return null;
		return path
	}

	set entry(value) {
		const path = this.entry;
		if (path === null) this.winsw.config.arguments.push(value);
		else this.winsw.config.arguments.splice(this.winsw.config.arguments.indexOf(path), 1, value)
	}

	_patch(info) {
		super._patch(info);
		if (!info || !(info instanceof Object)) return;
		for (const key in info) {
			let value = info[key];
			if (value == null) continue;
			switch (key) {
			case 'binaryPath': if (extname(this.binaryPath) == '.exe') break;
			case 'entry':
			case 'js':
			case 'script':
			case 'target':
			case 'targetPath':
				if (!existsSync(value)) throw new ReferenceError(`No file found at "${value}"`);
				this.entry = value;
				this.displayName ||= basename(value);
				this.winsw._patch({ entry: value });
				break;
			case 'installDir':
				if (!existsSync(value)) throw new ReferenceError(`Dir not found: "${value}"`);
				this.options.installDir = value;
				break;
			// case 'winsw': Object.assign(this.options.winsw, value); break;
			case 'winsw': this.winsw._patch(value)
			}
		}

		this.winsw.config._patch(this)
	}

	async install() {
		await this.winsw.createBinary();
		return super.install(...arguments)
	}

	async uninstall() {
		await super.uninstall(...arguments);
		await this.winsw.unlinkBinary()
	}

	async update(info) {
		const returnValue = await super.update(info);
		// Only update if changes were made -- read xml first?
		await this.winsw.updateConfig();
		return returnValue
	}

	static test(name, config) {
		if (typeof name == 'string') config = { entry: name };
		let ext = config.entry && extname(config.entry);
		if (ext === '.js') return true;
		const binaryPath = config.binaryPathName || config.binaryPath;
		ext = binaryPath && extname(basename(binaryPath, extname(binaryPath)));
		if (ext === '.winsw') return true;
		return false
	}
}