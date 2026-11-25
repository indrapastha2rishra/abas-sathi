import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActiveGalleryEvents,
  filterActiveNotices,
  sortOwnershipOutstandingByFlatAsc,
} from './dashboardHelpers';
import type { GalleryMaster, GalleryPhoto, NoticeMaster } from '../types/database';

test('sortOwnershipOutstandingByFlatAsc sorts naturally by Flat_No ascending', () => {
  const rows = [
    { Ownership_ID: 'O3', Flat_No: 'B-201', Ownership_Start_Date: '2024-01-01' },
    { Ownership_ID: 'O2', Flat_No: 'A-102', Ownership_Start_Date: '2024-01-01' },
    { Ownership_ID: 'O4', Flat_No: 'A-10', Ownership_Start_Date: '2024-01-01' },
    { Ownership_ID: 'O1', Flat_No: 'A-2', Ownership_Start_Date: '2024-01-01' },
    { Ownership_ID: 'O5', Flat_No: 'A-101', Ownership_Start_Date: '2025-01-01' },
    { Ownership_ID: 'O0', Flat_No: 'A-101', Ownership_Start_Date: '2023-01-01' },
  ];

  const sorted = sortOwnershipOutstandingByFlatAsc(rows);
  assert.deepEqual(
    sorted.map((r) => `${r.Flat_No}:${r.Ownership_ID}`),
    ['A-2:O1', 'A-10:O4', 'A-101:O0', 'A-101:O5', 'A-102:O2', 'B-201:O3']
  );
});

test('filterActiveNotices supports Published/Active statuses and various date formats', () => {
  const notices: NoticeMaster[] = [
    {
      Notice_ID: 'N1',
      Notice_Number: 'NOT-1',
      Notice_Title: 'Older Active Notice',
      Notice_Category: 'General',
      Notice_Description: 'Details 1',
      Publish_Date: '01/04/2026',
      Expiry_Date: '31/12/2026',
      Attachment: '',
      Visibility: 'All',
      Notice_Status: 'Active' as any,
      Created_By: 'Admin',
      Created_At: '2026-04-01',
    },
    {
      Notice_ID: 'N2',
      Notice_Number: 'NOT-2',
      Notice_Title: 'Latest Published Notice',
      Notice_Category: 'Meeting',
      Notice_Description: 'Details 2',
      Publish_Date: '2026-05-05T10:00:00Z',
      Expiry_Date: '2026-06-30',
      Attachment: '',
      Visibility: 'All',
      Notice_Status: 'Published',
      Created_By: 'Admin',
      Created_At: '2026-05-05',
    },
    {
      Notice_ID: 'N3',
      Notice_Number: 'NOT-3',
      Notice_Title: 'Expired Notice',
      Notice_Category: 'General',
      Notice_Description: 'Expired',
      Publish_Date: '2026-01-01',
      Expiry_Date: '2026-04-30',
      Attachment: '',
      Visibility: 'All',
      Notice_Status: 'Published',
      Created_By: 'Admin',
      Created_At: '2026-01-01',
    },
    {
      Notice_ID: 'N4',
      Notice_Number: 'NOT-4',
      Notice_Title: 'Draft Notice',
      Notice_Category: 'General',
      Notice_Description: 'Draft',
      Publish_Date: '2026-05-01',
      Expiry_Date: '2026-12-31',
      Attachment: '',
      Visibility: 'All',
      Notice_Status: 'Draft',
      Created_By: 'Admin',
      Created_At: '2026-05-01',
    },
  ];

  const active = filterActiveNotices(notices, '2026-05-10');
  assert.deepEqual(
    active.map((n) => n.Notice_ID),
    ['N2', 'N1']
  );
});

test('buildActiveGalleryEvents connects Gallery Master with Gallery_Photos in display order', () => {
  const gallery: GalleryMaster[] = [
    {
      Gallery_ID: 'GAL-1',
      Event_Name: 'Durga Puja 2026',
      Event_Date: '2026-10-15',
      Event_Description: 'Community Puja',
      Photo_File_Reference: 'https://example.com/cover.jpg',
      Visibility: 'Residents Only',
      Uploaded_By: 'Admin',
      Uploaded_At: '2026-10-16',
      Status: 'Active',
    },
    {
      Gallery_ID: 'GAL-2',
      Event_Name: 'Old Event',
      Event_Date: '2025-01-26',
      Event_Description: 'Archived',
      Photo_File_Reference: 'https://example.com/old.jpg',
      Visibility: 'Residents Only',
      Uploaded_By: 'Admin',
      Uploaded_At: '2025-01-27',
      Status: 'Archived',
    },
  ];

  const galleryPhotos: GalleryPhoto[] = [
    {
      Photo_ID: 'PHO-2',
      Gallery_ID: 'GAL-1',
      Photo_File_Reference: 'https://example.com/second.jpg',
      Photo_Caption: 'Evening Aarti',
      Display_Order: 2,
      Status: 'Active',
    },
    {
      Photo_ID: 'PHO-1',
      Gallery_ID: 'GAL-1',
      Photo_File_Reference: 'DRIVE-FILE-1',
      Photo_Caption: 'Pandal Inauguration',
      Display_Order: 1,
      Status: 'Active',
    },
    {
      Photo_ID: 'PHO-3',
      Gallery_ID: 'GAL-1',
      Photo_File_Reference: 'https://example.com/hidden.jpg',
      Photo_Caption: 'Hidden',
      Display_Order: 3,
      Status: 'Inactive',
    },
  ];

  const events = buildActiveGalleryEvents(gallery, galleryPhotos);
  assert.equal(events.length, 1);
  assert.equal(events[0].event.Gallery_ID, 'GAL-1');
  assert.deepEqual(
    events[0].photos.map((p) => p.photoId),
    ['GAL-1-cover', 'PHO-1', 'PHO-2']
  );
  assert.equal(events[0].photos[1].caption, 'Pandal Inauguration');
});
