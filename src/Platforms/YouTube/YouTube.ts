import {httpsClient, httpsClientOptions} from "@httpsClient";
import {Decipher, YouTubeFormat} from "./Decipher";

const DecipherYt = Decipher.parseFormats;

/**
 * @description Получаем ID
 * @param url {string} Ссылка
 * @param isPlaylist
 */
export function getID(url: string, isPlaylist: boolean = false) {
    if (typeof url !== "string") return "Url is not string";
    const parsedLink = new URL(url);

    if (parsedLink.searchParams.get("list") && isPlaylist) return parsedLink.searchParams.get("list");
    else if (parsedLink.searchParams.get("v") && !isPlaylist) return parsedLink.searchParams.get("v");
    return parsedLink.pathname.split("/")[1];
}

namespace API {
    export function Request(type: "JSON" | "STRING", url: string, options: httpsClientOptions = {options: {}, request: {}}): string | {} {
        if (type === "JSON") return httpsClient.parseJson(url, options);
        return httpsClient.parseBody(url, {
            options: {userAgent: true, cookie: true}, request: {
                headers: {
                    "accept-language": "en-US,en;q=0.9,en-US;q=0.8,en;q=0.7",
                    "accept-encoding": "gzip, deflate, br"
                }
            }
        });
    }
}

namespace construct {
    export async function video(video: any) {
        return {
            url: `https://youtu.be/${video.videoId}`,
            title: video.title,
            duration: {seconds: video.lengthSeconds},
            image: video.thumbnail.thumbnails.pop(),
            isLive: video.isLiveContent
        };
    }
}

export namespace YouTube {
    /**
     * @description Получаем данные о видео
     * @param url {string} Ссылка на видео
     */
    export function getVideo(url: string) {
        const ID = getID(url);

        return new Promise(async (resolve, reject) => {
            const page = await API.Request("STRING", `https://www.youtube.com/watch?v=${ID}&has_verified=1`) as string;
            const result = page.split("var ytInitialPlayerResponse = ")?.[1]?.split(";</script>")[0].split(/(?<=}}});\s*(var|const|let)\s/)[0];

            if (!result) throw reject(new Error("Not found track data!"));
            const jsonResult = JSON.parse(result);

            if (jsonResult.playabilityStatus?.status !== "OK") throw reject(new Error(`Не удалось получить данные из-за: ${jsonResult.playabilityStatus.status}`));

            const details = jsonResult.videoDetails;
            let audios: YouTubeFormat;

            if (details.isLiveContent) audios = {url: details.streamingData?.dashManifestUrl ?? null}; //dashManifestUrl, hlsManifestUrl
            else {
                const html5player = `https://www.youtube.com${page.split('"jsUrl":"')[1].split('"')[0]}`;
                const allFormats = [...jsonResult.streamingData?.formats ?? [], ...jsonResult.streamingData?.adaptiveFormats ?? []];
                const FindOpus: YouTubeFormat[] = allFormats.filter((format: YouTubeFormat) => format.mimeType?.match(/opus/) || format?.mimeType?.match(/audio/));

                audios = (await DecipherYt(FindOpus, html5player)).pop();
            }

            return resolve({...await construct.video(details), format: audios});
        });
    }
}