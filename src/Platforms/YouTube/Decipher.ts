import {URL, URLSearchParams} from 'node:url';
import * as querystring from "querystring";
import {httpsClient} from "@httpsClient";
import * as vm from "vm";

export interface YouTubeFormat {
    url: string;
    signatureCipher?: string;
    cipher?: string
    sp?: string;
    s?: string;
    mimeType?: string;
    qualityLabel?: string
}

export namespace Decipher {
    /**
     * Применяет преобразование параметра расшифровки и n ко всем URL-адресам формата.
     * @param {Array.<Object>} formats
     * @param {string} html5player
     */
    export async function parseFormats(formats: YouTubeFormat[], html5player: string): Promise<YouTubeFormat[]> {
        try {
            const functions = await getFunctions(html5player);
            const decipherScript = functions.length ? new vm.Script(functions[0]) : null;
            const nTransformScript = functions.length > 1 ? new vm.Script(functions[1]) : null;

            //Меняем данные в Array<YouTubeFormat>
            for (const format of formats) setDownloadURL(format, decipherScript, nTransformScript);

            return formats;
        } catch (e) {
            return OldDecipher.parseFormats(formats, html5player);
        }
    }
    //====================== ====================== ====================== ======================
    /**
     * Извлечь функции расшифровки подписи и преобразования n параметров из файла html5player
     * @param {string} html5Link
     * @returns {Promise<Array.<string>>}
     */
    function getFunctions (html5Link: string) {
        return httpsClient.parseBody(html5Link).then((body) => {
            const functions = extractFunctions(body);
            if (!functions || !functions.length) return;

            return functions;
        });
    }
    //====================== ====================== ====================== ======================
    /**
     * Извлекает действия, которые необходимо предпринять для расшифровки подписи и преобразовать параметр n
     * @param {string} body
     * @returns {Array.<string>}
     */
    function extractFunctions(body: string) {
        const functions: string[] = [];

        //Пытаемся вытащить фрагмент для дальнейшей манипуляции
        const extractManipulations = (caller: string) => {
            const functionName = caller.split(`a=a.split("");`)[1].split(".")[0];
            if (!functionName) return '';

            const functionStart = `var ${functionName}={`;
            const ndx = body.indexOf(functionStart);
            if (ndx < 0) return '';

            return `var ${functionName}=${cutAfterJS(body.slice(ndx + functionStart.length - 1))}`;
        };
        //Вытаскиваем Decoder
        const extractDecipher = () => {
            const functionName = body.split(`a.set("alr","yes");c&&(c=`)[1].split(`(decodeURIC`)[0];

            if (functionName && functionName.length) {
                const functionStart = `${functionName}=function(a)`;
                const ndx = body.indexOf(functionStart);

                if (ndx >= 0) {
                    let functionBody = `var ${functionStart}${cutAfterJS(body.slice(ndx + functionStart.length))}`;
                    functions.push(`${extractManipulations(functionBody)};${functionBody};${functionName}(sig);`);
                }
            }
        };
        //Вытаскиваем Ncode
        const extractNCode = () => {
            let functionName = body.split(`&&(b=a.get("n"))&&(b=`)[1].split(`(b)`)[0];

            if (functionName.includes('[')) functionName = body.split(`${functionName.split('[')[0]}=[`)[1].split(`]`)[0];

            if (functionName && functionName.length) {
                const functionStart = `${functionName}=function(a)`;
                const ndx = body.indexOf(functionStart);

                if (ndx >= 0) functions.push(`var ${functionStart}${cutAfterJS(body.slice(ndx + functionStart.length))};${functionName}(ncode);`);
            }
        };

        extractDecipher();
        extractNCode();
        return functions;
    }
    //====================== ====================== ====================== ======================
    /**
     * Применить расшифровку и n-преобразование к индивидуальному формату
     * @param {Object} format
     * @param {vm.Script} decipherScript
     * @param {vm.Script} nTransformScript
     */
    function setDownloadURL(format: YouTubeFormat, decipherScript: scriptVM, nTransformScript: scriptVM): void {
        const decipher = (url: string): string => {
            // noinspection JSDeprecatedSymbols
            const args = querystring.parse(url);
            if (!args.s || !decipherScript) return args.url as string;

            const components = new URL(decodeURIComponent(args.url as string));
            components.searchParams.set(args.sp as string ? args.sp as string : 'signature', decipherScript.runInNewContext({ sig: decodeURIComponent(args.s as string) }));
            return components.toString();
        };
        const ncode = (url: string) => {
            const components = new URL(decodeURIComponent(url));
            const n = components.searchParams.get('n');
            if (!n || !nTransformScript) return url;
            components.searchParams.set('n', nTransformScript.runInNewContext({ ncode: n }));
            return components.toString();
        };
        const url = format.url || format.signatureCipher || format.cipher;

        format.url = !format.url ? ncode(decipher(url)) : ncode(url);
    }
}
interface scriptVM { runInNewContext: (object: {}) => string; }
const ESCAPING_SEGMENT = [
    // Strings
    { start: '"', end: '"' },
    { start: "'", end: "'" },
    { start: '`', end: '`' },

    // RegEx
    { start: '/', end: '/', startPrefix: /(^|[[{:;,])\s?$/ }
];
//====================== ====================== ====================== ======================
//====================== ====================== ====================== ======================
//====================== ====================== ====================== ======================
//====================== ====================== ====================== ======================
// RegExp for various js functions
const var_js = '[a-zA-Z_\\$]\\w*';
const singleQuote = `'[^'\\\\]*(:?\\\\[\\s\\S][^'\\\\]*)*'`;
const duobleQuote = `"[^"\\\\]*(:?\\\\[\\s\\S][^"\\\\]*)*"`;
const quote_js = `(?:${singleQuote}|${duobleQuote})`;
const key_js = `(?:${var_js}|${quote_js})`;
const prop_js = `(?:\\.${var_js}|\\[${quote_js}\\])`;
const empty_js = `(?:''|"")`;
const reverse_function = ':function\\(a\\)\\{' + '(?:return )?a\\.reverse\\(\\)' + '\\}';
const slice_function = ':function\\(a,b\\)\\{' + 'return a\\.slice\\(b\\)' + '\\}';
const splice_function = ':function\\(a,b\\)\\{' + 'a\\.splice\\(0,b\\)' + '\\}';
const swap_function =
    ':function\\(a,b\\)\\{' +
    'var c=a\\[0\\];a\\[0\\]=a\\[b(?:%a\\.length)?\\];a\\[b(?:%a\\.length)?\\]=c(?:;return a)?' +
    '\\}';
const obj_regexp = new RegExp(
    `var (${var_js})=\\{((?:(?:${key_js}${reverse_function}|${key_js}${slice_function}|${key_js}${splice_function}|${key_js}${swap_function}),?\\r?\\n?)+)};`
);
const function_regexp = new RegExp(
    `${
        `function(?: ${var_js})?\\(a\\)\\{` + `a=a\\.split\\(${empty_js}\\);\\s*` + `((?:(?:a=)?${var_js}`
    }${prop_js}\\(a,\\d+\\);)+)` +
    `return a\\.join\\(${empty_js}\\)` +
    `\\}`
);
const reverse_regexp = new RegExp(`(?:^|,)(${key_js})${reverse_function}`, 'm');
const slice_regexp = new RegExp(`(?:^|,)(${key_js})${slice_function}`, 'm');
const splice_regexp = new RegExp(`(?:^|,)(${key_js})${splice_function}`, 'm');
const swap_regexp = new RegExp(`(?:^|,)(${key_js})${swap_function}`, 'm');


namespace OldDecipher {
    /**
     * @description Изменение форматов перед их использованием
     * @param formats {YouTubeFormat[]} YouTube форматы
     * @param html5player {string} Страница html5player
     */
    export async function parseFormats(formats: YouTubeFormat[], html5player: string) {
        const body = await httpsClient.parseBody(html5player); //Берем html5player страницу
        const tokens = parseTokens(body);

        formats.forEach((format) => {
            const cipher = format.signatureCipher || format.cipher;

            if (cipher) {
                const params = Object.fromEntries(new URLSearchParams(cipher));
                Object.assign(format, params);
                delete format.signatureCipher;
                delete format.cipher;
            }

            if (tokens && format.s && format.url) {
                const signature = DecodeSignature(tokens, format.s);
                const Url = new URL(decodeURIComponent(format.url));
                Url.searchParams.set('ratebypass', 'yes');

                if (signature) Url.searchParams.set(format.sp || 'signature', signature);

                // @ts-ignore
                Object.keys(format).forEach(key => delete format[key]);

                format.url = Url.toString();
            } else {
                const index = formats.indexOf(format);
                if (index > 0) formats.splice(index, 1);
            }
        });

        return formats;
    }
    //====================== ====================== ====================== ======================
    /**
     * @description Проводим некоторые манипуляции с signature
     * @param tokens {string[]}
     * @param signature {string}
     */
    function DecodeSignature(tokens: string[], signature: string): string {
        let sig = signature.split("");

        for (const token of tokens) {
            let position;
            const nameToken = token.slice(2);

            switch (token.slice(0, 2)) {
                case "sw": { position = parseInt(nameToken); swapPositions(sig, position); break; }
                case "sl": { position = parseInt(nameToken); sig = sig.slice(position); break; }
                case "sp": { position = parseInt(nameToken); sig.splice(0, position); break; }
                case "rv": { sig.reverse(); break; }
            }
        }
        return sig.join("");
    }
    //====================== ====================== ====================== ======================
    /**
     * @description Берем данные с youtube html5player
     * @param page {string} Страница html5player
     */
    function parseTokens(page: string): string[] {
        const funAction = function_regexp.exec(page);
        const objAction = obj_regexp.exec(page);

        if (!funAction || !objAction) return null;

        const object = objAction[1].replace(/\$/g, '\\$');
        const objPage = objAction[2].replace(/\$/g, '\\$');
        const funPage = funAction[1].replace(/\$/g, '\\$');

        let result: RegExpExecArray, tokens: string[] = [], keys: string[] = [];

        [reverse_regexp, slice_regexp, splice_regexp, swap_regexp].forEach((res) => {
            result = res.exec(objPage);
            keys.push(replacer(result));
        });

        const parsedKeys = `(${keys.join('|')})`;
        const tokenizeRegexp = new RegExp(`(?:a=)?${object}(?:\\.${parsedKeys}|\\['${parsedKeys}'\\]|\\["${parsedKeys}"\\])` + `\\(a,(\\d+)\\)`, 'g');

        while ((result = tokenizeRegexp.exec(funPage)) !== null) {
            (() => {
                const key = result[1] || result[2] || result[3];
                switch (key) {
                    case keys[3]: return tokens.push(`sw${result[4]}`);
                    case keys[0]: return tokens.push('rv');
                    case keys[1]: return tokens.push(`sl${result[4]}`);
                    case keys[2]: return tokens.push(`sp${result[4]}`);
                }
            })();
        }
        return tokens;
    }
    //====================== ====================== ====================== ======================
    /**
     * @description Уменьшаем кол-во кода
     * @param res {RegExpExecArray}
     */
    function replacer(res: RegExpExecArray):string {
        return res && res[1].replace(/\$/g, '\\$').replace(/\$|^'|^"|'$|"$/g, '');
    }
}
//====================== ====================== ====================== ======================
/**
 * Сопоставление начальной и конечной фигурной скобки входного JS
 * @param {string} mixedJson
 * @returns {string}
 */
function cutAfterJS(mixedJson: string): string {
    let open, close; //Define the general open and closing tag

    if (mixedJson[0] === '[') { open = '['; close = ']'; }
    else if (mixedJson[0] === '{') { open = '{'; close = '}'; }

    if (!open) throw new Error(`Can't cut unsupported JSON (need to begin with [ or { ) but got: ${mixedJson[0]}`);

    // counter - Current open brackets to be closed
    // isEscaped - States if the current character is treated as escaped or not
    // isEscapedObject = States if the loop is currently inside an escaped js object
    let counter = 0, isEscaped = false, isEscapedObject = null;

    // Go through all characters from the start
    for (let i = 0; i < mixedJson.length; i++) {
        // End of current escaped object
        if (!isEscaped && isEscapedObject !== null && mixedJson[i] === isEscapedObject.end) {
            isEscapedObject = null;
            continue;
            // Might be the start of a new escaped object
        } else if (!isEscaped && isEscapedObject === null) {
            for (const escaped of ESCAPING_SEGMENT) {
                if (mixedJson[i] !== escaped.start) continue;
                // Test startPrefix against last 10 characters
                if (!escaped.startPrefix || mixedJson.substring(i - 10, i).match(escaped.startPrefix)) {
                    isEscapedObject = escaped;
                    break;
                }
            }
            // Continue if we found a new escaped object
            if (isEscapedObject !== null) continue;
        }

        // Toggle the isEscaped boolean for every backslash
        // Reset for every regular character
        isEscaped = mixedJson[i] === '\\' && !isEscaped;

        if (isEscapedObject !== null) continue;

        if (mixedJson[i] === open) counter++;
        else if (mixedJson[i] === close) counter--;

        // All brackets have been closed, thus end of JSON is reached
        if (counter === 0) return mixedJson.substring(0, i + 1);
    }

    // We ran through the whole string and ended up with an unclosed bracket
    throw Error("Can't cut unsupported JSON (no matching closing bracket found)");
}
function swapPositions(array: any[], position: number): void {
    const first = array[0];
    array[0] = array[position];
    array[position] = first;
}