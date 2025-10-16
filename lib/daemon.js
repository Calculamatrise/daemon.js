import { basename, dirname, join, resolve } from 'path';
import { existsSync } from "fs";
import { mkdir, readdir, rmdir, unlink, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { createExe, generateXml } from "./winsw.js";
import Logger from "./eventlog.js";
import DaemonRegistry from "./registry.js";
import { execute } from './exec.js';
import { StartFlag } from './enum.js';

const __filename = fileURLToPath(import.meta.url)
	, __dirname = dirname(__filename)
	, PermError = 'Permission Denied. Requires administrative privileges.'
	, daemonDir = '.daemon'
	, wrapper = resolve(join(__dirname, './wrapper.js'));

const escape = value => {
	if (typeof value !== 'string' || !/[\s"]/.test(value)) return value;
	return `"${value.replace(/(["\\])/g, '\\$1')}"`
};

export default class Daemon {
	#dir = process.cwd();
	#logger;

	binaryPath = null;
	description = null;
	displayName = null;
	logOnAs = {
		account: null,
		domain: process.env.COMPUTERNAME,
		mungeCredentialsAfterInstall: true,
		password: null
	};
	name = null;
	options = {
		execFlags: null,
		script: null,
		winsw: {
			allowServiceLogon: null,
			env: null,
			installDir: null,
			logging: null,
			logPath: null,
			maxRestarts: 3,
			maxRetries: null,
			nodeOptions: '--harmony',
			stopParentFirst: null,
			stopTimeout: 30,
			workingDirectory: null
		},
		wrap: true,
		wrapper: {
			abortOnError: false,
			commandArguments: {
				grow: .25,
				wait: 1
			}
		}
	};
	startType = StartFlag.AutoStart;

	get #exe() { return `${basename(this.name, '.exe')}.exe` }
	get exists() {
		return existsSync(this.binaryPath) &&
			existsSync(join(this.winswRoot, this.name + '.xml'))
	}

	get logger() {
		if (this.#logger != null) return this.#logger;
		return this.#logger ||= new Logger((this.displayName || this.name || '[daemon.js] Unnamed Daemon') + ' Monitor')
	}

	get winswRoot() {
		if (this.script === null || this.name === null) throw Error('Script and name are required.');
		return resolve(join(this.#dir, daemonDir))
	}

	constructor(config = {}) {
		Object.defineProperty(this, 'options', { enumerable: false });
		this._patch(config)
	}

	_patch(info) {
		if (!info || !(info instanceof Object)) return;
		for (const key in info) {
			const value = info[key];
			if (value == null) continue;
			switch (key) {
			// Config
			case 'script': this.#dir = dirname(value);
			case 'binaryPath': this[key] = resolve(value); break;
			case 'wrap': {
				if (typeof value != 'boolean') throw new TypeError(`options[${key}] must be of type: boolean`);
				this.options[key] = value;
				break;
			}

			// Wrapper Options
			case 'grow':
			case 'wait': this.options.wrapper.commandArguments[key] = Math.max(0, Number(value) || 1); break;

			// Info
			case 'binaryPathName': this.binaryPath = value; break;
			case 'dependencies': break;
			case 'displayName': this[key] = value; break;
			case 'serviceName': this.name = value; break;
			case 'serviceStartName': this.logOnAs.account = value; break;
			case 'startType': this[key] = value; break;

			// Query
			// case 'state': this[key]; break;
			// case 'type': this[key]; break;
			// Catch all exisitng
			default: if (Object.hasOwn(this, key)) this[key] = value
			}
		}
	}

	async _createSW(dir) {
		dir && (this.dir = resolve(dir));
		dir = this.winswRoot;

		if (!existsSync(dir)) await mkdir(dir)
			.then(() => execute(`attrib +H "${dir}"`));

		let repaired = false;
		this.binaryPath ||= join(dir, basename(this.name, '.exe') + '.exe')
		if (!existsSync(this.binaryPath)) {
			this.logger.warn(`Executable not found, re-creating: ${this.binaryPath}`);
			await createExe(this.name, dir);
			repaired = true;
		}

		const xmlPath = join(dir, this.name + '.xml');
		if (!existsSync(xmlPath)) {
			this.logger.warn(`Config XML not found, re-writing: ${xmlPath}`);
			await writeFile(xmlPath, this.toXML());
			repaired = true;
		}

		return repaired
	}

	async _unlinkSW() {
		const rm = async file => {
			const path = join(this.winswRoot, file);
			if (existsSync(path))
				return unlink(path);
		};

		// Remove the daemon files individually to prevent security warnings.
		await rm(this.name + '.xml');

		// Remove known wrappers
		await rm(this.name + '.wrapper.log');
		await rm(this.name + '.out.log');
		await rm(this.name + '.err.log');

		// Remove the executable and executable .NET runtime config file
		await rm(this.name + '.exe');
		await rm(this.name + '.exe.config');

		// Remove all other files
		const files = await readdir(this.winswRoot);
		const _other_files = files.filter(file => !file.match(/\.(wrapper\.log|out\.log|err\.log|exe|xml)$/i));
		await Promise.all(_other_files.map(f => rm(f)));
		if (files.length === 0 && this.winswRoot !== dirname(this.script)) {
			await rmdir(this.winswRoot)
		}
	}

	async install() {
		const repaired = await this._createSW()
			, registered = await DaemonRegistry.isRegistered(this.name);
		if (this.exists && registered && !repaired) return this.logger.warn('The process cannot be installed again because it already exists.');

		await execute(`"${this.binaryPath}" install`)
	}

	async uninstall(force) {
		if (force === true) return execute(`reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Services\\${this.name}" /f`);
		// if (!this.exists) return console.log('Uninstall was skipped because process does not exist or could not be found.');

		await this.stop();
		await execute(`${escape(this.binaryPath)} uninstall`)
			.then(() => this.exists && setTimeout(() => this._unlinkSW(), 2e3))
			.catch(err => this.#handlePermissionError(err))
	}

	async start() {
		if (!this.exists) throw Error('The service "' + this.name + '" does not exist or could not be found.');
		return execute(`net start "${this.#exe}"`)
			.then(() => true)
			.catch(err => {
				if (err.code != 2) return this.logger.error(err.toString());
				if (err.message.indexOf('already been started') >= 0 && err.message.indexOf('service name is invalid') < 0)
					return this.logger.warn('An attempt to start the service failed because the service is already running. The process should be stopped before starting, or the restart method should be used.');
				if (err.message.indexOf('service name is invalid') < 0)
					return this.#handlePermissionError(err);
			})
	}

	async stop() {
		// Check if it's in tasklist before trying to stop if requires elevation
		// console.log(await exec('tasklist'))
		return execute('net stop "' + this.#exe + '"')
			.then(stdout => this.logger.info(stdout))
			.catch(err => {
				if (err.code != 2) return this.#handlePermissionError(err);
				this.logger.warn('An attempt to stop the service failed because the service is/was not running.')
			})
	}

	kill() {
		return execute(`taskkill /F /IM ${this.#exe}`)
	}

	async restart() {
		await this.stop();
		await this.start()
	}

	toXML() {
		const options = {
			allowServiceLogon: this.options.winsw.allowServiceLogon,
			binaryPath: this.binaryPath,
			name: this.displayName,
			description: this.description,
			env: this.options.winsw.env,
			id: this.name,
			nodeOptions: this.options.winsw.nodeOptions,
			logging: this.options.winsw.logging,
			logOnAs: this.logOnAs,
			logPath: this.options.logPath,
			script: this.options.wrap ? wrapper : this.script,
			stopParentFirst: this.options.winsw.stopParentFirst,
			stopTimeout: this.options.winsw.stopTimeout,
			workingDirectory: this.options.winsw.workingDirectory
		};

		if (this.options.wrap) {
			const args = {
				cwd: this.options.wrapper.workingDirectory || this.#dir,
				file: this.options.script,
				log: `${this.displayName || this.name} Wrapper`,
				grow: this.options.wrapper.commandArguments.grow,
				wait: this.options.wrapper.commandArguments.wait,
				maxrestarts: this.options.wrapper.maxRestarts ?? this.options.winsw.maxRestarts,
				abortonerror: this.options.wrapper.abortOnError,
				stopparentfirst: this.options.winsw.stopParentFirst
			};
			if (this.options.winsw.maxRetries != null)
				args.maxretries = this.options.winsw.maxRetries;
			if (this.options.execFlags != null)
				args.scriptoptions = this.options.execFlags;
			options.arguments = Object.entries(args)
				.filter(([, v]) => v != null && v !== false)
				.map(([key, val]) => `--${key}${val === true ? '' : `=${escape(val)}`}`);
		}

		return generateXml(options)
	}

	#handlePermissionError(error) {
		if (error.message.indexOf('Administrator access') >= 0 || error.message.indexOf('Access is denied') >= 0) {
			try { this.logger.error(PermError) } catch (e) { console.warn(PermError) }
		} else {
			try { this.logger.error(error.toString()) } catch (e) { console.warn(error.toString()) }
		}
	}
}