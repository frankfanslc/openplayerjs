import { PlayerComponent, SettingsItem } from '../interfaces';
import Player from '../player';
declare class Levels implements PlayerComponent {
    #private;
    /**
     * Create an instance of Captions.
     *
     * @param {Player} player
     * @memberof Levels
     * @returns {Levels}
     */
    constructor(player: Player, position: string, layer: string);
    /**
     * Create a button and a container to display levels (if any).
     *
     * @inheritDoc
     * @memberof Levels
     */
    create(): void;
    destroy(): void;
    addSettings(): SettingsItem | unknown;
    private _formatMenuItems;
    private _getResolutionsLabel;
    private _gatherLevels;
    private _buildMenu;
}
export default Levels;
