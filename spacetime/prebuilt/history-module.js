import { env_get } from "spacetime:sys@2.2";
import * as _syscalls2_0 from "spacetime:sys@2.0";
import { moduleHooks } from "spacetime:sys@2.0";
import * as _syscalls2_1 from "spacetime:sys@2.1";

//#region node_modules/headers-polyfill/lib/index.mjs
var __create$1 = Object.create;
var __defProp$1 = Object.defineProperty;
var __getOwnPropDesc$1 = Object.getOwnPropertyDescriptor;
var __getOwnPropNames$1 = Object.getOwnPropertyNames;
var __getProtoOf$1 = Object.getPrototypeOf;
var __hasOwnProp$1 = Object.prototype.hasOwnProperty;
var __commonJS$1 = (cb, mod) => function __require() {
	return mod || (0, cb[__getOwnPropNames$1(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps$1 = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (let key of __getOwnPropNames$1(from)) if (!__hasOwnProp$1.call(to, key) && key !== except) __defProp$1(to, key, {
			get: () => from[key],
			enumerable: !(desc = __getOwnPropDesc$1(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM$1 = (mod, isNodeMode, target) => (target = mod != null ? __create$1(__getProtoOf$1(mod)) : {}, __copyProps$1(isNodeMode || !mod || !mod.__esModule ? __defProp$1(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var import_set_cookie_parser = __toESM$1(__commonJS$1({ "node_modules/set-cookie-parser/lib/set-cookie.js"(exports, module) {
	"use strict";
	var defaultParseOptions = {
		decodeValues: true,
		map: false,
		silent: false
	};
	function isNonEmptyString(str) {
		return typeof str === "string" && !!str.trim();
	}
	function parseString(setCookieValue, options) {
		var parts = setCookieValue.split(";").filter(isNonEmptyString);
		var parsed = parseNameValuePair(parts.shift());
		var name = parsed.name;
		var value = parsed.value;
		options = options ? Object.assign({}, defaultParseOptions, options) : defaultParseOptions;
		try {
			value = options.decodeValues ? decodeURIComponent(value) : value;
		} catch (e) {
			console.error("set-cookie-parser encountered an error while decoding a cookie with value '" + value + "'. Set options.decodeValues to false to disable this feature.", e);
		}
		var cookie = {
			name,
			value
		};
		parts.forEach(function(part) {
			var sides = part.split("=");
			var key = sides.shift().trimLeft().toLowerCase();
			var value2 = sides.join("=");
			if (key === "expires") cookie.expires = new Date(value2);
			else if (key === "max-age") cookie.maxAge = parseInt(value2, 10);
			else if (key === "secure") cookie.secure = true;
			else if (key === "httponly") cookie.httpOnly = true;
			else if (key === "samesite") cookie.sameSite = value2;
			else cookie[key] = value2;
		});
		return cookie;
	}
	function parseNameValuePair(nameValuePairStr) {
		var name = "";
		var value = "";
		var nameValueArr = nameValuePairStr.split("=");
		if (nameValueArr.length > 1) {
			name = nameValueArr.shift();
			value = nameValueArr.join("=");
		} else value = nameValuePairStr;
		return {
			name,
			value
		};
	}
	function parse(input, options) {
		options = options ? Object.assign({}, defaultParseOptions, options) : defaultParseOptions;
		if (!input) if (!options.map) return [];
		else return {};
		if (input.headers) if (typeof input.headers.getSetCookie === "function") input = input.headers.getSetCookie();
		else if (input.headers["set-cookie"]) input = input.headers["set-cookie"];
		else {
			var sch = input.headers[Object.keys(input.headers).find(function(key) {
				return key.toLowerCase() === "set-cookie";
			})];
			if (!sch && input.headers.cookie && !options.silent) console.warn("Warning: set-cookie-parser appears to have been called on a request object. It is designed to parse Set-Cookie headers from responses, not Cookie headers from requests. Set the option {silent: true} to suppress this warning.");
			input = sch;
		}
		if (!Array.isArray(input)) input = [input];
		options = options ? Object.assign({}, defaultParseOptions, options) : defaultParseOptions;
		if (!options.map) return input.filter(isNonEmptyString).map(function(str) {
			return parseString(str, options);
		});
		else return input.filter(isNonEmptyString).reduce(function(cookies2, str) {
			var cookie = parseString(str, options);
			cookies2[cookie.name] = cookie;
			return cookies2;
		}, {});
	}
	function splitCookiesString2(cookiesString) {
		if (Array.isArray(cookiesString)) return cookiesString;
		if (typeof cookiesString !== "string") return [];
		var cookiesStrings = [];
		var pos = 0;
		var start;
		var ch;
		var lastComma;
		var nextStart;
		var cookiesSeparatorFound;
		function skipWhitespace() {
			while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) pos += 1;
			return pos < cookiesString.length;
		}
		function notSpecialChar() {
			ch = cookiesString.charAt(pos);
			return ch !== "=" && ch !== ";" && ch !== ",";
		}
		while (pos < cookiesString.length) {
			start = pos;
			cookiesSeparatorFound = false;
			while (skipWhitespace()) {
				ch = cookiesString.charAt(pos);
				if (ch === ",") {
					lastComma = pos;
					pos += 1;
					skipWhitespace();
					nextStart = pos;
					while (pos < cookiesString.length && notSpecialChar()) pos += 1;
					if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
						cookiesSeparatorFound = true;
						pos = nextStart;
						cookiesStrings.push(cookiesString.substring(start, lastComma));
						start = pos;
					} else pos = lastComma + 1;
				} else pos += 1;
			}
			if (!cookiesSeparatorFound || pos >= cookiesString.length) cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
		}
		return cookiesStrings;
	}
	module.exports = parse;
	module.exports.parse = parse;
	module.exports.parseString = parseString;
	module.exports.splitCookiesString = splitCookiesString2;
} })());
var HEADERS_INVALID_CHARACTERS = /[^a-z0-9\-#$%&'*+.^_`|~]/i;
function normalizeHeaderName(name) {
	if (HEADERS_INVALID_CHARACTERS.test(name) || name.trim() === "") throw new TypeError("Invalid character in header field name");
	return name.trim().toLowerCase();
}
var charCodesToRemove = [
	String.fromCharCode(10),
	String.fromCharCode(13),
	String.fromCharCode(9),
	String.fromCharCode(32)
];
var HEADER_VALUE_REMOVE_REGEXP = new RegExp(`(^[${charCodesToRemove.join("")}]|$[${charCodesToRemove.join("")}])`, "g");
function normalizeHeaderValue(value) {
	return value.replace(HEADER_VALUE_REMOVE_REGEXP, "");
}
function isValidHeaderName(value) {
	if (typeof value !== "string") return false;
	if (value.length === 0) return false;
	for (let i = 0; i < value.length; i++) {
		const character = value.charCodeAt(i);
		if (character > 127 || !isToken(character)) return false;
	}
	return true;
}
function isToken(value) {
	return ![
		127,
		32,
		"(",
		")",
		"<",
		">",
		"@",
		",",
		";",
		":",
		"\\",
		"\"",
		"/",
		"[",
		"]",
		"?",
		"=",
		"{",
		"}"
	].includes(value);
}
function isValidHeaderValue(value) {
	if (typeof value !== "string") return false;
	if (value.trim() !== value) return false;
	for (let i = 0; i < value.length; i++) {
		const character = value.charCodeAt(i);
		if (character === 0 || character === 10 || character === 13) return false;
	}
	return true;
}
var NORMALIZED_HEADERS = Symbol("normalizedHeaders");
var RAW_HEADER_NAMES = Symbol("rawHeaderNames");
var HEADER_VALUE_DELIMITER = ", ";
var _a, _b, _c;
var Headers = class _Headers {
	constructor(init) {
		this[_a] = {};
		this[_b] = /* @__PURE__ */ new Map();
		this[_c] = "Headers";
		if (["Headers", "HeadersPolyfill"].includes(init?.constructor.name) || init instanceof _Headers || typeof globalThis.Headers !== "undefined" && init instanceof globalThis.Headers) init.forEach((value, name) => {
			this.append(name, value);
		}, this);
		else if (Array.isArray(init)) init.forEach(([name, value]) => {
			this.append(name, Array.isArray(value) ? value.join(HEADER_VALUE_DELIMITER) : value);
		});
		else if (init) Object.getOwnPropertyNames(init).forEach((name) => {
			const value = init[name];
			this.append(name, Array.isArray(value) ? value.join(HEADER_VALUE_DELIMITER) : value);
		});
	}
	[(_a = NORMALIZED_HEADERS, _b = RAW_HEADER_NAMES, _c = Symbol.toStringTag, Symbol.iterator)]() {
		return this.entries();
	}
	*keys() {
		for (const [name] of this.entries()) yield name;
	}
	*values() {
		for (const [, value] of this.entries()) yield value;
	}
	*entries() {
		let sortedKeys = Object.keys(this[NORMALIZED_HEADERS]).sort((a, b) => a.localeCompare(b));
		for (const name of sortedKeys) if (name === "set-cookie") for (const value of this.getSetCookie()) yield [name, value];
		else yield [name, this.get(name)];
	}
	/**
	* Returns a boolean stating whether a `Headers` object contains a certain header.
	*/
	has(name) {
		if (!isValidHeaderName(name)) throw new TypeError(`Invalid header name "${name}"`);
		return this[NORMALIZED_HEADERS].hasOwnProperty(normalizeHeaderName(name));
	}
	/**
	* Returns a `ByteString` sequence of all the values of a header with a given name.
	*/
	get(name) {
		if (!isValidHeaderName(name)) throw TypeError(`Invalid header name "${name}"`);
		return this[NORMALIZED_HEADERS][normalizeHeaderName(name)] ?? null;
	}
	/**
	* Sets a new value for an existing header inside a `Headers` object, or adds the header if it does not already exist.
	*/
	set(name, value) {
		if (!isValidHeaderName(name) || !isValidHeaderValue(value)) return;
		const normalizedName = normalizeHeaderName(name);
		const normalizedValue = normalizeHeaderValue(value);
		this[NORMALIZED_HEADERS][normalizedName] = normalizeHeaderValue(normalizedValue);
		this[RAW_HEADER_NAMES].set(normalizedName, name);
	}
	/**
	* Appends a new value onto an existing header inside a `Headers` object, or adds the header if it does not already exist.
	*/
	append(name, value) {
		if (!isValidHeaderName(name) || !isValidHeaderValue(value)) return;
		const normalizedName = normalizeHeaderName(name);
		const normalizedValue = normalizeHeaderValue(value);
		let resolvedValue = this.has(normalizedName) ? `${this.get(normalizedName)}, ${normalizedValue}` : normalizedValue;
		this.set(name, resolvedValue);
	}
	/**
	* Deletes a header from the `Headers` object.
	*/
	delete(name) {
		if (!isValidHeaderName(name)) return;
		if (!this.has(name)) return;
		const normalizedName = normalizeHeaderName(name);
		delete this[NORMALIZED_HEADERS][normalizedName];
		this[RAW_HEADER_NAMES].delete(normalizedName);
	}
	/**
	* Traverses the `Headers` object,
	* calling the given callback for each header.
	*/
	forEach(callback, thisArg) {
		for (const [name, value] of this.entries()) callback.call(thisArg, value, name, this);
	}
	/**
	* Returns an array containing the values
	* of all Set-Cookie headers associated
	* with a response
	*/
	getSetCookie() {
		const setCookieHeader = this.get("set-cookie");
		if (setCookieHeader === null) return [];
		if (setCookieHeader === "") return [""];
		return (0, import_set_cookie_parser.splitCookiesString)(setCookieHeader);
	}
};

//#endregion
//#region node_modules/spacetimedb/dist/server/index.mjs
typeof globalThis !== "undefined" && (globalThis.global = globalThis.global || globalThis, globalThis.window = globalThis.window || globalThis);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
	return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
	return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: () => from[key],
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(__defProp(target, "default", {
	value: mod,
	enumerable: true
}), mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var require_base64_js = __commonJS({ "../../node_modules/.pnpm/base64-js@1.5.1/node_modules/base64-js/index.js"(exports) {
	exports.byteLength = byteLength;
	exports.toByteArray = toByteArray;
	exports.fromByteArray = fromByteArray2;
	var lookup = [];
	var revLookup = [];
	var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
	var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	for (i = 0, len = code.length; i < len; ++i) {
		lookup[i] = code[i];
		revLookup[code.charCodeAt(i)] = i;
	}
	var i;
	var len;
	revLookup["-".charCodeAt(0)] = 62;
	revLookup["_".charCodeAt(0)] = 63;
	function getLens(b64) {
		var len2 = b64.length;
		if (len2 % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
		var validLen = b64.indexOf("=");
		if (validLen === -1) validLen = len2;
		var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
		return [validLen, placeHoldersLen];
	}
	function byteLength(b64) {
		var lens = getLens(b64);
		var validLen = lens[0];
		var placeHoldersLen = lens[1];
		return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
	}
	function _byteLength(b64, validLen, placeHoldersLen) {
		return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
	}
	function toByteArray(b64) {
		var tmp;
		var lens = getLens(b64);
		var validLen = lens[0];
		var placeHoldersLen = lens[1];
		var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
		var curByte = 0;
		var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
		var i2;
		for (i2 = 0; i2 < len2; i2 += 4) {
			tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
			arr[curByte++] = tmp >> 16 & 255;
			arr[curByte++] = tmp >> 8 & 255;
			arr[curByte++] = tmp & 255;
		}
		if (placeHoldersLen === 2) {
			tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
			arr[curByte++] = tmp & 255;
		}
		if (placeHoldersLen === 1) {
			tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
			arr[curByte++] = tmp >> 8 & 255;
			arr[curByte++] = tmp & 255;
		}
		return arr;
	}
	function tripletToBase64(num) {
		return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
	}
	function encodeChunk(uint8, start, end) {
		var tmp;
		var output = [];
		for (var i2 = start; i2 < end; i2 += 3) {
			tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
			output.push(tripletToBase64(tmp));
		}
		return output.join("");
	}
	function fromByteArray2(uint8) {
		var tmp;
		var len2 = uint8.length;
		var extraBytes = len2 % 3;
		var parts = [];
		var maxChunkLength = 16383;
		for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
		if (extraBytes === 1) {
			tmp = uint8[len2 - 1];
			parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==");
		} else if (extraBytes === 2) {
			tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
			parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "=");
		}
		return parts.join("");
	}
} });
var require_codes = __commonJS({ "../../node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/codes.json"(exports, module) {
	module.exports = {
		"100": "Continue",
		"101": "Switching Protocols",
		"102": "Processing",
		"103": "Early Hints",
		"200": "OK",
		"201": "Created",
		"202": "Accepted",
		"203": "Non-Authoritative Information",
		"204": "No Content",
		"205": "Reset Content",
		"206": "Partial Content",
		"207": "Multi-Status",
		"208": "Already Reported",
		"226": "IM Used",
		"300": "Multiple Choices",
		"301": "Moved Permanently",
		"302": "Found",
		"303": "See Other",
		"304": "Not Modified",
		"305": "Use Proxy",
		"307": "Temporary Redirect",
		"308": "Permanent Redirect",
		"400": "Bad Request",
		"401": "Unauthorized",
		"402": "Payment Required",
		"403": "Forbidden",
		"404": "Not Found",
		"405": "Method Not Allowed",
		"406": "Not Acceptable",
		"407": "Proxy Authentication Required",
		"408": "Request Timeout",
		"409": "Conflict",
		"410": "Gone",
		"411": "Length Required",
		"412": "Precondition Failed",
		"413": "Payload Too Large",
		"414": "URI Too Long",
		"415": "Unsupported Media Type",
		"416": "Range Not Satisfiable",
		"417": "Expectation Failed",
		"418": "I'm a Teapot",
		"421": "Misdirected Request",
		"422": "Unprocessable Entity",
		"423": "Locked",
		"424": "Failed Dependency",
		"425": "Too Early",
		"426": "Upgrade Required",
		"428": "Precondition Required",
		"429": "Too Many Requests",
		"431": "Request Header Fields Too Large",
		"451": "Unavailable For Legal Reasons",
		"500": "Internal Server Error",
		"501": "Not Implemented",
		"502": "Bad Gateway",
		"503": "Service Unavailable",
		"504": "Gateway Timeout",
		"505": "HTTP Version Not Supported",
		"506": "Variant Also Negotiates",
		"507": "Insufficient Storage",
		"508": "Loop Detected",
		"509": "Bandwidth Limit Exceeded",
		"510": "Not Extended",
		"511": "Network Authentication Required"
	};
} });
var require_statuses = __commonJS({ "../../node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/index.js"(exports, module) {
	var codes = require_codes();
	module.exports = status2;
	status2.message = codes;
	status2.code = createMessageToStatusCodeMap(codes);
	status2.codes = createStatusCodeList(codes);
	status2.redirect = {
		300: true,
		301: true,
		302: true,
		303: true,
		305: true,
		307: true,
		308: true
	};
	status2.empty = {
		204: true,
		205: true,
		304: true
	};
	status2.retry = {
		502: true,
		503: true,
		504: true
	};
	function createMessageToStatusCodeMap(codes2) {
		var map = {};
		Object.keys(codes2).forEach(function forEachCode(code) {
			var message = codes2[code];
			var status3 = Number(code);
			map[message.toLowerCase()] = status3;
		});
		return map;
	}
	function createStatusCodeList(codes2) {
		return Object.keys(codes2).map(function mapCode(code) {
			return Number(code);
		});
	}
	function getStatusCode(message) {
		var msg = message.toLowerCase();
		if (!Object.prototype.hasOwnProperty.call(status2.code, msg)) throw new Error("invalid status message: \"" + message + "\"");
		return status2.code[msg];
	}
	function getStatusMessage(code) {
		if (!Object.prototype.hasOwnProperty.call(status2.message, code)) throw new Error("invalid status code: " + code);
		return status2.message[code];
	}
	function status2(code) {
		if (typeof code === "number") return getStatusMessage(code);
		if (typeof code !== "string") throw new TypeError("code must be a number or string");
		var n = parseInt(code, 10);
		if (!isNaN(n)) return getStatusMessage(n);
		return getStatusCode(code);
	}
} });
var util_stub_exports = {};
__export(util_stub_exports, { inspect: () => inspect });
var inspect;
var init_util_stub = __esm({ "src/util-stub.ts"() {
	inspect = {};
} });
var require_util_inspect = __commonJS({ "../../node_modules/.pnpm/object-inspect@1.13.4/node_modules/object-inspect/util.inspect.js"(exports, module) {
	module.exports = (init_util_stub(), __toCommonJS(util_stub_exports)).inspect;
} });
var require_object_inspect = __commonJS({ "../../node_modules/.pnpm/object-inspect@1.13.4/node_modules/object-inspect/index.js"(exports, module) {
	var hasMap = typeof Map === "function" && Map.prototype;
	var mapSizeDescriptor = Object.getOwnPropertyDescriptor && hasMap ? Object.getOwnPropertyDescriptor(Map.prototype, "size") : null;
	var mapSize = hasMap && mapSizeDescriptor && typeof mapSizeDescriptor.get === "function" ? mapSizeDescriptor.get : null;
	var mapForEach = hasMap && Map.prototype.forEach;
	var hasSet = typeof Set === "function" && Set.prototype;
	var setSizeDescriptor = Object.getOwnPropertyDescriptor && hasSet ? Object.getOwnPropertyDescriptor(Set.prototype, "size") : null;
	var setSize = hasSet && setSizeDescriptor && typeof setSizeDescriptor.get === "function" ? setSizeDescriptor.get : null;
	var setForEach = hasSet && Set.prototype.forEach;
	var weakMapHas = typeof WeakMap === "function" && WeakMap.prototype ? WeakMap.prototype.has : null;
	var weakSetHas = typeof WeakSet === "function" && WeakSet.prototype ? WeakSet.prototype.has : null;
	var weakRefDeref = typeof WeakRef === "function" && WeakRef.prototype ? WeakRef.prototype.deref : null;
	var booleanValueOf = Boolean.prototype.valueOf;
	var objectToString = Object.prototype.toString;
	var functionToString = Function.prototype.toString;
	var $match = String.prototype.match;
	var $slice = String.prototype.slice;
	var $replace = String.prototype.replace;
	var $toUpperCase = String.prototype.toUpperCase;
	var $toLowerCase = String.prototype.toLowerCase;
	var $test = RegExp.prototype.test;
	var $concat = Array.prototype.concat;
	var $join = Array.prototype.join;
	var $arrSlice = Array.prototype.slice;
	var $floor = Math.floor;
	var bigIntValueOf = typeof BigInt === "function" ? BigInt.prototype.valueOf : null;
	var gOPS = Object.getOwnPropertySymbols;
	var symToString = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? Symbol.prototype.toString : null;
	var hasShammedSymbols = typeof Symbol === "function" && typeof Symbol.iterator === "object";
	var toStringTag = typeof Symbol === "function" && Symbol.toStringTag && (typeof Symbol.toStringTag === hasShammedSymbols ? "object" : "symbol") ? Symbol.toStringTag : null;
	var isEnumerable = Object.prototype.propertyIsEnumerable;
	var gPO = (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf) || ([].__proto__ === Array.prototype ? function(O) {
		return O.__proto__;
	} : null);
	function addNumericSeparator(num, str) {
		if (num === Infinity || num === -Infinity || num !== num || num && num > -1e3 && num < 1e3 || $test.call(/e/, str)) return str;
		var sepRegex = /[0-9](?=(?:[0-9]{3})+(?![0-9]))/g;
		if (typeof num === "number") {
			var int = num < 0 ? -$floor(-num) : $floor(num);
			if (int !== num) {
				var intStr = String(int);
				var dec = $slice.call(str, intStr.length + 1);
				return $replace.call(intStr, sepRegex, "$&_") + "." + $replace.call($replace.call(dec, /([0-9]{3})/g, "$&_"), /_$/, "");
			}
		}
		return $replace.call(str, sepRegex, "$&_");
	}
	var utilInspect = require_util_inspect();
	var inspectCustom = utilInspect.custom;
	var inspectSymbol = isSymbol(inspectCustom) ? inspectCustom : null;
	var quotes = {
		__proto__: null,
		"double": "\"",
		single: "'"
	};
	var quoteREs = {
		__proto__: null,
		"double": /(["\\])/g,
		single: /(['\\])/g
	};
	module.exports = function inspect_(obj, options, depth, seen) {
		var opts = options || {};
		if (has(opts, "quoteStyle") && !has(quotes, opts.quoteStyle)) throw new TypeError("option \"quoteStyle\" must be \"single\" or \"double\"");
		if (has(opts, "maxStringLength") && (typeof opts.maxStringLength === "number" ? opts.maxStringLength < 0 && opts.maxStringLength !== Infinity : opts.maxStringLength !== null)) throw new TypeError("option \"maxStringLength\", if provided, must be a positive integer, Infinity, or `null`");
		var customInspect = has(opts, "customInspect") ? opts.customInspect : true;
		if (typeof customInspect !== "boolean" && customInspect !== "symbol") throw new TypeError("option \"customInspect\", if provided, must be `true`, `false`, or `'symbol'`");
		if (has(opts, "indent") && opts.indent !== null && opts.indent !== "	" && !(parseInt(opts.indent, 10) === opts.indent && opts.indent > 0)) throw new TypeError("option \"indent\" must be \"\\t\", an integer > 0, or `null`");
		if (has(opts, "numericSeparator") && typeof opts.numericSeparator !== "boolean") throw new TypeError("option \"numericSeparator\", if provided, must be `true` or `false`");
		var numericSeparator = opts.numericSeparator;
		if (typeof obj === "undefined") return "undefined";
		if (obj === null) return "null";
		if (typeof obj === "boolean") return obj ? "true" : "false";
		if (typeof obj === "string") return inspectString(obj, opts);
		if (typeof obj === "number") {
			if (obj === 0) return Infinity / obj > 0 ? "0" : "-0";
			var str = String(obj);
			return numericSeparator ? addNumericSeparator(obj, str) : str;
		}
		if (typeof obj === "bigint") {
			var bigIntStr = String(obj) + "n";
			return numericSeparator ? addNumericSeparator(obj, bigIntStr) : bigIntStr;
		}
		var maxDepth = typeof opts.depth === "undefined" ? 5 : opts.depth;
		if (typeof depth === "undefined") depth = 0;
		if (depth >= maxDepth && maxDepth > 0 && typeof obj === "object") return isArray(obj) ? "[Array]" : "[Object]";
		var indent = getIndent(opts, depth);
		if (typeof seen === "undefined") seen = [];
		else if (indexOf(seen, obj) >= 0) return "[Circular]";
		function inspect3(value, from, noIndent) {
			if (from) {
				seen = $arrSlice.call(seen);
				seen.push(from);
			}
			if (noIndent) {
				var newOpts = { depth: opts.depth };
				if (has(opts, "quoteStyle")) newOpts.quoteStyle = opts.quoteStyle;
				return inspect_(value, newOpts, depth + 1, seen);
			}
			return inspect_(value, opts, depth + 1, seen);
		}
		if (typeof obj === "function" && !isRegExp(obj)) {
			var name = nameOf(obj);
			var keys = arrObjKeys(obj, inspect3);
			return "[Function" + (name ? ": " + name : " (anonymous)") + "]" + (keys.length > 0 ? " { " + $join.call(keys, ", ") + " }" : "");
		}
		if (isSymbol(obj)) {
			var symString = hasShammedSymbols ? $replace.call(String(obj), /^(Symbol\(.*\))_[^)]*$/, "$1") : symToString.call(obj);
			return typeof obj === "object" && !hasShammedSymbols ? markBoxed(symString) : symString;
		}
		if (isElement(obj)) {
			var s = "<" + $toLowerCase.call(String(obj.nodeName));
			var attrs = obj.attributes || [];
			for (var i = 0; i < attrs.length; i++) s += " " + attrs[i].name + "=" + wrapQuotes(quote(attrs[i].value), "double", opts);
			s += ">";
			if (obj.childNodes && obj.childNodes.length) s += "...";
			s += "</" + $toLowerCase.call(String(obj.nodeName)) + ">";
			return s;
		}
		if (isArray(obj)) {
			if (obj.length === 0) return "[]";
			var xs = arrObjKeys(obj, inspect3);
			if (indent && !singleLineValues(xs)) return "[" + indentedJoin(xs, indent) + "]";
			return "[ " + $join.call(xs, ", ") + " ]";
		}
		if (isError(obj)) {
			var parts = arrObjKeys(obj, inspect3);
			if (!("cause" in Error.prototype) && "cause" in obj && !isEnumerable.call(obj, "cause")) return "{ [" + String(obj) + "] " + $join.call($concat.call("[cause]: " + inspect3(obj.cause), parts), ", ") + " }";
			if (parts.length === 0) return "[" + String(obj) + "]";
			return "{ [" + String(obj) + "] " + $join.call(parts, ", ") + " }";
		}
		if (typeof obj === "object" && customInspect) {
			if (inspectSymbol && typeof obj[inspectSymbol] === "function" && utilInspect) return utilInspect(obj, { depth: maxDepth - depth });
			else if (customInspect !== "symbol" && typeof obj.inspect === "function") return obj.inspect();
		}
		if (isMap(obj)) {
			var mapParts = [];
			if (mapForEach) mapForEach.call(obj, function(value, key) {
				mapParts.push(inspect3(key, obj, true) + " => " + inspect3(value, obj));
			});
			return collectionOf("Map", mapSize.call(obj), mapParts, indent);
		}
		if (isSet(obj)) {
			var setParts = [];
			if (setForEach) setForEach.call(obj, function(value) {
				setParts.push(inspect3(value, obj));
			});
			return collectionOf("Set", setSize.call(obj), setParts, indent);
		}
		if (isWeakMap(obj)) return weakCollectionOf("WeakMap");
		if (isWeakSet(obj)) return weakCollectionOf("WeakSet");
		if (isWeakRef(obj)) return weakCollectionOf("WeakRef");
		if (isNumber(obj)) return markBoxed(inspect3(Number(obj)));
		if (isBigInt(obj)) return markBoxed(inspect3(bigIntValueOf.call(obj)));
		if (isBoolean(obj)) return markBoxed(booleanValueOf.call(obj));
		if (isString(obj)) return markBoxed(inspect3(String(obj)));
		if (typeof window !== "undefined" && obj === window) return "{ [object Window] }";
		if (typeof globalThis !== "undefined" && obj === globalThis || typeof global !== "undefined" && obj === global) return "{ [object globalThis] }";
		if (!isDate(obj) && !isRegExp(obj)) {
			var ys = arrObjKeys(obj, inspect3);
			var isPlainObject = gPO ? gPO(obj) === Object.prototype : obj instanceof Object || obj.constructor === Object;
			var protoTag = obj instanceof Object ? "" : "null prototype";
			var stringTag = !isPlainObject && toStringTag && Object(obj) === obj && toStringTag in obj ? $slice.call(toStr(obj), 8, -1) : protoTag ? "Object" : "";
			var tag = (isPlainObject || typeof obj.constructor !== "function" ? "" : obj.constructor.name ? obj.constructor.name + " " : "") + (stringTag || protoTag ? "[" + $join.call($concat.call([], stringTag || [], protoTag || []), ": ") + "] " : "");
			if (ys.length === 0) return tag + "{}";
			if (indent) return tag + "{" + indentedJoin(ys, indent) + "}";
			return tag + "{ " + $join.call(ys, ", ") + " }";
		}
		return String(obj);
	};
	function wrapQuotes(s, defaultStyle, opts) {
		var quoteChar = quotes[opts.quoteStyle || defaultStyle];
		return quoteChar + s + quoteChar;
	}
	function quote(s) {
		return $replace.call(String(s), /"/g, "&quot;");
	}
	function canTrustToString(obj) {
		return !toStringTag || !(typeof obj === "object" && (toStringTag in obj || typeof obj[toStringTag] !== "undefined"));
	}
	function isArray(obj) {
		return toStr(obj) === "[object Array]" && canTrustToString(obj);
	}
	function isDate(obj) {
		return toStr(obj) === "[object Date]" && canTrustToString(obj);
	}
	function isRegExp(obj) {
		return toStr(obj) === "[object RegExp]" && canTrustToString(obj);
	}
	function isError(obj) {
		return toStr(obj) === "[object Error]" && canTrustToString(obj);
	}
	function isString(obj) {
		return toStr(obj) === "[object String]" && canTrustToString(obj);
	}
	function isNumber(obj) {
		return toStr(obj) === "[object Number]" && canTrustToString(obj);
	}
	function isBoolean(obj) {
		return toStr(obj) === "[object Boolean]" && canTrustToString(obj);
	}
	function isSymbol(obj) {
		if (hasShammedSymbols) return obj && typeof obj === "object" && obj instanceof Symbol;
		if (typeof obj === "symbol") return true;
		if (!obj || typeof obj !== "object" || !symToString) return false;
		try {
			symToString.call(obj);
			return true;
		} catch (e) {}
		return false;
	}
	function isBigInt(obj) {
		if (!obj || typeof obj !== "object" || !bigIntValueOf) return false;
		try {
			bigIntValueOf.call(obj);
			return true;
		} catch (e) {}
		return false;
	}
	var hasOwn2 = Object.prototype.hasOwnProperty || function(key) {
		return key in this;
	};
	function has(obj, key) {
		return hasOwn2.call(obj, key);
	}
	function toStr(obj) {
		return objectToString.call(obj);
	}
	function nameOf(f) {
		if (f.name) return f.name;
		var m = $match.call(functionToString.call(f), /^function\s*([\w$]+)/);
		if (m) return m[1];
		return null;
	}
	function indexOf(xs, x) {
		if (xs.indexOf) return xs.indexOf(x);
		for (var i = 0, l = xs.length; i < l; i++) if (xs[i] === x) return i;
		return -1;
	}
	function isMap(x) {
		if (!mapSize || !x || typeof x !== "object") return false;
		try {
			mapSize.call(x);
			try {
				setSize.call(x);
			} catch (s) {
				return true;
			}
			return x instanceof Map;
		} catch (e) {}
		return false;
	}
	function isWeakMap(x) {
		if (!weakMapHas || !x || typeof x !== "object") return false;
		try {
			weakMapHas.call(x, weakMapHas);
			try {
				weakSetHas.call(x, weakSetHas);
			} catch (s) {
				return true;
			}
			return x instanceof WeakMap;
		} catch (e) {}
		return false;
	}
	function isWeakRef(x) {
		if (!weakRefDeref || !x || typeof x !== "object") return false;
		try {
			weakRefDeref.call(x);
			return true;
		} catch (e) {}
		return false;
	}
	function isSet(x) {
		if (!setSize || !x || typeof x !== "object") return false;
		try {
			setSize.call(x);
			try {
				mapSize.call(x);
			} catch (m) {
				return true;
			}
			return x instanceof Set;
		} catch (e) {}
		return false;
	}
	function isWeakSet(x) {
		if (!weakSetHas || !x || typeof x !== "object") return false;
		try {
			weakSetHas.call(x, weakSetHas);
			try {
				weakMapHas.call(x, weakMapHas);
			} catch (s) {
				return true;
			}
			return x instanceof WeakSet;
		} catch (e) {}
		return false;
	}
	function isElement(x) {
		if (!x || typeof x !== "object") return false;
		if (typeof HTMLElement !== "undefined" && x instanceof HTMLElement) return true;
		return typeof x.nodeName === "string" && typeof x.getAttribute === "function";
	}
	function inspectString(str, opts) {
		if (str.length > opts.maxStringLength) {
			var remaining = str.length - opts.maxStringLength;
			var trailer = "... " + remaining + " more character" + (remaining > 1 ? "s" : "");
			return inspectString($slice.call(str, 0, opts.maxStringLength), opts) + trailer;
		}
		var quoteRE = quoteREs[opts.quoteStyle || "single"];
		quoteRE.lastIndex = 0;
		return wrapQuotes($replace.call($replace.call(str, quoteRE, "\\$1"), /[\x00-\x1f]/g, lowbyte), "single", opts);
	}
	function lowbyte(c) {
		var n = c.charCodeAt(0);
		var x = {
			8: "b",
			9: "t",
			10: "n",
			12: "f",
			13: "r"
		}[n];
		if (x) return "\\" + x;
		return "\\x" + (n < 16 ? "0" : "") + $toUpperCase.call(n.toString(16));
	}
	function markBoxed(str) {
		return "Object(" + str + ")";
	}
	function weakCollectionOf(type) {
		return type + " { ? }";
	}
	function collectionOf(type, size, entries, indent) {
		var joinedEntries = indent ? indentedJoin(entries, indent) : $join.call(entries, ", ");
		return type + " (" + size + ") {" + joinedEntries + "}";
	}
	function singleLineValues(xs) {
		for (var i = 0; i < xs.length; i++) if (indexOf(xs[i], "\n") >= 0) return false;
		return true;
	}
	function getIndent(opts, depth) {
		var baseIndent;
		if (opts.indent === "	") baseIndent = "	";
		else if (typeof opts.indent === "number" && opts.indent > 0) baseIndent = $join.call(Array(opts.indent + 1), " ");
		else return null;
		return {
			base: baseIndent,
			prev: $join.call(Array(depth + 1), baseIndent)
		};
	}
	function indentedJoin(xs, indent) {
		if (xs.length === 0) return "";
		var lineJoiner = "\n" + indent.prev + indent.base;
		return lineJoiner + $join.call(xs, "," + lineJoiner) + "\n" + indent.prev;
	}
	function arrObjKeys(obj, inspect3) {
		var isArr = isArray(obj);
		var xs = [];
		if (isArr) {
			xs.length = obj.length;
			for (var i = 0; i < obj.length; i++) xs[i] = has(obj, i) ? inspect3(obj[i], obj) : "";
		}
		var syms = typeof gOPS === "function" ? gOPS(obj) : [];
		var symMap;
		if (hasShammedSymbols) {
			symMap = {};
			for (var k = 0; k < syms.length; k++) symMap["$" + syms[k]] = syms[k];
		}
		for (var key in obj) {
			if (!has(obj, key)) continue;
			if (isArr && String(Number(key)) === key && key < obj.length) continue;
			if (hasShammedSymbols && symMap["$" + key] instanceof Symbol) continue;
			else if ($test.call(/[^\w$]/, key)) xs.push(inspect3(key, obj) + ": " + inspect3(obj[key], obj));
			else xs.push(key + ": " + inspect3(obj[key], obj));
		}
		if (typeof gOPS === "function") {
			for (var j = 0; j < syms.length; j++) if (isEnumerable.call(obj, syms[j])) xs.push("[" + inspect3(syms[j]) + "]: " + inspect3(obj[syms[j]], obj));
		}
		return xs;
	}
} });
var textDecoder = new TextDecoder("utf-8");
var BinaryReader = class {
	/**
	* The DataView used to read values from the binary data.
	*
	* Note: The DataView's `byteOffset` is relative to the beginning of the
	* underlying ArrayBuffer, not the start of the provided Uint8Array input.
	* This `BinaryReader`'s `#offset` field is used to track the current read position
	* relative to the start of the provided Uint8Array input.
	*/
	view;
	/**
	* Represents the offset (in bytes) relative to the start of the DataView
	* and provided Uint8Array input.
	*
	* Note: This is *not* the absolute byte offset within the underlying ArrayBuffer.
	*/
	offset = 0;
	constructor(input) {
		this.view = input instanceof DataView ? input : new DataView(input.buffer, input.byteOffset, input.byteLength);
		this.offset = 0;
	}
	reset(input) {
		this.view = input instanceof DataView ? input : new DataView(input.buffer, input.byteOffset, input.byteLength);
		this.offset = 0;
	}
	get remaining() {
		return this.view.byteLength - this.offset;
	}
	/** Ensure we have at least `n` bytes left to read */
	#ensure(n) {
		if (this.offset + n > this.view.byteLength) throw new RangeError(`Tried to read ${n} byte(s) at relative offset ${this.offset}, but only ${this.remaining} byte(s) remain`);
	}
	readUInt8Array() {
		const length = this.readU32();
		this.#ensure(length);
		return this.readBytes(length).slice();
	}
	readBool() {
		const value = this.view.getUint8(this.offset);
		this.offset += 1;
		return value !== 0;
	}
	readByte() {
		const value = this.view.getUint8(this.offset);
		this.offset += 1;
		return value;
	}
	readBytes(length) {
		const array = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
		this.offset += length;
		return array;
	}
	readI8() {
		const value = this.view.getInt8(this.offset);
		this.offset += 1;
		return value;
	}
	readU8() {
		return this.readByte();
	}
	readI16() {
		const value = this.view.getInt16(this.offset, true);
		this.offset += 2;
		return value;
	}
	readU16() {
		const value = this.view.getUint16(this.offset, true);
		this.offset += 2;
		return value;
	}
	readI32() {
		const value = this.view.getInt32(this.offset, true);
		this.offset += 4;
		return value;
	}
	readU32() {
		const value = this.view.getUint32(this.offset, true);
		this.offset += 4;
		return value;
	}
	readI64() {
		const value = this.view.getBigInt64(this.offset, true);
		this.offset += 8;
		return value;
	}
	readU64() {
		const value = this.view.getBigUint64(this.offset, true);
		this.offset += 8;
		return value;
	}
	readU128() {
		const lowerPart = this.view.getBigUint64(this.offset, true);
		const upperPart = this.view.getBigUint64(this.offset + 8, true);
		this.offset += 16;
		return (upperPart << BigInt(64)) + lowerPart;
	}
	readI128() {
		const lowerPart = this.view.getBigUint64(this.offset, true);
		const upperPart = this.view.getBigInt64(this.offset + 8, true);
		this.offset += 16;
		return (upperPart << BigInt(64)) + lowerPart;
	}
	readU256() {
		const p0 = this.view.getBigUint64(this.offset, true);
		const p1 = this.view.getBigUint64(this.offset + 8, true);
		const p2 = this.view.getBigUint64(this.offset + 16, true);
		const p3 = this.view.getBigUint64(this.offset + 24, true);
		this.offset += 32;
		return (p3 << BigInt(192)) + (p2 << BigInt(128)) + (p1 << BigInt(64)) + p0;
	}
	readI256() {
		const p0 = this.view.getBigUint64(this.offset, true);
		const p1 = this.view.getBigUint64(this.offset + 8, true);
		const p2 = this.view.getBigUint64(this.offset + 16, true);
		const p3 = this.view.getBigInt64(this.offset + 24, true);
		this.offset += 32;
		return (p3 << BigInt(192)) + (p2 << BigInt(128)) + (p1 << BigInt(64)) + p0;
	}
	readF32() {
		const value = this.view.getFloat32(this.offset, true);
		this.offset += 4;
		return value;
	}
	readF64() {
		const value = this.view.getFloat64(this.offset, true);
		this.offset += 8;
		return value;
	}
	readString() {
		const length = this.readU32();
		this.#ensure(length);
		const bytes = this.readBytes(length);
		return textDecoder.decode(bytes);
	}
};
var import_base64_js = __toESM(require_base64_js());
var textEncoder = new TextEncoder();
var ArrayBufferPrototypeTransfer = ArrayBuffer.prototype.transfer ?? function(newByteLength) {
	if (newByteLength === void 0) return this.slice();
	else if (newByteLength <= this.byteLength) return this.slice(0, newByteLength);
	else {
		const copy = new Uint8Array(newByteLength);
		copy.set(new Uint8Array(this));
		return copy.buffer;
	}
};
var ResizableBuffer = class {
	buffer;
	view;
	constructor(init) {
		this.buffer = typeof init === "number" ? new ArrayBuffer(init) : init;
		this.view = new DataView(this.buffer);
	}
	get capacity() {
		return this.buffer.byteLength;
	}
	grow(newSize) {
		if (newSize <= this.buffer.byteLength) return;
		this.buffer = ArrayBufferPrototypeTransfer.call(this.buffer, newSize);
		this.view = new DataView(this.buffer);
	}
};
var BinaryWriter = class {
	buffer;
	offset = 0;
	constructor(init) {
		this.buffer = typeof init === "number" ? new ResizableBuffer(init) : init;
	}
	clear() {
		this.offset = 0;
	}
	reset(buffer) {
		this.buffer = buffer;
		this.offset = 0;
	}
	expandBuffer(additionalCapacity) {
		const minCapacity = this.offset + additionalCapacity + 1;
		if (minCapacity <= this.buffer.capacity) return;
		let newCapacity = this.buffer.capacity * 2;
		if (newCapacity < minCapacity) newCapacity = minCapacity;
		this.buffer.grow(newCapacity);
	}
	toBase64() {
		return (0, import_base64_js.fromByteArray)(this.getBuffer());
	}
	getBuffer() {
		return new Uint8Array(this.buffer.buffer, 0, this.offset);
	}
	get view() {
		return this.buffer.view;
	}
	writeUInt8Array(value) {
		const length = value.length;
		this.expandBuffer(4 + length);
		this.writeU32(length);
		new Uint8Array(this.buffer.buffer, this.offset).set(value);
		this.offset += length;
	}
	writeBool(value) {
		this.expandBuffer(1);
		this.view.setUint8(this.offset, value ? 1 : 0);
		this.offset += 1;
	}
	writeByte(value) {
		this.expandBuffer(1);
		this.view.setUint8(this.offset, value);
		this.offset += 1;
	}
	writeBytes(value) {
		this.expandBuffer(value.length);
		new Uint8Array(this.buffer.buffer, this.offset, value.length).set(value);
		this.offset += value.length;
	}
	writeI8(value) {
		this.expandBuffer(1);
		this.view.setInt8(this.offset, value);
		this.offset += 1;
	}
	writeU8(value) {
		this.expandBuffer(1);
		this.view.setUint8(this.offset, value);
		this.offset += 1;
	}
	writeI16(value) {
		this.expandBuffer(2);
		this.view.setInt16(this.offset, value, true);
		this.offset += 2;
	}
	writeU16(value) {
		this.expandBuffer(2);
		this.view.setUint16(this.offset, value, true);
		this.offset += 2;
	}
	writeI32(value) {
		this.expandBuffer(4);
		this.view.setInt32(this.offset, value, true);
		this.offset += 4;
	}
	writeU32(value) {
		this.expandBuffer(4);
		this.view.setUint32(this.offset, value, true);
		this.offset += 4;
	}
	writeI64(value) {
		this.expandBuffer(8);
		this.view.setBigInt64(this.offset, value, true);
		this.offset += 8;
	}
	writeU64(value) {
		this.expandBuffer(8);
		this.view.setBigUint64(this.offset, value, true);
		this.offset += 8;
	}
	writeU128(value) {
		this.expandBuffer(16);
		const lowerPart = value & BigInt("0xFFFFFFFFFFFFFFFF");
		const upperPart = value >> BigInt(64);
		this.view.setBigUint64(this.offset, lowerPart, true);
		this.view.setBigUint64(this.offset + 8, upperPart, true);
		this.offset += 16;
	}
	writeI128(value) {
		this.expandBuffer(16);
		const lowerPart = value & BigInt("0xFFFFFFFFFFFFFFFF");
		const upperPart = value >> BigInt(64);
		this.view.setBigInt64(this.offset, lowerPart, true);
		this.view.setBigInt64(this.offset + 8, upperPart, true);
		this.offset += 16;
	}
	writeU256(value) {
		this.expandBuffer(32);
		const low_64_mask = BigInt("0xFFFFFFFFFFFFFFFF");
		const p0 = value & low_64_mask;
		const p1 = value >> BigInt(64) & low_64_mask;
		const p2 = value >> BigInt(128) & low_64_mask;
		const p3 = value >> BigInt(192);
		this.view.setBigUint64(this.offset + 0, p0, true);
		this.view.setBigUint64(this.offset + 8, p1, true);
		this.view.setBigUint64(this.offset + 16, p2, true);
		this.view.setBigUint64(this.offset + 24, p3, true);
		this.offset += 32;
	}
	writeI256(value) {
		this.expandBuffer(32);
		const low_64_mask = BigInt("0xFFFFFFFFFFFFFFFF");
		const p0 = value & low_64_mask;
		const p1 = value >> BigInt(64) & low_64_mask;
		const p2 = value >> BigInt(128) & low_64_mask;
		const p3 = value >> BigInt(192);
		this.view.setBigUint64(this.offset + 0, p0, true);
		this.view.setBigUint64(this.offset + 8, p1, true);
		this.view.setBigUint64(this.offset + 16, p2, true);
		this.view.setBigInt64(this.offset + 24, p3, true);
		this.offset += 32;
	}
	writeF32(value) {
		this.expandBuffer(4);
		this.view.setFloat32(this.offset, value, true);
		this.offset += 4;
	}
	writeF64(value) {
		this.expandBuffer(8);
		this.view.setFloat64(this.offset, value, true);
		this.offset += 8;
	}
	writeString(value) {
		const len = value.length;
		this.expandBuffer(4 + len);
		const bytes = new Uint8Array(this.buffer.buffer);
		let offset = this.offset + 4;
		let i = 0;
		for (; i < len; i++) {
			const c = value.charCodeAt(i);
			if (c >= 128) break;
			bytes[offset++] = c;
		}
		if (i === len) {
			this.view.setUint32(this.offset, len, true);
			this.offset = offset;
			return;
		}
		this.writeUInt8Array(textEncoder.encode(value));
	}
};
function deepEqual(obj1, obj2) {
	if (obj1 === obj2) return true;
	if (typeof obj1 !== "object" || obj1 === null || typeof obj2 !== "object" || obj2 === null) return false;
	let firstKey = 0;
	if (obj1 instanceof Uint8Array && obj2 instanceof Uint8Array) {
		if (obj1.length !== obj2.length) return false;
		for (let i = 0; i < obj1.length; i++) if (obj1[i] !== obj2[i]) return false;
		firstKey = obj1.length;
	}
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);
	if (keys1.length !== keys2.length) return false;
	const values1 = obj1;
	const values2 = obj2;
	for (let i = firstKey; i < keys1.length; i++) {
		const key = keys1[i];
		if (!Object.prototype.propertyIsEnumerable.call(obj2, key) || !deepEqual(values1[key], values2[key])) return false;
	}
	return true;
}
function uint8ArrayToHexString(array) {
	return Array.prototype.map.call(array.reverse(), (x) => ("00" + x.toString(16)).slice(-2)).join("");
}
function uint8ArrayToU128(array) {
	if (array.length != 16) throw new Error(`Uint8Array is not 16 bytes long: ${array}`);
	return new BinaryReader(array).readU128();
}
function uint8ArrayToU256(array) {
	if (array.length != 32) throw new Error(`Uint8Array is not 32 bytes long: [${array}]`);
	return new BinaryReader(array).readU256();
}
function hexStringToUint8Array(str) {
	if (str.startsWith("0x")) str = str.slice(2);
	const matches = str.match(/.{1,2}/g) || [];
	return Uint8Array.from(matches.map((byte) => parseInt(byte, 16))).reverse();
}
function hexStringToU128(str) {
	return uint8ArrayToU128(hexStringToUint8Array(str));
}
function hexStringToU256(str) {
	return uint8ArrayToU256(hexStringToUint8Array(str));
}
function u128ToUint8Array(data) {
	const writer = new BinaryWriter(16);
	writer.writeU128(data);
	return writer.getBuffer();
}
function u128ToHexString(data) {
	return uint8ArrayToHexString(u128ToUint8Array(data));
}
function u256ToUint8Array(data) {
	const writer = new BinaryWriter(32);
	writer.writeU256(data);
	return writer.getBuffer();
}
function u256ToHexString(data) {
	return uint8ArrayToHexString(u256ToUint8Array(data));
}
function coerceToBigInt(value, what) {
	if (typeof value === "bigint") return value;
	if (typeof value === "number") return BigInt(value);
	if (typeof value === "string" && value.trim() !== "") return BigInt(value);
	throw new TypeError(`Cannot convert ${typeof value} to ${what}: expected bigint, integer number, or decimal string`);
}
function toPascalCase(s) {
	const str = toCamelCase(s);
	return str.charAt(0).toUpperCase() + str.slice(1);
}
function toCamelCase(s) {
	const str = s.replace(/[-_]+/g, "_").replace(/_([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
	return str.charAt(0).toLowerCase() + str.slice(1);
}
function bsatnBaseSize(typespace, ty) {
	const assumedArrayLength = 4;
	while (ty.tag === "Ref") ty = typespace.types[ty.value];
	if (ty.tag === "Product") {
		let sum = 0;
		for (const { algebraicType: elem } of ty.value.elements) sum += bsatnBaseSize(typespace, elem);
		return sum;
	} else if (ty.tag === "Sum") {
		let min = Infinity;
		for (const { algebraicType: vari } of ty.value.variants) {
			const vSize = bsatnBaseSize(typespace, vari);
			if (vSize < min) min = vSize;
		}
		if (min === Infinity) min = 0;
		return 4 + min;
	} else if (ty.tag == "Array") return 4 + assumedArrayLength * bsatnBaseSize(typespace, ty.value);
	return {
		String: 4 + assumedArrayLength,
		Sum: 1,
		Bool: 1,
		I8: 1,
		U8: 1,
		I16: 2,
		U16: 2,
		I32: 4,
		U32: 4,
		F32: 4,
		I64: 8,
		U64: 8,
		F64: 8,
		I128: 16,
		U128: 16,
		I256: 32,
		U256: 32
	}[ty.tag];
}
var hasOwn = Object.hasOwn;
var TimeDuration = class _TimeDuration {
	__time_duration_micros__;
	static MICROS_PER_MILLIS = 1000n;
	/**
	* Get the algebraic type representation of the {@link TimeDuration} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__time_duration_micros__",
			algebraicType: AlgebraicType.I64
		}] });
	}
	static isTimeDuration(algebraicType) {
		if (algebraicType.tag !== "Product") return false;
		const elements = algebraicType.value.elements;
		if (elements.length !== 1) return false;
		const microsElement = elements[0];
		return microsElement.name === "__time_duration_micros__" && microsElement.algebraicType.tag === "I64";
	}
	get micros() {
		return this.__time_duration_micros__;
	}
	get millis() {
		return Number(this.micros / _TimeDuration.MICROS_PER_MILLIS);
	}
	constructor(micros) {
		this.__time_duration_micros__ = coerceToBigInt(micros, "TimeDuration");
	}
	static fromMillis(millis) {
		return new _TimeDuration(BigInt(millis) * _TimeDuration.MICROS_PER_MILLIS);
	}
	/** This outputs the same string format that we use in the host and in Rust modules */
	toString() {
		const micros = this.micros;
		const sign = micros < 0 ? "-" : "+";
		const pos = micros < 0 ? -micros : micros;
		const secs = pos / 1000000n;
		const micros_remaining = pos % 1000000n;
		return `${sign}${secs}.${String(micros_remaining).padStart(6, "0")}`;
	}
};
var Timestamp = class _Timestamp {
	__timestamp_micros_since_unix_epoch__;
	static MICROS_PER_MILLIS = 1000n;
	get microsSinceUnixEpoch() {
		return this.__timestamp_micros_since_unix_epoch__;
	}
	constructor(micros) {
		this.__timestamp_micros_since_unix_epoch__ = coerceToBigInt(micros, "Timestamp");
	}
	/**
	* Get the algebraic type representation of the {@link Timestamp} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__timestamp_micros_since_unix_epoch__",
			algebraicType: AlgebraicType.I64
		}] });
	}
	static isTimestamp(algebraicType) {
		if (algebraicType.tag !== "Product") return false;
		const elements = algebraicType.value.elements;
		if (elements.length !== 1) return false;
		const microsElement = elements[0];
		return microsElement.name === "__timestamp_micros_since_unix_epoch__" && microsElement.algebraicType.tag === "I64";
	}
	/**
	* The Unix epoch, the midnight at the beginning of January 1, 1970, UTC.
	*/
	static UNIX_EPOCH = new _Timestamp(0n);
	/**
	* Get a `Timestamp` representing the execution environment's belief of the current moment in time.
	*/
	static now() {
		return _Timestamp.fromDate(/* @__PURE__ */ new Date());
	}
	/** Convert to milliseconds since Unix epoch. */
	toMillis() {
		return this.microsSinceUnixEpoch / 1000n;
	}
	/**
	* Get a `Timestamp` representing the same point in time as `date`.
	*/
	static fromDate(date) {
		const millis = date.getTime();
		return new _Timestamp(BigInt(millis) * _Timestamp.MICROS_PER_MILLIS);
	}
	/**
	* Get a `Date` representing approximately the same point in time as `this`.
	*
	* This method truncates to millisecond precision,
	* and throws `RangeError` if the `Timestamp` is outside the range representable as a `Date`.
	*/
	toDate() {
		const millis = this.__timestamp_micros_since_unix_epoch__ / _Timestamp.MICROS_PER_MILLIS;
		if (millis > BigInt(Number.MAX_SAFE_INTEGER) || millis < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Timestamp is outside of the representable range of JS's Date");
		return new Date(Number(millis));
	}
	/**
	* Get an ISO 8601 / RFC 3339 formatted string representation of this timestamp with microsecond precision.
	*
	* This method preserves the full microsecond precision of the timestamp,
	* and throws `RangeError` if the `Timestamp` is outside the range representable in ISO format.
	*
	* @returns ISO 8601 formatted string with microsecond precision (e.g., '2025-02-17T10:30:45.123456Z')
	*/
	toISOString() {
		const micros = this.__timestamp_micros_since_unix_epoch__;
		const millis = micros / _Timestamp.MICROS_PER_MILLIS;
		if (millis > BigInt(Number.MAX_SAFE_INTEGER) || millis < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Timestamp is outside of the representable range for ISO string formatting");
		const isoBase = new Date(Number(millis)).toISOString();
		const microsRemainder = Math.abs(Number(micros % 1000000n));
		const fractionalPart = String(microsRemainder).padStart(6, "0");
		return isoBase.replace(/\.\d{3}Z$/, `.${fractionalPart}Z`);
	}
	since(other) {
		return new TimeDuration(this.__timestamp_micros_since_unix_epoch__ - other.__timestamp_micros_since_unix_epoch__);
	}
};
var Uuid = class _Uuid {
	__uuid__;
	/**
	* The nil UUID (all zeros).
	*
	* @example
	* ```ts
	* const uuid = Uuid.NIL;
	* console.assert(
	*   uuid.toString() === "00000000-0000-0000-0000-000000000000"
	* );
	* ```
	*/
	static NIL = new _Uuid(0n);
	static MAX_UUID_BIGINT = 340282366920938463463374607431768211455n;
	/**
	* The max UUID (all ones).
	*
	* @example
	* ```ts
	* const uuid = Uuid.MAX;
	* console.assert(
	*   uuid.toString() === "ffffffff-ffff-ffff-ffff-ffffffffffff"
	* );
	* ```
	*/
	static MAX = new _Uuid(_Uuid.MAX_UUID_BIGINT);
	/**
	* Create a UUID from a raw 128-bit value.
	*
	* @param u - Unsigned 128-bit integer
	* @throws {Error} If the value is outside the valid UUID range
	*/
	constructor(u) {
		const v = coerceToBigInt(u, "Uuid");
		if (v < 0n || v > _Uuid.MAX_UUID_BIGINT) throw new Error("Invalid UUID: must be between 0 and `MAX_UUID_BIGINT`");
		this.__uuid__ = v;
	}
	/**
	* Create a UUID `v4` from explicit random bytes.
	*
	* This method assumes the bytes are already sufficiently random.
	* It only sets the appropriate bits for the UUID version and variant.
	*
	* @param bytes - Exactly 16 random bytes
	* @returns A UUID `v4`
	* @throws {Error} If `bytes.length !== 16`
	*
	* @example
	* ```ts
	* const randomBytes = new Uint8Array(16);
	* const uuid = Uuid.fromRandomBytesV4(randomBytes);
	*
	* console.assert(
	*   uuid.toString() === "00000000-0000-4000-8000-000000000000"
	* );
	* ```
	*/
	static fromRandomBytesV4(bytes) {
		if (bytes.length !== 16) throw new Error("UUID v4 requires 16 bytes");
		const arr = new Uint8Array(bytes);
		arr[6] = arr[6] & 15 | 64;
		arr[8] = arr[8] & 63 | 128;
		return new _Uuid(_Uuid.bytesToBigInt(arr));
	}
	/**
	* Generate a UUID `v7` using a monotonic counter from `0` to `2^31 - 1`,
	* a timestamp, and 4 random bytes.
	*
	* The counter wraps around on overflow.
	*
	* The UUID `v7` is structured as follows:
	*
	* ```ascii
	* ┌───────────────────────────────────────────────┬───────────────────┐
	* | B0  | B1  | B2  | B3  | B4  | B5              |         B6        |
	* ├───────────────────────────────────────────────┼───────────────────┤
	* |                 unix_ts_ms                    |      version 7    |
	* └───────────────────────────────────────────────┴───────────────────┘
	* ┌──────────────┬─────────┬──────────────────┬───────────────────────┐
	* | B7           | B8      | B9  | B10 | B11  | B12 | B13 | B14 | B15 |
	* ├──────────────┼─────────┼──────────────────┼───────────────────────┤
	* | counter_high | variant |    counter_low   |        random         |
	* └──────────────┴─────────┴──────────────────┴───────────────────────┘
	* ```
	*
	* @param counter - Mutable monotonic counter (31-bit)
	* @param now - Timestamp since the Unix epoch
	* @param randomBytes - Exactly 4 random bytes
	* @returns A UUID `v7`
	*
	* @throws {Error} If the `counter` is negative
	* @throws {Error} If the `timestamp` is before the Unix epoch
	* @throws {Error} If `randomBytes.length !== 4`
	*
	* @example
	* ```ts
	* const now = Timestamp.fromMillis(1_686_000_000_000n);
	* const counter = { value: 1 };
	* const randomBytes = new Uint8Array(4);
	*
	* const uuid = Uuid.fromCounterV7(counter, now, randomBytes);
	*
	* console.assert(
	*   uuid.toString() === "0000647e-5180-7000-8000-000200000000"
	* );
	* ```
	*/
	static fromCounterV7(counter, now, randomBytes) {
		if (randomBytes.length !== 4) throw new Error("`fromCounterV7` requires `randomBytes.length == 4`");
		if (counter.value < 0) throw new Error("`fromCounterV7` uuid `counter` must be non-negative");
		if (now.__timestamp_micros_since_unix_epoch__ < 0) throw new Error("`fromCounterV7` `timestamp` before unix epoch");
		const counterVal = counter.value;
		counter.value = counterVal + 1 & 2147483647;
		const tsMs = now.toMillis() & 281474976710655n;
		const bytes = new Uint8Array(16);
		bytes[0] = Number(tsMs >> 40n & 255n);
		bytes[1] = Number(tsMs >> 32n & 255n);
		bytes[2] = Number(tsMs >> 24n & 255n);
		bytes[3] = Number(tsMs >> 16n & 255n);
		bytes[4] = Number(tsMs >> 8n & 255n);
		bytes[5] = Number(tsMs & 255n);
		bytes[7] = counterVal >>> 23 & 255;
		bytes[9] = counterVal >>> 15 & 255;
		bytes[10] = counterVal >>> 7 & 255;
		bytes[11] = (counterVal & 127) << 1 & 255;
		bytes[12] |= randomBytes[0] & 127;
		bytes[13] = randomBytes[1];
		bytes[14] = randomBytes[2];
		bytes[15] = randomBytes[3];
		bytes[6] = bytes[6] & 15 | 112;
		bytes[8] = bytes[8] & 63 | 128;
		return new _Uuid(_Uuid.bytesToBigInt(bytes));
	}
	/**
	* Parse a UUID from a string representation.
	*
	* @param s - UUID string
	* @returns Parsed UUID
	* @throws {Error} If the string is not a valid UUID
	*
	* @example
	* ```ts
	* const s = "01888d6e-5c00-7000-8000-000000000000";
	* const uuid = Uuid.parse(s);
	*
	* console.assert(uuid.toString() === s);
	* ```
	*/
	static parse(s) {
		const hex = s.replace(/-/g, "");
		if (hex.length !== 32) throw new Error("Invalid hex UUID");
		let v = 0n;
		for (let i = 0; i < 32; i += 2) v = v << 8n | BigInt(parseInt(hex.slice(i, i + 2), 16));
		return new _Uuid(v);
	}
	/** Convert to hex string without a 0x prefix. */
	toHexString() {
		return u128ToHexString(this.asBigInt());
	}
	/** Convert to string (hyphenated form). */
	toString() {
		const hex = this.toHexString();
		return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
	}
	/** Convert to bigint (u128). */
	asBigInt() {
		return this.__uuid__;
	}
	/** Return a `Uint8Array` of 16 bytes. */
	toBytes() {
		return _Uuid.bigIntToBytes(this.__uuid__);
	}
	static bytesToBigInt(bytes) {
		let result = 0n;
		for (const b of bytes) result = result << 8n | BigInt(b);
		return result;
	}
	static bigIntToBytes(value) {
		const bytes = new Uint8Array(16);
		for (let i = 15; i >= 0; i--) {
			bytes[i] = Number(value & 255n);
			value >>= 8n;
		}
		return bytes;
	}
	/**
	* Returns the version of this UUID.
	*
	* This represents the algorithm used to generate the value.
	*
	* @returns A `UuidVersion`
	* @throws {Error} If the version field is not recognized
	*/
	getVersion() {
		const version = this.toBytes()[6] >> 4 & 15;
		switch (version) {
			case 4: return "V4";
			case 7: return "V7";
			default:
				if (this == _Uuid.NIL) return "Nil";
				if (this == _Uuid.MAX) return "Max";
				throw new Error(`Unsupported UUID version: ${version}`);
		}
	}
	/**
	* Extract the monotonic counter from a UUIDv7.
	*
	* Intended for testing and diagnostics.
	* Behavior is undefined if called on a non-V7 UUID.
	*
	* @returns 31-bit counter value
	*/
	getCounter() {
		const bytes = this.toBytes();
		const high = bytes[7];
		const mid1 = bytes[9];
		const mid2 = bytes[10];
		const low = bytes[11] >>> 1;
		return high << 23 | mid1 << 15 | mid2 << 7 | low | 0;
	}
	compareTo(other) {
		if (this.__uuid__ < other.__uuid__) return -1;
		if (this.__uuid__ > other.__uuid__) return 1;
		return 0;
	}
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__uuid__",
			algebraicType: AlgebraicType.U128
		}] });
	}
};
var ConnectionId = class _ConnectionId {
	__connection_id__;
	/**
	* Creates a new `ConnectionId`.
	*/
	constructor(data) {
		this.__connection_id__ = coerceToBigInt(data, "ConnectionId");
	}
	/**
	* Get the algebraic type representation of the {@link ConnectionId} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__connection_id__",
			algebraicType: AlgebraicType.U128
		}] });
	}
	isZero() {
		return this.__connection_id__ === BigInt(0);
	}
	static nullIfZero(addr) {
		if (addr.isZero()) return null;
		else return addr;
	}
	static random() {
		function randomU8() {
			return Math.floor(Math.random() * 255);
		}
		let result = BigInt(0);
		for (let i = 0; i < 16; i++) result = result << BigInt(8) | BigInt(randomU8());
		return new _ConnectionId(result);
	}
	/**
	* Compare two connection IDs for equality.
	*/
	isEqual(other) {
		return this.__connection_id__ == other.__connection_id__;
	}
	/**
	* Check if two connection IDs are equal.
	*/
	equals(other) {
		return this.isEqual(other);
	}
	/**
	* Print the connection ID as a hexadecimal string.
	*/
	toHexString() {
		return u128ToHexString(this.__connection_id__);
	}
	/**
	* Convert the connection ID to a Uint8Array.
	*/
	toUint8Array() {
		return u128ToUint8Array(this.__connection_id__);
	}
	/**
	* Parse a connection ID from a hexadecimal string.
	*/
	static fromString(str) {
		return new _ConnectionId(hexStringToU128(str));
	}
	static fromStringOrNull(str) {
		const addr = _ConnectionId.fromString(str);
		if (addr.isZero()) return null;
		else return addr;
	}
};
var Identity = class _Identity {
	__identity__;
	/**
	* Creates a new `Identity`.
	*
	* `data` can be a hexadecimal string or a `bigint`.
	*/
	constructor(data) {
		this.__identity__ = typeof data === "string" ? hexStringToU256(data) : coerceToBigInt(data, "Identity");
	}
	/**
	* Get the algebraic type representation of the {@link Identity} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__identity__",
			algebraicType: AlgebraicType.U256
		}] });
	}
	/**
	* Check if two identities are equal.
	*/
	isEqual(other) {
		return this.toHexString() === other.toHexString();
	}
	/**
	* Check if two identities are equal.
	*/
	equals(other) {
		return this.isEqual(other);
	}
	/**
	* Print the identity as a hexadecimal string.
	*/
	toHexString() {
		return u256ToHexString(this.__identity__);
	}
	/**
	* Convert the address to a Uint8Array.
	*/
	toUint8Array() {
		return u256ToUint8Array(this.__identity__);
	}
	/**
	* Parse an Identity from a hexadecimal string.
	*/
	static fromString(str) {
		return new _Identity(str);
	}
	/**
	* Zero identity (0x0000000000000000000000000000000000000000000000000000000000000000)
	*/
	static zero() {
		return new _Identity(0n);
	}
	toString() {
		return this.toHexString();
	}
};
var SERIALIZERS = /* @__PURE__ */ new Map();
var DESERIALIZERS = /* @__PURE__ */ new Map();
var AlgebraicType = {
	Ref: (value) => ({
		tag: "Ref",
		value
	}),
	Sum: (value) => ({
		tag: "Sum",
		value
	}),
	Product: (value) => ({
		tag: "Product",
		value
	}),
	Array: (value) => ({
		tag: "Array",
		value
	}),
	String: { tag: "String" },
	Bool: { tag: "Bool" },
	I8: { tag: "I8" },
	U8: { tag: "U8" },
	I16: { tag: "I16" },
	U16: { tag: "U16" },
	I32: { tag: "I32" },
	U32: { tag: "U32" },
	I64: { tag: "I64" },
	U64: { tag: "U64" },
	I128: { tag: "I128" },
	U128: { tag: "U128" },
	I256: { tag: "I256" },
	U256: { tag: "U256" },
	F32: { tag: "F32" },
	F64: { tag: "F64" },
	makeSerializer(ty, typespace) {
		if (ty.tag === "Ref") {
			if (!typespace) throw new Error("cannot serialize refs without a typespace");
			while (ty.tag === "Ref") ty = typespace.types[ty.value];
		}
		switch (ty.tag) {
			case "Product": return ProductType.makeSerializer(ty.value, typespace);
			case "Sum": return SumType.makeSerializer(ty.value, typespace);
			case "Array": if (ty.value.tag === "U8") return serializeUint8Array;
			else {
				const serialize = AlgebraicType.makeSerializer(ty.value, typespace);
				return (writer, value) => {
					writer.writeU32(value.length);
					for (const elem of value) serialize(writer, elem);
				};
			}
			default: return primitiveSerializers[ty.tag];
		}
	},
	serializeValue(writer, ty, value, typespace) {
		AlgebraicType.makeSerializer(ty, typespace)(writer, value);
	},
	makeDeserializer(ty, typespace) {
		if (ty.tag === "Ref") {
			if (!typespace) throw new Error("cannot deserialize refs without a typespace");
			while (ty.tag === "Ref") ty = typespace.types[ty.value];
		}
		switch (ty.tag) {
			case "Product": return ProductType.makeDeserializer(ty.value, typespace);
			case "Sum": return SumType.makeDeserializer(ty.value, typespace);
			case "Array": if (ty.value.tag === "U8") return deserializeUint8Array;
			else {
				const deserialize = AlgebraicType.makeDeserializer(ty.value, typespace);
				return (reader) => {
					const length = reader.readU32();
					const result = Array(length);
					for (let i = 0; i < length; i++) result[i] = deserialize(reader);
					return result;
				};
			}
			default: return primitiveDeserializers[ty.tag];
		}
	},
	deserializeValue(reader, ty, typespace) {
		return AlgebraicType.makeDeserializer(ty, typespace)(reader);
	},
	intoMapKey: function(ty, value) {
		switch (ty.tag) {
			case "U8":
			case "U16":
			case "U32":
			case "U64":
			case "U128":
			case "U256":
			case "I8":
			case "I16":
			case "I32":
			case "I64":
			case "I128":
			case "I256":
			case "F32":
			case "F64":
			case "String":
			case "Bool": return value;
			case "Product": return ProductType.intoMapKey(ty.value, value);
			default: {
				const writer = new BinaryWriter(10);
				AlgebraicType.serializeValue(writer, ty, value);
				return writer.toBase64();
			}
		}
	}
};
function bindCall(f) {
	return Function.prototype.call.bind(f);
}
var primitiveSerializers = {
	Bool: bindCall(BinaryWriter.prototype.writeBool),
	I8: bindCall(BinaryWriter.prototype.writeI8),
	U8: bindCall(BinaryWriter.prototype.writeU8),
	I16: bindCall(BinaryWriter.prototype.writeI16),
	U16: bindCall(BinaryWriter.prototype.writeU16),
	I32: bindCall(BinaryWriter.prototype.writeI32),
	U32: bindCall(BinaryWriter.prototype.writeU32),
	I64: bindCall(BinaryWriter.prototype.writeI64),
	U64: bindCall(BinaryWriter.prototype.writeU64),
	I128: bindCall(BinaryWriter.prototype.writeI128),
	U128: bindCall(BinaryWriter.prototype.writeU128),
	I256: bindCall(BinaryWriter.prototype.writeI256),
	U256: bindCall(BinaryWriter.prototype.writeU256),
	F32: bindCall(BinaryWriter.prototype.writeF32),
	F64: bindCall(BinaryWriter.prototype.writeF64),
	String: bindCall(BinaryWriter.prototype.writeString)
};
Object.freeze(primitiveSerializers);
var serializeUint8Array = bindCall(BinaryWriter.prototype.writeUInt8Array);
var primitiveDeserializers = {
	Bool: bindCall(BinaryReader.prototype.readBool),
	I8: bindCall(BinaryReader.prototype.readI8),
	U8: bindCall(BinaryReader.prototype.readU8),
	I16: bindCall(BinaryReader.prototype.readI16),
	U16: bindCall(BinaryReader.prototype.readU16),
	I32: bindCall(BinaryReader.prototype.readI32),
	U32: bindCall(BinaryReader.prototype.readU32),
	I64: bindCall(BinaryReader.prototype.readI64),
	U64: bindCall(BinaryReader.prototype.readU64),
	I128: bindCall(BinaryReader.prototype.readI128),
	U128: bindCall(BinaryReader.prototype.readU128),
	I256: bindCall(BinaryReader.prototype.readI256),
	U256: bindCall(BinaryReader.prototype.readU256),
	F32: bindCall(BinaryReader.prototype.readF32),
	F64: bindCall(BinaryReader.prototype.readF64),
	String: bindCall(BinaryReader.prototype.readString)
};
Object.freeze(primitiveDeserializers);
var deserializeUint8Array = bindCall(BinaryReader.prototype.readUInt8Array);
var primitiveSizes = {
	Bool: 1,
	I8: 1,
	U8: 1,
	I16: 2,
	U16: 2,
	I32: 4,
	U32: 4,
	I64: 8,
	U64: 8,
	I128: 16,
	U128: 16,
	I256: 32,
	U256: 32,
	F32: 4,
	F64: 8
};
var fixedSizePrimitives = new Set(Object.keys(primitiveSizes));
var isFixedSizeProduct = (ty) => ty.elements.every(({ algebraicType }) => fixedSizePrimitives.has(algebraicType.tag));
var productSize = (ty) => ty.elements.reduce((acc, { algebraicType }) => acc + primitiveSizes[algebraicType.tag], 0);
var primitiveJSName = {
	Bool: "Uint8",
	I8: "Int8",
	U8: "Uint8",
	I16: "Int16",
	U16: "Uint16",
	I32: "Int32",
	U32: "Uint32",
	I64: "BigInt64",
	U64: "BigUint64",
	F32: "Float32",
	F64: "Float64"
};
var specialProductDeserializers = {
	__time_duration_micros__: (reader) => new TimeDuration(reader.readI64()),
	__timestamp_micros_since_unix_epoch__: (reader) => new Timestamp(reader.readI64()),
	__identity__: (reader) => new Identity(reader.readU256()),
	__connection_id__: (reader) => new ConnectionId(reader.readU128()),
	__uuid__: (reader) => new Uuid(reader.readU128())
};
Object.freeze(specialProductDeserializers);
var unitDeserializer = () => ({});
var getElementInitializer = (element) => {
	let init;
	switch (element.algebraicType.tag) {
		case "String":
			init = "''";
			break;
		case "Bool":
			init = "false";
			break;
		case "I8":
		case "U8":
		case "I16":
		case "U16":
		case "I32":
		case "U32":
			init = "0";
			break;
		case "I64":
		case "U64":
		case "I128":
		case "U128":
		case "I256":
		case "U256":
			init = "0n";
			break;
		case "F32":
		case "F64":
			init = "0.0";
			break;
		default: init = "undefined";
	}
	return `${element.name}: ${init}`;
};
var ProductType = {
	makeSerializer(ty, typespace) {
		let serializer = SERIALIZERS.get(ty);
		if (serializer != null) return serializer;
		if (isFixedSizeProduct(ty)) {
			const body2 = `"use strict";
writer.expandBuffer(${productSize(ty)});
const view = writer.view;
${ty.elements.map(({ name, algebraicType: { tag } }) => tag in primitiveJSName ? `view.set${primitiveJSName[tag]}(writer.offset, value.${name}, ${primitiveSizes[tag] > 1 ? "true" : ""});
writer.offset += ${primitiveSizes[tag]};` : `writer.write${tag}(value.${name});`).join("\n")}`;
			serializer = Function("writer", "value", body2);
			SERIALIZERS.set(ty, serializer);
			return serializer;
		}
		const serializers = {};
		const body = "\"use strict\";\n" + ty.elements.map((element) => `this.${element.name}(writer, value.${element.name});`).join("\n");
		serializer = Function("writer", "value", body).bind(serializers);
		SERIALIZERS.set(ty, serializer);
		for (const { name, algebraicType } of ty.elements) serializers[name] = AlgebraicType.makeSerializer(algebraicType, typespace);
		Object.freeze(serializers);
		return serializer;
	},
	serializeValue(writer, ty, value, typespace) {
		ProductType.makeSerializer(ty, typespace)(writer, value);
	},
	makeDeserializer(ty, typespace) {
		switch (ty.elements.length) {
			case 0: return unitDeserializer;
			case 1: {
				const fieldName = ty.elements[0].name;
				if (hasOwn(specialProductDeserializers, fieldName)) return specialProductDeserializers[fieldName];
			}
		}
		let deserializer = DESERIALIZERS.get(ty);
		if (deserializer != null) return deserializer;
		if (isFixedSizeProduct(ty)) {
			const body = `"use strict";
const result = { ${ty.elements.map(getElementInitializer).join(", ")} };
const view = reader.view;
${ty.elements.map(({ name, algebraicType: { tag } }) => tag in primitiveJSName ? tag === "Bool" ? `result.${name} = view.getUint8(reader.offset) !== 0;
reader.offset += 1;` : `result.${name} = view.get${primitiveJSName[tag]}(reader.offset, ${primitiveSizes[tag] > 1 ? "true" : ""});
reader.offset += ${primitiveSizes[tag]};` : `result.${name} = reader.read${tag}();`).join("\n")}
return result;`;
			deserializer = Function("reader", body);
			DESERIALIZERS.set(ty, deserializer);
			return deserializer;
		}
		const deserializers = {};
		deserializer = Function("reader", `"use strict";
const result = { ${ty.elements.map(getElementInitializer).join(", ")} };
${ty.elements.map(({ name }) => `result.${name} = this.${name}(reader);`).join("\n")}
return result;`).bind(deserializers);
		DESERIALIZERS.set(ty, deserializer);
		for (const { name, algebraicType } of ty.elements) deserializers[name] = AlgebraicType.makeDeserializer(algebraicType, typespace);
		Object.freeze(deserializers);
		return deserializer;
	},
	deserializeValue(reader, ty, typespace) {
		return ProductType.makeDeserializer(ty, typespace)(reader);
	},
	intoMapKey(ty, value) {
		if (ty.elements.length === 1) {
			const fieldName = ty.elements[0].name;
			if (hasOwn(specialProductDeserializers, fieldName)) return value[fieldName];
		}
		const writer = new BinaryWriter(10);
		AlgebraicType.serializeValue(writer, AlgebraicType.Product(ty), value);
		return writer.toBase64();
	}
};
var SumType = {
	makeSerializer(ty, typespace) {
		if (ty.variants.length == 2 && ty.variants[0].name === "some" && ty.variants[1].name === "none") {
			const serialize = AlgebraicType.makeSerializer(ty.variants[0].algebraicType, typespace);
			return (writer, value) => {
				if (value !== null && value !== void 0) {
					writer.writeByte(0);
					serialize(writer, value);
				} else writer.writeByte(1);
			};
		} else if (ty.variants.length == 2 && ty.variants[0].name === "ok" && ty.variants[1].name === "err") {
			const serializeOk = AlgebraicType.makeSerializer(ty.variants[0].algebraicType, typespace);
			const serializeErr = AlgebraicType.makeSerializer(ty.variants[1].algebraicType, typespace);
			return (writer, value) => {
				if ("ok" in value) {
					writer.writeU8(0);
					serializeOk(writer, value.ok);
				} else if ("err" in value) {
					writer.writeU8(1);
					serializeErr(writer, value.err);
				} else throw new TypeError("could not serialize result: object had neither a `ok` nor an `err` field");
			};
		} else {
			let serializer = SERIALIZERS.get(ty);
			if (serializer != null) return serializer;
			const serializers = {};
			const body = `switch (value.tag) {
${ty.variants.map(({ name }, i) => `  case ${JSON.stringify(name)}:
    writer.writeByte(${i});
    return this.${name}(writer, value.value);`).join("\n")}
  default:
    throw new TypeError(
      \`Could not serialize sum type; unknown tag \${value.tag}\`
    )
}
`;
			serializer = Function("writer", "value", body).bind(serializers);
			SERIALIZERS.set(ty, serializer);
			for (const { name, algebraicType } of ty.variants) serializers[name] = AlgebraicType.makeSerializer(algebraicType, typespace);
			Object.freeze(serializers);
			return serializer;
		}
	},
	serializeValue(writer, ty, value, typespace) {
		SumType.makeSerializer(ty, typespace)(writer, value);
	},
	makeDeserializer(ty, typespace) {
		if (ty.variants.length == 2 && ty.variants[0].name === "some" && ty.variants[1].name === "none") {
			const deserialize = AlgebraicType.makeDeserializer(ty.variants[0].algebraicType, typespace);
			return (reader) => {
				const tag = reader.readU8();
				if (tag === 0) return deserialize(reader);
				else if (tag === 1) return;
				else throw `Can't deserialize an option type, couldn't find ${tag} tag`;
			};
		} else if (ty.variants.length == 2 && ty.variants[0].name === "ok" && ty.variants[1].name === "err") {
			const deserializeOk = AlgebraicType.makeDeserializer(ty.variants[0].algebraicType, typespace);
			const deserializeErr = AlgebraicType.makeDeserializer(ty.variants[1].algebraicType, typespace);
			return (reader) => {
				const tag = reader.readByte();
				if (tag === 0) return { ok: deserializeOk(reader) };
				else if (tag === 1) return { err: deserializeErr(reader) };
				else throw `Can't deserialize a result type, couldn't find ${tag} tag`;
			};
		} else {
			let deserializer = DESERIALIZERS.get(ty);
			if (deserializer != null) return deserializer;
			const deserializers = {};
			deserializer = Function("reader", `switch (reader.readU8()) {
${ty.variants.map(({ name }, i) => `case ${i}: return { tag: ${JSON.stringify(name)}, value: this.${name}(reader) };`).join("\n")} }`).bind(deserializers);
			DESERIALIZERS.set(ty, deserializer);
			for (const { name, algebraicType } of ty.variants) deserializers[name] = AlgebraicType.makeDeserializer(algebraicType, typespace);
			Object.freeze(deserializers);
			return deserializer;
		}
	},
	deserializeValue(reader, ty, typespace) {
		return SumType.makeDeserializer(ty, typespace)(reader);
	}
};
var Option = { getAlgebraicType(innerType) {
	return AlgebraicType.Sum({ variants: [{
		name: "some",
		algebraicType: innerType
	}, {
		name: "none",
		algebraicType: AlgebraicType.Product({ elements: [] })
	}] });
} };
var Result = { getAlgebraicType(okType, errType) {
	return AlgebraicType.Sum({ variants: [{
		name: "ok",
		algebraicType: okType
	}, {
		name: "err",
		algebraicType: errType
	}] });
} };
var ScheduleAt = {
	interval(value) {
		return Interval(value);
	},
	time(value) {
		return Time(value);
	},
	getAlgebraicType() {
		return AlgebraicType.Sum({ variants: [{
			name: "Interval",
			algebraicType: TimeDuration.getAlgebraicType()
		}, {
			name: "Time",
			algebraicType: Timestamp.getAlgebraicType()
		}] });
	},
	isScheduleAt(algebraicType) {
		if (algebraicType.tag !== "Sum") return false;
		const variants = algebraicType.value.variants;
		if (variants.length !== 2) return false;
		const intervalVariant = variants.find((v) => v.name === "Interval");
		const timeVariant = variants.find((v) => v.name === "Time");
		if (!intervalVariant || !timeVariant) return false;
		return TimeDuration.isTimeDuration(intervalVariant.algebraicType) && Timestamp.isTimestamp(timeVariant.algebraicType);
	}
};
var Interval = (micros) => ({
	tag: "Interval",
	value: new TimeDuration(micros)
});
var Time = (microsSinceUnixEpoch) => ({
	tag: "Time",
	value: new Timestamp(microsSinceUnixEpoch)
});
var schedule_at_default = ScheduleAt;
function set(x, t2) {
	return {
		...x,
		...t2
	};
}
var TypeBuilder = class {
	/**
	* The TypeScript phantom type. This is not stored at runtime,
	* but is visible to the compiler
	*/
	type;
	/**
	* The SpacetimeDB algebraic type (run‑time value). In addition to storing
	* the runtime representation of the `AlgebraicType`, it also captures
	* the TypeScript type information of the `AlgebraicType`. That is to say
	* the value is not merely an `AlgebraicType`, but is constructed to be
	* the corresponding concrete `AlgebraicType` for the TypeScript type `Type`.
	*
	* e.g. `string` corresponds to `AlgebraicType.String`
	*/
	algebraicType;
	constructor(algebraicType) {
		this.algebraicType = algebraicType;
	}
	optional() {
		return new OptionBuilder(this);
	}
	/** Match this column to a receiver parameter in an outbox table. */
	param(opts) {
		return new ColumnBuilder(this, { paramName: opts.name });
	}
	serialize(writer, value) {
		(this.serialize = AlgebraicType.makeSerializer(this.algebraicType))(writer, value);
	}
	deserialize(reader) {
		return (this.deserialize = AlgebraicType.makeDeserializer(this.algebraicType))(reader);
	}
};
var U8Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U8);
	}
	index(algorithm = "btree") {
		return new U8ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U8ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U8ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U8ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U8ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U8ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U16Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U16);
	}
	index(algorithm = "btree") {
		return new U16ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U16ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U16ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U16ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U16ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U16ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U32Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U32);
	}
	index(algorithm = "btree") {
		return new U32ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U32ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U32ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U32ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U32ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U32ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U64Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U64);
	}
	index(algorithm = "btree") {
		return new U64ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U64ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U64ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U64ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U64ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U64ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U128Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U128);
	}
	index(algorithm = "btree") {
		return new U128ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U128ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U128ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U128ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U128ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U128ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U256Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U256);
	}
	index(algorithm = "btree") {
		return new U256ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U256ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U256ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U256ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U256ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U256ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I8Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I8);
	}
	index(algorithm = "btree") {
		return new I8ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I8ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I8ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I8ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I8ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I8ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I16Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I16);
	}
	index(algorithm = "btree") {
		return new I16ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I16ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I16ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I16ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I16ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I16ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I32Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I32);
	}
	index(algorithm = "btree") {
		return new I32ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I32ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I32ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I32ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I32ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I32ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I64Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I64);
	}
	index(algorithm = "btree") {
		return new I64ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I64ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I64ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I64ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I64ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I64ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I128Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I128);
	}
	index(algorithm = "btree") {
		return new I128ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I128ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I128ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I128ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I128ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I128ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I256Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I256);
	}
	index(algorithm = "btree") {
		return new I256ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I256ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I256ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I256ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I256ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I256ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var F32Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.F32);
	}
	default(value) {
		return new F32ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new F32ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var F64Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.F64);
	}
	default(value) {
		return new F64ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new F64ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var BoolBuilder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.Bool);
	}
	index(algorithm = "btree") {
		return new BoolColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new BoolColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new BoolColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new BoolColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new BoolColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var StringBuilder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.String);
	}
	index(algorithm = "btree") {
		return new StringColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new StringColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new StringColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new StringColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new StringColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ArrayBuilder = class extends TypeBuilder {
	element;
	constructor(element) {
		super(AlgebraicType.Array(element.algebraicType));
		this.element = element;
	}
	default(value) {
		return new ArrayColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ArrayColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ByteArrayBuilder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.Array(AlgebraicType.U8));
	}
	default(value) {
		return new ByteArrayColumnBuilder(set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ByteArrayColumnBuilder(set(defaultMetadata, { name }));
	}
};
var OptionBuilder = class extends TypeBuilder {
	value;
	constructor(value) {
		super(Option.getAlgebraicType(value.algebraicType));
		this.value = value;
	}
	default(value) {
		return new OptionColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new OptionColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ProductBuilder = class extends TypeBuilder {
	typeName;
	elements;
	constructor(elements, name) {
		function elementsArrayFromElementsObj(obj) {
			return Object.keys(obj).map((key) => ({
				name: key,
				get algebraicType() {
					return obj[key].algebraicType;
				}
			}));
		}
		super(AlgebraicType.Product({ elements: elementsArrayFromElementsObj(elements) }));
		this.typeName = name;
		this.elements = elements;
	}
	default(value) {
		return new ProductColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ProductColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ResultBuilder = class extends TypeBuilder {
	ok;
	err;
	constructor(ok, err) {
		super(Result.getAlgebraicType(ok.algebraicType, err.algebraicType));
		this.ok = ok;
		this.err = err;
	}
	default(value) {
		return new ResultColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
};
var UnitBuilder = class extends TypeBuilder {
	constructor() {
		super({
			tag: "Product",
			value: { elements: [] }
		});
	}
};
var RowBuilder = class extends TypeBuilder {
	row;
	typeName;
	constructor(row, name) {
		const mappedRow = Object.fromEntries(Object.entries(row).map(([colName, builder]) => [colName, builder instanceof ColumnBuilder ? builder : new ColumnBuilder(builder, {})]));
		const elements = Object.keys(mappedRow).map((name2) => ({
			name: name2,
			get algebraicType() {
				return mappedRow[name2].typeBuilder.algebraicType;
			}
		}));
		super(AlgebraicType.Product({ elements }));
		this.row = mappedRow;
		this.typeName = name;
	}
};
var SumBuilderImpl = class extends TypeBuilder {
	variants;
	typeName;
	constructor(variants, name) {
		function variantsArrayFromVariantsObj(variants2) {
			return Object.keys(variants2).map((key) => ({
				name: key,
				get algebraicType() {
					return variants2[key].algebraicType;
				}
			}));
		}
		super(AlgebraicType.Sum({ variants: variantsArrayFromVariantsObj(variants) }));
		this.variants = variants;
		this.typeName = name;
		for (const key of Object.keys(variants)) {
			const desc = Object.getOwnPropertyDescriptor(variants, key);
			const isAccessor = !!desc && (typeof desc.get === "function" || typeof desc.set === "function");
			let isUnit2 = false;
			if (!isAccessor) isUnit2 = variants[key] instanceof UnitBuilder;
			if (isUnit2) {
				const constant = this.create(key);
				Object.defineProperty(this, key, {
					value: constant,
					writable: false,
					enumerable: true,
					configurable: false
				});
			} else {
				const fn = ((value) => this.create(key, value));
				Object.defineProperty(this, key, {
					value: fn,
					writable: false,
					enumerable: true,
					configurable: false
				});
			}
		}
	}
	create(tag, value) {
		return value === void 0 ? { tag } : {
			tag,
			value
		};
	}
	default(value) {
		return new SumColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new SumColumnBuilder(this, set(defaultMetadata, { name }));
	}
	index(algorithm = "btree") {
		return new SumColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new SumColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
};
var SumBuilder = SumBuilderImpl;
var SimpleSumBuilderImpl = class extends SumBuilderImpl {
	index(algorithm = "btree") {
		return new SimpleSumColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new SimpleSumColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
};
var ScheduleAtBuilder = class extends TypeBuilder {
	constructor() {
		super(schedule_at_default.getAlgebraicType());
	}
	default(value) {
		return new ScheduleAtColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ScheduleAtColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var IdentityBuilder = class extends TypeBuilder {
	constructor() {
		super(Identity.getAlgebraicType());
	}
	/** Marks the destination database column of an IDC outbox. */
	target() {
		return new IdentityColumnBuilder(this, { isTarget: true });
	}
	index(algorithm = "btree") {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ConnectionIdBuilder = class extends TypeBuilder {
	constructor() {
		super(ConnectionId.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var TimestampBuilder = class extends TypeBuilder {
	constructor() {
		super(Timestamp.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var TimeDurationBuilder = class extends TypeBuilder {
	constructor() {
		super(TimeDuration.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var UuidBuilder = class extends TypeBuilder {
	constructor() {
		super(Uuid.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new UuidColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new UuidColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new UuidColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new UuidColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new UuidColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new UuidColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var defaultMetadata = {};
var ColumnBuilder = class _ColumnBuilder {
	typeBuilder;
	columnMetadata;
	constructor(typeBuilder, metadata) {
		this.typeBuilder = typeBuilder;
		this.columnMetadata = metadata;
	}
	/** Match this column to a receiver parameter in an outbox table. */
	param(opts) {
		return new _ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { paramName: opts.name }));
	}
	serialize(writer, value) {
		this.typeBuilder.serialize(writer, value);
	}
	deserialize(reader) {
		return this.typeBuilder.deserialize(reader);
	}
};
var U8ColumnBuilder = class _U8ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U16ColumnBuilder = class _U16ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U32ColumnBuilder = class _U32ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U64ColumnBuilder = class _U64ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U128ColumnBuilder = class _U128ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U256ColumnBuilder = class _U256ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I8ColumnBuilder = class _I8ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I16ColumnBuilder = class _I16ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I32ColumnBuilder = class _I32ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I64ColumnBuilder = class _I64ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I128ColumnBuilder = class _I128ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I256ColumnBuilder = class _I256ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var F32ColumnBuilder = class _F32ColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _F32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _F32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var F64ColumnBuilder = class _F64ColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _F64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _F64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var BoolColumnBuilder = class _BoolColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var StringColumnBuilder = class _StringColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ArrayColumnBuilder = class _ArrayColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _ArrayColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ArrayColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ByteArrayColumnBuilder = class _ByteArrayColumnBuilder extends ColumnBuilder {
	constructor(metadata) {
		super(new TypeBuilder(AlgebraicType.Array(AlgebraicType.U8)), metadata);
	}
	default(value) {
		return new _ByteArrayColumnBuilder(set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ByteArrayColumnBuilder(set(this.columnMetadata, { name }));
	}
};
var OptionColumnBuilder = class _OptionColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _OptionColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _OptionColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ResultColumnBuilder = class _ResultColumnBuilder extends ColumnBuilder {
	constructor(typeBuilder, metadata) {
		super(typeBuilder, metadata);
	}
	default(value) {
		return new _ResultColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
};
var ProductColumnBuilder = class _ProductColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _ProductColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ProductColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var SumColumnBuilder = class _SumColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
	index(algorithm = "btree") {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
};
var SimpleSumColumnBuilder = class _SimpleSumColumnBuilder extends SumColumnBuilder {
	index(algorithm = "btree") {
		return new _SimpleSumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new _SimpleSumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
};
var ScheduleAtColumnBuilder = class _ScheduleAtColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _ScheduleAtColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ScheduleAtColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var IdentityColumnBuilder = class _IdentityColumnBuilder extends ColumnBuilder {
	target() {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isTarget: true }));
	}
	index(algorithm = "btree") {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ConnectionIdColumnBuilder = class _ConnectionIdColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var TimestampColumnBuilder = class _TimestampColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var TimeDurationColumnBuilder = class _TimeDurationColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var UuidColumnBuilder = class _UuidColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var RefBuilder = class extends TypeBuilder {
	ref;
	/** The phantom type of the pointee of this ref. */
	__spacetimeType;
	constructor(ref) {
		super(AlgebraicType.Ref(ref));
		this.ref = ref;
	}
};
var enumImpl = ((nameOrObj, maybeObj) => {
	let obj = nameOrObj;
	let name = void 0;
	if (typeof nameOrObj === "string") {
		if (!maybeObj) throw new TypeError("When providing a name, you must also provide the variants object or array.");
		obj = maybeObj;
		name = nameOrObj;
	}
	if (Array.isArray(obj)) {
		const simpleVariantsObj = {};
		for (const variant of obj) simpleVariantsObj[variant] = new UnitBuilder();
		return new SimpleSumBuilderImpl(simpleVariantsObj, name);
	}
	return new SumBuilder(obj, name);
});
var t = {
	bool: () => new BoolBuilder(),
	string: () => new StringBuilder(),
	number: () => new F64Builder(),
	i8: () => new I8Builder(),
	u8: () => new U8Builder(),
	i16: () => new I16Builder(),
	u16: () => new U16Builder(),
	i32: () => new I32Builder(),
	u32: () => new U32Builder(),
	i64: () => new I64Builder(),
	u64: () => new U64Builder(),
	i128: () => new I128Builder(),
	u128: () => new U128Builder(),
	i256: () => new I256Builder(),
	u256: () => new U256Builder(),
	f32: () => new F32Builder(),
	f64: () => new F64Builder(),
	object: ((nameOrObj, maybeObj) => {
		if (typeof nameOrObj === "string") {
			if (!maybeObj) throw new TypeError("When providing a name, you must also provide the object.");
			return new ProductBuilder(maybeObj, nameOrObj);
		}
		return new ProductBuilder(nameOrObj, void 0);
	}),
	row: ((nameOrObj, maybeObj) => {
		const [obj, name] = typeof nameOrObj === "string" ? [maybeObj, nameOrObj] : [nameOrObj, void 0];
		return new RowBuilder(obj, name);
	}),
	array(e) {
		return new ArrayBuilder(e);
	},
	enum: enumImpl,
	unit() {
		return new UnitBuilder();
	},
	lazy(thunk) {
		let cached = null;
		const get = () => cached ??= thunk();
		return new Proxy({}, {
			get(_t, prop, recv) {
				const target = get();
				const val = Reflect.get(target, prop, recv);
				return typeof val === "function" ? val.bind(target) : val;
			},
			set(_t, prop, value, recv) {
				return Reflect.set(get(), prop, value, recv);
			},
			has(_t, prop) {
				return prop in get();
			},
			ownKeys() {
				return Reflect.ownKeys(get());
			},
			getOwnPropertyDescriptor(_t, prop) {
				return Object.getOwnPropertyDescriptor(get(), prop);
			},
			getPrototypeOf() {
				return Object.getPrototypeOf(get());
			}
		});
	},
	scheduleAt: () => {
		return new ScheduleAtBuilder();
	},
	option(value) {
		return new OptionBuilder(value);
	},
	result(ok, err) {
		return new ResultBuilder(ok, err);
	},
	identity: () => {
		return new IdentityBuilder();
	},
	connectionId: () => {
		return new ConnectionIdBuilder();
	},
	timestamp: () => {
		return new TimestampBuilder();
	},
	timeDuration: () => {
		return new TimeDurationBuilder();
	},
	uuid: () => {
		return new UuidBuilder();
	},
	byteArray: () => {
		return new ByteArrayBuilder();
	}
};
var MAX_ENV_KEY_BYTES = 256;
var MAX_ENV_VALUE_BYTES = 8 * 1024;
var MAX_ENV_VARS = 256;
var environment = new Proxy(Object.freeze(Object.assign(/* @__PURE__ */ Object.create(null), { get: (key) => env_get(key) })), { get(target, key) {
	if (key === "get") return target.get;
	if (typeof key !== "string") return void 0;
	return env_get(key) ?? void 0;
} });
function environmentDeclarations(schema2) {
	const entries = Object.entries(schema2);
	if (entries.length > MAX_ENV_VARS) throw new TypeError("Too many environment declarations");
	const bytes = new TextEncoder();
	return entries.map(([name, definition]) => {
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || bytes.encode(name).length > MAX_ENV_KEY_BYTES) throw new TypeError("Invalid environment declaration name");
		const optional = definition instanceof OptionBuilder;
		const inner = optional ? definition.value : definition;
		let ty;
		if (inner instanceof StringBuilder) ty = { tag: "String" };
		else {
			const type = inner?.algebraicType;
			if (type?.tag !== "Sum" || !("variants" in inner)) throw new TypeError(`Environment '${name}' must be a string or simple enum`);
			const values = type.value.variants.map((variant) => {
				if (variant.algebraicType.tag !== "Product" || variant.algebraicType.value.elements.length !== 0) throw new TypeError(`Environment '${name}' cannot use an enum payload`);
				if (typeof variant.name !== "string") throw new TypeError(`Environment '${name}' enum cases must have names`);
				if (bytes.encode(variant.name).length > MAX_ENV_VALUE_BYTES) throw new TypeError(`Environment '${name}' literal is too long`);
				return variant.name;
			});
			if (values.length === 0 || new Set(values).size !== values.length) throw new TypeError(`Environment '${name}' needs a nonempty literal union`);
			ty = values.length === 1 ? {
				tag: "StringLiteral",
				value: values[0]
			} : {
				tag: "Union",
				value: values
			};
		}
		return {
			name,
			ty,
			optional
		};
	});
}
var AlgebraicType2 = t.enum("AlgebraicType", {
	Ref: t.u32(),
	get Sum() {
		return SumType2;
	},
	get Product() {
		return ProductType2;
	},
	get Array() {
		return AlgebraicType2;
	},
	String: t.unit(),
	Bool: t.unit(),
	I8: t.unit(),
	U8: t.unit(),
	I16: t.unit(),
	U16: t.unit(),
	I32: t.unit(),
	U32: t.unit(),
	I64: t.unit(),
	U64: t.unit(),
	I128: t.unit(),
	U128: t.unit(),
	I256: t.unit(),
	U256: t.unit(),
	F32: t.unit(),
	F64: t.unit()
});
var CaseConversionPolicy = t.enum("CaseConversionPolicy", {
	None: t.unit(),
	SnakeCase: t.unit()
});
var ExplicitNameEntry = t.enum("ExplicitNameEntry", {
	get Table() {
		return NameMapping;
	},
	get Function() {
		return NameMapping;
	},
	get Index() {
		return NameMapping;
	},
	get Namespace() {
		return NameMapping;
	}
});
var ExplicitNames = t.object("ExplicitNames", { get entries() {
	return t.array(ExplicitNameEntry);
} });
var FunctionVisibility = t.enum("FunctionVisibility", {
	Private: t.unit(),
	ClientCallable: t.unit()
});
var HttpHeaderPair = t.object("HttpHeaderPair", {
	name: t.string(),
	value: t.byteArray()
});
var HttpHeaders = t.object("HttpHeaders", { get entries() {
	return t.array(HttpHeaderPair);
} });
var HttpMethod = t.enum("HttpMethod", {
	Get: t.unit(),
	Head: t.unit(),
	Post: t.unit(),
	Put: t.unit(),
	Delete: t.unit(),
	Connect: t.unit(),
	Options: t.unit(),
	Trace: t.unit(),
	Patch: t.unit(),
	Extension: t.string()
});
var HttpRequest = t.object("HttpRequest", {
	get method() {
		return HttpMethod;
	},
	get headers() {
		return HttpHeaders;
	},
	timeout: t.option(t.timeDuration()),
	uri: t.string(),
	get version() {
		return HttpVersion;
	}
});
var HttpResponse = t.object("HttpResponse", {
	get headers() {
		return HttpHeaders;
	},
	get version() {
		return HttpVersion;
	},
	code: t.u16()
});
var HttpVersion = t.enum("HttpVersion", {
	Http09: t.unit(),
	Http10: t.unit(),
	Http11: t.unit(),
	Http2: t.unit(),
	Http3: t.unit()
});
var IndexType = t.enum("IndexType", {
	BTree: t.unit(),
	Hash: t.unit()
});
var Lifecycle = t.enum("Lifecycle", {
	Init: t.unit(),
	OnConnect: t.unit(),
	OnDisconnect: t.unit()
});
var MethodOrAny = t.enum("MethodOrAny", {
	Any: t.unit(),
	get Method() {
		return HttpMethod;
	}
});
var MiscModuleExport = t.enum("MiscModuleExport", { get TypeAlias() {
	return TypeAlias;
} });
var NameMapping = t.object("NameMapping", {
	sourceName: t.string(),
	canonicalName: t.string()
});
var ProductType2 = t.object("ProductType", { get elements() {
	return t.array(ProductTypeElement);
} });
var ProductTypeElement = t.object("ProductTypeElement", {
	name: t.option(t.string()),
	get algebraicType() {
		return AlgebraicType2;
	}
});
var RawColumnDefV8 = t.object("RawColumnDefV8", {
	colName: t.string(),
	get colType() {
		return AlgebraicType2;
	}
});
var RawColumnDefaultValueV10 = t.object("RawColumnDefaultValueV10", {
	colId: t.u16(),
	value: t.byteArray()
});
var RawColumnDefaultValueV9 = t.object("RawColumnDefaultValueV9", {
	table: t.string(),
	colId: t.u16(),
	value: t.byteArray()
});
var RawConstraintDataV9 = t.enum("RawConstraintDataV9", { get Unique() {
	return RawUniqueConstraintDataV9;
} });
var RawConstraintDefV10 = t.object("RawConstraintDefV10", {
	sourceName: t.option(t.string()),
	get data() {
		return RawConstraintDataV9;
	}
});
var RawConstraintDefV8 = t.object("RawConstraintDefV8", {
	constraintName: t.string(),
	constraints: t.u8(),
	columns: t.array(t.u16())
});
var RawConstraintDefV9 = t.object("RawConstraintDefV9", {
	name: t.option(t.string()),
	get data() {
		return RawConstraintDataV9;
	}
});
var RawEnvVarTypeV10 = t.enum("RawEnvVarTypeV10", {
	String: t.unit(),
	StringLiteral: t.string(),
	Union: t.array(t.string())
});
var RawEnvironmentDeclarationV10 = t.object("RawEnvironmentDeclarationV10", {
	name: t.string(),
	get ty() {
		return RawEnvVarTypeV10;
	},
	optional: t.bool()
});
var RawHttpHandlerDefV10 = t.object("RawHttpHandlerDefV10", { sourceName: t.string() });
var RawHttpRouteDefV10 = t.object("RawHttpRouteDefV10", {
	handlerFunction: t.string(),
	get method() {
		return MethodOrAny;
	},
	path: t.string()
});
var RawIndexAlgorithm = t.enum("RawIndexAlgorithm", {
	BTree: t.array(t.u16()),
	Hash: t.array(t.u16()),
	Direct: t.u16()
});
var RawIndexDefV10 = t.object("RawIndexDefV10", {
	sourceName: t.option(t.string()),
	accessorName: t.option(t.string()),
	get algorithm() {
		return RawIndexAlgorithm;
	}
});
var RawIndexDefV8 = t.object("RawIndexDefV8", {
	indexName: t.string(),
	isUnique: t.bool(),
	get indexType() {
		return IndexType;
	},
	columns: t.array(t.u16())
});
var RawIndexDefV9 = t.object("RawIndexDefV9", {
	name: t.option(t.string()),
	accessorName: t.option(t.string()),
	get algorithm() {
		return RawIndexAlgorithm;
	}
});
var RawLifeCycleReducerDefV10 = t.object("RawLifeCycleReducerDefV10", {
	get lifecycleSpec() {
		return Lifecycle;
	},
	functionName: t.string()
});
var RawMiscModuleExportV9 = t.enum("RawMiscModuleExportV9", {
	get ColumnDefaultValue() {
		return RawColumnDefaultValueV9;
	},
	get Procedure() {
		return RawProcedureDefV9;
	},
	get View() {
		return RawViewDefV9;
	}
});
var RawModuleDef = t.enum("RawModuleDef", {
	get V8BackCompat() {
		return RawModuleDefV8;
	},
	get V9() {
		return RawModuleDefV9;
	},
	get V10() {
		return RawModuleDefV10;
	}
});
var RawModuleDefV10 = t.object("RawModuleDefV10", { get sections() {
	return t.array(RawModuleDefV10Section);
} });
var RawModuleDefV10Section = t.enum("RawModuleDefV10Section", {
	get Typespace() {
		return Typespace;
	},
	get Types() {
		return t.array(RawTypeDefV10);
	},
	get Tables() {
		return t.array(RawTableDefV10);
	},
	get Reducers() {
		return t.array(RawReducerDefV10);
	},
	get Procedures() {
		return t.array(RawProcedureDefV10);
	},
	get Views() {
		return t.array(RawViewDefV10);
	},
	get Schedules() {
		return t.array(RawScheduleDefV10);
	},
	get LifeCycleReducers() {
		return t.array(RawLifeCycleReducerDefV10);
	},
	get RowLevelSecurity() {
		return t.array(RawRowLevelSecurityDefV9);
	},
	get CaseConversionPolicy() {
		return CaseConversionPolicy;
	},
	get ExplicitNames() {
		return ExplicitNames;
	},
	get HttpHandlers() {
		return t.array(RawHttpHandlerDefV10);
	},
	get HttpRoutes() {
		return t.array(RawHttpRouteDefV10);
	},
	get ViewPrimaryKeys() {
		return t.array(RawViewPrimaryKeyDefV10);
	},
	get Submodules() {
		return t.array(RawSubmoduleV10);
	},
	get Environment() {
		return t.array(RawEnvironmentDeclarationV10);
	},
	get Outboxes() {
		return t.array(RawOutboxDefV10);
	}
});
var RawModuleDefV8 = t.object("RawModuleDefV8", {
	get typespace() {
		return Typespace;
	},
	get tables() {
		return t.array(TableDesc);
	},
	get reducers() {
		return t.array(ReducerDef);
	},
	get miscExports() {
		return t.array(MiscModuleExport);
	}
});
var RawModuleDefV9 = t.object("RawModuleDefV9", {
	get typespace() {
		return Typespace;
	},
	get tables() {
		return t.array(RawTableDefV9);
	},
	get reducers() {
		return t.array(RawReducerDefV9);
	},
	get types() {
		return t.array(RawTypeDefV9);
	},
	get miscExports() {
		return t.array(RawMiscModuleExportV9);
	},
	get rowLevelSecurity() {
		return t.array(RawRowLevelSecurityDefV9);
	}
});
var RawOutboxDefV10 = t.object("RawOutboxDefV10", {
	tableName: t.string(),
	remoteReducer: t.string(),
	targetColumn: t.u16(),
	argColumns: t.array(t.u16()),
	onResultReducer: t.option(t.string()),
	signatureHash: t.u256()
});
var RawProcedureDefV10 = t.object("RawProcedureDefV10", {
	sourceName: t.string(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	},
	get visibility() {
		return FunctionVisibility;
	}
});
var RawProcedureDefV9 = t.object("RawProcedureDefV9", {
	name: t.string(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	}
});
var RawReducerDefV10 = t.object("RawReducerDefV10", {
	sourceName: t.string(),
	get params() {
		return ProductType2;
	},
	get visibility() {
		return FunctionVisibility;
	},
	get okReturnType() {
		return AlgebraicType2;
	},
	get errReturnType() {
		return AlgebraicType2;
	}
});
var RawReducerDefV9 = t.object("RawReducerDefV9", {
	name: t.string(),
	get params() {
		return ProductType2;
	},
	get lifecycle() {
		return t.option(Lifecycle);
	}
});
var RawRowLevelSecurityDefV9 = t.object("RawRowLevelSecurityDefV9", { sql: t.string() });
var RawScheduleDefV10 = t.object("RawScheduleDefV10", {
	sourceName: t.option(t.string()),
	tableName: t.string(),
	scheduleAtCol: t.u16(),
	functionName: t.string()
});
var RawScheduleDefV9 = t.object("RawScheduleDefV9", {
	name: t.option(t.string()),
	reducerName: t.string(),
	scheduledAtColumn: t.u16()
});
var RawScopedTypeNameV10 = t.object("RawScopedTypeNameV10", {
	scope: t.array(t.string()),
	sourceName: t.string()
});
var RawScopedTypeNameV9 = t.object("RawScopedTypeNameV9", {
	scope: t.array(t.string()),
	name: t.string()
});
var RawSequenceDefV10 = t.object("RawSequenceDefV10", {
	sourceName: t.option(t.string()),
	column: t.u16(),
	start: t.option(t.i128()),
	minValue: t.option(t.i128()),
	maxValue: t.option(t.i128()),
	increment: t.i128()
});
var RawSequenceDefV8 = t.object("RawSequenceDefV8", {
	sequenceName: t.string(),
	colPos: t.u16(),
	increment: t.i128(),
	start: t.option(t.i128()),
	minValue: t.option(t.i128()),
	maxValue: t.option(t.i128()),
	allocated: t.i128()
});
var RawSequenceDefV9 = t.object("RawSequenceDefV9", {
	name: t.option(t.string()),
	column: t.u16(),
	start: t.option(t.i128()),
	minValue: t.option(t.i128()),
	maxValue: t.option(t.i128()),
	increment: t.i128()
});
var RawSubmoduleV10 = t.object("RawSubmoduleV10", {
	namespace: t.string(),
	get module() {
		return RawModuleDefV10;
	}
});
var RawTableDefV10 = t.object("RawTableDefV10", {
	sourceName: t.string(),
	productTypeRef: t.u32(),
	primaryKey: t.array(t.u16()),
	get indexes() {
		return t.array(RawIndexDefV10);
	},
	get constraints() {
		return t.array(RawConstraintDefV10);
	},
	get sequences() {
		return t.array(RawSequenceDefV10);
	},
	get tableType() {
		return TableType;
	},
	get tableAccess() {
		return TableAccess;
	},
	get defaultValues() {
		return t.array(RawColumnDefaultValueV10);
	},
	isEvent: t.bool()
});
var RawTableDefV8 = t.object("RawTableDefV8", {
	tableName: t.string(),
	get columns() {
		return t.array(RawColumnDefV8);
	},
	get indexes() {
		return t.array(RawIndexDefV8);
	},
	get constraints() {
		return t.array(RawConstraintDefV8);
	},
	get sequences() {
		return t.array(RawSequenceDefV8);
	},
	tableType: t.string(),
	tableAccess: t.string(),
	scheduled: t.option(t.string())
});
var RawTableDefV9 = t.object("RawTableDefV9", {
	name: t.string(),
	productTypeRef: t.u32(),
	primaryKey: t.array(t.u16()),
	get indexes() {
		return t.array(RawIndexDefV9);
	},
	get constraints() {
		return t.array(RawConstraintDefV9);
	},
	get sequences() {
		return t.array(RawSequenceDefV9);
	},
	get schedule() {
		return t.option(RawScheduleDefV9);
	},
	get tableType() {
		return TableType;
	},
	get tableAccess() {
		return TableAccess;
	}
});
var RawTypeDefV10 = t.object("RawTypeDefV10", {
	get sourceName() {
		return RawScopedTypeNameV10;
	},
	ty: t.u32(),
	customOrdering: t.bool()
});
var RawTypeDefV9 = t.object("RawTypeDefV9", {
	get name() {
		return RawScopedTypeNameV9;
	},
	ty: t.u32(),
	customOrdering: t.bool()
});
var RawUniqueConstraintDataV9 = t.object("RawUniqueConstraintDataV9", { columns: t.array(t.u16()) });
var RawViewDefV10 = t.object("RawViewDefV10", {
	sourceName: t.string(),
	index: t.u32(),
	isPublic: t.bool(),
	isAnonymous: t.bool(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	}
});
var RawViewDefV9 = t.object("RawViewDefV9", {
	name: t.string(),
	index: t.u32(),
	isPublic: t.bool(),
	isAnonymous: t.bool(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	}
});
var RawViewPrimaryKeyDefV10 = t.object("RawViewPrimaryKeyDefV10", {
	viewSourceName: t.string(),
	columns: t.array(t.string())
});
var ReducerDef = t.object("ReducerDef", {
	name: t.string(),
	get args() {
		return t.array(ProductTypeElement);
	}
});
var SumType2 = t.object("SumType", { get variants() {
	return t.array(SumTypeVariant);
} });
var SumTypeVariant = t.object("SumTypeVariant", {
	name: t.option(t.string()),
	get algebraicType() {
		return AlgebraicType2;
	}
});
var TableAccess = t.enum("TableAccess", {
	Public: t.unit(),
	Private: t.unit()
});
var TableDesc = t.object("TableDesc", {
	get schema() {
		return RawTableDefV8;
	},
	data: t.u32()
});
var TableType = t.enum("TableType", {
	System: t.unit(),
	User: t.unit()
});
var TypeAlias = t.object("TypeAlias", {
	name: t.string(),
	ty: t.u32()
});
var Typespace = t.object("Typespace", { get types() {
	return t.array(AlgebraicType2);
} });
var ViewResultHeader = t.enum("ViewResultHeader", {
	RowData: t.unit(),
	RawSql: t.string()
});
function tableToSchema(accName, schema2, tableDef) {
	const getColName = (i) => schema2.rowType.algebraicType.value.elements[i].name;
	const resolvedIndexes = tableDef.indexes.map((idx) => {
		const accessorName = idx.accessorName;
		if (typeof accessorName !== "string" || accessorName.length === 0) throw new TypeError(`Index '${idx.sourceName ?? "<unknown>"}' on table '${tableDef.sourceName}' is missing accessor name`);
		const columnIds = idx.algorithm.tag === "Direct" ? [idx.algorithm.value] : idx.algorithm.value;
		return {
			name: accessorName,
			unique: tableDef.constraints.some((c) => c.data.tag === "Unique" && c.data.value.columns.every((col) => columnIds.includes(col))),
			algorithm: {
				BTree: "btree",
				Hash: "hash",
				Direct: "direct"
			}[idx.algorithm.tag],
			columns: columnIds.map(getColName)
		};
	});
	return {
		sourceName: schema2.tableName || accName,
		accessorName: accName,
		isOutbox: schema2.outbox !== void 0,
		columns: schema2.rowType.row,
		rowType: schema2.rowSpacetimeType,
		indexes: schema2.idxs,
		constraints: tableDef.constraints.map((c) => ({
			name: c.sourceName,
			constraint: "unique",
			columns: c.data.value.columns.map(getColName)
		})),
		resolvedIndexes,
		tableDef,
		...tableDef.isEvent ? { isEvent: true } : {}
	};
}
var ModuleContext = class {
	#compoundTypes = /* @__PURE__ */ new Map();
	/**
	* The global module definition that gets populated by calls to `reducer()` and lifecycle hooks.
	*/
	#moduleDef = {
		typespace: { types: [] },
		tables: [],
		reducers: [],
		types: [],
		rowLevelSecurity: [],
		schedules: [],
		outboxes: [],
		procedures: [],
		views: [],
		viewPrimaryKeys: [],
		lifeCycleReducers: [],
		httpHandlers: [],
		httpRoutes: [],
		caseConversionPolicy: { tag: "SnakeCase" },
		explicitNames: { entries: [] },
		submodules: [],
		environment: []
	};
	get moduleDef() {
		return this.#moduleDef;
	}
	rawModuleDefV10() {
		const sections = [];
		const push = (s) => {
			if (s) sections.push(s);
		};
		const module = this.#moduleDef;
		push(module.typespace && {
			tag: "Typespace",
			value: module.typespace
		});
		push(module.types && {
			tag: "Types",
			value: module.types
		});
		push(module.tables && {
			tag: "Tables",
			value: module.tables
		});
		push(module.reducers && {
			tag: "Reducers",
			value: module.reducers
		});
		push(module.procedures && {
			tag: "Procedures",
			value: module.procedures
		});
		push(module.views && {
			tag: "Views",
			value: module.views
		});
		push(module.viewPrimaryKeys && {
			tag: "ViewPrimaryKeys",
			value: module.viewPrimaryKeys
		});
		push(module.schedules && {
			tag: "Schedules",
			value: module.schedules
		});
		push(module.outboxes && {
			tag: "Outboxes",
			value: module.outboxes
		});
		push(module.lifeCycleReducers && {
			tag: "LifeCycleReducers",
			value: module.lifeCycleReducers
		});
		push(module.httpHandlers && {
			tag: "HttpHandlers",
			value: module.httpHandlers
		});
		push(module.httpRoutes && {
			tag: "HttpRoutes",
			value: module.httpRoutes
		});
		push(module.rowLevelSecurity && {
			tag: "RowLevelSecurity",
			value: module.rowLevelSecurity
		});
		push(module.explicitNames && {
			tag: "ExplicitNames",
			value: module.explicitNames
		});
		push(module.caseConversionPolicy && {
			tag: "CaseConversionPolicy",
			value: module.caseConversionPolicy
		});
		push(module.submodules && {
			tag: "Submodules",
			value: module.submodules
		});
		push({
			tag: "Environment",
			value: module.environment
		});
		return { sections };
	}
	addSubmodule(submodule) {
		this.#moduleDef.submodules.push(submodule);
	}
	/**
	* Set the case conversion policy for this module.
	* Called by the settings mechanism.
	*/
	setCaseConversionPolicy(policy) {
		this.#moduleDef.caseConversionPolicy = policy;
	}
	get typespace() {
		return this.#moduleDef.typespace;
	}
	/**
	* Resolves the actual type of a TypeBuilder by following its references until it reaches a non-ref type.
	* @param typespace The typespace to resolve types against.
	* @param typeBuilder The TypeBuilder to resolve.
	* @returns The resolved algebraic type.
	*/
	resolveType(typeBuilder) {
		let ty = typeBuilder.algebraicType;
		while (ty.tag === "Ref") ty = this.typespace.types[ty.value];
		return ty;
	}
	/**
	* Adds a type to the module definition's typespace as a `Ref` if it is a named compound type (Product or Sum).
	* Otherwise, returns the type as is.
	* @param name
	* @param ty
	* @returns
	*/
	registerTypesRecursively(typeBuilder) {
		if (typeBuilder instanceof ProductBuilder && !isUnit(typeBuilder) || typeBuilder instanceof SumBuilder || typeBuilder instanceof RowBuilder) return this.#registerCompoundTypeRecursively(typeBuilder);
		else if (typeBuilder instanceof OptionBuilder) return new OptionBuilder(this.registerTypesRecursively(typeBuilder.value));
		else if (typeBuilder instanceof ResultBuilder) return new ResultBuilder(this.registerTypesRecursively(typeBuilder.ok), this.registerTypesRecursively(typeBuilder.err));
		else if (typeBuilder instanceof ArrayBuilder) return new ArrayBuilder(this.registerTypesRecursively(typeBuilder.element));
		else return typeBuilder;
	}
	#registerCompoundTypeRecursively(typeBuilder) {
		const ty = typeBuilder.algebraicType;
		const name = typeBuilder.typeName;
		if (name === void 0) throw new Error(`Missing type name for ${typeBuilder.constructor.name ?? "TypeBuilder"} ${JSON.stringify(typeBuilder)}`);
		let r = this.#compoundTypes.get(ty);
		if (r != null) return r;
		const newTy = typeBuilder instanceof RowBuilder || typeBuilder instanceof ProductBuilder ? {
			tag: "Product",
			value: { elements: [] }
		} : {
			tag: "Sum",
			value: { variants: [] }
		};
		r = new RefBuilder(this.#moduleDef.typespace.types.length);
		this.#moduleDef.typespace.types.push(newTy);
		this.#compoundTypes.set(ty, r);
		if (typeBuilder instanceof RowBuilder) for (const [name2, elem] of Object.entries(typeBuilder.row)) newTy.value.elements.push({
			name: name2,
			algebraicType: this.registerTypesRecursively(elem.typeBuilder).algebraicType
		});
		else if (typeBuilder instanceof ProductBuilder) for (const [name2, elem] of Object.entries(typeBuilder.elements)) newTy.value.elements.push({
			name: name2,
			algebraicType: this.registerTypesRecursively(elem).algebraicType
		});
		else if (typeBuilder instanceof SumBuilder) for (const [name2, variant] of Object.entries(typeBuilder.variants)) newTy.value.variants.push({
			name: name2,
			algebraicType: this.registerTypesRecursively(variant).algebraicType
		});
		this.#moduleDef.types.push({
			sourceName: splitName(name),
			ty: r.ref,
			customOrdering: true
		});
		return r;
	}
};
function isUnit(typeBuilder) {
	return typeBuilder.typeName == null && typeBuilder.algebraicType.value.elements.length === 0;
}
function splitName(name) {
	const scope = name.split(".");
	return {
		sourceName: scope.pop(),
		scope
	};
}
var textEncoder2 = new TextEncoder();
var textDecoder2 = new TextDecoder("utf-8");
function deserializeMethod(method) {
	switch (method.tag) {
		case "Get": return "GET";
		case "Head": return "HEAD";
		case "Post": return "POST";
		case "Put": return "PUT";
		case "Delete": return "DELETE";
		case "Connect": return "CONNECT";
		case "Options": return "OPTIONS";
		case "Trace": return "TRACE";
		case "Patch": return "PATCH";
		case "Extension": return method.value;
	}
}
var methods = /* @__PURE__ */ new Map([
	["GET", { tag: "Get" }],
	["HEAD", { tag: "Head" }],
	["POST", { tag: "Post" }],
	["PUT", { tag: "Put" }],
	["DELETE", { tag: "Delete" }],
	["CONNECT", { tag: "Connect" }],
	["OPTIONS", { tag: "Options" }],
	["TRACE", { tag: "Trace" }],
	["PATCH", { tag: "Patch" }]
]);
function serializeMethod(method) {
	return methods.get(method?.toUpperCase() ?? "GET") ?? {
		tag: "Extension",
		value: method
	};
}
function serializeHeaders(headers) {
	return { entries: Array.from(headers.entries(), ([name, value]) => ({
		name,
		value: textEncoder2.encode(value)
	})) };
}
function deserializeHeaders(headers) {
	return new Headers(headers.entries.map(({ name, value }) => [name, textDecoder2.decode(value)]));
}
var makeResponse = Symbol("makeResponse");
var SyncResponse = class _SyncResponse {
	#body;
	#inner;
	constructor(body, init) {
		if (body == null) this.#body = null;
		else if (typeof body === "string") this.#body = body;
		else this.#body = new Uint8Array(body).buffer;
		this.#inner = {
			headers: new Headers(init?.headers),
			status: init?.status ?? 200,
			statusText: init?.statusText ?? "",
			type: "default",
			url: null,
			aborted: false,
			version: init?.version ?? { tag: "Http11" }
		};
	}
	static [makeResponse](body, inner) {
		const me = new _SyncResponse(body);
		me.#inner = inner;
		return me;
	}
	get headers() {
		return this.#inner.headers;
	}
	get status() {
		return this.#inner.status;
	}
	get statusText() {
		return this.#inner.statusText;
	}
	get ok() {
		return 200 <= this.#inner.status && this.#inner.status <= 299;
	}
	get url() {
		return this.#inner.url ?? "";
	}
	get type() {
		return this.#inner.type;
	}
	get version() {
		return this.#inner.version;
	}
	arrayBuffer() {
		return this.bytes().buffer;
	}
	bytes() {
		if (this.#body == null) return new Uint8Array();
		else if (typeof this.#body === "string") return textEncoder2.encode(this.#body);
		else return new Uint8Array(this.#body);
	}
	json() {
		return JSON.parse(this.text());
	}
	text() {
		if (this.#body == null) return "";
		else if (typeof this.#body === "string") return this.#body;
		else return textDecoder2.decode(this.#body);
	}
};
var httpHandlerFn = Symbol("SpacetimeDB.httpHandlerFn");
var makeRequest = Symbol("makeRequest");
function coerceRequestBody(body) {
	if (body == null) return null;
	if (typeof body === "string") return body;
	return new Uint8Array(body);
}
function requestBodyToBytes(body) {
	if (body == null) return new Uint8Array();
	if (typeof body === "string") return textEncoder2.encode(body);
	return body;
}
function requestBodyToText(body) {
	if (body == null) return "";
	if (typeof body === "string") return body;
	return textDecoder2.decode(body);
}
var Request = class _Request {
	#body;
	#inner;
	constructor(url, init = {}) {
		this.#body = coerceRequestBody(init.body);
		this.#inner = {
			headers: new Headers(init.headers),
			method: init.method ?? "GET",
			uri: "" + url,
			version: init.version ?? { tag: "Http11" }
		};
	}
	static [makeRequest](body, inner) {
		const me = new _Request(inner.uri);
		me.#body = coerceRequestBody(body);
		me.#inner = inner;
		return me;
	}
	get headers() {
		return this.#inner.headers;
	}
	get method() {
		return this.#inner.method;
	}
	get uri() {
		return this.#inner.uri;
	}
	get url() {
		return this.#inner.uri;
	}
	get version() {
		return this.#inner.version;
	}
	arrayBuffer() {
		return this.bytes().buffer;
	}
	bytes() {
		return requestBodyToBytes(this.#body);
	}
	json() {
		return JSON.parse(this.text());
	}
	text() {
		return requestBodyToText(this.#body);
	}
};
var exportedHttpHandlerObjects = /* @__PURE__ */ new WeakSet();
function makeHttpHandlerExport(ctx, opts, fn) {
	const handlerExport = Object.assign((...args) => fn(...args), {
		[httpHandlerFn]: fn,
		[exportContext]: ctx,
		[registerExport](ctx2, exportName) {
			if (exportedHttpHandlerObjects.has(handlerExport)) throw new TypeError(`HTTP handler '${exportName}' was exported more than once`);
			exportedHttpHandlerObjects.add(handlerExport);
			registerHttpHandler(ctx2, exportName, fn, opts);
			ctx2.httpHandlerExports.set(handlerExport, exportName);
		}
	});
	return handlerExport;
}
function makeHttpRouterExport(ctx, router) {
	return {
		[exportContext]: ctx,
		[registerExport](ctx2) {
			ctx2.pendingHttpRoutes.push(...router.intoRoutes());
		}
	};
}
function registerHttpHandler(ctx, exportName, fn, opts) {
	ctx.defineHttpHandler(exportName);
	ctx.moduleDef.httpHandlers.push({ sourceName: exportName });
	if (opts?.name != null) ctx.moduleDef.explicitNames.entries.push({
		tag: "Function",
		value: {
			sourceName: exportName,
			canonicalName: opts.name
		}
	});
	if (!fn.name) Object.defineProperty(fn, "name", {
		value: exportName,
		writable: false
	});
	ctx.httpHandlers.push(fn);
}
var import_statuses = __toESM(require_statuses());
var Range = class {
	#from;
	#to;
	constructor(from, to) {
		this.#from = from ?? { tag: "unbounded" };
		this.#to = to ?? { tag: "unbounded" };
	}
	get from() {
		return this.#from;
	}
	get to() {
		return this.#to;
	}
};
var receiverModules = /* @__PURE__ */ new WeakMap();
var identityModules = /* @__PURE__ */ new WeakMap();
function makeOutbox(receiver, row, primaryKey, scheduledOrEvent) {
	const columns = Object.entries(row.row);
	if (scheduledOrEvent) throw new TypeError("Outbox tables cannot be scheduled or event tables");
	const pk = primaryKey.length === 1 ? columns[primaryKey[0]][1] : void 0;
	if (!pk?.columnMetadata.isAutoIncrement || pk.typeBuilder.algebraicType.tag !== "U64") throw new TypeError("Outbox tables require a u64 primary key with autoInc()");
	const targets = columns.flatMap(([, col], i) => col.columnMetadata.isTarget ? [i] : []);
	if (targets.length !== 1 || !deepEqual(columns[targets[0]][1].typeBuilder.algebraicType, t.identity().algebraicType)) throw new TypeError("Outbox tables require exactly one identity().target() column");
	const argColumns = Object.entries(receiver.params).map(([name, type]) => {
		const matches = columns.flatMap(([key, col], i) => (col.columnMetadata.paramName ?? key) === name ? [i] : []);
		if (matches.length !== 1) throw new TypeError(`Outbox requires exactly one column for receiver parameter '${name}'`);
		const index = matches[0];
		if (!deepEqual(columns[index][1].typeBuilder.algebraicType, type.algebraicType)) throw new TypeError(`Outbox column for '${name}' has the wrong type`);
		return index;
	});
	const module = receiverModules.get(receiver);
	const target = columns[targets[0]][1].typeBuilder;
	if (module === void 0 || identityModules.get(target) !== module) throw new TypeError("Outbox target must use the selected receiver module identity() builder");
	return {
		targetColumn: targets[0],
		argColumns,
		remoteReducer: receiver.name,
		signatureHash: receiver.signatureHash
	};
}
function table(opts, row, ..._) {
	const { name, public: isPublic = false, indexes: userIndexes = [], scheduled, event: isEvent = false } = opts;
	const colIds = /* @__PURE__ */ new Map();
	const colNameList = [];
	if (!(row instanceof RowBuilder)) row = new RowBuilder(row);
	row.algebraicType.value.elements.forEach((elem, i) => {
		colIds.set(elem.name, i);
		colNameList.push(elem.name);
	});
	const pk = [];
	const indexes = [];
	const constraints = [];
	const sequences = [];
	let scheduleAtCol;
	const defaultValues = [];
	for (const [name2, builder] of Object.entries(row.row)) {
		const meta = builder.columnMetadata;
		if (meta.isPrimaryKey) pk.push(colIds.get(name2));
		const isUnique = meta.isUnique || meta.isPrimaryKey;
		if (meta.indexType || isUnique) {
			const algo = meta.indexType ?? "btree";
			const id = colIds.get(name2);
			let algorithm;
			switch (algo) {
				case "btree":
					algorithm = RawIndexAlgorithm.BTree([id]);
					break;
				case "hash":
					algorithm = RawIndexAlgorithm.Hash([id]);
					break;
				case "direct":
					algorithm = RawIndexAlgorithm.Direct(id);
					break;
			}
			indexes.push({
				sourceName: void 0,
				accessorName: name2,
				algorithm
			});
		}
		if (isUnique) constraints.push({
			sourceName: void 0,
			data: {
				tag: "Unique",
				value: { columns: [colIds.get(name2)] }
			}
		});
		if (meta.isAutoIncrement) sequences.push({
			sourceName: void 0,
			start: void 0,
			minValue: void 0,
			maxValue: void 0,
			column: colIds.get(name2),
			increment: 1n
		});
		if (Object.prototype.hasOwnProperty.call(meta, "defaultValue")) {
			const writer = new BinaryWriter(16);
			builder.serialize(writer, meta.defaultValue);
			defaultValues.push({
				colId: colIds.get(name2),
				value: writer.getBuffer()
			});
		}
		const algebraicType = builder.typeBuilder.algebraicType;
		if (schedule_at_default.isScheduleAt(algebraicType)) scheduleAtCol = colIds.get(name2);
	}
	for (const indexOpts of userIndexes ?? []) {
		const accessor = indexOpts.accessor;
		if (typeof accessor !== "string" || accessor.length === 0) {
			const tableLabel = name ?? "<unnamed>";
			const indexLabel = indexOpts.name ?? "<unnamed>";
			throw new TypeError(`Index '${indexLabel}' on table '${tableLabel}' must define a non-empty 'accessor'`);
		}
		let algorithm;
		switch (indexOpts.algorithm) {
			case "btree":
				algorithm = {
					tag: "BTree",
					value: indexOpts.columns.map((c) => colIds.get(c))
				};
				break;
			case "hash":
				algorithm = {
					tag: "Hash",
					value: indexOpts.columns.map((c) => colIds.get(c))
				};
				break;
			case "direct":
				algorithm = {
					tag: "Direct",
					value: colIds.get(indexOpts.column)
				};
				break;
		}
		indexes.push({
			sourceName: void 0,
			accessorName: accessor,
			algorithm,
			canonicalName: indexOpts.name
		});
	}
	for (const constraintOpts of opts.constraints ?? []) if (constraintOpts.constraint === "unique") {
		const data = {
			tag: "Unique",
			value: { columns: constraintOpts.columns.map((c) => colIds.get(c)) }
		};
		constraints.push({
			sourceName: constraintOpts.name,
			data
		});
		continue;
	}
	const productType = row.algebraicType.value;
	const schedule = scheduled && scheduleAtCol !== void 0 ? {
		scheduleAtCol,
		reducer: scheduled
	} : void 0;
	const receiver = opts.outbox?.receiver;
	return {
		outbox: receiver ? makeOutbox(receiver, row, pk, !!scheduled || isEvent) : void 0,
		rowType: row,
		tableName: name,
		rowSpacetimeType: productType,
		tableDef: (ctx, accName) => {
			const tableName = name ?? accName;
			if (row.typeName === void 0) row.typeName = toPascalCase(tableName);
			for (const index of indexes) {
				const sourceName = index.sourceName = `${accName}_${(index.algorithm.tag === "Direct" ? [index.algorithm.value] : index.algorithm.value).map((i) => colNameList[i]).join("_")}_idx_${index.algorithm.tag.toLowerCase()}`;
				const { canonicalName } = index;
				if (canonicalName !== void 0) ctx.moduleDef.explicitNames.entries.push(ExplicitNameEntry.Index({
					sourceName,
					canonicalName
				}));
			}
			return {
				sourceName: accName,
				productTypeRef: ctx.registerTypesRecursively(row).ref,
				primaryKey: pk,
				indexes,
				constraints,
				sequences,
				tableType: { tag: "User" },
				tableAccess: { tag: isPublic ? "Public" : "Private" },
				defaultValues,
				isEvent
			};
		},
		idxs: userIndexes,
		constraints,
		scheduleAtCol,
		schedule
	};
}
var QueryBrand = Symbol("QueryBrand");
var isRowTypedQuery = (val) => !!val && typeof val === "object" && QueryBrand in val;
function toSql(q) {
	return q.toSql();
}
var SemijoinImpl = class _SemijoinImpl {
	constructor(sourceQuery, filterQuery, joinCondition) {
		this.sourceQuery = sourceQuery;
		this.filterQuery = filterQuery;
		this.joinCondition = joinCondition;
		if (sourceQuery.table.sourceName === filterQuery.table.sourceName) throw new Error("Cannot semijoin a table to itself");
	}
	[QueryBrand] = true;
	type = "semijoin";
	build() {
		return this;
	}
	where(predicate) {
		return new _SemijoinImpl(this.sourceQuery.where(predicate), this.filterQuery, this.joinCondition);
	}
	toSql() {
		const left = this.filterQuery;
		const right = this.sourceQuery;
		const leftTable = quoteIdentifier(left.table.sourceName);
		const rightTable = quoteIdentifier(right.table.sourceName);
		let sql = `SELECT ${rightTable}.* FROM ${leftTable} JOIN ${rightTable} ON ${booleanExprToSql(this.joinCondition)}`;
		const clauses = [];
		if (left.whereClause) clauses.push(booleanExprToSql(left.whereClause));
		if (right.whereClause) clauses.push(booleanExprToSql(right.whereClause));
		if (clauses.length > 0) {
			const whereSql = clauses.length === 1 ? clauses[0] : clauses.map(wrapInParens).join(" AND ");
			sql += ` WHERE ${whereSql}`;
		}
		return sql;
	}
};
var FromBuilder = class _FromBuilder {
	constructor(table2, whereClause) {
		this.table = table2;
		this.whereClause = whereClause;
	}
	[QueryBrand] = true;
	where(predicate) {
		const newCondition = normalizePredicateExpr(predicate(this.table.cols));
		const nextWhere = this.whereClause ? this.whereClause.and(newCondition) : newCondition;
		return new _FromBuilder(this.table, nextWhere);
	}
	rightSemijoin(right, on) {
		const sourceQuery = new _FromBuilder(right);
		const joinCondition = on(this.table.indexedCols, right.indexedCols);
		return new SemijoinImpl(sourceQuery, this, joinCondition);
	}
	leftSemijoin(right, on) {
		const filterQuery = new _FromBuilder(right);
		const joinCondition = on(this.table.indexedCols, right.indexedCols);
		return new SemijoinImpl(this, filterQuery, joinCondition);
	}
	toSql() {
		return renderSelectSqlWithJoins(this.table, this.whereClause);
	}
	build() {
		return this;
	}
};
var TableRefImpl = class {
	[QueryBrand] = true;
	type = "table";
	sourceName;
	accessorName;
	cols;
	indexedCols;
	tableDef;
	get columns() {
		return this.tableDef.columns;
	}
	get indexes() {
		return this.tableDef.indexes;
	}
	get rowType() {
		return this.tableDef.rowType;
	}
	get constraints() {
		return this.tableDef.constraints;
	}
	constructor(tableDef) {
		this.sourceName = tableDef.sourceName;
		this.accessorName = tableDef.accessorName;
		this.cols = createRowExpr(tableDef);
		this.indexedCols = this.cols;
		this.tableDef = tableDef;
		Object.freeze(this);
	}
	asFrom() {
		return new FromBuilder(this);
	}
	rightSemijoin(other, on) {
		return this.asFrom().rightSemijoin(other, on);
	}
	leftSemijoin(other, on) {
		return this.asFrom().leftSemijoin(other, on);
	}
	build() {
		return this.asFrom().build();
	}
	toSql() {
		return this.asFrom().toSql();
	}
	where(predicate) {
		return this.asFrom().where(predicate);
	}
};
function createTableRefFromDef(tableDef) {
	return new TableRefImpl(tableDef);
}
function makeQueryBuilder(schema2) {
	const qb = /* @__PURE__ */ Object.create(null);
	for (const table2 of Object.values(schema2.tables)) {
		const ref = createTableRefFromDef(table2);
		qb[table2.accessorName] = ref;
	}
	return Object.freeze(qb);
}
function createRowExpr(tableDef) {
	const row = {};
	for (const columnName of Object.keys(tableDef.columns)) {
		const columnBuilder = tableDef.columns[columnName];
		const column = new ColumnExpression(tableDef.sourceName, columnName, columnBuilder.typeBuilder.algebraicType, columnBuilder.columnMetadata.name);
		row[columnName] = Object.freeze(column);
	}
	return Object.freeze(row);
}
function renderSelectSqlWithJoins(table2, where, extraClauses = []) {
	const sql = `SELECT * FROM ${quoteIdentifier(table2.sourceName)}`;
	const clauses = [];
	if (where) clauses.push(booleanExprToSql(where));
	clauses.push(...extraClauses);
	if (clauses.length === 0) return sql;
	return `${sql} WHERE ${clauses.length === 1 ? clauses[0] : clauses.map(wrapInParens).join(" AND ")}`;
}
var ColumnExpression = class {
	type = "column";
	column;
	columnName;
	table;
	tsValueType;
	spacetimeType;
	constructor(table2, column, spacetimeType, columnName) {
		this.table = table2;
		this.column = column;
		this.columnName = columnName || column;
		this.spacetimeType = spacetimeType;
	}
	eq(x) {
		return new BooleanExpr({
			type: "eq",
			left: this,
			right: normalizeValue(x)
		});
	}
	ne(x) {
		return new BooleanExpr({
			type: "ne",
			left: this,
			right: normalizeValue(x)
		});
	}
	lt(x) {
		return new BooleanExpr({
			type: "lt",
			left: this,
			right: normalizeValue(x)
		});
	}
	lte(x) {
		return new BooleanExpr({
			type: "lte",
			left: this,
			right: normalizeValue(x)
		});
	}
	gt(x) {
		return new BooleanExpr({
			type: "gt",
			left: this,
			right: normalizeValue(x)
		});
	}
	gte(x) {
		return new BooleanExpr({
			type: "gte",
			left: this,
			right: normalizeValue(x)
		});
	}
};
function literal(value) {
	return {
		type: "literal",
		value
	};
}
function normalizeValue(val) {
	if (val.type === "literal") return val;
	if (typeof val === "object" && val != null && "type" in val && val.type === "column") return val;
	return literal(val);
}
function normalizePredicateExpr(value) {
	if (value instanceof BooleanExpr) return value;
	if (typeof value === "boolean") return new BooleanExpr({
		type: "eq",
		left: literal(value),
		right: literal(true)
	});
	return new BooleanExpr({
		type: "eq",
		left: value,
		right: literal(true)
	});
}
var BooleanExpr = class _BooleanExpr {
	constructor(data) {
		this.data = data;
	}
	and(other) {
		return new _BooleanExpr({
			type: "and",
			clauses: [this.data, other.data]
		});
	}
	or(other) {
		return new _BooleanExpr({
			type: "or",
			clauses: [this.data, other.data]
		});
	}
	not() {
		return new _BooleanExpr({
			type: "not",
			clause: this.data
		});
	}
};
function booleanExprToSql(expr, tableAlias) {
	const data = expr instanceof BooleanExpr ? expr.data : expr;
	switch (data.type) {
		case "eq": return `${valueExprToSql(data.left)} = ${valueExprToSql(data.right)}`;
		case "ne": return `${valueExprToSql(data.left)} <> ${valueExprToSql(data.right)}`;
		case "gt": return `${valueExprToSql(data.left)} > ${valueExprToSql(data.right)}`;
		case "gte": return `${valueExprToSql(data.left)} >= ${valueExprToSql(data.right)}`;
		case "lt": return `${valueExprToSql(data.left)} < ${valueExprToSql(data.right)}`;
		case "lte": return `${valueExprToSql(data.left)} <= ${valueExprToSql(data.right)}`;
		case "and": return data.clauses.map((c) => booleanExprToSql(c)).map(wrapInParens).join(" AND ");
		case "or": return data.clauses.map((c) => booleanExprToSql(c)).map(wrapInParens).join(" OR ");
		case "not": return `NOT ${wrapInParens(booleanExprToSql(data.clause))}`;
	}
}
function wrapInParens(sql) {
	return `(${sql})`;
}
function valueExprToSql(expr, tableAlias) {
	if (isLiteralExpr(expr)) return literalValueToSql(expr.value);
	const table2 = expr.table;
	return `${quoteIdentifier(table2)}.${quoteIdentifier(expr.columnName)}`;
}
function literalValueToSql(value) {
	if (value === null || value === void 0) return "NULL";
	if (value instanceof Identity || value instanceof ConnectionId || value instanceof Uuid) return `0x${value.toHexString()}`;
	if (value instanceof Timestamp) return `'${value.toISOString()}'`;
	switch (typeof value) {
		case "number":
		case "bigint": return String(value);
		case "boolean": return value ? "TRUE" : "FALSE";
		case "string": return `'${value.replace(/'/g, "''")}'`;
		default: return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
	}
}
function quoteIdentifier(name) {
	return name.split(".").map((part) => `"${part.replace(/"/g, "\"\"")}"`).join(".");
}
function isLiteralExpr(expr) {
	return expr.type === "literal";
}
function makeViewExport(ctx, opts, params, ret, fn) {
	const viewExport = fn.bind();
	viewExport[exportContext] = ctx;
	viewExport[registerExport] = (ctx2, exportName) => {
		registerView(ctx2, opts, exportName, params, ret, fn);
	};
	return viewExport;
}
function makeAnonViewExport(ctx, opts, params, ret, fn) {
	const viewExport = fn.bind();
	viewExport[exportContext] = ctx;
	viewExport[registerExport] = (ctx2, exportName) => {
		registerAnonymousView(ctx2, opts, exportName, params, ret, fn);
	};
	return viewExport;
}
function registerView(ctx, opts, exportName, params, ret, fn) {
	const described = describeView(ctx, opts, exportName, false, params, ret);
	ctx.views.push(buildViewInfo(ctx, described, fn));
}
function registerAnonymousView(ctx, opts, exportName, params, ret, fn) {
	const described = describeView(ctx, opts, exportName, true, params, ret);
	ctx.anonViews.push(buildViewInfo(ctx, described, fn));
}
function describeView(ctx, opts, exportName, anon, params, ret) {
	ctx.defineFunction(exportName);
	const paramsBuilder = new RowBuilder(params, toPascalCase(exportName));
	let returnType = ctx.registerTypesRecursively(ret).algebraicType;
	const { value: paramType } = ctx.resolveType(ctx.registerTypesRecursively(paramsBuilder));
	ctx.moduleDef.views.push({
		sourceName: exportName,
		index: (anon ? ctx.anonViews : ctx.views).length,
		isPublic: opts.public,
		isAnonymous: anon,
		params: paramType,
		returnType
	});
	const primaryKeyColumns = viewPrimaryKeyColumns(ret);
	if (primaryKeyColumns.length > 1) throw new TypeError(`View '${exportName}' can have at most one primaryKey() column on its returned row type; found ${primaryKeyColumns.join(", ")}`);
	if (primaryKeyColumns.length === 1 && paramType.elements.length === 0) ctx.moduleDef.viewPrimaryKeys.push({
		viewSourceName: exportName,
		columns: primaryKeyColumns
	});
	if (opts.name != null) ctx.moduleDef.explicitNames.entries.push({
		tag: "Function",
		value: {
			sourceName: exportName,
			canonicalName: opts.name
		}
	});
	const wrapOption = returnType.tag == "Sum";
	if (returnType.tag == "Sum") returnType = AlgebraicType.Array(returnType.value.variants[0].algebraicType);
	return {
		paramType,
		returnType,
		wrapOption
	};
}
function buildViewInfo(ctx, { paramType, returnType, wrapOption }, fn) {
	const { typespace } = ctx;
	return {
		fn: wrapOption ? ((viewCtx, args) => {
			const ret = fn(viewCtx, args);
			return ret == null ? [] : [ret];
		}) : fn,
		deserializeParams: ProductType.makeDeserializer(paramType, typespace),
		serializeReturn: AlgebraicType.makeSerializer(returnType, typespace),
		returnTypeBaseSize: bsatnBaseSize(typespace, returnType)
	};
}
function viewPrimaryKeyColumns(ret) {
	const row = viewReturnRow(ret);
	if (row == null) return [];
	return Object.entries(row.row).filter((entry) => entry[1].columnMetadata.isPrimaryKey === true).map(([name]) => name);
}
function viewReturnRow(ret) {
	if (ret instanceof ArrayBuilder && ret.element instanceof RowBuilder) return ret.element;
	if (ret instanceof OptionBuilder && ret.value instanceof RowBuilder) return ret.value;
}
var SenderError = class extends Error {
	constructor(message) {
		super(message);
	}
	get name() {
		return "SenderError";
	}
};
var SpacetimeHostError = class extends Error {
	constructor(message) {
		super(message);
	}
	get name() {
		return "SpacetimeHostError";
	}
};
var errorData = {
	HostCallFailure: 1,
	NotInTransaction: 2,
	BsatnDecodeError: 3,
	NoSuchTable: 4,
	NoSuchIndex: 5,
	NoSuchIter: 6,
	NoSuchConsoleTimer: 7,
	NoSuchBytes: 8,
	NoSpace: 9,
	BufferTooSmall: 11,
	UniqueAlreadyExists: 12,
	ScheduleAtDelayTooLong: 13,
	IndexNotUnique: 14,
	NoSuchRow: 15,
	AutoIncOverflow: 16,
	WouldBlockTransaction: 17,
	TransactionNotAnonymous: 18,
	TransactionIsReadOnly: 19,
	TransactionIsMut: 20,
	HttpError: 21
};
function mapEntries(x, f) {
	return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, f(k, v)]));
}
var errnoToClass = /* @__PURE__ */ new Map();
var errors = Object.freeze(mapEntries(errorData, (name, code) => {
	const cls = Object.defineProperty(class extends SpacetimeHostError {
		get name() {
			return name;
		}
	}, "name", {
		value: name,
		writable: false
	});
	errnoToClass.set(code, cls);
	return cls;
}));
function getErrorConstructor(code) {
	return errnoToClass.get(code) ?? SpacetimeHostError;
}
var SBigInt = typeof BigInt !== "undefined" ? BigInt : void 0;
var One = typeof BigInt !== "undefined" ? BigInt(1) : void 0;
var ThirtyTwo = typeof BigInt !== "undefined" ? BigInt(32) : void 0;
var NumValues = typeof BigInt !== "undefined" ? BigInt(4294967296) : void 0;
function unsafeUniformBigIntDistribution(from, to, rng) {
	var diff = to - from + One;
	var FinalNumValues = NumValues;
	var NumIterations = 1;
	while (FinalNumValues < diff) {
		FinalNumValues <<= ThirtyTwo;
		++NumIterations;
	}
	var value = generateNext(NumIterations, rng);
	if (value < diff) return value + from;
	if (value + diff < FinalNumValues) return value % diff + from;
	var MaxAcceptedRandom = FinalNumValues - FinalNumValues % diff;
	while (value >= MaxAcceptedRandom) value = generateNext(NumIterations, rng);
	return value % diff + from;
}
function generateNext(NumIterations, rng) {
	var value = SBigInt(rng.unsafeNext() + 2147483648);
	for (var num = 1; num < NumIterations; ++num) {
		var out = rng.unsafeNext();
		value = (value << ThirtyTwo) + SBigInt(out + 2147483648);
	}
	return value;
}
function unsafeUniformIntDistributionInternal(rangeSize, rng) {
	var MaxAllowed = rangeSize > 2 ? ~~(4294967296 / rangeSize) * rangeSize : 4294967296;
	var deltaV = rng.unsafeNext() + 2147483648;
	while (deltaV >= MaxAllowed) deltaV = rng.unsafeNext() + 2147483648;
	return deltaV % rangeSize;
}
function fromNumberToArrayInt64(out, n) {
	if (n < 0) {
		var posN = -n;
		out.sign = -1;
		out.data[0] = ~~(posN / 4294967296);
		out.data[1] = posN >>> 0;
	} else {
		out.sign = 1;
		out.data[0] = ~~(n / 4294967296);
		out.data[1] = n >>> 0;
	}
	return out;
}
function substractArrayInt64(out, arrayIntA, arrayIntB) {
	var lowA = arrayIntA.data[1];
	var highA = arrayIntA.data[0];
	var signA = arrayIntA.sign;
	var lowB = arrayIntB.data[1];
	var highB = arrayIntB.data[0];
	var signB = arrayIntB.sign;
	out.sign = 1;
	if (signA === 1 && signB === -1) {
		var low_1 = lowA + lowB;
		var high = highA + highB + (low_1 > 4294967295 ? 1 : 0);
		out.data[0] = high >>> 0;
		out.data[1] = low_1 >>> 0;
		return out;
	}
	var lowFirst = lowA;
	var highFirst = highA;
	var lowSecond = lowB;
	var highSecond = highB;
	if (signA === -1) {
		lowFirst = lowB;
		highFirst = highB;
		lowSecond = lowA;
		highSecond = highA;
	}
	var reminderLow = 0;
	var low = lowFirst - lowSecond;
	if (low < 0) {
		reminderLow = 1;
		low = low >>> 0;
	}
	out.data[0] = highFirst - highSecond - reminderLow;
	out.data[1] = low;
	return out;
}
function unsafeUniformArrayIntDistributionInternal(out, rangeSize, rng) {
	var rangeLength = rangeSize.length;
	while (true) {
		for (var index = 0; index !== rangeLength; ++index) out[index] = unsafeUniformIntDistributionInternal(index === 0 ? rangeSize[0] + 1 : 4294967296, rng);
		for (var index = 0; index !== rangeLength; ++index) {
			var current = out[index];
			var currentInRange = rangeSize[index];
			if (current < currentInRange) return out;
			else if (current > currentInRange) break;
		}
	}
}
var safeNumberMaxSafeInteger = Number.MAX_SAFE_INTEGER;
var sharedA = {
	sign: 1,
	data: [0, 0]
};
var sharedB = {
	sign: 1,
	data: [0, 0]
};
var sharedC = {
	sign: 1,
	data: [0, 0]
};
var sharedData = [0, 0];
function uniformLargeIntInternal(from, to, rangeSize, rng) {
	var rangeSizeArrayIntValue = rangeSize <= safeNumberMaxSafeInteger ? fromNumberToArrayInt64(sharedC, rangeSize) : substractArrayInt64(sharedC, fromNumberToArrayInt64(sharedA, to), fromNumberToArrayInt64(sharedB, from));
	if (rangeSizeArrayIntValue.data[1] === 4294967295) {
		rangeSizeArrayIntValue.data[0] += 1;
		rangeSizeArrayIntValue.data[1] = 0;
	} else rangeSizeArrayIntValue.data[1] += 1;
	unsafeUniformArrayIntDistributionInternal(sharedData, rangeSizeArrayIntValue.data, rng);
	return sharedData[0] * 4294967296 + sharedData[1] + from;
}
function unsafeUniformIntDistribution(from, to, rng) {
	var rangeSize = to - from;
	if (rangeSize <= 4294967295) return unsafeUniformIntDistributionInternal(rangeSize + 1, rng) + from;
	return uniformLargeIntInternal(from, to, rangeSize, rng);
}
var XoroShiro128Plus = (function() {
	function XoroShiro128Plus2(s01, s00, s11, s10) {
		this.s01 = s01;
		this.s00 = s00;
		this.s11 = s11;
		this.s10 = s10;
	}
	XoroShiro128Plus2.prototype.clone = function() {
		return new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
	};
	XoroShiro128Plus2.prototype.next = function() {
		var nextRng = new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
		return [nextRng.unsafeNext(), nextRng];
	};
	XoroShiro128Plus2.prototype.unsafeNext = function() {
		var out = this.s00 + this.s10 | 0;
		var a0 = this.s10 ^ this.s00;
		var a1 = this.s11 ^ this.s01;
		var s00 = this.s00;
		var s01 = this.s01;
		this.s00 = s00 << 24 ^ s01 >>> 8 ^ a0 ^ a0 << 16;
		this.s01 = s01 << 24 ^ s00 >>> 8 ^ a1 ^ (a1 << 16 | a0 >>> 16);
		this.s10 = a1 << 5 ^ a0 >>> 27;
		this.s11 = a0 << 5 ^ a1 >>> 27;
		return out;
	};
	XoroShiro128Plus2.prototype.jump = function() {
		var nextRng = new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
		nextRng.unsafeJump();
		return nextRng;
	};
	XoroShiro128Plus2.prototype.unsafeJump = function() {
		var ns01 = 0;
		var ns00 = 0;
		var ns11 = 0;
		var ns10 = 0;
		var jump = [
			3639956645,
			3750757012,
			1261568508,
			386426335
		];
		for (var i = 0; i !== 4; ++i) for (var mask = 1; mask; mask <<= 1) {
			if (jump[i] & mask) {
				ns01 ^= this.s01;
				ns00 ^= this.s00;
				ns11 ^= this.s11;
				ns10 ^= this.s10;
			}
			this.unsafeNext();
		}
		this.s01 = ns01;
		this.s00 = ns00;
		this.s11 = ns11;
		this.s10 = ns10;
	};
	XoroShiro128Plus2.prototype.getState = function() {
		return [
			this.s01,
			this.s00,
			this.s11,
			this.s10
		];
	};
	return XoroShiro128Plus2;
})();
function fromState(state) {
	if (!(state.length === 4)) throw new Error("The state must have been produced by a xoroshiro128plus RandomGenerator");
	return new XoroShiro128Plus(state[0], state[1], state[2], state[3]);
}
var xoroshiro128plus = Object.assign(function(seed) {
	return new XoroShiro128Plus(-1, ~seed, seed | 0, 0);
}, { fromState });
var { asUintN } = BigInt;
function pcg32(state) {
	state = asUintN(64, state * 6364136223846793005n + 11634580027462260723n);
	const xorshifted = Number(asUintN(32, (state >> 18n ^ state) >> 27n));
	const rot = Number(asUintN(32, state >> 59n));
	return xorshifted >> rot | xorshifted << 32 - rot;
}
function generateFloat64(rng) {
	const g1 = unsafeUniformIntDistribution(0, (1 << 26) - 1, rng);
	const g2 = unsafeUniformIntDistribution(0, (1 << 27) - 1, rng);
	return (g1 * Math.pow(2, 27) + g2) * Math.pow(2, -53);
}
function makeRandomFromSeed(seed) {
	const rng = xoroshiro128plus(pcg32(seedToBigInt(seed)));
	const random = () => generateFloat64(rng);
	random.fill = (array) => {
		if (isBigIntArray(array)) {
			const upper = (1n << BigInt(array.BYTES_PER_ELEMENT * 8)) - 1n;
			for (let i = 0; i < array.length; i++) array[i] = unsafeUniformBigIntDistribution(0n, upper, rng);
		} else {
			const upper = Math.pow(2, array.BYTES_PER_ELEMENT * 8) - 1;
			for (let i = 0; i < array.length; i++) array[i] = unsafeUniformIntDistribution(0, upper, rng);
		}
		return array;
	};
	random.shuffle = (array) => {
		for (let currentIndex = array.length - 1; currentIndex > 0; currentIndex--) {
			const swapIndex = random.integerInRange(0, currentIndex);
			[array[currentIndex], array[swapIndex]] = [array[swapIndex], array[currentIndex]];
		}
		return array;
	};
	random.uint32 = () => rng.unsafeNext();
	random.integerInRange = (min, max) => unsafeUniformIntDistribution(min, max, rng);
	random.bigintInRange = (min, max) => unsafeUniformBigIntDistribution(min, max, rng);
	return random;
}
function makeRandom(seed) {
	return makeRandomFromSeed(seed);
}
function seedToBigInt(seed) {
	if (typeof seed === "bigint") return seed;
	if (typeof seed === "number") return BigInt(seed);
	if (seed instanceof Uint8Array) {
		let value = 0n;
		const len = Math.min(seed.byteLength, 8);
		for (let i = 0; i < len; i++) value |= BigInt(seed[i]) << BigInt(i * 8);
		return value;
	}
	return seed.microsSinceUnixEpoch;
}
function isBigIntArray(array) {
	return array instanceof BigInt64Array || array instanceof BigUint64Array;
}
var sys = {
	..._syscalls2_0,
	..._syscalls2_1
};
var hostBackend = {
	identity: sys.identity,
	getJwtPayload: sys.get_jwt_payload,
	tableIdFromName: sys.table_id_from_name,
	indexIdFromName: sys.index_id_from_name,
	datastoreTableRowCount: sys.datastore_table_row_count,
	datastoreTableScanBsatn: sys.datastore_table_scan_bsatn,
	datastoreInsertBsatn: sys.datastore_insert_bsatn,
	datastoreDeleteAllByEqBsatn: sys.datastore_delete_all_by_eq_bsatn,
	datastoreIndexScanPointBsatn: sys.datastore_index_scan_point_bsatn,
	datastoreIndexScanRangeBsatn: sys.datastore_index_scan_range_bsatn,
	datastoreDeleteByIndexScanPointBsatn: sys.datastore_delete_by_index_scan_point_bsatn,
	datastoreDeleteByIndexScanRangeBsatn: sys.datastore_delete_by_index_scan_range_bsatn,
	datastoreUpdateBsatn: sys.datastore_update_bsatn,
	datastoreClear: sys.datastore_clear,
	rowIterBsatnAdvance: sys.row_iter_bsatn_advance,
	rowIterBsatnClose: sys.row_iter_bsatn_close,
	procedureStartMutTx: sys.procedure_start_mut_tx,
	procedureCommitMutTx: sys.procedure_commit_mut_tx,
	procedureAbortMutTx: sys.procedure_abort_mut_tx,
	procedureHttpRequest: sys.procedure_http_request
};
var { freeze } = Object;
var sys2 = {
	..._syscalls2_0,
	..._syscalls2_1
};
function isDatastoreBackend(value) {
	return value !== null && typeof value === "object" && "tableIdFromName" in value && "procedureStartMutTx" in value;
}
function requestFromWire(request, body) {
	return Request[makeRequest](body, {
		headers: deserializeHeaders(request.headers),
		method: deserializeMethod(request.method),
		uri: request.uri,
		version: request.version
	});
}
function responseIntoWire(response) {
	return [{
		headers: serializeHeaders(response.headers),
		version: response.version,
		code: response.status
	}, response.bytes()];
}
function parseJsonObject(json) {
	let value;
	try {
		value = JSON.parse(json);
	} catch {
		throw new Error("Invalid JSON: failed to parse string");
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object at the top level");
	return value;
}
var JwtClaimsImpl = class {
	/**
	* Creates a new JwtClaims instance.
	* @param rawPayload The JWT payload as a raw JSON string.
	* @param identity The identity for this JWT. We are only taking this because we don't have a blake3 implementation (which we need to compute it).
	*/
	constructor(rawPayload, identity) {
		this.rawPayload = rawPayload;
		this.fullPayload = parseJsonObject(rawPayload);
		this._identity = identity;
	}
	fullPayload;
	_identity;
	get identity() {
		return this._identity;
	}
	get subject() {
		return this.fullPayload["sub"];
	}
	get issuer() {
		return this.fullPayload["iss"];
	}
	get audience() {
		const aud = this.fullPayload["aud"];
		if (aud == null) return [];
		return typeof aud === "string" ? [aud] : aud;
	}
};
var AuthCtxImpl = class _AuthCtxImpl {
	isInternal;
	_jwtSource;
	_initializedJWT = false;
	_jwtClaims;
	_senderIdentity;
	constructor(opts) {
		this.isInternal = opts.isInternal;
		this._jwtSource = opts.jwtSource;
		this._senderIdentity = opts.senderIdentity;
	}
	_initializeJWT() {
		if (this._initializedJWT) return;
		this._initializedJWT = true;
		const token = this.isInternal ? null : this._jwtSource();
		if (!token) this._jwtClaims = null;
		else this._jwtClaims = new JwtClaimsImpl(token, this._senderIdentity);
		Object.freeze(this);
	}
	/** Lazily compute whether a JWT exists and is parseable. */
	get hasJWT() {
		this._initializeJWT();
		return this._jwtClaims !== null;
	}
	/** Lazily parse the JwtClaims only when accessed. */
	get jwt() {
		this._initializeJWT();
		return this._jwtClaims;
	}
	/** Create a context representing internal (non-user) requests. */
	static internal() {
		return new _AuthCtxImpl({
			isInternal: true,
			jwtSource: () => null,
			senderIdentity: Identity.zero()
		});
	}
	/**
	* Create the context of an invocation by `sender`,
	* which is internal when `sender` is this database,
	* and otherwise reads the JWT payload from `jwtPayload` on first use.
	*/
	static forSender(sender, databaseIdentity, jwtPayload) {
		return new _AuthCtxImpl({
			isInternal: sender.isEqual(databaseIdentity),
			jwtSource: () => {
				const payloadBuf = jwtPayload();
				if (payloadBuf === null || payloadBuf.length === 0) return null;
				return new TextDecoder().decode(payloadBuf);
			},
			senderIdentity: sender
		});
	}
	/** If there is a connection id, look up the JWT payload from the system tables. */
	static fromBackend(connectionId, sender, databaseIdentity, backend) {
		return _AuthCtxImpl.forSender(sender, databaseIdentity, () => connectionId === null ? null : backend.getJwtPayload(connectionId.__connection_id__));
	}
	/** If there is a connection id, look up the JWT payload from the host system tables. */
	static fromSystemTables(connectionId, sender) {
		return _AuthCtxImpl.fromBackend(connectionId, sender, new Identity(hostBackend.identity()), hostBackend);
	}
};
var ReducerCtxImpl = class ReducerCtx {
	#identity;
	#senderAuth;
	#uuidCounter;
	#random;
	#backend;
	sender;
	timestamp;
	connectionId;
	db;
	env = environment;
	as;
	constructor(sender, timestamp, connectionId, dbView, backendOrAsViews = hostBackend, senderAuth, random, asViews = {}) {
		Object.seal(this);
		this.sender = sender;
		this.timestamp = timestamp;
		this.connectionId = connectionId;
		this.db = dbView;
		if (isDatastoreBackend(backendOrAsViews)) {
			this.#backend = backendOrAsViews;
			this.#senderAuth = senderAuth;
			this.#random = random;
		} else {
			this.#backend = hostBackend;
			asViews = backendOrAsViews;
		}
		this.as = asViews;
	}
	/** Reset the `ReducerCtx` to be used for a new transaction */
	static resetHost(me, sender, timestamp, connectionId, dbView, asViews) {
		me.sender = sender;
		me.timestamp = timestamp;
		me.connectionId = connectionId;
		me.#backend = hostBackend;
		me.#senderAuth = void 0;
		me.#random = void 0;
		me.#uuidCounter = void 0;
		if (dbView !== void 0) me.db = dbView;
		if (asViews !== void 0) me.as = asViews;
	}
	/** Reset the `ReducerCtx` to be used with an injectable backend. */
	static reset(me, sender, timestamp, connectionId, backendOrDbView = hostBackend, senderAuth, random, dbView, asViews) {
		me.sender = sender;
		me.timestamp = timestamp;
		me.connectionId = connectionId;
		if (isDatastoreBackend(backendOrDbView)) {
			me.#backend = backendOrDbView;
			me.#senderAuth = senderAuth;
			me.#random = random;
		} else {
			me.#backend = hostBackend;
			me.#senderAuth = void 0;
			me.#random = void 0;
			dbView = backendOrDbView;
			asViews = senderAuth;
		}
		me.#uuidCounter = void 0;
		if (dbView !== void 0) me.db = dbView;
		if (asViews !== void 0) me.as = asViews;
	}
	get databaseIdentity() {
		return this.#identity ??= new Identity(this.#backend.identity());
	}
	get identity() {
		return this.databaseIdentity;
	}
	get senderAuth() {
		return this.#senderAuth ??= AuthCtxImpl.fromBackend(this.connectionId, this.sender, this.databaseIdentity, this.#backend);
	}
	get random() {
		return this.#random ??= makeRandom(this.timestamp);
	}
	/**
	* Create a new random {@link Uuid} `v4` using this `ReducerCtx`'s RNG.
	*/
	newUuidV4() {
		const bytes = this.random.fill(new Uint8Array(16));
		return Uuid.fromRandomBytesV4(bytes);
	}
	/**
	* Create a new sortable {@link Uuid} `v7` using this `ReducerCtx`'s RNG, counter,
	* and timestamp.
	*/
	newUuidV7() {
		const bytes = this.random.fill(new Uint8Array(4));
		const counter = this.#uuidCounter ??= { value: 0 };
		return Uuid.fromCounterV7(counter, this.timestamp, bytes);
	}
};
var callUserFunction = function __spacetimedb_end_short_backtrace(fn, ...args) {
	return fn(...args);
};
function runWithTx(makeCtx, body, backend = hostBackend) {
	const run = () => {
		const timestamp = backend.procedureStartMutTx();
		try {
			return body(makeCtx(new Timestamp(timestamp)));
		} catch (e) {
			backend.procedureAbortMutTx();
			throw e;
		}
	};
	let res = run();
	try {
		backend.procedureCommitMutTx();
		return res;
	} catch {}
	console.warn("committing anonymous transaction failed");
	res = run();
	try {
		backend.procedureCommitMutTx();
		return res;
	} catch (e) {
		throw new Error("transaction retry failed again", { cause: e });
	}
}
function flattenSubmoduleDispatches(dispatches, parentPrefix = "") {
	const result = [];
	for (const d of dispatches) {
		const namePrefix = parentPrefix + d.namespace + ".";
		result.push({
			reducerFns: d.reducerFns,
			reducerDefs: d.reducerDefs,
			procedureFns: d.procedureFns,
			procedureDefs: d.procedureDefs,
			anonViewFns: d.anonViewFns,
			viewFns: d.viewFns,
			tables: d.tables,
			schemaTables: d.schemaTables,
			typespace: d.typespace,
			dbView_: void 0,
			queryBuilder_: void 0,
			namePrefix,
			subDispatches: d.subDispatches
		});
		result.push(...flattenSubmoduleDispatches(d.subDispatches, namePrefix));
	}
	return result;
}
var makeHooks = (schema2) => new ModuleHooksImpl(schema2);
var ModuleHooksImpl = class {
	#schema;
	#dbView_;
	#consumerAs_;
	#reducerArgsDeserializers;
	#consumerReducerCount;
	#consumerProcedureCount;
	#flatSubmodules;
	#consumerAnonViewCount;
	#consumerViewCount;
	/** Cache the `ReducerCtx` object to avoid allocating anew for every reducer call. */
	#reducerCtx_;
	/** Per-submodule alias ctx maps, cached lazily (parallel to #flatSubmodules). */
	#submoduleAsViews_ = [];
	constructor(schema2) {
		this.#schema = schema2;
		this.#consumerReducerCount = schema2.reducers.length;
		this.#consumerProcedureCount = schema2.procedures.length;
		this.#consumerAnonViewCount = schema2.anonViews.length;
		this.#consumerViewCount = schema2.views.length;
		this.#flatSubmodules = flattenSubmoduleDispatches(schema2.submoduleDispatchInfos);
		const consumerDeserializers = schema2.moduleDef.reducers.map(({ params }) => ProductType.makeDeserializer(params, schema2.typespace));
		const submoduleDeserializers = this.#flatSubmodules.flatMap(({ reducerDefs, typespace }) => reducerDefs.map(({ params }) => ProductType.makeDeserializer(params, typespace)));
		this.#reducerArgsDeserializers = [...consumerDeserializers, ...submoduleDeserializers];
	}
	get #dbView() {
		if (this.#dbView_ !== void 0) return this.#dbView_;
		const rootTables = Object.values(this.#schema.schemaType.tables).map((table2) => [table2.accessorName, makeTableView(this.#schema.typespace, table2.tableDef, hostBackend, "", table2.isOutbox)]);
		const submoduleNs = this.#schema.submoduleDispatchInfos.map((dispatch) => [dispatch.namespace, buildDbViewForDispatch(dispatch, dispatch.namespace + ".")]);
		this.#dbView_ = freeze(Object.fromEntries([...rootTables, ...submoduleNs]));
		return this.#dbView_;
	}
	#getSubmoduleDbView(submoduleIdx) {
		const m = this.#flatSubmodules[submoduleIdx];
		return m.dbView_ ??= freeze(Object.fromEntries(m.tables.map(({ accessorName, tableDef }) => [accessorName, makeTableView(m.typespace, tableDef, hostBackend, m.namePrefix, m.schemaTables[accessorName].isOutbox)])));
	}
	#getSubmoduleAsViews(submoduleIdx) {
		return this.#submoduleAsViews_[submoduleIdx] ??= buildAliasCtxMap(this.#reducerCtx, this.#flatSubmodules[submoduleIdx].subDispatches, this.#flatSubmodules[submoduleIdx].namePrefix);
	}
	/** Query builder scoped to the submodule's own tables, with namespace-prefixed
	*  source names so generated SQL targets the mounted table names. */
	#getSubmoduleQueryBuilder(submoduleIdx) {
		const m = this.#flatSubmodules[submoduleIdx];
		return m.queryBuilder_ ??= makeQueryBuilder({ tables: Object.fromEntries(Object.entries(m.schemaTables).map(([key, def]) => [key, {
			...def,
			sourceName: m.namePrefix + def.sourceName
		}])) });
	}
	get #reducerCtx() {
		return this.#reducerCtx_ ??= new ReducerCtxImpl(Identity.zero(), Timestamp.UNIX_EPOCH, null, this.#dbView);
	}
	get #consumerAs() {
		return this.#consumerAs_ ??= buildAliasCtxMap(this.#reducerCtx, this.#schema.submoduleDispatchInfos, "");
	}
	__describe_module__() {
		const writer = new BinaryWriter(128);
		RawModuleDef.serialize(writer, RawModuleDef.V10(this.#schema.rawModuleDefV10()));
		return writer.getBuffer();
	}
	__get_error_constructor__(code) {
		return getErrorConstructor(code);
	}
	get __sender_error_class__() {
		return SenderError;
	}
	__call_reducer__(reducerId, sender, connId, timestamp, argsBuf) {
		const deserializeArgs = this.#reducerArgsDeserializers[reducerId];
		BINARY_READER.reset(argsBuf);
		const args = deserializeArgs(BINARY_READER);
		const senderIdentity = new Identity(sender);
		let fn;
		let dbView;
		let asViews;
		if (reducerId < this.#consumerReducerCount) {
			fn = this.#schema.reducers[reducerId];
			dbView = this.#dbView;
			asViews = this.#consumerAs;
		} else {
			let offset = this.#consumerReducerCount;
			for (let i = 0; i < this.#flatSubmodules.length; i++) {
				const m = this.#flatSubmodules[i];
				if (reducerId < offset + m.reducerFns.length) {
					fn = m.reducerFns[reducerId - offset];
					dbView = this.#getSubmoduleDbView(i);
					asViews = this.#getSubmoduleAsViews(i);
					break;
				}
				offset += m.reducerFns.length;
			}
			if (fn === void 0) throw new RangeError(`unknown reducerId ${reducerId}`);
		}
		const ctx = this.#reducerCtx;
		ReducerCtxImpl.resetHost(ctx, senderIdentity, new Timestamp(timestamp), ConnectionId.nullIfZero(new ConnectionId(connId)), dbView, asViews);
		callUserFunction(fn, ctx, args);
	}
	__call_view__(id, sender, argsBuf) {
		const moduleCtx = this.#schema;
		let viewFns;
		let localId;
		let dbView;
		let from;
		if (id < this.#consumerViewCount) {
			viewFns = moduleCtx.views;
			localId = id;
			dbView = this.#dbView;
			from = makeQueryBuilder(moduleCtx.schemaType);
		} else {
			let offset = this.#consumerViewCount;
			let found = false;
			for (let i = 0; i < this.#flatSubmodules.length; i++) {
				const m = this.#flatSubmodules[i];
				if (id < offset + m.viewFns.length) {
					viewFns = m.viewFns;
					localId = id - offset;
					dbView = this.#getSubmoduleDbView(i);
					from = this.#getSubmoduleQueryBuilder(i);
					found = true;
					break;
				}
				offset += m.viewFns.length;
			}
			if (!found) throw new RangeError(`unknown viewId ${id}`);
		}
		const { fn, deserializeParams, serializeReturn, returnTypeBaseSize } = viewFns[localId];
		const ret = callUserFunction(fn, freeze({
			env: environment,
			sender: new Identity(sender),
			db: dbView,
			from
		}), deserializeParams(new BinaryReader(argsBuf)));
		const retBuf = new BinaryWriter(returnTypeBaseSize);
		if (isRowTypedQuery(ret)) {
			const query = toSql(ret);
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RawSql(query));
		} else {
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RowData);
			serializeReturn(retBuf, ret);
		}
		return { data: retBuf.getBuffer() };
	}
	__call_view_anon__(id, argsBuf) {
		const moduleCtx = this.#schema;
		let anonViewFns;
		let localId;
		let dbView;
		let from;
		if (id < this.#consumerAnonViewCount) {
			anonViewFns = moduleCtx.anonViews;
			localId = id;
			dbView = this.#dbView;
			from = makeQueryBuilder(moduleCtx.schemaType);
		} else {
			let offset = this.#consumerAnonViewCount;
			let found = false;
			for (let i = 0; i < this.#flatSubmodules.length; i++) {
				const m = this.#flatSubmodules[i];
				if (id < offset + m.anonViewFns.length) {
					anonViewFns = m.anonViewFns;
					localId = id - offset;
					dbView = this.#getSubmoduleDbView(i);
					from = this.#getSubmoduleQueryBuilder(i);
					found = true;
					break;
				}
				offset += m.anonViewFns.length;
			}
			if (!found) throw new RangeError(`unknown anonViewId ${id}`);
		}
		const { fn, deserializeParams, serializeReturn, returnTypeBaseSize } = anonViewFns[localId];
		const ret = callUserFunction(fn, freeze({
			env: environment,
			db: dbView,
			from
		}), deserializeParams(new BinaryReader(argsBuf)));
		const retBuf = new BinaryWriter(returnTypeBaseSize);
		if (isRowTypedQuery(ret)) {
			const query = toSql(ret);
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RawSql(query));
		} else {
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RowData);
			serializeReturn(retBuf, ret);
		}
		return { data: retBuf.getBuffer() };
	}
	__call_procedure__(id, sender, connection_id, timestamp, args) {
		const senderIdentity = new Identity(sender);
		const connId = ConnectionId.nullIfZero(new ConnectionId(connection_id));
		const ts = new Timestamp(timestamp);
		if (id < this.#consumerProcedureCount) return callProcedure(this.#schema.procedures, id, senderIdentity, connId, ts, args, () => this.#dbView, this.#schema.submoduleDispatchInfos);
		let offset = this.#consumerProcedureCount;
		for (let i = 0; i < this.#flatSubmodules.length; i++) {
			const m = this.#flatSubmodules[i];
			if (id < offset + m.procedureFns.length) return callProcedure(m.procedureFns, id - offset, senderIdentity, connId, ts, args, () => this.#getSubmoduleDbView(i), m.subDispatches, m.namePrefix);
			offset += m.procedureFns.length;
		}
		throw new RangeError(`unknown procedureId ${id}`);
	}
	__call_http_handler__(id, timestamp, request, body, sender, senderJwt) {
		const moduleCtx = this.#schema;
		const handler = moduleCtx.httpHandlers[id];
		const [responseMetadata, responseBody] = responseIntoWire(callUserFunction(handler, new HandlerContextImpl(new Identity(sender), new Timestamp(timestamp), senderJwt, () => this.#dbView, this.#schema.submoduleDispatchInfos), requestFromWire(HttpRequest.deserialize(new BinaryReader(request)), body)));
		const responseBuf = new BinaryWriter(bsatnBaseSize(moduleCtx.typespace, HttpResponse.algebraicType));
		HttpResponse.serialize(responseBuf, responseMetadata);
		return [responseBuf.getBuffer(), responseBody];
	}
};
var BINARY_WRITER = new BinaryWriter(0);
var BINARY_READER = new BinaryReader(new Uint8Array());
var HandlerContextImpl = class _HandlerContextImpl {
	constructor(sender, timestamp, senderJwt, dbView, dispatches = []) {
		this.sender = sender;
		this.timestamp = timestamp;
		this.#senderJwt = senderJwt;
		this.#dbView = dbView;
		this.#dispatches = dispatches;
	}
	env = environment;
	#identity;
	#senderJwt;
	#senderAuth;
	#uuidCounter;
	#random;
	#dbView;
	#dispatches;
	#asViews;
	http = httpClient;
	/** The `AuthCtx` of `me.sender`, which the transactions that `me` opens share. */
	static senderAuth(me) {
		return me.#senderAuth ??= AuthCtxImpl.forSender(me.sender, me.identity, () => me.#senderJwt);
	}
	get identity() {
		return this.#identity ??= new Identity(sys2.identity());
	}
	get random() {
		return this.#random ??= makeRandom(this.timestamp);
	}
	get as() {
		return this.#asViews ??= buildHandlerAliasCtxMap(this, this.#dispatches, "");
	}
	withTx(body) {
		const dispatches = this.#dispatches;
		return runWithTx((timestamp) => {
			const tx = new ReducerCtxImpl(this.sender, timestamp, null, this.#dbView(), hostBackend, _HandlerContextImpl.senderAuth(this));
			if (dispatches.length > 0) tx.as = buildAliasCtxMap(tx, dispatches, "");
			return tx;
		}, body);
	}
	newUuidV4() {
		const bytes = this.random.fill(new Uint8Array(16));
		return Uuid.fromRandomBytesV4(bytes);
	}
	newUuidV7() {
		const bytes = this.random.fill(new Uint8Array(4));
		const counter = this.#uuidCounter ??= { value: 0 };
		return Uuid.fromCounterV7(counter, this.timestamp, bytes);
	}
};
function buildDbViewForDispatch(dispatch, namePrefix) {
	const tableEntries = dispatch.tables.map(({ accessorName, tableDef }) => [accessorName, makeTableView(dispatch.typespace, tableDef, hostBackend, namePrefix, dispatch.schemaTables[accessorName].isOutbox)]);
	const subNsEntries = dispatch.subDispatches.map((sub) => [sub.namespace, buildDbViewForDispatch(sub, namePrefix + sub.namespace + ".")]);
	return freeze(Object.fromEntries([...tableEntries, ...subNsEntries]));
}
function buildAliasCtx(parent, dispatch, namePrefix) {
	return {
		get sender() {
			return parent.sender;
		},
		get databaseIdentity() {
			return parent.databaseIdentity;
		},
		get identity() {
			return parent.identity;
		},
		get timestamp() {
			return parent.timestamp;
		},
		get connectionId() {
			return parent.connectionId;
		},
		get senderAuth() {
			return parent.senderAuth;
		},
		get random() {
			return parent.random;
		},
		newUuidV4() {
			return parent.newUuidV4();
		},
		newUuidV7() {
			return parent.newUuidV7();
		},
		db: buildDbViewForDispatch(dispatch, namePrefix),
		as: buildAliasCtxMap(parent, dispatch.subDispatches, namePrefix)
	};
}
function buildAliasCtxMap(parent, dispatches, parentPrefix) {
	return freeze(Object.fromEntries(dispatches.map((d) => [d.namespace, buildAliasCtx(parent, d, parentPrefix + d.namespace + ".")])));
}
function buildHandlerAliasCtx(parent, dispatch, namePrefix) {
	let nsDb_;
	return {
		get sender() {
			return parent.sender;
		},
		get timestamp() {
			return parent.timestamp;
		},
		get http() {
			return parent.http;
		},
		get identity() {
			return parent.identity;
		},
		get random() {
			return parent.random;
		},
		as: buildHandlerAliasCtxMap(parent, dispatch.subDispatches, namePrefix),
		withTx(body) {
			return runWithTx((ts) => {
				const tx = new ReducerCtxImpl(parent.sender, ts, null, nsDb_ ??= buildDbViewForDispatch(dispatch, namePrefix), hostBackend, HandlerContextImpl.senderAuth(parent));
				assignTxAliasViews(tx, dispatch.subDispatches, namePrefix);
				return tx;
			}, body);
		},
		newUuidV4() {
			return parent.newUuidV4();
		},
		newUuidV7() {
			return parent.newUuidV7();
		}
	};
}
function buildHandlerAliasCtxMap(parent, dispatches, parentPrefix) {
	return freeze(Object.fromEntries(dispatches.map((d) => [d.namespace, buildHandlerAliasCtx(parent, d, parentPrefix + d.namespace + ".")])));
}
function buildProcedureAliasCtx(parent, dispatch, namePrefix) {
	let nsDb_;
	return {
		get sender() {
			return parent.sender;
		},
		get databaseIdentity() {
			return parent.databaseIdentity;
		},
		get identity() {
			return parent.identity;
		},
		get timestamp() {
			return parent.timestamp;
		},
		get connectionId() {
			return parent.connectionId;
		},
		get http() {
			return parent.http;
		},
		get random() {
			return parent.random;
		},
		sleep(duration) {
			return parent.sleep(duration);
		},
		as: buildProcedureAliasCtxMap(parent, dispatch.subDispatches, namePrefix),
		withTx(body) {
			return runWithTx((ts) => {
				const tx = new ReducerCtxImpl(parent.sender, ts, parent.connectionId, nsDb_ ??= buildDbViewForDispatch(dispatch, namePrefix));
				assignTxAliasViews(tx, dispatch.subDispatches, namePrefix);
				return tx;
			}, body);
		},
		newUuidV4() {
			return parent.newUuidV4();
		},
		newUuidV7() {
			return parent.newUuidV7();
		}
	};
}
function buildProcedureAliasCtxMap(parent, dispatches, parentPrefix) {
	return freeze(Object.fromEntries(dispatches.map((d) => [d.namespace, buildProcedureAliasCtx(parent, d, parentPrefix + d.namespace + ".")])));
}
function assignTxAliasViews(tx, dispatches, parentPrefix = "") {
	if (dispatches.length > 0) tx.as = buildAliasCtxMap(tx, dispatches, parentPrefix);
}
function makeTableView(typespace, table2, backendOrNamePrefix = hostBackend, namePrefix = "", isOutbox = false) {
	const backend = isDatastoreBackend(backendOrNamePrefix) ? backendOrNamePrefix : hostBackend;
	if (typeof backendOrNamePrefix === "string") namePrefix = backendOrNamePrefix;
	const table_id = backend.tableIdFromName(namePrefix + table2.sourceName);
	const rowType = typespace.types[table2.productTypeRef];
	if (rowType.tag !== "Product") throw "impossible";
	const serializeRow = AlgebraicType.makeSerializer(rowType, typespace);
	const deserializeRow = AlgebraicType.makeDeserializer(rowType, typespace);
	const sequences = table2.sequences.map((seq) => {
		const col = rowType.value.elements[seq.column];
		const colType = col.algebraicType;
		let sequenceTrigger;
		switch (colType.tag) {
			case "U8":
			case "I8":
			case "U16":
			case "I16":
			case "U32":
			case "I32":
				sequenceTrigger = 0;
				break;
			case "U64":
			case "I64":
			case "U128":
			case "I128":
			case "U256":
			case "I256":
				sequenceTrigger = 0n;
				break;
			default: throw new TypeError("invalid sequence type");
		}
		return {
			colName: col.name,
			sequenceTrigger,
			deserialize: AlgebraicType.makeDeserializer(colType, typespace)
		};
	});
	const hasAutoIncrement = sequences.length > 0;
	const iter = () => tableIterator(backend.datastoreTableScanBsatn(table_id), deserializeRow, backend);
	const integrateGeneratedColumns = hasAutoIncrement ? (row, ret_buf) => {
		BINARY_READER.reset(ret_buf);
		for (const { colName, deserialize, sequenceTrigger } of sequences) if (row[colName] === sequenceTrigger) row[colName] = deserialize(BINARY_READER);
	} : null;
	const generatedColumnsView = (generated, fallback) => generated instanceof Uint8Array ? new DataView(generated.buffer, generated.byteOffset, generated.byteLength) : fallback;
	const tableMethods = {
		count: () => BigInt(backend.datastoreTableRowCount(table_id)),
		iter,
		[Symbol.iterator]: () => iter(),
		insert: (row) => {
			const buf = LEAF_BUF;
			BINARY_WRITER.reset(buf);
			serializeRow(BINARY_WRITER, row);
			const generated = backend.datastoreInsertBsatn(table_id, buf.buffer, BINARY_WRITER.offset);
			const ret = { ...row };
			integrateGeneratedColumns?.(ret, generatedColumnsView(generated, buf.view));
			return ret;
		},
		delete: (row) => {
			const buf = LEAF_BUF;
			BINARY_WRITER.reset(buf);
			BINARY_WRITER.writeU32(1);
			serializeRow(BINARY_WRITER, row);
			return backend.datastoreDeleteAllByEqBsatn(table_id, buf.buffer, BINARY_WRITER.offset) > 0;
		},
		clear: () => {
			const count = BigInt(backend.datastoreTableRowCount(table_id));
			backend.datastoreClear(table_id);
			return count;
		}
	};
	const tableView = Object.assign(/* @__PURE__ */ Object.create(null), tableMethods);
	if (isOutbox) {
		Reflect.deleteProperty(tableView, "delete");
		Reflect.deleteProperty(tableView, "clear");
	}
	for (const indexDef of table2.indexes) {
		const accessorName = indexDef.accessorName;
		const index_id = backend.indexIdFromName(namePrefix + indexDef.sourceName);
		let column_ids;
		let isHashIndex = false;
		switch (indexDef.algorithm.tag) {
			case "Hash":
				isHashIndex = true;
				column_ids = indexDef.algorithm.value;
				break;
			case "BTree":
				column_ids = indexDef.algorithm.value;
				break;
			case "Direct":
				column_ids = [indexDef.algorithm.value];
				break;
		}
		const numColumns = column_ids.length;
		const columnSet = new Set(column_ids);
		const isUnique = table2.constraints.filter((x) => x.data.tag === "Unique").some((x) => {
			const constraintColumns = new Set(x.data.value.columns);
			return [...columnSet].every((column) => constraintColumns.has(column));
		});
		const isPrimaryKey = isUnique && column_ids.length === table2.primaryKey.length && column_ids.every((id, i) => table2.primaryKey[i] === id);
		const indexSerializers = column_ids.map((id) => AlgebraicType.makeSerializer(rowType.value.elements[id].algebraicType, typespace));
		const serializePoint = (buffer, colVal) => {
			BINARY_WRITER.reset(buffer);
			for (let i = 0; i < numColumns; i++) indexSerializers[i](BINARY_WRITER, colVal[i]);
			return BINARY_WRITER.offset;
		};
		const serializeSingleElement = numColumns === 1 ? indexSerializers[0] : null;
		const serializeSinglePoint = serializeSingleElement && ((buffer, colVal) => {
			BINARY_WRITER.reset(buffer);
			serializeSingleElement(BINARY_WRITER, colVal);
			return BINARY_WRITER.offset;
		});
		let index;
		if (isUnique && serializeSinglePoint) {
			const base = {
				find: (colVal) => {
					const buf = LEAF_BUF;
					const point_len = serializeSinglePoint(buf, colVal);
					return tableIterateOne(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
				},
				delete: (colVal) => {
					const buf = LEAF_BUF;
					const point_len = serializeSinglePoint(buf, colVal);
					return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len) > 0;
				}
			};
			if (isPrimaryKey) base.update = (row) => {
				const buf = LEAF_BUF;
				BINARY_WRITER.reset(buf);
				serializeRow(BINARY_WRITER, row);
				const generated = backend.datastoreUpdateBsatn(table_id, index_id, buf.buffer, BINARY_WRITER.offset);
				integrateGeneratedColumns?.(row, generatedColumnsView(generated, buf.view));
				return row;
			};
			index = base;
		} else if (isUnique) {
			const base = {
				find: (colVal) => {
					if (colVal.length !== numColumns) throw new TypeError("wrong number of elements");
					const buf = LEAF_BUF;
					const point_len = serializePoint(buf, colVal);
					return tableIterateOne(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
				},
				delete: (colVal) => {
					if (colVal.length !== numColumns) throw new TypeError("wrong number of elements");
					const buf = LEAF_BUF;
					const point_len = serializePoint(buf, colVal);
					return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len) > 0;
				}
			};
			if (isPrimaryKey) base.update = (row) => {
				const buf = LEAF_BUF;
				BINARY_WRITER.reset(buf);
				serializeRow(BINARY_WRITER, row);
				const generated = backend.datastoreUpdateBsatn(table_id, index_id, buf.buffer, BINARY_WRITER.offset);
				integrateGeneratedColumns?.(row, generatedColumnsView(generated, buf.view));
				return row;
			};
			index = base;
		} else if (serializeSinglePoint) {
			const serializeSingleRange = !isHashIndex ? (buffer, range) => {
				BINARY_WRITER.reset(buffer);
				const writer = BINARY_WRITER;
				const writeBound = (bound) => {
					writer.writeU8({
						included: 0,
						excluded: 1,
						unbounded: 2
					}[bound.tag]);
					if (bound.tag !== "unbounded") serializeSingleElement(writer, bound.value);
				};
				writeBound(range.from);
				const rstartLen = writer.offset;
				writeBound(range.to);
				return [
					0,
					0,
					rstartLen,
					writer.offset - rstartLen
				];
			} : null;
			const rawIndex = {
				filter: (range) => {
					const buf = LEAF_BUF;
					if (serializeSingleRange && range instanceof Range) {
						const args = serializeSingleRange(buf, range);
						return tableIterator(backend.datastoreIndexScanRangeBsatn(index_id, buf.buffer, ...args), deserializeRow, backend);
					}
					const point_len = serializeSinglePoint(buf, range);
					return tableIterator(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
				},
				delete: (range) => {
					const buf = LEAF_BUF;
					if (serializeSingleRange && range instanceof Range) {
						const args = serializeSingleRange(buf, range);
						return backend.datastoreDeleteByIndexScanRangeBsatn(index_id, buf.buffer, ...args);
					}
					const point_len = serializeSinglePoint(buf, range);
					return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len);
				}
			};
			if (isHashIndex) index = rawIndex;
			else index = rawIndex;
		} else if (isHashIndex) index = {
			filter: (range) => {
				const buf = LEAF_BUF;
				const point_len = serializePoint(buf, range);
				return tableIterator(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
			},
			delete: (range) => {
				const buf = LEAF_BUF;
				const point_len = serializePoint(buf, range);
				return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len);
			}
		};
		else {
			const isCompleteScalarKey = (range) => {
				return range.length === numColumns && !(range[range.length - 1] instanceof Range);
			};
			const serializeRange = (buffer, range) => {
				if (range.length > numColumns) throw new TypeError("too many elements");
				BINARY_WRITER.reset(buffer);
				const writer = BINARY_WRITER;
				const prefix_elems = range.length - 1;
				for (let i = 0; i < prefix_elems; i++) indexSerializers[i](writer, range[i]);
				const rstartOffset = writer.offset;
				const term = range[range.length - 1];
				const serializeTerm = indexSerializers[range.length - 1];
				if (term instanceof Range) {
					const writeBound = (bound) => {
						writer.writeU8({
							included: 0,
							excluded: 1,
							unbounded: 2
						}[bound.tag]);
						if (bound.tag !== "unbounded") serializeTerm(writer, bound.value);
					};
					writeBound(term.from);
					const rstartLen = writer.offset - rstartOffset;
					writeBound(term.to);
					return [
						rstartOffset,
						prefix_elems,
						rstartLen,
						writer.offset - rstartOffset - rstartLen
					];
				} else {
					writer.writeU8(0);
					serializeTerm(writer, term);
					return [
						rstartOffset,
						prefix_elems,
						writer.offset - rstartOffset,
						0
					];
				}
			};
			index = {
				filter: (range) => {
					if (!Array.isArray(range)) range = [range];
					if (isCompleteScalarKey(range)) {
						const buf = LEAF_BUF;
						const point_len = serializePoint(buf, range);
						return tableIterator(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
					} else {
						const buf = LEAF_BUF;
						const args = serializeRange(buf, range);
						return tableIterator(backend.datastoreIndexScanRangeBsatn(index_id, buf.buffer, ...args), deserializeRow, backend);
					}
				},
				delete: (range) => {
					if (!Array.isArray(range)) range = [range];
					if (isCompleteScalarKey(range)) {
						const buf = LEAF_BUF;
						const point_len = serializePoint(buf, range);
						return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len);
					} else {
						const buf = LEAF_BUF;
						const args = serializeRange(buf, range);
						return backend.datastoreDeleteByIndexScanRangeBsatn(index_id, buf.buffer, ...args);
					}
				}
			};
		}
		if (isOutbox) {
			Reflect.deleteProperty(index, "delete");
			Reflect.deleteProperty(index, "update");
		}
		if (Object.hasOwn(tableView, accessorName)) freeze(Object.assign(tableView[accessorName], index));
		else tableView[accessorName] = freeze(index);
	}
	return freeze(tableView);
}
function* tableIterator(id, deserialize, backend = hostBackend) {
	const iter = new IteratorHandle(id, backend);
	const iterBuf = takeBuf();
	try {
		let amt;
		while (amt = iter.advance(iterBuf)) {
			const reader = new BinaryReader(iterBuf.view);
			while (reader.offset < amt) yield deserialize(reader);
		}
	} finally {
		iter[Symbol.dispose]();
		returnBuf(iterBuf);
	}
}
function tableIterateOne(id, deserialize, backend = hostBackend) {
	const buf = LEAF_BUF;
	if (advanceIterRaw(id, buf, backend) !== 0) {
		BINARY_READER.reset(buf.view);
		return deserialize(BINARY_READER);
	}
	return null;
}
function advanceIterRaw(id, buf, backend = hostBackend) {
	while (true) try {
		return 0 | backend.rowIterBsatnAdvance(id, buf.buffer);
	} catch (e) {
		if (e && typeof e === "object" && hasOwn(e, "__buffer_too_small__")) {
			buf.grow(e.__buffer_too_small__);
			continue;
		}
		throw e;
	}
}
var DEFAULT_BUFFER_CAPACITY = 32 * 1024 * 2;
var ITER_BUFS = [new ResizableBuffer(DEFAULT_BUFFER_CAPACITY)];
var ITER_BUF_COUNT = 1;
function takeBuf() {
	return ITER_BUF_COUNT ? ITER_BUFS[--ITER_BUF_COUNT] : new ResizableBuffer(DEFAULT_BUFFER_CAPACITY);
}
function returnBuf(buf) {
	ITER_BUFS[ITER_BUF_COUNT++] = buf;
}
var LEAF_BUF = new ResizableBuffer(DEFAULT_BUFFER_CAPACITY);
var IteratorHandle = class _IteratorHandle {
	#id;
	#backend;
	static #finalizationRegistry = new FinalizationRegistry(({ id, backend }) => backend.rowIterBsatnClose(id));
	constructor(id, backend = hostBackend) {
		this.#id = id;
		this.#backend = backend;
		_IteratorHandle.#finalizationRegistry.register(this, {
			id,
			backend
		}, this);
	}
	/** Unregister this object with the finalization registry and return the id */
	#detach() {
		const id = this.#id;
		this.#id = -1;
		_IteratorHandle.#finalizationRegistry.unregister(this);
		return id;
	}
	/** Call `row_iter_bsatn_advance`, returning 0 if this iterator has been exhausted. */
	advance(buf) {
		if (this.#id === -1) return 0;
		const ret = advanceIterRaw(this.#id, buf, this.#backend);
		if (ret <= 0) this.#detach();
		return ret < 0 ? -ret : ret;
	}
	[Symbol.dispose]() {
		if (this.#id >= 0) {
			const id = this.#detach();
			this.#backend.rowIterBsatnClose(id);
		}
	}
};
var { freeze: freeze2 } = Object;
var requestBaseSize = bsatnBaseSize({ types: [] }, HttpRequest.algebraicType);
function fetch(url, init = {}) {
	const method = serializeMethod(init.method);
	const headers = serializeHeaders(new Headers(init.headers));
	const uri = "" + url;
	const request = freeze2({
		method,
		headers,
		timeout: init.timeout,
		uri,
		version: { tag: "Http11" }
	});
	const requestBuf = new BinaryWriter(requestBaseSize);
	HttpRequest.serialize(requestBuf, request);
	const body = init.body == null ? new Uint8Array() : typeof init.body === "string" ? init.body : new Uint8Array(init.body);
	const [responseBuf, responseBody] = sys2.procedure_http_request(requestBuf.getBuffer(), body);
	const response = HttpResponse.deserialize(new BinaryReader(responseBuf));
	return SyncResponse[makeResponse](responseBody, {
		type: "basic",
		url: uri,
		status: response.code,
		statusText: import_statuses.default.message[response.code] ?? "",
		headers: deserializeHeaders(response.headers),
		aborted: false,
		version: response.version
	});
}
freeze2(fetch);
var httpClient = freeze2({ fetch });
function makeProcedureExport(ctx, opts, params, ret, fn) {
	const name = opts?.name;
	const procedureExport = (...args) => fn(...args);
	procedureExport[exportContext] = ctx;
	procedureExport[registerExport] = (ctx2, exportName) => {
		registerProcedure(ctx2, name ?? exportName, params, ret, fn);
		ctx2.functionExports.set(procedureExport, name ?? exportName);
		if (opts?.onSchedule !== void 0) ctx2.pendingSchedules.push({
			table: opts.onSchedule,
			functionName: name ?? exportName
		});
	};
	return procedureExport;
}
function registerProcedure(ctx, exportName, params, ret, fn, opts) {
	ctx.defineFunction(exportName);
	const paramsType = { elements: Object.entries(params).map(([n, c]) => ({
		name: n,
		algebraicType: ctx.registerTypesRecursively("typeBuilder" in c ? c.typeBuilder : c).algebraicType
	})) };
	const returnType = ctx.registerTypesRecursively(ret).algebraicType;
	ctx.moduleDef.procedures.push({
		sourceName: exportName,
		params: paramsType,
		returnType,
		visibility: FunctionVisibility.ClientCallable
	});
	const { typespace } = ctx;
	ctx.procedures.push({
		fn,
		deserializeArgs: ProductType.makeDeserializer(paramsType, typespace),
		serializeReturn: AlgebraicType.makeSerializer(returnType, typespace),
		returnTypeBaseSize: bsatnBaseSize(typespace, returnType)
	});
}
function callProcedure(procedures, id, sender, connectionId, timestamp, argsBuf, dbView, dispatches = [], parentPrefix = "") {
	const { fn, deserializeArgs, serializeReturn, returnTypeBaseSize } = procedures[id];
	const args = deserializeArgs(new BinaryReader(argsBuf));
	const ret = callUserFunction(fn, new ProcedureCtxImpl(sender, timestamp, connectionId, dbView, hostBackend, httpClient, void 0, void 0, void 0, dispatches, parentPrefix), args);
	const retBuf = new BinaryWriter(returnTypeBaseSize);
	serializeReturn(retBuf, ret);
	return retBuf.getBuffer();
}
var ProcedureCtxImpl = class ProcedureCtx {
	constructor(sender, timestamp, connectionId, dbView, backend = hostBackend, http = httpClient, sleep = () => {
		throw new Error("procedure sleep is not available in this runtime");
	}, random, childSeedRandom, dispatches = [], parentPrefix = "") {
		this.sender = sender;
		this.timestamp = timestamp;
		this.connectionId = connectionId;
		this.#dbView = dbView;
		this.#backend = backend;
		this.#http = http;
		this.#sleep = sleep;
		this.#random = random;
		this.#childSeedRandom = childSeedRandom;
		this.#dispatches = dispatches;
		this.#parentPrefix = parentPrefix;
	}
	#identity;
	#uuidCounter;
	#random;
	#dbView;
	#backend;
	#http;
	#sleep;
	#childSeedRandom;
	env = environment;
	#dispatches;
	#parentPrefix;
	#asViews;
	get databaseIdentity() {
		return this.#identity ??= new Identity(this.#backend.identity());
	}
	get identity() {
		return this.databaseIdentity;
	}
	get random() {
		return this.#random ??= makeRandom(this.timestamp);
	}
	get http() {
		return this.#http;
	}
	sleep(duration) {
		this.#sleep(duration);
	}
	get as() {
		return this.#asViews ??= buildProcedureAliasCtxMap(this, this.#dispatches, this.#parentPrefix);
	}
	withTx(body) {
		const txSeed = this.#childSeedRandom?.bigintInRange(0n, (1n << 64n) - 1n);
		const dispatches = this.#dispatches;
		const parentPrefix = this.#parentPrefix;
		return runWithTx((timestamp) => {
			const tx = new ReducerCtxImpl(this.sender, timestamp, this.connectionId, this.#dbView(), this.#backend, void 0, txSeed == null ? void 0 : makeRandomFromSeed(txSeed));
			assignTxAliasViews(tx, dispatches, parentPrefix);
			return tx;
		}, body, this.#backend);
	}
	newUuidV4() {
		const bytes = this.random.fill(new Uint8Array(16));
		return Uuid.fromRandomBytesV4(bytes);
	}
	newUuidV7() {
		const bytes = this.random.fill(new Uint8Array(4));
		const counter = this.#uuidCounter ??= { value: 0 };
		return Uuid.fromCounterV7(counter, this.timestamp, bytes);
	}
};
function makeReducerExport(ctx, opts, params, fn, lifecycle) {
	const reducerExport = (...args) => fn(...args);
	reducerExport[exportContext] = ctx;
	reducerExport[registerExport] = (ctx2, exportName) => {
		registerReducer(ctx2, exportName, params, fn, opts, lifecycle);
		ctx2.functionExports.set(reducerExport, exportName);
		if (opts?.onResult !== void 0) ctx2.pendingOutboxCallbacks.push({
			table: opts.onResult,
			functionName: exportName
		});
		if (opts?.onSchedule !== void 0) ctx2.pendingSchedules.push({
			table: opts.onSchedule,
			functionName: exportName
		});
	};
	return reducerExport;
}
function registerReducer(ctx, exportName, params, fn, opts, lifecycle) {
	ctx.defineFunction(exportName);
	if (!(params instanceof RowBuilder)) params = new RowBuilder(params);
	if (opts?.onResult) {
		if (opts.onSchedule) throw new TypeError("A reducer cannot use both onSchedule and onResult");
		if (lifecycle) throw new TypeError("A lifecycle reducer cannot use onResult");
		const target = opts.onResult;
		const fields = Object.values(params.row);
		if (fields.length !== 2 || fields[0].typeBuilder !== target.rowType || !deepEqual(fields[1].typeBuilder.algebraicType, t.result(t.unit(), t.string()).algebraicType)) throw new TypeError("onResult requires the outbox row followed by Result<Unit, String>");
	}
	if (params.typeName === void 0) params.typeName = toPascalCase(exportName);
	const ref = ctx.registerTypesRecursively(params);
	const paramsType = ctx.resolveType(ref).value;
	const isLifecycle = lifecycle != null;
	ctx.moduleDef.reducers.push({
		sourceName: exportName,
		params: paramsType,
		visibility: FunctionVisibility.ClientCallable,
		okReturnType: AlgebraicType.Product({ elements: [] }),
		errReturnType: AlgebraicType.String
	});
	if (opts?.name != null) ctx.moduleDef.explicitNames.entries.push({
		tag: "Function",
		value: {
			sourceName: exportName,
			canonicalName: opts.name
		}
	});
	if (isLifecycle) ctx.moduleDef.lifeCycleReducers.push({
		lifecycleSpec: lifecycle,
		functionName: exportName
	});
	if (!fn.name) Object.defineProperty(fn, "name", {
		value: exportName,
		writable: false
	});
	ctx.reducers.push(fn);
}
var SchemaInner = class extends ModuleContext {
	schemaType;
	exportsRegistered = false;
	schedulesResolved = false;
	existingFunctions = /* @__PURE__ */ new Set();
	existingHttpHandlers = /* @__PURE__ */ new Set();
	reducers = [];
	procedures = [];
	views = [];
	anonViews = [];
	httpHandlers = [];
	/**
	* Maps reducer/procedure export objects to their source names.
	* Used for resolving scheduled table targets.
	*/
	functionExports = /* @__PURE__ */ new Map();
	tableSourceNames = /* @__PURE__ */ new Map();
	httpHandlerExports = /* @__PURE__ */ new Map();
	pendingSchedules = [];
	pendingOutboxCallbacks = [];
	pendingHttpRoutes = [];
	submoduleDispatchInfos = [];
	constructor(getSchemaType) {
		super();
		this.schemaType = getSchemaType(this);
	}
	defineFunction(name) {
		if (this.existingFunctions.has(name)) throw new TypeError(`There is already a reducer, procedure, or view with the name '${name}'`);
		this.existingFunctions.add(name);
	}
	defineHttpHandler(name) {
		if (this.existingHttpHandlers.has(name)) throw new TypeError(`There is already an HTTP handler with the name '${name}'`);
		this.existingHttpHandlers.add(name);
	}
	resolveSchedules() {
		if (this.schedulesResolved) return;
		this.schedulesResolved = true;
		const scheduledTables = /* @__PURE__ */ new Map();
		for (const { functionName: knownFunctionName, reducer, table: table2, tableName: knownTableName, scheduleAtCol: knownScheduleAtCol } of this.pendingSchedules) {
			let tableName = knownTableName;
			if (tableName === void 0) {
				const tableNames = this.tableSourceNames.get(table2);
				if (tableNames !== void 0 && tableNames.length > 1) throw new TypeError("Schedule target table is registered more than once in this schema. Use a distinct table handle for each scheduled table.");
				tableName = tableNames?.[0];
			}
			if (tableName === void 0) throw new TypeError("Schedule target table is not part of this schema.");
			if (table2.outbox) throw new TypeError("Outbox tables cannot be scheduled");
			const scheduleAtCol = knownScheduleAtCol ?? table2.scheduleAtCol;
			if (scheduleAtCol === void 0) throw new TypeError(`Table ${tableName} defines a schedule, but it does not have a ScheduleAt column.`);
			const functionName = knownFunctionName ?? (reducer === void 0 ? void 0 : this.functionExports.get(reducer()));
			if (functionName === void 0) {
				const msg = `Table ${tableName} defines a schedule, but it seems like the associated function was not exported.`;
				throw new TypeError(msg);
			}
			const existingFunctionName = scheduledTables.get(tableName);
			if (existingFunctionName !== void 0) throw new TypeError(`Table ${tableName} defines multiple schedules: ${existingFunctionName} and ${functionName}. A schedule table can only be used by one reducer or procedure.`);
			scheduledTables.set(tableName, functionName);
			this.moduleDef.schedules.push({
				sourceName: void 0,
				tableName,
				scheduleAtCol,
				functionName
			});
		}
	}
	resolveOutboxCallbacks() {
		for (const { table: table2, functionName } of this.pendingOutboxCallbacks) {
			const names = this.tableSourceNames.get(table2);
			if (names?.length !== 1) throw new TypeError("onResult must reference an outbox registered exactly once in this schema");
			const outbox = this.moduleDef.outboxes.find((o) => o.tableName === names[0]);
			if (!outbox) throw new TypeError("onResult requires an outbox table");
			if (outbox.onResultReducer !== void 0 && outbox.onResultReducer !== functionName) throw new TypeError("An outbox can only have one onResult reducer");
			outbox.onResultReducer = functionName;
		}
	}
	resolveHttpRoutes() {
		for (const route of this.pendingHttpRoutes) {
			const handlerFunction = this.httpHandlerExports.get(route.handler);
			if (handlerFunction === void 0) throw new TypeError(`HTTP route for path '${route.path}' refers to a handler that was not exported.`);
			this.moduleDef.httpRoutes.push({
				handlerFunction,
				method: route.method,
				path: route.path
			});
		}
	}
};
var Schema = class {
	#ctx;
	constructor(ctx) {
		this.#ctx = ctx;
	}
	[moduleHooks](exports) {
		this.buildRawModuleDefV10(exports);
		this.#ctx.resolveHttpRoutes();
		return makeHooks(this.#ctx);
	}
	get schemaType() {
		return this.#ctx.schemaType;
	}
	get moduleDef() {
		return this.#ctx.moduleDef;
	}
	get typespace() {
		return this.#ctx.typespace;
	}
	get submoduleDispatchInfos() {
		return this.#ctx.submoduleDispatchInfos;
	}
	/** Internal: register exports and materialize the RawModuleDefV10 for upload. */
	buildRawModuleDefV10(exports, opts) {
		registerModuleExports(this.#ctx, exports, { ignoreNonModuleExports: opts?.ignoreNonModuleExports ?? false });
		this.#ctx.resolveSchedules();
		this.#ctx.resolveOutboxCallbacks();
		return this.#ctx.rawModuleDefV10();
	}
	/**
	* @internal – called by schema() when processing a submodule namespace entry.
	* Registers the library's exports and returns both the serialized module def
	* and the runtime dispatch info needed by ModuleHooksImpl for __call_reducer__.
	*/
	buildSubmoduleDispatch(exports) {
		const rawDef = this.buildRawModuleDefV10(exports, { ignoreNonModuleExports: true });
		if (this.#ctx.moduleDef.environment.length !== 0) throw new TypeError("Submodules cannot declare environment variables");
		this.#ctx.resolveHttpRoutes();
		return {
			rawDef,
			dispatch: {
				namespace: "",
				reducerFns: [...this.#ctx.reducers],
				reducerDefs: [...this.#ctx.moduleDef.reducers],
				procedureFns: [...this.#ctx.procedures],
				procedureDefs: [...this.#ctx.moduleDef.procedures],
				anonViewFns: [...this.#ctx.anonViews],
				viewFns: [...this.#ctx.views],
				typespace: this.#ctx.moduleDef.typespace,
				tables: Object.values(this.#ctx.schemaType.tables).map((t2) => ({
					accessorName: t2.accessorName,
					tableDef: t2.tableDef
				})),
				schemaTables: this.#ctx.schemaType.tables,
				subDispatches: [...this.#ctx.submoduleDispatchInfos]
			}
		};
	}
	reducer(...args) {
		let opts, params = {}, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2: {
				let arg1;
				[arg1, fn] = args;
				if (typeof arg1.name === "string") opts = arg1;
				else params = arg1;
				break;
			}
			case 3:
				[opts, params, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, params, fn);
	}
	init(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, {}, fn, Lifecycle.Init);
	}
	clientConnected(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, {}, fn, Lifecycle.OnConnect);
	}
	clientDisconnected(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, {}, fn, Lifecycle.OnDisconnect);
	}
	view(opts, ...args) {
		let params = {}, ret, fn;
		switch (args.length) {
			case 2:
				[ret, fn] = args;
				break;
			case 3:
				[params, ret, fn] = args;
				break;
		}
		return makeViewExport(this.#ctx, opts, params, ret, fn);
	}
	anonymousView(opts, ...args) {
		let params = {}, ret, fn;
		switch (args.length) {
			case 2:
				[ret, fn] = args;
				break;
			case 3:
				[params, ret, fn] = args;
				break;
		}
		return makeAnonViewExport(this.#ctx, opts, params, ret, fn);
	}
	procedure(...args) {
		let opts, params = {}, ret, fn;
		switch (args.length) {
			case 2:
				[ret, fn] = args;
				break;
			case 3: {
				let arg1;
				[arg1, ret, fn] = args;
				if (typeof arg1.name === "string") opts = arg1;
				else params = arg1;
				break;
			}
			case 4:
				[opts, params, ret, fn] = args;
				break;
		}
		return makeProcedureExport(this.#ctx, opts, params, ret, fn);
	}
	httpHandler(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeHttpHandlerExport(this.#ctx, opts, fn);
	}
	httpRouter(router) {
		return makeHttpRouterExport(this.#ctx, router);
	}
	/**
	* Bundle multiple reducers, procedures, etc into one value to export.
	* The name they will be exported with is their corresponding key in the `exports` argument.
	*/
	exportGroup(exports) {
		return {
			[exportContext]: this.#ctx,
			[registerExport](ctx, _exportName) {
				for (const [exportName, moduleExport] of Object.entries(exports)) {
					checkExportContext(moduleExport, ctx);
					moduleExport[registerExport](ctx, exportName);
				}
			}
		};
	}
	clientVisibilityFilter = { sql: (filter) => ({
		[exportContext]: this.#ctx,
		[registerExport](ctx, _exportName) {
			ctx.moduleDef.rowLevelSecurity.push({ sql: filter });
		}
	}) };
};
var registerExport = Symbol("SpacetimeDB.registerExport");
var exportContext = Symbol("SpacetimeDB.exportContext");
function isModuleExport(x) {
	return (typeof x === "function" || typeof x === "object") && x !== null && registerExport in x;
}
function checkExportContext(exp, schema2) {
	if (exp[exportContext] != null && exp[exportContext] !== schema2) throw new TypeError("multiple schemas are not supported");
}
function isUntypedTableSchema(x) {
	return typeof x === "object" && x !== null && hasOwn(x, "tableDef");
}
function isSubmoduleNamespace(x) {
	return typeof x === "object" && x !== null && hasOwn(x, "default") && x.default instanceof Schema;
}
function isSubmoduleMount(x) {
	return typeof x === "object" && x !== null && hasOwn(x, "module") && !hasOwn(x, "default") && !hasOwn(x, "tableDef");
}
function defaultImportError(accName) {
	return /* @__PURE__ */ new TypeError(`schema entry '${accName}' looks like a default import; use \`import * as ${accName} from '...'\` so the submodule can see the library's named reducer exports.`);
}
function resolveSubmoduleEntry(accName, entry) {
	if (entry instanceof Schema) throw defaultImportError(accName);
	if (isSubmoduleNamespace(entry)) return { submodule: entry };
	if (!isSubmoduleMount(entry)) return;
	if (entry.module instanceof Schema) throw defaultImportError(accName);
	if (!isSubmoduleNamespace(entry.module)) throw new TypeError(`schema entry '${accName}' has a \`module\` that is not a submodule namespace object; pass the result of \`import * as ${accName} from '...'\`.`);
	if (entry.name === void 0) return { submodule: entry.module };
	if (typeof entry.name !== "string" || entry.name.length === 0) throw new TypeError(`schema entry '${accName}' has an invalid \`name\`; expected a non-empty string for the canonical namespace name.`);
	return {
		submodule: entry.module,
		canonicalName: entry.name
	};
}
function registerModuleExports(schema2, exports, opts) {
	if (schema2.exportsRegistered) return;
	schema2.exportsRegistered = true;
	for (const [name, moduleExport] of Object.entries(exports)) {
		if (name === "default") continue;
		if (!isModuleExport(moduleExport)) {
			if (opts?.ignoreNonModuleExports) continue;
			throw new TypeError("exporting something that is not a spacetime export");
		}
		checkExportContext(moduleExport, schema2);
		moduleExport[registerExport](schema2, name);
	}
}
function schema(entries, moduleSettings) {
	return new Schema(new SchemaInner((ctx2) => {
		ctx2.moduleDef.environment = environmentDeclarations(moduleSettings?.env ?? {});
		if (moduleSettings?.CASE_CONVERSION_POLICY != null) ctx2.setCaseConversionPolicy(moduleSettings.CASE_CONVERSION_POLICY);
		const tableSchemas = {};
		for (const [accName, entry] of Object.entries(entries)) {
			const mount = resolveSubmoduleEntry(accName, entry);
			if (mount !== void 0) {
				const { submodule, canonicalName } = mount;
				const { rawDef, dispatch } = submodule.default.buildSubmoduleDispatch(submodule);
				dispatch.namespace = accName;
				ctx2.addSubmodule({
					namespace: accName,
					module: rawDef
				});
				if (canonicalName !== void 0) ctx2.moduleDef.explicitNames.entries.push({
					tag: "Namespace",
					value: {
						sourceName: accName,
						canonicalName
					}
				});
				ctx2.submoduleDispatchInfos.push(dispatch);
				continue;
			}
			if (!isUntypedTableSchema(entry)) throw new TypeError(`schema entry '${accName}' must be a table, a submodule namespace object, or a \`{ name, module }\` submodule mount`);
			const table2 = entry;
			const tableDef = table2.tableDef(ctx2, accName);
			tableSchemas[accName] = tableToSchema(accName, table2, tableDef);
			const tableSourceNames = ctx2.tableSourceNames.get(table2);
			if (tableSourceNames === void 0) ctx2.tableSourceNames.set(table2, [tableDef.sourceName]);
			else tableSourceNames.push(tableDef.sourceName);
			ctx2.moduleDef.tables.push(tableDef);
			if (table2.outbox) ctx2.moduleDef.outboxes.push({
				...table2.outbox,
				tableName: tableDef.sourceName,
				onResultReducer: void 0
			});
			if (table2.schedule) ctx2.pendingSchedules.push({
				table: table2,
				tableName: tableDef.sourceName,
				scheduleAtCol: table2.schedule.scheduleAtCol,
				reducer: table2.schedule.reducer
			});
			if (table2.tableName) ctx2.moduleDef.explicitNames.entries.push({
				tag: "Table",
				value: {
					sourceName: accName,
					canonicalName: table2.tableName
				}
			});
		}
		return {
			tables: tableSchemas,
			env: moduleSettings?.env ?? {}
		};
	}));
}
var import_object_inspect = __toESM(require_object_inspect());
var fmtLog = (...data) => data.map((x) => typeof x === "string" ? x : (0, import_object_inspect.default)(x)).join(" ");
var console_level_error = 0;
var console_level_warn = 1;
var console_level_info = 2;
var console_level_debug = 3;
var console_level_trace = 4;
var timerMap = /* @__PURE__ */ new Map();
var console2 = {
	__proto__: {},
	[Symbol.toStringTag]: "console",
	assert: (condition = false, ...data) => {
		if (!condition) sys2.console_log(console_level_error, fmtLog(...data));
	},
	clear: () => {},
	debug: (...data) => {
		sys2.console_log(console_level_debug, fmtLog(...data));
	},
	error: (...data) => {
		sys2.console_log(console_level_error, fmtLog(...data));
	},
	info: (...data) => {
		sys2.console_log(console_level_info, fmtLog(...data));
	},
	log: (...data) => {
		sys2.console_log(console_level_info, fmtLog(...data));
	},
	table: (tabularData, _properties) => {
		sys2.console_log(console_level_info, fmtLog(tabularData));
	},
	trace: (...data) => {
		sys2.console_log(console_level_trace, fmtLog(...data));
	},
	warn: (...data) => {
		sys2.console_log(console_level_warn, fmtLog(...data));
	},
	dir: (_item, _options) => {},
	dirxml: (..._data) => {},
	count: (_label = "default") => {},
	countReset: (_label = "default") => {},
	group: (..._data) => {},
	groupCollapsed: (..._data) => {},
	groupEnd: () => {},
	time: (label = "default") => {
		if (timerMap.has(label)) {
			sys2.console_log(console_level_warn, `Timer '${label}' already exists.`);
			return;
		}
		timerMap.set(label, sys2.console_timer_start(label));
	},
	timeLog: (label = "default", ...data) => {
		sys2.console_log(console_level_info, fmtLog(label, ...data));
	},
	timeEnd: (label = "default") => {
		const spanId = timerMap.get(label);
		if (spanId === void 0) {
			sys2.console_log(console_level_warn, `Timer '${label}' does not exist.`);
			return;
		}
		sys2.console_timer_end(spanId);
		timerMap.delete(label);
	},
	timeStamp: () => {},
	profile: () => {},
	profileEnd: () => {}
};
globalThis.console = console2;

//#endregion
//#region src/index.ts
const db = schema({
	driver: table({ public: true }, {
		driver_id: t.string().primaryKey(),
		name: t.string(),
		source: t.string(),
		created_at: t.f64(),
		revision: t.u32()
	}),
	session: table({ public: true }, {
		session_id: t.string().primaryKey(),
		driver_id: t.string(),
		track: t.string(),
		car: t.string(),
		corner: t.string(),
		mode: t.string(),
		agent: t.bool(),
		model: t.string().optional(),
		started_at: t.f64(),
		ended_at: t.f64().optional(),
		plan: t.string().optional(),
		recording: t.string().optional(),
		revision: t.u32()
	}),
	lap: table({ public: true }, {
		lap_id: t.string().primaryKey(),
		session_id: t.string(),
		n: t.u32(),
		attempt_id: t.string(),
		role: t.string(),
		valid: t.bool(),
		invalid_reason: t.string().optional(),
		section_s: t.f64().optional(),
		entry_kmh: t.f64().optional(),
		apex_kmh: t.f64().optional(),
		exit_kmh: t.f64().optional(),
		brake_onset_m: t.f64().optional(),
		brake_board_m: t.f64().optional(),
		peak_brake: t.f64().optional(),
		throttle_pickup_m: t.f64().optional(),
		release_s: t.f64().optional(),
		trail_brake_share: t.f64().optional(),
		lockup_s: t.f64().optional(),
		wheelspin_s: t.f64().optional(),
		min_kmh: t.f64().optional(),
		min_pos_m: t.f64().optional(),
		input_dropout: t.bool(),
		inputs: t.string().optional(),
		at: t.f64(),
		revision: t.u32()
	}),
	lapTrace: table({
		name: "lap_trace",
		public: true
	}, {
		lap_id: t.string().primaryKey(),
		rows: t.string(),
		revision: t.u32()
	}),
	decision: table({ public: true }, {
		decision_id: t.string().primaryKey(),
		lap_id: t.string(),
		label: t.string().optional(),
		action: t.string().optional(),
		drill_id: t.string().optional(),
		target: t.string().optional(),
		cue: t.string().optional(),
		verdict: t.string().optional(),
		mode: t.string().optional(),
		provider: t.string().optional(),
		model: t.string().optional(),
		latency_ms: t.f64().optional(),
		summary: t.string().optional(),
		at: t.f64(),
		revision: t.u32()
	}),
	coachOwner: table({ name: "coach_owner" }, {
		slot: t.u8().primaryKey(),
		identity: t.identity()
	})
});
function guard(ctx) {
	const owner = ctx.db.coachOwner.slot.find(0);
	if (!owner || !owner.identity.isEqual(ctx.sender)) throw new SenderError("coach only");
}
function uuid(id) {
	if (typeof id !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new SenderError("invalid UUID");
}
function decode(payload) {
	const obj = JSON.parse(payload, (_key, value) => value === null ? void 0 : value);
	if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new SenderError("expected row object");
	return obj;
}
function newer(old, row) {
	if (!Number.isInteger(row.revision) || row.revision < 1) throw new SenderError("invalid revision");
	return !old || row.revision > old.revision;
}
const register_coach = db.reducer((ctx) => {
	if (ctx.db.coachOwner.slot.find(0)) {
		guard(ctx);
		return;
	}
	ctx.db.coachOwner.insert({
		slot: 0,
		identity: ctx.sender
	});
});
const upsert_driver = db.reducer({ payload: t.string() }, (ctx, { payload }) => {
	guard(ctx);
	const row = decode(payload);
	uuid(row.driver_id);
	const old = ctx.db.driver.driver_id.find(row.driver_id);
	if (newer(old, row)) old ? ctx.db.driver.driver_id.update(row) : ctx.db.driver.insert(row);
});
function saveSession(ctx, payload) {
	guard(ctx);
	const row = decode(payload);
	uuid(row.session_id);
	if (!ctx.db.driver.driver_id.find(row.driver_id)) throw new SenderError("driver missing");
	const old = ctx.db.session.session_id.find(row.session_id);
	if (newer(old, row)) old ? ctx.db.session.session_id.update(row) : ctx.db.session.insert(row);
}
const start_session = db.reducer({ payload: t.string() }, (ctx, args) => saveSession(ctx, args.payload));
const end_session = db.reducer({ payload: t.string() }, (ctx, args) => saveSession(ctx, args.payload));
const set_plan = db.reducer({ payload: t.string() }, (ctx, args) => saveSession(ctx, args.payload));
const record_lap = db.reducer({ payload: t.string() }, (ctx, { payload }) => {
	guard(ctx);
	const { lap: row, trace } = decode(payload);
	uuid(row.lap_id);
	if (trace.lap_id !== row.lap_id) throw new SenderError("trace belongs to another lap");
	if (!Array.isArray(JSON.parse(trace.rows))) throw new SenderError("trace must be an array");
	if (!ctx.db.session.session_id.find(row.session_id)) throw new SenderError("session missing");
	if (row.valid && !(typeof row.section_s === "number" && Number.isFinite(row.section_s) && row.section_s > 0)) throw new SenderError("invalid section time");
	const old = ctx.db.lap.lap_id.find(row.lap_id);
	if (newer(old, row)) old ? ctx.db.lap.lap_id.update(row) : ctx.db.lap.insert(row);
	const oldTrace = ctx.db.lapTrace.lap_id.find(trace.lap_id);
	if (newer(oldTrace, trace)) oldTrace ? ctx.db.lapTrace.lap_id.update(trace) : ctx.db.lapTrace.insert(trace);
});
const record_decision = db.reducer({ payload: t.string() }, (ctx, { payload }) => {
	guard(ctx);
	const row = decode(payload);
	uuid(row.decision_id);
	if (!ctx.db.lap.lap_id.find(row.lap_id)) throw new SenderError("lap missing");
	const old = ctx.db.decision.decision_id.find(row.decision_id);
	if (newer(old, row)) old ? ctx.db.decision.decision_id.update(row) : ctx.db.decision.insert(row);
});

//#endregion
export { db as default, end_session, record_decision, record_lap, register_coach, set_plan, start_session, upsert_driver };
//# debugId=e1f6325f-71a2-4aae-a3f0-f1841914d9f4
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwibmFtZXMiOlsiX19jcmVhdGUiLCJfX2RlZlByb3AiLCJfX2dldE93blByb3BEZXNjIiwiX19nZXRPd25Qcm9wTmFtZXMiLCJfX2dldFByb3RvT2YiLCJfX2hhc093blByb3AiLCJfX2NvbW1vbkpTIiwiX19jb3B5UHJvcHMiLCJfX3RvRVNNIiwiI2Vuc3VyZSIsIiNtb2R1bGVEZWYiLCIjcmVnaXN0ZXJDb21wb3VuZFR5cGVSZWN1cnNpdmVseSIsIiNjb21wb3VuZFR5cGVzIiwiI2JvZHkiLCIjaW5uZXIiLCIjZnJvbSIsIiN0byIsIiNiYWNrZW5kIiwiI3NlbmRlckF1dGgiLCIjcmFuZG9tIiwiI3V1aWRDb3VudGVyIiwiI2lkZW50aXR5IiwiI3NjaGVtYSIsIiNjb25zdW1lclJlZHVjZXJDb3VudCIsIiNjb25zdW1lclByb2NlZHVyZUNvdW50IiwiI2NvbnN1bWVyQW5vblZpZXdDb3VudCIsIiNjb25zdW1lclZpZXdDb3VudCIsIiNmbGF0U3VibW9kdWxlcyIsIiNyZWR1Y2VyQXJnc0Rlc2VyaWFsaXplcnMiLCIjZGJWaWV3IiwiI2RiVmlld18iLCIjc3VibW9kdWxlQXNWaWV3c18iLCIjcmVkdWNlckN0eCIsIiNyZWR1Y2VyQ3R4XyIsIiNjb25zdW1lckFzIiwiI2NvbnN1bWVyQXNfIiwiI2dldFN1Ym1vZHVsZURiVmlldyIsIiNnZXRTdWJtb2R1bGVBc1ZpZXdzIiwiI2dldFN1Ym1vZHVsZVF1ZXJ5QnVpbGRlciIsIiNzZW5kZXJKd3QiLCIjZGlzcGF0Y2hlcyIsIiNhc1ZpZXdzIiwiI2ZpbmFsaXphdGlvblJlZ2lzdHJ5IiwiI2lkIiwiI2RldGFjaCIsIiNodHRwIiwiI3NsZWVwIiwiI2NoaWxkU2VlZFJhbmRvbSIsIiNwYXJlbnRQcmVmaXgiLCIjY3R4Il0sInNvdXJjZXMiOlsiQzovVXNlcnMvamlhbmcvQXBwRGF0YS9Mb2NhbC9UZW1wL25vbWFkc2ltLXJldmlldy9zcGFjZXRpbWUvbm9kZV9tb2R1bGVzL2hlYWRlcnMtcG9seWZpbGwvbGliL2luZGV4Lm1qcyIsIkM6L1VzZXJzL2ppYW5nL0FwcERhdGEvTG9jYWwvVGVtcC9ub21hZHNpbS1yZXZpZXcvc3BhY2V0aW1lL25vZGVfbW9kdWxlcy9zcGFjZXRpbWVkYi9kaXN0L3NlcnZlci9pbmRleC5tanMiLCJDOi9Vc2Vycy9qaWFuZy9BcHBEYXRhL0xvY2FsL1RlbXAvbm9tYWRzaW0tcmV2aWV3L3NwYWNldGltZS9zcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsidmFyIF9fY3JlYXRlID0gT2JqZWN0LmNyZWF0ZTtcbnZhciBfX2RlZlByb3AgPSBPYmplY3QuZGVmaW5lUHJvcGVydHk7XG52YXIgX19nZXRPd25Qcm9wRGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I7XG52YXIgX19nZXRPd25Qcm9wTmFtZXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcztcbnZhciBfX2dldFByb3RvT2YgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Y7XG52YXIgX19oYXNPd25Qcm9wID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBfX2NvbW1vbkpTID0gKGNiLCBtb2QpID0+IGZ1bmN0aW9uIF9fcmVxdWlyZSgpIHtcbiAgcmV0dXJuIG1vZCB8fCAoMCwgY2JbX19nZXRPd25Qcm9wTmFtZXMoY2IpWzBdXSkoKG1vZCA9IHsgZXhwb3J0czoge30gfSkuZXhwb3J0cywgbW9kKSwgbW9kLmV4cG9ydHM7XG59O1xudmFyIF9fY29weVByb3BzID0gKHRvLCBmcm9tLCBleGNlcHQsIGRlc2MpID0+IHtcbiAgaWYgKGZyb20gJiYgdHlwZW9mIGZyb20gPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIGZyb20gPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGZvciAobGV0IGtleSBvZiBfX2dldE93blByb3BOYW1lcyhmcm9tKSlcbiAgICAgIGlmICghX19oYXNPd25Qcm9wLmNhbGwodG8sIGtleSkgJiYga2V5ICE9PSBleGNlcHQpXG4gICAgICAgIF9fZGVmUHJvcCh0bywga2V5LCB7IGdldDogKCkgPT4gZnJvbVtrZXldLCBlbnVtZXJhYmxlOiAhKGRlc2MgPSBfX2dldE93blByb3BEZXNjKGZyb20sIGtleSkpIHx8IGRlc2MuZW51bWVyYWJsZSB9KTtcbiAgfVxuICByZXR1cm4gdG87XG59O1xudmFyIF9fdG9FU00gPSAobW9kLCBpc05vZGVNb2RlLCB0YXJnZXQpID0+ICh0YXJnZXQgPSBtb2QgIT0gbnVsbCA/IF9fY3JlYXRlKF9fZ2V0UHJvdG9PZihtb2QpKSA6IHt9LCBfX2NvcHlQcm9wcyhcbiAgLy8gSWYgdGhlIGltcG9ydGVyIGlzIGluIG5vZGUgY29tcGF0aWJpbGl0eSBtb2RlIG9yIHRoaXMgaXMgbm90IGFuIEVTTVxuICAvLyBmaWxlIHRoYXQgaGFzIGJlZW4gY29udmVydGVkIHRvIGEgQ29tbW9uSlMgZmlsZSB1c2luZyBhIEJhYmVsLVxuICAvLyBjb21wYXRpYmxlIHRyYW5zZm9ybSAoaS5lLiBcIl9fZXNNb2R1bGVcIiBoYXMgbm90IGJlZW4gc2V0KSwgdGhlbiBzZXRcbiAgLy8gXCJkZWZhdWx0XCIgdG8gdGhlIENvbW1vbkpTIFwibW9kdWxlLmV4cG9ydHNcIiBmb3Igbm9kZSBjb21wYXRpYmlsaXR5LlxuICBpc05vZGVNb2RlIHx8ICFtb2QgfHwgIW1vZC5fX2VzTW9kdWxlID8gX19kZWZQcm9wKHRhcmdldCwgXCJkZWZhdWx0XCIsIHsgdmFsdWU6IG1vZCwgZW51bWVyYWJsZTogdHJ1ZSB9KSA6IHRhcmdldCxcbiAgbW9kXG4pKTtcblxuLy8gbm9kZV9tb2R1bGVzL3NldC1jb29raWUtcGFyc2VyL2xpYi9zZXQtY29va2llLmpzXG52YXIgcmVxdWlyZV9zZXRfY29va2llID0gX19jb21tb25KUyh7XG4gIFwibm9kZV9tb2R1bGVzL3NldC1jb29raWUtcGFyc2VyL2xpYi9zZXQtY29va2llLmpzXCIoZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIGRlZmF1bHRQYXJzZU9wdGlvbnMgPSB7XG4gICAgICBkZWNvZGVWYWx1ZXM6IHRydWUsXG4gICAgICBtYXA6IGZhbHNlLFxuICAgICAgc2lsZW50OiBmYWxzZVxuICAgIH07XG4gICAgZnVuY3Rpb24gaXNOb25FbXB0eVN0cmluZyhzdHIpIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygc3RyID09PSBcInN0cmluZ1wiICYmICEhc3RyLnRyaW0oKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gcGFyc2VTdHJpbmcoc2V0Q29va2llVmFsdWUsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBwYXJ0cyA9IHNldENvb2tpZVZhbHVlLnNwbGl0KFwiO1wiKS5maWx0ZXIoaXNOb25FbXB0eVN0cmluZyk7XG4gICAgICB2YXIgbmFtZVZhbHVlUGFpclN0ciA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICB2YXIgcGFyc2VkID0gcGFyc2VOYW1lVmFsdWVQYWlyKG5hbWVWYWx1ZVBhaXJTdHIpO1xuICAgICAgdmFyIG5hbWUgPSBwYXJzZWQubmFtZTtcbiAgICAgIHZhciB2YWx1ZSA9IHBhcnNlZC52YWx1ZTtcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdFBhcnNlT3B0aW9ucywgb3B0aW9ucykgOiBkZWZhdWx0UGFyc2VPcHRpb25zO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFsdWUgPSBvcHRpb25zLmRlY29kZVZhbHVlcyA/IGRlY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcInNldC1jb29raWUtcGFyc2VyIGVuY291bnRlcmVkIGFuIGVycm9yIHdoaWxlIGRlY29kaW5nIGEgY29va2llIHdpdGggdmFsdWUgJ1wiICsgdmFsdWUgKyBcIicuIFNldCBvcHRpb25zLmRlY29kZVZhbHVlcyB0byBmYWxzZSB0byBkaXNhYmxlIHRoaXMgZmVhdHVyZS5cIixcbiAgICAgICAgICBlXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB2YXIgY29va2llID0ge1xuICAgICAgICBuYW1lLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHBhcnRzLmZvckVhY2goZnVuY3Rpb24ocGFydCkge1xuICAgICAgICB2YXIgc2lkZXMgPSBwYXJ0LnNwbGl0KFwiPVwiKTtcbiAgICAgICAgdmFyIGtleSA9IHNpZGVzLnNoaWZ0KCkudHJpbUxlZnQoKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB2YXIgdmFsdWUyID0gc2lkZXMuam9pbihcIj1cIik7XG4gICAgICAgIGlmIChrZXkgPT09IFwiZXhwaXJlc1wiKSB7XG4gICAgICAgICAgY29va2llLmV4cGlyZXMgPSBuZXcgRGF0ZSh2YWx1ZTIpO1xuICAgICAgICB9IGVsc2UgaWYgKGtleSA9PT0gXCJtYXgtYWdlXCIpIHtcbiAgICAgICAgICBjb29raWUubWF4QWdlID0gcGFyc2VJbnQodmFsdWUyLCAxMCk7XG4gICAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBcInNlY3VyZVwiKSB7XG4gICAgICAgICAgY29va2llLnNlY3VyZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBcImh0dHBvbmx5XCIpIHtcbiAgICAgICAgICBjb29raWUuaHR0cE9ubHkgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKGtleSA9PT0gXCJzYW1lc2l0ZVwiKSB7XG4gICAgICAgICAgY29va2llLnNhbWVTaXRlID0gdmFsdWUyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvb2tpZVtrZXldID0gdmFsdWUyO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBjb29raWU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBhcnNlTmFtZVZhbHVlUGFpcihuYW1lVmFsdWVQYWlyU3RyKSB7XG4gICAgICB2YXIgbmFtZSA9IFwiXCI7XG4gICAgICB2YXIgdmFsdWUgPSBcIlwiO1xuICAgICAgdmFyIG5hbWVWYWx1ZUFyciA9IG5hbWVWYWx1ZVBhaXJTdHIuc3BsaXQoXCI9XCIpO1xuICAgICAgaWYgKG5hbWVWYWx1ZUFyci5sZW5ndGggPiAxKSB7XG4gICAgICAgIG5hbWUgPSBuYW1lVmFsdWVBcnIuc2hpZnQoKTtcbiAgICAgICAgdmFsdWUgPSBuYW1lVmFsdWVBcnIuam9pbihcIj1cIik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSA9IG5hbWVWYWx1ZVBhaXJTdHI7XG4gICAgICB9XG4gICAgICByZXR1cm4geyBuYW1lLCB2YWx1ZSB9O1xuICAgIH1cbiAgICBmdW5jdGlvbiBwYXJzZShpbnB1dCwgb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0UGFyc2VPcHRpb25zLCBvcHRpb25zKSA6IGRlZmF1bHRQYXJzZU9wdGlvbnM7XG4gICAgICBpZiAoIWlucHV0KSB7XG4gICAgICAgIGlmICghb3B0aW9ucy5tYXApIHtcbiAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaW5wdXQuaGVhZGVycykge1xuICAgICAgICBpZiAodHlwZW9mIGlucHV0LmhlYWRlcnMuZ2V0U2V0Q29va2llID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICBpbnB1dCA9IGlucHV0LmhlYWRlcnMuZ2V0U2V0Q29va2llKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXQuaGVhZGVyc1tcInNldC1jb29raWVcIl0pIHtcbiAgICAgICAgICBpbnB1dCA9IGlucHV0LmhlYWRlcnNbXCJzZXQtY29va2llXCJdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBzY2ggPSBpbnB1dC5oZWFkZXJzW09iamVjdC5rZXlzKGlucHV0LmhlYWRlcnMpLmZpbmQoZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4ga2V5LnRvTG93ZXJDYXNlKCkgPT09IFwic2V0LWNvb2tpZVwiO1xuICAgICAgICAgIH0pXTtcbiAgICAgICAgICBpZiAoIXNjaCAmJiBpbnB1dC5oZWFkZXJzLmNvb2tpZSAmJiAhb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgICAgXCJXYXJuaW5nOiBzZXQtY29va2llLXBhcnNlciBhcHBlYXJzIHRvIGhhdmUgYmVlbiBjYWxsZWQgb24gYSByZXF1ZXN0IG9iamVjdC4gSXQgaXMgZGVzaWduZWQgdG8gcGFyc2UgU2V0LUNvb2tpZSBoZWFkZXJzIGZyb20gcmVzcG9uc2VzLCBub3QgQ29va2llIGhlYWRlcnMgZnJvbSByZXF1ZXN0cy4gU2V0IHRoZSBvcHRpb24ge3NpbGVudDogdHJ1ZX0gdG8gc3VwcHJlc3MgdGhpcyB3YXJuaW5nLlwiXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpbnB1dCA9IHNjaDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGlucHV0KSkge1xuICAgICAgICBpbnB1dCA9IFtpbnB1dF07XG4gICAgICB9XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRQYXJzZU9wdGlvbnMsIG9wdGlvbnMpIDogZGVmYXVsdFBhcnNlT3B0aW9ucztcbiAgICAgIGlmICghb3B0aW9ucy5tYXApIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LmZpbHRlcihpc05vbkVtcHR5U3RyaW5nKS5tYXAoZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgICAgcmV0dXJuIHBhcnNlU3RyaW5nKHN0ciwgb3B0aW9ucyk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGNvb2tpZXMgPSB7fTtcbiAgICAgICAgcmV0dXJuIGlucHV0LmZpbHRlcihpc05vbkVtcHR5U3RyaW5nKS5yZWR1Y2UoZnVuY3Rpb24oY29va2llczIsIHN0cikge1xuICAgICAgICAgIHZhciBjb29raWUgPSBwYXJzZVN0cmluZyhzdHIsIG9wdGlvbnMpO1xuICAgICAgICAgIGNvb2tpZXMyW2Nvb2tpZS5uYW1lXSA9IGNvb2tpZTtcbiAgICAgICAgICByZXR1cm4gY29va2llczI7XG4gICAgICAgIH0sIGNvb2tpZXMpO1xuICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBzcGxpdENvb2tpZXNTdHJpbmcyKGNvb2tpZXNTdHJpbmcpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvb2tpZXNTdHJpbmcpKSB7XG4gICAgICAgIHJldHVybiBjb29raWVzU3RyaW5nO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBjb29raWVzU3RyaW5nICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cbiAgICAgIHZhciBjb29raWVzU3RyaW5ncyA9IFtdO1xuICAgICAgdmFyIHBvcyA9IDA7XG4gICAgICB2YXIgc3RhcnQ7XG4gICAgICB2YXIgY2g7XG4gICAgICB2YXIgbGFzdENvbW1hO1xuICAgICAgdmFyIG5leHRTdGFydDtcbiAgICAgIHZhciBjb29raWVzU2VwYXJhdG9yRm91bmQ7XG4gICAgICBmdW5jdGlvbiBza2lwV2hpdGVzcGFjZSgpIHtcbiAgICAgICAgd2hpbGUgKHBvcyA8IGNvb2tpZXNTdHJpbmcubGVuZ3RoICYmIC9cXHMvLnRlc3QoY29va2llc1N0cmluZy5jaGFyQXQocG9zKSkpIHtcbiAgICAgICAgICBwb3MgKz0gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG9zIDwgY29va2llc1N0cmluZy5sZW5ndGg7XG4gICAgICB9XG4gICAgICBmdW5jdGlvbiBub3RTcGVjaWFsQ2hhcigpIHtcbiAgICAgICAgY2ggPSBjb29raWVzU3RyaW5nLmNoYXJBdChwb3MpO1xuICAgICAgICByZXR1cm4gY2ggIT09IFwiPVwiICYmIGNoICE9PSBcIjtcIiAmJiBjaCAhPT0gXCIsXCI7XG4gICAgICB9XG4gICAgICB3aGlsZSAocG9zIDwgY29va2llc1N0cmluZy5sZW5ndGgpIHtcbiAgICAgICAgc3RhcnQgPSBwb3M7XG4gICAgICAgIGNvb2tpZXNTZXBhcmF0b3JGb3VuZCA9IGZhbHNlO1xuICAgICAgICB3aGlsZSAoc2tpcFdoaXRlc3BhY2UoKSkge1xuICAgICAgICAgIGNoID0gY29va2llc1N0cmluZy5jaGFyQXQocG9zKTtcbiAgICAgICAgICBpZiAoY2ggPT09IFwiLFwiKSB7XG4gICAgICAgICAgICBsYXN0Q29tbWEgPSBwb3M7XG4gICAgICAgICAgICBwb3MgKz0gMTtcbiAgICAgICAgICAgIHNraXBXaGl0ZXNwYWNlKCk7XG4gICAgICAgICAgICBuZXh0U3RhcnQgPSBwb3M7XG4gICAgICAgICAgICB3aGlsZSAocG9zIDwgY29va2llc1N0cmluZy5sZW5ndGggJiYgbm90U3BlY2lhbENoYXIoKSkge1xuICAgICAgICAgICAgICBwb3MgKz0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwb3MgPCBjb29raWVzU3RyaW5nLmxlbmd0aCAmJiBjb29raWVzU3RyaW5nLmNoYXJBdChwb3MpID09PSBcIj1cIikge1xuICAgICAgICAgICAgICBjb29raWVzU2VwYXJhdG9yRm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgICBwb3MgPSBuZXh0U3RhcnQ7XG4gICAgICAgICAgICAgIGNvb2tpZXNTdHJpbmdzLnB1c2goY29va2llc1N0cmluZy5zdWJzdHJpbmcoc3RhcnQsIGxhc3RDb21tYSkpO1xuICAgICAgICAgICAgICBzdGFydCA9IHBvcztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBvcyA9IGxhc3RDb21tYSArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvcyArPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNvb2tpZXNTZXBhcmF0b3JGb3VuZCB8fCBwb3MgPj0gY29va2llc1N0cmluZy5sZW5ndGgpIHtcbiAgICAgICAgICBjb29raWVzU3RyaW5ncy5wdXNoKGNvb2tpZXNTdHJpbmcuc3Vic3RyaW5nKHN0YXJ0LCBjb29raWVzU3RyaW5nLmxlbmd0aCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gY29va2llc1N0cmluZ3M7XG4gICAgfVxuICAgIG1vZHVsZS5leHBvcnRzID0gcGFyc2U7XG4gICAgbW9kdWxlLmV4cG9ydHMucGFyc2UgPSBwYXJzZTtcbiAgICBtb2R1bGUuZXhwb3J0cy5wYXJzZVN0cmluZyA9IHBhcnNlU3RyaW5nO1xuICAgIG1vZHVsZS5leHBvcnRzLnNwbGl0Q29va2llc1N0cmluZyA9IHNwbGl0Q29va2llc1N0cmluZzI7XG4gIH1cbn0pO1xuXG4vLyBzcmMvSGVhZGVycy50c1xudmFyIGltcG9ydF9zZXRfY29va2llX3BhcnNlciA9IF9fdG9FU00ocmVxdWlyZV9zZXRfY29va2llKCkpO1xuXG4vLyBzcmMvdXRpbHMvbm9ybWFsaXplSGVhZGVyTmFtZS50c1xudmFyIEhFQURFUlNfSU5WQUxJRF9DSEFSQUNURVJTID0gL1teYS16MC05XFwtIyQlJicqKy5eX2B8fl0vaTtcbmZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlck5hbWUobmFtZSkge1xuICBpZiAoSEVBREVSU19JTlZBTElEX0NIQVJBQ1RFUlMudGVzdChuYW1lKSB8fCBuYW1lLnRyaW0oKSA9PT0gXCJcIikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGNoYXJhY3RlciBpbiBoZWFkZXIgZmllbGQgbmFtZVwiKTtcbiAgfVxuICByZXR1cm4gbmFtZS50cmltKCkudG9Mb3dlckNhc2UoKTtcbn1cblxuLy8gc3JjL3V0aWxzL25vcm1hbGl6ZUhlYWRlclZhbHVlLnRzXG52YXIgY2hhckNvZGVzVG9SZW1vdmUgPSBbXG4gIFN0cmluZy5mcm9tQ2hhckNvZGUoMTApLFxuICBTdHJpbmcuZnJvbUNoYXJDb2RlKDEzKSxcbiAgU3RyaW5nLmZyb21DaGFyQ29kZSg5KSxcbiAgU3RyaW5nLmZyb21DaGFyQ29kZSgzMilcbl07XG52YXIgSEVBREVSX1ZBTFVFX1JFTU9WRV9SRUdFWFAgPSBuZXcgUmVnRXhwKFxuICBgKF5bJHtjaGFyQ29kZXNUb1JlbW92ZS5qb2luKFwiXCIpfV18JFske2NoYXJDb2Rlc1RvUmVtb3ZlLmpvaW4oXCJcIil9XSlgLFxuICBcImdcIlxuKTtcbmZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlclZhbHVlKHZhbHVlKSB7XG4gIGNvbnN0IG5leHRWYWx1ZSA9IHZhbHVlLnJlcGxhY2UoSEVBREVSX1ZBTFVFX1JFTU9WRV9SRUdFWFAsIFwiXCIpO1xuICByZXR1cm4gbmV4dFZhbHVlO1xufVxuXG4vLyBzcmMvdXRpbHMvaXNWYWxpZEhlYWRlck5hbWUudHNcbmZ1bmN0aW9uIGlzVmFsaWRIZWFkZXJOYW1lKHZhbHVlKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hhcmFjdGVyID0gdmFsdWUuY2hhckNvZGVBdChpKTtcbiAgICBpZiAoY2hhcmFjdGVyID4gMTI3IHx8ICFpc1Rva2VuKGNoYXJhY3RlcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5mdW5jdGlvbiBpc1Rva2VuKHZhbHVlKSB7XG4gIHJldHVybiAhW1xuICAgIDEyNyxcbiAgICAzMixcbiAgICBcIihcIixcbiAgICBcIilcIixcbiAgICBcIjxcIixcbiAgICBcIj5cIixcbiAgICBcIkBcIixcbiAgICBcIixcIixcbiAgICBcIjtcIixcbiAgICBcIjpcIixcbiAgICBcIlxcXFxcIixcbiAgICAnXCInLFxuICAgIFwiL1wiLFxuICAgIFwiW1wiLFxuICAgIFwiXVwiLFxuICAgIFwiP1wiLFxuICAgIFwiPVwiLFxuICAgIFwie1wiLFxuICAgIFwifVwiXG4gIF0uaW5jbHVkZXModmFsdWUpO1xufVxuXG4vLyBzcmMvdXRpbHMvaXNWYWxpZEhlYWRlclZhbHVlLnRzXG5mdW5jdGlvbiBpc1ZhbGlkSGVhZGVyVmFsdWUodmFsdWUpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAodmFsdWUudHJpbSgpICE9PSB2YWx1ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hhcmFjdGVyID0gdmFsdWUuY2hhckNvZGVBdChpKTtcbiAgICBpZiAoXG4gICAgICAvLyBOVUwuXG4gICAgICBjaGFyYWN0ZXIgPT09IDAgfHwgLy8gSFRUUCBuZXdsaW5lIGJ5dGVzLlxuICAgICAgY2hhcmFjdGVyID09PSAxMCB8fCBjaGFyYWN0ZXIgPT09IDEzXG4gICAgKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vLyBzcmMvSGVhZGVycy50c1xudmFyIE5PUk1BTElaRURfSEVBREVSUyA9IFN5bWJvbChcIm5vcm1hbGl6ZWRIZWFkZXJzXCIpO1xudmFyIFJBV19IRUFERVJfTkFNRVMgPSBTeW1ib2woXCJyYXdIZWFkZXJOYW1lc1wiKTtcbnZhciBIRUFERVJfVkFMVUVfREVMSU1JVEVSID0gXCIsIFwiO1xudmFyIF9hLCBfYiwgX2M7XG52YXIgSGVhZGVycyA9IGNsYXNzIF9IZWFkZXJzIHtcbiAgY29uc3RydWN0b3IoaW5pdCkge1xuICAgIC8vIE5vcm1hbGl6ZWQgaGVhZGVyIHtcIm5hbWVcIjpcImEsIGJcIn0gc3RvcmFnZS5cbiAgICB0aGlzW19hXSA9IHt9O1xuICAgIC8vIEtlZXBzIHRoZSBtYXBwaW5nIGJldHdlZW4gdGhlIHJhdyBoZWFkZXIgbmFtZVxuICAgIC8vIGFuZCB0aGUgbm9ybWFsaXplZCBoZWFkZXIgbmFtZSB0byBlYXNlIHRoZSBsb29rdXAuXG4gICAgdGhpc1tfYl0gPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICAgIHRoaXNbX2NdID0gXCJIZWFkZXJzXCI7XG4gICAgaWYgKFtcIkhlYWRlcnNcIiwgXCJIZWFkZXJzUG9seWZpbGxcIl0uaW5jbHVkZXMoaW5pdD8uY29uc3RydWN0b3IubmFtZSkgfHwgaW5pdCBpbnN0YW5jZW9mIF9IZWFkZXJzIHx8IHR5cGVvZiBnbG9iYWxUaGlzLkhlYWRlcnMgIT09IFwidW5kZWZpbmVkXCIgJiYgaW5pdCBpbnN0YW5jZW9mIGdsb2JhbFRoaXMuSGVhZGVycykge1xuICAgICAgY29uc3QgaW5pdGlhbEhlYWRlcnMgPSBpbml0O1xuICAgICAgaW5pdGlhbEhlYWRlcnMuZm9yRWFjaCgodmFsdWUsIG5hbWUpID0+IHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgdmFsdWUpO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGluaXQpKSB7XG4gICAgICBpbml0LmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+IHtcbiAgICAgICAgdGhpcy5hcHBlbmQoXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlLmpvaW4oSEVBREVSX1ZBTFVFX0RFTElNSVRFUikgOiB2YWx1ZVxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChpbml0KSB7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhpbml0KS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5pdFtuYW1lXTtcbiAgICAgICAgdGhpcy5hcHBlbmQoXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlLmpvaW4oSEVBREVSX1ZBTFVFX0RFTElNSVRFUikgOiB2YWx1ZVxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIFsoX2EgPSBOT1JNQUxJWkVEX0hFQURFUlMsIF9iID0gUkFXX0hFQURFUl9OQU1FUywgX2MgPSBTeW1ib2wudG9TdHJpbmdUYWcsIFN5bWJvbC5pdGVyYXRvcildKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXMoKTtcbiAgfVxuICAqa2V5cygpIHtcbiAgICBmb3IgKGNvbnN0IFtuYW1lXSBvZiB0aGlzLmVudHJpZXMoKSkge1xuICAgICAgeWllbGQgbmFtZTtcbiAgICB9XG4gIH1cbiAgKnZhbHVlcygpIHtcbiAgICBmb3IgKGNvbnN0IFssIHZhbHVlXSBvZiB0aGlzLmVudHJpZXMoKSkge1xuICAgICAgeWllbGQgdmFsdWU7XG4gICAgfVxuICB9XG4gICplbnRyaWVzKCkge1xuICAgIGxldCBzb3J0ZWRLZXlzID0gT2JqZWN0LmtleXModGhpc1tOT1JNQUxJWkVEX0hFQURFUlNdKS5zb3J0KFxuICAgICAgKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKVxuICAgICk7XG4gICAgZm9yIChjb25zdCBuYW1lIG9mIHNvcnRlZEtleXMpIHtcbiAgICAgIGlmIChuYW1lID09PSBcInNldC1jb29raWVcIikge1xuICAgICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMuZ2V0U2V0Q29va2llKCkpIHtcbiAgICAgICAgICB5aWVsZCBbbmFtZSwgdmFsdWVdO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB5aWVsZCBbbmFtZSwgdGhpcy5nZXQobmFtZSldO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvKipcbiAgICogUmV0dXJucyBhIGJvb2xlYW4gc3RhdGluZyB3aGV0aGVyIGEgYEhlYWRlcnNgIG9iamVjdCBjb250YWlucyBhIGNlcnRhaW4gaGVhZGVyLlxuICAgKi9cbiAgaGFzKG5hbWUpIHtcbiAgICBpZiAoIWlzVmFsaWRIZWFkZXJOYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnZhbGlkIGhlYWRlciBuYW1lIFwiJHtuYW1lfVwiYCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzW05PUk1BTElaRURfSEVBREVSU10uaGFzT3duUHJvcGVydHkobm9ybWFsaXplSGVhZGVyTmFtZShuYW1lKSk7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybnMgYSBgQnl0ZVN0cmluZ2Agc2VxdWVuY2Ugb2YgYWxsIHRoZSB2YWx1ZXMgb2YgYSBoZWFkZXIgd2l0aCBhIGdpdmVuIG5hbWUuXG4gICAqL1xuICBnZXQobmFtZSkge1xuICAgIGlmICghaXNWYWxpZEhlYWRlck5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IFR5cGVFcnJvcihgSW52YWxpZCBoZWFkZXIgbmFtZSBcIiR7bmFtZX1cImApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpc1tOT1JNQUxJWkVEX0hFQURFUlNdW25vcm1hbGl6ZUhlYWRlck5hbWUobmFtZSldID8/IG51bGw7XG4gIH1cbiAgLyoqXG4gICAqIFNldHMgYSBuZXcgdmFsdWUgZm9yIGFuIGV4aXN0aW5nIGhlYWRlciBpbnNpZGUgYSBgSGVhZGVyc2Agb2JqZWN0LCBvciBhZGRzIHRoZSBoZWFkZXIgaWYgaXQgZG9lcyBub3QgYWxyZWFkeSBleGlzdC5cbiAgICovXG4gIHNldChuYW1lLCB2YWx1ZSkge1xuICAgIGlmICghaXNWYWxpZEhlYWRlck5hbWUobmFtZSkgfHwgIWlzVmFsaWRIZWFkZXJWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgbm9ybWFsaXplZE5hbWUgPSBub3JtYWxpemVIZWFkZXJOYW1lKG5hbWUpO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRWYWx1ZSA9IG5vcm1hbGl6ZUhlYWRlclZhbHVlKHZhbHVlKTtcbiAgICB0aGlzW05PUk1BTElaRURfSEVBREVSU11bbm9ybWFsaXplZE5hbWVdID0gbm9ybWFsaXplSGVhZGVyVmFsdWUobm9ybWFsaXplZFZhbHVlKTtcbiAgICB0aGlzW1JBV19IRUFERVJfTkFNRVNdLnNldChub3JtYWxpemVkTmFtZSwgbmFtZSk7XG4gIH1cbiAgLyoqXG4gICAqIEFwcGVuZHMgYSBuZXcgdmFsdWUgb250byBhbiBleGlzdGluZyBoZWFkZXIgaW5zaWRlIGEgYEhlYWRlcnNgIG9iamVjdCwgb3IgYWRkcyB0aGUgaGVhZGVyIGlmIGl0IGRvZXMgbm90IGFscmVhZHkgZXhpc3QuXG4gICAqL1xuICBhcHBlbmQobmFtZSwgdmFsdWUpIHtcbiAgICBpZiAoIWlzVmFsaWRIZWFkZXJOYW1lKG5hbWUpIHx8ICFpc1ZhbGlkSGVhZGVyVmFsdWUodmFsdWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gbm9ybWFsaXplSGVhZGVyTmFtZShuYW1lKTtcbiAgICBjb25zdCBub3JtYWxpemVkVmFsdWUgPSBub3JtYWxpemVIZWFkZXJWYWx1ZSh2YWx1ZSk7XG4gICAgbGV0IHJlc29sdmVkVmFsdWUgPSB0aGlzLmhhcyhub3JtYWxpemVkTmFtZSkgPyBgJHt0aGlzLmdldChub3JtYWxpemVkTmFtZSl9LCAke25vcm1hbGl6ZWRWYWx1ZX1gIDogbm9ybWFsaXplZFZhbHVlO1xuICAgIHRoaXMuc2V0KG5hbWUsIHJlc29sdmVkVmFsdWUpO1xuICB9XG4gIC8qKlxuICAgKiBEZWxldGVzIGEgaGVhZGVyIGZyb20gdGhlIGBIZWFkZXJzYCBvYmplY3QuXG4gICAqL1xuICBkZWxldGUobmFtZSkge1xuICAgIGlmICghaXNWYWxpZEhlYWRlck5hbWUobmFtZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmhhcyhuYW1lKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBub3JtYWxpemVkTmFtZSA9IG5vcm1hbGl6ZUhlYWRlck5hbWUobmFtZSk7XG4gICAgZGVsZXRlIHRoaXNbTk9STUFMSVpFRF9IRUFERVJTXVtub3JtYWxpemVkTmFtZV07XG4gICAgdGhpc1tSQVdfSEVBREVSX05BTUVTXS5kZWxldGUobm9ybWFsaXplZE5hbWUpO1xuICB9XG4gIC8qKlxuICAgKiBUcmF2ZXJzZXMgdGhlIGBIZWFkZXJzYCBvYmplY3QsXG4gICAqIGNhbGxpbmcgdGhlIGdpdmVuIGNhbGxiYWNrIGZvciBlYWNoIGhlYWRlci5cbiAgICovXG4gIGZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2YgdGhpcy5lbnRyaWVzKCkpIHtcbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdmFsdWUsIG5hbWUsIHRoaXMpO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogUmV0dXJucyBhbiBhcnJheSBjb250YWluaW5nIHRoZSB2YWx1ZXNcbiAgICogb2YgYWxsIFNldC1Db29raWUgaGVhZGVycyBhc3NvY2lhdGVkXG4gICAqIHdpdGggYSByZXNwb25zZVxuICAgKi9cbiAgZ2V0U2V0Q29va2llKCkge1xuICAgIGNvbnN0IHNldENvb2tpZUhlYWRlciA9IHRoaXMuZ2V0KFwic2V0LWNvb2tpZVwiKTtcbiAgICBpZiAoc2V0Q29va2llSGVhZGVyID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIGlmIChzZXRDb29raWVIZWFkZXIgPT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBbXCJcIl07XG4gICAgfVxuICAgIHJldHVybiAoMCwgaW1wb3J0X3NldF9jb29raWVfcGFyc2VyLnNwbGl0Q29va2llc1N0cmluZykoc2V0Q29va2llSGVhZGVyKTtcbiAgfVxufTtcblxuLy8gc3JjL2dldFJhd0hlYWRlcnMudHNcbmZ1bmN0aW9uIGdldFJhd0hlYWRlcnMoaGVhZGVycykge1xuICBjb25zdCByYXdIZWFkZXJzID0ge307XG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBoZWFkZXJzLmVudHJpZXMoKSkge1xuICAgIHJhd0hlYWRlcnNbaGVhZGVyc1tSQVdfSEVBREVSX05BTUVTXS5nZXQobmFtZSldID0gdmFsdWU7XG4gIH1cbiAgcmV0dXJuIHJhd0hlYWRlcnM7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvaGVhZGVyc1RvTGlzdC50c1xuZnVuY3Rpb24gaGVhZGVyc1RvTGlzdChoZWFkZXJzKSB7XG4gIGNvbnN0IGhlYWRlcnNMaXN0ID0gW107XG4gIGhlYWRlcnMuZm9yRWFjaCgodmFsdWUsIG5hbWUpID0+IHtcbiAgICBjb25zdCByZXNvbHZlZFZhbHVlID0gdmFsdWUuaW5jbHVkZXMoXCIsXCIpID8gdmFsdWUuc3BsaXQoXCIsXCIpLm1hcCgodmFsdWUyKSA9PiB2YWx1ZTIudHJpbSgpKSA6IHZhbHVlO1xuICAgIGhlYWRlcnNMaXN0LnB1c2goW25hbWUsIHJlc29sdmVkVmFsdWVdKTtcbiAgfSk7XG4gIHJldHVybiBoZWFkZXJzTGlzdDtcbn1cblxuLy8gc3JjL3RyYW5zZm9ybWVycy9oZWFkZXJzVG9TdHJpbmcudHNcbmZ1bmN0aW9uIGhlYWRlcnNUb1N0cmluZyhoZWFkZXJzKSB7XG4gIGNvbnN0IGxpc3QgPSBoZWFkZXJzVG9MaXN0KGhlYWRlcnMpO1xuICBjb25zdCBsaW5lcyA9IGxpc3QubWFwKChbbmFtZSwgdmFsdWVdKSA9PiB7XG4gICAgY29uc3QgdmFsdWVzID0gW10uY29uY2F0KHZhbHVlKTtcbiAgICByZXR1cm4gYCR7bmFtZX06ICR7dmFsdWVzLmpvaW4oXCIsIFwiKX1gO1xuICB9KTtcbiAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXHJcXG5cIik7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvaGVhZGVyc1RvT2JqZWN0LnRzXG52YXIgc2luZ2xlVmFsdWVIZWFkZXJzID0gW1widXNlci1hZ2VudFwiXTtcbmZ1bmN0aW9uIGhlYWRlcnNUb09iamVjdChoZWFkZXJzKSB7XG4gIGNvbnN0IGhlYWRlcnNPYmplY3QgPSB7fTtcbiAgaGVhZGVycy5mb3JFYWNoKCh2YWx1ZSwgbmFtZSkgPT4ge1xuICAgIGNvbnN0IGlzTXVsdGlWYWx1ZSA9ICFzaW5nbGVWYWx1ZUhlYWRlcnMuaW5jbHVkZXMobmFtZS50b0xvd2VyQ2FzZSgpKSAmJiB2YWx1ZS5pbmNsdWRlcyhcIixcIik7XG4gICAgaGVhZGVyc09iamVjdFtuYW1lXSA9IGlzTXVsdGlWYWx1ZSA/IHZhbHVlLnNwbGl0KFwiLFwiKS5tYXAoKHMpID0+IHMudHJpbSgpKSA6IHZhbHVlO1xuICB9KTtcbiAgcmV0dXJuIGhlYWRlcnNPYmplY3Q7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvc3RyaW5nVG9IZWFkZXJzLnRzXG5mdW5jdGlvbiBzdHJpbmdUb0hlYWRlcnMoc3RyKSB7XG4gIGNvbnN0IGxpbmVzID0gc3RyLnRyaW0oKS5zcGxpdCgvW1xcclxcbl0rLyk7XG4gIHJldHVybiBsaW5lcy5yZWR1Y2UoKGhlYWRlcnMsIGxpbmUpID0+IHtcbiAgICBpZiAobGluZS50cmltKCkgPT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgIH1cbiAgICBjb25zdCBwYXJ0cyA9IGxpbmUuc3BsaXQoXCI6IFwiKTtcbiAgICBjb25zdCBuYW1lID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCB2YWx1ZSA9IHBhcnRzLmpvaW4oXCI6IFwiKTtcbiAgICBoZWFkZXJzLmFwcGVuZChuYW1lLCB2YWx1ZSk7XG4gICAgcmV0dXJuIGhlYWRlcnM7XG4gIH0sIG5ldyBIZWFkZXJzKCkpO1xufVxuXG4vLyBzcmMvdHJhbnNmb3JtZXJzL2xpc3RUb0hlYWRlcnMudHNcbmZ1bmN0aW9uIGxpc3RUb0hlYWRlcnMobGlzdCkge1xuICBjb25zdCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgbGlzdC5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PiB7XG4gICAgY29uc3QgdmFsdWVzID0gW10uY29uY2F0KHZhbHVlKTtcbiAgICB2YWx1ZXMuZm9yRWFjaCgodmFsdWUyKSA9PiB7XG4gICAgICBoZWFkZXJzLmFwcGVuZChuYW1lLCB2YWx1ZTIpO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIGhlYWRlcnM7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvcmVkdWNlSGVhZGVyc09iamVjdC50c1xuZnVuY3Rpb24gcmVkdWNlSGVhZGVyc09iamVjdChoZWFkZXJzLCByZWR1Y2VyLCBpbml0aWFsU3RhdGUpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKGhlYWRlcnMpLnJlZHVjZSgobmV4dEhlYWRlcnMsIG5hbWUpID0+IHtcbiAgICByZXR1cm4gcmVkdWNlcihuZXh0SGVhZGVycywgbmFtZSwgaGVhZGVyc1tuYW1lXSk7XG4gIH0sIGluaXRpYWxTdGF0ZSk7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvb2JqZWN0VG9IZWFkZXJzLnRzXG5mdW5jdGlvbiBvYmplY3RUb0hlYWRlcnMoaGVhZGVyc09iamVjdCkge1xuICByZXR1cm4gcmVkdWNlSGVhZGVyc09iamVjdChcbiAgICBoZWFkZXJzT2JqZWN0LFxuICAgIChoZWFkZXJzLCBuYW1lLCB2YWx1ZSkgPT4ge1xuICAgICAgY29uc3QgdmFsdWVzID0gW10uY29uY2F0KHZhbHVlKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICB2YWx1ZXMuZm9yRWFjaCgodmFsdWUyKSA9PiB7XG4gICAgICAgIGhlYWRlcnMuYXBwZW5kKG5hbWUsIHZhbHVlMik7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgIH0sXG4gICAgbmV3IEhlYWRlcnMoKVxuICApO1xufVxuXG4vLyBzcmMvdHJhbnNmb3JtZXJzL2ZsYXR0ZW5IZWFkZXJzTGlzdC50c1xuZnVuY3Rpb24gZmxhdHRlbkhlYWRlcnNMaXN0KGxpc3QpIHtcbiAgcmV0dXJuIGxpc3QubWFwKChbbmFtZSwgdmFsdWVzXSkgPT4ge1xuICAgIHJldHVybiBbbmFtZSwgW10uY29uY2F0KHZhbHVlcykuam9pbihcIiwgXCIpXTtcbiAgfSk7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvZmxhdHRlbkhlYWRlcnNPYmplY3QudHNcbmZ1bmN0aW9uIGZsYXR0ZW5IZWFkZXJzT2JqZWN0KGhlYWRlcnNPYmplY3QpIHtcbiAgcmV0dXJuIHJlZHVjZUhlYWRlcnNPYmplY3QoXG4gICAgaGVhZGVyc09iamVjdCxcbiAgICAoaGVhZGVycywgbmFtZSwgdmFsdWUpID0+IHtcbiAgICAgIGhlYWRlcnNbbmFtZV0gPSBbXS5jb25jYXQodmFsdWUpLmpvaW4oXCIsIFwiKTtcbiAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgIH0sXG4gICAge31cbiAgKTtcbn1cbmV4cG9ydCB7XG4gIEhlYWRlcnMsXG4gIGZsYXR0ZW5IZWFkZXJzTGlzdCxcbiAgZmxhdHRlbkhlYWRlcnNPYmplY3QsXG4gIGdldFJhd0hlYWRlcnMsXG4gIGhlYWRlcnNUb0xpc3QsXG4gIGhlYWRlcnNUb09iamVjdCxcbiAgaGVhZGVyc1RvU3RyaW5nLFxuICBsaXN0VG9IZWFkZXJzLFxuICBvYmplY3RUb0hlYWRlcnMsXG4gIHJlZHVjZUhlYWRlcnNPYmplY3QsXG4gIHN0cmluZ1RvSGVhZGVyc1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4Lm1qcy5tYXAiLCJpbXBvcnQgeyBlbnZfZ2V0IH0gZnJvbSAnc3BhY2V0aW1lOnN5c0AyLjInO1xuaW1wb3J0ICogYXMgX3N5c2NhbGxzMl8wIGZyb20gJ3NwYWNldGltZTpzeXNAMi4wJztcbmltcG9ydCB7IG1vZHVsZUhvb2tzIH0gZnJvbSAnc3BhY2V0aW1lOnN5c0AyLjAnO1xuaW1wb3J0IHsgSGVhZGVycyB9IGZyb20gJ2hlYWRlcnMtcG9seWZpbGwnO1xuZXhwb3J0IHsgSGVhZGVycyB9IGZyb20gJ2hlYWRlcnMtcG9seWZpbGwnO1xuaW1wb3J0ICogYXMgX3N5c2NhbGxzMl8xIGZyb20gJ3NwYWNldGltZTpzeXNAMi4xJztcblxudHlwZW9mIGdsb2JhbFRoaXMhPT1cInVuZGVmaW5lZFwiJiYoKGdsb2JhbFRoaXMuZ2xvYmFsPWdsb2JhbFRoaXMuZ2xvYmFsfHxnbG9iYWxUaGlzKSwoZ2xvYmFsVGhpcy53aW5kb3c9Z2xvYmFsVGhpcy53aW5kb3d8fGdsb2JhbFRoaXMpKTtcbnZhciBfX2NyZWF0ZSA9IE9iamVjdC5jcmVhdGU7XG52YXIgX19kZWZQcm9wID0gT2JqZWN0LmRlZmluZVByb3BlcnR5O1xudmFyIF9fZ2V0T3duUHJvcERlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yO1xudmFyIF9fZ2V0T3duUHJvcE5hbWVzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXM7XG52YXIgX19nZXRQcm90b09mID0gT2JqZWN0LmdldFByb3RvdHlwZU9mO1xudmFyIF9faGFzT3duUHJvcCA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgX19lc20gPSAoZm4sIHJlcykgPT4gZnVuY3Rpb24gX19pbml0KCkge1xuICByZXR1cm4gZm4gJiYgKHJlcyA9ICgwLCBmbltfX2dldE93blByb3BOYW1lcyhmbilbMF1dKShmbiA9IDApKSwgcmVzO1xufTtcbnZhciBfX2NvbW1vbkpTID0gKGNiLCBtb2QpID0+IGZ1bmN0aW9uIF9fcmVxdWlyZSgpIHtcbiAgcmV0dXJuIG1vZCB8fCAoMCwgY2JbX19nZXRPd25Qcm9wTmFtZXMoY2IpWzBdXSkoKG1vZCA9IHsgZXhwb3J0czoge30gfSkuZXhwb3J0cywgbW9kKSwgbW9kLmV4cG9ydHM7XG59O1xudmFyIF9fZXhwb3J0ID0gKHRhcmdldCwgYWxsKSA9PiB7XG4gIGZvciAodmFyIG5hbWUgaW4gYWxsKVxuICAgIF9fZGVmUHJvcCh0YXJnZXQsIG5hbWUsIHsgZ2V0OiBhbGxbbmFtZV0sIGVudW1lcmFibGU6IHRydWUgfSk7XG59O1xudmFyIF9fY29weVByb3BzID0gKHRvLCBmcm9tLCBleGNlcHQsIGRlc2MpID0+IHtcbiAgaWYgKGZyb20gJiYgdHlwZW9mIGZyb20gPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIGZyb20gPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGZvciAobGV0IGtleSBvZiBfX2dldE93blByb3BOYW1lcyhmcm9tKSlcbiAgICAgIGlmICghX19oYXNPd25Qcm9wLmNhbGwodG8sIGtleSkgJiYga2V5ICE9PSBleGNlcHQpXG4gICAgICAgIF9fZGVmUHJvcCh0bywga2V5LCB7IGdldDogKCkgPT4gZnJvbVtrZXldLCBlbnVtZXJhYmxlOiAhKGRlc2MgPSBfX2dldE93blByb3BEZXNjKGZyb20sIGtleSkpIHx8IGRlc2MuZW51bWVyYWJsZSB9KTtcbiAgfVxuICByZXR1cm4gdG87XG59O1xudmFyIF9fdG9FU00gPSAobW9kLCBpc05vZGVNb2RlLCB0YXJnZXQpID0+ICh0YXJnZXQgPSBtb2QgIT0gbnVsbCA/IF9fY3JlYXRlKF9fZ2V0UHJvdG9PZihtb2QpKSA6IHt9LCBfX2NvcHlQcm9wcyhcbiAgLy8gSWYgdGhlIGltcG9ydGVyIGlzIGluIG5vZGUgY29tcGF0aWJpbGl0eSBtb2RlIG9yIHRoaXMgaXMgbm90IGFuIEVTTVxuICAvLyBmaWxlIHRoYXQgaGFzIGJlZW4gY29udmVydGVkIHRvIGEgQ29tbW9uSlMgZmlsZSB1c2luZyBhIEJhYmVsLVxuICAvLyBjb21wYXRpYmxlIHRyYW5zZm9ybSAoaS5lLiBcIl9fZXNNb2R1bGVcIiBoYXMgbm90IGJlZW4gc2V0KSwgdGhlbiBzZXRcbiAgLy8gXCJkZWZhdWx0XCIgdG8gdGhlIENvbW1vbkpTIFwibW9kdWxlLmV4cG9ydHNcIiBmb3Igbm9kZSBjb21wYXRpYmlsaXR5LlxuICBfX2RlZlByb3AodGFyZ2V0LCBcImRlZmF1bHRcIiwgeyB2YWx1ZTogbW9kLCBlbnVtZXJhYmxlOiB0cnVlIH0pICxcbiAgbW9kXG4pKTtcbnZhciBfX3RvQ29tbW9uSlMgPSAobW9kKSA9PiBfX2NvcHlQcm9wcyhfX2RlZlByb3Aoe30sIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pLCBtb2QpO1xuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vYmFzZTY0LWpzQDEuNS4xL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvaW5kZXguanNcbnZhciByZXF1aXJlX2Jhc2U2NF9qcyA9IF9fY29tbW9uSlMoe1xuICBcIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9iYXNlNjQtanNAMS41LjEvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9pbmRleC5qc1wiKGV4cG9ydHMpIHtcbiAgICBleHBvcnRzLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoO1xuICAgIGV4cG9ydHMudG9CeXRlQXJyYXkgPSB0b0J5dGVBcnJheTtcbiAgICBleHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5MjtcbiAgICB2YXIgbG9va3VwID0gW107XG4gICAgdmFyIHJldkxvb2t1cCA9IFtdO1xuICAgIHZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gXCJ1bmRlZmluZWRcIiA/IFVpbnQ4QXJyYXkgOiBBcnJheTtcbiAgICB2YXIgY29kZSA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrL1wiO1xuICAgIGZvciAoaSA9IDAsIGxlbiA9IGNvZGUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIGxvb2t1cFtpXSA9IGNvZGVbaV07XG4gICAgICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGk7XG4gICAgfVxuICAgIHZhciBpO1xuICAgIHZhciBsZW47XG4gICAgcmV2TG9va3VwW1wiLVwiLmNoYXJDb2RlQXQoMCldID0gNjI7XG4gICAgcmV2TG9va3VwW1wiX1wiLmNoYXJDb2RlQXQoMCldID0gNjM7XG4gICAgZnVuY3Rpb24gZ2V0TGVucyhiNjQpIHtcbiAgICAgIHZhciBsZW4yID0gYjY0Lmxlbmd0aDtcbiAgICAgIGlmIChsZW4yICUgNCA+IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNFwiKTtcbiAgICAgIH1cbiAgICAgIHZhciB2YWxpZExlbiA9IGI2NC5pbmRleE9mKFwiPVwiKTtcbiAgICAgIGlmICh2YWxpZExlbiA9PT0gLTEpIHZhbGlkTGVuID0gbGVuMjtcbiAgICAgIHZhciBwbGFjZUhvbGRlcnNMZW4gPSB2YWxpZExlbiA9PT0gbGVuMiA/IDAgOiA0IC0gdmFsaWRMZW4gJSA0O1xuICAgICAgcmV0dXJuIFt2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuXTtcbiAgICB9XG4gICAgZnVuY3Rpb24gYnl0ZUxlbmd0aChiNjQpIHtcbiAgICAgIHZhciBsZW5zID0gZ2V0TGVucyhiNjQpO1xuICAgICAgdmFyIHZhbGlkTGVuID0gbGVuc1swXTtcbiAgICAgIHZhciBwbGFjZUhvbGRlcnNMZW4gPSBsZW5zWzFdO1xuICAgICAgcmV0dXJuICh2YWxpZExlbiArIHBsYWNlSG9sZGVyc0xlbikgKiAzIC8gNCAtIHBsYWNlSG9sZGVyc0xlbjtcbiAgICB9XG4gICAgZnVuY3Rpb24gX2J5dGVMZW5ndGgoYjY0LCB2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuKSB7XG4gICAgICByZXR1cm4gKHZhbGlkTGVuICsgcGxhY2VIb2xkZXJzTGVuKSAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzTGVuO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0b0J5dGVBcnJheShiNjQpIHtcbiAgICAgIHZhciB0bXA7XG4gICAgICB2YXIgbGVucyA9IGdldExlbnMoYjY0KTtcbiAgICAgIHZhciB2YWxpZExlbiA9IGxlbnNbMF07XG4gICAgICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gbGVuc1sxXTtcbiAgICAgIHZhciBhcnIgPSBuZXcgQXJyKF9ieXRlTGVuZ3RoKGI2NCwgdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbikpO1xuICAgICAgdmFyIGN1ckJ5dGUgPSAwO1xuICAgICAgdmFyIGxlbjIgPSBwbGFjZUhvbGRlcnNMZW4gPiAwID8gdmFsaWRMZW4gLSA0IDogdmFsaWRMZW47XG4gICAgICB2YXIgaTI7XG4gICAgICBmb3IgKGkyID0gMDsgaTIgPCBsZW4yOyBpMiArPSA0KSB7XG4gICAgICAgIHRtcCA9IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMildIDw8IDE4IHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyICsgMSldIDw8IDEyIHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyICsgMildIDw8IDYgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaTIgKyAzKV07XG4gICAgICAgIGFycltjdXJCeXRlKytdID0gdG1wID4+IDE2ICYgMjU1O1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCA+PiA4ICYgMjU1O1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDI1NTtcbiAgICAgIH1cbiAgICAgIGlmIChwbGFjZUhvbGRlcnNMZW4gPT09IDIpIHtcbiAgICAgICAgdG1wID0gcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyKV0gPDwgMiB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMiArIDEpXSA+PiA0O1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDI1NTtcbiAgICAgIH1cbiAgICAgIGlmIChwbGFjZUhvbGRlcnNMZW4gPT09IDEpIHtcbiAgICAgICAgdG1wID0gcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyKV0gPDwgMTAgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaTIgKyAxKV0gPDwgNCB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMiArIDIpXSA+PiAyO1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCA+PiA4ICYgMjU1O1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDI1NTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhcnI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NChudW0pIHtcbiAgICAgIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgNjNdICsgbG9va3VwW251bSA+PiAxMiAmIDYzXSArIGxvb2t1cFtudW0gPj4gNiAmIDYzXSArIGxvb2t1cFtudW0gJiA2M107XG4gICAgfVxuICAgIGZ1bmN0aW9uIGVuY29kZUNodW5rKHVpbnQ4LCBzdGFydCwgZW5kKSB7XG4gICAgICB2YXIgdG1wO1xuICAgICAgdmFyIG91dHB1dCA9IFtdO1xuICAgICAgZm9yICh2YXIgaTIgPSBzdGFydDsgaTIgPCBlbmQ7IGkyICs9IDMpIHtcbiAgICAgICAgdG1wID0gKHVpbnQ4W2kyXSA8PCAxNiAmIDE2NzExNjgwKSArICh1aW50OFtpMiArIDFdIDw8IDggJiA2NTI4MCkgKyAodWludDhbaTIgKyAyXSAmIDI1NSk7XG4gICAgICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0bXApKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvdXRwdXQuam9pbihcIlwiKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZnJvbUJ5dGVBcnJheTIodWludDgpIHtcbiAgICAgIHZhciB0bXA7XG4gICAgICB2YXIgbGVuMiA9IHVpbnQ4Lmxlbmd0aDtcbiAgICAgIHZhciBleHRyYUJ5dGVzID0gbGVuMiAlIDM7XG4gICAgICB2YXIgcGFydHMgPSBbXTtcbiAgICAgIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzO1xuICAgICAgZm9yICh2YXIgaTIgPSAwLCBsZW4yMiA9IGxlbjIgLSBleHRyYUJ5dGVzOyBpMiA8IGxlbjIyOyBpMiArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgICAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpMiwgaTIgKyBtYXhDaHVua0xlbmd0aCA+IGxlbjIyID8gbGVuMjIgOiBpMiArIG1heENodW5rTGVuZ3RoKSk7XG4gICAgICB9XG4gICAgICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgICAgICB0bXAgPSB1aW50OFtsZW4yIC0gMV07XG4gICAgICAgIHBhcnRzLnB1c2goXG4gICAgICAgICAgbG9va3VwW3RtcCA+PiAyXSArIGxvb2t1cFt0bXAgPDwgNCAmIDYzXSArIFwiPT1cIlxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmIChleHRyYUJ5dGVzID09PSAyKSB7XG4gICAgICAgIHRtcCA9ICh1aW50OFtsZW4yIC0gMl0gPDwgOCkgKyB1aW50OFtsZW4yIC0gMV07XG4gICAgICAgIHBhcnRzLnB1c2goXG4gICAgICAgICAgbG9va3VwW3RtcCA+PiAxMF0gKyBsb29rdXBbdG1wID4+IDQgJiA2M10gKyBsb29rdXBbdG1wIDw8IDIgJiA2M10gKyBcIj1cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcnRzLmpvaW4oXCJcIik7XG4gICAgfVxuICB9XG59KTtcblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3N0YXR1c2VzQDIuMC4yL25vZGVfbW9kdWxlcy9zdGF0dXNlcy9jb2Rlcy5qc29uXG52YXIgcmVxdWlyZV9jb2RlcyA9IF9fY29tbW9uSlMoe1xuICBcIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9zdGF0dXNlc0AyLjAuMi9ub2RlX21vZHVsZXMvc3RhdHVzZXMvY29kZXMuanNvblwiKGV4cG9ydHMsIG1vZHVsZSkge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgXCIxMDBcIjogXCJDb250aW51ZVwiLFxuICAgICAgXCIxMDFcIjogXCJTd2l0Y2hpbmcgUHJvdG9jb2xzXCIsXG4gICAgICBcIjEwMlwiOiBcIlByb2Nlc3NpbmdcIixcbiAgICAgIFwiMTAzXCI6IFwiRWFybHkgSGludHNcIixcbiAgICAgIFwiMjAwXCI6IFwiT0tcIixcbiAgICAgIFwiMjAxXCI6IFwiQ3JlYXRlZFwiLFxuICAgICAgXCIyMDJcIjogXCJBY2NlcHRlZFwiLFxuICAgICAgXCIyMDNcIjogXCJOb24tQXV0aG9yaXRhdGl2ZSBJbmZvcm1hdGlvblwiLFxuICAgICAgXCIyMDRcIjogXCJObyBDb250ZW50XCIsXG4gICAgICBcIjIwNVwiOiBcIlJlc2V0IENvbnRlbnRcIixcbiAgICAgIFwiMjA2XCI6IFwiUGFydGlhbCBDb250ZW50XCIsXG4gICAgICBcIjIwN1wiOiBcIk11bHRpLVN0YXR1c1wiLFxuICAgICAgXCIyMDhcIjogXCJBbHJlYWR5IFJlcG9ydGVkXCIsXG4gICAgICBcIjIyNlwiOiBcIklNIFVzZWRcIixcbiAgICAgIFwiMzAwXCI6IFwiTXVsdGlwbGUgQ2hvaWNlc1wiLFxuICAgICAgXCIzMDFcIjogXCJNb3ZlZCBQZXJtYW5lbnRseVwiLFxuICAgICAgXCIzMDJcIjogXCJGb3VuZFwiLFxuICAgICAgXCIzMDNcIjogXCJTZWUgT3RoZXJcIixcbiAgICAgIFwiMzA0XCI6IFwiTm90IE1vZGlmaWVkXCIsXG4gICAgICBcIjMwNVwiOiBcIlVzZSBQcm94eVwiLFxuICAgICAgXCIzMDdcIjogXCJUZW1wb3JhcnkgUmVkaXJlY3RcIixcbiAgICAgIFwiMzA4XCI6IFwiUGVybWFuZW50IFJlZGlyZWN0XCIsXG4gICAgICBcIjQwMFwiOiBcIkJhZCBSZXF1ZXN0XCIsXG4gICAgICBcIjQwMVwiOiBcIlVuYXV0aG9yaXplZFwiLFxuICAgICAgXCI0MDJcIjogXCJQYXltZW50IFJlcXVpcmVkXCIsXG4gICAgICBcIjQwM1wiOiBcIkZvcmJpZGRlblwiLFxuICAgICAgXCI0MDRcIjogXCJOb3QgRm91bmRcIixcbiAgICAgIFwiNDA1XCI6IFwiTWV0aG9kIE5vdCBBbGxvd2VkXCIsXG4gICAgICBcIjQwNlwiOiBcIk5vdCBBY2NlcHRhYmxlXCIsXG4gICAgICBcIjQwN1wiOiBcIlByb3h5IEF1dGhlbnRpY2F0aW9uIFJlcXVpcmVkXCIsXG4gICAgICBcIjQwOFwiOiBcIlJlcXVlc3QgVGltZW91dFwiLFxuICAgICAgXCI0MDlcIjogXCJDb25mbGljdFwiLFxuICAgICAgXCI0MTBcIjogXCJHb25lXCIsXG4gICAgICBcIjQxMVwiOiBcIkxlbmd0aCBSZXF1aXJlZFwiLFxuICAgICAgXCI0MTJcIjogXCJQcmVjb25kaXRpb24gRmFpbGVkXCIsXG4gICAgICBcIjQxM1wiOiBcIlBheWxvYWQgVG9vIExhcmdlXCIsXG4gICAgICBcIjQxNFwiOiBcIlVSSSBUb28gTG9uZ1wiLFxuICAgICAgXCI0MTVcIjogXCJVbnN1cHBvcnRlZCBNZWRpYSBUeXBlXCIsXG4gICAgICBcIjQxNlwiOiBcIlJhbmdlIE5vdCBTYXRpc2ZpYWJsZVwiLFxuICAgICAgXCI0MTdcIjogXCJFeHBlY3RhdGlvbiBGYWlsZWRcIixcbiAgICAgIFwiNDE4XCI6IFwiSSdtIGEgVGVhcG90XCIsXG4gICAgICBcIjQyMVwiOiBcIk1pc2RpcmVjdGVkIFJlcXVlc3RcIixcbiAgICAgIFwiNDIyXCI6IFwiVW5wcm9jZXNzYWJsZSBFbnRpdHlcIixcbiAgICAgIFwiNDIzXCI6IFwiTG9ja2VkXCIsXG4gICAgICBcIjQyNFwiOiBcIkZhaWxlZCBEZXBlbmRlbmN5XCIsXG4gICAgICBcIjQyNVwiOiBcIlRvbyBFYXJseVwiLFxuICAgICAgXCI0MjZcIjogXCJVcGdyYWRlIFJlcXVpcmVkXCIsXG4gICAgICBcIjQyOFwiOiBcIlByZWNvbmRpdGlvbiBSZXF1aXJlZFwiLFxuICAgICAgXCI0MjlcIjogXCJUb28gTWFueSBSZXF1ZXN0c1wiLFxuICAgICAgXCI0MzFcIjogXCJSZXF1ZXN0IEhlYWRlciBGaWVsZHMgVG9vIExhcmdlXCIsXG4gICAgICBcIjQ1MVwiOiBcIlVuYXZhaWxhYmxlIEZvciBMZWdhbCBSZWFzb25zXCIsXG4gICAgICBcIjUwMFwiOiBcIkludGVybmFsIFNlcnZlciBFcnJvclwiLFxuICAgICAgXCI1MDFcIjogXCJOb3QgSW1wbGVtZW50ZWRcIixcbiAgICAgIFwiNTAyXCI6IFwiQmFkIEdhdGV3YXlcIixcbiAgICAgIFwiNTAzXCI6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgXCI1MDRcIjogXCJHYXRld2F5IFRpbWVvdXRcIixcbiAgICAgIFwiNTA1XCI6IFwiSFRUUCBWZXJzaW9uIE5vdCBTdXBwb3J0ZWRcIixcbiAgICAgIFwiNTA2XCI6IFwiVmFyaWFudCBBbHNvIE5lZ290aWF0ZXNcIixcbiAgICAgIFwiNTA3XCI6IFwiSW5zdWZmaWNpZW50IFN0b3JhZ2VcIixcbiAgICAgIFwiNTA4XCI6IFwiTG9vcCBEZXRlY3RlZFwiLFxuICAgICAgXCI1MDlcIjogXCJCYW5kd2lkdGggTGltaXQgRXhjZWVkZWRcIixcbiAgICAgIFwiNTEwXCI6IFwiTm90IEV4dGVuZGVkXCIsXG4gICAgICBcIjUxMVwiOiBcIk5ldHdvcmsgQXV0aGVudGljYXRpb24gUmVxdWlyZWRcIlxuICAgIH07XG4gIH1cbn0pO1xuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vc3RhdHVzZXNAMi4wLjIvbm9kZV9tb2R1bGVzL3N0YXR1c2VzL2luZGV4LmpzXG52YXIgcmVxdWlyZV9zdGF0dXNlcyA9IF9fY29tbW9uSlMoe1xuICBcIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9zdGF0dXNlc0AyLjAuMi9ub2RlX21vZHVsZXMvc3RhdHVzZXMvaW5kZXguanNcIihleHBvcnRzLCBtb2R1bGUpIHtcbiAgICB2YXIgY29kZXMgPSByZXF1aXJlX2NvZGVzKCk7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBzdGF0dXMyO1xuICAgIHN0YXR1czIubWVzc2FnZSA9IGNvZGVzO1xuICAgIHN0YXR1czIuY29kZSA9IGNyZWF0ZU1lc3NhZ2VUb1N0YXR1c0NvZGVNYXAoY29kZXMpO1xuICAgIHN0YXR1czIuY29kZXMgPSBjcmVhdGVTdGF0dXNDb2RlTGlzdChjb2Rlcyk7XG4gICAgc3RhdHVzMi5yZWRpcmVjdCA9IHtcbiAgICAgIDMwMDogdHJ1ZSxcbiAgICAgIDMwMTogdHJ1ZSxcbiAgICAgIDMwMjogdHJ1ZSxcbiAgICAgIDMwMzogdHJ1ZSxcbiAgICAgIDMwNTogdHJ1ZSxcbiAgICAgIDMwNzogdHJ1ZSxcbiAgICAgIDMwODogdHJ1ZVxuICAgIH07XG4gICAgc3RhdHVzMi5lbXB0eSA9IHtcbiAgICAgIDIwNDogdHJ1ZSxcbiAgICAgIDIwNTogdHJ1ZSxcbiAgICAgIDMwNDogdHJ1ZVxuICAgIH07XG4gICAgc3RhdHVzMi5yZXRyeSA9IHtcbiAgICAgIDUwMjogdHJ1ZSxcbiAgICAgIDUwMzogdHJ1ZSxcbiAgICAgIDUwNDogdHJ1ZVxuICAgIH07XG4gICAgZnVuY3Rpb24gY3JlYXRlTWVzc2FnZVRvU3RhdHVzQ29kZU1hcChjb2RlczIpIHtcbiAgICAgIHZhciBtYXAgPSB7fTtcbiAgICAgIE9iamVjdC5rZXlzKGNvZGVzMikuZm9yRWFjaChmdW5jdGlvbiBmb3JFYWNoQ29kZShjb2RlKSB7XG4gICAgICAgIHZhciBtZXNzYWdlID0gY29kZXMyW2NvZGVdO1xuICAgICAgICB2YXIgc3RhdHVzMyA9IE51bWJlcihjb2RlKTtcbiAgICAgICAgbWFwW21lc3NhZ2UudG9Mb3dlckNhc2UoKV0gPSBzdGF0dXMzO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbWFwO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjcmVhdGVTdGF0dXNDb2RlTGlzdChjb2RlczIpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhjb2RlczIpLm1hcChmdW5jdGlvbiBtYXBDb2RlKGNvZGUpIHtcbiAgICAgICAgcmV0dXJuIE51bWJlcihjb2RlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRTdGF0dXNDb2RlKG1lc3NhZ2UpIHtcbiAgICAgIHZhciBtc2cgPSBtZXNzYWdlLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzdGF0dXMyLmNvZGUsIG1zZykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHN0YXR1cyBtZXNzYWdlOiBcIicgKyBtZXNzYWdlICsgJ1wiJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RhdHVzMi5jb2RlW21zZ107XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldFN0YXR1c01lc3NhZ2UoY29kZSkge1xuICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc3RhdHVzMi5tZXNzYWdlLCBjb2RlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnZhbGlkIHN0YXR1cyBjb2RlOiBcIiArIGNvZGUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXR1czIubWVzc2FnZVtjb2RlXTtcbiAgICB9XG4gICAgZnVuY3Rpb24gc3RhdHVzMihjb2RlKSB7XG4gICAgICBpZiAodHlwZW9mIGNvZGUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgcmV0dXJuIGdldFN0YXR1c01lc3NhZ2UoY29kZSk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGNvZGUgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNvZGUgbXVzdCBiZSBhIG51bWJlciBvciBzdHJpbmdcIik7XG4gICAgICB9XG4gICAgICB2YXIgbiA9IHBhcnNlSW50KGNvZGUsIDEwKTtcbiAgICAgIGlmICghaXNOYU4obikpIHtcbiAgICAgICAgcmV0dXJuIGdldFN0YXR1c01lc3NhZ2Uobik7XG4gICAgICB9XG4gICAgICByZXR1cm4gZ2V0U3RhdHVzQ29kZShjb2RlKTtcbiAgICB9XG4gIH1cbn0pO1xuXG4vLyBzcmMvdXRpbC1zdHViLnRzXG52YXIgdXRpbF9zdHViX2V4cG9ydHMgPSB7fTtcbl9fZXhwb3J0KHV0aWxfc3R1Yl9leHBvcnRzLCB7XG4gIGluc3BlY3Q6ICgpID0+IGluc3BlY3Rcbn0pO1xudmFyIGluc3BlY3Q7XG52YXIgaW5pdF91dGlsX3N0dWIgPSBfX2VzbSh7XG4gIFwic3JjL3V0aWwtc3R1Yi50c1wiKCkge1xuICAgIGluc3BlY3QgPSB7fTtcbiAgfVxufSk7XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9vYmplY3QtaW5zcGVjdEAxLjEzLjQvbm9kZV9tb2R1bGVzL29iamVjdC1pbnNwZWN0L3V0aWwuaW5zcGVjdC5qc1xudmFyIHJlcXVpcmVfdXRpbF9pbnNwZWN0ID0gX19jb21tb25KUyh7XG4gIFwiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL29iamVjdC1pbnNwZWN0QDEuMTMuNC9ub2RlX21vZHVsZXMvb2JqZWN0LWluc3BlY3QvdXRpbC5pbnNwZWN0LmpzXCIoZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSAoaW5pdF91dGlsX3N0dWIoKSwgX190b0NvbW1vbkpTKHV0aWxfc3R1Yl9leHBvcnRzKSkuaW5zcGVjdDtcbiAgfVxufSk7XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9vYmplY3QtaW5zcGVjdEAxLjEzLjQvbm9kZV9tb2R1bGVzL29iamVjdC1pbnNwZWN0L2luZGV4LmpzXG52YXIgcmVxdWlyZV9vYmplY3RfaW5zcGVjdCA9IF9fY29tbW9uSlMoe1xuICBcIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9vYmplY3QtaW5zcGVjdEAxLjEzLjQvbm9kZV9tb2R1bGVzL29iamVjdC1pbnNwZWN0L2luZGV4LmpzXCIoZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgdmFyIGhhc01hcCA9IHR5cGVvZiBNYXAgPT09IFwiZnVuY3Rpb25cIiAmJiBNYXAucHJvdG90eXBlO1xuICAgIHZhciBtYXBTaXplRGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgJiYgaGFzTWFwID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihNYXAucHJvdG90eXBlLCBcInNpemVcIikgOiBudWxsO1xuICAgIHZhciBtYXBTaXplID0gaGFzTWFwICYmIG1hcFNpemVEZXNjcmlwdG9yICYmIHR5cGVvZiBtYXBTaXplRGVzY3JpcHRvci5nZXQgPT09IFwiZnVuY3Rpb25cIiA/IG1hcFNpemVEZXNjcmlwdG9yLmdldCA6IG51bGw7XG4gICAgdmFyIG1hcEZvckVhY2ggPSBoYXNNYXAgJiYgTWFwLnByb3RvdHlwZS5mb3JFYWNoO1xuICAgIHZhciBoYXNTZXQgPSB0eXBlb2YgU2V0ID09PSBcImZ1bmN0aW9uXCIgJiYgU2V0LnByb3RvdHlwZTtcbiAgICB2YXIgc2V0U2l6ZURlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yICYmIGhhc1NldCA/IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoU2V0LnByb3RvdHlwZSwgXCJzaXplXCIpIDogbnVsbDtcbiAgICB2YXIgc2V0U2l6ZSA9IGhhc1NldCAmJiBzZXRTaXplRGVzY3JpcHRvciAmJiB0eXBlb2Ygc2V0U2l6ZURlc2NyaXB0b3IuZ2V0ID09PSBcImZ1bmN0aW9uXCIgPyBzZXRTaXplRGVzY3JpcHRvci5nZXQgOiBudWxsO1xuICAgIHZhciBzZXRGb3JFYWNoID0gaGFzU2V0ICYmIFNldC5wcm90b3R5cGUuZm9yRWFjaDtcbiAgICB2YXIgaGFzV2Vha01hcCA9IHR5cGVvZiBXZWFrTWFwID09PSBcImZ1bmN0aW9uXCIgJiYgV2Vha01hcC5wcm90b3R5cGU7XG4gICAgdmFyIHdlYWtNYXBIYXMgPSBoYXNXZWFrTWFwID8gV2Vha01hcC5wcm90b3R5cGUuaGFzIDogbnVsbDtcbiAgICB2YXIgaGFzV2Vha1NldCA9IHR5cGVvZiBXZWFrU2V0ID09PSBcImZ1bmN0aW9uXCIgJiYgV2Vha1NldC5wcm90b3R5cGU7XG4gICAgdmFyIHdlYWtTZXRIYXMgPSBoYXNXZWFrU2V0ID8gV2Vha1NldC5wcm90b3R5cGUuaGFzIDogbnVsbDtcbiAgICB2YXIgaGFzV2Vha1JlZiA9IHR5cGVvZiBXZWFrUmVmID09PSBcImZ1bmN0aW9uXCIgJiYgV2Vha1JlZi5wcm90b3R5cGU7XG4gICAgdmFyIHdlYWtSZWZEZXJlZiA9IGhhc1dlYWtSZWYgPyBXZWFrUmVmLnByb3RvdHlwZS5kZXJlZiA6IG51bGw7XG4gICAgdmFyIGJvb2xlYW5WYWx1ZU9mID0gQm9vbGVhbi5wcm90b3R5cGUudmFsdWVPZjtcbiAgICB2YXIgb2JqZWN0VG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuICAgIHZhciBmdW5jdGlvblRvU3RyaW5nID0gRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nO1xuICAgIHZhciAkbWF0Y2ggPSBTdHJpbmcucHJvdG90eXBlLm1hdGNoO1xuICAgIHZhciAkc2xpY2UgPSBTdHJpbmcucHJvdG90eXBlLnNsaWNlO1xuICAgIHZhciAkcmVwbGFjZSA9IFN0cmluZy5wcm90b3R5cGUucmVwbGFjZTtcbiAgICB2YXIgJHRvVXBwZXJDYXNlID0gU3RyaW5nLnByb3RvdHlwZS50b1VwcGVyQ2FzZTtcbiAgICB2YXIgJHRvTG93ZXJDYXNlID0gU3RyaW5nLnByb3RvdHlwZS50b0xvd2VyQ2FzZTtcbiAgICB2YXIgJHRlc3QgPSBSZWdFeHAucHJvdG90eXBlLnRlc3Q7XG4gICAgdmFyICRjb25jYXQgPSBBcnJheS5wcm90b3R5cGUuY29uY2F0O1xuICAgIHZhciAkam9pbiA9IEFycmF5LnByb3RvdHlwZS5qb2luO1xuICAgIHZhciAkYXJyU2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG4gICAgdmFyICRmbG9vciA9IE1hdGguZmxvb3I7XG4gICAgdmFyIGJpZ0ludFZhbHVlT2YgPSB0eXBlb2YgQmlnSW50ID09PSBcImZ1bmN0aW9uXCIgPyBCaWdJbnQucHJvdG90eXBlLnZhbHVlT2YgOiBudWxsO1xuICAgIHZhciBnT1BTID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scztcbiAgICB2YXIgc3ltVG9TdHJpbmcgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJzeW1ib2xcIiA/IFN5bWJvbC5wcm90b3R5cGUudG9TdHJpbmcgOiBudWxsO1xuICAgIHZhciBoYXNTaGFtbWVkU3ltYm9scyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcIm9iamVjdFwiO1xuICAgIHZhciB0b1N0cmluZ1RhZyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wudG9TdHJpbmdUYWcgJiYgKHR5cGVvZiBTeW1ib2wudG9TdHJpbmdUYWcgPT09IGhhc1NoYW1tZWRTeW1ib2xzID8gXCJvYmplY3RcIiA6IFwic3ltYm9sXCIpID8gU3ltYm9sLnRvU3RyaW5nVGFnIDogbnVsbDtcbiAgICB2YXIgaXNFbnVtZXJhYmxlID0gT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcbiAgICB2YXIgZ1BPID0gKHR5cGVvZiBSZWZsZWN0ID09PSBcImZ1bmN0aW9uXCIgPyBSZWZsZWN0LmdldFByb3RvdHlwZU9mIDogT2JqZWN0LmdldFByb3RvdHlwZU9mKSB8fCAoW10uX19wcm90b19fID09PSBBcnJheS5wcm90b3R5cGUgPyBmdW5jdGlvbihPKSB7XG4gICAgICByZXR1cm4gTy5fX3Byb3RvX187XG4gICAgfSA6IG51bGwpO1xuICAgIGZ1bmN0aW9uIGFkZE51bWVyaWNTZXBhcmF0b3IobnVtLCBzdHIpIHtcbiAgICAgIGlmIChudW0gPT09IEluZmluaXR5IHx8IG51bSA9PT0gLUluZmluaXR5IHx8IG51bSAhPT0gbnVtIHx8IG51bSAmJiBudW0gPiAtMWUzICYmIG51bSA8IDFlMyB8fCAkdGVzdC5jYWxsKC9lLywgc3RyKSkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgfVxuICAgICAgdmFyIHNlcFJlZ2V4ID0gL1swLTldKD89KD86WzAtOV17M30pKyg/IVswLTldKSkvZztcbiAgICAgIGlmICh0eXBlb2YgbnVtID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHZhciBpbnQgPSBudW0gPCAwID8gLSRmbG9vcigtbnVtKSA6ICRmbG9vcihudW0pO1xuICAgICAgICBpZiAoaW50ICE9PSBudW0pIHtcbiAgICAgICAgICB2YXIgaW50U3RyID0gU3RyaW5nKGludCk7XG4gICAgICAgICAgdmFyIGRlYyA9ICRzbGljZS5jYWxsKHN0ciwgaW50U3RyLmxlbmd0aCArIDEpO1xuICAgICAgICAgIHJldHVybiAkcmVwbGFjZS5jYWxsKGludFN0ciwgc2VwUmVnZXgsIFwiJCZfXCIpICsgXCIuXCIgKyAkcmVwbGFjZS5jYWxsKCRyZXBsYWNlLmNhbGwoZGVjLCAvKFswLTldezN9KS9nLCBcIiQmX1wiKSwgL18kLywgXCJcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiAkcmVwbGFjZS5jYWxsKHN0ciwgc2VwUmVnZXgsIFwiJCZfXCIpO1xuICAgIH1cbiAgICB2YXIgdXRpbEluc3BlY3QgPSByZXF1aXJlX3V0aWxfaW5zcGVjdCgpO1xuICAgIHZhciBpbnNwZWN0Q3VzdG9tID0gdXRpbEluc3BlY3QuY3VzdG9tO1xuICAgIHZhciBpbnNwZWN0U3ltYm9sID0gaXNTeW1ib2woaW5zcGVjdEN1c3RvbSkgPyBpbnNwZWN0Q3VzdG9tIDogbnVsbDtcbiAgICB2YXIgcXVvdGVzID0ge1xuICAgICAgX19wcm90b19fOiBudWxsLFxuICAgICAgXCJkb3VibGVcIjogJ1wiJyxcbiAgICAgIHNpbmdsZTogXCInXCJcbiAgICB9O1xuICAgIHZhciBxdW90ZVJFcyA9IHtcbiAgICAgIF9fcHJvdG9fXzogbnVsbCxcbiAgICAgIFwiZG91YmxlXCI6IC8oW1wiXFxcXF0pL2csXG4gICAgICBzaW5nbGU6IC8oWydcXFxcXSkvZ1xuICAgIH07XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbnNwZWN0XyhvYmosIG9wdGlvbnMsIGRlcHRoLCBzZWVuKSB7XG4gICAgICB2YXIgb3B0cyA9IG9wdGlvbnMgfHwge307XG4gICAgICBpZiAoaGFzKG9wdHMsIFwicXVvdGVTdHlsZVwiKSAmJiAhaGFzKHF1b3Rlcywgb3B0cy5xdW90ZVN0eWxlKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvcHRpb24gXCJxdW90ZVN0eWxlXCIgbXVzdCBiZSBcInNpbmdsZVwiIG9yIFwiZG91YmxlXCInKTtcbiAgICAgIH1cbiAgICAgIGlmIChoYXMob3B0cywgXCJtYXhTdHJpbmdMZW5ndGhcIikgJiYgKHR5cGVvZiBvcHRzLm1heFN0cmluZ0xlbmd0aCA9PT0gXCJudW1iZXJcIiA/IG9wdHMubWF4U3RyaW5nTGVuZ3RoIDwgMCAmJiBvcHRzLm1heFN0cmluZ0xlbmd0aCAhPT0gSW5maW5pdHkgOiBvcHRzLm1heFN0cmluZ0xlbmd0aCAhPT0gbnVsbCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9uIFwibWF4U3RyaW5nTGVuZ3RoXCIsIGlmIHByb3ZpZGVkLCBtdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlciwgSW5maW5pdHksIG9yIGBudWxsYCcpO1xuICAgICAgfVxuICAgICAgdmFyIGN1c3RvbUluc3BlY3QgPSBoYXMob3B0cywgXCJjdXN0b21JbnNwZWN0XCIpID8gb3B0cy5jdXN0b21JbnNwZWN0IDogdHJ1ZTtcbiAgICAgIGlmICh0eXBlb2YgY3VzdG9tSW5zcGVjdCAhPT0gXCJib29sZWFuXCIgJiYgY3VzdG9tSW5zcGVjdCAhPT0gXCJzeW1ib2xcIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwib3B0aW9uIFxcXCJjdXN0b21JbnNwZWN0XFxcIiwgaWYgcHJvdmlkZWQsIG11c3QgYmUgYHRydWVgLCBgZmFsc2VgLCBvciBgJ3N5bWJvbCdgXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGhhcyhvcHRzLCBcImluZGVudFwiKSAmJiBvcHRzLmluZGVudCAhPT0gbnVsbCAmJiBvcHRzLmluZGVudCAhPT0gXCJcdFwiICYmICEocGFyc2VJbnQob3B0cy5pbmRlbnQsIDEwKSA9PT0gb3B0cy5pbmRlbnQgJiYgb3B0cy5pbmRlbnQgPiAwKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvcHRpb24gXCJpbmRlbnRcIiBtdXN0IGJlIFwiXFxcXHRcIiwgYW4gaW50ZWdlciA+IDAsIG9yIGBudWxsYCcpO1xuICAgICAgfVxuICAgICAgaWYgKGhhcyhvcHRzLCBcIm51bWVyaWNTZXBhcmF0b3JcIikgJiYgdHlwZW9mIG9wdHMubnVtZXJpY1NlcGFyYXRvciAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9uIFwibnVtZXJpY1NlcGFyYXRvclwiLCBpZiBwcm92aWRlZCwgbXVzdCBiZSBgdHJ1ZWAgb3IgYGZhbHNlYCcpO1xuICAgICAgfVxuICAgICAgdmFyIG51bWVyaWNTZXBhcmF0b3IgPSBvcHRzLm51bWVyaWNTZXBhcmF0b3I7XG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICByZXR1cm4gXCJ1bmRlZmluZWRcIjtcbiAgICAgIH1cbiAgICAgIGlmIChvYmogPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIFwibnVsbFwiO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBvYmogPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIHJldHVybiBvYmogPyBcInRydWVcIiA6IFwiZmFsc2VcIjtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHJldHVybiBpbnNwZWN0U3RyaW5nKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICBpZiAob2JqID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIEluZmluaXR5IC8gb2JqID4gMCA/IFwiMFwiIDogXCItMFwiO1xuICAgICAgICB9XG4gICAgICAgIHZhciBzdHIgPSBTdHJpbmcob2JqKTtcbiAgICAgICAgcmV0dXJuIG51bWVyaWNTZXBhcmF0b3IgPyBhZGROdW1lcmljU2VwYXJhdG9yKG9iaiwgc3RyKSA6IHN0cjtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcImJpZ2ludFwiKSB7XG4gICAgICAgIHZhciBiaWdJbnRTdHIgPSBTdHJpbmcob2JqKSArIFwiblwiO1xuICAgICAgICByZXR1cm4gbnVtZXJpY1NlcGFyYXRvciA/IGFkZE51bWVyaWNTZXBhcmF0b3Iob2JqLCBiaWdJbnRTdHIpIDogYmlnSW50U3RyO1xuICAgICAgfVxuICAgICAgdmFyIG1heERlcHRoID0gdHlwZW9mIG9wdHMuZGVwdGggPT09IFwidW5kZWZpbmVkXCIgPyA1IDogb3B0cy5kZXB0aDtcbiAgICAgIGlmICh0eXBlb2YgZGVwdGggPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgZGVwdGggPSAwO1xuICAgICAgfVxuICAgICAgaWYgKGRlcHRoID49IG1heERlcHRoICYmIG1heERlcHRoID4gMCAmJiB0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBpc0FycmF5KG9iaikgPyBcIltBcnJheV1cIiA6IFwiW09iamVjdF1cIjtcbiAgICAgIH1cbiAgICAgIHZhciBpbmRlbnQgPSBnZXRJbmRlbnQob3B0cywgZGVwdGgpO1xuICAgICAgaWYgKHR5cGVvZiBzZWVuID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIHNlZW4gPSBbXTtcbiAgICAgIH0gZWxzZSBpZiAoaW5kZXhPZihzZWVuLCBvYmopID49IDApIHtcbiAgICAgICAgcmV0dXJuIFwiW0NpcmN1bGFyXVwiO1xuICAgICAgfVxuICAgICAgZnVuY3Rpb24gaW5zcGVjdDModmFsdWUsIGZyb20sIG5vSW5kZW50KSB7XG4gICAgICAgIGlmIChmcm9tKSB7XG4gICAgICAgICAgc2VlbiA9ICRhcnJTbGljZS5jYWxsKHNlZW4pO1xuICAgICAgICAgIHNlZW4ucHVzaChmcm9tKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9JbmRlbnQpIHtcbiAgICAgICAgICB2YXIgbmV3T3B0cyA9IHtcbiAgICAgICAgICAgIGRlcHRoOiBvcHRzLmRlcHRoXG4gICAgICAgICAgfTtcbiAgICAgICAgICBpZiAoaGFzKG9wdHMsIFwicXVvdGVTdHlsZVwiKSkge1xuICAgICAgICAgICAgbmV3T3B0cy5xdW90ZVN0eWxlID0gb3B0cy5xdW90ZVN0eWxlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gaW5zcGVjdF8odmFsdWUsIG5ld09wdHMsIGRlcHRoICsgMSwgc2Vlbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGluc3BlY3RfKHZhbHVlLCBvcHRzLCBkZXB0aCArIDEsIHNlZW4pO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBvYmogPT09IFwiZnVuY3Rpb25cIiAmJiAhaXNSZWdFeHAob2JqKSkge1xuICAgICAgICB2YXIgbmFtZSA9IG5hbWVPZihvYmopO1xuICAgICAgICB2YXIga2V5cyA9IGFyck9iaktleXMob2JqLCBpbnNwZWN0Myk7XG4gICAgICAgIHJldHVybiBcIltGdW5jdGlvblwiICsgKG5hbWUgPyBcIjogXCIgKyBuYW1lIDogXCIgKGFub255bW91cylcIikgKyBcIl1cIiArIChrZXlzLmxlbmd0aCA+IDAgPyBcIiB7IFwiICsgJGpvaW4uY2FsbChrZXlzLCBcIiwgXCIpICsgXCIgfVwiIDogXCJcIik7XG4gICAgICB9XG4gICAgICBpZiAoaXNTeW1ib2wob2JqKSkge1xuICAgICAgICB2YXIgc3ltU3RyaW5nID0gaGFzU2hhbW1lZFN5bWJvbHMgPyAkcmVwbGFjZS5jYWxsKFN0cmluZyhvYmopLCAvXihTeW1ib2xcXCguKlxcKSlfW14pXSokLywgXCIkMVwiKSA6IHN5bVRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09IFwib2JqZWN0XCIgJiYgIWhhc1NoYW1tZWRTeW1ib2xzID8gbWFya0JveGVkKHN5bVN0cmluZykgOiBzeW1TdHJpbmc7XG4gICAgICB9XG4gICAgICBpZiAoaXNFbGVtZW50KG9iaikpIHtcbiAgICAgICAgdmFyIHMgPSBcIjxcIiArICR0b0xvd2VyQ2FzZS5jYWxsKFN0cmluZyhvYmoubm9kZU5hbWUpKTtcbiAgICAgICAgdmFyIGF0dHJzID0gb2JqLmF0dHJpYnV0ZXMgfHwgW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0cnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBzICs9IFwiIFwiICsgYXR0cnNbaV0ubmFtZSArIFwiPVwiICsgd3JhcFF1b3RlcyhxdW90ZShhdHRyc1tpXS52YWx1ZSksIFwiZG91YmxlXCIsIG9wdHMpO1xuICAgICAgICB9XG4gICAgICAgIHMgKz0gXCI+XCI7XG4gICAgICAgIGlmIChvYmouY2hpbGROb2RlcyAmJiBvYmouY2hpbGROb2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICBzICs9IFwiLi4uXCI7XG4gICAgICAgIH1cbiAgICAgICAgcyArPSBcIjwvXCIgKyAkdG9Mb3dlckNhc2UuY2FsbChTdHJpbmcob2JqLm5vZGVOYW1lKSkgKyBcIj5cIjtcbiAgICAgICAgcmV0dXJuIHM7XG4gICAgICB9XG4gICAgICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgICAgIGlmIChvYmoubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIFwiW11cIjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgeHMgPSBhcnJPYmpLZXlzKG9iaiwgaW5zcGVjdDMpO1xuICAgICAgICBpZiAoaW5kZW50ICYmICFzaW5nbGVMaW5lVmFsdWVzKHhzKSkge1xuICAgICAgICAgIHJldHVybiBcIltcIiArIGluZGVudGVkSm9pbih4cywgaW5kZW50KSArIFwiXVwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBcIlsgXCIgKyAkam9pbi5jYWxsKHhzLCBcIiwgXCIpICsgXCIgXVwiO1xuICAgICAgfVxuICAgICAgaWYgKGlzRXJyb3Iob2JqKSkge1xuICAgICAgICB2YXIgcGFydHMgPSBhcnJPYmpLZXlzKG9iaiwgaW5zcGVjdDMpO1xuICAgICAgICBpZiAoIShcImNhdXNlXCIgaW4gRXJyb3IucHJvdG90eXBlKSAmJiBcImNhdXNlXCIgaW4gb2JqICYmICFpc0VudW1lcmFibGUuY2FsbChvYmosIFwiY2F1c2VcIikpIHtcbiAgICAgICAgICByZXR1cm4gXCJ7IFtcIiArIFN0cmluZyhvYmopICsgXCJdIFwiICsgJGpvaW4uY2FsbCgkY29uY2F0LmNhbGwoXCJbY2F1c2VdOiBcIiArIGluc3BlY3QzKG9iai5jYXVzZSksIHBhcnRzKSwgXCIsIFwiKSArIFwiIH1cIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFydHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIFwiW1wiICsgU3RyaW5nKG9iaikgKyBcIl1cIjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gXCJ7IFtcIiArIFN0cmluZyhvYmopICsgXCJdIFwiICsgJGpvaW4uY2FsbChwYXJ0cywgXCIsIFwiKSArIFwiIH1cIjtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiICYmIGN1c3RvbUluc3BlY3QpIHtcbiAgICAgICAgaWYgKGluc3BlY3RTeW1ib2wgJiYgdHlwZW9mIG9ialtpbnNwZWN0U3ltYm9sXSA9PT0gXCJmdW5jdGlvblwiICYmIHV0aWxJbnNwZWN0KSB7XG4gICAgICAgICAgcmV0dXJuIHV0aWxJbnNwZWN0KG9iaiwgeyBkZXB0aDogbWF4RGVwdGggLSBkZXB0aCB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXN0b21JbnNwZWN0ICE9PSBcInN5bWJvbFwiICYmIHR5cGVvZiBvYmouaW5zcGVjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgcmV0dXJuIG9iai5pbnNwZWN0KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChpc01hcChvYmopKSB7XG4gICAgICAgIHZhciBtYXBQYXJ0cyA9IFtdO1xuICAgICAgICBpZiAobWFwRm9yRWFjaCkge1xuICAgICAgICAgIG1hcEZvckVhY2guY2FsbChvYmosIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgIG1hcFBhcnRzLnB1c2goaW5zcGVjdDMoa2V5LCBvYmosIHRydWUpICsgXCIgPT4gXCIgKyBpbnNwZWN0Myh2YWx1ZSwgb2JqKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb25PZihcIk1hcFwiLCBtYXBTaXplLmNhbGwob2JqKSwgbWFwUGFydHMsIGluZGVudCk7XG4gICAgICB9XG4gICAgICBpZiAoaXNTZXQob2JqKSkge1xuICAgICAgICB2YXIgc2V0UGFydHMgPSBbXTtcbiAgICAgICAgaWYgKHNldEZvckVhY2gpIHtcbiAgICAgICAgICBzZXRGb3JFYWNoLmNhbGwob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgICAgc2V0UGFydHMucHVzaChpbnNwZWN0Myh2YWx1ZSwgb2JqKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb25PZihcIlNldFwiLCBzZXRTaXplLmNhbGwob2JqKSwgc2V0UGFydHMsIGluZGVudCk7XG4gICAgICB9XG4gICAgICBpZiAoaXNXZWFrTWFwKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIHdlYWtDb2xsZWN0aW9uT2YoXCJXZWFrTWFwXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGlzV2Vha1NldChvYmopKSB7XG4gICAgICAgIHJldHVybiB3ZWFrQ29sbGVjdGlvbk9mKFwiV2Vha1NldFwiKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc1dlYWtSZWYob2JqKSkge1xuICAgICAgICByZXR1cm4gd2Vha0NvbGxlY3Rpb25PZihcIldlYWtSZWZcIik7XG4gICAgICB9XG4gICAgICBpZiAoaXNOdW1iZXIob2JqKSkge1xuICAgICAgICByZXR1cm4gbWFya0JveGVkKGluc3BlY3QzKE51bWJlcihvYmopKSk7XG4gICAgICB9XG4gICAgICBpZiAoaXNCaWdJbnQob2JqKSkge1xuICAgICAgICByZXR1cm4gbWFya0JveGVkKGluc3BlY3QzKGJpZ0ludFZhbHVlT2YuY2FsbChvYmopKSk7XG4gICAgICB9XG4gICAgICBpZiAoaXNCb29sZWFuKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIG1hcmtCb3hlZChib29sZWFuVmFsdWVPZi5jYWxsKG9iaikpO1xuICAgICAgfVxuICAgICAgaWYgKGlzU3RyaW5nKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIG1hcmtCb3hlZChpbnNwZWN0MyhTdHJpbmcob2JqKSkpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgJiYgb2JqID09PSB3aW5kb3cpIHtcbiAgICAgICAgcmV0dXJuIFwieyBbb2JqZWN0IFdpbmRvd10gfVwiO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBnbG9iYWxUaGlzICE9PSBcInVuZGVmaW5lZFwiICYmIG9iaiA9PT0gZ2xvYmFsVGhpcyB8fCB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiICYmIG9iaiA9PT0gZ2xvYmFsKSB7XG4gICAgICAgIHJldHVybiBcInsgW29iamVjdCBnbG9iYWxUaGlzXSB9XCI7XG4gICAgICB9XG4gICAgICBpZiAoIWlzRGF0ZShvYmopICYmICFpc1JlZ0V4cChvYmopKSB7XG4gICAgICAgIHZhciB5cyA9IGFyck9iaktleXMob2JqLCBpbnNwZWN0Myk7XG4gICAgICAgIHZhciBpc1BsYWluT2JqZWN0ID0gZ1BPID8gZ1BPKG9iaikgPT09IE9iamVjdC5wcm90b3R5cGUgOiBvYmogaW5zdGFuY2VvZiBPYmplY3QgfHwgb2JqLmNvbnN0cnVjdG9yID09PSBPYmplY3Q7XG4gICAgICAgIHZhciBwcm90b1RhZyA9IG9iaiBpbnN0YW5jZW9mIE9iamVjdCA/IFwiXCIgOiBcIm51bGwgcHJvdG90eXBlXCI7XG4gICAgICAgIHZhciBzdHJpbmdUYWcgPSAhaXNQbGFpbk9iamVjdCAmJiB0b1N0cmluZ1RhZyAmJiBPYmplY3Qob2JqKSA9PT0gb2JqICYmIHRvU3RyaW5nVGFnIGluIG9iaiA/ICRzbGljZS5jYWxsKHRvU3RyKG9iaiksIDgsIC0xKSA6IHByb3RvVGFnID8gXCJPYmplY3RcIiA6IFwiXCI7XG4gICAgICAgIHZhciBjb25zdHJ1Y3RvclRhZyA9IGlzUGxhaW5PYmplY3QgfHwgdHlwZW9mIG9iai5jb25zdHJ1Y3RvciAhPT0gXCJmdW5jdGlvblwiID8gXCJcIiA6IG9iai5jb25zdHJ1Y3Rvci5uYW1lID8gb2JqLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBcIiA6IFwiXCI7XG4gICAgICAgIHZhciB0YWcgPSBjb25zdHJ1Y3RvclRhZyArIChzdHJpbmdUYWcgfHwgcHJvdG9UYWcgPyBcIltcIiArICRqb2luLmNhbGwoJGNvbmNhdC5jYWxsKFtdLCBzdHJpbmdUYWcgfHwgW10sIHByb3RvVGFnIHx8IFtdKSwgXCI6IFwiKSArIFwiXSBcIiA6IFwiXCIpO1xuICAgICAgICBpZiAoeXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIHRhZyArIFwie31cIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZW50KSB7XG4gICAgICAgICAgcmV0dXJuIHRhZyArIFwie1wiICsgaW5kZW50ZWRKb2luKHlzLCBpbmRlbnQpICsgXCJ9XCI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhZyArIFwieyBcIiArICRqb2luLmNhbGwoeXMsIFwiLCBcIikgKyBcIiB9XCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gU3RyaW5nKG9iaik7XG4gICAgfTtcbiAgICBmdW5jdGlvbiB3cmFwUXVvdGVzKHMsIGRlZmF1bHRTdHlsZSwgb3B0cykge1xuICAgICAgdmFyIHN0eWxlID0gb3B0cy5xdW90ZVN0eWxlIHx8IGRlZmF1bHRTdHlsZTtcbiAgICAgIHZhciBxdW90ZUNoYXIgPSBxdW90ZXNbc3R5bGVdO1xuICAgICAgcmV0dXJuIHF1b3RlQ2hhciArIHMgKyBxdW90ZUNoYXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHF1b3RlKHMpIHtcbiAgICAgIHJldHVybiAkcmVwbGFjZS5jYWxsKFN0cmluZyhzKSwgL1wiL2csIFwiJnF1b3Q7XCIpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjYW5UcnVzdFRvU3RyaW5nKG9iaikge1xuICAgICAgcmV0dXJuICF0b1N0cmluZ1RhZyB8fCAhKHR5cGVvZiBvYmogPT09IFwib2JqZWN0XCIgJiYgKHRvU3RyaW5nVGFnIGluIG9iaiB8fCB0eXBlb2Ygb2JqW3RvU3RyaW5nVGFnXSAhPT0gXCJ1bmRlZmluZWRcIikpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc0FycmF5KG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIiAmJiBjYW5UcnVzdFRvU3RyaW5nKG9iaik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzRGF0ZShvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cihvYmopID09PSBcIltvYmplY3QgRGF0ZV1cIiAmJiBjYW5UcnVzdFRvU3RyaW5nKG9iaik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzUmVnRXhwKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBSZWdFeHBdXCIgJiYgY2FuVHJ1c3RUb1N0cmluZyhvYmopO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc0Vycm9yKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBFcnJvcl1cIiAmJiBjYW5UcnVzdFRvU3RyaW5nKG9iaik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzU3RyaW5nKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBTdHJpbmddXCIgJiYgY2FuVHJ1c3RUb1N0cmluZyhvYmopO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc051bWJlcihvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cihvYmopID09PSBcIltvYmplY3QgTnVtYmVyXVwiICYmIGNhblRydXN0VG9TdHJpbmcob2JqKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNCb29sZWFuKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBCb29sZWFuXVwiICYmIGNhblRydXN0VG9TdHJpbmcob2JqKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNTeW1ib2wob2JqKSB7XG4gICAgICBpZiAoaGFzU2hhbW1lZFN5bWJvbHMpIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiICYmIG9iaiBpbnN0YW5jZW9mIFN5bWJvbDtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcInN5bWJvbFwiKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFvYmogfHwgdHlwZW9mIG9iaiAhPT0gXCJvYmplY3RcIiB8fCAhc3ltVG9TdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgc3ltVG9TdHJpbmcuY2FsbChvYmopO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNCaWdJbnQob2JqKSB7XG4gICAgICBpZiAoIW9iaiB8fCB0eXBlb2Ygb2JqICE9PSBcIm9iamVjdFwiIHx8ICFiaWdJbnRWYWx1ZU9mKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIGJpZ0ludFZhbHVlT2YuY2FsbChvYmopO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdmFyIGhhc093bjIgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5IHx8IGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGtleSBpbiB0aGlzO1xuICAgIH07XG4gICAgZnVuY3Rpb24gaGFzKG9iaiwga2V5KSB7XG4gICAgICByZXR1cm4gaGFzT3duMi5jYWxsKG9iaiwga2V5KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gdG9TdHIob2JqKSB7XG4gICAgICByZXR1cm4gb2JqZWN0VG9TdHJpbmcuY2FsbChvYmopO1xuICAgIH1cbiAgICBmdW5jdGlvbiBuYW1lT2YoZikge1xuICAgICAgaWYgKGYubmFtZSkge1xuICAgICAgICByZXR1cm4gZi5uYW1lO1xuICAgICAgfVxuICAgICAgdmFyIG0gPSAkbWF0Y2guY2FsbChmdW5jdGlvblRvU3RyaW5nLmNhbGwoZiksIC9eZnVuY3Rpb25cXHMqKFtcXHckXSspLyk7XG4gICAgICBpZiAobSkge1xuICAgICAgICByZXR1cm4gbVsxXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpbmRleE9mKHhzLCB4KSB7XG4gICAgICBpZiAoeHMuaW5kZXhPZikge1xuICAgICAgICByZXR1cm4geHMuaW5kZXhPZih4KTtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0geHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGlmICh4c1tpXSA9PT0geCkge1xuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzTWFwKHgpIHtcbiAgICAgIGlmICghbWFwU2l6ZSB8fCAheCB8fCB0eXBlb2YgeCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBtYXBTaXplLmNhbGwoeCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgc2V0U2l6ZS5jYWxsKHgpO1xuICAgICAgICB9IGNhdGNoIChzKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHggaW5zdGFuY2VvZiBNYXA7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzV2Vha01hcCh4KSB7XG4gICAgICBpZiAoIXdlYWtNYXBIYXMgfHwgIXggfHwgdHlwZW9mIHggIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgd2Vha01hcEhhcy5jYWxsKHgsIHdlYWtNYXBIYXMpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdlYWtTZXRIYXMuY2FsbCh4LCB3ZWFrU2V0SGFzKTtcbiAgICAgICAgfSBjYXRjaCAocykge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB4IGluc3RhbmNlb2YgV2Vha01hcDtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNXZWFrUmVmKHgpIHtcbiAgICAgIGlmICghd2Vha1JlZkRlcmVmIHx8ICF4IHx8IHR5cGVvZiB4ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHdlYWtSZWZEZXJlZi5jYWxsKHgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNTZXQoeCkge1xuICAgICAgaWYgKCFzZXRTaXplIHx8ICF4IHx8IHR5cGVvZiB4ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHNldFNpemUuY2FsbCh4KTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtYXBTaXplLmNhbGwoeCk7XG4gICAgICAgIH0gY2F0Y2ggKG0pIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geCBpbnN0YW5jZW9mIFNldDtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNXZWFrU2V0KHgpIHtcbiAgICAgIGlmICghd2Vha1NldEhhcyB8fCAheCB8fCB0eXBlb2YgeCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICB3ZWFrU2V0SGFzLmNhbGwoeCwgd2Vha1NldEhhcyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2Vha01hcEhhcy5jYWxsKHgsIHdlYWtNYXBIYXMpO1xuICAgICAgICB9IGNhdGNoIChzKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHggaW5zdGFuY2VvZiBXZWFrU2V0O1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc0VsZW1lbnQoeCkge1xuICAgICAgaWYgKCF4IHx8IHR5cGVvZiB4ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgSFRNTEVsZW1lbnQgIT09IFwidW5kZWZpbmVkXCIgJiYgeCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHR5cGVvZiB4Lm5vZGVOYW1lID09PSBcInN0cmluZ1wiICYmIHR5cGVvZiB4LmdldEF0dHJpYnV0ZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpbnNwZWN0U3RyaW5nKHN0ciwgb3B0cykge1xuICAgICAgaWYgKHN0ci5sZW5ndGggPiBvcHRzLm1heFN0cmluZ0xlbmd0aCkge1xuICAgICAgICB2YXIgcmVtYWluaW5nID0gc3RyLmxlbmd0aCAtIG9wdHMubWF4U3RyaW5nTGVuZ3RoO1xuICAgICAgICB2YXIgdHJhaWxlciA9IFwiLi4uIFwiICsgcmVtYWluaW5nICsgXCIgbW9yZSBjaGFyYWN0ZXJcIiArIChyZW1haW5pbmcgPiAxID8gXCJzXCIgOiBcIlwiKTtcbiAgICAgICAgcmV0dXJuIGluc3BlY3RTdHJpbmcoJHNsaWNlLmNhbGwoc3RyLCAwLCBvcHRzLm1heFN0cmluZ0xlbmd0aCksIG9wdHMpICsgdHJhaWxlcjtcbiAgICAgIH1cbiAgICAgIHZhciBxdW90ZVJFID0gcXVvdGVSRXNbb3B0cy5xdW90ZVN0eWxlIHx8IFwic2luZ2xlXCJdO1xuICAgICAgcXVvdGVSRS5sYXN0SW5kZXggPSAwO1xuICAgICAgdmFyIHMgPSAkcmVwbGFjZS5jYWxsKCRyZXBsYWNlLmNhbGwoc3RyLCBxdW90ZVJFLCBcIlxcXFwkMVwiKSwgL1tcXHgwMC1cXHgxZl0vZywgbG93Ynl0ZSk7XG4gICAgICByZXR1cm4gd3JhcFF1b3RlcyhzLCBcInNpbmdsZVwiLCBvcHRzKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbG93Ynl0ZShjKSB7XG4gICAgICB2YXIgbiA9IGMuY2hhckNvZGVBdCgwKTtcbiAgICAgIHZhciB4ID0ge1xuICAgICAgICA4OiBcImJcIixcbiAgICAgICAgOTogXCJ0XCIsXG4gICAgICAgIDEwOiBcIm5cIixcbiAgICAgICAgMTI6IFwiZlwiLFxuICAgICAgICAxMzogXCJyXCJcbiAgICAgIH1bbl07XG4gICAgICBpZiAoeCkge1xuICAgICAgICByZXR1cm4gXCJcXFxcXCIgKyB4O1xuICAgICAgfVxuICAgICAgcmV0dXJuIFwiXFxcXHhcIiArIChuIDwgMTYgPyBcIjBcIiA6IFwiXCIpICsgJHRvVXBwZXJDYXNlLmNhbGwobi50b1N0cmluZygxNikpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBtYXJrQm94ZWQoc3RyKSB7XG4gICAgICByZXR1cm4gXCJPYmplY3QoXCIgKyBzdHIgKyBcIilcIjtcbiAgICB9XG4gICAgZnVuY3Rpb24gd2Vha0NvbGxlY3Rpb25PZih0eXBlKSB7XG4gICAgICByZXR1cm4gdHlwZSArIFwiIHsgPyB9XCI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNvbGxlY3Rpb25PZih0eXBlLCBzaXplLCBlbnRyaWVzLCBpbmRlbnQpIHtcbiAgICAgIHZhciBqb2luZWRFbnRyaWVzID0gaW5kZW50ID8gaW5kZW50ZWRKb2luKGVudHJpZXMsIGluZGVudCkgOiAkam9pbi5jYWxsKGVudHJpZXMsIFwiLCBcIik7XG4gICAgICByZXR1cm4gdHlwZSArIFwiIChcIiArIHNpemUgKyBcIikge1wiICsgam9pbmVkRW50cmllcyArIFwifVwiO1xuICAgIH1cbiAgICBmdW5jdGlvbiBzaW5nbGVMaW5lVmFsdWVzKHhzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpbmRleE9mKHhzW2ldLCBcIlxcblwiKSA+PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZ2V0SW5kZW50KG9wdHMsIGRlcHRoKSB7XG4gICAgICB2YXIgYmFzZUluZGVudDtcbiAgICAgIGlmIChvcHRzLmluZGVudCA9PT0gXCJcdFwiKSB7XG4gICAgICAgIGJhc2VJbmRlbnQgPSBcIlx0XCI7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBvcHRzLmluZGVudCA9PT0gXCJudW1iZXJcIiAmJiBvcHRzLmluZGVudCA+IDApIHtcbiAgICAgICAgYmFzZUluZGVudCA9ICRqb2luLmNhbGwoQXJyYXkob3B0cy5pbmRlbnQgKyAxKSwgXCIgXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICBiYXNlOiBiYXNlSW5kZW50LFxuICAgICAgICBwcmV2OiAkam9pbi5jYWxsKEFycmF5KGRlcHRoICsgMSksIGJhc2VJbmRlbnQpXG4gICAgICB9O1xuICAgIH1cbiAgICBmdW5jdGlvbiBpbmRlbnRlZEpvaW4oeHMsIGluZGVudCkge1xuICAgICAgaWYgKHhzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgIH1cbiAgICAgIHZhciBsaW5lSm9pbmVyID0gXCJcXG5cIiArIGluZGVudC5wcmV2ICsgaW5kZW50LmJhc2U7XG4gICAgICByZXR1cm4gbGluZUpvaW5lciArICRqb2luLmNhbGwoeHMsIFwiLFwiICsgbGluZUpvaW5lcikgKyBcIlxcblwiICsgaW5kZW50LnByZXY7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGFyck9iaktleXMob2JqLCBpbnNwZWN0Mykge1xuICAgICAgdmFyIGlzQXJyID0gaXNBcnJheShvYmopO1xuICAgICAgdmFyIHhzID0gW107XG4gICAgICBpZiAoaXNBcnIpIHtcbiAgICAgICAgeHMubGVuZ3RoID0gb2JqLmxlbmd0aDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB4c1tpXSA9IGhhcyhvYmosIGkpID8gaW5zcGVjdDMob2JqW2ldLCBvYmopIDogXCJcIjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdmFyIHN5bXMgPSB0eXBlb2YgZ09QUyA9PT0gXCJmdW5jdGlvblwiID8gZ09QUyhvYmopIDogW107XG4gICAgICB2YXIgc3ltTWFwO1xuICAgICAgaWYgKGhhc1NoYW1tZWRTeW1ib2xzKSB7XG4gICAgICAgIHN5bU1hcCA9IHt9O1xuICAgICAgICBmb3IgKHZhciBrID0gMDsgayA8IHN5bXMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICBzeW1NYXBbXCIkXCIgKyBzeW1zW2tdXSA9IHN5bXNba107XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKCFoYXMob2JqLCBrZXkpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzQXJyICYmIFN0cmluZyhOdW1iZXIoa2V5KSkgPT09IGtleSAmJiBrZXkgPCBvYmoubGVuZ3RoKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhhc1NoYW1tZWRTeW1ib2xzICYmIHN5bU1hcFtcIiRcIiArIGtleV0gaW5zdGFuY2VvZiBTeW1ib2wpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSBlbHNlIGlmICgkdGVzdC5jYWxsKC9bXlxcdyRdLywga2V5KSkge1xuICAgICAgICAgIHhzLnB1c2goaW5zcGVjdDMoa2V5LCBvYmopICsgXCI6IFwiICsgaW5zcGVjdDMob2JqW2tleV0sIG9iaikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHhzLnB1c2goa2V5ICsgXCI6IFwiICsgaW5zcGVjdDMob2JqW2tleV0sIG9iaikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGdPUFMgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHN5bXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBpZiAoaXNFbnVtZXJhYmxlLmNhbGwob2JqLCBzeW1zW2pdKSkge1xuICAgICAgICAgICAgeHMucHVzaChcIltcIiArIGluc3BlY3QzKHN5bXNbal0pICsgXCJdOiBcIiArIGluc3BlY3QzKG9ialtzeW1zW2pdXSwgb2JqKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4geHM7XG4gICAgfVxuICB9XG59KTtcblxuLy8gc3JjL2xpYi9iaW5hcnlfcmVhZGVyLnRzXG52YXIgdGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoXCJ1dGYtOFwiKTtcbnZhciBCaW5hcnlSZWFkZXIgPSBjbGFzcyB7XG4gIC8qKlxuICAgKiBUaGUgRGF0YVZpZXcgdXNlZCB0byByZWFkIHZhbHVlcyBmcm9tIHRoZSBiaW5hcnkgZGF0YS5cbiAgICpcbiAgICogTm90ZTogVGhlIERhdGFWaWV3J3MgYGJ5dGVPZmZzZXRgIGlzIHJlbGF0aXZlIHRvIHRoZSBiZWdpbm5pbmcgb2YgdGhlXG4gICAqIHVuZGVybHlpbmcgQXJyYXlCdWZmZXIsIG5vdCB0aGUgc3RhcnQgb2YgdGhlIHByb3ZpZGVkIFVpbnQ4QXJyYXkgaW5wdXQuXG4gICAqIFRoaXMgYEJpbmFyeVJlYWRlcmAncyBgI29mZnNldGAgZmllbGQgaXMgdXNlZCB0byB0cmFjayB0aGUgY3VycmVudCByZWFkIHBvc2l0aW9uXG4gICAqIHJlbGF0aXZlIHRvIHRoZSBzdGFydCBvZiB0aGUgcHJvdmlkZWQgVWludDhBcnJheSBpbnB1dC5cbiAgICovXG4gIHZpZXc7XG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBvZmZzZXQgKGluIGJ5dGVzKSByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIERhdGFWaWV3XG4gICAqIGFuZCBwcm92aWRlZCBVaW50OEFycmF5IGlucHV0LlxuICAgKlxuICAgKiBOb3RlOiBUaGlzIGlzICpub3QqIHRoZSBhYnNvbHV0ZSBieXRlIG9mZnNldCB3aXRoaW4gdGhlIHVuZGVybHlpbmcgQXJyYXlCdWZmZXIuXG4gICAqL1xuICBvZmZzZXQgPSAwO1xuICBjb25zdHJ1Y3RvcihpbnB1dCkge1xuICAgIHRoaXMudmlldyA9IGlucHV0IGluc3RhbmNlb2YgRGF0YVZpZXcgPyBpbnB1dCA6IG5ldyBEYXRhVmlldyhpbnB1dC5idWZmZXIsIGlucHV0LmJ5dGVPZmZzZXQsIGlucHV0LmJ5dGVMZW5ndGgpO1xuICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgfVxuICByZXNldChpbnB1dCkge1xuICAgIHRoaXMudmlldyA9IGlucHV0IGluc3RhbmNlb2YgRGF0YVZpZXcgPyBpbnB1dCA6IG5ldyBEYXRhVmlldyhpbnB1dC5idWZmZXIsIGlucHV0LmJ5dGVPZmZzZXQsIGlucHV0LmJ5dGVMZW5ndGgpO1xuICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgfVxuICBnZXQgcmVtYWluaW5nKCkge1xuICAgIHJldHVybiB0aGlzLnZpZXcuYnl0ZUxlbmd0aCAtIHRoaXMub2Zmc2V0O1xuICB9XG4gIC8qKiBFbnN1cmUgd2UgaGF2ZSBhdCBsZWFzdCBgbmAgYnl0ZXMgbGVmdCB0byByZWFkICovXG4gICNlbnN1cmUobikge1xuICAgIGlmICh0aGlzLm9mZnNldCArIG4gPiB0aGlzLnZpZXcuYnl0ZUxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXG4gICAgICAgIGBUcmllZCB0byByZWFkICR7bn0gYnl0ZShzKSBhdCByZWxhdGl2ZSBvZmZzZXQgJHt0aGlzLm9mZnNldH0sIGJ1dCBvbmx5ICR7dGhpcy5yZW1haW5pbmd9IGJ5dGUocykgcmVtYWluYFxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgcmVhZFVJbnQ4QXJyYXkoKSB7XG4gICAgY29uc3QgbGVuZ3RoID0gdGhpcy5yZWFkVTMyKCk7XG4gICAgdGhpcy4jZW5zdXJlKGxlbmd0aCk7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJ5dGVzKGxlbmd0aCkuc2xpY2UoKTtcbiAgfVxuICByZWFkQm9vbCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMudmlldy5nZXRVaW50OCh0aGlzLm9mZnNldCk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTtcbiAgICByZXR1cm4gdmFsdWUgIT09IDA7XG4gIH1cbiAgcmVhZEJ5dGUoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0VWludDgodGhpcy5vZmZzZXQpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRCeXRlcyhsZW5ndGgpIHtcbiAgICBjb25zdCBhcnJheSA9IG5ldyBVaW50OEFycmF5KFxuICAgICAgdGhpcy52aWV3LmJ1ZmZlcixcbiAgICAgIHRoaXMudmlldy5ieXRlT2Zmc2V0ICsgdGhpcy5vZmZzZXQsXG4gICAgICBsZW5ndGhcbiAgICApO1xuICAgIHRoaXMub2Zmc2V0ICs9IGxlbmd0aDtcbiAgICByZXR1cm4gYXJyYXk7XG4gIH1cbiAgcmVhZEk4KCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldEludDgodGhpcy5vZmZzZXQpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRVOCgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQnl0ZSgpO1xuICB9XG4gIHJlYWRJMTYoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0SW50MTYodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDI7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRVMTYoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0VWludDE2KHRoaXMub2Zmc2V0LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAyO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICByZWFkSTMyKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldEludDMyKHRoaXMub2Zmc2V0LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSA0O1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICByZWFkVTMyKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldFVpbnQzMih0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gNDtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgcmVhZEk2NCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMudmlldy5nZXRCaWdJbnQ2NCh0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgcmVhZFU2NCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDg7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRVMTI4KCkge1xuICAgIGNvbnN0IGxvd2VyUGFydCA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIGNvbnN0IHVwcGVyUGFydCA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxNjtcbiAgICByZXR1cm4gKHVwcGVyUGFydCA8PCBCaWdJbnQoNjQpKSArIGxvd2VyUGFydDtcbiAgfVxuICByZWFkSTEyOCgpIHtcbiAgICBjb25zdCBsb3dlclBhcnQgPSB0aGlzLnZpZXcuZ2V0QmlnVWludDY0KHRoaXMub2Zmc2V0LCB0cnVlKTtcbiAgICBjb25zdCB1cHBlclBhcnQgPSB0aGlzLnZpZXcuZ2V0QmlnSW50NjQodGhpcy5vZmZzZXQgKyA4LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxNjtcbiAgICByZXR1cm4gKHVwcGVyUGFydCA8PCBCaWdJbnQoNjQpKSArIGxvd2VyUGFydDtcbiAgfVxuICByZWFkVTI1NigpIHtcbiAgICBjb25zdCBwMCA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIGNvbnN0IHAxID0gdGhpcy52aWV3LmdldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDgsIHRydWUpO1xuICAgIGNvbnN0IHAyID0gdGhpcy52aWV3LmdldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDE2LCB0cnVlKTtcbiAgICBjb25zdCBwMyA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyAyNCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMzI7XG4gICAgcmV0dXJuIChwMyA8PCBCaWdJbnQoMyAqIDY0KSkgKyAocDIgPDwgQmlnSW50KDIgKiA2NCkpICsgKHAxIDw8IEJpZ0ludCgxICogNjQpKSArIHAwO1xuICB9XG4gIHJlYWRJMjU2KCkge1xuICAgIGNvbnN0IHAwID0gdGhpcy52aWV3LmdldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgY29uc3QgcDEgPSB0aGlzLnZpZXcuZ2V0QmlnVWludDY0KHRoaXMub2Zmc2V0ICsgOCwgdHJ1ZSk7XG4gICAgY29uc3QgcDIgPSB0aGlzLnZpZXcuZ2V0QmlnVWludDY0KHRoaXMub2Zmc2V0ICsgMTYsIHRydWUpO1xuICAgIGNvbnN0IHAzID0gdGhpcy52aWV3LmdldEJpZ0ludDY0KHRoaXMub2Zmc2V0ICsgMjQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDMyO1xuICAgIHJldHVybiAocDMgPDwgQmlnSW50KDMgKiA2NCkpICsgKHAyIDw8IEJpZ0ludCgyICogNjQpKSArIChwMSA8PCBCaWdJbnQoMSAqIDY0KSkgKyBwMDtcbiAgfVxuICByZWFkRjMyKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldEZsb2F0MzIodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDQ7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRGNjQoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0RmxvYXQ2NCh0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgcmVhZFN0cmluZygpIHtcbiAgICBjb25zdCBsZW5ndGggPSB0aGlzLnJlYWRVMzIoKTtcbiAgICB0aGlzLiNlbnN1cmUobGVuZ3RoKTtcbiAgICBjb25zdCBieXRlcyA9IHRoaXMucmVhZEJ5dGVzKGxlbmd0aCk7XG4gICAgcmV0dXJuIHRleHREZWNvZGVyLmRlY29kZShieXRlcyk7XG4gIH1cbn07XG5cbi8vIHNyYy9saWIvYmluYXJ5X3dyaXRlci50c1xudmFyIGltcG9ydF9iYXNlNjRfanMgPSBfX3RvRVNNKHJlcXVpcmVfYmFzZTY0X2pzKCkpO1xudmFyIHRleHRFbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG52YXIgQXJyYXlCdWZmZXJQcm90b3R5cGVUcmFuc2ZlciA9IEFycmF5QnVmZmVyLnByb3RvdHlwZS50cmFuc2ZlciA/PyBmdW5jdGlvbihuZXdCeXRlTGVuZ3RoKSB7XG4gIGlmIChuZXdCeXRlTGVuZ3RoID09PSB2b2lkIDApIHtcbiAgICByZXR1cm4gdGhpcy5zbGljZSgpO1xuICB9IGVsc2UgaWYgKG5ld0J5dGVMZW5ndGggPD0gdGhpcy5ieXRlTGVuZ3RoKSB7XG4gICAgcmV0dXJuIHRoaXMuc2xpY2UoMCwgbmV3Qnl0ZUxlbmd0aCk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY29weSA9IG5ldyBVaW50OEFycmF5KG5ld0J5dGVMZW5ndGgpO1xuICAgIGNvcHkuc2V0KG5ldyBVaW50OEFycmF5KHRoaXMpKTtcbiAgICByZXR1cm4gY29weS5idWZmZXI7XG4gIH1cbn07XG52YXIgUmVzaXphYmxlQnVmZmVyID0gY2xhc3Mge1xuICBidWZmZXI7XG4gIHZpZXc7XG4gIGNvbnN0cnVjdG9yKGluaXQpIHtcbiAgICB0aGlzLmJ1ZmZlciA9IHR5cGVvZiBpbml0ID09PSBcIm51bWJlclwiID8gbmV3IEFycmF5QnVmZmVyKGluaXQpIDogaW5pdDtcbiAgICB0aGlzLnZpZXcgPSBuZXcgRGF0YVZpZXcodGhpcy5idWZmZXIpO1xuICB9XG4gIGdldCBjYXBhY2l0eSgpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXIuYnl0ZUxlbmd0aDtcbiAgfVxuICBncm93KG5ld1NpemUpIHtcbiAgICBpZiAobmV3U2l6ZSA8PSB0aGlzLmJ1ZmZlci5ieXRlTGVuZ3RoKSByZXR1cm47XG4gICAgdGhpcy5idWZmZXIgPSBBcnJheUJ1ZmZlclByb3RvdHlwZVRyYW5zZmVyLmNhbGwodGhpcy5idWZmZXIsIG5ld1NpemUpO1xuICAgIHRoaXMudmlldyA9IG5ldyBEYXRhVmlldyh0aGlzLmJ1ZmZlcik7XG4gIH1cbn07XG52YXIgQmluYXJ5V3JpdGVyID0gY2xhc3Mge1xuICBidWZmZXI7XG4gIG9mZnNldCA9IDA7XG4gIGNvbnN0cnVjdG9yKGluaXQpIHtcbiAgICB0aGlzLmJ1ZmZlciA9IHR5cGVvZiBpbml0ID09PSBcIm51bWJlclwiID8gbmV3IFJlc2l6YWJsZUJ1ZmZlcihpbml0KSA6IGluaXQ7XG4gIH1cbiAgY2xlYXIoKSB7XG4gICAgdGhpcy5vZmZzZXQgPSAwO1xuICB9XG4gIHJlc2V0KGJ1ZmZlcikge1xuICAgIHRoaXMuYnVmZmVyID0gYnVmZmVyO1xuICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgfVxuICBleHBhbmRCdWZmZXIoYWRkaXRpb25hbENhcGFjaXR5KSB7XG4gICAgY29uc3QgbWluQ2FwYWNpdHkgPSB0aGlzLm9mZnNldCArIGFkZGl0aW9uYWxDYXBhY2l0eSArIDE7XG4gICAgaWYgKG1pbkNhcGFjaXR5IDw9IHRoaXMuYnVmZmVyLmNhcGFjaXR5KSByZXR1cm47XG4gICAgbGV0IG5ld0NhcGFjaXR5ID0gdGhpcy5idWZmZXIuY2FwYWNpdHkgKiAyO1xuICAgIGlmIChuZXdDYXBhY2l0eSA8IG1pbkNhcGFjaXR5KSBuZXdDYXBhY2l0eSA9IG1pbkNhcGFjaXR5O1xuICAgIHRoaXMuYnVmZmVyLmdyb3cobmV3Q2FwYWNpdHkpO1xuICB9XG4gIHRvQmFzZTY0KCkge1xuICAgIHJldHVybiAoMCwgaW1wb3J0X2Jhc2U2NF9qcy5mcm9tQnl0ZUFycmF5KSh0aGlzLmdldEJ1ZmZlcigpKTtcbiAgfVxuICBnZXRCdWZmZXIoKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLmJ1ZmZlciwgMCwgdGhpcy5vZmZzZXQpO1xuICB9XG4gIGdldCB2aWV3KCkge1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlci52aWV3O1xuICB9XG4gIHdyaXRlVUludDhBcnJheSh2YWx1ZSkge1xuICAgIGNvbnN0IGxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcig0ICsgbGVuZ3RoKTtcbiAgICB0aGlzLndyaXRlVTMyKGxlbmd0aCk7XG4gICAgbmV3IFVpbnQ4QXJyYXkodGhpcy5idWZmZXIuYnVmZmVyLCB0aGlzLm9mZnNldCkuc2V0KHZhbHVlKTtcbiAgICB0aGlzLm9mZnNldCArPSBsZW5ndGg7XG4gIH1cbiAgd3JpdGVCb29sKHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMSk7XG4gICAgdGhpcy52aWV3LnNldFVpbnQ4KHRoaXMub2Zmc2V0LCB2YWx1ZSA/IDEgOiAwKTtcbiAgICB0aGlzLm9mZnNldCArPSAxO1xuICB9XG4gIHdyaXRlQnl0ZSh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDEpO1xuICAgIHRoaXMudmlldy5zZXRVaW50OCh0aGlzLm9mZnNldCwgdmFsdWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE7XG4gIH1cbiAgd3JpdGVCeXRlcyh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKHZhbHVlLmxlbmd0aCk7XG4gICAgbmV3IFVpbnQ4QXJyYXkodGhpcy5idWZmZXIuYnVmZmVyLCB0aGlzLm9mZnNldCwgdmFsdWUubGVuZ3RoKS5zZXQodmFsdWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IHZhbHVlLmxlbmd0aDtcbiAgfVxuICB3cml0ZUk4KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMSk7XG4gICAgdGhpcy52aWV3LnNldEludDgodGhpcy5vZmZzZXQsIHZhbHVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxO1xuICB9XG4gIHdyaXRlVTgodmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcigxKTtcbiAgICB0aGlzLnZpZXcuc2V0VWludDgodGhpcy5vZmZzZXQsIHZhbHVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxO1xuICB9XG4gIHdyaXRlSTE2KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMik7XG4gICAgdGhpcy52aWV3LnNldEludDE2KHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMjtcbiAgfVxuICB3cml0ZVUxNih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDIpO1xuICAgIHRoaXMudmlldy5zZXRVaW50MTYodGhpcy5vZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAyO1xuICB9XG4gIHdyaXRlSTMyKHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoNCk7XG4gICAgdGhpcy52aWV3LnNldEludDMyKHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gNDtcbiAgfVxuICB3cml0ZVUzMih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDQpO1xuICAgIHRoaXMudmlldy5zZXRVaW50MzIodGhpcy5vZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSA0O1xuICB9XG4gIHdyaXRlSTY0KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoOCk7XG4gICAgdGhpcy52aWV3LnNldEJpZ0ludDY0KHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgfVxuICB3cml0ZVU2NCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDgpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSA4O1xuICB9XG4gIHdyaXRlVTEyOCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDE2KTtcbiAgICBjb25zdCBsb3dlclBhcnQgPSB2YWx1ZSAmIEJpZ0ludChcIjB4RkZGRkZGRkZGRkZGRkZGRlwiKTtcbiAgICBjb25zdCB1cHBlclBhcnQgPSB2YWx1ZSA+PiBCaWdJbnQoNjQpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIGxvd2VyUGFydCwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDgsIHVwcGVyUGFydCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTY7XG4gIH1cbiAgd3JpdGVJMTI4KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMTYpO1xuICAgIGNvbnN0IGxvd2VyUGFydCA9IHZhbHVlICYgQmlnSW50KFwiMHhGRkZGRkZGRkZGRkZGRkZGXCIpO1xuICAgIGNvbnN0IHVwcGVyUGFydCA9IHZhbHVlID4+IEJpZ0ludCg2NCk7XG4gICAgdGhpcy52aWV3LnNldEJpZ0ludDY0KHRoaXMub2Zmc2V0LCBsb3dlclBhcnQsIHRydWUpO1xuICAgIHRoaXMudmlldy5zZXRCaWdJbnQ2NCh0aGlzLm9mZnNldCArIDgsIHVwcGVyUGFydCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTY7XG4gIH1cbiAgd3JpdGVVMjU2KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMzIpO1xuICAgIGNvbnN0IGxvd182NF9tYXNrID0gQmlnSW50KFwiMHhGRkZGRkZGRkZGRkZGRkZGXCIpO1xuICAgIGNvbnN0IHAwID0gdmFsdWUgJiBsb3dfNjRfbWFzaztcbiAgICBjb25zdCBwMSA9IHZhbHVlID4+IEJpZ0ludCg2NCAqIDEpICYgbG93XzY0X21hc2s7XG4gICAgY29uc3QgcDIgPSB2YWx1ZSA+PiBCaWdJbnQoNjQgKiAyKSAmIGxvd182NF9tYXNrO1xuICAgIGNvbnN0IHAzID0gdmFsdWUgPj4gQmlnSW50KDY0ICogMyk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAwLCBwMCwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAxLCBwMSwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAyLCBwMiwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAzLCBwMywgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMzI7XG4gIH1cbiAgd3JpdGVJMjU2KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMzIpO1xuICAgIGNvbnN0IGxvd182NF9tYXNrID0gQmlnSW50KFwiMHhGRkZGRkZGRkZGRkZGRkZGXCIpO1xuICAgIGNvbnN0IHAwID0gdmFsdWUgJiBsb3dfNjRfbWFzaztcbiAgICBjb25zdCBwMSA9IHZhbHVlID4+IEJpZ0ludCg2NCAqIDEpICYgbG93XzY0X21hc2s7XG4gICAgY29uc3QgcDIgPSB2YWx1ZSA+PiBCaWdJbnQoNjQgKiAyKSAmIGxvd182NF9tYXNrO1xuICAgIGNvbnN0IHAzID0gdmFsdWUgPj4gQmlnSW50KDY0ICogMyk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAwLCBwMCwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAxLCBwMSwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAyLCBwMiwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ0ludDY0KHRoaXMub2Zmc2V0ICsgOCAqIDMsIHAzLCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAzMjtcbiAgfVxuICB3cml0ZUYzMih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDQpO1xuICAgIHRoaXMudmlldy5zZXRGbG9hdDMyKHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gNDtcbiAgfVxuICB3cml0ZUY2NCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDgpO1xuICAgIHRoaXMudmlldy5zZXRGbG9hdDY0KHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgfVxuICB3cml0ZVN0cmluZyh2YWx1ZSkge1xuICAgIGNvbnN0IGxlbiA9IHZhbHVlLmxlbmd0aDtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcig0ICsgbGVuKTtcbiAgICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLmJ1ZmZlcik7XG4gICAgbGV0IG9mZnNldCA9IHRoaXMub2Zmc2V0ICsgNDtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yICg7IGkgPCBsZW47IGkrKykge1xuICAgICAgY29uc3QgYyA9IHZhbHVlLmNoYXJDb2RlQXQoaSk7XG4gICAgICBpZiAoYyA+PSAxMjgpIGJyZWFrO1xuICAgICAgYnl0ZXNbb2Zmc2V0KytdID0gYztcbiAgICB9XG4gICAgaWYgKGkgPT09IGxlbikge1xuICAgICAgdGhpcy52aWV3LnNldFVpbnQzMih0aGlzLm9mZnNldCwgbGVuLCB0cnVlKTtcbiAgICAgIHRoaXMub2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLndyaXRlVUludDhBcnJheSh0ZXh0RW5jb2Rlci5lbmNvZGUodmFsdWUpKTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi91dGlsLnRzXG5mdW5jdGlvbiBkZWVwRXF1YWwob2JqMSwgb2JqMikge1xuICBpZiAob2JqMSA9PT0gb2JqMikgcmV0dXJuIHRydWU7XG4gIGlmICh0eXBlb2Ygb2JqMSAhPT0gXCJvYmplY3RcIiB8fCBvYmoxID09PSBudWxsIHx8IHR5cGVvZiBvYmoyICE9PSBcIm9iamVjdFwiIHx8IG9iajIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgbGV0IGZpcnN0S2V5ID0gMDtcbiAgaWYgKG9iajEgaW5zdGFuY2VvZiBVaW50OEFycmF5ICYmIG9iajIgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgaWYgKG9iajEubGVuZ3RoICE9PSBvYmoyLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2JqMS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKG9iajFbaV0gIT09IG9iajJbaV0pIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZmlyc3RLZXkgPSBvYmoxLmxlbmd0aDtcbiAgfVxuICBjb25zdCBrZXlzMSA9IE9iamVjdC5rZXlzKG9iajEpO1xuICBjb25zdCBrZXlzMiA9IE9iamVjdC5rZXlzKG9iajIpO1xuICBpZiAoa2V5czEubGVuZ3RoICE9PSBrZXlzMi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgdmFsdWVzMSA9IG9iajE7XG4gIGNvbnN0IHZhbHVlczIgPSBvYmoyO1xuICBmb3IgKGxldCBpID0gZmlyc3RLZXk7IGkgPCBrZXlzMS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGtleXMxW2ldO1xuICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKG9iajIsIGtleSkgfHwgIWRlZXBFcXVhbCh2YWx1ZXMxW2tleV0sIHZhbHVlczJba2V5XSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5mdW5jdGlvbiB1aW50OEFycmF5VG9IZXhTdHJpbmcoYXJyYXkpIHtcbiAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChhcnJheS5yZXZlcnNlKCksICh4KSA9PiAoXCIwMFwiICsgeC50b1N0cmluZygxNikpLnNsaWNlKC0yKSkuam9pbihcIlwiKTtcbn1cbmZ1bmN0aW9uIHVpbnQ4QXJyYXlUb1UxMjgoYXJyYXkpIHtcbiAgaWYgKGFycmF5Lmxlbmd0aCAhPSAxNikge1xuICAgIHRocm93IG5ldyBFcnJvcihgVWludDhBcnJheSBpcyBub3QgMTYgYnl0ZXMgbG9uZzogJHthcnJheX1gKTtcbiAgfVxuICByZXR1cm4gbmV3IEJpbmFyeVJlYWRlcihhcnJheSkucmVhZFUxMjgoKTtcbn1cbmZ1bmN0aW9uIHVpbnQ4QXJyYXlUb1UyNTYoYXJyYXkpIHtcbiAgaWYgKGFycmF5Lmxlbmd0aCAhPSAzMikge1xuICAgIHRocm93IG5ldyBFcnJvcihgVWludDhBcnJheSBpcyBub3QgMzIgYnl0ZXMgbG9uZzogWyR7YXJyYXl9XWApO1xuICB9XG4gIHJldHVybiBuZXcgQmluYXJ5UmVhZGVyKGFycmF5KS5yZWFkVTI1NigpO1xufVxuZnVuY3Rpb24gaGV4U3RyaW5nVG9VaW50OEFycmF5KHN0cikge1xuICBpZiAoc3RyLnN0YXJ0c1dpdGgoXCIweFwiKSkge1xuICAgIHN0ciA9IHN0ci5zbGljZSgyKTtcbiAgfVxuICBjb25zdCBtYXRjaGVzID0gc3RyLm1hdGNoKC8uezEsMn0vZykgfHwgW107XG4gIGNvbnN0IGRhdGEgPSBVaW50OEFycmF5LmZyb20oXG4gICAgbWF0Y2hlcy5tYXAoKGJ5dGUpID0+IHBhcnNlSW50KGJ5dGUsIDE2KSlcbiAgKTtcbiAgcmV0dXJuIGRhdGEucmV2ZXJzZSgpO1xufVxuZnVuY3Rpb24gaGV4U3RyaW5nVG9VMTI4KHN0cikge1xuICByZXR1cm4gdWludDhBcnJheVRvVTEyOChoZXhTdHJpbmdUb1VpbnQ4QXJyYXkoc3RyKSk7XG59XG5mdW5jdGlvbiBoZXhTdHJpbmdUb1UyNTYoc3RyKSB7XG4gIHJldHVybiB1aW50OEFycmF5VG9VMjU2KGhleFN0cmluZ1RvVWludDhBcnJheShzdHIpKTtcbn1cbmZ1bmN0aW9uIHUxMjhUb1VpbnQ4QXJyYXkoZGF0YSkge1xuICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDE2KTtcbiAgd3JpdGVyLndyaXRlVTEyOChkYXRhKTtcbiAgcmV0dXJuIHdyaXRlci5nZXRCdWZmZXIoKTtcbn1cbmZ1bmN0aW9uIHUxMjhUb0hleFN0cmluZyhkYXRhKSB7XG4gIHJldHVybiB1aW50OEFycmF5VG9IZXhTdHJpbmcodTEyOFRvVWludDhBcnJheShkYXRhKSk7XG59XG5mdW5jdGlvbiB1MjU2VG9VaW50OEFycmF5KGRhdGEpIHtcbiAgY29uc3Qgd3JpdGVyID0gbmV3IEJpbmFyeVdyaXRlcigzMik7XG4gIHdyaXRlci53cml0ZVUyNTYoZGF0YSk7XG4gIHJldHVybiB3cml0ZXIuZ2V0QnVmZmVyKCk7XG59XG5mdW5jdGlvbiB1MjU2VG9IZXhTdHJpbmcoZGF0YSkge1xuICByZXR1cm4gdWludDhBcnJheVRvSGV4U3RyaW5nKHUyNTZUb1VpbnQ4QXJyYXkoZGF0YSkpO1xufVxuZnVuY3Rpb24gY29lcmNlVG9CaWdJbnQodmFsdWUsIHdoYXQpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJiaWdpbnRcIikgcmV0dXJuIHZhbHVlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSByZXR1cm4gQmlnSW50KHZhbHVlKTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiAmJiB2YWx1ZS50cmltKCkgIT09IFwiXCIpIHJldHVybiBCaWdJbnQodmFsdWUpO1xuICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgIGBDYW5ub3QgY29udmVydCAke3R5cGVvZiB2YWx1ZX0gdG8gJHt3aGF0fTogZXhwZWN0ZWQgYmlnaW50LCBpbnRlZ2VyIG51bWJlciwgb3IgZGVjaW1hbCBzdHJpbmdgXG4gICk7XG59XG5mdW5jdGlvbiB0b1Bhc2NhbENhc2Uocykge1xuICBjb25zdCBzdHIgPSB0b0NhbWVsQ2FzZShzKTtcbiAgcmV0dXJuIHN0ci5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0ci5zbGljZSgxKTtcbn1cbmZ1bmN0aW9uIHRvQ2FtZWxDYXNlKHMpIHtcbiAgY29uc3Qgc3RyID0gcy5yZXBsYWNlKC9bLV9dKy9nLCBcIl9cIikucmVwbGFjZSgvXyhbYS16QS1aMC05XSkvZywgKF8sIGMpID0+IGMudG9VcHBlckNhc2UoKSk7XG4gIHJldHVybiBzdHIuY2hhckF0KDApLnRvTG93ZXJDYXNlKCkgKyBzdHIuc2xpY2UoMSk7XG59XG5mdW5jdGlvbiBic2F0bkJhc2VTaXplKHR5cGVzcGFjZSwgdHkpIHtcbiAgY29uc3QgYXNzdW1lZEFycmF5TGVuZ3RoID0gNDtcbiAgd2hpbGUgKHR5LnRhZyA9PT0gXCJSZWZcIikgdHkgPSB0eXBlc3BhY2UudHlwZXNbdHkudmFsdWVdO1xuICBpZiAodHkudGFnID09PSBcIlByb2R1Y3RcIikge1xuICAgIGxldCBzdW0gPSAwO1xuICAgIGZvciAoY29uc3QgeyBhbGdlYnJhaWNUeXBlOiBlbGVtIH0gb2YgdHkudmFsdWUuZWxlbWVudHMpIHtcbiAgICAgIHN1bSArPSBic2F0bkJhc2VTaXplKHR5cGVzcGFjZSwgZWxlbSk7XG4gICAgfVxuICAgIHJldHVybiBzdW07XG4gIH0gZWxzZSBpZiAodHkudGFnID09PSBcIlN1bVwiKSB7XG4gICAgbGV0IG1pbiA9IEluZmluaXR5O1xuICAgIGZvciAoY29uc3QgeyBhbGdlYnJhaWNUeXBlOiB2YXJpIH0gb2YgdHkudmFsdWUudmFyaWFudHMpIHtcbiAgICAgIGNvbnN0IHZTaXplID0gYnNhdG5CYXNlU2l6ZSh0eXBlc3BhY2UsIHZhcmkpO1xuICAgICAgaWYgKHZTaXplIDwgbWluKSBtaW4gPSB2U2l6ZTtcbiAgICB9XG4gICAgaWYgKG1pbiA9PT0gSW5maW5pdHkpIG1pbiA9IDA7XG4gICAgcmV0dXJuIDQgKyBtaW47XG4gIH0gZWxzZSBpZiAodHkudGFnID09IFwiQXJyYXlcIikge1xuICAgIHJldHVybiA0ICsgYXNzdW1lZEFycmF5TGVuZ3RoICogYnNhdG5CYXNlU2l6ZSh0eXBlc3BhY2UsIHR5LnZhbHVlKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIFN0cmluZzogNCArIGFzc3VtZWRBcnJheUxlbmd0aCxcbiAgICBTdW06IDEsXG4gICAgQm9vbDogMSxcbiAgICBJODogMSxcbiAgICBVODogMSxcbiAgICBJMTY6IDIsXG4gICAgVTE2OiAyLFxuICAgIEkzMjogNCxcbiAgICBVMzI6IDQsXG4gICAgRjMyOiA0LFxuICAgIEk2NDogOCxcbiAgICBVNjQ6IDgsXG4gICAgRjY0OiA4LFxuICAgIEkxMjg6IDE2LFxuICAgIFUxMjg6IDE2LFxuICAgIEkyNTY6IDMyLFxuICAgIFUyNTY6IDMyXG4gIH1bdHkudGFnXTtcbn1cbnZhciBoYXNPd24gPSBPYmplY3QuaGFzT3duO1xuXG4vLyBzcmMvbGliL3RpbWVfZHVyYXRpb24udHNcbnZhciBUaW1lRHVyYXRpb24gPSBjbGFzcyBfVGltZUR1cmF0aW9uIHtcbiAgX190aW1lX2R1cmF0aW9uX21pY3Jvc19fO1xuICBzdGF0aWMgTUlDUk9TX1BFUl9NSUxMSVMgPSAxMDAwbjtcbiAgLyoqXG4gICAqIEdldCB0aGUgYWxnZWJyYWljIHR5cGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIHtAbGluayBUaW1lRHVyYXRpb259IHR5cGUuXG4gICAqIEByZXR1cm5zIFRoZSBhbGdlYnJhaWMgdHlwZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgdHlwZS5cbiAgICovXG4gIHN0YXRpYyBnZXRBbGdlYnJhaWNUeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlLlByb2R1Y3Qoe1xuICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IFwiX190aW1lX2R1cmF0aW9uX21pY3Jvc19fXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5JNjRcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuICB9XG4gIHN0YXRpYyBpc1RpbWVEdXJhdGlvbihhbGdlYnJhaWNUeXBlKSB7XG4gICAgaWYgKGFsZ2VicmFpY1R5cGUudGFnICE9PSBcIlByb2R1Y3RcIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBlbGVtZW50cyA9IGFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHM7XG4gICAgaWYgKGVsZW1lbnRzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBtaWNyb3NFbGVtZW50ID0gZWxlbWVudHNbMF07XG4gICAgcmV0dXJuIG1pY3Jvc0VsZW1lbnQubmFtZSA9PT0gXCJfX3RpbWVfZHVyYXRpb25fbWljcm9zX19cIiAmJiBtaWNyb3NFbGVtZW50LmFsZ2VicmFpY1R5cGUudGFnID09PSBcIkk2NFwiO1xuICB9XG4gIGdldCBtaWNyb3MoKSB7XG4gICAgcmV0dXJuIHRoaXMuX190aW1lX2R1cmF0aW9uX21pY3Jvc19fO1xuICB9XG4gIGdldCBtaWxsaXMoKSB7XG4gICAgcmV0dXJuIE51bWJlcih0aGlzLm1pY3JvcyAvIF9UaW1lRHVyYXRpb24uTUlDUk9TX1BFUl9NSUxMSVMpO1xuICB9XG4gIGNvbnN0cnVjdG9yKG1pY3Jvcykge1xuICAgIHRoaXMuX190aW1lX2R1cmF0aW9uX21pY3Jvc19fID0gY29lcmNlVG9CaWdJbnQobWljcm9zLCBcIlRpbWVEdXJhdGlvblwiKTtcbiAgfVxuICBzdGF0aWMgZnJvbU1pbGxpcyhtaWxsaXMpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lRHVyYXRpb24oQmlnSW50KG1pbGxpcykgKiBfVGltZUR1cmF0aW9uLk1JQ1JPU19QRVJfTUlMTElTKTtcbiAgfVxuICAvKiogVGhpcyBvdXRwdXRzIHRoZSBzYW1lIHN0cmluZyBmb3JtYXQgdGhhdCB3ZSB1c2UgaW4gdGhlIGhvc3QgYW5kIGluIFJ1c3QgbW9kdWxlcyAqL1xuICB0b1N0cmluZygpIHtcbiAgICBjb25zdCBtaWNyb3MgPSB0aGlzLm1pY3JvcztcbiAgICBjb25zdCBzaWduID0gbWljcm9zIDwgMCA/IFwiLVwiIDogXCIrXCI7XG4gICAgY29uc3QgcG9zID0gbWljcm9zIDwgMCA/IC1taWNyb3MgOiBtaWNyb3M7XG4gICAgY29uc3Qgc2VjcyA9IHBvcyAvIDEwMDAwMDBuO1xuICAgIGNvbnN0IG1pY3Jvc19yZW1haW5pbmcgPSBwb3MgJSAxMDAwMDAwbjtcbiAgICByZXR1cm4gYCR7c2lnbn0ke3NlY3N9LiR7U3RyaW5nKG1pY3Jvc19yZW1haW5pbmcpLnBhZFN0YXJ0KDYsIFwiMFwiKX1gO1xuICB9XG59O1xuXG4vLyBzcmMvbGliL3RpbWVzdGFtcC50c1xudmFyIFRpbWVzdGFtcCA9IGNsYXNzIF9UaW1lc3RhbXAge1xuICBfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fO1xuICBzdGF0aWMgTUlDUk9TX1BFUl9NSUxMSVMgPSAxMDAwbjtcbiAgZ2V0IG1pY3Jvc1NpbmNlVW5peEVwb2NoKCkge1xuICAgIHJldHVybiB0aGlzLl9fdGltZXN0YW1wX21pY3Jvc19zaW5jZV91bml4X2Vwb2NoX187XG4gIH1cbiAgY29uc3RydWN0b3IobWljcm9zKSB7XG4gICAgdGhpcy5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fID0gY29lcmNlVG9CaWdJbnQoXG4gICAgICBtaWNyb3MsXG4gICAgICBcIlRpbWVzdGFtcFwiXG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogR2V0IHRoZSBhbGdlYnJhaWMgdHlwZSByZXByZXNlbnRhdGlvbiBvZiB0aGUge0BsaW5rIFRpbWVzdGFtcH0gdHlwZS5cbiAgICogQHJldHVybnMgVGhlIGFsZ2VicmFpYyB0eXBlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0eXBlLlxuICAgKi9cbiAgc3RhdGljIGdldEFsZ2VicmFpY1R5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuUHJvZHVjdCh7XG4gICAgICBlbGVtZW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogXCJfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5JNjRcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuICB9XG4gIHN0YXRpYyBpc1RpbWVzdGFtcChhbGdlYnJhaWNUeXBlKSB7XG4gICAgaWYgKGFsZ2VicmFpY1R5cGUudGFnICE9PSBcIlByb2R1Y3RcIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBlbGVtZW50cyA9IGFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHM7XG4gICAgaWYgKGVsZW1lbnRzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBtaWNyb3NFbGVtZW50ID0gZWxlbWVudHNbMF07XG4gICAgcmV0dXJuIG1pY3Jvc0VsZW1lbnQubmFtZSA9PT0gXCJfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fXCIgJiYgbWljcm9zRWxlbWVudC5hbGdlYnJhaWNUeXBlLnRhZyA9PT0gXCJJNjRcIjtcbiAgfVxuICAvKipcbiAgICogVGhlIFVuaXggZXBvY2gsIHRoZSBtaWRuaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIEphbnVhcnkgMSwgMTk3MCwgVVRDLlxuICAgKi9cbiAgc3RhdGljIFVOSVhfRVBPQ0ggPSBuZXcgX1RpbWVzdGFtcCgwbik7XG4gIC8qKlxuICAgKiBHZXQgYSBgVGltZXN0YW1wYCByZXByZXNlbnRpbmcgdGhlIGV4ZWN1dGlvbiBlbnZpcm9ubWVudCdzIGJlbGllZiBvZiB0aGUgY3VycmVudCBtb21lbnQgaW4gdGltZS5cbiAgICovXG4gIHN0YXRpYyBub3coKSB7XG4gICAgcmV0dXJuIF9UaW1lc3RhbXAuZnJvbURhdGUoLyogQF9fUFVSRV9fICovIG5ldyBEYXRlKCkpO1xuICB9XG4gIC8qKiBDb252ZXJ0IHRvIG1pbGxpc2Vjb25kcyBzaW5jZSBVbml4IGVwb2NoLiAqL1xuICB0b01pbGxpcygpIHtcbiAgICByZXR1cm4gdGhpcy5taWNyb3NTaW5jZVVuaXhFcG9jaCAvIDEwMDBuO1xuICB9XG4gIC8qKlxuICAgKiBHZXQgYSBgVGltZXN0YW1wYCByZXByZXNlbnRpbmcgdGhlIHNhbWUgcG9pbnQgaW4gdGltZSBhcyBgZGF0ZWAuXG4gICAqL1xuICBzdGF0aWMgZnJvbURhdGUoZGF0ZSkge1xuICAgIGNvbnN0IG1pbGxpcyA9IGRhdGUuZ2V0VGltZSgpO1xuICAgIGNvbnN0IG1pY3JvcyA9IEJpZ0ludChtaWxsaXMpICogX1RpbWVzdGFtcC5NSUNST1NfUEVSX01JTExJUztcbiAgICByZXR1cm4gbmV3IF9UaW1lc3RhbXAobWljcm9zKTtcbiAgfVxuICAvKipcbiAgICogR2V0IGEgYERhdGVgIHJlcHJlc2VudGluZyBhcHByb3hpbWF0ZWx5IHRoZSBzYW1lIHBvaW50IGluIHRpbWUgYXMgYHRoaXNgLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCB0cnVuY2F0ZXMgdG8gbWlsbGlzZWNvbmQgcHJlY2lzaW9uLFxuICAgKiBhbmQgdGhyb3dzIGBSYW5nZUVycm9yYCBpZiB0aGUgYFRpbWVzdGFtcGAgaXMgb3V0c2lkZSB0aGUgcmFuZ2UgcmVwcmVzZW50YWJsZSBhcyBhIGBEYXRlYC5cbiAgICovXG4gIHRvRGF0ZSgpIHtcbiAgICBjb25zdCBtaWNyb3MgPSB0aGlzLl9fdGltZXN0YW1wX21pY3Jvc19zaW5jZV91bml4X2Vwb2NoX187XG4gICAgY29uc3QgbWlsbGlzID0gbWljcm9zIC8gX1RpbWVzdGFtcC5NSUNST1NfUEVSX01JTExJUztcbiAgICBpZiAobWlsbGlzID4gQmlnSW50KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB8fCBtaWxsaXMgPCBCaWdJbnQoTnVtYmVyLk1JTl9TQUZFX0lOVEVHRVIpKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcbiAgICAgICAgXCJUaW1lc3RhbXAgaXMgb3V0c2lkZSBvZiB0aGUgcmVwcmVzZW50YWJsZSByYW5nZSBvZiBKUydzIERhdGVcIlxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBEYXRlKE51bWJlcihtaWxsaXMpKTtcbiAgfVxuICAvKipcbiAgICogR2V0IGFuIElTTyA4NjAxIC8gUkZDIDMzMzkgZm9ybWF0dGVkIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIHRpbWVzdGFtcCB3aXRoIG1pY3Jvc2Vjb25kIHByZWNpc2lvbi5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgcHJlc2VydmVzIHRoZSBmdWxsIG1pY3Jvc2Vjb25kIHByZWNpc2lvbiBvZiB0aGUgdGltZXN0YW1wLFxuICAgKiBhbmQgdGhyb3dzIGBSYW5nZUVycm9yYCBpZiB0aGUgYFRpbWVzdGFtcGAgaXMgb3V0c2lkZSB0aGUgcmFuZ2UgcmVwcmVzZW50YWJsZSBpbiBJU08gZm9ybWF0LlxuICAgKlxuICAgKiBAcmV0dXJucyBJU08gODYwMSBmb3JtYXR0ZWQgc3RyaW5nIHdpdGggbWljcm9zZWNvbmQgcHJlY2lzaW9uIChlLmcuLCAnMjAyNS0wMi0xN1QxMDozMDo0NS4xMjM0NTZaJylcbiAgICovXG4gIHRvSVNPU3RyaW5nKCkge1xuICAgIGNvbnN0IG1pY3JvcyA9IHRoaXMuX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfXztcbiAgICBjb25zdCBtaWxsaXMgPSBtaWNyb3MgLyBfVGltZXN0YW1wLk1JQ1JPU19QRVJfTUlMTElTO1xuICAgIGlmIChtaWxsaXMgPiBCaWdJbnQoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHx8IG1pbGxpcyA8IEJpZ0ludChOdW1iZXIuTUlOX1NBRkVfSU5URUdFUikpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFxuICAgICAgICBcIlRpbWVzdGFtcCBpcyBvdXRzaWRlIG9mIHRoZSByZXByZXNlbnRhYmxlIHJhbmdlIGZvciBJU08gc3RyaW5nIGZvcm1hdHRpbmdcIlxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKE51bWJlcihtaWxsaXMpKTtcbiAgICBjb25zdCBpc29CYXNlID0gZGF0ZS50b0lTT1N0cmluZygpO1xuICAgIGNvbnN0IG1pY3Jvc1JlbWFpbmRlciA9IE1hdGguYWJzKE51bWJlcihtaWNyb3MgJSAxMDAwMDAwbikpO1xuICAgIGNvbnN0IGZyYWN0aW9uYWxQYXJ0ID0gU3RyaW5nKG1pY3Jvc1JlbWFpbmRlcikucGFkU3RhcnQoNiwgXCIwXCIpO1xuICAgIHJldHVybiBpc29CYXNlLnJlcGxhY2UoL1xcLlxcZHszfVokLywgYC4ke2ZyYWN0aW9uYWxQYXJ0fVpgKTtcbiAgfVxuICBzaW5jZShvdGhlcikge1xuICAgIHJldHVybiBuZXcgVGltZUR1cmF0aW9uKFxuICAgICAgdGhpcy5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fIC0gb3RoZXIuX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfX1xuICAgICk7XG4gIH1cbn07XG5cbi8vIHNyYy9saWIvdXVpZC50c1xudmFyIFV1aWQgPSBjbGFzcyBfVXVpZCB7XG4gIF9fdXVpZF9fO1xuICAvKipcbiAgICogVGhlIG5pbCBVVUlEIChhbGwgemVyb3MpLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0c1xuICAgKiBjb25zdCB1dWlkID0gVXVpZC5OSUw7XG4gICAqIGNvbnNvbGUuYXNzZXJ0KFxuICAgKiAgIHV1aWQudG9TdHJpbmcoKSA9PT0gXCIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDBcIlxuICAgKiApO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBOSUwgPSBuZXcgX1V1aWQoMG4pO1xuICBzdGF0aWMgTUFYX1VVSURfQklHSU5UID0gMHhmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZm47XG4gIC8qKlxuICAgKiBUaGUgbWF4IFVVSUQgKGFsbCBvbmVzKS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3QgdXVpZCA9IFV1aWQuTUFYO1xuICAgKiBjb25zb2xlLmFzc2VydChcbiAgICogICB1dWlkLnRvU3RyaW5nKCkgPT09IFwiZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmXCJcbiAgICogKTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgTUFYID0gbmV3IF9VdWlkKF9VdWlkLk1BWF9VVUlEX0JJR0lOVCk7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBVVUlEIGZyb20gYSByYXcgMTI4LWJpdCB2YWx1ZS5cbiAgICpcbiAgICogQHBhcmFtIHUgLSBVbnNpZ25lZCAxMjgtYml0IGludGVnZXJcbiAgICogQHRocm93cyB7RXJyb3J9IElmIHRoZSB2YWx1ZSBpcyBvdXRzaWRlIHRoZSB2YWxpZCBVVUlEIHJhbmdlXG4gICAqL1xuICBjb25zdHJ1Y3Rvcih1KSB7XG4gICAgY29uc3QgdiA9IGNvZXJjZVRvQmlnSW50KHUsIFwiVXVpZFwiKTtcbiAgICBpZiAodiA8IDBuIHx8IHYgPiBfVXVpZC5NQVhfVVVJRF9CSUdJTlQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgVVVJRDogbXVzdCBiZSBiZXR3ZWVuIDAgYW5kIGBNQVhfVVVJRF9CSUdJTlRgXCIpO1xuICAgIH1cbiAgICB0aGlzLl9fdXVpZF9fID0gdjtcbiAgfVxuICAvKipcbiAgICogQ3JlYXRlIGEgVVVJRCBgdjRgIGZyb20gZXhwbGljaXQgcmFuZG9tIGJ5dGVzLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoZSBieXRlcyBhcmUgYWxyZWFkeSBzdWZmaWNpZW50bHkgcmFuZG9tLlxuICAgKiBJdCBvbmx5IHNldHMgdGhlIGFwcHJvcHJpYXRlIGJpdHMgZm9yIHRoZSBVVUlEIHZlcnNpb24gYW5kIHZhcmlhbnQuXG4gICAqXG4gICAqIEBwYXJhbSBieXRlcyAtIEV4YWN0bHkgMTYgcmFuZG9tIGJ5dGVzXG4gICAqIEByZXR1cm5zIEEgVVVJRCBgdjRgXG4gICAqIEB0aHJvd3Mge0Vycm9yfSBJZiBgYnl0ZXMubGVuZ3RoICE9PSAxNmBcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3QgcmFuZG9tQnl0ZXMgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAqIGNvbnN0IHV1aWQgPSBVdWlkLmZyb21SYW5kb21CeXRlc1Y0KHJhbmRvbUJ5dGVzKTtcbiAgICpcbiAgICogY29uc29sZS5hc3NlcnQoXG4gICAqICAgdXVpZC50b1N0cmluZygpID09PSBcIjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMFwiXG4gICAqICk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIGZyb21SYW5kb21CeXRlc1Y0KGJ5dGVzKSB7XG4gICAgaWYgKGJ5dGVzLmxlbmd0aCAhPT0gMTYpIHRocm93IG5ldyBFcnJvcihcIlVVSUQgdjQgcmVxdWlyZXMgMTYgYnl0ZXNcIik7XG4gICAgY29uc3QgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZXMpO1xuICAgIGFycls2XSA9IGFycls2XSAmIDE1IHwgNjQ7XG4gICAgYXJyWzhdID0gYXJyWzhdICYgNjMgfCAxMjg7XG4gICAgcmV0dXJuIG5ldyBfVXVpZChfVXVpZC5ieXRlc1RvQmlnSW50KGFycikpO1xuICB9XG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIFVVSUQgYHY3YCB1c2luZyBhIG1vbm90b25pYyBjb3VudGVyIGZyb20gYDBgIHRvIGAyXjMxIC0gMWAsXG4gICAqIGEgdGltZXN0YW1wLCBhbmQgNCByYW5kb20gYnl0ZXMuXG4gICAqXG4gICAqIFRoZSBjb3VudGVyIHdyYXBzIGFyb3VuZCBvbiBvdmVyZmxvdy5cbiAgICpcbiAgICogVGhlIFVVSUQgYHY3YCBpcyBzdHJ1Y3R1cmVkIGFzIGZvbGxvd3M6XG4gICAqXG4gICAqIGBgYGFzY2lpXG4gICAqIOKUjOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUrOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUkFxuICAgKiB8IEIwICB8IEIxICB8IEIyICB8IEIzICB8IEI0ICB8IEI1ICAgICAgICAgICAgICB8ICAgICAgICAgQjYgICAgICAgIHxcbiAgICog4pSc4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pS84pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSkXG4gICAqIHwgICAgICAgICAgICAgICAgIHVuaXhfdHNfbXMgICAgICAgICAgICAgICAgICAgIHwgICAgICB2ZXJzaW9uIDcgICAgfFxuICAgKiDilJTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilJhcbiAgICog4pSM4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSQXG4gICAqIHwgQjcgICAgICAgICAgIHwgQjggICAgICB8IEI5ICB8IEIxMCB8IEIxMSAgfCBCMTIgfCBCMTMgfCBCMTQgfCBCMTUgfFxuICAgKiDilJzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilKRcbiAgICogfCBjb3VudGVyX2hpZ2ggfCB2YXJpYW50IHwgICAgY291bnRlcl9sb3cgICB8ICAgICAgICByYW5kb20gICAgICAgICB8XG4gICAqIOKUlOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUmFxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGNvdW50ZXIgLSBNdXRhYmxlIG1vbm90b25pYyBjb3VudGVyICgzMS1iaXQpXG4gICAqIEBwYXJhbSBub3cgLSBUaW1lc3RhbXAgc2luY2UgdGhlIFVuaXggZXBvY2hcbiAgICogQHBhcmFtIHJhbmRvbUJ5dGVzIC0gRXhhY3RseSA0IHJhbmRvbSBieXRlc1xuICAgKiBAcmV0dXJucyBBIFVVSUQgYHY3YFxuICAgKlxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlIGBjb3VudGVyYCBpcyBuZWdhdGl2ZVxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlIGB0aW1lc3RhbXBgIGlzIGJlZm9yZSB0aGUgVW5peCBlcG9jaFxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgYHJhbmRvbUJ5dGVzLmxlbmd0aCAhPT0gNGBcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3Qgbm93ID0gVGltZXN0YW1wLmZyb21NaWxsaXMoMV82ODZfMDAwXzAwMF8wMDBuKTtcbiAgICogY29uc3QgY291bnRlciA9IHsgdmFsdWU6IDEgfTtcbiAgICogY29uc3QgcmFuZG9tQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KTtcbiAgICpcbiAgICogY29uc3QgdXVpZCA9IFV1aWQuZnJvbUNvdW50ZXJWNyhjb3VudGVyLCBub3csIHJhbmRvbUJ5dGVzKTtcbiAgICpcbiAgICogY29uc29sZS5hc3NlcnQoXG4gICAqICAgdXVpZC50b1N0cmluZygpID09PSBcIjAwMDA2NDdlLTUxODAtNzAwMC04MDAwLTAwMDIwMDAwMDAwMFwiXG4gICAqICk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIGZyb21Db3VudGVyVjcoY291bnRlciwgbm93LCByYW5kb21CeXRlcykge1xuICAgIGlmIChyYW5kb21CeXRlcy5sZW5ndGggIT09IDQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImBmcm9tQ291bnRlclY3YCByZXF1aXJlcyBgcmFuZG9tQnl0ZXMubGVuZ3RoID09IDRgXCIpO1xuICAgIH1cbiAgICBpZiAoY291bnRlci52YWx1ZSA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImBmcm9tQ291bnRlclY3YCB1dWlkIGBjb3VudGVyYCBtdXN0IGJlIG5vbi1uZWdhdGl2ZVwiKTtcbiAgICB9XG4gICAgaWYgKG5vdy5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fIDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYGZyb21Db3VudGVyVjdgIGB0aW1lc3RhbXBgIGJlZm9yZSB1bml4IGVwb2NoXCIpO1xuICAgIH1cbiAgICBjb25zdCBjb3VudGVyVmFsID0gY291bnRlci52YWx1ZTtcbiAgICBjb3VudGVyLnZhbHVlID0gY291bnRlclZhbCArIDEgJiAyMTQ3NDgzNjQ3O1xuICAgIGNvbnN0IHRzTXMgPSBub3cudG9NaWxsaXMoKSAmIDB4ZmZmZmZmZmZmZmZmbjtcbiAgICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KDE2KTtcbiAgICBieXRlc1swXSA9IE51bWJlcih0c01zID4+IDQwbiAmIDB4ZmZuKTtcbiAgICBieXRlc1sxXSA9IE51bWJlcih0c01zID4+IDMybiAmIDB4ZmZuKTtcbiAgICBieXRlc1syXSA9IE51bWJlcih0c01zID4+IDI0biAmIDB4ZmZuKTtcbiAgICBieXRlc1szXSA9IE51bWJlcih0c01zID4+IDE2biAmIDB4ZmZuKTtcbiAgICBieXRlc1s0XSA9IE51bWJlcih0c01zID4+IDhuICYgMHhmZm4pO1xuICAgIGJ5dGVzWzVdID0gTnVtYmVyKHRzTXMgJiAweGZmbik7XG4gICAgYnl0ZXNbN10gPSBjb3VudGVyVmFsID4+PiAyMyAmIDI1NTtcbiAgICBieXRlc1s5XSA9IGNvdW50ZXJWYWwgPj4+IDE1ICYgMjU1O1xuICAgIGJ5dGVzWzEwXSA9IGNvdW50ZXJWYWwgPj4+IDcgJiAyNTU7XG4gICAgYnl0ZXNbMTFdID0gKGNvdW50ZXJWYWwgJiAxMjcpIDw8IDEgJiAyNTU7XG4gICAgYnl0ZXNbMTJdIHw9IHJhbmRvbUJ5dGVzWzBdICYgMTI3O1xuICAgIGJ5dGVzWzEzXSA9IHJhbmRvbUJ5dGVzWzFdO1xuICAgIGJ5dGVzWzE0XSA9IHJhbmRvbUJ5dGVzWzJdO1xuICAgIGJ5dGVzWzE1XSA9IHJhbmRvbUJ5dGVzWzNdO1xuICAgIGJ5dGVzWzZdID0gYnl0ZXNbNl0gJiAxNSB8IDExMjtcbiAgICBieXRlc1s4XSA9IGJ5dGVzWzhdICYgNjMgfCAxMjg7XG4gICAgcmV0dXJuIG5ldyBfVXVpZChfVXVpZC5ieXRlc1RvQmlnSW50KGJ5dGVzKSk7XG4gIH1cbiAgLyoqXG4gICAqIFBhcnNlIGEgVVVJRCBmcm9tIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gcyAtIFVVSUQgc3RyaW5nXG4gICAqIEByZXR1cm5zIFBhcnNlZCBVVUlEXG4gICAqIEB0aHJvd3Mge0Vycm9yfSBJZiB0aGUgc3RyaW5nIGlzIG5vdCBhIHZhbGlkIFVVSURcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3QgcyA9IFwiMDE4ODhkNmUtNWMwMC03MDAwLTgwMDAtMDAwMDAwMDAwMDAwXCI7XG4gICAqIGNvbnN0IHV1aWQgPSBVdWlkLnBhcnNlKHMpO1xuICAgKlxuICAgKiBjb25zb2xlLmFzc2VydCh1dWlkLnRvU3RyaW5nKCkgPT09IHMpO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBwYXJzZShzKSB7XG4gICAgY29uc3QgaGV4ID0gcy5yZXBsYWNlKC8tL2csIFwiXCIpO1xuICAgIGlmIChoZXgubGVuZ3RoICE9PSAzMikgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBoZXggVVVJRFwiKTtcbiAgICBsZXQgdiA9IDBuO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkgKz0gMikge1xuICAgICAgdiA9IHYgPDwgOG4gfCBCaWdJbnQocGFyc2VJbnQoaGV4LnNsaWNlKGksIGkgKyAyKSwgMTYpKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBfVXVpZCh2KTtcbiAgfVxuICAvKiogQ29udmVydCB0byBoZXggc3RyaW5nIHdpdGhvdXQgYSAweCBwcmVmaXguICovXG4gIHRvSGV4U3RyaW5nKCkge1xuICAgIHJldHVybiB1MTI4VG9IZXhTdHJpbmcodGhpcy5hc0JpZ0ludCgpKTtcbiAgfVxuICAvKiogQ29udmVydCB0byBzdHJpbmcgKGh5cGhlbmF0ZWQgZm9ybSkuICovXG4gIHRvU3RyaW5nKCkge1xuICAgIGNvbnN0IGhleCA9IHRoaXMudG9IZXhTdHJpbmcoKTtcbiAgICByZXR1cm4gaGV4LnNsaWNlKDAsIDgpICsgXCItXCIgKyBoZXguc2xpY2UoOCwgMTIpICsgXCItXCIgKyBoZXguc2xpY2UoMTIsIDE2KSArIFwiLVwiICsgaGV4LnNsaWNlKDE2LCAyMCkgKyBcIi1cIiArIGhleC5zbGljZSgyMCk7XG4gIH1cbiAgLyoqIENvbnZlcnQgdG8gYmlnaW50ICh1MTI4KS4gKi9cbiAgYXNCaWdJbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX191dWlkX187XG4gIH1cbiAgLyoqIFJldHVybiBhIGBVaW50OEFycmF5YCBvZiAxNiBieXRlcy4gKi9cbiAgdG9CeXRlcygpIHtcbiAgICByZXR1cm4gX1V1aWQuYmlnSW50VG9CeXRlcyh0aGlzLl9fdXVpZF9fKTtcbiAgfVxuICBzdGF0aWMgYnl0ZXNUb0JpZ0ludChieXRlcykge1xuICAgIGxldCByZXN1bHQgPSAwbjtcbiAgICBmb3IgKGNvbnN0IGIgb2YgYnl0ZXMpIHJlc3VsdCA9IHJlc3VsdCA8PCA4biB8IEJpZ0ludChiKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHN0YXRpYyBiaWdJbnRUb0J5dGVzKHZhbHVlKSB7XG4gICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAgZm9yIChsZXQgaSA9IDE1OyBpID49IDA7IGktLSkge1xuICAgICAgYnl0ZXNbaV0gPSBOdW1iZXIodmFsdWUgJiAweGZmbik7XG4gICAgICB2YWx1ZSA+Pj0gOG47XG4gICAgfVxuICAgIHJldHVybiBieXRlcztcbiAgfVxuICAvKipcbiAgICogUmV0dXJucyB0aGUgdmVyc2lvbiBvZiB0aGlzIFVVSUQuXG4gICAqXG4gICAqIFRoaXMgcmVwcmVzZW50cyB0aGUgYWxnb3JpdGhtIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHZhbHVlLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGBVdWlkVmVyc2lvbmBcbiAgICogQHRocm93cyB7RXJyb3J9IElmIHRoZSB2ZXJzaW9uIGZpZWxkIGlzIG5vdCByZWNvZ25pemVkXG4gICAqL1xuICBnZXRWZXJzaW9uKCkge1xuICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLnRvQnl0ZXMoKVs2XSA+PiA0ICYgMTU7XG4gICAgc3dpdGNoICh2ZXJzaW9uKSB7XG4gICAgICBjYXNlIDQ6XG4gICAgICAgIHJldHVybiBcIlY0XCI7XG4gICAgICBjYXNlIDc6XG4gICAgICAgIHJldHVybiBcIlY3XCI7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAodGhpcyA9PSBfVXVpZC5OSUwpIHtcbiAgICAgICAgICByZXR1cm4gXCJOaWxcIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcyA9PSBfVXVpZC5NQVgpIHtcbiAgICAgICAgICByZXR1cm4gXCJNYXhcIjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIFVVSUQgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgbW9ub3RvbmljIGNvdW50ZXIgZnJvbSBhIFVVSUR2Ny5cbiAgICpcbiAgICogSW50ZW5kZWQgZm9yIHRlc3RpbmcgYW5kIGRpYWdub3N0aWNzLlxuICAgKiBCZWhhdmlvciBpcyB1bmRlZmluZWQgaWYgY2FsbGVkIG9uIGEgbm9uLVY3IFVVSUQuXG4gICAqXG4gICAqIEByZXR1cm5zIDMxLWJpdCBjb3VudGVyIHZhbHVlXG4gICAqL1xuICBnZXRDb3VudGVyKCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy50b0J5dGVzKCk7XG4gICAgY29uc3QgaGlnaCA9IGJ5dGVzWzddO1xuICAgIGNvbnN0IG1pZDEgPSBieXRlc1s5XTtcbiAgICBjb25zdCBtaWQyID0gYnl0ZXNbMTBdO1xuICAgIGNvbnN0IGxvdyA9IGJ5dGVzWzExXSA+Pj4gMTtcbiAgICByZXR1cm4gaGlnaCA8PCAyMyB8IG1pZDEgPDwgMTUgfCBtaWQyIDw8IDcgfCBsb3cgfCAwO1xuICB9XG4gIGNvbXBhcmVUbyhvdGhlcikge1xuICAgIGlmICh0aGlzLl9fdXVpZF9fIDwgb3RoZXIuX191dWlkX18pIHJldHVybiAtMTtcbiAgICBpZiAodGhpcy5fX3V1aWRfXyA+IG90aGVyLl9fdXVpZF9fKSByZXR1cm4gMTtcbiAgICByZXR1cm4gMDtcbiAgfVxuICBzdGF0aWMgZ2V0QWxnZWJyYWljVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHtcbiAgICAgIGVsZW1lbnRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBcIl9fdXVpZF9fXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5VMTI4XG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9jb25uZWN0aW9uX2lkLnRzXG52YXIgQ29ubmVjdGlvbklkID0gY2xhc3MgX0Nvbm5lY3Rpb25JZCB7XG4gIF9fY29ubmVjdGlvbl9pZF9fO1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgQ29ubmVjdGlvbklkYC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLl9fY29ubmVjdGlvbl9pZF9fID0gY29lcmNlVG9CaWdJbnQoZGF0YSwgXCJDb25uZWN0aW9uSWRcIik7XG4gIH1cbiAgLyoqXG4gICAqIEdldCB0aGUgYWxnZWJyYWljIHR5cGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIHtAbGluayBDb25uZWN0aW9uSWR9IHR5cGUuXG4gICAqIEByZXR1cm5zIFRoZSBhbGdlYnJhaWMgdHlwZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgdHlwZS5cbiAgICovXG4gIHN0YXRpYyBnZXRBbGdlYnJhaWNUeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlLlByb2R1Y3Qoe1xuICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgeyBuYW1lOiBcIl9fY29ubmVjdGlvbl9pZF9fXCIsIGFsZ2VicmFpY1R5cGU6IEFsZ2VicmFpY1R5cGUuVTEyOCB9XG4gICAgICBdXG4gICAgfSk7XG4gIH1cbiAgaXNaZXJvKCkge1xuICAgIHJldHVybiB0aGlzLl9fY29ubmVjdGlvbl9pZF9fID09PSBCaWdJbnQoMCk7XG4gIH1cbiAgc3RhdGljIG51bGxJZlplcm8oYWRkcikge1xuICAgIGlmIChhZGRyLmlzWmVybygpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGFkZHI7XG4gICAgfVxuICB9XG4gIHN0YXRpYyByYW5kb20oKSB7XG4gICAgZnVuY3Rpb24gcmFuZG9tVTgoKSB7XG4gICAgICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMjU1KTtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IEJpZ0ludCgwKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdCA8PCBCaWdJbnQoOCkgfCBCaWdJbnQocmFuZG9tVTgoKSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgX0Nvbm5lY3Rpb25JZChyZXN1bHQpO1xuICB9XG4gIC8qKlxuICAgKiBDb21wYXJlIHR3byBjb25uZWN0aW9uIElEcyBmb3IgZXF1YWxpdHkuXG4gICAqL1xuICBpc0VxdWFsKG90aGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuX19jb25uZWN0aW9uX2lkX18gPT0gb3RoZXIuX19jb25uZWN0aW9uX2lkX187XG4gIH1cbiAgLyoqXG4gICAqIENoZWNrIGlmIHR3byBjb25uZWN0aW9uIElEcyBhcmUgZXF1YWwuXG4gICAqL1xuICBlcXVhbHMob3RoZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pc0VxdWFsKG90aGVyKTtcbiAgfVxuICAvKipcbiAgICogUHJpbnQgdGhlIGNvbm5lY3Rpb24gSUQgYXMgYSBoZXhhZGVjaW1hbCBzdHJpbmcuXG4gICAqL1xuICB0b0hleFN0cmluZygpIHtcbiAgICByZXR1cm4gdTEyOFRvSGV4U3RyaW5nKHRoaXMuX19jb25uZWN0aW9uX2lkX18pO1xuICB9XG4gIC8qKlxuICAgKiBDb252ZXJ0IHRoZSBjb25uZWN0aW9uIElEIHRvIGEgVWludDhBcnJheS5cbiAgICovXG4gIHRvVWludDhBcnJheSgpIHtcbiAgICByZXR1cm4gdTEyOFRvVWludDhBcnJheSh0aGlzLl9fY29ubmVjdGlvbl9pZF9fKTtcbiAgfVxuICAvKipcbiAgICogUGFyc2UgYSBjb25uZWN0aW9uIElEIGZyb20gYSBoZXhhZGVjaW1hbCBzdHJpbmcuXG4gICAqL1xuICBzdGF0aWMgZnJvbVN0cmluZyhzdHIpIHtcbiAgICByZXR1cm4gbmV3IF9Db25uZWN0aW9uSWQoaGV4U3RyaW5nVG9VMTI4KHN0cikpO1xuICB9XG4gIHN0YXRpYyBmcm9tU3RyaW5nT3JOdWxsKHN0cikge1xuICAgIGNvbnN0IGFkZHIgPSBfQ29ubmVjdGlvbklkLmZyb21TdHJpbmcoc3RyKTtcbiAgICBpZiAoYWRkci5pc1plcm8oKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBhZGRyO1xuICAgIH1cbiAgfVxufTtcblxuLy8gc3JjL2xpYi9pZGVudGl0eS50c1xudmFyIElkZW50aXR5ID0gY2xhc3MgX0lkZW50aXR5IHtcbiAgX19pZGVudGl0eV9fO1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgSWRlbnRpdHlgLlxuICAgKlxuICAgKiBgZGF0YWAgY2FuIGJlIGEgaGV4YWRlY2ltYWwgc3RyaW5nIG9yIGEgYGJpZ2ludGAuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5fX2lkZW50aXR5X18gPSB0eXBlb2YgZGF0YSA9PT0gXCJzdHJpbmdcIiA/IGhleFN0cmluZ1RvVTI1NihkYXRhKSA6IGNvZXJjZVRvQmlnSW50KGRhdGEsIFwiSWRlbnRpdHlcIik7XG4gIH1cbiAgLyoqXG4gICAqIEdldCB0aGUgYWxnZWJyYWljIHR5cGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIHtAbGluayBJZGVudGl0eX0gdHlwZS5cbiAgICogQHJldHVybnMgVGhlIGFsZ2VicmFpYyB0eXBlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0eXBlLlxuICAgKi9cbiAgc3RhdGljIGdldEFsZ2VicmFpY1R5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuUHJvZHVjdCh7XG4gICAgICBlbGVtZW50czogW3sgbmFtZTogXCJfX2lkZW50aXR5X19cIiwgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5VMjU2IH1dXG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIENoZWNrIGlmIHR3byBpZGVudGl0aWVzIGFyZSBlcXVhbC5cbiAgICovXG4gIGlzRXF1YWwob3RoZXIpIHtcbiAgICByZXR1cm4gdGhpcy50b0hleFN0cmluZygpID09PSBvdGhlci50b0hleFN0cmluZygpO1xuICB9XG4gIC8qKlxuICAgKiBDaGVjayBpZiB0d28gaWRlbnRpdGllcyBhcmUgZXF1YWwuXG4gICAqL1xuICBlcXVhbHMob3RoZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pc0VxdWFsKG90aGVyKTtcbiAgfVxuICAvKipcbiAgICogUHJpbnQgdGhlIGlkZW50aXR5IGFzIGEgaGV4YWRlY2ltYWwgc3RyaW5nLlxuICAgKi9cbiAgdG9IZXhTdHJpbmcoKSB7XG4gICAgcmV0dXJuIHUyNTZUb0hleFN0cmluZyh0aGlzLl9faWRlbnRpdHlfXyk7XG4gIH1cbiAgLyoqXG4gICAqIENvbnZlcnQgdGhlIGFkZHJlc3MgdG8gYSBVaW50OEFycmF5LlxuICAgKi9cbiAgdG9VaW50OEFycmF5KCkge1xuICAgIHJldHVybiB1MjU2VG9VaW50OEFycmF5KHRoaXMuX19pZGVudGl0eV9fKTtcbiAgfVxuICAvKipcbiAgICogUGFyc2UgYW4gSWRlbnRpdHkgZnJvbSBhIGhleGFkZWNpbWFsIHN0cmluZy5cbiAgICovXG4gIHN0YXRpYyBmcm9tU3RyaW5nKHN0cikge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5KHN0cik7XG4gIH1cbiAgLyoqXG4gICAqIFplcm8gaWRlbnRpdHkgKDB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMClcbiAgICovXG4gIHN0YXRpYyB6ZXJvKCkge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5KDBuKTtcbiAgfVxuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gdGhpcy50b0hleFN0cmluZygpO1xuICB9XG59O1xuXG4vLyBzcmMvbGliL2FsZ2VicmFpY190eXBlLnRzXG52YXIgU0VSSUFMSVpFUlMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xudmFyIERFU0VSSUFMSVpFUlMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xudmFyIEFsZ2VicmFpY1R5cGUgPSB7XG4gIFJlZjogKHZhbHVlKSA9PiAoeyB0YWc6IFwiUmVmXCIsIHZhbHVlIH0pLFxuICBTdW06ICh2YWx1ZSkgPT4gKHtcbiAgICB0YWc6IFwiU3VtXCIsXG4gICAgdmFsdWVcbiAgfSksXG4gIFByb2R1Y3Q6ICh2YWx1ZSkgPT4gKHtcbiAgICB0YWc6IFwiUHJvZHVjdFwiLFxuICAgIHZhbHVlXG4gIH0pLFxuICBBcnJheTogKHZhbHVlKSA9PiAoe1xuICAgIHRhZzogXCJBcnJheVwiLFxuICAgIHZhbHVlXG4gIH0pLFxuICBTdHJpbmc6IHsgdGFnOiBcIlN0cmluZ1wiIH0sXG4gIEJvb2w6IHsgdGFnOiBcIkJvb2xcIiB9LFxuICBJODogeyB0YWc6IFwiSThcIiB9LFxuICBVODogeyB0YWc6IFwiVThcIiB9LFxuICBJMTY6IHsgdGFnOiBcIkkxNlwiIH0sXG4gIFUxNjogeyB0YWc6IFwiVTE2XCIgfSxcbiAgSTMyOiB7IHRhZzogXCJJMzJcIiB9LFxuICBVMzI6IHsgdGFnOiBcIlUzMlwiIH0sXG4gIEk2NDogeyB0YWc6IFwiSTY0XCIgfSxcbiAgVTY0OiB7IHRhZzogXCJVNjRcIiB9LFxuICBJMTI4OiB7IHRhZzogXCJJMTI4XCIgfSxcbiAgVTEyODogeyB0YWc6IFwiVTEyOFwiIH0sXG4gIEkyNTY6IHsgdGFnOiBcIkkyNTZcIiB9LFxuICBVMjU2OiB7IHRhZzogXCJVMjU2XCIgfSxcbiAgRjMyOiB7IHRhZzogXCJGMzJcIiB9LFxuICBGNjQ6IHsgdGFnOiBcIkY2NFwiIH0sXG4gIG1ha2VTZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpIHtcbiAgICBpZiAodHkudGFnID09PSBcIlJlZlwiKSB7XG4gICAgICBpZiAoIXR5cGVzcGFjZSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2Fubm90IHNlcmlhbGl6ZSByZWZzIHdpdGhvdXQgYSB0eXBlc3BhY2VcIik7XG4gICAgICB3aGlsZSAodHkudGFnID09PSBcIlJlZlwiKSB0eSA9IHR5cGVzcGFjZS50eXBlc1t0eS52YWx1ZV07XG4gICAgfVxuICAgIHN3aXRjaCAodHkudGFnKSB7XG4gICAgICBjYXNlIFwiUHJvZHVjdFwiOlxuICAgICAgICByZXR1cm4gUHJvZHVjdFR5cGUubWFrZVNlcmlhbGl6ZXIodHkudmFsdWUsIHR5cGVzcGFjZSk7XG4gICAgICBjYXNlIFwiU3VtXCI6XG4gICAgICAgIHJldHVybiBTdW1UeXBlLm1ha2VTZXJpYWxpemVyKHR5LnZhbHVlLCB0eXBlc3BhY2UpO1xuICAgICAgY2FzZSBcIkFycmF5XCI6XG4gICAgICAgIGlmICh0eS52YWx1ZS50YWcgPT09IFwiVThcIikge1xuICAgICAgICAgIHJldHVybiBzZXJpYWxpemVVaW50OEFycmF5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHNlcmlhbGl6ZSA9IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIodHkudmFsdWUsIHR5cGVzcGFjZSk7XG4gICAgICAgICAgcmV0dXJuICh3cml0ZXIsIHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB3cml0ZXIud3JpdGVVMzIodmFsdWUubGVuZ3RoKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZWxlbSBvZiB2YWx1ZSkge1xuICAgICAgICAgICAgICBzZXJpYWxpemUod3JpdGVyLCBlbGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gcHJpbWl0aXZlU2VyaWFsaXplcnNbdHkudGFnXTtcbiAgICB9XG4gIH0sXG4gIC8qKiBAZGVwcmVjYXRlZCBVc2UgYG1ha2VTZXJpYWxpemVyYCBpbnN0ZWFkLiAqL1xuICBzZXJpYWxpemVWYWx1ZSh3cml0ZXIsIHR5LCB2YWx1ZSwgdHlwZXNwYWNlKSB7XG4gICAgQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKSh3cml0ZXIsIHZhbHVlKTtcbiAgfSxcbiAgbWFrZURlc2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKSB7XG4gICAgaWYgKHR5LnRhZyA9PT0gXCJSZWZcIikge1xuICAgICAgaWYgKCF0eXBlc3BhY2UpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbm5vdCBkZXNlcmlhbGl6ZSByZWZzIHdpdGhvdXQgYSB0eXBlc3BhY2VcIik7XG4gICAgICB3aGlsZSAodHkudGFnID09PSBcIlJlZlwiKSB0eSA9IHR5cGVzcGFjZS50eXBlc1t0eS52YWx1ZV07XG4gICAgfVxuICAgIHN3aXRjaCAodHkudGFnKSB7XG4gICAgICBjYXNlIFwiUHJvZHVjdFwiOlxuICAgICAgICByZXR1cm4gUHJvZHVjdFR5cGUubWFrZURlc2VyaWFsaXplcih0eS52YWx1ZSwgdHlwZXNwYWNlKTtcbiAgICAgIGNhc2UgXCJTdW1cIjpcbiAgICAgICAgcmV0dXJuIFN1bVR5cGUubWFrZURlc2VyaWFsaXplcih0eS52YWx1ZSwgdHlwZXNwYWNlKTtcbiAgICAgIGNhc2UgXCJBcnJheVwiOlxuICAgICAgICBpZiAodHkudmFsdWUudGFnID09PSBcIlU4XCIpIHtcbiAgICAgICAgICByZXR1cm4gZGVzZXJpYWxpemVVaW50OEFycmF5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGRlc2VyaWFsaXplID0gQWxnZWJyYWljVHlwZS5tYWtlRGVzZXJpYWxpemVyKFxuICAgICAgICAgICAgdHkudmFsdWUsXG4gICAgICAgICAgICB0eXBlc3BhY2VcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiAocmVhZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsZW5ndGggPSByZWFkZXIucmVhZFUzMigpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgcmVzdWx0W2ldID0gZGVzZXJpYWxpemUocmVhZGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHByaW1pdGl2ZURlc2VyaWFsaXplcnNbdHkudGFnXTtcbiAgICB9XG4gIH0sXG4gIC8qKiBAZGVwcmVjYXRlZCBVc2UgYG1ha2VEZXNlcmlhbGl6ZXJgIGluc3RlYWQuICovXG4gIGRlc2VyaWFsaXplVmFsdWUocmVhZGVyLCB0eSwgdHlwZXNwYWNlKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKShyZWFkZXIpO1xuICB9LFxuICAvKipcbiAgICogQ29udmVydCBhIHZhbHVlIG9mIHRoZSBhbGdlYnJhaWMgdHlwZSBpbnRvIHNvbWV0aGluZyB0aGF0IGNhbiBiZSB1c2VkIGFzIGEga2V5IGluIGEgbWFwLlxuICAgKiBUaGVyZSBhcmUgbm8gZ3VhcmFudGVlcyBhYm91dCBiZWluZyBhYmxlIHRvIG9yZGVyIGl0LlxuICAgKiBUaGlzIGlzIG9ubHkgZ3VhcmFudGVlZCB0byBiZSBjb21wYXJhYmxlIHRvIG90aGVyIHZhbHVlcyBvZiB0aGUgc2FtZSB0eXBlLlxuICAgKiBAcGFyYW0gdmFsdWUgQSB2YWx1ZSBvZiB0aGUgYWxnZWJyYWljIHR5cGVcbiAgICogQHJldHVybnMgU29tZXRoaW5nIHRoYXQgY2FuIGJlIHVzZWQgYXMgYSBrZXkgaW4gYSBtYXAuXG4gICAqL1xuICBpbnRvTWFwS2V5OiBmdW5jdGlvbih0eSwgdmFsdWUpIHtcbiAgICBzd2l0Y2ggKHR5LnRhZykge1xuICAgICAgY2FzZSBcIlU4XCI6XG4gICAgICBjYXNlIFwiVTE2XCI6XG4gICAgICBjYXNlIFwiVTMyXCI6XG4gICAgICBjYXNlIFwiVTY0XCI6XG4gICAgICBjYXNlIFwiVTEyOFwiOlxuICAgICAgY2FzZSBcIlUyNTZcIjpcbiAgICAgIGNhc2UgXCJJOFwiOlxuICAgICAgY2FzZSBcIkkxNlwiOlxuICAgICAgY2FzZSBcIkkzMlwiOlxuICAgICAgY2FzZSBcIkk2NFwiOlxuICAgICAgY2FzZSBcIkkxMjhcIjpcbiAgICAgIGNhc2UgXCJJMjU2XCI6XG4gICAgICBjYXNlIFwiRjMyXCI6XG4gICAgICBjYXNlIFwiRjY0XCI6XG4gICAgICBjYXNlIFwiU3RyaW5nXCI6XG4gICAgICBjYXNlIFwiQm9vbFwiOlxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICBjYXNlIFwiUHJvZHVjdFwiOlxuICAgICAgICByZXR1cm4gUHJvZHVjdFR5cGUuaW50b01hcEtleSh0eS52YWx1ZSwgdmFsdWUpO1xuICAgICAgZGVmYXVsdDoge1xuICAgICAgICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDEwKTtcbiAgICAgICAgQWxnZWJyYWljVHlwZS5zZXJpYWxpemVWYWx1ZSh3cml0ZXIsIHR5LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB3cml0ZXIudG9CYXNlNjQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5mdW5jdGlvbiBiaW5kQ2FsbChmKSB7XG4gIHJldHVybiBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKGYpO1xufVxudmFyIHByaW1pdGl2ZVNlcmlhbGl6ZXJzID0ge1xuICBCb29sOiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlQm9vbCksXG4gIEk4OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTgpLFxuICBVODogYmluZENhbGwoQmluYXJ5V3JpdGVyLnByb3RvdHlwZS53cml0ZVU4KSxcbiAgSTE2OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTE2KSxcbiAgVTE2OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTE2KSxcbiAgSTMyOiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTMyKSxcbiAgVTMyOiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTMyKSxcbiAgSTY0OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTY0KSxcbiAgVTY0OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTY0KSxcbiAgSTEyODogYmluZENhbGwoQmluYXJ5V3JpdGVyLnByb3RvdHlwZS53cml0ZUkxMjgpLFxuICBVMTI4OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTEyOCksXG4gIEkyNTY6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVJMjU2KSxcbiAgVTI1NjogYmluZENhbGwoQmluYXJ5V3JpdGVyLnByb3RvdHlwZS53cml0ZVUyNTYpLFxuICBGMzI6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVGMzIpLFxuICBGNjQ6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVGNjQpLFxuICBTdHJpbmc6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVTdHJpbmcpXG59O1xuT2JqZWN0LmZyZWV6ZShwcmltaXRpdmVTZXJpYWxpemVycyk7XG52YXIgc2VyaWFsaXplVWludDhBcnJheSA9IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVVSW50OEFycmF5KTtcbnZhciBwcmltaXRpdmVEZXNlcmlhbGl6ZXJzID0ge1xuICBCb29sOiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRCb29sKSxcbiAgSTg6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZEk4KSxcbiAgVTg6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFU4KSxcbiAgSTE2OiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRJMTYpLFxuICBVMTY6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFUxNiksXG4gIEkzMjogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkSTMyKSxcbiAgVTMyOiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRVMzIpLFxuICBJNjQ6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZEk2NCksXG4gIFU2NDogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkVTY0KSxcbiAgSTEyODogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkSTEyOCksXG4gIFUxMjg6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFUxMjgpLFxuICBJMjU2OiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRJMjU2KSxcbiAgVTI1NjogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkVTI1NiksXG4gIEYzMjogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkRjMyKSxcbiAgRjY0OiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRGNjQpLFxuICBTdHJpbmc6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFN0cmluZylcbn07XG5PYmplY3QuZnJlZXplKHByaW1pdGl2ZURlc2VyaWFsaXplcnMpO1xudmFyIGRlc2VyaWFsaXplVWludDhBcnJheSA9IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFVJbnQ4QXJyYXkpO1xudmFyIHByaW1pdGl2ZVNpemVzID0ge1xuICBCb29sOiAxLFxuICBJODogMSxcbiAgVTg6IDEsXG4gIEkxNjogMixcbiAgVTE2OiAyLFxuICBJMzI6IDQsXG4gIFUzMjogNCxcbiAgSTY0OiA4LFxuICBVNjQ6IDgsXG4gIEkxMjg6IDE2LFxuICBVMTI4OiAxNixcbiAgSTI1NjogMzIsXG4gIFUyNTY6IDMyLFxuICBGMzI6IDQsXG4gIEY2NDogOFxufTtcbnZhciBmaXhlZFNpemVQcmltaXRpdmVzID0gbmV3IFNldChPYmplY3Qua2V5cyhwcmltaXRpdmVTaXplcykpO1xudmFyIGlzRml4ZWRTaXplUHJvZHVjdCA9ICh0eSkgPT4gdHkuZWxlbWVudHMuZXZlcnkoXG4gICh7IGFsZ2VicmFpY1R5cGUgfSkgPT4gZml4ZWRTaXplUHJpbWl0aXZlcy5oYXMoYWxnZWJyYWljVHlwZS50YWcpXG4pO1xudmFyIHByb2R1Y3RTaXplID0gKHR5KSA9PiB0eS5lbGVtZW50cy5yZWR1Y2UoXG4gIChhY2MsIHsgYWxnZWJyYWljVHlwZSB9KSA9PiBhY2MgKyBwcmltaXRpdmVTaXplc1thbGdlYnJhaWNUeXBlLnRhZ10sXG4gIDBcbik7XG52YXIgcHJpbWl0aXZlSlNOYW1lID0ge1xuICBCb29sOiBcIlVpbnQ4XCIsXG4gIEk4OiBcIkludDhcIixcbiAgVTg6IFwiVWludDhcIixcbiAgSTE2OiBcIkludDE2XCIsXG4gIFUxNjogXCJVaW50MTZcIixcbiAgSTMyOiBcIkludDMyXCIsXG4gIFUzMjogXCJVaW50MzJcIixcbiAgSTY0OiBcIkJpZ0ludDY0XCIsXG4gIFU2NDogXCJCaWdVaW50NjRcIixcbiAgRjMyOiBcIkZsb2F0MzJcIixcbiAgRjY0OiBcIkZsb2F0NjRcIlxufTtcbnZhciBzcGVjaWFsUHJvZHVjdERlc2VyaWFsaXplcnMgPSB7XG4gIF9fdGltZV9kdXJhdGlvbl9taWNyb3NfXzogKHJlYWRlcikgPT4gbmV3IFRpbWVEdXJhdGlvbihyZWFkZXIucmVhZEk2NCgpKSxcbiAgX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfXzogKHJlYWRlcikgPT4gbmV3IFRpbWVzdGFtcChyZWFkZXIucmVhZEk2NCgpKSxcbiAgX19pZGVudGl0eV9fOiAocmVhZGVyKSA9PiBuZXcgSWRlbnRpdHkocmVhZGVyLnJlYWRVMjU2KCkpLFxuICBfX2Nvbm5lY3Rpb25faWRfXzogKHJlYWRlcikgPT4gbmV3IENvbm5lY3Rpb25JZChyZWFkZXIucmVhZFUxMjgoKSksXG4gIF9fdXVpZF9fOiAocmVhZGVyKSA9PiBuZXcgVXVpZChyZWFkZXIucmVhZFUxMjgoKSlcbn07XG5PYmplY3QuZnJlZXplKHNwZWNpYWxQcm9kdWN0RGVzZXJpYWxpemVycyk7XG52YXIgdW5pdERlc2VyaWFsaXplciA9ICgpID0+ICh7fSk7XG52YXIgZ2V0RWxlbWVudEluaXRpYWxpemVyID0gKGVsZW1lbnQpID0+IHtcbiAgbGV0IGluaXQ7XG4gIHN3aXRjaCAoZWxlbWVudC5hbGdlYnJhaWNUeXBlLnRhZykge1xuICAgIGNhc2UgXCJTdHJpbmdcIjpcbiAgICAgIGluaXQgPSBcIicnXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiQm9vbFwiOlxuICAgICAgaW5pdCA9IFwiZmFsc2VcIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJJOFwiOlxuICAgIGNhc2UgXCJVOFwiOlxuICAgIGNhc2UgXCJJMTZcIjpcbiAgICBjYXNlIFwiVTE2XCI6XG4gICAgY2FzZSBcIkkzMlwiOlxuICAgIGNhc2UgXCJVMzJcIjpcbiAgICAgIGluaXQgPSBcIjBcIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJJNjRcIjpcbiAgICBjYXNlIFwiVTY0XCI6XG4gICAgY2FzZSBcIkkxMjhcIjpcbiAgICBjYXNlIFwiVTEyOFwiOlxuICAgIGNhc2UgXCJJMjU2XCI6XG4gICAgY2FzZSBcIlUyNTZcIjpcbiAgICAgIGluaXQgPSBcIjBuXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiRjMyXCI6XG4gICAgY2FzZSBcIkY2NFwiOlxuICAgICAgaW5pdCA9IFwiMC4wXCI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgaW5pdCA9IFwidW5kZWZpbmVkXCI7XG4gIH1cbiAgcmV0dXJuIGAke2VsZW1lbnQubmFtZX06ICR7aW5pdH1gO1xufTtcbnZhciBQcm9kdWN0VHlwZSA9IHtcbiAgbWFrZVNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkge1xuICAgIGxldCBzZXJpYWxpemVyID0gU0VSSUFMSVpFUlMuZ2V0KHR5KTtcbiAgICBpZiAoc2VyaWFsaXplciAhPSBudWxsKSByZXR1cm4gc2VyaWFsaXplcjtcbiAgICBpZiAoaXNGaXhlZFNpemVQcm9kdWN0KHR5KSkge1xuICAgICAgY29uc3Qgc2l6ZSA9IHByb2R1Y3RTaXplKHR5KTtcbiAgICAgIGNvbnN0IGJvZHkyID0gYFwidXNlIHN0cmljdFwiO1xud3JpdGVyLmV4cGFuZEJ1ZmZlcigke3NpemV9KTtcbmNvbnN0IHZpZXcgPSB3cml0ZXIudmlldztcbiR7dHkuZWxlbWVudHMubWFwKFxuICAgICAgICAoeyBuYW1lLCBhbGdlYnJhaWNUeXBlOiB7IHRhZyB9IH0pID0+IHRhZyBpbiBwcmltaXRpdmVKU05hbWUgPyBgdmlldy5zZXQke3ByaW1pdGl2ZUpTTmFtZVt0YWddfSh3cml0ZXIub2Zmc2V0LCB2YWx1ZS4ke25hbWV9LCAke3ByaW1pdGl2ZVNpemVzW3RhZ10gPiAxID8gXCJ0cnVlXCIgOiBcIlwifSk7XG53cml0ZXIub2Zmc2V0ICs9ICR7cHJpbWl0aXZlU2l6ZXNbdGFnXX07YCA6IGB3cml0ZXIud3JpdGUke3RhZ30odmFsdWUuJHtuYW1lfSk7YFxuICAgICAgKS5qb2luKFwiXFxuXCIpfWA7XG4gICAgICBzZXJpYWxpemVyID0gRnVuY3Rpb24oXCJ3cml0ZXJcIiwgXCJ2YWx1ZVwiLCBib2R5Mik7XG4gICAgICBTRVJJQUxJWkVSUy5zZXQodHksIHNlcmlhbGl6ZXIpO1xuICAgICAgcmV0dXJuIHNlcmlhbGl6ZXI7XG4gICAgfVxuICAgIGNvbnN0IHNlcmlhbGl6ZXJzID0ge307XG4gICAgY29uc3QgYm9keSA9ICdcInVzZSBzdHJpY3RcIjtcXG4nICsgdHkuZWxlbWVudHMubWFwKFxuICAgICAgKGVsZW1lbnQpID0+IGB0aGlzLiR7ZWxlbWVudC5uYW1lfSh3cml0ZXIsIHZhbHVlLiR7ZWxlbWVudC5uYW1lfSk7YFxuICAgICkuam9pbihcIlxcblwiKTtcbiAgICBzZXJpYWxpemVyID0gRnVuY3Rpb24oXCJ3cml0ZXJcIiwgXCJ2YWx1ZVwiLCBib2R5KS5iaW5kKFxuICAgICAgc2VyaWFsaXplcnNcbiAgICApO1xuICAgIFNFUklBTElaRVJTLnNldCh0eSwgc2VyaWFsaXplcik7XG4gICAgZm9yIChjb25zdCB7IG5hbWUsIGFsZ2VicmFpY1R5cGUgfSBvZiB0eS5lbGVtZW50cykge1xuICAgICAgc2VyaWFsaXplcnNbbmFtZV0gPSBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKFxuICAgICAgICBhbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgICk7XG4gICAgfVxuICAgIE9iamVjdC5mcmVlemUoc2VyaWFsaXplcnMpO1xuICAgIHJldHVybiBzZXJpYWxpemVyO1xuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlU2VyaWFsaXplcmAgaW5zdGVhZC4gKi9cbiAgc2VyaWFsaXplVmFsdWUod3JpdGVyLCB0eSwgdmFsdWUsIHR5cGVzcGFjZSkge1xuICAgIFByb2R1Y3RUeXBlLm1ha2VTZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpKHdyaXRlciwgdmFsdWUpO1xuICB9LFxuICBtYWtlRGVzZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpIHtcbiAgICBzd2l0Y2ggKHR5LmVsZW1lbnRzLmxlbmd0aCkge1xuICAgICAgY2FzZSAwOlxuICAgICAgICByZXR1cm4gdW5pdERlc2VyaWFsaXplcjtcbiAgICAgIGNhc2UgMToge1xuICAgICAgICBjb25zdCBmaWVsZE5hbWUgPSB0eS5lbGVtZW50c1swXS5uYW1lO1xuICAgICAgICBpZiAoaGFzT3duKHNwZWNpYWxQcm9kdWN0RGVzZXJpYWxpemVycywgZmllbGROYW1lKSlcbiAgICAgICAgICByZXR1cm4gc3BlY2lhbFByb2R1Y3REZXNlcmlhbGl6ZXJzW2ZpZWxkTmFtZV07XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBkZXNlcmlhbGl6ZXIgPSBERVNFUklBTElaRVJTLmdldCh0eSk7XG4gICAgaWYgKGRlc2VyaWFsaXplciAhPSBudWxsKSByZXR1cm4gZGVzZXJpYWxpemVyO1xuICAgIGlmIChpc0ZpeGVkU2l6ZVByb2R1Y3QodHkpKSB7XG4gICAgICBjb25zdCBib2R5ID0gYFwidXNlIHN0cmljdFwiO1xuY29uc3QgcmVzdWx0ID0geyAke3R5LmVsZW1lbnRzLm1hcChnZXRFbGVtZW50SW5pdGlhbGl6ZXIpLmpvaW4oXCIsIFwiKX0gfTtcbmNvbnN0IHZpZXcgPSByZWFkZXIudmlldztcbiR7dHkuZWxlbWVudHMubWFwKFxuICAgICAgICAoeyBuYW1lLCBhbGdlYnJhaWNUeXBlOiB7IHRhZyB9IH0pID0+IHRhZyBpbiBwcmltaXRpdmVKU05hbWUgPyB0YWcgPT09IFwiQm9vbFwiID8gYHJlc3VsdC4ke25hbWV9ID0gdmlldy5nZXRVaW50OChyZWFkZXIub2Zmc2V0KSAhPT0gMDtcbnJlYWRlci5vZmZzZXQgKz0gMTtgIDogYHJlc3VsdC4ke25hbWV9ID0gdmlldy5nZXQke3ByaW1pdGl2ZUpTTmFtZVt0YWddfShyZWFkZXIub2Zmc2V0LCAke3ByaW1pdGl2ZVNpemVzW3RhZ10gPiAxID8gXCJ0cnVlXCIgOiBcIlwifSk7XG5yZWFkZXIub2Zmc2V0ICs9ICR7cHJpbWl0aXZlU2l6ZXNbdGFnXX07YCA6IGByZXN1bHQuJHtuYW1lfSA9IHJlYWRlci5yZWFkJHt0YWd9KCk7YFxuICAgICAgKS5qb2luKFwiXFxuXCIpfVxucmV0dXJuIHJlc3VsdDtgO1xuICAgICAgZGVzZXJpYWxpemVyID0gRnVuY3Rpb24oXCJyZWFkZXJcIiwgYm9keSk7XG4gICAgICBERVNFUklBTElaRVJTLnNldCh0eSwgZGVzZXJpYWxpemVyKTtcbiAgICAgIHJldHVybiBkZXNlcmlhbGl6ZXI7XG4gICAgfVxuICAgIGNvbnN0IGRlc2VyaWFsaXplcnMgPSB7fTtcbiAgICBkZXNlcmlhbGl6ZXIgPSBGdW5jdGlvbihcbiAgICAgIFwicmVhZGVyXCIsXG4gICAgICBgXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCByZXN1bHQgPSB7ICR7dHkuZWxlbWVudHMubWFwKGdldEVsZW1lbnRJbml0aWFsaXplcikuam9pbihcIiwgXCIpfSB9O1xuJHt0eS5lbGVtZW50cy5tYXAoKHsgbmFtZSB9KSA9PiBgcmVzdWx0LiR7bmFtZX0gPSB0aGlzLiR7bmFtZX0ocmVhZGVyKTtgKS5qb2luKFwiXFxuXCIpfVxucmV0dXJuIHJlc3VsdDtgXG4gICAgKS5iaW5kKGRlc2VyaWFsaXplcnMpO1xuICAgIERFU0VSSUFMSVpFUlMuc2V0KHR5LCBkZXNlcmlhbGl6ZXIpO1xuICAgIGZvciAoY29uc3QgeyBuYW1lLCBhbGdlYnJhaWNUeXBlIH0gb2YgdHkuZWxlbWVudHMpIHtcbiAgICAgIGRlc2VyaWFsaXplcnNbbmFtZV0gPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICAgIGFsZ2VicmFpY1R5cGUsXG4gICAgICAgIHR5cGVzcGFjZVxuICAgICAgKTtcbiAgICB9XG4gICAgT2JqZWN0LmZyZWV6ZShkZXNlcmlhbGl6ZXJzKTtcbiAgICByZXR1cm4gZGVzZXJpYWxpemVyO1xuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlRGVzZXJpYWxpemVyYCBpbnN0ZWFkLiAqL1xuICBkZXNlcmlhbGl6ZVZhbHVlKHJlYWRlciwgdHksIHR5cGVzcGFjZSkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZS5tYWtlRGVzZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpKHJlYWRlcik7XG4gIH0sXG4gIGludG9NYXBLZXkodHksIHZhbHVlKSB7XG4gICAgaWYgKHR5LmVsZW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgY29uc3QgZmllbGROYW1lID0gdHkuZWxlbWVudHNbMF0ubmFtZTtcbiAgICAgIGlmIChoYXNPd24oc3BlY2lhbFByb2R1Y3REZXNlcmlhbGl6ZXJzLCBmaWVsZE5hbWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZVtmaWVsZE5hbWVdO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDEwKTtcbiAgICBBbGdlYnJhaWNUeXBlLnNlcmlhbGl6ZVZhbHVlKHdyaXRlciwgQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHR5KSwgdmFsdWUpO1xuICAgIHJldHVybiB3cml0ZXIudG9CYXNlNjQoKTtcbiAgfVxufTtcbnZhciBTdW1UeXBlID0ge1xuICBtYWtlU2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKSB7XG4gICAgaWYgKHR5LnZhcmlhbnRzLmxlbmd0aCA9PSAyICYmIHR5LnZhcmlhbnRzWzBdLm5hbWUgPT09IFwic29tZVwiICYmIHR5LnZhcmlhbnRzWzFdLm5hbWUgPT09IFwibm9uZVwiKSB7XG4gICAgICBjb25zdCBzZXJpYWxpemUgPSBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKFxuICAgICAgICB0eS52YXJpYW50c1swXS5hbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgICk7XG4gICAgICByZXR1cm4gKHdyaXRlciwgdmFsdWUpID0+IHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVCeXRlKDApO1xuICAgICAgICAgIHNlcmlhbGl6ZSh3cml0ZXIsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVCeXRlKDEpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHkudmFyaWFudHMubGVuZ3RoID09IDIgJiYgdHkudmFyaWFudHNbMF0ubmFtZSA9PT0gXCJva1wiICYmIHR5LnZhcmlhbnRzWzFdLm5hbWUgPT09IFwiZXJyXCIpIHtcbiAgICAgIGNvbnN0IHNlcmlhbGl6ZU9rID0gQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihcbiAgICAgICAgdHkudmFyaWFudHNbMF0uYWxnZWJyYWljVHlwZSxcbiAgICAgICAgdHlwZXNwYWNlXG4gICAgICApO1xuICAgICAgY29uc3Qgc2VyaWFsaXplRXJyID0gQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihcbiAgICAgICAgdHkudmFyaWFudHNbMV0uYWxnZWJyYWljVHlwZSxcbiAgICAgICAgdHlwZXNwYWNlXG4gICAgICApO1xuICAgICAgcmV0dXJuICh3cml0ZXIsIHZhbHVlKSA9PiB7XG4gICAgICAgIGlmIChcIm9rXCIgaW4gdmFsdWUpIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVVOCgwKTtcbiAgICAgICAgICBzZXJpYWxpemVPayh3cml0ZXIsIHZhbHVlLm9rKTtcbiAgICAgICAgfSBlbHNlIGlmIChcImVyclwiIGluIHZhbHVlKSB7XG4gICAgICAgICAgd3JpdGVyLndyaXRlVTgoMSk7XG4gICAgICAgICAgc2VyaWFsaXplRXJyKHdyaXRlciwgdmFsdWUuZXJyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgXCJjb3VsZCBub3Qgc2VyaWFsaXplIHJlc3VsdDogb2JqZWN0IGhhZCBuZWl0aGVyIGEgYG9rYCBub3IgYW4gYGVycmAgZmllbGRcIlxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBzZXJpYWxpemVyID0gU0VSSUFMSVpFUlMuZ2V0KHR5KTtcbiAgICAgIGlmIChzZXJpYWxpemVyICE9IG51bGwpIHJldHVybiBzZXJpYWxpemVyO1xuICAgICAgY29uc3Qgc2VyaWFsaXplcnMgPSB7fTtcbiAgICAgIGNvbnN0IGJvZHkgPSBgc3dpdGNoICh2YWx1ZS50YWcpIHtcbiR7dHkudmFyaWFudHMubWFwKFxuICAgICAgICAoeyBuYW1lIH0sIGkpID0+IGAgIGNhc2UgJHtKU09OLnN0cmluZ2lmeShuYW1lKX06XG4gICAgd3JpdGVyLndyaXRlQnl0ZSgke2l9KTtcbiAgICByZXR1cm4gdGhpcy4ke25hbWV9KHdyaXRlciwgdmFsdWUudmFsdWUpO2BcbiAgICAgICkuam9pbihcIlxcblwiKX1cbiAgZGVmYXVsdDpcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgXFxgQ291bGQgbm90IHNlcmlhbGl6ZSBzdW0gdHlwZTsgdW5rbm93biB0YWcgXFwke3ZhbHVlLnRhZ31cXGBcbiAgICApXG59XG5gO1xuICAgICAgc2VyaWFsaXplciA9IEZ1bmN0aW9uKFwid3JpdGVyXCIsIFwidmFsdWVcIiwgYm9keSkuYmluZChcbiAgICAgICAgc2VyaWFsaXplcnNcbiAgICAgICk7XG4gICAgICBTRVJJQUxJWkVSUy5zZXQodHksIHNlcmlhbGl6ZXIpO1xuICAgICAgZm9yIChjb25zdCB7IG5hbWUsIGFsZ2VicmFpY1R5cGUgfSBvZiB0eS52YXJpYW50cykge1xuICAgICAgICBzZXJpYWxpemVyc1tuYW1lXSA9IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIoXG4gICAgICAgICAgYWxnZWJyYWljVHlwZSxcbiAgICAgICAgICB0eXBlc3BhY2VcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIE9iamVjdC5mcmVlemUoc2VyaWFsaXplcnMpO1xuICAgICAgcmV0dXJuIHNlcmlhbGl6ZXI7XG4gICAgfVxuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlU2VyaWFsaXplcmAgaW5zdGVhZC4gKi9cbiAgc2VyaWFsaXplVmFsdWUod3JpdGVyLCB0eSwgdmFsdWUsIHR5cGVzcGFjZSkge1xuICAgIFN1bVR5cGUubWFrZVNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkod3JpdGVyLCB2YWx1ZSk7XG4gIH0sXG4gIG1ha2VEZXNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkge1xuICAgIGlmICh0eS52YXJpYW50cy5sZW5ndGggPT0gMiAmJiB0eS52YXJpYW50c1swXS5uYW1lID09PSBcInNvbWVcIiAmJiB0eS52YXJpYW50c1sxXS5uYW1lID09PSBcIm5vbmVcIikge1xuICAgICAgY29uc3QgZGVzZXJpYWxpemUgPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICAgIHR5LnZhcmlhbnRzWzBdLmFsZ2VicmFpY1R5cGUsXG4gICAgICAgIHR5cGVzcGFjZVxuICAgICAgKTtcbiAgICAgIHJldHVybiAocmVhZGVyKSA9PiB7XG4gICAgICAgIGNvbnN0IHRhZyA9IHJlYWRlci5yZWFkVTgoKTtcbiAgICAgICAgaWYgKHRhZyA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBkZXNlcmlhbGl6ZShyZWFkZXIpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gMSkge1xuICAgICAgICAgIHJldHVybiB2b2lkIDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgYENhbid0IGRlc2VyaWFsaXplIGFuIG9wdGlvbiB0eXBlLCBjb3VsZG4ndCBmaW5kICR7dGFnfSB0YWdgO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHkudmFyaWFudHMubGVuZ3RoID09IDIgJiYgdHkudmFyaWFudHNbMF0ubmFtZSA9PT0gXCJva1wiICYmIHR5LnZhcmlhbnRzWzFdLm5hbWUgPT09IFwiZXJyXCIpIHtcbiAgICAgIGNvbnN0IGRlc2VyaWFsaXplT2sgPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICAgIHR5LnZhcmlhbnRzWzBdLmFsZ2VicmFpY1R5cGUsXG4gICAgICAgIHR5cGVzcGFjZVxuICAgICAgKTtcbiAgICAgIGNvbnN0IGRlc2VyaWFsaXplRXJyID0gQWxnZWJyYWljVHlwZS5tYWtlRGVzZXJpYWxpemVyKFxuICAgICAgICB0eS52YXJpYW50c1sxXS5hbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgICk7XG4gICAgICByZXR1cm4gKHJlYWRlcikgPT4ge1xuICAgICAgICBjb25zdCB0YWcgPSByZWFkZXIucmVhZEJ5dGUoKTtcbiAgICAgICAgaWYgKHRhZyA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiB7IG9rOiBkZXNlcmlhbGl6ZU9rKHJlYWRlcikgfTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4geyBlcnI6IGRlc2VyaWFsaXplRXJyKHJlYWRlcikgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBgQ2FuJ3QgZGVzZXJpYWxpemUgYSByZXN1bHQgdHlwZSwgY291bGRuJ3QgZmluZCAke3RhZ30gdGFnYDtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGRlc2VyaWFsaXplciA9IERFU0VSSUFMSVpFUlMuZ2V0KHR5KTtcbiAgICAgIGlmIChkZXNlcmlhbGl6ZXIgIT0gbnVsbCkgcmV0dXJuIGRlc2VyaWFsaXplcjtcbiAgICAgIGNvbnN0IGRlc2VyaWFsaXplcnMgPSB7fTtcbiAgICAgIGRlc2VyaWFsaXplciA9IEZ1bmN0aW9uKFxuICAgICAgICBcInJlYWRlclwiLFxuICAgICAgICBgc3dpdGNoIChyZWFkZXIucmVhZFU4KCkpIHtcbiR7dHkudmFyaWFudHMubWFwKFxuICAgICAgICAgICh7IG5hbWUgfSwgaSkgPT4gYGNhc2UgJHtpfTogcmV0dXJuIHsgdGFnOiAke0pTT04uc3RyaW5naWZ5KG5hbWUpfSwgdmFsdWU6IHRoaXMuJHtuYW1lfShyZWFkZXIpIH07YFxuICAgICAgICApLmpvaW4oXCJcXG5cIil9IH1gXG4gICAgICApLmJpbmQoZGVzZXJpYWxpemVycyk7XG4gICAgICBERVNFUklBTElaRVJTLnNldCh0eSwgZGVzZXJpYWxpemVyKTtcbiAgICAgIGZvciAoY29uc3QgeyBuYW1lLCBhbGdlYnJhaWNUeXBlIH0gb2YgdHkudmFyaWFudHMpIHtcbiAgICAgICAgZGVzZXJpYWxpemVyc1tuYW1lXSA9IEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcihcbiAgICAgICAgICBhbGdlYnJhaWNUeXBlLFxuICAgICAgICAgIHR5cGVzcGFjZVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgT2JqZWN0LmZyZWV6ZShkZXNlcmlhbGl6ZXJzKTtcbiAgICAgIHJldHVybiBkZXNlcmlhbGl6ZXI7XG4gICAgfVxuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlRGVzZXJpYWxpemVyYCBpbnN0ZWFkLiAqL1xuICBkZXNlcmlhbGl6ZVZhbHVlKHJlYWRlciwgdHksIHR5cGVzcGFjZSkge1xuICAgIHJldHVybiBTdW1UeXBlLm1ha2VEZXNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkocmVhZGVyKTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9vcHRpb24udHNcbnZhciBPcHRpb24gPSB7XG4gIGdldEFsZ2VicmFpY1R5cGUoaW5uZXJUeXBlKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuU3VtKHtcbiAgICAgIHZhcmlhbnRzOiBbXG4gICAgICAgIHsgbmFtZTogXCJzb21lXCIsIGFsZ2VicmFpY1R5cGU6IGlubmVyVHlwZSB9LFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogXCJub25lXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHsgZWxlbWVudHM6IFtdIH0pXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9yZXN1bHQudHNcbnZhciBSZXN1bHQgPSB7XG4gIGdldEFsZ2VicmFpY1R5cGUob2tUeXBlLCBlcnJUeXBlKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuU3VtKHtcbiAgICAgIHZhcmlhbnRzOiBbXG4gICAgICAgIHsgbmFtZTogXCJva1wiLCBhbGdlYnJhaWNUeXBlOiBva1R5cGUgfSxcbiAgICAgICAgeyBuYW1lOiBcImVyclwiLCBhbGdlYnJhaWNUeXBlOiBlcnJUeXBlIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9zY2hlZHVsZV9hdC50c1xudmFyIFNjaGVkdWxlQXQgPSB7XG4gIGludGVydmFsKHZhbHVlKSB7XG4gICAgcmV0dXJuIEludGVydmFsKHZhbHVlKTtcbiAgfSxcbiAgdGltZSh2YWx1ZSkge1xuICAgIHJldHVybiBUaW1lKHZhbHVlKTtcbiAgfSxcbiAgZ2V0QWxnZWJyYWljVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZS5TdW0oe1xuICAgICAgdmFyaWFudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IFwiSW50ZXJ2YWxcIixcbiAgICAgICAgICBhbGdlYnJhaWNUeXBlOiBUaW1lRHVyYXRpb24uZ2V0QWxnZWJyYWljVHlwZSgpXG4gICAgICAgIH0sXG4gICAgICAgIHsgbmFtZTogXCJUaW1lXCIsIGFsZ2VicmFpY1R5cGU6IFRpbWVzdGFtcC5nZXRBbGdlYnJhaWNUeXBlKCkgfVxuICAgICAgXVxuICAgIH0pO1xuICB9LFxuICBpc1NjaGVkdWxlQXQoYWxnZWJyYWljVHlwZSkge1xuICAgIGlmIChhbGdlYnJhaWNUeXBlLnRhZyAhPT0gXCJTdW1cIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCB2YXJpYW50cyA9IGFsZ2VicmFpY1R5cGUudmFsdWUudmFyaWFudHM7XG4gICAgaWYgKHZhcmlhbnRzLmxlbmd0aCAhPT0gMikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBpbnRlcnZhbFZhcmlhbnQgPSB2YXJpYW50cy5maW5kKCh2KSA9PiB2Lm5hbWUgPT09IFwiSW50ZXJ2YWxcIik7XG4gICAgY29uc3QgdGltZVZhcmlhbnQgPSB2YXJpYW50cy5maW5kKCh2KSA9PiB2Lm5hbWUgPT09IFwiVGltZVwiKTtcbiAgICBpZiAoIWludGVydmFsVmFyaWFudCB8fCAhdGltZVZhcmlhbnQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIFRpbWVEdXJhdGlvbi5pc1RpbWVEdXJhdGlvbihpbnRlcnZhbFZhcmlhbnQuYWxnZWJyYWljVHlwZSkgJiYgVGltZXN0YW1wLmlzVGltZXN0YW1wKHRpbWVWYXJpYW50LmFsZ2VicmFpY1R5cGUpO1xuICB9XG59O1xudmFyIEludGVydmFsID0gKG1pY3JvcykgPT4gKHtcbiAgdGFnOiBcIkludGVydmFsXCIsXG4gIHZhbHVlOiBuZXcgVGltZUR1cmF0aW9uKG1pY3Jvcylcbn0pO1xudmFyIFRpbWUgPSAobWljcm9zU2luY2VVbml4RXBvY2gpID0+ICh7XG4gIHRhZzogXCJUaW1lXCIsXG4gIHZhbHVlOiBuZXcgVGltZXN0YW1wKG1pY3Jvc1NpbmNlVW5peEVwb2NoKVxufSk7XG52YXIgc2NoZWR1bGVfYXRfZGVmYXVsdCA9IFNjaGVkdWxlQXQ7XG5cbi8vIHNyYy9saWIvdHlwZV91dGlsLnRzXG5mdW5jdGlvbiBzZXQoeCwgdDIpIHtcbiAgcmV0dXJuIHsgLi4ueCwgLi4udDIgfTtcbn1cblxuLy8gc3JjL2xpYi90eXBlX2J1aWxkZXJzLnRzXG52YXIgVHlwZUJ1aWxkZXIgPSBjbGFzcyB7XG4gIC8qKlxuICAgKiBUaGUgVHlwZVNjcmlwdCBwaGFudG9tIHR5cGUuIFRoaXMgaXMgbm90IHN0b3JlZCBhdCBydW50aW1lLFxuICAgKiBidXQgaXMgdmlzaWJsZSB0byB0aGUgY29tcGlsZXJcbiAgICovXG4gIHR5cGU7XG4gIC8qKlxuICAgKiBUaGUgU3BhY2V0aW1lREIgYWxnZWJyYWljIHR5cGUgKHJ1buKAkXRpbWUgdmFsdWUpLiBJbiBhZGRpdGlvbiB0byBzdG9yaW5nXG4gICAqIHRoZSBydW50aW1lIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBgQWxnZWJyYWljVHlwZWAsIGl0IGFsc28gY2FwdHVyZXNcbiAgICogdGhlIFR5cGVTY3JpcHQgdHlwZSBpbmZvcm1hdGlvbiBvZiB0aGUgYEFsZ2VicmFpY1R5cGVgLiBUaGF0IGlzIHRvIHNheVxuICAgKiB0aGUgdmFsdWUgaXMgbm90IG1lcmVseSBhbiBgQWxnZWJyYWljVHlwZWAsIGJ1dCBpcyBjb25zdHJ1Y3RlZCB0byBiZVxuICAgKiB0aGUgY29ycmVzcG9uZGluZyBjb25jcmV0ZSBgQWxnZWJyYWljVHlwZWAgZm9yIHRoZSBUeXBlU2NyaXB0IHR5cGUgYFR5cGVgLlxuICAgKlxuICAgKiBlLmcuIGBzdHJpbmdgIGNvcnJlc3BvbmRzIHRvIGBBbGdlYnJhaWNUeXBlLlN0cmluZ2BcbiAgICovXG4gIGFsZ2VicmFpY1R5cGU7XG4gIGNvbnN0cnVjdG9yKGFsZ2VicmFpY1R5cGUpIHtcbiAgICB0aGlzLmFsZ2VicmFpY1R5cGUgPSBhbGdlYnJhaWNUeXBlO1xuICB9XG4gIG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBuZXcgT3B0aW9uQnVpbGRlcih0aGlzKTtcbiAgfVxuICAvKiogTWF0Y2ggdGhpcyBjb2x1bW4gdG8gYSByZWNlaXZlciBwYXJhbWV0ZXIgaW4gYW4gb3V0Ym94IHRhYmxlLiAqL1xuICBwYXJhbShvcHRzKSB7XG4gICAgcmV0dXJuIG5ldyBDb2x1bW5CdWlsZGVyKHRoaXMsIHsgcGFyYW1OYW1lOiBvcHRzLm5hbWUgfSk7XG4gIH1cbiAgc2VyaWFsaXplKHdyaXRlciwgdmFsdWUpIHtcbiAgICBjb25zdCBzZXJpYWxpemUgPSB0aGlzLnNlcmlhbGl6ZSA9IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIoXG4gICAgICB0aGlzLmFsZ2VicmFpY1R5cGVcbiAgICApO1xuICAgIHNlcmlhbGl6ZSh3cml0ZXIsIHZhbHVlKTtcbiAgfVxuICBkZXNlcmlhbGl6ZShyZWFkZXIpIHtcbiAgICBjb25zdCBkZXNlcmlhbGl6ZSA9IHRoaXMuZGVzZXJpYWxpemUgPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICB0aGlzLmFsZ2VicmFpY1R5cGVcbiAgICApO1xuICAgIHJldHVybiBkZXNlcmlhbGl6ZShyZWFkZXIpO1xuICB9XG59O1xudmFyIFU4QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLlU4KTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFU4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVOENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KSk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFU4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IFU4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBVOENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBVMTZCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuVTE2KTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFUxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IFUxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFUxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFUxNkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBVMzJCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuVTMyKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFUzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IFUzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFUzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFUzMkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBVNjRCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuVTY0KTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFU2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IFU2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFU2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFU2NENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBVMTI4QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLlUxMjgpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFUxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFUxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBVMTI4Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFUyNTZCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuVTI1Nik7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBVMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgVTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBVMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFUyNTZDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSThCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuSTgpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgSThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEk4Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgSThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgSThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IEk4Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIEkxNkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5JMTYpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSTE2Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIEkzMkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5JMzIpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgSTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgSTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgSTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSTMyQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIEk2NEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5JNjQpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSTY0Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIEkxMjhCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuSTEyOCk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBJMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgSTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgSTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IEkxMjhDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSTI1NkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5JMjU2KTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IEkyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEkyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IEkyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSTI1NkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBGMzJCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuRjMyKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBGMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBGMzJDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgRjY0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkY2NCk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgRjY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgRjY0Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIEJvb2xCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuQm9vbCk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBCb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBCb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgQm9vbENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBCb29sQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFN0cmluZ0J1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5TdHJpbmcpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgU3RyaW5nQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJpbmdDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJpbmdDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJpbmdDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJpbmdDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgQXJyYXlCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGVsZW1lbnQ7XG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkFycmF5KGVsZW1lbnQuYWxnZWJyYWljVHlwZSkpO1xuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgQXJyYXlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBBcnJheUNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBCeXRlQXJyYXlCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuQXJyYXkoQWxnZWJyYWljVHlwZS5VOCkpO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IEJ5dGVBcnJheUNvbHVtbkJ1aWxkZXIoXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgQnl0ZUFycmF5Q29sdW1uQnVpbGRlcihzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIE9wdGlvbkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgdmFsdWU7XG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgc3VwZXIoT3B0aW9uLmdldEFsZ2VicmFpY1R5cGUodmFsdWUuYWxnZWJyYWljVHlwZSkpO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBPcHRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBPcHRpb25Db2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgUHJvZHVjdEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgdHlwZU5hbWU7XG4gIGVsZW1lbnRzO1xuICBjb25zdHJ1Y3RvcihlbGVtZW50cywgbmFtZSkge1xuICAgIGZ1bmN0aW9uIGVsZW1lbnRzQXJyYXlGcm9tRWxlbWVudHNPYmoob2JqKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKS5tYXAoKGtleSkgPT4gKHtcbiAgICAgICAgbmFtZToga2V5LFxuICAgICAgICAvLyBMYXppbHkgcmVzb2x2ZSB0aGUgdW5kZXJseWluZyBvYmplY3QncyBhbGdlYnJhaWNUeXBlLlxuICAgICAgICAvLyBUaGlzIHdpbGwgY2FsbCBvYmpba2V5XS5hbGdlYnJhaWNUeXBlIG9ubHkgd2hlbiBzb21lb25lXG4gICAgICAgIC8vIGFjdHVhbGx5IHJlYWRzIHRoaXMgcHJvcGVydHkuXG4gICAgICAgIGdldCBhbGdlYnJhaWNUeXBlKCkge1xuICAgICAgICAgIHJldHVybiBvYmpba2V5XS5hbGdlYnJhaWNUeXBlO1xuICAgICAgICB9XG4gICAgICB9KSk7XG4gICAgfVxuICAgIHN1cGVyKFxuICAgICAgQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHtcbiAgICAgICAgZWxlbWVudHM6IGVsZW1lbnRzQXJyYXlGcm9tRWxlbWVudHNPYmooZWxlbWVudHMpXG4gICAgICB9KVxuICAgICk7XG4gICAgdGhpcy50eXBlTmFtZSA9IG5hbWU7XG4gICAgdGhpcy5lbGVtZW50cyA9IGVsZW1lbnRzO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFByb2R1Y3RDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9kdWN0Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFJlc3VsdEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgb2s7XG4gIGVycjtcbiAgY29uc3RydWN0b3Iob2ssIGVycikge1xuICAgIHN1cGVyKFJlc3VsdC5nZXRBbGdlYnJhaWNUeXBlKG9rLmFsZ2VicmFpY1R5cGUsIGVyci5hbGdlYnJhaWNUeXBlKSk7XG4gICAgdGhpcy5vayA9IG9rO1xuICAgIHRoaXMuZXJyID0gZXJyO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFJlc3VsdENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pKTtcbiAgfVxufTtcbnZhciBVbml0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcih7IHRhZzogXCJQcm9kdWN0XCIsIHZhbHVlOiB7IGVsZW1lbnRzOiBbXSB9IH0pO1xuICB9XG59O1xudmFyIFJvd0J1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgcm93O1xuICB0eXBlTmFtZTtcbiAgY29uc3RydWN0b3Iocm93LCBuYW1lKSB7XG4gICAgY29uc3QgbWFwcGVkUm93ID0gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgT2JqZWN0LmVudHJpZXMocm93KS5tYXAoKFtjb2xOYW1lLCBidWlsZGVyXSkgPT4gW1xuICAgICAgICBjb2xOYW1lLFxuICAgICAgICBidWlsZGVyIGluc3RhbmNlb2YgQ29sdW1uQnVpbGRlciA/IGJ1aWxkZXIgOiBuZXcgQ29sdW1uQnVpbGRlcihidWlsZGVyLCB7fSlcbiAgICAgIF0pXG4gICAgKTtcbiAgICBjb25zdCBlbGVtZW50cyA9IE9iamVjdC5rZXlzKG1hcHBlZFJvdykubWFwKChuYW1lMikgPT4gKHtcbiAgICAgIG5hbWU6IG5hbWUyLFxuICAgICAgZ2V0IGFsZ2VicmFpY1R5cGUoKSB7XG4gICAgICAgIHJldHVybiBtYXBwZWRSb3dbbmFtZTJdLnR5cGVCdWlsZGVyLmFsZ2VicmFpY1R5cGU7XG4gICAgICB9XG4gICAgfSkpO1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuUHJvZHVjdCh7IGVsZW1lbnRzIH0pKTtcbiAgICB0aGlzLnJvdyA9IG1hcHBlZFJvdztcbiAgICB0aGlzLnR5cGVOYW1lID0gbmFtZTtcbiAgfVxufTtcbnZhciBTdW1CdWlsZGVySW1wbCA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICB2YXJpYW50cztcbiAgdHlwZU5hbWU7XG4gIGNvbnN0cnVjdG9yKHZhcmlhbnRzLCBuYW1lKSB7XG4gICAgZnVuY3Rpb24gdmFyaWFudHNBcnJheUZyb21WYXJpYW50c09iaih2YXJpYW50czIpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyh2YXJpYW50czIpLm1hcCgoa2V5KSA9PiAoe1xuICAgICAgICBuYW1lOiBrZXksXG4gICAgICAgIC8vIExhemlseSByZXNvbHZlIHRoZSB1bmRlcmx5aW5nIG9iamVjdCdzIGFsZ2VicmFpY1R5cGUuXG4gICAgICAgIC8vIFRoaXMgd2lsbCBjYWxsIG9ialtrZXldLmFsZ2VicmFpY1R5cGUgb25seSB3aGVuIHNvbWVvbmVcbiAgICAgICAgLy8gYWN0dWFsbHkgcmVhZHMgdGhpcyBwcm9wZXJ0eS5cbiAgICAgICAgZ2V0IGFsZ2VicmFpY1R5cGUoKSB7XG4gICAgICAgICAgcmV0dXJuIHZhcmlhbnRzMltrZXldLmFsZ2VicmFpY1R5cGU7XG4gICAgICAgIH1cbiAgICAgIH0pKTtcbiAgICB9XG4gICAgc3VwZXIoXG4gICAgICBBbGdlYnJhaWNUeXBlLlN1bSh7XG4gICAgICAgIHZhcmlhbnRzOiB2YXJpYW50c0FycmF5RnJvbVZhcmlhbnRzT2JqKHZhcmlhbnRzKVxuICAgICAgfSlcbiAgICApO1xuICAgIHRoaXMudmFyaWFudHMgPSB2YXJpYW50cztcbiAgICB0aGlzLnR5cGVOYW1lID0gbmFtZTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyh2YXJpYW50cykpIHtcbiAgICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHZhcmlhbnRzLCBrZXkpO1xuICAgICAgY29uc3QgaXNBY2Nlc3NvciA9ICEhZGVzYyAmJiAodHlwZW9mIGRlc2MuZ2V0ID09PSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIGRlc2Muc2V0ID09PSBcImZ1bmN0aW9uXCIpO1xuICAgICAgbGV0IGlzVW5pdDIgPSBmYWxzZTtcbiAgICAgIGlmICghaXNBY2Nlc3Nvcikge1xuICAgICAgICBjb25zdCB2YXJpYW50ID0gdmFyaWFudHNba2V5XTtcbiAgICAgICAgaXNVbml0MiA9IHZhcmlhbnQgaW5zdGFuY2VvZiBVbml0QnVpbGRlcjtcbiAgICAgIH1cbiAgICAgIGlmIChpc1VuaXQyKSB7XG4gICAgICAgIGNvbnN0IGNvbnN0YW50ID0gdGhpcy5jcmVhdGUoa2V5KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIGtleSwge1xuICAgICAgICAgIHZhbHVlOiBjb25zdGFudCxcbiAgICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZm4gPSAoKHZhbHVlKSA9PiB0aGlzLmNyZWF0ZShrZXksIHZhbHVlKSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBrZXksIHtcbiAgICAgICAgICB2YWx1ZTogZm4sXG4gICAgICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY3JlYXRlKHRhZywgdmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IHZvaWQgMCA/IHsgdGFnIH0gOiB7IHRhZywgdmFsdWUgfTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBTdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBTdW1Db2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBTdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBTdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBTdW1CdWlsZGVyID0gU3VtQnVpbGRlckltcGw7XG52YXIgU2ltcGxlU3VtQnVpbGRlckltcGwgPSBjbGFzcyBleHRlbmRzIFN1bUJ1aWxkZXJJbXBsIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBTaW1wbGVTdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBTaW1wbGVTdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBTaW1wbGVTdW1CdWlsZGVyID0gU2ltcGxlU3VtQnVpbGRlckltcGw7XG52YXIgU2NoZWR1bGVBdEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoc2NoZWR1bGVfYXRfZGVmYXVsdC5nZXRBbGdlYnJhaWNUeXBlKCkpO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFNjaGVkdWxlQXRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBTY2hlZHVsZUF0Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIElkZW50aXR5QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihJZGVudGl0eS5nZXRBbGdlYnJhaWNUeXBlKCkpO1xuICB9XG4gIC8qKiBNYXJrcyB0aGUgZGVzdGluYXRpb24gZGF0YWJhc2UgY29sdW1uIG9mIGFuIElEQyBvdXRib3guICovXG4gIHRhcmdldCgpIHtcbiAgICByZXR1cm4gbmV3IElkZW50aXR5Q29sdW1uQnVpbGRlcih0aGlzLCB7IGlzVGFyZ2V0OiB0cnVlIH0pO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IElkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IElkZW50aXR5Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIENvbm5lY3Rpb25JZEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQ29ubmVjdGlvbklkLmdldEFsZ2VicmFpY1R5cGUoKSk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBDb25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBDb25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBDb25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBDb25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgVGltZXN0YW1wQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihUaW1lc3RhbXAuZ2V0QWxnZWJyYWljVHlwZSgpKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFRpbWVzdGFtcENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IFRpbWVzdGFtcENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFRpbWVzdGFtcENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFRpbWVzdGFtcENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBUaW1lRHVyYXRpb25CdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFRpbWVEdXJhdGlvbi5nZXRBbGdlYnJhaWNUeXBlKCkpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFV1aWRCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFV1aWQuZ2V0QWxnZWJyYWljVHlwZSgpKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFV1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFV1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBVdWlkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IFV1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBVdWlkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVXVpZENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBkZWZhdWx0TWV0YWRhdGEgPSB7fTtcbnZhciBDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0NvbHVtbkJ1aWxkZXIge1xuICB0eXBlQnVpbGRlcjtcbiAgY29sdW1uTWV0YWRhdGE7XG4gIGNvbnN0cnVjdG9yKHR5cGVCdWlsZGVyLCBtZXRhZGF0YSkge1xuICAgIHRoaXMudHlwZUJ1aWxkZXIgPSB0eXBlQnVpbGRlcjtcbiAgICB0aGlzLmNvbHVtbk1ldGFkYXRhID0gbWV0YWRhdGE7XG4gIH1cbiAgLyoqIE1hdGNoIHRoaXMgY29sdW1uIHRvIGEgcmVjZWl2ZXIgcGFyYW1ldGVyIGluIGFuIG91dGJveCB0YWJsZS4gKi9cbiAgcGFyYW0ob3B0cykge1xuICAgIHJldHVybiBuZXcgX0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgcGFyYW1OYW1lOiBvcHRzLm5hbWUgfSlcbiAgICApO1xuICB9XG4gIHNlcmlhbGl6ZSh3cml0ZXIsIHZhbHVlKSB7XG4gICAgdGhpcy50eXBlQnVpbGRlci5zZXJpYWxpemUod3JpdGVyLCB2YWx1ZSk7XG4gIH1cbiAgZGVzZXJpYWxpemUocmVhZGVyKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZUJ1aWxkZXIuZGVzZXJpYWxpemUocmVhZGVyKTtcbiAgfVxufTtcbnZhciBVOENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfVThDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1U4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX1U4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX1U4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1U4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBVMTZDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1UxNkNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX1UxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9VMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9VMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFUzMkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfVTMyQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9VMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9VMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9VMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1UzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1UzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgVTY0Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9VNjRDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1U2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9VNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1U2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX1U2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBVMTI4Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9VMTI4Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9VMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX1UxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1UxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9VMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9VMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgVTI1NkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfVTI1NkNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfVTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9VMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9VMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1UyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEk4Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9JOENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfSThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfSThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfSThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfSThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEkxNkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfSTE2Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9JMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9JMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9JMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0kxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0kxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgSTMyQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9JMzJDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX0kzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9JMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX0kzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX0kzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfSTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfSTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJNjRDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0k2NENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0k2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9JNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9JNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEkxMjhDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0kxMjhDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX0kxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX0kxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0kxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9JMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJMjU2Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9JMjU2Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9JMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0kyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX0kyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9JMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9JMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgRjMyQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9GMzJDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9GMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9GMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEY2NENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfRjY0Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfRjY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfRjY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBCb29sQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9Cb29sQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0Jvb2xDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX0Jvb2xDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0Jvb2xDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBTdHJpbmdDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1N0cmluZ0NvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfU3RyaW5nQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX1N0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfU3RyaW5nQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9TdHJpbmdDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9TdHJpbmdDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEFycmF5Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9BcnJheUNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0FycmF5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfQXJyYXlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEJ5dGVBcnJheUNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfQnl0ZUFycmF5Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcihtZXRhZGF0YSkge1xuICAgIHN1cGVyKG5ldyBUeXBlQnVpbGRlcihBbGdlYnJhaWNUeXBlLkFycmF5KEFsZ2VicmFpY1R5cGUuVTgpKSwgbWV0YWRhdGEpO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9CeXRlQXJyYXlDb2x1bW5CdWlsZGVyKFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfQnl0ZUFycmF5Q29sdW1uQnVpbGRlcihzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBPcHRpb25Db2x1bW5CdWlsZGVyID0gY2xhc3MgX09wdGlvbkNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX09wdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX09wdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgUmVzdWx0Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9SZXN1bHRDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKHR5cGVCdWlsZGVyLCBtZXRhZGF0YSkge1xuICAgIHN1cGVyKHR5cGVCdWlsZGVyLCBtZXRhZGF0YSk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1Jlc3VsdENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFByb2R1Y3RDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1Byb2R1Y3RDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9Qcm9kdWN0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9Qcm9kdWN0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBTdW1Db2x1bW5CdWlsZGVyID0gY2xhc3MgX1N1bUNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1N1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfU3VtQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9TdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1N1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBTaW1wbGVTdW1Db2x1bW5CdWlsZGVyID0gY2xhc3MgX1NpbXBsZVN1bUNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBTdW1Db2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfU2ltcGxlU3VtQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9TaW1wbGVTdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgU2NoZWR1bGVBdENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfU2NoZWR1bGVBdENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1NjaGVkdWxlQXRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1NjaGVkdWxlQXRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIElkZW50aXR5Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9JZGVudGl0eUNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgdGFyZ2V0KCkge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1RhcmdldDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9JZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9Db25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9Db25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0Nvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBUaW1lc3RhbXBDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1RpbWVzdGFtcENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX1RpbWVzdGFtcENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lc3RhbXBDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1RpbWVzdGFtcENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9UaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1RpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1RpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFV1aWRDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1V1aWRDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1V1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgUmVmQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICByZWY7XG4gIC8qKiBUaGUgcGhhbnRvbSB0eXBlIG9mIHRoZSBwb2ludGVlIG9mIHRoaXMgcmVmLiAqL1xuICBfX3NwYWNldGltZVR5cGU7XG4gIGNvbnN0cnVjdG9yKHJlZikge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuUmVmKHJlZikpO1xuICAgIHRoaXMucmVmID0gcmVmO1xuICB9XG59O1xudmFyIGVudW1JbXBsID0gKChuYW1lT3JPYmosIG1heWJlT2JqKSA9PiB7XG4gIGxldCBvYmogPSBuYW1lT3JPYmo7XG4gIGxldCBuYW1lID0gdm9pZCAwO1xuICBpZiAodHlwZW9mIG5hbWVPck9iaiA9PT0gXCJzdHJpbmdcIikge1xuICAgIGlmICghbWF5YmVPYmopIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIFwiV2hlbiBwcm92aWRpbmcgYSBuYW1lLCB5b3UgbXVzdCBhbHNvIHByb3ZpZGUgdGhlIHZhcmlhbnRzIG9iamVjdCBvciBhcnJheS5cIlxuICAgICAgKTtcbiAgICB9XG4gICAgb2JqID0gbWF5YmVPYmo7XG4gICAgbmFtZSA9IG5hbWVPck9iajtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgY29uc3Qgc2ltcGxlVmFyaWFudHNPYmogPSB7fTtcbiAgICBmb3IgKGNvbnN0IHZhcmlhbnQgb2Ygb2JqKSB7XG4gICAgICBzaW1wbGVWYXJpYW50c09ialt2YXJpYW50XSA9IG5ldyBVbml0QnVpbGRlcigpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFNpbXBsZVN1bUJ1aWxkZXJJbXBsKHNpbXBsZVZhcmlhbnRzT2JqLCBuYW1lKTtcbiAgfVxuICByZXR1cm4gbmV3IFN1bUJ1aWxkZXIob2JqLCBuYW1lKTtcbn0pO1xudmFyIHQgPSB7XG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBCb29sYCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgYm9vbGVhbmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEJvb2xCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgYm9vbDogKCkgPT4gbmV3IEJvb2xCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBTdHJpbmdgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBzdHJpbmdgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBTdHJpbmdCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgc3RyaW5nOiAoKSA9PiBuZXcgU3RyaW5nQnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgRjY0YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgbnVtYmVyYCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgRjY0QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIG51bWJlcjogKCkgPT4gbmV3IEY2NEJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEk4YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgbnVtYmVyYCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgSThCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgaTg6ICgpID0+IG5ldyBJOEJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYFU4YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgbnVtYmVyYCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVThCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgdTg6ICgpID0+IG5ldyBVOEJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEkxNmAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEkxNkJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBpMTY6ICgpID0+IG5ldyBJMTZCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBVMTZgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBudW1iZXJgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBVMTZCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgdTE2OiAoKSA9PiBuZXcgVTE2QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgSTMyYCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgbnVtYmVyYCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgSTMyQnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIGkzMjogKCkgPT4gbmV3IEkzMkJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYFUzMmAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFUzMkJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICB1MzI6ICgpID0+IG5ldyBVMzJCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBJNjRgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBiaWdpbnRgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBJNjRCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgaTY0OiAoKSA9PiBuZXcgSTY0QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgVTY0YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgYmlnaW50YCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVTY0QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHU2NDogKCkgPT4gbmV3IFU2NEJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEkxMjhgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBiaWdpbnRgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBJMTI4QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIGkxMjg6ICgpID0+IG5ldyBJMTI4QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgVTEyOGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYGJpZ2ludGAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFUxMjhCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgdTEyODogKCkgPT4gbmV3IFUxMjhCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBJMjU2YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgYmlnaW50YCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgSTI1NkJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBpMjU2OiAoKSA9PiBuZXcgSTI1NkJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYFUyNTZgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBiaWdpbnRgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBVMjU2QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHUyNTY6ICgpID0+IG5ldyBVMjU2QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgRjMyYCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgbnVtYmVyYCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgRjMyQnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIGYzMjogKCkgPT4gbmV3IEYzMkJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEY2NGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEY2NEJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBmNjQ6ICgpID0+IG5ldyBGNjRCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBQcm9kdWN0YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9ucy4gUHJvZHVjdCB0eXBlcyBpbiBTcGFjZXRpbWVEQlxuICAgKiBhcmUgZXNzZW50aWFsbHkgdGhlIHNhbWUgYXMgb2JqZWN0cyBpbiBKYXZhU2NyaXB0L1R5cGVTY3JpcHQuXG4gICAqIFByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCBtdXN0IGFsc28gYmUge0BsaW5rIFR5cGVCdWlsZGVyfXMuXG4gICAqIFJlcHJlc2VudGVkIGFzIGFuIG9iamVjdCB3aXRoIHNwZWNpZmljIHByb3BlcnRpZXMgaW4gVHlwZVNjcmlwdC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgKG9wdGlvbmFsKSBBIGRpc3BsYXkgbmFtZSBmb3IgdGhlIHByb2R1Y3QgdHlwZS4gSWYgb21pdHRlZCwgYW4gYW5vbnltb3VzIHByb2R1Y3QgdHlwZSBpcyBjcmVhdGVkLlxuICAgKiBAcGFyYW0gb2JqIFRoZSBvYmplY3QgZGVmaW5pbmcgdGhlIHByb3BlcnRpZXMgb2YgdGhlIHR5cGUsIHdob3NlIHByb3BlcnR5XG4gICAqIHZhbHVlcyBtdXN0IGJlIHtAbGluayBUeXBlQnVpbGRlcn1zLlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgUHJvZHVjdEJ1aWxkZXJ9IGluc3RhbmNlLlxuICAgKi9cbiAgb2JqZWN0OiAoKG5hbWVPck9iaiwgbWF5YmVPYmopID0+IHtcbiAgICBpZiAodHlwZW9mIG5hbWVPck9iaiA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgaWYgKCFtYXliZU9iaikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIFwiV2hlbiBwcm92aWRpbmcgYSBuYW1lLCB5b3UgbXVzdCBhbHNvIHByb3ZpZGUgdGhlIG9iamVjdC5cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBQcm9kdWN0QnVpbGRlcihtYXliZU9iaiwgbmFtZU9yT2JqKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBQcm9kdWN0QnVpbGRlcihuYW1lT3JPYmosIHZvaWQgMCk7XG4gIH0pLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgUm93YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9ucy4gUm93IHR5cGVzIGluIFNwYWNldGltZURCXG4gICAqIGFyZSBzaW1pbGFyIHRvIGBQcm9kdWN0YCB0eXBlcywgYnV0IGFyZSBzcGVjaWZpY2FsbHkgdXNlZCB0byBkZWZpbmUgdGhlIHNjaGVtYSBvZiBhIHRhYmxlIHJvdy5cbiAgICogUHJvcGVydGllcyBvZiB0aGUgb2JqZWN0IG11c3QgYWxzbyBiZSB7QGxpbmsgVHlwZUJ1aWxkZXJ9IG9yIHtAbGluayBDb2x1bW5CdWlsZGVyfXMuXG4gICAqXG4gICAqIFlvdSBjYW4gcmVwcmVzZW50IGEgYFJvd2AgYXMgZWl0aGVyIGEge0BsaW5rIFJvd09ian0gb3IgYW4ge0BsaW5rIFJvd0J1aWxkZXJ9IHR5cGUgd2hlblxuICAgKiBkZWZpbmluZyBhIHRhYmxlIHNjaGVtYS5cbiAgICpcbiAgICogVGhlIHtAbGluayBSb3dCdWlsZGVyfSB0eXBlIGlzIHVzZWZ1bCB3aGVuIHlvdSB3YW50IHRvIGNyZWF0ZSBhIHR5cGUgd2hpY2ggY2FuIGJlIHVzZWQgYW55d2hlcmVcbiAgICogYSB7QGxpbmsgVHlwZUJ1aWxkZXJ9IGlzIGFjY2VwdGVkLCBzdWNoIGFzIGluIG5lc3RlZCBvYmplY3RzIG9yIGFycmF5cywgb3IgYXMgdGhlIGFyZ3VtZW50XG4gICAqIHRvIGEgc2NoZWR1bGVkIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gb2JqIFRoZSBvYmplY3QgZGVmaW5pbmcgdGhlIHByb3BlcnRpZXMgb2YgdGhlIHJvdywgd2hvc2UgcHJvcGVydHlcbiAgICogdmFsdWVzIG11c3QgYmUge0BsaW5rIFR5cGVCdWlsZGVyfXMgb3Ige0BsaW5rIENvbHVtbkJ1aWxkZXJ9cy5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFJvd0J1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICByb3c6ICgobmFtZU9yT2JqLCBtYXliZU9iaikgPT4ge1xuICAgIGNvbnN0IFtvYmosIG5hbWVdID0gdHlwZW9mIG5hbWVPck9iaiA9PT0gXCJzdHJpbmdcIiA/IFttYXliZU9iaiwgbmFtZU9yT2JqXSA6IFtuYW1lT3JPYmosIHZvaWQgMF07XG4gICAgcmV0dXJuIG5ldyBSb3dCdWlsZGVyKG9iaiwgbmFtZSk7XG4gIH0pLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zLlxuICAgKiBSZXByZXNlbnRlZCBhcyBhbiBhcnJheSBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcGFyYW0gZWxlbWVudCBUaGUgZWxlbWVudCB0eXBlIG9mIHRoZSBhcnJheSwgd2hpY2ggbXVzdCBiZSBhIGBUeXBlQnVpbGRlcmAuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBBcnJheUJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBhcnJheShlKSB7XG4gICAgcmV0dXJuIG5ldyBBcnJheUJ1aWxkZXIoZSk7XG4gIH0sXG4gIGVudW06IGVudW1JbXBsLFxuICAvKipcbiAgICogVGhpcyBpcyBhIHNwZWNpYWwgaGVscGVyIGZ1bmN0aW9uIGZvciBjb252ZW5pZW50bHkgY3JlYXRpbmcgYFByb2R1Y3RgIHR5cGUgY29sdW1ucyB3aXRoIG5vIGZpZWxkcy5cbiAgICpcbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFByb2R1Y3RCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIG5vIGZpZWxkcy5cbiAgICovXG4gIHVuaXQoKSB7XG4gICAgcmV0dXJuIG5ldyBVbml0QnVpbGRlcigpO1xuICB9LFxuICAvKipcbiAgICogQ3JlYXRlcyBhIGxhemlseS1ldmFsdWF0ZWQge0BsaW5rIFR5cGVCdWlsZGVyfS4gVGhpcyBpcyB1c2VmdWwgZm9yIGNyZWF0aW5nXG4gICAqIHJlY3Vyc2l2ZSB0eXBlcywgc3VjaCBhcyBhIHRyZWUgb3IgbGlua2VkIGxpc3QuXG4gICAqIEBwYXJhbSB0aHVuayBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHtAbGluayBUeXBlQnVpbGRlcn0uXG4gICAqIEByZXR1cm5zIEEgcHJveHkge0BsaW5rIFR5cGVCdWlsZGVyfSB0aGF0IGV2YWx1YXRlcyB0aGUgdGh1bmsgb24gZmlyc3QgYWNjZXNzLlxuICAgKi9cbiAgbGF6eSh0aHVuaykge1xuICAgIGxldCBjYWNoZWQgPSBudWxsO1xuICAgIGNvbnN0IGdldCA9ICgpID0+IGNhY2hlZCA/Pz0gdGh1bmsoKTtcbiAgICBjb25zdCBwcm94eSA9IG5ldyBQcm94eSh7fSwge1xuICAgICAgZ2V0KF90LCBwcm9wLCByZWN2KSB7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGdldCgpO1xuICAgICAgICBjb25zdCB2YWwgPSBSZWZsZWN0LmdldCh0YXJnZXQsIHByb3AsIHJlY3YpO1xuICAgICAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gXCJmdW5jdGlvblwiID8gdmFsLmJpbmQodGFyZ2V0KSA6IHZhbDtcbiAgICAgIH0sXG4gICAgICBzZXQoX3QsIHByb3AsIHZhbHVlLCByZWN2KSB7XG4gICAgICAgIHJldHVybiBSZWZsZWN0LnNldChnZXQoKSwgcHJvcCwgdmFsdWUsIHJlY3YpO1xuICAgICAgfSxcbiAgICAgIGhhcyhfdCwgcHJvcCkge1xuICAgICAgICByZXR1cm4gcHJvcCBpbiBnZXQoKTtcbiAgICAgIH0sXG4gICAgICBvd25LZXlzKCkge1xuICAgICAgICByZXR1cm4gUmVmbGVjdC5vd25LZXlzKGdldCgpKTtcbiAgICAgIH0sXG4gICAgICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoX3QsIHByb3ApIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZ2V0KCksIHByb3ApO1xuICAgICAgfSxcbiAgICAgIGdldFByb3RvdHlwZU9mKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKGdldCgpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcHJveHk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgc3BlY2lhbCBoZWxwZXIgZnVuY3Rpb24gZm9yIGNvbnZlbmllbnRseSBjcmVhdGluZyB7QGxpbmsgU2NoZWR1bGVBdH0gdHlwZSBjb2x1bW5zLlxuICAgKiBAcmV0dXJucyBBIG5ldyBDb2x1bW5CdWlsZGVyIGluc3RhbmNlIHdpdGggdGhlIHtAbGluayBTY2hlZHVsZUF0fSB0eXBlLlxuICAgKi9cbiAgc2NoZWR1bGVBdDogKCkgPT4ge1xuICAgIHJldHVybiBuZXcgU2NoZWR1bGVBdEJ1aWxkZXIoKTtcbiAgfSxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGNyZWF0aW5nIGEgY29sdW1uIHdpdGggdGhlIHtAbGluayBPcHRpb259IHR5cGUuXG4gICAqIFlvdSBjYW4gY3JlYXRlIGEgY29sdW1uIG9mIHRoZSBzYW1lIHR5cGUgYnkgY29uc3RydWN0aW5nIGFuIGVudW0gd2l0aCBhIGBzb21lYCBhbmQgYG5vbmVgIHZhcmlhbnQuXG4gICAqIEBwYXJhbSB2YWx1ZSBUaGUgdHlwZSBvZiB0aGUgdmFsdWUgY29udGFpbmVkIGluIHRoZSBgc29tZWAgdmFyaWFudCBvZiB0aGUgYE9wdGlvbmAuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBPcHRpb25CdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgT3B0aW9ufSB0eXBlLlxuICAgKi9cbiAgb3B0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBPcHRpb25CdWlsZGVyKHZhbHVlKTtcbiAgfSxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGNyZWF0aW5nIGEgY29sdW1uIHdpdGggdGhlIHtAbGluayBSZXN1bHR9IHR5cGUuXG4gICAqIFlvdSBjYW4gY3JlYXRlIGEgY29sdW1uIG9mIHRoZSBzYW1lIHR5cGUgYnkgY29uc3RydWN0aW5nIGFuIGVudW0gd2l0aCBhbiBgb2tgIGFuZCBgZXJyYCB2YXJpYW50LlxuICAgKiBAcGFyYW0gb2sgVGhlIHR5cGUgb2YgdGhlIHZhbHVlIGNvbnRhaW5lZCBpbiB0aGUgYG9rYCB2YXJpYW50IG9mIHRoZSBgUmVzdWx0YC5cbiAgICogQHBhcmFtIGVyciBUaGUgdHlwZSBvZiB0aGUgdmFsdWUgY29udGFpbmVkIGluIHRoZSBgZXJyYCB2YXJpYW50IG9mIHRoZSBgUmVzdWx0YC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFJlc3VsdEJ1aWxkZXJ9IGluc3RhbmNlIHdpdGggdGhlIHtAbGluayBSZXN1bHR9IHR5cGUuXG4gICAqL1xuICByZXN1bHQob2ssIGVycikge1xuICAgIHJldHVybiBuZXcgUmVzdWx0QnVpbGRlcihvaywgZXJyKTtcbiAgfSxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGNyZWF0aW5nIGEgY29sdW1uIHdpdGggdGhlIHtAbGluayBJZGVudGl0eX0gdHlwZS5cbiAgICogWW91IGNhbiBjcmVhdGUgYSBjb2x1bW4gb2YgdGhlIHNhbWUgdHlwZSBieSBjb25zdHJ1Y3RpbmcgYW4gYG9iamVjdGAgd2l0aCBhIHNpbmdsZSBgX19pZGVudGl0eV9fYCBlbGVtZW50LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVHlwZUJ1aWxkZXJ9IGluc3RhbmNlIHdpdGggdGhlIHtAbGluayBJZGVudGl0eX0gdHlwZS5cbiAgICovXG4gIGlkZW50aXR5OiAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0eUJ1aWxkZXIoKTtcbiAgfSxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGNyZWF0aW5nIGEgY29sdW1uIHdpdGggdGhlIHtAbGluayBDb25uZWN0aW9uSWR9IHR5cGUuXG4gICAqIFlvdSBjYW4gY3JlYXRlIGEgY29sdW1uIG9mIHRoZSBzYW1lIHR5cGUgYnkgY29uc3RydWN0aW5nIGFuIGBvYmplY3RgIHdpdGggYSBzaW5nbGUgYF9fY29ubmVjdGlvbl9pZF9fYCBlbGVtZW50LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVHlwZUJ1aWxkZXJ9IGluc3RhbmNlIHdpdGggdGhlIHtAbGluayBDb25uZWN0aW9uSWR9IHR5cGUuXG4gICAqL1xuICBjb25uZWN0aW9uSWQ6ICgpID0+IHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZEJ1aWxkZXIoKTtcbiAgfSxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGNyZWF0aW5nIGEgY29sdW1uIHdpdGggdGhlIHtAbGluayBUaW1lc3RhbXB9IHR5cGUuXG4gICAqIFlvdSBjYW4gY3JlYXRlIGEgY29sdW1uIG9mIHRoZSBzYW1lIHR5cGUgYnkgY29uc3RydWN0aW5nIGFuIGBvYmplY3RgIHdpdGggYSBzaW5nbGUgYF9fdGltZXN0YW1wX21pY3Jvc19zaW5jZV91bml4X2Vwb2NoX19gIGVsZW1lbnQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBUeXBlQnVpbGRlcn0gaW5zdGFuY2Ugd2l0aCB0aGUge0BsaW5rIFRpbWVzdGFtcH0gdHlwZS5cbiAgICovXG4gIHRpbWVzdGFtcDogKCkgPT4ge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQnVpbGRlcigpO1xuICB9LFxuICAvKipcbiAgICogVGhpcyBpcyBhIGNvbnZlbmllbmNlIG1ldGhvZCBmb3IgY3JlYXRpbmcgYSBjb2x1bW4gd2l0aCB0aGUge0BsaW5rIFRpbWVEdXJhdGlvbn0gdHlwZS5cbiAgICogWW91IGNhbiBjcmVhdGUgYSBjb2x1bW4gb2YgdGhlIHNhbWUgdHlwZSBieSBjb25zdHJ1Y3RpbmcgYW4gYG9iamVjdGAgd2l0aCBhIHNpbmdsZSBgX190aW1lX2R1cmF0aW9uX21pY3Jvc19fYCBlbGVtZW50LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVHlwZUJ1aWxkZXJ9IGluc3RhbmNlIHdpdGggdGhlIHtAbGluayBUaW1lRHVyYXRpb259IHR5cGUuXG4gICAqL1xuICB0aW1lRHVyYXRpb246ICgpID0+IHtcbiAgICByZXR1cm4gbmV3IFRpbWVEdXJhdGlvbkJ1aWxkZXIoKTtcbiAgfSxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGNyZWF0aW5nIGEgY29sdW1uIHdpdGggdGhlIHtAbGluayBVdWlkfSB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBgb2JqZWN0YCB3aXRoIGEgc2luZ2xlIGBfX3V1aWRfX2AgZWxlbWVudC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFR5cGVCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgVXVpZH0gdHlwZS5cbiAgICovXG4gIHV1aWQ6ICgpID0+IHtcbiAgICByZXR1cm4gbmV3IFV1aWRCdWlsZGVyKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSBgQnl0ZUFycmF5YCB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBgYXJyYXlgIG9mIGB1OGAuXG4gICAqIFRoZSBUeXBlU2NyaXB0IHJlcHJlc2VudGF0aW9uIGlzIHtAbGluayBVaW50OEFycmF5fS5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEJ5dGVBcnJheUJ1aWxkZXJ9IGluc3RhbmNlIHdpdGggdGhlIGBCeXRlQXJyYXlgIHR5cGUuXG4gICAqL1xuICBieXRlQXJyYXk6ICgpID0+IHtcbiAgICByZXR1cm4gbmV3IEJ5dGVBcnJheUJ1aWxkZXIoKTtcbiAgfVxufTtcbnZhciBNQVhfRU5WX0tFWV9CWVRFUyA9IDI1NjtcbnZhciBNQVhfRU5WX1ZBTFVFX0JZVEVTID0gOCAqIDEwMjQ7XG52YXIgTUFYX0VOVl9WQVJTID0gMjU2O1xudmFyIGVudmlyb25tZW50ID0gbmV3IFByb3h5KFxuICBPYmplY3QuZnJlZXplKFxuICAgIE9iamVjdC5hc3NpZ24oLyogQF9fUFVSRV9fICovIE9iamVjdC5jcmVhdGUobnVsbCksIHsgZ2V0OiAoa2V5KSA9PiBlbnZfZ2V0KGtleSkgfSlcbiAgKSxcbiAge1xuICAgIGdldCh0YXJnZXQsIGtleSkge1xuICAgICAgaWYgKGtleSA9PT0gXCJnZXRcIikgcmV0dXJuIHRhcmdldC5nZXQ7XG4gICAgICBpZiAodHlwZW9mIGtleSAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIHZvaWQgMDtcbiAgICAgIHJldHVybiBlbnZfZ2V0KGtleSkgPz8gdm9pZCAwO1xuICAgIH1cbiAgfVxuKTtcbmZ1bmN0aW9uIGVudmlyb25tZW50RGVjbGFyYXRpb25zKHNjaGVtYTIpIHtcbiAgY29uc3QgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKHNjaGVtYTIpO1xuICBpZiAoZW50cmllcy5sZW5ndGggPiBNQVhfRU5WX1ZBUlMpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRvbyBtYW55IGVudmlyb25tZW50IGRlY2xhcmF0aW9uc1wiKTtcbiAgY29uc3QgYnl0ZXMgPSBuZXcgVGV4dEVuY29kZXIoKTtcbiAgcmV0dXJuIGVudHJpZXMubWFwKChbbmFtZSwgZGVmaW5pdGlvbl0pID0+IHtcbiAgICBpZiAoIS9eW0EtWmEtel9dW0EtWmEtejAtOV9dKiQvLnRlc3QobmFtZSkgfHwgYnl0ZXMuZW5jb2RlKG5hbWUpLmxlbmd0aCA+IE1BWF9FTlZfS0VZX0JZVEVTKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBlbnZpcm9ubWVudCBkZWNsYXJhdGlvbiBuYW1lXCIpO1xuICAgIH1cbiAgICBjb25zdCBvcHRpb25hbCA9IGRlZmluaXRpb24gaW5zdGFuY2VvZiBPcHRpb25CdWlsZGVyO1xuICAgIGNvbnN0IGlubmVyID0gb3B0aW9uYWwgPyBkZWZpbml0aW9uLnZhbHVlIDogZGVmaW5pdGlvbjtcbiAgICBsZXQgdHk7XG4gICAgaWYgKGlubmVyIGluc3RhbmNlb2YgU3RyaW5nQnVpbGRlcikge1xuICAgICAgdHkgPSB7IHRhZzogXCJTdHJpbmdcIiB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0eXBlID0gaW5uZXI/LmFsZ2VicmFpY1R5cGU7XG4gICAgICBpZiAodHlwZT8udGFnICE9PSBcIlN1bVwiIHx8ICEoXCJ2YXJpYW50c1wiIGluIGlubmVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBFbnZpcm9ubWVudCAnJHtuYW1lfScgbXVzdCBiZSBhIHN0cmluZyBvciBzaW1wbGUgZW51bWBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHZhbHVlcyA9IHR5cGUudmFsdWUudmFyaWFudHMubWFwKCh2YXJpYW50KSA9PiB7XG4gICAgICAgIGlmICh2YXJpYW50LmFsZ2VicmFpY1R5cGUudGFnICE9PSBcIlByb2R1Y3RcIiB8fCB2YXJpYW50LmFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgIGBFbnZpcm9ubWVudCAnJHtuYW1lfScgY2Fubm90IHVzZSBhbiBlbnVtIHBheWxvYWRgXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIHZhcmlhbnQubmFtZSAhPT0gXCJzdHJpbmdcIilcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgYEVudmlyb25tZW50ICcke25hbWV9JyBlbnVtIGNhc2VzIG11c3QgaGF2ZSBuYW1lc2BcbiAgICAgICAgICApO1xuICAgICAgICBpZiAoYnl0ZXMuZW5jb2RlKHZhcmlhbnQubmFtZSkubGVuZ3RoID4gTUFYX0VOVl9WQUxVRV9CWVRFUylcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBFbnZpcm9ubWVudCAnJHtuYW1lfScgbGl0ZXJhbCBpcyB0b28gbG9uZ2ApO1xuICAgICAgICByZXR1cm4gdmFyaWFudC5uYW1lO1xuICAgICAgfSk7XG4gICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCB8fCBuZXcgU2V0KHZhbHVlcykuc2l6ZSAhPT0gdmFsdWVzLmxlbmd0aClcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgRW52aXJvbm1lbnQgJyR7bmFtZX0nIG5lZWRzIGEgbm9uZW1wdHkgbGl0ZXJhbCB1bmlvbmBcbiAgICAgICAgKTtcbiAgICAgIHR5ID0gdmFsdWVzLmxlbmd0aCA9PT0gMSA/IHsgdGFnOiBcIlN0cmluZ0xpdGVyYWxcIiwgdmFsdWU6IHZhbHVlc1swXSB9IDogeyB0YWc6IFwiVW5pb25cIiwgdmFsdWU6IHZhbHVlcyB9O1xuICAgIH1cbiAgICByZXR1cm4geyBuYW1lLCB0eSwgb3B0aW9uYWwgfTtcbiAgfSk7XG59XG5cbi8vIHNyYy9saWIvYXV0b2dlbi90eXBlcy50c1xudmFyIEFsZ2VicmFpY1R5cGUyID0gdC5lbnVtKFwiQWxnZWJyYWljVHlwZVwiLCB7XG4gIFJlZjogdC51MzIoKSxcbiAgZ2V0IFN1bSgpIHtcbiAgICByZXR1cm4gU3VtVHlwZTI7XG4gIH0sXG4gIGdldCBQcm9kdWN0KCkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZTI7XG4gIH0sXG4gIGdldCBBcnJheSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH0sXG4gIFN0cmluZzogdC51bml0KCksXG4gIEJvb2w6IHQudW5pdCgpLFxuICBJODogdC51bml0KCksXG4gIFU4OiB0LnVuaXQoKSxcbiAgSTE2OiB0LnVuaXQoKSxcbiAgVTE2OiB0LnVuaXQoKSxcbiAgSTMyOiB0LnVuaXQoKSxcbiAgVTMyOiB0LnVuaXQoKSxcbiAgSTY0OiB0LnVuaXQoKSxcbiAgVTY0OiB0LnVuaXQoKSxcbiAgSTEyODogdC51bml0KCksXG4gIFUxMjg6IHQudW5pdCgpLFxuICBJMjU2OiB0LnVuaXQoKSxcbiAgVTI1NjogdC51bml0KCksXG4gIEYzMjogdC51bml0KCksXG4gIEY2NDogdC51bml0KClcbn0pO1xudmFyIENhc2VDb252ZXJzaW9uUG9saWN5ID0gdC5lbnVtKFwiQ2FzZUNvbnZlcnNpb25Qb2xpY3lcIiwge1xuICBOb25lOiB0LnVuaXQoKSxcbiAgU25ha2VDYXNlOiB0LnVuaXQoKVxufSk7XG52YXIgRXhwbGljaXROYW1lRW50cnkgPSB0LmVudW0oXCJFeHBsaWNpdE5hbWVFbnRyeVwiLCB7XG4gIGdldCBUYWJsZSgpIHtcbiAgICByZXR1cm4gTmFtZU1hcHBpbmc7XG4gIH0sXG4gIGdldCBGdW5jdGlvbigpIHtcbiAgICByZXR1cm4gTmFtZU1hcHBpbmc7XG4gIH0sXG4gIGdldCBJbmRleCgpIHtcbiAgICByZXR1cm4gTmFtZU1hcHBpbmc7XG4gIH0sXG4gIGdldCBOYW1lc3BhY2UoKSB7XG4gICAgcmV0dXJuIE5hbWVNYXBwaW5nO1xuICB9XG59KTtcbnZhciBFeHBsaWNpdE5hbWVzID0gdC5vYmplY3QoXCJFeHBsaWNpdE5hbWVzXCIsIHtcbiAgZ2V0IGVudHJpZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoRXhwbGljaXROYW1lRW50cnkpO1xuICB9XG59KTtcbnZhciBGdW5jdGlvblZpc2liaWxpdHkgPSB0LmVudW0oXCJGdW5jdGlvblZpc2liaWxpdHlcIiwge1xuICBQcml2YXRlOiB0LnVuaXQoKSxcbiAgQ2xpZW50Q2FsbGFibGU6IHQudW5pdCgpXG59KTtcbnZhciBIdHRwSGVhZGVyUGFpciA9IHQub2JqZWN0KFwiSHR0cEhlYWRlclBhaXJcIiwge1xuICBuYW1lOiB0LnN0cmluZygpLFxuICB2YWx1ZTogdC5ieXRlQXJyYXkoKVxufSk7XG52YXIgSHR0cEhlYWRlcnMgPSB0Lm9iamVjdChcIkh0dHBIZWFkZXJzXCIsIHtcbiAgZ2V0IGVudHJpZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoSHR0cEhlYWRlclBhaXIpO1xuICB9XG59KTtcbnZhciBIdHRwTWV0aG9kID0gdC5lbnVtKFwiSHR0cE1ldGhvZFwiLCB7XG4gIEdldDogdC51bml0KCksXG4gIEhlYWQ6IHQudW5pdCgpLFxuICBQb3N0OiB0LnVuaXQoKSxcbiAgUHV0OiB0LnVuaXQoKSxcbiAgRGVsZXRlOiB0LnVuaXQoKSxcbiAgQ29ubmVjdDogdC51bml0KCksXG4gIE9wdGlvbnM6IHQudW5pdCgpLFxuICBUcmFjZTogdC51bml0KCksXG4gIFBhdGNoOiB0LnVuaXQoKSxcbiAgRXh0ZW5zaW9uOiB0LnN0cmluZygpXG59KTtcbnZhciBIdHRwUmVxdWVzdCA9IHQub2JqZWN0KFwiSHR0cFJlcXVlc3RcIiwge1xuICBnZXQgbWV0aG9kKCkge1xuICAgIHJldHVybiBIdHRwTWV0aG9kO1xuICB9LFxuICBnZXQgaGVhZGVycygpIHtcbiAgICByZXR1cm4gSHR0cEhlYWRlcnM7XG4gIH0sXG4gIHRpbWVvdXQ6IHQub3B0aW9uKHQudGltZUR1cmF0aW9uKCkpLFxuICB1cmk6IHQuc3RyaW5nKCksXG4gIGdldCB2ZXJzaW9uKCkge1xuICAgIHJldHVybiBIdHRwVmVyc2lvbjtcbiAgfVxufSk7XG52YXIgSHR0cFJlc3BvbnNlID0gdC5vYmplY3QoXCJIdHRwUmVzcG9uc2VcIiwge1xuICBnZXQgaGVhZGVycygpIHtcbiAgICByZXR1cm4gSHR0cEhlYWRlcnM7XG4gIH0sXG4gIGdldCB2ZXJzaW9uKCkge1xuICAgIHJldHVybiBIdHRwVmVyc2lvbjtcbiAgfSxcbiAgY29kZTogdC51MTYoKVxufSk7XG52YXIgSHR0cFZlcnNpb24gPSB0LmVudW0oXCJIdHRwVmVyc2lvblwiLCB7XG4gIEh0dHAwOTogdC51bml0KCksXG4gIEh0dHAxMDogdC51bml0KCksXG4gIEh0dHAxMTogdC51bml0KCksXG4gIEh0dHAyOiB0LnVuaXQoKSxcbiAgSHR0cDM6IHQudW5pdCgpXG59KTtcbnZhciBJbmRleFR5cGUgPSB0LmVudW0oXCJJbmRleFR5cGVcIiwge1xuICBCVHJlZTogdC51bml0KCksXG4gIEhhc2g6IHQudW5pdCgpXG59KTtcbnZhciBMaWZlY3ljbGUgPSB0LmVudW0oXCJMaWZlY3ljbGVcIiwge1xuICBJbml0OiB0LnVuaXQoKSxcbiAgT25Db25uZWN0OiB0LnVuaXQoKSxcbiAgT25EaXNjb25uZWN0OiB0LnVuaXQoKVxufSk7XG52YXIgTWV0aG9kT3JBbnkgPSB0LmVudW0oXCJNZXRob2RPckFueVwiLCB7XG4gIEFueTogdC51bml0KCksXG4gIGdldCBNZXRob2QoKSB7XG4gICAgcmV0dXJuIEh0dHBNZXRob2Q7XG4gIH1cbn0pO1xudmFyIE1pc2NNb2R1bGVFeHBvcnQgPSB0LmVudW0oXCJNaXNjTW9kdWxlRXhwb3J0XCIsIHtcbiAgZ2V0IFR5cGVBbGlhcygpIHtcbiAgICByZXR1cm4gVHlwZUFsaWFzO1xuICB9XG59KTtcbnZhciBOYW1lTWFwcGluZyA9IHQub2JqZWN0KFwiTmFtZU1hcHBpbmdcIiwge1xuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpLFxuICBjYW5vbmljYWxOYW1lOiB0LnN0cmluZygpXG59KTtcbnZhciBQcm9kdWN0VHlwZTIgPSB0Lm9iamVjdChcIlByb2R1Y3RUeXBlXCIsIHtcbiAgZ2V0IGVsZW1lbnRzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFByb2R1Y3RUeXBlRWxlbWVudCk7XG4gIH1cbn0pO1xudmFyIFByb2R1Y3RUeXBlRWxlbWVudCA9IHQub2JqZWN0KFwiUHJvZHVjdFR5cGVFbGVtZW50XCIsIHtcbiAgbmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGdldCBhbGdlYnJhaWNUeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlMjtcbiAgfVxufSk7XG52YXIgUmF3Q29sdW1uRGVmVjggPSB0Lm9iamVjdChcIlJhd0NvbHVtbkRlZlY4XCIsIHtcbiAgY29sTmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IGNvbFR5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9XG59KTtcbnZhciBSYXdDb2x1bW5EZWZhdWx0VmFsdWVWMTAgPSB0Lm9iamVjdChcIlJhd0NvbHVtbkRlZmF1bHRWYWx1ZVYxMFwiLCB7XG4gIGNvbElkOiB0LnUxNigpLFxuICB2YWx1ZTogdC5ieXRlQXJyYXkoKVxufSk7XG52YXIgUmF3Q29sdW1uRGVmYXVsdFZhbHVlVjkgPSB0Lm9iamVjdChcIlJhd0NvbHVtbkRlZmF1bHRWYWx1ZVY5XCIsIHtcbiAgdGFibGU6IHQuc3RyaW5nKCksXG4gIGNvbElkOiB0LnUxNigpLFxuICB2YWx1ZTogdC5ieXRlQXJyYXkoKVxufSk7XG52YXIgUmF3Q29uc3RyYWludERhdGFWOSA9IHQuZW51bShcIlJhd0NvbnN0cmFpbnREYXRhVjlcIiwge1xuICBnZXQgVW5pcXVlKCkge1xuICAgIHJldHVybiBSYXdVbmlxdWVDb25zdHJhaW50RGF0YVY5O1xuICB9XG59KTtcbnZhciBSYXdDb25zdHJhaW50RGVmVjEwID0gdC5vYmplY3QoXCJSYXdDb25zdHJhaW50RGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGdldCBkYXRhKCkge1xuICAgIHJldHVybiBSYXdDb25zdHJhaW50RGF0YVY5O1xuICB9XG59KTtcbnZhciBSYXdDb25zdHJhaW50RGVmVjggPSB0Lm9iamVjdChcIlJhd0NvbnN0cmFpbnREZWZWOFwiLCB7XG4gIGNvbnN0cmFpbnROYW1lOiB0LnN0cmluZygpLFxuICBjb25zdHJhaW50czogdC51OCgpLFxuICBjb2x1bW5zOiB0LmFycmF5KHQudTE2KCkpXG59KTtcbnZhciBSYXdDb25zdHJhaW50RGVmVjkgPSB0Lm9iamVjdChcIlJhd0NvbnN0cmFpbnREZWZWOVwiLCB7XG4gIG5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICBnZXQgZGF0YSgpIHtcbiAgICByZXR1cm4gUmF3Q29uc3RyYWludERhdGFWOTtcbiAgfVxufSk7XG52YXIgUmF3RW52VmFyVHlwZVYxMCA9IHQuZW51bShcIlJhd0VudlZhclR5cGVWMTBcIiwge1xuICBTdHJpbmc6IHQudW5pdCgpLFxuICBTdHJpbmdMaXRlcmFsOiB0LnN0cmluZygpLFxuICBVbmlvbjogdC5hcnJheSh0LnN0cmluZygpKVxufSk7XG52YXIgUmF3RW52aXJvbm1lbnREZWNsYXJhdGlvblYxMCA9IHQub2JqZWN0KFxuICBcIlJhd0Vudmlyb25tZW50RGVjbGFyYXRpb25WMTBcIixcbiAge1xuICAgIG5hbWU6IHQuc3RyaW5nKCksXG4gICAgZ2V0IHR5KCkge1xuICAgICAgcmV0dXJuIFJhd0VudlZhclR5cGVWMTA7XG4gICAgfSxcbiAgICBvcHRpb25hbDogdC5ib29sKClcbiAgfVxuKTtcbnZhciBSYXdIdHRwSGFuZGxlckRlZlYxMCA9IHQub2JqZWN0KFwiUmF3SHR0cEhhbmRsZXJEZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpXG59KTtcbnZhciBSYXdIdHRwUm91dGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd0h0dHBSb3V0ZURlZlYxMFwiLCB7XG4gIGhhbmRsZXJGdW5jdGlvbjogdC5zdHJpbmcoKSxcbiAgZ2V0IG1ldGhvZCgpIHtcbiAgICByZXR1cm4gTWV0aG9kT3JBbnk7XG4gIH0sXG4gIHBhdGg6IHQuc3RyaW5nKClcbn0pO1xudmFyIFJhd0luZGV4QWxnb3JpdGhtID0gdC5lbnVtKFwiUmF3SW5kZXhBbGdvcml0aG1cIiwge1xuICBCVHJlZTogdC5hcnJheSh0LnUxNigpKSxcbiAgSGFzaDogdC5hcnJheSh0LnUxNigpKSxcbiAgRGlyZWN0OiB0LnUxNigpXG59KTtcbnZhciBSYXdJbmRleERlZlYxMCA9IHQub2JqZWN0KFwiUmF3SW5kZXhEZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgYWNjZXNzb3JOYW1lOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgZ2V0IGFsZ29yaXRobSgpIHtcbiAgICByZXR1cm4gUmF3SW5kZXhBbGdvcml0aG07XG4gIH1cbn0pO1xudmFyIFJhd0luZGV4RGVmVjggPSB0Lm9iamVjdChcIlJhd0luZGV4RGVmVjhcIiwge1xuICBpbmRleE5hbWU6IHQuc3RyaW5nKCksXG4gIGlzVW5pcXVlOiB0LmJvb2woKSxcbiAgZ2V0IGluZGV4VHlwZSgpIHtcbiAgICByZXR1cm4gSW5kZXhUeXBlO1xuICB9LFxuICBjb2x1bW5zOiB0LmFycmF5KHQudTE2KCkpXG59KTtcbnZhciBSYXdJbmRleERlZlY5ID0gdC5vYmplY3QoXCJSYXdJbmRleERlZlY5XCIsIHtcbiAgbmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGFjY2Vzc29yTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGdldCBhbGdvcml0aG0oKSB7XG4gICAgcmV0dXJuIFJhd0luZGV4QWxnb3JpdGhtO1xuICB9XG59KTtcbnZhciBSYXdMaWZlQ3ljbGVSZWR1Y2VyRGVmVjEwID0gdC5vYmplY3QoXG4gIFwiUmF3TGlmZUN5Y2xlUmVkdWNlckRlZlYxMFwiLFxuICB7XG4gICAgZ2V0IGxpZmVjeWNsZVNwZWMoKSB7XG4gICAgICByZXR1cm4gTGlmZWN5Y2xlO1xuICAgIH0sXG4gICAgZnVuY3Rpb25OYW1lOiB0LnN0cmluZygpXG4gIH1cbik7XG52YXIgUmF3TWlzY01vZHVsZUV4cG9ydFY5ID0gdC5lbnVtKFwiUmF3TWlzY01vZHVsZUV4cG9ydFY5XCIsIHtcbiAgZ2V0IENvbHVtbkRlZmF1bHRWYWx1ZSgpIHtcbiAgICByZXR1cm4gUmF3Q29sdW1uRGVmYXVsdFZhbHVlVjk7XG4gIH0sXG4gIGdldCBQcm9jZWR1cmUoKSB7XG4gICAgcmV0dXJuIFJhd1Byb2NlZHVyZURlZlY5O1xuICB9LFxuICBnZXQgVmlldygpIHtcbiAgICByZXR1cm4gUmF3Vmlld0RlZlY5O1xuICB9XG59KTtcbnZhciBSYXdNb2R1bGVEZWYgPSB0LmVudW0oXCJSYXdNb2R1bGVEZWZcIiwge1xuICBnZXQgVjhCYWNrQ29tcGF0KCkge1xuICAgIHJldHVybiBSYXdNb2R1bGVEZWZWODtcbiAgfSxcbiAgZ2V0IFY5KCkge1xuICAgIHJldHVybiBSYXdNb2R1bGVEZWZWOTtcbiAgfSxcbiAgZ2V0IFYxMCgpIHtcbiAgICByZXR1cm4gUmF3TW9kdWxlRGVmVjEwO1xuICB9XG59KTtcbnZhciBSYXdNb2R1bGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd01vZHVsZURlZlYxMFwiLCB7XG4gIGdldCBzZWN0aW9ucygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdNb2R1bGVEZWZWMTBTZWN0aW9uKTtcbiAgfVxufSk7XG52YXIgUmF3TW9kdWxlRGVmVjEwU2VjdGlvbiA9IHQuZW51bShcIlJhd01vZHVsZURlZlYxMFNlY3Rpb25cIiwge1xuICBnZXQgVHlwZXNwYWNlKCkge1xuICAgIHJldHVybiBUeXBlc3BhY2U7XG4gIH0sXG4gIGdldCBUeXBlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUeXBlRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IFRhYmxlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUYWJsZURlZlYxMCk7XG4gIH0sXG4gIGdldCBSZWR1Y2VycygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdSZWR1Y2VyRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IFByb2NlZHVyZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3UHJvY2VkdXJlRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IFZpZXdzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1ZpZXdEZWZWMTApO1xuICB9LFxuICBnZXQgU2NoZWR1bGVzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1NjaGVkdWxlRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IExpZmVDeWNsZVJlZHVjZXJzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0xpZmVDeWNsZVJlZHVjZXJEZWZWMTApO1xuICB9LFxuICBnZXQgUm93TGV2ZWxTZWN1cml0eSgpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdSb3dMZXZlbFNlY3VyaXR5RGVmVjkpO1xuICB9LFxuICBnZXQgQ2FzZUNvbnZlcnNpb25Qb2xpY3koKSB7XG4gICAgcmV0dXJuIENhc2VDb252ZXJzaW9uUG9saWN5O1xuICB9LFxuICBnZXQgRXhwbGljaXROYW1lcygpIHtcbiAgICByZXR1cm4gRXhwbGljaXROYW1lcztcbiAgfSxcbiAgZ2V0IEh0dHBIYW5kbGVycygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdIdHRwSGFuZGxlckRlZlYxMCk7XG4gIH0sXG4gIGdldCBIdHRwUm91dGVzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0h0dHBSb3V0ZURlZlYxMCk7XG4gIH0sXG4gIGdldCBWaWV3UHJpbWFyeUtleXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Vmlld1ByaW1hcnlLZXlEZWZWMTApO1xuICB9LFxuICBnZXQgU3VibW9kdWxlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdTdWJtb2R1bGVWMTApO1xuICB9LFxuICBnZXQgRW52aXJvbm1lbnQoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3RW52aXJvbm1lbnREZWNsYXJhdGlvblYxMCk7XG4gIH0sXG4gIGdldCBPdXRib3hlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdPdXRib3hEZWZWMTApO1xuICB9XG59KTtcbnZhciBSYXdNb2R1bGVEZWZWOCA9IHQub2JqZWN0KFwiUmF3TW9kdWxlRGVmVjhcIiwge1xuICBnZXQgdHlwZXNwYWNlKCkge1xuICAgIHJldHVybiBUeXBlc3BhY2U7XG4gIH0sXG4gIGdldCB0YWJsZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoVGFibGVEZXNjKTtcbiAgfSxcbiAgZ2V0IHJlZHVjZXJzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJlZHVjZXJEZWYpO1xuICB9LFxuICBnZXQgbWlzY0V4cG9ydHMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoTWlzY01vZHVsZUV4cG9ydCk7XG4gIH1cbn0pO1xudmFyIFJhd01vZHVsZURlZlY5ID0gdC5vYmplY3QoXCJSYXdNb2R1bGVEZWZWOVwiLCB7XG4gIGdldCB0eXBlc3BhY2UoKSB7XG4gICAgcmV0dXJuIFR5cGVzcGFjZTtcbiAgfSxcbiAgZ2V0IHRhYmxlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUYWJsZURlZlY5KTtcbiAgfSxcbiAgZ2V0IHJlZHVjZXJzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1JlZHVjZXJEZWZWOSk7XG4gIH0sXG4gIGdldCB0eXBlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUeXBlRGVmVjkpO1xuICB9LFxuICBnZXQgbWlzY0V4cG9ydHMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3TWlzY01vZHVsZUV4cG9ydFY5KTtcbiAgfSxcbiAgZ2V0IHJvd0xldmVsU2VjdXJpdHkoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Um93TGV2ZWxTZWN1cml0eURlZlY5KTtcbiAgfVxufSk7XG52YXIgUmF3T3V0Ym94RGVmVjEwID0gdC5vYmplY3QoXCJSYXdPdXRib3hEZWZWMTBcIiwge1xuICB0YWJsZU5hbWU6IHQuc3RyaW5nKCksXG4gIHJlbW90ZVJlZHVjZXI6IHQuc3RyaW5nKCksXG4gIHRhcmdldENvbHVtbjogdC51MTYoKSxcbiAgYXJnQ29sdW1uczogdC5hcnJheSh0LnUxNigpKSxcbiAgb25SZXN1bHRSZWR1Y2VyOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgc2lnbmF0dXJlSGFzaDogdC51MjU2KClcbn0pO1xudmFyIFJhd1Byb2NlZHVyZURlZlYxMCA9IHQub2JqZWN0KFwiUmF3UHJvY2VkdXJlRGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgcmV0dXJuVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH0sXG4gIGdldCB2aXNpYmlsaXR5KCkge1xuICAgIHJldHVybiBGdW5jdGlvblZpc2liaWxpdHk7XG4gIH1cbn0pO1xudmFyIFJhd1Byb2NlZHVyZURlZlY5ID0gdC5vYmplY3QoXCJSYXdQcm9jZWR1cmVEZWZWOVwiLCB7XG4gIG5hbWU6IHQuc3RyaW5nKCksXG4gIGdldCBwYXJhbXMoKSB7XG4gICAgcmV0dXJuIFByb2R1Y3RUeXBlMjtcbiAgfSxcbiAgZ2V0IHJldHVyblR5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9XG59KTtcbnZhciBSYXdSZWR1Y2VyRGVmVjEwID0gdC5vYmplY3QoXCJSYXdSZWR1Y2VyRGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgdmlzaWJpbGl0eSgpIHtcbiAgICByZXR1cm4gRnVuY3Rpb25WaXNpYmlsaXR5O1xuICB9LFxuICBnZXQgb2tSZXR1cm5UeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlMjtcbiAgfSxcbiAgZ2V0IGVyclJldHVyblR5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9XG59KTtcbnZhciBSYXdSZWR1Y2VyRGVmVjkgPSB0Lm9iamVjdChcIlJhd1JlZHVjZXJEZWZWOVwiLCB7XG4gIG5hbWU6IHQuc3RyaW5nKCksXG4gIGdldCBwYXJhbXMoKSB7XG4gICAgcmV0dXJuIFByb2R1Y3RUeXBlMjtcbiAgfSxcbiAgZ2V0IGxpZmVjeWNsZSgpIHtcbiAgICByZXR1cm4gdC5vcHRpb24oTGlmZWN5Y2xlKTtcbiAgfVxufSk7XG52YXIgUmF3Um93TGV2ZWxTZWN1cml0eURlZlY5ID0gdC5vYmplY3QoXCJSYXdSb3dMZXZlbFNlY3VyaXR5RGVmVjlcIiwge1xuICBzcWw6IHQuc3RyaW5nKClcbn0pO1xudmFyIFJhd1NjaGVkdWxlRGVmVjEwID0gdC5vYmplY3QoXCJSYXdTY2hlZHVsZURlZlYxMFwiLCB7XG4gIHNvdXJjZU5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICB0YWJsZU5hbWU6IHQuc3RyaW5nKCksXG4gIHNjaGVkdWxlQXRDb2w6IHQudTE2KCksXG4gIGZ1bmN0aW9uTmFtZTogdC5zdHJpbmcoKVxufSk7XG52YXIgUmF3U2NoZWR1bGVEZWZWOSA9IHQub2JqZWN0KFwiUmF3U2NoZWR1bGVEZWZWOVwiLCB7XG4gIG5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICByZWR1Y2VyTmFtZTogdC5zdHJpbmcoKSxcbiAgc2NoZWR1bGVkQXRDb2x1bW46IHQudTE2KClcbn0pO1xudmFyIFJhd1Njb3BlZFR5cGVOYW1lVjEwID0gdC5vYmplY3QoXCJSYXdTY29wZWRUeXBlTmFtZVYxMFwiLCB7XG4gIHNjb3BlOiB0LmFycmF5KHQuc3RyaW5nKCkpLFxuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpXG59KTtcbnZhciBSYXdTY29wZWRUeXBlTmFtZVY5ID0gdC5vYmplY3QoXCJSYXdTY29wZWRUeXBlTmFtZVY5XCIsIHtcbiAgc2NvcGU6IHQuYXJyYXkodC5zdHJpbmcoKSksXG4gIG5hbWU6IHQuc3RyaW5nKClcbn0pO1xudmFyIFJhd1NlcXVlbmNlRGVmVjEwID0gdC5vYmplY3QoXCJSYXdTZXF1ZW5jZURlZlYxMFwiLCB7XG4gIHNvdXJjZU5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICBjb2x1bW46IHQudTE2KCksXG4gIHN0YXJ0OiB0Lm9wdGlvbih0LmkxMjgoKSksXG4gIG1pblZhbHVlOiB0Lm9wdGlvbih0LmkxMjgoKSksXG4gIG1heFZhbHVlOiB0Lm9wdGlvbih0LmkxMjgoKSksXG4gIGluY3JlbWVudDogdC5pMTI4KClcbn0pO1xudmFyIFJhd1NlcXVlbmNlRGVmVjggPSB0Lm9iamVjdChcIlJhd1NlcXVlbmNlRGVmVjhcIiwge1xuICBzZXF1ZW5jZU5hbWU6IHQuc3RyaW5nKCksXG4gIGNvbFBvczogdC51MTYoKSxcbiAgaW5jcmVtZW50OiB0LmkxMjgoKSxcbiAgc3RhcnQ6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWluVmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWF4VmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgYWxsb2NhdGVkOiB0LmkxMjgoKVxufSk7XG52YXIgUmF3U2VxdWVuY2VEZWZWOSA9IHQub2JqZWN0KFwiUmF3U2VxdWVuY2VEZWZWOVwiLCB7XG4gIG5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICBjb2x1bW46IHQudTE2KCksXG4gIHN0YXJ0OiB0Lm9wdGlvbih0LmkxMjgoKSksXG4gIG1pblZhbHVlOiB0Lm9wdGlvbih0LmkxMjgoKSksXG4gIG1heFZhbHVlOiB0Lm9wdGlvbih0LmkxMjgoKSksXG4gIGluY3JlbWVudDogdC5pMTI4KClcbn0pO1xudmFyIFJhd1N1Ym1vZHVsZVYxMCA9IHQub2JqZWN0KFwiUmF3U3VibW9kdWxlVjEwXCIsIHtcbiAgbmFtZXNwYWNlOiB0LnN0cmluZygpLFxuICBnZXQgbW9kdWxlKCkge1xuICAgIHJldHVybiBSYXdNb2R1bGVEZWZWMTA7XG4gIH1cbn0pO1xudmFyIFJhd1RhYmxlRGVmVjEwID0gdC5vYmplY3QoXCJSYXdUYWJsZURlZlYxMFwiLCB7XG4gIHNvdXJjZU5hbWU6IHQuc3RyaW5nKCksXG4gIHByb2R1Y3RUeXBlUmVmOiB0LnUzMigpLFxuICBwcmltYXJ5S2V5OiB0LmFycmF5KHQudTE2KCkpLFxuICBnZXQgaW5kZXhlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdJbmRleERlZlYxMCk7XG4gIH0sXG4gIGdldCBjb25zdHJhaW50cygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdDb25zdHJhaW50RGVmVjEwKTtcbiAgfSxcbiAgZ2V0IHNlcXVlbmNlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdTZXF1ZW5jZURlZlYxMCk7XG4gIH0sXG4gIGdldCB0YWJsZVR5cGUoKSB7XG4gICAgcmV0dXJuIFRhYmxlVHlwZTtcbiAgfSxcbiAgZ2V0IHRhYmxlQWNjZXNzKCkge1xuICAgIHJldHVybiBUYWJsZUFjY2VzcztcbiAgfSxcbiAgZ2V0IGRlZmF1bHRWYWx1ZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Q29sdW1uRGVmYXVsdFZhbHVlVjEwKTtcbiAgfSxcbiAgaXNFdmVudDogdC5ib29sKClcbn0pO1xudmFyIFJhd1RhYmxlRGVmVjggPSB0Lm9iamVjdChcIlJhd1RhYmxlRGVmVjhcIiwge1xuICB0YWJsZU5hbWU6IHQuc3RyaW5nKCksXG4gIGdldCBjb2x1bW5zKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0NvbHVtbkRlZlY4KTtcbiAgfSxcbiAgZ2V0IGluZGV4ZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3SW5kZXhEZWZWOCk7XG4gIH0sXG4gIGdldCBjb25zdHJhaW50cygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdDb25zdHJhaW50RGVmVjgpO1xuICB9LFxuICBnZXQgc2VxdWVuY2VzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1NlcXVlbmNlRGVmVjgpO1xuICB9LFxuICB0YWJsZVR5cGU6IHQuc3RyaW5nKCksXG4gIHRhYmxlQWNjZXNzOiB0LnN0cmluZygpLFxuICBzY2hlZHVsZWQ6IHQub3B0aW9uKHQuc3RyaW5nKCkpXG59KTtcbnZhciBSYXdUYWJsZURlZlY5ID0gdC5vYmplY3QoXCJSYXdUYWJsZURlZlY5XCIsIHtcbiAgbmFtZTogdC5zdHJpbmcoKSxcbiAgcHJvZHVjdFR5cGVSZWY6IHQudTMyKCksXG4gIHByaW1hcnlLZXk6IHQuYXJyYXkodC51MTYoKSksXG4gIGdldCBpbmRleGVzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0luZGV4RGVmVjkpO1xuICB9LFxuICBnZXQgY29uc3RyYWludHMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Q29uc3RyYWludERlZlY5KTtcbiAgfSxcbiAgZ2V0IHNlcXVlbmNlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdTZXF1ZW5jZURlZlY5KTtcbiAgfSxcbiAgZ2V0IHNjaGVkdWxlKCkge1xuICAgIHJldHVybiB0Lm9wdGlvbihSYXdTY2hlZHVsZURlZlY5KTtcbiAgfSxcbiAgZ2V0IHRhYmxlVHlwZSgpIHtcbiAgICByZXR1cm4gVGFibGVUeXBlO1xuICB9LFxuICBnZXQgdGFibGVBY2Nlc3MoKSB7XG4gICAgcmV0dXJuIFRhYmxlQWNjZXNzO1xuICB9XG59KTtcbnZhciBSYXdUeXBlRGVmVjEwID0gdC5vYmplY3QoXCJSYXdUeXBlRGVmVjEwXCIsIHtcbiAgZ2V0IHNvdXJjZU5hbWUoKSB7XG4gICAgcmV0dXJuIFJhd1Njb3BlZFR5cGVOYW1lVjEwO1xuICB9LFxuICB0eTogdC51MzIoKSxcbiAgY3VzdG9tT3JkZXJpbmc6IHQuYm9vbCgpXG59KTtcbnZhciBSYXdUeXBlRGVmVjkgPSB0Lm9iamVjdChcIlJhd1R5cGVEZWZWOVwiLCB7XG4gIGdldCBuYW1lKCkge1xuICAgIHJldHVybiBSYXdTY29wZWRUeXBlTmFtZVY5O1xuICB9LFxuICB0eTogdC51MzIoKSxcbiAgY3VzdG9tT3JkZXJpbmc6IHQuYm9vbCgpXG59KTtcbnZhciBSYXdVbmlxdWVDb25zdHJhaW50RGF0YVY5ID0gdC5vYmplY3QoXG4gIFwiUmF3VW5pcXVlQ29uc3RyYWludERhdGFWOVwiLFxuICB7XG4gICAgY29sdW1uczogdC5hcnJheSh0LnUxNigpKVxuICB9XG4pO1xudmFyIFJhd1ZpZXdEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1ZpZXdEZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpLFxuICBpbmRleDogdC51MzIoKSxcbiAgaXNQdWJsaWM6IHQuYm9vbCgpLFxuICBpc0Fub255bW91czogdC5ib29sKCksXG4gIGdldCBwYXJhbXMoKSB7XG4gICAgcmV0dXJuIFByb2R1Y3RUeXBlMjtcbiAgfSxcbiAgZ2V0IHJldHVyblR5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9XG59KTtcbnZhciBSYXdWaWV3RGVmVjkgPSB0Lm9iamVjdChcIlJhd1ZpZXdEZWZWOVwiLCB7XG4gIG5hbWU6IHQuc3RyaW5nKCksXG4gIGluZGV4OiB0LnUzMigpLFxuICBpc1B1YmxpYzogdC5ib29sKCksXG4gIGlzQW5vbnltb3VzOiB0LmJvb2woKSxcbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgcmV0dXJuVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFJhd1ZpZXdQcmltYXJ5S2V5RGVmVjEwID0gdC5vYmplY3QoXCJSYXdWaWV3UHJpbWFyeUtleURlZlYxMFwiLCB7XG4gIHZpZXdTb3VyY2VOYW1lOiB0LnN0cmluZygpLFxuICBjb2x1bW5zOiB0LmFycmF5KHQuc3RyaW5nKCkpXG59KTtcbnZhciBSZWR1Y2VyRGVmID0gdC5vYmplY3QoXCJSZWR1Y2VyRGVmXCIsIHtcbiAgbmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IGFyZ3MoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUHJvZHVjdFR5cGVFbGVtZW50KTtcbiAgfVxufSk7XG52YXIgU3VtVHlwZTIgPSB0Lm9iamVjdChcIlN1bVR5cGVcIiwge1xuICBnZXQgdmFyaWFudHMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoU3VtVHlwZVZhcmlhbnQpO1xuICB9XG59KTtcbnZhciBTdW1UeXBlVmFyaWFudCA9IHQub2JqZWN0KFwiU3VtVHlwZVZhcmlhbnRcIiwge1xuICBuYW1lOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgZ2V0IGFsZ2VicmFpY1R5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9XG59KTtcbnZhciBUYWJsZUFjY2VzcyA9IHQuZW51bShcIlRhYmxlQWNjZXNzXCIsIHtcbiAgUHVibGljOiB0LnVuaXQoKSxcbiAgUHJpdmF0ZTogdC51bml0KClcbn0pO1xudmFyIFRhYmxlRGVzYyA9IHQub2JqZWN0KFwiVGFibGVEZXNjXCIsIHtcbiAgZ2V0IHNjaGVtYSgpIHtcbiAgICByZXR1cm4gUmF3VGFibGVEZWZWODtcbiAgfSxcbiAgZGF0YTogdC51MzIoKVxufSk7XG52YXIgVGFibGVUeXBlID0gdC5lbnVtKFwiVGFibGVUeXBlXCIsIHtcbiAgU3lzdGVtOiB0LnVuaXQoKSxcbiAgVXNlcjogdC51bml0KClcbn0pO1xudmFyIFR5cGVBbGlhcyA9IHQub2JqZWN0KFwiVHlwZUFsaWFzXCIsIHtcbiAgbmFtZTogdC5zdHJpbmcoKSxcbiAgdHk6IHQudTMyKClcbn0pO1xudmFyIFR5cGVzcGFjZSA9IHQub2JqZWN0KFwiVHlwZXNwYWNlXCIsIHtcbiAgZ2V0IHR5cGVzKCkge1xuICAgIHJldHVybiB0LmFycmF5KEFsZ2VicmFpY1R5cGUyKTtcbiAgfVxufSk7XG52YXIgVmlld1Jlc3VsdEhlYWRlciA9IHQuZW51bShcIlZpZXdSZXN1bHRIZWFkZXJcIiwge1xuICBSb3dEYXRhOiB0LnVuaXQoKSxcbiAgUmF3U3FsOiB0LnN0cmluZygpXG59KTtcblxuLy8gc3JjL2xpYi9zY2hlbWEudHNcbmZ1bmN0aW9uIHRhYmxlVG9TY2hlbWEoYWNjTmFtZSwgc2NoZW1hMiwgdGFibGVEZWYpIHtcbiAgY29uc3QgZ2V0Q29sTmFtZSA9IChpKSA9PiBzY2hlbWEyLnJvd1R5cGUuYWxnZWJyYWljVHlwZS52YWx1ZS5lbGVtZW50c1tpXS5uYW1lO1xuICBjb25zdCByZXNvbHZlZEluZGV4ZXMgPSB0YWJsZURlZi5pbmRleGVzLm1hcChcbiAgICAoaWR4KSA9PiB7XG4gICAgICBjb25zdCBhY2Nlc3Nvck5hbWUgPSBpZHguYWNjZXNzb3JOYW1lO1xuICAgICAgaWYgKHR5cGVvZiBhY2Nlc3Nvck5hbWUgIT09IFwic3RyaW5nXCIgfHwgYWNjZXNzb3JOYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBJbmRleCAnJHtpZHguc291cmNlTmFtZSA/PyBcIjx1bmtub3duPlwifScgb24gdGFibGUgJyR7dGFibGVEZWYuc291cmNlTmFtZX0nIGlzIG1pc3NpbmcgYWNjZXNzb3IgbmFtZWBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNvbHVtbklkcyA9IGlkeC5hbGdvcml0aG0udGFnID09PSBcIkRpcmVjdFwiID8gW2lkeC5hbGdvcml0aG0udmFsdWVdIDogaWR4LmFsZ29yaXRobS52YWx1ZTtcbiAgICAgIGNvbnN0IHVuaXF1ZSA9IHRhYmxlRGVmLmNvbnN0cmFpbnRzLnNvbWUoXG4gICAgICAgIChjKSA9PiBjLmRhdGEudGFnID09PSBcIlVuaXF1ZVwiICYmIGMuZGF0YS52YWx1ZS5jb2x1bW5zLmV2ZXJ5KChjb2wpID0+IGNvbHVtbklkcy5pbmNsdWRlcyhjb2wpKVxuICAgICAgKTtcbiAgICAgIGNvbnN0IGFsZ29yaXRobSA9IHtcbiAgICAgICAgQlRyZWU6IFwiYnRyZWVcIixcbiAgICAgICAgSGFzaDogXCJoYXNoXCIsXG4gICAgICAgIERpcmVjdDogXCJkaXJlY3RcIlxuICAgICAgfVtpZHguYWxnb3JpdGhtLnRhZ107XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBhY2Nlc3Nvck5hbWUsXG4gICAgICAgIHVuaXF1ZSxcbiAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICBjb2x1bW5zOiBjb2x1bW5JZHMubWFwKGdldENvbE5hbWUpXG4gICAgICB9O1xuICAgIH1cbiAgKTtcbiAgcmV0dXJuIHtcbiAgICAvLyBGb3IgY2xpZW50LGBzY2hhbWEudGFibGVOYW1lYCB3aWxsIGFsd2F5cyBiZSB0aGVyZSBhcyBjYW5vbmljYWwgbmFtZS5cbiAgICAvLyBGb3IgbW9kdWxlLCBpZiBleHBsaWNpdCBuYW1lIGlzIG5vdCBwcm92aWRlZCB2aWEgYG5hbWVgLCBhY2Nlc3NvciBuYW1lIHdpbGxcbiAgICAvLyBiZSB1c2VkLCBpdCBpcyBzdG9yZWQgYXMgYWxpYXMgaW4gZGF0YWJhc2UsIGhlbmNlIHdvcmtzIGluIHF1ZXJ5IGJ1aWxkZXIuXG4gICAgc291cmNlTmFtZTogc2NoZW1hMi50YWJsZU5hbWUgfHwgYWNjTmFtZSxcbiAgICBhY2Nlc3Nvck5hbWU6IGFjY05hbWUsXG4gICAgaXNPdXRib3g6IHNjaGVtYTIub3V0Ym94ICE9PSB2b2lkIDAsXG4gICAgY29sdW1uczogc2NoZW1hMi5yb3dUeXBlLnJvdyxcbiAgICAvLyB0eXBlZCBhcyBUW2ldWydyb3dUeXBlJ11bJ3JvdyddIHVuZGVyIFRhYmxlc1RvU2NoZW1hPFQ+XG4gICAgcm93VHlwZTogc2NoZW1hMi5yb3dTcGFjZXRpbWVUeXBlLFxuICAgIC8vIEtlZXAgZGVjbGFyYXRpdmUgaW5kZXhlcyBpbiB0aGVpciBvcmlnaW5hbCBzaGFwZSBmb3IgdHlwZS1sZXZlbCBjb25zdW1lcnMuXG4gICAgaW5kZXhlczogc2NoZW1hMi5pZHhzLFxuICAgIGNvbnN0cmFpbnRzOiB0YWJsZURlZi5jb25zdHJhaW50cy5tYXAoKGMpID0+ICh7XG4gICAgICBuYW1lOiBjLnNvdXJjZU5hbWUsXG4gICAgICBjb25zdHJhaW50OiBcInVuaXF1ZVwiLFxuICAgICAgY29sdW1uczogYy5kYXRhLnZhbHVlLmNvbHVtbnMubWFwKGdldENvbE5hbWUpXG4gICAgfSkpLFxuICAgIC8vIEV4cG9zZSByZXNvbHZlZCBydW50aW1lIGluZGV4ZXMgc2VwYXJhdGVseSBzbyBydW50aW1lIHVzZXJzIGRvbid0IGhhdmUgdG9cbiAgICAvLyByZWludGVycHJldCBgaW5kZXhlc2Agd2l0aCB1bnNhZmUgY2FzdHMuXG4gICAgcmVzb2x2ZWRJbmRleGVzLFxuICAgIHRhYmxlRGVmLFxuICAgIC4uLnRhYmxlRGVmLmlzRXZlbnQgPyB7IGlzRXZlbnQ6IHRydWUgfSA6IHt9XG4gIH07XG59XG52YXIgTW9kdWxlQ29udGV4dCA9IGNsYXNzIHtcbiAgI2NvbXBvdW5kVHlwZXMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICAvKipcbiAgICogVGhlIGdsb2JhbCBtb2R1bGUgZGVmaW5pdGlvbiB0aGF0IGdldHMgcG9wdWxhdGVkIGJ5IGNhbGxzIHRvIGByZWR1Y2VyKClgIGFuZCBsaWZlY3ljbGUgaG9va3MuXG4gICAqL1xuICAjbW9kdWxlRGVmID0ge1xuICAgIHR5cGVzcGFjZTogeyB0eXBlczogW10gfSxcbiAgICB0YWJsZXM6IFtdLFxuICAgIHJlZHVjZXJzOiBbXSxcbiAgICB0eXBlczogW10sXG4gICAgcm93TGV2ZWxTZWN1cml0eTogW10sXG4gICAgc2NoZWR1bGVzOiBbXSxcbiAgICBvdXRib3hlczogW10sXG4gICAgcHJvY2VkdXJlczogW10sXG4gICAgdmlld3M6IFtdLFxuICAgIHZpZXdQcmltYXJ5S2V5czogW10sXG4gICAgbGlmZUN5Y2xlUmVkdWNlcnM6IFtdLFxuICAgIGh0dHBIYW5kbGVyczogW10sXG4gICAgaHR0cFJvdXRlczogW10sXG4gICAgY2FzZUNvbnZlcnNpb25Qb2xpY3k6IHsgdGFnOiBcIlNuYWtlQ2FzZVwiIH0sXG4gICAgZXhwbGljaXROYW1lczoge1xuICAgICAgZW50cmllczogW11cbiAgICB9LFxuICAgIHN1Ym1vZHVsZXM6IFtdLFxuICAgIGVudmlyb25tZW50OiBbXVxuICB9O1xuICBnZXQgbW9kdWxlRGVmKCkge1xuICAgIHJldHVybiB0aGlzLiNtb2R1bGVEZWY7XG4gIH1cbiAgcmF3TW9kdWxlRGVmVjEwKCkge1xuICAgIGNvbnN0IHNlY3Rpb25zID0gW107XG4gICAgY29uc3QgcHVzaCA9IChzKSA9PiB7XG4gICAgICBpZiAocykgc2VjdGlvbnMucHVzaChzKTtcbiAgICB9O1xuICAgIGNvbnN0IG1vZHVsZSA9IHRoaXMuI21vZHVsZURlZjtcbiAgICBwdXNoKG1vZHVsZS50eXBlc3BhY2UgJiYgeyB0YWc6IFwiVHlwZXNwYWNlXCIsIHZhbHVlOiBtb2R1bGUudHlwZXNwYWNlIH0pO1xuICAgIHB1c2gobW9kdWxlLnR5cGVzICYmIHsgdGFnOiBcIlR5cGVzXCIsIHZhbHVlOiBtb2R1bGUudHlwZXMgfSk7XG4gICAgcHVzaChtb2R1bGUudGFibGVzICYmIHsgdGFnOiBcIlRhYmxlc1wiLCB2YWx1ZTogbW9kdWxlLnRhYmxlcyB9KTtcbiAgICBwdXNoKG1vZHVsZS5yZWR1Y2VycyAmJiB7IHRhZzogXCJSZWR1Y2Vyc1wiLCB2YWx1ZTogbW9kdWxlLnJlZHVjZXJzIH0pO1xuICAgIHB1c2gobW9kdWxlLnByb2NlZHVyZXMgJiYgeyB0YWc6IFwiUHJvY2VkdXJlc1wiLCB2YWx1ZTogbW9kdWxlLnByb2NlZHVyZXMgfSk7XG4gICAgcHVzaChtb2R1bGUudmlld3MgJiYgeyB0YWc6IFwiVmlld3NcIiwgdmFsdWU6IG1vZHVsZS52aWV3cyB9KTtcbiAgICBwdXNoKFxuICAgICAgbW9kdWxlLnZpZXdQcmltYXJ5S2V5cyAmJiB7XG4gICAgICAgIHRhZzogXCJWaWV3UHJpbWFyeUtleXNcIixcbiAgICAgICAgdmFsdWU6IG1vZHVsZS52aWV3UHJpbWFyeUtleXNcbiAgICAgIH1cbiAgICApO1xuICAgIHB1c2gobW9kdWxlLnNjaGVkdWxlcyAmJiB7IHRhZzogXCJTY2hlZHVsZXNcIiwgdmFsdWU6IG1vZHVsZS5zY2hlZHVsZXMgfSk7XG4gICAgcHVzaChtb2R1bGUub3V0Ym94ZXMgJiYgeyB0YWc6IFwiT3V0Ym94ZXNcIiwgdmFsdWU6IG1vZHVsZS5vdXRib3hlcyB9KTtcbiAgICBwdXNoKFxuICAgICAgbW9kdWxlLmxpZmVDeWNsZVJlZHVjZXJzICYmIHtcbiAgICAgICAgdGFnOiBcIkxpZmVDeWNsZVJlZHVjZXJzXCIsXG4gICAgICAgIHZhbHVlOiBtb2R1bGUubGlmZUN5Y2xlUmVkdWNlcnNcbiAgICAgIH1cbiAgICApO1xuICAgIHB1c2goXG4gICAgICBtb2R1bGUuaHR0cEhhbmRsZXJzICYmIHtcbiAgICAgICAgdGFnOiBcIkh0dHBIYW5kbGVyc1wiLFxuICAgICAgICB2YWx1ZTogbW9kdWxlLmh0dHBIYW5kbGVyc1xuICAgICAgfVxuICAgICk7XG4gICAgcHVzaChcbiAgICAgIG1vZHVsZS5odHRwUm91dGVzICYmIHtcbiAgICAgICAgdGFnOiBcIkh0dHBSb3V0ZXNcIixcbiAgICAgICAgdmFsdWU6IG1vZHVsZS5odHRwUm91dGVzXG4gICAgICB9XG4gICAgKTtcbiAgICBwdXNoKFxuICAgICAgbW9kdWxlLnJvd0xldmVsU2VjdXJpdHkgJiYge1xuICAgICAgICB0YWc6IFwiUm93TGV2ZWxTZWN1cml0eVwiLFxuICAgICAgICB2YWx1ZTogbW9kdWxlLnJvd0xldmVsU2VjdXJpdHlcbiAgICAgIH1cbiAgICApO1xuICAgIHB1c2goXG4gICAgICBtb2R1bGUuZXhwbGljaXROYW1lcyAmJiB7XG4gICAgICAgIHRhZzogXCJFeHBsaWNpdE5hbWVzXCIsXG4gICAgICAgIHZhbHVlOiBtb2R1bGUuZXhwbGljaXROYW1lc1xuICAgICAgfVxuICAgICk7XG4gICAgcHVzaChcbiAgICAgIG1vZHVsZS5jYXNlQ29udmVyc2lvblBvbGljeSAmJiB7XG4gICAgICAgIHRhZzogXCJDYXNlQ29udmVyc2lvblBvbGljeVwiLFxuICAgICAgICB2YWx1ZTogbW9kdWxlLmNhc2VDb252ZXJzaW9uUG9saWN5XG4gICAgICB9XG4gICAgKTtcbiAgICBwdXNoKFxuICAgICAgbW9kdWxlLnN1Ym1vZHVsZXMgJiYge1xuICAgICAgICB0YWc6IFwiU3VibW9kdWxlc1wiLFxuICAgICAgICB2YWx1ZTogbW9kdWxlLnN1Ym1vZHVsZXNcbiAgICAgIH1cbiAgICApO1xuICAgIHB1c2goeyB0YWc6IFwiRW52aXJvbm1lbnRcIiwgdmFsdWU6IG1vZHVsZS5lbnZpcm9ubWVudCB9KTtcbiAgICByZXR1cm4geyBzZWN0aW9ucyB9O1xuICB9XG4gIGFkZFN1Ym1vZHVsZShzdWJtb2R1bGUpIHtcbiAgICB0aGlzLiNtb2R1bGVEZWYuc3VibW9kdWxlcy5wdXNoKHN1Ym1vZHVsZSk7XG4gIH1cbiAgLyoqXG4gICAqIFNldCB0aGUgY2FzZSBjb252ZXJzaW9uIHBvbGljeSBmb3IgdGhpcyBtb2R1bGUuXG4gICAqIENhbGxlZCBieSB0aGUgc2V0dGluZ3MgbWVjaGFuaXNtLlxuICAgKi9cbiAgc2V0Q2FzZUNvbnZlcnNpb25Qb2xpY3kocG9saWN5KSB7XG4gICAgdGhpcy4jbW9kdWxlRGVmLmNhc2VDb252ZXJzaW9uUG9saWN5ID0gcG9saWN5O1xuICB9XG4gIGdldCB0eXBlc3BhY2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuI21vZHVsZURlZi50eXBlc3BhY2U7XG4gIH1cbiAgLyoqXG4gICAqIFJlc29sdmVzIHRoZSBhY3R1YWwgdHlwZSBvZiBhIFR5cGVCdWlsZGVyIGJ5IGZvbGxvd2luZyBpdHMgcmVmZXJlbmNlcyB1bnRpbCBpdCByZWFjaGVzIGEgbm9uLXJlZiB0eXBlLlxuICAgKiBAcGFyYW0gdHlwZXNwYWNlIFRoZSB0eXBlc3BhY2UgdG8gcmVzb2x2ZSB0eXBlcyBhZ2FpbnN0LlxuICAgKiBAcGFyYW0gdHlwZUJ1aWxkZXIgVGhlIFR5cGVCdWlsZGVyIHRvIHJlc29sdmUuXG4gICAqIEByZXR1cm5zIFRoZSByZXNvbHZlZCBhbGdlYnJhaWMgdHlwZS5cbiAgICovXG4gIHJlc29sdmVUeXBlKHR5cGVCdWlsZGVyKSB7XG4gICAgbGV0IHR5ID0gdHlwZUJ1aWxkZXIuYWxnZWJyYWljVHlwZTtcbiAgICB3aGlsZSAodHkudGFnID09PSBcIlJlZlwiKSB7XG4gICAgICB0eSA9IHRoaXMudHlwZXNwYWNlLnR5cGVzW3R5LnZhbHVlXTtcbiAgICB9XG4gICAgcmV0dXJuIHR5O1xuICB9XG4gIC8qKlxuICAgKiBBZGRzIGEgdHlwZSB0byB0aGUgbW9kdWxlIGRlZmluaXRpb24ncyB0eXBlc3BhY2UgYXMgYSBgUmVmYCBpZiBpdCBpcyBhIG5hbWVkIGNvbXBvdW5kIHR5cGUgKFByb2R1Y3Qgb3IgU3VtKS5cbiAgICogT3RoZXJ3aXNlLCByZXR1cm5zIHRoZSB0eXBlIGFzIGlzLlxuICAgKiBAcGFyYW0gbmFtZVxuICAgKiBAcGFyYW0gdHlcbiAgICogQHJldHVybnNcbiAgICovXG4gIHJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh0eXBlQnVpbGRlcikge1xuICAgIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFByb2R1Y3RCdWlsZGVyICYmICFpc1VuaXQodHlwZUJ1aWxkZXIpIHx8IHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgU3VtQnVpbGRlciB8fCB0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFJvd0J1aWxkZXIpIHtcbiAgICAgIHJldHVybiB0aGlzLiNyZWdpc3RlckNvbXBvdW5kVHlwZVJlY3Vyc2l2ZWx5KHR5cGVCdWlsZGVyKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgT3B0aW9uQnVpbGRlcikge1xuICAgICAgcmV0dXJuIG5ldyBPcHRpb25CdWlsZGVyKFxuICAgICAgICB0aGlzLnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh0eXBlQnVpbGRlci52YWx1ZSlcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFJlc3VsdEJ1aWxkZXIpIHtcbiAgICAgIHJldHVybiBuZXcgUmVzdWx0QnVpbGRlcihcbiAgICAgICAgdGhpcy5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkodHlwZUJ1aWxkZXIub2spLFxuICAgICAgICB0aGlzLnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh0eXBlQnVpbGRlci5lcnIpXG4gICAgICApO1xuICAgIH0gZWxzZSBpZiAodHlwZUJ1aWxkZXIgaW5zdGFuY2VvZiBBcnJheUJ1aWxkZXIpIHtcbiAgICAgIHJldHVybiBuZXcgQXJyYXlCdWlsZGVyKFxuICAgICAgICB0aGlzLnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh0eXBlQnVpbGRlci5lbGVtZW50KVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHR5cGVCdWlsZGVyO1xuICAgIH1cbiAgfVxuICAjcmVnaXN0ZXJDb21wb3VuZFR5cGVSZWN1cnNpdmVseSh0eXBlQnVpbGRlcikge1xuICAgIGNvbnN0IHR5ID0gdHlwZUJ1aWxkZXIuYWxnZWJyYWljVHlwZTtcbiAgICBjb25zdCBuYW1lID0gdHlwZUJ1aWxkZXIudHlwZU5hbWU7XG4gICAgaWYgKG5hbWUgPT09IHZvaWQgMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgTWlzc2luZyB0eXBlIG5hbWUgZm9yICR7dHlwZUJ1aWxkZXIuY29uc3RydWN0b3IubmFtZSA/PyBcIlR5cGVCdWlsZGVyXCJ9ICR7SlNPTi5zdHJpbmdpZnkodHlwZUJ1aWxkZXIpfWBcbiAgICAgICk7XG4gICAgfVxuICAgIGxldCByID0gdGhpcy4jY29tcG91bmRUeXBlcy5nZXQodHkpO1xuICAgIGlmIChyICE9IG51bGwpIHtcbiAgICAgIHJldHVybiByO1xuICAgIH1cbiAgICBjb25zdCBuZXdUeSA9IHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgUm93QnVpbGRlciB8fCB0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFByb2R1Y3RCdWlsZGVyID8ge1xuICAgICAgdGFnOiBcIlByb2R1Y3RcIixcbiAgICAgIHZhbHVlOiB7IGVsZW1lbnRzOiBbXSB9XG4gICAgfSA6IHtcbiAgICAgIHRhZzogXCJTdW1cIixcbiAgICAgIHZhbHVlOiB7IHZhcmlhbnRzOiBbXSB9XG4gICAgfTtcbiAgICByID0gbmV3IFJlZkJ1aWxkZXIodGhpcy4jbW9kdWxlRGVmLnR5cGVzcGFjZS50eXBlcy5sZW5ndGgpO1xuICAgIHRoaXMuI21vZHVsZURlZi50eXBlc3BhY2UudHlwZXMucHVzaChuZXdUeSk7XG4gICAgdGhpcy4jY29tcG91bmRUeXBlcy5zZXQodHksIHIpO1xuICAgIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFJvd0J1aWxkZXIpIHtcbiAgICAgIGZvciAoY29uc3QgW25hbWUyLCBlbGVtXSBvZiBPYmplY3QuZW50cmllcyh0eXBlQnVpbGRlci5yb3cpKSB7XG4gICAgICAgIG5ld1R5LnZhbHVlLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgIG5hbWU6IG5hbWUyLFxuICAgICAgICAgIGFsZ2VicmFpY1R5cGU6IHRoaXMucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KGVsZW0udHlwZUJ1aWxkZXIpLmFsZ2VicmFpY1R5cGVcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFByb2R1Y3RCdWlsZGVyKSB7XG4gICAgICBmb3IgKGNvbnN0IFtuYW1lMiwgZWxlbV0gb2YgT2JqZWN0LmVudHJpZXModHlwZUJ1aWxkZXIuZWxlbWVudHMpKSB7XG4gICAgICAgIG5ld1R5LnZhbHVlLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgIG5hbWU6IG5hbWUyLFxuICAgICAgICAgIGFsZ2VicmFpY1R5cGU6IHRoaXMucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KGVsZW0pLmFsZ2VicmFpY1R5cGVcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFN1bUJ1aWxkZXIpIHtcbiAgICAgIGZvciAoY29uc3QgW25hbWUyLCB2YXJpYW50XSBvZiBPYmplY3QuZW50cmllcyh0eXBlQnVpbGRlci52YXJpYW50cykpIHtcbiAgICAgICAgbmV3VHkudmFsdWUudmFyaWFudHMucHVzaCh7XG4gICAgICAgICAgbmFtZTogbmFtZTIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogdGhpcy5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkodmFyaWFudCkuYWxnZWJyYWljVHlwZVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy4jbW9kdWxlRGVmLnR5cGVzLnB1c2goe1xuICAgICAgc291cmNlTmFtZTogc3BsaXROYW1lKG5hbWUpLFxuICAgICAgdHk6IHIucmVmLFxuICAgICAgY3VzdG9tT3JkZXJpbmc6IHRydWVcbiAgICB9KTtcbiAgICByZXR1cm4gcjtcbiAgfVxufTtcbmZ1bmN0aW9uIGlzVW5pdCh0eXBlQnVpbGRlcikge1xuICByZXR1cm4gdHlwZUJ1aWxkZXIudHlwZU5hbWUgPT0gbnVsbCAmJiB0eXBlQnVpbGRlci5hbGdlYnJhaWNUeXBlLnZhbHVlLmVsZW1lbnRzLmxlbmd0aCA9PT0gMDtcbn1cbmZ1bmN0aW9uIHNwbGl0TmFtZShuYW1lKSB7XG4gIGNvbnN0IHNjb3BlID0gbmFtZS5zcGxpdChcIi5cIik7XG4gIHJldHVybiB7IHNvdXJjZU5hbWU6IHNjb3BlLnBvcCgpLCBzY29wZSB9O1xufVxudmFyIHRleHRFbmNvZGVyMiA9IG5ldyBUZXh0RW5jb2RlcigpO1xudmFyIHRleHREZWNvZGVyMiA9IG5ldyBUZXh0RGVjb2RlcihcInV0Zi04XCIpO1xuZnVuY3Rpb24gZGVzZXJpYWxpemVNZXRob2QobWV0aG9kKSB7XG4gIHN3aXRjaCAobWV0aG9kLnRhZykge1xuICAgIGNhc2UgXCJHZXRcIjpcbiAgICAgIHJldHVybiBcIkdFVFwiO1xuICAgIGNhc2UgXCJIZWFkXCI6XG4gICAgICByZXR1cm4gXCJIRUFEXCI7XG4gICAgY2FzZSBcIlBvc3RcIjpcbiAgICAgIHJldHVybiBcIlBPU1RcIjtcbiAgICBjYXNlIFwiUHV0XCI6XG4gICAgICByZXR1cm4gXCJQVVRcIjtcbiAgICBjYXNlIFwiRGVsZXRlXCI6XG4gICAgICByZXR1cm4gXCJERUxFVEVcIjtcbiAgICBjYXNlIFwiQ29ubmVjdFwiOlxuICAgICAgcmV0dXJuIFwiQ09OTkVDVFwiO1xuICAgIGNhc2UgXCJPcHRpb25zXCI6XG4gICAgICByZXR1cm4gXCJPUFRJT05TXCI7XG4gICAgY2FzZSBcIlRyYWNlXCI6XG4gICAgICByZXR1cm4gXCJUUkFDRVwiO1xuICAgIGNhc2UgXCJQYXRjaFwiOlxuICAgICAgcmV0dXJuIFwiUEFUQ0hcIjtcbiAgICBjYXNlIFwiRXh0ZW5zaW9uXCI6XG4gICAgICByZXR1cm4gbWV0aG9kLnZhbHVlO1xuICB9XG59XG52YXIgbWV0aG9kcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKFtcbiAgW1wiR0VUXCIsIHsgdGFnOiBcIkdldFwiIH1dLFxuICBbXCJIRUFEXCIsIHsgdGFnOiBcIkhlYWRcIiB9XSxcbiAgW1wiUE9TVFwiLCB7IHRhZzogXCJQb3N0XCIgfV0sXG4gIFtcIlBVVFwiLCB7IHRhZzogXCJQdXRcIiB9XSxcbiAgW1wiREVMRVRFXCIsIHsgdGFnOiBcIkRlbGV0ZVwiIH1dLFxuICBbXCJDT05ORUNUXCIsIHsgdGFnOiBcIkNvbm5lY3RcIiB9XSxcbiAgW1wiT1BUSU9OU1wiLCB7IHRhZzogXCJPcHRpb25zXCIgfV0sXG4gIFtcIlRSQUNFXCIsIHsgdGFnOiBcIlRyYWNlXCIgfV0sXG4gIFtcIlBBVENIXCIsIHsgdGFnOiBcIlBhdGNoXCIgfV1cbl0pO1xuZnVuY3Rpb24gc2VyaWFsaXplTWV0aG9kKG1ldGhvZCkge1xuICByZXR1cm4gbWV0aG9kcy5nZXQobWV0aG9kPy50b1VwcGVyQ2FzZSgpID8/IFwiR0VUXCIpID8/IHtcbiAgICB0YWc6IFwiRXh0ZW5zaW9uXCIsXG4gICAgdmFsdWU6IG1ldGhvZFxuICB9O1xufVxuZnVuY3Rpb24gc2VyaWFsaXplSGVhZGVycyhoZWFkZXJzKSB7XG4gIHJldHVybiB7XG4gICAgZW50cmllczogQXJyYXkuZnJvbShoZWFkZXJzLmVudHJpZXMoKSwgKFtuYW1lLCB2YWx1ZV0pID0+ICh7XG4gICAgICBuYW1lLFxuICAgICAgdmFsdWU6IHRleHRFbmNvZGVyMi5lbmNvZGUodmFsdWUpXG4gICAgfSkpXG4gIH07XG59XG5mdW5jdGlvbiBkZXNlcmlhbGl6ZUhlYWRlcnMoaGVhZGVycykge1xuICByZXR1cm4gbmV3IEhlYWRlcnMoXG4gICAgaGVhZGVycy5lbnRyaWVzLm1hcCgoeyBuYW1lLCB2YWx1ZSB9KSA9PiBbXG4gICAgICBuYW1lLFxuICAgICAgdGV4dERlY29kZXIyLmRlY29kZSh2YWx1ZSlcbiAgICBdKVxuICApO1xufVxudmFyIG1ha2VSZXNwb25zZSA9IFN5bWJvbChcIm1ha2VSZXNwb25zZVwiKTtcbnZhciBTeW5jUmVzcG9uc2UgPSBjbGFzcyBfU3luY1Jlc3BvbnNlIHtcbiAgI2JvZHk7XG4gICNpbm5lcjtcbiAgY29uc3RydWN0b3IoYm9keSwgaW5pdCkge1xuICAgIGlmIChib2R5ID09IG51bGwpIHtcbiAgICAgIHRoaXMuI2JvZHkgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGJvZHkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHRoaXMuI2JvZHkgPSBib2R5O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiNib2R5ID0gbmV3IFVpbnQ4QXJyYXkoYm9keSkuYnVmZmVyO1xuICAgIH1cbiAgICB0aGlzLiNpbm5lciA9IHtcbiAgICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKGluaXQ/LmhlYWRlcnMpLFxuICAgICAgc3RhdHVzOiBpbml0Py5zdGF0dXMgPz8gMjAwLFxuICAgICAgc3RhdHVzVGV4dDogaW5pdD8uc3RhdHVzVGV4dCA/PyBcIlwiLFxuICAgICAgdHlwZTogXCJkZWZhdWx0XCIsXG4gICAgICB1cmw6IG51bGwsXG4gICAgICBhYm9ydGVkOiBmYWxzZSxcbiAgICAgIHZlcnNpb246IGluaXQ/LnZlcnNpb24gPz8geyB0YWc6IFwiSHR0cDExXCIgfVxuICAgIH07XG4gIH1cbiAgc3RhdGljIFttYWtlUmVzcG9uc2VdKGJvZHksIGlubmVyKSB7XG4gICAgY29uc3QgbWUgPSBuZXcgX1N5bmNSZXNwb25zZShib2R5KTtcbiAgICBtZS4jaW5uZXIgPSBpbm5lcjtcbiAgICByZXR1cm4gbWU7XG4gIH1cbiAgZ2V0IGhlYWRlcnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLmhlYWRlcnM7XG4gIH1cbiAgZ2V0IHN0YXR1cygpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIuc3RhdHVzO1xuICB9XG4gIGdldCBzdGF0dXNUZXh0KCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci5zdGF0dXNUZXh0O1xuICB9XG4gIGdldCBvaygpIHtcbiAgICByZXR1cm4gMjAwIDw9IHRoaXMuI2lubmVyLnN0YXR1cyAmJiB0aGlzLiNpbm5lci5zdGF0dXMgPD0gMjk5O1xuICB9XG4gIGdldCB1cmwoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLnVybCA/PyBcIlwiO1xuICB9XG4gIGdldCB0eXBlKCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci50eXBlO1xuICB9XG4gIGdldCB2ZXJzaW9uKCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci52ZXJzaW9uO1xuICB9XG4gIGFycmF5QnVmZmVyKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVzKCkuYnVmZmVyO1xuICB9XG4gIGJ5dGVzKCkge1xuICAgIGlmICh0aGlzLiNib2R5ID09IG51bGwpIHtcbiAgICAgIHJldHVybiBuZXcgVWludDhBcnJheSgpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoaXMuI2JvZHkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiB0ZXh0RW5jb2RlcjIuZW5jb2RlKHRoaXMuI2JvZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkodGhpcy4jYm9keSk7XG4gICAgfVxuICB9XG4gIGpzb24oKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UodGhpcy50ZXh0KCkpO1xuICB9XG4gIHRleHQoKSB7XG4gICAgaWYgKHRoaXMuI2JvZHkgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcy4jYm9keSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHRoaXMuI2JvZHk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0ZXh0RGVjb2RlcjIuZGVjb2RlKHRoaXMuI2JvZHkpO1xuICAgIH1cbiAgfVxufTtcblxuLy8gc3JjL3NlcnZlci9odHRwX2hhbmRsZXJzLnRzXG52YXIgaHR0cEhhbmRsZXJGbiA9IFN5bWJvbChcIlNwYWNldGltZURCLmh0dHBIYW5kbGVyRm5cIik7XG52YXIgQUNDRVBUQUJMRV9ST1VURV9QQVRIX0NIQVJTX0hVTUFOX0RFU0NSSVBUSU9OID0gXCJBU0NJSSBsb3dlcmNhc2UgbGV0dGVycywgZGlnaXRzIGFuZCBgLV9+L2BcIjtcbnZhciBtYWtlUmVxdWVzdCA9IFN5bWJvbChcIm1ha2VSZXF1ZXN0XCIpO1xuZnVuY3Rpb24gY29lcmNlUmVxdWVzdEJvZHkoYm9keSkge1xuICBpZiAoYm9keSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgaWYgKHR5cGVvZiBib2R5ID09PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIGJvZHk7XG4gIH1cbiAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGJvZHkpO1xufVxuZnVuY3Rpb24gcmVxdWVzdEJvZHlUb0J5dGVzKGJvZHkpIHtcbiAgaWYgKGJvZHkgPT0gbnVsbCkge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheSgpO1xuICB9XG4gIGlmICh0eXBlb2YgYm9keSA9PT0gXCJzdHJpbmdcIikge1xuICAgIHJldHVybiB0ZXh0RW5jb2RlcjIuZW5jb2RlKGJvZHkpO1xuICB9XG4gIHJldHVybiBib2R5O1xufVxuZnVuY3Rpb24gcmVxdWVzdEJvZHlUb1RleHQoYm9keSkge1xuICBpZiAoYm9keSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbiAgaWYgKHR5cGVvZiBib2R5ID09PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIGJvZHk7XG4gIH1cbiAgcmV0dXJuIHRleHREZWNvZGVyMi5kZWNvZGUoYm9keSk7XG59XG5mdW5jdGlvbiBjaGFyYWN0ZXJJc0FjY2VwdGFibGVGb3JSb3V0ZVBhdGgoYykge1xuICByZXR1cm4gYyA+PSBcImFcIiAmJiBjIDw9IFwielwiIHx8IGMgPj0gXCIwXCIgJiYgYyA8PSBcIjlcIiB8fCBjID09PSBcIi1cIiB8fCBjID09PSBcIl9cIiB8fCBjID09PSBcIn5cIiB8fCBjID09PSBcIi9cIjtcbn1cbmZ1bmN0aW9uIGFzc2VydFZhbGlkUGF0aChwYXRoKSB7XG4gIGlmIChwYXRoICE9PSBcIlwiICYmICFwYXRoLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUm91dGUgcGF0aHMgbXVzdCBzdGFydCB3aXRoIFxcYC9cXGA6ICR7cGF0aH1gKTtcbiAgfVxuICBpZiAoIVsuLi5wYXRoXS5ldmVyeShjaGFyYWN0ZXJJc0FjY2VwdGFibGVGb3JSb3V0ZVBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgIGBSb3V0ZSBwYXRocyBtYXkgY29udGFpbiBvbmx5ICR7QUNDRVBUQUJMRV9ST1VURV9QQVRIX0NIQVJTX0hVTUFOX0RFU0NSSVBUSU9OfTogJHtwYXRofWBcbiAgICApO1xuICB9XG59XG5mdW5jdGlvbiByb3V0ZXNPdmVybGFwKGEsIGIpIHtcbiAgY29uc3QgbWV0aG9kc01hdGNoID0gKGxlZnQsIHJpZ2h0KSA9PiB7XG4gICAgaWYgKGxlZnQudGFnICE9PSByaWdodC50YWcpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGxlZnQudGFnID09PSBcIkV4dGVuc2lvblwiICYmIHJpZ2h0LnRhZyA9PT0gXCJFeHRlbnNpb25cIikge1xuICAgICAgcmV0dXJuIGxlZnQudmFsdWUgPT09IHJpZ2h0LnZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbiAgcmV0dXJuIGEucGF0aCA9PT0gYi5wYXRoICYmIChhLm1ldGhvZC50YWcgPT09IFwiQW55XCIgfHwgYi5tZXRob2QudGFnID09PSBcIkFueVwiIHx8IGEubWV0aG9kLnRhZyA9PT0gXCJNZXRob2RcIiAmJiBiLm1ldGhvZC50YWcgPT09IFwiTWV0aG9kXCIgJiYgbWV0aG9kc01hdGNoKGEubWV0aG9kLnZhbHVlLCBiLm1ldGhvZC52YWx1ZSkpO1xufVxuZnVuY3Rpb24gam9pblBhdGhzKHByZWZpeCwgc3VmZml4KSB7XG4gIGlmIChwcmVmaXggPT09IFwiL1wiKSB7XG4gICAgcmV0dXJuIHN1ZmZpeDtcbiAgfVxuICBpZiAoc3VmZml4ID09PSBcIi9cIikge1xuICAgIHJldHVybiBwcmVmaXg7XG4gIH1cbiAgbGV0IHByZWZpeEVuZCA9IHByZWZpeC5sZW5ndGg7XG4gIHdoaWxlIChwcmVmaXhFbmQgPiAwICYmIHByZWZpeFtwcmVmaXhFbmQgLSAxXSA9PT0gXCIvXCIpIHtcbiAgICBwcmVmaXhFbmQtLTtcbiAgfVxuICBsZXQgc3VmZml4U3RhcnQgPSAwO1xuICB3aGlsZSAoc3VmZml4U3RhcnQgPCBzdWZmaXgubGVuZ3RoICYmIHN1ZmZpeFtzdWZmaXhTdGFydF0gPT09IFwiL1wiKSB7XG4gICAgc3VmZml4U3RhcnQrKztcbiAgfVxuICBjb25zdCBqb2luZWRQcmVmaXggPSBwcmVmaXguc2xpY2UoMCwgcHJlZml4RW5kKTtcbiAgY29uc3Qgam9pbmVkU3VmZml4ID0gc3VmZml4LnNsaWNlKHN1ZmZpeFN0YXJ0KTtcbiAgcmV0dXJuIGAke2pvaW5lZFByZWZpeH0vJHtqb2luZWRTdWZmaXh9YDtcbn1cbnZhciBSZXF1ZXN0ID0gY2xhc3MgX1JlcXVlc3Qge1xuICAjYm9keTtcbiAgI2lubmVyO1xuICBjb25zdHJ1Y3Rvcih1cmwsIGluaXQgPSB7fSkge1xuICAgIHRoaXMuI2JvZHkgPSBjb2VyY2VSZXF1ZXN0Qm9keShpbml0LmJvZHkpO1xuICAgIHRoaXMuI2lubmVyID0ge1xuICAgICAgaGVhZGVyczogbmV3IEhlYWRlcnMoaW5pdC5oZWFkZXJzKSxcbiAgICAgIG1ldGhvZDogaW5pdC5tZXRob2QgPz8gXCJHRVRcIixcbiAgICAgIHVyaTogXCJcIiArIHVybCxcbiAgICAgIHZlcnNpb246IGluaXQudmVyc2lvbiA/PyB7IHRhZzogXCJIdHRwMTFcIiB9XG4gICAgfTtcbiAgfVxuICBzdGF0aWMgW21ha2VSZXF1ZXN0XShib2R5LCBpbm5lcikge1xuICAgIGNvbnN0IG1lID0gbmV3IF9SZXF1ZXN0KGlubmVyLnVyaSk7XG4gICAgbWUuI2JvZHkgPSBjb2VyY2VSZXF1ZXN0Qm9keShib2R5KTtcbiAgICBtZS4jaW5uZXIgPSBpbm5lcjtcbiAgICByZXR1cm4gbWU7XG4gIH1cbiAgZ2V0IGhlYWRlcnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLmhlYWRlcnM7XG4gIH1cbiAgZ2V0IG1ldGhvZCgpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIubWV0aG9kO1xuICB9XG4gIGdldCB1cmkoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLnVyaTtcbiAgfVxuICBnZXQgdXJsKCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci51cmk7XG4gIH1cbiAgZ2V0IHZlcnNpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLnZlcnNpb247XG4gIH1cbiAgYXJyYXlCdWZmZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnl0ZXMoKS5idWZmZXI7XG4gIH1cbiAgYnl0ZXMoKSB7XG4gICAgcmV0dXJuIHJlcXVlc3RCb2R5VG9CeXRlcyh0aGlzLiNib2R5KTtcbiAgfVxuICBqc29uKCkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKHRoaXMudGV4dCgpKTtcbiAgfVxuICB0ZXh0KCkge1xuICAgIHJldHVybiByZXF1ZXN0Qm9keVRvVGV4dCh0aGlzLiNib2R5KTtcbiAgfVxufTtcbnZhciBleHBvcnRlZEh0dHBIYW5kbGVyT2JqZWN0cyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgV2Vha1NldCgpO1xudmFyIFJvdXRlciA9IGNsYXNzIF9Sb3V0ZXIge1xuICAjcm91dGVzO1xuICBjb25zdHJ1Y3Rvcihyb3V0ZXMgPSBbXSkge1xuICAgIHRoaXMuI3JvdXRlcyA9IHJvdXRlcztcbiAgfVxuICBnZXQocGF0aCwgaGFuZGxlcikge1xuICAgIHJldHVybiB0aGlzLmFkZFJvdXRlKFxuICAgICAgeyB0YWc6IFwiTWV0aG9kXCIsIHZhbHVlOiB7IHRhZzogXCJHZXRcIiB9IH0sXG4gICAgICBwYXRoLFxuICAgICAgaGFuZGxlclxuICAgICk7XG4gIH1cbiAgaGVhZChwYXRoLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkUm91dGUoXG4gICAgICB7IHRhZzogXCJNZXRob2RcIiwgdmFsdWU6IHsgdGFnOiBcIkhlYWRcIiB9IH0sXG4gICAgICBwYXRoLFxuICAgICAgaGFuZGxlclxuICAgICk7XG4gIH1cbiAgb3B0aW9ucyhwYXRoLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkUm91dGUoXG4gICAgICB7IHRhZzogXCJNZXRob2RcIiwgdmFsdWU6IHsgdGFnOiBcIk9wdGlvbnNcIiB9IH0sXG4gICAgICBwYXRoLFxuICAgICAgaGFuZGxlclxuICAgICk7XG4gIH1cbiAgcHV0KHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiUHV0XCIgfSB9LFxuICAgICAgcGF0aCxcbiAgICAgIGhhbmRsZXJcbiAgICApO1xuICB9XG4gIGRlbGV0ZShwYXRoLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkUm91dGUoXG4gICAgICB7IHRhZzogXCJNZXRob2RcIiwgdmFsdWU6IHsgdGFnOiBcIkRlbGV0ZVwiIH0gfSxcbiAgICAgIHBhdGgsXG4gICAgICBoYW5kbGVyXG4gICAgKTtcbiAgfVxuICBwb3N0KHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiUG9zdFwiIH0gfSxcbiAgICAgIHBhdGgsXG4gICAgICBoYW5kbGVyXG4gICAgKTtcbiAgfVxuICBwYXRjaChwYXRoLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkUm91dGUoXG4gICAgICB7IHRhZzogXCJNZXRob2RcIiwgdmFsdWU6IHsgdGFnOiBcIlBhdGNoXCIgfSB9LFxuICAgICAgcGF0aCxcbiAgICAgIGhhbmRsZXJcbiAgICApO1xuICB9XG4gIGFueShwYXRoLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkUm91dGUoeyB0YWc6IFwiQW55XCIgfSwgcGF0aCwgaGFuZGxlcik7XG4gIH1cbiAgbmVzdChwYXRoLCBzdWJSb3V0ZXIpIHtcbiAgICBhc3NlcnRWYWxpZFBhdGgocGF0aCk7XG4gICAgaWYgKHRoaXMuI3JvdXRlcy5zb21lKChyb3V0ZSkgPT4gcm91dGUucGF0aC5zdGFydHNXaXRoKHBhdGgpKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgYENhbm5vdCBuZXN0IHJvdXRlciBhdCBcXGAke3BhdGh9XFxgOyBleGlzdGluZyByb3V0ZXMgb3ZlcmxhcCB3aXRoIG5lc3RlZCBwYXRoYFxuICAgICAgKTtcbiAgICB9XG4gICAgbGV0IG1lcmdlZCA9IG5ldyBfUm91dGVyKHRoaXMuI3JvdXRlcyk7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiBzdWJSb3V0ZXIuI3JvdXRlcykge1xuICAgICAgbWVyZ2VkID0gbWVyZ2VkLmFkZFJvdXRlKFxuICAgICAgICByb3V0ZS5tZXRob2QsXG4gICAgICAgIGpvaW5QYXRocyhwYXRoLCByb3V0ZS5wYXRoKSxcbiAgICAgICAgcm91dGUuaGFuZGxlclxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIG1lcmdlZDtcbiAgfVxuICBtZXJnZShvdGhlclJvdXRlcikge1xuICAgIGxldCBtZXJnZWQgPSBuZXcgX1JvdXRlcih0aGlzLiNyb3V0ZXMpO1xuICAgIGZvciAoY29uc3Qgcm91dGUgb2Ygb3RoZXJSb3V0ZXIuI3JvdXRlcykge1xuICAgICAgbWVyZ2VkID0gbWVyZ2VkLmFkZFJvdXRlKHJvdXRlLm1ldGhvZCwgcm91dGUucGF0aCwgcm91dGUuaGFuZGxlcik7XG4gICAgfVxuICAgIHJldHVybiBtZXJnZWQ7XG4gIH1cbiAgaW50b1JvdXRlcygpIHtcbiAgICByZXR1cm4gdGhpcy4jcm91dGVzLnNsaWNlKCk7XG4gIH1cbiAgYWRkUm91dGUobWV0aG9kLCBwYXRoLCBoYW5kbGVyKSB7XG4gICAgYXNzZXJ0VmFsaWRQYXRoKHBhdGgpO1xuICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHsgbWV0aG9kLCBwYXRoLCBoYW5kbGVyIH07XG4gICAgaWYgKHRoaXMuI3JvdXRlcy5zb21lKChyb3V0ZSkgPT4gcm91dGVzT3ZlcmxhcChyb3V0ZSwgY2FuZGlkYXRlKSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFJvdXRlIGNvbmZsaWN0IGZvciBcXGAke3BhdGh9XFxgYCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgX1JvdXRlcihbLi4udGhpcy4jcm91dGVzLCBjYW5kaWRhdGVdKTtcbiAgfVxufTtcbmZ1bmN0aW9uIG1ha2VIdHRwSGFuZGxlckV4cG9ydChjdHgsIG9wdHMsIGZuKSB7XG4gIGNvbnN0IGhhbmRsZXJFeHBvcnQgPSBPYmplY3QuYXNzaWduKFxuICAgICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKSxcbiAgICB7XG4gICAgICBbaHR0cEhhbmRsZXJGbl06IGZuLFxuICAgICAgW2V4cG9ydENvbnRleHRdOiBjdHgsXG4gICAgICBbcmVnaXN0ZXJFeHBvcnRdKGN0eDIsIGV4cG9ydE5hbWUpIHtcbiAgICAgICAgaWYgKGV4cG9ydGVkSHR0cEhhbmRsZXJPYmplY3RzLmhhcyhoYW5kbGVyRXhwb3J0KSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICBgSFRUUCBoYW5kbGVyICcke2V4cG9ydE5hbWV9JyB3YXMgZXhwb3J0ZWQgbW9yZSB0aGFuIG9uY2VgXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBleHBvcnRlZEh0dHBIYW5kbGVyT2JqZWN0cy5hZGQoaGFuZGxlckV4cG9ydCk7XG4gICAgICAgIHJlZ2lzdGVySHR0cEhhbmRsZXIoY3R4MiwgZXhwb3J0TmFtZSwgZm4sIG9wdHMpO1xuICAgICAgICBjdHgyLmh0dHBIYW5kbGVyRXhwb3J0cy5zZXQoXG4gICAgICAgICAgaGFuZGxlckV4cG9ydCxcbiAgICAgICAgICBleHBvcnROYW1lXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICApO1xuICByZXR1cm4gaGFuZGxlckV4cG9ydDtcbn1cbmZ1bmN0aW9uIG1ha2VIdHRwUm91dGVyRXhwb3J0KGN0eCwgcm91dGVyKSB7XG4gIHJldHVybiB7XG4gICAgW2V4cG9ydENvbnRleHRdOiBjdHgsXG4gICAgW3JlZ2lzdGVyRXhwb3J0XShjdHgyKSB7XG4gICAgICBjdHgyLnBlbmRpbmdIdHRwUm91dGVzLnB1c2goLi4ucm91dGVyLmludG9Sb3V0ZXMoKSk7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJIdHRwSGFuZGxlcihjdHgsIGV4cG9ydE5hbWUsIGZuLCBvcHRzKSB7XG4gIGN0eC5kZWZpbmVIdHRwSGFuZGxlcihleHBvcnROYW1lKTtcbiAgY3R4Lm1vZHVsZURlZi5odHRwSGFuZGxlcnMucHVzaCh7IHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUgfSk7XG4gIGlmIChvcHRzPy5uYW1lICE9IG51bGwpIHtcbiAgICBjdHgubW9kdWxlRGVmLmV4cGxpY2l0TmFtZXMuZW50cmllcy5wdXNoKHtcbiAgICAgIHRhZzogXCJGdW5jdGlvblwiLFxuICAgICAgdmFsdWU6IHtcbiAgICAgICAgc291cmNlTmFtZTogZXhwb3J0TmFtZSxcbiAgICAgICAgY2Fub25pY2FsTmFtZTogb3B0cy5uYW1lXG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgaWYgKCFmbi5uYW1lKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGZuLCBcIm5hbWVcIiwgeyB2YWx1ZTogZXhwb3J0TmFtZSwgd3JpdGFibGU6IGZhbHNlIH0pO1xuICB9XG4gIGN0eC5odHRwSGFuZGxlcnMucHVzaChmbik7XG59XG5cbi8vIHNyYy9zZXJ2ZXIvaHR0cF9pbnRlcm5hbC50c1xudmFyIGltcG9ydF9zdGF0dXNlcyA9IF9fdG9FU00ocmVxdWlyZV9zdGF0dXNlcygpKTtcblxuLy8gc3JjL3NlcnZlci9yYW5nZS50c1xudmFyIFJhbmdlID0gY2xhc3Mge1xuICAjZnJvbTtcbiAgI3RvO1xuICBjb25zdHJ1Y3Rvcihmcm9tLCB0bykge1xuICAgIHRoaXMuI2Zyb20gPSBmcm9tID8/IHsgdGFnOiBcInVuYm91bmRlZFwiIH07XG4gICAgdGhpcy4jdG8gPSB0byA/PyB7IHRhZzogXCJ1bmJvdW5kZWRcIiB9O1xuICB9XG4gIGdldCBmcm9tKCkge1xuICAgIHJldHVybiB0aGlzLiNmcm9tO1xuICB9XG4gIGdldCB0bygpIHtcbiAgICByZXR1cm4gdGhpcy4jdG87XG4gIH1cbn07XG5cbi8vIHNyYy9saWIvcmVtb3RlX21vZHVsZS50c1xudmFyIHJlY2VpdmVyTW9kdWxlcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgV2Vha01hcCgpO1xudmFyIGlkZW50aXR5TW9kdWxlcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgV2Vha01hcCgpO1xuZnVuY3Rpb24gb3V0Ym94VGFibGUocmVjZWl2ZXIsIGlkZW50aXR5LCBvcHRzID0ge30pIHtcbiAgZm9yIChjb25zdCBuYW1lIG9mIFtcIm1zZ0lkXCIsIFwidGFyZ2V0XCJdKSB7XG4gICAgaWYgKG5hbWUgaW4gcmVjZWl2ZXIucGFyYW1zKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBgUmVjZWl2ZXIgcGFyYW1ldGVyICcke25hbWV9JyBjb25mbGljdHMgd2l0aCBvdXRib3ggbWV0YWRhdGE7IGRlY2xhcmUgdGhlIG91dGJveCB3aXRoIHRhYmxlKCkgYW5kIGNob29zZSBkaWZmZXJlbnQgbWV0YWRhdGEgY29sdW1uIG5hbWVzYFxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgY29uc3Qgcm93ID0ge1xuICAgIG1zZ0lkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgdGFyZ2V0OiBpZGVudGl0eSgpLnRhcmdldCgpLFxuICAgIC4uLnJlY2VpdmVyLnBhcmFtc1xuICB9O1xuICByZXR1cm4gdGFibGUoeyBuYW1lOiBvcHRzLm5hbWUsIG91dGJveDogeyByZWNlaXZlciB9IH0sIHJvdyk7XG59XG5mdW5jdGlvbiByZW1vdGVNb2R1bGUocmVkdWNlcnMsIG1vZHVsZSkge1xuICBjb25zdCBpZGVudGl0eSA9ICgpID0+IHtcbiAgICBjb25zdCBidWlsZGVyID0gbmV3IElkZW50aXR5QnVpbGRlcigpO1xuICAgIGlkZW50aXR5TW9kdWxlcy5zZXQoYnVpbGRlciwgbW9kdWxlKTtcbiAgICByZXR1cm4gYnVpbGRlcjtcbiAgfTtcbiAgY29uc3QgaGFuZGxlcyA9IE9iamVjdC5mcm9tRW50cmllcyhcbiAgICBPYmplY3QuZW50cmllcyhyZWR1Y2VycykubWFwKChbbmFtZSwgcmVkdWNlcl0pID0+IHtcbiAgICAgIGNvbnN0IGhhbmRsZSA9IHsgLi4ucmVkdWNlciB9O1xuICAgICAgcmVjZWl2ZXJNb2R1bGVzLnNldChoYW5kbGUsIG1vZHVsZSk7XG4gICAgICByZXR1cm4gW25hbWUsIGhhbmRsZV07XG4gICAgfSlcbiAgKTtcbiAgY29uc3Qgb3V0Ym94ID0gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIE9iamVjdC5lbnRyaWVzKGhhbmRsZXMpLm1hcCgoW25hbWUsIHJlZHVjZXJdKSA9PiBbXG4gICAgICBuYW1lLFxuICAgICAgKG9wdHMpID0+IG91dGJveFRhYmxlKHJlZHVjZXIsIGlkZW50aXR5LCBvcHRzKVxuICAgIF0pXG4gICk7XG4gIHJldHVybiB7IHJlZHVjZXJzOiBoYW5kbGVzLCBpZGVudGl0eSwgb3V0Ym94IH07XG59XG5mdW5jdGlvbiBtYWtlT3V0Ym94KHJlY2VpdmVyLCByb3csIHByaW1hcnlLZXksIHNjaGVkdWxlZE9yRXZlbnQpIHtcbiAgY29uc3QgY29sdW1ucyA9IE9iamVjdC5lbnRyaWVzKHJvdy5yb3cpO1xuICBpZiAoc2NoZWR1bGVkT3JFdmVudClcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT3V0Ym94IHRhYmxlcyBjYW5ub3QgYmUgc2NoZWR1bGVkIG9yIGV2ZW50IHRhYmxlc1wiKTtcbiAgY29uc3QgcGsgPSBwcmltYXJ5S2V5Lmxlbmd0aCA9PT0gMSA/IGNvbHVtbnNbcHJpbWFyeUtleVswXV1bMV0gOiB2b2lkIDA7XG4gIGlmICghcGs/LmNvbHVtbk1ldGFkYXRhLmlzQXV0b0luY3JlbWVudCB8fCBway50eXBlQnVpbGRlci5hbGdlYnJhaWNUeXBlLnRhZyAhPT0gXCJVNjRcIikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICBcIk91dGJveCB0YWJsZXMgcmVxdWlyZSBhIHU2NCBwcmltYXJ5IGtleSB3aXRoIGF1dG9JbmMoKVwiXG4gICAgKTtcbiAgfVxuICBjb25zdCB0YXJnZXRzID0gY29sdW1ucy5mbGF0TWFwKFxuICAgIChbLCBjb2xdLCBpKSA9PiBjb2wuY29sdW1uTWV0YWRhdGEuaXNUYXJnZXQgPyBbaV0gOiBbXVxuICApO1xuICBpZiAodGFyZ2V0cy5sZW5ndGggIT09IDEgfHwgIWRlZXBFcXVhbChcbiAgICBjb2x1bW5zW3RhcmdldHNbMF1dWzFdLnR5cGVCdWlsZGVyLmFsZ2VicmFpY1R5cGUsXG4gICAgdC5pZGVudGl0eSgpLmFsZ2VicmFpY1R5cGVcbiAgKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICBcIk91dGJveCB0YWJsZXMgcmVxdWlyZSBleGFjdGx5IG9uZSBpZGVudGl0eSgpLnRhcmdldCgpIGNvbHVtblwiXG4gICAgKTtcbiAgfVxuICBjb25zdCBhcmdDb2x1bW5zID0gT2JqZWN0LmVudHJpZXMocmVjZWl2ZXIucGFyYW1zKS5tYXAoKFtuYW1lLCB0eXBlXSkgPT4ge1xuICAgIGNvbnN0IG1hdGNoZXMgPSBjb2x1bW5zLmZsYXRNYXAoXG4gICAgICAoW2tleSwgY29sXSwgaSkgPT4gKGNvbC5jb2x1bW5NZXRhZGF0YS5wYXJhbU5hbWUgPz8ga2V5KSA9PT0gbmFtZSA/IFtpXSA6IFtdXG4gICAgKTtcbiAgICBpZiAobWF0Y2hlcy5sZW5ndGggIT09IDEpXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBgT3V0Ym94IHJlcXVpcmVzIGV4YWN0bHkgb25lIGNvbHVtbiBmb3IgcmVjZWl2ZXIgcGFyYW1ldGVyICcke25hbWV9J2BcbiAgICAgICk7XG4gICAgY29uc3QgaW5kZXggPSBtYXRjaGVzWzBdO1xuICAgIGlmICghZGVlcEVxdWFsKFxuICAgICAgY29sdW1uc1tpbmRleF1bMV0udHlwZUJ1aWxkZXIuYWxnZWJyYWljVHlwZSxcbiAgICAgIHR5cGUuYWxnZWJyYWljVHlwZVxuICAgICkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYE91dGJveCBjb2x1bW4gZm9yICcke25hbWV9JyBoYXMgdGhlIHdyb25nIHR5cGVgKTtcbiAgICB9XG4gICAgcmV0dXJuIGluZGV4O1xuICB9KTtcbiAgY29uc3QgbW9kdWxlID0gcmVjZWl2ZXJNb2R1bGVzLmdldChyZWNlaXZlcik7XG4gIGNvbnN0IHRhcmdldCA9IGNvbHVtbnNbdGFyZ2V0c1swXV1bMV0udHlwZUJ1aWxkZXI7XG4gIGlmIChtb2R1bGUgPT09IHZvaWQgMCB8fCBpZGVudGl0eU1vZHVsZXMuZ2V0KHRhcmdldCkgIT09IG1vZHVsZSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICBcIk91dGJveCB0YXJnZXQgbXVzdCB1c2UgdGhlIHNlbGVjdGVkIHJlY2VpdmVyIG1vZHVsZSBpZGVudGl0eSgpIGJ1aWxkZXJcIlxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICB0YXJnZXRDb2x1bW46IHRhcmdldHNbMF0sXG4gICAgYXJnQ29sdW1ucyxcbiAgICByZW1vdGVSZWR1Y2VyOiByZWNlaXZlci5uYW1lLFxuICAgIHNpZ25hdHVyZUhhc2g6IHJlY2VpdmVyLnNpZ25hdHVyZUhhc2hcbiAgfTtcbn1cblxuLy8gc3JjL2xpYi90YWJsZS50c1xuZnVuY3Rpb24gdGFibGUob3B0cywgcm93LCAuLi5fKSB7XG4gIGNvbnN0IHtcbiAgICBuYW1lLFxuICAgIHB1YmxpYzogaXNQdWJsaWMgPSBmYWxzZSxcbiAgICBpbmRleGVzOiB1c2VySW5kZXhlcyA9IFtdLFxuICAgIHNjaGVkdWxlZCxcbiAgICBldmVudDogaXNFdmVudCA9IGZhbHNlXG4gIH0gPSBvcHRzO1xuICBjb25zdCBjb2xJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBjb25zdCBjb2xOYW1lTGlzdCA9IFtdO1xuICBpZiAoIShyb3cgaW5zdGFuY2VvZiBSb3dCdWlsZGVyKSkge1xuICAgIHJvdyA9IG5ldyBSb3dCdWlsZGVyKHJvdyk7XG4gIH1cbiAgcm93LmFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHMuZm9yRWFjaCgoZWxlbSwgaSkgPT4ge1xuICAgIGNvbElkcy5zZXQoZWxlbS5uYW1lLCBpKTtcbiAgICBjb2xOYW1lTGlzdC5wdXNoKGVsZW0ubmFtZSk7XG4gIH0pO1xuICBjb25zdCBwayA9IFtdO1xuICBjb25zdCBpbmRleGVzID0gW107XG4gIGNvbnN0IGNvbnN0cmFpbnRzID0gW107XG4gIGNvbnN0IHNlcXVlbmNlcyA9IFtdO1xuICBsZXQgc2NoZWR1bGVBdENvbDtcbiAgY29uc3QgZGVmYXVsdFZhbHVlcyA9IFtdO1xuICBmb3IgKGNvbnN0IFtuYW1lMiwgYnVpbGRlcl0gb2YgT2JqZWN0LmVudHJpZXMocm93LnJvdykpIHtcbiAgICBjb25zdCBtZXRhID0gYnVpbGRlci5jb2x1bW5NZXRhZGF0YTtcbiAgICBpZiAobWV0YS5pc1ByaW1hcnlLZXkpIHtcbiAgICAgIHBrLnB1c2goY29sSWRzLmdldChuYW1lMikpO1xuICAgIH1cbiAgICBjb25zdCBpc1VuaXF1ZSA9IG1ldGEuaXNVbmlxdWUgfHwgbWV0YS5pc1ByaW1hcnlLZXk7XG4gICAgaWYgKG1ldGEuaW5kZXhUeXBlIHx8IGlzVW5pcXVlKSB7XG4gICAgICBjb25zdCBhbGdvID0gbWV0YS5pbmRleFR5cGUgPz8gXCJidHJlZVwiO1xuICAgICAgY29uc3QgaWQgPSBjb2xJZHMuZ2V0KG5hbWUyKTtcbiAgICAgIGxldCBhbGdvcml0aG07XG4gICAgICBzd2l0Y2ggKGFsZ28pIHtcbiAgICAgICAgY2FzZSBcImJ0cmVlXCI6XG4gICAgICAgICAgYWxnb3JpdGhtID0gUmF3SW5kZXhBbGdvcml0aG0uQlRyZWUoW2lkXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJoYXNoXCI6XG4gICAgICAgICAgYWxnb3JpdGhtID0gUmF3SW5kZXhBbGdvcml0aG0uSGFzaChbaWRdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcImRpcmVjdFwiOlxuICAgICAgICAgIGFsZ29yaXRobSA9IFJhd0luZGV4QWxnb3JpdGhtLkRpcmVjdChpZCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpbmRleGVzLnB1c2goe1xuICAgICAgICBzb3VyY2VOYW1lOiB2b2lkIDAsXG4gICAgICAgIC8vIFVubmFtZWQgaW5kZXhlcyB3aWxsIGJlIGFzc2lnbmVkIGEgZ2xvYmFsbHkgdW5pcXVlIG5hbWVcbiAgICAgICAgYWNjZXNzb3JOYW1lOiBuYW1lMixcbiAgICAgICAgYWxnb3JpdGhtXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKGlzVW5pcXVlKSB7XG4gICAgICBjb25zdHJhaW50cy5wdXNoKHtcbiAgICAgICAgc291cmNlTmFtZTogdm9pZCAwLFxuICAgICAgICBkYXRhOiB7IHRhZzogXCJVbmlxdWVcIiwgdmFsdWU6IHsgY29sdW1uczogW2NvbElkcy5nZXQobmFtZTIpXSB9IH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAobWV0YS5pc0F1dG9JbmNyZW1lbnQpIHtcbiAgICAgIHNlcXVlbmNlcy5wdXNoKHtcbiAgICAgICAgc291cmNlTmFtZTogdm9pZCAwLFxuICAgICAgICBzdGFydDogdm9pZCAwLFxuICAgICAgICBtaW5WYWx1ZTogdm9pZCAwLFxuICAgICAgICBtYXhWYWx1ZTogdm9pZCAwLFxuICAgICAgICBjb2x1bW46IGNvbElkcy5nZXQobmFtZTIpLFxuICAgICAgICBpbmNyZW1lbnQ6IDFuXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtZXRhLCBcImRlZmF1bHRWYWx1ZVwiKSkge1xuICAgICAgY29uc3Qgd3JpdGVyID0gbmV3IEJpbmFyeVdyaXRlcigxNik7XG4gICAgICBidWlsZGVyLnNlcmlhbGl6ZSh3cml0ZXIsIG1ldGEuZGVmYXVsdFZhbHVlKTtcbiAgICAgIGRlZmF1bHRWYWx1ZXMucHVzaCh7XG4gICAgICAgIGNvbElkOiBjb2xJZHMuZ2V0KG5hbWUyKSxcbiAgICAgICAgdmFsdWU6IHdyaXRlci5nZXRCdWZmZXIoKVxuICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGFsZ2VicmFpY1R5cGUgPSBidWlsZGVyLnR5cGVCdWlsZGVyLmFsZ2VicmFpY1R5cGU7XG4gICAgaWYgKHNjaGVkdWxlX2F0X2RlZmF1bHQuaXNTY2hlZHVsZUF0KGFsZ2VicmFpY1R5cGUpKSB7XG4gICAgICBzY2hlZHVsZUF0Q29sID0gY29sSWRzLmdldChuYW1lMik7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgaW5kZXhPcHRzIG9mIHVzZXJJbmRleGVzID8/IFtdKSB7XG4gICAgY29uc3QgYWNjZXNzb3IgPSBpbmRleE9wdHMuYWNjZXNzb3I7XG4gICAgaWYgKHR5cGVvZiBhY2Nlc3NvciAhPT0gXCJzdHJpbmdcIiB8fCBhY2Nlc3Nvci5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IHRhYmxlTGFiZWwgPSBuYW1lID8/IFwiPHVubmFtZWQ+XCI7XG4gICAgICBjb25zdCBpbmRleExhYmVsID0gaW5kZXhPcHRzLm5hbWUgPz8gXCI8dW5uYW1lZD5cIjtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIGBJbmRleCAnJHtpbmRleExhYmVsfScgb24gdGFibGUgJyR7dGFibGVMYWJlbH0nIG11c3QgZGVmaW5lIGEgbm9uLWVtcHR5ICdhY2Nlc3NvcidgXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgYWxnb3JpdGhtO1xuICAgIHN3aXRjaCAoaW5kZXhPcHRzLmFsZ29yaXRobSkge1xuICAgICAgY2FzZSBcImJ0cmVlXCI6XG4gICAgICAgIGFsZ29yaXRobSA9IHtcbiAgICAgICAgICB0YWc6IFwiQlRyZWVcIixcbiAgICAgICAgICB2YWx1ZTogaW5kZXhPcHRzLmNvbHVtbnMubWFwKChjKSA9PiBjb2xJZHMuZ2V0KGMpKVxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJoYXNoXCI6XG4gICAgICAgIGFsZ29yaXRobSA9IHtcbiAgICAgICAgICB0YWc6IFwiSGFzaFwiLFxuICAgICAgICAgIHZhbHVlOiBpbmRleE9wdHMuY29sdW1ucy5tYXAoKGMpID0+IGNvbElkcy5nZXQoYykpXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImRpcmVjdFwiOlxuICAgICAgICBhbGdvcml0aG0gPSB7IHRhZzogXCJEaXJlY3RcIiwgdmFsdWU6IGNvbElkcy5nZXQoaW5kZXhPcHRzLmNvbHVtbikgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGluZGV4ZXMucHVzaCh7XG4gICAgICBzb3VyY2VOYW1lOiB2b2lkIDAsXG4gICAgICBhY2Nlc3Nvck5hbWU6IGFjY2Vzc29yLFxuICAgICAgYWxnb3JpdGhtLFxuICAgICAgY2Fub25pY2FsTmFtZTogaW5kZXhPcHRzLm5hbWVcbiAgICB9KTtcbiAgfVxuICBmb3IgKGNvbnN0IGNvbnN0cmFpbnRPcHRzIG9mIG9wdHMuY29uc3RyYWludHMgPz8gW10pIHtcbiAgICBpZiAoY29uc3RyYWludE9wdHMuY29uc3RyYWludCA9PT0gXCJ1bmlxdWVcIikge1xuICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgdGFnOiBcIlVuaXF1ZVwiLFxuICAgICAgICB2YWx1ZTogeyBjb2x1bW5zOiBjb25zdHJhaW50T3B0cy5jb2x1bW5zLm1hcCgoYykgPT4gY29sSWRzLmdldChjKSkgfVxuICAgICAgfTtcbiAgICAgIGNvbnN0cmFpbnRzLnB1c2goeyBzb3VyY2VOYW1lOiBjb25zdHJhaW50T3B0cy5uYW1lLCBkYXRhIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIGNvbnN0IHByb2R1Y3RUeXBlID0gcm93LmFsZ2VicmFpY1R5cGUudmFsdWU7XG4gIGNvbnN0IHNjaGVkdWxlID0gc2NoZWR1bGVkICYmIHNjaGVkdWxlQXRDb2wgIT09IHZvaWQgMCA/IHsgc2NoZWR1bGVBdENvbCwgcmVkdWNlcjogc2NoZWR1bGVkIH0gOiB2b2lkIDA7XG4gIGNvbnN0IHJlY2VpdmVyID0gb3B0cy5vdXRib3g/LnJlY2VpdmVyO1xuICBjb25zdCBvdXRib3ggPSByZWNlaXZlciA/IG1ha2VPdXRib3gocmVjZWl2ZXIsIHJvdywgcGssICEhc2NoZWR1bGVkIHx8IGlzRXZlbnQpIDogdm9pZCAwO1xuICByZXR1cm4ge1xuICAgIG91dGJveCxcbiAgICByb3dUeXBlOiByb3csXG4gICAgdGFibGVOYW1lOiBuYW1lLFxuICAgIHJvd1NwYWNldGltZVR5cGU6IHByb2R1Y3RUeXBlLFxuICAgIHRhYmxlRGVmOiAoY3R4LCBhY2NOYW1lKSA9PiB7XG4gICAgICBjb25zdCB0YWJsZU5hbWUgPSBuYW1lID8/IGFjY05hbWU7XG4gICAgICBpZiAocm93LnR5cGVOYW1lID09PSB2b2lkIDApIHtcbiAgICAgICAgcm93LnR5cGVOYW1lID0gdG9QYXNjYWxDYXNlKHRhYmxlTmFtZSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGluZGV4IG9mIGluZGV4ZXMpIHtcbiAgICAgICAgY29uc3QgY29scyA9IGluZGV4LmFsZ29yaXRobS50YWcgPT09IFwiRGlyZWN0XCIgPyBbaW5kZXguYWxnb3JpdGhtLnZhbHVlXSA6IGluZGV4LmFsZ29yaXRobS52YWx1ZTtcbiAgICAgICAgY29uc3QgY29sUyA9IGNvbHMubWFwKChpKSA9PiBjb2xOYW1lTGlzdFtpXSkuam9pbihcIl9cIik7XG4gICAgICAgIGNvbnN0IHNvdXJjZU5hbWUgPSBpbmRleC5zb3VyY2VOYW1lID0gYCR7YWNjTmFtZX1fJHtjb2xTfV9pZHhfJHtpbmRleC5hbGdvcml0aG0udGFnLnRvTG93ZXJDYXNlKCl9YDtcbiAgICAgICAgY29uc3QgeyBjYW5vbmljYWxOYW1lIH0gPSBpbmRleDtcbiAgICAgICAgaWYgKGNhbm9uaWNhbE5hbWUgIT09IHZvaWQgMCkge1xuICAgICAgICAgIGN0eC5tb2R1bGVEZWYuZXhwbGljaXROYW1lcy5lbnRyaWVzLnB1c2goXG4gICAgICAgICAgICBFeHBsaWNpdE5hbWVFbnRyeS5JbmRleCh7IHNvdXJjZU5hbWUsIGNhbm9uaWNhbE5hbWUgfSlcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzb3VyY2VOYW1lOiBhY2NOYW1lLFxuICAgICAgICBwcm9kdWN0VHlwZVJlZjogY3R4LnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseShyb3cpLnJlZixcbiAgICAgICAgcHJpbWFyeUtleTogcGssXG4gICAgICAgIGluZGV4ZXMsXG4gICAgICAgIGNvbnN0cmFpbnRzLFxuICAgICAgICBzZXF1ZW5jZXMsXG4gICAgICAgIHRhYmxlVHlwZTogeyB0YWc6IFwiVXNlclwiIH0sXG4gICAgICAgIHRhYmxlQWNjZXNzOiB7IHRhZzogaXNQdWJsaWMgPyBcIlB1YmxpY1wiIDogXCJQcml2YXRlXCIgfSxcbiAgICAgICAgZGVmYXVsdFZhbHVlcyxcbiAgICAgICAgaXNFdmVudFxuICAgICAgfTtcbiAgICB9LFxuICAgIC8vIFByZXNlcnZlIHRoZSBkZWNsYXJlZCBpbmRleCBvcHRpb25zIGFzIHJ1bnRpbWUgZGF0YSBzbyBgdGFibGVUb1NjaGVtYWBcbiAgICAvLyBjYW4gZXhwb3NlIHRoZW0gd2l0aG91dCB0eXBlLXNtdWdnbGluZy5cbiAgICBpZHhzOiB1c2VySW5kZXhlcyxcbiAgICBjb25zdHJhaW50cyxcbiAgICBzY2hlZHVsZUF0Q29sLFxuICAgIHNjaGVkdWxlXG4gIH07XG59XG5cbi8vIHNyYy9saWIvcXVlcnkudHNcbnZhciBRdWVyeUJyYW5kID0gU3ltYm9sKFwiUXVlcnlCcmFuZFwiKTtcbnZhciBpc1Jvd1R5cGVkUXVlcnkgPSAodmFsKSA9PiAhIXZhbCAmJiB0eXBlb2YgdmFsID09PSBcIm9iamVjdFwiICYmIFF1ZXJ5QnJhbmQgaW4gdmFsO1xudmFyIGlzVHlwZWRRdWVyeSA9ICh2YWwpID0+ICEhdmFsICYmIHR5cGVvZiB2YWwgPT09IFwib2JqZWN0XCIgJiYgUXVlcnlCcmFuZCBpbiB2YWw7XG5mdW5jdGlvbiB0b1NxbChxKSB7XG4gIHJldHVybiBxLnRvU3FsKCk7XG59XG52YXIgU2VtaWpvaW5JbXBsID0gY2xhc3MgX1NlbWlqb2luSW1wbCB7XG4gIGNvbnN0cnVjdG9yKHNvdXJjZVF1ZXJ5LCBmaWx0ZXJRdWVyeSwgam9pbkNvbmRpdGlvbikge1xuICAgIHRoaXMuc291cmNlUXVlcnkgPSBzb3VyY2VRdWVyeTtcbiAgICB0aGlzLmZpbHRlclF1ZXJ5ID0gZmlsdGVyUXVlcnk7XG4gICAgdGhpcy5qb2luQ29uZGl0aW9uID0gam9pbkNvbmRpdGlvbjtcbiAgICBpZiAoc291cmNlUXVlcnkudGFibGUuc291cmNlTmFtZSA9PT0gZmlsdGVyUXVlcnkudGFibGUuc291cmNlTmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IHNlbWlqb2luIGEgdGFibGUgdG8gaXRzZWxmXCIpO1xuICAgIH1cbiAgfVxuICBbUXVlcnlCcmFuZF0gPSB0cnVlO1xuICB0eXBlID0gXCJzZW1pam9pblwiO1xuICBidWlsZCgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICB3aGVyZShwcmVkaWNhdGUpIHtcbiAgICBjb25zdCBuZXh0U291cmNlUXVlcnkgPSB0aGlzLnNvdXJjZVF1ZXJ5LndoZXJlKHByZWRpY2F0ZSk7XG4gICAgcmV0dXJuIG5ldyBfU2VtaWpvaW5JbXBsKFxuICAgICAgbmV4dFNvdXJjZVF1ZXJ5LFxuICAgICAgdGhpcy5maWx0ZXJRdWVyeSxcbiAgICAgIHRoaXMuam9pbkNvbmRpdGlvblxuICAgICk7XG4gIH1cbiAgdG9TcWwoKSB7XG4gICAgY29uc3QgbGVmdCA9IHRoaXMuZmlsdGVyUXVlcnk7XG4gICAgY29uc3QgcmlnaHQgPSB0aGlzLnNvdXJjZVF1ZXJ5O1xuICAgIGNvbnN0IGxlZnRUYWJsZSA9IHF1b3RlSWRlbnRpZmllcihsZWZ0LnRhYmxlLnNvdXJjZU5hbWUpO1xuICAgIGNvbnN0IHJpZ2h0VGFibGUgPSBxdW90ZUlkZW50aWZpZXIocmlnaHQudGFibGUuc291cmNlTmFtZSk7XG4gICAgbGV0IHNxbCA9IGBTRUxFQ1QgJHtyaWdodFRhYmxlfS4qIEZST00gJHtsZWZ0VGFibGV9IEpPSU4gJHtyaWdodFRhYmxlfSBPTiAke2Jvb2xlYW5FeHByVG9TcWwodGhpcy5qb2luQ29uZGl0aW9uKX1gO1xuICAgIGNvbnN0IGNsYXVzZXMgPSBbXTtcbiAgICBpZiAobGVmdC53aGVyZUNsYXVzZSkge1xuICAgICAgY2xhdXNlcy5wdXNoKGJvb2xlYW5FeHByVG9TcWwobGVmdC53aGVyZUNsYXVzZSkpO1xuICAgIH1cbiAgICBpZiAocmlnaHQud2hlcmVDbGF1c2UpIHtcbiAgICAgIGNsYXVzZXMucHVzaChib29sZWFuRXhwclRvU3FsKHJpZ2h0LndoZXJlQ2xhdXNlKSk7XG4gICAgfVxuICAgIGlmIChjbGF1c2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHdoZXJlU3FsID0gY2xhdXNlcy5sZW5ndGggPT09IDEgPyBjbGF1c2VzWzBdIDogY2xhdXNlcy5tYXAod3JhcEluUGFyZW5zKS5qb2luKFwiIEFORCBcIik7XG4gICAgICBzcWwgKz0gYCBXSEVSRSAke3doZXJlU3FsfWA7XG4gICAgfVxuICAgIHJldHVybiBzcWw7XG4gIH1cbn07XG52YXIgRnJvbUJ1aWxkZXIgPSBjbGFzcyBfRnJvbUJ1aWxkZXIge1xuICBjb25zdHJ1Y3Rvcih0YWJsZTIsIHdoZXJlQ2xhdXNlKSB7XG4gICAgdGhpcy50YWJsZSA9IHRhYmxlMjtcbiAgICB0aGlzLndoZXJlQ2xhdXNlID0gd2hlcmVDbGF1c2U7XG4gIH1cbiAgW1F1ZXJ5QnJhbmRdID0gdHJ1ZTtcbiAgd2hlcmUocHJlZGljYXRlKSB7XG4gICAgY29uc3QgbmV3Q29uZGl0aW9uID0gbm9ybWFsaXplUHJlZGljYXRlRXhwcihwcmVkaWNhdGUodGhpcy50YWJsZS5jb2xzKSk7XG4gICAgY29uc3QgbmV4dFdoZXJlID0gdGhpcy53aGVyZUNsYXVzZSA/IHRoaXMud2hlcmVDbGF1c2UuYW5kKG5ld0NvbmRpdGlvbikgOiBuZXdDb25kaXRpb247XG4gICAgcmV0dXJuIG5ldyBfRnJvbUJ1aWxkZXIodGhpcy50YWJsZSwgbmV4dFdoZXJlKTtcbiAgfVxuICByaWdodFNlbWlqb2luKHJpZ2h0LCBvbikge1xuICAgIGNvbnN0IHNvdXJjZVF1ZXJ5ID0gbmV3IF9Gcm9tQnVpbGRlcihyaWdodCk7XG4gICAgY29uc3Qgam9pbkNvbmRpdGlvbiA9IG9uKFxuICAgICAgdGhpcy50YWJsZS5pbmRleGVkQ29scyxcbiAgICAgIHJpZ2h0LmluZGV4ZWRDb2xzXG4gICAgKTtcbiAgICByZXR1cm4gbmV3IFNlbWlqb2luSW1wbChzb3VyY2VRdWVyeSwgdGhpcywgam9pbkNvbmRpdGlvbik7XG4gIH1cbiAgbGVmdFNlbWlqb2luKHJpZ2h0LCBvbikge1xuICAgIGNvbnN0IGZpbHRlclF1ZXJ5ID0gbmV3IF9Gcm9tQnVpbGRlcihyaWdodCk7XG4gICAgY29uc3Qgam9pbkNvbmRpdGlvbiA9IG9uKFxuICAgICAgdGhpcy50YWJsZS5pbmRleGVkQ29scyxcbiAgICAgIHJpZ2h0LmluZGV4ZWRDb2xzXG4gICAgKTtcbiAgICByZXR1cm4gbmV3IFNlbWlqb2luSW1wbCh0aGlzLCBmaWx0ZXJRdWVyeSwgam9pbkNvbmRpdGlvbik7XG4gIH1cbiAgdG9TcWwoKSB7XG4gICAgcmV0dXJuIHJlbmRlclNlbGVjdFNxbFdpdGhKb2lucyh0aGlzLnRhYmxlLCB0aGlzLndoZXJlQ2xhdXNlKTtcbiAgfVxuICBidWlsZCgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxufTtcbnZhciBUYWJsZVJlZkltcGwgPSBjbGFzcyB7XG4gIFtRdWVyeUJyYW5kXSA9IHRydWU7XG4gIHR5cGUgPSBcInRhYmxlXCI7XG4gIHNvdXJjZU5hbWU7XG4gIGFjY2Vzc29yTmFtZTtcbiAgY29scztcbiAgaW5kZXhlZENvbHM7XG4gIHRhYmxlRGVmO1xuICAvLyBEZWxlZ2F0ZSBVbnR5cGVkVGFibGVEZWYgcHJvcGVydGllcyBmcm9tIHRhYmxlRGVmIHNvIHRoaXMgY2FuIGJlIHVzZWQgYXMgYSB0YWJsZSBkZWYuXG4gIGdldCBjb2x1bW5zKCkge1xuICAgIHJldHVybiB0aGlzLnRhYmxlRGVmLmNvbHVtbnM7XG4gIH1cbiAgZ2V0IGluZGV4ZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVEZWYuaW5kZXhlcztcbiAgfVxuICBnZXQgcm93VHlwZSgpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZURlZi5yb3dUeXBlO1xuICB9XG4gIGdldCBjb25zdHJhaW50cygpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZURlZi5jb25zdHJhaW50cztcbiAgfVxuICBjb25zdHJ1Y3Rvcih0YWJsZURlZikge1xuICAgIHRoaXMuc291cmNlTmFtZSA9IHRhYmxlRGVmLnNvdXJjZU5hbWU7XG4gICAgdGhpcy5hY2Nlc3Nvck5hbWUgPSB0YWJsZURlZi5hY2Nlc3Nvck5hbWU7XG4gICAgdGhpcy5jb2xzID0gY3JlYXRlUm93RXhwcih0YWJsZURlZik7XG4gICAgdGhpcy5pbmRleGVkQ29scyA9IHRoaXMuY29scztcbiAgICB0aGlzLnRhYmxlRGVmID0gdGFibGVEZWY7XG4gICAgT2JqZWN0LmZyZWV6ZSh0aGlzKTtcbiAgfVxuICBhc0Zyb20oKSB7XG4gICAgcmV0dXJuIG5ldyBGcm9tQnVpbGRlcih0aGlzKTtcbiAgfVxuICByaWdodFNlbWlqb2luKG90aGVyLCBvbikge1xuICAgIHJldHVybiB0aGlzLmFzRnJvbSgpLnJpZ2h0U2VtaWpvaW4ob3RoZXIsIG9uKTtcbiAgfVxuICBsZWZ0U2VtaWpvaW4ob3RoZXIsIG9uKSB7XG4gICAgcmV0dXJuIHRoaXMuYXNGcm9tKCkubGVmdFNlbWlqb2luKG90aGVyLCBvbik7XG4gIH1cbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXMuYXNGcm9tKCkuYnVpbGQoKTtcbiAgfVxuICB0b1NxbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hc0Zyb20oKS50b1NxbCgpO1xuICB9XG4gIHdoZXJlKHByZWRpY2F0ZSkge1xuICAgIHJldHVybiB0aGlzLmFzRnJvbSgpLndoZXJlKHByZWRpY2F0ZSk7XG4gIH1cbn07XG5mdW5jdGlvbiBjcmVhdGVUYWJsZVJlZkZyb21EZWYodGFibGVEZWYpIHtcbiAgcmV0dXJuIG5ldyBUYWJsZVJlZkltcGwodGFibGVEZWYpO1xufVxuZnVuY3Rpb24gbWFrZVF1ZXJ5QnVpbGRlcihzY2hlbWEyKSB7XG4gIGNvbnN0IHFiID0gLyogQF9fUFVSRV9fICovIE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIGZvciAoY29uc3QgdGFibGUyIG9mIE9iamVjdC52YWx1ZXMoc2NoZW1hMi50YWJsZXMpKSB7XG4gICAgY29uc3QgcmVmID0gY3JlYXRlVGFibGVSZWZGcm9tRGVmKFxuICAgICAgdGFibGUyXG4gICAgKTtcbiAgICBxYlt0YWJsZTIuYWNjZXNzb3JOYW1lXSA9IHJlZjtcbiAgfVxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShxYik7XG59XG5mdW5jdGlvbiBtYWtlRnJvbUJ1aWxkZXIodGFibGVzKSB7XG4gIGNvbnN0IHJlc3VsdCA9IC8qIEBfX1BVUkVfXyAqLyBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBjb25zdCBuYW1lc3BhY2VzID0gLyogQF9fUFVSRV9fICovIE9iamVjdC5jcmVhdGUoXG4gICAgbnVsbFxuICApO1xuICBmb3IgKGNvbnN0IHRhYmxlMiBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICBjb25zdCBkb3RJZHggPSB0YWJsZTIuc291cmNlTmFtZS5pbmRleE9mKFwiLlwiKTtcbiAgICBpZiAoZG90SWR4ID09PSAtMSkge1xuICAgICAgcmVzdWx0W3RhYmxlMi5hY2Nlc3Nvck5hbWVdID0gY3JlYXRlVGFibGVSZWZGcm9tRGVmKHRhYmxlMik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5zID0gdGFibGUyLnNvdXJjZU5hbWUuc2xpY2UoMCwgZG90SWR4KTtcbiAgICAgIGNvbnN0IGtleSA9IHRhYmxlMi5zb3VyY2VOYW1lLnNsaWNlKGRvdElkeCArIDEpO1xuICAgICAgKG5hbWVzcGFjZXNbbnNdID8/PSAvKiBAX19QVVJFX18gKi8gT2JqZWN0LmNyZWF0ZShudWxsKSlba2V5XSA9IGNyZWF0ZVRhYmxlUmVmRnJvbURlZihcbiAgICAgICAgdGFibGUyXG4gICAgICApO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IFtucywgbnNUYWJsZXNdIG9mIE9iamVjdC5lbnRyaWVzKG5hbWVzcGFjZXMpKSB7XG4gICAgcmVzdWx0W25zXSA9IE9iamVjdC5mcmVlemUobnNUYWJsZXMpO1xuICB9XG4gIHJldHVybiBPYmplY3QuZnJlZXplKHJlc3VsdCk7XG59XG5mdW5jdGlvbiBjcmVhdGVSb3dFeHByKHRhYmxlRGVmKSB7XG4gIGNvbnN0IHJvdyA9IHt9O1xuICBmb3IgKGNvbnN0IGNvbHVtbk5hbWUgb2YgT2JqZWN0LmtleXModGFibGVEZWYuY29sdW1ucykpIHtcbiAgICBjb25zdCBjb2x1bW5CdWlsZGVyID0gdGFibGVEZWYuY29sdW1uc1tjb2x1bW5OYW1lXTtcbiAgICBjb25zdCBjb2x1bW4gPSBuZXcgQ29sdW1uRXhwcmVzc2lvbihcbiAgICAgIHRhYmxlRGVmLnNvdXJjZU5hbWUsXG4gICAgICBjb2x1bW5OYW1lLFxuICAgICAgY29sdW1uQnVpbGRlci50eXBlQnVpbGRlci5hbGdlYnJhaWNUeXBlLFxuICAgICAgY29sdW1uQnVpbGRlci5jb2x1bW5NZXRhZGF0YS5uYW1lXG4gICAgKTtcbiAgICByb3dbY29sdW1uTmFtZV0gPSBPYmplY3QuZnJlZXplKGNvbHVtbik7XG4gIH1cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUocm93KTtcbn1cbmZ1bmN0aW9uIHJlbmRlclNlbGVjdFNxbFdpdGhKb2lucyh0YWJsZTIsIHdoZXJlLCBleHRyYUNsYXVzZXMgPSBbXSkge1xuICBjb25zdCBxdW90ZWRUYWJsZSA9IHF1b3RlSWRlbnRpZmllcih0YWJsZTIuc291cmNlTmFtZSk7XG4gIGNvbnN0IHNxbCA9IGBTRUxFQ1QgKiBGUk9NICR7cXVvdGVkVGFibGV9YDtcbiAgY29uc3QgY2xhdXNlcyA9IFtdO1xuICBpZiAod2hlcmUpIGNsYXVzZXMucHVzaChib29sZWFuRXhwclRvU3FsKHdoZXJlKSk7XG4gIGNsYXVzZXMucHVzaCguLi5leHRyYUNsYXVzZXMpO1xuICBpZiAoY2xhdXNlcy5sZW5ndGggPT09IDApIHJldHVybiBzcWw7XG4gIGNvbnN0IHdoZXJlU3FsID0gY2xhdXNlcy5sZW5ndGggPT09IDEgPyBjbGF1c2VzWzBdIDogY2xhdXNlcy5tYXAod3JhcEluUGFyZW5zKS5qb2luKFwiIEFORCBcIik7XG4gIHJldHVybiBgJHtzcWx9IFdIRVJFICR7d2hlcmVTcWx9YDtcbn1cbnZhciBDb2x1bW5FeHByZXNzaW9uID0gY2xhc3Mge1xuICB0eXBlID0gXCJjb2x1bW5cIjtcbiAgLy8gVGhpcyBpcyB0aGUgY29sdW1uIGFjY2Vzc29yXG4gIGNvbHVtbjtcbiAgLy8gVGhlIG5hbWUgb2YgdGhlIGNvbHVtbiBpbiB0aGUgZGF0YWJhc2UuXG4gIGNvbHVtbk5hbWU7XG4gIHRhYmxlO1xuICAvLyBwaGFudG9tOiBhY3R1YWwgcnVudGltZSB2YWx1ZSBpcyB1bmRlZmluZWRcbiAgdHNWYWx1ZVR5cGU7XG4gIHNwYWNldGltZVR5cGU7XG4gIGNvbnN0cnVjdG9yKHRhYmxlMiwgY29sdW1uLCBzcGFjZXRpbWVUeXBlLCBjb2x1bW5OYW1lKSB7XG4gICAgdGhpcy50YWJsZSA9IHRhYmxlMjtcbiAgICB0aGlzLmNvbHVtbiA9IGNvbHVtbjtcbiAgICB0aGlzLmNvbHVtbk5hbWUgPSBjb2x1bW5OYW1lIHx8IGNvbHVtbjtcbiAgICB0aGlzLnNwYWNldGltZVR5cGUgPSBzcGFjZXRpbWVUeXBlO1xuICB9XG4gIGVxKHgpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICAgIHR5cGU6IFwiZXFcIixcbiAgICAgIGxlZnQ6IHRoaXMsXG4gICAgICByaWdodDogbm9ybWFsaXplVmFsdWUoeClcbiAgICB9KTtcbiAgfVxuICBuZSh4KSB7XG4gICAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7XG4gICAgICB0eXBlOiBcIm5lXCIsXG4gICAgICBsZWZ0OiB0aGlzLFxuICAgICAgcmlnaHQ6IG5vcm1hbGl6ZVZhbHVlKHgpXG4gICAgfSk7XG4gIH1cbiAgbHQoeCkge1xuICAgIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJsdFwiLFxuICAgICAgbGVmdDogdGhpcyxcbiAgICAgIHJpZ2h0OiBub3JtYWxpemVWYWx1ZSh4KVxuICAgIH0pO1xuICB9XG4gIGx0ZSh4KSB7XG4gICAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7XG4gICAgICB0eXBlOiBcImx0ZVwiLFxuICAgICAgbGVmdDogdGhpcyxcbiAgICAgIHJpZ2h0OiBub3JtYWxpemVWYWx1ZSh4KVxuICAgIH0pO1xuICB9XG4gIGd0KHgpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICAgIHR5cGU6IFwiZ3RcIixcbiAgICAgIGxlZnQ6IHRoaXMsXG4gICAgICByaWdodDogbm9ybWFsaXplVmFsdWUoeClcbiAgICB9KTtcbiAgfVxuICBndGUoeCkge1xuICAgIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJndGVcIixcbiAgICAgIGxlZnQ6IHRoaXMsXG4gICAgICByaWdodDogbm9ybWFsaXplVmFsdWUoeClcbiAgICB9KTtcbiAgfVxufTtcbmZ1bmN0aW9uIGxpdGVyYWwodmFsdWUpIHtcbiAgcmV0dXJuIHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlIH07XG59XG5mdW5jdGlvbiBub3JtYWxpemVWYWx1ZSh2YWwpIHtcbiAgaWYgKHZhbC50eXBlID09PSBcImxpdGVyYWxcIilcbiAgICByZXR1cm4gdmFsO1xuICBpZiAodHlwZW9mIHZhbCA9PT0gXCJvYmplY3RcIiAmJiB2YWwgIT0gbnVsbCAmJiBcInR5cGVcIiBpbiB2YWwgJiYgdmFsLnR5cGUgPT09IFwiY29sdW1uXCIpIHtcbiAgICByZXR1cm4gdmFsO1xuICB9XG4gIHJldHVybiBsaXRlcmFsKHZhbCk7XG59XG5mdW5jdGlvbiBub3JtYWxpemVQcmVkaWNhdGVFeHByKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJvb2xlYW5FeHByKSByZXR1cm4gdmFsdWU7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7XG4gICAgICB0eXBlOiBcImVxXCIsXG4gICAgICBsZWZ0OiBsaXRlcmFsKHZhbHVlKSxcbiAgICAgIHJpZ2h0OiBsaXRlcmFsKHRydWUpXG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7XG4gICAgdHlwZTogXCJlcVwiLFxuICAgIGxlZnQ6IHZhbHVlLFxuICAgIHJpZ2h0OiBsaXRlcmFsKHRydWUpXG4gIH0pO1xufVxudmFyIEJvb2xlYW5FeHByID0gY2xhc3MgX0Jvb2xlYW5FeHByIHtcbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gIH1cbiAgYW5kKG90aGVyKSB7XG4gICAgcmV0dXJuIG5ldyBfQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJhbmRcIixcbiAgICAgIGNsYXVzZXM6IFt0aGlzLmRhdGEsIG90aGVyLmRhdGFdXG4gICAgfSk7XG4gIH1cbiAgb3Iob3RoZXIpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sZWFuRXhwcih7XG4gICAgICB0eXBlOiBcIm9yXCIsXG4gICAgICBjbGF1c2VzOiBbdGhpcy5kYXRhLCBvdGhlci5kYXRhXVxuICAgIH0pO1xuICB9XG4gIG5vdCgpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sZWFuRXhwcih7IHR5cGU6IFwibm90XCIsIGNsYXVzZTogdGhpcy5kYXRhIH0pO1xuICB9XG59O1xuZnVuY3Rpb24gbm90KGNsYXVzZSkge1xuICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHsgdHlwZTogXCJub3RcIiwgY2xhdXNlOiBjbGF1c2UuZGF0YSB9KTtcbn1cbmZ1bmN0aW9uIGFuZChmaXJzdCwgc2Vjb25kLCAuLi5yZXN0KSB7XG4gIGNvbnN0IGNsYXVzZXMgPSBbZmlyc3QsIHNlY29uZCwgLi4ucmVzdF07XG4gIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgIHR5cGU6IFwiYW5kXCIsXG4gICAgY2xhdXNlczogY2xhdXNlcy5tYXAoKGMpID0+IGMuZGF0YSlcbiAgfSk7XG59XG5mdW5jdGlvbiBvcihmaXJzdCwgc2Vjb25kLCAuLi5yZXN0KSB7XG4gIGNvbnN0IGNsYXVzZXMgPSBbZmlyc3QsIHNlY29uZCwgLi4ucmVzdF07XG4gIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgIHR5cGU6IFwib3JcIixcbiAgICBjbGF1c2VzOiBjbGF1c2VzLm1hcCgoYykgPT4gYy5kYXRhKVxuICB9KTtcbn1cbmZ1bmN0aW9uIGJvb2xlYW5FeHByVG9TcWwoZXhwciwgdGFibGVBbGlhcykge1xuICBjb25zdCBkYXRhID0gZXhwciBpbnN0YW5jZW9mIEJvb2xlYW5FeHByID8gZXhwci5kYXRhIDogZXhwcjtcbiAgc3dpdGNoIChkYXRhLnR5cGUpIHtcbiAgICBjYXNlIFwiZXFcIjpcbiAgICAgIHJldHVybiBgJHt2YWx1ZUV4cHJUb1NxbChkYXRhLmxlZnQpfSA9ICR7dmFsdWVFeHByVG9TcWwoZGF0YS5yaWdodCl9YDtcbiAgICBjYXNlIFwibmVcIjpcbiAgICAgIHJldHVybiBgJHt2YWx1ZUV4cHJUb1NxbChkYXRhLmxlZnQpfSA8PiAke3ZhbHVlRXhwclRvU3FsKGRhdGEucmlnaHQpfWA7XG4gICAgY2FzZSBcImd0XCI6XG4gICAgICByZXR1cm4gYCR7dmFsdWVFeHByVG9TcWwoZGF0YS5sZWZ0KX0gPiAke3ZhbHVlRXhwclRvU3FsKGRhdGEucmlnaHQpfWA7XG4gICAgY2FzZSBcImd0ZVwiOlxuICAgICAgcmV0dXJuIGAke3ZhbHVlRXhwclRvU3FsKGRhdGEubGVmdCl9ID49ICR7dmFsdWVFeHByVG9TcWwoZGF0YS5yaWdodCl9YDtcbiAgICBjYXNlIFwibHRcIjpcbiAgICAgIHJldHVybiBgJHt2YWx1ZUV4cHJUb1NxbChkYXRhLmxlZnQpfSA8ICR7dmFsdWVFeHByVG9TcWwoZGF0YS5yaWdodCl9YDtcbiAgICBjYXNlIFwibHRlXCI6XG4gICAgICByZXR1cm4gYCR7dmFsdWVFeHByVG9TcWwoZGF0YS5sZWZ0KX0gPD0gJHt2YWx1ZUV4cHJUb1NxbChkYXRhLnJpZ2h0KX1gO1xuICAgIGNhc2UgXCJhbmRcIjpcbiAgICAgIHJldHVybiBkYXRhLmNsYXVzZXMubWFwKChjKSA9PiBib29sZWFuRXhwclRvU3FsKGMpKS5tYXAod3JhcEluUGFyZW5zKS5qb2luKFwiIEFORCBcIik7XG4gICAgY2FzZSBcIm9yXCI6XG4gICAgICByZXR1cm4gZGF0YS5jbGF1c2VzLm1hcCgoYykgPT4gYm9vbGVhbkV4cHJUb1NxbChjKSkubWFwKHdyYXBJblBhcmVucykuam9pbihcIiBPUiBcIik7XG4gICAgY2FzZSBcIm5vdFwiOlxuICAgICAgcmV0dXJuIGBOT1QgJHt3cmFwSW5QYXJlbnMoYm9vbGVhbkV4cHJUb1NxbChkYXRhLmNsYXVzZSkpfWA7XG4gIH1cbn1cbmZ1bmN0aW9uIHdyYXBJblBhcmVucyhzcWwpIHtcbiAgcmV0dXJuIGAoJHtzcWx9KWA7XG59XG5mdW5jdGlvbiB2YWx1ZUV4cHJUb1NxbChleHByLCB0YWJsZUFsaWFzKSB7XG4gIGlmIChpc0xpdGVyYWxFeHByKGV4cHIpKSB7XG4gICAgcmV0dXJuIGxpdGVyYWxWYWx1ZVRvU3FsKGV4cHIudmFsdWUpO1xuICB9XG4gIGNvbnN0IHRhYmxlMiA9IGV4cHIudGFibGU7XG4gIHJldHVybiBgJHtxdW90ZUlkZW50aWZpZXIodGFibGUyKX0uJHtxdW90ZUlkZW50aWZpZXIoZXhwci5jb2x1bW5OYW1lKX1gO1xufVxuZnVuY3Rpb24gbGl0ZXJhbFZhbHVlVG9TcWwodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB2b2lkIDApIHtcbiAgICByZXR1cm4gXCJOVUxMXCI7XG4gIH1cbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSWRlbnRpdHkgfHwgdmFsdWUgaW5zdGFuY2VvZiBDb25uZWN0aW9uSWQgfHwgdmFsdWUgaW5zdGFuY2VvZiBVdWlkKSB7XG4gICAgcmV0dXJuIGAweCR7dmFsdWUudG9IZXhTdHJpbmcoKX1gO1xuICB9XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFRpbWVzdGFtcCkge1xuICAgIHJldHVybiBgJyR7dmFsdWUudG9JU09TdHJpbmcoKX0nYDtcbiAgfVxuICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xuICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICBjYXNlIFwiYmlnaW50XCI6XG4gICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgICBjYXNlIFwiYm9vbGVhblwiOlxuICAgICAgcmV0dXJuIHZhbHVlID8gXCJUUlVFXCIgOiBcIkZBTFNFXCI7XG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgcmV0dXJuIGAnJHt2YWx1ZS5yZXBsYWNlKC8nL2csIFwiJydcIil9J2A7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBgJyR7SlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoLycvZywgXCInJ1wiKX0nYDtcbiAgfVxufVxuZnVuY3Rpb24gcXVvdGVJZGVudGlmaWVyKG5hbWUpIHtcbiAgcmV0dXJuIG5hbWUuc3BsaXQoXCIuXCIpLm1hcCgocGFydCkgPT4gYFwiJHtwYXJ0LnJlcGxhY2UoL1wiL2csICdcIlwiJyl9XCJgKS5qb2luKFwiLlwiKTtcbn1cbmZ1bmN0aW9uIGlzTGl0ZXJhbEV4cHIoZXhwcikge1xuICByZXR1cm4gZXhwci50eXBlID09PSBcImxpdGVyYWxcIjtcbn1cbmZ1bmN0aW9uIGV2YWx1YXRlQm9vbGVhbkV4cHIoZXhwciwgcm93KSB7XG4gIHJldHVybiBldmFsdWF0ZURhdGEoZXhwci5kYXRhLCByb3cpO1xufVxuZnVuY3Rpb24gZXZhbHVhdGVEYXRhKGRhdGEsIHJvdykge1xuICBzd2l0Y2ggKGRhdGEudHlwZSkge1xuICAgIGNhc2UgXCJlcVwiOlxuICAgICAgcmV0dXJuIHJlc29sdmVWYWx1ZShkYXRhLmxlZnQsIHJvdykgPT09IHJlc29sdmVWYWx1ZShkYXRhLnJpZ2h0LCByb3cpO1xuICAgIGNhc2UgXCJuZVwiOlxuICAgICAgcmV0dXJuIHJlc29sdmVWYWx1ZShkYXRhLmxlZnQsIHJvdykgIT09IHJlc29sdmVWYWx1ZShkYXRhLnJpZ2h0LCByb3cpO1xuICAgIGNhc2UgXCJndFwiOlxuICAgICAgcmV0dXJuIHJlc29sdmVWYWx1ZShkYXRhLmxlZnQsIHJvdykgPiByZXNvbHZlVmFsdWUoZGF0YS5yaWdodCwgcm93KTtcbiAgICBjYXNlIFwiZ3RlXCI6XG4gICAgICByZXR1cm4gcmVzb2x2ZVZhbHVlKGRhdGEubGVmdCwgcm93KSA+PSByZXNvbHZlVmFsdWUoZGF0YS5yaWdodCwgcm93KTtcbiAgICBjYXNlIFwibHRcIjpcbiAgICAgIHJldHVybiByZXNvbHZlVmFsdWUoZGF0YS5sZWZ0LCByb3cpIDwgcmVzb2x2ZVZhbHVlKGRhdGEucmlnaHQsIHJvdyk7XG4gICAgY2FzZSBcImx0ZVwiOlxuICAgICAgcmV0dXJuIHJlc29sdmVWYWx1ZShkYXRhLmxlZnQsIHJvdykgPD0gcmVzb2x2ZVZhbHVlKGRhdGEucmlnaHQsIHJvdyk7XG4gICAgY2FzZSBcImFuZFwiOlxuICAgICAgcmV0dXJuIGRhdGEuY2xhdXNlcy5ldmVyeSgoYykgPT4gZXZhbHVhdGVEYXRhKGMsIHJvdykpO1xuICAgIGNhc2UgXCJvclwiOlxuICAgICAgcmV0dXJuIGRhdGEuY2xhdXNlcy5zb21lKChjKSA9PiBldmFsdWF0ZURhdGEoYywgcm93KSk7XG4gICAgY2FzZSBcIm5vdFwiOlxuICAgICAgcmV0dXJuICFldmFsdWF0ZURhdGEoZGF0YS5jbGF1c2UsIHJvdyk7XG4gIH1cbn1cbmZ1bmN0aW9uIHJlc29sdmVWYWx1ZShleHByLCByb3cpIHtcbiAgaWYgKGlzTGl0ZXJhbEV4cHIoZXhwcikpIHtcbiAgICByZXR1cm4gdG9Db21wYXJhYmxlVmFsdWUoZXhwci52YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHRvQ29tcGFyYWJsZVZhbHVlKHJvd1tleHByLmNvbHVtbl0pO1xufVxuZnVuY3Rpb24gaXNIZXhTZXJpYWxpemFibGVMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdmFsdWUudG9IZXhTdHJpbmcgPT09IFwiZnVuY3Rpb25cIjtcbn1cbmZ1bmN0aW9uIGlzVGltZXN0YW1wTGlrZSh2YWx1ZSkge1xuICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIikgcmV0dXJuIGZhbHNlO1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBUaW1lc3RhbXApIHJldHVybiB0cnVlO1xuICBjb25zdCBtaWNyb3MgPSB2YWx1ZVtcIl9fdGltZXN0YW1wX21pY3Jvc19zaW5jZV91bml4X2Vwb2NoX19cIl07XG4gIHJldHVybiB0eXBlb2YgbWljcm9zID09PSBcImJpZ2ludFwiO1xufVxuZnVuY3Rpb24gdG9Db21wYXJhYmxlVmFsdWUodmFsdWUpIHtcbiAgaWYgKGlzSGV4U2VyaWFsaXphYmxlTGlrZSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdmFsdWUudG9IZXhTdHJpbmcoKTtcbiAgfVxuICBpZiAoaXNUaW1lc3RhbXBMaWtlKHZhbHVlKSkge1xuICAgIHJldHVybiB2YWx1ZS5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGdldFF1ZXJ5VGFibGVOYW1lKHF1ZXJ5KSB7XG4gIGlmIChxdWVyeS50YWJsZSkgcmV0dXJuIHF1ZXJ5LnRhYmxlLm5hbWU7XG4gIGlmIChxdWVyeS5uYW1lKSByZXR1cm4gcXVlcnkubmFtZTtcbiAgaWYgKHF1ZXJ5LnNvdXJjZVF1ZXJ5KSByZXR1cm4gcXVlcnkuc291cmNlUXVlcnkudGFibGUubmFtZTtcbiAgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGV4dHJhY3QgdGFibGUgbmFtZSBmcm9tIHF1ZXJ5XCIpO1xufVxuZnVuY3Rpb24gZ2V0UXVlcnlBY2Nlc3Nvck5hbWUocXVlcnkpIHtcbiAgaWYgKHF1ZXJ5LnRhYmxlKSByZXR1cm4gcXVlcnkudGFibGUuYWNjZXNzb3JOYW1lO1xuICBpZiAocXVlcnkuYWNjZXNzb3JOYW1lKSByZXR1cm4gcXVlcnkuYWNjZXNzb3JOYW1lO1xuICBpZiAocXVlcnkuc291cmNlUXVlcnkpIHJldHVybiBxdWVyeS5zb3VyY2VRdWVyeS50YWJsZS5hY2Nlc3Nvck5hbWU7XG4gIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBleHRyYWN0IGFjY2Vzc29yIG5hbWUgZnJvbSBxdWVyeVwiKTtcbn1cbmZ1bmN0aW9uIGdldFF1ZXJ5V2hlcmVDbGF1c2UocXVlcnkpIHtcbiAgaWYgKHF1ZXJ5LndoZXJlQ2xhdXNlKSByZXR1cm4gcXVlcnkud2hlcmVDbGF1c2U7XG4gIHJldHVybiB2b2lkIDA7XG59XG5cbi8vIHNyYy9zZXJ2ZXIvdmlld3MudHNcbmZ1bmN0aW9uIG1ha2VWaWV3RXhwb3J0KGN0eCwgb3B0cywgcGFyYW1zLCByZXQsIGZuKSB7XG4gIGNvbnN0IHZpZXdFeHBvcnQgPSAoXG4gICAgLy8gQHRzLWV4cGVjdC1lcnJvciB0eXBlc2NyaXB0IGluY29ycmVjdGx5IHNheXMgRnVuY3Rpb24jYmluZCByZXF1aXJlcyBhbiBhcmd1bWVudC5cbiAgICBmbi5iaW5kKClcbiAgKTtcbiAgdmlld0V4cG9ydFtleHBvcnRDb250ZXh0XSA9IGN0eDtcbiAgdmlld0V4cG9ydFtyZWdpc3RlckV4cG9ydF0gPSAoY3R4MiwgZXhwb3J0TmFtZSkgPT4ge1xuICAgIHJlZ2lzdGVyVmlldyhjdHgyLCBvcHRzLCBleHBvcnROYW1lLCBwYXJhbXMsIHJldCwgZm4pO1xuICB9O1xuICByZXR1cm4gdmlld0V4cG9ydDtcbn1cbmZ1bmN0aW9uIG1ha2VBbm9uVmlld0V4cG9ydChjdHgsIG9wdHMsIHBhcmFtcywgcmV0LCBmbikge1xuICBjb25zdCB2aWV3RXhwb3J0ID0gKFxuICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgdHlwZXNjcmlwdCBpbmNvcnJlY3RseSBzYXlzIEZ1bmN0aW9uI2JpbmQgcmVxdWlyZXMgYW4gYXJndW1lbnQuXG4gICAgZm4uYmluZCgpXG4gICk7XG4gIHZpZXdFeHBvcnRbZXhwb3J0Q29udGV4dF0gPSBjdHg7XG4gIHZpZXdFeHBvcnRbcmVnaXN0ZXJFeHBvcnRdID0gKGN0eDIsIGV4cG9ydE5hbWUpID0+IHtcbiAgICByZWdpc3RlckFub255bW91c1ZpZXcoY3R4Miwgb3B0cywgZXhwb3J0TmFtZSwgcGFyYW1zLCByZXQsIGZuKTtcbiAgfTtcbiAgcmV0dXJuIHZpZXdFeHBvcnQ7XG59XG5mdW5jdGlvbiByZWdpc3RlclZpZXcoY3R4LCBvcHRzLCBleHBvcnROYW1lLCBwYXJhbXMsIHJldCwgZm4pIHtcbiAgY29uc3QgZGVzY3JpYmVkID0gZGVzY3JpYmVWaWV3KGN0eCwgb3B0cywgZXhwb3J0TmFtZSwgZmFsc2UsIHBhcmFtcywgcmV0KTtcbiAgY3R4LnZpZXdzLnB1c2goYnVpbGRWaWV3SW5mbyhjdHgsIGRlc2NyaWJlZCwgZm4pKTtcbn1cbmZ1bmN0aW9uIHJlZ2lzdGVyQW5vbnltb3VzVmlldyhjdHgsIG9wdHMsIGV4cG9ydE5hbWUsIHBhcmFtcywgcmV0LCBmbikge1xuICBjb25zdCBkZXNjcmliZWQgPSBkZXNjcmliZVZpZXcoY3R4LCBvcHRzLCBleHBvcnROYW1lLCB0cnVlLCBwYXJhbXMsIHJldCk7XG4gIGN0eC5hbm9uVmlld3MucHVzaChidWlsZFZpZXdJbmZvKGN0eCwgZGVzY3JpYmVkLCBmbikpO1xufVxuZnVuY3Rpb24gZGVzY3JpYmVWaWV3KGN0eCwgb3B0cywgZXhwb3J0TmFtZSwgYW5vbiwgcGFyYW1zLCByZXQpIHtcbiAgY3R4LmRlZmluZUZ1bmN0aW9uKGV4cG9ydE5hbWUpO1xuICBjb25zdCBwYXJhbXNCdWlsZGVyID0gbmV3IFJvd0J1aWxkZXIocGFyYW1zLCB0b1Bhc2NhbENhc2UoZXhwb3J0TmFtZSkpO1xuICBsZXQgcmV0dXJuVHlwZSA9IGN0eC5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkocmV0KS5hbGdlYnJhaWNUeXBlO1xuICBjb25zdCB7IHZhbHVlOiBwYXJhbVR5cGUgfSA9IGN0eC5yZXNvbHZlVHlwZShcbiAgICBjdHgucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHBhcmFtc0J1aWxkZXIpXG4gICk7XG4gIGN0eC5tb2R1bGVEZWYudmlld3MucHVzaCh7XG4gICAgc291cmNlTmFtZTogZXhwb3J0TmFtZSxcbiAgICBpbmRleDogKGFub24gPyBjdHguYW5vblZpZXdzIDogY3R4LnZpZXdzKS5sZW5ndGgsXG4gICAgaXNQdWJsaWM6IG9wdHMucHVibGljLFxuICAgIGlzQW5vbnltb3VzOiBhbm9uLFxuICAgIHBhcmFtczogcGFyYW1UeXBlLFxuICAgIHJldHVyblR5cGVcbiAgfSk7XG4gIGNvbnN0IHByaW1hcnlLZXlDb2x1bW5zID0gdmlld1ByaW1hcnlLZXlDb2x1bW5zKHJldCk7XG4gIGlmIChwcmltYXJ5S2V5Q29sdW1ucy5sZW5ndGggPiAxKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgIGBWaWV3ICcke2V4cG9ydE5hbWV9JyBjYW4gaGF2ZSBhdCBtb3N0IG9uZSBwcmltYXJ5S2V5KCkgY29sdW1uIG9uIGl0cyByZXR1cm5lZCByb3cgdHlwZTsgZm91bmQgJHtwcmltYXJ5S2V5Q29sdW1ucy5qb2luKFwiLCBcIil9YFxuICAgICk7XG4gIH1cbiAgaWYgKHByaW1hcnlLZXlDb2x1bW5zLmxlbmd0aCA9PT0gMSAmJiBwYXJhbVR5cGUuZWxlbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgY3R4Lm1vZHVsZURlZi52aWV3UHJpbWFyeUtleXMucHVzaCh7XG4gICAgICB2aWV3U291cmNlTmFtZTogZXhwb3J0TmFtZSxcbiAgICAgIGNvbHVtbnM6IHByaW1hcnlLZXlDb2x1bW5zXG4gICAgfSk7XG4gIH1cbiAgaWYgKG9wdHMubmFtZSAhPSBudWxsKSB7XG4gICAgY3R4Lm1vZHVsZURlZi5leHBsaWNpdE5hbWVzLmVudHJpZXMucHVzaCh7XG4gICAgICB0YWc6IFwiRnVuY3Rpb25cIixcbiAgICAgIHZhbHVlOiB7XG4gICAgICAgIHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgICAgIGNhbm9uaWNhbE5hbWU6IG9wdHMubmFtZVxuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIGNvbnN0IHdyYXBPcHRpb24gPSByZXR1cm5UeXBlLnRhZyA9PSBcIlN1bVwiO1xuICBpZiAocmV0dXJuVHlwZS50YWcgPT0gXCJTdW1cIikge1xuICAgIHJldHVyblR5cGUgPSBBbGdlYnJhaWNUeXBlLkFycmF5KFxuICAgICAgcmV0dXJuVHlwZS52YWx1ZS52YXJpYW50c1swXS5hbGdlYnJhaWNUeXBlXG4gICAgKTtcbiAgfVxuICByZXR1cm4geyBwYXJhbVR5cGUsIHJldHVyblR5cGUsIHdyYXBPcHRpb24gfTtcbn1cbmZ1bmN0aW9uIGJ1aWxkVmlld0luZm8oY3R4LCB7IHBhcmFtVHlwZSwgcmV0dXJuVHlwZSwgd3JhcE9wdGlvbiB9LCBmbikge1xuICBjb25zdCB7IHR5cGVzcGFjZSB9ID0gY3R4O1xuICByZXR1cm4ge1xuICAgIGZuOiB3cmFwT3B0aW9uID8gKCh2aWV3Q3R4LCBhcmdzKSA9PiB7XG4gICAgICBjb25zdCByZXQgPSBmbih2aWV3Q3R4LCBhcmdzKTtcbiAgICAgIHJldHVybiByZXQgPT0gbnVsbCA/IFtdIDogW3JldF07XG4gICAgfSkgOiBmbixcbiAgICBkZXNlcmlhbGl6ZVBhcmFtczogUHJvZHVjdFR5cGUubWFrZURlc2VyaWFsaXplcihwYXJhbVR5cGUsIHR5cGVzcGFjZSksXG4gICAgc2VyaWFsaXplUmV0dXJuOiBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKHJldHVyblR5cGUsIHR5cGVzcGFjZSksXG4gICAgcmV0dXJuVHlwZUJhc2VTaXplOiBic2F0bkJhc2VTaXplKHR5cGVzcGFjZSwgcmV0dXJuVHlwZSlcbiAgfTtcbn1cbmZ1bmN0aW9uIHZpZXdQcmltYXJ5S2V5Q29sdW1ucyhyZXQpIHtcbiAgY29uc3Qgcm93ID0gdmlld1JldHVyblJvdyhyZXQpO1xuICBpZiAocm93ID09IG51bGwpIHtcbiAgICByZXR1cm4gW107XG4gIH1cbiAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHJvdy5yb3cpLmZpbHRlcihcbiAgICAoZW50cnkpID0+IGVudHJ5WzFdLmNvbHVtbk1ldGFkYXRhLmlzUHJpbWFyeUtleSA9PT0gdHJ1ZVxuICApLm1hcCgoW25hbWVdKSA9PiBuYW1lKTtcbn1cbmZ1bmN0aW9uIHZpZXdSZXR1cm5Sb3cocmV0KSB7XG4gIGlmIChyZXQgaW5zdGFuY2VvZiBBcnJheUJ1aWxkZXIgJiYgcmV0LmVsZW1lbnQgaW5zdGFuY2VvZiBSb3dCdWlsZGVyKSB7XG4gICAgcmV0dXJuIHJldC5lbGVtZW50O1xuICB9XG4gIGlmIChyZXQgaW5zdGFuY2VvZiBPcHRpb25CdWlsZGVyICYmIHJldC52YWx1ZSBpbnN0YW5jZW9mIFJvd0J1aWxkZXIpIHtcbiAgICByZXR1cm4gcmV0LnZhbHVlO1xuICB9XG4gIHJldHVybiB2b2lkIDA7XG59XG5cbi8vIHNyYy9saWIvZXJyb3JzLnRzXG52YXIgU2VuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZSkge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICB9XG4gIGdldCBuYW1lKCkge1xuICAgIHJldHVybiBcIlNlbmRlckVycm9yXCI7XG4gIH1cbn07XG5cbi8vIHNyYy9zZXJ2ZXIvZXJyb3JzLnRzXG52YXIgU3BhY2V0aW1lSG9zdEVycm9yID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2UpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgfVxuICBnZXQgbmFtZSgpIHtcbiAgICByZXR1cm4gXCJTcGFjZXRpbWVIb3N0RXJyb3JcIjtcbiAgfVxufTtcbnZhciBlcnJvckRhdGEgPSB7XG4gIC8qKlxuICAgKiBBIGdlbmVyaWMgZXJyb3IgY2xhc3MgZm9yIHVua25vd24gZXJyb3IgY29kZXMuXG4gICAqL1xuICBIb3N0Q2FsbEZhaWx1cmU6IDEsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYW4gQUJJIGNhbGwgd2FzIG1hZGUgb3V0c2lkZSBvZiBhIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgTm90SW5UcmFuc2FjdGlvbjogMixcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBCU0FUTiBkZWNvZGluZyBmYWlsZWQuXG4gICAqIFRoaXMgdHlwaWNhbGx5IG1lYW5zIHRoYXQgdGhlIGRhdGEgY291bGQgbm90IGJlIGRlY29kZWQgdG8gdGhlIGV4cGVjdGVkIHR5cGUuXG4gICAqL1xuICBCc2F0bkRlY29kZUVycm9yOiAzLFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGEgc3BlY2lmaWVkIHRhYmxlIGRvZXMgbm90IGV4aXN0LlxuICAgKi9cbiAgTm9TdWNoVGFibGU6IDQsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYSBzcGVjaWZpZWQgaW5kZXggZG9lcyBub3QgZXhpc3QuXG4gICAqL1xuICBOb1N1Y2hJbmRleDogNSxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhIHNwZWNpZmllZCByb3cgaXRlcmF0b3IgaXMgbm90IHZhbGlkLlxuICAgKi9cbiAgTm9TdWNoSXRlcjogNixcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhIHNwZWNpZmllZCBjb25zb2xlIHRpbWVyIGRvZXMgbm90IGV4aXN0LlxuICAgKi9cbiAgTm9TdWNoQ29uc29sZVRpbWVyOiA3LFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGEgc3BlY2lmaWVkIGJ5dGVzIHNvdXJjZSBvciBzaW5rIGlzIG5vdCB2YWxpZC5cbiAgICovXG4gIE5vU3VjaEJ5dGVzOiA4LFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGEgcHJvdmlkZWQgc2luayBoYXMgbm8gbW9yZSBzcGFjZSBsZWZ0LlxuICAgKi9cbiAgTm9TcGFjZTogOSxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCB0aGVyZSBpcyBubyBtb3JlIHNwYWNlIGluIHRoZSBkYXRhYmFzZS5cbiAgICovXG4gIEJ1ZmZlclRvb1NtYWxsOiAxMSxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhIHZhbHVlIHdpdGggYSBnaXZlbiB1bmlxdWUgaWRlbnRpZmllciBhbHJlYWR5IGV4aXN0cy5cbiAgICovXG4gIFVuaXF1ZUFscmVhZHlFeGlzdHM6IDEyLFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IHRoZSBzcGVjaWZpZWQgZGVsYXkgaW4gc2NoZWR1bGluZyBhIHJvdyB3YXMgdG9vIGxvbmcuXG4gICAqL1xuICBTY2hlZHVsZUF0RGVsYXlUb29Mb25nOiAxMyxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhbiBpbmRleCB3YXMgbm90IHVuaXF1ZSB3aGVuIGl0IHdhcyBleHBlY3RlZCB0byBiZS5cbiAgICovXG4gIEluZGV4Tm90VW5pcXVlOiAxNCxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhbiBpbmRleCB3YXMgbm90IHVuaXF1ZSB3aGVuIGl0IHdhcyBleHBlY3RlZCB0byBiZS5cbiAgICovXG4gIE5vU3VjaFJvdzogMTUsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYW4gYXV0by1pbmNyZW1lbnQgc2VxdWVuY2UgaGFzIG92ZXJmbG93ZWQuXG4gICAqL1xuICBBdXRvSW5jT3ZlcmZsb3c6IDE2LFxuICBXb3VsZEJsb2NrVHJhbnNhY3Rpb246IDE3LFxuICBUcmFuc2FjdGlvbk5vdEFub255bW91czogMTgsXG4gIFRyYW5zYWN0aW9uSXNSZWFkT25seTogMTksXG4gIFRyYW5zYWN0aW9uSXNNdXQ6IDIwLFxuICBIdHRwRXJyb3I6IDIxXG59O1xuZnVuY3Rpb24gbWFwRW50cmllcyh4LCBmKSB7XG4gIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgT2JqZWN0LmVudHJpZXMoeCkubWFwKChbaywgdl0pID0+IFtrLCBmKGssIHYpXSlcbiAgKTtcbn1cbnZhciBlcnJub1RvQ2xhc3MgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xudmFyIGVycm9ycyA9IE9iamVjdC5mcmVlemUoXG4gIG1hcEVudHJpZXMoZXJyb3JEYXRhLCAobmFtZSwgY29kZSkgPT4ge1xuICAgIGNvbnN0IGNscyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShcbiAgICAgIGNsYXNzIGV4dGVuZHMgU3BhY2V0aW1lSG9zdEVycm9yIHtcbiAgICAgICAgZ2V0IG5hbWUoKSB7XG4gICAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBcIm5hbWVcIixcbiAgICAgIHsgdmFsdWU6IG5hbWUsIHdyaXRhYmxlOiBmYWxzZSB9XG4gICAgKTtcbiAgICBlcnJub1RvQ2xhc3Muc2V0KGNvZGUsIGNscyk7XG4gICAgcmV0dXJuIGNscztcbiAgfSlcbik7XG5mdW5jdGlvbiBnZXRFcnJvckNvbnN0cnVjdG9yKGNvZGUpIHtcbiAgcmV0dXJuIGVycm5vVG9DbGFzcy5nZXQoY29kZSkgPz8gU3BhY2V0aW1lSG9zdEVycm9yO1xufVxuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vcHVyZS1yYW5kQDcuMC4xL25vZGVfbW9kdWxlcy9wdXJlLXJhbmQvbGliL2VzbS9kaXN0cmlidXRpb24vVW5zYWZlVW5pZm9ybUJpZ0ludERpc3RyaWJ1dGlvbi5qc1xudmFyIFNCaWdJbnQgPSB0eXBlb2YgQmlnSW50ICE9PSBcInVuZGVmaW5lZFwiID8gQmlnSW50IDogdm9pZCAwO1xudmFyIE9uZSA9IHR5cGVvZiBCaWdJbnQgIT09IFwidW5kZWZpbmVkXCIgPyBCaWdJbnQoMSkgOiB2b2lkIDA7XG52YXIgVGhpcnR5VHdvID0gdHlwZW9mIEJpZ0ludCAhPT0gXCJ1bmRlZmluZWRcIiA/IEJpZ0ludCgzMikgOiB2b2lkIDA7XG52YXIgTnVtVmFsdWVzID0gdHlwZW9mIEJpZ0ludCAhPT0gXCJ1bmRlZmluZWRcIiA/IEJpZ0ludCg0Mjk0OTY3Mjk2KSA6IHZvaWQgMDtcbmZ1bmN0aW9uIHVuc2FmZVVuaWZvcm1CaWdJbnREaXN0cmlidXRpb24oZnJvbSwgdG8sIHJuZykge1xuICB2YXIgZGlmZiA9IHRvIC0gZnJvbSArIE9uZTtcbiAgdmFyIEZpbmFsTnVtVmFsdWVzID0gTnVtVmFsdWVzO1xuICB2YXIgTnVtSXRlcmF0aW9ucyA9IDE7XG4gIHdoaWxlIChGaW5hbE51bVZhbHVlcyA8IGRpZmYpIHtcbiAgICBGaW5hbE51bVZhbHVlcyA8PD0gVGhpcnR5VHdvO1xuICAgICsrTnVtSXRlcmF0aW9ucztcbiAgfVxuICB2YXIgdmFsdWUgPSBnZW5lcmF0ZU5leHQoTnVtSXRlcmF0aW9ucywgcm5nKTtcbiAgaWYgKHZhbHVlIDwgZGlmZikge1xuICAgIHJldHVybiB2YWx1ZSArIGZyb207XG4gIH1cbiAgaWYgKHZhbHVlICsgZGlmZiA8IEZpbmFsTnVtVmFsdWVzKSB7XG4gICAgcmV0dXJuIHZhbHVlICUgZGlmZiArIGZyb207XG4gIH1cbiAgdmFyIE1heEFjY2VwdGVkUmFuZG9tID0gRmluYWxOdW1WYWx1ZXMgLSBGaW5hbE51bVZhbHVlcyAlIGRpZmY7XG4gIHdoaWxlICh2YWx1ZSA+PSBNYXhBY2NlcHRlZFJhbmRvbSkge1xuICAgIHZhbHVlID0gZ2VuZXJhdGVOZXh0KE51bUl0ZXJhdGlvbnMsIHJuZyk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlICUgZGlmZiArIGZyb207XG59XG5mdW5jdGlvbiBnZW5lcmF0ZU5leHQoTnVtSXRlcmF0aW9ucywgcm5nKSB7XG4gIHZhciB2YWx1ZSA9IFNCaWdJbnQocm5nLnVuc2FmZU5leHQoKSArIDIxNDc0ODM2NDgpO1xuICBmb3IgKHZhciBudW0gPSAxOyBudW0gPCBOdW1JdGVyYXRpb25zOyArK251bSkge1xuICAgIHZhciBvdXQgPSBybmcudW5zYWZlTmV4dCgpO1xuICAgIHZhbHVlID0gKHZhbHVlIDw8IFRoaXJ0eVR3bykgKyBTQmlnSW50KG91dCArIDIxNDc0ODM2NDgpO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3B1cmUtcmFuZEA3LjAuMS9ub2RlX21vZHVsZXMvcHVyZS1yYW5kL2xpYi9lc20vZGlzdHJpYnV0aW9uL2ludGVybmFscy9VbnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uSW50ZXJuYWwuanNcbmZ1bmN0aW9uIHVuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb25JbnRlcm5hbChyYW5nZVNpemUsIHJuZykge1xuICB2YXIgTWF4QWxsb3dlZCA9IHJhbmdlU2l6ZSA+IDIgPyB+fig0Mjk0OTY3Mjk2IC8gcmFuZ2VTaXplKSAqIHJhbmdlU2l6ZSA6IDQyOTQ5NjcyOTY7XG4gIHZhciBkZWx0YVYgPSBybmcudW5zYWZlTmV4dCgpICsgMjE0NzQ4MzY0ODtcbiAgd2hpbGUgKGRlbHRhViA+PSBNYXhBbGxvd2VkKSB7XG4gICAgZGVsdGFWID0gcm5nLnVuc2FmZU5leHQoKSArIDIxNDc0ODM2NDg7XG4gIH1cbiAgcmV0dXJuIGRlbHRhViAlIHJhbmdlU2l6ZTtcbn1cblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3B1cmUtcmFuZEA3LjAuMS9ub2RlX21vZHVsZXMvcHVyZS1yYW5kL2xpYi9lc20vZGlzdHJpYnV0aW9uL2ludGVybmFscy9BcnJheUludDY0LmpzXG5mdW5jdGlvbiBmcm9tTnVtYmVyVG9BcnJheUludDY0KG91dCwgbikge1xuICBpZiAobiA8IDApIHtcbiAgICB2YXIgcG9zTiA9IC1uO1xuICAgIG91dC5zaWduID0gLTE7XG4gICAgb3V0LmRhdGFbMF0gPSB+fihwb3NOIC8gNDI5NDk2NzI5Nik7XG4gICAgb3V0LmRhdGFbMV0gPSBwb3NOID4+PiAwO1xuICB9IGVsc2Uge1xuICAgIG91dC5zaWduID0gMTtcbiAgICBvdXQuZGF0YVswXSA9IH5+KG4gLyA0Mjk0OTY3Mjk2KTtcbiAgICBvdXQuZGF0YVsxXSA9IG4gPj4+IDA7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cbmZ1bmN0aW9uIHN1YnN0cmFjdEFycmF5SW50NjQob3V0LCBhcnJheUludEEsIGFycmF5SW50Qikge1xuICB2YXIgbG93QSA9IGFycmF5SW50QS5kYXRhWzFdO1xuICB2YXIgaGlnaEEgPSBhcnJheUludEEuZGF0YVswXTtcbiAgdmFyIHNpZ25BID0gYXJyYXlJbnRBLnNpZ247XG4gIHZhciBsb3dCID0gYXJyYXlJbnRCLmRhdGFbMV07XG4gIHZhciBoaWdoQiA9IGFycmF5SW50Qi5kYXRhWzBdO1xuICB2YXIgc2lnbkIgPSBhcnJheUludEIuc2lnbjtcbiAgb3V0LnNpZ24gPSAxO1xuICBpZiAoc2lnbkEgPT09IDEgJiYgc2lnbkIgPT09IC0xKSB7XG4gICAgdmFyIGxvd18xID0gbG93QSArIGxvd0I7XG4gICAgdmFyIGhpZ2ggPSBoaWdoQSArIGhpZ2hCICsgKGxvd18xID4gNDI5NDk2NzI5NSA/IDEgOiAwKTtcbiAgICBvdXQuZGF0YVswXSA9IGhpZ2ggPj4+IDA7XG4gICAgb3V0LmRhdGFbMV0gPSBsb3dfMSA+Pj4gMDtcbiAgICByZXR1cm4gb3V0O1xuICB9XG4gIHZhciBsb3dGaXJzdCA9IGxvd0E7XG4gIHZhciBoaWdoRmlyc3QgPSBoaWdoQTtcbiAgdmFyIGxvd1NlY29uZCA9IGxvd0I7XG4gIHZhciBoaWdoU2Vjb25kID0gaGlnaEI7XG4gIGlmIChzaWduQSA9PT0gLTEpIHtcbiAgICBsb3dGaXJzdCA9IGxvd0I7XG4gICAgaGlnaEZpcnN0ID0gaGlnaEI7XG4gICAgbG93U2Vjb25kID0gbG93QTtcbiAgICBoaWdoU2Vjb25kID0gaGlnaEE7XG4gIH1cbiAgdmFyIHJlbWluZGVyTG93ID0gMDtcbiAgdmFyIGxvdyA9IGxvd0ZpcnN0IC0gbG93U2Vjb25kO1xuICBpZiAobG93IDwgMCkge1xuICAgIHJlbWluZGVyTG93ID0gMTtcbiAgICBsb3cgPSBsb3cgPj4+IDA7XG4gIH1cbiAgb3V0LmRhdGFbMF0gPSBoaWdoRmlyc3QgLSBoaWdoU2Vjb25kIC0gcmVtaW5kZXJMb3c7XG4gIG91dC5kYXRhWzFdID0gbG93O1xuICByZXR1cm4gb3V0O1xufVxuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vcHVyZS1yYW5kQDcuMC4xL25vZGVfbW9kdWxlcy9wdXJlLXJhbmQvbGliL2VzbS9kaXN0cmlidXRpb24vaW50ZXJuYWxzL1Vuc2FmZVVuaWZvcm1BcnJheUludERpc3RyaWJ1dGlvbkludGVybmFsLmpzXG5mdW5jdGlvbiB1bnNhZmVVbmlmb3JtQXJyYXlJbnREaXN0cmlidXRpb25JbnRlcm5hbChvdXQsIHJhbmdlU2l6ZSwgcm5nKSB7XG4gIHZhciByYW5nZUxlbmd0aCA9IHJhbmdlU2l6ZS5sZW5ndGg7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCAhPT0gcmFuZ2VMZW5ndGg7ICsraW5kZXgpIHtcbiAgICAgIHZhciBpbmRleFJhbmdlU2l6ZSA9IGluZGV4ID09PSAwID8gcmFuZ2VTaXplWzBdICsgMSA6IDQyOTQ5NjcyOTY7XG4gICAgICB2YXIgZyA9IHVuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb25JbnRlcm5hbChpbmRleFJhbmdlU2l6ZSwgcm5nKTtcbiAgICAgIG91dFtpbmRleF0gPSBnO1xuICAgIH1cbiAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4ICE9PSByYW5nZUxlbmd0aDsgKytpbmRleCkge1xuICAgICAgdmFyIGN1cnJlbnQgPSBvdXRbaW5kZXhdO1xuICAgICAgdmFyIGN1cnJlbnRJblJhbmdlID0gcmFuZ2VTaXplW2luZGV4XTtcbiAgICAgIGlmIChjdXJyZW50IDwgY3VycmVudEluUmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgIH0gZWxzZSBpZiAoY3VycmVudCA+IGN1cnJlbnRJblJhbmdlKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vcHVyZS1yYW5kQDcuMC4xL25vZGVfbW9kdWxlcy9wdXJlLXJhbmQvbGliL2VzbS9kaXN0cmlidXRpb24vVW5zYWZlVW5pZm9ybUludERpc3RyaWJ1dGlvbi5qc1xudmFyIHNhZmVOdW1iZXJNYXhTYWZlSW50ZWdlciA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xudmFyIHNoYXJlZEEgPSB7IHNpZ246IDEsIGRhdGE6IFswLCAwXSB9O1xudmFyIHNoYXJlZEIgPSB7IHNpZ246IDEsIGRhdGE6IFswLCAwXSB9O1xudmFyIHNoYXJlZEMgPSB7IHNpZ246IDEsIGRhdGE6IFswLCAwXSB9O1xudmFyIHNoYXJlZERhdGEgPSBbMCwgMF07XG5mdW5jdGlvbiB1bmlmb3JtTGFyZ2VJbnRJbnRlcm5hbChmcm9tLCB0bywgcmFuZ2VTaXplLCBybmcpIHtcbiAgdmFyIHJhbmdlU2l6ZUFycmF5SW50VmFsdWUgPSByYW5nZVNpemUgPD0gc2FmZU51bWJlck1heFNhZmVJbnRlZ2VyID8gZnJvbU51bWJlclRvQXJyYXlJbnQ2NChzaGFyZWRDLCByYW5nZVNpemUpIDogc3Vic3RyYWN0QXJyYXlJbnQ2NChzaGFyZWRDLCBmcm9tTnVtYmVyVG9BcnJheUludDY0KHNoYXJlZEEsIHRvKSwgZnJvbU51bWJlclRvQXJyYXlJbnQ2NChzaGFyZWRCLCBmcm9tKSk7XG4gIGlmIChyYW5nZVNpemVBcnJheUludFZhbHVlLmRhdGFbMV0gPT09IDQyOTQ5NjcyOTUpIHtcbiAgICByYW5nZVNpemVBcnJheUludFZhbHVlLmRhdGFbMF0gKz0gMTtcbiAgICByYW5nZVNpemVBcnJheUludFZhbHVlLmRhdGFbMV0gPSAwO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlU2l6ZUFycmF5SW50VmFsdWUuZGF0YVsxXSArPSAxO1xuICB9XG4gIHVuc2FmZVVuaWZvcm1BcnJheUludERpc3RyaWJ1dGlvbkludGVybmFsKHNoYXJlZERhdGEsIHJhbmdlU2l6ZUFycmF5SW50VmFsdWUuZGF0YSwgcm5nKTtcbiAgcmV0dXJuIHNoYXJlZERhdGFbMF0gKiA0Mjk0OTY3Mjk2ICsgc2hhcmVkRGF0YVsxXSArIGZyb207XG59XG5mdW5jdGlvbiB1bnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uKGZyb20sIHRvLCBybmcpIHtcbiAgdmFyIHJhbmdlU2l6ZSA9IHRvIC0gZnJvbTtcbiAgaWYgKHJhbmdlU2l6ZSA8PSA0Mjk0OTY3Mjk1KSB7XG4gICAgdmFyIGcgPSB1bnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uSW50ZXJuYWwocmFuZ2VTaXplICsgMSwgcm5nKTtcbiAgICByZXR1cm4gZyArIGZyb207XG4gIH1cbiAgcmV0dXJuIHVuaWZvcm1MYXJnZUludEludGVybmFsKGZyb20sIHRvLCByYW5nZVNpemUsIHJuZyk7XG59XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9wdXJlLXJhbmRANy4wLjEvbm9kZV9tb2R1bGVzL3B1cmUtcmFuZC9saWIvZXNtL2dlbmVyYXRvci9Yb3JvU2hpcm8uanNcbnZhciBYb3JvU2hpcm8xMjhQbHVzID0gKGZ1bmN0aW9uKCkge1xuICBmdW5jdGlvbiBYb3JvU2hpcm8xMjhQbHVzMihzMDEsIHMwMCwgczExLCBzMTApIHtcbiAgICB0aGlzLnMwMSA9IHMwMTtcbiAgICB0aGlzLnMwMCA9IHMwMDtcbiAgICB0aGlzLnMxMSA9IHMxMTtcbiAgICB0aGlzLnMxMCA9IHMxMDtcbiAgfVxuICBYb3JvU2hpcm8xMjhQbHVzMi5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFhvcm9TaGlybzEyOFBsdXMyKHRoaXMuczAxLCB0aGlzLnMwMCwgdGhpcy5zMTEsIHRoaXMuczEwKTtcbiAgfTtcbiAgWG9yb1NoaXJvMTI4UGx1czIucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbmV4dFJuZyA9IG5ldyBYb3JvU2hpcm8xMjhQbHVzMih0aGlzLnMwMSwgdGhpcy5zMDAsIHRoaXMuczExLCB0aGlzLnMxMCk7XG4gICAgdmFyIG91dCA9IG5leHRSbmcudW5zYWZlTmV4dCgpO1xuICAgIHJldHVybiBbb3V0LCBuZXh0Um5nXTtcbiAgfTtcbiAgWG9yb1NoaXJvMTI4UGx1czIucHJvdG90eXBlLnVuc2FmZU5leHQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgb3V0ID0gdGhpcy5zMDAgKyB0aGlzLnMxMCB8IDA7XG4gICAgdmFyIGEwID0gdGhpcy5zMTAgXiB0aGlzLnMwMDtcbiAgICB2YXIgYTEgPSB0aGlzLnMxMSBeIHRoaXMuczAxO1xuICAgIHZhciBzMDAgPSB0aGlzLnMwMDtcbiAgICB2YXIgczAxID0gdGhpcy5zMDE7XG4gICAgdGhpcy5zMDAgPSBzMDAgPDwgMjQgXiBzMDEgPj4+IDggXiBhMCBeIGEwIDw8IDE2O1xuICAgIHRoaXMuczAxID0gczAxIDw8IDI0IF4gczAwID4+PiA4IF4gYTEgXiAoYTEgPDwgMTYgfCBhMCA+Pj4gMTYpO1xuICAgIHRoaXMuczEwID0gYTEgPDwgNSBeIGEwID4+PiAyNztcbiAgICB0aGlzLnMxMSA9IGEwIDw8IDUgXiBhMSA+Pj4gMjc7XG4gICAgcmV0dXJuIG91dDtcbiAgfTtcbiAgWG9yb1NoaXJvMTI4UGx1czIucHJvdG90eXBlLmp1bXAgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbmV4dFJuZyA9IG5ldyBYb3JvU2hpcm8xMjhQbHVzMih0aGlzLnMwMSwgdGhpcy5zMDAsIHRoaXMuczExLCB0aGlzLnMxMCk7XG4gICAgbmV4dFJuZy51bnNhZmVKdW1wKCk7XG4gICAgcmV0dXJuIG5leHRSbmc7XG4gIH07XG4gIFhvcm9TaGlybzEyOFBsdXMyLnByb3RvdHlwZS51bnNhZmVKdW1wID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG5zMDEgPSAwO1xuICAgIHZhciBuczAwID0gMDtcbiAgICB2YXIgbnMxMSA9IDA7XG4gICAgdmFyIG5zMTAgPSAwO1xuICAgIHZhciBqdW1wID0gWzM2Mzk5NTY2NDUsIDM3NTA3NTcwMTIsIDEyNjE1Njg1MDgsIDM4NjQyNjMzNV07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgIT09IDQ7ICsraSkge1xuICAgICAgZm9yICh2YXIgbWFzayA9IDE7IG1hc2s7IG1hc2sgPDw9IDEpIHtcbiAgICAgICAgaWYgKGp1bXBbaV0gJiBtYXNrKSB7XG4gICAgICAgICAgbnMwMSBePSB0aGlzLnMwMTtcbiAgICAgICAgICBuczAwIF49IHRoaXMuczAwO1xuICAgICAgICAgIG5zMTEgXj0gdGhpcy5zMTE7XG4gICAgICAgICAgbnMxMCBePSB0aGlzLnMxMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVuc2FmZU5leHQoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5zMDEgPSBuczAxO1xuICAgIHRoaXMuczAwID0gbnMwMDtcbiAgICB0aGlzLnMxMSA9IG5zMTE7XG4gICAgdGhpcy5zMTAgPSBuczEwO1xuICB9O1xuICBYb3JvU2hpcm8xMjhQbHVzMi5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gW3RoaXMuczAxLCB0aGlzLnMwMCwgdGhpcy5zMTEsIHRoaXMuczEwXTtcbiAgfTtcbiAgcmV0dXJuIFhvcm9TaGlybzEyOFBsdXMyO1xufSkoKTtcbmZ1bmN0aW9uIGZyb21TdGF0ZShzdGF0ZSkge1xuICB2YXIgdmFsaWQgPSBzdGF0ZS5sZW5ndGggPT09IDQ7XG4gIGlmICghdmFsaWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgc3RhdGUgbXVzdCBoYXZlIGJlZW4gcHJvZHVjZWQgYnkgYSB4b3Jvc2hpcm8xMjhwbHVzIFJhbmRvbUdlbmVyYXRvclwiKTtcbiAgfVxuICByZXR1cm4gbmV3IFhvcm9TaGlybzEyOFBsdXMoc3RhdGVbMF0sIHN0YXRlWzFdLCBzdGF0ZVsyXSwgc3RhdGVbM10pO1xufVxudmFyIHhvcm9zaGlybzEyOHBsdXMgPSBPYmplY3QuYXNzaWduKGZ1bmN0aW9uKHNlZWQpIHtcbiAgcmV0dXJuIG5ldyBYb3JvU2hpcm8xMjhQbHVzKC0xLCB+c2VlZCwgc2VlZCB8IDAsIDApO1xufSwgeyBmcm9tU3RhdGUgfSk7XG5cbi8vIHNyYy9zZXJ2ZXIvcm5nLnRzXG52YXIgeyBhc1VpbnROIH0gPSBCaWdJbnQ7XG5mdW5jdGlvbiBwY2czMihzdGF0ZSkge1xuICBjb25zdCBNVUwgPSA2MzY0MTM2MjIzODQ2NzkzMDA1bjtcbiAgY29uc3QgSU5DID0gMTE2MzQ1ODAwMjc0NjIyNjA3MjNuO1xuICBzdGF0ZSA9IGFzVWludE4oNjQsIHN0YXRlICogTVVMICsgSU5DKTtcbiAgY29uc3QgeG9yc2hpZnRlZCA9IE51bWJlcihhc1VpbnROKDMyLCAoc3RhdGUgPj4gMThuIF4gc3RhdGUpID4+IDI3bikpO1xuICBjb25zdCByb3QgPSBOdW1iZXIoYXNVaW50TigzMiwgc3RhdGUgPj4gNTluKSk7XG4gIHJldHVybiB4b3JzaGlmdGVkID4+IHJvdCB8IHhvcnNoaWZ0ZWQgPDwgMzIgLSByb3Q7XG59XG5mdW5jdGlvbiBnZW5lcmF0ZUZsb2F0NjQocm5nKSB7XG4gIGNvbnN0IGcxID0gdW5zYWZlVW5pZm9ybUludERpc3RyaWJ1dGlvbigwLCAoMSA8PCAyNikgLSAxLCBybmcpO1xuICBjb25zdCBnMiA9IHVuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb24oMCwgKDEgPDwgMjcpIC0gMSwgcm5nKTtcbiAgY29uc3QgdmFsdWUgPSAoZzEgKiBNYXRoLnBvdygyLCAyNykgKyBnMikgKiBNYXRoLnBvdygyLCAtNTMpO1xuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiBtYWtlUmFuZG9tRnJvbVNlZWQoc2VlZCkge1xuICBjb25zdCBybmcgPSB4b3Jvc2hpcm8xMjhwbHVzKHBjZzMyKHNlZWRUb0JpZ0ludChzZWVkKSkpO1xuICBjb25zdCByYW5kb20gPSAoKSA9PiBnZW5lcmF0ZUZsb2F0NjQocm5nKTtcbiAgcmFuZG9tLmZpbGwgPSAoYXJyYXkpID0+IHtcbiAgICBpZiAoaXNCaWdJbnRBcnJheShhcnJheSkpIHtcbiAgICAgIGNvbnN0IHVwcGVyID0gKDFuIDw8IEJpZ0ludChhcnJheS5CWVRFU19QRVJfRUxFTUVOVCAqIDgpKSAtIDFuO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBhcnJheVtpXSA9IHVuc2FmZVVuaWZvcm1CaWdJbnREaXN0cmlidXRpb24oMG4sIHVwcGVyLCBybmcpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB1cHBlciA9IE1hdGgucG93KDIsIGFycmF5LkJZVEVTX1BFUl9FTEVNRU5UICogOCkgLSAxO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBhcnJheVtpXSA9IHVuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb24oMCwgdXBwZXIsIHJuZyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhcnJheTtcbiAgfTtcbiAgcmFuZG9tLnNodWZmbGUgPSAoYXJyYXkpID0+IHtcbiAgICBmb3IgKGxldCBjdXJyZW50SW5kZXggPSBhcnJheS5sZW5ndGggLSAxOyBjdXJyZW50SW5kZXggPiAwOyBjdXJyZW50SW5kZXgtLSkge1xuICAgICAgY29uc3Qgc3dhcEluZGV4ID0gcmFuZG9tLmludGVnZXJJblJhbmdlKDAsIGN1cnJlbnRJbmRleCk7XG4gICAgICBbYXJyYXlbY3VycmVudEluZGV4XSwgYXJyYXlbc3dhcEluZGV4XV0gPSBbXG4gICAgICAgIGFycmF5W3N3YXBJbmRleF0sXG4gICAgICAgIGFycmF5W2N1cnJlbnRJbmRleF1cbiAgICAgIF07XG4gICAgfVxuICAgIHJldHVybiBhcnJheTtcbiAgfTtcbiAgcmFuZG9tLnVpbnQzMiA9ICgpID0+IHJuZy51bnNhZmVOZXh0KCk7XG4gIHJhbmRvbS5pbnRlZ2VySW5SYW5nZSA9IChtaW4sIG1heCkgPT4gdW5zYWZlVW5pZm9ybUludERpc3RyaWJ1dGlvbihtaW4sIG1heCwgcm5nKTtcbiAgcmFuZG9tLmJpZ2ludEluUmFuZ2UgPSAobWluLCBtYXgpID0+IHVuc2FmZVVuaWZvcm1CaWdJbnREaXN0cmlidXRpb24obWluLCBtYXgsIHJuZyk7XG4gIHJldHVybiByYW5kb207XG59XG5mdW5jdGlvbiBtYWtlUmFuZG9tKHNlZWQpIHtcbiAgcmV0dXJuIG1ha2VSYW5kb21Gcm9tU2VlZChzZWVkKTtcbn1cbmZ1bmN0aW9uIHNlZWRUb0JpZ0ludChzZWVkKSB7XG4gIGlmICh0eXBlb2Ygc2VlZCA9PT0gXCJiaWdpbnRcIikgcmV0dXJuIHNlZWQ7XG4gIGlmICh0eXBlb2Ygc2VlZCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIEJpZ0ludChzZWVkKTtcbiAgaWYgKHNlZWQgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgbGV0IHZhbHVlID0gMG47XG4gICAgY29uc3QgbGVuID0gTWF0aC5taW4oc2VlZC5ieXRlTGVuZ3RoLCA4KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YWx1ZSB8PSBCaWdJbnQoc2VlZFtpXSkgPDwgQmlnSW50KGkgKiA4KTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJldHVybiBzZWVkLm1pY3Jvc1NpbmNlVW5peEVwb2NoO1xufVxuZnVuY3Rpb24gaXNCaWdJbnRBcnJheShhcnJheSkge1xuICByZXR1cm4gYXJyYXkgaW5zdGFuY2VvZiBCaWdJbnQ2NEFycmF5IHx8IGFycmF5IGluc3RhbmNlb2YgQmlnVWludDY0QXJyYXk7XG59XG52YXIgc3lzID0geyAuLi5fc3lzY2FsbHMyXzAsIC4uLl9zeXNjYWxsczJfMSB9O1xudmFyIGhvc3RCYWNrZW5kID0ge1xuICAvLyBEaXJlY3QgcmVmZXJlbmNlcyBrZWVwIGJhY2tlbmQgaW5qZWN0aW9uIGZyb20gYWRkaW5nIGEgd3JhcHBlciBjYWxsIHRvIHRoZSBob3N0IGhvdCBwYXRoLlxuICBpZGVudGl0eTogc3lzLmlkZW50aXR5LFxuICBnZXRKd3RQYXlsb2FkOiBzeXMuZ2V0X2p3dF9wYXlsb2FkLFxuICB0YWJsZUlkRnJvbU5hbWU6IHN5cy50YWJsZV9pZF9mcm9tX25hbWUsXG4gIGluZGV4SWRGcm9tTmFtZTogc3lzLmluZGV4X2lkX2Zyb21fbmFtZSxcbiAgZGF0YXN0b3JlVGFibGVSb3dDb3VudDogc3lzLmRhdGFzdG9yZV90YWJsZV9yb3dfY291bnQsXG4gIGRhdGFzdG9yZVRhYmxlU2NhbkJzYXRuOiBzeXMuZGF0YXN0b3JlX3RhYmxlX3NjYW5fYnNhdG4sXG4gIGRhdGFzdG9yZUluc2VydEJzYXRuOiBzeXMuZGF0YXN0b3JlX2luc2VydF9ic2F0bixcbiAgZGF0YXN0b3JlRGVsZXRlQWxsQnlFcUJzYXRuOiBzeXMuZGF0YXN0b3JlX2RlbGV0ZV9hbGxfYnlfZXFfYnNhdG4sXG4gIGRhdGFzdG9yZUluZGV4U2NhblBvaW50QnNhdG46IHN5cy5kYXRhc3RvcmVfaW5kZXhfc2Nhbl9wb2ludF9ic2F0bixcbiAgZGF0YXN0b3JlSW5kZXhTY2FuUmFuZ2VCc2F0bjogc3lzLmRhdGFzdG9yZV9pbmRleF9zY2FuX3JhbmdlX2JzYXRuLFxuICBkYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblBvaW50QnNhdG46IHN5cy5kYXRhc3RvcmVfZGVsZXRlX2J5X2luZGV4X3NjYW5fcG9pbnRfYnNhdG4sXG4gIGRhdGFzdG9yZURlbGV0ZUJ5SW5kZXhTY2FuUmFuZ2VCc2F0bjogc3lzLmRhdGFzdG9yZV9kZWxldGVfYnlfaW5kZXhfc2Nhbl9yYW5nZV9ic2F0bixcbiAgZGF0YXN0b3JlVXBkYXRlQnNhdG46IHN5cy5kYXRhc3RvcmVfdXBkYXRlX2JzYXRuLFxuICBkYXRhc3RvcmVDbGVhcjogc3lzLmRhdGFzdG9yZV9jbGVhcixcbiAgcm93SXRlckJzYXRuQWR2YW5jZTogc3lzLnJvd19pdGVyX2JzYXRuX2FkdmFuY2UsXG4gIHJvd0l0ZXJCc2F0bkNsb3NlOiBzeXMucm93X2l0ZXJfYnNhdG5fY2xvc2UsXG4gIHByb2NlZHVyZVN0YXJ0TXV0VHg6IHN5cy5wcm9jZWR1cmVfc3RhcnRfbXV0X3R4LFxuICBwcm9jZWR1cmVDb21taXRNdXRUeDogc3lzLnByb2NlZHVyZV9jb21taXRfbXV0X3R4LFxuICBwcm9jZWR1cmVBYm9ydE11dFR4OiBzeXMucHJvY2VkdXJlX2Fib3J0X211dF90eCxcbiAgcHJvY2VkdXJlSHR0cFJlcXVlc3Q6IHN5cy5wcm9jZWR1cmVfaHR0cF9yZXF1ZXN0XG59O1xuXG4vLyBzcmMvc2VydmVyL3J1bnRpbWUudHNcbnZhciB7IGZyZWV6ZSB9ID0gT2JqZWN0O1xudmFyIHN5czIgPSB7IC4uLl9zeXNjYWxsczJfMCwgLi4uX3N5c2NhbGxzMl8xIH07XG5mdW5jdGlvbiBpc0RhdGFzdG9yZUJhY2tlbmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9PSBudWxsICYmIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiBcInRhYmxlSWRGcm9tTmFtZVwiIGluIHZhbHVlICYmIFwicHJvY2VkdXJlU3RhcnRNdXRUeFwiIGluIHZhbHVlO1xufVxuZnVuY3Rpb24gcmVxdWVzdEZyb21XaXJlKHJlcXVlc3QsIGJvZHkpIHtcbiAgcmV0dXJuIFJlcXVlc3RbbWFrZVJlcXVlc3RdKGJvZHksIHtcbiAgICBoZWFkZXJzOiBkZXNlcmlhbGl6ZUhlYWRlcnMocmVxdWVzdC5oZWFkZXJzKSxcbiAgICBtZXRob2Q6IGRlc2VyaWFsaXplTWV0aG9kKHJlcXVlc3QubWV0aG9kKSxcbiAgICB1cmk6IHJlcXVlc3QudXJpLFxuICAgIHZlcnNpb246IHJlcXVlc3QudmVyc2lvblxuICB9KTtcbn1cbmZ1bmN0aW9uIHJlc3BvbnNlSW50b1dpcmUocmVzcG9uc2UpIHtcbiAgcmV0dXJuIFtcbiAgICB7XG4gICAgICBoZWFkZXJzOiBzZXJpYWxpemVIZWFkZXJzKHJlc3BvbnNlLmhlYWRlcnMpLFxuICAgICAgdmVyc2lvbjogcmVzcG9uc2UudmVyc2lvbixcbiAgICAgIGNvZGU6IHJlc3BvbnNlLnN0YXR1c1xuICAgIH0sXG4gICAgcmVzcG9uc2UuYnl0ZXMoKVxuICBdO1xufVxuZnVuY3Rpb24gcGFyc2VKc29uT2JqZWN0KGpzb24pIHtcbiAgbGV0IHZhbHVlO1xuICB0cnkge1xuICAgIHZhbHVlID0gSlNPTi5wYXJzZShqc29uKTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBKU09OOiBmYWlsZWQgdG8gcGFyc2Ugc3RyaW5nXCIpO1xuICB9XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBhIEpTT04gb2JqZWN0IGF0IHRoZSB0b3AgbGV2ZWxcIik7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxudmFyIEp3dENsYWltc0ltcGwgPSBjbGFzcyB7XG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IEp3dENsYWltcyBpbnN0YW5jZS5cbiAgICogQHBhcmFtIHJhd1BheWxvYWQgVGhlIEpXVCBwYXlsb2FkIGFzIGEgcmF3IEpTT04gc3RyaW5nLlxuICAgKiBAcGFyYW0gaWRlbnRpdHkgVGhlIGlkZW50aXR5IGZvciB0aGlzIEpXVC4gV2UgYXJlIG9ubHkgdGFraW5nIHRoaXMgYmVjYXVzZSB3ZSBkb24ndCBoYXZlIGEgYmxha2UzIGltcGxlbWVudGF0aW9uICh3aGljaCB3ZSBuZWVkIHRvIGNvbXB1dGUgaXQpLlxuICAgKi9cbiAgY29uc3RydWN0b3IocmF3UGF5bG9hZCwgaWRlbnRpdHkpIHtcbiAgICB0aGlzLnJhd1BheWxvYWQgPSByYXdQYXlsb2FkO1xuICAgIHRoaXMuZnVsbFBheWxvYWQgPSBwYXJzZUpzb25PYmplY3QocmF3UGF5bG9hZCk7XG4gICAgdGhpcy5faWRlbnRpdHkgPSBpZGVudGl0eTtcbiAgfVxuICBmdWxsUGF5bG9hZDtcbiAgX2lkZW50aXR5O1xuICBnZXQgaWRlbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2lkZW50aXR5O1xuICB9XG4gIGdldCBzdWJqZWN0KCkge1xuICAgIHJldHVybiB0aGlzLmZ1bGxQYXlsb2FkW1wic3ViXCJdO1xuICB9XG4gIGdldCBpc3N1ZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuZnVsbFBheWxvYWRbXCJpc3NcIl07XG4gIH1cbiAgZ2V0IGF1ZGllbmNlKCkge1xuICAgIGNvbnN0IGF1ZCA9IHRoaXMuZnVsbFBheWxvYWRbXCJhdWRcIl07XG4gICAgaWYgKGF1ZCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiB0eXBlb2YgYXVkID09PSBcInN0cmluZ1wiID8gW2F1ZF0gOiBhdWQ7XG4gIH1cbn07XG52YXIgQXV0aEN0eEltcGwgPSBjbGFzcyBfQXV0aEN0eEltcGwge1xuICBpc0ludGVybmFsO1xuICAvLyBTb3VyY2Ugb2YgdGhlIEpXVCBwYXlsb2FkIHN0cmluZywgaWYgdGhlcmUgaXMgb25lLlxuICBfand0U291cmNlO1xuICAvLyBXaGV0aGVyIHdlIGhhdmUgaW5pdGlhbGl6ZWQgdGhlIEpXVCBjbGFpbXMuXG4gIF9pbml0aWFsaXplZEpXVCA9IGZhbHNlO1xuICBfand0Q2xhaW1zO1xuICBfc2VuZGVySWRlbnRpdHk7XG4gIGNvbnN0cnVjdG9yKG9wdHMpIHtcbiAgICB0aGlzLmlzSW50ZXJuYWwgPSBvcHRzLmlzSW50ZXJuYWw7XG4gICAgdGhpcy5fand0U291cmNlID0gb3B0cy5qd3RTb3VyY2U7XG4gICAgdGhpcy5fc2VuZGVySWRlbnRpdHkgPSBvcHRzLnNlbmRlcklkZW50aXR5O1xuICB9XG4gIF9pbml0aWFsaXplSldUKCkge1xuICAgIGlmICh0aGlzLl9pbml0aWFsaXplZEpXVCkgcmV0dXJuO1xuICAgIHRoaXMuX2luaXRpYWxpemVkSldUID0gdHJ1ZTtcbiAgICBjb25zdCB0b2tlbiA9IHRoaXMuaXNJbnRlcm5hbCA/IG51bGwgOiB0aGlzLl9qd3RTb3VyY2UoKTtcbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICB0aGlzLl9qd3RDbGFpbXMgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9qd3RDbGFpbXMgPSBuZXcgSnd0Q2xhaW1zSW1wbCh0b2tlbiwgdGhpcy5fc2VuZGVySWRlbnRpdHkpO1xuICAgIH1cbiAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xuICB9XG4gIC8qKiBMYXppbHkgY29tcHV0ZSB3aGV0aGVyIGEgSldUIGV4aXN0cyBhbmQgaXMgcGFyc2VhYmxlLiAqL1xuICBnZXQgaGFzSldUKCkge1xuICAgIHRoaXMuX2luaXRpYWxpemVKV1QoKTtcbiAgICByZXR1cm4gdGhpcy5fand0Q2xhaW1zICE9PSBudWxsO1xuICB9XG4gIC8qKiBMYXppbHkgcGFyc2UgdGhlIEp3dENsYWltcyBvbmx5IHdoZW4gYWNjZXNzZWQuICovXG4gIGdldCBqd3QoKSB7XG4gICAgdGhpcy5faW5pdGlhbGl6ZUpXVCgpO1xuICAgIHJldHVybiB0aGlzLl9qd3RDbGFpbXM7XG4gIH1cbiAgLyoqIENyZWF0ZSBhIGNvbnRleHQgcmVwcmVzZW50aW5nIGludGVybmFsIChub24tdXNlcikgcmVxdWVzdHMuICovXG4gIHN0YXRpYyBpbnRlcm5hbCgpIHtcbiAgICByZXR1cm4gbmV3IF9BdXRoQ3R4SW1wbCh7XG4gICAgICBpc0ludGVybmFsOiB0cnVlLFxuICAgICAgand0U291cmNlOiAoKSA9PiBudWxsLFxuICAgICAgc2VuZGVySWRlbnRpdHk6IElkZW50aXR5Lnplcm8oKVxuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBDcmVhdGUgdGhlIGNvbnRleHQgb2YgYW4gaW52b2NhdGlvbiBieSBgc2VuZGVyYCxcbiAgICogd2hpY2ggaXMgaW50ZXJuYWwgd2hlbiBgc2VuZGVyYCBpcyB0aGlzIGRhdGFiYXNlLFxuICAgKiBhbmQgb3RoZXJ3aXNlIHJlYWRzIHRoZSBKV1QgcGF5bG9hZCBmcm9tIGBqd3RQYXlsb2FkYCBvbiBmaXJzdCB1c2UuXG4gICAqL1xuICBzdGF0aWMgZm9yU2VuZGVyKHNlbmRlciwgZGF0YWJhc2VJZGVudGl0eSwgand0UGF5bG9hZCkge1xuICAgIHJldHVybiBuZXcgX0F1dGhDdHhJbXBsKHtcbiAgICAgIGlzSW50ZXJuYWw6IHNlbmRlci5pc0VxdWFsKGRhdGFiYXNlSWRlbnRpdHkpLFxuICAgICAgand0U291cmNlOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHBheWxvYWRCdWYgPSBqd3RQYXlsb2FkKCk7XG4gICAgICAgIGlmIChwYXlsb2FkQnVmID09PSBudWxsIHx8IHBheWxvYWRCdWYubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgcGF5bG9hZFN0ciA9IG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShwYXlsb2FkQnVmKTtcbiAgICAgICAgcmV0dXJuIHBheWxvYWRTdHI7XG4gICAgICB9LFxuICAgICAgc2VuZGVySWRlbnRpdHk6IHNlbmRlclxuICAgIH0pO1xuICB9XG4gIC8qKiBJZiB0aGVyZSBpcyBhIGNvbm5lY3Rpb24gaWQsIGxvb2sgdXAgdGhlIEpXVCBwYXlsb2FkIGZyb20gdGhlIHN5c3RlbSB0YWJsZXMuICovXG4gIHN0YXRpYyBmcm9tQmFja2VuZChjb25uZWN0aW9uSWQsIHNlbmRlciwgZGF0YWJhc2VJZGVudGl0eSwgYmFja2VuZCkge1xuICAgIHJldHVybiBfQXV0aEN0eEltcGwuZm9yU2VuZGVyKFxuICAgICAgc2VuZGVyLFxuICAgICAgZGF0YWJhc2VJZGVudGl0eSxcbiAgICAgICgpID0+IGNvbm5lY3Rpb25JZCA9PT0gbnVsbCA/IG51bGwgOiBiYWNrZW5kLmdldEp3dFBheWxvYWQoY29ubmVjdGlvbklkLl9fY29ubmVjdGlvbl9pZF9fKVxuICAgICk7XG4gIH1cbiAgLyoqIElmIHRoZXJlIGlzIGEgY29ubmVjdGlvbiBpZCwgbG9vayB1cCB0aGUgSldUIHBheWxvYWQgZnJvbSB0aGUgaG9zdCBzeXN0ZW0gdGFibGVzLiAqL1xuICBzdGF0aWMgZnJvbVN5c3RlbVRhYmxlcyhjb25uZWN0aW9uSWQsIHNlbmRlcikge1xuICAgIHJldHVybiBfQXV0aEN0eEltcGwuZnJvbUJhY2tlbmQoXG4gICAgICBjb25uZWN0aW9uSWQsXG4gICAgICBzZW5kZXIsXG4gICAgICBuZXcgSWRlbnRpdHkoaG9zdEJhY2tlbmQuaWRlbnRpdHkoKSksXG4gICAgICBob3N0QmFja2VuZFxuICAgICk7XG4gIH1cbn07XG52YXIgUmVkdWNlckN0eEltcGwgPSBjbGFzcyBSZWR1Y2VyQ3R4IHtcbiAgI2lkZW50aXR5O1xuICAjc2VuZGVyQXV0aDtcbiAgI3V1aWRDb3VudGVyO1xuICAjcmFuZG9tO1xuICAjYmFja2VuZDtcbiAgc2VuZGVyO1xuICB0aW1lc3RhbXA7XG4gIGNvbm5lY3Rpb25JZDtcbiAgZGI7XG4gIGVudiA9IGVudmlyb25tZW50O1xuICBhcztcbiAgY29uc3RydWN0b3Ioc2VuZGVyLCB0aW1lc3RhbXAsIGNvbm5lY3Rpb25JZCwgZGJWaWV3LCBiYWNrZW5kT3JBc1ZpZXdzID0gaG9zdEJhY2tlbmQsIHNlbmRlckF1dGgsIHJhbmRvbSwgYXNWaWV3cyA9IHt9KSB7XG4gICAgT2JqZWN0LnNlYWwodGhpcyk7XG4gICAgdGhpcy5zZW5kZXIgPSBzZW5kZXI7XG4gICAgdGhpcy50aW1lc3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgdGhpcy5jb25uZWN0aW9uSWQgPSBjb25uZWN0aW9uSWQ7XG4gICAgdGhpcy5kYiA9IGRiVmlldztcbiAgICBpZiAoaXNEYXRhc3RvcmVCYWNrZW5kKGJhY2tlbmRPckFzVmlld3MpKSB7XG4gICAgICB0aGlzLiNiYWNrZW5kID0gYmFja2VuZE9yQXNWaWV3cztcbiAgICAgIHRoaXMuI3NlbmRlckF1dGggPSBzZW5kZXJBdXRoO1xuICAgICAgdGhpcy4jcmFuZG9tID0gcmFuZG9tO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiNiYWNrZW5kID0gaG9zdEJhY2tlbmQ7XG4gICAgICBhc1ZpZXdzID0gYmFja2VuZE9yQXNWaWV3cztcbiAgICB9XG4gICAgdGhpcy5hcyA9IGFzVmlld3M7XG4gIH1cbiAgLyoqIFJlc2V0IHRoZSBgUmVkdWNlckN0eGAgdG8gYmUgdXNlZCBmb3IgYSBuZXcgdHJhbnNhY3Rpb24gKi9cbiAgc3RhdGljIHJlc2V0SG9zdChtZSwgc2VuZGVyLCB0aW1lc3RhbXAsIGNvbm5lY3Rpb25JZCwgZGJWaWV3LCBhc1ZpZXdzKSB7XG4gICAgbWUuc2VuZGVyID0gc2VuZGVyO1xuICAgIG1lLnRpbWVzdGFtcCA9IHRpbWVzdGFtcDtcbiAgICBtZS5jb25uZWN0aW9uSWQgPSBjb25uZWN0aW9uSWQ7XG4gICAgbWUuI2JhY2tlbmQgPSBob3N0QmFja2VuZDtcbiAgICBtZS4jc2VuZGVyQXV0aCA9IHZvaWQgMDtcbiAgICBtZS4jcmFuZG9tID0gdm9pZCAwO1xuICAgIG1lLiN1dWlkQ291bnRlciA9IHZvaWQgMDtcbiAgICBpZiAoZGJWaWV3ICE9PSB2b2lkIDApIHtcbiAgICAgIG1lLmRiID0gZGJWaWV3O1xuICAgIH1cbiAgICBpZiAoYXNWaWV3cyAhPT0gdm9pZCAwKSB7XG4gICAgICBtZS5hcyA9IGFzVmlld3M7XG4gICAgfVxuICB9XG4gIC8qKiBSZXNldCB0aGUgYFJlZHVjZXJDdHhgIHRvIGJlIHVzZWQgd2l0aCBhbiBpbmplY3RhYmxlIGJhY2tlbmQuICovXG4gIHN0YXRpYyByZXNldChtZSwgc2VuZGVyLCB0aW1lc3RhbXAsIGNvbm5lY3Rpb25JZCwgYmFja2VuZE9yRGJWaWV3ID0gaG9zdEJhY2tlbmQsIHNlbmRlckF1dGgsIHJhbmRvbSwgZGJWaWV3LCBhc1ZpZXdzKSB7XG4gICAgbWUuc2VuZGVyID0gc2VuZGVyO1xuICAgIG1lLnRpbWVzdGFtcCA9IHRpbWVzdGFtcDtcbiAgICBtZS5jb25uZWN0aW9uSWQgPSBjb25uZWN0aW9uSWQ7XG4gICAgaWYgKGlzRGF0YXN0b3JlQmFja2VuZChiYWNrZW5kT3JEYlZpZXcpKSB7XG4gICAgICBtZS4jYmFja2VuZCA9IGJhY2tlbmRPckRiVmlldztcbiAgICAgIG1lLiNzZW5kZXJBdXRoID0gc2VuZGVyQXV0aDtcbiAgICAgIG1lLiNyYW5kb20gPSByYW5kb207XG4gICAgfSBlbHNlIHtcbiAgICAgIG1lLiNiYWNrZW5kID0gaG9zdEJhY2tlbmQ7XG4gICAgICBtZS4jc2VuZGVyQXV0aCA9IHZvaWQgMDtcbiAgICAgIG1lLiNyYW5kb20gPSB2b2lkIDA7XG4gICAgICBkYlZpZXcgPSBiYWNrZW5kT3JEYlZpZXc7XG4gICAgICBhc1ZpZXdzID0gc2VuZGVyQXV0aDtcbiAgICB9XG4gICAgbWUuI3V1aWRDb3VudGVyID0gdm9pZCAwO1xuICAgIGlmIChkYlZpZXcgIT09IHZvaWQgMCkge1xuICAgICAgbWUuZGIgPSBkYlZpZXc7XG4gICAgfVxuICAgIGlmIChhc1ZpZXdzICE9PSB2b2lkIDApIHtcbiAgICAgIG1lLmFzID0gYXNWaWV3cztcbiAgICB9XG4gIH1cbiAgZ2V0IGRhdGFiYXNlSWRlbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lkZW50aXR5ID8/PSBuZXcgSWRlbnRpdHkodGhpcy4jYmFja2VuZC5pZGVudGl0eSgpKTtcbiAgfVxuICBnZXQgaWRlbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YWJhc2VJZGVudGl0eTtcbiAgfVxuICBnZXQgc2VuZGVyQXV0aCgpIHtcbiAgICByZXR1cm4gdGhpcy4jc2VuZGVyQXV0aCA/Pz0gQXV0aEN0eEltcGwuZnJvbUJhY2tlbmQoXG4gICAgICB0aGlzLmNvbm5lY3Rpb25JZCxcbiAgICAgIHRoaXMuc2VuZGVyLFxuICAgICAgdGhpcy5kYXRhYmFzZUlkZW50aXR5LFxuICAgICAgdGhpcy4jYmFja2VuZFxuICAgICk7XG4gIH1cbiAgZ2V0IHJhbmRvbSgpIHtcbiAgICByZXR1cm4gdGhpcy4jcmFuZG9tID8/PSBtYWtlUmFuZG9tKHRoaXMudGltZXN0YW1wKTtcbiAgfVxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IHJhbmRvbSB7QGxpbmsgVXVpZH0gYHY0YCB1c2luZyB0aGlzIGBSZWR1Y2VyQ3R4YCdzIFJORy5cbiAgICovXG4gIG5ld1V1aWRWNCgpIHtcbiAgICBjb25zdCBieXRlcyA9IHRoaXMucmFuZG9tLmZpbGwobmV3IFVpbnQ4QXJyYXkoMTYpKTtcbiAgICByZXR1cm4gVXVpZC5mcm9tUmFuZG9tQnl0ZXNWNChieXRlcyk7XG4gIH1cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBzb3J0YWJsZSB7QGxpbmsgVXVpZH0gYHY3YCB1c2luZyB0aGlzIGBSZWR1Y2VyQ3R4YCdzIFJORywgY291bnRlcixcbiAgICogYW5kIHRpbWVzdGFtcC5cbiAgICovXG4gIG5ld1V1aWRWNygpIHtcbiAgICBjb25zdCBieXRlcyA9IHRoaXMucmFuZG9tLmZpbGwobmV3IFVpbnQ4QXJyYXkoNCkpO1xuICAgIGNvbnN0IGNvdW50ZXIgPSB0aGlzLiN1dWlkQ291bnRlciA/Pz0geyB2YWx1ZTogMCB9O1xuICAgIHJldHVybiBVdWlkLmZyb21Db3VudGVyVjcoY291bnRlciwgdGhpcy50aW1lc3RhbXAsIGJ5dGVzKTtcbiAgfVxufTtcbnZhciBjYWxsVXNlckZ1bmN0aW9uID0gZnVuY3Rpb24gX19zcGFjZXRpbWVkYl9lbmRfc2hvcnRfYmFja3RyYWNlKGZuLCAuLi5hcmdzKSB7XG4gIHJldHVybiBmbiguLi5hcmdzKTtcbn07XG5mdW5jdGlvbiBydW5XaXRoVHgobWFrZUN0eCwgYm9keSwgYmFja2VuZCA9IGhvc3RCYWNrZW5kKSB7XG4gIGNvbnN0IHJ1biA9ICgpID0+IHtcbiAgICBjb25zdCB0aW1lc3RhbXAgPSBiYWNrZW5kLnByb2NlZHVyZVN0YXJ0TXV0VHgoKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGJvZHkobWFrZUN0eChuZXcgVGltZXN0YW1wKHRpbWVzdGFtcCkpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBiYWNrZW5kLnByb2NlZHVyZUFib3J0TXV0VHgoKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9O1xuICBsZXQgcmVzID0gcnVuKCk7XG4gIHRyeSB7XG4gICAgYmFja2VuZC5wcm9jZWR1cmVDb21taXRNdXRUeCgpO1xuICAgIHJldHVybiByZXM7XG4gIH0gY2F0Y2gge1xuICB9XG4gIGNvbnNvbGUud2FybihcImNvbW1pdHRpbmcgYW5vbnltb3VzIHRyYW5zYWN0aW9uIGZhaWxlZFwiKTtcbiAgcmVzID0gcnVuKCk7XG4gIHRyeSB7XG4gICAgYmFja2VuZC5wcm9jZWR1cmVDb21taXRNdXRUeCgpO1xuICAgIHJldHVybiByZXM7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0cmFuc2FjdGlvbiByZXRyeSBmYWlsZWQgYWdhaW5cIiwgeyBjYXVzZTogZSB9KTtcbiAgfVxufVxuZnVuY3Rpb24gZmxhdHRlblN1Ym1vZHVsZURpc3BhdGNoZXMoZGlzcGF0Y2hlcywgcGFyZW50UHJlZml4ID0gXCJcIikge1xuICBjb25zdCByZXN1bHQgPSBbXTtcbiAgZm9yIChjb25zdCBkIG9mIGRpc3BhdGNoZXMpIHtcbiAgICBjb25zdCBuYW1lUHJlZml4ID0gcGFyZW50UHJlZml4ICsgZC5uYW1lc3BhY2UgKyBcIi5cIjtcbiAgICByZXN1bHQucHVzaCh7XG4gICAgICByZWR1Y2VyRm5zOiBkLnJlZHVjZXJGbnMsXG4gICAgICByZWR1Y2VyRGVmczogZC5yZWR1Y2VyRGVmcyxcbiAgICAgIHByb2NlZHVyZUZuczogZC5wcm9jZWR1cmVGbnMsXG4gICAgICBwcm9jZWR1cmVEZWZzOiBkLnByb2NlZHVyZURlZnMsXG4gICAgICBhbm9uVmlld0ZuczogZC5hbm9uVmlld0ZucyxcbiAgICAgIHZpZXdGbnM6IGQudmlld0ZucyxcbiAgICAgIHRhYmxlczogZC50YWJsZXMsXG4gICAgICBzY2hlbWFUYWJsZXM6IGQuc2NoZW1hVGFibGVzLFxuICAgICAgdHlwZXNwYWNlOiBkLnR5cGVzcGFjZSxcbiAgICAgIGRiVmlld186IHZvaWQgMCxcbiAgICAgIHF1ZXJ5QnVpbGRlcl86IHZvaWQgMCxcbiAgICAgIG5hbWVQcmVmaXgsXG4gICAgICBzdWJEaXNwYXRjaGVzOiBkLnN1YkRpc3BhdGNoZXNcbiAgICB9KTtcbiAgICByZXN1bHQucHVzaCguLi5mbGF0dGVuU3VibW9kdWxlRGlzcGF0Y2hlcyhkLnN1YkRpc3BhdGNoZXMsIG5hbWVQcmVmaXgpKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxudmFyIG1ha2VIb29rcyA9IChzY2hlbWEyKSA9PiBuZXcgTW9kdWxlSG9va3NJbXBsKHNjaGVtYTIpO1xudmFyIE1vZHVsZUhvb2tzSW1wbCA9IGNsYXNzIHtcbiAgI3NjaGVtYTtcbiAgI2RiVmlld187XG4gICNjb25zdW1lckFzXztcbiAgI3JlZHVjZXJBcmdzRGVzZXJpYWxpemVycztcbiAgI2NvbnN1bWVyUmVkdWNlckNvdW50O1xuICAjY29uc3VtZXJQcm9jZWR1cmVDb3VudDtcbiAgI2ZsYXRTdWJtb2R1bGVzO1xuICAjY29uc3VtZXJBbm9uVmlld0NvdW50O1xuICAjY29uc3VtZXJWaWV3Q291bnQ7XG4gIC8qKiBDYWNoZSB0aGUgYFJlZHVjZXJDdHhgIG9iamVjdCB0byBhdm9pZCBhbGxvY2F0aW5nIGFuZXcgZm9yIGV2ZXJ5IHJlZHVjZXIgY2FsbC4gKi9cbiAgI3JlZHVjZXJDdHhfO1xuICAvKiogUGVyLXN1Ym1vZHVsZSBhbGlhcyBjdHggbWFwcywgY2FjaGVkIGxhemlseSAocGFyYWxsZWwgdG8gI2ZsYXRTdWJtb2R1bGVzKS4gKi9cbiAgI3N1Ym1vZHVsZUFzVmlld3NfID0gW107XG4gIGNvbnN0cnVjdG9yKHNjaGVtYTIpIHtcbiAgICB0aGlzLiNzY2hlbWEgPSBzY2hlbWEyO1xuICAgIHRoaXMuI2NvbnN1bWVyUmVkdWNlckNvdW50ID0gc2NoZW1hMi5yZWR1Y2Vycy5sZW5ndGg7XG4gICAgdGhpcy4jY29uc3VtZXJQcm9jZWR1cmVDb3VudCA9IHNjaGVtYTIucHJvY2VkdXJlcy5sZW5ndGg7XG4gICAgdGhpcy4jY29uc3VtZXJBbm9uVmlld0NvdW50ID0gc2NoZW1hMi5hbm9uVmlld3MubGVuZ3RoO1xuICAgIHRoaXMuI2NvbnN1bWVyVmlld0NvdW50ID0gc2NoZW1hMi52aWV3cy5sZW5ndGg7XG4gICAgdGhpcy4jZmxhdFN1Ym1vZHVsZXMgPSBmbGF0dGVuU3VibW9kdWxlRGlzcGF0Y2hlcyhcbiAgICAgIHNjaGVtYTIuc3VibW9kdWxlRGlzcGF0Y2hJbmZvc1xuICAgICk7XG4gICAgY29uc3QgY29uc3VtZXJEZXNlcmlhbGl6ZXJzID0gc2NoZW1hMi5tb2R1bGVEZWYucmVkdWNlcnMubWFwKFxuICAgICAgKHsgcGFyYW1zIH0pID0+IFByb2R1Y3RUeXBlLm1ha2VEZXNlcmlhbGl6ZXIocGFyYW1zLCBzY2hlbWEyLnR5cGVzcGFjZSlcbiAgICApO1xuICAgIGNvbnN0IHN1Ym1vZHVsZURlc2VyaWFsaXplcnMgPSB0aGlzLiNmbGF0U3VibW9kdWxlcy5mbGF0TWFwKFxuICAgICAgKHsgcmVkdWNlckRlZnMsIHR5cGVzcGFjZSB9KSA9PiByZWR1Y2VyRGVmcy5tYXAoXG4gICAgICAgICh7IHBhcmFtcyB9KSA9PiBQcm9kdWN0VHlwZS5tYWtlRGVzZXJpYWxpemVyKHBhcmFtcywgdHlwZXNwYWNlKVxuICAgICAgKVxuICAgICk7XG4gICAgdGhpcy4jcmVkdWNlckFyZ3NEZXNlcmlhbGl6ZXJzID0gW1xuICAgICAgLi4uY29uc3VtZXJEZXNlcmlhbGl6ZXJzLFxuICAgICAgLi4uc3VibW9kdWxlRGVzZXJpYWxpemVyc1xuICAgIF07XG4gIH1cbiAgZ2V0ICNkYlZpZXcoKSB7XG4gICAgaWYgKHRoaXMuI2RiVmlld18gIT09IHZvaWQgMCkgcmV0dXJuIHRoaXMuI2RiVmlld187XG4gICAgY29uc3Qgcm9vdFRhYmxlcyA9IE9iamVjdC52YWx1ZXModGhpcy4jc2NoZW1hLnNjaGVtYVR5cGUudGFibGVzKS5tYXAoXG4gICAgICAodGFibGUyKSA9PiBbXG4gICAgICAgIHRhYmxlMi5hY2Nlc3Nvck5hbWUsXG4gICAgICAgIG1ha2VUYWJsZVZpZXcoXG4gICAgICAgICAgdGhpcy4jc2NoZW1hLnR5cGVzcGFjZSxcbiAgICAgICAgICB0YWJsZTIudGFibGVEZWYsXG4gICAgICAgICAgaG9zdEJhY2tlbmQsXG4gICAgICAgICAgXCJcIixcbiAgICAgICAgICB0YWJsZTIuaXNPdXRib3hcbiAgICAgICAgKVxuICAgICAgXVxuICAgICk7XG4gICAgY29uc3Qgc3VibW9kdWxlTnMgPSB0aGlzLiNzY2hlbWEuc3VibW9kdWxlRGlzcGF0Y2hJbmZvcy5tYXAoKGRpc3BhdGNoKSA9PiBbXG4gICAgICBkaXNwYXRjaC5uYW1lc3BhY2UsXG4gICAgICBidWlsZERiVmlld0ZvckRpc3BhdGNoKGRpc3BhdGNoLCBkaXNwYXRjaC5uYW1lc3BhY2UgKyBcIi5cIilcbiAgICBdKTtcbiAgICB0aGlzLiNkYlZpZXdfID0gZnJlZXplKFxuICAgICAgT2JqZWN0LmZyb21FbnRyaWVzKFsuLi5yb290VGFibGVzLCAuLi5zdWJtb2R1bGVOc10pXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcy4jZGJWaWV3XztcbiAgfVxuICAjZ2V0U3VibW9kdWxlRGJWaWV3KHN1Ym1vZHVsZUlkeCkge1xuICAgIGNvbnN0IG0gPSB0aGlzLiNmbGF0U3VibW9kdWxlc1tzdWJtb2R1bGVJZHhdO1xuICAgIHJldHVybiBtLmRiVmlld18gPz89IGZyZWV6ZShcbiAgICAgIE9iamVjdC5mcm9tRW50cmllcyhcbiAgICAgICAgbS50YWJsZXMubWFwKCh7IGFjY2Vzc29yTmFtZSwgdGFibGVEZWYgfSkgPT4gW1xuICAgICAgICAgIGFjY2Vzc29yTmFtZSxcbiAgICAgICAgICBtYWtlVGFibGVWaWV3KFxuICAgICAgICAgICAgbS50eXBlc3BhY2UsXG4gICAgICAgICAgICB0YWJsZURlZixcbiAgICAgICAgICAgIGhvc3RCYWNrZW5kLFxuICAgICAgICAgICAgbS5uYW1lUHJlZml4LFxuICAgICAgICAgICAgbS5zY2hlbWFUYWJsZXNbYWNjZXNzb3JOYW1lXS5pc091dGJveFxuICAgICAgICAgIClcbiAgICAgICAgXSlcbiAgICAgIClcbiAgICApO1xuICB9XG4gICNnZXRTdWJtb2R1bGVBc1ZpZXdzKHN1Ym1vZHVsZUlkeCkge1xuICAgIHJldHVybiB0aGlzLiNzdWJtb2R1bGVBc1ZpZXdzX1tzdWJtb2R1bGVJZHhdID8/PSBidWlsZEFsaWFzQ3R4TWFwKFxuICAgICAgdGhpcy4jcmVkdWNlckN0eCxcbiAgICAgIHRoaXMuI2ZsYXRTdWJtb2R1bGVzW3N1Ym1vZHVsZUlkeF0uc3ViRGlzcGF0Y2hlcyxcbiAgICAgIHRoaXMuI2ZsYXRTdWJtb2R1bGVzW3N1Ym1vZHVsZUlkeF0ubmFtZVByZWZpeFxuICAgICk7XG4gIH1cbiAgLyoqIFF1ZXJ5IGJ1aWxkZXIgc2NvcGVkIHRvIHRoZSBzdWJtb2R1bGUncyBvd24gdGFibGVzLCB3aXRoIG5hbWVzcGFjZS1wcmVmaXhlZFxuICAgKiAgc291cmNlIG5hbWVzIHNvIGdlbmVyYXRlZCBTUUwgdGFyZ2V0cyB0aGUgbW91bnRlZCB0YWJsZSBuYW1lcy4gKi9cbiAgI2dldFN1Ym1vZHVsZVF1ZXJ5QnVpbGRlcihzdWJtb2R1bGVJZHgpIHtcbiAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbc3VibW9kdWxlSWR4XTtcbiAgICByZXR1cm4gbS5xdWVyeUJ1aWxkZXJfID8/PSBtYWtlUXVlcnlCdWlsZGVyKHtcbiAgICAgIHRhYmxlczogT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgICBPYmplY3QuZW50cmllcyhtLnNjaGVtYVRhYmxlcykubWFwKChba2V5LCBkZWZdKSA9PiBbXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHsgLi4uZGVmLCBzb3VyY2VOYW1lOiBtLm5hbWVQcmVmaXggKyBkZWYuc291cmNlTmFtZSB9XG4gICAgICAgIF0pXG4gICAgICApXG4gICAgfSk7XG4gIH1cbiAgZ2V0ICNyZWR1Y2VyQ3R4KCkge1xuICAgIHJldHVybiB0aGlzLiNyZWR1Y2VyQ3R4XyA/Pz0gbmV3IFJlZHVjZXJDdHhJbXBsKFxuICAgICAgSWRlbnRpdHkuemVybygpLFxuICAgICAgVGltZXN0YW1wLlVOSVhfRVBPQ0gsXG4gICAgICBudWxsLFxuICAgICAgdGhpcy4jZGJWaWV3XG4gICAgKTtcbiAgfVxuICBnZXQgI2NvbnN1bWVyQXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2NvbnN1bWVyQXNfID8/PSBidWlsZEFsaWFzQ3R4TWFwKFxuICAgICAgdGhpcy4jcmVkdWNlckN0eCxcbiAgICAgIHRoaXMuI3NjaGVtYS5zdWJtb2R1bGVEaXNwYXRjaEluZm9zLFxuICAgICAgXCJcIlxuICAgICk7XG4gIH1cbiAgX19kZXNjcmliZV9tb2R1bGVfXygpIHtcbiAgICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDEyOCk7XG4gICAgUmF3TW9kdWxlRGVmLnNlcmlhbGl6ZShcbiAgICAgIHdyaXRlcixcbiAgICAgIFJhd01vZHVsZURlZi5WMTAodGhpcy4jc2NoZW1hLnJhd01vZHVsZURlZlYxMCgpKVxuICAgICk7XG4gICAgcmV0dXJuIHdyaXRlci5nZXRCdWZmZXIoKTtcbiAgfVxuICBfX2dldF9lcnJvcl9jb25zdHJ1Y3Rvcl9fKGNvZGUpIHtcbiAgICByZXR1cm4gZ2V0RXJyb3JDb25zdHJ1Y3Rvcihjb2RlKTtcbiAgfVxuICBnZXQgX19zZW5kZXJfZXJyb3JfY2xhc3NfXygpIHtcbiAgICByZXR1cm4gU2VuZGVyRXJyb3I7XG4gIH1cbiAgX19jYWxsX3JlZHVjZXJfXyhyZWR1Y2VySWQsIHNlbmRlciwgY29ubklkLCB0aW1lc3RhbXAsIGFyZ3NCdWYpIHtcbiAgICBjb25zdCBkZXNlcmlhbGl6ZUFyZ3MgPSB0aGlzLiNyZWR1Y2VyQXJnc0Rlc2VyaWFsaXplcnNbcmVkdWNlcklkXTtcbiAgICBCSU5BUllfUkVBREVSLnJlc2V0KGFyZ3NCdWYpO1xuICAgIGNvbnN0IGFyZ3MgPSBkZXNlcmlhbGl6ZUFyZ3MoQklOQVJZX1JFQURFUik7XG4gICAgY29uc3Qgc2VuZGVySWRlbnRpdHkgPSBuZXcgSWRlbnRpdHkoc2VuZGVyKTtcbiAgICBsZXQgZm47XG4gICAgbGV0IGRiVmlldztcbiAgICBsZXQgYXNWaWV3cztcbiAgICBpZiAocmVkdWNlcklkIDwgdGhpcy4jY29uc3VtZXJSZWR1Y2VyQ291bnQpIHtcbiAgICAgIGZuID0gdGhpcy4jc2NoZW1hLnJlZHVjZXJzW3JlZHVjZXJJZF07XG4gICAgICBkYlZpZXcgPSB0aGlzLiNkYlZpZXc7XG4gICAgICBhc1ZpZXdzID0gdGhpcy4jY29uc3VtZXJBcztcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9mZnNldCA9IHRoaXMuI2NvbnN1bWVyUmVkdWNlckNvdW50O1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLiNmbGF0U3VibW9kdWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbaV07XG4gICAgICAgIGlmIChyZWR1Y2VySWQgPCBvZmZzZXQgKyBtLnJlZHVjZXJGbnMubGVuZ3RoKSB7XG4gICAgICAgICAgZm4gPSBtLnJlZHVjZXJGbnNbcmVkdWNlcklkIC0gb2Zmc2V0XTtcbiAgICAgICAgICBkYlZpZXcgPSB0aGlzLiNnZXRTdWJtb2R1bGVEYlZpZXcoaSk7XG4gICAgICAgICAgYXNWaWV3cyA9IHRoaXMuI2dldFN1Ym1vZHVsZUFzVmlld3MoaSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgb2Zmc2V0ICs9IG0ucmVkdWNlckZucy5sZW5ndGg7XG4gICAgICB9XG4gICAgICBpZiAoZm4gPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihgdW5rbm93biByZWR1Y2VySWQgJHtyZWR1Y2VySWR9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGN0eCA9IHRoaXMuI3JlZHVjZXJDdHg7XG4gICAgUmVkdWNlckN0eEltcGwucmVzZXRIb3N0KFxuICAgICAgY3R4LFxuICAgICAgc2VuZGVySWRlbnRpdHksXG4gICAgICBuZXcgVGltZXN0YW1wKHRpbWVzdGFtcCksXG4gICAgICBDb25uZWN0aW9uSWQubnVsbElmWmVybyhuZXcgQ29ubmVjdGlvbklkKGNvbm5JZCkpLFxuICAgICAgZGJWaWV3LFxuICAgICAgYXNWaWV3c1xuICAgICk7XG4gICAgY2FsbFVzZXJGdW5jdGlvbihmbiwgY3R4LCBhcmdzKTtcbiAgfVxuICBfX2NhbGxfdmlld19fKGlkLCBzZW5kZXIsIGFyZ3NCdWYpIHtcbiAgICBjb25zdCBtb2R1bGVDdHggPSB0aGlzLiNzY2hlbWE7XG4gICAgbGV0IHZpZXdGbnM7XG4gICAgbGV0IGxvY2FsSWQ7XG4gICAgbGV0IGRiVmlldztcbiAgICBsZXQgZnJvbTtcbiAgICBpZiAoaWQgPCB0aGlzLiNjb25zdW1lclZpZXdDb3VudCkge1xuICAgICAgdmlld0ZucyA9IG1vZHVsZUN0eC52aWV3cztcbiAgICAgIGxvY2FsSWQgPSBpZDtcbiAgICAgIGRiVmlldyA9IHRoaXMuI2RiVmlldztcbiAgICAgIGZyb20gPSBtYWtlUXVlcnlCdWlsZGVyKG1vZHVsZUN0eC5zY2hlbWFUeXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9mZnNldCA9IHRoaXMuI2NvbnN1bWVyVmlld0NvdW50O1xuICAgICAgbGV0IGZvdW5kID0gZmFsc2U7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuI2ZsYXRTdWJtb2R1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLiNmbGF0U3VibW9kdWxlc1tpXTtcbiAgICAgICAgaWYgKGlkIDwgb2Zmc2V0ICsgbS52aWV3Rm5zLmxlbmd0aCkge1xuICAgICAgICAgIHZpZXdGbnMgPSBtLnZpZXdGbnM7XG4gICAgICAgICAgbG9jYWxJZCA9IGlkIC0gb2Zmc2V0O1xuICAgICAgICAgIGRiVmlldyA9IHRoaXMuI2dldFN1Ym1vZHVsZURiVmlldyhpKTtcbiAgICAgICAgICBmcm9tID0gdGhpcy4jZ2V0U3VibW9kdWxlUXVlcnlCdWlsZGVyKGkpO1xuICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBvZmZzZXQgKz0gbS52aWV3Rm5zLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGlmICghZm91bmQpIHRocm93IG5ldyBSYW5nZUVycm9yKGB1bmtub3duIHZpZXdJZCAke2lkfWApO1xuICAgIH1cbiAgICBjb25zdCB7IGZuLCBkZXNlcmlhbGl6ZVBhcmFtcywgc2VyaWFsaXplUmV0dXJuLCByZXR1cm5UeXBlQmFzZVNpemUgfSA9IHZpZXdGbnNbbG9jYWxJZF07XG4gICAgY29uc3QgY3R4ID0gZnJlZXplKHtcbiAgICAgIGVudjogZW52aXJvbm1lbnQsXG4gICAgICBzZW5kZXI6IG5ldyBJZGVudGl0eShzZW5kZXIpLFxuICAgICAgZGI6IGRiVmlldyxcbiAgICAgIGZyb21cbiAgICB9KTtcbiAgICBjb25zdCBhcmdzID0gZGVzZXJpYWxpemVQYXJhbXMobmV3IEJpbmFyeVJlYWRlcihhcmdzQnVmKSk7XG4gICAgY29uc3QgcmV0ID0gY2FsbFVzZXJGdW5jdGlvbihmbiwgY3R4LCBhcmdzKTtcbiAgICBjb25zdCByZXRCdWYgPSBuZXcgQmluYXJ5V3JpdGVyKHJldHVyblR5cGVCYXNlU2l6ZSk7XG4gICAgaWYgKGlzUm93VHlwZWRRdWVyeShyZXQpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRvU3FsKHJldCk7XG4gICAgICBWaWV3UmVzdWx0SGVhZGVyLnNlcmlhbGl6ZShyZXRCdWYsIFZpZXdSZXN1bHRIZWFkZXIuUmF3U3FsKHF1ZXJ5KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIFZpZXdSZXN1bHRIZWFkZXIuc2VyaWFsaXplKHJldEJ1ZiwgVmlld1Jlc3VsdEhlYWRlci5Sb3dEYXRhKTtcbiAgICAgIHNlcmlhbGl6ZVJldHVybihyZXRCdWYsIHJldCk7XG4gICAgfVxuICAgIHJldHVybiB7IGRhdGE6IHJldEJ1Zi5nZXRCdWZmZXIoKSB9O1xuICB9XG4gIF9fY2FsbF92aWV3X2Fub25fXyhpZCwgYXJnc0J1Zikge1xuICAgIGNvbnN0IG1vZHVsZUN0eCA9IHRoaXMuI3NjaGVtYTtcbiAgICBsZXQgYW5vblZpZXdGbnM7XG4gICAgbGV0IGxvY2FsSWQ7XG4gICAgbGV0IGRiVmlldztcbiAgICBsZXQgZnJvbTtcbiAgICBpZiAoaWQgPCB0aGlzLiNjb25zdW1lckFub25WaWV3Q291bnQpIHtcbiAgICAgIGFub25WaWV3Rm5zID0gbW9kdWxlQ3R4LmFub25WaWV3cztcbiAgICAgIGxvY2FsSWQgPSBpZDtcbiAgICAgIGRiVmlldyA9IHRoaXMuI2RiVmlldztcbiAgICAgIGZyb20gPSBtYWtlUXVlcnlCdWlsZGVyKG1vZHVsZUN0eC5zY2hlbWFUeXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9mZnNldCA9IHRoaXMuI2NvbnN1bWVyQW5vblZpZXdDb3VudDtcbiAgICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLiNmbGF0U3VibW9kdWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbaV07XG4gICAgICAgIGlmIChpZCA8IG9mZnNldCArIG0uYW5vblZpZXdGbnMubGVuZ3RoKSB7XG4gICAgICAgICAgYW5vblZpZXdGbnMgPSBtLmFub25WaWV3Rm5zO1xuICAgICAgICAgIGxvY2FsSWQgPSBpZCAtIG9mZnNldDtcbiAgICAgICAgICBkYlZpZXcgPSB0aGlzLiNnZXRTdWJtb2R1bGVEYlZpZXcoaSk7XG4gICAgICAgICAgZnJvbSA9IHRoaXMuI2dldFN1Ym1vZHVsZVF1ZXJ5QnVpbGRlcihpKTtcbiAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgb2Zmc2V0ICs9IG0uYW5vblZpZXdGbnMubGVuZ3RoO1xuICAgICAgfVxuICAgICAgaWYgKCFmb3VuZCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoYHVua25vd24gYW5vblZpZXdJZCAke2lkfWApO1xuICAgIH1cbiAgICBjb25zdCB7IGZuLCBkZXNlcmlhbGl6ZVBhcmFtcywgc2VyaWFsaXplUmV0dXJuLCByZXR1cm5UeXBlQmFzZVNpemUgfSA9IGFub25WaWV3Rm5zW2xvY2FsSWRdO1xuICAgIGNvbnN0IGN0eCA9IGZyZWV6ZSh7XG4gICAgICBlbnY6IGVudmlyb25tZW50LFxuICAgICAgZGI6IGRiVmlldyxcbiAgICAgIGZyb21cbiAgICB9KTtcbiAgICBjb25zdCBhcmdzID0gZGVzZXJpYWxpemVQYXJhbXMobmV3IEJpbmFyeVJlYWRlcihhcmdzQnVmKSk7XG4gICAgY29uc3QgcmV0ID0gY2FsbFVzZXJGdW5jdGlvbihmbiwgY3R4LCBhcmdzKTtcbiAgICBjb25zdCByZXRCdWYgPSBuZXcgQmluYXJ5V3JpdGVyKHJldHVyblR5cGVCYXNlU2l6ZSk7XG4gICAgaWYgKGlzUm93VHlwZWRRdWVyeShyZXQpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRvU3FsKHJldCk7XG4gICAgICBWaWV3UmVzdWx0SGVhZGVyLnNlcmlhbGl6ZShyZXRCdWYsIFZpZXdSZXN1bHRIZWFkZXIuUmF3U3FsKHF1ZXJ5KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIFZpZXdSZXN1bHRIZWFkZXIuc2VyaWFsaXplKHJldEJ1ZiwgVmlld1Jlc3VsdEhlYWRlci5Sb3dEYXRhKTtcbiAgICAgIHNlcmlhbGl6ZVJldHVybihyZXRCdWYsIHJldCk7XG4gICAgfVxuICAgIHJldHVybiB7IGRhdGE6IHJldEJ1Zi5nZXRCdWZmZXIoKSB9O1xuICB9XG4gIF9fY2FsbF9wcm9jZWR1cmVfXyhpZCwgc2VuZGVyLCBjb25uZWN0aW9uX2lkLCB0aW1lc3RhbXAsIGFyZ3MpIHtcbiAgICBjb25zdCBzZW5kZXJJZGVudGl0eSA9IG5ldyBJZGVudGl0eShzZW5kZXIpO1xuICAgIGNvbnN0IGNvbm5JZCA9IENvbm5lY3Rpb25JZC5udWxsSWZaZXJvKG5ldyBDb25uZWN0aW9uSWQoY29ubmVjdGlvbl9pZCkpO1xuICAgIGNvbnN0IHRzID0gbmV3IFRpbWVzdGFtcCh0aW1lc3RhbXApO1xuICAgIGlmIChpZCA8IHRoaXMuI2NvbnN1bWVyUHJvY2VkdXJlQ291bnQpIHtcbiAgICAgIHJldHVybiBjYWxsUHJvY2VkdXJlKFxuICAgICAgICB0aGlzLiNzY2hlbWEucHJvY2VkdXJlcyxcbiAgICAgICAgaWQsXG4gICAgICAgIHNlbmRlcklkZW50aXR5LFxuICAgICAgICBjb25uSWQsXG4gICAgICAgIHRzLFxuICAgICAgICBhcmdzLFxuICAgICAgICAoKSA9PiB0aGlzLiNkYlZpZXcsXG4gICAgICAgIHRoaXMuI3NjaGVtYS5zdWJtb2R1bGVEaXNwYXRjaEluZm9zXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgb2Zmc2V0ID0gdGhpcy4jY29uc3VtZXJQcm9jZWR1cmVDb3VudDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuI2ZsYXRTdWJtb2R1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbaV07XG4gICAgICBpZiAoaWQgPCBvZmZzZXQgKyBtLnByb2NlZHVyZUZucy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxQcm9jZWR1cmUoXG4gICAgICAgICAgbS5wcm9jZWR1cmVGbnMsXG4gICAgICAgICAgaWQgLSBvZmZzZXQsXG4gICAgICAgICAgc2VuZGVySWRlbnRpdHksXG4gICAgICAgICAgY29ubklkLFxuICAgICAgICAgIHRzLFxuICAgICAgICAgIGFyZ3MsXG4gICAgICAgICAgKCkgPT4gdGhpcy4jZ2V0U3VibW9kdWxlRGJWaWV3KGkpLFxuICAgICAgICAgIG0uc3ViRGlzcGF0Y2hlcyxcbiAgICAgICAgICBtLm5hbWVQcmVmaXhcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIG9mZnNldCArPSBtLnByb2NlZHVyZUZucy5sZW5ndGg7XG4gICAgfVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGB1bmtub3duIHByb2NlZHVyZUlkICR7aWR9YCk7XG4gIH1cbiAgX19jYWxsX2h0dHBfaGFuZGxlcl9fKGlkLCB0aW1lc3RhbXAsIHJlcXVlc3QsIGJvZHksIHNlbmRlciwgc2VuZGVySnd0KSB7XG4gICAgY29uc3QgbW9kdWxlQ3R4ID0gdGhpcy4jc2NoZW1hO1xuICAgIGNvbnN0IGhhbmRsZXIgPSBtb2R1bGVDdHguaHR0cEhhbmRsZXJzW2lkXTtcbiAgICBjb25zdCBjdHggPSBuZXcgSGFuZGxlckNvbnRleHRJbXBsKFxuICAgICAgbmV3IElkZW50aXR5KHNlbmRlciksXG4gICAgICBuZXcgVGltZXN0YW1wKHRpbWVzdGFtcCksXG4gICAgICBzZW5kZXJKd3QsXG4gICAgICAoKSA9PiB0aGlzLiNkYlZpZXcsXG4gICAgICB0aGlzLiNzY2hlbWEuc3VibW9kdWxlRGlzcGF0Y2hJbmZvc1xuICAgICk7XG4gICAgY29uc3QgcmVxdWVzdE1ldGFkYXRhID0gSHR0cFJlcXVlc3QuZGVzZXJpYWxpemUobmV3IEJpbmFyeVJlYWRlcihyZXF1ZXN0KSk7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBjYWxsVXNlckZ1bmN0aW9uKFxuICAgICAgaGFuZGxlcixcbiAgICAgIGN0eCxcbiAgICAgIHJlcXVlc3RGcm9tV2lyZShyZXF1ZXN0TWV0YWRhdGEsIGJvZHkpXG4gICAgKTtcbiAgICBjb25zdCBbcmVzcG9uc2VNZXRhZGF0YSwgcmVzcG9uc2VCb2R5XSA9IHJlc3BvbnNlSW50b1dpcmUocmVzcG9uc2UpO1xuICAgIGNvbnN0IHJlc3BvbnNlQnVmID0gbmV3IEJpbmFyeVdyaXRlcihcbiAgICAgIGJzYXRuQmFzZVNpemUobW9kdWxlQ3R4LnR5cGVzcGFjZSwgSHR0cFJlc3BvbnNlLmFsZ2VicmFpY1R5cGUpXG4gICAgKTtcbiAgICBIdHRwUmVzcG9uc2Uuc2VyaWFsaXplKHJlc3BvbnNlQnVmLCByZXNwb25zZU1ldGFkYXRhKTtcbiAgICByZXR1cm4gW3Jlc3BvbnNlQnVmLmdldEJ1ZmZlcigpLCByZXNwb25zZUJvZHldO1xuICB9XG59O1xudmFyIEJJTkFSWV9XUklURVIgPSBuZXcgQmluYXJ5V3JpdGVyKDApO1xudmFyIEJJTkFSWV9SRUFERVIgPSBuZXcgQmluYXJ5UmVhZGVyKG5ldyBVaW50OEFycmF5KCkpO1xudmFyIEhhbmRsZXJDb250ZXh0SW1wbCA9IGNsYXNzIF9IYW5kbGVyQ29udGV4dEltcGwge1xuICBjb25zdHJ1Y3RvcihzZW5kZXIsIHRpbWVzdGFtcCwgc2VuZGVySnd0LCBkYlZpZXcsIGRpc3BhdGNoZXMgPSBbXSkge1xuICAgIHRoaXMuc2VuZGVyID0gc2VuZGVyO1xuICAgIHRoaXMudGltZXN0YW1wID0gdGltZXN0YW1wO1xuICAgIHRoaXMuI3NlbmRlckp3dCA9IHNlbmRlckp3dDtcbiAgICB0aGlzLiNkYlZpZXcgPSBkYlZpZXc7XG4gICAgdGhpcy4jZGlzcGF0Y2hlcyA9IGRpc3BhdGNoZXM7XG4gIH1cbiAgZW52ID0gZW52aXJvbm1lbnQ7XG4gICNpZGVudGl0eTtcbiAgI3NlbmRlckp3dDtcbiAgI3NlbmRlckF1dGg7XG4gICN1dWlkQ291bnRlcjtcbiAgI3JhbmRvbTtcbiAgI2RiVmlldztcbiAgI2Rpc3BhdGNoZXM7XG4gICNhc1ZpZXdzO1xuICBodHRwID0gaHR0cENsaWVudDtcbiAgLyoqIFRoZSBgQXV0aEN0eGAgb2YgYG1lLnNlbmRlcmAsIHdoaWNoIHRoZSB0cmFuc2FjdGlvbnMgdGhhdCBgbWVgIG9wZW5zIHNoYXJlLiAqL1xuICBzdGF0aWMgc2VuZGVyQXV0aChtZSkge1xuICAgIHJldHVybiBtZS4jc2VuZGVyQXV0aCA/Pz0gQXV0aEN0eEltcGwuZm9yU2VuZGVyKFxuICAgICAgbWUuc2VuZGVyLFxuICAgICAgbWUuaWRlbnRpdHksXG4gICAgICAoKSA9PiBtZS4jc2VuZGVySnd0XG4gICAgKTtcbiAgfVxuICBnZXQgaWRlbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lkZW50aXR5ID8/PSBuZXcgSWRlbnRpdHkoc3lzMi5pZGVudGl0eSgpKTtcbiAgfVxuICBnZXQgcmFuZG9tKCkge1xuICAgIHJldHVybiB0aGlzLiNyYW5kb20gPz89IG1ha2VSYW5kb20odGhpcy50aW1lc3RhbXApO1xuICB9XG4gIGdldCBhcygpIHtcbiAgICByZXR1cm4gdGhpcy4jYXNWaWV3cyA/Pz0gYnVpbGRIYW5kbGVyQWxpYXNDdHhNYXAoXG4gICAgICB0aGlzLFxuICAgICAgdGhpcy4jZGlzcGF0Y2hlcyxcbiAgICAgIFwiXCJcbiAgICApO1xuICB9XG4gIHdpdGhUeChib2R5KSB7XG4gICAgY29uc3QgZGlzcGF0Y2hlcyA9IHRoaXMuI2Rpc3BhdGNoZXM7XG4gICAgcmV0dXJuIHJ1bldpdGhUeCgodGltZXN0YW1wKSA9PiB7XG4gICAgICBjb25zdCB0eCA9IG5ldyBSZWR1Y2VyQ3R4SW1wbChcbiAgICAgICAgdGhpcy5zZW5kZXIsXG4gICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgdGhpcy4jZGJWaWV3KCksXG4gICAgICAgIGhvc3RCYWNrZW5kLFxuICAgICAgICBfSGFuZGxlckNvbnRleHRJbXBsLnNlbmRlckF1dGgodGhpcylcbiAgICAgICk7XG4gICAgICBpZiAoZGlzcGF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHR4LmFzID0gYnVpbGRBbGlhc0N0eE1hcCh0eCwgZGlzcGF0Y2hlcywgXCJcIik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHg7XG4gICAgfSwgYm9keSk7XG4gIH1cbiAgbmV3VXVpZFY0KCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy5yYW5kb20uZmlsbChuZXcgVWludDhBcnJheSgxNikpO1xuICAgIHJldHVybiBVdWlkLmZyb21SYW5kb21CeXRlc1Y0KGJ5dGVzKTtcbiAgfVxuICBuZXdVdWlkVjcoKSB7XG4gICAgY29uc3QgYnl0ZXMgPSB0aGlzLnJhbmRvbS5maWxsKG5ldyBVaW50OEFycmF5KDQpKTtcbiAgICBjb25zdCBjb3VudGVyID0gdGhpcy4jdXVpZENvdW50ZXIgPz89IHsgdmFsdWU6IDAgfTtcbiAgICByZXR1cm4gVXVpZC5mcm9tQ291bnRlclY3KGNvdW50ZXIsIHRoaXMudGltZXN0YW1wLCBieXRlcyk7XG4gIH1cbn07XG5mdW5jdGlvbiBidWlsZERiVmlld0ZvckRpc3BhdGNoKGRpc3BhdGNoLCBuYW1lUHJlZml4KSB7XG4gIGNvbnN0IHRhYmxlRW50cmllcyA9IGRpc3BhdGNoLnRhYmxlcy5tYXAoKHsgYWNjZXNzb3JOYW1lLCB0YWJsZURlZiB9KSA9PiBbXG4gICAgYWNjZXNzb3JOYW1lLFxuICAgIG1ha2VUYWJsZVZpZXcoXG4gICAgICBkaXNwYXRjaC50eXBlc3BhY2UsXG4gICAgICB0YWJsZURlZixcbiAgICAgIGhvc3RCYWNrZW5kLFxuICAgICAgbmFtZVByZWZpeCxcbiAgICAgIGRpc3BhdGNoLnNjaGVtYVRhYmxlc1thY2Nlc3Nvck5hbWVdLmlzT3V0Ym94XG4gICAgKVxuICBdKTtcbiAgY29uc3Qgc3ViTnNFbnRyaWVzID0gZGlzcGF0Y2guc3ViRGlzcGF0Y2hlcy5tYXAoKHN1YikgPT4gW1xuICAgIHN1Yi5uYW1lc3BhY2UsXG4gICAgYnVpbGREYlZpZXdGb3JEaXNwYXRjaChzdWIsIG5hbWVQcmVmaXggKyBzdWIubmFtZXNwYWNlICsgXCIuXCIpXG4gIF0pO1xuICByZXR1cm4gZnJlZXplKE9iamVjdC5mcm9tRW50cmllcyhbLi4udGFibGVFbnRyaWVzLCAuLi5zdWJOc0VudHJpZXNdKSk7XG59XG5mdW5jdGlvbiBidWlsZEFsaWFzQ3R4KHBhcmVudCwgZGlzcGF0Y2gsIG5hbWVQcmVmaXgpIHtcbiAgY29uc3QgbnNEYiA9IGJ1aWxkRGJWaWV3Rm9yRGlzcGF0Y2goZGlzcGF0Y2gsIG5hbWVQcmVmaXgpO1xuICBjb25zdCBzdWJBcyA9IGJ1aWxkQWxpYXNDdHhNYXAocGFyZW50LCBkaXNwYXRjaC5zdWJEaXNwYXRjaGVzLCBuYW1lUHJlZml4KTtcbiAgcmV0dXJuIHtcbiAgICBnZXQgc2VuZGVyKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5zZW5kZXI7XG4gICAgfSxcbiAgICBnZXQgZGF0YWJhc2VJZGVudGl0eSgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuZGF0YWJhc2VJZGVudGl0eTtcbiAgICB9LFxuICAgIGdldCBpZGVudGl0eSgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuaWRlbnRpdHk7XG4gICAgfSxcbiAgICBnZXQgdGltZXN0YW1wKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC50aW1lc3RhbXA7XG4gICAgfSxcbiAgICBnZXQgY29ubmVjdGlvbklkKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5jb25uZWN0aW9uSWQ7XG4gICAgfSxcbiAgICBnZXQgc2VuZGVyQXV0aCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuc2VuZGVyQXV0aDtcbiAgICB9LFxuICAgIGdldCByYW5kb20oKSB7XG4gICAgICByZXR1cm4gcGFyZW50LnJhbmRvbTtcbiAgICB9LFxuICAgIG5ld1V1aWRWNCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQubmV3VXVpZFY0KCk7XG4gICAgfSxcbiAgICBuZXdVdWlkVjcoKSB7XG4gICAgICByZXR1cm4gcGFyZW50Lm5ld1V1aWRWNygpO1xuICAgIH0sXG4gICAgZGI6IG5zRGIsXG4gICAgYXM6IHN1YkFzXG4gIH07XG59XG5mdW5jdGlvbiBidWlsZEFsaWFzQ3R4TWFwKHBhcmVudCwgZGlzcGF0Y2hlcywgcGFyZW50UHJlZml4KSB7XG4gIHJldHVybiBmcmVlemUoXG4gICAgT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgZGlzcGF0Y2hlcy5tYXAoKGQpID0+IFtcbiAgICAgICAgZC5uYW1lc3BhY2UsXG4gICAgICAgIGJ1aWxkQWxpYXNDdHgocGFyZW50LCBkLCBwYXJlbnRQcmVmaXggKyBkLm5hbWVzcGFjZSArIFwiLlwiKVxuICAgICAgXSlcbiAgICApXG4gICk7XG59XG5mdW5jdGlvbiBidWlsZEhhbmRsZXJBbGlhc0N0eChwYXJlbnQsIGRpc3BhdGNoLCBuYW1lUHJlZml4KSB7XG4gIGxldCBuc0RiXztcbiAgY29uc3Qgc3ViQXMgPSBidWlsZEhhbmRsZXJBbGlhc0N0eE1hcChcbiAgICBwYXJlbnQsXG4gICAgZGlzcGF0Y2guc3ViRGlzcGF0Y2hlcyxcbiAgICBuYW1lUHJlZml4XG4gICk7XG4gIHJldHVybiB7XG4gICAgZ2V0IHNlbmRlcigpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuc2VuZGVyO1xuICAgIH0sXG4gICAgZ2V0IHRpbWVzdGFtcCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQudGltZXN0YW1wO1xuICAgIH0sXG4gICAgZ2V0IGh0dHAoKSB7XG4gICAgICByZXR1cm4gcGFyZW50Lmh0dHA7XG4gICAgfSxcbiAgICBnZXQgaWRlbnRpdHkoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LmlkZW50aXR5O1xuICAgIH0sXG4gICAgZ2V0IHJhbmRvbSgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQucmFuZG9tO1xuICAgIH0sXG4gICAgYXM6IHN1YkFzLFxuICAgIHdpdGhUeChib2R5KSB7XG4gICAgICByZXR1cm4gcnVuV2l0aFR4KCh0cykgPT4ge1xuICAgICAgICBjb25zdCB0eCA9IG5ldyBSZWR1Y2VyQ3R4SW1wbChcbiAgICAgICAgICBwYXJlbnQuc2VuZGVyLFxuICAgICAgICAgIHRzLFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICAgbnNEYl8gPz89IGJ1aWxkRGJWaWV3Rm9yRGlzcGF0Y2goXG4gICAgICAgICAgICBkaXNwYXRjaCxcbiAgICAgICAgICAgIG5hbWVQcmVmaXhcbiAgICAgICAgICApLFxuICAgICAgICAgIGhvc3RCYWNrZW5kLFxuICAgICAgICAgIEhhbmRsZXJDb250ZXh0SW1wbC5zZW5kZXJBdXRoKHBhcmVudClcbiAgICAgICAgKTtcbiAgICAgICAgYXNzaWduVHhBbGlhc1ZpZXdzKHR4LCBkaXNwYXRjaC5zdWJEaXNwYXRjaGVzLCBuYW1lUHJlZml4KTtcbiAgICAgICAgcmV0dXJuIHR4O1xuICAgICAgfSwgYm9keSk7XG4gICAgfSxcbiAgICBuZXdVdWlkVjQoKSB7XG4gICAgICByZXR1cm4gcGFyZW50Lm5ld1V1aWRWNCgpO1xuICAgIH0sXG4gICAgbmV3VXVpZFY3KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5uZXdVdWlkVjcoKTtcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBidWlsZEhhbmRsZXJBbGlhc0N0eE1hcChwYXJlbnQsIGRpc3BhdGNoZXMsIHBhcmVudFByZWZpeCkge1xuICByZXR1cm4gZnJlZXplKFxuICAgIE9iamVjdC5mcm9tRW50cmllcyhcbiAgICAgIGRpc3BhdGNoZXMubWFwKChkKSA9PiBbXG4gICAgICAgIGQubmFtZXNwYWNlLFxuICAgICAgICBidWlsZEhhbmRsZXJBbGlhc0N0eChwYXJlbnQsIGQsIHBhcmVudFByZWZpeCArIGQubmFtZXNwYWNlICsgXCIuXCIpXG4gICAgICBdKVxuICAgIClcbiAgKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkUHJvY2VkdXJlQWxpYXNDdHgocGFyZW50LCBkaXNwYXRjaCwgbmFtZVByZWZpeCkge1xuICBsZXQgbnNEYl87XG4gIGNvbnN0IHN1YkFzID0gYnVpbGRQcm9jZWR1cmVBbGlhc0N0eE1hcChcbiAgICBwYXJlbnQsXG4gICAgZGlzcGF0Y2guc3ViRGlzcGF0Y2hlcyxcbiAgICBuYW1lUHJlZml4XG4gICk7XG4gIHJldHVybiB7XG4gICAgZ2V0IHNlbmRlcigpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuc2VuZGVyO1xuICAgIH0sXG4gICAgZ2V0IGRhdGFiYXNlSWRlbnRpdHkoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LmRhdGFiYXNlSWRlbnRpdHk7XG4gICAgfSxcbiAgICBnZXQgaWRlbnRpdHkoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LmlkZW50aXR5O1xuICAgIH0sXG4gICAgZ2V0IHRpbWVzdGFtcCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQudGltZXN0YW1wO1xuICAgIH0sXG4gICAgZ2V0IGNvbm5lY3Rpb25JZCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuY29ubmVjdGlvbklkO1xuICAgIH0sXG4gICAgZ2V0IGh0dHAoKSB7XG4gICAgICByZXR1cm4gcGFyZW50Lmh0dHA7XG4gICAgfSxcbiAgICBnZXQgcmFuZG9tKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5yYW5kb207XG4gICAgfSxcbiAgICBzbGVlcChkdXJhdGlvbikge1xuICAgICAgcmV0dXJuIHBhcmVudC5zbGVlcChkdXJhdGlvbik7XG4gICAgfSxcbiAgICBhczogc3ViQXMsXG4gICAgd2l0aFR4KGJvZHkpIHtcbiAgICAgIHJldHVybiBydW5XaXRoVHgoKHRzKSA9PiB7XG4gICAgICAgIGNvbnN0IHR4ID0gbmV3IFJlZHVjZXJDdHhJbXBsKFxuICAgICAgICAgIHBhcmVudC5zZW5kZXIsXG4gICAgICAgICAgdHMsXG4gICAgICAgICAgcGFyZW50LmNvbm5lY3Rpb25JZCxcbiAgICAgICAgICBuc0RiXyA/Pz0gYnVpbGREYlZpZXdGb3JEaXNwYXRjaChcbiAgICAgICAgICAgIGRpc3BhdGNoLFxuICAgICAgICAgICAgbmFtZVByZWZpeFxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgICAgYXNzaWduVHhBbGlhc1ZpZXdzKHR4LCBkaXNwYXRjaC5zdWJEaXNwYXRjaGVzLCBuYW1lUHJlZml4KTtcbiAgICAgICAgcmV0dXJuIHR4O1xuICAgICAgfSwgYm9keSk7XG4gICAgfSxcbiAgICBuZXdVdWlkVjQoKSB7XG4gICAgICByZXR1cm4gcGFyZW50Lm5ld1V1aWRWNCgpO1xuICAgIH0sXG4gICAgbmV3VXVpZFY3KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5uZXdVdWlkVjcoKTtcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBidWlsZFByb2NlZHVyZUFsaWFzQ3R4TWFwKHBhcmVudCwgZGlzcGF0Y2hlcywgcGFyZW50UHJlZml4KSB7XG4gIHJldHVybiBmcmVlemUoXG4gICAgT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgZGlzcGF0Y2hlcy5tYXAoKGQpID0+IFtcbiAgICAgICAgZC5uYW1lc3BhY2UsXG4gICAgICAgIGJ1aWxkUHJvY2VkdXJlQWxpYXNDdHgocGFyZW50LCBkLCBwYXJlbnRQcmVmaXggKyBkLm5hbWVzcGFjZSArIFwiLlwiKVxuICAgICAgXSlcbiAgICApXG4gICk7XG59XG5mdW5jdGlvbiBhc3NpZ25UeEFsaWFzVmlld3ModHgsIGRpc3BhdGNoZXMsIHBhcmVudFByZWZpeCA9IFwiXCIpIHtcbiAgaWYgKGRpc3BhdGNoZXMubGVuZ3RoID4gMCkge1xuICAgIHR4LmFzID0gYnVpbGRBbGlhc0N0eE1hcCh0eCwgZGlzcGF0Y2hlcywgcGFyZW50UHJlZml4KTtcbiAgfVxufVxuZnVuY3Rpb24gbWFrZVRhYmxlVmlldyh0eXBlc3BhY2UsIHRhYmxlMiwgYmFja2VuZE9yTmFtZVByZWZpeCA9IGhvc3RCYWNrZW5kLCBuYW1lUHJlZml4ID0gXCJcIiwgaXNPdXRib3ggPSBmYWxzZSkge1xuICBjb25zdCBiYWNrZW5kID0gaXNEYXRhc3RvcmVCYWNrZW5kKGJhY2tlbmRPck5hbWVQcmVmaXgpID8gYmFja2VuZE9yTmFtZVByZWZpeCA6IGhvc3RCYWNrZW5kO1xuICBpZiAodHlwZW9mIGJhY2tlbmRPck5hbWVQcmVmaXggPT09IFwic3RyaW5nXCIpIHtcbiAgICBuYW1lUHJlZml4ID0gYmFja2VuZE9yTmFtZVByZWZpeDtcbiAgfVxuICBjb25zdCB0YWJsZV9pZCA9IGJhY2tlbmQudGFibGVJZEZyb21OYW1lKG5hbWVQcmVmaXggKyB0YWJsZTIuc291cmNlTmFtZSk7XG4gIGNvbnN0IHJvd1R5cGUgPSB0eXBlc3BhY2UudHlwZXNbdGFibGUyLnByb2R1Y3RUeXBlUmVmXTtcbiAgaWYgKHJvd1R5cGUudGFnICE9PSBcIlByb2R1Y3RcIikge1xuICAgIHRocm93IFwiaW1wb3NzaWJsZVwiO1xuICB9XG4gIGNvbnN0IHNlcmlhbGl6ZVJvdyA9IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIocm93VHlwZSwgdHlwZXNwYWNlKTtcbiAgY29uc3QgZGVzZXJpYWxpemVSb3cgPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIocm93VHlwZSwgdHlwZXNwYWNlKTtcbiAgY29uc3Qgc2VxdWVuY2VzID0gdGFibGUyLnNlcXVlbmNlcy5tYXAoKHNlcSkgPT4ge1xuICAgIGNvbnN0IGNvbCA9IHJvd1R5cGUudmFsdWUuZWxlbWVudHNbc2VxLmNvbHVtbl07XG4gICAgY29uc3QgY29sVHlwZSA9IGNvbC5hbGdlYnJhaWNUeXBlO1xuICAgIGxldCBzZXF1ZW5jZVRyaWdnZXI7XG4gICAgc3dpdGNoIChjb2xUeXBlLnRhZykge1xuICAgICAgY2FzZSBcIlU4XCI6XG4gICAgICBjYXNlIFwiSThcIjpcbiAgICAgIGNhc2UgXCJVMTZcIjpcbiAgICAgIGNhc2UgXCJJMTZcIjpcbiAgICAgIGNhc2UgXCJVMzJcIjpcbiAgICAgIGNhc2UgXCJJMzJcIjpcbiAgICAgICAgc2VxdWVuY2VUcmlnZ2VyID0gMDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwiVTY0XCI6XG4gICAgICBjYXNlIFwiSTY0XCI6XG4gICAgICBjYXNlIFwiVTEyOFwiOlxuICAgICAgY2FzZSBcIkkxMjhcIjpcbiAgICAgIGNhc2UgXCJVMjU2XCI6XG4gICAgICBjYXNlIFwiSTI1NlwiOlxuICAgICAgICBzZXF1ZW5jZVRyaWdnZXIgPSAwbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiaW52YWxpZCBzZXF1ZW5jZSB0eXBlXCIpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgY29sTmFtZTogY29sLm5hbWUsXG4gICAgICBzZXF1ZW5jZVRyaWdnZXIsXG4gICAgICBkZXNlcmlhbGl6ZTogQWxnZWJyYWljVHlwZS5tYWtlRGVzZXJpYWxpemVyKGNvbFR5cGUsIHR5cGVzcGFjZSlcbiAgICB9O1xuICB9KTtcbiAgY29uc3QgaGFzQXV0b0luY3JlbWVudCA9IHNlcXVlbmNlcy5sZW5ndGggPiAwO1xuICBjb25zdCBpdGVyID0gKCkgPT4gdGFibGVJdGVyYXRvcihcbiAgICBiYWNrZW5kLmRhdGFzdG9yZVRhYmxlU2NhbkJzYXRuKHRhYmxlX2lkKSxcbiAgICBkZXNlcmlhbGl6ZVJvdyxcbiAgICBiYWNrZW5kXG4gICk7XG4gIGNvbnN0IGludGVncmF0ZUdlbmVyYXRlZENvbHVtbnMgPSBoYXNBdXRvSW5jcmVtZW50ID8gKHJvdywgcmV0X2J1ZikgPT4ge1xuICAgIEJJTkFSWV9SRUFERVIucmVzZXQocmV0X2J1Zik7XG4gICAgZm9yIChjb25zdCB7IGNvbE5hbWUsIGRlc2VyaWFsaXplLCBzZXF1ZW5jZVRyaWdnZXIgfSBvZiBzZXF1ZW5jZXMpIHtcbiAgICAgIGlmIChyb3dbY29sTmFtZV0gPT09IHNlcXVlbmNlVHJpZ2dlcikge1xuICAgICAgICByb3dbY29sTmFtZV0gPSBkZXNlcmlhbGl6ZShCSU5BUllfUkVBREVSKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gOiBudWxsO1xuICBjb25zdCBnZW5lcmF0ZWRDb2x1bW5zVmlldyA9IChnZW5lcmF0ZWQsIGZhbGxiYWNrKSA9PiBnZW5lcmF0ZWQgaW5zdGFuY2VvZiBVaW50OEFycmF5ID8gbmV3IERhdGFWaWV3KFxuICAgIGdlbmVyYXRlZC5idWZmZXIsXG4gICAgZ2VuZXJhdGVkLmJ5dGVPZmZzZXQsXG4gICAgZ2VuZXJhdGVkLmJ5dGVMZW5ndGhcbiAgKSA6IGZhbGxiYWNrO1xuICBjb25zdCB0YWJsZU1ldGhvZHMgPSB7XG4gICAgY291bnQ6ICgpID0+IEJpZ0ludChiYWNrZW5kLmRhdGFzdG9yZVRhYmxlUm93Q291bnQodGFibGVfaWQpKSxcbiAgICBpdGVyLFxuICAgIFtTeW1ib2wuaXRlcmF0b3JdOiAoKSA9PiBpdGVyKCksXG4gICAgaW5zZXJ0OiAocm93KSA9PiB7XG4gICAgICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgICAgIEJJTkFSWV9XUklURVIucmVzZXQoYnVmKTtcbiAgICAgIHNlcmlhbGl6ZVJvdyhCSU5BUllfV1JJVEVSLCByb3cpO1xuICAgICAgY29uc3QgZ2VuZXJhdGVkID0gYmFja2VuZC5kYXRhc3RvcmVJbnNlcnRCc2F0bihcbiAgICAgICAgdGFibGVfaWQsXG4gICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgIEJJTkFSWV9XUklURVIub2Zmc2V0XG4gICAgICApO1xuICAgICAgY29uc3QgcmV0ID0geyAuLi5yb3cgfTtcbiAgICAgIGludGVncmF0ZUdlbmVyYXRlZENvbHVtbnM/LihcbiAgICAgICAgcmV0LFxuICAgICAgICBnZW5lcmF0ZWRDb2x1bW5zVmlldyhnZW5lcmF0ZWQsIGJ1Zi52aWV3KVxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXQ7XG4gICAgfSxcbiAgICBkZWxldGU6IChyb3cpID0+IHtcbiAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgQklOQVJZX1dSSVRFUi5yZXNldChidWYpO1xuICAgICAgQklOQVJZX1dSSVRFUi53cml0ZVUzMigxKTtcbiAgICAgIHNlcmlhbGl6ZVJvdyhCSU5BUllfV1JJVEVSLCByb3cpO1xuICAgICAgY29uc3QgY291bnQgPSBiYWNrZW5kLmRhdGFzdG9yZURlbGV0ZUFsbEJ5RXFCc2F0bihcbiAgICAgICAgdGFibGVfaWQsXG4gICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgIEJJTkFSWV9XUklURVIub2Zmc2V0XG4gICAgICApO1xuICAgICAgcmV0dXJuIGNvdW50ID4gMDtcbiAgICB9LFxuICAgIGNsZWFyOiAoKSA9PiB7XG4gICAgICBjb25zdCBjb3VudCA9IEJpZ0ludChiYWNrZW5kLmRhdGFzdG9yZVRhYmxlUm93Q291bnQodGFibGVfaWQpKTtcbiAgICAgIGJhY2tlbmQuZGF0YXN0b3JlQ2xlYXIodGFibGVfaWQpO1xuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH1cbiAgfTtcbiAgY29uc3QgdGFibGVWaWV3ID0gT2JqZWN0LmFzc2lnbihcbiAgICAvKiBAX19QVVJFX18gKi8gT2JqZWN0LmNyZWF0ZShudWxsKSxcbiAgICB0YWJsZU1ldGhvZHNcbiAgKTtcbiAgaWYgKGlzT3V0Ym94KSB7XG4gICAgUmVmbGVjdC5kZWxldGVQcm9wZXJ0eSh0YWJsZVZpZXcsIFwiZGVsZXRlXCIpO1xuICAgIFJlZmxlY3QuZGVsZXRlUHJvcGVydHkodGFibGVWaWV3LCBcImNsZWFyXCIpO1xuICB9XG4gIGZvciAoY29uc3QgaW5kZXhEZWYgb2YgdGFibGUyLmluZGV4ZXMpIHtcbiAgICBjb25zdCBhY2Nlc3Nvck5hbWUgPSBpbmRleERlZi5hY2Nlc3Nvck5hbWU7XG4gICAgY29uc3QgaW5kZXhfaWQgPSBiYWNrZW5kLmluZGV4SWRGcm9tTmFtZShuYW1lUHJlZml4ICsgaW5kZXhEZWYuc291cmNlTmFtZSk7XG4gICAgbGV0IGNvbHVtbl9pZHM7XG4gICAgbGV0IGlzSGFzaEluZGV4ID0gZmFsc2U7XG4gICAgc3dpdGNoIChpbmRleERlZi5hbGdvcml0aG0udGFnKSB7XG4gICAgICBjYXNlIFwiSGFzaFwiOlxuICAgICAgICBpc0hhc2hJbmRleCA9IHRydWU7XG4gICAgICAgIGNvbHVtbl9pZHMgPSBpbmRleERlZi5hbGdvcml0aG0udmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcIkJUcmVlXCI6XG4gICAgICAgIGNvbHVtbl9pZHMgPSBpbmRleERlZi5hbGdvcml0aG0udmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcIkRpcmVjdFwiOlxuICAgICAgICBjb2x1bW5faWRzID0gW2luZGV4RGVmLmFsZ29yaXRobS52YWx1ZV07XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBudW1Db2x1bW5zID0gY29sdW1uX2lkcy5sZW5ndGg7XG4gICAgY29uc3QgY29sdW1uU2V0ID0gbmV3IFNldChjb2x1bW5faWRzKTtcbiAgICBjb25zdCBpc1VuaXF1ZSA9IHRhYmxlMi5jb25zdHJhaW50cy5maWx0ZXIoKHgpID0+IHguZGF0YS50YWcgPT09IFwiVW5pcXVlXCIpLnNvbWUoKHgpID0+IHtcbiAgICAgIGNvbnN0IGNvbnN0cmFpbnRDb2x1bW5zID0gbmV3IFNldCh4LmRhdGEudmFsdWUuY29sdW1ucyk7XG4gICAgICByZXR1cm4gWy4uLmNvbHVtblNldF0uZXZlcnkoKGNvbHVtbikgPT4gY29uc3RyYWludENvbHVtbnMuaGFzKGNvbHVtbikpO1xuICAgIH0pO1xuICAgIGNvbnN0IGlzUHJpbWFyeUtleSA9IGlzVW5pcXVlICYmIGNvbHVtbl9pZHMubGVuZ3RoID09PSB0YWJsZTIucHJpbWFyeUtleS5sZW5ndGggJiYgY29sdW1uX2lkcy5ldmVyeSgoaWQsIGkpID0+IHRhYmxlMi5wcmltYXJ5S2V5W2ldID09PSBpZCk7XG4gICAgY29uc3QgaW5kZXhTZXJpYWxpemVycyA9IGNvbHVtbl9pZHMubWFwKFxuICAgICAgKGlkKSA9PiBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKFxuICAgICAgICByb3dUeXBlLnZhbHVlLmVsZW1lbnRzW2lkXS5hbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgIClcbiAgICApO1xuICAgIGNvbnN0IHNlcmlhbGl6ZVBvaW50ID0gKGJ1ZmZlciwgY29sVmFsKSA9PiB7XG4gICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1ZmZlcik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUNvbHVtbnM7IGkrKykge1xuICAgICAgICBpbmRleFNlcmlhbGl6ZXJzW2ldKEJJTkFSWV9XUklURVIsIGNvbFZhbFtpXSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gQklOQVJZX1dSSVRFUi5vZmZzZXQ7XG4gICAgfTtcbiAgICBjb25zdCBzZXJpYWxpemVTaW5nbGVFbGVtZW50ID0gbnVtQ29sdW1ucyA9PT0gMSA/IGluZGV4U2VyaWFsaXplcnNbMF0gOiBudWxsO1xuICAgIGNvbnN0IHNlcmlhbGl6ZVNpbmdsZVBvaW50ID0gc2VyaWFsaXplU2luZ2xlRWxlbWVudCAmJiAoKGJ1ZmZlciwgY29sVmFsKSA9PiB7XG4gICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1ZmZlcik7XG4gICAgICBzZXJpYWxpemVTaW5nbGVFbGVtZW50KEJJTkFSWV9XUklURVIsIGNvbFZhbCk7XG4gICAgICByZXR1cm4gQklOQVJZX1dSSVRFUi5vZmZzZXQ7XG4gICAgfSk7XG4gICAgbGV0IGluZGV4O1xuICAgIGlmIChpc1VuaXF1ZSAmJiBzZXJpYWxpemVTaW5nbGVQb2ludCkge1xuICAgICAgY29uc3QgYmFzZSA9IHtcbiAgICAgICAgZmluZDogKGNvbFZhbCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVNpbmdsZVBvaW50KGJ1ZiwgY29sVmFsKTtcbiAgICAgICAgICBjb25zdCBpdGVyX2lkID0gYmFja2VuZC5kYXRhc3RvcmVJbmRleFNjYW5Qb2ludEJzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRlT25lKGl0ZXJfaWQsIGRlc2VyaWFsaXplUm93LCBiYWNrZW5kKTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVsZXRlOiAoY29sVmFsKSA9PiB7XG4gICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplU2luZ2xlUG9pbnQoYnVmLCBjb2xWYWwpO1xuICAgICAgICAgIGNvbnN0IG51bSA9IGJhY2tlbmQuZGF0YXN0b3JlRGVsZXRlQnlJbmRleFNjYW5Qb2ludEJzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gbnVtID4gMDtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChpc1ByaW1hcnlLZXkpIHtcbiAgICAgICAgYmFzZS51cGRhdGUgPSAocm93KSA9PiB7XG4gICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgQklOQVJZX1dSSVRFUi5yZXNldChidWYpO1xuICAgICAgICAgIHNlcmlhbGl6ZVJvdyhCSU5BUllfV1JJVEVSLCByb3cpO1xuICAgICAgICAgIGNvbnN0IGdlbmVyYXRlZCA9IGJhY2tlbmQuZGF0YXN0b3JlVXBkYXRlQnNhdG4oXG4gICAgICAgICAgICB0YWJsZV9pZCxcbiAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgIEJJTkFSWV9XUklURVIub2Zmc2V0XG4gICAgICAgICAgKTtcbiAgICAgICAgICBpbnRlZ3JhdGVHZW5lcmF0ZWRDb2x1bW5zPy4oXG4gICAgICAgICAgICByb3csXG4gICAgICAgICAgICBnZW5lcmF0ZWRDb2x1bW5zVmlldyhnZW5lcmF0ZWQsIGJ1Zi52aWV3KVxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuIHJvdztcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGluZGV4ID0gYmFzZTtcbiAgICB9IGVsc2UgaWYgKGlzVW5pcXVlKSB7XG4gICAgICBjb25zdCBiYXNlID0ge1xuICAgICAgICBmaW5kOiAoY29sVmFsKSA9PiB7XG4gICAgICAgICAgaWYgKGNvbFZhbC5sZW5ndGggIT09IG51bUNvbHVtbnMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJ3cm9uZyBudW1iZXIgb2YgZWxlbWVudHNcIik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVBvaW50KGJ1ZiwgY29sVmFsKTtcbiAgICAgICAgICBjb25zdCBpdGVyX2lkID0gYmFja2VuZC5kYXRhc3RvcmVJbmRleFNjYW5Qb2ludEJzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRlT25lKGl0ZXJfaWQsIGRlc2VyaWFsaXplUm93LCBiYWNrZW5kKTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVsZXRlOiAoY29sVmFsKSA9PiB7XG4gICAgICAgICAgaWYgKGNvbFZhbC5sZW5ndGggIT09IG51bUNvbHVtbnMpXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwid3JvbmcgbnVtYmVyIG9mIGVsZW1lbnRzXCIpO1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVBvaW50KGJ1ZiwgY29sVmFsKTtcbiAgICAgICAgICBjb25zdCBudW0gPSBiYWNrZW5kLmRhdGFzdG9yZURlbGV0ZUJ5SW5kZXhTY2FuUG9pbnRCc2F0bihcbiAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgIHBvaW50X2xlblxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuIG51bSA+IDA7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpZiAoaXNQcmltYXJ5S2V5KSB7XG4gICAgICAgIGJhc2UudXBkYXRlID0gKHJvdykgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIEJJTkFSWV9XUklURVIucmVzZXQoYnVmKTtcbiAgICAgICAgICBzZXJpYWxpemVSb3coQklOQVJZX1dSSVRFUiwgcm93KTtcbiAgICAgICAgICBjb25zdCBnZW5lcmF0ZWQgPSBiYWNrZW5kLmRhdGFzdG9yZVVwZGF0ZUJzYXRuKFxuICAgICAgICAgICAgdGFibGVfaWQsXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBCSU5BUllfV1JJVEVSLm9mZnNldFxuICAgICAgICAgICk7XG4gICAgICAgICAgaW50ZWdyYXRlR2VuZXJhdGVkQ29sdW1ucz8uKFxuICAgICAgICAgICAgcm93LFxuICAgICAgICAgICAgZ2VuZXJhdGVkQ29sdW1uc1ZpZXcoZ2VuZXJhdGVkLCBidWYudmlldylcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiByb3c7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpbmRleCA9IGJhc2U7XG4gICAgfSBlbHNlIGlmIChzZXJpYWxpemVTaW5nbGVQb2ludCkge1xuICAgICAgY29uc3Qgc2VyaWFsaXplU2luZ2xlUmFuZ2UgPSAhaXNIYXNoSW5kZXggPyAoYnVmZmVyLCByYW5nZSkgPT4ge1xuICAgICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1ZmZlcik7XG4gICAgICAgIGNvbnN0IHdyaXRlciA9IEJJTkFSWV9XUklURVI7XG4gICAgICAgIGNvbnN0IHdyaXRlQm91bmQgPSAoYm91bmQpID0+IHtcbiAgICAgICAgICBjb25zdCB0YWdzID0geyBpbmNsdWRlZDogMCwgZXhjbHVkZWQ6IDEsIHVuYm91bmRlZDogMiB9O1xuICAgICAgICAgIHdyaXRlci53cml0ZVU4KHRhZ3NbYm91bmQudGFnXSk7XG4gICAgICAgICAgaWYgKGJvdW5kLnRhZyAhPT0gXCJ1bmJvdW5kZWRcIilcbiAgICAgICAgICAgIHNlcmlhbGl6ZVNpbmdsZUVsZW1lbnQod3JpdGVyLCBib3VuZC52YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHdyaXRlQm91bmQocmFuZ2UuZnJvbSk7XG4gICAgICAgIGNvbnN0IHJzdGFydExlbiA9IHdyaXRlci5vZmZzZXQ7XG4gICAgICAgIHdyaXRlQm91bmQocmFuZ2UudG8pO1xuICAgICAgICBjb25zdCByZW5kTGVuID0gd3JpdGVyLm9mZnNldCAtIHJzdGFydExlbjtcbiAgICAgICAgcmV0dXJuIFswLCAwLCByc3RhcnRMZW4sIHJlbmRMZW5dO1xuICAgICAgfSA6IG51bGw7XG4gICAgICBjb25zdCByYXdJbmRleCA9IHtcbiAgICAgICAgZmlsdGVyOiAocmFuZ2UpID0+IHtcbiAgICAgICAgICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgICAgICAgICBpZiAoc2VyaWFsaXplU2luZ2xlUmFuZ2UgJiYgcmFuZ2UgaW5zdGFuY2VvZiBSYW5nZSkge1xuICAgICAgICAgICAgY29uc3QgYXJncyA9IHNlcmlhbGl6ZVNpbmdsZVJhbmdlKGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgICAgY29uc3QgaXRlcl9pZDIgPSBiYWNrZW5kLmRhdGFzdG9yZUluZGV4U2NhblJhbmdlQnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICAuLi5hcmdzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHRhYmxlSXRlcmF0b3IoaXRlcl9pZDIsIGRlc2VyaWFsaXplUm93LCBiYWNrZW5kKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplU2luZ2xlUG9pbnQoYnVmLCByYW5nZSk7XG4gICAgICAgICAgY29uc3QgaXRlcl9pZCA9IGJhY2tlbmQuZGF0YXN0b3JlSW5kZXhTY2FuUG9pbnRCc2F0bihcbiAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgIHBvaW50X2xlblxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlSXRlcmF0b3IoaXRlcl9pZCwgZGVzZXJpYWxpemVSb3csIGJhY2tlbmQpO1xuICAgICAgICB9LFxuICAgICAgICBkZWxldGU6IChyYW5nZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGlmIChzZXJpYWxpemVTaW5nbGVSYW5nZSAmJiByYW5nZSBpbnN0YW5jZW9mIFJhbmdlKSB7XG4gICAgICAgICAgICBjb25zdCBhcmdzID0gc2VyaWFsaXplU2luZ2xlUmFuZ2UoYnVmLCByYW5nZSk7XG4gICAgICAgICAgICByZXR1cm4gYmFja2VuZC5kYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblJhbmdlQnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICAuLi5hcmdzXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBwb2ludF9sZW4gPSBzZXJpYWxpemVTaW5nbGVQb2ludChidWYsIHJhbmdlKTtcbiAgICAgICAgICByZXR1cm4gYmFja2VuZC5kYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGlzSGFzaEluZGV4KSB7XG4gICAgICAgIGluZGV4ID0gcmF3SW5kZXg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmRleCA9IHJhd0luZGV4O1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNIYXNoSW5kZXgpIHtcbiAgICAgIGluZGV4ID0ge1xuICAgICAgICBmaWx0ZXI6IChyYW5nZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVBvaW50KGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgIGNvbnN0IGl0ZXJfaWQgPSBiYWNrZW5kLmRhdGFzdG9yZUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiB0YWJsZUl0ZXJhdG9yKGl0ZXJfaWQsIGRlc2VyaWFsaXplUm93LCBiYWNrZW5kKTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVsZXRlOiAocmFuZ2UpID0+IHtcbiAgICAgICAgICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgICAgICAgICBjb25zdCBwb2ludF9sZW4gPSBzZXJpYWxpemVQb2ludChidWYsIHJhbmdlKTtcbiAgICAgICAgICByZXR1cm4gYmFja2VuZC5kYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBpc0NvbXBsZXRlU2NhbGFyS2V5ID0gKHJhbmdlKSA9PiB7XG4gICAgICAgIHJldHVybiByYW5nZS5sZW5ndGggPT09IG51bUNvbHVtbnMgJiYgIShyYW5nZVtyYW5nZS5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIFJhbmdlKTtcbiAgICAgIH07XG4gICAgICBjb25zdCBzZXJpYWxpemVSYW5nZSA9IChidWZmZXIsIHJhbmdlKSA9PiB7XG4gICAgICAgIGlmIChyYW5nZS5sZW5ndGggPiBudW1Db2x1bW5zKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwidG9vIG1hbnkgZWxlbWVudHNcIik7XG4gICAgICAgIEJJTkFSWV9XUklURVIucmVzZXQoYnVmZmVyKTtcbiAgICAgICAgY29uc3Qgd3JpdGVyID0gQklOQVJZX1dSSVRFUjtcbiAgICAgICAgY29uc3QgcHJlZml4X2VsZW1zID0gcmFuZ2UubGVuZ3RoIC0gMTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVmaXhfZWxlbXM7IGkrKykge1xuICAgICAgICAgIGluZGV4U2VyaWFsaXplcnNbaV0od3JpdGVyLCByYW5nZVtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcnN0YXJ0T2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcbiAgICAgICAgY29uc3QgdGVybSA9IHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdO1xuICAgICAgICBjb25zdCBzZXJpYWxpemVUZXJtID0gaW5kZXhTZXJpYWxpemVyc1tyYW5nZS5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKHRlcm0gaW5zdGFuY2VvZiBSYW5nZSkge1xuICAgICAgICAgIGNvbnN0IHdyaXRlQm91bmQgPSAoYm91bmQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRhZ3MgPSB7IGluY2x1ZGVkOiAwLCBleGNsdWRlZDogMSwgdW5ib3VuZGVkOiAyIH07XG4gICAgICAgICAgICB3cml0ZXIud3JpdGVVOCh0YWdzW2JvdW5kLnRhZ10pO1xuICAgICAgICAgICAgaWYgKGJvdW5kLnRhZyAhPT0gXCJ1bmJvdW5kZWRcIikgc2VyaWFsaXplVGVybSh3cml0ZXIsIGJvdW5kLnZhbHVlKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHdyaXRlQm91bmQodGVybS5mcm9tKTtcbiAgICAgICAgICBjb25zdCByc3RhcnRMZW4gPSB3cml0ZXIub2Zmc2V0IC0gcnN0YXJ0T2Zmc2V0O1xuICAgICAgICAgIHdyaXRlQm91bmQodGVybS50byk7XG4gICAgICAgICAgY29uc3QgcmVuZExlbiA9IHdyaXRlci5vZmZzZXQgLSByc3RhcnRPZmZzZXQgLSByc3RhcnRMZW47XG4gICAgICAgICAgcmV0dXJuIFtyc3RhcnRPZmZzZXQsIHByZWZpeF9lbGVtcywgcnN0YXJ0TGVuLCByZW5kTGVuXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVVOCgwKTtcbiAgICAgICAgICBzZXJpYWxpemVUZXJtKHdyaXRlciwgdGVybSk7XG4gICAgICAgICAgY29uc3QgcnN0YXJ0TGVuID0gd3JpdGVyLm9mZnNldCAtIHJzdGFydE9mZnNldDtcbiAgICAgICAgICBjb25zdCByZW5kTGVuID0gMDtcbiAgICAgICAgICByZXR1cm4gW3JzdGFydE9mZnNldCwgcHJlZml4X2VsZW1zLCByc3RhcnRMZW4sIHJlbmRMZW5dO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaW5kZXggPSB7XG4gICAgICAgIGZpbHRlcjogKHJhbmdlKSA9PiB7XG4gICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHJhbmdlKSkgcmFuZ2UgPSBbcmFuZ2VdO1xuICAgICAgICAgIGlmIChpc0NvbXBsZXRlU2NhbGFyS2V5KHJhbmdlKSkge1xuICAgICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgICBjb25zdCBwb2ludF9sZW4gPSBzZXJpYWxpemVQb2ludChidWYsIHJhbmdlKTtcbiAgICAgICAgICAgIGNvbnN0IGl0ZXJfaWQgPSBiYWNrZW5kLmRhdGFzdG9yZUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRvcihpdGVyX2lkLCBkZXNlcmlhbGl6ZVJvdywgYmFja2VuZCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgICAgY29uc3QgYXJncyA9IHNlcmlhbGl6ZVJhbmdlKGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgICAgY29uc3QgaXRlcl9pZCA9IGJhY2tlbmQuZGF0YXN0b3JlSW5kZXhTY2FuUmFuZ2VCc2F0bihcbiAgICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICAgIC4uLmFyZ3NcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRvcihpdGVyX2lkLCBkZXNlcmlhbGl6ZVJvdywgYmFja2VuZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBkZWxldGU6IChyYW5nZSkgPT4ge1xuICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShyYW5nZSkpIHJhbmdlID0gW3JhbmdlXTtcbiAgICAgICAgICBpZiAoaXNDb21wbGV0ZVNjYWxhcktleShyYW5nZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplUG9pbnQoYnVmLCByYW5nZSk7XG4gICAgICAgICAgICByZXR1cm4gYmFja2VuZC5kYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgICAgY29uc3QgYXJncyA9IHNlcmlhbGl6ZVJhbmdlKGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgICAgcmV0dXJuIGJhY2tlbmQuZGF0YXN0b3JlRGVsZXRlQnlJbmRleFNjYW5SYW5nZUJzYXRuKFxuICAgICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgICAgLi4uYXJnc1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIGlmIChpc091dGJveCkge1xuICAgICAgUmVmbGVjdC5kZWxldGVQcm9wZXJ0eShpbmRleCwgXCJkZWxldGVcIik7XG4gICAgICBSZWZsZWN0LmRlbGV0ZVByb3BlcnR5KGluZGV4LCBcInVwZGF0ZVwiKTtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5oYXNPd24odGFibGVWaWV3LCBhY2Nlc3Nvck5hbWUpKSB7XG4gICAgICBmcmVlemUoT2JqZWN0LmFzc2lnbih0YWJsZVZpZXdbYWNjZXNzb3JOYW1lXSwgaW5kZXgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFibGVWaWV3W2FjY2Vzc29yTmFtZV0gPSBmcmVlemUoaW5kZXgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZnJlZXplKHRhYmxlVmlldyk7XG59XG5mdW5jdGlvbiogdGFibGVJdGVyYXRvcihpZCwgZGVzZXJpYWxpemUsIGJhY2tlbmQgPSBob3N0QmFja2VuZCkge1xuICBjb25zdCBpdGVyID0gbmV3IEl0ZXJhdG9ySGFuZGxlKGlkLCBiYWNrZW5kKTtcbiAgY29uc3QgaXRlckJ1ZiA9IHRha2VCdWYoKTtcbiAgdHJ5IHtcbiAgICBsZXQgYW10O1xuICAgIHdoaWxlIChhbXQgPSBpdGVyLmFkdmFuY2UoaXRlckJ1ZikpIHtcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBCaW5hcnlSZWFkZXIoaXRlckJ1Zi52aWV3KTtcbiAgICAgIHdoaWxlIChyZWFkZXIub2Zmc2V0IDwgYW10KSB7XG4gICAgICAgIHlpZWxkIGRlc2VyaWFsaXplKHJlYWRlcik7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIGl0ZXJbU3ltYm9sLmRpc3Bvc2VdKCk7XG4gICAgcmV0dXJuQnVmKGl0ZXJCdWYpO1xuICB9XG59XG5mdW5jdGlvbiB0YWJsZUl0ZXJhdGVPbmUoaWQsIGRlc2VyaWFsaXplLCBiYWNrZW5kID0gaG9zdEJhY2tlbmQpIHtcbiAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gIGNvbnN0IHJldCA9IGFkdmFuY2VJdGVyUmF3KGlkLCBidWYsIGJhY2tlbmQpO1xuICBpZiAocmV0ICE9PSAwKSB7XG4gICAgQklOQVJZX1JFQURFUi5yZXNldChidWYudmlldyk7XG4gICAgcmV0dXJuIGRlc2VyaWFsaXplKEJJTkFSWV9SRUFERVIpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuZnVuY3Rpb24gYWR2YW5jZUl0ZXJSYXcoaWQsIGJ1ZiwgYmFja2VuZCA9IGhvc3RCYWNrZW5kKSB7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiAwIHwgYmFja2VuZC5yb3dJdGVyQnNhdG5BZHZhbmNlKGlkLCBidWYuYnVmZmVyKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSAmJiB0eXBlb2YgZSA9PT0gXCJvYmplY3RcIiAmJiBoYXNPd24oZSwgXCJfX2J1ZmZlcl90b29fc21hbGxfX1wiKSkge1xuICAgICAgICBidWYuZ3JvdyhlLl9fYnVmZmVyX3Rvb19zbWFsbF9fKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxufVxudmFyIERFRkFVTFRfQlVGRkVSX0NBUEFDSVRZID0gMzIgKiAxMDI0ICogMjtcbnZhciBJVEVSX0JVRlMgPSBbXG4gIG5ldyBSZXNpemFibGVCdWZmZXIoREVGQVVMVF9CVUZGRVJfQ0FQQUNJVFkpXG5dO1xudmFyIElURVJfQlVGX0NPVU5UID0gMTtcbmZ1bmN0aW9uIHRha2VCdWYoKSB7XG4gIHJldHVybiBJVEVSX0JVRl9DT1VOVCA/IElURVJfQlVGU1stLUlURVJfQlVGX0NPVU5UXSA6IG5ldyBSZXNpemFibGVCdWZmZXIoREVGQVVMVF9CVUZGRVJfQ0FQQUNJVFkpO1xufVxuZnVuY3Rpb24gcmV0dXJuQnVmKGJ1Zikge1xuICBJVEVSX0JVRlNbSVRFUl9CVUZfQ09VTlQrK10gPSBidWY7XG59XG52YXIgTEVBRl9CVUYgPSBuZXcgUmVzaXphYmxlQnVmZmVyKERFRkFVTFRfQlVGRkVSX0NBUEFDSVRZKTtcbnZhciBJdGVyYXRvckhhbmRsZSA9IGNsYXNzIF9JdGVyYXRvckhhbmRsZSB7XG4gICNpZDtcbiAgI2JhY2tlbmQ7XG4gIHN0YXRpYyAjZmluYWxpemF0aW9uUmVnaXN0cnkgPSBuZXcgRmluYWxpemF0aW9uUmVnaXN0cnkoKHsgaWQsIGJhY2tlbmQgfSkgPT4gYmFja2VuZC5yb3dJdGVyQnNhdG5DbG9zZShpZCkpO1xuICBjb25zdHJ1Y3RvcihpZCwgYmFja2VuZCA9IGhvc3RCYWNrZW5kKSB7XG4gICAgdGhpcy4jaWQgPSBpZDtcbiAgICB0aGlzLiNiYWNrZW5kID0gYmFja2VuZDtcbiAgICBfSXRlcmF0b3JIYW5kbGUuI2ZpbmFsaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMsIHsgaWQsIGJhY2tlbmQgfSwgdGhpcyk7XG4gIH1cbiAgLyoqIFVucmVnaXN0ZXIgdGhpcyBvYmplY3Qgd2l0aCB0aGUgZmluYWxpemF0aW9uIHJlZ2lzdHJ5IGFuZCByZXR1cm4gdGhlIGlkICovXG4gICNkZXRhY2goKSB7XG4gICAgY29uc3QgaWQgPSB0aGlzLiNpZDtcbiAgICB0aGlzLiNpZCA9IC0xO1xuICAgIF9JdGVyYXRvckhhbmRsZS4jZmluYWxpemF0aW9uUmVnaXN0cnkudW5yZWdpc3Rlcih0aGlzKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqIENhbGwgYHJvd19pdGVyX2JzYXRuX2FkdmFuY2VgLCByZXR1cm5pbmcgMCBpZiB0aGlzIGl0ZXJhdG9yIGhhcyBiZWVuIGV4aGF1c3RlZC4gKi9cbiAgYWR2YW5jZShidWYpIHtcbiAgICBpZiAodGhpcy4jaWQgPT09IC0xKSByZXR1cm4gMDtcbiAgICBjb25zdCByZXQgPSBhZHZhbmNlSXRlclJhdyh0aGlzLiNpZCwgYnVmLCB0aGlzLiNiYWNrZW5kKTtcbiAgICBpZiAocmV0IDw9IDApIHRoaXMuI2RldGFjaCgpO1xuICAgIHJldHVybiByZXQgPCAwID8gLXJldCA6IHJldDtcbiAgfVxuICBbU3ltYm9sLmRpc3Bvc2VdKCkge1xuICAgIGlmICh0aGlzLiNpZCA+PSAwKSB7XG4gICAgICBjb25zdCBpZCA9IHRoaXMuI2RldGFjaCgpO1xuICAgICAgdGhpcy4jYmFja2VuZC5yb3dJdGVyQnNhdG5DbG9zZShpZCk7XG4gICAgfVxuICB9XG59O1xuXG4vLyBzcmMvc2VydmVyL2h0dHBfaW50ZXJuYWwudHNcbnZhciB7IGZyZWV6ZTogZnJlZXplMiB9ID0gT2JqZWN0O1xudmFyIHJlcXVlc3RCYXNlU2l6ZSA9IGJzYXRuQmFzZVNpemUoeyB0eXBlczogW10gfSwgSHR0cFJlcXVlc3QuYWxnZWJyYWljVHlwZSk7XG5mdW5jdGlvbiBmZXRjaCh1cmwsIGluaXQgPSB7fSkge1xuICBjb25zdCBtZXRob2QgPSBzZXJpYWxpemVNZXRob2QoaW5pdC5tZXRob2QpO1xuICBjb25zdCBoZWFkZXJzID0gc2VyaWFsaXplSGVhZGVycyhuZXcgSGVhZGVycyhpbml0LmhlYWRlcnMpKTtcbiAgY29uc3QgdXJpID0gXCJcIiArIHVybDtcbiAgY29uc3QgcmVxdWVzdCA9IGZyZWV6ZTIoe1xuICAgIG1ldGhvZCxcbiAgICBoZWFkZXJzLFxuICAgIHRpbWVvdXQ6IGluaXQudGltZW91dCxcbiAgICB1cmksXG4gICAgdmVyc2lvbjogeyB0YWc6IFwiSHR0cDExXCIgfVxuICB9KTtcbiAgY29uc3QgcmVxdWVzdEJ1ZiA9IG5ldyBCaW5hcnlXcml0ZXIocmVxdWVzdEJhc2VTaXplKTtcbiAgSHR0cFJlcXVlc3Quc2VyaWFsaXplKHJlcXVlc3RCdWYsIHJlcXVlc3QpO1xuICBjb25zdCBib2R5ID0gaW5pdC5ib2R5ID09IG51bGwgPyBuZXcgVWludDhBcnJheSgpIDogdHlwZW9mIGluaXQuYm9keSA9PT0gXCJzdHJpbmdcIiA/IGluaXQuYm9keSA6IG5ldyBVaW50OEFycmF5KGluaXQuYm9keSk7XG4gIGNvbnN0IFtyZXNwb25zZUJ1ZiwgcmVzcG9uc2VCb2R5XSA9IHN5czIucHJvY2VkdXJlX2h0dHBfcmVxdWVzdChcbiAgICByZXF1ZXN0QnVmLmdldEJ1ZmZlcigpLFxuICAgIGJvZHlcbiAgKTtcbiAgY29uc3QgcmVzcG9uc2UgPSBIdHRwUmVzcG9uc2UuZGVzZXJpYWxpemUobmV3IEJpbmFyeVJlYWRlcihyZXNwb25zZUJ1ZikpO1xuICByZXR1cm4gU3luY1Jlc3BvbnNlW21ha2VSZXNwb25zZV0ocmVzcG9uc2VCb2R5LCB7XG4gICAgdHlwZTogXCJiYXNpY1wiLFxuICAgIHVybDogdXJpLFxuICAgIHN0YXR1czogcmVzcG9uc2UuY29kZSxcbiAgICAvLyBgc3RhdHVzKGNvZGUpYCB0aHJvd3MgZm9yIGNvZGVzIGl0IGRvZXNuJ3Qga25vdywgbGlrZSBDbG91ZGZsYXJlJ3MgNTMwLlxuICAgIHN0YXR1c1RleHQ6IGltcG9ydF9zdGF0dXNlcy5kZWZhdWx0Lm1lc3NhZ2VbcmVzcG9uc2UuY29kZV0gPz8gXCJcIixcbiAgICBoZWFkZXJzOiBkZXNlcmlhbGl6ZUhlYWRlcnMocmVzcG9uc2UuaGVhZGVycyksXG4gICAgYWJvcnRlZDogZmFsc2UsXG4gICAgdmVyc2lvbjogcmVzcG9uc2UudmVyc2lvblxuICB9KTtcbn1cbmZyZWV6ZTIoZmV0Y2gpO1xudmFyIGh0dHBDbGllbnQgPSBmcmVlemUyKHsgZmV0Y2ggfSk7XG5cbi8vIHNyYy9zZXJ2ZXIvcHJvY2VkdXJlcy50c1xuZnVuY3Rpb24gbWFrZVByb2NlZHVyZUV4cG9ydChjdHgsIG9wdHMsIHBhcmFtcywgcmV0LCBmbikge1xuICBjb25zdCBuYW1lID0gb3B0cz8ubmFtZTtcbiAgY29uc3QgcHJvY2VkdXJlRXhwb3J0ID0gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xuICBwcm9jZWR1cmVFeHBvcnRbZXhwb3J0Q29udGV4dF0gPSBjdHg7XG4gIHByb2NlZHVyZUV4cG9ydFtyZWdpc3RlckV4cG9ydF0gPSAoY3R4MiwgZXhwb3J0TmFtZSkgPT4ge1xuICAgIHJlZ2lzdGVyUHJvY2VkdXJlKGN0eDIsIG5hbWUgPz8gZXhwb3J0TmFtZSwgcGFyYW1zLCByZXQsIGZuKTtcbiAgICBjdHgyLmZ1bmN0aW9uRXhwb3J0cy5zZXQoXG4gICAgICBwcm9jZWR1cmVFeHBvcnQsXG4gICAgICBuYW1lID8/IGV4cG9ydE5hbWVcbiAgICApO1xuICAgIGlmIChvcHRzPy5vblNjaGVkdWxlICE9PSB2b2lkIDApIHtcbiAgICAgIGN0eDIucGVuZGluZ1NjaGVkdWxlcy5wdXNoKHtcbiAgICAgICAgdGFibGU6IG9wdHMub25TY2hlZHVsZSxcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBuYW1lID8/IGV4cG9ydE5hbWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIHByb2NlZHVyZUV4cG9ydDtcbn1cbmZ1bmN0aW9uIHJlZ2lzdGVyUHJvY2VkdXJlKGN0eCwgZXhwb3J0TmFtZSwgcGFyYW1zLCByZXQsIGZuLCBvcHRzKSB7XG4gIGN0eC5kZWZpbmVGdW5jdGlvbihleHBvcnROYW1lKTtcbiAgY29uc3QgcGFyYW1zVHlwZSA9IHtcbiAgICBlbGVtZW50czogT2JqZWN0LmVudHJpZXMocGFyYW1zKS5tYXAoKFtuLCBjXSkgPT4gKHtcbiAgICAgIG5hbWU6IG4sXG4gICAgICBhbGdlYnJhaWNUeXBlOiBjdHgucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KFxuICAgICAgICBcInR5cGVCdWlsZGVyXCIgaW4gYyA/IGMudHlwZUJ1aWxkZXIgOiBjXG4gICAgICApLmFsZ2VicmFpY1R5cGVcbiAgICB9KSlcbiAgfTtcbiAgY29uc3QgcmV0dXJuVHlwZSA9IGN0eC5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkocmV0KS5hbGdlYnJhaWNUeXBlO1xuICBjdHgubW9kdWxlRGVmLnByb2NlZHVyZXMucHVzaCh7XG4gICAgc291cmNlTmFtZTogZXhwb3J0TmFtZSxcbiAgICBwYXJhbXM6IHBhcmFtc1R5cGUsXG4gICAgcmV0dXJuVHlwZSxcbiAgICB2aXNpYmlsaXR5OiBGdW5jdGlvblZpc2liaWxpdHkuQ2xpZW50Q2FsbGFibGVcbiAgfSk7XG4gIGNvbnN0IHsgdHlwZXNwYWNlIH0gPSBjdHg7XG4gIGN0eC5wcm9jZWR1cmVzLnB1c2goe1xuICAgIGZuLFxuICAgIGRlc2VyaWFsaXplQXJnczogUHJvZHVjdFR5cGUubWFrZURlc2VyaWFsaXplcihwYXJhbXNUeXBlLCB0eXBlc3BhY2UpLFxuICAgIHNlcmlhbGl6ZVJldHVybjogQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihyZXR1cm5UeXBlLCB0eXBlc3BhY2UpLFxuICAgIHJldHVyblR5cGVCYXNlU2l6ZTogYnNhdG5CYXNlU2l6ZSh0eXBlc3BhY2UsIHJldHVyblR5cGUpXG4gIH0pO1xufVxuZnVuY3Rpb24gY2FsbFByb2NlZHVyZShwcm9jZWR1cmVzLCBpZCwgc2VuZGVyLCBjb25uZWN0aW9uSWQsIHRpbWVzdGFtcCwgYXJnc0J1ZiwgZGJWaWV3LCBkaXNwYXRjaGVzID0gW10sIHBhcmVudFByZWZpeCA9IFwiXCIpIHtcbiAgY29uc3QgeyBmbiwgZGVzZXJpYWxpemVBcmdzLCBzZXJpYWxpemVSZXR1cm4sIHJldHVyblR5cGVCYXNlU2l6ZSB9ID0gcHJvY2VkdXJlc1tpZF07XG4gIGNvbnN0IGFyZ3MgPSBkZXNlcmlhbGl6ZUFyZ3MobmV3IEJpbmFyeVJlYWRlcihhcmdzQnVmKSk7XG4gIGNvbnN0IGN0eCA9IG5ldyBQcm9jZWR1cmVDdHhJbXBsKFxuICAgIHNlbmRlcixcbiAgICB0aW1lc3RhbXAsXG4gICAgY29ubmVjdGlvbklkLFxuICAgIGRiVmlldyxcbiAgICBob3N0QmFja2VuZCxcbiAgICBodHRwQ2xpZW50LFxuICAgIHZvaWQgMCxcbiAgICB2b2lkIDAsXG4gICAgdm9pZCAwLFxuICAgIGRpc3BhdGNoZXMsXG4gICAgcGFyZW50UHJlZml4XG4gICk7XG4gIGNvbnN0IHJldCA9IGNhbGxVc2VyRnVuY3Rpb24oZm4sIGN0eCwgYXJncyk7XG4gIGNvbnN0IHJldEJ1ZiA9IG5ldyBCaW5hcnlXcml0ZXIocmV0dXJuVHlwZUJhc2VTaXplKTtcbiAgc2VyaWFsaXplUmV0dXJuKHJldEJ1ZiwgcmV0KTtcbiAgcmV0dXJuIHJldEJ1Zi5nZXRCdWZmZXIoKTtcbn1cbnZhciBQcm9jZWR1cmVDdHhJbXBsID0gY2xhc3MgUHJvY2VkdXJlQ3R4IHtcbiAgY29uc3RydWN0b3Ioc2VuZGVyLCB0aW1lc3RhbXAsIGNvbm5lY3Rpb25JZCwgZGJWaWV3LCBiYWNrZW5kID0gaG9zdEJhY2tlbmQsIGh0dHAgPSBodHRwQ2xpZW50LCBzbGVlcCA9ICgpID0+IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJwcm9jZWR1cmUgc2xlZXAgaXMgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHJ1bnRpbWVcIik7XG4gIH0sIHJhbmRvbSwgY2hpbGRTZWVkUmFuZG9tLCBkaXNwYXRjaGVzID0gW10sIHBhcmVudFByZWZpeCA9IFwiXCIpIHtcbiAgICB0aGlzLnNlbmRlciA9IHNlbmRlcjtcbiAgICB0aGlzLnRpbWVzdGFtcCA9IHRpbWVzdGFtcDtcbiAgICB0aGlzLmNvbm5lY3Rpb25JZCA9IGNvbm5lY3Rpb25JZDtcbiAgICB0aGlzLiNkYlZpZXcgPSBkYlZpZXc7XG4gICAgdGhpcy4jYmFja2VuZCA9IGJhY2tlbmQ7XG4gICAgdGhpcy4jaHR0cCA9IGh0dHA7XG4gICAgdGhpcy4jc2xlZXAgPSBzbGVlcDtcbiAgICB0aGlzLiNyYW5kb20gPSByYW5kb207XG4gICAgdGhpcy4jY2hpbGRTZWVkUmFuZG9tID0gY2hpbGRTZWVkUmFuZG9tO1xuICAgIHRoaXMuI2Rpc3BhdGNoZXMgPSBkaXNwYXRjaGVzO1xuICAgIHRoaXMuI3BhcmVudFByZWZpeCA9IHBhcmVudFByZWZpeDtcbiAgfVxuICAjaWRlbnRpdHk7XG4gICN1dWlkQ291bnRlcjtcbiAgI3JhbmRvbTtcbiAgI2RiVmlldztcbiAgI2JhY2tlbmQ7XG4gICNodHRwO1xuICAjc2xlZXA7XG4gICNjaGlsZFNlZWRSYW5kb207XG4gIGVudiA9IGVudmlyb25tZW50O1xuICAjZGlzcGF0Y2hlcztcbiAgI3BhcmVudFByZWZpeDtcbiAgI2FzVmlld3M7XG4gIGdldCBkYXRhYmFzZUlkZW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLiNpZGVudGl0eSA/Pz0gbmV3IElkZW50aXR5KHRoaXMuI2JhY2tlbmQuaWRlbnRpdHkoKSk7XG4gIH1cbiAgZ2V0IGlkZW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmRhdGFiYXNlSWRlbnRpdHk7XG4gIH1cbiAgZ2V0IHJhbmRvbSgpIHtcbiAgICByZXR1cm4gdGhpcy4jcmFuZG9tID8/PSBtYWtlUmFuZG9tKHRoaXMudGltZXN0YW1wKTtcbiAgfVxuICBnZXQgaHR0cCgpIHtcbiAgICByZXR1cm4gdGhpcy4jaHR0cDtcbiAgfVxuICBzbGVlcChkdXJhdGlvbikge1xuICAgIHRoaXMuI3NsZWVwKGR1cmF0aW9uKTtcbiAgfVxuICBnZXQgYXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2FzVmlld3MgPz89IGJ1aWxkUHJvY2VkdXJlQWxpYXNDdHhNYXAoXG4gICAgICB0aGlzLFxuICAgICAgdGhpcy4jZGlzcGF0Y2hlcyxcbiAgICAgIHRoaXMuI3BhcmVudFByZWZpeFxuICAgICk7XG4gIH1cbiAgd2l0aFR4KGJvZHkpIHtcbiAgICBjb25zdCB0eFNlZWQgPSB0aGlzLiNjaGlsZFNlZWRSYW5kb20/LmJpZ2ludEluUmFuZ2UoMG4sICgxbiA8PCA2NG4pIC0gMW4pO1xuICAgIGNvbnN0IGRpc3BhdGNoZXMgPSB0aGlzLiNkaXNwYXRjaGVzO1xuICAgIGNvbnN0IHBhcmVudFByZWZpeCA9IHRoaXMuI3BhcmVudFByZWZpeDtcbiAgICByZXR1cm4gcnVuV2l0aFR4KFxuICAgICAgKHRpbWVzdGFtcCkgPT4ge1xuICAgICAgICBjb25zdCB0eCA9IG5ldyBSZWR1Y2VyQ3R4SW1wbChcbiAgICAgICAgICB0aGlzLnNlbmRlcixcbiAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgICAgdGhpcy5jb25uZWN0aW9uSWQsXG4gICAgICAgICAgdGhpcy4jZGJWaWV3KCksXG4gICAgICAgICAgdGhpcy4jYmFja2VuZCxcbiAgICAgICAgICB2b2lkIDAsXG4gICAgICAgICAgdHhTZWVkID09IG51bGwgPyB2b2lkIDAgOiBtYWtlUmFuZG9tRnJvbVNlZWQodHhTZWVkKVxuICAgICAgICApO1xuICAgICAgICBhc3NpZ25UeEFsaWFzVmlld3ModHgsIGRpc3BhdGNoZXMsIHBhcmVudFByZWZpeCk7XG4gICAgICAgIHJldHVybiB0eDtcbiAgICAgIH0sXG4gICAgICBib2R5LFxuICAgICAgdGhpcy4jYmFja2VuZFxuICAgICk7XG4gIH1cbiAgbmV3VXVpZFY0KCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy5yYW5kb20uZmlsbChuZXcgVWludDhBcnJheSgxNikpO1xuICAgIHJldHVybiBVdWlkLmZyb21SYW5kb21CeXRlc1Y0KGJ5dGVzKTtcbiAgfVxuICBuZXdVdWlkVjcoKSB7XG4gICAgY29uc3QgYnl0ZXMgPSB0aGlzLnJhbmRvbS5maWxsKG5ldyBVaW50OEFycmF5KDQpKTtcbiAgICBjb25zdCBjb3VudGVyID0gdGhpcy4jdXVpZENvdW50ZXIgPz89IHsgdmFsdWU6IDAgfTtcbiAgICByZXR1cm4gVXVpZC5mcm9tQ291bnRlclY3KGNvdW50ZXIsIHRoaXMudGltZXN0YW1wLCBieXRlcyk7XG4gIH1cbn07XG5cbi8vIHNyYy9zZXJ2ZXIvcmVkdWNlcnMudHNcbmZ1bmN0aW9uIG1ha2VSZWR1Y2VyRXhwb3J0KGN0eCwgb3B0cywgcGFyYW1zLCBmbiwgbGlmZWN5Y2xlKSB7XG4gIGNvbnN0IHJlZHVjZXJFeHBvcnQgPSAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG4gIHJlZHVjZXJFeHBvcnRbZXhwb3J0Q29udGV4dF0gPSBjdHg7XG4gIHJlZHVjZXJFeHBvcnRbcmVnaXN0ZXJFeHBvcnRdID0gKGN0eDIsIGV4cG9ydE5hbWUpID0+IHtcbiAgICByZWdpc3RlclJlZHVjZXIoY3R4MiwgZXhwb3J0TmFtZSwgcGFyYW1zLCBmbiwgb3B0cywgbGlmZWN5Y2xlKTtcbiAgICBjdHgyLmZ1bmN0aW9uRXhwb3J0cy5zZXQoXG4gICAgICByZWR1Y2VyRXhwb3J0LFxuICAgICAgZXhwb3J0TmFtZVxuICAgICk7XG4gICAgaWYgKG9wdHM/Lm9uUmVzdWx0ICE9PSB2b2lkIDApIHtcbiAgICAgIGN0eDIucGVuZGluZ091dGJveENhbGxiYWNrcy5wdXNoKHtcbiAgICAgICAgdGFibGU6IG9wdHMub25SZXN1bHQsXG4gICAgICAgIGZ1bmN0aW9uTmFtZTogZXhwb3J0TmFtZVxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChvcHRzPy5vblNjaGVkdWxlICE9PSB2b2lkIDApIHtcbiAgICAgIGN0eDIucGVuZGluZ1NjaGVkdWxlcy5wdXNoKHtcbiAgICAgICAgdGFibGU6IG9wdHMub25TY2hlZHVsZSxcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBleHBvcnROYW1lXG4gICAgICB9KTtcbiAgICB9XG4gIH07XG4gIHJldHVybiByZWR1Y2VyRXhwb3J0O1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJSZWR1Y2VyKGN0eCwgZXhwb3J0TmFtZSwgcGFyYW1zLCBmbiwgb3B0cywgbGlmZWN5Y2xlKSB7XG4gIGN0eC5kZWZpbmVGdW5jdGlvbihleHBvcnROYW1lKTtcbiAgaWYgKCEocGFyYW1zIGluc3RhbmNlb2YgUm93QnVpbGRlcikpIHtcbiAgICBwYXJhbXMgPSBuZXcgUm93QnVpbGRlcihwYXJhbXMpO1xuICB9XG4gIGlmIChvcHRzPy5vblJlc3VsdCkge1xuICAgIGlmIChvcHRzLm9uU2NoZWR1bGUpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJBIHJlZHVjZXIgY2Fubm90IHVzZSBib3RoIG9uU2NoZWR1bGUgYW5kIG9uUmVzdWx0XCIpO1xuICAgIH1cbiAgICBpZiAobGlmZWN5Y2xlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQSBsaWZlY3ljbGUgcmVkdWNlciBjYW5ub3QgdXNlIG9uUmVzdWx0XCIpO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXQgPSBvcHRzLm9uUmVzdWx0O1xuICAgIGNvbnN0IGZpZWxkcyA9IE9iamVjdC52YWx1ZXMocGFyYW1zLnJvdyk7XG4gICAgaWYgKGZpZWxkcy5sZW5ndGggIT09IDIgfHwgZmllbGRzWzBdLnR5cGVCdWlsZGVyICE9PSB0YXJnZXQucm93VHlwZSB8fCAhZGVlcEVxdWFsKFxuICAgICAgZmllbGRzWzFdLnR5cGVCdWlsZGVyLmFsZ2VicmFpY1R5cGUsXG4gICAgICB0LnJlc3VsdCh0LnVuaXQoKSwgdC5zdHJpbmcoKSkuYWxnZWJyYWljVHlwZVxuICAgICkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIFwib25SZXN1bHQgcmVxdWlyZXMgdGhlIG91dGJveCByb3cgZm9sbG93ZWQgYnkgUmVzdWx0PFVuaXQsIFN0cmluZz5cIlxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgaWYgKHBhcmFtcy50eXBlTmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgcGFyYW1zLnR5cGVOYW1lID0gdG9QYXNjYWxDYXNlKGV4cG9ydE5hbWUpO1xuICB9XG4gIGNvbnN0IHJlZiA9IGN0eC5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkocGFyYW1zKTtcbiAgY29uc3QgcGFyYW1zVHlwZSA9IGN0eC5yZXNvbHZlVHlwZShyZWYpLnZhbHVlO1xuICBjb25zdCBpc0xpZmVjeWNsZSA9IGxpZmVjeWNsZSAhPSBudWxsO1xuICBjdHgubW9kdWxlRGVmLnJlZHVjZXJzLnB1c2goe1xuICAgIHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgcGFyYW1zOiBwYXJhbXNUeXBlLFxuICAgIC8vTW9kdWxlRGVmIHZhbGlkYXRpb24gY29kZSBpcyByZXNwb25zaWJsZSB0byBtYXJrIHByaXZhdGUgcmVkdWNlcnNcbiAgICB2aXNpYmlsaXR5OiBGdW5jdGlvblZpc2liaWxpdHkuQ2xpZW50Q2FsbGFibGUsXG4gICAgLy9IYXJkY29kZWQgZm9yIG5vdyAtIHJlZHVjZXJzIGRvIG5vdCByZXR1cm4gdmFsdWVzIHlldFxuICAgIG9rUmV0dXJuVHlwZTogQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHsgZWxlbWVudHM6IFtdIH0pLFxuICAgIGVyclJldHVyblR5cGU6IEFsZ2VicmFpY1R5cGUuU3RyaW5nXG4gIH0pO1xuICBpZiAob3B0cz8ubmFtZSAhPSBudWxsKSB7XG4gICAgY3R4Lm1vZHVsZURlZi5leHBsaWNpdE5hbWVzLmVudHJpZXMucHVzaCh7XG4gICAgICB0YWc6IFwiRnVuY3Rpb25cIixcbiAgICAgIHZhbHVlOiB7XG4gICAgICAgIHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgICAgIGNhbm9uaWNhbE5hbWU6IG9wdHMubmFtZVxuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIGlmIChpc0xpZmVjeWNsZSkge1xuICAgIGN0eC5tb2R1bGVEZWYubGlmZUN5Y2xlUmVkdWNlcnMucHVzaCh7XG4gICAgICBsaWZlY3ljbGVTcGVjOiBsaWZlY3ljbGUsXG4gICAgICBmdW5jdGlvbk5hbWU6IGV4cG9ydE5hbWVcbiAgICB9KTtcbiAgfVxuICBpZiAoIWZuLm5hbWUpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZm4sIFwibmFtZVwiLCB7IHZhbHVlOiBleHBvcnROYW1lLCB3cml0YWJsZTogZmFsc2UgfSk7XG4gIH1cbiAgY3R4LnJlZHVjZXJzLnB1c2goZm4pO1xufVxuXG4vLyBzcmMvc2VydmVyL3NjaGVtYS50c1xudmFyIFNjaGVtYUlubmVyID0gY2xhc3MgZXh0ZW5kcyBNb2R1bGVDb250ZXh0IHtcbiAgc2NoZW1hVHlwZTtcbiAgZXhwb3J0c1JlZ2lzdGVyZWQgPSBmYWxzZTtcbiAgc2NoZWR1bGVzUmVzb2x2ZWQgPSBmYWxzZTtcbiAgZXhpc3RpbmdGdW5jdGlvbnMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBleGlzdGluZ0h0dHBIYW5kbGVycyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIHJlZHVjZXJzID0gW107XG4gIHByb2NlZHVyZXMgPSBbXTtcbiAgdmlld3MgPSBbXTtcbiAgYW5vblZpZXdzID0gW107XG4gIGh0dHBIYW5kbGVycyA9IFtdO1xuICAvKipcbiAgICogTWFwcyByZWR1Y2VyL3Byb2NlZHVyZSBleHBvcnQgb2JqZWN0cyB0byB0aGVpciBzb3VyY2UgbmFtZXMuXG4gICAqIFVzZWQgZm9yIHJlc29sdmluZyBzY2hlZHVsZWQgdGFibGUgdGFyZ2V0cy5cbiAgICovXG4gIGZ1bmN0aW9uRXhwb3J0cyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gIHRhYmxlU291cmNlTmFtZXMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBodHRwSGFuZGxlckV4cG9ydHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBwZW5kaW5nU2NoZWR1bGVzID0gW107XG4gIHBlbmRpbmdPdXRib3hDYWxsYmFja3MgPSBbXTtcbiAgcGVuZGluZ0h0dHBSb3V0ZXMgPSBbXTtcbiAgc3VibW9kdWxlRGlzcGF0Y2hJbmZvcyA9IFtdO1xuICBjb25zdHJ1Y3RvcihnZXRTY2hlbWFUeXBlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnNjaGVtYVR5cGUgPSBnZXRTY2hlbWFUeXBlKHRoaXMpO1xuICB9XG4gIGRlZmluZUZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZiAodGhpcy5leGlzdGluZ0Z1bmN0aW9ucy5oYXMobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIGBUaGVyZSBpcyBhbHJlYWR5IGEgcmVkdWNlciwgcHJvY2VkdXJlLCBvciB2aWV3IHdpdGggdGhlIG5hbWUgJyR7bmFtZX0nYFxuICAgICAgKTtcbiAgICB9XG4gICAgdGhpcy5leGlzdGluZ0Z1bmN0aW9ucy5hZGQobmFtZSk7XG4gIH1cbiAgZGVmaW5lSHR0cEhhbmRsZXIobmFtZSkge1xuICAgIGlmICh0aGlzLmV4aXN0aW5nSHR0cEhhbmRsZXJzLmhhcyhuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgYFRoZXJlIGlzIGFscmVhZHkgYW4gSFRUUCBoYW5kbGVyIHdpdGggdGhlIG5hbWUgJyR7bmFtZX0nYFxuICAgICAgKTtcbiAgICB9XG4gICAgdGhpcy5leGlzdGluZ0h0dHBIYW5kbGVycy5hZGQobmFtZSk7XG4gIH1cbiAgcmVzb2x2ZVNjaGVkdWxlcygpIHtcbiAgICBpZiAodGhpcy5zY2hlZHVsZXNSZXNvbHZlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnNjaGVkdWxlc1Jlc29sdmVkID0gdHJ1ZTtcbiAgICBjb25zdCBzY2hlZHVsZWRUYWJsZXMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICAgIGZvciAoY29uc3Qge1xuICAgICAgZnVuY3Rpb25OYW1lOiBrbm93bkZ1bmN0aW9uTmFtZSxcbiAgICAgIHJlZHVjZXIsXG4gICAgICB0YWJsZTogdGFibGUyLFxuICAgICAgdGFibGVOYW1lOiBrbm93blRhYmxlTmFtZSxcbiAgICAgIHNjaGVkdWxlQXRDb2w6IGtub3duU2NoZWR1bGVBdENvbFxuICAgIH0gb2YgdGhpcy5wZW5kaW5nU2NoZWR1bGVzKSB7XG4gICAgICBsZXQgdGFibGVOYW1lID0ga25vd25UYWJsZU5hbWU7XG4gICAgICBpZiAodGFibGVOYW1lID09PSB2b2lkIDApIHtcbiAgICAgICAgY29uc3QgdGFibGVOYW1lcyA9IHRoaXMudGFibGVTb3VyY2VOYW1lcy5nZXQodGFibGUyKTtcbiAgICAgICAgaWYgKHRhYmxlTmFtZXMgIT09IHZvaWQgMCAmJiB0YWJsZU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgXCJTY2hlZHVsZSB0YXJnZXQgdGFibGUgaXMgcmVnaXN0ZXJlZCBtb3JlIHRoYW4gb25jZSBpbiB0aGlzIHNjaGVtYS4gVXNlIGEgZGlzdGluY3QgdGFibGUgaGFuZGxlIGZvciBlYWNoIHNjaGVkdWxlZCB0YWJsZS5cIlxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgdGFibGVOYW1lID0gdGFibGVOYW1lcz8uWzBdO1xuICAgICAgfVxuICAgICAgaWYgKHRhYmxlTmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgXCJTY2hlZHVsZSB0YXJnZXQgdGFibGUgaXMgbm90IHBhcnQgb2YgdGhpcyBzY2hlbWEuXCJcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmICh0YWJsZTIub3V0Ym94KVxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT3V0Ym94IHRhYmxlcyBjYW5ub3QgYmUgc2NoZWR1bGVkXCIpO1xuICAgICAgY29uc3Qgc2NoZWR1bGVBdENvbCA9IGtub3duU2NoZWR1bGVBdENvbCA/PyB0YWJsZTIuc2NoZWR1bGVBdENvbDtcbiAgICAgIGlmIChzY2hlZHVsZUF0Q29sID09PSB2b2lkIDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgVGFibGUgJHt0YWJsZU5hbWV9IGRlZmluZXMgYSBzY2hlZHVsZSwgYnV0IGl0IGRvZXMgbm90IGhhdmUgYSBTY2hlZHVsZUF0IGNvbHVtbi5gXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSBrbm93bkZ1bmN0aW9uTmFtZSA/PyAocmVkdWNlciA9PT0gdm9pZCAwID8gdm9pZCAwIDogdGhpcy5mdW5jdGlvbkV4cG9ydHMuZ2V0KHJlZHVjZXIoKSkpO1xuICAgICAgaWYgKGZ1bmN0aW9uTmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIGNvbnN0IG1zZyA9IGBUYWJsZSAke3RhYmxlTmFtZX0gZGVmaW5lcyBhIHNjaGVkdWxlLCBidXQgaXQgc2VlbXMgbGlrZSB0aGUgYXNzb2NpYXRlZCBmdW5jdGlvbiB3YXMgbm90IGV4cG9ydGVkLmA7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IobXNnKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGV4aXN0aW5nRnVuY3Rpb25OYW1lID0gc2NoZWR1bGVkVGFibGVzLmdldCh0YWJsZU5hbWUpO1xuICAgICAgaWYgKGV4aXN0aW5nRnVuY3Rpb25OYW1lICE9PSB2b2lkIDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgVGFibGUgJHt0YWJsZU5hbWV9IGRlZmluZXMgbXVsdGlwbGUgc2NoZWR1bGVzOiAke2V4aXN0aW5nRnVuY3Rpb25OYW1lfSBhbmQgJHtmdW5jdGlvbk5hbWV9LiBBIHNjaGVkdWxlIHRhYmxlIGNhbiBvbmx5IGJlIHVzZWQgYnkgb25lIHJlZHVjZXIgb3IgcHJvY2VkdXJlLmBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHNjaGVkdWxlZFRhYmxlcy5zZXQodGFibGVOYW1lLCBmdW5jdGlvbk5hbWUpO1xuICAgICAgdGhpcy5tb2R1bGVEZWYuc2NoZWR1bGVzLnB1c2goe1xuICAgICAgICBzb3VyY2VOYW1lOiB2b2lkIDAsXG4gICAgICAgIHRhYmxlTmFtZSxcbiAgICAgICAgc2NoZWR1bGVBdENvbCxcbiAgICAgICAgZnVuY3Rpb25OYW1lXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgcmVzb2x2ZU91dGJveENhbGxiYWNrcygpIHtcbiAgICBmb3IgKGNvbnN0IHsgdGFibGU6IHRhYmxlMiwgZnVuY3Rpb25OYW1lIH0gb2YgdGhpcy5wZW5kaW5nT3V0Ym94Q2FsbGJhY2tzKSB7XG4gICAgICBjb25zdCBuYW1lcyA9IHRoaXMudGFibGVTb3VyY2VOYW1lcy5nZXQodGFibGUyKTtcbiAgICAgIGlmIChuYW1lcz8ubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgXCJvblJlc3VsdCBtdXN0IHJlZmVyZW5jZSBhbiBvdXRib3ggcmVnaXN0ZXJlZCBleGFjdGx5IG9uY2UgaW4gdGhpcyBzY2hlbWFcIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgY29uc3Qgb3V0Ym94ID0gdGhpcy5tb2R1bGVEZWYub3V0Ym94ZXMuZmluZChcbiAgICAgICAgKG8pID0+IG8udGFibGVOYW1lID09PSBuYW1lc1swXVxuICAgICAgKTtcbiAgICAgIGlmICghb3V0Ym94KSB0aHJvdyBuZXcgVHlwZUVycm9yKFwib25SZXN1bHQgcmVxdWlyZXMgYW4gb3V0Ym94IHRhYmxlXCIpO1xuICAgICAgaWYgKG91dGJveC5vblJlc3VsdFJlZHVjZXIgIT09IHZvaWQgMCAmJiBvdXRib3gub25SZXN1bHRSZWR1Y2VyICE9PSBmdW5jdGlvbk5hbWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkFuIG91dGJveCBjYW4gb25seSBoYXZlIG9uZSBvblJlc3VsdCByZWR1Y2VyXCIpO1xuICAgICAgfVxuICAgICAgb3V0Ym94Lm9uUmVzdWx0UmVkdWNlciA9IGZ1bmN0aW9uTmFtZTtcbiAgICB9XG4gIH1cbiAgcmVzb2x2ZUh0dHBSb3V0ZXMoKSB7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLnBlbmRpbmdIdHRwUm91dGVzKSB7XG4gICAgICBjb25zdCBoYW5kbGVyRnVuY3Rpb24gPSB0aGlzLmh0dHBIYW5kbGVyRXhwb3J0cy5nZXQocm91dGUuaGFuZGxlcik7XG4gICAgICBpZiAoaGFuZGxlckZ1bmN0aW9uID09PSB2b2lkIDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgSFRUUCByb3V0ZSBmb3IgcGF0aCAnJHtyb3V0ZS5wYXRofScgcmVmZXJzIHRvIGEgaGFuZGxlciB0aGF0IHdhcyBub3QgZXhwb3J0ZWQuYFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhpcy5tb2R1bGVEZWYuaHR0cFJvdXRlcy5wdXNoKHtcbiAgICAgICAgaGFuZGxlckZ1bmN0aW9uLFxuICAgICAgICBtZXRob2Q6IHJvdXRlLm1ldGhvZCxcbiAgICAgICAgcGF0aDogcm91dGUucGF0aFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59O1xudmFyIFNjaGVtYSA9IGNsYXNzIHtcbiAgI2N0eDtcbiAgY29uc3RydWN0b3IoY3R4KSB7XG4gICAgdGhpcy4jY3R4ID0gY3R4O1xuICB9XG4gIFttb2R1bGVIb29rc10oZXhwb3J0cykge1xuICAgIHRoaXMuYnVpbGRSYXdNb2R1bGVEZWZWMTAoZXhwb3J0cyk7XG4gICAgdGhpcy4jY3R4LnJlc29sdmVIdHRwUm91dGVzKCk7XG4gICAgcmV0dXJuIG1ha2VIb29rcyh0aGlzLiNjdHgpO1xuICB9XG4gIGdldCBzY2hlbWFUeXBlKCkge1xuICAgIHJldHVybiB0aGlzLiNjdHguc2NoZW1hVHlwZTtcbiAgfVxuICBnZXQgbW9kdWxlRGVmKCkge1xuICAgIHJldHVybiB0aGlzLiNjdHgubW9kdWxlRGVmO1xuICB9XG4gIGdldCB0eXBlc3BhY2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2N0eC50eXBlc3BhY2U7XG4gIH1cbiAgZ2V0IHN1Ym1vZHVsZURpc3BhdGNoSW5mb3MoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2N0eC5zdWJtb2R1bGVEaXNwYXRjaEluZm9zO1xuICB9XG4gIC8qKiBJbnRlcm5hbDogcmVnaXN0ZXIgZXhwb3J0cyBhbmQgbWF0ZXJpYWxpemUgdGhlIFJhd01vZHVsZURlZlYxMCBmb3IgdXBsb2FkLiAqL1xuICBidWlsZFJhd01vZHVsZURlZlYxMChleHBvcnRzLCBvcHRzKSB7XG4gICAgcmVnaXN0ZXJNb2R1bGVFeHBvcnRzKHRoaXMuI2N0eCwgZXhwb3J0cywge1xuICAgICAgaWdub3JlTm9uTW9kdWxlRXhwb3J0czogb3B0cz8uaWdub3JlTm9uTW9kdWxlRXhwb3J0cyA/PyBmYWxzZVxuICAgIH0pO1xuICAgIHRoaXMuI2N0eC5yZXNvbHZlU2NoZWR1bGVzKCk7XG4gICAgdGhpcy4jY3R4LnJlc29sdmVPdXRib3hDYWxsYmFja3MoKTtcbiAgICByZXR1cm4gdGhpcy4jY3R4LnJhd01vZHVsZURlZlYxMCgpO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWwg4oCTIGNhbGxlZCBieSBzY2hlbWEoKSB3aGVuIHByb2Nlc3NpbmcgYSBzdWJtb2R1bGUgbmFtZXNwYWNlIGVudHJ5LlxuICAgKiBSZWdpc3RlcnMgdGhlIGxpYnJhcnkncyBleHBvcnRzIGFuZCByZXR1cm5zIGJvdGggdGhlIHNlcmlhbGl6ZWQgbW9kdWxlIGRlZlxuICAgKiBhbmQgdGhlIHJ1bnRpbWUgZGlzcGF0Y2ggaW5mbyBuZWVkZWQgYnkgTW9kdWxlSG9va3NJbXBsIGZvciBfX2NhbGxfcmVkdWNlcl9fLlxuICAgKi9cbiAgYnVpbGRTdWJtb2R1bGVEaXNwYXRjaChleHBvcnRzKSB7XG4gICAgY29uc3QgcmF3RGVmID0gdGhpcy5idWlsZFJhd01vZHVsZURlZlYxMChleHBvcnRzLCB7XG4gICAgICBpZ25vcmVOb25Nb2R1bGVFeHBvcnRzOiB0cnVlXG4gICAgfSk7XG4gICAgaWYgKHRoaXMuI2N0eC5tb2R1bGVEZWYuZW52aXJvbm1lbnQubGVuZ3RoICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3VibW9kdWxlcyBjYW5ub3QgZGVjbGFyZSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcIik7XG4gICAgfVxuICAgIHRoaXMuI2N0eC5yZXNvbHZlSHR0cFJvdXRlcygpO1xuICAgIHJldHVybiB7XG4gICAgICByYXdEZWYsXG4gICAgICBkaXNwYXRjaDoge1xuICAgICAgICBuYW1lc3BhY2U6IFwiXCIsXG4gICAgICAgIHJlZHVjZXJGbnM6IFsuLi50aGlzLiNjdHgucmVkdWNlcnNdLFxuICAgICAgICByZWR1Y2VyRGVmczogWy4uLnRoaXMuI2N0eC5tb2R1bGVEZWYucmVkdWNlcnNdLFxuICAgICAgICBwcm9jZWR1cmVGbnM6IFsuLi50aGlzLiNjdHgucHJvY2VkdXJlc10sXG4gICAgICAgIHByb2NlZHVyZURlZnM6IFsuLi50aGlzLiNjdHgubW9kdWxlRGVmLnByb2NlZHVyZXNdLFxuICAgICAgICBhbm9uVmlld0ZuczogWy4uLnRoaXMuI2N0eC5hbm9uVmlld3NdLFxuICAgICAgICB2aWV3Rm5zOiBbLi4udGhpcy4jY3R4LnZpZXdzXSxcbiAgICAgICAgdHlwZXNwYWNlOiB0aGlzLiNjdHgubW9kdWxlRGVmLnR5cGVzcGFjZSxcbiAgICAgICAgdGFibGVzOiBPYmplY3QudmFsdWVzKHRoaXMuI2N0eC5zY2hlbWFUeXBlLnRhYmxlcykubWFwKCh0MikgPT4gKHtcbiAgICAgICAgICBhY2Nlc3Nvck5hbWU6IHQyLmFjY2Vzc29yTmFtZSxcbiAgICAgICAgICB0YWJsZURlZjogdDIudGFibGVEZWZcbiAgICAgICAgfSkpLFxuICAgICAgICBzY2hlbWFUYWJsZXM6IHRoaXMuI2N0eC5zY2hlbWFUeXBlLnRhYmxlcyxcbiAgICAgICAgc3ViRGlzcGF0Y2hlczogWy4uLnRoaXMuI2N0eC5zdWJtb2R1bGVEaXNwYXRjaEluZm9zXVxuICAgICAgfVxuICAgIH07XG4gIH1cbiAgcmVkdWNlciguLi5hcmdzKSB7XG4gICAgbGV0IG9wdHMsIHBhcmFtcyA9IHt9LCBmbjtcbiAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIFtmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjoge1xuICAgICAgICBsZXQgYXJnMTtcbiAgICAgICAgW2FyZzEsIGZuXSA9IGFyZ3M7XG4gICAgICAgIGlmICh0eXBlb2YgYXJnMS5uYW1lID09PSBcInN0cmluZ1wiKVxuICAgICAgICAgIG9wdHMgPSBhcmcxO1xuICAgICAgICBlbHNlIHBhcmFtcyA9IGFyZzE7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAzOlxuICAgICAgICBbb3B0cywgcGFyYW1zLCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIG1ha2VSZWR1Y2VyRXhwb3J0KHRoaXMuI2N0eCwgb3B0cywgcGFyYW1zLCBmbik7XG4gIH1cbiAgaW5pdCguLi5hcmdzKSB7XG4gICAgbGV0IG9wdHMsIGZuO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgW2ZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBbb3B0cywgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlUmVkdWNlckV4cG9ydCh0aGlzLiNjdHgsIG9wdHMsIHt9LCBmbiwgTGlmZWN5Y2xlLkluaXQpO1xuICB9XG4gIGNsaWVudENvbm5lY3RlZCguLi5hcmdzKSB7XG4gICAgbGV0IG9wdHMsIGZuO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgW2ZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBbb3B0cywgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlUmVkdWNlckV4cG9ydCh0aGlzLiNjdHgsIG9wdHMsIHt9LCBmbiwgTGlmZWN5Y2xlLk9uQ29ubmVjdCk7XG4gIH1cbiAgY2xpZW50RGlzY29ubmVjdGVkKC4uLmFyZ3MpIHtcbiAgICBsZXQgb3B0cywgZm47XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAxOlxuICAgICAgICBbZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIFtvcHRzLCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIG1ha2VSZWR1Y2VyRXhwb3J0KHRoaXMuI2N0eCwgb3B0cywge30sIGZuLCBMaWZlY3ljbGUuT25EaXNjb25uZWN0KTtcbiAgfVxuICB2aWV3KG9wdHMsIC4uLmFyZ3MpIHtcbiAgICBsZXQgcGFyYW1zID0ge30sIHJldCwgZm47XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAyOlxuICAgICAgICBbcmV0LCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgW3BhcmFtcywgcmV0LCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIG1ha2VWaWV3RXhwb3J0KHRoaXMuI2N0eCwgb3B0cywgcGFyYW1zLCByZXQsIGZuKTtcbiAgfVxuICBhbm9ueW1vdXNWaWV3KG9wdHMsIC4uLmFyZ3MpIHtcbiAgICBsZXQgcGFyYW1zID0ge30sIHJldCwgZm47XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAyOlxuICAgICAgICBbcmV0LCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgW3BhcmFtcywgcmV0LCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIG1ha2VBbm9uVmlld0V4cG9ydChcbiAgICAgIHRoaXMuI2N0eCxcbiAgICAgIG9wdHMsXG4gICAgICBwYXJhbXMsXG4gICAgICByZXQsXG4gICAgICBmblxuICAgICk7XG4gIH1cbiAgcHJvY2VkdXJlKC4uLmFyZ3MpIHtcbiAgICBsZXQgb3B0cywgcGFyYW1zID0ge30sIHJldCwgZm47XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAyOlxuICAgICAgICBbcmV0LCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzoge1xuICAgICAgICBsZXQgYXJnMTtcbiAgICAgICAgW2FyZzEsIHJldCwgZm5dID0gYXJncztcbiAgICAgICAgaWYgKHR5cGVvZiBhcmcxLm5hbWUgPT09IFwic3RyaW5nXCIpXG4gICAgICAgICAgb3B0cyA9IGFyZzE7XG4gICAgICAgIGVsc2UgcGFyYW1zID0gYXJnMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIDQ6XG4gICAgICAgIFtvcHRzLCBwYXJhbXMsIHJldCwgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlUHJvY2VkdXJlRXhwb3J0KHRoaXMuI2N0eCwgb3B0cywgcGFyYW1zLCByZXQsIGZuKTtcbiAgfVxuICBodHRwSGFuZGxlciguLi5hcmdzKSB7XG4gICAgbGV0IG9wdHMsIGZuO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgW2ZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBbb3B0cywgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlSHR0cEhhbmRsZXJFeHBvcnQodGhpcy4jY3R4LCBvcHRzLCBmbik7XG4gIH1cbiAgaHR0cFJvdXRlcihyb3V0ZXIpIHtcbiAgICByZXR1cm4gbWFrZUh0dHBSb3V0ZXJFeHBvcnQodGhpcy4jY3R4LCByb3V0ZXIpO1xuICB9XG4gIC8qKlxuICAgKiBCdW5kbGUgbXVsdGlwbGUgcmVkdWNlcnMsIHByb2NlZHVyZXMsIGV0YyBpbnRvIG9uZSB2YWx1ZSB0byBleHBvcnQuXG4gICAqIFRoZSBuYW1lIHRoZXkgd2lsbCBiZSBleHBvcnRlZCB3aXRoIGlzIHRoZWlyIGNvcnJlc3BvbmRpbmcga2V5IGluIHRoZSBgZXhwb3J0c2AgYXJndW1lbnQuXG4gICAqL1xuICBleHBvcnRHcm91cChleHBvcnRzKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIFtleHBvcnRDb250ZXh0XTogdGhpcy4jY3R4LFxuICAgICAgW3JlZ2lzdGVyRXhwb3J0XShjdHgsIF9leHBvcnROYW1lKSB7XG4gICAgICAgIGZvciAoY29uc3QgW2V4cG9ydE5hbWUsIG1vZHVsZUV4cG9ydF0gb2YgT2JqZWN0LmVudHJpZXMoZXhwb3J0cykpIHtcbiAgICAgICAgICBjaGVja0V4cG9ydENvbnRleHQobW9kdWxlRXhwb3J0LCBjdHgpO1xuICAgICAgICAgIG1vZHVsZUV4cG9ydFtyZWdpc3RlckV4cG9ydF0oY3R4LCBleHBvcnROYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cbiAgY2xpZW50VmlzaWJpbGl0eUZpbHRlciA9IHtcbiAgICBzcWw6IChmaWx0ZXIpID0+ICh7XG4gICAgICBbZXhwb3J0Q29udGV4dF06IHRoaXMuI2N0eCxcbiAgICAgIFtyZWdpc3RlckV4cG9ydF0oY3R4LCBfZXhwb3J0TmFtZSkge1xuICAgICAgICBjdHgubW9kdWxlRGVmLnJvd0xldmVsU2VjdXJpdHkucHVzaCh7IHNxbDogZmlsdGVyIH0pO1xuICAgICAgfVxuICAgIH0pXG4gIH07XG59O1xudmFyIHJlZ2lzdGVyRXhwb3J0ID0gU3ltYm9sKFwiU3BhY2V0aW1lREIucmVnaXN0ZXJFeHBvcnRcIik7XG52YXIgZXhwb3J0Q29udGV4dCA9IFN5bWJvbChcIlNwYWNldGltZURCLmV4cG9ydENvbnRleHRcIik7XG5mdW5jdGlvbiBpc01vZHVsZUV4cG9ydCh4KSB7XG4gIHJldHVybiAodHlwZW9mIHggPT09IFwiZnVuY3Rpb25cIiB8fCB0eXBlb2YgeCA9PT0gXCJvYmplY3RcIikgJiYgeCAhPT0gbnVsbCAmJiByZWdpc3RlckV4cG9ydCBpbiB4O1xufVxuZnVuY3Rpb24gY2hlY2tFeHBvcnRDb250ZXh0KGV4cCwgc2NoZW1hMikge1xuICBpZiAoZXhwW2V4cG9ydENvbnRleHRdICE9IG51bGwgJiYgZXhwW2V4cG9ydENvbnRleHRdICE9PSBzY2hlbWEyKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm11bHRpcGxlIHNjaGVtYXMgYXJlIG5vdCBzdXBwb3J0ZWRcIik7XG4gIH1cbn1cbmZ1bmN0aW9uIGlzVW50eXBlZFRhYmxlU2NoZW1hKHgpIHtcbiAgcmV0dXJuIHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGwgJiYgaGFzT3duKHgsIFwidGFibGVEZWZcIik7XG59XG5mdW5jdGlvbiBpc1N1Ym1vZHVsZU5hbWVzcGFjZSh4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsICYmIGhhc093bih4LCBcImRlZmF1bHRcIikgJiYgeC5kZWZhdWx0IGluc3RhbmNlb2YgU2NoZW1hO1xufVxuZnVuY3Rpb24gaXNTdWJtb2R1bGVNb3VudCh4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsICYmIGhhc093bih4LCBcIm1vZHVsZVwiKSAmJiAhaGFzT3duKHgsIFwiZGVmYXVsdFwiKSAmJiAhaGFzT3duKHgsIFwidGFibGVEZWZcIik7XG59XG5mdW5jdGlvbiBkZWZhdWx0SW1wb3J0RXJyb3IoYWNjTmFtZSkge1xuICByZXR1cm4gbmV3IFR5cGVFcnJvcihcbiAgICBgc2NoZW1hIGVudHJ5ICcke2FjY05hbWV9JyBsb29rcyBsaWtlIGEgZGVmYXVsdCBpbXBvcnQ7IHVzZSBcXGBpbXBvcnQgKiBhcyAke2FjY05hbWV9IGZyb20gJy4uLidcXGAgc28gdGhlIHN1Ym1vZHVsZSBjYW4gc2VlIHRoZSBsaWJyYXJ5J3MgbmFtZWQgcmVkdWNlciBleHBvcnRzLmBcbiAgKTtcbn1cbmZ1bmN0aW9uIHJlc29sdmVTdWJtb2R1bGVFbnRyeShhY2NOYW1lLCBlbnRyeSkge1xuICBpZiAoZW50cnkgaW5zdGFuY2VvZiBTY2hlbWEpIHtcbiAgICB0aHJvdyBkZWZhdWx0SW1wb3J0RXJyb3IoYWNjTmFtZSk7XG4gIH1cbiAgaWYgKGlzU3VibW9kdWxlTmFtZXNwYWNlKGVudHJ5KSkge1xuICAgIHJldHVybiB7IHN1Ym1vZHVsZTogZW50cnkgfTtcbiAgfVxuICBpZiAoIWlzU3VibW9kdWxlTW91bnQoZW50cnkpKSB7XG4gICAgcmV0dXJuIHZvaWQgMDtcbiAgfVxuICBpZiAoZW50cnkubW9kdWxlIGluc3RhbmNlb2YgU2NoZW1hKSB7XG4gICAgdGhyb3cgZGVmYXVsdEltcG9ydEVycm9yKGFjY05hbWUpO1xuICB9XG4gIGlmICghaXNTdWJtb2R1bGVOYW1lc3BhY2UoZW50cnkubW9kdWxlKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICBgc2NoZW1hIGVudHJ5ICcke2FjY05hbWV9JyBoYXMgYSBcXGBtb2R1bGVcXGAgdGhhdCBpcyBub3QgYSBzdWJtb2R1bGUgbmFtZXNwYWNlIG9iamVjdDsgcGFzcyB0aGUgcmVzdWx0IG9mIFxcYGltcG9ydCAqIGFzICR7YWNjTmFtZX0gZnJvbSAnLi4uJ1xcYC5gXG4gICAgKTtcbiAgfVxuICBpZiAoZW50cnkubmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgcmV0dXJuIHsgc3VibW9kdWxlOiBlbnRyeS5tb2R1bGUgfTtcbiAgfVxuICBpZiAodHlwZW9mIGVudHJ5Lm5hbWUgIT09IFwic3RyaW5nXCIgfHwgZW50cnkubmFtZS5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgYHNjaGVtYSBlbnRyeSAnJHthY2NOYW1lfScgaGFzIGFuIGludmFsaWQgXFxgbmFtZVxcYDsgZXhwZWN0ZWQgYSBub24tZW1wdHkgc3RyaW5nIGZvciB0aGUgY2Fub25pY2FsIG5hbWVzcGFjZSBuYW1lLmBcbiAgICApO1xuICB9XG4gIHJldHVybiB7IHN1Ym1vZHVsZTogZW50cnkubW9kdWxlLCBjYW5vbmljYWxOYW1lOiBlbnRyeS5uYW1lIH07XG59XG5mdW5jdGlvbiByZWdpc3Rlck1vZHVsZUV4cG9ydHMoc2NoZW1hMiwgZXhwb3J0cywgb3B0cykge1xuICBpZiAoc2NoZW1hMi5leHBvcnRzUmVnaXN0ZXJlZCkge1xuICAgIHJldHVybjtcbiAgfVxuICBzY2hlbWEyLmV4cG9ydHNSZWdpc3RlcmVkID0gdHJ1ZTtcbiAgZm9yIChjb25zdCBbbmFtZSwgbW9kdWxlRXhwb3J0XSBvZiBPYmplY3QuZW50cmllcyhleHBvcnRzKSkge1xuICAgIGlmIChuYW1lID09PSBcImRlZmF1bHRcIikgY29udGludWU7XG4gICAgaWYgKCFpc01vZHVsZUV4cG9ydChtb2R1bGVFeHBvcnQpKSB7XG4gICAgICBpZiAob3B0cz8uaWdub3JlTm9uTW9kdWxlRXhwb3J0cykge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJleHBvcnRpbmcgc29tZXRoaW5nIHRoYXQgaXMgbm90IGEgc3BhY2V0aW1lIGV4cG9ydFwiKTtcbiAgICB9XG4gICAgY2hlY2tFeHBvcnRDb250ZXh0KG1vZHVsZUV4cG9ydCwgc2NoZW1hMik7XG4gICAgbW9kdWxlRXhwb3J0W3JlZ2lzdGVyRXhwb3J0XShzY2hlbWEyLCBuYW1lKTtcbiAgfVxufVxuZnVuY3Rpb24gc2NoZW1hKGVudHJpZXMsIG1vZHVsZVNldHRpbmdzKSB7XG4gIGNvbnN0IGN0eCA9IG5ldyBTY2hlbWFJbm5lcigoY3R4MikgPT4ge1xuICAgIGN0eDIubW9kdWxlRGVmLmVudmlyb25tZW50ID0gZW52aXJvbm1lbnREZWNsYXJhdGlvbnMoXG4gICAgICBtb2R1bGVTZXR0aW5ncz8uZW52ID8/IHt9XG4gICAgKTtcbiAgICBpZiAobW9kdWxlU2V0dGluZ3M/LkNBU0VfQ09OVkVSU0lPTl9QT0xJQ1kgIT0gbnVsbCkge1xuICAgICAgY3R4Mi5zZXRDYXNlQ29udmVyc2lvblBvbGljeShtb2R1bGVTZXR0aW5ncy5DQVNFX0NPTlZFUlNJT05fUE9MSUNZKTtcbiAgICB9XG4gICAgY29uc3QgdGFibGVTY2hlbWFzID0ge307XG4gICAgZm9yIChjb25zdCBbYWNjTmFtZSwgZW50cnldIG9mIE9iamVjdC5lbnRyaWVzKGVudHJpZXMpKSB7XG4gICAgICBjb25zdCBtb3VudCA9IHJlc29sdmVTdWJtb2R1bGVFbnRyeShhY2NOYW1lLCBlbnRyeSk7XG4gICAgICBpZiAobW91bnQgIT09IHZvaWQgMCkge1xuICAgICAgICBjb25zdCB7IHN1Ym1vZHVsZSwgY2Fub25pY2FsTmFtZSB9ID0gbW91bnQ7XG4gICAgICAgIGNvbnN0IHsgcmF3RGVmLCBkaXNwYXRjaCB9ID0gc3VibW9kdWxlLmRlZmF1bHQuYnVpbGRTdWJtb2R1bGVEaXNwYXRjaChzdWJtb2R1bGUpO1xuICAgICAgICBkaXNwYXRjaC5uYW1lc3BhY2UgPSBhY2NOYW1lO1xuICAgICAgICBjdHgyLmFkZFN1Ym1vZHVsZSh7IG5hbWVzcGFjZTogYWNjTmFtZSwgbW9kdWxlOiByYXdEZWYgfSk7XG4gICAgICAgIGlmIChjYW5vbmljYWxOYW1lICE9PSB2b2lkIDApIHtcbiAgICAgICAgICBjdHgyLm1vZHVsZURlZi5leHBsaWNpdE5hbWVzLmVudHJpZXMucHVzaCh7XG4gICAgICAgICAgICB0YWc6IFwiTmFtZXNwYWNlXCIsXG4gICAgICAgICAgICB2YWx1ZTogeyBzb3VyY2VOYW1lOiBhY2NOYW1lLCBjYW5vbmljYWxOYW1lIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjdHgyLnN1Ym1vZHVsZURpc3BhdGNoSW5mb3MucHVzaChkaXNwYXRjaCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFpc1VudHlwZWRUYWJsZVNjaGVtYShlbnRyeSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgc2NoZW1hIGVudHJ5ICcke2FjY05hbWV9JyBtdXN0IGJlIGEgdGFibGUsIGEgc3VibW9kdWxlIG5hbWVzcGFjZSBvYmplY3QsIG9yIGEgXFxgeyBuYW1lLCBtb2R1bGUgfVxcYCBzdWJtb2R1bGUgbW91bnRgXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBjb25zdCB0YWJsZTIgPSBlbnRyeTtcbiAgICAgIGNvbnN0IHRhYmxlRGVmID0gdGFibGUyLnRhYmxlRGVmKGN0eDIsIGFjY05hbWUpO1xuICAgICAgdGFibGVTY2hlbWFzW2FjY05hbWVdID0gdGFibGVUb1NjaGVtYShhY2NOYW1lLCB0YWJsZTIsIHRhYmxlRGVmKTtcbiAgICAgIGNvbnN0IHRhYmxlU291cmNlTmFtZXMgPSBjdHgyLnRhYmxlU291cmNlTmFtZXMuZ2V0KHRhYmxlMik7XG4gICAgICBpZiAodGFibGVTb3VyY2VOYW1lcyA9PT0gdm9pZCAwKSB7XG4gICAgICAgIGN0eDIudGFibGVTb3VyY2VOYW1lcy5zZXQodGFibGUyLCBbdGFibGVEZWYuc291cmNlTmFtZV0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGFibGVTb3VyY2VOYW1lcy5wdXNoKHRhYmxlRGVmLnNvdXJjZU5hbWUpO1xuICAgICAgfVxuICAgICAgY3R4Mi5tb2R1bGVEZWYudGFibGVzLnB1c2godGFibGVEZWYpO1xuICAgICAgaWYgKHRhYmxlMi5vdXRib3gpIHtcbiAgICAgICAgY3R4Mi5tb2R1bGVEZWYub3V0Ym94ZXMucHVzaCh7XG4gICAgICAgICAgLi4udGFibGUyLm91dGJveCxcbiAgICAgICAgICB0YWJsZU5hbWU6IHRhYmxlRGVmLnNvdXJjZU5hbWUsXG4gICAgICAgICAgb25SZXN1bHRSZWR1Y2VyOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAodGFibGUyLnNjaGVkdWxlKSB7XG4gICAgICAgIGN0eDIucGVuZGluZ1NjaGVkdWxlcy5wdXNoKHtcbiAgICAgICAgICB0YWJsZTogdGFibGUyLFxuICAgICAgICAgIHRhYmxlTmFtZTogdGFibGVEZWYuc291cmNlTmFtZSxcbiAgICAgICAgICBzY2hlZHVsZUF0Q29sOiB0YWJsZTIuc2NoZWR1bGUuc2NoZWR1bGVBdENvbCxcbiAgICAgICAgICByZWR1Y2VyOiB0YWJsZTIuc2NoZWR1bGUucmVkdWNlclxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmICh0YWJsZTIudGFibGVOYW1lKSB7XG4gICAgICAgIGN0eDIubW9kdWxlRGVmLmV4cGxpY2l0TmFtZXMuZW50cmllcy5wdXNoKHtcbiAgICAgICAgICB0YWc6IFwiVGFibGVcIixcbiAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgc291cmNlTmFtZTogYWNjTmFtZSxcbiAgICAgICAgICAgIGNhbm9uaWNhbE5hbWU6IHRhYmxlMi50YWJsZU5hbWVcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgdGFibGVzOiB0YWJsZVNjaGVtYXMsXG4gICAgICBlbnY6IG1vZHVsZVNldHRpbmdzPy5lbnYgPz8ge31cbiAgICB9O1xuICB9KTtcbiAgcmV0dXJuIG5ldyBTY2hlbWEoY3R4KTtcbn1cblxuLy8gc3JjL3NlcnZlci9jb25zb2xlLnRzXG52YXIgaW1wb3J0X29iamVjdF9pbnNwZWN0ID0gX190b0VTTShyZXF1aXJlX29iamVjdF9pbnNwZWN0KCkpO1xudmFyIGZtdExvZyA9ICguLi5kYXRhKSA9PiBkYXRhLm1hcCgoeCkgPT4gdHlwZW9mIHggPT09IFwic3RyaW5nXCIgPyB4IDogKDAsIGltcG9ydF9vYmplY3RfaW5zcGVjdC5kZWZhdWx0KSh4KSkuam9pbihcIiBcIik7XG52YXIgY29uc29sZV9sZXZlbF9lcnJvciA9IDA7XG52YXIgY29uc29sZV9sZXZlbF93YXJuID0gMTtcbnZhciBjb25zb2xlX2xldmVsX2luZm8gPSAyO1xudmFyIGNvbnNvbGVfbGV2ZWxfZGVidWcgPSAzO1xudmFyIGNvbnNvbGVfbGV2ZWxfdHJhY2UgPSA0O1xudmFyIHRpbWVyTWFwID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbnZhciBjb25zb2xlMiA9IHtcbiAgLy8gQHRzLWV4cGVjdC1lcnJvciB3ZSB3YW50IGEgYmxhbmsgcHJvdG90eXBlLCBidXQgdHlwZXNjcmlwdCBjb21wbGFpbnNcbiAgX19wcm90b19fOiB7fSxcbiAgW1N5bWJvbC50b1N0cmluZ1RhZ106IFwiY29uc29sZVwiLFxuICBhc3NlcnQ6IChjb25kaXRpb24gPSBmYWxzZSwgLi4uZGF0YSkgPT4ge1xuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICBzeXMyLmNvbnNvbGVfbG9nKGNvbnNvbGVfbGV2ZWxfZXJyb3IsIGZtdExvZyguLi5kYXRhKSk7XG4gICAgfVxuICB9LFxuICBjbGVhcjogKCkgPT4ge1xuICB9LFxuICBkZWJ1ZzogKC4uLmRhdGEpID0+IHtcbiAgICBzeXMyLmNvbnNvbGVfbG9nKGNvbnNvbGVfbGV2ZWxfZGVidWcsIGZtdExvZyguLi5kYXRhKSk7XG4gIH0sXG4gIGVycm9yOiAoLi4uZGF0YSkgPT4ge1xuICAgIHN5czIuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF9lcnJvciwgZm10TG9nKC4uLmRhdGEpKTtcbiAgfSxcbiAgaW5mbzogKC4uLmRhdGEpID0+IHtcbiAgICBzeXMyLmNvbnNvbGVfbG9nKGNvbnNvbGVfbGV2ZWxfaW5mbywgZm10TG9nKC4uLmRhdGEpKTtcbiAgfSxcbiAgbG9nOiAoLi4uZGF0YSkgPT4ge1xuICAgIHN5czIuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF9pbmZvLCBmbXRMb2coLi4uZGF0YSkpO1xuICB9LFxuICB0YWJsZTogKHRhYnVsYXJEYXRhLCBfcHJvcGVydGllcykgPT4ge1xuICAgIHN5czIuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF9pbmZvLCBmbXRMb2codGFidWxhckRhdGEpKTtcbiAgfSxcbiAgdHJhY2U6ICguLi5kYXRhKSA9PiB7XG4gICAgc3lzMi5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX3RyYWNlLCBmbXRMb2coLi4uZGF0YSkpO1xuICB9LFxuICB3YXJuOiAoLi4uZGF0YSkgPT4ge1xuICAgIHN5czIuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF93YXJuLCBmbXRMb2coLi4uZGF0YSkpO1xuICB9LFxuICBkaXI6IChfaXRlbSwgX29wdGlvbnMpID0+IHtcbiAgfSxcbiAgZGlyeG1sOiAoLi4uX2RhdGEpID0+IHtcbiAgfSxcbiAgLy8gQ291bnRpbmdcbiAgY291bnQ6IChfbGFiZWwgPSBcImRlZmF1bHRcIikgPT4ge1xuICB9LFxuICBjb3VudFJlc2V0OiAoX2xhYmVsID0gXCJkZWZhdWx0XCIpID0+IHtcbiAgfSxcbiAgLy8gR3JvdXBpbmdcbiAgZ3JvdXA6ICguLi5fZGF0YSkgPT4ge1xuICB9LFxuICBncm91cENvbGxhcHNlZDogKC4uLl9kYXRhKSA9PiB7XG4gIH0sXG4gIGdyb3VwRW5kOiAoKSA9PiB7XG4gIH0sXG4gIC8vIFRpbWluZ1xuICB0aW1lOiAobGFiZWwgPSBcImRlZmF1bHRcIikgPT4ge1xuICAgIGlmICh0aW1lck1hcC5oYXMobGFiZWwpKSB7XG4gICAgICBzeXMyLmNvbnNvbGVfbG9nKGNvbnNvbGVfbGV2ZWxfd2FybiwgYFRpbWVyICcke2xhYmVsfScgYWxyZWFkeSBleGlzdHMuYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRpbWVyTWFwLnNldChsYWJlbCwgc3lzMi5jb25zb2xlX3RpbWVyX3N0YXJ0KGxhYmVsKSk7XG4gIH0sXG4gIHRpbWVMb2c6IChsYWJlbCA9IFwiZGVmYXVsdFwiLCAuLi5kYXRhKSA9PiB7XG4gICAgc3lzMi5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX2luZm8sIGZtdExvZyhsYWJlbCwgLi4uZGF0YSkpO1xuICB9LFxuICB0aW1lRW5kOiAobGFiZWwgPSBcImRlZmF1bHRcIikgPT4ge1xuICAgIGNvbnN0IHNwYW5JZCA9IHRpbWVyTWFwLmdldChsYWJlbCk7XG4gICAgaWYgKHNwYW5JZCA9PT0gdm9pZCAwKSB7XG4gICAgICBzeXMyLmNvbnNvbGVfbG9nKGNvbnNvbGVfbGV2ZWxfd2FybiwgYFRpbWVyICcke2xhYmVsfScgZG9lcyBub3QgZXhpc3QuYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHN5czIuY29uc29sZV90aW1lcl9lbmQoc3BhbklkKTtcbiAgICB0aW1lck1hcC5kZWxldGUobGFiZWwpO1xuICB9LFxuICAvLyBBZGRpdGlvbmFsIGNvbnNvbGUgbWV0aG9kcyB0byBzYXRpc2Z5IHRoZSBDb25zb2xlIGludGVyZmFjZVxuICB0aW1lU3RhbXA6ICgpID0+IHtcbiAgfSxcbiAgcHJvZmlsZTogKCkgPT4ge1xuICB9LFxuICBwcm9maWxlRW5kOiAoKSA9PiB7XG4gIH1cbn07XG5cbi8vIHNyYy9zZXJ2ZXIvcG9seWZpbGxzLnRzXG5nbG9iYWxUaGlzLmNvbnNvbGUgPSBjb25zb2xlMjtcbi8qISBCdW5kbGVkIGxpY2Vuc2UgaW5mb3JtYXRpb246XG5cbnN0YXR1c2VzL2luZGV4LmpzOlxuICAoKiFcbiAgICogc3RhdHVzZXNcbiAgICogQ29weXJpZ2h0KGMpIDIwMTQgSm9uYXRoYW4gT25nXG4gICAqIENvcHlyaWdodChjKSAyMDE2IERvdWdsYXMgQ2hyaXN0b3BoZXIgV2lsc29uXG4gICAqIE1JVCBMaWNlbnNlZFxuICAgKilcbiovXG5cbmV4cG9ydCB7IEFycmF5QnVpbGRlciwgQXJyYXlDb2x1bW5CdWlsZGVyLCBCb29sQnVpbGRlciwgQm9vbENvbHVtbkJ1aWxkZXIsIEJvb2xlYW5FeHByLCBCeXRlQXJyYXlCdWlsZGVyLCBCeXRlQXJyYXlDb2x1bW5CdWlsZGVyLCBDYXNlQ29udmVyc2lvblBvbGljeSwgQ29sdW1uQnVpbGRlciwgQ29sdW1uRXhwcmVzc2lvbiwgQ29ubmVjdGlvbklkQnVpbGRlciwgQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlciwgRjMyQnVpbGRlciwgRjMyQ29sdW1uQnVpbGRlciwgRjY0QnVpbGRlciwgRjY0Q29sdW1uQnVpbGRlciwgSTEyOEJ1aWxkZXIsIEkxMjhDb2x1bW5CdWlsZGVyLCBJMTZCdWlsZGVyLCBJMTZDb2x1bW5CdWlsZGVyLCBJMjU2QnVpbGRlciwgSTI1NkNvbHVtbkJ1aWxkZXIsIEkzMkJ1aWxkZXIsIEkzMkNvbHVtbkJ1aWxkZXIsIEk2NEJ1aWxkZXIsIEk2NENvbHVtbkJ1aWxkZXIsIEk4QnVpbGRlciwgSThDb2x1bW5CdWlsZGVyLCBJZGVudGl0eUJ1aWxkZXIsIElkZW50aXR5Q29sdW1uQnVpbGRlciwgT3B0aW9uQnVpbGRlciwgT3B0aW9uQ29sdW1uQnVpbGRlciwgUHJvZHVjdEJ1aWxkZXIsIFByb2R1Y3RDb2x1bW5CdWlsZGVyLCBSYW5nZSwgUmVmQnVpbGRlciwgUmVxdWVzdCwgUmVzdWx0QnVpbGRlciwgUmVzdWx0Q29sdW1uQnVpbGRlciwgUm91dGVyLCBSb3dCdWlsZGVyLCBTY2hlZHVsZUF0LCBTY2hlZHVsZUF0QnVpbGRlciwgU2NoZWR1bGVBdENvbHVtbkJ1aWxkZXIsIFNlbmRlckVycm9yLCBTaW1wbGVTdW1CdWlsZGVyLCBTaW1wbGVTdW1Db2x1bW5CdWlsZGVyLCBTcGFjZXRpbWVIb3N0RXJyb3IsIFN0cmluZ0J1aWxkZXIsIFN0cmluZ0NvbHVtbkJ1aWxkZXIsIFN1bUJ1aWxkZXIsIFN1bUNvbHVtbkJ1aWxkZXIsIFN5bmNSZXNwb25zZSwgVGltZUR1cmF0aW9uQnVpbGRlciwgVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlciwgVGltZXN0YW1wQnVpbGRlciwgVGltZXN0YW1wQ29sdW1uQnVpbGRlciwgVHlwZUJ1aWxkZXIsIFUxMjhCdWlsZGVyLCBVMTI4Q29sdW1uQnVpbGRlciwgVTE2QnVpbGRlciwgVTE2Q29sdW1uQnVpbGRlciwgVTI1NkJ1aWxkZXIsIFUyNTZDb2x1bW5CdWlsZGVyLCBVMzJCdWlsZGVyLCBVMzJDb2x1bW5CdWlsZGVyLCBVNjRCdWlsZGVyLCBVNjRDb2x1bW5CdWlsZGVyLCBVOEJ1aWxkZXIsIFU4Q29sdW1uQnVpbGRlciwgVXVpZEJ1aWxkZXIsIFV1aWRDb2x1bW5CdWlsZGVyLCBhbmQsIGNyZWF0ZVRhYmxlUmVmRnJvbURlZiwgZXJyb3JzLCBldmFsdWF0ZUJvb2xlYW5FeHByLCBnZXRRdWVyeUFjY2Vzc29yTmFtZSwgZ2V0UXVlcnlUYWJsZU5hbWUsIGdldFF1ZXJ5V2hlcmVDbGF1c2UsIGlzUm93VHlwZWRRdWVyeSwgaXNUeXBlZFF1ZXJ5LCBsaXRlcmFsLCBtYWtlRnJvbUJ1aWxkZXIsIG1ha2VRdWVyeUJ1aWxkZXIsIG5vdCwgb3IsIHJlbW90ZU1vZHVsZSwgc2NoZW1hLCB0LCB0YWJsZSwgdG9DYW1lbENhc2UsIHRvQ29tcGFyYWJsZVZhbHVlLCB0b1NxbCB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXgubWpzLm1hcFxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXgubWpzLm1hcCIsImltcG9ydCB7XHJcbiAgc2NoZW1hLFxyXG4gIHRhYmxlLFxyXG4gIHQsXHJcbiAgU2VuZGVyRXJyb3IsXHJcbiAgdHlwZSBSZWR1Y2VyQ3R4LFxyXG4gIHR5cGUgSW5mZXJTY2hlbWEsXHJcbn0gZnJvbSBcInNwYWNldGltZWRiL3NlcnZlclwiO1xyXG5pbXBvcnQgdHlwZSB7IEluZmVyIH0gZnJvbSBcInNwYWNldGltZWRiXCI7XHJcblxyXG5jb25zdCBkcml2ZXIgPSB0YWJsZShcclxuICB7IHB1YmxpYzogdHJ1ZSB9LFxyXG4gIHtcclxuICAgIGRyaXZlcl9pZDogdC5zdHJpbmcoKS5wcmltYXJ5S2V5KCksXHJcbiAgICBuYW1lOiB0LnN0cmluZygpLFxyXG4gICAgc291cmNlOiB0LnN0cmluZygpLFxyXG4gICAgY3JlYXRlZF9hdDogdC5mNjQoKSxcclxuICAgIHJldmlzaW9uOiB0LnUzMigpLFxyXG4gIH0sXHJcbik7XHJcbmNvbnN0IHNlc3Npb24gPSB0YWJsZShcclxuICB7IHB1YmxpYzogdHJ1ZSB9LFxyXG4gIHtcclxuICAgIHNlc3Npb25faWQ6IHQuc3RyaW5nKCkucHJpbWFyeUtleSgpLFxyXG4gICAgZHJpdmVyX2lkOiB0LnN0cmluZygpLFxyXG4gICAgdHJhY2s6IHQuc3RyaW5nKCksXHJcbiAgICBjYXI6IHQuc3RyaW5nKCksXHJcbiAgICBjb3JuZXI6IHQuc3RyaW5nKCksXHJcbiAgICBtb2RlOiB0LnN0cmluZygpLFxyXG4gICAgYWdlbnQ6IHQuYm9vbCgpLFxyXG4gICAgbW9kZWw6IHQuc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICAgIHN0YXJ0ZWRfYXQ6IHQuZjY0KCksXHJcbiAgICBlbmRlZF9hdDogdC5mNjQoKS5vcHRpb25hbCgpLFxyXG4gICAgcGxhbjogdC5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG4gICAgcmVjb3JkaW5nOiB0LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgICByZXZpc2lvbjogdC51MzIoKSxcclxuICB9LFxyXG4pO1xyXG5jb25zdCBsYXAgPSB0YWJsZShcclxuICB7IHB1YmxpYzogdHJ1ZSB9LFxyXG4gIHtcclxuICAgIGxhcF9pZDogdC5zdHJpbmcoKS5wcmltYXJ5S2V5KCksXHJcbiAgICBzZXNzaW9uX2lkOiB0LnN0cmluZygpLFxyXG4gICAgbjogdC51MzIoKSxcclxuICAgIGF0dGVtcHRfaWQ6IHQuc3RyaW5nKCksXHJcbiAgICByb2xlOiB0LnN0cmluZygpLFxyXG4gICAgdmFsaWQ6IHQuYm9vbCgpLFxyXG4gICAgaW52YWxpZF9yZWFzb246IHQuc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICAgIHNlY3Rpb25fczogdC5mNjQoKS5vcHRpb25hbCgpLFxyXG4gICAgZW50cnlfa21oOiB0LmY2NCgpLm9wdGlvbmFsKCksXHJcbiAgICBhcGV4X2ttaDogdC5mNjQoKS5vcHRpb25hbCgpLFxyXG4gICAgZXhpdF9rbWg6IHQuZjY0KCkub3B0aW9uYWwoKSxcclxuICAgIGJyYWtlX29uc2V0X206IHQuZjY0KCkub3B0aW9uYWwoKSxcclxuICAgIGJyYWtlX2JvYXJkX206IHQuZjY0KCkub3B0aW9uYWwoKSxcclxuICAgIHBlYWtfYnJha2U6IHQuZjY0KCkub3B0aW9uYWwoKSxcclxuICAgIHRocm90dGxlX3BpY2t1cF9tOiB0LmY2NCgpLm9wdGlvbmFsKCksXHJcbiAgICByZWxlYXNlX3M6IHQuZjY0KCkub3B0aW9uYWwoKSxcclxuICAgIHRyYWlsX2JyYWtlX3NoYXJlOiB0LmY2NCgpLm9wdGlvbmFsKCksXHJcbiAgICBsb2NrdXBfczogdC5mNjQoKS5vcHRpb25hbCgpLFxyXG4gICAgd2hlZWxzcGluX3M6IHQuZjY0KCkub3B0aW9uYWwoKSxcclxuICAgIG1pbl9rbWg6IHQuZjY0KCkub3B0aW9uYWwoKSxcclxuICAgIG1pbl9wb3NfbTogdC5mNjQoKS5vcHRpb25hbCgpLFxyXG4gICAgaW5wdXRfZHJvcG91dDogdC5ib29sKCksXHJcbiAgICBpbnB1dHM6IHQuc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICAgIGF0OiB0LmY2NCgpLFxyXG4gICAgcmV2aXNpb246IHQudTMyKCksXHJcbiAgfSxcclxuKTtcclxuY29uc3QgbGFwVHJhY2UgPSB0YWJsZShcclxuICB7IG5hbWU6IFwibGFwX3RyYWNlXCIsIHB1YmxpYzogdHJ1ZSB9LFxyXG4gIHtcclxuICAgIGxhcF9pZDogdC5zdHJpbmcoKS5wcmltYXJ5S2V5KCksXHJcbiAgICByb3dzOiB0LnN0cmluZygpLFxyXG4gICAgcmV2aXNpb246IHQudTMyKCksXHJcbiAgfSxcclxuKTtcclxuY29uc3QgZGVjaXNpb24gPSB0YWJsZShcclxuICB7IHB1YmxpYzogdHJ1ZSB9LFxyXG4gIHtcclxuICAgIGRlY2lzaW9uX2lkOiB0LnN0cmluZygpLnByaW1hcnlLZXkoKSxcclxuICAgIGxhcF9pZDogdC5zdHJpbmcoKSxcclxuICAgIGxhYmVsOiB0LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgICBhY3Rpb246IHQuc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICAgIGRyaWxsX2lkOiB0LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgICB0YXJnZXQ6IHQuc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICAgIGN1ZTogdC5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG4gICAgdmVyZGljdDogdC5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG4gICAgbW9kZTogdC5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG4gICAgcHJvdmlkZXI6IHQuc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICAgIG1vZGVsOiB0LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgICBsYXRlbmN5X21zOiB0LmY2NCgpLm9wdGlvbmFsKCksXHJcbiAgICBzdW1tYXJ5OiB0LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgICBhdDogdC5mNjQoKSxcclxuICAgIHJldmlzaW9uOiB0LnUzMigpLFxyXG4gIH0sXHJcbik7XHJcbi8vIFByaXZhdGUgc2luZ2xldG9uLiByZWdpc3Rlcl9jb2FjaCBtdXN0IHJ1biBiZWZvcmUgZGlzdHJpYnV0aW5nIHRoZSBzcGVjdGF0b3IgbGluay5cclxuY29uc3QgY29hY2hPd25lciA9IHRhYmxlKFxyXG4gIHsgbmFtZTogXCJjb2FjaF9vd25lclwiIH0sXHJcbiAgeyBzbG90OiB0LnU4KCkucHJpbWFyeUtleSgpLCBpZGVudGl0eTogdC5pZGVudGl0eSgpIH0sXHJcbik7XHJcbmNvbnN0IGRiID0gc2NoZW1hKHsgZHJpdmVyLCBzZXNzaW9uLCBsYXAsIGxhcFRyYWNlLCBkZWNpc2lvbiwgY29hY2hPd25lciB9KTtcclxuZXhwb3J0IGRlZmF1bHQgZGI7XHJcbnR5cGUgQ29udGV4dCA9IFJlZHVjZXJDdHg8SW5mZXJTY2hlbWE8dHlwZW9mIGRiPj47XHJcblxyXG5mdW5jdGlvbiBndWFyZChjdHg6IENvbnRleHQpIHtcclxuICBjb25zdCBvd25lciA9IGN0eC5kYi5jb2FjaE93bmVyLnNsb3QuZmluZCgwKTtcclxuICBpZiAoIW93bmVyIHx8ICFvd25lci5pZGVudGl0eS5pc0VxdWFsKGN0eC5zZW5kZXIpKVxyXG4gICAgdGhyb3cgbmV3IFNlbmRlckVycm9yKFwiY29hY2ggb25seVwiKTtcclxufVxyXG5mdW5jdGlvbiB1dWlkKGlkOiBzdHJpbmcpIHtcclxuICBpZiAoXHJcbiAgICB0eXBlb2YgaWQgIT09IFwic3RyaW5nXCIgfHxcclxuICAgICEvXlswLTlhLWZdezh9KC1bMC05YS1mXXs0fSl7M30tWzAtOWEtZl17MTJ9JC9pLnRlc3QoaWQpXHJcbiAgKVxyXG4gICAgdGhyb3cgbmV3IFNlbmRlckVycm9yKFwiaW52YWxpZCBVVUlEXCIpO1xyXG59XHJcbmZ1bmN0aW9uIGRlY29kZTxUPihwYXlsb2FkOiBzdHJpbmcpOiBUIHtcclxuICAvLyBPcHRpb25hbCBTUUxpdGUgY29sdW1ucyB1c2UgbnVsbDsgdGhlIFR5cGVTY3JpcHQgU0RLIHJlcHJlc2VudHMgb3B0aW9ucyBhcyB1bmRlZmluZWQuXHJcbiAgY29uc3Qgb2JqID0gSlNPTi5wYXJzZShwYXlsb2FkLCAoX2tleSwgdmFsdWUpID0+XHJcbiAgICB2YWx1ZSA9PT0gbnVsbCA/IHVuZGVmaW5lZCA6IHZhbHVlLFxyXG4gICk7XHJcbiAgaWYgKCFvYmogfHwgdHlwZW9mIG9iaiAhPT0gXCJvYmplY3RcIiB8fCBBcnJheS5pc0FycmF5KG9iaikpXHJcbiAgICB0aHJvdyBuZXcgU2VuZGVyRXJyb3IoXCJleHBlY3RlZCByb3cgb2JqZWN0XCIpO1xyXG4gIHJldHVybiBvYmogYXMgVDtcclxufVxyXG5mdW5jdGlvbiBuZXdlcihcclxuICBvbGQ6IHsgcmV2aXNpb246IG51bWJlciB9IHwgbnVsbCB8IHVuZGVmaW5lZCxcclxuICByb3c6IHsgcmV2aXNpb246IG51bWJlciB9LFxyXG4pIHtcclxuICBpZiAoIU51bWJlci5pc0ludGVnZXIocm93LnJldmlzaW9uKSB8fCByb3cucmV2aXNpb24gPCAxKVxyXG4gICAgdGhyb3cgbmV3IFNlbmRlckVycm9yKFwiaW52YWxpZCByZXZpc2lvblwiKTtcclxuICByZXR1cm4gIW9sZCB8fCByb3cucmV2aXNpb24gPiBvbGQucmV2aXNpb247XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCByZWdpc3Rlcl9jb2FjaCA9IGRiLnJlZHVjZXIoKGN0eCkgPT4ge1xyXG4gIGNvbnN0IG93bmVyID0gY3R4LmRiLmNvYWNoT3duZXIuc2xvdC5maW5kKDApO1xyXG4gIGlmIChvd25lcikge1xyXG4gICAgZ3VhcmQoY3R4KTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgY3R4LmRiLmNvYWNoT3duZXIuaW5zZXJ0KHsgc2xvdDogMCwgaWRlbnRpdHk6IGN0eC5zZW5kZXIgfSk7XHJcbn0pO1xyXG5leHBvcnQgY29uc3QgdXBzZXJ0X2RyaXZlciA9IGRiLnJlZHVjZXIoXHJcbiAgeyBwYXlsb2FkOiB0LnN0cmluZygpIH0sXHJcbiAgKGN0eCwgeyBwYXlsb2FkIH0pID0+IHtcclxuICAgIGd1YXJkKGN0eCk7XHJcbiAgICBjb25zdCByb3cgPSBkZWNvZGU8SW5mZXI8dHlwZW9mIGRyaXZlci5yb3dUeXBlPj4ocGF5bG9hZCk7XHJcbiAgICB1dWlkKHJvdy5kcml2ZXJfaWQpO1xyXG4gICAgY29uc3Qgb2xkID0gY3R4LmRiLmRyaXZlci5kcml2ZXJfaWQuZmluZChyb3cuZHJpdmVyX2lkKTtcclxuICAgIGlmIChuZXdlcihvbGQsIHJvdykpXHJcbiAgICAgIG9sZCA/IGN0eC5kYi5kcml2ZXIuZHJpdmVyX2lkLnVwZGF0ZShyb3cpIDogY3R4LmRiLmRyaXZlci5pbnNlcnQocm93KTtcclxuICB9LFxyXG4pO1xyXG5cclxuZnVuY3Rpb24gc2F2ZVNlc3Npb24oY3R4OiBDb250ZXh0LCBwYXlsb2FkOiBzdHJpbmcpIHtcclxuICBndWFyZChjdHgpO1xyXG4gIGNvbnN0IHJvdyA9IGRlY29kZTxJbmZlcjx0eXBlb2Ygc2Vzc2lvbi5yb3dUeXBlPj4ocGF5bG9hZCk7XHJcbiAgdXVpZChyb3cuc2Vzc2lvbl9pZCk7XHJcbiAgaWYgKCFjdHguZGIuZHJpdmVyLmRyaXZlcl9pZC5maW5kKHJvdy5kcml2ZXJfaWQpKVxyXG4gICAgdGhyb3cgbmV3IFNlbmRlckVycm9yKFwiZHJpdmVyIG1pc3NpbmdcIik7XHJcbiAgY29uc3Qgb2xkID0gY3R4LmRiLnNlc3Npb24uc2Vzc2lvbl9pZC5maW5kKHJvdy5zZXNzaW9uX2lkKTtcclxuICBpZiAobmV3ZXIob2xkLCByb3cpKVxyXG4gICAgb2xkID8gY3R4LmRiLnNlc3Npb24uc2Vzc2lvbl9pZC51cGRhdGUocm93KSA6IGN0eC5kYi5zZXNzaW9uLmluc2VydChyb3cpO1xyXG59XHJcbmV4cG9ydCBjb25zdCBzdGFydF9zZXNzaW9uID0gZGIucmVkdWNlcih7IHBheWxvYWQ6IHQuc3RyaW5nKCkgfSwgKGN0eCwgYXJncykgPT5cclxuICBzYXZlU2Vzc2lvbihjdHgsIGFyZ3MucGF5bG9hZCksXHJcbik7XHJcbi8vIFRoZXNlIGFjY2VwdCB0aGUgZnVsbCB2ZXJzaW9uZWQgcm93IHRvbywgc28gZGVsYXllZCByZXRyaWVzIGNhbm5vdCByZW9wZW4gYSBzZXNzaW9uIG9yIGVyYXNlIGl0cyBwbGFuLlxyXG5leHBvcnQgY29uc3QgZW5kX3Nlc3Npb24gPSBkYi5yZWR1Y2VyKHsgcGF5bG9hZDogdC5zdHJpbmcoKSB9LCAoY3R4LCBhcmdzKSA9PlxyXG4gIHNhdmVTZXNzaW9uKGN0eCwgYXJncy5wYXlsb2FkKSxcclxuKTtcclxuZXhwb3J0IGNvbnN0IHNldF9wbGFuID0gZGIucmVkdWNlcih7IHBheWxvYWQ6IHQuc3RyaW5nKCkgfSwgKGN0eCwgYXJncykgPT5cclxuICBzYXZlU2Vzc2lvbihjdHgsIGFyZ3MucGF5bG9hZCksXHJcbik7XHJcblxyXG5leHBvcnQgY29uc3QgcmVjb3JkX2xhcCA9IGRiLnJlZHVjZXIoXHJcbiAgeyBwYXlsb2FkOiB0LnN0cmluZygpIH0sXHJcbiAgKGN0eCwgeyBwYXlsb2FkIH0pID0+IHtcclxuICAgIGd1YXJkKGN0eCk7XHJcbiAgICBjb25zdCB7IGxhcDogcm93LCB0cmFjZSB9ID0gZGVjb2RlPHtcclxuICAgICAgbGFwOiBJbmZlcjx0eXBlb2YgbGFwLnJvd1R5cGU+O1xyXG4gICAgICB0cmFjZTogSW5mZXI8dHlwZW9mIGxhcFRyYWNlLnJvd1R5cGU+O1xyXG4gICAgfT4ocGF5bG9hZCk7XHJcbiAgICB1dWlkKHJvdy5sYXBfaWQpO1xyXG4gICAgaWYgKHRyYWNlLmxhcF9pZCAhPT0gcm93LmxhcF9pZClcclxuICAgICAgdGhyb3cgbmV3IFNlbmRlckVycm9yKFwidHJhY2UgYmVsb25ncyB0byBhbm90aGVyIGxhcFwiKTtcclxuICAgIGlmICghQXJyYXkuaXNBcnJheShKU09OLnBhcnNlKHRyYWNlLnJvd3MpKSlcclxuICAgICAgdGhyb3cgbmV3IFNlbmRlckVycm9yKFwidHJhY2UgbXVzdCBiZSBhbiBhcnJheVwiKTtcclxuICAgIGlmICghY3R4LmRiLnNlc3Npb24uc2Vzc2lvbl9pZC5maW5kKHJvdy5zZXNzaW9uX2lkKSlcclxuICAgICAgdGhyb3cgbmV3IFNlbmRlckVycm9yKFwic2Vzc2lvbiBtaXNzaW5nXCIpO1xyXG4gICAgaWYgKFxyXG4gICAgICByb3cudmFsaWQgJiZcclxuICAgICAgIShcclxuICAgICAgICB0eXBlb2Ygcm93LnNlY3Rpb25fcyA9PT0gXCJudW1iZXJcIiAmJlxyXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShyb3cuc2VjdGlvbl9zKSAmJlxyXG4gICAgICAgIHJvdy5zZWN0aW9uX3MgPiAwXHJcbiAgICAgIClcclxuICAgIClcclxuICAgICAgdGhyb3cgbmV3IFNlbmRlckVycm9yKFwiaW52YWxpZCBzZWN0aW9uIHRpbWVcIik7XHJcbiAgICBjb25zdCBvbGQgPSBjdHguZGIubGFwLmxhcF9pZC5maW5kKHJvdy5sYXBfaWQpO1xyXG4gICAgaWYgKG5ld2VyKG9sZCwgcm93KSlcclxuICAgICAgb2xkID8gY3R4LmRiLmxhcC5sYXBfaWQudXBkYXRlKHJvdykgOiBjdHguZGIubGFwLmluc2VydChyb3cpO1xyXG4gICAgY29uc3Qgb2xkVHJhY2UgPSBjdHguZGIubGFwVHJhY2UubGFwX2lkLmZpbmQodHJhY2UubGFwX2lkKTtcclxuICAgIGlmIChuZXdlcihvbGRUcmFjZSwgdHJhY2UpKVxyXG4gICAgICBvbGRUcmFjZVxyXG4gICAgICAgID8gY3R4LmRiLmxhcFRyYWNlLmxhcF9pZC51cGRhdGUodHJhY2UpXHJcbiAgICAgICAgOiBjdHguZGIubGFwVHJhY2UuaW5zZXJ0KHRyYWNlKTtcclxuICB9LFxyXG4pO1xyXG5leHBvcnQgY29uc3QgcmVjb3JkX2RlY2lzaW9uID0gZGIucmVkdWNlcihcclxuICB7IHBheWxvYWQ6IHQuc3RyaW5nKCkgfSxcclxuICAoY3R4LCB7IHBheWxvYWQgfSkgPT4ge1xyXG4gICAgZ3VhcmQoY3R4KTtcclxuICAgIGNvbnN0IHJvdyA9IGRlY29kZTxJbmZlcjx0eXBlb2YgZGVjaXNpb24ucm93VHlwZT4+KHBheWxvYWQpO1xyXG4gICAgdXVpZChyb3cuZGVjaXNpb25faWQpO1xyXG4gICAgaWYgKCFjdHguZGIubGFwLmxhcF9pZC5maW5kKHJvdy5sYXBfaWQpKVxyXG4gICAgICB0aHJvdyBuZXcgU2VuZGVyRXJyb3IoXCJsYXAgbWlzc2luZ1wiKTtcclxuICAgIGNvbnN0IG9sZCA9IGN0eC5kYi5kZWNpc2lvbi5kZWNpc2lvbl9pZC5maW5kKHJvdy5kZWNpc2lvbl9pZCk7XHJcbiAgICBpZiAobmV3ZXIob2xkLCByb3cpKVxyXG4gICAgICBvbGRcclxuICAgICAgICA/IGN0eC5kYi5kZWNpc2lvbi5kZWNpc2lvbl9pZC51cGRhdGUocm93KVxyXG4gICAgICAgIDogY3R4LmRiLmRlY2lzaW9uLmluc2VydChyb3cpO1xyXG4gIH0sXHJcbik7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBSUEsYUFBVyxPQUFPO0FBQ3RCLElBQUlDLGNBQVksT0FB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QUNwQyxJQUFJLEdBQUcsU0FBUyxPQUFPLE1BQU07RUFFdEM7QUFDRCxNQUFhLGtCQUFrQixHQUFHLFFBQ2hDLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxHQUN0QixLQUFLLEVBQUUsY0FBYztBQUNwQixPQUFNLElBQUk7Q0FDVixNQUFNLE1BQU0sT0FBdUMsUUFBUTtBQUMzRCxNQUFLLElBQUksWUFBWTtBQUNyQixLQUFJLENBQUMsSUFBSSxHQUFHLElBQUksT0FBTyxLQUFLLElBQUksT0FBTyxDQUNyQyxPQUFNLElBQUksWUFBWSxjQUFjO0NBQ3RDLE1BQU0sTUFBTSxJQUFJLEdBQUcsU0FBUyxZQUFZLEtBQUssSUFBSSxZQUFZO0FBQzdELEtBQUksTUFBTSxLQUFLLElBQUksQ0FDakIsT0FDSSxJQUFJLEdBQUcsU0FBUyxZQUFZLE9BQU8sSUFBSSxHQUN2QyxJQUFJLEdBQUcsU0FBUyxPQUFPLElBQUk7RUFFcEMiLCJkZWJ1Z0lkIjoiZTFmNjMyNWYtNzFhMi00YWFlLWEzZjAtZjE4NDE5MTRkOWY0In0=