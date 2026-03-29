import { normalizeName } from './daemon/Daemon.js';
import DaemonInfo from './daemon/DaemonInfo.js';
import { execute } from "./utils/exec.js";
import { escape } from "./utils/utils.js";

export default class DaemonRegistry {
	static _exec(...args) {
		return execute(`sc ${args.join(' ')}`)
	}

	static async get(name, state = true) {
		let query = escape(normalizeName(name));
		if (state) query += ` & sc queryex ${query}`;
		return DaemonRegistry._exec(`qc ${query}`)
			.then(DaemonInfo.from)
			.catch(err => {
				if (err.code != 1060) throw err;
				return null
			})
	}

	static async getAll() {
		const rows = await execute('sc query')
			.then(raw => raw.split(/\r?\n(?=service_name:)/gi));
		return (rows || []).map(DaemonInfo.from)
	}

	static async isRegistered(name) {
		try {
			const out = await DaemonRegistry._exec(`query ${escape(normalizeName(name))}`);
			return out.includes('SERVICE_NAME');
		} catch {
			return false
		}
	}

	static async unregister(name) {
		const svcName = escape(normalizeName(name));
		const exists = await DaemonRegistry.isRegistered(svcName);
		if (!exists) return false;
		await DaemonRegistry._exec('delete', svcName);
		return true
	}

	static [Symbol.asyncIterator]() { return this.entries() }
	static async *entries(verbatim = false) {
		const rows = await execute('sc queryex')
			.then(raw => raw.split(/[\r\n]+(?=service_name:)/gi));
		for (const raw of rows) {
			try {
				const info = DaemonInfo.from(raw);
				if (verbatim) {
					const qcRaw = await execute(`sc qc ${info.id}`);
					info._patch(qcRaw);
				}

				yield info;
			} catch (err) {
				console.warn(`Failed to patch ${raw}:`, err)
			}
		}
	}
}