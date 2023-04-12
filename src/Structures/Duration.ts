//
export function ParsingTimeToNumber(duration: string): number {
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
export function ParsingTimeToString(duration: number): string {
    const days = toString(duration / ((60 * 60) * 24) % 24) as number;
    const hours = toString(duration / (60 * 60) % 24) as number;
    const minutes = toString((duration / 60) % 60) as number;
    const seconds = toString(duration % 60) as number;

    //Получаем дни, часы, минуты, секунды в формате 00:00
    return (days > 0 ? `${days}:` : "") + (hours > 0 || days > 0 ? `${hours}:` : "") + (minutes > 0 ? `${minutes}:` : "00:") + (seconds > 0 ? `${seconds}` : "00");
}
//====================== ====================== ====================== ======================
/**
 * @description Добавляем 0 к числу. Пример: 01:10
 * @param duration {string | number} Число
 */
function toFixed0(duration: number): string | number {
    return (duration < 10) ? ("0" + duration) : duration;
}
//====================== ====================== ====================== ======================
/**
 * @description Делаем из числа строку, так-же добавляем к числу 0 если это надо
 * @param duration {number} Желательно число
 * @requires {toFixed0}
 */
function toString(duration: number): string | number {
    return toFixed0(parseInt(duration as any));
}