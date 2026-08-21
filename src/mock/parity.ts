
type NoneMissing<T extends never> = T;

type Missing<Real, Stub> = Exclude<keyof Real, keyof Stub> | Exclude<keyof Stub, keyof Real>;

export type _PopupDataParity = NoneMissing<
  Missing<typeof import('./popup-data'), typeof import('./popup-data.stub')>
>;

export type _HoverCardParity = NoneMissing<
  Missing<typeof import('./hover-card'), typeof import('./hover-card.stub')>
>;

export type _SettingsParity = NoneMissing<
  Missing<typeof import('./settings'), typeof import('./settings.stub')>
>;
