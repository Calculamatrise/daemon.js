import { exec as __exec } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';
const _exec = promisify(__exec);
import { escape } from './utils.js';

const elevateCmdPath = resolve(import.meta.dirname, '../../bin/elevate.cmd');
if (!existsSync(elevateCmdPath)) throw new ReferenceError(`Elevate module not found at "${elevateCmdPath}"`);

const ELEVATE_CMD_PATH = escape(elevateCmdPath);
const elevate = (cmd, ...options) => {
	if (cmd.includes('&')) cmd = `cmd /c "${cmd}"`;
	return _exec(`${ELEVATE_CMD_PATH} ${cmd}`, ...options)
};

export async function execute(cmd, callback) {
	return _exec(cmd, callback)
		.then(({ stderr, stdout }) => {
			if (stderr) throw new Error(stderr);
			return stdout.trim()
		})
		.catch(err => {
			if (err.code === 1 || err.code === 5 || err.message.includes('Access is denied.') ||
			err.message.includes('Administrator privileges') ||
			err.code === 'EPERM') return elevate(cmd, callback);
			throw err
		})
}