export default class SoundManager {
    sounds: Record<string, HTMLAudioElement[]>
    
    constructor() {
        this.sounds = {};
    }

    loadSound(src: string) {
        this.sounds[src] ??= [new Audio(src)];
    }

    playSound(src: string) {
        let sound = this.sounds[src].find(({ paused }) => paused);
        if (!sound) {
            sound = new Audio(src);
            this.sounds[src].push(sound);
        }

        sound.play();
    }
}