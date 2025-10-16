import { fork } from 'child_process';
import { existsSync } from "fs";
import { basename, dirname, extname, resolve } from "path";
import Logger from "./eventlog.js";

const Alias = {
	abortOnError: 'a',
	cwd: ['d', 'dir', 'wd', 'workingdir', 'workingdirectory'],
	eventLog: ['e', 'el'],
	file: 'f',
	flags: ['execflags', 'execoptions', 'scriptflags', 'scriptoptions'],
	grow: 'g',
	log: 'l',
	maxRestarts: ['r', 'restarts'],
	maxRetries: ['m', 'retries'],
	stopParentFirst: null,
	wait: 'w'
};
const LowerCaseConfigKeys = Object.entries(Alias).map(([key, value]) => {
	let opts = Array.isArray(value) ? value : typeof value == 'string' ? [value] : [];
	opts.push(key.toLowerCase());
	return [key, opts]
});

// Default settings
const config = {
	abortonerror: false,
	eventlog: 'APPLICATION',
	grow: .25,
	maxrestarts: 5,
	maxretries: -1,
	stopparentfirst: false,
	wait: 1
};

// Simple arg parser
const args = process.argv.slice(2)
	.filter(arg => arg.startsWith('--'))
	.map(arg => {
		const eqIdx = arg.indexOf('=');
		if (eqIdx === -1) return [arg.slice(2), 'y'];
		return [arg.slice(2, eqIdx), arg.slice(eqIdx + 1)]
	})
	.filter(([key]) => {
		const matchingEntry = -1 !== LowerCaseConfigKeys.findIndex(([, opts]) => opts.includes(key));
		if (!matchingEntry)
			console.warn(`${key} is not a valid wrapper argument`);
		return matchingEntry
	});
for (const [key, val] of args) {
	const [matchingKey] = LowerCaseConfigKeys.find(([, opts]) => opts.includes(key));
	switch (matchingKey.toLowerCase()) {
	case 'maxrestarts':
	case 'maxretries': config[matchingKey] = parseInt(val); break;
	case 'grow':
	case 'wait': config[matchingKey] = parseFloat(val); break;
	case 'abortonerror':
	case 'stopparentfirst': config[matchingKey] = val.toLowerCase().startsWith('y'); break;
	default: config[matchingKey] = val
	}
}

// Validate required
if (!config.file || !existsSync(resolve(config.file)))
	throw new Error(config.file + ' does not exist or cannot be found.');
if (!config.log)
	config.log = `${basename(config.file, extname(config.file))} Wrapper`;

// Final setup
const log = new Logger({ source: config.log, eventlog: config.eventlog })
	, script = resolve(config.file)
	, grow = config.grow + 1;
let wait = config.wait * 1e3
  , attempts = 0
  , startTime = null
  , starts = 0
  , child = null
  , forcekill = false;

config.file = resolve(config.file);
if (config.cwd) {
	if (!existsSync(resolve(config.cwd))) {
		console.warn(config.cwd + ' not found.');
		config.cwd = process.cwd();
	}
	config.cwd = resolve(config.cwd);
} else if (config.file) {
	config.cwd = dirname(config.file);
}

// Monitor function
function monitor() {
	if (!child || !child.pid) {
		if (starts >= config.maxrestarts) {
			if (new Date().getTime() - 6e4 <= startTime.getTime()) {
				log.error('Too many restarts within the last 60 seconds. Please check the script.');
				process.exit();
			}
		}

		setTimeout(() => {
			wait *= grow;
			attempts++;
			if (attempts > config.maxretries && config.maxretries >= 0) {
				log.error('Too many restarts. Will not restart.');
				process.exit();
			} else {
				launch('warn', `Restarted after ${wait} ms; attempts = ${attempts}`)
			}
		}, wait);
	} else {
		attempts = 0;
		wait = config.wait * 1e3
	}
}

// Launch process
function launch(level, msg) {
	if (forcekill) {
		log.info("Process killed");
		return;
	}
	if (level && msg) log[level](msg);
	if (!startTime) {
		startTime = new Date();
		setTimeout(() => {
			startTime = null;
			starts = 0;
		}, 60001);
	}
	starts++;

	const opts = { env: process.env };
	let args = [];
	if (config.cwd) opts.cwd = config.cwd;
	if (config.stopparentfirst) opts.detached = true;
	if (config.flags) args = config.flags.split(/\s(?=--)/);

	child = fork(script, args, opts);
	child.on('exit', code => {
		log.warn(`${config.file} stopped running.`);
		if (code !== 0 && config.abortonerror) {
			log.error(`${config.file} exited with error code ${code}`);
			process.exit();
		} else if (forcekill) {
			process.exit();
		}

		child = null;
		monitor()
	})
}

// Kill handler
function killkid() {
	forcekill = true;
	if (child) {
		if (config.stopparentfirst) {
			child.send('shutdown');
		} else {
			child.kill();
		}
	} else {
		log.warn('Attempted to kill an unrecognized process.')
	}
}

process.on('exit', killkid);
process.on('SIGINT', killkid);
process.on('SIGTERM', killkid);
process.on('uncaughtException', err => launch('warn', err.message));

// Start the script
launch('info', `Starting ${config.file}`);