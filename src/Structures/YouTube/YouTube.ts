import { extractSignature, YouTubeFormat } from "./Decipher";
import { httpsClient } from "../httpsClient";

//====================== ====================== ====================== ======================
/**
 * Простой парсер youtube
 * Некоторое взято у ytdl-core (Decipher или extractorSignature)
 */
//====================== ====================== ====================== ======================

//Локальная база данных
const db = {
    link: "https://www.youtube.com"
};
//====================== ====================== ====================== ======================
/**
 * @description Формирование общих данных
 */
namespace construct {
    /**
     * @description Из полученных данных заготовляваем трек для AudioPlayer<Queue>
     * @param video {any} Любое видео с youtube
     */
    export function video(video: any) {
        return new Promise(async (resolve) => {
            return resolve({
                url: `https://youtu.be/${video.videoId}`,
                title: video.title,
                duration: { seconds: video.lengthSeconds },
                image: video.thumbnail.thumbnails.pop(),
                isLive: video.isLiveContent,
                format: null as YouTubeFormat[]
            });
        });
    }
}
//====================== ====================== ====================== ======================
/**
 * @description Какие запросы доступны (какие были добавлены)
 */
export namespace YouTube {
    /**
     * @description Получаем данные о видео
     * @param url {string} Ссылка на видео
     */
    export function getVideo(url: string) {
        const ID = getID(url);

        return new Promise(async (resolve, reject) => {
            //Если ID видео не удалось извлечь из ссылки
            if (!ID) return reject(Error("[APIs]: Не удалось получить ID трека!"));

            try {
                //Создаем запрос
                const page = await httpsClient.get(`${db.link}/watch?v=${ID}&has_verified=1`, {
                    resolve: "string", useragent: true,
                    headers: {
                        "accept-language": "en-US,en;q=0.9,en-US;q=0.8,en;q=0.7",
                        "accept-encoding": "gzip, deflate, br"
                    }
                }) as string | Error;

                if (page instanceof Error) return reject(Error("[APIs]: Не удалось получить данные!"));

                const result = JSON.parse(page?.split("var ytInitialPlayerResponse = ")?.[1]?.split(";</script>")[0]?.split(/(?<=}}});\s*(var|const|let)\s/)[0]);

                //Если нет данных на странице
                if (!result) return reject(Error("[APIs]: Не удалось получить данные!"));

                //Если статус получения данные не OK
                if (result.playabilityStatus?.status === "LOGIN_REQUIRED") return reject(Error(`[APIs]: Данное видео невозможно включить из-за проблем с авторизацией!`));
                else if (result.playabilityStatus?.status !== "OK") return reject(Error(`[APIs]: Не удалось получить данные! Status: ${result?.playabilityStatus?.status}`));

                const details = result.videoDetails;
                const video = await construct.video(details);
                let audios: YouTubeFormat[] = [];

                //Выбираем какой формат у видео из <VideoDetails>.isLiveContent
                if (details.isLiveContent) audios = [{ url: details.streamingData?.dashManifestUrl ?? null }]; //dashManifestUrl, hlsManifestUrl
                else {
                    const html5player = `${db.link}${page.split('"jsUrl":"')[1].split('"')[0]}`;
                    const format = await extractSignature([...result.streamingData?.formats ?? [], ...result.streamingData?.adaptiveFormats ?? []], html5player);

                    //Если формат ну удалось получить из-за ошибки
                    if (format instanceof Error) return reject(format);

                    audios = format;
                }
                //@ts-ignore
                video.format = audios;


                return resolve(video);
            } catch (e) { return reject(Error(`[APIs]: ${e}`)) }
        });
    }
}
//====================== ====================== ====================== ======================
/**
 * @description Получаем ID
 * @param url {string} Ссылка
 * @param isPlaylist
 */
function getID(url: string, isPlaylist: boolean = false): string {
    try {
        if (typeof url !== "string") return null;
        const parsedLink = new URL(url);

        if (parsedLink.searchParams.get("list") && isPlaylist) return parsedLink.searchParams.get("list");
        else if (parsedLink.searchParams.get("v") && !isPlaylist) return parsedLink.searchParams.get("v");
        return parsedLink.pathname.split("/").pop();
    } catch (err) { return null; }
}