import { exec as __exec } from 'child_process';
import { promisify } from 'util';
const _exec = promisify(__exec);
import { execute } from "./exec.js";
import EventLogger from './eventlog.js';
import Daemon from './daemon.js';

const PermError = 'Permission Denied. Requires administrative privileges.';

const escape = value => {
	if (typeof value !== 'string' || !/[\s"]/.test(value)) return value;
	return `"${value.replace(/(["\\])/g, '\\$1')}"`
};

class DaemonRegistry {
	cache = new Map;
	defaultOptions = {
		abortOnError: false,
		commandArguments: {
			grow: .25,
			wait: 1
		},
		description: null,
		dir: null,
		env: null,
		execFlags: null,
		execPath: null,
		logOnAs: {
			account: null,
			domain: process.env.COMPUTERNAME,
			mungeCredentialsAfterInstall: true,
			password: null
		},
		name: null,
		script: null,
		useWrapper: true,
		defaultWinswOptions: {
			allowServiceLogon: null,
			logging: null,
			logMode: 'rotate',
			logPath: null,
			maxRestarts: 3,
			maxRetries: null,
			nodeOptions: '--harmony',
			stopParentFirst: null,
			stopTimeout: 30,
			workingDirectory: null
		}
	};
	log = new EventLogger(this.constructor.name);

	async create(name, config) {
		const daemon = new Daemon(Object.assign({ displayName: name }, config, { name }));
		await daemon._createSW();
		return daemon
	}

	async has(name) {
		return execute(`sc query ${escape(name)}`)
			.then(() => true)
			.catch(err => {
				if (err.code != 1060) throw err;
				return false
			})
	}

	async get(name) {
		const info = await execute(`sc qc ${escape(name)}`)
			.then(raw => {
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
			})
			.catch(err => {
				if (err.code != 1060) throw err;
				return null
			});
		return info && new Daemon(info)
	}

	async register() {
		const daemon = await this.create(...arguments);
		await daemon.install();
		return daemon
	}

	async isRegistered(name) {
		try {
			const { stdout } = await _exec(`sc query ${escape(name)}`);
			return stdout.includes('SERVICE_NAME');
		} catch {
			return false
		}
	}

	async unregister(name, force) {
		const daemon = await this.get(name);
		daemon && await daemon.uninstall(force);
		// return daemon
	}
}

const registry = new DaemonRegistry();
export default registry;