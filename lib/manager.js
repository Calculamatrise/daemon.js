const PermError = 'Permission Denied. Requires administrative privileges.';

const escape = value => {
	if (typeof value !== 'string' || !/[\s"]/.test(value)) return value;
	return `"${value.replace(/(["\\])/g, '\\$1')}"`
};

class DaemonManager {
	async start(exe) {
		if (this.name === null) throw new TypeError("A name for the service is required.");
		if (!this.exists) throw Error(`The service "${this.name}" does not exist or could not be found.`);
		return execute(`net start "${exe}"`)
			.catch(err => {
				if (err.code == 2) {
					if (err.message.indexOf('already been started') >= 0 && err.message.indexOf('service name is invalid') < 0) {
						this.log.warn('An attempt to start the service failed because the service is already running. The process should be stopped before starting, or the restart method should be used.');
						this.emit('error', err);
						return;
					} else if (err.message.indexOf('service name is invalid') < 0) {
						this.#handlePermissionError(err);
						console.log(err);
						this.emit('error', err);
						return;
					}
				} else {
					this.log.error(err.toString());
				}
			})
	}

	async stop(exe) {
		// Check if it's in tasklist before trying to stop if requires elevation
		// console.log(await exec('tasklist'))
		return execute(`net stop ${escape(exe)}`)
			.then(stdout => this.log.info(stdout))
			.catch(err => {
				if (err.code != 2) return this.#handlePermissionError(err);
				this.log.warn('An attempt to stop the service failed because the service is/was not running.')
			})
	}

	kill(exe) {
		return execute(`taskkill /F /IM ${escape(exe)}`)
	}

	async restart(name) {
		await this.stop();
		await this.start()
	}

	#handlePermissionError(error) {
		if (error.message.indexOf('Administrator access') >= 0 || error.message.indexOf('Access is denied') >= 0) {
			try { this.log.error(PermError) } catch (e) { console.warn(PermError) }
		} else {
			try { this.log.error(error.toString()) } catch (e) { console.warn(error.toString()) }
		}
	}
}

const manager = new DaemonManager();
export default manager;