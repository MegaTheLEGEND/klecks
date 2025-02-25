import {BB} from '../../bb/bb';
import {KL} from '../kl';
import {KlCanvas} from '../canvas/kl-canvas';
import {TExportType} from '../kl-types';
import {SaveReminder} from '../ui/components/save-reminder';
import {saveAs} from '../../bb/base/save-as';

export class SaveToComputer {

    /**
     * Using old code, because saving somehow doesn't work for ipad before ios 13,
     * and it doesn't even throw an exception.
     */
    private saveImage (canvas: HTMLCanvasElement, filename: string, mimeType: string): void {
        const parts = canvas.toDataURL(mimeType).match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/);

        if (!parts) {
            throw new Error('saveImage: empty parts');
        }

        //assume base64 encoding
        const binStr = atob(parts[3]);
        //convert to binary in ArrayBuffer
        const buf = new ArrayBuffer(binStr.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < view.length; i++) {
            view[i] = binStr.charCodeAt(i);
        }
        const blob = new Blob([view], {'type': parts[1]});
        saveAs(blob, filename);
    }

    constructor (
        private saveReminder: SaveReminder,
        private klRootEl: HTMLElement,
        private getExportType: () => TExportType,
        private getKlCanvas: () => KlCanvas,
        private filenameBase: string,
    ) {}

    save (format?: 'psd' | 'layers' | 'png') {
        this.saveReminder.reset();

        if (!format) {
            format = this.getExportType();
        }

        if (format === 'png') {
            const extension = 'png';
            const mimeType = 'image/png';
            const filename = BB.getDate() + this.filenameBase + '.' + extension;
            const fullCanvas = this.getKlCanvas().getCompleteCanvas(1);
            try {
                this.saveImage(fullCanvas, filename, mimeType);
            } catch (error) { //fallback for old browsers
                alert('could not save');
                throw new Error('failed png export');
            }
        } else if (format === 'layers') {
            const extension = 'png';
            const mimeType = 'image/png';
            const fileBase = BB.getDate() + this.filenameBase;
            const layerArr = this.getKlCanvas().getLayersFast();
            for (let i = 0; i < layerArr.length; i++) {
                const item = layerArr[i];
                const fnameArr = [
                    fileBase,
                    '_',
                    ('' + (i + 1)).padStart(2, '0'),
                    '_',
                    item.name,
                    '.',
                    extension,
                ];
                this.saveImage(item.canvas, fnameArr.join(''), mimeType);
            }
        } else if (format === 'psd') {

            const layerArr = this.getKlCanvas().getLayersFast();

            const psdConfig: {
                width: number;
                height: number;
                children: {
                    name: string;
                    opacity: number;
                    canvas: HTMLCanvasElement;
                    blendMode: string;
                    left: number;
                    top: number;
                }[];
                canvas: HTMLCanvasElement;
            } = {
                width: this.getKlCanvas().getWidth(),
                height: this.getKlCanvas().getHeight(),
                children: [],
                canvas: this.getKlCanvas().getCompleteCanvas(1),
            };
            for (let i = 0; i < layerArr.length; i++) {
                const item = layerArr[i];
                psdConfig.children.push({
                    name: item.name,
                    opacity: item.opacity,
                    canvas: item.canvas,
                    blendMode: KL.PSD.blendKlToPsd(item.mixModeStr),
                    left: 0,
                    top: 0,
                });
            }

            KL.loadAgPsd().then((agPsdLazy) => {
                const buffer = agPsdLazy.writePsdBuffer(psdConfig);
                const blob = new Blob([buffer], { type: 'application/octet-stream' });
                saveAs(blob, BB.getDate() + this.filenameBase + '.psd');
            }).catch(() => {
                alert('Error: failed to load PSD library');
            });

        }

    }

}