/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, Calendar, Image as ImageIcon, Download, Tag } from 'lucide-react';

export const ResidentNoticesView: React.FC = () => {
  const { notices, gallery, t } = useApp();

  return (
    <div className="space-y-8">
      {/* Notices Section */}
      <div className="space-y-4">
        <div className="border-b border-[#E8E1D4] pb-4">
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#536B4D]" />
            Community Notices / সোসাইটি নোটিশ বোর্ড
          </h1>
          <p className="text-xs text-gray-500">
            Important society circulars, maintenance schedules, and meeting notices
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notices.map((notice) => (
            <div
              key={notice.Notice_ID}
              className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D]">
                    {notice.Notice_Category}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">{notice.Notice_Number}</span>
                </div>
                <h3 className="text-sm font-bold text-[#29352D] mt-2">{notice.Notice_Title}</h3>
                <p className="text-xs text-[#29352D]/80 mt-1.5 leading-relaxed">
                  {notice.Notice_Description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#E8E1D4] flex items-center justify-between text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[#536B4D]" />
                  Published: {notice.Publish_Date}
                </span>
                {notice.Attachment && (
                  <span className="font-semibold text-[#536B4D] underline cursor-pointer">
                    {notice.Attachment}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gallery Section */}
      <div className="space-y-4">
        <div className="border-b border-[#E8E1D4] pb-3">
          <h2 className="text-lg font-bold text-[#29352D] flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-[#536B4D]" />
            Community Event Gallery / ছবি ও উৎসব
          </h2>
          <p className="text-xs text-gray-500">
            Glimpses of community celebrations, infrastructure drives, and festivals
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gallery.map((item) => (
            <div
              key={item.Gallery_ID}
              className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs group"
            >
              <div className="h-44 overflow-hidden relative">
                <img
                  src={item.Photo_File_Reference}
                  alt={item.Event_Name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] backdrop-blur-xs">
                  {item.Event_Date}
                </span>
              </div>
              <div className="p-4 space-y-1">
                <h3 className="font-bold text-xs text-[#29352D]">{item.Event_Name}</h3>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {item.Event_Description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
