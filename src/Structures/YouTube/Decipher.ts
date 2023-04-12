import { URL, URLSearchParams } from 'node:url';
import * as querystring from "querystring";
import { httpsClient } from "../httpsClient";
import * as vm from "vm";

//====================== ====================== ====================== ======================
/*                        Original YouTube Signature extractor                             //
//             https://github.com/fent/node-ytdl-core/blob/master/lib/sig.js               */
//====================== ====================== ====================== ======================

export interface YouTubeFormat {
    url: string;
    signatureCipher?: string;
    cipher?: string
    sp?: string;
    s?: string;
    mimeType?: string;
    bitrate?: number;
    qualityLabel?: string;
}

//====================== ====================== ====================== ======================
/*                               Executes decryption runtime                               */
//====================== ====================== ====================== ======================
/**
 * @description Применяет преобразование параметра расшифровки и n ко всем URL-адресам формата.
 * @param {Array.<Object>} formats
 * @param {string} html5player
 */
export function extractSignature(formats: YouTubeFormat[], html5player: string): Promise<YouTubeFormat[]> {
    return new Promise(async (resolve) => {
        //Пробуем 1 способ получения ссылки
        try {
            const functions = await extractFunctions(html5player);

            for (let format of formats) {
                const url = setDownloadURL(format, functions.length ? new vm.Script(functions[0]) : null, functions.length > 1 ? new vm.Script(functions[1]) : null);

                if (!url) formats.shift();
                else format.url = url;
            }
        } catch (e) { //Если 1 способ не помог пробуем 2
            const page = await httpsClient.get(html5player, { resolve: "string" }) as string;
            const tokens = parseTokens(page);

            for (let format of formats) {
                const url = setDownload(format, tokens);

                if (!url) formats.shift();
                else format.url = url;
            }
        }

        return resolve(formats);
    });
}
//====================== ====================== ====================== ======================
/*                            Functions of the new decryption                              */
//====================== ====================== ====================== ======================
/**
 * @description Извлечь функции расшифровки подписи и преобразования n параметров из файла html5player
 * @param {string} html5Link
 * @returns {Promise<Array.<string>>}
 */
function extractFunctions(html5Link: string): Promise<string[]> {
    const functions: string[] = [];
    return new Promise((resolve, reject) => httpsClient.get(html5Link, { resolve: "string" }).then((body: string) => {
        if (!body) return;

        const decipherName = body.split(`a.set("alr","yes");c&&(c=`)[1].split(`(decodeURIC`)[0];
        let ncodeName = body.split(`&&(b=a.get("n"))&&(b=`)[1].split(`(b)`)[0];

        //extract Decipher
        if (decipherName && decipherName.length) {
            const functionStart = `${decipherName}=function(a)`;
            const ndx = body.indexOf(functionStart);

            if (ndx >= 0) {
                let functionBody = `var ${functionStart}${cutAfterJS(body.slice(ndx + functionStart.length))}`;
                functions.push(`${extractManipulations(functionBody, body)};${functionBody};${decipherName}(sig);`);
            }
        }

        //extract ncode
        if (ncodeName.includes('[')) ncodeName = body.split(`${ncodeName.split('[')[0]}=[`)[1].split(`]`)[0];
        if (ncodeName && ncodeName.length) {
            const functionStart = `${ncodeName}=function(a)`;
            const ndx = body.indexOf(functionStart);

            if (ndx >= 0) functions.push(`var ${functionStart}${cutAfterJS(body.slice(ndx + functionStart.length))};${ncodeName}(ncode);`);
        }

        //Проверяем если ли functions
        if (!functions || !functions.length) return;

        return resolve(functions);
    }).catch((err: Error) => reject(err)));
}
//====================== ====================== ====================== ======================
/**
 * @description Пытаемся вытащить фрагмент для дальнейшей манипуляции
 * @param caller {string}
 * @param body {string}
 */
function extractManipulations(caller: string, body: string): string {
    const functionName = caller.split(`a=a.split("");`)[1].split(".")[0];
    if (!functionName) return '';

    const functionStart = `var ${functionName}={`;
    const ndx = body.indexOf(functionStart);
    if (ndx < 0) return '';

    return `var ${functionName}=${cutAfterJS(body.slice(ndx + functionStart.length - 1))}`;
}
//====================== ====================== ====================== ======================
/**
 * @description Применить расшифровку и n-преобразование к индивидуальному формату
 * @param format {Object}
 * @param decipherScript {vm.Script}
 * @param nTransformScript {vm.Script}
 */
function setDownloadURL(format: YouTubeFormat, decipherScript?: vm.Script, nTransformScript?: vm.Script): string | void {
    const url = format.url || format.signatureCipher || format.cipher;

    //Удаляем не нужные данные
    delete format.signatureCipher;
    delete format.cipher;

    return !format.url ? _ncode(_decipher(url, decipherScript), nTransformScript) : _ncode(url, nTransformScript);
}
//====================== ====================== ====================== ======================
/**
 * @description Расшифровка ссылки
 * @param url {string} Ссылка которая не работает
 * @param decipherScript {vm.Script}
 */
function _decipher(url: string, decipherScript: vm.Script): string {
    const args = querystring.parse(url);
    if (!args.s || !decipherScript) return args.url as string;

    const components = new URL(decodeURIComponent(args.url as string));
    components.searchParams.set(args.sp as string ? args.sp as string : 'signature', decipherScript.runInNewContext({ sig: decodeURIComponent(args.s as string) }));
    return components.toString();
}
//====================== ====================== ====================== ======================
/**
 * @description Добавляем ссылке n=sig, для ускорения работы ссылки, данные с такой ссылки будут обрабатываться быстрее
 * @param url {string} Ссылка которая работает
 * @param nTransformScript {vm.Script}
 */
function _ncode(url: string, nTransformScript: vm.Script): string {
    const components = new URL(decodeURIComponent(url));
    const n = components.searchParams.get('n');
    if (!n || !nTransformScript) return url;
    components.searchParams.set('n', nTransformScript.runInNewContext({ ncode: n }));
    return components.toString();
}
//====================== ====================== ====================== ======================
const EsSegment = [
    // Strings
    { s: '"', e: '"' }, { s: "'", e: "'" }, { s: '`', e: '`' },

    // RegEx
    { s: '/', e: '/', prf: /(^|[[{:;,/])\s?$/ || /(^|[[{:;,])\s?$/ }
];
/**
 * @description Сопоставление начальной и конечной фигурной скобки входного JS
 * @param mixedJson {string}
 * @returns {string}
 */
function cutAfterJS(mixedJson: string): string {
    let open, close; //Define the general open and closing tag

    if (mixedJson[0] === '[') { open = '['; close = ']'; }
    else if (mixedJson[0] === '{') { open = '{'; close = '}'; }

    if (!open) throw Error(`Can't cut unsupported JSON (need to begin with [ or { ) but got: ${mixedJson[0]}`);

    // counter - Current open brackets to be closed
    // isEscaped - States if the current character is treated as escaped or not
    // isEscapedObject = States if the loop is currently inside an escaped js object
    let counter = 0, isEscaped = false, isEscapedObject = null;

    // Go through all characters from the start
    for (let i = 0; i < mixedJson.length; i++) {
        // End of current escaped object
        if (!isEscaped && isEscapedObject !== null && mixedJson[i] === isEscapedObject.e) { isEscapedObject = null; continue; }
        // Might be the start of a new escaped object
        else if (!isEscaped && isEscapedObject === null) {
            for (const escaped of EsSegment) {
                if (mixedJson[i] !== escaped.s) continue;
                // Test startPrefix against last 10 characters
                if (!escaped.prf || mixedJson.substring(i - 10, i).match(escaped.prf)) { isEscapedObject = escaped; break; }
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
//====================== ====================== ====================== ======================
/*                            Functions of the old decryption                              */
//====================== ====================== ====================== ======================
const js = {
    var: '[a-zA-Z_\\$]\\w*',
    single: `'[^'\\\\]*(:?\\\\[\\s\\S][^'\\\\]*)*'`,
    duo: `"[^"\\\\]*(:?\\\\[\\s\\S][^"\\\\]*)*"`,
    empty: `(?:''|"")`,

    reverse: ':function\\(a\\)\\{' + '(?:return )?a\\.reverse\\(\\)' + '\\}',
    slice: ':function\\(a,b\\)\\{' + 'return a\\.slice\\(b\\)' + '\\}',
    splice: ':function\\(a,b\\)\\{' + 'a\\.splice\\(0,b\\)' + '\\}',
    swap: ':function\\(a,b\\)\\{' +
        'var c=a\\[0\\];a\\[0\\]=a\\[b(?:%a\\.length)?\\];a\\[b(?:%a\\.length)?\\]=c(?:;return a)?' +
        '\\}'
}
const quote = `(?:${js.single}|${js.duo})`;
const prop = `(?:\\.${js.var}|\\[${quote}\\])`;
const key = `(?:${js.var}|${quote})`;

const regExp = {
    reverse: new RegExp(`(?:^|,)(${key})${js.reverse}`, 'm'),
    slice: new RegExp(`(?:^|,)(${key})${js.slice}`, 'm'),
    splice: new RegExp(`(?:^|,)(${key})${js.splice}`, 'm'),
    swap: new RegExp(`(?:^|,)(${key})${js.swap}`, 'm'),


    obj: new RegExp(`var (${js.var})=\\{((?:(?:${key}${js.reverse}|${key}${js.slice}|${key}${js.splice}|${key}${js.swap}),?\\r?\\n?)+)};`),
    function: new RegExp(
        `${`function(?: ${js.var})?\\(a\\)\\{` + `a=a\\.split\\(${js.empty}\\);\\s*` + `((?:(?:a=)?${js.var}`
        }${prop}\\(a,\\d+\\);)+)` +
        `return a\\.join\\(${js.empty}\\)` +
        `\\}`
    )
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
            case "sw": { position = parseInt(nameToken); swapPositions<string>(sig, position); break; }
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
    const funAction = regExp.function.exec(page);
    const objAction = regExp.obj.exec(page);

    if (!funAction || !objAction) return null;

    const object = objAction[1].replace(/\$/g, "\\$");
    const objPage = objAction[2].replace(/\$/g, "\\$");
    const funPage = funAction[1].replace(/\$/g, "\\$");

    let result: RegExpExecArray, tokens: string[] = [], keys: string[] = [];

    [regExp.reverse, regExp.slice, regExp.splice, regExp.swap].forEach((res) => {
        result = res.exec(objPage);
        keys.push(replacer(result));
    });

    const parsedKeys = `(${keys.join('|')})`;
    const tokenizeRegexp = new RegExp(`(?:a=)?${object}(?:\\.${parsedKeys}|\\['${parsedKeys}'\\]|\\["${parsedKeys}"\\])` + `\\(a,(\\d+)\\)`, 'g');

    while ((result = tokenizeRegexp.exec(funPage)) !== null) {
        (() => {
            const key = result[1] || result[2] || result[3];
            switch (key) {
                case keys[0]: return tokens.push('rv');
                case keys[1]: return tokens.push(`sl${result[4]}`);
                case keys[2]: return tokens.push(`sp${result[4]}`);
                case keys[3]: return tokens.push(`sw${result[4]}`);
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
function replacer(res: RegExpExecArray): string {
    return res && res[1].replace(/\$/g, "\\$").replace(/\$|^'|^"|'$|"$/g, "");
}
//====================== ====================== ====================== ======================
/**
 * @description Изменяем ссылки
 * @param format {YouTubeFormat} Формат youtube
 * @param tokens {RegExpExecArray} Токены
 */
function setDownload(format: YouTubeFormat, tokens: string[]): string {
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

        return Url.toString();
    }

    return null;
}
/**
 * @description Смена позиции в Array
 * @param array {Array<any>} Array
 * @param position {number} Номер позиции
 */
function swapPositions<V>(array: V[], position: number): void {
    const first = array[0];
    array[0] = array[position];
    array[position] = first;
}