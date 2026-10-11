import { useEffect, useRef } from 'react';

type LeaveGameDialogProps = {
  active: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LeaveGameDialog({ active, onCancel, onConfirm }: LeaveGameDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

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
        onCancel();
      }}
    >
      <h2 id="leave-game-title">Leave game?</h2>
      <p id="leave-game-message">
        Are you sure you want to leave this game?
        {active && <><br />You may not be able to rejoin the current match.</>}
      </p>
      <div className="leave-game-dialog-actions">
        <button className="secondary" type="button" autoFocus onClick={onCancel}>Cancel</button>
        <button className="leave-game-confirm" type="button" onClick={onConfirm}>Leave game</button>
      </div>
    </dialog>
  );
}
