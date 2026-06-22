import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { 
  Users, MessageSquare, Send, Plus, Loader2, Image as ImageIcon, 
  Trash2, LogOut, Shield, Compass, ChevronRight, UserMinus, Sparkles, User as UserIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GroupsTabProps {
  userId: string;
  profile: Profile | null;
}

interface Group {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  creator_id: string;
  created_at: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  profiles?: {
    name: string;
    avatar_url?: string;
  };
}

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  message: string;
  image_url?: string;
  created_at: string;
  profiles?: {
    name: string;
    avatar_url?: string;
  };
}

export default function GroupsTab({ userId, profile }: GroupsTabProps) {
  const [activeSegment, setActiveSegment] = useState<'my-groups' | 'discover'>('my-groups');
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [discoverGroups, setDiscoverGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create group modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupBio, setNewGroupBio] = useState('');
  const [newGroupAvatar, setNewGroupAvatar] = useState<File | null>(null);
  const [newGroupAvatarURL, setNewGroupAvatarURL] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Group chat focus states
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  
  // Chat input states
  const [inputMessage, setInputMessage] = useState('');
  const [msgImage, setMsgImage] = useState<File | null>(null);
  const [msgImageURL, setMsgImageURL] = useState<string | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  
  const bottomChatRef = useRef<HTMLDivElement | null>(null);

  // Realtime subscription channel ref
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (userId) {
      fetchMyGroups();
      fetchDiscoverGroups();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedGroupId) {
      fetchChatMessages(selectedGroupId);
      fetchGroupMembers(selectedGroupId);
      setupRealtimeChat(selectedGroupId);
    } else {
      // Clean up realtime subscription on exit or switch
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (bottomChatRef.current) {
      bottomChatRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchMyGroups = async () => {
    setLoading(true);
    try {
      // Query member rows
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      if (memberErr) throw memberErr;
      
      if (memberRows && memberRows.length > 0) {
        const groupIds = memberRows.map(row => row.group_id);
        const { data: groupsData, error: groupsErr } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);

        if (groupsErr) throw groupsErr;
        setMyGroups(groupsData || []);
      } else {
        setMyGroups([]);
      }
    } catch (err) {
      console.error('Error fetching my groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscoverGroups = async () => {
    try {
      // Query all public groups except those we are already a member of
      const { data: memberRows } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      const excludeIds = memberRows?.map(row => row.group_id) || [];

      let query = supabase.from('groups').select('*').limit(30);
      
      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDiscoverGroups(data || []);
    } catch (err) {
      console.error('Error looking up discoverable groups:', err);
    }
  };

  const fetchChatMessages = async (groupId: string) => {
    setLoadingChat(true);
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          *,
          profiles:user_id (
            name,
            avatar_url
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error getting group chat logs:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          profiles:user_id (
            name,
            avatar_url
          )
        `)
        .eq('group_id', groupId);

      if (error) throw error;
      setMembers(data || []);

      const userRow = data?.find(row => row.user_id === userId);
      setMyRole(userRow ? userRow.role : null);
    } catch (err) {
      console.error('Error getting member list:', err);
    }
  };

  const setupRealtimeChat = (groupId: string) => {
    // Unsubscribe from any previous channels
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`
        },
        async (payload) => {
          // Fetch creator details on the fly
          const { data: userProf } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', payload.new.user_id)
            .maybeSingle();

          const receivedMsg: GroupMessage = {
            id: payload.new.id,
            group_id: payload.new.group_id,
            user_id: payload.new.user_id,
            message: payload.new.message,
            image_url: payload.new.image_url,
            created_at: payload.new.created_at,
            profiles: {
              name: userProf?.name || 'Athletic Companion',
              avatar_url: userProf?.avatar_url
            }
          };

          setMessages(prev => {
            // Prevent duplicated inserts if we already added it optimistically
            if (prev.some(m => m.id === receivedMsg.id)) return prev;
            return [...prev, receivedMsg];
          });
        }
      )
      .subscribe();

    subscriptionRef.current = channel;
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !newGroupBio.trim()) return;
    setCreating(true);

    let avatarUrl = '';
    try {
      if (newGroupAvatar) {
        const fileExt = newGroupAvatar.name.split('.').pop() || 'jpg';
        const fileName = `${userId}-${Date.now()}-group.${fileExt}`;
        const filePath = `groups/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, newGroupAvatar);

        if (uploadError) throw uploadError;

        const { data: pubData } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        avatarUrl = pubData.publicUrl;
      }

      // 1. Create matching row in 'groups' table
      const { data: createdGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName,
          description: newGroupBio,
          creator_id: userId,
          avatar_url: avatarUrl || 'https://cdn-icons-png.flaticon.com/512/12563/12563330.png'
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. Add creator into member listings automatically as 'owner'
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: createdGroup.id,
          user_id: userId,
          role: 'owner'
        });

      if (memberError) throw memberError;

      // Clean modals
      setNewGroupName('');
      setNewGroupBio('');
      setNewGroupAvatar(null);
      setNewGroupAvatarURL(null);
      setShowCreateModal(false);

      // Refresh listings
      fetchMyGroups();
      fetchDiscoverGroups();
    } catch (err: any) {
      alert(`Conflict creating athletic team: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (group: Group) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: userId,
          role: 'member'
        });

      if (error) throw error;

      fetchMyGroups();
      fetchDiscoverGroups();
      // Auto-open group chat for visual feedback immediately
      setSelectedGroupId(group.id);
      setSelectedGroup(group);
    } catch (err: any) {
      alert(`Join registration failed: ${err.message}`);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && !msgImage) return;
    setSendingMsg(true);

    let imageUrl = '';
    const tempMsgId = `temp-${Date.now()}`;
    const rawMessageStr = inputMessage;

    // Reset textbox instantly for optimal tactile interaction
    setInputMessage('');

    try {
      if (msgImage) {
        const fileExt = msgImage.name.split('.').pop() || 'jpg';
        const fileName = `${userId}-${Date.now()}-chat.${fileExt}`;
        const filePath = `group-chat/${fileName}`;

        const { error: imgErr } = await supabase.storage
          .from('post-images')
          .upload(filePath, msgImage);

        if (imgErr) throw imgErr;

        const { data: pubData } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        imageUrl = pubData.publicUrl;
        setMsgImage(null);
        setMsgImageURL(null);
      }

      // Optimistic Addition so rendering feels immediate
      const optimisticMsg: GroupMessage = {
        id: tempMsgId,
        group_id: selectedGroupId!,
        user_id: userId,
        message: rawMessageStr,
        image_url: imageUrl || undefined,
        created_at: new Date().toISOString(),
        profiles: {
          name: profile?.name || 'You',
          avatar_url: profile?.avatar_url
        }
      };

      setMessages(prev => [...prev, optimisticMsg]);

      const { data: sentRow, error: dbErr } = await supabase
        .from('group_messages')
        .insert({
          group_id: selectedGroupId,
          user_id: userId,
          message: rawMessageStr,
          image_url: imageUrl || undefined
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      // Replace optimistic message item with standard database item
      setMessages(prev => prev.map(m => m.id === tempMsgId ? { ...sentRow, profiles: optimisticMsg.profiles } : m));

    } catch (err: any) {
      alert(`Log generation failed: ${err.message}`);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroupId) return;
    const isOwner = myRole === 'owner';

    let hasConfirmed = false;
    if (isOwner) {
      hasConfirmed = window.confirm(
        'Warning: You are currently declared as the Founder of this athletic team. Leaving will permanently dismiss you and remove your creator access. Are you 100% sure?'
      );
    } else {
      hasConfirmed = window.confirm('Are you sure you want to dismiss yourself from this team chat?');
    }

    if (!hasConfirmed) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', selectedGroupId)
        .eq('user_id', userId);

      if (error) throw error;

      setSelectedGroupId(null);
      setSelectedGroup(null);
      fetchMyGroups();
      fetchDiscoverGroups();
    } catch (err: any) {
      alert(`Dismissal failed: ${err.message}`);
    }
  };

  const handleKickMember = async (memberUserId: string, memberName: string) => {
    if (!selectedGroupId) return;
    const confirmKick = window.confirm(`Are you certain you wish to kick ${memberName} from this Fit21 workspace?`);
    if (!confirmKick) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', selectedGroupId)
        .eq('user_id', memberUserId);

      if (error) throw error;

      fetchGroupMembers(selectedGroupId);
    } catch (err: any) {
      alert(`Failed to expel companion: ${err.message}`);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewGroupAvatar(file);
      setNewGroupAvatarURL(URL.createObjectURL(file));
    }
  };

  const handleMsgImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMsgImage(file);
      setMsgImageURL(URL.createObjectURL(file));
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <AnimatePresence mode="wait">
        {!selectedGroupId ? (
          /* SECTION 1: GROUPS DIRECTORY AND DISCOVER TIERS */
          <motion.div
            key="groups-directory"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Nav Headers & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 border-b border-neutral-900 pb-1 w-full sm:w-auto">
                <button
                  onClick={() => setActiveSegment('my-groups')}
                  className={`px-4 py-2 text-sm font-extrabold transition relative cursor-pointer ${
                    activeSegment === 'my-groups' ? 'text-[#00E87A]' : 'text-neutral-500'
                  }`}
                >
                  My Workout Teams ({myGroups.length})
                  {activeSegment === 'my-groups' && (
                    <motion.div layoutId="nav-line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00E87A]" />
                  )}
                </button>
                <button
                  onClick={() => setActiveSegment('discover')}
                  className={`px-4 py-2 text-sm font-extrabold transition relative cursor-pointer ${
                    activeSegment === 'discover' ? 'text-[#00E87A]' : 'text-neutral-500'
                  }`}
                >
                  Discover Communities
                  {activeSegment === 'discover' && (
                    <motion.div layoutId="nav-line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00E87A]" />
                  )}
                </button>
              </div>

              <button
                id="btn-trigger-group-create"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-xl hover:bg-[#00c968] hover:shadow-[0_0_15px_rgba(0,232,122,0.3)] transition text-xs flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 text-[#0A0A0A] stroke-[3]" />
                Forge New Team
              </button>
            </div>

            {/* Display list based on segment */}
            {activeSegment === 'my-groups' ? (
              myGroups.length === 0 ? (
                <div className="border border-dashed border-neutral-850 p-12 text-center rounded-3xl min-h-[250px] flex flex-col justify-center items-center">
                  <Users className="w-10 h-10 text-neutral-600 mb-3" />
                  <h4 className="text-sm font-bold text-neutral-300">No workout circles joined</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    In peer groups, athletes enforce streaks natively! Tap the 'Discover Communities' segment above to find other runners or water lifters!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myGroups.map(group => (
                    <div
                      key={group.id}
                      onClick={() => { setSelectedGroupId(group.id); setSelectedGroup(group); }}
                      className="bg-[#121212] border border-neutral-850 hover:border-[#00E87A]/35 p-5 rounded-3xl hover:bg-neutral-900/60 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-neutral-850 border border-neutral-800 shrink-0">
                          <img
                            src={group.avatar_url}
                            alt={group.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-[#00E87A] transition-colors">{group.name}</h4>
                          <p className="text-xs text-neutral-400 mt-1 line-clamp-1 max-w-xs">{group.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-[#00E87A] group-hover:translate-x-1.5 transition" />
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* DISCOVER SEGMENT */
              discoverGroups.length === 0 ? (
                <div className="border border-dashed border-neutral-850 p-12 text-center rounded-3xl min-h-[250px] flex flex-col justify-center items-center">
                  <Compass className="w-10 h-10 text-neutral-600 mb-3" />
                  <h4 className="text-sm font-bold text-neutral-300">You are all-seeing!</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    You have joined all public fitness circles available in our area. Create your own group!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {discoverGroups.map(group => (
                    <div
                      key={group.id}
                      className="bg-[#121212] border border-neutral-850 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-neutral-850 border border-neutral-850 shrink-0">
                          <img
                            src={group.avatar_url}
                            alt={group.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white leading-tight">{group.name}</h4>
                          <p className="text-xs text-neutral-400 mt-1 line-clamp-2 max-w-xs">{group.description}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleJoinGroup(group)}
                        className="px-4 py-2 bg-neutral-800 text-white rounded-xl text-xs hover:bg-[#00E87A] hover:text-[#0A0A0A] hover:scale-105 active:scale-95 transition font-bold shrink-0 cursor-pointer text-center"
                      >
                        Join Team
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </motion.div>
        ) : (
          /* SECTION 2: INDEPENDENT ACTIONABLE TEAM CHAT INTERACTIVE SCREEN */
          <motion.div
            key="group-chat-screen"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left/Middle Chat column */}
            <div className="lg:col-span-2 flex flex-col h-[70vh] bg-neutral-950 border border-neutral-850 rounded-3xl overflow-hidden relative">
              {/* Chat Header */}
              <div className="p-4 bg-[#121212] border-b border-neutral-850 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedGroupId(null)}
                    className="p-1 px-2.5 rounded-lg border border-neutral-805 text-xs text-neutral-400 hover:text-white hover:bg-neutral-900 transition mr-1"
                  >
                    ← Back
                  </button>
                  <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0">
                    <img
                      src={selectedGroup?.avatar_url}
                      alt="Chat avatar"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white leading-tight">{selectedGroup?.name}</h3>
                    <p className="text-[10px] text-neutral-500 font-semibold uppercase">{members.length} Athletes</p>
                  </div>
                </div>

                <button
                  onClick={handleLeaveGroup}
                  className="p-2 border border-red-500/10 hover:border-red-500/40 text-red-400 bg-red-500/3 hover:bg-red-500/10 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer font-bold"
                  title="Leave Team"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span className="hidden sm:inline">Leave</span>
                </button>
              </div>

              {/* Message thread logs */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingChat && messages.length === 0 ? (
                  <div className="text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-[#00E87A] mx-auto mb-2" />
                    <p className="text-xs text-neutral-500">Buffering real-time logs...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-neutral-400">Silent team workspace</p>
                    <p className="text-[10px] text-neutral-600 mt-1">Let this squad know you are ready to break habit ceilings!</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.user_id === userId;
                    const cProf = msg.profiles || {};
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                      >
                        {/* Sender Avatar */}
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-neutral-800 overflow-hidden shrink-0 border border-neutral-750 flex items-center justify-center">
                            {cProf.avatar_url ? (
                              <img src={cProf.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <UserIcon className="w-3.5 h-3.5 text-neutral-500" />
                            )}
                          </div>
                        )}

                        {/* Text Block */}
                        <div>
                          {!isMe && (
                            <span className="text-[10px] text-neutral-500 font-bold block mb-0.5 ml-1">{cProf.name || 'Fit21 Companion'}</span>
                          )}
                          <div className={`p-3 rounded-2xl text-xs space-y-2 relative ${
                            isMe 
                              ? 'bg-[#00E87A] text-[#0A0A0A] font-medium rounded-tr-none' 
                              : 'bg-neutral-900 text-neutral-200 rounded-tl-none border border-neutral-850'
                          }`}>
                            {msg.image_url && (
                              <div className="rounded-xl overflow-hidden max-h-40 bg-neutral-950/20">
                                <img src={msg.image_url} alt="Attached" className="w-full h-auto max-h-40 object-cover" referrerPolicy="no-referrer" />
                              </div>
                            )}
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                          </div>
                          <span className={`text-[9px] text-neutral-600 mt-0.5 block ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                            {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomChatRef} />
              </div>

              {/* Chat panel typing dock */}
              <div className="p-4 bg-[#121212] border-t border-neutral-850 shrink-0 space-y-2">
                {/* Optional Message Image Preview */}
                {msgImageURL && (
                  <div className="inline-flex items-center gap-2 p-2 bg-neutral-950 rounded-xl relative border border-neutral-800">
                    <img src={msgImageURL} alt="Preview" className="w-10 h-10 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => { setMsgImage(null); setMsgImageURL(null); }}
                      className="p-1 text-rose-400 text-xs hover:underline font-bold"
                    >
                      Delete
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative p-2.5 bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 transition rounded-xl shrink-0 cursor-pointer flex items-center justify-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMsgImageSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <ImageIcon className="w-4 h-4 text-neutral-400" />
                  </div>

                  <input
                    type="text"
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                    placeholder="Message squad members live..."
                    className="flex-1 bg-neutral-950 border border-neutral-850 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-[#00E87A] focus:bg-neutral-950/70 py-2.5"
                  />

                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMsg || (!inputMessage.trim() && !msgImage)}
                    className="p-2.5 bg-[#00E87A] hover:bg-[#00c968] text-[#0A0A0A] rounded-xl transition duration-150 cursor-pointer disabled:opacity-50 shrink-0 mr-1"
                  >
                    {sendingMsg ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#0A0A0A]" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Group member list panel */}
            <div className="bg-[#121212] border border-neutral-850 p-5 rounded-3xl h-[70vh] flex flex-col justify-between overflow-hidden">
              <div className="space-y-4 overflow-y-auto flex-1">
                <div className="flex items-center justify-between border-b border-neutral-850 pb-2">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Active Members</h4>
                  <span className="text-xs text-[#00E87A] font-black">{members.length} / 50</span>
                </div>

                <div className="space-y-3">
                  {members.map(member => {
                    const cProf = member.profiles || {};
                    const isMe = member.user_id === userId;
                    const canKick = (myRole === 'owner' || myRole === 'admin') && member.role !== 'owner' && !isMe;
                    
                    return (
                      <div key={member.id} className="flex items-center justify-between bg-neutral-950/20 p-2.5 rounded-xl border border-neutral-850/40">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 border border-neutral-750 flex items-center justify-center">
                            {cProf.avatar_url ? (
                              <img src={cProf.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <UserIcon className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {cProf.name || 'Fit21 Athlete'} {isMe && '(You)'}
                            </span>
                            <span className="text-[9px] text-neutral-500 font-extrabold capitalize flex items-center gap-0.5 mt-0.5">
                              {member.role === 'owner' && <Shield className="w-2.5 h-2.5 text-amber-500 fill-amber-500/10" />}
                              {member.role === 'admin' && <Shield className="w-2.5 h-2.5 text-[#00E87A]" />}
                              {member.role}
                            </span>
                          </div>
                        </div>

                        {canKick && (
                          <button
                            onClick={() => handleKickMember(member.user_id, cProf.name || 'Athlete')}
                            className="p-1 px-1.5 border border-red-500/10 hover:border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-lg text-[9px] font-black flex items-center gap-0.5 transition cursor-pointer"
                            title="Expel athlete"
                          >
                            <UserMinus className="w-3 h-3 text-red-400" />
                            <span>Kick</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="pt-4 border-t border-neutral-850/60 text-center">
                <span className="text-[10px] text-neutral-600 font-bold block uppercase tracking-wider">Coach Supervised Workspace</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE GROUP MODAL CONTAINER */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl z-10 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#00E87A]" />
                  Forge Athletic Workspace
                </h4>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-neutral-500 hover:text-white transition p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Avatar upload */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2">
                    Team Badge Icon
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shrink-0 flex items-center justify-center">
                      {newGroupAvatarURL ? (
                        <img src={newGroupAvatarURL} alt="Preview badge" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-neutral-700" />
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <span className="p-2 border border-neutral-800 text-neutral-400 rounded-xl text-xs font-bold hover:bg-neutral-850 hover:text-white block">
                        Upload custom badge picture
                      </span>
                    </div>
                  </div>
                </div>

                {/* Team Name */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="e.g. Lagos City Marathon Guild, 6AM Water Lifters"
                    className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-850 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] transition text-sm"
                  />
                </div>

                {/* Bio Description */}
                <div>
                  <label className="block text-xs font-semibold text-[#00e87a] uppercase tracking-widest mb-1.5">
                    Gym manifesto / Mission
                  </label>
                  <textarea
                    value={newGroupBio}
                    onChange={e => setNewGroupBio(e.target.value)}
                    placeholder="Describe your collective limits..., what time habits are executed..."
                    rows={3}
                    className="w-full bg-neutral-950 border border-neutral-850 rounded-2xl p-4 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] resize-none"
                  />
                </div>

                <button
                  onClick={handleCreateGroup}
                  disabled={creating || !newGroupName.trim() || !newGroupBio.trim()}
                  className="w-full py-3 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-xl hover:bg-[#00c968] hover:shadow-[0_0_15px_rgba(0,232,122,0.3)] transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Forging Team Credentials...
                    </>
                  ) : (
                    'Publish & Joint Team Info'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
