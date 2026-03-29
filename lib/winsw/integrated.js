import WinSW from "./winsw.js";

export default class IntegratedWinSW extends WinSW {
	constructor(options, client) {
		super(options);
		Object.defineProperty(this, 'client', { value: client || null, writable: true })
	}

	get _id() { return this.client.id || this.config.id }

	async createBinary() {
		await super.createBinary(...arguments);
		this.client.binaryPath = this.binaryPath
	}

	async unlinkBinary() {
		await super.unlinkBinary(...arguments);
		this.client.binaryPath = null
	}
}