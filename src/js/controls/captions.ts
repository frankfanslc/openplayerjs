import Cue from '../interfaces/captions/cue';
import CueList from '../interfaces/captions/cue-list';
import TrackURL from '../interfaces/captions/track-urls';
import PlayerComponent from '../interfaces/component';
import EventsList from '../interfaces/events-list';
import SettingsItem from '../interfaces/settings/item';
import SettingsSubItem from '../interfaces/settings/subitem';
import Player from '../player';
import { EVENT_OPTIONS, IS_ANDROID, IS_IOS } from '../utils/constants';
import { addEvent } from '../utils/events';
import { getAbsoluteUrl, hasClass, isJson, removeElement, request, sanitize } from '../utils/general';
import { timeToSeconds } from '../utils/time';

/**
 * Closed Captions.
 *
 * @description Using `<track>` tags, this class allows the displaying of both local and remote captions/subtitles
 * bypassing CORS, and without the use of the `crossorigin` attribute.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/track
 * @see https://www.html5rocks.com/en/tutorials/track/basics/
 */
class Captions implements PlayerComponent {
    #player: Player;

    #button: HTMLButtonElement;

    #captions: HTMLDivElement;

    #menu: HTMLDivElement;

    #events: EventsList = {
        button: {},
        global: {},
        media: {},
    };

    #langTracks: CueList = {};

    #mediaTrackList: TextTrack[];

    #trackUrlList: TrackURL = {};

    #hasTracks: boolean;

    #currentTrack?: TextTrack;

    #default = 'off';

    #detachMenu: boolean;

    #labels: any;

    #controlPosition: string;

    #controlLayer: string;

    constructor(player: Player, position: string, layer: string) {
        this.#player = player;
        this.#labels = player.getOptions().labels;
        this.#detachMenu = player.getOptions().detachMenus;
        this.#controlPosition = position;
        this.#controlLayer = layer;
        const trackList = this.#player.getElement().textTracks;

        // Check that `trackList` matches with track tags (if any)
        const tracks = [];
        for (let i = 0, total = trackList.length; i < total; i++) {
            const selector = [
                `track[kind="subtitles"][srclang="${trackList[i].language}"][label="${trackList[i].label}"]`,
                `track[kind="captions"][srclang="${trackList[i].language}"][label="${trackList[i].label}"]`,
            ];
            const tag = this.#player.getElement().querySelector(selector.join(', '));
            if (tag) {
                tracks.push(trackList[i]);
            }
        }

        if (!tracks.length) {
            for (let i = 0, total = trackList.length; i < total; i++) {
                tracks.push(trackList[i]);
            }
        }
        this.#mediaTrackList = tracks;
        this.#hasTracks = !!this.#mediaTrackList.length;
        return this;
    }

    public create(): void {
        if (!this.#hasTracks) {
            return;
        }

        this.#button = document.createElement('button');
        this.#button.className = `op-controls__captions op-control__${this.#controlPosition}`;
        this.#button.tabIndex = 0;
        this.#button.title = this.#labels.toggleCaptions;
        this.#button.setAttribute('aria-controls', this.#player.id);
        this.#button.setAttribute('aria-pressed', 'false');
        this.#button.setAttribute('aria-label', this.#labels.toggleCaptions);
        this.#button.setAttribute('data-active-captions', 'off');

        // Build menu if detachMenu is `true`
        if (this.#detachMenu) {
            this.#button.classList.add('op-control--no-hover');
            this.#menu = document.createElement('div');
            this.#menu.className = 'op-settings op-captions__menu';
            this.#menu.setAttribute('aria-hidden', 'true');
            this.#menu.innerHTML = `<div class="op-settings__menu" role="menu" id="menu-item-captions">
                <div class="op-settings__submenu-item" tabindex="0" role="menuitemradio" aria-checked="${
                    this.#default === 'off' ? 'true' : 'false'
                }">
                    <div class="op-settings__submenu-label op-subtitles__option" data-value="captions-off">${this.#labels.off}</div>
                </div>
            </div>`;
        }

        // Determine if tracks are valid (have valid URLs and contain cues); if so include them in the list of available tracks.
        // Otherwise, remove the markup associated with them
        for (let i = 0, tracks = this.#player.getElement().querySelectorAll('track'), total = tracks.length; i < total; i++) {
            const element = tracks[i] as HTMLTrackElement;
            if (element.kind === 'subtitles' || element.kind === 'captions') {
                if (element.default) {
                    this.#default = element.srclang;
                    this.#button.setAttribute('data-active-captions', element.srclang);
                }
                const trackUrl = getAbsoluteUrl(element.src);
                const currTrack = this.#mediaTrackList[i];
                if (currTrack && currTrack.language === element.srclang) {
                    if (currTrack.cues && currTrack.cues.length > 0) {
                        this.#langTracks[element.srclang] = this._getNativeCues(this.#mediaTrackList[i]);
                        this._prepareTrack(i, element.srclang, trackUrl, element.default || false);
                    } else {
                        request(trackUrl, 'text', (d) => {
                            this.#langTracks[element.srclang] = this._getCuesFromText(d);
                            this._prepareTrack(i, element.srclang, trackUrl, element.default || false);

                            // Build only items that are successful
                            const selector = `.op-subtitles__option[data-value="captions-${this.#mediaTrackList[i].language}"]`;
                            if (this.#menu && !this.#menu.querySelector(selector)) {
                                const item = document.createElement('div');
                                item.className = 'op-settings__submenu-item';
                                item.tabIndex = 0;
                                item.setAttribute('role', 'menuitemradio');
                                item.setAttribute('aria-checked', this.#default === this.#mediaTrackList[i].language ? 'true' : 'false');
                                item.innerHTML = `<div class="op-settings__submenu-label op-subtitles__option"
                                        data-value="captions-${this.#mediaTrackList[i].language}">
                                        ${this.#labels.lang[this.#mediaTrackList[i].language] || this.#mediaTrackList[i].label}
                                    </div>`;
                                this.#menu.appendChild(item);
                            }
                        });
                    }
                }
            }
        }

        // Build container to display captions to mitigate cross browser inconsistencies
        this.#captions = document.createElement('div');
        this.#captions.className = 'op-captions';
        this.#captions.innerHTML = '<span></span>';

        const container = this.#captions.querySelector('span');
        this.#events.media.timeupdate = (): void => {
            if (this.#player.isMedia()) {
                if (this.#currentTrack) {
                    const currentCues = this.#langTracks[this.#currentTrack.language];
                    if (container && currentCues !== undefined) {
                        const index = this._search(currentCues, this.#player.getMedia().currentTime);
                        container.innerHTML = '';
                        if (index > -1 && hasClass(this.#button, 'op-controls__captions--on')) {
                            this.#captions.classList.add('op-captions--on');
                            container.innerHTML = sanitize(currentCues[index].text, false);
                        } else {
                            this._hideCaptions();
                        }
                    }
                } else {
                    this._hideCaptions();
                }
            } else {
                this._hideCaptions();
            }
        };

        // Show/hide captions
        this.#events.button.click = (e: Event): void => {
            const button = e.target as HTMLDivElement;
            if (this.#detachMenu) {
                const menus = this.#player.getContainer().querySelectorAll('.op-settings');
                for (let i = 0, total = menus.length; i < total; ++i) {
                    if (menus[i] !== this.#menu) {
                        menus[i].setAttribute('aria-hidden', 'true');
                    }
                }
                if (this.#menu.getAttribute('aria-hidden') === 'true') {
                    this.#menu.setAttribute('aria-hidden', 'false');
                } else {
                    this.#menu.setAttribute('aria-hidden', 'true');
                }
            } else {
                button.setAttribute('aria-pressed', 'true');
                if (hasClass(button, 'op-controls__captions--on')) {
                    this._hideCaptions();
                    button.classList.remove('op-controls__captions--on');
                    button.setAttribute('data-active-captions', 'off');
                } else {
                    if (!this.#currentTrack) {
                        const [track] = this.#mediaTrackList;
                        this.#currentTrack = track;
                    }
                    this._displayCaptions();
                    button.classList.add('op-controls__captions--on');
                    button.setAttribute('data-active-captions', this.#currentTrack.language);
                }
            }
        };
        this.#events.button.mouseover = (): void => {
            if (!IS_IOS && !IS_ANDROID && this.#detachMenu) {
                const menus = this.#player.getContainer().querySelectorAll('.op-settings');
                for (let i = 0, total = menus.length; i < total; ++i) {
                    if (menus[i] !== this.#menu) {
                        menus[i].setAttribute('aria-hidden', 'true');
                    }
                }
                if (this.#menu.getAttribute('aria-hidden') === 'true') {
                    this.#menu.setAttribute('aria-hidden', 'false');
                }
            }
        };
        this.#events.button.mouseout = (): void => {
            if (!IS_IOS && !IS_ANDROID && this.#detachMenu) {
                const menus = this.#player.getContainer().querySelectorAll('.op-settings');
                for (let i = 0, total = menus.length; i < total; ++i) {
                    menus[i].setAttribute('aria-hidden', 'true');
                }
                if (this.#menu.getAttribute('aria-hidden') === 'false') {
                    this.#menu.setAttribute('aria-hidden', 'true');
                }
            }
        };

        if (this.#hasTracks) {
            const target = this.#player.getContainer();
            target.insertBefore(this.#captions, target.firstChild);
            if (this.#detachMenu) {
                const itemContainer = document.createElement('div');
                itemContainer.className = `op-controls__container op-control__${this.#controlPosition}`;
                itemContainer.appendChild(this.#button);
                itemContainer.appendChild(this.#menu);
                this.#player
                    .getControls()
                    .getLayer(this.#controlLayer)
                    .appendChild(itemContainer);
            } else {
                this.#player
                    .getControls()
                    .getLayer(this.#controlLayer)
                    .appendChild(this.#button);
            }
            this.#button.addEventListener('click', this.#events.button.click, EVENT_OPTIONS);
        }

        // For the following workflow it is required to have more than 1 language available
        if ((this.#mediaTrackList.length <= 1 && !this.#detachMenu) || (!this.#mediaTrackList.length && this.#detachMenu)) {
            return;
        }

        this.#events.global.click = (e: Event): void => {
            const option = e.target as HTMLElement;
            if (option.closest(`#${this.#player.id}`) && hasClass(option, 'op-subtitles__option')) {
                const langEl = option.getAttribute('data-value');
                const language = langEl ? langEl.replace('captions-', '') : '';
                const currentLang = Array.from(this.#mediaTrackList).filter((item) => item.language === language);
                this.#currentTrack = currentLang ? currentLang.pop() : undefined;
                if (this.#detachMenu) {
                    if (hasClass(this.#button, 'op-controls__captions--on')) {
                        this._hideCaptions();
                        this.#button.classList.remove('op-controls__captions--on');
                        this.#button.setAttribute('data-active-captions', 'off');
                    } else {
                        this._displayCaptions();
                        this.#button.classList.add('op-controls__captions--on');
                        this.#button.setAttribute('data-active-captions', language);
                    }
                    if (option.parentElement && option.parentElement.parentElement) {
                        const captions = option.parentElement.parentElement.querySelectorAll('.op-settings__submenu-item');
                        for (let i = 0, total = captions.length; i < total; ++i) {
                            captions[i].setAttribute('aria-checked', 'false');
                        }
                    }
                    if (option.parentElement) {
                        option.parentElement.setAttribute('aria-checked', 'true');
                    }
                    this.#menu.setAttribute('aria-hidden', 'false');
                } else {
                    this._displayCaptions();
                    this.#button.setAttribute('data-active-captions', language);
                }
                const event = addEvent('captionschanged');
                this.#player.getElement().dispatchEvent(event);
            }
        };

        if (this.#detachMenu) {
            this.#button.addEventListener('mouseover', this.#events.button.mouseover, EVENT_OPTIONS);
            this.#menu.addEventListener('mouseover', this.#events.button.mouseover, EVENT_OPTIONS);
            this.#menu.addEventListener('mouseout', this.#events.button.mouseout, EVENT_OPTIONS);
            this.#player.getElement().addEventListener('controlshidden', this.#events.button.mouseout, EVENT_OPTIONS);
        }

        if (typeof this.#events.global.click !== 'undefined') {
            document.addEventListener('click', this.#events.global.click, EVENT_OPTIONS);
        }
    }

    public destroy(): void {
        if (typeof this.#events.global.click !== 'undefined') {
            document.removeEventListener('click', this.#events.global.click);
        }

        if (this.#hasTracks) {
            this.#button.removeEventListener('click', this.#events.button.click);
            if (this.#detachMenu) {
                this.#button.removeEventListener('mouseover', this.#events.button.mouseover);
                this.#menu.removeEventListener('mouseover', this.#events.button.mouseover);
                this.#menu.removeEventListener('mouseout', this.#events.button.mouseout);
                this.#player.getElement().removeEventListener('controlshidden', this.#events.button.mouseout);
                removeElement(this.#menu);
            }
            this.#player.getElement().removeEventListener('timeupdate', this.#events.media.timeupdate);
            removeElement(this.#button);
            removeElement(this.#captions);
        }
    }

    public addSettings(): SettingsItem | unknown {
        if (this.#detachMenu || this.#mediaTrackList.length <= 1) {
            return {};
        }
        const subitems = this._formatMenuItems();
        // Avoid implementing submenu for captions if only 2 options were available
        return subitems.length > 2
            ? {
                  className: 'op-subtitles__option',
                  default: this.#default || 'off',
                  key: 'captions',
                  name: this.#labels.captions,
                  subitems,
              }
            : {};
    }

    private _getCuesFromText(vttText: string): Cue[] {
        const lines = vttText.split(/\r?\n/);
        const entries: Cue[] = [];
        const urlRegexp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
        let timePattern = '^((?:[0-9]{1,2}:)?[0-9]{2}:[0-9]{2}([,.][0-9]{1,3})?) --> ';
        timePattern += '((?:[0-9]{1,2}:)?[0-9]{2}:[0-9]{2}([,.][0-9]{3})?)(.*?)$';
        const regexp = new RegExp(timePattern);

        let identifier;

        for (let i = 0, total = lines.length; i < total; i++) {
            const timeCode = regexp.exec(lines[i]);

            if (timeCode && i < lines.length) {
                if (i - 1 >= 0 && lines[i - 1] !== '') {
                    identifier = lines[i - 1];
                }
                i++;
                // grab all the (possibly multi-line) text that follows
                let cue = lines[i];
                i++;
                while (lines[i] !== '' && i < lines.length) {
                    cue = `${cue}\n${lines[i]}`;
                    i++;
                }
                cue = cue.trim().replace(urlRegexp, "<a href='$1' target='_blank'>$1</a>");
                const initTime = timeToSeconds(timeCode[1]);

                entries.push({
                    endTime: timeToSeconds(timeCode[3]),
                    identifier: identifier || '',
                    settings: isJson(timeCode[5]) ? JSON.parse(timeCode[5]) : {},
                    startTime: initTime === 0 ? 0.2 : initTime,
                    text: cue,
                });
            }
            identifier = '';
        }
        return entries;
    }

    private _getNativeCues(track: TextTrack): Cue[] {
        const cues: Cue[] = [];
        const trackCues = track.cues as TextTrackCueList;
        Object.keys(trackCues).forEach((index) => {
            const j = parseInt(index, 10);
            const current = trackCues[j] as VTTCue;
            cues.push({
                endTime: current.endTime,
                identifier: current.id,
                settings: {},
                startTime: current.startTime,
                text: current.text,
            });
        });
        return cues;
    }

    private _displayCaptions(): void {
        if (!this.#captions || !this.#currentTrack || this.#currentTrack.cues === undefined) {
            return;
        }

        const container = this.#captions.querySelector('span');
        if (container) {
            container.innerHTML = '';
        }
        this.#player.getElement().addEventListener('timeupdate', this.#events.media.timeupdate, EVENT_OPTIONS);
    }

    private _hideCaptions(): void {
        this.#captions.classList.remove('op-captions--on');
        if (!this.#currentTrack) {
            this.#button.classList.remove('op-controls__captions--on');
            this.#button.setAttribute('data-active-captions', 'off');
        }
    }

    // Search using binary search algorithm (borrowed from https://www.geeksforgeeks.org/binary-search/)
    private _search(tracks: Cue[], currentTime: number): number {
        let low = 0;
        let high = tracks.length - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const start = tracks[mid].startTime;
            const stop = tracks[mid].endTime;

            if (currentTime >= start && currentTime < stop) {
                return mid;
            }
            if (start < currentTime) {
                low = mid + 1;
            } else if (start > currentTime) {
                high = mid - 1;
            }
        }
        return -1;
    }

    private _prepareTrack(index: number, language: string, trackUrl: string, showTrack = false): void {
        this.#trackUrlList[language] = trackUrl;
        this.#mediaTrackList[index].mode = 'disabled';
        if (showTrack) {
            this.#default = language;
            this.#button.classList.add('op-controls__captions--on');
            this.#button.setAttribute('data-active-captions', language);
            this.#currentTrack = Array.from(this.#mediaTrackList)
                .filter((item) => item.language === this.#default)
                .pop();
            this._displayCaptions();
            if (!this.#player.getContainer().classList.contains('op-captions--detected')) {
                this.#player.getContainer().classList.add('op-captions--detected');
            }
        }
    }

    private _formatMenuItems(): SettingsSubItem[] {
        let items = [{ key: 'off', label: this.#labels.off }];
        // Build object based on available languages
        for (let i = 0, total = this.#mediaTrackList.length; i < total; i++) {
            const track = this.#mediaTrackList[i];
            // Override language item if duplicated when passing list of items
            items = items.filter((el) => el.key !== track.language);
            items.push({ key: track.language, label: this.#labels.lang[track.language] || this.#mediaTrackList[i].label });
        }

        return items;
    }
}

export default Captions;
