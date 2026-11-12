/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Wrench,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  MessageSquare,
  Search,
  Filter,
  Check,
} from 'lucide-react';
import { ActivityRequestRegister } from '../../types/database';

export const ActivityRequestsView: React.FC = () => {
  const {
    activityRequests,
    createActivityRequest,
    updateActivityRequest,
    activeRole,
    currentUser,
    residentProperty,
    uploadPrivateFile,
    t,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ActivityRequestRegister | null>(null);

  // New Request Form
  const [category, setCategory] = useState<ActivityRequestRegister['Request_Category']>('Plumbing');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ActivityRequestRegister['Priority']>('Medium');
  const [attachmentFile, setAttachmentFile] = useState<File|null>(null);

  // Editing Form
  const [statusUpdate, setStatusUpdate] = useState<ActivityRequestRegister['Request_Status']>('In Progress');
  const [assignedTo, setAssignedTo] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
    const created = await createActivityRequest({ category, subject, description, priority });
    if (attachmentFile) {
      try { await uploadPrivateFile(attachmentFile, 'Activity Request Attachment', residentProperty?.PropertyID, undefined, 'activityRequests', created.Request_ID); }
      catch (uploadError:any) { window.alert(`Request ${created.Request_Number} was saved, but its attachment upload failed: ${uploadError?.message||'Unknown error'}. You can retry from Settings → Documents.`); }
    }
    setIsNewModalOpen(false);
    setSubject('');
    setDescription('');
    setAttachmentFile(null);
    } catch (error:any) { window.alert(error?.message || 'Request could not be saved.'); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;
    try {
    await updateActivityRequest(editingRequest.Request_ID, {
      Request_Status: statusUpdate, Assigned_To: assignedTo, Admin_Remarks: adminRemarks,
      Completion_Date: statusUpdate === 'Completed' ? new Date().toISOString().split('T')[0] : null,
      Completion_Proof: statusUpdate === 'Completed' ? null : null,
    });
    setEditingRequest(null);
    } catch (error:any) { window.alert(error?.message || 'Request update failed.'); }
  };

  // Filter requests
  const visibleRequests = activityRequests.filter((req) => {
    // If resident, only show own flat's requests
    if (activeRole === 'Resident' && req.PropertyID !== residentProperty?.PropertyID) {
      return false;
    }

    const matchesSearch =
      req.Subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.Request_Number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.Request_Category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      activeFilter === 'all'
        ? true
        : activeFilter === 'pending'
        ? req.Request_Status === 'Pending'
        : activeFilter === 'in_progress'
        ? req.Request_Status === 'In Progress'
        : req.Request_Status === 'Completed';

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E1D4] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <Wrench className="h-5 w-5 text-[#536B4D]" />
            {t.navActivityRequests} / সার্ভিস রিকোয়েস্ট
          </h1>
          <p className="text-xs text-gray-500">
            Maintenance ticketing, vendor assignments, and resident resolution tracking
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[#536B4D] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#3F523A] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Raise New Request</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-[#E8E1D4] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets by subject, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] pl-9 pr-3 py-2 text-xs text-[#29352D] focus:border-[#536B4D] focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap gap-1 bg-[#F7F4EC] p-1 rounded-xl border border-[#E8E1D4]">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeFilter === 'all' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70'
            }`}
          >
            All Tickets ({activityRequests.length})
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeFilter === 'pending' ? 'bg-white text-red-700 shadow-xs' : 'text-[#29352D]/70'
            }`}
          >
            Pending ({activityRequests.filter((r) => r.Request_Status === 'Pending').length})
          </button>
          <button
            onClick={() => setActiveFilter('in_progress')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeFilter === 'in_progress' ? 'bg-white text-blue-700 shadow-xs' : 'text-[#29352D]/70'
            }`}
          >
            In Progress ({activityRequests.filter((r) => r.Request_Status === 'In Progress').length})
          </button>
          <button
            onClick={() => setActiveFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeFilter === 'completed' ? 'bg-white text-emerald-700 shadow-xs' : 'text-[#29352D]/70'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {visibleRequests.map((req) => (
          <div
            key={req.Request_ID}
            className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs hover:border-[#536B4D]/50 transition-all space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8E1D4] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-xs text-[#29352D] bg-[#F7F4EC] px-2.5 py-1 rounded-md border border-[#E8E1D4]">
                  {req.Request_Number}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D]">
                  {req.Request_Category}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    req.Priority === 'Emergency'
                      ? 'bg-red-100 text-red-800'
                      : req.Priority === 'High'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  Priority: {req.Priority}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    req.Request_Status === 'Completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : req.Request_Status === 'In Progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {req.Request_Status}
                </span>
                {activeRole !== 'Resident' && (
                  <button
                    onClick={() => {
                      setEditingRequest(req);
                      setStatusUpdate(req.Request_Status);
                      setAssignedTo(req.Assigned_To);
                      setAdminRemarks(req.Admin_Remarks);
                    }}
                    className="px-3 py-1 rounded-lg bg-[#536B4D] text-white text-xs font-semibold hover:bg-[#3F523A] transition-colors cursor-pointer"
                  >
                    Manage
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#29352D]">{req.Subject}</h3>
              <p className="text-xs text-[#29352D]/80 mt-1 leading-relaxed">{req.Description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs text-gray-500 bg-[#F7F4EC] p-3 rounded-xl border border-[#E8E1D4]">
              <div>
                <span>Requested By:</span>
                <p className="font-semibold text-[#29352D]">{req.Requested_By}</p>
              </div>
              <div>
                <span>Assigned Technician:</span>
                <p className="font-semibold text-[#536B4D]">{req.Assigned_To || 'Unassigned'}</p>
              </div>
              <div>
                <span>Date Logged:</span>
                <p className="font-medium text-[#29352D]">{req.Request_Date}</p>
              </div>
            </div>

            {req.Admin_Remarks && (
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                <MessageSquare className="h-4 w-4 shrink-0 text-blue-700 mt-0.5" />
                <div>
                  <span className="font-bold">Committee Action Note: </span>
                  <span>{req.Admin_Remarks}</span>
                </div>
              </div>
            )}
          </div>
        ))}
        {visibleRequests.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-500 bg-white rounded-2xl border border-[#E8E1D4] italic">
            No activity requests found for this filter.
          </div>
        )}
      </div>

      {/* RAISE NEW REQUEST MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#E8E1D4] space-y-4 text-xs">
            <h3 className="text-base font-bold text-[#29352D] border-b border-[#E8E1D4] pb-2">
              Raise Maintenance Service Request / নতুন অভিযোগ বা রিকোয়েস্ট
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Category / বিভাগ:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                  >
                    <option value="Plumbing">Plumbing (প্লাম্বিং)</option>
                    <option value="Electrical">Electrical (বিদ্যুৎ)</option>
                    <option value="Lift/Elevator">Lift / Elevator (লিফট)</option>
                    <option value="Carpentry">Carpentry (কাঠের কাজ)</option>
                    <option value="Cleanliness">Cleanliness (পরিচ্ছন্নতা)</option>
                    <option value="Security">Security (নিরাপত্তা)</option>
                    <option value="Administrative">Administrative (সোসাইটি প্রশাসন)</option>
                    <option value="Other">Other (অন্যান্য)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Priority / অগ্রাধিকার:</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Subject / বিষয়:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Water dripping from bathroom shaft"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Detailed Description / বিস্তারিত বিবরণ:</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide details about the issue..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                ></textarea>
              </div>

              <div>
                <label className="block font-semibold mb-1">Photo Attachment (Optional):</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                />
                <p className="text-[10px] text-gray-500 mt-1">PDF/JPG/PNG up to 5 MB. The file is uploaded privately after the request is saved.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E1D4]">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E8E1D4] text-[#29352D] hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#536B4D] text-white font-bold hover:bg-[#3F523A]"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / MANAGE TICKET MODAL */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#E8E1D4] space-y-4 text-xs">
            <h3 className="text-base font-bold text-[#29352D] border-b border-[#E8E1D4] pb-2">
              Manage Ticket {editingRequest.Request_Number}
            </h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">Update Status:</label>
                <select
                  value={statusUpdate}
                  onChange={(e) => setStatusUpdate(e.target.value as any)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Assign Technician / Member:</label>
                <input
                  type="text"
                  placeholder="e.g. Biswas Plumber (9830112233)"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Committee Remarks / Action Taken:</label>
                <textarea
                  rows={3}
                  placeholder="Enter remarks visible to resident..."
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E1D4]">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="px-4 py-2 rounded-xl border border-[#E8E1D4] text-[#29352D] hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#536B4D] text-white font-bold hover:bg-[#3F523A]"
                >
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
