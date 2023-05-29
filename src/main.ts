import {ParsingTimeToNumber, ParsingTimeToString} from "./Structures/Duration";
import {YouTubeFormat} from "./Structures/YouTube/Decipher";
import {YouTube} from "./Structures/YouTube/YouTube";
import {FFmpeg} from "./Structures/FFmpeg";
import prompt from "prompt";
import os from "os";
import * as process from "process";

const Quality = {
    "hd2160": "4К",
    "hd1440": "2К",
    "hd1080": "1080p",
    "hd720": "720p",
    "large": "480p",
    "medium": "360p",
    "small": "240p",
    "tiny": "144p",
};

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

class spnkDL {
    private readonly path = `${os.homedir()}\\Downloads\\SPNK`;
    private video: any = null;
    private format: string

    private set exitCode(message: string) {
        console.log(message);
        process.exit(0);
    };

    private get title() { return this.video.title.replace(/[|,'";*/\\{}!?.:<>]/gi, ""); };

    private get prompt() {
        prompt.start({ message: "SPNK" });
        return prompt.get
    };

    public set setupVideo(bool: boolean) {
        this.prompt([{name: "url"}], async (err: Error, result: any) => {
            this.video = await YouTube.getVideo(result.url);

            if (!this.video) return this.exitCode = "Not found video";

            this.download = await this.choiceQuality
        });
    };

    private get choiceQuality(): Promise<string[]> {
        return new Promise<string[]>((resolve) => {
            const videos: YouTubeFormat[] = this.video.format.filter((format: YouTubeFormat) => format.mimeType.match(/video/));
            const audios: YouTubeFormat[] = this.video.format.filter((format: YouTubeFormat) => format.mimeType.match(/audio/));

            console.log(`Title: ${this.video.title} | ${this.video.url}\n\nAll video formats:`);
            for (let index in videos) {
                // @ts-ignore
                let quality = Quality[videos[index].quality] ?? videos[index].quality;

                console.log(`   [${index}]: [${quality} | ${videos[index].fps}]: [${videos[index].mimeType}]`);
            }
            console.log(`Other\n   [${videos.length++}]: [AudioOnly]\n`);

            this.prompt([{name: "number"}, {name: "format"}], async (err: Error, result: any) => {
                const index = result.number;
                this.format = result.format;

                if (videos[index]) return resolve([videos[index].url, audios.at(0).url]);
                return resolve([audios.at(0).url]);
            });
        });
    };

    private set download(paths: string[]) {
        const Args = ["-y"];
        const VideoFormat = paths.length > 1 ? (this.video.format as YouTubeFormat[]).find((format) => format.url === paths[0]) : {fps: 0, quality: "Audio"};
        // @ts-ignore
        const parsedQuality = Quality[VideoFormat.quality] ?? VideoFormat.quality;

        //Добавляем аргументы для ffmpeg'a
        if (paths.length > 0) paths.forEach((url) => Args.push("-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5", "-i", url));
        if (paths.length > 1) Args.push("-c:v", "copy");

        //Создаем ffmpeg
        const ffmpeg = new FFmpeg(
            [
                ...Args, `${this.path}\\[${parsedQuality}] ${this.title}.${this.format}`
            ],
            { highWaterMark: (1024 * 1024 * 1024) * 1024 }
        );



        const VideoTime = this.video.duration.seconds;
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

                const dQuality = VideoFormat.fps > 0 ? `Quality:  ${parsedQuality}/${this.format} | FPS: ${VideoFormat.fps}` : `Quality:  ${parsedQuality}/${this.format}`;
                const bar = `[${progressBar(totalDuration, VideoTime, 50)}] ${process} %`;
                const Duration = `Duration: ${decodingTime} / ${VideoTimeString}`;
                const Size = `Size:       ${FormatBytes(sizeFile * 1024)}`;
                const Download = `Download: ${FormatBytes(download * 1024)} | ${ParsingTimeToString(VideoTime - totalDuration)}`;
                const space = "─".repeat(65);

                console.clear();
                console.log(`┌${space}\n├ ${this.title}\n├ ${dQuality}\n├ ${Duration}\n├ ${Download}\n├ ${Size}\n├ ${bar}\n└${space}`);
            }
        });

        ffmpeg.stdout.once("close", () => {
            Error(`[CODE: 0] Файл находится в ${this.path}`);
        });


        ffmpeg.on("error", (err) => {
            Error(`[CODE: 202] ${err}`);
        });
    }
}

new spnkDL().setupVideo = true;
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
        if (err === "RangeError: Invalid count value") return "Error value";
        return "Loading...";
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