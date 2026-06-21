import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Post, PostComment, Profile } from '../types';
import { Heart, MessageSquare, Send, RefreshCw, Plus, Image as ImageIcon, Loader2, User, Trophy, Camera, Sparkles } from 'lucide-react';
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

  // Free-form post Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const fetchFeed = async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch posts joined with profiles
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

      // 2. Fetch User's Likes
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
  }, [userId]);

  const handleLikeToggle = async (post: Post) => {
    const isLiked = likedPostIds.has(post.id);
    const updatedLikedPostIds = new Set(likedPostIds);

    if (isLiked) {
      updatedLikedPostIds.delete(post.id);
      setLikedPostIds(updatedLikedPostIds);
      // Auto-decrement locally for instant response
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
      // Auto-increment locally for instant response
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

        // Submit comment/like notification to author of post
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

    // Reset textbox
    setNewCommentText(prev => ({ ...prev, [postId]: '' }));

    // Optimistic addition
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

      // Notify post author
      if (authorId !== userId) {
        await supabase.from('notifications').insert({
          user_id: authorId,
          type: 'comment',
          title: 'New Comment on post! 💬',
          body: `${profile?.name || 'Someone'} commented: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`,
          is_read: false
        });
      }

      fetchComments(postId); // reload correct list
    } catch (err) {
      console.error('Error adding comment to db:', err);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPostImage(file);
      setNewPostImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !newPostImage) return;
    setPublishing(true);

    let imageUrl = '';
    try {
      if (newPostImage) {
        // upload to 'post-images' bucket
        const fileExt = newPostImage.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, newPostImage);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          post_type: 'free_form',
          content: newPostContent,
          image_url: imageUrl || undefined,
          video_url: imageUrl || undefined,
        });

      if (error) throw error;

      // Reset
      setNewPostContent('');
      setNewPostImage(null);
      setNewPostImagePreview(null);
      setShowCreateModal(false);
      fetchFeed(); // reload
    } catch (err: any) {
      alert(`Error publishing post: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="relative max-w-2xl mx-auto space-y-6 pb-24">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span>WhatsApp & Fit21 Community Feed</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#00E87A]/10 text-[#00E87A]">
            Active
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
                className="bg-[#121212] border border-neutral-800 rounded-3xl p-5 hover:border-neutral-750 transition-colors"
              >
                {/* Header info */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-neutral-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
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
                      <p className="text-sm font-extrabold text-white flex items-center gap-1.5">
                        {authorName}
                        {post.post_type === 'completion' && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-bold tracking-wider rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            <Trophy className="w-2.5 h-2.5" />
                            Goal Verified
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

                {/* Optional Media */}
                {post.image_url && (
                  <div className="mt-3.5 rounded-2xl overflow-hidden border border-neutral-850 max-h-96 bg-neutral-950">
                    {post.image_url.match(/\.(mp4|mov|avi|webm)/i) || post.video_url?.includes('video') ? (
                      <video
                        src={post.image_url}
                        controls
                        className="w-full h-auto max-h-96 object-contain"
                        muted
                      />
                    ) : (
                      <img
                        src={post.image_url}
                        alt="Posted Media"
                        className="w-full h-auto max-h-96 object-contain mx-auto"
                        referrerPolicy="no-referrer"
                      />
                    )}
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
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>{post.likes_count || 0}</span>
                  </button>

                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition cursor-pointer"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>{post.comments_count || 0}</span>
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
                                <span>{cProfiles.name || 'Fit21 Athlete'}</span>
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
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00E87A]"
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

      {/* Floating Plus button on desktop/mobile for creation */}
      <button
        id="social-fab-btn"
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-24 right-6 p-4 rounded-full bg-[#00E87A] text-[#0A0A0A] shadow-2xl hover:bg-[#00c968] hover:scale-105 active:scale-95 transition z-45 cursor-pointer"
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
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#00E87A]" />
                  Broadcast to Fit21 Feed
                </h4>
                <button
                  onClick={() => setShowCreateModal(false)}
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
                  rows={4}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] resize-none"
                />

                {/* Optional Image */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Attach Image (Optional)
                  </label>

                  <div className="relative border border-dashed border-neutral-800 rounded-2xl p-4 text-center hover:border-[#00E87A]/40 transition bg-neutral-900/40">
                    <input
                      id="create-post-file"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    />
                    {newPostImagePreview ? (
                      <div className="space-y-2">
                        <img
                          src={newPostImagePreview}
                          alt="preview"
                          className="max-h-40 object-contain mx-auto rounded-xl"
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

                <button
                  id="create-post-submit-btn"
                  onClick={handleCreatePost}
                  disabled={publishing || (!newPostContent.trim() && !newPostImage)}
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
    </div>
  );
}
