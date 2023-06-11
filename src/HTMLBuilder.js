import HTMLTree from "./HTMLTree.js";

const HTMLBuilder = class {
	#templates = {};

	constructor(path, source) {
		console.log('[HTMLBuilder] path:', path);
		this.#parse(source);
	}

	#parse(source) {
		source.replace(/<template name=\s*(['"])(.*?)\1[^>]*>([\S\s]+?)<\/template>/gm, (_a, _b, templateName, content) => {
			console.log('   - find templateName:', templateName);
			this.#templates[templateName] = new HTMLTree({templateContent: content});
		});
	}

	build() {
		const source =
			`import RP from '/srv/redpilule/src/index.js';` +
			Object.entries(this.#templates).map(([templateName, tree]) => {
			return `
				let ${templateName} = class extends RP {
					constructor(model, logic) {
						const tree = `+ JSON.stringify(tree) +`;
						super(tree, model, logic);
					}
				}
				customElements.define('x-` + templateName.toLowerCase()+ `', ${templateName});
			`;
		}).join('') + 'export {' + Object.keys(this.#templates).join(',') + '};';

		//console.warn('source:', source);
		return source;
	}
}

export default HTMLBuilder;
