import {URL} from 'node:url';
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
}

export namespace Decipher {
    /**
     * Применяет преобразование параметра расшифровки и n ко всем URL-адресам формата.
     * @param {Array.<Object>} formats
     * @param {string} html5player
     */
    export async function parseFormats(formats: YouTubeFormat[], html5player: string) {
        const functions = await getFunctions(html5player);
        const decipherScript = functions.length ? new vm.Script(functions[0]) : null;
        const nTransformScript = functions.length > 1 ? new vm.Script(functions[1]) : null;

        //Меняем данные в Array<YouTubeFormat>
        for (const format of formats) setDownloadURL(format, decipherScript, nTransformScript);

        return formats;
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

        // @ts-ignore
        Object.keys(format).forEach(key => delete format[key]);

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