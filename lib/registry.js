import OSAdapter from './adapters/index.js';
import DaemonInfo from './daemon/DaemonInfo.js';

export default class DaemonRegistry {
	static [Symbol.asyncIterator]() { return this.entries() }
	static async *entries(options) {
		for await (const raw of OSAdapter.entries(options))
			yield new DaemonInfo(raw)
	}

	static async config(id, info) {
		if (typeof info != 'object' || info == null)
			throw new TypeError('Second positional argument: "info" must be of type: object');
		await OSAdapter.config(id, info)
	}

	static async get(id, state = true) {
		const info = await OSAdapter.get(id, state);
		return info ? new DaemonInfo(info) : null
	}

	static async isRegistered(id) {
		try {
			const out = await OSAdapter.query(id);
			return out.includes('SERVICE_NAME');
		} catch {
			return false
		}
	}

	static async register(id, binary, info, ...args) {
		await OSAdapter.create(id, binary, info, ...args)
	}

	static async unregister(id, opts = {}) {
		const skipCheck = typeof opts == 'boolean' ? opts : opts?.skipCheck;
		if (!skipCheck) {
			const exists = await DaemonRegistry.isRegistered(id);
			if (!exists) return false;
		}

		await OSAdapter.delete(id, opts);
		return skipCheck ? null : true
	}
}