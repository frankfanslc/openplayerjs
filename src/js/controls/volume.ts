import PlayerComponent from '../interfaces/component';
import EventsList from '../interfaces/events-list';
import Player from '../player';
import { IS_ANDROID, IS_IOS } from '../utils/constants';
import { addEvent } from '../utils/events';
import { isAudio } from '../utils/general';

/**
 * Volume controller element.
 *
 * @description This class controls the media's volume level using `semantic markup`,
 * such as input range and progress elements.
 * @see https://codepen.io/mi-lee/post/an-overview-of-html5-semantics
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume
 * @see https://developer.mozilla.org/en-US/Apps/Fundamentals/Audio_and_video_delivery/cross_browser_video_player#Volume
 * @class Volume
 * @implements PlayerComponent
 */
class Volume implements PlayerComponent {
    /**
     * Instance of OpenPlayer.
     *
     * @private
     * @type Player
     * @memberof Settings
     */
    private player: Player;

    /**
     * Mute button.
     *
     * @private
     * @type HTMLButtonElement
     * @memberof Volume
     */
    private button: HTMLButtonElement;

    /**
     * Container for volume elements (display and slider input).
     *
     * @private
     * @type HTMLDivElement
     * @memberof Volume
     */
    private container: HTMLDivElement;

    /**
     * Element that displays the media's current volume level.
     *
     * @private
     * @type HTMLProgressElement
     * @memberof Volume
     */
    private display: HTMLProgressElement;

    /**
     * Element that allows changing media's current volume.
     *
     * @private
     * @type HTMLInputElement
     * @memberof Volume
     */
    private slider: HTMLInputElement;

    /**
     * Events that will be triggered in Volume element:
     *  - button (to toggle mute in media).
     *  - media (to alter volume level and modify mute's icon depending of the volume level).
     *  - slider (events to be triggered when clicking or sliding volume rail to modify volume level).
     *
     * @private
     * @type EventsList
     * @memberof Volume
     */
    private events: EventsList = {
        button: {},
        media: {},
        slider: {},
    };

    /**
     * Storage of volume value to restore it when toggling mute.
     *
     * @private
     * @type number
     * @memberof Volume
     */
    private volume: number;

    /**
     * Default labels from player's config
     *
     * @private
     * @type object
     * @memberof Captions
     */
    private labels: any;

    /**
     * Create an instance of Volume.
     *
     * @param {Player} player
     * @returns {Volume}
     */
    constructor(player: Player) {
        this.player = player;
        this.labels = player.getOptions().labels;
        this.volume = this.player.getMedia().volume;
        return this;
    }

    /**
     *
     * @inheritDoc
     * @memberof Volume
     */
    public create(): void {
        this.container = document.createElement('div');
        this.container.className = 'op-controls__volume';
        this.container.tabIndex = 0;
        this.container.setAttribute('aria-valuemin', '0');
        this.container.setAttribute('aria-valuemax', '100');
        this.container.setAttribute('aria-valuenow', `${this.volume}`);
        this.container.setAttribute('aria-valuetext', `${this.labels.volume}: ${this.volume}`);
        this.container.setAttribute('aria-orientation', 'vertical');
        this.container.setAttribute('aria-label', this.labels.volumeSlider);

        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.className = 'op-controls__volume--input';
        this.slider.tabIndex = -1;
        this.slider.value = this.player.getMedia().volume.toString();
        this.slider.setAttribute('min', '0');
        this.slider.setAttribute('max', '1');
        this.slider.setAttribute('step', '0.1');
        this.slider.setAttribute('aria-label', this.labels.volumeControl);

        this.display = document.createElement('progress');
        this.display.className = 'op-controls__volume--display';
        this.display.setAttribute('max', '10');
        this.display.setAttribute('role', 'presentation');
        this.display.value = this.player.getMedia().volume * 10;

        this.container.appendChild(this.slider);
        this.container.appendChild(this.display);

        // Use as backup when mute is clicked
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'op-controls__mute';
        this.button.tabIndex = 0;
        this.button.title = this.labels.mute;
        this.button.setAttribute('aria-controls', this.player.id);
        this.button.setAttribute('aria-pressed', 'false');
        this.button.setAttribute('aria-label', this.labels.mute);
        this.button.innerHTML = `<span class="op-sr">${this.labels.mute}</span>`;

        /**
         * @private
         * @param {*} element
         */
        const updateSlider = (element: any) => {
            const mediaVolume = element.volume * 1;
            const vol = Math.floor(mediaVolume * 100);

            this.slider.value = `${element.volume}`;
            this.display.value = (mediaVolume * 10);
            this.container.setAttribute('aria-valuenow', `${vol}`);
            this.container.setAttribute('aria-valuetext', `${this.labels.volume}: ${vol}`);
        };

        /**
         * @private
         * @param {*} element
         */
        const updateButton = (element: any) => {
            const vol = element.volume;
            if (vol <= 0.5 && vol > 0) {
                this.button.classList.remove('op-controls__mute--muted');
                this.button.classList.add('op-controls__mute--half');
            } else if (vol === 0) {
                this.button.classList.add('op-controls__mute--muted');
                this.button.classList.remove('op-controls__mute--half');
            } else {
                this.button.classList.remove('op-controls__mute--muted');
                this.button.classList.remove('op-controls__mute--half');
            }
        };

        /**
         * @private
         * @param {Event} event
         */
        const updateVolume = (event: Event) => {
            const el = this.player.activeElement();
            const value = parseFloat((event.target as HTMLInputElement).value);
            el.volume = value;
            el.muted = (el.volume === 0);
            this.volume = value;
            if (!el.muted && this.player.getContainer().querySelector('.op-player__unmute')) {
                this.player.getContainer().querySelector('.op-player__unmute').remove();
            }
            const e = addEvent('volumechange');
            this.player.getElement().dispatchEvent(e);
        };

        this.events.media.volumechange = () => {
            const el = this.player.activeElement();
            updateSlider(el);
            updateButton(el);
        };

        // If a source is live, ensure that Volume controls move to the right for audio to mimic
        // Safari's output
        this.events.media.timeupdate = () => {
            if (isAudio(this.player.getElement()) && (this.player.activeElement().duration === Infinity ||
                this.player.getElement().getAttribute('op-live'))) {
                this.button.classList.add('op-control__right');
            }
        };
        this.events.media.loadedmetadata = () => {
            const el = this.player.activeElement();
            if (el.muted) {
                el.volume = 0;
                el.muted = true;
                const e = addEvent('volumechange');
                this.player.getElement().dispatchEvent(e);
            }
        };
        this.events.slider.input = updateVolume.bind(this);
        this.events.slider.change = updateVolume.bind(this);

        this.events.button.click = () => {
            this.button.setAttribute('aria-pressed', 'true');
            const el = this.player.activeElement();
            el.muted = !el.muted;

            if (el.muted) {
                el.volume = 0;
                this.button.title = this.labels.unmute;
                this.button.setAttribute('aria-label', this.labels.unmute);
            } else {
                el.volume = this.volume;
                this.button.title = this.labels.mute;
                this.button.setAttribute('aria-label', this.labels.mute);
            }
            const event = addEvent('volumechange');
            this.player.getElement().dispatchEvent(event);
        };

        this.button.addEventListener('click', this.events.button.click);
        Object.keys(this.events.media).forEach(event => {
            this.player.getElement().addEventListener(event, this.events.media[event]);
        });

        Object.keys(this.events.slider).forEach(event => {
            this.slider.addEventListener(event, this.events.slider[event]);
        });

        if (!IS_ANDROID && !IS_IOS) {
            const controls = this.player.getControls().getContainer();
            controls.appendChild(this.button);
            controls.appendChild(this.container);
        }
    }

    /**
     *
     * @inheritDoc
     * @memberof Volume
     */
    public destroy(): void {
        this.button.removeEventListener('click', this.events.button.click);
        Object.keys(this.events.media).forEach(event => {
            this.player.getElement().removeEventListener(event, this.events.media[event]);
        });

        Object.keys(this.events.slider).forEach(event => {
            this.slider.removeEventListener(event, this.events.slider[event]);
        });

        this.slider.remove();
        this.display.remove();
        this.container.remove();
    }
}

export default Volume;
