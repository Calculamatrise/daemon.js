import { existsSync, readFileSync } from "fs";
import { constants, copyFile, mkdir, readdir, readFile, rmdir, unlink, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import WinSWConfig from "./config.js";
import { execute } from "../utils/exec.js";

const WINSW_EXE_PATH = resolve(import.meta.dirname, '../../bin/winsw.exe');
if (!existsSync(WINSW_EXE_PATH)) throw new ReferenceError(`WinSW executable not found at "${WINSW_EXE_PATH}"`);

const DAEMON_DIR_NAME = '.daemon';

export default class WinSW {
	config = new WinSWConfig();
	constructor(options) {
		Object.defineProperty(this, 'options', { value: options || {}, writable: true })
	}

	get #targetPathDir() {
		return dirname(this.config.arguments.at(-1))
	}

	get _id() { return this.config.id }
	_checkConfig(dir) {
		const configPath = join(dir, `${this._id}.xml`);
		if (!existsSync(configPath)) return;
		// this.config._parse(await readFile(configPath, 'utf-8'))
		this.config._parse(readFileSync(configPath, 'utf-8'))
	}

	_patch(info) {
		if (!info || !(info instanceof Object)) return;
		for (const key in info) {
			let value = info[key];
			if (value == null) continue;
			switch (key) {
			case 'binaryPath':
				if (extname(this.binaryPath) == '.exe') {
					this._checkConfig(dirname(this.binaryPath));
					break;
				}
			case 'installDir':
				if (!existsSync(value)) throw new ReferenceError(`Dir not found: "${value}"`);
				this.options.installDir = value;
				this._checkConfig();
				break;
			case 'targetPath':
				this.config._patch({ [key]: value });
				this._checkConfig(join(dirname(value), DAEMON_DIR_NAME))
			}
		}
	}

	async createBinary(recursive = false) {
		const dir = this.options.installDir || join(this.#targetPathDir, DAEMON_DIR_NAME)
			, binPath = join(dir, `${this._id}.exe`);
		if (!existsSync(dir)) await mkdir(dir, { recursive })
			.then(() => execute(`attrib +H "${dir}"`));

		if (!existsSync(binPath)) await createExe(binPath);
		this.binaryPath = binPath;

		const xmlPath = join(dir, `${this._id}.xml`);
		await writeFile(xmlPath, this.config.toXML())
	}

	async updateConfig() {
		const dir = this.options.installDir || join(this.#targetPathDir, DAEMON_DIR_NAME);
		if (!existsSync(dir)) await mkdir(dir, { recursive })
			.then(() => execute(`attrib +H "${dir}"`));

		const xmlPath = join(dir, `${this._id}.xml`);
		await writeFile(xmlPath, this.config.toXML())
	}

	async unlinkBinary() {
		const dir = this.options.installDir || dirname(this.binaryPath);
		if (!existsSync(dir)) return;
		const rm = async file => {
			const path = join(dir, file);
			if (existsSync(path))
				return unlink(path);
		};

		const remaining = await readdir(dir)
			, removeFiles = [];
		for (const i in remaining) {
			const base = remaining[i];
			if (!base.startsWith(this._id)) continue;
			switch (base) {
			case this._id + '.err.log':
			case this._id + '.exe':
			case this._id + '.exe.config':
			case this._id + '.out.log':
			case this._id + '.wrapper.log':
			case this._id + '.xml':
				removeFiles.push(base);
				remaining.splice(i, 1);
			}
		}

		await Promise.all(removeFiles.map(f => rm(f)));
		// this.binaryPath = null;
		if (remaining.length === 0) await rmdir(dir)
	}
}

function createExe(dest) {
	return copyFile(WINSW_EXE_PATH, dest, constants.COPYFILE_EXCL)
}