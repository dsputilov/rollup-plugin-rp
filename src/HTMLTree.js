/**
 * @description Возвращает скомпилированный html шаблон
 */

let uid = (() => {
	let id = 0;
	return () => {
		id++;
		return id;
	};
})();

let modelRefProps = {
	m: {observed: true},
	model: {observed: true}
};

let modelRefAlias = {
	model: "m",
	storage: "s"
}

let modelRefsObserved = Object.keys(modelRefProps).filter(function (propName) {
	return modelRefProps[propName].observed === true;
});
let modelRefsObservedReg = new RegExp('(' + modelRefsObserved.join('|') + ')(\\.|$)([\\w\\.]+)?', 'gm');
//var modelLinkObservedReg = new RegExp('^(' + modelRefsObserved.join('|') +")(\\.|$)([\\w\\.]+)?$");
let bindMethods = {
	onclick: 1,
	onkeydown: 1,
	onkeypress: 1,
	ondblclick: 1,
	onmousedown: 1,
	onmouseover: 1,
	onmousemove: 1,
	onmouseleave: 1,
	onmouseout: 1,
	ondragstart: 1,
	ondrag: 1,
	ondragstop: 1,
	onclickout: 1,
	oncontextmenu: 1
};

const HTMLTree = class {
	vDom = {
		tree: []				//
		//		[
		//			{
		//				type:enum(slot, tag, textNode, splitNode, value, event)
		//				valueInRender: fn,
		//				valueOutRender: fn,
		//				attrs: {}			//[при type=tag]
		//				slotName:	string	//[при type=slot]
		//				childNodes: []
		//			}
		//		]
		//nodeHandlers: {},		// {placeId: {valueInRender: fn, valueOutRender: fn} }
		//placesPaths: {},		// {placeId: ".childNodes[1].childNodes[0]"}

		//model: {},			// 'expression': [ fn() ]		modelPath: {  }
		//io: [],				// IO
		//fn: [],				// onclick, onmouseover, onsubmit etc..
		//extTag: [],			// tagExtension
		//extAttr: []			// attrExtension
	};
	#selfClosedTags = {
		br: true,
		hr: true,
		img: true,
		input: true
	};

	/**
	 * @constructor
	 * @param args                    {object}
	 * @param args.templateContent    {String}   // "<div>hello</div>"
	 * @return obj {object}
	 *         obj.vDom
	 *         obj.vDom.tree:             []
	 */
	constructor(args) {
		this.vDom.tree = this.#compile(args.templateContent);
	}

	#compile(html) {
		let domTree = [];						// Итоговый дом
		let domNode = domTree;
		let activeChain = [];					// Цепочка вложенных тегов до текущего domNode
		//var activeChainPaths = [];              // Цепочка номеров нод до текущего domNode (join в момент даст путь до ноды)
		let activeChainLn;						// Кол-во элементов в цепи
		let error = null;
		let slotNames = {};			//Имена слотов, чтобы проверить что они не повторяются

		html = html.replace(/<!--([\s\S]*)-->/gm, '');
		html = html.replace(/[\n\r]/g, '\t');		//Переносы заменяем на табы, чтобы сохранить отступы между словами
		html = html.replace(/\t*/gm, '');
		//console.log('   - template compile:', html);

		let parse = () => {
			let beginPos, endPos;			// < и >
			let tagCfg;
			let i, j;
			let htmlLn, char, nextChar;
			let text, textParts;
			let closingCheck, placeNum;

			//console.warn(html);
			if (!html) {
				return;
			}
			beginPos = html.indexOf('<');
			if (beginPos > 0) {											// Если перед тегом - текст, вырезаем его в ноду
				text = html.substring(0, beginPos);
				html = html.substring(beginPos);

				textParts = this.querySplit(text);
				//console.log('[app: template] parts:', textParts);
				textParts.forEach(function (part) {
					if (part.modelDepends) {							//Если в тексте найдено выражение
						placeNum = uid();
						domNode.push({
							type: 'splitNode'
						});
						domNode.push({
							type: 'textNode',
							value: '',
							placeNum: placeNum,
							valueInRender: part.valueInRender,
							valueOutRender: part.valueOutRender,
							modelDepends: part.modelDepends
						});
						domNode.push({
							type: 'splitNode'
						});

					} else {											//Если выражений в тексте нет
						domNode.push({
							type: 'textNode',
							value: part.value
						});
					}
				});
			} else if (beginPos === -1) {								//Дальше тегов нет, но какой то текст есть
				domNode.push({
					type: 'textNode',
					value: html
				});
				//TODO: выражения в этом тексте сейчас не выловятся. Нужно делать querySplit
				return;
			} else if (beginPos === 0) {								// Начало какого то тега
				let tagName;
				let closeTagName;
				let closeTagCfg;
				let tagIsComplete = null;
				let tagIsSelfClosed;

				if (html[1] === '/') {									// Это оказался закрывающий тег
					endPos = html.indexOf('>');
					closeTagName = html.substring(2, endPos);
					closeTagCfg = activeChain.pop();
					//activeChainPaths.pop();
					//console.log('closed tag:', closeTagName, closeTagCfg.tagName);
					if (closeTagCfg && closeTagCfg.tagName === closeTagName) {
						html = html.substring(endPos + 1);
						activeChainLn = activeChain.length;
						domNode = activeChainLn ? activeChain[activeChainLn - 1].childNodes : domTree;			//Возвращаемся к родительской ноде
					} else {
						error = ('invalid closed tag: ' + closeTagCfg.tagName + ' ... ' + html.substring(0, 50));
						//TODO: throw
						return;
					}
				} else {
					let attrs = {};

					closingCheck = function (i) {
						char = html[i];
						//console.log('search end:', i, char);
						if (char === '>') {				//Тег закончился
							tagIsComplete = true;
						} else if (char === '/') {		//Тег закончился и самозакрылся
							if (html[i + 1] === '>') {
								tagIsComplete = true;
								tagIsSelfClosed = true;
							} else {
								error = ('invalid self closed tag: ' + html.substring(0, 50));
							}
						}
						//console.log('[closingCheck] tagIsComplete, tagIsSelfClosed', char, tagIsComplete, tagIsSelfClosed);
					};

					//Ищем пробел или закрывающий >
					htmlLn = html.length;
					for (i = 1; i < htmlLn; i++) {
						char = html[i];
						closingCheck(i);	//Проверяем закончился ли тег
						if (error) {
							return;			//Если есть ошибки, вообще выходим из парсинга
						}
						if (tagIsComplete || char === ' ') {	//Тег закрылся или дальше пробел и наверно аттрибуты
							tagName = html.substring(1, i);
							//console.log('[find end] tagIsSelfClosed:', tagIsSelfClosed, (tagIsSelfClosed ? 10:0) );
							html = html.substring(i + 1 + (tagIsSelfClosed ? 1 : 0));
							break;
						}
					}

					//Тег не закончился, парсим аттрибуты до закрывающего >
					if (!tagIsComplete) {
						let attrTakeName = false;
						let attrQuote = null;		// Если true, то идет сбор значения
						let attrName = '';
						let attrValue = '';
						let attrType = null;
						let attrNamePosBegin = null;
						let attrValuePosBegin = null;
						let attrValueEscCount;
						let lastAttrNameChar;

						htmlLn = html.length;
						for (i = 0; i < htmlLn; i++) {
							char = html[i];
							//console.log(i, char, attrQuote);
							if (attrQuote) {					// Если есть открывающая кавычка, то захватываем всё, пока не встретим закрывающую
								if (char === attrQuote) {
									// Перед закрывающей кавычкой может быть \\\.
									// Если слешей нет, либо их четное число - кавычка закрылась, иначе это кавычка внутри значения
									attrValueEscCount = 0;
									for (j = i - 1; j > 1 && html[j] === '\\'; j--) {
										attrValueEscCount++;
									}
									if (attrValueEscCount % 2 === 0) {	//Кавычка реально закрылась
										attrValue = html.substring(attrValuePosBegin, i);
										attrs[attrName.toLowerCase()] = {value: attrValue, type: attrType};
										//html = html.substring(i+1);
										attrQuote = null;
										//console.log('- [attr] taken value:', attrName, attrValue);

										//Следующий символ должен быть либо закрывающим тег, либо разделяющим аттрибут
										nextChar = html[i + 1];
										if (nextChar !== ' ' && nextChar !== '\t' && nextChar !== '/' && nextChar !== '>') {
											error = ('Between attributes must be spaces');
											return;
										}
									}
								}
							} else {
								if (!attrTakeName) {
									closingCheck(i);
									if (tagIsComplete) break;
									if (error) {
										return;			// Если есть ошибки, вообще выходим из парсинга
									}
									if (char !== ' ' && char !== '\t') {
										attrTakeName = true;
										attrNamePosBegin = i;
									}
								} else {
									if (char === '=') {	// Название собрали, дальше будет значение
										attrName = html.substring(attrNamePosBegin, i);
										attrTakeName = false;
										i++;
										attrValuePosBegin = i + 1;
										attrQuote = html[i];
										lastAttrNameChar = html[i - 2];
										//console.warn('find attrQuote!', attrQuote, );
										if (lastAttrNameChar === ':') {
											attrType = 'json';
											attrName = attrName.substring(0, attrName.length - 1);
											//i++;
											//attrValuePosBegin = i + 1;
											//attrQuote = html[i];
										} else {
											attrType = 'string';
										}
										if (attrQuote !== '\'' && attrQuote !== '"') {
											error = ('Attributes value must be in quotes');
											return;
										}
									} else {
										closingCheck(i);
										if (tagIsComplete) break;
										if (error) {
											//TODO: throw
											return;		//Если есть ошибки, вообще выходим из парсинга
										}
									}
								}
							}
						}
						html = html.substring(i + 1 + (tagIsSelfClosed ? 1 : 0));
					}

					//console.log('tag complete:', tagIsSelfClosed, tagIsComplete, tagName, html);

					if (tagName === 'slot') {
						if (!attrs.name) {
							error = 'Slot must have attribute "name"';
							return;
						} else if (slotNames[attrs.name]) {
							error = 'Duplicate name of slot: "' + attrs.name + '"';
							return;
						}
						let slotName = attrs.name.value;
						slotNames[slotName] = true;
						domNode.push({
							type: 'slot',
							slotName: slotName
						});

						if (!tagIsSelfClosed) {					//Если внутри тега чтото есть - отправляем это вникуда
							activeChain.push({
								tagName: 'slot'					//Закрывающий тег должен быть </slot>
							});
							domNode = [];
						}
					} else {
						let attrsCompiled = {};
						Object.entries(attrs).forEach(([attrName, attr]) => {
							if (bindMethods[attrName]) {
								attrsCompiled[attrName] = {
									type: 'event',
									fn: attr.value				//this.#compilerGet(attr.value)
								};
								delete attrs[attrName];
							} else {
								if (attr.type === 'json') {
									//console.warn('JSON attr:', attr);
									attrsCompiled[attrName] = this.#queryJsonCompile(attr.value);
								} else if (attr.type === 'string') {
									attrsCompiled[attrName] = this.#queryStringCompile(attr.value);
								}
							}
						});
						tagCfg = {
							type: /-/.test(tagName) ? 'component' : 'tag',
							tagName: tagName,
							attrs: attrsCompiled,
							childNodes: []
						};
						domNode.push(tagCfg);
						//console.log('%c-find:', 'background:BlueViolet', tagName, html, domNode);
						if (!tagIsSelfClosed && !this.#selfClosedTags[tagName]) {
							//activeChainPaths.push('.childNodes['+ (domNode.length-1) +']');
							activeChain.push(tagCfg);
							domNode = tagCfg.childNodes;
						}
					}
				}
			}
			if (html) {
				parse();
			}
		};
		parse();

		if (error) {
			throw new Error(error);
		}

		return domTree;
	}


	/**	@method queryJsonCompile
	 *	@description				Вызывается для парсинга типизированых аттрибутов компонентов <component param:='{x: model.x}'></component>
	 *	@param query	{String}	Запрос вида: '{foo: {x: model.x}, bar: model.bar}'
	 *
	 *	@return {Object}
	 *		{
	 *			value:			{String=}
	 *			valueOut:		{String=}			//js код, который будет исполнен в модуле и полученое значение будет передано на рендеринг
	 *			modelDepends:	[	{
	 *									refName:		{string},		//M, E, G, S итд
	 *									modelPath:		{string},		//Путь в модели
	 *									valueOutRender:	{function}
	 *								}
	 *							]
	 *		}
	 */
	#queryJsonCompile(query) {
		let staticData = [];
		let objects = [];
		let depends = [];
		let valueOut = query;		//this.#compilerGet(query);

		//TODO: проверить что валидный json. Сейчас можно передать '{a:1}abcd' и оно обработается
		//TODO: Написать тест

		query = query
			.replace(/\\(['"]).*?\\\1/gm, function (_, data) {						//save escaped static data
				staticData.push(data);
				return '%@RP_STATIC_' + (staticData.length - 1) + '@%';
			})
			.replace(/(['"]).*?\1/gm, function (_, data) {							//save static data
				staticData.push(data);
				return '%@RP_STATIC_' + (staticData.length - 1) + '@%';
			});

		while (query.match(/{([^{}]+)}/)) {
			query = query.replace(/{([^{}]+)}/g, function (_, data) {
				objects.push(data);
				return '%@RP_OBJ_' + (objects.length - 1) + '@%';
			});
		}

		let childParse = (str, path) => {
			if (str.indexOf('%@RP_OBJ_') === 0 && str.match(/%@RP_OBJ_(\w+)/)) {				//OPTIMIZE: проверить дает ли indexOf производительности
				let objId = RegExp.$1;
				let objValue = objects[objId];
				objValue.replace(/(['"])?([\w\d]+)(['"])?\s*:\s*(.*?)(,|$)/g, (_, _1, name, _2, value) => {			//TODO: закрывающая ковычка должна совпадать. наверно \\\\1
					let propPath = path ? (path + '.' + name) : name;
					return childParse(value, propPath);
				});
			} else {
				str.replace(/(m|model)\.([a-zA-Z0-9.]+)/g, (_, refName, refPath) => {
					if (modelRefAlias[refName]) {
						refName = modelRefAlias[refName];
					}
					if (!depends[refName]) {
						depends[refName] = {};
					}
					depends.push({
						refName: refName,
						modelPath: refPath,
						valueOutRender: str,			//this.#compilerGet(str),
						jsonInnerPath: path
					});
				});
			}
			return '';
		};
		childParse(query, '');
		return {valueOut: valueOut, modelDepends: depends, type: 'json'};
	}


	/**	@method queryStringCompile
	 *	@description				Вызывается для выражений, которые необходимо схлопнуть, может обработать и просто статику вернув value
	 *	@param query	{String}	Запрос вида: 'my name is {{G.campaign ? G.campaign.name : M.name ::upperCase}}, and {{M.age}} years old'
	 *	@return {Object}
	 *		{
	 *			value:			{String=}
	 *			valueIn:		{String=},
	 *			valueOut:		{String=}			//js код, который будет исполнен в модуле и полученое значение будет передано на рендеринг
	 *			modelDepends:	[	{
	 *									refName:		{string},		//M, E, G, S итд
	 *									modelPath:		{string},		//Путь в модели
	 *								}
	 *							]
	 *		}
	 */
	#queryStringCompile(query) {
		//console.log('queryStringCompile: ', query, type);
		let regQuery = /({{.*?}})/igm;					// Захватывает query ({{M.foo.bar}})
		let reqExpr = /^{{\s*(.*?)\s*}}$/;				// Захватывает expression от начала до конца {{(M.foo.bar)}}

		if (query.match(regQuery)) {
			query = query
				.replace(regQuery, '#_QV_#$1#_QV_#')
				.split('#_QV_#')
				.map(function (txt) {
					if (txt.match(reqExpr)) {
						return '(' + RegExp.$1 + ')';		//В запросе может быть несколько условий {{a?1:2}} {{b?3:4}}
						//return RegExp.$1;
					} else {
						txt = txt.replace("'", "\\'");
						return txt ? "'" + txt + "'" : '';
					}
				})
				.filter(function (txt) {
					return !!txt;
				})
				.join('+');
			//let compiledQuery = this.#exprCompile(query);
			//console.log('%c query', 'color:red;', query, compiledQuery);
			return this.#exprCompile(query);
		} else {
			return {value: query, type: 'string'};
		}
	}

	/**	@method querySplit
	 *	@description		Разбивает строку с выражениями на части
	 *	@param query		{String}		Запрос вида: 'my name is {{G.campaign ? G.campaign.name : M.name ::upperCase}}, and {{M.age}} years old'
	 *
	 *	@return {Object}
	 *		{
	 * 			parts: [
	 *				%{
	 *					value:			{String=}
	 *					valueOut:		{String=}			//js код, который будет передан в модуль и там исполнен в момент рендеринга выражения
	 *					valueIn:		{String=},
	 *					modelDepends:	[	{
	 *											refName:		{string},		//m, e, g, s итд
	 *											modelPath:		{string},		//Путь в модели
	 *										}
	 *									]
	 *				}
	 * 			]
	 * 		}
	 */
	querySplit(query) {
		let queryParts = [];
		let regQuery = /({{.*?}})/igm;				// Захватывает query ({{M.foo.bar}})
		let reqExpr = /^{{\s*(.*?)\s*}}$/;			// Захватывает expression {{(M.foo.bar)}}

		if (query.match(regQuery)) {
			query
				.replace(regQuery, '#_QV_#$1#_QV_#')
				.split('#_QV_#')
				.forEach(txt => {
					let expr;

					if (!txt) return;
					if (txt.match(reqExpr)) {
						expr = this.#exprCompile(RegExp.$1);		// 'G.campaign_id:filter' -> {modelPath: 'campaign_id', owner: 'G', adapters:{}}
						queryParts.push(expr);
					} else {
						queryParts.push({value: txt});
					}
				});
		} else {
			queryParts.push({value: query});
		}
		return queryParts;
	}

	/**	@method exprCompile
	 *	@description	Компилирует выражение вида: M.user.name + ' ' + M.user.age :: path1,path2
	 *	@param valueOut	{String}	//Компилируемое выражение, пример: M.user.name + ' ' + M.user.age %%path1,path2 :: filter1 :: filter2
	 *								// %% path1, path2 - дополнительные пути для подписки на изменения. Если значения по этим путям изменятся - произойдет перерендеринг выражения
	 *	@param cfg		{Object=}
	 *	@param cfg.jsonInnerPath	{string=}	Путь внутри json'a в значении аттрибута
	 *	@return {Object}
	 *		{
	 *			value:			{String=}
	 *			valueIn:		{String=},		//js источника перенаправления. Если задан - valueOut должен быть из одного modelPath, в который будет помещен результат
	 *			valueOut:		{String=}		//js код, который будет передан в модуль и там исполнен в момент рендеринга выражения
	 *			modelOut:		[],				//Модели из valueOut
	 *			modelDepends:	[	{
	 *									refName:		{string},		//m, e, g, s итд
	 *									modelPath:		{string},		//Путь в модели
	 *									jsonInnerPath:	{string}		//Компилятору уже передается этот путь в cfg, прокидываем его в modelDepends.
	 *								}
	 *							]
	 *		}
	 */
	#exprCompile(valueOut, cfg) {
		let scan;
		let ret, staticData;		//name, paramsRaw, refName, path, modelRefPath
		//let adapters = [];

		if (!cfg) {
			cfg = {};
		}

		valueOut = valueOut.trim();
		//console.log('--valueOut:', valueOut);

		ret = {
			type: 'string',
			valueInRender: null,		//Функция возвращающая значение valueIn;
			valueOutRender: null,		//Функция возвращающая значение valueOut;
			modelOut: [],				//Модели из valueOut	[ {modelRef, modelPath} ]
			modelDepends: []			//Все модели			[ {modelRef, modelPath, jsonInnerPath} ];
		};
		//console.log('[template] -------- exprCompile:', valueOut);

		/**
		 * @description Получает на входе строку с выражением, парсит и заполняет ret.modelDepends
		 * @param expr		{string}
		 * @param iterator	{function}	Вызвать функцию для каждой найденной зависимости
		 * @return {string}
		 */
		scan = (expr, iterator) => {
			let exprFn;
			let canSync = /^[\w\d._]+$/.test(expr);
			staticData = [];
			expr = expr.trim();
			exprFn = expr;				//this.#compilerGet(expr);

			expr/*
				Если в style выражение в кавычках, но оно ломается `url: ('/ggfd/{{m.path}}.jpg')`
				TODO: Поидее сейвить текст не нужно, но нужно проверить что в компонентах припередаче json'a не ломается ничего

				.replace(/\\(['"]).*?\\\1/gm, function (_, data) {								//save static data
					staticData.push(data);
					return '%@' + staticData.length + '@%';
				})
				.replace(/(['"]).*?\1/gm, function (_, data) {									//save static data
					staticData.push(data);
					return '%@' + staticData.length + '@%';
				})*/
				.replace(modelRefsObservedReg, function (_, refName, _null, path) {
					ret.modelDepends.push({
						refName: refName,
						modelPath: path,
						canSync: canSync,
						jsonInnerPath: cfg.jsonInnerPath	//(cfg.jsonInnerPath ? cfg.jsonInnerPath : null)
					});
					if (iterator) {
						iterator(refName, path);
					}
					return '';
				});

			return exprFn;
		};

		//Дополнительные подписки для рендера
		/*
		valueOut.replace(/%%(.*?)(::|$)/g, function() {
			RegExp.$1.trim().split(',').forEach(function(depend) {
				var modelRefPath;
				if (depend.match(modelRefsObservedReg)) {
					//modelRefPath = "modelRefGet(moduleName, objSelf, '" + RegExp.$1 + "').model";
					ret.modelDepends.push( "return {refName: '" + refName + "', modelRef: " + modelRefPath +", modelPath: '" + RegExp.$3 + "'}" );
					//ret.modelDepends.push( new Function(["moduleName", "objSelf"], "return {refName: '" + refName + "', modelRef: " + modelRefPath +", modelPath: '" + RegExp.$3 + "'}") );
				}
			});
			return '';
		});
		*/

		//let valueFlowOffset, valueIn;
		// Выдираем значения перед перенаправлением ( 'foo' >> M.value )
		//valueFlowOffset = valueOut.indexOf('>>');
		//if (valueFlowOffset !== -1) {
		//	if (adapters.length) {
		//		_throw_('[Template] Not allow use adapters with valueIn ">>" value redirect in: ', valueOut);
		//		return {};
		//	}
		//	valueIn = valueOut.substring(0, valueFlowOffset);
		//	valueOut = valueOut.substring(valueFlowOffset+2);
		//	if ( valueIn.match(modelRefsObservedReg) ) {
		//		ret.valueInRender = scan(valueIn);
		//	}
		//}

		//Генерим valueOut
		ret.valueOutRender = scan(valueOut, function (refName, path) {
			ret.modelOut.push({
				refName: refName,
				modelPath: path
			});
		});

		//console.log('ret:', valueOut, ret);
		return ret;
	}
};

export default HTMLTree;
