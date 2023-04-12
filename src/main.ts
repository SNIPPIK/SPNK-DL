import { ParsingTimeToNumber, ParsingTimeToString } from "./Structures/Duration";
import { YouTubeFormat } from "./Structures/YouTube/Decipher";
import { YouTube } from "./Structures/YouTube/YouTube";
import { FFmpeg } from "./Structures/FFmpeg";
import prompt from "prompt";
import os from "os";
import fs from "fs";

//Logs
console.clear();
console.log(`
   _____ _____  _   _ _  __     _____  _      
  / ____|  __ \\| \\ | | |/ /    |  __ \\| |     
 | (___ | |__) |  \\| | ' /_____| |  | | |    
  \\___ \\|  ___/| . \` |  <______| |  | | |
  ____) | |    | |\\  | . \\     | |__| | |____ 
 |_____/|_|    |_| \\_|_|\\_\\    |_____/|______| 
`);

const savePath = `${os.homedir()}\\Downloads\\SPNK`;
const properties = [
    {
        name: 'url',
        validator: /^(https?:\/\/)?(www\.)?(m\.)?(music\.)?( )?(youtube\.com|youtu\.?be)\/.+$/gi,
        warning: 'Укажи ссылку на YouTube?!'
    },
    {
        name: 'format'
    },
    {
        name: "quality",
    }
];

//====================== ====================== ====================== ======================
prompt.start({ message: "SPNK-log" });
prompt.get(properties, async (err: Error, str: any) => {
    const url = str.url;
    const Quality = str.quality || "OnlyAudio";
    const format = str.format || "mp3"
    const FFmpegFormats: string[] = [];
    let FPS = 0; //Счетчик фпс

    //Получаем видео и аудио
    const { videos, audios, data } = await SearchFormats(url, Quality);

    //Если указано другое качество видео и его нет то сообщаем
    if (Quality !== "OnlyAudio" && !videos?.length) return Error("[CODE: 20] Не удалось получить исходные файлы видео!");
    else if (Quality !== "OnlyAudio") {
        const video = videos[0];
        FPS = video.fps;
        FFmpegFormats.push(video.url);
    }

    //Если есть аудио, то добавляем его
    if (audios.length > 0) FFmpegFormats.push(audios[0].url);

    const title = data.title.replace(/[\[,\]}{"`'|*/]/gi, "");
    const Args = ["-y"];

    //Добавляем аргументы для ffmpeg'a
    if (FFmpegFormats.length > 0) FFmpegFormats.forEach((url) => Args.push("-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5", "-i", url));
    if (FFmpegFormats.length > 1) Args.push("-c:v", "copy");

    //Создаем ffmpeg
    const ffmpeg = new FFmpeg(
        [
            ...Args, `${savePath}\\[${title}].${format}`
        ],
        { highWaterMark: (1024 * 1024 * 1024) * 1024 }
    );

    const VideoTime = data.duration.seconds;
    const VideoTimeString = ParsingTimeToString(VideoTime);
    let oldSize = 0;

    ffmpeg.stderr.on("data", (Buffer) => {
        const info = Buffer.toString();

        if (info.match(/time=/)) {
            const decodingTime = info.split("time=")[1].split(".")[0];
            const totalDuration: number = ParsingTimeToNumber(decodingTime);
            const sizeFile = info.split("size=")[1].split("kB")[0];
            const process = (totalDuration * 100 / VideoTime).toFixed(2);
            const download = oldSize > 0 ? sizeFile - oldSize : 0;

            oldSize = sizeFile;

            const dQuality = FPS > 0 ? `Quality:  ${Quality}/${format} | FPS: ${FPS}` : `Quality:  ${Quality}/${format}`;
            const bar = `[${progressBar(totalDuration, VideoTime, 50)}] ${process} %`;
            const Duration = `Duration: ${decodingTime} / ${VideoTimeString}`;
            const Size = `Size:       ${FormatBytes(sizeFile * 1024)}`;
            const Download = `Download: ${FormatBytes(download * 1024)} | ${ParsingTimeToString(VideoTime - totalDuration)}`;
            const space = "-".repeat(65);

            console.clear();
            console.log(`┌${space}\n├ ${data.title}\n├ ${dQuality}\n├ ${Duration}\n├ ${Download}\n├ ${Size}\n├ ${bar}\n└${space}`);
        }
    });

    ffmpeg.stdout.once("close", () => {
        Error(`[CODE: 0] Файл находится в ${savePath}`);
    });


    ffmpeg.on("error", (err) => {
        Error(`[CODE: 202] ${err}`);
    });
});
//====================== ====================== ====================== ======================
/**
 * @description Ищем видео и аудио
 * @param url {string} ССылка на видео
 * @param quality {string} Качество видео
 * @returns 
 */
async function SearchFormats(url: string, quality: string) {
    let videos;

    // Получаем данные о видео
    const Video: any = await YouTube.getVideo(url);

    if (!fs.existsSync(savePath)) fs.mkdirSync(savePath);

    if (!Video) return Error("[CODE: 19] Не удалось получить данные этого видео!");

    //Ищем аудио дорожку
    const audios = Video.format.filter((format: YouTubeFormat) => format.mimeType?.match(/opus/) || format?.mimeType?.match(/audio/)).sort((format: any) => format.bitrate);

    //Если пользователь указал другое качество
    if (quality !== "OnlyAudio") {
        videos = Video.format.filter((format: YouTubeFormat) => format.qualityLabel === `${quality}60` || format.qualityLabel === quality);
    }

    //Удаляем видео и аудио дорожки
    delete Video.format;

    return { videos, audios, data: Video };
}
//====================== ====================== ====================== ======================
/**
 * @description Выводим ошибку и выключаем процесс
 * @param err {string} Ошибка
 */
function Error(err: string) {
    if (err) console.log(err);
    return process.exit(0);
}
//====================== ====================== ====================== ======================
/**
 * @description Создаем progress bar загрузки видео
 * @param currentTime {number} Текущее время
 * @param maxTime {number} Макс время
 * @param size {number} Размер
 */
function progressBar(currentTime: number, maxTime: number, size: number = 15) {
    try {
        const CurrentDuration = isNaN(currentTime) ? 0 : currentTime;
        const progressSize = Math.round(size * (CurrentDuration / maxTime));
        const progressText = "█".repeat(progressSize);
        const emptyText = " ".repeat(size - progressSize);

        return `${progressText}${emptyText}`;
    } catch (err) {
        if (err === "RangeError: Invalid count value") return "**❯** \`\`[Error value]\`\`";
        return "**❯** \`\`[Loading]\`\`";
    }
}
//====================== ====================== ====================== ======================
/**
 * @description Получаем размер файла
 * @param bytes {number} Кол-во байт
 */
function FormatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`
}