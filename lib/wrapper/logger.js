import { execute } from "../utils/exec.js";

export default class EventLogger {
	static EventLogs = {
		Application: 'APPLICATION',
		System: 'SYSTEM'
	};
	static EventTypes = {
		AuditFailure: 'FAILUREAUDIT',
		AuditSuccess: 'SUCCESSAUDIT',
		Error: 'ERROR',
		Information: 'INFORMATION',
		Warning: 'WARNING'
	};

	name = 'APPLICATION';
	source = 'Node.js';

	get eventLog() { return this.name }
	set eventLog(value) {
		this.name = Object.values(this.constructor.EventLogs).includes(value.toUpperCase()) ? value.toUpperCase() : 'APPLICATION'
	}

	constructor(config = {}) {
		if (typeof config == 'string') {
			this.name = config;
		} else {
			for (const key in config) {
				const value = config[key];
				if (value == null) continue;
				switch (key.toLowerCase()) {
				case 'eventlog':
				case 'name': this.name = value; break;
				default: if (Object.hasOwn(this, key)) this[key] = value
				}
			}
		}
	}

	async _write(msg, { id, log, src, type } = {}) {
		if (msg == null || msg.trim().length == 0) return;
		msg = msg.replaceAll(/\r|\n/g, "\f");
		if (msg.length > 30000)
			msg = msg.slice(0, 29997) + '…';
		log = (typeof log === 'string' && Object.values(this.constructor.EventLogs).includes(log.toUpperCase()))
			? log.toUpperCase()
			: this.eventLog;
		type = (typeof type === 'string' && Object.values(this.constructor.EventTypes).includes(type.toUpperCase()))
			? type.toUpperCase()
			: this.constructor.EventTypes.Information;
		id = typeof id == 'number' ? (id > 0 ? id : 1000) : 1000;
		src = (src || this.source || 'Unknown Application').trim();
		const cmd = `eventcreate /L ${log} /T ${type} /SO "${src}" /D "${msg}" /ID ${id}`;
		return execute(cmd)
	}

	write(...data) {
		let options = null
		  , _opts = data.at(-1);
		if (_opts instanceof Object && (Object.hasOwn(_opts, 'id') || Object.hasOwn(_opts, 'log') || Object.hasOwn(_opts, 'src') || Object.hasOwn(_opts, 'type')))
			options = data.pop();
		return this._write(data.join(' '), options)
	}

	info(...data) {
		return this.write(...data, { type: this.constructor.EventTypes.Information })
	}

	warn(...data) {
		return this.write(...data, { type: this.constructor.EventTypes.Warning })
	}

	error(...data) {
		return this.write(...data, { type: this.constructor.EventTypes.Error })
	}

	auditSuccess(...data) {
		return this.write(...data, { type: this.constructor.EventTypes.AuditSuccess })
	}

	auditFailure(...data) {
		return this.write(...data, { type: this.constructor.EventTypes.AuditFailure })
	}
}