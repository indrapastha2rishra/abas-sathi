/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GalleryMaster, GalleryPhoto, NoticeMaster } from '../types/database';
import { toReportDateKey } from './reportHelpers';

export interface OwnershipOutstandingRowLike {
  Ownership_ID?: string;
  Flat_No?: string;
  PropertyID?: string;
  Ownership_Start_Date?: string;
  [key: string]: unknown;
}

export function sortOwnershipOutstandingByFlatAsc<T extends OwnershipOutstandingRowLike>(rows: T[]): T[] {
  return [...(rows || [])].sort((a, b) => {
    const flatA = String(a.Flat_No || a.PropertyID || '').trim();
    const flatB = String(b.Flat_No || b.PropertyID || '').trim();
    const flatCmp = flatA.localeCompare(flatB, undefined, { numeric: true, sensitivity: 'base' });
    if (flatCmp !== 0) return flatCmp;
    const dateA = toReportDateKey(a.Ownership_Start_Date);
    const dateB = toReportDateKey(b.Ownership_Start_Date);
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return String(a.Ownership_ID || '').localeCompare(String(b.Ownership_ID || ''));
  });
}

export function filterActiveNotices(notices: NoticeMaster[], todayKey: string): NoticeMaster[] {
  return (notices || [])
    .filter((notice) => {
      const status = String(notice.Notice_Status || (notice as any).Status || '').trim().toLowerCase();
      const isActiveStatus = status === 'published' || status === 'active';
      if (!isActiveStatus) return false;
      const publish = toReportDateKey(notice.Publish_Date);
      const expiry = toReportDateKey(notice.Expiry_Date);
      return (!publish || publish <= todayKey) && (!expiry || expiry >= todayKey);
    })
    .sort((a, b) => toReportDateKey(b.Publish_Date).localeCompare(toReportDateKey(a.Publish_Date)));
}

export interface ActiveGalleryPhotoItem {
  photoId: string;
  ref: string;
  caption: string;
}

export interface ActiveGalleryEvent {
  event: GalleryMaster;
  photos: ActiveGalleryPhotoItem[];
}

export function extractPhotoReference(row: Record<string, any> | null | undefined): string {
  if (!row) return '';
  return String(
    row.Photo_File_Reference ||
      row.Photo_URL ||
      row.Image_URL ||
      row.Photo_File_ID ||
      row.Image_File_ID ||
      row.File_Reference ||
      row.Photo ||
      ''
  ).trim();
}

export function buildActiveGalleryEvents(
  gallery: GalleryMaster[],
  galleryPhotos: GalleryPhoto[] = []
): ActiveGalleryEvent[] {
  const photosByGalleryId = new Map<string, GalleryPhoto[]>();

  (galleryPhotos || []).forEach((photo) => {
    const gid = String(photo.Gallery_ID || '').trim();
    if (!gid) return;
    const status = String(photo.Status || '').trim().toLowerCase();
    if (status === 'inactive' || status === 'archived' || status === 'deleted') return;
    const ref = extractPhotoReference(photo as any);
    if (!ref) return;
    const existing = photosByGalleryId.get(gid) || [];
    existing.push(photo);
    photosByGalleryId.set(gid, existing);
  });

  return (gallery || [])
    .filter((item) => {
      const status = String(item.Status || '').trim().toLowerCase();
      return !status || status === 'active' || status === 'published';
    })
    .sort((a, b) => toReportDateKey(b.Event_Date).localeCompare(toReportDateKey(a.Event_Date)))
    .map((event) => {
      const gid = String(event.Gallery_ID || '').trim();
      const linkedRows = [...(photosByGalleryId.get(gid) || [])].sort((a, b) => {
        const orderA = Number(a.Display_Order ?? Number.MAX_SAFE_INTEGER);
        const orderB = Number(b.Display_Order ?? Number.MAX_SAFE_INTEGER);
        if (Number.isFinite(orderA) && Number.isFinite(orderB) && orderA !== orderB) {
          return orderA - orderB;
        }
        return String(a.Photo_ID || '').localeCompare(String(b.Photo_ID || ''));
      });

      const seenRefs = new Set<string>();
      const photos: ActiveGalleryPhotoItem[] = [];

      linkedRows.forEach((row, idx) => {
        const ref = extractPhotoReference(row as any);
        if (!ref || seenRefs.has(ref)) return;
        seenRefs.add(ref);
        photos.push({
          photoId: String(row.Photo_ID || `${gid}-photo-${idx}`),
          ref,
          caption: String(row.Photo_Caption || (row as any).Caption || (row as any).Title || '').trim(),
        });
      });

      const masterRef = extractPhotoReference(event as any);
      if (masterRef && !seenRefs.has(masterRef)) {
        seenRefs.add(masterRef);
        photos.unshift({
          photoId: `${gid}-cover`,
          ref: masterRef,
          caption: '',
        });
      }

      return { event, photos };
    });
}
