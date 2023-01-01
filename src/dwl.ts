import {YouTube} from "@APIs";
import {spawn} from "child_process";
import * as urls from "@db/Links.json";

start().catch(console.log);

const ErrorLink: string[] = [];

/**
 * @description Начинаем скачивать видео с youtube
 * @param num {number} номер ссылки в списке
 */
async function start(num = 0): Promise<void> {
    const url = urls[num];

    if (!url) {
        if (ErrorLink.length > 0) console.log(`Не удалось скачать эти видео\n${ErrorLink.join("\n")}\n`);
        return console.log("Ссылки закончились");
    }

    const video: any = await gettingInfo(url);
    num++;

    if (!video || !video.format.url) {
        ErrorLink.push(video.title);
        return start(num);
    }

    const ffmpeg = DecodingMP3(video.format.url, video.title);
    const VideoTime = video.duration.seconds;

    ffmpeg.stderr.on("data", (Buffer) => {
        const info = Buffer.toString();

        if (info.match(/time=/)) {
            const totalDuration: number = ParsingTimeToNumber(info.split("time=")[1].split(".")[0]);
            const sizeFile = info.split("size=")[1].split("kB")[0];
            const process = totalDuration * 100 / VideoTime;

            console.clear();
            console.log(`${video.title}\nSize: ${sizeFile} kB\n[${progressBar(totalDuration, VideoTime, 50)}] ${process} %`);
        }
    });

    ffmpeg.stdout.once("close", () => {
        console.log(`Has downloaded! Path: Audio/`);

        return setTimeout(() => {
            console.clear();
            start(num);
        }, 3e3);
    });
}
//====================== ====================== ====================== ======================
/**
 * @description Получаем ссылку на исходное видео
 * @param url {string} Ссылка на видео
 */
function gettingInfo(url: string) {
    return YouTube.getVideo(url).then((video) => {

        if (!video) return null;
        return video;
    });
}
//====================== ====================== ====================== ======================
/**
 * @description Конвертируем получаемый файл в mp3
 * @param path {string} Путь или ссылка
 * @param out {string} Название файла
 * @constructor
 */
function DecodingMP3(path: string, out: string) {
    const args = ["-y", "-reconnect", 1, "-reconnect_streamed", 1, "-reconnect_delay_max", 5, "-i", path, `Audio/${out}.mp3`];

    return spawn("ffmpeg", args as any, { shell: false, windowsHide: true });
}
//====================== ====================== ====================== ======================
function progressBar(currentTime: number, maxTime: number, size: number = 15) {
    try {
        const CurrentDuration = isNaN(currentTime) ? 0 : currentTime;
        const progressSize = Math.round(size * (CurrentDuration / maxTime));
        const progressText = "|".repeat(progressSize);
        const emptyText = "-".repeat(size - progressSize);

        return `${progressText}${emptyText}`;
    } catch (err) {
        if (err === "RangeError: Invalid count value") return "**❯** \`\`[Error value]\`\`";
        return "**❯** \`\`[Loading]\`\`";
    }
}
//
function ParsingTimeToNumber(duration: string): number {
    if (typeof duration === "number") return duration;

    const Splitter = duration?.split(":");
    const days = (duration: string) => Number(duration) * ((60 * 60) * 24);
    const hours = (duration: string) => Number(duration) * ((60 * 60) * 24);
    const minutes = (duration: string) => (Number(duration) * 60);
    const seconds = (duration: string) => Number(duration);

    if (!Splitter?.length) return Number(duration);

    switch (Splitter.length) {
        case 4: return days(Splitter[0]) + hours(Splitter[1]) + minutes(Splitter[2]) + seconds(Splitter[3]);
        case 3: return hours(Splitter[0]) + minutes(Splitter[1]) + seconds(Splitter[2]);
        case 2: return minutes(Splitter[0]) + seconds(Splitter[1]);
    }
}
