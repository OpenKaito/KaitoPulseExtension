export interface VerifySurfaceRequest {
  verifierId: string;
  originTabId?: number;
  requestedAt: number;
}

export const verifySurfaceKey = (windowId: number): string => `kaito.verifySurface.${windowId}`;
