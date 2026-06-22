import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Post, PostComment, Profile } from '../types';
import { Heart, MessageSquare, Send, RefreshCw, Plus, Image as ImageIcon, Loader2, User, Trophy, Camera, Sparkles, Share2, Video, StopCircle, Award, CheckCircle2, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SocialFeedProps {
  userId: string;
  profile: Profile | null;
}

export default function SocialFeed({ userId, profile }: SocialFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  // Comments state mapped by post ID
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  // Companion profile modal states
  const [selectedUserProfileId, setSelectedUserProfileId] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null);
  const [selectedUserJournal, setSelectedUserJournal] = useState<any[]>([]);
  const [loadingSelectedProfile, setLoadingSelectedProfile] = useState(false);

  const handleOpenCompanionProfile = async (profileId: string) => {
    setSelectedUserProfileId(profileId);
    setLoadingSelectedProfile(true);
    setSelectedUserProfile(null);
    setSelectedUserJournal([]);
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();

      if (profErr) throw profErr;
      if (prof) {
        setSelectedUserProfile(prof);

        const { data: jour, error: jourErr } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', profileId)
          .eq('is_private', false)
          .order('created_at', { ascending: false });

        if (!jourErr) {
          setSelectedUserJournal(jour || []);
        }
      }
    } catch (err) {
      console.error('Error fetching companion profile details:', err);
    } finally {
      setLoadingSelectedProfile(false);
    }
  };

  // Free-form / Media creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  
  // Media Attach Type: 'none' | 'photo' | 'video' | 'achievement'
  const [activeMediaTab, setActiveMediaTab] = useState<'none' | 'photo' | 'video' | 'achievement'>('none');
  
  // Photo states
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null);
  
  // Live camera workout video states
  const [recordingMode, setRecordingMode] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [countdown, setCountdown] = useState(30);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedVideoFile, setRecordedVideoFile] = useState<File | null>(null);
  
  // Achievement states
  const [selectedAchievement, setSelectedAchievement] = useState<{ kind: string; value: number } | null>(null);

  const [publishing, setPublishing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<any>(null);

  const fetchFeed = async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch posts joined with profiles
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            name,
            avatar_url
          )
        `)
        .or('is_deleted.eq.false,is_deleted.is.null')
        .or('is_flagged.eq.false,is_flagged.is.null')
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) throw error;
      setPosts(data || []);

      // Fetch User's Likes
      const { data: likesData, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', userId);

      if (!likesError && likesData) {
        setLikedPostIds(new Set(likesData.map(l => l.post_id)));
      }
    } catch (err) {
      console.error('Error fetching feed posts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchFeed();
    }
    return () => {
      stopCameraStream();
    };
  }, [userId]);

  // Handle Likes
  const handleLikeToggle = async (post: Post) => {
    const isLiked = likedPostIds.has(post.id);
    const updatedLikedPostIds = new Set(likedPostIds);

    if (isLiked) {
      updatedLikedPostIds.delete(post.id);
      setLikedPostIds(updatedLikedPostIds);
      setPosts(prev =>
        prev.map(p =>
          p.id === post.id ? { ...p, likes_count: Math.max(0, (p.likes_count || 1) - 1) } : p
        )
      );

      try {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', userId);
      } catch (err) {
        console.error('Error unliking post:', err);
      }
    } else {
      updatedLikedPostIds.add(post.id);
      setLikedPostIds(updatedLikedPostIds);
      setPosts(prev =>
        prev.map(p =>
          p.id === post.id ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p
        )
      );

      try {
        await supabase
          .from('post_likes')
          .insert({
            post_id: post.id,
            user_id: userId
          });

        if (post.user_id !== userId) {
          await supabase.from('notifications').insert({
            user_id: post.user_id,
            type: 'like',
            title: 'Your post was liked! ❤️',
            body: `${profile?.name || 'Someone'} liked your fitness broadcast on the Feed.`,
            is_read: false
          });
        }
      } catch (err) {
        console.error('Error liking post:', err);
      }
    }
  };

  // Handle Comments
  const fetchComments = async (postId: string) => {
    setLoadingComments(prev => ({ ...prev, [postId]: true }));
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          profiles:user_id (
            name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCommentsByPost(prev => ({ ...prev, [postId]: data || [] }));
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  const toggleComments = (postId: string) => {
    const isExpanded = !expandedComments[postId];
    setExpandedComments(prev => ({ ...prev, [postId]: isExpanded }));
    if (isExpanded) {
      fetchComments(postId);
    }
  };

  const handleAddComment = async (postId: string, authorId: string) => {
    const text = newCommentText[postId]?.trim();
    if (!text) return;

    setNewCommentText(prev => ({ ...prev, [postId]: '' }));

    const tempComment: PostComment = {
      id: Math.random().toString(),
      post_id: postId,
      user_id: userId,
      content: text,
      created_at: new Date().toISOString(),
      profiles: {
        name: profile?.name || 'You',
        avatar_url: profile?.avatar_url
      }
    };

    setCommentsByPost(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), tempComment]
    }));

    setPosts(prev =>
      prev.map(p =>
        p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
      )
    );

    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: userId,
          content: text
        });

      if (error) throw error;

      if (authorId !== userId) {
        await supabase.from('notifications').insert({
          user_id: authorId,
          type: 'comment',
          title: 'New Comment on post! 💬',
          body: `${profile?.name || 'Someone'} commented: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`,
          is_read: false
        });
      }

      fetchComments(postId);
    } catch (err) {
      console.error('Error adding comment to db:', err);
    }
  };

  // Image Selection Handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPostImage(file);
      setNewPostImagePreview(URL.createObjectURL(file));
    }
  };

  // Video File Upload Handler (for non-live route)
  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setRecordedVideoFile(file);
      setRecordedVideoUrl(URL.createObjectURL(file));
      setRecordingMode('preview');
    }
  };

  // Camera Live Video Recording Logic
  const startCamera = async () => {
    setRecordingMode('recording');
    setRecordedChunks([]);
    setCountdown(30);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      const recorderObj = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const chunks: Blob[] = [];
      recorderObj.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorderObj.onstop = () => {
        const finalBlob = new Blob(chunks, { type: 'video/mp4' });
        const linkUrl = URL.createObjectURL(finalBlob);
        setRecordedVideoUrl(linkUrl);
        setRecordedVideoFile(new File([finalBlob], `workout-${Date.now()}.mp4`, { type: 'video/mp4' }));
        setRecordingMode('preview');
      };

      recorderObj.start(1000);
      setMediaRecorder(recorderObj);

      // Countdown Timer (30 seconds maximum)
      let secondsLeft = 30;
      intervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        setCountdown(secondsLeft);
        if (secondsLeft <= 0) {
          stopRecordingLive(recorderObj, mediaStream);
        }
      }, 1000);

    } catch (err) {
      console.error('Error opening camera stream:', err);
      alert('Camera of microphone permissions were denied. Please upload an existing workout video clip instead!');
      setRecordingMode('idle');
    }
  };

  const stopRecordingLive = (activeRecorder?: MediaRecorder, activeStream?: MediaStream) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    const rec = activeRecorder || mediaRecorder;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }

    const st = activeStream || stream;
    if (st) {
      st.getTracks().forEach(tr => tr.stop());
    }
    setStream(null);
    setMediaRecorder(null);
  };

  const stopCameraStream = () => {
    stopRecordingLive();
  };

  const resetVideoRecording = () => {
    stopCameraStream();
    setRecordedVideoUrl(null);
    setRecordedVideoFile(null);
    setRecordingMode('idle');
    setCountdown(30);
  };

  // Submit / Publish Post
  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !newPostImage && !recordedVideoFile && activeMediaTab !== 'achievement') {
      return;
    }
    setPublishing(true);

    let mediaUrl = '';
    const fileToUpload = activeMediaTab === 'photo' ? newPostImage : (activeMediaTab === 'video' ? recordedVideoFile : null);

    try {
      if (fileToUpload) {
        const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, fileToUpload);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        mediaUrl = publicUrlData.publicUrl;
      }

      let payloadType: 'post' | 'completion' | 'achievement' = 'post';
      let payloadShareCard = null;

      if (activeMediaTab === 'achievement' && selectedAchievement) {
        payloadType = 'achievement';
        payloadShareCard = selectedAchievement;
      } else if (activeMediaTab === 'video') {
        payloadType = 'post';
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          post_type: payloadType,
          content: newPostContent || (activeMediaTab === 'achievement' ? 'I unlocked an athletic milestone on Fit21! 🏆' : 'Crushed another intense physical round today! 💪'),
          image_url: mediaUrl || undefined,
          video_url: activeMediaTab === 'video' ? mediaUrl : undefined,
          share_card_data: payloadShareCard || undefined
        });

      if (error) throw error;

      // Reset Modal States
      setNewPostContent('');
      setNewPostImage(null);
      setNewPostImagePreview(null);
      resetVideoRecording();
      setSelectedAchievement(null);
      setActiveMediaTab('none');
      setShowCreateModal(false);
      
      // Reload Food logs
      fetchFeed();
    } catch (err: any) {
      alert(`Error publishing post: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  // Native share utilizing navigator.share API
  const handleSharePost = async (post: Post) => {
    const authorName = post.profiles?.name || 'A Fit21 Champion';
    const postSnippet = post.content.substring(0, 80);
    const textMsg = `"${postSnippet}" - Check out this update by ${authorName} on Fit21 (Feel 21 Again)!\n\nJoin our workout circle: https://chat.whatsapp.com/DdQZz2IWdIw8JxwWRk8tuS`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Fit21 Progress Update',
          text: textMsg,
          url: window.location.origin
        });
      } catch (err) {
        console.log('Native sharing aborted or unavailable:', err);
      }
    } else {
      // Fallback copy
      try {
        await navigator.clipboard.writeText(`${textMsg}\n${window.location.origin}`);
        alert('Fit21 workout update shared to clipboard! Share directly into WhatsApp! 🎯🔥');
      } catch (err) {
        console.error('Clipboard copy writing error:', err);
      }
    }
  };

  return (
    <div className="relative max-w-2xl mx-auto space-y-6 pb-24">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span>Fit21 PWA Group Feed</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#00E87A]/10 text-[#00E87A]">
            Live Circle
          </span>
        </h3>
        <button
          id="btn-refresh-feed"
          onClick={() => fetchFeed(true)}
          disabled={refreshing || loading}
          className="p-2 rounded-xl text-neutral-400 hover:text-[#00E87A] hover:bg-neutral-900 border border-neutral-800 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#00E87A]' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Container */}
      {loading ? (
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-3xl p-16 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#00E87A] mx-auto mb-4" />
          <p className="text-sm font-medium text-neutral-400">Syncing community logs from cross-regions...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="border border-dashed border-neutral-850 p-12 text-center rounded-3xl">
          <Sparkles className="w-10 h-10 text-[#00E87A]/20 mx-auto mb-3" />
          <p className="text-md font-semibold text-neutral-300">Quiet in the gym today</p>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            Nobody has broadcasted any runs or challenges yet. Tap the button below to post!
          </p>
          <button
            id="start-broadcasting-btn"
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-neutral-800 text-white rounded-xl text-xs hover:bg-[#00E87A] hover:text-[#0A0A0A] transition font-bold"
          >
            Start Broadcasting
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => {
            const isLiked = likedPostIds.has(post.id);
            const profilesObj: any = post.profiles || {};
            const authorName = profilesObj.name || 'Fit21 Athlete';
            const avatarUrl = profilesObj.avatar_url;

            return (
              <motion.div
                key={post.id}
                layoutId={`post-${post.id}`}
                className="bg-[#121212] border border-neutral-850 rounded-3xl p-5 hover:border-neutral-750 transition-colors shadow-xl"
              >
                {/* Header info */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleOpenCompanionProfile(post.user_id)}>
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-neutral-700 overflow-hidden flex-shrink-0 flex items-center justify-center group-hover:border-[#00E87A] transition-colors">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={authorName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-5 h-5 text-neutral-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-white flex items-center gap-1.5 flex-wrap group-hover:text-[#00E87A] transition-colors">
                        {authorName}
                        {post.post_type === 'completion' && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-bold tracking-wider rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            <Trophy className="w-2.5 h-2.5 text-emerald-400" />
                            Goal Verified
                          </span>
                        )}
                        {post.post_type === 'achievement' && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-bold tracking-wider rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                            <Award className="w-2.5 h-2.5 text-purple-400" />
                            Elite Milestone
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        {post.created_at ? new Date(post.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Just now'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content text */}
                <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap break-words">
                  {post.content}
                </p>

                {/* Optional Custom Achievement Card */}
                {post.post_type === 'achievement' && post.share_card_data && (
                  <div className="mt-3.5 p-4 rounded-2xl bg-neutral-950 border border-neutral-850 flex items-center gap-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[#00E87A]/3 opacity-20 pointer-events-none" />
                    
                    {post.share_card_data.kind === 'streak' ? (
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center justify-center text-2xl">
                        🔥
                      </div>
                    ) : post.share_card_data.kind === 'completions' ? (
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-2xl">
                        🏆
                      </div>
                    ) : post.share_card_data.kind === 'pro' ? (
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex flex-col items-center justify-center text-2xl">
                        👑
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#00E87A]/10 border border-[#00E87A]/20 flex flex-col items-center justify-center text-2xl">
                        ⚡
                      </div>
                    )}

                    <div className="flex-1">
                      <p className="text-[9px] uppercase font-bold text-[#00E87A] tracking-widest">Milestone Lock</p>
                      <h5 className="text-xs font-black text-white mt-0.5">
                        {post.share_card_data.kind === 'streak' && `Active Habit Streak: ${post.share_card_data.value} Days 🔥`}
                        {post.share_card_data.kind === 'completions' && `Finished core challenges: ${post.share_card_data.value} workouts 🏆`}
                        {post.share_card_data.kind === 'pro' && `Active Fit21 Pro Circle unlocked! 👑`}
                      </h5>
                    </div>
                  </div>
                )}

                {/* Video Media Render */}
                {post.video_url && (
                  <div className="mt-3.5 rounded-2xl overflow-hidden border border-neutral-850 bg-neutral-950">
                    <video
                      src={post.video_url}
                      controls
                      playsInline
                      className="w-full h-auto max-h-[350px] object-contain mx-auto"
                    />
                  </div>
                )}

                {/* Optional Image Media Render (excluding video already showing as video_url) */}
                {post.image_url && !post.video_url && (
                  <div className="mt-3.5 rounded-2xl overflow-hidden border border-neutral-850 max-h-[350px] bg-neutral-950">
                    <img
                      src={post.image_url}
                      alt="Broadcast progress image"
                      className="w-full h-auto max-h-[350px] object-contain mx-auto"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* Actions Toolbar */}
                <div className="flex items-center gap-6 mt-4 pt-3.5 border-t border-neutral-850/60 text-sm">
                  <button
                    onClick={() => handleLikeToggle(post)}
                    className={`flex items-center gap-1.5 transition cursor-pointer ${
                      isLiked ? 'text-rose-500 font-extrabold' : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>{post.likes_count || 0}</span>
                  </button>

                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.comments_count || 0}</span>
                  </button>

                  <button
                    onClick={() => handleSharePost(post)}
                    className="flex items-center gap-1.5 text-neutral-500 hover:text-[#00E87A] transition ml-auto cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-xs">Share</span>
                  </button>
                </div>

                {/* Expanded comments section */}
                {expandedComments[post.id] && (
                  <div className="mt-4 pt-4 border-t border-neutral-850/60 space-y-3">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                      Comments Section
                    </label>

                    {loadingComments[post.id] && (!commentsByPost[post.id] || commentsByPost[post.id].length === 0) ? (
                      <div className="text-center text-xs text-neutral-500 py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-[#00E87A] mx-auto inline mr-2" />
                        Fetching comments...
                      </div>
                    ) : (commentsByPost[post.id] || []).length === 0 ? (
                      <p className="text-xs text-neutral-500 text-center py-2">No comments yet. Ignite the discussion!</p>
                    ) : (
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {(commentsByPost[post.id] || []).map(comment => {
                          const cProfiles: any = comment.profiles || {};
                          return (
                            <div key={comment.id} className="text-xs bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-850/40">
                              <p className="font-bold text-white flex items-center justify-between">
                                <span 
                                  className="hover:text-[#00E87A] cursor-pointer transition-colors"
                                  onClick={() => handleOpenCompanionProfile(comment.user_id)}
                                >
                                  {cProfiles.name || 'Fit21 Athlete'}
                                </span>
                                <span className="text-[9px] text-neutral-600">
                                  {comment.created_at ? new Date(comment.created_at).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric'
                                  }) : ''}
                                </span>
                              </p>
                              <p className="text-neutral-300 mt-1 leading-relaxed whitespace-pre-wrap">
                                {comment.content}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Comment Input Form */}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newCommentText[post.id] || ''}
                        onChange={e => setNewCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddComment(post.id, post.user_id);
                        }}
                        placeholder="Encourage champion's pace..."
                        className="flex-1 bg-neutral-900 border border-neutral-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00E87A]"
                      />
                      <button
                        onClick={() => handleAddComment(post.id, post.user_id)}
                        className="p-1.5 bg-[#00E87A] hover:bg-[#00c968] text-[#0A0A0A] rounded-xl self-end transition duration-150 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Floating Plus button */}
      <button
        id="social-fab-btn"
        onClick={() => {
          setShowCreateModal(true);
          setActiveMediaTab('none');
        }}
        className="fixed bottom-24 right-5 p-4 rounded-full bg-[#00E87A] text-[#0A0A0A] shadow-2xl hover:bg-[#00c968] hover:scale-105 active:scale-95 transition z-40 cursor-pointer"
        title="Add post to Feed"
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                stopCameraStream();
                setShowCreateModal(false);
              }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#00E87A]" />
                  Broadcast to Fit21 Feed
                </h4>
                <button
                  onClick={() => {
                    stopCameraStream();
                    setShowCreateModal(false);
                  }}
                  className="text-neutral-500 hover:text-white transition p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <textarea
                  id="create-post-content"
                  required
                  value={newPostContent}
                  onChange={e => setNewPostContent(e.target.value)}
                  placeholder="Share your current state, workout motivation, physical accomplishments, or diet hacks..."
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] resize-none"
                />

                {/* Media Selector Tabs */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Media Attachment Route
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => { resetVideoRecording(); setActiveMediaTab('none'); }}
                      className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        activeMediaTab === 'none'
                          ? 'bg-[#00E87A]/15 text-[#00E87A] border-[#00E87A]/30'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-850'
                      }`}
                    >
                      ✍️ Text Only
                    </button>
                    <button
                      type="button"
                      onClick={() => { resetVideoRecording(); setActiveMediaTab('photo'); }}
                      className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        activeMediaTab === 'photo'
                          ? 'bg-[#00E87A]/15 text-[#00E87A] border-[#00E87A]/30'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-850'
                      }`}
                    >
                      📷 Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => { resetVideoRecording(); setActiveMediaTab('video'); }}
                      className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        activeMediaTab === 'video'
                          ? 'bg-[#00E87A]/15 text-[#00E87A] border-[#00E87A]/30'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-850'
                      }`}
                    >
                      📹 Workout Video
                    </button>
                    <button
                      type="button"
                      onClick={() => { resetVideoRecording(); setActiveMediaTab('achievement'); }}
                      className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        activeMediaTab === 'achievement'
                          ? 'bg-[#00E87A]/15 text-[#00E87A] border-[#00E87A]/30'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-850'
                      }`}
                    >
                      🏆 Achievement
                    </button>
                  </div>
                </div>

                {/* Sub-panels depending on tab */}
                {activeMediaTab === 'photo' && (
                  <div className="p-4 bg-neutral-900 rounded-2xl border border-neutral-800">
                    <label className="block text-xs font-semibold text-neutral-400 mb-2">
                      Upload Fitness Snap
                    </label>
                    <div className="relative border border-dashed border-neutral-750 rounded-2xl p-4 text-center hover:border-[#00E87A]/40 transition bg-neutral-950/40">
                      <input
                        id="create-photo-input"
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                      />
                      {newPostImagePreview ? (
                        <div className="space-y-2">
                          <img
                            src={newPostImagePreview}
                            alt="Preview"
                            className="max-h-36 object-contain mx-auto rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setNewPostImage(null);
                              setNewPostImagePreview(null);
                            }}
                            className="text-xs text-rose-400 hover:underline relative z-20"
                          >
                            Remove Photo
                          </button>
                        </div>
                      ) : (
                        <div className="py-2">
                          <ImageIcon className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-neutral-300">Choose custom picture</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeMediaTab === 'video' && (
                  <div className="p-4 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-4">
                    <label className="block text-xs font-semibold text-neutral-400">
                      30-Second Workout Clip Capture
                    </label>

                    {recordingMode === 'idle' && (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="p-4 bg-[#00E87A]/10 text-[#00E87A] border border-[#00E87A]/20 hover:bg-[#00E87A]/20 rounded-2xl flex flex-col items-center justify-center gap-2 font-bold cursor-pointer transition"
                        >
                          <Camera className="w-6 h-6" />
                          <span>Record Live Camera</span>
                        </button>
                        <div className="relative p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-neutral-850 cursor-pointer transition">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoFileSelect}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          />
                          <Video className="w-6 h-6 text-neutral-400" />
                          <span className="text-xs text-neutral-300 font-bold">Upload Video File</span>
                        </div>
                      </div>
                    )}

                    {recordingMode === 'recording' && (
                      <div className="text-center space-y-3">
                        <div className="w-full h-44 bg-neutral-950 rounded-2xl overflow-hidden relative">
                          <video
                            ref={videoRef}
                            muted
                            playsInline
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                          {/* Recording watermark */}
                          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-red-600 text-white font-extrabold text-[9px] animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full" />
                            REC Live
                          </div>
                          {/* Timer circle inside frame */}
                          <div className="absolute bottom-2 right-2 flex items-center justify-center gap-1 px-3 py-1 bg-black/60 backdrop-blur rounded-full text-xs font-extrabold text-white">
                            Time Left: <span className="text-[#00E87A]">{countdown}s</span>
                          </div>
                        </div>

                        {/* Animated Voice Indicator mockup (Nigerian cellular optimized layout) */}
                        <div className="flex justify-center items-center gap-1 py-1">
                          <span className="text-[10px] text-neutral-500 mr-2 uppercase font-extrabold tracking-wider">Mic Level:</span>
                          {[1, 2, 3, 4, 3, 5, 2, 4, 1].map((val, idx) => (
                            <span
                              key={idx}
                              className="w-1 bg-[#00E87A] rounded-full transition-all duration-150"
                              style={{
                                height: `${val * 3}px`,
                                animationRef: 'pulse',
                                animation: 'pulse 1s infinite'
                              }}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => stopRecordingLive()}
                          className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-black rounded-xl flex items-center gap-2 mx-auto cursor-pointer transition"
                        >
                          <StopCircle className="w-4 h-4" />
                          Stop Recording & Generate
                        </button>
                      </div>
                    )}

                    {recordingMode === 'preview' && (
                      <div className="text-center space-y-3">
                        <div className="w-full h-44 bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-800">
                          <video
                            src={recordedVideoUrl || undefined}
                            controls
                            playsInline
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex gap-2 justify-center">
                          <button
                            type="button"
                            onClick={resetVideoRecording}
                            className="px-4 py-2 border border-neutral-800 text-neutral-400 hover:text-white rounded-xl text-xs font-bold"
                          >
                            Discard & Re-take
                          </button>
                          <div className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Workout Clip Locked
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeMediaTab === 'achievement' && (
                  <div className="p-4 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-3">
                    <label className="block text-xs font-semibold text-neutral-400">
                      Share Milestone Card on Feed
                    </label>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAchievement({ kind: 'streak', value: profile?.streak_count || 1 })}
                        className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition ${
                          selectedAchievement?.kind === 'streak'
                            ? 'bg-[#00E87A]/15 border-[#00E87A]/30 text-[#00E87A]'
                            : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🔥</span>
                          <div>
                            <span className="block text-xs font-extrabold text-white">Daily Habit Streak</span>
                            <span className="text-[10px] text-neutral-500">Current ongoing chain of markings</span>
                          </div>
                        </div>
                        <span className="text-sm font-black">{profile?.streak_count || 1} Days</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedAchievement({ kind: 'completions', value: profile?.total_challenges_completed || 0 })}
                        className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition ${
                          selectedAchievement?.kind === 'completions'
                            ? 'bg-[#00E87A]/15 border-[#00E87A]/30 text-[#00E87A]'
                            : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🏆</span>
                          <div>
                            <span className="block text-xs font-extrabold text-white">Verified Challenge completions</span>
                            <span className="text-[10px] text-neutral-500">Total core activities checked</span>
                          </div>
                        </div>
                        <span className="text-sm font-black">{profile?.total_challenges_completed || 0} Workouts</span>
                      </button>
                    </div>
                  </div>
                )}

                <button
                  id="create-post-submit-btn"
                  onClick={handleCreatePost}
                  disabled={publishing || (!newPostContent.trim() && !newPostImage && !recordedVideoFile && activeMediaTab !== 'achievement')}
                  className="w-full py-3 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-xl hover:bg-[#00c968] hover:shadow-[0_0_15px_rgba(0,232,122,0.3)] transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Broadcasting...
                    </>
                  ) : (
                    'Publish Post'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPANION PROFILE IN-DEPTH OVERLAY WITH PUBLIC JOURNAL VIEW */}
      <AnimatePresence>
        {selectedUserProfileId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUserProfileId(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto"
            >
              {loadingSelectedProfile ? (
                 <div className="text-center py-12">
                   <Loader2 className="w-8 h-8 animate-spin text-[#00E87A] mx-auto mb-3" />
                   <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Syncing Companion info...</p>
                 </div>
              ) : selectedUserProfile ? (
                <div className="space-y-6">
                  {/* Close trigger header */}
                  <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
                    <span className="text-xs font-bold text-[#00E87A] uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Athlete Profile card
                    </span>
                    <button
                      onClick={() => setSelectedUserProfileId(null)}
                      className="text-neutral-500 hover:text-white transition p-1.5"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Profile avatar & Name */}
                  <div className="text-center space-y-2">
                    <div className="w-20 h-20 rounded-full bg-neutral-800 border-2 border-[#00E87A] overflow-hidden flex items-center justify-center mx-auto">
                      {selectedUserProfile.avatar_url ? (
                        <img src={selectedUserProfile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-10 h-10 text-neutral-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">{selectedUserProfile.name}</h4>
                      <p className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-wide">
                        {selectedUserProfile.state || 'Lagos'}, Nigeria
                      </p>
                    </div>
                    <p className="text-xs text-neutral-400 italic max-w-xs mx-auto">
                      "{selectedUserProfile.bio || 'Ready to build unstoppable fitness habits! Let\'s go! 🔥'}"
                    </p>
                  </div>

                  {/* Stats dashboard container */}
                  <div className="grid grid-cols-3 gap-2.5 bg-neutral-950 p-4 rounded-2xl text-center border border-neutral-850">
                    <div className="space-y-0.5">
                      <Flame className="w-4 h-4 text-orange-400 mx-auto fill-orange-400/10" />
                      <span className="block text-md font-black text-white">{selectedUserProfile.streak_count || 0}</span>
                      <span className="block text-[8px] text-neutral-500 uppercase font-extrabold">Active Streak</span>
                    </div>
                    <div className="space-y-0.5 border-x border-neutral-850">
                      <Trophy className="w-4 h-4 text-amber-500 mx-auto" />
                      <span className="block text-md font-black text-white">{selectedUserProfile.longest_streak || 0}</span>
                      <span className="block text-[8px] text-neutral-500 uppercase font-extrabold">Longest Row</span>
                    </div>
                    <div className="space-y-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#00E87A] mx-auto" />
                      <span className="block text-md font-black text-white">{selectedUserProfile.total_challenges_completed || 0}</span>
                      <span className="block text-[8px] text-neutral-500 uppercase font-extrabold">Completions</span>
                    </div>
                  </div>

                  {/* Shared Public Journal of this user */}
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-850 pb-1.5 flex items-center justify-between">
                      <span>Public Habits Journal</span>
                      <span className="text-[10px] text-[#00E87A] font-black">{selectedUserJournal.length} entries</span>
                    </h5>

                    {selectedUserJournal.length === 0 ? (
                      <div className="p-8 text-center bg-neutral-950/40 rounded-2xl border border-neutral-850/60">
                        <p className="text-xs text-neutral-500 font-medium">This athlete has not made any entries public yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {selectedUserJournal.map(entry => (
                          <div key={entry.id} className="p-3 bg-neutral-950/80 border border-neutral-850 rounded-xl space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-[10px] text-neutral-400">
                              <span className="font-bold flex items-center gap-1">
                                <span>Mood:</span>
                                <span>{entry.mood === 'great' ? '🤩 Great' : entry.mood === 'good' ? '😊 Good' : entry.mood === 'okay' ? '😐 Okay' : entry.mood === 'bad' ? '😔 Bad' : '😫 Terrible'}</span>
                              </span>
                              <span className="text-neutral-500">
                                {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <p className="text-neutral-200 leading-relaxed break-words">{entry.content}</p>
                            <div className="flex items-center gap-1.5 text-[9px] text-[#00E87A] font-extrabold">
                              <span>🔋 Energy rate: {entry.energy_level}/10</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-400 text-center">Companion profile details unavailable.</p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
