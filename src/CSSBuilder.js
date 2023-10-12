import {readFileSync} from 'fs';

let files = [];

let CSSBuilder = class {
	#path;
	#fileDir;
	#rules = [];

	constructor(path, source) {
		this.#path = path;
		this.#fileDir = path.replace(/\/[^\/]+$/, "/");
		this.#parse(source);
		//console.log('css:', source);
	}

	#parse(source) {
		let staticData = [];
		let cssSafety = source                                                        // TODO: use balanced regexp
			.replace(/\/\*(.*?)\*\//gm, '')
			.replace(/(['"])(.*?)\1/gm, function (_, _q, data) {				//save static data
				staticData.push(data);
				return '%@' + (staticData.length - 1) + '@%';
			});

		cssSafety.replace(/(.*?){((?:[^}{]+|{(?:[^}{]+|{[^}{]*})*})*)}/gi, (_, selector, rule) => {
			selector = selector.replace(/[\n\r]/ig, '');

			selector = selector.replace(/%@(\d+)@%/gm, (_, idx) => {			//restore static data
				return "'" + staticData[idx] + "'";
			});
			rule = rule.replace(/%@(\d+)@%/gm, (_, idx) => {					//restore static data
				return "'" + staticData[idx] + "'";
			});

			rule = rule.replace(/\t/g, '');
			//TODO: validate selector and rules !!!
			let ruleCfg = this.#searchFiles(selector, rule.trim());
			this.#rules.push(ruleCfg);
		});
		//console.log("[component:Component.cssParse]", rules);
	}

	#searchFiles(selector, rule) {
		const urlReg = /(^|;)\s*([a-zA-Z\-]+)\s*:\s*url\s*\((['"]?)(.*)\3\)\s*([^;]*)(;|$)/gm;

		rule = rule.replace(urlReg, (_, p1, property, p2, url, tail) => {
			if (url.match(/\.svg$/)) {
				return p1 + property + ":" + this.#fileContentGet(url);
			} else {
				return p1 + property + ": url(" + url + ");" + tail;
				/*
				const fileCfg = {
					selector: selector,
					property: property,
					url: url,
					tail: tail,
				};
				files.push(fileCfg);
				console.warn(fileCfg);
				return p1;
				 */
			}
		});

		return {selector: selector, rule: rule}
	}

	#fileContentGet(url) {
		let path = this.#fileDir + url;
		let fileContent = readFileSync(path, 'utf-8').replace(/[\r\n]+/gm, '').replace(/'/g, '"');
		return "url('data:image/svg+xml;utf8," + fileContent + "');";
	}

	build() {
		//console.log('rules:', this.#rules);
		//console.log('files:', files);

		return `
			const rules = ` + JSON.stringify(this.#rules) + `;
			let cssStyle;
			const css = {
				install:() => {
					cssStyle = document.createElement("style");
					document.head.appendChild(cssStyle);
					const cssStyleSheet = cssStyle.sheet;
					rules.forEach(ruleCfg => {
						//console.log('%cselector:', 'background:green;color:white;', ruleCfg.selector);
						//console.log('rule:', ruleCfg.rule);
						cssStyleSheet.addRule(ruleCfg.selector, ruleCfg.rule, 0);
					});
					//files.push.apply(files, data.files);
					//console.log('css installed [` + this.#path + `]:', rules);
				},
				remove:() => {
					if (cssStyle) {document.head.removeChild(cssStyle);}
				}
			};
			export default css;
		`
	}
}

export default CSSBuilder;