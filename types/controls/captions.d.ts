import PlayerComponent from '../interfaces/component';
import SettingsItem from '../interfaces/settings/item';
import Player from '../player';
/**
 * Closed Captions.
 *
 * @description Using `<track>` tags, this class allows the displaying of both local and remote captions/subtitles
 * bypassing CORS, and without the use of the `crossorigin` attribute.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/track
 * @see https://www.html5rocks.com/en/tutorials/track/basics/
 */
declare class Captions implements PlayerComponent {
    #private;
    constructor(player: Player, position: string, layer: string);
    create(): void;
    destroy(): void;
    addSettings(): SettingsItem | unknown;
    private _getCuesFromText;
    private _getNativeCues;
    private _displayCaptions;
    private _hideCaptions;
    private _search;
    private _prepareTrack;
    private _formatMenuItems;
}
export default Captions;
