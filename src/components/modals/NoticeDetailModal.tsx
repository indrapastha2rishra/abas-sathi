/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Calendar, Download, FileText, X, AlertCircle } from 'lucide-react';
import { NoticeMaster } from '../../types/database';
import { formatDateDisplay } from '../../utils/dateFormat';

interface NoticeDetailModalProps {
  notice: NoticeMaster | null;
  onClose: () => void;
  onDownloadAttachment?: (fileId: string, fileName: string) => Promise<void> | void;
  downloadError?: string;
}

export const NoticeDetailModal: React.FC<NoticeDetailModalProps> = ({
  notice,
  onClose,
  onDownloadAttachment,
  downloadError,
}) => {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notice, onClose]);

  if (!notice) return null;

  const attachmentRef = String((notice as any).Attachment_File_ID || notice.Attachment || '').trim();

  const handleDownload = async () => {
    if (!attachmentRef || !onDownloadAttachment) return;
    setDownloading(true);
    try {
      await onDownloadAttachment(attachmentRef, notice.Notice_Title || 'notice-attachment');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-detail-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs no-print"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[#E8E1D4] bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-[#E8E1D4] bg-[#F7F4EC] px-6 py-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#536B4D]/15 text-[#536B4D]">
                {notice.Notice_Category || 'General'}
              </span>
              {notice.Notice_Number && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white border border-[#E8E1D4] text-gray-600">
                  {notice.Notice_Number}
                </span>
              )}
              {notice.Visibility && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white border border-[#E8E1D4] text-[#29352D]/80">
                  {notice.Visibility}
                </span>
              )}
            </div>
            <h2 id="notice-detail-modal-title" className="text-base md:text-lg font-bold text-[#29352D] break-words">
              {notice.Notice_Title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notice"
            className="shrink-0 rounded-lg p-1.5 text-[#29352D]/70 hover:bg-[#E8E1D4] hover:text-[#29352D] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dates & Issuer Strip */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E1D4] bg-white px-6 py-2.5 text-xs text-gray-600">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#536B4D]" />
              <span>
                Published: <strong className="text-[#29352D]">{formatDateDisplay(notice.Publish_Date, '—')}</strong>
              </span>
            </span>
            <span>
              Valid Till:{' '}
              <strong className="text-[#29352D]">
                {notice.Expiry_Date ? formatDateDisplay(notice.Expiry_Date, '—') : 'No Expiry'}
              </strong>
            </span>
          </div>
          {notice.Created_By && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
              <FileText className="h-3.5 w-3.5 text-[#536B4D]" />
              Issued by: <strong className="text-[#29352D]">{notice.Created_By}</strong>
            </span>
          )}
        </div>

        {/* Full Notice Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {downloadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          <div className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC]/50 p-4 md:p-5">
            <p className="text-sm leading-relaxed text-[#29352D] whitespace-pre-wrap break-words">
              {notice.Notice_Description || 'No detailed description provided.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E1D4] bg-[#F7F4EC]/70 px-6 py-3.5">
          <div>
            {attachmentRef && onDownloadAttachment && (
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#536B4D] px-4 py-2 text-xs font-bold text-white hover:bg-[#3F523A] transition-colors cursor-pointer disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                <span>{downloading ? 'Downloading…' : 'Download Circular'}</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E8E1D4] bg-white px-4 py-2 text-xs font-bold text-[#29352D] hover:bg-[#E8E1D4]/50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
