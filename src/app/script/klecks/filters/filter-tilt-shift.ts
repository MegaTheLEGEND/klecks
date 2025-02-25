import {BB} from '../../bb/bb';
import {eventResMs} from './filters-consts';
import {KlSlider} from '../ui/components/kl-slider';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {LANG} from '../../language/language';
import {IVector2D} from '../../bb/bb-types';
import {TFilterHistoryEntry} from './filters';

export type TFilterTiltShiftInput = {
    a: IVector2D;
    b: IVector2D;
    blur: number;
    gradient: number;
};

export type TFilterTiltShiftHistoryEntry = TFilterHistoryEntry<
    'tiltShift',
    TFilterTiltShiftInput>;

export const filterTiltShift = {

    getDialog (params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        const displayW = parseInt('' + fit.width), displayH = parseInt('' + fit.height);
        const w = Math.min(displayW, context.canvas.width);
        const h = Math.min(displayH, context.canvas.height);

        const tempCanvas = BB.canvas(w, h);
        {
            const ctx = BB.ctx(tempCanvas);
            ctx.save();
            if (w > context.canvas.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(context.canvas, 0, 0, w, h);
            ctx.restore();
        }
        const previewFactor = w / context.canvas.width;
        const displayPreviewFactor = displayW / context.canvas.width;

        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterTiltShiftInput> = {
            element: div,
        };

        const pointerListenerArr = [];

        function finishInit () {
            let blur = 20, gradient = 200;
            div.innerHTML = LANG('filter-tilt-shift-description') + '<br/><br/>';

            const fxCanvas = getSharedFx();
            if (!fxCanvas) {
                return; // todo throw?
            }
            const texture = fxCanvas.texture(tempCanvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size
            let fa, fb; // focus line
            function update () {
                try {
                    fxCanvas.draw(texture).tiltShift(
                        fa.x / displayPreviewFactor * previewFactor,
                        fa.y / displayPreviewFactor * previewFactor,
                        fb.x / displayPreviewFactor * previewFactor,
                        fb.y / displayPreviewFactor * previewFactor,
                        blur * previewFactor,
                        gradient * previewFactor
                    ).update();
                    klCanvasPreview.render();
                } catch(e) {
                    (div as any).errorCallback(e);
                }
            }

            function nob (x, y) {
                const nobSize = 14;
                const div = BB.el({
                    css: {
                        width: nobSize + 'px',
                        height: nobSize + 'px',
                        backgroundColor: '#fff',
                        boxShadow: 'inset 0 0 0 2px #000',
                        borderRadius: nobSize + 'px',
                        position: 'absolute',
                        cursor: 'move',
                        left: (x - nobSize / 2) + 'px',
                        top: (y - nobSize / 2) + 'px',
                        userSelect: 'none',
                        touchAction: 'none',
                    },
                });
                (div as any).x = x;
                (div as any).y = y;
                const pointerListener = new BB.PointerListener({
                    target: div,
                    onPointer: function (event) {
                        event.eventPreventDefault();
                        if (event.button === 'left' && event.type === 'pointermove') {
                            (div as any).x += event.dX;
                            (div as any).y += event.dY;
                            div.style.left = ((div as any).x - nobSize / 2) + 'px';
                            div.style.top = ((div as any).y - nobSize / 2) + 'px';
                            update();
                        }
                    },
                });
                pointerListenerArr.push(pointerListener);
                return div;
            }

            fa = nob(parseInt('' + (displayW / 6)), parseInt('' + (displayH / 2)));
            fb = nob(parseInt('' + (displayW - displayW / 6)), parseInt('' + (displayH - displayH / 3)));

            const blurSlider = new KlSlider({
                label: LANG('filter-tilt-shift-blur'),
                width: 300,
                height: 30,
                min: 0,
                max: 200,
                value: blur,
                eventResMs: eventResMs,
                onChange: function (val) {
                    blur = val;
                    update();
                },
            });
            blurSlider.getElement().style.marginBottom = '10px';
            div.append(blurSlider.getElement());
            const gradientSlider = new KlSlider({
                label: LANG('filter-tilt-shift-gradient'),
                width: 300,
                height: 30,
                min: 0,
                max: 1000,
                value: gradient,
                eventResMs: eventResMs,
                onChange: function (val) {
                    gradient = val;
                    update();
                },
            });
            div.append(gradientSlider.getElement());


            const previewWrapper = BB.el({
                className: 'kl-preview-wrapper',
                css: {
                    width: '340px',
                    height: '220px',
                },
            });
            previewWrapper.oncontextmenu = function () {
                return false;
            };

            const previewLayerArr: IKlBasicLayer[] = [];
            {
                for (let i = 0; i < layers.length; i++) {
                    previewLayerArr.push({
                        image: i === selectedLayerIndex ? fxCanvas : layers[i].context.canvas,
                        opacity: layers[i].opacity,
                        mixModeStr: layers[i].mixModeStr,
                    });
                }
            }
            const klCanvasPreview = new KlCanvasPreview({
                width: parseInt('' + displayW),
                height: parseInt('' + displayH),
                layers: previewLayerArr,
            });

            const previewInnerWrapper = BB.el({
                className: 'kl-preview-wrapper__canvas',
                css: {
                    width: parseInt('' + displayW) + 'px',
                    height: parseInt('' + displayH) + 'px',
                },
            });
            previewInnerWrapper.append(klCanvasPreview.getElement());
            previewWrapper.append(previewInnerWrapper);

            previewInnerWrapper.append(fa, fb);


            div.append(previewWrapper);
            update();
            result.destroy = (): void => {
                for (let i = 0; i < pointerListenerArr.length; i++) {
                    pointerListenerArr[i].destroy();
                }
                blurSlider.destroy();
                gradientSlider.destroy();
                texture.destroy();
                klCanvasPreview.destroy();
            };
            result.getInput = function (): TFilterTiltShiftInput {
                result.destroy();
                return {
                    a: {x: fa.x / displayPreviewFactor, y: fa.y / displayPreviewFactor},
                    b: {x: fb.x / displayPreviewFactor, y: fb.y / displayPreviewFactor},
                    blur: blur,
                    gradient: gradient,
                };
            };
        }

        setTimeout(finishInit, 1);


        return result;
    },

    apply (params: IFilterApply<TFilterTiltShiftInput>): boolean {
        const context = params.context;
        const history = params.history;
        const a = params.input.a;
        const b = params.input.b;
        const blur = params.input.blur;
        const gradient = params.input.gradient;
        if (!context || !history) {
            return false;
        }
        history.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).tiltShift(a.x, a.y, b.x, b.y, blur, gradient).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ['filter', 'tiltShift'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterTiltShiftHistoryEntry);
        return true;
    },

};