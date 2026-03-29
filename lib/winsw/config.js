import { execSync } from "child_process";
import { basename, dirname, extname } from "path";

function getSystemNodePath() {
	const execPath = process.execPath;
	if (basename(execPath) === 'node.exe') return execPath;
	try {
		return execSync('where node', { encoding: 'utf8' }).trim()
	} catch {
		return null
	}
}

export default class WinSWConfig {
	// Required
	id = null;
	executable = null;
	// Optional
	arguments = [];
	serviceAccount = {
		username: 'NT AUTHORITY\\Local Service'
	};
	workingDirectory = null;
	_parse(str) {
		WinSWConfig.parse(str, this)
	}

	_patch(data) {
		if (!data || typeof data != 'object') return;
		for (const key in data) {
			switch (key) {
			case 'arguments':
				this.arguments.push(...data[key]);
				break;
			case 'execPath':
				if (extname(data[key]) !== '.exe') throw new TypeError('Executable binary must be of type: .exe');
				this.executable = data[key];
				break;
			case 'targetPath':
				this.arguments.splice(0, this.arguments.length, '--harmony', data[key]);
				break;
			case 'workingDirectory':
				this.workingDirectory = data[key]
			}
		}
	}

	toXML() {
		let str = '<service>';
		for (const i in this) {
			let item = this[i];
			switch (i) {
			case 'executable':
				if (typeof item == 'string') break;
				item = process.execPath;
				if (!item.includes('node')) {
					item = getSystemNodePath();
				}
			// 	break;
			// case 'workingDirectory':
			// 	if (typeof item == 'string') break;
			// 	item = dirname(this.arguments.at(-1));
			}

			if (item == null) continue;
			switch (i) {
			case 'arguments':
				// if (typeof item == 'string') break;
				item = item.join(' ');
			}

			if (typeof item == 'object') {
				let formatted = '';
				for (const i in item) {
					const tag = i.toLowerCase();
					formatted += `\n\t\t<${tag}>${item[i]}</${tag}>`;
				}
				item = formatted + '\n\t';
			}

			const tag = i.toLowerCase();
			str += `\n\t<${tag}>${item}</${tag}>`;
		}
		return str + '\n</service>'
	}

	toString() {
		return this.toXML()
	}

	static parse(str, obj = null) {
		const svc = obj || new WinSWConfig();
		const lines = str
			.trim()
			.split(/(?<=\>)(?:(?:[\r\n]+)[\s\t]*)?(?=\<)/g);

		const stack = [];
		let current = svc;
		let skipNextPush = false; // flag to skip pushing <service> itself

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || /^<\?/.test(trimmed) || /^<!--/.test(trimmed)) continue;

			const selfCloseMatch = trimmed.match(/^<([\w:-]+)([^>]*)\/>$/);
			if (selfCloseMatch) {
				let [, tag, rawAttrs] = selfCloseMatch;
				tag = normalizeTag(current, tag);
				if (tag === 'service') continue; // skip root
				// current[tag] = current[tag] != null
				// 	? [...((Array.isArray(current[tag]) && !(current[tag] instanceof XMLComponent)) ? current[tag] : [current[tag]])]
				// 	: null;
				// const component = new XMLComponent(tag, parseAttributes(rawAttrs));
				// if (current === svc && current[tag] == null) current[tag] = component;
				// else current[tag].push(component);
				if (!Object.hasOwn(current, tag)) continue;
				current[tag] = rawAttrs;
				continue;
			}

			// Full tag with content: <tag attr="val">value</tag>
			let fullTagMatch = trimmed.match(/^<([\w:-]+)([^>]*)>([^<]*)<\/\1>$/);
			if (fullTagMatch) {
				let [, tag, rawAttrs, content] = fullTagMatch;
				tag = normalizeTag(current, tag);
				if (tag === 'service') continue; // skip root
				if (!Object.hasOwn(current, tag)) continue;
				switch (tag.toLowerCase()) {
				case 'arguments':
					current[tag].splice(0, current[tag].length, ...content.trim().split(/\s+/g));
					continue;
				}

				current[tag] = content.trim();
				continue;
			}

			// Opening tag: <tag attr="val">
			let openMatch = trimmed.match(/^<([\w:-]+)([^>]*)>$/);
			if (openMatch) {
				let [, tag, rawAttrs] = openMatch;
				tag = normalizeTag(current, tag);
				if (tag === 'service') {
					skipNextPush = true; // root opening, don't push
					continue;
				}
				if (!Object.hasOwn(current, tag)) continue;
				const component = svc[tag] || {};
				current[tag] = component;
				if (!skipNextPush) stack.push(current);
				current = component;
				skipNextPush = false;
				continue;
			}

			// Closing tag: </tag>
			let closeMatch = trimmed.match(/^<\/([\w:-]+)>$/);
			if (closeMatch) {
				if (closeMatch[1] === 'service') continue; // skip root
				current = stack.pop() || svc;
				continue;
			}
		}

		return svc
	}
}

function parseAttributes(raw) {
	const obj = {};
	for (const [, key, value] of raw.matchAll(/([\w:-]+)="([^"]*)"/g)) {
		obj[key] = value;
	}
	return obj
}

function normalizeTag(target, tag) {
	const tags = Object.getOwnPropertyNames(target);
	const correspondingTag = tags.find(t => t.toLowerCase() === tag.toLowerCase());
	return correspondingTag || tag
}