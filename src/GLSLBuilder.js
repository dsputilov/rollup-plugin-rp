const GLSLBuilder = class {
	#source;

	constructor(path, source) {
		console.log('[GLSLBuilder] path:', path);
		this.#source = source;
	}

	build() {
		return 'const code = `' + this.#source + '`; export default code;';
	}
}

export default GLSLBuilder;
