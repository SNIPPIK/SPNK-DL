import { BrotliDecompress, createBrotliDecompress, createDeflate, createGunzip, Deflate, Gunzip } from "node:zlib";
import { request as httpsRequest, RequestOptions as ReqOptions } from "https";
import { IncomingMessage, request as httpRequest } from "http";

export { Request, RequestOptions, method };

const decoderBase = {
    "gzip": createGunzip,
    "br": createBrotliDecompress,
    "deflate": createDeflate
};
//Доступные запросы
const protocols = {
    "http": httpRequest,  //http запрос
    "https": httpsRequest //https запрос
};

namespace Request {
    /**
     * @description Создаем запрос по ссылке, модифицируем по необходимости
     * @param url {string} Ссылка
     * @param options {httpsClientOptions} Настройки запроса
     * @requires {uploadCookie, getCookies}
     */
    export function Request(options: RequestOptions): Promise<IncomingMessage | Error> {
        const protocol = options.protocol?.split(":")[0] as "http" | "https";

        return new Promise((resolve) => {
            const request = protocols[protocol](options, (res: IncomingMessage) => {
                //Автоматическое перенаправление
                if ((res.statusCode >= 300 && res.statusCode < 400) && res.headers?.location) return resolve(Request({ ...options, path: res.headers.location }));

                return resolve(res);
            });
            //Если запрос получил ошибку
            request.once("error", resolve);
            request.once("timeout", () => resolve(Error(`[APIs]: Connection Timeout Exceeded ${options?.hostname}:${options?.port ?? 443}`)));

            //Если запрос POST, отправляем ответ на сервер
            if (options.method === "POST" && options.body) request.write(options.body);

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
    export function parseBody(options?: RequestOptions): Promise<string | Error> {
        return new Promise((resolve) => Request(options).then((request) => {
            if (request instanceof Error) return resolve(request);

            const encoding = request.headers["content-encoding"] as "br" | "gzip" | "deflate";
            const decoder: Decoder | null = decoderBase[encoding] ? decoderBase[encoding]() : null;

            if (!decoder) return resolve(extractPage(request));
            return resolve(extractPage(request.pipe(decoder)));
        }));
    }
    //====================== ====================== ====================== ======================
    /**
     * @description Получаем со страницы JSON (Работает только тогда когда все страница JSON)
     * @param url {string} Ссылка
     * @param options {httpsClientOptions} Настройки запроса
     * @requires {parseBody}
     */
    export function parseJson(options?: RequestOptions): Promise<null | any> {
        return new Promise((resolve) => parseBody(options).then(body => {
            if (body instanceof Error) return resolve(null);

            try {
                return resolve(JSON.parse(body));
            } catch (e) {
                console.error(`[httpsClient]: Invalid json response body at ${options.hostname} reason: ${e.message}`);
                return resolve(null);
            }
        }));
    }
}
//====================== ====================== ====================== ======================
/**
 * @description Получаем всю страницу
 * @param decoder {Decoder | IncomingMessage}
 */
function extractPage(decoder: Decoder | IncomingMessage): Promise<string> {
    const data: string[] = [];

    return new Promise<string>((resolve) => {
        decoder.setEncoding("utf-8");
        decoder.on("data", (c) => data.push(c));
        decoder.once("end", () => {
            return resolve(data.join(""));
        });
    });
}
type method = "POST" | "GET" | "HEAD";
type Decoder = BrotliDecompress | Gunzip | Deflate;
interface RequestOptions extends ReqOptions {
    body?: string;
    method?: method;
}