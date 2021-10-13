import PlayerComponent from '../interfaces/component';
import EventsList from '../interfaces/events-list';
import SettingsItem from '../interfaces/settings/item';
import SettingsSubItem from '../interfaces/settings/subitem';
import SettingsSubMenu from '../interfaces/settings/submenu';
import Player from '../player';
import { EVENT_OPTIONS } from '../utils/constants';
import { hasClass, removeElement } from '../utils/general';

/**
 * Settings element.
 *
 * @description This class creates a menu of options to manipulate media that cannot
 * be placed in the main control necessarily (such as different captions associated with media,
 * levels of speed to play media, etc.)
 * This element is based on YouTube's Settings element.
 * @class Settings
 * @implements PlayerComponent
 */
class Settings implements PlayerComponent {
    /**
     * Instance of OpenPlayer.
     *
     * @private
     * @type Player
     * @memberof Settings
     */
    #player: Player;

    /**
     * Collection of items associated with a specific menu item.
     *
     * @private
     * @type SettingsSubMenu
     * @memberof Settings
     */
    #submenu: SettingsSubMenu = {};

    /**
     * Button to toggle menu's visibility.
     *
     * @private
     * @type HTMLButtonElement
     * @memberof Settings
     */
    #button: HTMLButtonElement;

    /**
     * HTML markup to display Settings options.
     *
     * @private
     * @type HTMLElement
     * @memberof Settings
     */
    #menu: HTMLElement;

    /**
     * Events that will be triggered in Settings element:
     *  - global (to hide menu on resize and manipulate speed levels, and to manipulate submenu elements)
     *  - media (to hide menu when media is played/paused or when `controls.hide` is triggered)
     *
     * @private
     * @type EventsList
     * @memberof Settings
     */
    #events: EventsList = {
        global: {},
        media: {},
    };

    /**
     * Storage of the initial state of the menu's markup.
     *
     * @private
     * @type string
     * @memberof Settings
     */
    #originalOutput = '';

    /**
     * Default labels from player's config
     *
     * @private
     * @type object
     * @memberof Settings
     */
    #labels: any;

    /**
     * Position of the button to be indicated as part of its class name
     *
     * @private
     * @type {string}
     * @memberof Settings
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
     * Event that displays main menu when clicking in Settings button.
     *
     * @private
     * @type callback
     * @memberof Settings
     */
    private clickEvent: () => void;

    /**
     * Event that hides Settings main menu when other events occur, such as play/pause media
     * or when resizing the user's window.
     *
     * @private
     * @type callback
     * @memberof Settings
     */
    private hideEvent: () => void;

    /**
     * Event that is triggered when an element from Settings is removed.
     *
     * @private
     * @type callback
     * @memberof Settings
     */
    private removeEvent: (e: CustomEvent) => void;

    /**
     * Create an instance of Settings.
     *
     * @param {Player} player
     * @returns {Settings}
     * @memberof Settings
     */
    constructor(player: Player, position: string, layer: string) {
        this.#player = player;
        this.#labels = player.getOptions().labels;
        this.#position = position;
        this.#layer = layer;
        this._keydownEvent = this._keydownEvent.bind(this);
        return this;
    }

    /**
     *
     * @inheritDoc
     * @memberof Settings
     */
    public create(): void {
        this.#button = document.createElement('button');
        this.#button.className = `op-controls__settings op-control__${this.#position}`;
        this.#button.tabIndex = 0;
        this.#button.title = this.#labels.settings;
        this.#button.setAttribute('aria-controls', this.#player.id);
        this.#button.setAttribute('aria-pressed', 'false');
        this.#button.setAttribute('aria-label', this.#labels.settings);

        this.#menu = document.createElement('div');
        this.#menu.className = 'op-settings';
        this.#menu.setAttribute('aria-hidden', 'true');
        this.#menu.innerHTML = '<div class="op-settings__menu" role="menu"></div>';

        this.clickEvent = (): void => {
            this.#button.setAttribute('aria-pressed', 'true');
            const menus = this.#player.getContainer().querySelectorAll('.op-settings');
            for (let i = 0, total = menus.length; i < total; ++i) {
                if (menus[i] !== this.#menu) {
                    menus[i].setAttribute('aria-hidden', 'true');
                }
            }
            this.#menu.setAttribute('aria-hidden', this.#menu.getAttribute('aria-hidden') === 'false' ? 'true' : 'false');
        };

        this.hideEvent = (): void => {
            let timeout;
            if (timeout && typeof window !== 'undefined') {
                window.cancelAnimationFrame(timeout);
            }

            if (typeof window !== 'undefined') {
                timeout = window.requestAnimationFrame((): void => {
                    this.#menu.innerHTML = this.#originalOutput;
                    this.#menu.setAttribute('aria-hidden', 'true');
                });
            }
        };

        this.removeEvent = (e: CustomEvent): void => {
            const { id, type } = e.detail;
            this.removeItem(id, type);
        };

        this.#events.media.controlshidden = this.hideEvent.bind(this);
        this.#events.media.settingremoved = this.removeEvent.bind(this);
        this.#events.media.play = this.hideEvent.bind(this);
        this.#events.media.pause = this.hideEvent.bind(this);

        this.#player.getContainer().addEventListener('keydown', this._keydownEvent, EVENT_OPTIONS);

        this.clickEvent = this.clickEvent.bind(this);
        this.hideEvent = this.hideEvent.bind(this);

        this.#events.global.click = (e: any): void => {
            if (e.target.closest(`#${this.#player.id}`) && hasClass(e.target, 'op-speed__option')) {
                this.#player.getMedia().playbackRate = parseFloat(e.target.getAttribute('data-value').replace('speed-', ''));
            }
        };
        this.#events.global.resize = this.hideEvent.bind(this);

        this.#button.addEventListener('click', this.clickEvent, EVENT_OPTIONS);
        Object.keys(this.#events).forEach((event) => {
            this.#player.getElement().addEventListener(event, this.#events.media[event], EVENT_OPTIONS);
        });
        document.addEventListener('click', this.#events.global.click, EVENT_OPTIONS);
        document.addEventListener('keydown', this.#events.global.click, EVENT_OPTIONS);
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this.#events.global.resize, EVENT_OPTIONS);
        }

        this.#player
            .getControls()
            .getLayer(this.#layer)
            .appendChild(this.#button);
        this.#player.getContainer().appendChild(this.#menu);
    }

    /**
     *
     * @inheritDoc
     * @memberof Settings
     */
    public destroy(): void {
        this.#button.removeEventListener('click', this.clickEvent);
        Object.keys(this.#events).forEach((event) => {
            this.#player.getElement().removeEventListener(event, this.#events.media[event]);
        });
        document.removeEventListener('click', this.#events.global.click);
        document.removeEventListener('keydown', this.#events.global.click);
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.#events.global.resize);
        }
        if (this.#events.global['settings.submenu'] !== undefined) {
            document.removeEventListener('click', this.#events.global['settings.submenu']);
            this.#player.getElement().removeEventListener('controlshidden', this.hideEvent);
        }

        this.#player.getContainer().removeEventListener('keydown', this._keydownEvent);

        removeElement(this.#menu);
        removeElement(this.#button);
    }

    /**
     * Build `Settings` default option: media speed levels
     *
     * @returns {SettingItem}
     * @memberof Settings
     */
    public addSettings(): SettingsItem {
        const media = this.#player.getMedia();
        let rate = 1;
        if (this.#player && media) {
            rate = media.defaultPlaybackRate !== media.playbackRate ? media.playbackRate : media.defaultPlaybackRate;
        }
        return {
            className: 'op-speed__option',
            default: rate.toString(),
            key: 'speed',
            name: this.#labels.speed,
            subitems: [
                { key: '0.25', label: '0.25' },
                { key: '0.5', label: '0.5' },
                { key: '0.75', label: '0.75' },
                { key: '1', label: this.#labels.speedNormal },
                { key: '1.25', label: '1.25' },
                { key: '1.5', label: '1.5' },
                { key: '2', label: '2' },
            ],
        };
    }

    /**
     * Add a new element and subelements to Setting's menu.
     *
     * The subelements will be transformed in HTML output, and this will be cached via
     * [[Settings.submenu]] element. A global event will be associated with the newly
     * added elements.
     *
     * @param {string} name  The name of the Settings element.
     * @param {string} key  Identifier to generate unique Settings' items and subitems.
     * @param {string} defaultValue  It can represent a number or a string.
     * @param {?SettingsSubItem[]} submenu  A collection of subitems.
     * @param {?string} className  A specific class to trigger events on submenu items.
     * @memberof Settings
     */
    public addItem(name: string, key: string, defaultValue: string, submenu?: SettingsSubItem[], className?: string): void {
        // Build the menu entry first
        const menuItem = document.createElement('div');
        menuItem.className = 'op-settings__menu-item';
        menuItem.tabIndex = 0;
        menuItem.setAttribute('role', 'menuitemradio');
        menuItem.innerHTML = `<div class="op-settings__menu-label" data-value="${key}-${defaultValue}">${name}</div>`;

        const submenuMatch = submenu ? submenu.find((x) => x.key === defaultValue) : null;
        if (submenuMatch) {
            menuItem.innerHTML += `<div class="op-settings__menu-content" tabindex="0">${submenuMatch.label}</div>`;
        }

        const mainMenu = this.#menu.querySelector('.op-settings__menu');
        if (mainMenu) {
            mainMenu.appendChild(menuItem);
        }
        this.#originalOutput = this.#menu.innerHTML;

        // Store the submenu to reach all options for current menu item
        if (submenu) {
            const subItems = `
                <div class="op-settings__header">
                    <button type="button" class="op-settings__back" tabindex="0">${name}</button>
                </div>
                <div class="op-settings__menu" role="menu" id="menu-item-${key}">
                    ${submenu
                        .map(
                            (item: SettingsSubItem) => `
                    <div class="op-settings__submenu-item" role="menuitemradio" aria-checked="${
                        defaultValue === item.key ? 'true' : 'false'
                    }">
                        <div class="op-settings__submenu-label ${className || ''}" tabindex="0" data-value="${key}-${item.key}">
                            ${item.label}
                        </div>
                    </div>`
                        )
                        .join('')}
                </div>`;
            this.#submenu[key] = subItems;
        }

        this.#events.global['settings.submenu'] = (e: Event): void => {
            const target = e.target as HTMLElement;
            if (target.closest(`#${this.#player.id}`)) {
                if (hasClass(target, 'op-settings__back')) {
                    this.#menu.classList.add('op-settings--sliding');
                    setTimeout((): void => {
                        this.#menu.innerHTML = this.#originalOutput;
                        this.#menu.classList.remove('op-settings--sliding');
                    }, 100);
                } else if (hasClass(target, 'op-settings__menu-content')) {
                    const labelEl = target.parentElement ? target.parentElement.querySelector('.op-settings__menu-label') : null;
                    const label = labelEl ? labelEl.getAttribute('data-value') : null;
                    const fragments = label ? label.split('-') : [];
                    if (fragments.length > 0) {
                        fragments.pop();

                        // eslint-disable-next-line no-useless-escape
                        const current = fragments.join('-').replace(/^\-|\-$/, '');
                        if (typeof this.#submenu[current] !== 'undefined') {
                            this.#menu.classList.add('op-settings--sliding');
                            setTimeout((): void => {
                                this.#menu.innerHTML = this.#submenu[current];
                                this.#menu.classList.remove('op-settings--sliding');
                            }, 100);
                        }
                    }
                } else if (hasClass(target, 'op-settings__submenu-label')) {
                    const current = target.getAttribute('data-value');
                    const value = current ? current.replace(`${key}-`, '') : '';
                    const label = target.innerText;

                    // Update values in submenu and store
                    const menuTarget = this.#menu.querySelector(`#menu-item-${key} .op-settings__submenu-item[aria-checked=true]`);
                    if (menuTarget) {
                        menuTarget.setAttribute('aria-checked', 'false');
                        if (target.parentElement) {
                            target.parentElement.setAttribute('aria-checked', 'true');
                        }
                        this.#submenu[key] = this.#menu.innerHTML;

                        // Restore original menu, and set the new value
                        this.#menu.classList.add('op-settings--sliding');
                        setTimeout((): void => {
                            this.#menu.innerHTML = this.#originalOutput;
                            const prev = this.#menu.querySelector(`.op-settings__menu-label[data-value="${key}-${defaultValue}"]`);
                            if (prev) {
                                prev.setAttribute('data-value', `${current}`);
                                if (prev.nextElementSibling) {
                                    prev.nextElementSibling.innerHTML = label;
                                }
                            }
                            defaultValue = value;
                            this.#originalOutput = this.#menu.innerHTML;
                            this.#menu.classList.remove('op-settings--sliding');
                        }, 100);
                    }
                }
            } else {
                this.hideEvent();
            }
        };

        document.addEventListener('click', this.#events.global['settings.submenu'], EVENT_OPTIONS);
        this.#player.getElement().addEventListener('controlshidden', this.hideEvent, EVENT_OPTIONS);
    }

    /**
     *
     *
     * @param {(string|number)} id
     * @param {string} type
     * @param {number} [minItems=2]
     * @memberof Settings
     */
    public removeItem(id: string | number, type: string, minItems = 2): void {
        const target = this.#player.getElement().querySelector(`.op-settings__submenu-label[data-value=${type}-${id}]`);
        if (target) {
            removeElement(target);
        }

        if (this.#player.getElement().querySelectorAll(`.op-settings__submenu-label[data-value^=${type}]`).length < minItems) {
            delete this.#submenu[type];
            const label = this.#player.getElement().querySelector(`.op-settings__menu-label[data-value^=${type}]`);
            const menuItem = label ? label.closest('.op-settings__menu-item') : null;
            if (menuItem) {
                removeElement(menuItem);
            }
        }
    }

    /**
     * Use the `Enter` and space bar keys to show the Settings menu.
     *
     * @private
     * @param {KeyboardEvent} e
     * @memberof Volume
     */
    private _keydownEvent(e: KeyboardEvent): void {
        const key = e.which || e.keyCode || 0;
        const isAd = this.#player.isAd();
        const settingsBtnFocused = document?.activeElement?.classList.contains('op-controls__settings');

        const menuFocused =
            document?.activeElement?.classList.contains('op-settings__menu-content') ||
            document?.activeElement?.classList.contains('op-settings__back') ||
            document?.activeElement?.classList.contains('op-settings__submenu-label');
        if (!isAd) {
            if (settingsBtnFocused && (key === 13 || key === 32)) {
                this.clickEvent();
                e.preventDefault();
                e.stopPropagation();
            } else if (menuFocused && (key === 13 || key === 32)) {
                this.#events.global['settings.submenu'](e);
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }
}

export default Settings;
