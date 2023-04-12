import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "child_process";
import { Duplex, DuplexOptions, Readable, Writable } from "stream";

export class FFmpeg extends Duplex {
    /**
     * @description Процесс 
     */
    private process;
    //====================== ====================== ====================== ======================
    //====================== ====================== ====================== ======================
    /**
     * @description Жив ли процесс
     */
    public get deletable() { return !this.process?.killed || !this.destroyed || !!this.process; };
    //====================== ====================== ====================== ======================
    /**
     * @description Данные выходящие из процесса
     */
    public get stdout() { return this?.process?.stdout; };
    //====================== ====================== ====================== ======================
    /**
     * @description Данные входящие в процесс
     */
    public get stdin() { return this?.process?.stdin; };

    public get stderr() { return this?.process?.stderr; };
    //====================== ====================== ====================== ======================
    /**
     * @description Создаем FFmpeg 
     * @param args {Arguments} Аргументы запуска
     * @param options {DuplexOptions} Модификации потока
     */
    public constructor(args: string[], options: DuplexOptions = {}) {
        super({ autoDestroy: true, objectMode: true, ...options });

        //Используется для загрузки потока в ffmpeg. Необходимо не указывать параметр -i
        if (!args.includes("-i")) args = ["-i", "-", ...args];
        this.process = runProcess(FFmpegName, args);

        this.setter(["write", "end"], this.stdin);
        this.setter(["read", "setEncoding", "pipe", "unpipe"], this.stdout);
        this.setter(["on", "once", "removeListener", "removeListeners", "listeners"]);
    }
    //====================== ====================== ====================== ======================
    /**
     * @description Создаем "привязанные функции" (ПФ - термин из ECMAScript 6)
     * @param methods {string[]}
     * @param target {Readable | Writable}
     */
    private setter = (methods: string[], target?: Readable | Writable): void => {
        // @ts-ignore
        if (target) return methods.forEach((method) => this[method] = target[method].bind(target));
        else {
            const EVENTS = { readable: this.stdout, data: this.stdout, end: this.stdout, unpipe: this.stdout, finish: this.stdin, close: this.stdin, drain: this.stdin };
            // @ts-ignore
            methods.forEach((method) => this[method] = (ev, fn) => EVENTS[ev] ? EVENTS[ev][method](ev, fn) : Duplex.prototype[method].call(this, ev, fn));
        }
    }
    //====================== ====================== ====================== ======================
    /**
     * @description Удаляем все что не нужно
     */
    public _destroy = (): void => {
        this.removeAllListeners();
        if (!super.destroyed) super.destroy();

        if (this.deletable) {
            this.process.removeAllListeners();
            this.process.kill("SIGKILL");
        }
        this.process = null;
    };
}
//====================== ====================== ====================== ======================
/**
 * @description Запускаем процесс
 * @param name {string} Имя процесса
 * @param args {string[]} Аргументы процесса
 */
function runProcess(name: string, args: any[]): ChildProcessWithoutNullStreams & { stdout: { _readableState: Readable }, stdin: { _writableState: Writable } } {
    return spawn(name, args) as any;
}


//====================== ====================== ====================== ======================
/**
 * @description Делаем проверку наличия FFmpeg, FFprobe
 */
//====================== ====================== ====================== ======================
const paths = { ffmpeg: ["ffmpeg", "avconv"] };
let FFmpegName: string;

if (!FFmpegName) {
    //@ts-ignore
    try { if (dependencies["ffmpeg-static"]) paths.ffmpeg.push(require("ffmpeg-static")); } catch (e) {/* Null */ }

    FFmpegName = checkName(paths.ffmpeg, "FFmpeg not found! Your need to install ffmpeg!");
    delete paths.ffmpeg;
}
//====================== ====================== ====================== ======================
/**
 * @description Провеерка на наличие файла
 * @param names Имена процесса
 * @param error Ошибка если имя не найдено
 */
function checkName(names: string[], error: string) {
    for (const name of names) {
        const process = spawnSync(name, ["-h"], { windowsHide: true, shell: false });
        if (process.error) continue;
        return name;
    }
    console.log(error);
}