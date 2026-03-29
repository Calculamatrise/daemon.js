import WinSW from "./winsw.js";

export default class IntegratedWinSW extends WinSW {
	constructor(options, client) {
		super(options);
		Object.defineProperty(this, 'client', { value: client || null, writable: true })
	}


	get _id() { return this.client.id || this.config.id }
}