import { useEffect, useRef } from 'react';

type LeaveGameDialogProps = {
  active: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LeaveGameDialog({ active, onCancel, onConfirm }: LeaveGameDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  function cancel() {
    // Close first so the Leave button is no longer inert when focus returns to it.
    dialog.current?.close();
    onCancel();
  }

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="leave-game-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-game-title"
      aria-describedby="leave-game-message"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2 id="leave-game-title">Leave game?</h2>
      <p id="leave-game-message">
        Are you sure you want to leave this game?
        {active && <><br />The game will pause. Your seat and cards will be saved so you can rejoin.</>}
      </p>
      <div className="leave-game-dialog-actions">
        <button className="secondary" type="button" autoFocus onClick={cancel}>Cancel</button>
        <button className="leave-game-confirm" type="button" onClick={onConfirm}>Leave game</button>
      </div>
    </dialog>
  );
}
