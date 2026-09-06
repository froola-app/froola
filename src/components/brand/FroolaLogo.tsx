import { useEffect, useRef } from 'react';

const ORANGE = '#D4500A';
const BLACK  = '#111111';

interface Props {
  size?: number;
  /** Wordmark color. Defaults to near-black for light backgrounds;
   *  pass a light color (e.g. '#FAFAF8') over dark surfaces. The smile
   *  stays brand orange regardless. */
  color?: string;
}

export default function FroolaLogo({ size = 72, color = BLACK }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr  = window.devicePixelRatio || 1;
    const FS   = size;
    const FONT = `900 ${FS}px 'DM Sans', system-ui, sans-serif`;

    document.fonts.ready.then(() => {
      const tmp = document.createElement('canvas').getContext('2d')!;
      tmp.font = FONT;

      const frW  = tmp.measureText('fr').width;
      const oW   = tmp.measureText('o').width;
      const laW  = tmp.measureText('la').width;
      const mAsc = tmp.measureText('M').actualBoundingBoxAscent;
      const oAsc = tmp.measureText('o').actualBoundingBoxAscent;
      const oDes = Math.abs(tmp.measureText('o').actualBoundingBoxDescent || 0);

      const xH   = oAsc + oDes;
      const padX = FS * 0.08;
      const padT = FS * 0.15;
      const base = padT + mAsc;
      const sw   = FS * 0.135;

      const oCY      = base - xH * 0.5;
      const oR       = xH * 0.5;
      const o1CX     = padX + frW + oW * 0.5;
      const o2CX     = o1CX + oW;
      const smCX     = (o1CX + o2CX) / 2;
      const smileGap = sw * 0.9;
      const smY      = oCY + oR + smileGap;
      const smileHW  = oW * 0.38;
      const smileD   = oW * 0.17;

      const totalW = padX * 2 + frW + oW * 2 + laW;
      const totalH = smY + smileD + sw + FS * 0.18;

      canvas.width        = Math.ceil(totalW * dpr);
      canvas.height       = Math.ceil(totalH * dpr);
      canvas.style.width  = Math.ceil(totalW) + 'px';
      canvas.style.height = Math.ceil(totalH) + 'px';

      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.font          = FONT;
      ctx.textBaseline  = 'alphabetic';

      ctx.fillStyle = color;
      ctx.fillText('fr', padX, base);
      ctx.fillText('o',  padX + frW,      base);
      ctx.fillText('o',  padX + frW + oW, base);
      ctx.fillText('la', padX + frW + oW * 2, base);

      ctx.strokeStyle = ORANGE;
      ctx.lineWidth   = sw * 0.72;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(smCX - smileHW, smY);
      ctx.quadraticCurveTo(smCX, smY + smileD, smCX + smileHW, smY);
      ctx.stroke();
    });
  }, [size, color]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
