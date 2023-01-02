import {spawn} from "child_process";

/**
 * @description Конвертируем получаемый файл
 * @param path {string[]} Ссылки
 * @param out {string} Название файла
 * @constructor
 */
export function Decoding(path: string[], out: string) {
    const DefaultArgs = ["-y"];

    if (path.length > 0) path.forEach((url) => DefaultArgs.push("-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5", "-i", url));
    if (path.length > 1) DefaultArgs.push("-c:v", "copy");

    DefaultArgs.push(`Audio/${out}`);
    return spawn("ffmpeg", DefaultArgs as any, { shell: false, windowsHide: true });
}
