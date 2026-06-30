import Daemon from "./daemon/Daemon.js";
import DaemonRegistry from "./registry.js";

export default class DaemonManager {
	static [Symbol.asyncIterator]() { return this.entries() }
	static async *entries() {
		for await (const info of DaemonRegistry) yield new Daemon(info)
	}

	static async get(id, state) {
		const info = await DaemonRegistry.get(id, state);
		return info ? new Daemon(info) : null
	}

	static async has(id) {
		return DaemonRegistry.isRegistered(id)
	}

	static async install() {
		const daemon = new Daemon(...arguments);
		await daemon.install()
	}

	static async kill(id) {
		const daemon = await this._ensureDaemon(id);
		await daemon.kill()
	}

	static async list() {
		const entries = [];
		for await (const daemon of this.entries())
			entries.push(daemon);
		return entries
	}

	static async restart(id) {
		const daemon = await this._ensureDaemon(id);
		await daemon.restart()
	}

	static async start(id) {
		const daemon = await this._ensureDaemon(id);
		await daemon.start()
	}

	static async stop(id) {
		const daemon = await this._ensureDaemon(id);
		await daemon.stop()
	}

	static async uninstall(id) {
		const daemon = await this._ensureDaemon(id);
		await daemon.uninstall()
	}

	static async update(id, info) {
		const daemon = await this._ensureDaemon(id);
		await daemon.update(info)
	}

	static async _ensureDaemon(id) {
		if (id instanceof Daemon) return id;
		const daemon = await this.get(id);
		if (!daemon) throw new ReferenceError(`Daemon "${id}" not found.`);
		return daemon
	}
}