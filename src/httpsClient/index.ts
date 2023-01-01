import {BrotliDecompress, createBrotliDecompress, createDeflate, createGunzip, Deflate, Gunzip} from 'node:zlib';
import {request as httpsRequest, RequestOptions} from "https";
import {IncomingMessage, request as httpRequest} from "http";
import {getCookies, uploadCookie} from "./Cookie";
import UserAgents from "@db/UserAgents.json";

const decoderBase = {
    "gzip": createGunzip,
    "br": createBrotliDecompress,
    "deflate": createDeflate
};

//Поддержка запросов
const protocols = {
    "http:": httpRequest,  //http запрос
    "https:": httpsRequest //https запрос
}

export namespace httpsClient {
    /**
     * @description Создаем запрос по ссылке, модифицируем по необходимости
     * @param url {string} Ссылка
     * @param options {httpsClientOptions} Настройки запроса
     * @requires {uploadCookie, getCookies}
     */
    export function Request(url: string, options: httpsClientOptions = {request: {headers: {}}, options: {}}): Promise<IncomingMessage> {
        //Добавляем User-Agent
        if (options.options?.userAgent) {
            const {Agent, Version} = GetUserAgent();

            if (Agent) options.request.headers = {...options.request.headers, "user-agent": Agent};
            if (Version) options.request.headers = {...options.request.headers, "sec-ch-ua-full-version": Version};
        }

        //Добавляем куки
        if (options.options?.cookie) {
            const cookie = getCookies();
            options.request.headers = {...options.request.headers, "cookie": cookie};
        }


        return new Promise((resolve, reject) => {
            const {hostname, pathname, search, port, protocol} = new URL(url);
            const Options: RequestOptions = {
                host: hostname, path: pathname + search, port,
                headers: options?.request?.headers ?? {}, method: options?.request?.method ?? "GET",
            };
            const request = protocols[protocol as "https:" | "http:"](Options, (res: IncomingMessage) => {
                //Автоматическое перенаправление
                if ((res.statusCode >= 300 && res.statusCode < 400) && res.headers?.location) return resolve(Request(res.headers.location, options));
                //Обновляем куки
                if (options?.options?.cookie && res.headers && res.headers["set-cookie"]) setImmediate(() => uploadCookie(res.headers["set-cookie"]));
                return resolve(res);
            });

            //Если возникла ошибка
            request.on("error", reject);

            //Если запрос POST, отправляем ответ на сервер
            if (options?.request?.method === "POST") request.write(options.request?.body);

            //Заканчиваем запрос
            request.end();
        });
    }
    //====================== ====================== ====================== ======================
    /**
     * @description Получаем страницу в формате string
     * @param url {string} Ссылка
     * @param options {httpsClientOptions} Настройки запроса
     * @requires {Request}
     */
    export function parseBody(url: string, options?: httpsClientOptions): Promise<string> {
        return new Promise((resolve) => Request(url, options).then((res: IncomingMessage) => {
            const encoding = res.headers["content-encoding"] as "br" | "gzip" | "deflate";
            const decoder: Decoder | null = decoderBase[encoding] ? decoderBase[encoding]() : null;
            const data: string[] = [];
            const runDecode = (decoder: Decoder | IncomingMessage) => {
                decoder.setEncoding("utf-8");
                decoder.on("data", (c) => data.push(c));
                decoder.once("end", () => {
                    if (!decoder.destroyed) res.destroy();

                    return resolve(data.join(""));
                });
            };

            if (!decoder) return runDecode(res);
            return runDecode(res.pipe(decoder));
        }));
    }
    //====================== ====================== ====================== ======================
    /**
     * @description Получаем со страницы JSON (Работает только тогда когда все страница JSON)
     * @param url {string} Ссылка
     * @param options {httpsClientOptions} Настройки запроса
     * @requires {parseBody}
     */
    export function parseJson(url: string, options?: httpsClientOptions): Promise<null | any> {
        return parseBody(url, options).then((body: string) => {
            if (!body) return null;

            try {
                return JSON.parse(body);
            } catch (e) {
                console.log(`Invalid json response body at ${url} reason: ${e.message}`);
                return null;
            }
        });
    }
    //====================== ====================== ====================== ======================
    /**
     * @description Проверяем ссылку на работоспособность
     * @param url {string} Ссылка
     * @requires {Request}
     */
    export function checkLink(url: string): Promise<"OK" | "Fail"> | "Fail" {
        if (!url) return "Fail";

        return Request(url, {request: {method: "HEAD"}}).then((resource: IncomingMessage) => {
            if (resource instanceof Error) return "Fail"; //Если есть ошибка
            if (resource.statusCode >= 200 && resource.statusCode < 400) return "OK"; //Если возможно скачивать ресурс
            return "Fail"; //Если прошлые варианты не подходят, то эта ссылка не рабочая
        });
    }
}
//====================== ====================== ====================== ======================
/**
 * @description Получаем рандомный user-agent и его версию
 */
function GetUserAgent(): { Agent: string, Version: string } {
    const MinAgents = Math.ceil(0);
    const MaxAgents = Math.floor(UserAgents.length - 1);

    //Сам агент
    const Agent = UserAgents[Math.floor(Math.random() * (MaxAgents - MinAgents + 1)) + MinAgents];
    //Версия агента
    const Version = Agent?.split("Chrome/")[1]?.split(" ")[0];

    return {Agent, Version};
}
//====================== ====================== ====================== ======================
type Decoder = BrotliDecompress | Gunzip | Deflate;

// @ts-ignore
interface ReqOptions extends RequestOptions {
    body?: string;
    method?: "GET" | "POST" | "HEAD";
}

export interface httpsClientOptions {
    request?: ReqOptions;
    options?: {
        userAgent?: boolean;
        cookie?: boolean;
    };
}