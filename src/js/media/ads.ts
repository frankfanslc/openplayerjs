/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdsOptions, Source } from '../interfaces';
import Media from '../media';
import Player from '../player';
import { EVENT_OPTIONS, IS_ANDROID, IS_IOS, IS_IPHONE } from '../utils/constants';
import { addEvent, isVideo, isXml, loadScript } from '../utils/general';

declare const google: any;

// @see https://developers.google.com/interactive-media-ads/
class Ads {
    #adsEnded = false;

    #adsDone = false;

    #adsActive = false;

    #adsStarted = false;

    #intervalTimer = 0;

    #adsVolume: number;

    #adsMuted = false;

    #adsDuration = 0;

    #adsCurrentTime = 0;

    // @see https://tinyurl.com/ybjas4ut
    #adsManager: any = null;

    #player: Player;

    #media: Media;

    #element: HTMLMediaElement;

    #events: string[] = [];

    #ads: string | string[];

    #promise: Promise<void>;

    // @see https://tinyurl.com/ycwp4ufd
    #adsLoader: any;

    #adsContainer?: HTMLDivElement;

    #adsCustomClickContainer?: HTMLDivElement;

    // @see https://tinyurl.com/ya3zksso
    #adDisplayContainer: any;

    // @see https://tinyurl.com/ya8bxjf4
    #adsRequest: any;

    #autoStart = false;

    #autoStartMuted = false;

    #playTriggered = false;

    #adsOptions: AdsOptions;

    #currentAdsIndex = 0;

    #originalVolume: number;

    #preloadContent: any;

    #lastTimePaused = 0;

    #mediaSources: Source[] = [];

    #mediaStarted = false;

    loadPromise: unknown;

    loadedAd = false;

    constructor(player: Player, ads: string | string[], autoStart?: boolean, autoStartMuted?: boolean, options?: AdsOptions) {
        const defaultOpts: AdsOptions = {
            autoPlayAdBreaks: true,
            customClick: {
                enabled: false,
                label: 'Click here for more info',
            },
            debug: false,
            enablePreloading: false,
            language: 'en',
            loop: false,
            numRedirects: 4,
            publisherId: undefined,
            sdkPath: 'https://imasdk.googleapis.com/js/sdkloader/ima3.js',
            sessionId: undefined,
            src: [],
            vpaidMode: 'enabled',
        };
        this.#player = player;
        this.#ads = ads;
        this.#media = player.getMedia();
        this.#element = player.getElement();
        this.#autoStart = autoStart || false;
        this.#adsMuted = player.getElement().muted;
        this.#autoStartMuted = autoStartMuted || false;
        this.#adsOptions = { ...defaultOpts, ...options };
        if (options?.customClick && Object.keys(options.customClick).length) {
            this.#adsOptions.customClick = { ...defaultOpts.customClick, ...options.customClick };
        }
        this.#playTriggered = false;
        this.#originalVolume = this.#element.volume;
        this.#adsVolume = this.#originalVolume;

        const path = this.#adsOptions?.debug ? this.#adsOptions?.sdkPath?.replace(/(\.js$)/, '_debug.js') : this.#adsOptions?.sdkPath;

        this._handleClickInContainer = this._handleClickInContainer.bind(this);
        this.load = this.load.bind(this);
        this._loaded = this._loaded.bind(this);
        this._error = this._error.bind(this);
        this._assign = this._assign.bind(this);
        this._contentLoadedAction = this._contentLoadedAction.bind(this);
        this._loadedMetadataHandler = this._loadedMetadataHandler.bind(this);
        this._contentEndedListener = this._contentEndedListener.bind(this);
        this.resizeAds = this.resizeAds.bind(this);
        this._handleResizeAds = this._handleResizeAds.bind(this);
        this._onContentPauseRequested = this._onContentPauseRequested.bind(this);
        this._onContentResumeRequested = this._onContentResumeRequested.bind(this);

        this.#promise =
            path && (typeof google === 'undefined' || typeof google.ima === 'undefined')
                ? loadScript(path)
                : new Promise((resolve) => {
                      resolve();
                  });

        this.#promise
            .then(() => {
                this.load();
            })
            .catch((error) => {
                let message = 'Ad script could not be loaded; please check if you have an AdBlock ';
                message += 'turned on, or if you provided a valid URL is correct';
                console.error(`Ad error: ${message}.`);

                const details = {
                    detail: {
                        data: error,
                        message,
                        type: 'Ads',
                    },
                };
                const errorEvent = addEvent('playererror', details);
                this.#element.dispatchEvent(errorEvent);
            });
        return this;
    }

    load(force = false): void {
        if (typeof google === 'undefined' || !google.ima || (!force && this.loadedAd && this.#adsOptions.autoPlayAdBreaks)) {
            return;
        }

        /**
         * If we have set `autoPlayAdBreaks` to false and haven't set the
         * force flag, don't load ads yet
         */
        if (!this.#adsOptions.autoPlayAdBreaks && !force) {
            return;
        }

        this.loadedAd = true;

        /**
         * Check for an existing ad container div and destroy it to avoid
         * clickable areas of subsequent ads being blocked by old DIVs
         */
        const existingContainer = this.#player.getContainer().querySelector('.op-ads');
        if (existingContainer && existingContainer.parentNode) {
            existingContainer.parentNode.removeChild(existingContainer);
        }

        this.#adsStarted = true;
        this.#adsContainer = document.createElement('div');
        this.#adsContainer.className = 'op-ads';
        this.#adsContainer.tabIndex = -1;
        if (this.#element.parentElement) {
            this.#element.parentElement.insertBefore(this.#adsContainer, this.#element.nextSibling);
        }
        this.#adsContainer.addEventListener('click', this._handleClickInContainer);

        if (this.#adsOptions.customClick?.enabled) {
            this.#adsCustomClickContainer = document.createElement('div');
            this.#adsCustomClickContainer.className = 'op-ads__click-container';
            this.#adsCustomClickContainer.innerHTML = `<div class="op-ads__click-label">${this.#adsOptions.customClick.label}</div>`;
            if (this.#element.parentElement) {
                this.#element.parentElement.insertBefore(this.#adsCustomClickContainer, this.#element.nextSibling);
            }
        }

        this.#mediaSources = this.#media.src;
        const vpaidModeMap: Record<string, unknown> = {
            disabled: google.ima.ImaSdkSettings.VpaidMode.DISABLED,
            enabled: google.ima.ImaSdkSettings.VpaidMode.ENABLED,
            insecure: google.ima.ImaSdkSettings.VpaidMode.INSECURE,
        };

        google.ima.settings.setVpaidMode(vpaidModeMap[this.#adsOptions.vpaidMode || 'enabled']);
        google.ima.settings.setDisableCustomPlaybackForIOS10Plus(true);
        google.ima.settings.setAutoPlayAdBreaks(this.#adsOptions.autoPlayAdBreaks);
        google.ima.settings.setNumRedirects(this.#adsOptions.numRedirects);
        google.ima.settings.setLocale(this.#adsOptions.language);
        if (this.#adsOptions.sessionId) {
            google.ima.settings.setSessionId(this.#adsOptions.sessionId);
        }
        if (this.#adsOptions.publisherId) {
            google.ima.settings.setPpid(this.#adsOptions.publisherId);
        }
        google.ima.settings.setPlayerType('openplayerjs');
        google.ima.settings.setPlayerVersion('2.9.3');

        this.#adDisplayContainer = new google.ima.AdDisplayContainer(this.#adsContainer, this.#element, this.#adsCustomClickContainer);

        this.#adsLoader = new google.ima.AdsLoader(this.#adDisplayContainer);
        this.#adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, this._loaded, EVENT_OPTIONS);

        this.#adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, this._error, EVENT_OPTIONS);

        // Create responsive ad
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._handleResizeAds, EVENT_OPTIONS);
        }
        this.#element.addEventListener('loadedmetadata', this._handleResizeAds, EVENT_OPTIONS);

        // Request Ads automatically if `autoplay` was set
        if (
            this.#autoStart === true ||
            this.#autoStartMuted === true ||
            force === true ||
            this.#adsOptions.enablePreloading === true ||
            this.#playTriggered === true
        ) {
            if (!this.#adsDone) {
                this.#adsDone = true;
                this.#adDisplayContainer.initialize();
            }
            this._requestAds();
        }
    }

    async play(): Promise<void> {
        if (!this.#adsDone) {
            this.#playTriggered = true;
            this._initNotDoneAds();
            return;
        }

        if (this.#adsManager) {
            try {
                // No timer interval and no adsActive mean it's a potential initial ad play
                if (!this.#intervalTimer && this.#adsActive === false) {
                    this.#adsManager.start();
                } else {
                    this.#adsManager.resume();
                }
                this.#adsActive = true;
                const e = addEvent('play');
                this.#element.dispatchEvent(e);
            } catch (err) {
                this._resumeMedia();
            }
        }
    }

    pause(): void {
        if (this.#adsManager) {
            this.#adsActive = false;
            this.#adsManager.pause();
            const e = addEvent('pause');
            this.#element.dispatchEvent(e);
        }
    }

    destroy(): void {
        if (this.#adsManager) {
            this.#adsManager.removeEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, this._error);

            if (this.#events) {
                this.#events.forEach((event) => {
                    this.#adsManager.removeEventListener(event, this._assign);
                });
            }
        }

        this.#events = [];

        const controls = this.#player.getControls();
        const mouseEvents = controls ? controls.events.mouse : {};
        Object.keys(mouseEvents).forEach((event: string) => {
            if (this.#adsContainer) {
                this.#adsContainer.removeEventListener(event, mouseEvents[event]);
            }
        });

        if (this.#adsLoader) {
            this.#adsLoader.removeEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, this._error);
            this.#adsLoader.removeEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, this._loaded);
        }

        const destroy = !Array.isArray(this.#ads) || this.#currentAdsIndex > this.#ads.length;
        if (this.#adsManager && destroy) {
            this.#adsManager.destroy();
        }

        if (this.#adsOptions.customClick?.enabled && this.#adsCustomClickContainer) {
            this.#adsCustomClickContainer.remove();
        }

        if (IS_IOS || IS_ANDROID) {
            this.#element.removeEventListener('loadedmetadata', this._contentLoadedAction);
        }
        this.#element.removeEventListener('loadedmetadata', this._handleResizeAds);
        this.#element.removeEventListener('loadedmetadata', this._loadedMetadataHandler);
        this.#element.removeEventListener('ended', this._contentEndedListener);
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._handleResizeAds);
        }

        if (this.#adsContainer) {
            this.#adsContainer.removeEventListener('click', this._handleClickInContainer);
        }

        if (this.#adsContainer) {
            this.#adsContainer.remove();
        }
        this.loadPromise = null;
        this.loadedAd = false;
        this.#adsDone = false;
        this.#playTriggered = false;
        this.#adsDuration = 0;
        this.#adsCurrentTime = 0;
    }

    resizeAds(width?: number, height?: number): void {
        if (this.#adsManager) {
            const target = this.#element;
            const mode = target.getAttribute('data-fullscreen') === 'true' ? google.ima.ViewMode.FULLSCREEN : google.ima.ViewMode.NORMAL;

            let formattedWidth = width;
            const percentageWidth = width ? width.toString() : '';
            if (width && percentageWidth.indexOf('%') > -1) {
                if (this.#element.parentElement) {
                    formattedWidth = this.#element.parentElement.offsetWidth * (parseInt(percentageWidth, 10) / 100);
                }
            }

            let formattedHeight = height;
            const percentageHeight = height ? height.toString() : '';
            if (height && percentageHeight.indexOf('%') > -1) {
                if (this.#element.parentElement) {
                    formattedHeight = this.#element.parentElement.offsetHeight * (parseInt(percentageHeight, 10) / 100);
                }
            }

            let timeout;

            if (timeout && typeof window !== 'undefined') {
                window.cancelAnimationFrame(timeout);
            }
            if (typeof window !== 'undefined') {
                timeout = window.requestAnimationFrame(() => {
                    this.#adsManager.resize(formattedWidth || target.offsetWidth, formattedHeight || target.offsetHeight, mode);
                });
            }
        }
    }

    getAdsManager(): unknown {
        return this.#adsManager;
    }

    started(): boolean {
        return this.#adsStarted;
    }

    set src(source: string | string[]) {
        this.#ads = source;
    }

    set isDone(value: boolean) {
        this.#adsDone = value;
    }

    set playRequested(value: boolean) {
        this.#playTriggered = value;
    }

    set volume(value: number) {
        if (this.#adsManager) {
            this.#adsVolume = value;
            this.#adsManager.setVolume(value);
            this._setMediaVolume(value);
            this.#adsMuted = value === 0;
        }
    }

    get volume(): number {
        return this.#adsManager ? this.#adsManager.getVolume() : this.#originalVolume;
    }

    set muted(value: boolean) {
        if (this.#adsManager) {
            if (value) {
                this.#adsManager.setVolume(0);
                this.#adsMuted = true;
                this._setMediaVolume(0);
            } else {
                this.#adsManager.setVolume(this.#adsVolume);
                this.#adsMuted = false;
                this._setMediaVolume(this.#adsVolume);
            }
        }
    }

    get muted(): boolean {
        return this.#adsMuted;
    }

    set currentTime(value: number) {
        this.#adsCurrentTime = value;
    }

    get currentTime(): number {
        return this.#adsCurrentTime;
    }

    get duration(): number {
        return this.#adsDuration;
    }

    get paused(): boolean {
        return !this.#adsActive;
    }

    get ended(): boolean {
        return this.#adsEnded;
    }

    private _assign(event: any): void {
        const ad = event.getAd();
        switch (event.type) {
            case google.ima.AdEvent.Type.LOADED:
                if (!ad.isLinear()) {
                    this._onContentResumeRequested();
                } else {
                    if (IS_IPHONE && isVideo(this.#element)) {
                        this.#element.controls = false;
                    }
                    this.#adsDuration = ad.getDuration();
                    this.#adsCurrentTime = ad.getDuration();
                    if (!this.#mediaStarted && !IS_IOS && !IS_ANDROID) {
                        const waitingEvent = addEvent('waiting');
                        this.#element.dispatchEvent(waitingEvent);

                        const loadedEvent = addEvent('loadedmetadata');
                        this.#element.dispatchEvent(loadedEvent);

                        this.resizeAds();
                    }
                }
                break;
            case google.ima.AdEvent.Type.STARTED:
                if (ad.isLinear()) {
                    if (this.#element.parentElement && !this.#element.parentElement.classList.contains('op-ads--active')) {
                        this.#element.parentElement.classList.add('op-ads--active');
                    }

                    if (!this.#media.paused) {
                        this.#media.pause();
                    }
                    this.#adsActive = true;
                    const playEvent = addEvent('play');
                    this.#element.dispatchEvent(playEvent);
                    let resized;

                    if (!resized) {
                        this.resizeAds();
                        resized = true;
                    }

                    if (this.#media.ended) {
                        this.#adsEnded = false;
                        const endEvent = addEvent('adsmediaended');
                        this.#element.dispatchEvent(endEvent);
                    }

                    if (typeof window !== 'undefined') {
                        this.#intervalTimer = window.setInterval(() => {
                            if (this.#adsActive === true) {
                                this.#adsCurrentTime = Math.round(this.#adsManager.getRemainingTime());
                                const timeEvent = addEvent('timeupdate');
                                this.#element.dispatchEvent(timeEvent);
                            }
                        }, 350);
                    }
                }
                break;
            case google.ima.AdEvent.Type.COMPLETE:
            case google.ima.AdEvent.Type.SKIPPED:
                if (ad.isLinear()) {
                    if (event.type === google.ima.AdEvent.Type.SKIPPED) {
                        const skipEvent = addEvent('adsskipped');
                        this.#element.dispatchEvent(skipEvent);
                    }

                    if (this.#element.parentElement) {
                        this.#element.parentElement.classList.remove('op-ads--active');
                    }
                    this.#adsActive = false;
                    clearInterval(this.#intervalTimer);
                }
                break;
            case google.ima.AdEvent.Type.VOLUME_CHANGED:
                this._setMediaVolume(this.volume);
                break;
            case google.ima.AdEvent.Type.VOLUME_MUTED:
                if (ad.isLinear()) {
                    const volumeEvent = addEvent('volumechange');
                    this.#element.dispatchEvent(volumeEvent);
                }
                break;
            case google.ima.AdEvent.Type.ALL_ADS_COMPLETED:
                if (ad.isLinear()) {
                    this.#adsActive = false;
                    this.#adsEnded = true;
                    this.#intervalTimer = 0;
                    this.#adsMuted = false;
                    this.#adsStarted = false;
                    if (this.#element.parentElement) {
                        this.#element.parentElement.classList.remove('op-ads--active');
                    }
                    this.destroy();
                    if (this.#element.currentTime >= this.#element.duration) {
                        const endedEvent = addEvent('ended');
                        this.#element.dispatchEvent(endedEvent);
                    }
                }
                break;
            case google.ima.AdEvent.Type.CLICK:
                const pauseEvent = addEvent('pause');
                this.#element.dispatchEvent(pauseEvent);
                break;
            case google.ima.AdEvent.Type.AD_BREAK_READY:
                if (!this.#adsOptions.autoPlayAdBreaks) {
                    this.play();
                }
                break;
            default:
                break;
        }

        // Assign events prefixed with `ads` to main element so user
        // can listen to these events, except if the system detects a non-fatal error
        if (event.type === google.ima.AdEvent.Type.LOG) {
            const adData = event.getAdData();
            if (adData.adError) {
                const message = adData.adError.getMessage();
                console.warn(`Ad warning: Non-fatal error occurred: ${message}`);
                const details = {
                    detail: {
                        data: adData.adError,
                        message,
                        type: 'Ads',
                    },
                };
                const errorEvent = addEvent('playererror', details);
                this.#element.dispatchEvent(errorEvent);
            }
        } else {
            const e = addEvent(`ads${event.type}`);
            this.#element.dispatchEvent(e);
        }
    }

    // @see https://developers.google.com/interactive-media-ads/docs/sdks/html5/v3/apis#ima.AdError.ErrorCode
    private _error(event: any): void {
        const error = event.getError();
        const details = {
            detail: {
                data: error,
                message: error.toString(),
                type: 'Ads',
            },
        };
        const errorEvent = addEvent('playererror', details);
        this.#element.dispatchEvent(errorEvent);

        // @see https://support.google.com/admanager/answer/4442429?hl=en
        const fatalErrorCodes = [
            100, 101, 102, 300, 301, 302, 303, 400, 401, 402, 403, 405, 406, 407, 408, 409, 410, 500, 501, 502, 503, 900, 901, 1005,
        ];

        if (Array.isArray(this.#ads) && this.#ads.length > 1 && this.#currentAdsIndex < this.#ads.length - 1) {
            this.#currentAdsIndex++;
            this.destroy();
            this.#adsStarted = true;
            this.#playTriggered = true;
            this.load(true);
            console.warn(`Ad warning: ${error.toString()}`);
        } else {
            // Unless there's a fatal error, do not destroy the Ads manager
            if (fatalErrorCodes.indexOf(error.getErrorCode()) > -1) {
                if (this.#adsManager) {
                    this.#adsManager.destroy();
                }
                console.error(`Ad error: ${error.toString()}`);
            } else {
                console.warn(`Ad warning: ${error.toString()}`);
            }
            if (this.#autoStart === true || this.#autoStartMuted === true || this.#adsStarted === true) {
                this.#adsActive = false;
                // Sometimes, due to pre-fetch issues, Ads could report an error, but the SDK is able to
                // play Ads, so check if src was set to determine what action to take
                this._resumeMedia();
            }
        }
    }

    private _loaded(adsManagerLoadedEvent: any): void {
        const adsRenderingSettings = new google.ima.AdsRenderingSettings();
        adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = false;
        adsRenderingSettings.enablePreloading = this.#adsOptions.enablePreloading;
        // Get the ads manager.
        this.#adsManager = adsManagerLoadedEvent.getAdsManager(this.#element, adsRenderingSettings);
        this._start(this.#adsManager);
        this.loadPromise = new Promise((resolve) => resolve);
    }

    private _start(manager: any): void {
        if (this.#adsCustomClickContainer && manager.isCustomClickTrackingUsed()) {
            this.#adsCustomClickContainer.classList.add('op-ads__click-container--visible');
        }
        // Add listeners to the required events.
        manager.addEventListener(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, this._onContentPauseRequested, EVENT_OPTIONS);
        manager.addEventListener(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, this._onContentResumeRequested, EVENT_OPTIONS);

        this.#events = [
            google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
            google.ima.AdEvent.Type.CLICK,
            google.ima.AdEvent.Type.VIDEO_CLICKED,
            google.ima.AdEvent.Type.VIDEO_ICON_CLICKED,
            google.ima.AdEvent.Type.AD_PROGRESS,
            google.ima.AdEvent.Type.AD_BUFFERING,
            google.ima.AdEvent.Type.IMPRESSION,
            google.ima.AdEvent.Type.DURATION_CHANGE,
            google.ima.AdEvent.Type.USER_CLOSE,
            google.ima.AdEvent.Type.LINEAR_CHANGED,
            google.ima.AdEvent.Type.SKIPPABLE_STATE_CHANGED,
            google.ima.AdEvent.Type.AD_METADATA,
            google.ima.AdEvent.Type.INTERACTION,
            google.ima.AdEvent.Type.COMPLETE,
            google.ima.AdEvent.Type.FIRST_QUARTILE,
            google.ima.AdEvent.Type.LOADED,
            google.ima.AdEvent.Type.MIDPOINT,
            google.ima.AdEvent.Type.PAUSED,
            google.ima.AdEvent.Type.RESUMED,
            google.ima.AdEvent.Type.USER_CLOSE,
            google.ima.AdEvent.Type.STARTED,
            google.ima.AdEvent.Type.THIRD_QUARTILE,
            google.ima.AdEvent.Type.SKIPPED,
            google.ima.AdEvent.Type.VOLUME_CHANGED,
            google.ima.AdEvent.Type.VOLUME_MUTED,
            google.ima.AdEvent.Type.LOG,
        ];

        if (!this.#adsOptions.autoPlayAdBreaks) {
            // Add it to the events array so it gets removed onDestroy
            this.#events.push(google.ima.AdEvent.Type.AD_BREAK_READY);
        }

        const controls = this.#player.getControls();
        const mouseEvents = controls ? controls.events.mouse : {};
        Object.keys(mouseEvents).forEach((event: string) => {
            if (this.#adsContainer) {
                this.#adsContainer.addEventListener(event, mouseEvents[event], EVENT_OPTIONS);
            }
        });
        this.#events.forEach((event) => {
            manager.addEventListener(event, this._assign, EVENT_OPTIONS);
        });

        if (this.#autoStart === true || this.#autoStartMuted === true || this.#playTriggered === true) {
            this.#playTriggered = false;
            if (!this.#adsDone) {
                this._initNotDoneAds();
                return;
            }
            manager.init(
                this.#element.offsetWidth,
                this.#element.offsetHeight,
                this.#element.parentElement && this.#element.parentElement.getAttribute('data-fullscreen') === 'true'
                    ? google.ima.ViewMode.FULLSCREEN
                    : google.ima.ViewMode.NORMAL
            );
            manager.start();
            const e = addEvent('play');
            this.#element.dispatchEvent(e);
        } else if (this.#adsOptions.enablePreloading === true) {
            manager.init(
                this.#element.offsetWidth,
                this.#element.offsetHeight,
                this.#element.parentElement && this.#element.parentElement.getAttribute('data-fullscreen') === 'true'
                    ? google.ima.ViewMode.FULLSCREEN
                    : google.ima.ViewMode.NORMAL
            );
        }
    }

    private _initNotDoneAds(): void {
        if (this.#adDisplayContainer) {
            this.#adsDone = true;
            this.#adDisplayContainer.initialize();

            if (IS_IOS || IS_ANDROID) {
                this.#preloadContent = this._contentLoadedAction;
                this.#element.addEventListener('loadedmetadata', this._contentLoadedAction, EVENT_OPTIONS);
                this.#element.load();
            } else {
                this._contentLoadedAction();
            }
        } else {
            this.load();
            this.loadedAd = false;
        }
    }

    private _contentEndedListener(): void {
        this.#adsEnded = true;
        this.#adsActive = false;
        this.#adsStarted = false;
        this.#adsLoader.contentComplete();
    }

    private _onContentPauseRequested(): void {
        this.#element.removeEventListener('ended', this._contentEndedListener);
        this.#lastTimePaused = this.#media.currentTime;

        if (this.#adsStarted) {
            this.#media.pause();
        } else {
            this.#adsStarted = true;
        }
        const e = addEvent('play');
        this.#element.dispatchEvent(e);
    }

    private _onContentResumeRequested(): void {
        if (this.#adsOptions.loop) {
            if (Array.isArray(this.#ads)) {
                if (this.#currentAdsIndex === this.#ads.length - 1) {
                    this.#currentAdsIndex = 0;
                } else {
                    this.#currentAdsIndex++;
                }
            }
            this.destroy();
            this.#adsLoader.contentComplete();
            this.#playTriggered = true;
            this.#adsStarted = true;
            this.load(true);
        } else {
            this.#element.addEventListener('ended', this._contentEndedListener, EVENT_OPTIONS);
            this.#element.addEventListener('loadedmetadata', this._loadedMetadataHandler, EVENT_OPTIONS);
            if (IS_IOS || IS_ANDROID) {
                this.#media.src = this.#mediaSources;
                this.#media.load();
                this._prepareMedia();
                if (this.#element.parentElement) {
                    this.#element.parentElement.classList.add('op-ads--active');
                }
            } else {
                const event = addEvent('loadedmetadata');
                this.#element.dispatchEvent(event);
            }
        }
    }

    private _loadedMetadataHandler(): void {
        if (Array.isArray(this.#ads)) {
            this.#currentAdsIndex++;
            if (this.#currentAdsIndex <= this.#ads.length - 1) {
                if (this.#adsManager) {
                    this.#adsManager.destroy();
                }
                this.#adsLoader.contentComplete();
                this.#playTriggered = true;
                this.#adsStarted = true;
                this.#adsDone = false;
                this._requestAds();
            } else {
                if (!this.#adsOptions.autoPlayAdBreaks) {
                    this._resetAdsAfterManualBreak();
                }
                this._prepareMedia();
            }
        } else if (this.#element.seekable.length) {
            if (this.#element.seekable.end(0) > this.#lastTimePaused) {
                if (!this.#adsOptions.autoPlayAdBreaks) {
                    this._resetAdsAfterManualBreak();
                }
                this._prepareMedia();
            }
        } else {
            setTimeout(this._loadedMetadataHandler, 100);
        }
    }

    private _resumeMedia(): void {
        this.#intervalTimer = 0;
        this.#adsMuted = false;
        this.#adsStarted = false;
        this.#adsDuration = 0;
        this.#adsCurrentTime = 0;
        if (this.#element.parentElement) {
            this.#element.parentElement.classList.remove('op-ads--active');
        }

        if (this.#media.ended) {
            const e = addEvent('ended');
            this.#element.dispatchEvent(e);
        } else {
            try {
                this.#media.play();
                setTimeout(() => {
                    const e = addEvent('play');
                    this.#element.dispatchEvent(e);
                }, 50);
            } catch (err) {
                console.error(err);
            }
        }
    }

    private _requestAds(): void {
        this.#adsRequest = new google.ima.AdsRequest();
        const ads = Array.isArray(this.#ads) ? this.#ads[this.#currentAdsIndex] : this.#ads;

        if (isXml(ads)) {
            this.#adsRequest.adsResponse = ads;
        } else {
            this.#adsRequest.adTagUrl = ads;
        }

        const width = this.#element.parentElement ? this.#element.parentElement.offsetWidth : 0;
        const height = this.#element.parentElement ? this.#element.parentElement.offsetHeight : 0;
        this.#adsRequest.linearAdSlotWidth = width;
        this.#adsRequest.linearAdSlotHeight = height;
        this.#adsRequest.nonLinearAdSlotWidth = width;
        this.#adsRequest.nonLinearAdSlotHeight = height / 3;
        this.#adsRequest.setAdWillAutoPlay(this.#autoStart);
        this.#adsRequest.setAdWillPlayMuted(this.#autoStartMuted);
        this.#adsLoader.requestAds(this.#adsRequest);
    }

    /**
     * Internal callback to request Ads.
     *
     * @memberof Ads
     */
    private _contentLoadedAction(): void {
        if (this.#preloadContent) {
            this.#element.removeEventListener('loadedmetadata', this.#preloadContent);
            this.#preloadContent = null;
        }
        this._requestAds();
    }

    // @see https://developers.google.com/interactive-media-ads/docs/sdks/html5/faq#8
    private _resetAdsAfterManualBreak(): void {
        if (this.#adsManager) {
            this.#adsManager.destroy();
        }
        this.#adsLoader.contentComplete();
        this.#adsDone = false;
        this.#playTriggered = true;
    }

    private _prepareMedia(): void {
        this.#media.currentTime = this.#lastTimePaused;
        this.#element.removeEventListener('loadedmetadata', this._loadedMetadataHandler);
        this._resumeMedia();
    }

    private _setMediaVolume(volume: number): void {
        this.#media.volume = volume;
        this.#media.muted = volume === 0;
    }

    private _handleClickInContainer(): void {
        if (this.#media.paused) {
            const e = addEvent('paused');
            this.#element.dispatchEvent(e);
            this.pause();
        }
    }

    private _handleResizeAds(): void {
        this.resizeAds();
    }
}

export default Ads;
