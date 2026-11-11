import React, { useState } from 'react';
import { Btn, ErrorText, Field, Modal, Textarea } from './kit';

/** Dialog satu langkah dengan alasan/catatan (wajib atau opsional). */
export const ReasonModal: React.FC<{
  title: string;
  label: string;
  confirm: string;
  variant?: 'primary' | 'danger' | 'warning' | 'success';
  required?: boolean;
  hint?: React.ReactNode;
  onClose: () => void;
  onSubmit: (text: string) => { ok: boolean; error?: string };
}> = ({ title, label, confirm, variant = 'primary', required = true, hint, onClose, onSubmit }) => {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const go = () => {
    if (required && !text.trim()) return setErr(`${label} wajib diisi.`);
    const r = onSubmit(text.trim());
    if (!r.ok) setErr(r.error ?? 'Gagal');
    else onClose();
  };
  return (
    <Modal open title={title} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn variant={variant} onClick={go}>{confirm}</Btn></>}>
      {hint && <div className="text-sm text-slate-600">{hint}</div>}
      <Field label={label} required={required}>
        <Textarea autoFocus value={text} onChange={e => { setText(e.target.value); setErr(''); }} />
      </Field>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};
