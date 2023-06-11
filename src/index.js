import {readFileSync} from 'fs';
import {extname} from 'path';

import HTMLBuilder from "./HTMLBuilder.js";
import CSSBuilder from "./CSSBuilder.js";
import GLSLBuilder from "./GLSLBuilder.js";



export default function build() {
	let importedFiles = {};				// {filePath: [templateName, ...]}

	return {
		name: 'rp',

		load(path) {
			const ext = extname(path);
			//console.log('path:', path, 'ext:', ext);
			if (ext === '.html') {
				if (!importedFiles[path]) {			// Если файл еще не парсили, то засовываем его в ресурсы
					let source = readFileSync(path, 'utf-8').replace(/[\r\n]+/gm, '');
					importedFiles[path] = (new HTMLBuilder(path, source)).build();
				}
				return importedFiles[path];

			} else if (ext ==='.css') {
				if (!importedFiles[path]) {			// Если файл еще не парсили, то засовываем его в ресурсы
					let source = readFileSync(path, 'utf-8').replace(/[\r\n]+/gm, '');
					importedFiles[path] = (new CSSBuilder(path, source)).build();
				}
				return importedFiles[path];
			} else if (ext === '.glsl') {
				if (!importedFiles[path]) {			// Если файл еще не парсили, то засовываем его в ресурсы
					let source = readFileSync(path, 'utf-8').replace(/[\r\n]+/gm, '');
					importedFiles[path] = (new GLSLBuilder(path, source)).build();
				}
				return importedFiles[path];
			}
		}
	};
};
