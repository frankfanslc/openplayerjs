import PlayerComponent from '../interfaces/component';
import EventsList from '../interfaces/events-list';
import Player from '../player';
import { EVENT_OPTIONS, IS_ANDROID, IS_IOS } from '../utils/constants';
import { addEvent } from '../utils/events';
import { removeElement } from '../utils/general';

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
    #player: Player;

    /**
     * Mute button.
     *
     * @private
     * @type HTMLButtonElement
     * @memberof Volume
     */
    #button: HTMLButtonElement;

    /**
     * Container for volume elements (display and slider input).
     *
     * @private
     * @type HTMLDivElement
     * @memberof Volume
     */
    #container: HTMLDivElement;

    /**
     * Element that displays the media's current volume level.
     *
     * @private
     * @type HTMLProgressElement
     * @memberof Volume
     */
    #display: HTMLProgressElement;

    /**
     * Element that allows changing media's current volume.
     *
     * @private
     * @type HTMLInputElement
     * @memberof Volume
     */
    #slider: HTMLInputElement;

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
    #events: EventsList = {
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
    #volume: number;

    /**
     * Default labels from player's config
     *
     * @private
     * @type object
     * @memberof Volume
     */
    #labels: any;

    /**
     * Position of the button to be indicated as part of its class name
     *
     * @private
     * @type {string}
     * @memberof Volume
     */
    #position: string;

    /**
     * Layer where the control item will be placed
     *
     * @private
     * @type {string}
     * @memberof Captions
     */
    #layer: string;

    /**
     * Create an instance of Volume.
     *
     * @param {Player} player
     * @returns {Volume}
     */
    constructor(player: Player, position: string, layer: string) {
        this.#player = player;
        this.#labels = player.getOptions().labels;
        this.#volume = this.#player.getMedia().volume;
        this.#position = position;
        this.#layer = layer;
        this._keydownEvent = this._keydownEvent.bind(this);
        return this;
    }

    /**
     *
     * @inheritDoc
     * @memberof Volume
     */
    public create(): void {
        this.#container = document.createElement('div');
        this.#container.className = `op-controls__volume op-control__${this.#position}`;
        this.#container.tabIndex = 0;
        this.#container.setAttribute('aria-valuemin', '0');
        this.#container.setAttribute('aria-valuemax', '100');
        this.#container.setAttribute('aria-valuenow', `${this.#volume}`);
        this.#container.setAttribute('aria-valuetext', `${this.#labels.volume}: ${this.#volume}`);
        this.#container.setAttribute('aria-orientation', 'vertical');
        this.#container.setAttribute('aria-label', this.#labels.volumeSlider);

        this.#slider = document.createElement('input');
        this.#slider.type = 'range';
        this.#slider.className = 'op-controls__volume--input';
        this.#slider.tabIndex = -1;
        this.#slider.value = this.#player.getMedia().volume.toString();
        this.#slider.setAttribute('min', '0');
        this.#slider.setAttribute('max', '1');
        this.#slider.setAttribute('step', '0.1');
        this.#slider.setAttribute('aria-label', this.#labels.volumeControl);

        this.#display = document.createElement('progress');
        this.#display.className = 'op-controls__volume--display';
        this.#display.setAttribute('max', '10');
        this.#display.setAttribute('role', 'presentation');
        this.#display.value = this.#player.getMedia().volume * 10;

        this.#container.appendChild(this.#slider);
        this.#container.appendChild(this.#display);

        // Use as backup when mute is clicked
        this.#button = document.createElement('button');
        this.#button.type = 'button';
        this.#button.className = `op-controls__mute op-control__${this.#position}`;
        this.#button.tabIndex = 0;
        this.#button.title = this.#labels.mute;
        this.#button.setAttribute('aria-controls', this.#player.id);
        this.#button.setAttribute('aria-pressed', 'false');
        this.#button.setAttribute('aria-label', this.#labels.mute);

        /**
         * @private
         * @param {*} element
         */
        const updateSlider = (element: any): void => {
            const mediaVolume = element.volume * 1;
            const vol = Math.floor(mediaVolume * 100);

            this.#slider.value = `${element.volume}`;
            this.#display.value = mediaVolume * 10;
            this.#container.setAttribute('aria-valuenow', `${vol}`);
            this.#container.setAttribute('aria-valuetext', `${this.#labels.volume}: ${vol}`);
        };

        /**
         * @private
         * @param {*} element
         */
        const updateButton = (element: any): void => {
            const vol = element.volume;
            if (vol <= 0.5 && vol > 0) {
                this.#button.classList.remove('op-controls__mute--muted');
                this.#button.classList.add('op-controls__mute--half');
            } else if (vol === 0) {
                this.#button.classList.add('op-controls__mute--muted');
                this.#button.classList.remove('op-controls__mute--half');
            } else {
                this.#button.classList.remove('op-controls__mute--muted');
                this.#button.classList.remove('op-controls__mute--half');
            }
        };

        /**
         * @private
         * @param {Event} event
         */
        const updateVolume = (event: Event): void => {
            const el = this.#player.activeElement();
            const value = parseFloat((event.target as HTMLInputElement).value);
            el.volume = value;
            el.muted = el.volume === 0;
            this.#volume = value;
            const unmuteEl = this.#player.getContainer().querySelector('.op-player__unmute');
            if (!el.muted && unmuteEl) {
                removeElement(unmuteEl);
            }
            const e = addEvent('volumechange');
            this.#player.getElement().dispatchEvent(e);
        };

        this.#events.media.volumechange = (): void => {
            const el = this.#player.activeElement();
            updateSlider(el);
            updateButton(el);
        };
        this.#events.media.loadedmetadata = (): void => {
            const el = this.#player.activeElement();
            if (el.muted) {
                el.volume = 0;
            }
            const e = addEvent('volumechange');
            this.#player.getElement().dispatchEvent(e);
        };
        this.#events.slider.input = updateVolume.bind(this);
        this.#events.slider.change = updateVolume.bind(this);

        this.#events.button.click = (): void => {
            this.#button.setAttribute('aria-pressed', 'true');
            const el = this.#player.activeElement();
            el.muted = !el.muted;

            if (el.muted) {
                el.volume = 0;
                this.#button.title = this.#labels.unmute;
                this.#button.setAttribute('aria-label', this.#labels.unmute);
            } else {
                el.volume = this.#volume;
                this.#button.title = this.#labels.mute;
                this.#button.setAttribute('aria-label', this.#labels.mute);
            }
            const event = addEvent('volumechange');
            this.#player.getElement().dispatchEvent(event);
        };

        this.#button.addEventListener('click', this.#events.button.click, EVENT_OPTIONS);
        Object.keys(this.#events.media).forEach((event) => {
            this.#player.getElement().addEventListener(event, this.#events.media[event], EVENT_OPTIONS);
        });

        Object.keys(this.#events.slider).forEach((event) => {
            this.#slider.addEventListener(event, this.#events.slider[event], EVENT_OPTIONS);
        });

        this.#player.getContainer().addEventListener('keydown', this._keydownEvent, EVENT_OPTIONS);

        if (!IS_ANDROID && !IS_IOS) {
            const controls = this.#player.getControls().getLayer(this.#layer);
            controls.appendChild(this.#button);
            controls.appendChild(this.#container);
        }
    }

    /**
     *
     * @inheritDoc
     * @memberof Volume
     */
    public destroy(): void {
        this.#button.removeEventListener('click', this.#events.button.click);
        Object.keys(this.#events.media).forEach((event) => {
            this.#player.getElement().removeEventListener(event, this.#events.media[event]);
        });

        Object.keys(this.#events.slider).forEach((event) => {
            this.#slider.removeEventListener(event, this.#events.slider[event]);
        });

        this.#player.getContainer().removeEventListener('keydown', this._keydownEvent);

        removeElement(this.#slider);
        removeElement(this.#display);
        removeElement(this.#container);
    }

    /**
     * Use the `Enter` and space bar keys to manipulate volume.
     *
     * @private
     * @param {KeyboardEvent} e
     * @memberof Volume
     */
    private _keydownEvent(e: KeyboardEvent): void {
        const key = e.which || e.keyCode || 0;
        const el = this.#player.activeElement();
        const playBtnFocused = document?.activeElement?.classList.contains('op-controls__mute');

        if (playBtnFocused && (key === 13 || key === 32)) {
            el.muted = !el.muted;
            el.volume = el.muted ? 0 : this.#volume;
            this.#events.button.click();
            e.preventDefault();
            e.stopPropagation();
        }
    }
}

export default Volume;
