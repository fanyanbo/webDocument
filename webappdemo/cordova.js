;
(function() {
	var PLATFORM_VERSION_BUILD_LABEL = '5.2.0-dev';
	// file: src/scripts/require.js
	var require,
		define;

	(function() {
		var modules = {},
			// Stack of moduleIds currently being built.
			requireStack = [],
			// Map of module ID -> index into requireStack of modules currently being built.
			inProgressModules = {},
			SEPARATOR = ".";

		function build(module) {
			var factory = module.factory,
				localRequire = function(id) {
					var resultantId = id;
					//Its a relative path, so lop off the last portion and add the id (minus "./")
					if(id.charAt(0) === ".") {
						resultantId = module.id.slice(0, module.id.lastIndexOf(SEPARATOR)) + SEPARATOR + id.slice(2);
					}
					return require(resultantId);
				};
			module.exports = {};
			delete module.factory;
			factory(localRequire, module.exports, module);
			return module.exports;
		}

		require = function(id) {
			if(!modules[id]) {
				throw "module " + id + " not found";
			} else if(id in inProgressModules) {
				var cycle = requireStack.slice(inProgressModules[id]).join('->') + '->' + id;
				throw "Cycle in require graph: " + cycle;
			}
			if(modules[id].factory) {
				try {
					inProgressModules[id] = requireStack.length;
					requireStack.push(id);
					return build(modules[id]);
				} finally {
					delete inProgressModules[id];
					requireStack.pop();
				}
			}
			return modules[id].exports;
		};

		define = function(id, factory) {
			if(modules[id]) {
				throw "module " + id + " already defined";
			}

			modules[id] = {
				id: id,
				factory: factory
			};
		};

		define.remove = function(id) {
			delete modules[id];
		};

		define.moduleMap = modules;
	})();

	//Export for use in node
	if(typeof module === "object" && typeof require === "function") {
		module.exports.require = require;
		module.exports.define = define;
	}

	// file: src/cordova.js
	define("cordova", function(require, exports, module) {

		// Workaround for Windows 10 in hosted environment case
		// http://www.w3.org/html/wg/drafts/html/master/browsers.html#named-access-on-the-window-object
		if(window.cordova && !(window.cordova instanceof HTMLElement)) {
			throw new Error("cordova already defined");
		}

		var channel = require('cordova/channel');
		var platform = require('cordova/platform');

		/**
		 * Intercept calls to addEventListener + removeEventListener and handle deviceready,
		 * resume, and pause events.
		 */
		var m_document_addEventListener = document.addEventListener;
		var m_document_removeEventListener = document.removeEventListener;
		var m_window_addEventListener = window.addEventListener;
		var m_window_removeEventListener = window.removeEventListener;

		/**
		 * Houses custom event handlers to intercept on document + window event listeners.
		 */
		var documentEventHandlers = {},
			windowEventHandlers = {};

		document.addEventListener = function(evt, handler, capture) {
			var e = evt.toLowerCase();
			if(typeof documentEventHandlers[e] != 'undefined') {
				documentEventHandlers[e].subscribe(handler);
			} else {
				m_document_addEventListener.call(document, evt, handler, capture);
			}
		};

		window.addEventListener = function(evt, handler, capture) {
			var e = evt.toLowerCase();
			if(typeof windowEventHandlers[e] != 'undefined') {
				windowEventHandlers[e].subscribe(handler);
			} else {
				m_window_addEventListener.call(window, evt, handler, capture);
			}
		};

		document.removeEventListener = function(evt, handler, capture) {
			var e = evt.toLowerCase();
			// If unsubscribing from an event that is handled by a plugin
			if(typeof documentEventHandlers[e] != "undefined") {
				documentEventHandlers[e].unsubscribe(handler);
			} else {
				m_document_removeEventListener.call(document, evt, handler, capture);
			}
		};

		window.removeEventListener = function(evt, handler, capture) {
			var e = evt.toLowerCase();
			// If unsubscribing from an event that is handled by a plugin
			if(typeof windowEventHandlers[e] != "undefined") {
				windowEventHandlers[e].unsubscribe(handler);
			} else {
				m_window_removeEventListener.call(window, evt, handler, capture);
			}
		};

		function createEvent(type, data) {
			var event = document.createEvent('Events');
			event.initEvent(type, false, false);
			if(data) {
				for(var i in data) {
					if(data.hasOwnProperty(i)) {
						event[i] = data[i];
					}
				}
			}
			return event;
		}

		var cordova = {
			define: define,
			require: require,
			version: PLATFORM_VERSION_BUILD_LABEL,
			platformVersion: PLATFORM_VERSION_BUILD_LABEL,
			platformId: platform.id,
			/**
			 * Methods to add/remove your own addEventListener hijacking on document + window.
			 */
			addWindowEventHandler: function(event) {
				return(windowEventHandlers[event] = channel.create(event));
			},
			addStickyDocumentEventHandler: function(event) {
				return(documentEventHandlers[event] = channel.createSticky(event));
			},
			addDocumentEventHandler: function(event) {
				return(documentEventHandlers[event] = channel.create(event));
			},
			removeWindowEventHandler: function(event) {
				delete windowEventHandlers[event];
			},
			removeDocumentEventHandler: function(event) {
				delete documentEventHandlers[event];
			},
			/**
			 * Retrieve original event handlers that were replaced by Cordova
			 *
			 * @return object
			 */
			getOriginalHandlers: function() {
				return {
					'document': {
						'addEventListener': m_document_addEventListener,
						'removeEventListener': m_document_removeEventListener
					},
					'window': {
						'addEventListener': m_window_addEventListener,
						'removeEventListener': m_window_removeEventListener
					}
				};
			},
			/**
			 * Method to fire event from native code
			 * bNoDetach is required for events which cause an exception which needs to be caught in native code
			 */
			fireDocumentEvent: function(type, data, bNoDetach) {
				var evt = createEvent(type, data);
				if(typeof documentEventHandlers[type] != 'undefined') {
					if(bNoDetach) {
						documentEventHandlers[type].fire(evt);
					} else {
						setTimeout(function() {
							// Fire deviceready on listeners that were registered before cordova.js was loaded.
							if(type == 'deviceready') {
								document.dispatchEvent(evt);
							}
							documentEventHandlers[type].fire(evt);
						}, 0);
					}
				} else {
					document.dispatchEvent(evt);
				}
			},
			fireWindowEvent: function(type, data) {
				var evt = createEvent(type, data);
				if(typeof windowEventHandlers[type] != 'undefined') {
					setTimeout(function() {
						windowEventHandlers[type].fire(evt);
					}, 0);
				} else {
					window.dispatchEvent(evt);
				}
			},

			/**
			 * Plugin callback mechanism.
			 */
			// Randomize the starting callbackId to avoid collisions after refreshing or navigating.
			// This way, it's very unlikely that any new callback would get the same callbackId as an old callback.
			callbackId: Math.floor(Math.random() * 2000000000),
			callbacks: {},
			callbackStatus: {
				NO_RESULT: 0,
				OK: 1,
				CLASS_NOT_FOUND_EXCEPTION: 2,
				ILLEGAL_ACCESS_EXCEPTION: 3,
				INSTANTIATION_EXCEPTION: 4,
				MALFORMED_URL_EXCEPTION: 5,
				IO_EXCEPTION: 6,
				INVALID_ACTION: 7,
				JSON_EXCEPTION: 8,
				ERROR: 9
			},

			/**
			 * Called by native code when returning successful result from an action.
			 */
			callbackSuccess: function(callbackId, args) {
				cordova.callbackFromNative(callbackId, true, args.status, [args.message], args.keepCallback);
			},

			/**
			 * Called by native code when returning error result from an action.
			 */
			callbackError: function(callbackId, args) {
				// TODO: Deprecate callbackSuccess and callbackError in favour of callbackFromNative.
				// Derive success from status.
				cordova.callbackFromNative(callbackId, false, args.status, [args.message], args.keepCallback);
			},

			/**
			 * Called by native code when returning the result from an action.
			 */
			callbackFromNative: function(callbackId, isSuccess, status, args, keepCallback) {
				try {
					var callback = cordova.callbacks[callbackId];
					if(callback) {
						if(isSuccess && status == cordova.callbackStatus.OK) {
							callback.success && callback.success.apply(null, args);
						} else if(!isSuccess) {
							callback.fail && callback.fail.apply(null, args);
						}
						/*
						else
						    Note, this case is intentionally not caught.
						    this can happen if isSuccess is true, but callbackStatus is NO_RESULT
						    which is used to remove a callback from the list without calling the callbacks
						    typically keepCallback is false in this case
						*/
						// Clear callback if not expecting any more results
						if(!keepCallback) {
							delete cordova.callbacks[callbackId];
						}
					}
				} catch(err) {
					var msg = "Error in " + (isSuccess ? "Success" : "Error") + " callbackId: " + callbackId + " : " + err;
					console && console.log && console.log(msg);
					cordova.fireWindowEvent("cordovacallbackerror", {
						'message': msg
					});
					throw err;
				}
			},
			addConstructor: function(func) {
				channel.onCordovaReady.subscribe(function() {
					try {
						func();
					} catch(e) {
						console.log("Failed to run constructor: " + e);
					}
				});
			}
		};

		module.exports = cordova;

	});

	// file: /Users/steveng/repo/cordova/cordova-android/cordova-js-src/android/nativeapiprovider.js
	define("cordova/android/nativeapiprovider", function(require, exports, module) {

		/**
		 * Exports the ExposedJsApi.java object if available, otherwise exports the PromptBasedNativeApi.
		 */

		var nativeApi = this._cordovaNative || require('cordova/android/promptbasednativeapi');
		var currentApi = nativeApi;

		module.exports = {
			get: function() {
				return currentApi;
			},
			setPreferPrompt: function(value) {
				currentApi = value ? require('cordova/android/promptbasednativeapi') : nativeApi;
			},
			// Used only by tests.
			set: function(value) {
				currentApi = value;
			}
		};

	});

	// file: /Users/steveng/repo/cordova/cordova-android/cordova-js-src/android/promptbasednativeapi.js
	define("cordova/android/promptbasednativeapi", function(require, exports, module) {

		/**
		 * Implements the API of ExposedJsApi.java, but uses prompt() to communicate.
		 * This is used pre-JellyBean, where addJavascriptInterface() is disabled.
		 */

		module.exports = {
			exec: function(bridgeSecret, service, action, callbackId, argsJson) {
				return prompt(argsJson, 'gap:' + JSON.stringify([bridgeSecret, service, action, callbackId]));
			},
			setNativeToJsBridgeMode: function(bridgeSecret, value) {
				prompt(value, 'gap_bridge_mode:' + bridgeSecret);
			},
			retrieveJsMessages: function(bridgeSecret, fromOnlineEvent) {
				return prompt(+fromOnlineEvent, 'gap_poll:' + bridgeSecret);
			}
		};

	});

	// file: src/common/argscheck.js
	define("cordova/argscheck", function(require, exports, module) {

		var utils = require('cordova/utils');

		var moduleExports = module.exports;

		var typeMap = {
			'A': 'Array',
			'D': 'Date',
			'N': 'Number',
			'S': 'String',
			'F': 'Function',
			'O': 'Object'
		};

		function extractParamName(callee, argIndex) {
			return(/.*?\((.*?)\)/).exec(callee)[1].split(', ')[argIndex];
		}

		function checkArgs(spec, functionName, args, opt_callee) {
			if(!moduleExports.enableChecks) {
				return;
			}
			var errMsg = null;
			var typeName;
			for(var i = 0; i < spec.length; ++i) {
				var c = spec.charAt(i),
					cUpper = c.toUpperCase(),
					arg = args[i];
				// Asterix means allow anything.
				if(c == '*') {
					continue;
				}
				typeName = utils.typeName(arg);
				if((arg === null || arg === undefined) && c == cUpper) {
					continue;
				}
				if(typeName != typeMap[cUpper]) {
					errMsg = 'Expected ' + typeMap[cUpper];
					break;
				}
			}
			if(errMsg) {
				errMsg += ', but got ' + typeName + '.';
				errMsg = 'Wrong type for parameter "' + extractParamName(opt_callee || args.callee, i) + '" of ' + functionName + ': ' + errMsg;
				// Don't log when running unit tests.
				if(typeof jasmine == 'undefined') {
					console.error(errMsg);
				}
				throw TypeError(errMsg);
			}
		}

		function getValue(value, defaultValue) {
			return value === undefined ? defaultValue : value;
		}

		moduleExports.checkArgs = checkArgs;
		moduleExports.getValue = getValue;
		moduleExports.enableChecks = true;

	});

	// file: src/common/base64.js
	define("cordova/base64", function(require, exports, module) {

		var base64 = exports;

		base64.fromArrayBuffer = function(arrayBuffer) {
			var array = new Uint8Array(arrayBuffer);
			return uint8ToBase64(array);
		};

		base64.toArrayBuffer = function(str) {
			var decodedStr = typeof atob != 'undefined' ? atob(str) : new Buffer(str, 'base64').toString('binary');
			var arrayBuffer = new ArrayBuffer(decodedStr.length);
			var array = new Uint8Array(arrayBuffer);
			for(var i = 0, len = decodedStr.length; i < len; i++) {
				array[i] = decodedStr.charCodeAt(i);
			}
			return arrayBuffer;
		};

		//------------------------------------------------------------------------------

		/* This code is based on the performance tests at http://jsperf.com/b64tests
		 * This 12-bit-at-a-time algorithm was the best performing version on all
		 * platforms tested.
		 */

		var b64_6bit = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		var b64_12bit;

		var b64_12bitTable = function() {
			b64_12bit = [];
			for(var i = 0; i < 64; i++) {
				for(var j = 0; j < 64; j++) {
					b64_12bit[i * 64 + j] = b64_6bit[i] + b64_6bit[j];
				}
			}
			b64_12bitTable = function() {
				return b64_12bit;
			};
			return b64_12bit;
		};

		function uint8ToBase64(rawData) {
			var numBytes = rawData.byteLength;
			var output = "";
			var segment;
			var table = b64_12bitTable();
			for(var i = 0; i < numBytes - 2; i += 3) {
				segment = (rawData[i] << 16) + (rawData[i + 1] << 8) + rawData[i + 2];
				output += table[segment >> 12];
				output += table[segment & 0xfff];
			}
			if(numBytes - i == 2) {
				segment = (rawData[i] << 16) + (rawData[i + 1] << 8);
				output += table[segment >> 12];
				output += b64_6bit[(segment & 0xfff) >> 6];
				output += '=';
			} else if(numBytes - i == 1) {
				segment = (rawData[i] << 16);
				output += table[segment >> 12];
				output += '==';
			}
			return output;
		}

	});

	// file: src/common/builder.js
	define("cordova/builder", function(require, exports, module) {

		var utils = require('cordova/utils');

		function each(objects, func, context) {
			for(var prop in objects) {
				if(objects.hasOwnProperty(prop)) {
					func.apply(context, [objects[prop], prop]);
				}
			}
		}

		function clobber(obj, key, value) {
			exports.replaceHookForTesting(obj, key);
			var needsProperty = false;
			try {
				obj[key] = value;
			} catch(e) {
				needsProperty = true;
			}
			// Getters can only be overridden by getters.
			if(needsProperty || obj[key] !== value) {
				utils.defineGetter(obj, key, function() {
					return value;
				});
			}
		}

		function assignOrWrapInDeprecateGetter(obj, key, value, message) {
			if(message) {
				utils.defineGetter(obj, key, function() {
					console.log(message);
					delete obj[key];
					clobber(obj, key, value);
					return value;
				});
			} else {
				clobber(obj, key, value);
			}
		}

		function include(parent, objects, clobber, merge) {
			each(objects, function(obj, key) {
				try {
					var result = obj.path ? require(obj.path) : {};

					if(clobber) {
						// Clobber if it doesn't exist.
						if(typeof parent[key] === 'undefined') {
							assignOrWrapInDeprecateGetter(parent, key, result, obj.deprecated);
						} else if(typeof obj.path !== 'undefined') {
							// If merging, merge properties onto parent, otherwise, clobber.
							if(merge) {
								recursiveMerge(parent[key], result);
							} else {
								assignOrWrapInDeprecateGetter(parent, key, result, obj.deprecated);
							}
						}
						result = parent[key];
					} else {
						// Overwrite if not currently defined.
						if(typeof parent[key] == 'undefined') {
							assignOrWrapInDeprecateGetter(parent, key, result, obj.deprecated);
						} else {
							// Set result to what already exists, so we can build children into it if they exist.
							result = parent[key];
						}
					}

					if(obj.children) {
						include(result, obj.children, clobber, merge);
					}
				} catch(e) {
					utils.alert('Exception building Cordova JS globals: ' + e + ' for key "' + key + '"');
				}
			});
		}

		/**
		 * Merge properties from one object onto another recursively.  Properties from
		 * the src object will overwrite existing target property.
		 *
		 * @param target Object to merge properties into.
		 * @param src Object to merge properties from.
		 */
		function recursiveMerge(target, src) {
			for(var prop in src) {
				if(src.hasOwnProperty(prop)) {
					if(target.prototype && target.prototype.constructor === target) {
						// If the target object is a constructor override off prototype.
						clobber(target.prototype, prop, src[prop]);
					} else {
						if(typeof src[prop] === 'object' && typeof target[prop] === 'object') {
							recursiveMerge(target[prop], src[prop]);
						} else {
							clobber(target, prop, src[prop]);
						}
					}
				}
			}
		}

		exports.buildIntoButDoNotClobber = function(objects, target) {
			include(target, objects, false, false);
		};
		exports.buildIntoAndClobber = function(objects, target) {
			include(target, objects, true, false);
		};
		exports.buildIntoAndMerge = function(objects, target) {
			include(target, objects, true, true);
		};
		exports.recursiveMerge = recursiveMerge;
		exports.assignOrWrapInDeprecateGetter = assignOrWrapInDeprecateGetter;
		exports.replaceHookForTesting = function() {};

	});

	// file: src/common/channel.js
	define("cordova/channel", function(require, exports, module) {

		var utils = require('cordova/utils'),
			nextGuid = 1;

		/**
		 * Custom pub-sub "channel" that can have functions subscribed to it
		 * This object is used to define and control firing of events for
		 * cordova initialization, as well as for custom events thereafter.
		 *
		 * The order of events during page load and Cordova startup is as follows:
		 *
		 * onDOMContentLoaded*         Internal event that is received when the web page is loaded and parsed.
		 * onNativeReady*              Internal event that indicates the Cordova native side is ready.
		 * onCordovaReady*             Internal event fired when all Cordova JavaScript objects have been created.
		 * onDeviceReady*              User event fired to indicate that Cordova is ready
		 * onResume                    User event fired to indicate a start/resume lifecycle event
		 * onPause                     User event fired to indicate a pause lifecycle event
		 *
		 * The events marked with an * are sticky. Once they have fired, they will stay in the fired state.
		 * All listeners that subscribe after the event is fired will be executed right away.
		 *
		 * The only Cordova events that user code should register for are:
		 *      deviceready           Cordova native code is initialized and Cordova APIs can be called from JavaScript
		 *      pause                 App has moved to background
		 *      resume                App has returned to foreground
		 *
		 * Listeners can be registered as:
		 *      document.addEventListener("deviceready", myDeviceReadyListener, false);
		 *      document.addEventListener("resume", myResumeListener, false);
		 *      document.addEventListener("pause", myPauseListener, false);
		 *
		 * The DOM lifecycle events should be used for saving and restoring state
		 *      window.onload
		 *      window.onunload
		 *
		 */

		/**
		 * Channel
		 * @constructor
		 * @param type  String the channel name
		 */
		var Channel = function(type, sticky) {
				this.type = type;
				// Map of guid -> function.
				this.handlers = {};
				// 0 = Non-sticky, 1 = Sticky non-fired, 2 = Sticky fired.
				this.state = sticky ? 1 : 0;
				// Used in sticky mode to remember args passed to fire().
				this.fireArgs = null;
				// Used by onHasSubscribersChange to know if there are any listeners.
				this.numHandlers = 0;
				// Function that is called when the first listener is subscribed, or when
				// the last listener is unsubscribed.
				this.onHasSubscribersChange = null;
			},
			channel = {
				/**
				 * Calls the provided function only after all of the channels specified
				 * have been fired. All channels must be sticky channels.
				 */
				join: function(h, c) {
					var len = c.length,
						i = len,
						f = function() {
							if(!(--i)) h();
						};
					for(var j = 0; j < len; j++) {
						if(c[j].state === 0) {
							throw Error('Can only use join with sticky channels.');
						}
						c[j].subscribe(f);
					}
					if(!len) h();
				},
				create: function(type) {
					return channel[type] = new Channel(type, false);
				},
				createSticky: function(type) {
					return channel[type] = new Channel(type, true);
				},

				/**
				 * cordova Channels that must fire before "deviceready" is fired.
				 */
				deviceReadyChannelsArray: [],
				deviceReadyChannelsMap: {},

				/**
				 * Indicate that a feature needs to be initialized before it is ready to be used.
				 * This holds up Cordova's "deviceready" event until the feature has been initialized
				 * and Cordova.initComplete(feature) is called.
				 *
				 * @param feature {String}     The unique feature name
				 */
				waitForInitialization: function(feature) {
					if(feature) {
						var c = channel[feature] || this.createSticky(feature);
						this.deviceReadyChannelsMap[feature] = c;
						this.deviceReadyChannelsArray.push(c);
					}
				},

				/**
				 * Indicate that initialization code has completed and the feature is ready to be used.
				 *
				 * @param feature {String}     The unique feature name
				 */
				initializationComplete: function(feature) {
					var c = this.deviceReadyChannelsMap[feature];
					if(c) {
						c.fire();
					}
				}
			};

		function forceFunction(f) {
			if(typeof f != 'function') throw "Function required as first argument!";
		}

		/**
		 * Subscribes the given function to the channel. Any time that
		 * Channel.fire is called so too will the function.
		 * Optionally specify an execution context for the function
		 * and a guid that can be used to stop subscribing to the channel.
		 * Returns the guid.
		 */
		Channel.prototype.subscribe = function(f, c) {
			// need a function to call
			forceFunction(f);
			if(this.state == 2) {
				f.apply(c || this, this.fireArgs);
				return;
			}

			var func = f,
				guid = f.observer_guid;
			if(typeof c == "object") {
				func = utils.close(c, f);
			}

			if(!guid) {
				// first time any channel has seen this subscriber
				guid = '' + nextGuid++;
			}
			func.observer_guid = guid;
			f.observer_guid = guid;

			// Don't add the same handler more than once.
			if(!this.handlers[guid]) {
				this.handlers[guid] = func;
				this.numHandlers++;
				if(this.numHandlers == 1) {
					this.onHasSubscribersChange && this.onHasSubscribersChange();
				}
			}
		};

		/**
		 * Unsubscribes the function with the given guid from the channel.
		 */
		Channel.prototype.unsubscribe = function(f) {
			// need a function to unsubscribe
			forceFunction(f);

			var guid = f.observer_guid,
				handler = this.handlers[guid];
			if(handler) {
				delete this.handlers[guid];
				this.numHandlers--;
				if(this.numHandlers === 0) {
					this.onHasSubscribersChange && this.onHasSubscribersChange();
				}
			}
		};

		/**
		 * Calls all functions subscribed to this channel.
		 */
		Channel.prototype.fire = function(e) {
			var fail = false,
				fireArgs = Array.prototype.slice.call(arguments);
			// Apply stickiness.
			if(this.state == 1) {
				this.state = 2;
				this.fireArgs = fireArgs;
			}
			if(this.numHandlers) {
				// Copy the values first so that it is safe to modify it from within
				// callbacks.
				var toCall = [];
				for(var item in this.handlers) {
					toCall.push(this.handlers[item]);
				}
				for(var i = 0; i < toCall.length; ++i) {
					toCall[i].apply(this, fireArgs);
				}
				if(this.state == 2 && this.numHandlers) {
					this.numHandlers = 0;
					this.handlers = {};
					this.onHasSubscribersChange && this.onHasSubscribersChange();
				}
			}
		};

		// defining them here so they are ready super fast!
		// DOM event that is received when the web page is loaded and parsed.
		channel.createSticky('onDOMContentLoaded');

		// Event to indicate the Cordova native side is ready.
		channel.createSticky('onNativeReady');

		// Event to indicate that all Cordova JavaScript objects have been created
		// and it's time to run plugin constructors.
		channel.createSticky('onCordovaReady');

		// Event to indicate that all automatically loaded JS plugins are loaded and ready.
		// FIXME remove this
		channel.createSticky('onPluginsReady');

		// Event to indicate that Cordova is ready
		channel.createSticky('onDeviceReady');

		// Event to indicate a resume lifecycle event
		channel.create('onResume');

		// Event to indicate a pause lifecycle event
		channel.create('onPause');

		// Channels that must fire before "deviceready" is fired.
		channel.waitForInitialization('onCordovaReady');
		channel.waitForInitialization('onDOMContentLoaded');

		module.exports = channel;

	});

	// file: /Users/steveng/repo/cordova/cordova-android/cordova-js-src/exec.js
	define("cordova/exec", function(require, exports, module) {

		/**
		 * Execute a cordova command.  It is up to the native side whether this action
		 * is synchronous or asynchronous.  The native side can return:
		 *      Synchronous: PluginResult object as a JSON string
		 *      Asynchronous: Empty string ""
		 * If async, the native side will cordova.callbackSuccess or cordova.callbackError,
		 * depending upon the result of the action.
		 *
		 * @param {Function} success    The success callback
		 * @param {Function} fail       The fail callback
		 * @param {String} service      The name of the service to use
		 * @param {String} action       Action to be run in cordova
		 * @param {String[]} [args]     Zero or more arguments to pass to the method
		 */
		var cordova = require('cordova'),
			nativeApiProvider = require('cordova/android/nativeapiprovider'),
			utils = require('cordova/utils'),
			base64 = require('cordova/base64'),
			channel = require('cordova/channel'),
			jsToNativeModes = {
				PROMPT: 0,
				JS_OBJECT: 1
			},
			nativeToJsModes = {
				// Polls for messages using the JS->Native bridge.
				POLLING: 0,
				// For LOAD_URL to be viable, it would need to have a work-around for
				// the bug where the soft-keyboard gets dismissed when a message is sent.
				LOAD_URL: 1,
				// For the ONLINE_EVENT to be viable, it would need to intercept all event
				// listeners (both through addEventListener and window.ononline) as well
				// as set the navigator property itself.
				ONLINE_EVENT: 2
			},
			jsToNativeBridgeMode, // Set lazily.
			nativeToJsBridgeMode = nativeToJsModes.ONLINE_EVENT,
			pollEnabled = false,
			bridgeSecret = -1;

		var messagesFromNative = [];
		var isProcessing = false;
		var resolvedPromise = typeof Promise == 'undefined' ? null : Promise.resolve();
		var nextTick = resolvedPromise ? function(fn) {
			resolvedPromise.then(fn);
		} : function(fn) {
			setTimeout(fn);
		};

		function androidExec(success, fail, service, action, args) {
			if(bridgeSecret < 0) {
				// If we ever catch this firing, we'll need to queue up exec()s
				// and fire them once we get a secret. For now, I don't think
				// it's possible for exec() to be called since plugins are parsed but
				// not run until until after onNativeReady.
				throw new Error('exec() called without bridgeSecret');
			}
			// Set default bridge modes if they have not already been set.
			// By default, we use the failsafe, since addJavascriptInterface breaks too often
			if(jsToNativeBridgeMode === undefined) {
				androidExec.setJsToNativeBridgeMode(jsToNativeModes.JS_OBJECT);
			}

			// Process any ArrayBuffers in the args into a string.
			for(var i = 0; i < args.length; i++) {
				if(utils.typeName(args[i]) == 'ArrayBuffer') {
					args[i] = base64.fromArrayBuffer(args[i]);
				}
			}

			var callbackId = service + cordova.callbackId++,
				argsJson = JSON.stringify(args);

			if(success || fail) {
				cordova.callbacks[callbackId] = {
					success: success,
					fail: fail
				};
			}

			var msgs = nativeApiProvider.get().exec(bridgeSecret, service, action, callbackId, argsJson);
			// If argsJson was received by Java as null, try again with the PROMPT bridge mode.
			// This happens in rare circumstances, such as when certain Unicode characters are passed over the bridge on a Galaxy S2.  See CB-2666.
			if(jsToNativeBridgeMode == jsToNativeModes.JS_OBJECT && msgs === "@Null arguments.") {
				androidExec.setJsToNativeBridgeMode(jsToNativeModes.PROMPT);
				androidExec(success, fail, service, action, args);
				androidExec.setJsToNativeBridgeMode(jsToNativeModes.JS_OBJECT);
			} else if(msgs) {
				messagesFromNative.push(msgs);
				// Always process async to avoid exceptions messing up stack.
				nextTick(processMessages);
			}
		}

		androidExec.init = function() {
			bridgeSecret = +prompt('', 'gap_init:' + nativeToJsBridgeMode);
			channel.onNativeReady.fire();
		};

		function pollOnceFromOnlineEvent() {
			pollOnce(true);
		}

		function pollOnce(opt_fromOnlineEvent) {
			if(bridgeSecret < 0) {
				// This can happen when the NativeToJsMessageQueue resets the online state on page transitions.
				// We know there's nothing to retrieve, so no need to poll.
				return;
			}
			var msgs = nativeApiProvider.get().retrieveJsMessages(bridgeSecret, !!opt_fromOnlineEvent);
			if(msgs) {
				messagesFromNative.push(msgs);
				// Process sync since we know we're already top-of-stack.
				processMessages();
			}
		}

		function pollingTimerFunc() {
			if(pollEnabled) {
				pollOnce();
				setTimeout(pollingTimerFunc, 50);
			}
		}

		function hookOnlineApis() {
			function proxyEvent(e) {
				cordova.fireWindowEvent(e.type);
			}
			// The network module takes care of firing online and offline events.
			// It currently fires them only on document though, so we bridge them
			// to window here (while first listening for exec()-releated online/offline
			// events).
			window.addEventListener('online', pollOnceFromOnlineEvent, false);
			window.addEventListener('offline', pollOnceFromOnlineEvent, false);
			cordova.addWindowEventHandler('online');
			cordova.addWindowEventHandler('offline');
			document.addEventListener('online', proxyEvent, false);
			document.addEventListener('offline', proxyEvent, false);
		}

		hookOnlineApis();

		androidExec.jsToNativeModes = jsToNativeModes;
		androidExec.nativeToJsModes = nativeToJsModes;

		androidExec.setJsToNativeBridgeMode = function(mode) {
			if(mode == jsToNativeModes.JS_OBJECT && !window._cordovaNative) {
				mode = jsToNativeModes.PROMPT;
			}
			nativeApiProvider.setPreferPrompt(mode == jsToNativeModes.PROMPT);
			jsToNativeBridgeMode = mode;
		};

		androidExec.setNativeToJsBridgeMode = function(mode) {
			if(mode == nativeToJsBridgeMode) {
				return;
			}
			if(nativeToJsBridgeMode == nativeToJsModes.POLLING) {
				pollEnabled = false;
			}

			nativeToJsBridgeMode = mode;
			// Tell the native side to switch modes.
			// Otherwise, it will be set by androidExec.init()
			if(bridgeSecret >= 0) {
				nativeApiProvider.get().setNativeToJsBridgeMode(bridgeSecret, mode);
			}

			if(mode == nativeToJsModes.POLLING) {
				pollEnabled = true;
				setTimeout(pollingTimerFunc, 1);
			}
		};

		function buildPayload(payload, message) {
			var payloadKind = message.charAt(0);
			if(payloadKind == 's') {
				payload.push(message.slice(1));
			} else if(payloadKind == 't') {
				payload.push(true);
			} else if(payloadKind == 'f') {
				payload.push(false);
			} else if(payloadKind == 'N') {
				payload.push(null);
			} else if(payloadKind == 'n') {
				payload.push(+message.slice(1));
			} else if(payloadKind == 'A') {
				var data = message.slice(1);
				payload.push(base64.toArrayBuffer(data));
			} else if(payloadKind == 'S') {
				payload.push(window.atob(message.slice(1)));
			} else if(payloadKind == 'M') {
				var multipartMessages = message.slice(1);
				while(multipartMessages !== "") {
					var spaceIdx = multipartMessages.indexOf(' ');
					var msgLen = +multipartMessages.slice(0, spaceIdx);
					var multipartMessage = multipartMessages.substr(spaceIdx + 1, msgLen);
					multipartMessages = multipartMessages.slice(spaceIdx + msgLen + 1);
					buildPayload(payload, multipartMessage);
				}
			} else {
				payload.push(JSON.parse(message));
			}
		}

		// Processes a single message, as encoded by NativeToJsMessageQueue.java.
		function processMessage(message) {
			var firstChar = message.charAt(0);
			if(firstChar == 'J') {
				// This is deprecated on the .java side. It doesn't work with CSP enabled.
				eval(message.slice(1));
			} else if(firstChar == 'S' || firstChar == 'F') {
				var success = firstChar == 'S';
				var keepCallback = message.charAt(1) == '1';
				var spaceIdx = message.indexOf(' ', 2);
				var status = +message.slice(2, spaceIdx);
				var nextSpaceIdx = message.indexOf(' ', spaceIdx + 1);
				var callbackId = message.slice(spaceIdx + 1, nextSpaceIdx);
				var payloadMessage = message.slice(nextSpaceIdx + 1);
				var payload = [];
				buildPayload(payload, payloadMessage);
				cordova.callbackFromNative(callbackId, success, status, payload, keepCallback);
			} else {
				console.log("processMessage failed: invalid message: " + JSON.stringify(message));
			}
		}

		function processMessages() {
			// Check for the reentrant case.
			if(isProcessing) {
				return;
			}
			if(messagesFromNative.length === 0) {
				return;
			}
			isProcessing = true;
			try {
				var msg = popMessageFromQueue();
				// The Java side can send a * message to indicate that it
				// still has messages waiting to be retrieved.
				if(msg == '*' && messagesFromNative.length === 0) {
					nextTick(pollOnce);
					return;
				}
				processMessage(msg);
			} finally {
				isProcessing = false;
				if(messagesFromNative.length > 0) {
					nextTick(processMessages);
				}
			}
		}

		function popMessageFromQueue() {
			var messageBatch = messagesFromNative.shift();
			if(messageBatch == '*') {
				return '*';
			}

			var spaceIdx = messageBatch.indexOf(' ');
			var msgLen = +messageBatch.slice(0, spaceIdx);
			var message = messageBatch.substr(spaceIdx + 1, msgLen);
			messageBatch = messageBatch.slice(spaceIdx + msgLen + 1);
			if(messageBatch) {
				messagesFromNative.unshift(messageBatch);
			}
			return message;
		}

		module.exports = androidExec;

	});

	// file: src/common/exec/proxy.js
	define("cordova/exec/proxy", function(require, exports, module) {

		// internal map of proxy function
		var CommandProxyMap = {};

		module.exports = {

			// example: cordova.commandProxy.add("Accelerometer",{getCurrentAcceleration: function(successCallback, errorCallback, options) {...},...);
			add: function(id, proxyObj) {
				console.log("adding proxy for " + id);
				CommandProxyMap[id] = proxyObj;
				return proxyObj;
			},

			// cordova.commandProxy.remove("Accelerometer");
			remove: function(id) {
				var proxy = CommandProxyMap[id];
				delete CommandProxyMap[id];
				CommandProxyMap[id] = null;
				return proxy;
			},

			get: function(service, action) {
				return(CommandProxyMap[service] ? CommandProxyMap[service][action] : null);
			}
		};
	});

	// file: src/common/init.js
	define("cordova/init", function(require, exports, module) {

		var channel = require('cordova/channel');
		var cordova = require('cordova');
		var modulemapper = require('cordova/modulemapper');
		var platform = require('cordova/platform');
		var pluginloader = require('cordova/pluginloader');
		var utils = require('cordova/utils');

		var platformInitChannelsArray = [channel.onNativeReady, channel.onPluginsReady];

		function logUnfiredChannels(arr) {
			for(var i = 0; i < arr.length; ++i) {
				if(arr[i].state != 2) {
					console.log('Channel not fired: ' + arr[i].type);
				}
			}
		}

		window.setTimeout(function() {
			if(channel.onDeviceReady.state != 2) {
				console.log('deviceready has not fired after 50 seconds.');
				logUnfiredChannels(platformInitChannelsArray);
				logUnfiredChannels(channel.deviceReadyChannelsArray);
			}
		}, 50000);

		// Replace navigator before any modules are required(), to ensure it happens as soon as possible.
		// We replace it so that properties that can't be clobbered can instead be overridden.
		function replaceNavigator(origNavigator) {
			var CordovaNavigator = function() {};
			CordovaNavigator.prototype = origNavigator;
			var newNavigator = new CordovaNavigator();
			// This work-around really only applies to new APIs that are newer than Function.bind.
			// Without it, APIs such as getGamepads() break.
			if(CordovaNavigator.bind) {
				for(var key in origNavigator) {
					if(typeof origNavigator[key] == 'function') {
						newNavigator[key] = origNavigator[key].bind(origNavigator);
					} else {
						(function(k) {
							utils.defineGetterSetter(newNavigator, key, function() {
								return origNavigator[k];
							});
						})(key);
					}
				}
			}
			return newNavigator;
		}

		if(window.navigator) {
			window.navigator = replaceNavigator(window.navigator);
		}

		if(!window.console) {
			window.console = {
				log: function() {}
			};
		}
		if(!window.console.warn) {
			window.console.warn = function(msg) {
				this.log("warn: " + msg);
			};
		}

		// Register pause, resume and deviceready channels as events on document.
		channel.onPause = cordova.addDocumentEventHandler('pause');
		channel.onResume = cordova.addDocumentEventHandler('resume');
		channel.onActivated = cordova.addDocumentEventHandler('activated');
		channel.onDeviceReady = cordova.addStickyDocumentEventHandler('deviceready');

		// Listen for DOMContentLoaded and notify our channel subscribers.
		if(document.readyState == 'complete' || document.readyState == 'interactive') {
			channel.onDOMContentLoaded.fire();
		} else {
			document.addEventListener('DOMContentLoaded', function() {
				channel.onDOMContentLoaded.fire();
			}, false);
		}

		// _nativeReady is global variable that the native side can set
		// to signify that the native code is ready. It is a global since
		// it may be called before any cordova JS is ready.
		if(window._nativeReady) {
			channel.onNativeReady.fire();
		}

		modulemapper.clobbers('cordova', 'cordova');
		modulemapper.clobbers('cordova/exec', 'cordova.exec');
		modulemapper.clobbers('cordova/exec', 'Cordova.exec');

		// Call the platform-specific initialization.
		platform.bootstrap && platform.bootstrap();

		// Wrap in a setTimeout to support the use-case of having plugin JS appended to cordova.js.
		// The delay allows the attached modules to be defined before the plugin loader looks for them.
		setTimeout(function() {
			pluginloader.load(function() {
				channel.onPluginsReady.fire();
			});
		}, 0);

		/**
		 * Create all cordova objects once native side is ready.
		 */
		channel.join(function() {
			modulemapper.mapModules(window);

			platform.initialize && platform.initialize();

			// Fire event to notify that all objects are created
			channel.onCordovaReady.fire();

			// Fire onDeviceReady event once page has fully loaded, all
			// constructors have run and cordova info has been received from native
			// side.
			channel.join(function() {
				require('cordova').fireDocumentEvent('deviceready');
			}, channel.deviceReadyChannelsArray);

		}, platformInitChannelsArray);

	});

	// file: src/common/init_b.js
	define("cordova/init_b", function(require, exports, module) {

		var channel = require('cordova/channel');
		var cordova = require('cordova');
		var modulemapper = require('cordova/modulemapper');
		var platform = require('cordova/platform');
		var pluginloader = require('cordova/pluginloader');
		var utils = require('cordova/utils');

		var platformInitChannelsArray = [channel.onDOMContentLoaded, channel.onNativeReady, channel.onPluginsReady];

		// setting exec
		cordova.exec = require('cordova/exec');

		function logUnfiredChannels(arr) {
			for(var i = 0; i < arr.length; ++i) {
				if(arr[i].state != 2) {
					console.log('Channel not fired: ' + arr[i].type);
				}
			}
		}

		window.setTimeout(function() {
			if(channel.onDeviceReady.state != 2) {
				console.log('deviceready has not fired after 50 seconds.');
				logUnfiredChannels(platformInitChannelsArray);
				logUnfiredChannels(channel.deviceReadyChannelsArray);
			}
		}, 50000);

		// Replace navigator before any modules are required(), to ensure it happens as soon as possible.
		// We replace it so that properties that can't be clobbered can instead be overridden.
		function replaceNavigator(origNavigator) {
			var CordovaNavigator = function() {};
			CordovaNavigator.prototype = origNavigator;
			var newNavigator = new CordovaNavigator();
			// This work-around really only applies to new APIs that are newer than Function.bind.
			// Without it, APIs such as getGamepads() break.
			if(CordovaNavigator.bind) {
				for(var key in origNavigator) {
					if(typeof origNavigator[key] == 'function') {
						newNavigator[key] = origNavigator[key].bind(origNavigator);
					} else {
						(function(k) {
							utils.defineGetterSetter(newNavigator, key, function() {
								return origNavigator[k];
							});
						})(key);
					}
				}
			}
			return newNavigator;
		}
		if(window.navigator) {
			window.navigator = replaceNavigator(window.navigator);
		}

		if(!window.console) {
			window.console = {
				log: function() {}
			};
		}
		if(!window.console.warn) {
			window.console.warn = function(msg) {
				this.log("warn: " + msg);
			};
		}

		// Register pause, resume and deviceready channels as events on document.
		channel.onPause = cordova.addDocumentEventHandler('pause');
		channel.onResume = cordova.addDocumentEventHandler('resume');
		channel.onActivated = cordova.addDocumentEventHandler('activated');
		channel.onDeviceReady = cordova.addStickyDocumentEventHandler('deviceready');

		// Listen for DOMContentLoaded and notify our channel subscribers.
		if(document.readyState == 'complete' || document.readyState == 'interactive') {
			channel.onDOMContentLoaded.fire();
		} else {
			document.addEventListener('DOMContentLoaded', function() {
				channel.onDOMContentLoaded.fire();
			}, false);
		}

		// _nativeReady is global variable that the native side can set
		// to signify that the native code is ready. It is a global since
		// it may be called before any cordova JS is ready.
		if(window._nativeReady) {
			channel.onNativeReady.fire();
		}

		// Call the platform-specific initialization.
		platform.bootstrap && platform.bootstrap();

		// Wrap in a setTimeout to support the use-case of having plugin JS appended to cordova.js.
		// The delay allows the attached modules to be defined before the plugin loader looks for them.
		setTimeout(function() {
			pluginloader.load(function() {
				channel.onPluginsReady.fire();
			});
		}, 0);

		/**
		 * Create all cordova objects once native side is ready.
		 */
		channel.join(function() {
			modulemapper.mapModules(window);

			platform.initialize && platform.initialize();

			// Fire event to notify that all objects are created
			channel.onCordovaReady.fire();

			// Fire onDeviceReady event once page has fully loaded, all
			// constructors have run and cordova info has been received from native
			// side.
			channel.join(function() {
				require('cordova').fireDocumentEvent('deviceready');
			}, channel.deviceReadyChannelsArray);

		}, platformInitChannelsArray);

	});

	// file: src/common/modulemapper.js
	define("cordova/modulemapper", function(require, exports, module) {

		var builder = require('cordova/builder'),
			moduleMap = define.moduleMap,
			symbolList,
			deprecationMap;

		exports.reset = function() {
			symbolList = [];
			deprecationMap = {};
		};

		function addEntry(strategy, moduleName, symbolPath, opt_deprecationMessage) {
			if(!(moduleName in moduleMap)) {
				throw new Error('Module ' + moduleName + ' does not exist.');
			}
			symbolList.push(strategy, moduleName, symbolPath);
			if(opt_deprecationMessage) {
				deprecationMap[symbolPath] = opt_deprecationMessage;
			}
		}

		// Note: Android 2.3 does have Function.bind().
		exports.clobbers = function(moduleName, symbolPath, opt_deprecationMessage) {
			addEntry('c', moduleName, symbolPath, opt_deprecationMessage);
		};

		exports.merges = function(moduleName, symbolPath, opt_deprecationMessage) {
			addEntry('m', moduleName, symbolPath, opt_deprecationMessage);
		};

		exports.defaults = function(moduleName, symbolPath, opt_deprecationMessage) {
			addEntry('d', moduleName, symbolPath, opt_deprecationMessage);
		};

		exports.runs = function(moduleName) {
			addEntry('r', moduleName, null);
		};

		function prepareNamespace(symbolPath, context) {
			if(!symbolPath) {
				return context;
			}
			var parts = symbolPath.split('.');
			var cur = context;
			for(var i = 0, part; part = parts[i]; ++i) {
				cur = cur[part] = cur[part] || {};
			}
			return cur;
		}

		exports.mapModules = function(context) {
			var origSymbols = {};
			context.CDV_origSymbols = origSymbols;
			for(var i = 0, len = symbolList.length; i < len; i += 3) {
				var strategy = symbolList[i];
				var moduleName = symbolList[i + 1];
				var module = require(moduleName);
				// <runs/>
				if(strategy == 'r') {
					continue;
				}
				var symbolPath = symbolList[i + 2];
				var lastDot = symbolPath.lastIndexOf('.');
				var namespace = symbolPath.substr(0, lastDot);
				var lastName = symbolPath.substr(lastDot + 1);

				var deprecationMsg = symbolPath in deprecationMap ? 'Access made to deprecated symbol: ' + symbolPath + '. ' + deprecationMsg : null;
				var parentObj = prepareNamespace(namespace, context);
				var target = parentObj[lastName];

				if(strategy == 'm' && target) {
					builder.recursiveMerge(target, module);
				} else if((strategy == 'd' && !target) || (strategy != 'd')) {
					if(!(symbolPath in origSymbols)) {
						origSymbols[symbolPath] = target;
					}
					builder.assignOrWrapInDeprecateGetter(parentObj, lastName, module, deprecationMsg);
				}
			}
		};

		exports.getOriginalSymbol = function(context, symbolPath) {
			var origSymbols = context.CDV_origSymbols;
			if(origSymbols && (symbolPath in origSymbols)) {
				return origSymbols[symbolPath];
			}
			var parts = symbolPath.split('.');
			var obj = context;
			for(var i = 0; i < parts.length; ++i) {
				obj = obj && obj[parts[i]];
			}
			return obj;
		};

		exports.reset();

	});

	// file: src/common/modulemapper_b.js
	define("cordova/modulemapper_b", function(require, exports, module) {

		var builder = require('cordova/builder'),
			symbolList = [],
			deprecationMap;

		exports.reset = function() {
			symbolList = [];
			deprecationMap = {};
		};

		function addEntry(strategy, moduleName, symbolPath, opt_deprecationMessage) {
			symbolList.push(strategy, moduleName, symbolPath);
			if(opt_deprecationMessage) {
				deprecationMap[symbolPath] = opt_deprecationMessage;
			}
		}

		// Note: Android 2.3 does have Function.bind().
		exports.clobbers = function(moduleName, symbolPath, opt_deprecationMessage) {
			addEntry('c', moduleName, symbolPath, opt_deprecationMessage);
		};

		exports.merges = function(moduleName, symbolPath, opt_deprecationMessage) {
			addEntry('m', moduleName, symbolPath, opt_deprecationMessage);
		};

		exports.defaults = function(moduleName, symbolPath, opt_deprecationMessage) {
			addEntry('d', moduleName, symbolPath, opt_deprecationMessage);
		};

		exports.runs = function(moduleName) {
			addEntry('r', moduleName, null);
		};

		function prepareNamespace(symbolPath, context) {
			if(!symbolPath) {
				return context;
			}
			var parts = symbolPath.split('.');
			var cur = context;
			for(var i = 0, part; part = parts[i]; ++i) {
				cur = cur[part] = cur[part] || {};
			}
			return cur;
		}

		exports.mapModules = function(context) {
			var origSymbols = {};
			context.CDV_origSymbols = origSymbols;
			for(var i = 0, len = symbolList.length; i < len; i += 3) {
				var strategy = symbolList[i];
				var moduleName = symbolList[i + 1];
				var module = require(moduleName);
				// <runs/>
				if(strategy == 'r') {
					continue;
				}
				var symbolPath = symbolList[i + 2];
				var lastDot = symbolPath.lastIndexOf('.');
				var namespace = symbolPath.substr(0, lastDot);
				var lastName = symbolPath.substr(lastDot + 1);

				var deprecationMsg = symbolPath in deprecationMap ? 'Access made to deprecated symbol: ' + symbolPath + '. ' + deprecationMsg : null;
				var parentObj = prepareNamespace(namespace, context);
				var target = parentObj[lastName];

				if(strategy == 'm' && target) {
					builder.recursiveMerge(target, module);
				} else if((strategy == 'd' && !target) || (strategy != 'd')) {
					if(!(symbolPath in origSymbols)) {
						origSymbols[symbolPath] = target;
					}
					builder.assignOrWrapInDeprecateGetter(parentObj, lastName, module, deprecationMsg);
				}
			}
		};

		exports.getOriginalSymbol = function(context, symbolPath) {
			var origSymbols = context.CDV_origSymbols;
			if(origSymbols && (symbolPath in origSymbols)) {
				return origSymbols[symbolPath];
			}
			var parts = symbolPath.split('.');
			var obj = context;
			for(var i = 0; i < parts.length; ++i) {
				obj = obj && obj[parts[i]];
			}
			return obj;
		};

		exports.reset();

	});

	// file: /Users/steveng/repo/cordova/cordova-android/cordova-js-src/platform.js
	define("cordova/platform", function(require, exports, module) {

		// The last resume event that was received that had the result of a plugin call.
		var lastResumeEvent = null;

		module.exports = {
			id: 'android',
			bootstrap: function() {
				var channel = require('cordova/channel'),
					cordova = require('cordova'),
					exec = require('cordova/exec'),
					modulemapper = require('cordova/modulemapper');

				// Get the shared secret needed to use the bridge.
				exec.init();

				// TODO: Extract this as a proper plugin.
				modulemapper.clobbers('cordova/plugin/android/app', 'navigator.app');

				var APP_PLUGIN_NAME = Number(cordova.platformVersion.split('.')[0]) >= 4 ? 'CoreAndroid' : 'App';

				// Inject a listener for the backbutton on the document.
				var backButtonChannel = cordova.addDocumentEventHandler('backbutton');
				backButtonChannel.onHasSubscribersChange = function() {
					// If we just attached the first handler or detached the last handler,
					// let native know we need to override the back button.
					exec(null, null, APP_PLUGIN_NAME, "overrideBackbutton", [this.numHandlers == 1]);
				};

				// Add hardware MENU and SEARCH button handlers
				cordova.addDocumentEventHandler('menubutton');
				cordova.addDocumentEventHandler('searchbutton');

				function bindButtonChannel(buttonName) {
					// generic button bind used for volumeup/volumedown buttons
					var volumeButtonChannel = cordova.addDocumentEventHandler(buttonName + 'button');
					volumeButtonChannel.onHasSubscribersChange = function() {
						exec(null, null, APP_PLUGIN_NAME, "overrideButton", [buttonName, this.numHandlers == 1]);
					};
				}
				// Inject a listener for the volume buttons on the document.
				bindButtonChannel('volumeup');
				bindButtonChannel('volumedown');

				// The resume event is not "sticky", but it is possible that the event
				// will contain the result of a plugin call. We need to ensure that the
				// plugin result is delivered even after the event is fired (CB-10498)
				var cordovaAddEventListener = document.addEventListener;

				document.addEventListener = function(evt, handler, capture) {
					cordovaAddEventListener(evt, handler, capture);

					if(evt === 'resume' && lastResumeEvent) {
						handler(lastResumeEvent);
					}
				};

				// Let native code know we are all done on the JS side.
				// Native code will then un-hide the WebView.
				channel.onCordovaReady.subscribe(function() {
					exec(onMessageFromNative, null, APP_PLUGIN_NAME, 'messageChannel', []);
					exec(null, null, APP_PLUGIN_NAME, "show", []);
				});
			}
		};

		function onMessageFromNative(msg) {
			var cordova = require('cordova');
			var action = msg.action;

			switch(action) {
				// Button events
				case 'backbutton':
				case 'backbuttondown':
				case 'menubutton':
				case 'searchbutton':
					// App life cycle events
				case 'pause':
					// Volume events
				case 'volumedownbutton':
				case 'volumeupbutton':
					cordova.fireDocumentEvent(action);
					break;
				case 'resume':
					if(arguments.length > 1 && msg.pendingResult) {
						if(arguments.length === 2) {
							msg.pendingResult.result = arguments[1];
						} else {
							// The plugin returned a multipart message
							var res = [];
							for(var i = 1; i < arguments.length; i++) {
								res.push(arguments[i]);
							}
							msg.pendingResult.result = res;
						}

						// Save the plugin result so that it can be delivered to the js
						// even if they miss the initial firing of the event
						lastResumeEvent = msg;
					}
					cordova.fireDocumentEvent(action, msg);
					break;
				default:
					throw new Error('Unknown event action ' + action);
			}
		}

	});

	// file: /Users/steveng/repo/cordova/cordova-android/cordova-js-src/plugin/android/app.js
	define("cordova/plugin/android/app", function(require, exports, module) {

		var exec = require('cordova/exec');
		var APP_PLUGIN_NAME = Number(require('cordova').platformVersion.split('.')[0]) >= 4 ? 'CoreAndroid' : 'App';

		module.exports = {
			/**
			 * Clear the resource cache.
			 */
			clearCache: function() {
				exec(null, null, APP_PLUGIN_NAME, "clearCache", []);
			},

			/**
			 * Load the url into the webview or into new browser instance.
			 *
			 * @param url           The URL to load
			 * @param props         Properties that can be passed in to the activity:
			 *      wait: int                           => wait msec before loading URL
			 *      loadingDialog: "Title,Message"      => display a native loading dialog
			 *      loadUrlTimeoutValue: int            => time in msec to wait before triggering a timeout error
			 *      clearHistory: boolean              => clear webview history (default=false)
			 *      openExternal: boolean              => open in a new browser (default=false)
			 *
			 * Example:
			 *      navigator.app.loadUrl("http://server/myapp/index.html", {wait:2000, loadingDialog:"Wait,Loading App", loadUrlTimeoutValue: 60000});
			 */
			loadUrl: function(url, props) {
				exec(null, null, APP_PLUGIN_NAME, "loadUrl", [url, props]);
			},

			/**
			 * Cancel loadUrl that is waiting to be loaded.
			 */
			cancelLoadUrl: function() {
				exec(null, null, APP_PLUGIN_NAME, "cancelLoadUrl", []);
			},

			/**
			 * Clear web history in this web view.
			 * Instead of BACK button loading the previous web page, it will exit the app.
			 */
			clearHistory: function() {
				exec(null, null, APP_PLUGIN_NAME, "clearHistory", []);
			},

			/**
			 * Go to previous page displayed.
			 * This is the same as pressing the backbutton on Android device.
			 */
			backHistory: function() {
				exec(null, null, APP_PLUGIN_NAME, "backHistory", []);
			},

			/**
			 * Override the default behavior of the Android back button.
			 * If overridden, when the back button is pressed, the "backKeyDown" JavaScript event will be fired.
			 *
			 * Note: The user should not have to call this method.  Instead, when the user
			 *       registers for the "backbutton" event, this is automatically done.
			 *
			 * @param override        T=override, F=cancel override
			 */
			overrideBackbutton: function(override) {
				exec(null, null, APP_PLUGIN_NAME, "overrideBackbutton", [override]);
			},

			/**
			 * Override the default behavior of the Android volume button.
			 * If overridden, when the volume button is pressed, the "volume[up|down]button"
			 * JavaScript event will be fired.
			 *
			 * Note: The user should not have to call this method.  Instead, when the user
			 *       registers for the "volume[up|down]button" event, this is automatically done.
			 *
			 * @param button          volumeup, volumedown
			 * @param override        T=override, F=cancel override
			 */
			overrideButton: function(button, override) {
				exec(null, null, APP_PLUGIN_NAME, "overrideButton", [button, override]);
			},

			/**
			 * Exit and terminate the application.
			 */
			exitApp: function() {
				return exec(null, null, APP_PLUGIN_NAME, "exitApp", []);
			}
		};

	});

	// file: src/common/pluginloader.js
	define("cordova/pluginloader", function(require, exports, module) {

		var modulemapper = require('cordova/modulemapper');
		var urlutil = require('cordova/urlutil');

		// Helper function to inject a <script> tag.
		// Exported for testing.
		exports.injectScript = function(url, onload, onerror) {
			var script = document.createElement("script");
			// onload fires even when script fails loads with an error.
			script.onload = onload;
			// onerror fires for malformed URLs.
			script.onerror = onerror;
			script.src = url;
			document.head.appendChild(script);
		};

		function injectIfNecessary(id, url, onload, onerror) {
			onerror = onerror || onload;
			if(id in define.moduleMap) {
				onload();
			} else {
				exports.injectScript(url, function() {
					if(id in define.moduleMap) {
						onload();
					} else {
						onerror();
					}
				}, onerror);
			}
		}

		function onScriptLoadingComplete(moduleList, finishPluginLoading) {
			// Loop through all the plugins and then through their clobbers and merges.
			for(var i = 0, module; module = moduleList[i]; i++) {
				if(module.clobbers && module.clobbers.length) {
					for(var j = 0; j < module.clobbers.length; j++) {
						modulemapper.clobbers(module.id, module.clobbers[j]);
					}
				}

				if(module.merges && module.merges.length) {
					for(var k = 0; k < module.merges.length; k++) {
						modulemapper.merges(module.id, module.merges[k]);
					}
				}

				// Finally, if runs is truthy we want to simply require() the module.
				if(module.runs) {
					modulemapper.runs(module.id);
				}
			}

			finishPluginLoading();
		}

		// Handler for the cordova_plugins.js content.
		// See plugman's plugin_loader.js for the details of this object.
		// This function is only called if the really is a plugins array that isn't empty.
		// Otherwise the onerror response handler will just call finishPluginLoading().
		function handlePluginsObject(path, moduleList, finishPluginLoading) {
			// Now inject the scripts.
			var scriptCounter = moduleList.length;

			if(!scriptCounter) {
				finishPluginLoading();
				return;
			}

			function scriptLoadedCallback() {
				if(!--scriptCounter) {
					onScriptLoadingComplete(moduleList, finishPluginLoading);
				}
			}

			for(var i = 0; i < moduleList.length; i++) {
				injectIfNecessary(moduleList[i].id, path + moduleList[i].file, scriptLoadedCallback);
			}
		}

		function findCordovaPath() {
			var path = null;
			var scripts = document.getElementsByTagName('script');
			var term = __uri('js/jquery-1.8.3.min.js');
			console.log("---------term--------" + term);
			for(var n = scripts.length - 1; n > -1; n--) {
				var src = scripts[n].src.replace(/\?.*$/, ''); // Strip any query param (CB-6007).
				if(src.indexOf(term) == (src.length - term.length)) {
					path = src.substring(0, src.length - term.length) + '/';
					break;
				}
			}
			console.log("---------path--------" + path);
			return path;
		}

		// Tries to load all plugins' js-modules.
		// This is an async process, but onDeviceReady is blocked on onPluginsReady.
		// onPluginsReady is fired when there are no plugins to load, or they are all done.
		exports.load = function(callback) {
			var pathPrefix = findCordovaPath();
			if(pathPrefix === null) {
				console.log('Could not find cordova.js script tag. Plugin loading may fail.');
				pathPrefix = '';
			}
			var pluginsjspath = pathPrefix + __uri('cordova_plugins.js');
			injectIfNecessary('cordova/plugin_list', pluginsjspath, /*pathPrefix + 'cordova_plugins.js',*/ function() {
				var moduleList = require("cordova/plugin_list");
				handlePluginsObject(pathPrefix, moduleList, callback);
			}, callback);
		};

	});

	// file: src/common/pluginloader_b.js
	define("cordova/pluginloader_b", function(require, exports, module) {

		var modulemapper = require('cordova/modulemapper');

		// Handler for the cordova_plugins.js content.
		// See plugman's plugin_loader.js for the details of this object.
		function handlePluginsObject(moduleList) {
			// if moduleList is not defined or empty, we've nothing to do
			if(!moduleList || !moduleList.length) {
				return;
			}

			// Loop through all the modules and then through their clobbers and merges.
			for(var i = 0, module; module = moduleList[i]; i++) {
				if(module.clobbers && module.clobbers.length) {
					for(var j = 0; j < module.clobbers.length; j++) {
						modulemapper.clobbers(module.id, module.clobbers[j]);
					}
				}

				if(module.merges && module.merges.length) {
					for(var k = 0; k < module.merges.length; k++) {
						modulemapper.merges(module.id, module.merges[k]);
					}
				}

				// Finally, if runs is truthy we want to simply require() the module.
				if(module.runs) {
					modulemapper.runs(module.id);
				}
			}
		}

		// Loads all plugins' js-modules. Plugin loading is syncronous in browserified bundle
		// but the method accepts callback to be compatible with non-browserify flow.
		// onDeviceReady is blocked on onPluginsReady. onPluginsReady is fired when there are
		// no plugins to load, or they are all done.
		exports.load = function(callback) {
			var moduleList = require("cordova/plugin_list");
			handlePluginsObject(moduleList);

			callback();
		};

	});

	// file: src/common/urlutil.js
	define("cordova/urlutil", function(require, exports, module) {

		/**
		 * For already absolute URLs, returns what is passed in.
		 * For relative URLs, converts them to absolute ones.
		 */
		exports.makeAbsolute = function makeAbsolute(url) {
			var anchorEl = document.createElement('a');
			anchorEl.href = url;
			return anchorEl.href;
		};

	});

	// file: src/common/utils.js
	define("cordova/utils", function(require, exports, module) {

		var utils = exports;

		/**
		 * Defines a property getter / setter for obj[key].
		 */
		utils.defineGetterSetter = function(obj, key, getFunc, opt_setFunc) {
			if(Object.defineProperty) {
				var desc = {
					get: getFunc,
					configurable: true
				};
				if(opt_setFunc) {
					desc.set = opt_setFunc;
				}
				Object.defineProperty(obj, key, desc);
			} else {
				obj.__defineGetter__(key, getFunc);
				if(opt_setFunc) {
					obj.__defineSetter__(key, opt_setFunc);
				}
			}
		};

		/**
		 * Defines a property getter for obj[key].
		 */
		utils.defineGetter = utils.defineGetterSetter;

		utils.arrayIndexOf = function(a, item) {
			if(a.indexOf) {
				return a.indexOf(item);
			}
			var len = a.length;
			for(var i = 0; i < len; ++i) {
				if(a[i] == item) {
					return i;
				}
			}
			return -1;
		};

		/**
		 * Returns whether the item was found in the array.
		 */
		utils.arrayRemove = function(a, item) {
			var index = utils.arrayIndexOf(a, item);
			if(index != -1) {
				a.splice(index, 1);
			}
			return index != -1;
		};

		utils.typeName = function(val) {
			return Object.prototype.toString.call(val).slice(8, -1);
		};

		/**
		 * Returns an indication of whether the argument is an array or not
		 */
		utils.isArray = Array.isArray ||
			function(a) {
				return utils.typeName(a) == 'Array';
			};

		/**
		 * Returns an indication of whether the argument is a Date or not
		 */
		utils.isDate = function(d) {
			return(d instanceof Date);
		};

		/**
		 * Does a deep clone of the object.
		 */
		utils.clone = function(obj) {
			if(!obj || typeof obj == 'function' || utils.isDate(obj) || typeof obj != 'object') {
				return obj;
			}

			var retVal, i;

			if(utils.isArray(obj)) {
				retVal = [];
				for(i = 0; i < obj.length; ++i) {
					retVal.push(utils.clone(obj[i]));
				}
				return retVal;
			}

			retVal = {};
			for(i in obj) {
				if(!(i in retVal) || retVal[i] != obj[i]) {
					retVal[i] = utils.clone(obj[i]);
				}
			}
			return retVal;
		};

		/**
		 * Returns a wrapped version of the function
		 */
		utils.close = function(context, func, params) {
			return function() {
				var args = params || arguments;
				return func.apply(context, args);
			};
		};

		//------------------------------------------------------------------------------
		function UUIDcreatePart(length) {
			var uuidpart = "";
			for(var i = 0; i < length; i++) {
				var uuidchar = parseInt((Math.random() * 256), 10).toString(16);
				if(uuidchar.length == 1) {
					uuidchar = "0" + uuidchar;
				}
				uuidpart += uuidchar;
			}
			return uuidpart;
		}

		/**
		 * Create a UUID
		 */
		utils.createUUID = function() {
			return UUIDcreatePart(4) + '-' +
				UUIDcreatePart(2) + '-' +
				UUIDcreatePart(2) + '-' +
				UUIDcreatePart(2) + '-' +
				UUIDcreatePart(6);
		};

		/**
		 * Extends a child object from a parent object using classical inheritance
		 * pattern.
		 */
		utils.extend = (function() {
			// proxy used to establish prototype chain
			var F = function() {};
			// extend Child from Parent
			return function(Child, Parent) {

				F.prototype = Parent.prototype;
				Child.prototype = new F();
				Child.__super__ = Parent.prototype;
				Child.prototype.constructor = Child;
			};
		}());

		/**
		 * Alerts a message in any available way: alert or console.log.
		 */
		utils.alert = function(msg) {
			if(window.alert) {
				window.alert(msg);
			} else if(console && console.log) {
				console.log(msg);
			}
		};

	});

	window.cordova = require('cordova');
	// file: src/scripts/bootstrap.js
	require('cordova/init');
})();

//coocaamap-1.1.js部分

function debug(str) {}

function coocaakeymap(buts, curlink, hover, getVal, setVal, keyDownEvent) {
	this.linkbuttons = $(buts);
	for(var l = this.linkbuttons.length - 1; l >= 0; l--) {
		var i = this.linkbuttons[l];
		if(i.getAttribute("data-no-foucs") == "true") {
			this.linkbuttons.splice(i, 1);
		}
	}
	if(this.linkbuttons.length == 0) {
		this.linkbuttons = $("body");
	}
	var c = $(curlink);
	if(c.length != 0) {
		for(var x = 0; x < this.linkbuttons.length; x++) {
			if(this.linkbuttons.get(x) == c.get(0)) {
				this.curLink = c;
				break;
			}
		}
	}
	if(this.curLink == null) {
		for(var i = 0; i < this.linkbuttons.length; i++) {
			if($(this.linkbuttons[i]).is(":visible")) {
				this.curLink = $(this.linkbuttons[i]);
				break;
			}
		}
	}
	this.keyDownEvent = keyDownEvent || function() {};
	this.hoverClass = hover ? hover : "hover";
	this.input = null;

	this.setHeightLight(this);

	this.setVal = setVal || function(val) {

		$(this).val(val);
	};
	this.getVal = getVal || function() {
		return $(this).val();
	};

	var _this = this;
	//设置只读属性
	//$(buts).attr('readonly',true);
	//设置鼠标事件
	//$(buts).unbind("click").bind("click", function(){_this.handleClick(this); });
	$(buts).unbind("keyinput").bind('keyinput', this.handleInputVal);

	$(window).unbind("keydown").bind('keydown', function(ev) {
		_this.keyHandler(_this, ev);
	});
	this.cmd = [];
	this.iscmd = false;
	this.debugCmd = {
		"cmd3739373938384040": function() {
			var info = "访问地址:" + window.location.href;
			coocaa.alert(info, function() {
				_this.handlerKeydown();
				return true;
			});
		},
		"cmd3737393938384040": function() {
			var info = "版本号：" + coocaa.version;
			coocaa.alert(info, function() {
				_this.handlerKeydown();
				return true;
			});
		}
	};
}
//移除焦点元素
coocaakeymap.prototype.remove = function(wh) {
	this.linkbuttons = this.linkbuttons.not(wh);

};
//添加焦点元素
coocaakeymap.prototype.add = function(wh) {
	this.linkbuttons = this.linkbuttons.add(wh);
};
coocaakeymap.prototype.handlerKeydown = function() {
	var _this = this;
	$(window).unbind("keydown").bind("keydown", function(ev) {
		_this.keyHandler(_this, ev);
	});
}
coocaakeymap.prototype.triggerCmd = function(code) {
	if(this.debugCmd == null || this.iscmd == false || this.debugCmd == null) {
		return;
	}
	this.cmd.push(code);
	if(this.cmd.length > 10) {
		this.cmd = [];
		return;
	}
	var cmd = "cmd" + this.cmd.join("");
	if(typeof(this.debugCmd[cmd]) == "function") {
		this.cmd = [];
		this.iscmd = false;
		this.debugCmd[cmd]();
	}
};
coocaakeymap.prototype.setFocus = function(obj) {
	//传入null则聚焦到第一个可见元素
	if(obj.length == 0) {
		return;
	}
	if(!obj.is(":visible")) {
		obj = null;
	}
	this.curLink = obj;
	this.setHeightLight(this);
};

coocaakeymap.prototype.handleClick = function(obj) {
	this.setFocus($(obj));
	this.curLink.trigger("itemClick");
};
coocaakeymap.prototype.keyHandler = function(_this, ev) {
	//var ev = event;
	var curKey = ev.keyCode;
	debug("<br/>");
	debug("keyCode = " + ev.keyCode);
	debug("<br/>");
	debug(+new Date());
	debug("<br/>");
	_this.curLink.trigger("beforekeyinput", [curKey, ev, _this]);
	if(_this.input != null && _this.curLink.get(0) == _this.input.get(0)) {
		//ev.stopPropagation();
		debug("开始执行keyinput事件");
		_this.input.trigger("keyinput", [curKey, _this]);

	}
	var lastLink = _this.curLink;
	_this.curLink.trigger("afterkeyinput", [curKey, ev, _this]);

	if(_this.iscmd == true) {
		_this.triggerCmd(curKey);
	}
	//禁止select 左右上下 改变选项
	//var tag = _this.curLink.get(0).tagName;
	//if(tag  == "SELECT" || tag  == "INPUT"){
	//	ev.preventDefault();
	//}
	if(ev.isPropagationStopped() == false) {
		switch(curKey) {
			case 8: // 遥控器删除
				_this.iscmd = true;
				_this.cmd = [];
				if(curKey == 8) {
					ev.preventDefault();
				}
				break;
			case 27: // esc返回

				break;
			case 37: // left
				//判断输入点的位置
				_this.moveLeft();
				ev.stopPropagation();
				break;
			case 38: // up
				_this.moveUp();
				ev.stopPropagation();
				break;
			case 39: // right
				_this.moveRight();
				ev.stopPropagation();
				break;
			case 40: // down
				_this.moveDown();
				ev.stopPropagation();
				break;
			case 13: // enter
				_this.curLink.trigger("itemClick");
				break;
		}
	}
	if(lastLink != _this.curLink) {
		lastLink.trigger("blur");
		_this.curLink.trigger("focus");
	}
	this.keyDownEvent(ev);
};

coocaakeymap.prototype.setHeightLight = function(_this) {
	if(_this.curLink == null) {
		//将第一个可见元素设置为焦点元素
		for(var i = 0; i < _this.linkbuttons.length; i++) {
			if($(_this.linkbuttons[i]).is(":visible")) {
				_this.curLink = $(_this.linkbuttons[i]);
				break;
			}
		}
	}
	_this.linkbuttons.attr("readonly", true);
	var hover = _this.hoverClass;
	_this.linkbuttons.removeClass(hover);
	_this.curLink.addClass(hover);
	var curLink = _this.curLink;
	var type = curLink.attr('type');
	_this.input = null;
	//if ($.browser.mozilla && $.browser.version == "1.9.0.10") {
	//} else {
	// 如果是输入框就聚焦
	if(type == 'text' || type == 'password') {
		//curLink.get(0).focus();
	} else {}
	if($(_this.curLink).hasClass("input")) {
		_this.input = $(_this.curLink);
	}
	//}
	//将焦点赋给文档
	$(document).focus();
	this.curLink.trigger("itemSelected");
};

coocaakeymap.prototype.moveLeft = function() {
	var _this = this;
	//如果有leftTarget 标识,直接聚焦到标识所属元素
	if(_this.curLink.attr("leftTarget")) {
		var link = $(_this.curLink.attr("leftTarget"));
		if(link.size() > 0) {
			_this.curLink = link;
			_this.setHeightLight(_this);
			return;
		}
	}
	var curLink = _this.curLink;
	var xthis;
	var upCoincide;
	var downCoincide;
	var diffDistance = 99999;
	var mx = curLink.offset().left;
	var my = curLink.offset().top;
	var objNoCoincide = curLink;
	var diffNoCoincide = 99999;
	var prev = _this.curLink.prev();
	while(prev.length > 0) {
		//查找相邻的节点
		if(_this.linkbuttons.index(prev) != -1) {
			curLink = prev;
			break;
		} else {
			prev = prev.prev();
		}
	}
	if(_this.curLink == curLink) {
		_this.linkbuttons.each(function() {
			xthis = $(this);
			if(xthis.is(":hidden") || xthis.css("visibility") == 'hidden') {
				return true;
			}
			nx = xthis.offset().left;
			ny = xthis.offset().top;
			// debug("x:" + nx + " --- y:" + ny);
			// 如果2个box有重叠，则计算x最近的即可
			upCoincide = ny <= my && ny + xthis.height() > my;
			downCoincide = ny >= my && ny < my + curLink.height();
			if(nx < mx && (upCoincide || downCoincide)) {
				xdist = mx - nx;
				if(xdist < diffDistance) {
					diffDistance = xdist;
					curLink = xthis;
				}
			}
			if(nx < mx) {
				// 向左边移动的时候，如果在目标上边，计算右下角，否则计算左上角
				if(ny >= my)
					xdist = _this.lineDistance(nx + xthis.width(), ny, mx, my);
				else
					xdist = _this.lineDistance(nx + xthis.width(), ny + xthis.height(),
						mx, my);

				if(xdist < diffNoCoincide) {
					diffNoCoincide = xdist;
					objNoCoincide = xthis;
					curLink = xthis;
				}
			}
		});
	}
	_this.curLink = curLink;
	_this.setHeightLight(_this);

};

coocaakeymap.prototype.lineDistance = function(x1, y1, x2, y2) {
	var xs = 0;
	var ys = 0;
	xs = Math.abs(x1 - x2);
	xs = xs * xs;
	ys = Math.abs(y1 - y2);
	ys = ys * ys;
	return Math.sqrt(xs + ys);
};

coocaakeymap.prototype.moveRight = function() {
	var _this = this;
	// 如果有rightTarget标识,直接聚焦到标识所属元素
	if(_this.curLink.attr("rightTarget")) {
		var link = $(_this.curLink.attr("rightTarget"));
		if(link.size() > 0) {
			_this.curLink = link;
			_this.setHeightLight(_this);
			return;
		}
	}
	var curLink = _this.curLink;
	var xthis;
	var upCoincide;
	var downCoincide;

	var diffDistance = 99999;
	var mx = curLink.offset().left;
	var my = curLink.offset().top;
	var tarLink = curLink;
	var objNoCoincide = curLink;
	var diffNoCoincide = 99999;

	var next = _this.curLink.next();
	while(next.length > 0) {
		if(_this.linkbuttons.index(next) != -1) {
			curLink = next;
			break;
		} else {
			next = next.next();
		}
	}
	if(_this.curLink == curLink) {
		_this.linkbuttons.each(function() {
			xthis = $(this);
			if(xthis.is(":hidden") || xthis.css("visibility") == 'hidden') {
				return true;
			}
			nx = xthis.offset().left;
			ny = xthis.offset().top;
			upCoincide = ny <= my && ny + xthis.height() > my;
			downCoincide = ny >= my && ny < my + curLink.height();
			if(nx > mx && (upCoincide || downCoincide)) {
				xdist = nx - mx;
				if(xdist < diffDistance) {
					//debug(xthis.html() + "xdist:" + xdist);
					diffDistance = xdist;
					curLink = xthis;
				}
			}
			if(nx > mx) {
				//向右边移动的时候，如果在目标上边，计算目标左下角，否则计算左上角
				if(ny >= my)
					xdist = _this.lineDistance(nx, ny, mx + tarLink.width(), my);
				else
					xdist = _this.lineDistance(nx, ny + xthis.height(), mx + tarLink.width(), my);

				if(xdist < diffNoCoincide) {
					diffNoCoincide = xdist;
					objNoCoincide = xthis;
					curLink = xthis;
				}
			}
		});
	}
	_this.curLink = curLink;
	_this.setHeightLight(_this);
};

coocaakeymap.prototype.moveUp = function() {
	var _this = this;
	//如果有 upTarget 标识,直接聚焦到标识所属元素
	if(_this.curLink.attr("upTarget")) {
		var link = $(_this.curLink.attr("upTarget"));
		if(link.size() > 0) {
			_this.curLink = link;
			_this.setHeightLight(_this);
			return;
		}
	}
	var curLink = _this.curLink;
	var xthis;
	var leftCoincide;
	var rightCoincide;
	var diffDistance = 99999;
	var mx = curLink.offset().left;
	var my = curLink.offset().top;
	var tarLink = curLink;
	var objNoCoincide = curLink;
	var diffNoCoincide = 99999;
	var findF = false;
	_this.linkbuttons.each(function() {
		xthis = $(this);
		if(xthis.is(":hidden") || xthis.css("visibility") == 'hidden') {
			return true;
		}
		nx = xthis.offset().left;
		ny = xthis.offset().top;
		//先找重叠的，直接算Y坐标
		leftCoincide = nx <= mx && nx + xthis.width() > mx;
		rightCoincide = nx >= mx && mx + tarLink.width() > nx;
		if(ny < my && (leftCoincide || rightCoincide)) {
			xdist = my - ny;
			if(xdist < diffDistance) {
				diffDistance = xdist;
				curLink = xthis;
			}
			findF = true;
		} else if(findF == false) {
			///这里找距离最短的，不在乎是否有重叠
			if(ny < my) {
				//向上移动的时候，如果在目标右边，计算左下角，否则计算右下角
				if(nx >= mx)
					xdist = _this.lineDistance(nx, ny + xthis.height(), mx, my);
				else
					xdist = _this.lineDistance(nx + xthis.width(), ny + xthis.height(), mx, my);
				if(xdist < diffNoCoincide) {
					diffNoCoincide = xdist;
					objNoCoincide = xthis;
					curLink = xthis;
				}
			}
		}
	});
	_this.curLink = curLink;
	_this.setHeightLight(_this);
};

coocaakeymap.prototype.moveDown = function() {
	var _this = this;
	//如果有 downTarget 标识,直接聚焦到标识所属元素
	if(_this.curLink.attr("downTarget")) {
		var link = $(_this.curLink.attr("downTarget"));
		if(link.size() > 0) {
			_this.curLink = link;
			_this.setHeightLight(_this);
			return;
		}
	}
	var curLink = _this.curLink;
	var xthis;
	var leftCoincide;
	var rightCoincide;
	var diffDistance = 99999;
	var mx = curLink.offset().left;
	var my = curLink.offset().top;
	var tarLink = curLink;
	var objNoCoincide = curLink;
	var diffNoCoincide = 99999;
	var findF = false;
	_this.linkbuttons.each(function() {
		xthis = $(this);
		if(xthis.is(":hidden") || xthis.css("visibility") == 'hidden') {
			return true;
		}
		nx = xthis.offset().left;
		ny = xthis.offset().top;
		leftCoincide = nx <= mx && nx + xthis.width() > mx;
		rightCoincide = nx >= mx && mx + tarLink.width() > nx;
		if(ny > my && (leftCoincide || rightCoincide)) {
			xdist = ny - my;
			if(xdist < diffDistance) {
				diffDistance = xdist;
				curLink = xthis;
			}
			findF = true;
		} else if(findF == false) {
			if(ny > my) {
				//xdist = lineDistance(nx, ny, mx, my);
				//向下移动的时候，如果在目标右边，计算左下角，否则计算右下角            
				if(nx >= mx)
					xdist = _this.lineDistance(nx, ny, mx, my + tarLink.height());
				else
					xdist = _this.lineDistance(nx + xthis.width(), ny, mx, my + tarLink.height());

				if(xdist < diffNoCoincide) {
					diffNoCoincide = xdist;
					objNoCoincide = xthis;
					curLink = xthis;
				}
			}
		}
	});
	_this.curLink = curLink;
	_this.setHeightLight(_this);
};

coocaakeymap.prototype.handleInputVal = function(ev, code, map) {
	if(typeof map.setVal != 'function' || typeof map.getVal != 'function') {
		return;
	}
	var _this = map;
	var char = "";
	switch(code) {
		case 48: // key 0
		case 49: // 1
		case 50:
		case 51:
		case 52:
		case 53:
		case 54:
		case 55:
		case 56:
		case 57:
			//输入法输入
			if($(this).attr("readonly") == undefined) {
				return;
			}
			//ev.isPropagationStopped();
			char = String.fromCharCode(code);
			var old = _this.getVal.call(this);
			if(typeof $(this).attr("maxlength") != "nudefined") {
				var length = old.length;
				var maxlength = parseInt($(this).attr("maxlength"));
				if(maxlength <= length) {
					return;
				}
			}
			_this.setVal.call(this, old + char);
			break;
		case 96:
		case 97:
		case 98:
		case 99:
		case 100:
		case 101:
		case 102:
		case 103:
		case 104:
		case 105:
			//输入法输入
			if($(this).attr("readonly") == undefined) {
				return;
			}
			//ev.isPropagationStopped();
			var c = code - 48;
			char = String.fromCharCode(c);
			var old = _this.getVal.call(this);
			if(typeof $(this).attr("maxlength") != "nudefined") {
				var length = old.length;
				var maxlength = parseInt($(this).attr("maxlength"));
				if(maxlength <= length) {
					return;
				}
			}
			_this.setVal.call(this, old + char);
			break;
		case 8:
		case 0:
			//ev.isPropagationStopped();
			var old = _this.getVal.call(this);
			if(old.length > 0) {
				_this.setVal.call(this, old.substring(0, old.length - 1));
			}
			return;
		case 13: //回车键 
			break;
	}
};

//页面部分的逻辑
var app = {
	canonical_uri: function(src, base_path) {
		var root_page = /^[^?#]*\//.exec(location.href)[0],
			root_domain = /^\w+\:\/\/\/?[^\/]+/.exec(root_page)[0],
			absolute_regex = /^\w+\:\/\//;
		// is `src` is protocol-relative (begins with // or ///), prepend protocol  
		if(/^\/\/\/?/.test(src)) {
			src = location.protocol + src;
		}
		// is `src` page-relative? (not an absolute URL, and not a domain-relative path, beginning with /)  
		else if(!absolute_regex.test(src) && src.charAt(0) != "/") {
			// prepend `base_path`, if any  
			src = (base_path || "") + src;
		}
		// make sure to return `src` as absolute  
		return absolute_regex.test(src) ? src : ((src.charAt(0) == "/" ? root_domain : root_page) + src);
	},

	rel_html_imgpath: function(iconurl) {
		// console.log(app.canonical_uri(iconurl.replace(/.*\/([^\/]+\/[^\/]+)$/, '$1')));
		return app.canonical_uri(iconurl.replace(/.*\/([^\/]+\/[^\/]+)$/, '$1'));
	},

	// Application Constructor
	initialize: function() {
		this.bindEvents();
	},
	bindEvents: function() {
		document.addEventListener('deviceready', this.onDeviceReady, false);
        document.addEventListener('backbutton', this.onBackButton, false);
        document.addEventListener('backbuttondown', this.onBackButtonDown, false);
    	document.addEventListener('resume', this.onResume, false);
    	document.addEventListener('pause', this.onPause, false);
	},
	onBackButton: function() {
		console.log("in onBackButton");
		//navigator.app.exitApp();
	},
	onBackButtonDown: function() {
		console.log("in handleBackButtonDown");
		navigator.app.exitApp();
	},
	onDeviceReady: function() {
		console.log("in onDeviceReady");
		app.receivedEvent('deviceready');
		app.triggleButton();
	},
	onResume: function() {
		console.log("in onResume");
	},
	onPause: function() {
		console.log("in onPause");
	},
	receivedEvent: function(id) {
		var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelectorAll('.received');

        listeningElement.setAttribute('style', 'display:none;');
        for( var i = 0 , j = receivedElement.length ; i < j ; i++ ){
            receivedElement[i].setAttribute('style', 'display:block;');
        }
        
		console.log('Received Event: ' + id);

//		map = new coocaakeymap($(".coocaabtn"), null, "btnFocus", function() {}, function(val) {}, function(obj) {});
//		document.getElementById("goToDown").focus();
//		$("#walk").unbind('itemClick').bind("itemClick", function() {});
//		$("#goToDown").unbind('itemClick').bind("focus", function() {});
//		$("#goToDown").unbind('itemClick').bind("blur", function() {});
	},
	triggleButton: function() {
		cordova.require("com.coocaaosapi");
		
		document.getElementById("startloaclmedia").addEventListener("click", function (){
            coocaaosapi.startLocalMedia( function(message) {console.log(message); },function(error) {console.log(error);});
        },false);

        document.getElementById("starttvsetting").addEventListener("click",  function (){
            coocaaosapi.startTVSetting(function(message)  {console.log(message); },function(error){console.log(error);});
        }, false);

        document.getElementById("startsourcelist").addEventListener("click",  function (){
            coocaaosapi.startSourceList( function(message){console.log(message);},function(error){console.log(error); });
        },false);

        document.getElementById("startqrcode").addEventListener("click", function (){
            coocaaosapi.startQRCode(function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startmoviehistory").addEventListener("click", function (){
            coocaaosapi.startMovieHistory(function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startmygames").addEventListener("click", function (){
            coocaaosapi.startMyGames(function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startnormallocalapp").addEventListener("click", function (){
            coocaaosapi.startMyApps("",function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startchildlocalapp").addEventListener("click", function (){
            coocaaosapi.startMyApps("child",function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startusersetting").addEventListener("click", function (){
           coocaaosapi.startUserSetting(function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

       document.getElementById("startnetsetting").addEventListener("click", function (){
            coocaaosapi.startNetSetting(function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startbluetoothsetting").addEventListener("click", function (){
            coocaaosapi.startBlueToothSetting(function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

       document.getElementById("startmssagebox").addEventListener("click", function (){
            coocaaosapi.startMessageBox(function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startupgrade").addEventListener("click", function (){
            coocaaosapi.startSystemUpgrade(function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startmovielist").addEventListener("click", function (){
            var listid = eval(document.getElementById('movielistid')).value;
            console.log(listid);
            coocaaosapi.startMovieList(listid,function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

       document.getElementById("startmoviedetail").addEventListener("click", function (){
            var detailid = eval(document.getElementById('moviedetailid')).value;
            console.log(detailid);
            coocaaosapi.startMovieDetail(detailid,function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startmovietopic").addEventListener("click", function (){
            var topicid = eval(document.getElementById('movietopicid')).value;
            console.log(topicid);
            coocaaosapi.startMovieTopic(topicid,function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startmemcenter").addEventListener("click", function (){
            coocaaosapi.startMovieMemberCenter('qq',function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startmoviehome").addEventListener("click", function (){
            coocaaosapi.startMovieHome(function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startplaymovie").addEventListener("click", function (){
            var url = 'http://localhost/webappdemo/test.rmvb';
            var name = '孤独的美食家';
            coocaaosapi.playOnlineMovie(url,name,"false",function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startappstore").addEventListener("click", function (){
            coocaaosapi.startAppStore(function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startappstorebd").addEventListener("click", function (){
            coocaaosapi.startAppStoreBD(1,function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startappstoresort").addEventListener("click", function (){
             var sortid = eval(document.getElementById('appsortid')).value;
             console.log(sortid);
             coocaaosapi.startAppStoreSort(sortid,function(message) {console.log(message); },function(error) { console.log(error);});
       	},false);

        document.getElementById("startappstorelist").addEventListener("click", function (){
             var listid = eval(document.getElementById('applistid')).value;
             console.log(listid);
             coocaaosapi.startAppStoreList(listid,function(message) {console.log(message); },function(error) { console.log(error);});
      	},false);

        document.getElementById("startappstoredetail").addEventListener("click", function (){
              var detailid = eval(document.getElementById('appdetailid')).value;
              console.log(detailid);
              coocaaosapi.startAppStoreDetail(detailid,function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startappstorezone").addEventListener("click", function (){
              var zoneid = eval(document.getElementById('appzoneid')).value;
              console.log(zoneid);
              coocaaosapi.startAppStoreZone(zoneid,function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startdownloadapp").addEventListener("click", function (){
            var downloadstring = eval(document.getElementById('downloadid')).value;
            console.log(downloadstring);
            coocaaosapi.startOrCreateDownloadTask(
                "https://qd.myapp.com/myapp/qqteam/AndroidQQ/mobileqq_android.apk",
                '',
                'qq移动版',
                'com.tencent.mobileqq',
                '123123',
                'http://img.zcool.cn/community/01559e565d84d832f875964706920d.png',
                function(message) {console.log(message); },
                function(error) { console.log(error);});
        },false);

        document.getElementById("startgamecenter").addEventListener("click", function (){
            coocaaosapi.startGameCenter(function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startgamearsenal").addEventListener("click", function (){
            coocaaosapi.startGameArsenal(function(message) {console.log(message); },function(error) { console.log(error);});
        },false);

        document.getElementById("startgamelist").addEventListener("click", function (){
            var gamelistid = eval(document.getElementById('gamelistid')).value;
            console.log(gamelistid);
            var gametitleid = eval(document.getElementById('gametitleid')).value;
            console.log(gametitleid);
            coocaaosapi.startGameCenterList(gamelistid,gametitleid,function(message) {console.log(message); },function(error) { console.log(error);})
        },false);

         document.getElementById("startgamedetail").addEventListener("click", function (){
             var gamedetailid = eval(document.getElementById('gamedetailid')).value;
             console.log(gamedetailid);
             coocaaosapi.startGameCenterDetail(gamedetailid,function(message) {console.log(message); },function(error) { console.log(error);});
         },false);

        document.getElementById("startgamezone").addEventListener("click", function (){
             var gamezoneid = eval(document.getElementById('gamezoneid')).value;
             console.log(gamezoneid);
             coocaaosapi.startGameCenterZone(gamezoneid,function(message) {console.log(message); },function(error) { console.log(error);});
         },false);

        document.getElementById("getsysteminfo").addEventListener("click", function (){
             coocaaosapi.getDeviceInfo(function(message) {
                console.log(JSON.stringify(message));
                document.getElementById('systeminfoid').value = JSON.stringify(message);
             },function(error) { console.log(error);})
         },false);

        document.getElementById("getnetworking").addEventListener("click", function (){
            coocaaosapi.isNetConnected(function(message) {
            	console.log("isnetworking " + message.isnetworking);
            	document.getElementById('isnetworkingid').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);

        document.getElementById("getnettype").addEventListener("click", function (){
            coocaaosapi.getNetType(function(message) {
            	console.log("nettype " + message.nettype);
            	document.getElementById('nettypeid').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);

        document.getElementById("getipinfp").addEventListener("click", function (){
            coocaaosapi.getIpInfo(function(message) {
            	console.log(JSON.stringify(message));
            	document.getElementById('ipinfoid').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);

         document.getElementById("gethaslogin").addEventListener("click", function (){
            coocaaosapi.hasCoocaaUserLogin(function(message) {
            	console.log("haslogin " + message.haslogin);
            	document.getElementById('hasloginid').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);

        document.getElementById("getuserinfo").addEventListener("click", function (){
           	coocaaosapi.getUserInfo(function(message) {
           		console.log(JSON.stringify(message));
           		document.getElementById('userinfoid').innerHTML = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);

        document.getElementById("getlocation").addEventListener("click", function (){
            coocaaosapi.getDeviceLocation(function(message) {
            console.log("location " + message.location);
            document.getElementById('locationid').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);

        /*listener*/
        coocaaosapi.addNetChangedListener(function(message){
            console.log("nettype " + message.nettype);
            console.log("netevent " + message.netevent);
            document.getElementById("netchanged").value = JSON.stringify(message);
        });

        coocaaosapi.addUSBChangedListener(function(message){
                    console.log("usbinfo " + message.usb);
                    console.log( "USB_CHANGGED received! ismount: " + message.usbmount  );
                    console.log( "USB_CHANGGED received! mountpath: " + message.mountpath  );
                    document.getElementById("usbchanged").value = JSON.stringify(message);
                });

        coocaaosapi.addAppTaskListener(function(message){
             console.log("taskinfo " + JSON.stringify(message));
        });

        coocaaosapi.addPurchaseOrderListener(function(message){
                      console.log("startpurcharse message " + JSON.stringify(message));
                       document.getElementById("purcharsecallback").value = JSON.stringify(message);
        });

         document.getElementById("startpurcharse").addEventListener("click", function (){
                    var math =  Math.random() * 9000000 + 1000000;
                    coocaaosapi.purchaseOrder('1001',math+'','包月','product detail','虚拟',{'notify_url':'http://42.121.113.121:8090/aqiyiOrder/viewMain.html'},0.01,0,'','',
                    function(success){},function(error){console.log(error);});
                },false);

        document.getElementById("getusertoken").addEventListener("click", function (){
            coocaaosapi.getUserAccessToken(function(message) {
            console.log("usertoken " + message.accesstoken);
            document.getElementById('usertokenid').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);
        
//      Cordova 2.0 接口对接
		document.getElementById("getmovieappinfo").addEventListener("click", function (){
            coocaaosapi.getMoviePlatformInfo(function(message) {
            document.getElementById('movieappinfo').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("getthemeinfo").addEventListener("click", function (){
            coocaaosapi.getCurTheme(function(message) {
            document.getElementById('themeinfo').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);

		document.getElementById("getcordovainfo").addEventListener("click", function (){
            coocaaosapi.getWebViewSDKInfo(function(message) {
            document.getElementById('cordovainfo').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);

		document.getElementById("getappstoreinfo").addEventListener("click", function (){
            coocaaosapi.getAppStoreInfo(function(message) {
            document.getElementById('appstoreinfo').value = JSON.stringify(message);
            },function(error) { console.log(error);})
        },false);
		
		document.getElementById("setfocusposition").addEventListener("click", function (){
            var focuspositioninfo = document.getElementById("focusposition").value;
            coocaaosapi.setFocusPosition(focuspositioninfo,function(message) {
            	console.log("return message = "+ message);
            	if(message == "OK"){document.getElementById(focuspositioninfo).focus()};
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("pushwebinfo").addEventListener("click", function (){
            var mywebinfo = document.getElementById("webinfo").value;
            coocaaosapi.notifyJSMessage(mywebinfo,function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
		
		document.getElementById("pushloginfo").addEventListener("click", function (){
            var eventId = document.getElementById("eventid").value;
            var dData = document.getElementById("ddata").value;
            coocaaosapi.notifyJSLogInfo(eventId,dData,function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("startappshop").addEventListener("click", function (){
            coocaaosapi.startAppShop(function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("startappshoplist").addEventListener("click", function (){
            var id = document.getElementById("appshopid").value;
            var title = document.getElementById("appshoptitle").value;
            coocaaosapi.startAppShopList(id,title,function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("startappshopdetail").addEventListener("click", function (){
            var id = document.getElementById("appshopdetailid").value;
            coocaaosapi.startAppShopDetail(id,function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("startappshopzone").addEventListener("click", function (){
            var id = document.getElementById("appshopzoneid").value;
            coocaaosapi.startAppShopZone(id,function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("startappshopzonelist").addEventListener("click", function (){
            coocaaosapi.startAppShopZoneList(function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("startappshopvideo").addEventListener("click", function (){
            var id = document.getElementById("appshopvideoid").value;
            var url = document.getElementById("appshopvideourl").value;
            var name = document.getElementById("appshopvideoname").value;
            coocaaosapi.startAppShopVideo(id,url,name,function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("startappshopbuying").addEventListener("click", function (){
            var id = document.getElementById("appshopbuyingid").value;
            coocaaosapi.startAppShopBUYING(id,function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
        
        document.getElementById("startmoviesomepage").addEventListener("click", function (){
            coocaaosapi.startMovieSomePage("10585",function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
        document.getElementById("startCIBNpage").addEventListener("click", function (){
            coocaaosapi.startCIBN("5","1",function(message) {console.log(message);}, function(error) {console.log(error);});
        },false);
        document.getElementById("getSystemProperty").addEventListener("click", function (){
            var sysPropertykey = document.getElementById("getSystemPropertyKey").value;
            console.log("sysProperty key="+sysPropertykey);
            var ffffffFlag = "gfdsa";
            coocaaosapi.getPropertiesValue(sysPropertykey,function(message) {
            	console.log("sysProperty value="+JSON.stringify(message));
            	ffffffFlag = "success123";
            	console.log("ffffffFlag = "+ffffffFlag);
            	document.getElementById('getSystemPropertyValue').value = JSON.stringify(message);
            }, function(error) {
            	ffffffFlag = "fail123";
            	console.log(error+"ffffffFlag = "+ffffffFlag);
            });
        },false);
        
        document.getElementById("gotoLoginAndFinish").addEventListener("click", function (){
            coocaaosapi.startUserSettingAndFinish(function(message) {
            	console.log("return message = "+ message);
            },function(error) { console.log(error);})
        },false);
    }
		
};

app.initialize();
