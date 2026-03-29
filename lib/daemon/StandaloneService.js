import { exec as execCallback } from "child_process";
import { existsSync } from "fs";

import { AccountType, StartType, State } from "../utils/enum.js";

const escape = value => {
	if (typeof value !== 'string' || !/[\s"]/.test(value)) return value;
	return `"${value.replace(/(["\\])/g, '\\$1')}"`
};

const _exec = async cmd => {
	return new Promise((res, rej) => {
		execCallback(cmd, (err, stdout, stderr) => {
			if (err) return err.stderr = stderr || null, rej(err);
			res(stdout.trim())
		})
	})
};

const isElevated = async () => {
	return _exec('net session')
		.catch(err => {
			if (err.code === 2) return false;
			throw err
		})
	// return new Promise((res, rej) => {
	// 	execCallback('net session', (err, stdout, stderr) => {
	// 		if (err) {
	// 			if (err.code === 2) return false;
	// 			return rej(err);
	// 		}
	// 		res(true)
	// 	})
	// })
};

// const elevated = await isElevated();
const execElevated = async cmd => {
	// powershell "start cmd -v runAs"
	const psArgs = [
		'-NoProfile',
		'-Command',
		cmd
	].map(s => `'${s}'`).join(',');
	const ps = `Start-Process powershell -ArgumentList ${psArgs} -Verb RunAs`;
	return _exec(`powershell -Command "${ps}"`)
};

const exec = async cmd => {
	// if (!elevated) return execElevated(cmd);
	return _exec(cmd)
		.catch(err => {
			if (err.code === 5) return execElevated(cmd);
			throw err
		})
};

const execCommand = async (...params) => {
	if (params.length < 2)
		throw new Error('No parameters present');

	return exec(
		'sc ' + params
			.filter(param => param !== null && param !== undefined)
			.map(param => {
				if (typeof param === 'string') return param;
				if (typeof param !== 'object')
					throw new TypeError(`Invalid param type: expected string or object, got ${typeof param}`);

				const entries = typeof param.entries === 'function'
					? Array.from(param.entries())
					: Object.entries(param);

				return entries
					.map(([key, value]) => `${key}= ${escape(value)}`)
					.join(' ');
			})
			.join(' ')
	).catch(err => {
		if (err.code === 1060) return null;
		if (err.code === 5) throw new Error('Access denied');
		if (err.code === 1073) throw new Error('Service already exists');
		throw err
	})
};

export default class StandaloneService {
	accountType = null;
	delayed = null;
	dependencies = new Map();
	description = null;
	displayName = null;
	displayState = null;
	exitCode = null;
	installed = false;
	name = null;
	path = null;
	pid = null;
	startType = null;
	state = null;
	winExitCode = null;
	constructor(data) {
		this._patch(data)
	}

	get exists() {
		return existsSync(this.path)
	}

	_update(command, ...params) {
		if (!this.name) throw new Error('Service name is not defined');
		return execCommand(command, escape(this.name), ...params)
	}

	_patch(data) {
		if (!data || typeof data != 'object') return;
		for (const key in data) {
			switch (key) {
			case 'BINARY_PATH_NAME':
				this.path = data[key];
				break;
			case 'DEPENDENCIES':
				const dependencies = data[key]?.split(';');
				if (!dependencies || dependencies.length < 1) break;
				for (const dependency of dependencies)
					this.dependencies.set(dependency, new StandaloneService({ name: dependency }));
				break;
			case 'DESCRIPTION':
				this.description = data[key];
				break;
			case 'DISPLAY_NAME':
				this.displayName = data[key];
				break;
			case 'PID':
				this.pid = parseInt(data[key]) || null;
				break;
			case 'STATE':
				this.state = parseInt(data[key]);
				this.displayState = data[key].replace(/^\d+\s+/, '');
				break;
			case 'SERVICE_EXIT_CODE':
				this.exitCode = parseInt(data[key]);
				break;
			case 'SERVICE_NAME':
				this.name = data[key];
				this.installed = true;
				break;
			case 'SERVICE_START_NAME':
				this.accountType = data[key];
				break;
			case 'START_TYPE':
				this.startType = parseInt(data[key]) || null;
				this.delayed = data[key]?.includes('DELAYED');
				break;
			case 'WIN32_EXIT_CODE':
				this.winExitCode = parseInt(data[key]);
				break;
			default:
				if (!Object.hasOwn(this, key)) break;
				this[key] = data[key]
			}
		}
	}

	async configure(config) {
		await this.constructor.configure(this.name, config);
		this._patch(config);
		return this
	}

	async fetch(options) {
		this._patch(await this.constructor.query(this.name, options))
	}

	async install() {
		if (this.installed)
			throw new Error('Service is already installed');
		const entries = new Map();
		this.dependencies && entries.set('depend', Array.from(this.dependencies.keys()).join(';'));
		this.displayName && entries.set('DisplayName', this.displayName);
		this.path && entries.set('binPath', this.path);
		if (this.delayed) entries.set('start', 'delayed-auto');
		else if (this.startType) entries.set('start', this.startType || 'auto');
		const params = Array.from(entries.entries()).map(([key, value]) => `${key}= ${escape(value)}`).join(' ');
		return this._update('create', params)
			.then(() => this.installed = true)
	}

	async isDelayed() {
		if (this.delayed !== null) return this.delayed;
		if (!this.name) throw new Error('Service name is not defined');
		const cmd = `powershell -Command "(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\${this.name}').DelayedAutoStart"`;
		return exec(cmd)
			.then(result => this.delayed = result == 1)
			.catch(err => {
				if (err.stderr?.includes('DelayedAutoStart')) return false;
				throw err
			})
	}

	isRunning() {
		return this.state === State.Running
	}

	pause() {
		return this._update('pause')
	}

	async refresh() {
		const updated = await this.constructor.query(this.name);
		updated && this._patch(updated)
	}

	async restart() {
		await this.stop();
		await this.start()
	}

	resume() {
		return this._update('continue')
	}

	async setDescription(content) {
		return this._update('description', escape(content))
			.then(exists => {
				if (exists === null)
					throw new Error('Service is not installed');
				this.description = content;
				return true
			})
	}

	start() {
		if (this.state === State.Running || this.state === State.StartPending) return;
		return this._update('start')
			.catch(err => {
				if (err.code !== 1056) throw err;
				return this.state === State.Running
			})
	}

	stop() {
		if (this.state === State.Stopped || this.state === State.StopPending) return;
		return this._update('stop')
			.catch(err => {
				if (err.code !== 1062) throw err;
				return this.state === State.Stopped
			})
	}

	async uninstall() {
		await this.stop();
		await this._update('delete');
		return this.installed = false
	}

	async update(config) {
		if (config.accountType && !this.constructor.validateAccountType(config.accountType))
			throw new Error(`Invalid accountType: ${config.accountType}`);
		if (config.startType && !this.constructor.validateStartType(config.startType))
			throw new Error(`Invalid startType: ${config.startType}`);
		const entries = new Map();
		config.accountType && entries.set('obj', config.accountType);
		config.dependencies && entries.set('depend', config.dependencies.join(';'));
		config.displayName && entries.set('DisplayName', config.displayName);
		config.password && entries.set('password', config.password);
		config.path && entries.set('binPath', config.path);
		if (config.delayed) entries.set('start', 'delayed-auto');
		else if (config.startType) entries.set('start', config.startType);
		config.description && await this.setDescription(config.description);
		let requiresReload = Boolean(config.accountType || config.name);
		requiresReload && await this.uninstall();
		let params = Array.from(entries.entries()).map(([key, value]) => `${key}= ${escape(value)}`).join(' ');
		config.name && (params = escape(config.name) + (params.length > 0 ? ` ${params}` : ''));
		params.length > 0 && await this._update(requiresReload ? 'create' : 'config', params);
		this._patch(config);
		return this
	}

	toJSON() {
		return Object.assign({}, this)
	}

	toString() {
		const stateColor = this.isRunning() ? '\x1b[32m' : '\x1b[31m';
		const reset = '\x1b[0m';
		return `${this.name} — ${stateColor}${this.displayState || 'Unknown'}${reset} (PID: ${this.pid || 'N/A'})`
	}

	static async configure(name, config) {
		if (config.startType && !this.validateStartType(config.startType))
			throw new Error(`Invalid startType: ${config.startType}`);
		const entries = new Map();
		config.dependencies && entries.set('depend', config.dependencies.join(';'));
		config.displayName && entries.set('DisplayName', config.displayName);
		config.path && entries.set('binPath', config.path);
		if (config.delayed) entries.set('start', 'delayed-auto');
		else if (config.startType) entries.set('start', config.startType);
		await execCommand('config', escape(name), entries);
		return true
	}

	static async create({ accountType, delayed = false, displayName = null, name, path, startType = 'auto' }) {
		if (typeof arguments[0] == 'string') return this.create(Object.assign({}, arguments[1], { name: arguments[0] }));
		if (accountType && !this.validateAccountType(accountType))
			throw new Error(`Invalid accountType: ${config.accountType}`);
		if (startType && !this.validateStartType(startType))
			throw new Error(`Invalid startType: ${config.startType}`);
		const params = new Map();
		params.set('obj', accountType || AccountType.LocalService);
		displayName && params.set('DisplayName', displayName);
		path && params.set('binPath', path);
		if (delayed) params.set('start', 'delayed-auto');
		else params.set('start', startType);
		await execCommand('create', escape(name), params);
		return this.query(name)
	}

	static async delete(name) {
		const result = await execCommand('stop', `"${name}"`);
		if (result === null) return false;
		await execCommand('delete', `"${name}"`);
		return true
	}

	/**
	 * Check if a service exists
	 * @param {string} name
	 */
	static async exists(name) {
		const result = await execCommand('query', escape(name));
		return result !== null
	}

	static getLogs(name, limit = 10) {
		const command = `powershell -Command "Get-WinEvent -LogName System | Where-Object { $_.Message -like '*${name}*' } | Select-Object -First ${limit}"`;
		return exec(command)
	}

	/**
	 * Fetch a service
	 * @param {string} name
	 */
	static async query(name, { createIfNotExists } = {}) {
		const escaped = escape(name);
		const output = await execCommand('qc', `${escaped} & sc queryex ${escaped}`);
		if (!output) {
			if (!createIfNotExists) return null;
			return this.create({ name, ...arguments[1] });
		}

		const lines = output.split('\n').map(line => line.trim()).filter(Boolean);
		const info = {};
		for (const line of lines) {
			const match = line.match(/^([^:]+):\s*(.+)$/);
			if (match) {
				const key = match[1].trim();
				const value = match[2].trim();
				info[key] = value;
			}
		}

		return new this(info)
	}

	static validateAccountType(type) {
		return Object.values(AccountType).includes(type)
	}

	static validateStartType(type) {
		return Object.values(StartType).includes(type)
	}
}