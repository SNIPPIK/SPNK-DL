import {ParsingTimeToNumber, ParsingTimeToString} from "./DurationUtils";
import {YouTubeFormat} from "./Platforms/YouTube/Decipher";
import * as process from "process";
import {Decoding} from "./FFmpeg";
import {YouTube} from "@APIs";
import prompt from "prompt";

const properties = [
    {
        name: 'url',
        validator: /^(https?:\/\/)?(www\.)?(m\.)?(music\.)?( )?(youtube\.com|youtu\.?be)\/.+$/gi,
        warning: 'Укажи ссылку на YouTube?!'
    },
    {
        name: 'AudioType',
    },
    {
        name: "NeedVideo",
    }
];

//
console.clear();
console.log(`
$$\\     $$\\                $$$$$$$$\\        $$\\                       $$$$$$$\\  $$\\      $$\\ $$\\       
\\$$\\   $$  |               \\__$$  __|       $$ |                      $$  __$$\\ $$ | $\\  $$ |$$ |      
 \\$$\\ $$  /$$$$$$\\  $$\\   $$\\ $$ |$$\\   $$\\ $$$$$$$\\   $$$$$$\\        $$ |  $$ |$$ |$$$\\ $$ |$$ |      
  \\$$$$  /$$  __$$\\ $$ |  $$ |$$ |$$ |  $$ |$$  __$$\\ $$  __$$\\       $$ |  $$ |$$ $$ $$\\$$ |$$ |      
   \\$$  / $$ /  $$ |$$ |  $$ |$$ |$$ |  $$ |$$ |  $$ |$$$$$$$$ |      $$ |  $$ |$$$$  _$$$$ |$$ |      
    $$ |  $$ |  $$ |$$ |  $$ |$$ |$$ |  $$ |$$ |  $$ |$$   ____|      $$ |  $$ |$$$  / \\$$$ |$$ |      
    $$ |  \\$$$$$$  |\\$$$$$$  |$$ |\\$$$$$$  |$$$$$$$  |\\$$$$$$$\\       $$$$$$$  |$$  /   \\$$ |$$$$$$$$\\ 
    \\__|   \\______/  \\______/ \\__| \\______/ \\_______/  \\_______|      \\_______/ \\__/     \\__|\\________|
                                                                                                       
                                                                                                       
                                                                                                     
`)

//
prompt.start({ message: "Writer" });
prompt.get(properties, (err: Error, str: any) => runDWL(err, str));
//

const runDWL = async (err: Error, str: any) => {
    const url = str.url;
    const VideoQuality = str.NeedVideo ?? "OnlyAudio";
    const format = str.AudioType || "mp3";

    // Получаем данные о видео
    let video: any = await YouTube.getVideo(url);

    if (!video) return Error("Не найдена информация о видео");
    if (!video.format) video = await YouTube.getVideo(url);
    //

    // Подготавливаем форматы видео и аудио
    const audios = video.format.filter((format: YouTubeFormat) => format.mimeType?.match(/opus/) || format?.mimeType?.match(/audio/)).sort((format: any) => format.bitrate);
    const videos = VideoQuality !== "OnlyAudio" ? video.format.filter((format: YouTubeFormat) => format.qualityLabel === `${VideoQuality}60` || format.qualityLabel === VideoQuality) : [];
    const FFmpegFormats: string[] = [];
    let videoFPS = 0; //Счетчик фпс

    // Проверяем есть ли такой формат в списке
    if (videos?.length === 0 && VideoQuality !== "OnlyAudio") return Error("Такого формата видео нет");
    else if (VideoQuality !== "OnlyAudio") {
        const video = videos[0];
        videoFPS = video.fps;
        FFmpegFormats.push(video.url);
    }

    if (audios.length > 0) FFmpegFormats.push(audios[0].url);
    //
    
    let isDownload = false;
    const VideoTitle = video.title.replace(/[\[,\]}{"`'|*/]/gi, "");

    const ffmpeg = Decoding(FFmpegFormats, `${VideoTitle}.${format}`);
    const VideoTime = video.duration.seconds;
    const VideoTimeString = ParsingTimeToString(VideoTime);

    ffmpeg.stderr.on("data", (Buffer) => {
        const info = Buffer.toString();

        if (info.match(/time=/)) {
            const decodingTime = info.split("time=")[1].split(".")[0];
            const totalDuration: number = ParsingTimeToNumber(decodingTime);
            const sizeFile = info.split("size=")[1].split("kB")[0];
            const process = (totalDuration * 100 / VideoTime).toFixed(2);


            const Quality = videoFPS > 0 ? `Quality:  ${VideoQuality}/${format} | FPS: ${videoFPS}` : `Quality:  ${VideoQuality}/${format}`;
            const bar = `Progress:\n[${progressBar(totalDuration, VideoTime, 50)}] ${process} %`;
            const Duration = `Duration: ${decodingTime} / ${VideoTimeString}`;
            const Size = `Size: ${sizeFile} kB`;

            console.clear();
            console.log(`${video.title}\n${Quality}\n${Duration}\n${Size}\n${bar}`);

            isDownload = true;
        }
    });

    ffmpeg.stdout.once("close", () => {
        if (!isDownload) Error("Не удалось скачать это видео");
        else Error(`Файл находится в Audio/`);
    });
}

const Error = (err: string) => {
    if (err) console.log(err);
    return process.exit(0);
}
const progressBar = (currentTime: number, maxTime: number, size: number = 15) => {
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