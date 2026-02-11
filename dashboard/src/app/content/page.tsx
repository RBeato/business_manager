'use client'

import { useEffect, useState, useCallback } from 'react'
import type { BlogPost, BlogTopic } from '@/lib/supabase'

type Website = 'healthopenpage' | 'meditnation' | 'riffroutine'
type PostStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected'

const WEBSITE_LABELS: Record<Website, string> = {
  healthopenpage: 'HOP',
  meditnation: 'MeditNation',
  riffroutine: 'RiffRoutine',
}

const WEBSITE_COLORS: Record<Website, string> = {
  healthopenpage: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  meditnation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  riffroutine: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
}

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  pending_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected',
}

// Omit content from list view
type PostSummary = Omit<BlogPost, 'content' | 'generation_prompt' | 'image_url' | 'ai_model' | 'scheduled_publish_date' | 'keywords'>

function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? (
        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ContentPage() {
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [topics, setTopics] = useState<BlogTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [filterWebsite, setFilterWebsite] = useState<Website | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<PostStatus | 'all'>('all')
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null)
  const [postLoading, setPostLoading] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [showGenerateMenu, setShowGenerateMenu] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showTopics, setShowTopics] = useState(false)

  const fetchPosts = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterWebsite !== 'all') params.set('website', filterWebsite)
    if (filterStatus !== 'all') params.set('status', filterStatus)

    const res = await fetch(`/api/content/posts?${params}`)
    if (res.ok) {
      const data = await res.json()
      setPosts(data)
    }
  }, [filterWebsite, filterStatus])

  const fetchTopics = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterWebsite !== 'all') params.set('website', filterWebsite)
    params.set('status', 'queued')

    const res = await fetch(`/api/content/topics?${params}`)
    if (res.ok) {
      const data = await res.json()
      setTopics(data)
    }
  }, [filterWebsite])

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([fetchPosts(), fetchTopics()])
      setLoading(false)
    }
    load()
  }, [fetchPosts, fetchTopics])

  // Load full post when selected
  useEffect(() => {
    if (!selectedPostId) {
      setSelectedPost(null)
      return
    }
    async function loadPost() {
      setPostLoading(true)
      const res = await fetch(`/api/content/posts/${selectedPostId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedPost(data)
        setReviewNotes(data.review_notes || '')
      }
      setPostLoading(false)
    }
    loadPost()
  }, [selectedPostId])

  async function handleGenerate(website: Website) {
    setGenerating(website)
    setShowGenerateMenu(false)
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website }),
      })
      if (res.ok) {
        await Promise.all([fetchPosts(), fetchTopics()])
      } else {
        const err = await res.json()
        alert(`Generation failed: ${err.error}`)
      }
    } catch (err) {
      alert(`Generation failed: ${err}`)
    } finally {
      setGenerating(null)
    }
  }

  async function handleAction(action: 'approved' | 'rejected') {
    if (!selectedPostId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/content/posts/${selectedPostId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, review_notes: reviewNotes }),
      })
      if (res.ok) {
        setSelectedPostId(null)
        setSelectedPost(null)
        setReviewNotes('')
        await Promise.all([fetchPosts(), fetchTopics()])
      } else {
        const err = await res.json()
        alert(`Action failed: ${err.error}`)
      }
    } catch (err) {
      alert(`Action failed: ${err}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Stats
  const totalPosts = posts.length
  const pendingCount = posts.filter(p => p.status === 'pending_review').length
  const publishedCount = posts.filter(p => p.status === 'published').length
  const avgScore = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + (p.seo_score || 0), 0) / posts.length)
    : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading content engine...</p>
        </div>
      </div>
    )
  }

  // Review modal
  if (selectedPostId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setSelectedPostId(null); setSelectedPost(null); setReviewNotes('') }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Review Post</h1>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8">
          {postLoading || !selectedPost ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Post metadata */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 break-words">{selectedPost.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">/{selectedPost.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${WEBSITE_COLORS[selectedPost.website]}`}>
                      {WEBSITE_LABELS[selectedPost.website]}
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${STATUS_COLORS[selectedPost.status]}`}>
                      {STATUS_LABELS[selectedPost.status]}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">SEO Score</p>
                    <p className={`text-lg font-bold ${
                      (selectedPost.seo_score || 0) >= 70 ? 'text-green-600 dark:text-green-400' :
                      (selectedPost.seo_score || 0) >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>{selectedPost.seo_score || 0}/100</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Word Count</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedPost.word_count?.toLocaleString() || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reading Time</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedPost.reading_time_minutes || '—'} min</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Target Keyword</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{selectedPost.target_keyword || '—'}</p>
                  </div>
                </div>

                {selectedPost.meta_description && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Meta Description</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">{selectedPost.meta_description}</p>
                  </div>
                )}

                {selectedPost.keywords && selectedPost.keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedPost.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{kw}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Content preview */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4">Content Preview</h3>
                <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
                  <MarkdownPreview content={selectedPost.content} />
                </div>
              </div>

              {/* Review actions */}
              {(selectedPost.status === 'pending_review' || selectedPost.status === 'draft') && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4">Review</h3>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add review notes (optional)..."
                    className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    rows={3}
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleAction('approved')}
                      disabled={actionLoading}
                      className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                    >
                      {actionLoading ? 'Saving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleAction('rejected')}
                      disabled={actionLoading}
                      className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                    >
                      {actionLoading ? 'Saving...' : 'Reject'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    )
  }

  // Main content list view
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Content Engine</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">AI Blog Generation & Review</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Generate button */}
              <div className="relative">
                <button
                  onClick={() => setShowGenerateMenu(!showGenerateMenu)}
                  disabled={generating !== null}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating ({WEBSITE_LABELS[generating as Website]})...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Generate Post
                    </>
                  )}
                </button>
                {showGenerateMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                    {(Object.keys(WEBSITE_LABELS) as Website[]).map(site => (
                      <button
                        key={site}
                        onClick={() => handleGenerate(site)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {WEBSITE_LABELS[site]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total Posts</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalPosts}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 uppercase">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{pendingCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-600 dark:text-green-400 uppercase">Published</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{publishedCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400 uppercase">Avg SEO Score</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{avgScore}/100</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          {/* Website filter */}
          <div className="flex overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-1">
            {(['all', 'healthopenpage', 'meditnation', 'riffroutine'] as const).map(site => (
              <button
                key={site}
                onClick={() => setFilterWebsite(site)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                  filterWebsite === site
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {site === 'all' ? 'All Sites' : WEBSITE_LABELS[site]}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-1">
            {(['all', 'pending_review', 'approved', 'published', 'rejected'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                  filterStatus === status
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {/* Posts grid */}
        {posts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {posts.map(post => (
              <button
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className="text-left bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${WEBSITE_COLORS[post.website]}`}>
                    {WEBSITE_LABELS[post.website]}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[post.status]}`}>
                    {STATUS_LABELS[post.status]}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2">{post.title}</h3>
                {post.meta_description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{post.meta_description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${
                      (post.seo_score || 0) >= 70 ? 'text-green-600 dark:text-green-400' :
                      (post.seo_score || 0) >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      SEO: {post.seo_score || 0}
                    </span>
                    <span>{post.word_count?.toLocaleString() || '—'} words</span>
                  </div>
                  <span>{formatDate(post.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-xl border border-gray-200 dark:border-gray-800 text-center mb-8">
            <p className="text-gray-500 dark:text-gray-400">No posts found.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Generate your first post using the button above, or adjust your filters.
            </p>
          </div>
        )}

        {/* Topic Queue */}
        <section>
          <button
            onClick={() => setShowTopics(!showTopics)}
            className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${showTopics ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Topic Queue ({topics.length} queued)
          </button>
          {showTopics && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
              {topics.length > 0 ? (
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Topic</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Website</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Keyword</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Volume</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Difficulty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {topics.map(topic => (
                      <tr key={topic.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate">{topic.topic}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${WEBSITE_COLORS[topic.website]}`}>
                            {WEBSITE_LABELS[topic.website]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{topic.target_keyword || '—'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                          {topic.search_volume?.toLocaleString() || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block w-6 h-6 leading-6 text-xs font-bold rounded-full ${
                            topic.priority >= 8 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            topic.priority >= 5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>{topic.priority}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400 capitalize">
                          {topic.difficulty || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No queued topics. Run <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">npm run content:seed</code> to populate.
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

/** Simple markdown-to-HTML renderer for content preview */
function MarkdownPreview({ content }: { content: string }) {
  const html = content
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-6 mb-3">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700 dark:text-gray-300">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700 dark:text-gray-300">$1</li>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p class="text-gray-700 dark:text-gray-300 mb-3">')
    // Single newlines within context
    .replace(/\n/g, '<br/>')

  return (
    <div
      className="text-gray-700 dark:text-gray-300"
      dangerouslySetInnerHTML={{ __html: `<p class="text-gray-700 dark:text-gray-300 mb-3">${html}</p>` }}
    />
  )
}
