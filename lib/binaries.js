import { exec } from 'child_process';
import { dirname, join } from 'path';
import { promisify } from 'util';
const execAsync = promisify(exec);

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url)
	, __dirname = dirname(__filename);

const bin = join(__dirname, '../bin');
export function elevate(cmd, ...options) {
	return execAsync(JSON.stringify(join(bin, 'elevate.cmd')) + ' ' + cmd, ...options)
}

export async function isAdminUser(callback) {
	const elevated = await isElevated();
	const res = await (elevated ? execAsync : elevate)('net session', { stdio: 'ignore' })
		.then(() => true)
		.catch(err => err.code === 1 || err.message.includes("Access is denied.") ? false : null);
	typeof callback == 'function' && callback(res);
	return res
}

export async function isElevated(callback) {
	const res = await execAsync('net session', { stdio: 'ignore' })
		.then(() => true)
		.catch(err => err.code === 1 || err.message.includes("Access is denied.") ? false : null);
	typeof callback == 'function' && callback(res);
	return res
}

export function kill(pid, force) {
	if (!pid) throw new Error('PID is required for the kill operation.');
	if (typeof isNaN(pid)) throw new Error('PID must be a number.');
	return execAsync("taskkill /PID " + pid + (force === true ? ' /f' : ''))
}

export * as default from "./binaries.js";