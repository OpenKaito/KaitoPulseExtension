import type { UserInfoData } from "../types";
import { ProfileObserver } from "./profile-observer";
import { getUsernameHistory, loadUserInfoData } from "./profile-data";
import { findHandleAnchor, findTabNavAnchor, findProfileHeaderBlockAnchor } from "./profile-dom";
import { createUsernameHistory, type UsernameHistoryHandle } from "./username-history";
import { createUserInfoModule, type UserInfoHandle } from "./user-info-module";
import { isEnabled, type SignalSettings } from "../settings";

const USER_INFO_PARTIAL_POKE_MS = 5_000;

export class ProfileModulesController {
  private readonly doc: Document;
  private readonly observer: ProfileObserver;
  private currentHandle: string | null = null;
  private currentHeader: HTMLElement | null = null;
  private settings: SignalSettings;
  private usernameHistory: UsernameHistoryHandle | null = null;
  private userInfo: UserInfoHandle | null = null;
  private userInfoData: UserInfoData | null = null;
  private userInfoLoading = false;

  private userInfoSettled = false;

  private userInfoPartial = false;

  private userInfoErrored = false;

  private lastUserInfoAttemptAt = 0;

  private loadSeq = 0;

  constructor(doc: Document = document, settings: SignalSettings = {}) {
    this.doc = doc;
    this.settings = settings;
    this.observer = new ProfileObserver(
      {
        onMount: (handle, header) => {
          this.currentHandle = handle;
          this.currentHeader = header;
          this.userInfoData = null;
          this.userInfoLoading = false;
          this.userInfoSettled = false;
          this.userInfoPartial = false;
          this.userInfoErrored = false;
          this.lastUserInfoAttemptAt = 0;
          this.loadSeq++;
          this.ensureAll(header);
        },
        onEnsure: (_handle, header) => {
          this.currentHeader = header;
          this.ensureAll(header);
        },
        onUnmount: () => this.teardownModules(),
      },
      doc,
    );
  }

  observe(target: Node = this.doc): void {
    this.observer.observe(target);
  }

  private ensureAll(header: HTMLElement): void {
    this.ensureUsernameHistory(header);
    this.ensureUserInfo();
  }

  private ensureUserInfo(): void {
    if (!isEnabled(this.settings, 'profile.userInfo')) return;

    if (!this.userInfoData) {
      if (
        this.userInfoErrored &&
        Date.now() - this.lastUserInfoAttemptAt < USER_INFO_PARTIAL_POKE_MS
      ) {
        return;
      }
      this.loadUserInfo();
      return;
    }

    if (
      this.userInfoPartial &&
      !this.userInfoSettled &&
      Date.now() - this.lastUserInfoAttemptAt >= USER_INFO_PARTIAL_POKE_MS
    ) {
      this.loadUserInfo();
    }

    if (!this.userInfo?.root.isConnected) this.renderUserInfo();
  }

  private renderUserInfo(): void {
    if (!isEnabled(this.settings, 'profile.userInfo')) return;
    if (!this.userInfoData) return;

    const headerBlock = findProfileHeaderBlockAnchor(this.doc);
    const navAnchor = headerBlock ? null : findTabNavAnchor(this.doc);
    if (!headerBlock && !navAnchor) return;
    this.userInfo?.destroy();
    this.userInfo = null;
    const handle = createUserInfoModule(this.userInfoData);
    if (headerBlock) {
      headerBlock.insertAdjacentElement("afterend", handle.root);
    } else {
      navAnchor!.insertAdjacentElement("beforebegin", handle.root);
    }
    this.userInfo = handle;
  }

  private loadUserInfo(): void {
    if (this.userInfoLoading || this.userInfoSettled) return;
    const handle = this.currentHandle;
    if (!handle) return;
    this.userInfoLoading = true;
    this.lastUserInfoAttemptAt = Date.now();
    const seq = this.loadSeq;
    void loadUserInfoData(handle)
      .then((result) => {
        if (seq !== this.loadSeq) return;
        this.userInfoLoading = false;
        if (result.status === "ok") {
          const firstLoad = this.userInfoData === null;
          const healed = this.userInfoPartial && !result.partial;
          this.userInfoData = result.data;
          this.userInfoPartial = result.partial;
          this.userInfoErrored = false;

          this.userInfoSettled = !result.partial;

          if (firstLoad || healed) this.renderUserInfo();
        } else if (result.status === "empty") {

          this.userInfoSettled = true;
          this.userInfoErrored = false;
        } else if (result.status === "error") {

          this.userInfoErrored = true;
        }

      })
      .catch(() => {
        if (seq === this.loadSeq) this.userInfoLoading = false;
      });
  }

  private ensureUsernameHistory(header: HTMLElement): void {
    if (!isEnabled(this.settings, 'profile.usernameHistory')) return;
    const rows = getUsernameHistory();
    if (rows.length === 0) return;
    if (this.usernameHistory?.root.isConnected) return;
    this.usernameHistory?.destroy();
    this.usernameHistory = null;

    const anchor = findHandleAnchor(header);
    if (!anchor) return;
    const handle = createUsernameHistory(rows);
    anchor.append(handle.root);
    this.usernameHistory = handle;
  }

  private teardownModules(): void {
    this.usernameHistory?.destroy();
    this.usernameHistory = null;
    this.userInfo?.destroy();
    this.userInfo = null;
    this.userInfoData = null;
    this.userInfoLoading = false;
    this.userInfoSettled = false;
    this.userInfoPartial = false;
    this.userInfoErrored = false;
    this.lastUserInfoAttemptAt = 0;
    this.loadSeq++;
    this.currentHandle = null;
    this.currentHeader = null;
  }

  applySettings(next: SignalSettings): void {
    this.settings = next;

    if (!isEnabled(next, 'profile.usernameHistory')) {
      this.usernameHistory?.destroy();
      this.usernameHistory = null;
    } else if (this.currentHeader) {
      this.ensureUsernameHistory(this.currentHeader);
    }

    if (!isEnabled(next, 'profile.userInfo')) {
      this.userInfo?.destroy();
      this.userInfo = null;
    } else if (this.currentHandle) {
      this.ensureUserInfo();
    }
  }

  cleanup(): void {
    this.teardownModules();
    this.observer.cleanup();
  }
}
