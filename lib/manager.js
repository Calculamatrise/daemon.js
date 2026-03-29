import Daemon from "./daemon/Daemon.js";
import DaemonRegistry from "./registry.js";

export default class DaemonManager {
	static async *[Symbol.asyncIterator]() {
		for await (const info of DaemonRegistry) yield new Daemon(info)
	}

	static entries() {
		return this[Symbol.asyncIterator]()
	}

	static async get(name, state) {
		const info = await DaemonRegistry.get(name, state);
		return info && new Daemon(info)
	}

	static async has(name) {
		return DaemonRegistry.isRegistered(name)
	}

	static async install() {
		const daemon = await this.get(...arguments);
		await daemon.install()
	}

	static async kill(name) {
		const daemon = await this.get(name);
		await daemon.kill()
	}

	static async list() {
		return DaemonRegistry.getAll()
			.then(entries =>
				entries.map(entry => {
					const daemon = new Daemon(entry);
					return daemon
				})
			)
	}

	static async restart(name) {
		await this.stop(name);
		await this.start(name)
	}

	static async start(name) {
		const daemon = await this.get(name);
		await daemon.start()
	}

	static async stop(name) {
		const daemon = await this.get(name);
		await daemon.stop()
	}

	static async uninstall(name) {
		const daemon = await this.get(name);
		await daemon.uninstall()
	}
}