import { existsSync } from "fs";
import { resolve } from "path";
import { _exec, execute } from "../utils/exec.js";
import { StartType } from "../utils/enum.js";

const StartFlag = {
	Auto: 2,
	Manual: 3,
	Disabled: 4,
	/** @protected */
	Boot: 0,
	System: 1
};

const StartFlagDict = {
	[StartFlag.Boot]: 'Boot',
	[StartFlag.System]: 'System',
	[StartFlag.Auto]: 'Auto',
	[StartFlag.Manual]: 'Manual',
	[StartFlag.Disabled]: 'Disabled'
};

const sanitizeCmdComponent = value => {
	if (typeof value !== 'string' || !/[\s"]/.test(value)) return value;
	return `"${value.replace(/(["\\])/g, '\\$1')}"`
};

let elevatePath = resolve(import.meta.dirname, '../../bin/cmd+.exe');
if (!existsSync(elevatePath)) throw new ReferenceError(`Elevate module not found at "${elevatePath}"`);
elevatePath = sanitizeCmdComponent(elevatePath);

class WindowsSubsystemError extends Error {
	exitCode = 0;
	constructor(message, opts) {
		super(message, opts);
		this.exitCode = (opts?.exitCode ?? opts?.code ?? this.exitCode) | 0
	}
}

const SERVICE_CONTROL_ERROR_REGEX = /(?<=FAILED )(\d+)(?=:)/;
class ServiceControlError extends WindowsSubsystemError {
	static test(str) {
		if (!str || str.length < 7 /* || !str.startsWith('[SC]') */) return null;
		return str.match(SERVICE_CONTROL_ERROR_REGEX)
	}

	code = 0;
	stderr = null;
	constructor(message, opts, err) {
		super(message, err);
		this.code = (opts?.code ?? this.code) | 0;
		this.stderr = opts?.stderr ?? null
	}
}

class UACElevationError extends WindowsSubsystemError {}

export default class WindowsServiceAdapter {
	static async elevate(c) {
		if (c.includes('&') || c.includes('||')) c = `"${c}"`;
		return _exec(`${elevatePath} ${c}`)
			.catch(err => {
				if (err.code !== 199 && err.code !== 1223) throw err;
				throw new UACElevationError('User denied elevation request', err)
			})
	}

	static [Symbol.asyncIterator]() { return this.entries() }
	static async *entries(opts = {}) {
		if (typeof opts == 'string') opts = { group: opts };
		const rows = await this.query(null, opts?.extended != false, opts)
			// .then(raw => raw.trim())
			.then(raw => raw.length > 0 && raw.split(/[\r\n]+(?=service_name:)/gi));
		if (!rows) return;
		for (const raw of rows) yield _parseServiceInfo(raw)
	}

	static normalizeName(name) {
		if (typeof name != 'string') {
			if (typeof name != 'number') throw new TypeError('Daemon name must be a string');
			name = String(name);
		}
		return name.replace(/[^A-Za-z0-9_.-]+/g, '')
			.trim()
			.slice(0, 256)
	}

	static async restart(name, wait = true) {
		const cmd = wait ? 'net' : 'sc';
		const safeName = sanitizeCmdComponent(name);
		// Ignore stop result: >nul 2>&1 &
		return this._net(`stop ${safeName} & ${cmd} start ${safeName}`)
			.catch(err => {
				if (err.code !== 1062 && !err.stderr?.includes('HELPMSG 3521.')) throw err;
				return err.stdout || err.stderr
			})
	}

	static async start(name, wait = true) {
		return this['_' + (wait ? 'net' : 'sc')]('start', sanitizeCmdComponent(name))
			.catch(err => {
				if (err.code !== 1056 && !err.stderr?.includes('HELPMSG 2182.')) throw err;
				return err.stdout || err.stderr
			})
	}

	static async stop(name, wait = true) {
		return this['_' + (wait ? 'net' : 'sc')]('stop', sanitizeCmdComponent(name))
			.catch(err => {
				if (err.code !== 1062 && !err.stderr?.includes('HELPMSG 3521.')) throw err;
				return err.stdout || err.stderr
			})
	}

	static async terminate(pid) {
		return execute(`taskkill /F /PID ${pid}`)
	}

	static async get(name, state = true) {
		const safeName = sanitizeCmdComponent(name);
		const raw = await this._sc(`qc ${safeName}${state ? ` && sc queryex ${safeName}` : ''}`)
			.catch(err => {
				if (err.code == 1060) return null;
				throw err
			});
		return _parseServiceInfo(raw)
	}

	static async query(name = null, extended = true, opts = {}) {
		let cmd = 'query';
		if (extended) cmd += 'ex';
		if (name?.length > 0) cmd += ` ${sanitizeCmdComponent(name)}`;
		if (typeof opts == 'object' && opts != null) {
			const paramsString = formatParams({
				bufsize: opts.bufferSize,
				group: opts.group,
				ri: opts.resumeIndex,
				state: opts.state,
				type: opts.type
			});
			if (paramsString.length > 0) cmd += ` ${paramsString}`;
		}
		return this._sc(cmd)
	}

	static async create(name, binary, info = null, password = null) {
		let paramsString = typeof info == 'object' ? formatParams(infoToCParamObj(info, password)) : '';
		if (info.description) params += ` && sc description ${sanitizeCmdComponent(id)} ${sanitizeCmdComponent(info.description)}`;
		return this._sc('create', sanitizeCmdComponent(this.normalizeName(name)), `binPath= ${sanitizeCmdComponent(binary)}`, paramsString)
	}

	static async config(name, info, password = null) {
		let paramsString = typeof info == 'object' ? formatParams(Object.assign(infoToCParamObj(info, password), { binPath: info.binaryPath })) : '';
		let cmd = paramsString?.length > 0 ? `config ${name} ${paramsString}` : '';
		if (info.description) cmd += ` ${cmd ? ' && sc ' : ''}description ${sanitizeCmdComponent(id)} ${sanitizeCmdComponent(info.description)}`;
		return this._sc(cmd)
	}

	static async delete(name, { force = false, isRunning = false, purge = false } = {}) {
		const safeName = sanitizeCmdComponent(name);
		let cmd = `sc delete ${safeName}`;
		// if (isRunning == null) // query state
		// if (force) // taskkill
		if (isRunning) cmd = `net stop ${safeName} && ${cmd}`;
		if (purge) cmd += ` && reg delete ${sanitizeCmdComponent(`HKLM\\SYSTEM\\CurrentControlSet\\Services\\${name}`)} /f`;
		return execute(cmd)
	}

	static async _sc(...args) {
		return execute(`sc ${args.join(' ')}`)
			.then(text => {
				const match = ServiceControlError.test(text);
				if (!match) return text;
				throw { stderr: text }
			})
			.catch(err => {
				const text = err.stdout || err.stderr;
				const match = ServiceControlError.test(text);
				if (!match) throw err;
				const lines = text.split(/\r?\n/).slice(1).filter(l => l.length > 0);
				throw new ServiceControlError('A service control error occurred!', { code: match[0], stderr: lines[0] }, err)
			})
	}

	static async _net(...args) {
		return execute(`net ${args.join(' ')}`)
	}
}

function formatParams(data) {
	return Object.entries(data)
		.filter(([, v]) => v != null)
		.map(([k, v]) => `${k}= ${sanitizeCmdComponent(v)}`)
		.join(' ')
}

function infoToCParamObj(info, password = null) {
	if (!info) return { password };
	return {
		depend: info.dependencies?.size > 0 ? Array.prototype.join.call(info.dependencies, '/') : null,
		error: info.errorLevel,
		group: info.group,
		obj: info.logOnAs?.account,
		password: password ?? info.logOnAs?.password,
		start: info.startType,
		tag: info.tag,
		type: info.type,
		DisplayName: info.displayName
	}
}

function _parseServiceInfo(raw) {
	if (typeof raw != 'string' || raw.length == 0) return null;
	const lines = raw.split(/\s*[\n\r]+\s*/)
		.filter(l => l.includes(':'))
		.reduce((entries, line) => {
			let [key, ...rest] = line.split(/\s*:\s*/)
				, value = rest.join(':')
			key = key.toLowerCase();
			if (key.includes('_')) key = key.replace(/_(\w)/g, (_, c) => c.toUpperCase());
			if (value.length === 0) value = null;
			else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
			else {
				let float = parseFloat(value);
				if (key == 'startType') {
					const delayed = value.includes('(DELAYED)');
					value = StartType[(float == StartFlag.Auto && delayed) ? 'DelayedAuto' : StartFlagDict[float]];
				} else if (isFinite(float)) {
					value = float;
				}
			}

			entries.push([key, value]);
			return entries
		}, []);
	return Object.fromEntries(lines)
}