import type { JSX } from 'solid-js';
import { Modal } from './Modal';

export function ActivityDataNoticeModal(props: { onClose: () => void }): JSX.Element {
  return (
    <Modal onClose={props.onClose} labelledBy="activity-data-notice-title">
      <h2 id="activity-data-notice-title" class="rf-dialog-title rf-notice-title">
        Activity Data Notice
      </h2>
      <div class="rf-notice-body">
        <p>
          Activity Insights measures your engagement to calculate your Activity Insights score and determine
          your eligibility for certain Kaito features and rewards. Agreeing to it is required to use Kaito
          Pulse, and you can turn it off at any time afterwards from the Activity Insights menu. While it is
          enabled, Kaito Pulse will collect information about your interactions with online content,
          including:
        </p>
        <ul>
          <li>post identifiers;</li>
          <li>impression timestamps and dwell time;</li>
          <li>
            click events (such as opening a detail view, outbound link, media or quoted content, or using
            engagement actions — liking or unliking, reposting or undoing a repost, replying, bookmarking, or
            removing a bookmark);
          </li>
          <li>
            which kind of page you were on (for example the home timeline, a profile, or search), viewport and
            scroll position;
          </li>
          <li>limited metadata (such as content type) necessary to validate impressions; and</li>
          <li>
            a device fingerprint — your browser and operating system, language, time zone, screen size, and a
            hash of how your device renders graphics and audio — used to tell one device apart from another
            when checking whether engagement is genuine. Once collected, a short hash of it is attached to the
            requests Kaito Pulse makes — including the ones described under "What happens whether or not
            Activity Insights is on" below. Turning Activity Insights off deletes it and stops sending it.
          </li>
        </ul>
        <p>Kaito uses this information to:</p>
        <ul>
          <li>calculate your Activity Insights;</li>
          <li>validate genuine engagement;</li>
          <li>determine campaign participation and rewards eligibility;</li>
          <li>detect fraudulent or abusive activity; and</li>
          <li>provide Activity Insights-related features within Kaito.</li>
        </ul>
        <p>
          Activity Insights data is collected only after you sign in and agree to it. You can disable Activity
          Insights at any time — collection stops immediately, and anything captured but not yet sent is
          discarded. Kaito Pulse does not collect:
        </p>
        <ul>
          <li>the full text of online posts;</li>
          <li>direct messages;</li>
          <li>search content or other user-entered content;</li>
          <li>cookies, authentication headers or session credentials; or</li>
          <li>
            your activity on sites other than the ones Kaito Pulse runs on, and the device fingerprint above
            is not used to track you across other sites.
          </li>
        </ul>
        <p>
          By selecting Enable Activity Insights, you consent to Kaito Pulse collecting and using this
          information for the purposes described above and in the Privacy Policy.
        </p>
        <h3 class="rf-notice-subtitle">What happens whether or not Activity Insights is on</h3>
        <p>
          One thing is worth stating plainly, because turning Activity Insights off does not turn it off.
        </p>
        <ul>
          <li>
            <strong>Displaying the extension's own features.</strong> While you are signed in, Kaito Pulse asks Kaito
            for the data it draws on X — name-tag badges, hover cards, ad flags and token charts. To do that it sends
            the account identifiers and post identifiers currently visible on your screen, together with your X
            account, and requests the ones you hover over. This is how those features are rendered at all, so it
            happens regardless of your Activity Insights setting. Sign out to stop it, or turn the individual
            features off in the extension's settings.
          </li>
        </ul>
      </div>
    </Modal>
  );
}
