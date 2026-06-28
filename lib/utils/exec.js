import { exec as _execCallback } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';
import { escape } from './utils.js';

let elevatePath = resolve(import.meta.dirname, '../../bin/cmd+.exe');
if (!existsSync(elevatePath)) throw new ReferenceError(`Elevate module not found at "${elevatePath}"`);
elevatePath = escape(elevatePath);

const __exec = promisify(_execCallback);
const _exec = async c => {
	return __exec(c)
		.then(({ stderr, stdout }) => {
			if (stderr) throw new Error(stderr);
			return stdout.trim()
		})
};

const _elevate = async (cmd, ...args) => {
	if (cmd.includes('&')) cmd = `"${cmd}"`;
	return _exec(`${elevatePath} ${cmd}`, ...args)
};

export async function execute(cmd, elevate = false) {
	return (elevate ? _elevate : _exec)(cmd)
		.catch(err => {
			const msg = err.stderr || err.stdout;
			if (err.code === 5 || err.code === 740 || (msg || err.message).includes('Access is denied.')) return _elevate(cmd);
			// if (err.stdout) return err.stdout;
			if (msg) err.message = msg;
			throw err
		})
}