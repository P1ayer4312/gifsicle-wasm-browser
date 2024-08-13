const gifsicle = {
	tool: {
		workerLocalUrl: '',
		workerBlobUrl: '',
		worker() {
			if (this.workerBlobUrl) {
				return this.workerBlobUrl
			} else {
				if (!this.workerLocalUrl) {
					this.workerBlobUrl = '../src/worker.js'
				} else {
					this.workerBlobUrl = URL.createObjectURL(new Blob([this.workerLocalUrl]));
				}
				return this.workerBlobUrl
			}
			// if (this.workerUrl) return this.workerUrl
			// else {
			// 	this.workerUrl = URL.createObjectURL(new Blob([this.defUrl]));
			// }
			// return this.workerUrl
			// return `../src/worker.js`;
		},
		errorLink() {
			return " \n Check: https://github.com/renzhezhilu/gifsicle-wasm-browser";
		},
		testType(data) {
			return data instanceof Element
				? "element"
				: Object.prototype.toString
					.call(data)
					.replace(/\[object\s(.+)\]/, "$1")
					.toLowerCase();
		},
		async textToUrl() {
			return this.worker();
		},
		loadCommand(command) {
			let type = this.testType(command);
			if (command.length === 0) {
				throw "<command> the content can not be blank" + this.errorLink();
			}
			if (type === "array") {
				let delNewline = command.map(m=>m.replace(/\n/ig,' '));
				return delNewline
			} else {
				throw (
					"<command> types:" + type + ", must be an array" + this.errorLink()
				);
			}
		},
		loadOne(file) {
			return new Promise(async (res, rej) => {
				let type = this.testType(file);
				// url
				if (["string"].includes(type)) {
					fetch(file)
						.then((d) => {
							if (d.status !== 200)
								throw "<" + file + ">" + " Url error!!!" + this.errorLink();
							return d.arrayBuffer();
						})
						.then((d) => res(d))
						.catch(rej);
				}
				// blob
				else if (["blob", "file"].includes(type)) {
					// file.arrayBuffer().then((d) => res(d));
					new Response(file).arrayBuffer().then((d) => res(d));
				}
				// arraybuffer
				else if (["arraybuffer"].includes(type)) {
					res(file);
				}
				// other
				else {
					throw (
						"<input.file> types:" +
						type +
						", only supports Url, blob, file, arraybuffer" +
						this.errorLink()
					);
				}
			});
		},
		loadFile(input) {
			return new Promise(async (res, rej) => {
				let type = this.testType(input);
				if (type !== "array") {
					rej(
						"<input> types:" + type + ", only supports Array" + this.errorLink()
					);
				}
				if (input.length === 0) {
					rej("<input> the content can not be blank" + this.errorLink());
				}
				let loadTask = input.map((m) => this.loadOne(m.file));
				Promise.all(loadTask)
					.then(function (posts) {
						let bufArr = input.map((m, index) => {
							m.file = posts[index];
							return m;
						});
						res(bufArr);
					})
					.catch(rej);
			});
		},
		loadFolder(arr) {
			return new Promise(async (res, rej) => {
				let type = this.testType(arr);
				// url
				if (["array"].includes(type)) {
					res(arr);
				} else {
					rej(
						"<folder> types:" +
						type +
						", only supports Array" +
						this.errorLink()
					);
				}
			});
		},
	},
	run(obj) {  
		if (typeof obj !== 'object' || Array.isArray(obj)) {
			throw new Error('idk')
		}

		return new Promise(async (res, rej) => {
			let {
				input = [],
				command = "",
				folder = [],
				isStrict = false,
				showLogs = false,
			} = obj
			let workerUrl = await this.tool.textToUrl();
			let myWorker = new Worker(workerUrl);

			let newCommand = this.tool.loadCommand(command);
			let newFiles = await this.tool.loadFile(input);
			let newFolder = await this.tool.loadFolder(folder);

			if (showLogs) {
				console.log(newCommand);
				console.log(newFiles);
				console.log(workerUrl);
			}
			myWorker.postMessage({
				data: newFiles,
				command: newCommand,
				folder: newFolder,
				isStrict,
			});
			// 量化转换
			myWorker.onmessage = async function (e) {
				if (!e.data.files || typeof e.data.files === 'string') {
					myWorker.terminate();
					rej(e.data.files);
					return;
				}
				const outArr = new Array(e.data.files.length);
				for (let index = 0; index < e.data.files.length; index++) {
					const element = e.data.files[index];
					if (element.name.includes(".txt")) {
						let blob = new File([element.file], element.name, {
							type: "text/plain",
						});
						outArr.push(blob);
						// let text = await blob.text();
						// text = text.split("\n").map((m) => m + "<br>");
					} else {
						let gif = new File([element.file], element.name, {
							type: "image/gif",
						});
						outArr.push(gif);
					}
				}
				myWorker.terminate();
				res({         // --- Changed
          gifs: outArr,
          outputLogs: e.data.outputLogs
        });
			};
			// 转换错误
			myWorker.onerror = function (e) {
				console.error(e);
				myWorker.terminate();
				res(null);
			};
		});
	},
};

export default gifsicle;
