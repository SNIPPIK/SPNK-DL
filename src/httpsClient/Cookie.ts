import {existsSync, readFileSync, writeFile} from 'node:fs';

/**
 * @description Получаем куки из json файла
 */
export function getCookies(): null | string {
    try {
        if (!existsSync(`./DataBase/Cookie.json`)) return null;
        return JSON.parse(readFileSync(`./DataBase/Cookie.json`, "utf8")).cookie;
    } catch { return null; }
}
//====================== ====================== ====================== ======================
/**
 * @description Сохраняем куки в json файл
 * @param Cookie {string | string[]} Что нужно добавить к текущему куки
 */
export function uploadCookie(Cookie: string | string[]): void {
    if (!existsSync(`./DataBase/Cookie.json`)) return null;

    try {
        const CookieFile: {cookie: string} = JSON.parse(readFileSync(`./DataBase/Cookie.json`, "utf8"));
        const newCookie: string = ParsingCookieToString({...ParsingCookieToJson(CookieFile.cookie), ...ParsingCookieToJson(Cookie)});

        writeFile('./db/Cookie.json', JSON.stringify({cookie: newCookie}, null, `\t`), () => null);
    } catch (err) { throw new Error("Cookie file has damaged!"); }
}
//====================== ====================== ====================== ======================
/**
 * @description Создаем из строки json
 * @param headCookie {string[] | string} Что нужно добавить к текущему куки
 */
function ParsingCookieToJson(headCookie: string[] | string): {} {
    let Json = {};

    //Разбираем куки в JSON
    const filteredCookie = (cook: string) => cook.split(";").forEach((cookie) => {
        const arrayCookie = cookie.split("=");

        //Если параметра нет, то не добавляем его
        if (arrayCookie.length <= 1) return;

        const key: string = arrayCookie.shift()?.trim();
        const value: string = arrayCookie.join("=").trim();

        Json = {...Json, [key]: value};
    });

    if (typeof headCookie === "string") filteredCookie(headCookie);
    else headCookie.forEach(filteredCookie);

    return Json;
}
//====================== ====================== ====================== ======================
/**
 * @description Получаем из json формата строку
 * @param JsonCookie {object} Json куки
 */
function ParsingCookieToString(JsonCookie: {}) {
    let result: string[] = [];

    for (const [key, value] of Object.entries(JsonCookie)) result.push(`${key}=${value}`);
    return result.join("; ");
}