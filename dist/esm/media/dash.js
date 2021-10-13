var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DashMedia_player, _DashMedia_events, _DashMedia_options;
import { HAS_MSE } from '../utils/constants';
import { addEvent } from '../utils/events';
import { loadScript } from '../utils/general';
import { isDashSource } from '../utils/media';
import Native from './native';
class DashMedia extends Native {
    constructor(element, mediaSource, options) {
        super(element, mediaSource);
        _DashMedia_player.set(this, void 0);
        _DashMedia_events.set(this, {});
        _DashMedia_options.set(this, {});
        __classPrivateFieldSet(this, _DashMedia_options, options, "f");
        this.promise =
            typeof dashjs === 'undefined'
                ?
                    loadScript('https://cdn.dashjs.org/latest/dash.all.min.js')
                : new Promise((resolve) => {
                    resolve({});
                });
        this._assign = this._assign.bind(this);
        this.promise.then(() => {
            __classPrivateFieldSet(this, _DashMedia_player, dashjs.MediaPlayer().create(), "f");
            this.instance = __classPrivateFieldGet(this, _DashMedia_player, "f");
        });
        return this;
    }
    canPlayType(mimeType) {
        return HAS_MSE && mimeType === 'application/dash+xml';
    }
    load() {
        this._preparePlayer();
        __classPrivateFieldGet(this, _DashMedia_player, "f").attachSource(this.media.src);
        const e = addEvent('loadedmetadata');
        this.element.dispatchEvent(e);
        if (!__classPrivateFieldGet(this, _DashMedia_events, "f")) {
            __classPrivateFieldSet(this, _DashMedia_events, dashjs.MediaPlayer.events, "f");
            Object.keys(__classPrivateFieldGet(this, _DashMedia_events, "f")).forEach((event) => {
                __classPrivateFieldGet(this, _DashMedia_player, "f").on(__classPrivateFieldGet(this, _DashMedia_events, "f")[event], this._assign);
            });
        }
    }
    destroy() {
        this._revoke();
    }
    set src(media) {
        if (isDashSource(media)) {
            this._revoke();
            __classPrivateFieldSet(this, _DashMedia_player, dashjs.MediaPlayer().create(), "f");
            this._preparePlayer();
            __classPrivateFieldGet(this, _DashMedia_player, "f").attachSource(media.src);
            __classPrivateFieldSet(this, _DashMedia_events, dashjs.MediaPlayer.events, "f");
            Object.keys(__classPrivateFieldGet(this, _DashMedia_events, "f")).forEach((event) => {
                __classPrivateFieldGet(this, _DashMedia_player, "f").on(__classPrivateFieldGet(this, _DashMedia_events, "f")[event], this._assign);
            });
        }
    }
    get levels() {
        const levels = [];
        if (__classPrivateFieldGet(this, _DashMedia_player, "f")) {
            const bitrates = __classPrivateFieldGet(this, _DashMedia_player, "f").getBitrateInfoListFor('video');
            if (bitrates.length) {
                bitrates.forEach((item) => {
                    if (bitrates[item]) {
                        const { height, name } = bitrates[item];
                        const level = {
                            height,
                            id: `${item}`,
                            label: name || null,
                        };
                        levels.push(level);
                    }
                });
            }
        }
        return levels;
    }
    set level(level) {
        if (level === 0) {
            __classPrivateFieldGet(this, _DashMedia_player, "f").setAutoSwitchQuality(true);
        }
        else {
            __classPrivateFieldGet(this, _DashMedia_player, "f").setAutoSwitchQuality(false);
            __classPrivateFieldGet(this, _DashMedia_player, "f").setQualityFor('video', level);
        }
    }
    get level() {
        return __classPrivateFieldGet(this, _DashMedia_player, "f") ? __classPrivateFieldGet(this, _DashMedia_player, "f").getQualityFor('video') : -1;
    }
    _assign(event) {
        if (event.type === 'error') {
            const details = {
                detail: {
                    message: event,
                    type: 'M(PEG)-DASH',
                },
            };
            const errorEvent = addEvent('playererror', details);
            this.element.dispatchEvent(errorEvent);
        }
        else {
            const e = addEvent(event.type, { detail: event });
            this.element.dispatchEvent(e);
        }
    }
    _revoke() {
        if (__classPrivateFieldGet(this, _DashMedia_events, "f")) {
            Object.keys(__classPrivateFieldGet(this, _DashMedia_events, "f")).forEach((event) => {
                __classPrivateFieldGet(this, _DashMedia_player, "f").off(__classPrivateFieldGet(this, _DashMedia_events, "f")[event], this._assign);
            });
            __classPrivateFieldSet(this, _DashMedia_events, [], "f");
        }
        __classPrivateFieldGet(this, _DashMedia_player, "f").reset();
    }
    _preparePlayer() {
        var _a;
        if (typeof __classPrivateFieldGet(this, _DashMedia_player, "f").getDebug().setLogToBrowserConsole === 'undefined') {
            __classPrivateFieldGet(this, _DashMedia_player, "f").updateSettings({
                debug: {
                    logLevel: dashjs.Debug.LOG_LEVEL_NONE,
                },
                streaming: {
                    fastSwitchEnabled: true,
                    scheduleWhilePaused: false,
                },
            });
        }
        else {
            __classPrivateFieldGet(this, _DashMedia_player, "f").getDebug().setLogToBrowserConsole(false);
            __classPrivateFieldGet(this, _DashMedia_player, "f").setScheduleWhilePaused(false);
            __classPrivateFieldGet(this, _DashMedia_player, "f").setFastSwitchEnabled(true);
        }
        __classPrivateFieldGet(this, _DashMedia_player, "f").initialize();
        __classPrivateFieldGet(this, _DashMedia_player, "f").attachView(this.element);
        __classPrivateFieldGet(this, _DashMedia_player, "f").setAutoPlay(false);
        if (((_a = __classPrivateFieldGet(this, _DashMedia_options, "f")) === null || _a === void 0 ? void 0 : _a.drm) && Object.keys(__classPrivateFieldGet(this, _DashMedia_options, "f").drm).length) {
            __classPrivateFieldGet(this, _DashMedia_player, "f").setProtectionData(__classPrivateFieldGet(this, _DashMedia_options, "f").drm);
            if (__classPrivateFieldGet(this, _DashMedia_options, "f").robustnessLevel && __classPrivateFieldGet(this, _DashMedia_options, "f").robustnessLevel) {
                __classPrivateFieldGet(this, _DashMedia_player, "f").getProtectionController().setRobustnessLevel(__classPrivateFieldGet(this, _DashMedia_options, "f").robustnessLevel);
            }
        }
    }
}
_DashMedia_player = new WeakMap(), _DashMedia_events = new WeakMap(), _DashMedia_options = new WeakMap();
export default DashMedia;
