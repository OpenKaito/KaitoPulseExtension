export function removePrimusInstallSideEffects(source: string): string {
  // Only the telemetry goes; the identity and the warm-up are load-bearing on a fresh install.
  const installBranch =
    /if\(([$\w]+)===chrome\.runtime\.OnInstalledReason\.INSTALL\)\{([$\w]+)\(\);([$\w]+)\(\{eventType:"EXTENSION_INSTALL",rawData:""\}\),([$\w]+)\(\{reqMethodName:"start"\}\)\}/g;
  const matches = [...source.matchAll(installBranch)];
  if (matches.length !== 1) {
    throw new Error('[primus] install privacy patch mismatch; review the vendor install handler');
  }
  // The install branch only runs on a fresh install, and the vendor's own
  // `if (!userInfo)` guard stops it re-running; a profile that loses `userInfo`
  // later has nothing to re-create it, so the same function is also published
  // for `ensurePrimusIdentity` to call on demand.
  const registration = 'chrome.runtime.onInstalled.addListener(';
  if (source.split(registration).length !== 2) {
    throw new Error('[primus] install listener mismatch; cannot expose identity initialization');
  }
  return source
    .replace(
      installBranch,
      'if($1===chrome.runtime.OnInstalledReason.INSTALL){$2();$4({reqMethodName:"start"})}',
    )
    .replace(
      registration,
      `globalThis.__kaitoInitializePrimusIdentity=${matches[0][2]};${registration}`,
    );
}
