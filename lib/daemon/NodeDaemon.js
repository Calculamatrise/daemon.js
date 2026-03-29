import { basename, dirname, extname, join, resolve } from 'path';
import { existsSync } from "fs";

const WRAPPER_PATH = resolve(import.meta.dirname, '../wrapper/index.js');
if (!existsSync(WRAPPER_PATH)) throw new ReferenceError('Wrapper not found!');

import { mkdir, readdir, rmdir, unlink, writeFile } from 'fs/promises';
import Daemon, { normalizeOpts } from './Daemon.js';
import { execute } from '../utils/exec.js';
import { escape } from '../utils/utils.js';
// import WinSW from "../winsw/winsw.js";
import IntegratedWinSW from '../winsw/integrated.js';

const DAEMON_DIR_NAME = '.daemon';

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

	// toXML() {
	// 	const options = {
	// 		allowServiceLogon: this.options.winsw.allowServiceLogon,
	// 		name: this.displayName,
	// 		description: this.description,
	// 		env: this.options.winsw.env,
	// 		execPath: this.options.winsw.execPath,
	// 		id: this.id,
	// 		nodeOptions: this.options.winsw.nodeOptions || this.options.nodeOptions,
	// 		logging: this.options.winsw.logging,
	// 		logOnAs: this.logOnAs,
	// 		logPath: this.options.logPath,
	// 		script: this.options.wrap ? WRAPPER_PATH : this.targetPath,
	// 		stopParentFirst: this.options.winsw.stopParentFirst,
	// 		stopTimeout: this.options.winsw.stopTimeout,
	// 		workingDirectory: this.options.winsw.workingDirectory
	// 	};

	// 	if (this.options.wrap) {
	// 		const args = {
	// 			cwd: this.options.wrapper.workingDirectory,
	// 			file: this.targetPath,
	// 			log: `${this.displayName || this.id} Wrapper`,
	// 			grow: this.options.wrapper.commandArguments.grow,
	// 			wait: this.options.wrapper.commandArguments.wait,
	// 			maxrestarts: this.options.wrapper.maxRestarts ?? this.options.winsw.maxRestarts,
	// 			abortonerror: this.options.wrapper.abortOnError,
	// 			stopparentfirst: this.options.winsw.stopParentFirst
	// 		};
	// 		if (this.options.winsw.maxRetries != null)
	// 			args.maxretries = this.options.winsw.maxRetries;
	// 		if (this.options.execFlags != null)
	// 			args.scriptoptions = this.options.execFlags;
	// 		options.arguments = Object.entries(args)
	// 			.filter(([, v]) => v != null && v !== false)
	// 			.map(([key, val]) => `--${key}${val === true ? '' : `=${escape(val)}`}`);
	// 	}

	// 	return generateXml(options)
	// }

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