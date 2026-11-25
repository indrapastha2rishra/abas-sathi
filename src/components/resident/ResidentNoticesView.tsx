/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import {
  filterResidentGalleryEvents,
  filterResidentNotices,
  normId,
  normText,
} from '../../utils/residentPortalHelpers';
import { Bell, Calendar, Image as ImageIcon, Search, RefreshCw, AlertCircle, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export const ResidentNoticesView: React.FC = () => {
  const {
    notices,
    gallery,
    galleryPhotos,
    ownerships,
    tenants,
    residentProperty,
    currentUser,
    getPrivateFile,
    refreshActiveData,
    isRefreshingData,
  } = useApp();

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const visibilityContext = useMemo(() => {
    const pid = residentProperty?.PropertyID || currentUser.PropertyID;
    const hasOwnership = (ownerships || []).some(
      (o) => normId(o.PropertyID) === normId(pid) && (!currentUser.Ownership_ID || normId(o.Ownership_ID) === normId(currentUser.Ownership_ID))
    );
    const hasActiveTenant = (tenants || []).some(
      (t) => normId(t.PropertyID) === normId(pid) && (!t.Status || normText(t.Status) === 'active' || normText(t.Status) === 'notice period')
    );
    return {
      isOwner: hasOwnership || !hasActiveTenant,
      isTenant: hasActiveTenant,
      propertyId: pid,
    };
  }, [residentProperty?.PropertyID, currentUser.PropertyID, currentUser.Ownership_ID, ownerships, tenants]);

  const activeNotices = useMemo(
    () => filterResidentNotices(notices, todayKey, visibilityContext),
    [notices, todayKey, visibilityContext]
  );
  const activeGalleryEvents = useMemo(
    () => filterResidentGalleryEvents(gallery, galleryPhotos),
    [gallery, galleryPhotos]
  );

  const [noticeSearch, setNoticeSearch] = useState('');
  const [noticeCategory, setNoticeCategory] = useState('All');
  const [errorMsg, setErrorMsg] = useState('');
  const [imageSources, setImageSources] = useState<Record<string, string>>({});
  const [selectedPhotoIdxByEvent, setSelectedPhotoIdxByEvent] = useState<Record<string, number>>({});
  const [lightboxState, setLightboxState] = useState<{ eventId: string; index: number } | null>(null);
  const attemptedRefsRef = useRef<Set<string>>(new Set());

  const noticeCategories = useMemo(() => {
    const set = new Set<string>(['All']);
    activeNotices.forEach((n) => {
      if (n.Notice_Category) set.add(String(n.Notice_Category).trim());
    });
    return Array.from(set);
  }, [activeNotices]);

  const filteredNotices = useMemo(
    () =>
      activeNotices.filter((n) => {
        const matchesCat = noticeCategory === 'All' || String(n.Notice_Category || '').trim() === noticeCategory;
        const q = noticeSearch.trim().toLowerCase();
        const matchesSearch =
          !q ||
          String(n.Notice_Title || '').toLowerCase().includes(q) ||
          String(n.Notice_Description || '').toLowerCase().includes(q) ||
          String(n.Notice_Number || '').toLowerCase().includes(q);
        return matchesCat && matchesSearch;
      }),
    [activeNotices, noticeCategory, noticeSearch]
  );

  useEffect(() => {
    let cancelled = false;
    const refsToLoad: string[] = [];
    const directUpdates: Record<string, string> = {};

    activeGalleryEvents.forEach(({ photos }) => {
      photos.forEach(({ ref }) => {
        if (!ref) return;
        if (/^(https?:\/\/|data:|blob:|\/)/i.test(ref)) {
          if (!imageSources[ref]) directUpdates[ref] = ref;
        } else if (!attemptedRefsRef.current.has(ref)) {
          attemptedRefsRef.current.add(ref);
          refsToLoad.push(ref);
        }
      });
    });

    if (Object.keys(directUpdates).length > 0 && !cancelled) {
      setImageSources((prev) => ({ ...prev, ...directUpdates }));
    }
    if (refsToLoad.length === 0) return () => { cancelled = true; };

    const load = async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        refsToLoad.map(async (ref) => {
          try {
            const r: any = await getPrivateFile(ref);
            if (r?.data?.base64 && r?.data?.mimeType) {
              next[ref] = `data:${r.data.mimeType};base64,${r.data.base64}`;
            }
          } catch {
            /* keep unavailable image placeholder */
          }
        })
      );
      if (!cancelled && Object.keys(next).length > 0) {
        setImageSources((prev) => ({ ...prev, ...next }));
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activeGalleryEvents]);

  const downloadAttachment = async (fileId: string, fileName: string) => {
    setErrorMsg('');
    if (/^https?:\/\//i.test(fileId)) {
      const a = document.createElement('a');
      a.href = fileId;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      return;
    }
    try {
      const r: any = await getPrivateFile(fileId);
      const bytes = Uint8Array.from(atob(r.data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: r.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || r.data.fileName || 'notice-attachment';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Attachment download failed or access was denied.');
    }
  };

  const activeLightboxEvent = lightboxState
    ? activeGalleryEvents.find((g) => g.event.Gallery_ID === lightboxState.eventId)
    : undefined;

  return (
    <div className="space-y-8">
      {/* Notices Section */}
      <div className="space-y-4">
        <div className="border-b border-[#E8E1D4] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#536B4D]" />
              Notices & Society Gallery / নোটিশ ও গ্যালারি
            </h1>
            <p className="text-xs text-gray-500">
              Live circulars from Notice Master and active events from Gallery Master & Gallery_Photos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#536B4D]/10 text-[#536B4D]">
              {activeNotices.length} Notices · {activeGalleryEvents.length} Events
            </span>
            <button
              type="button"
              onClick={() => void refreshActiveData()}
              disabled={isRefreshingData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E1D4] bg-white px-3 py-1.5 text-xs font-semibold text-[#536B4D] hover:bg-[#F7F4EC] cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingData ? 'animate-spin' : ''}`} />
              <span>{isRefreshingData ? 'Syncing…' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Notice Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-[#E8E1D4] shadow-2xs">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search notice title or details..."
              value={noticeSearch}
              onChange={(e) => setNoticeSearch(e.target.value)}
              className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] pl-8 pr-3 py-1.5 text-xs text-[#29352D]"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {noticeCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setNoticeCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  noticeCategory === cat ? 'bg-[#536B4D] text-white' : 'bg-[#F7F4EC] text-[#29352D]/80 hover:bg-[#E8E1D4]/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotices.length === 0 && (
            <p className="col-span-full text-xs text-gray-500 py-6 text-center bg-white rounded-2xl border border-[#E8E1D4]">
              No active notices matching your filter.
            </p>
          )}
          {filteredNotices.map((notice) => {
            const attachmentRef = String((notice as any).Attachment_File_ID || notice.Attachment || '').trim();
            return (
              <div
                key={notice.Notice_ID}
                className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D]">
                      {notice.Notice_Category}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{notice.Notice_Number || notice.Notice_ID}</span>
                  </div>
                  <h3 className="text-sm font-bold text-[#29352D] mt-2">{notice.Notice_Title}</h3>
                  <p className="text-xs text-[#29352D]/80 mt-1.5 leading-relaxed whitespace-pre-line">
                    {notice.Notice_Description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E8E1D4] flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[#536B4D]" />
                    Published: {formatDateDisplay(notice.Publish_Date, '—')}
                    {notice.Expiry_Date ? ` · Expires: ${formatDateDisplay(notice.Expiry_Date, '—')}` : ''}
                  </span>
                  {attachmentRef && (
                    <button
                      type="button"
                      onClick={() => void downloadAttachment(attachmentRef, notice.Notice_Title || 'notice-attachment')}
                      className="inline-flex items-center gap-1 font-semibold text-[#536B4D] hover:underline cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download Attachment</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gallery Section */}
      <div className="space-y-4">
        <div className="border-b border-[#E8E1D4] pb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#29352D] flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-[#536B4D]" />
              Active Gallery / সক্রিয় গ্যালারি
            </h2>
            <p className="text-xs text-gray-500">
              Click any photo to view full size. Powered by Gallery Master & Gallery_Photos.
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#536B4D]/10 text-[#536B4D]">
            {activeGalleryEvents.length} Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeGalleryEvents.length === 0 && (
            <p className="col-span-full text-xs text-gray-500 py-6 text-center bg-white rounded-2xl border border-[#E8E1D4]">
              No active gallery events at present.
            </p>
          )}
          {activeGalleryEvents.map(({ event, photos }) => {
            const rawIdx = selectedPhotoIdxByEvent[event.Gallery_ID] || 0;
            const activeIdx = photos.length > 0 ? Math.min(rawIdx, photos.length - 1) : 0;
            const currentPhoto = photos[activeIdx];
            const src = currentPhoto
              ? imageSources[currentPhoto.ref] || (/^(https?:\/\/|data:|blob:|\/)/i.test(currentPhoto.ref) ? currentPhoto.ref : '')
              : '';
            return (
              <div
                key={event.Gallery_ID}
                className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs group flex flex-col"
              >
                <div
                  onClick={() => photos.length > 0 && setLightboxState({ eventId: event.Gallery_ID, index: activeIdx })}
                  className={`h-44 overflow-hidden relative bg-[#F7F4EC] ${photos.length > 0 ? 'cursor-pointer' : ''}`}
                >
                  {src ? (
                    <img
                      src={src}
                      alt={currentPhoto?.caption || event.Event_Name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 text-xs gap-1">
                      <ImageIcon className="h-6 w-6 text-[#536B4D]/40" />
                      <span>{photos.length > 0 ? 'Loading photo…' : 'No photos attached'}</span>
                    </div>
                  )}
                  {photos.length > 0 && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px]">
                      {activeIdx + 1} / {photos.length}
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] backdrop-blur-xs">
                    {formatDateDisplay(event.Event_Date, '—')}
                  </span>
                </div>
                {photos.length > 1 && (
                  <div className="flex items-center gap-1.5 px-3 pt-2.5 overflow-x-auto">
                    {photos.map((photo, idx) => {
                      const thumbSrc =
                        imageSources[photo.ref] || (/^(https?:\/\/|data:|blob:|\/)/i.test(photo.ref) ? photo.ref : '');
                      return (
                        <button
                          key={photo.photoId}
                          type="button"
                          onClick={() =>
                            setSelectedPhotoIdxByEvent((prev) => ({
                              ...prev,
                              [event.Gallery_ID]: idx,
                            }))
                          }
                          aria-label={`View photo ${idx + 1} for ${event.Event_Name}`}
                          className={`h-10 w-12 shrink-0 rounded-md overflow-hidden border-2 cursor-pointer ${
                            idx === activeIdx ? 'border-[#536B4D]' : 'border-[#E8E1D4] opacity-75 hover:opacity-100'
                          }`}
                        >
                          {thumbSrc ? (
                            <img src={thumbSrc} alt={photo.caption || event.Event_Name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-[#F7F4EC] flex items-center justify-center">
                              <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="p-4 space-y-1">
                  <h3 className="font-bold text-xs text-[#29352D]">{event.Event_Name}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {currentPhoto?.caption || event.Event_Description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxState && activeLightboxEvent && activeLightboxEvent.photos.length > 0 && (() => {
        const photos = activeLightboxEvent.photos;
        const safeIdx = Math.min(Math.max(0, lightboxState.index), photos.length - 1);
        const photo = photos[safeIdx];
        const src = imageSources[photo.ref] || (/^(https?:\/\/|data:|blob:|\/)/i.test(photo.ref) ? photo.ref : '');
        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setLightboxState(null)}
          >
            <div
              className="relative max-w-3xl w-full rounded-2xl bg-white overflow-hidden shadow-2xl border border-[#E8E1D4]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E1D4] bg-[#F7F4EC]">
                <div>
                  <h3 className="text-sm font-bold text-[#29352D]">{activeLightboxEvent.event.Event_Name}</h3>
                  <p className="text-[11px] text-gray-500">
                    {formatDateDisplay(activeLightboxEvent.event.Event_Date, '—')} · Photo {safeIdx + 1} of {photos.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxState(null)}
                  className="rounded-lg p-1.5 text-gray-600 hover:bg-[#E8E1D4] cursor-pointer"
                  aria-label="Close lightbox"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative bg-black flex items-center justify-center max-h-[68vh] min-h-[280px]">
                {src ? (
                  <img src={src} alt={photo.caption || activeLightboxEvent.event.Event_Name} className="max-h-[68vh] w-auto object-contain" />
                ) : (
                  <div className="text-white/70 text-xs py-12">Loading photo…</div>
                )}
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxState({
                          eventId: lightboxState.eventId,
                          index: (safeIdx - 1 + photos.length) % photos.length,
                        })
                      }
                      aria-label="Previous photo"
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/80 text-white p-2 cursor-pointer"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxState({
                          eventId: lightboxState.eventId,
                          index: (safeIdx + 1) % photos.length,
                        })
                      }
                      aria-label="Next photo"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/80 text-white p-2 cursor-pointer"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              <div className="px-4 py-3 bg-white text-xs text-[#29352D]">
                {photo.caption || activeLightboxEvent.event.Event_Description}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
