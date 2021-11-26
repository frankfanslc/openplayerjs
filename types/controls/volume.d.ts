import { PlayerComponent } from '../interfaces';
import Player from '../player';
declare class Volume implements PlayerComponent {
    #private;
    constructor(player: Player, position: string, layer: string);
    /**
     *
     * @inheritDoc
     * @memberof Volume
     */
    create(): void;
    destroy(): void;
    private _enterSpaceKeyEvent;
}
export default Volume;
