export type PnlArrowDirection = 'up' | 'down';

export const PNL_ARROW_VIEW_BOX = '0 0 9 7';
export const PNL_ARROW_WIDTH = 9;
export const PNL_ARROW_HEIGHT = 7;

export const PNL_ARROW_POINTS: Record<PnlArrowDirection, string> = {
  up: '4.5,0 9,7 0,7',
  down: '4.5,7 9,0 0,0',
};
