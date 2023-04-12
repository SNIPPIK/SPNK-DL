import { RequestOptions, Request, method } from "./Structures/Request";
import { getUserAgent } from "./Structures/Utils";

type RequestType = "string" | "json" | "full";
//Как можно получить данные
const RequestType = {
    "string": Request.parseBody,
    "json": Request.parseJson,
    "full": Request.Request
};

type resolveClient = any | Error;

export namespace httpsClient {
    /**
     * @description Делаем GET запрос
     * @param url {string} Ссылка
     * @param options {httpsClientOptions} Доп настройки
     */
    export function get(url: string, options: httpsClientOptions): Promise<resolveClient> {
        return runRequest(url, "GET", options.resolve, options);
    }
}
//====================== ====================== ====================== ======================
/**
 * @description Создаем запрос из требований
 * @param url {string} Ссылка
 * @param method {string} Метод зпроса
 * @param type {string} Тип выдачи данных
 * @param options {httpsClientOptions} Доп настройки
 */
function runRequest(url: string, method: method, type: RequestType, options: httpsClientOptions): Promise<any> {
    const { hostname, pathname, search, port, protocol } = new URL(url);
    let headers = options.headers ?? {};
    let reqOptions: RequestOptions = { method, hostname, path: pathname + search, port, headers, protocol: protocol }

    //Добавляем User-Agent
    if (options.useragent) {
        const { Agent, Version } = getUserAgent();

        if (Agent) headers = { ...headers, "user-agent": Agent };
        if (Version) headers = { ...headers, "sec-ch-ua-full-version": Version };
    }

    if (type === "json") {
        headers = { ...headers, 'Content-Type': 'application/json' };
    }

    return RequestType[type](reqOptions);
}

interface httpsClientOptions {
    //Тип выдаваемых данных
    resolve: RequestType;

    //Headers запроса
    headers?: RequestOptions["headers"];

    //Добавлять рандомный user-agent
    useragent?: boolean;
}