import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { status, review_notes } = body

  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json(
      { error: 'Status must be "approved" or "rejected"' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .update({
      status,
      review_notes: review_notes || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If rejected, reset the linked topic back to queued
  if (status === 'rejected') {
    await supabase
      .from('blog_topics')
      .update({ status: 'queued', related_blog_post_id: null })
      .eq('related_blog_post_id', id)
  }

  return NextResponse.json(data)
}
