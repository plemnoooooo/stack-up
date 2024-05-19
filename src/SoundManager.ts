export default class SoundManager {
    sounds: HTMLAudioElement[];
    
    constructor() {
        this.sounds = [];
    }

    playSound(soundSrc: string) {    
        let sound = this.sounds.find(({ paused }) => paused);
        if (!sound) {
            sound = new Audio(soundSrc);
            this.sounds.push(sound);
        }

        sound.src = soundSrc;       
        sound.play()
    }
}