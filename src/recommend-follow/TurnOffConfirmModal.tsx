import type { JSX } from 'solid-js';
import { Modal } from './Modal';

export function TurnOffConfirmModal(props: { onCancel: () => void; onConfirm: () => void }): JSX.Element {
  return (
    <Modal onClose={props.onCancel} showCloseButton={false} labelledBy="rf-turnoff-title">
      <p class="rf-dialog-title" id="rf-turnoff-title">Turn off Activity Insights?</p>
      <p class="rf-dialog-body">
        You'll lose your current Activity Insights data, including your time on X and account recommendations.
        This action can't be undone.
      </p>
      <div class="rf-turnoff-actions">
        <button type="button" class="rf-turnoff-keep-btn" onClick={props.onCancel}>
          Keep Activity Insights
        </button>
        <button type="button" class="rf-turnoff-off-btn" onClick={props.onConfirm}>
          Turn Off
        </button>
      </div>
    </Modal>
  );
}
