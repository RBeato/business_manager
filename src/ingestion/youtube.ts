import { google } from 'googleapis';
import { getConfig, formatDate } from '../config/index.js';
import {
  getYouTubeTokens,
  upsertYouTubeToken,
  upsertDailyYouTubeMetrics,
  upsertYouTubeVideo,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext } from '../types/index.js';

function createOAuth2Client(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(clientId, clientSecret);
}

/** Parse ISO 8601 duration (PT1H2M3S) to seconds */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchYouTubeAnalytics(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  channelId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, Record<string, number>>> {
  const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });

  const response = await youtubeAnalytics.reports.query({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    dimensions: 'day',
    metrics: [
      'views',
      'estimatedMinutesWatched',
      'subscribersGained',
      'subscribersLost',
      'likes',
      'dislikes',
      'comments',
      'shares',
      'averageViewDuration',
      'averageViewPercentage',
    ].join(','),
    sort: 'day',
  });

  const headers = response.data.columnHeaders?.map(h => h.name!) || [];
  const rows = response.data.rows || [];

  const result: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const date = row[0] as string;
    const metrics: Record<string, number> = {};
    for (let i = 1; i < headers.length; i++) {
      metrics[headers[i]!] = (row[i] as number) || 0;
    }
    result[date] = metrics;
  }

  return result;
}

async function fetchChannelVideos(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  channelId: string
): Promise<Array<{
  videoId: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  isShort: boolean;
  views: number;
  likes: number;
  comments: number;
  thumbnailUrl: string;
}>> {
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  // Get uploads playlist ID
  const channelResponse = await youtube.channels.list({
    id: [channelId],
    part: ['contentDetails'],
  });

  const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    console.warn(`No uploads playlist found for channel ${channelId}`);
    return [];
  }

  // Fetch recent videos from uploads playlist (up to 50)
  const playlistResponse = await youtube.playlistItems.list({
    playlistId: uploadsPlaylistId,
    part: ['snippet'],
    maxResults: 50,
  });

  const videoIds = playlistResponse.data.items
    ?.map(item => item.snippet?.resourceId?.videoId)
    .filter((id): id is string => !!id) || [];

  if (videoIds.length === 0) return [];

  // Fetch video details in batches of 50
  const videos: Array<{
    videoId: string;
    title: string;
    publishedAt: string;
    durationSeconds: number;
    isShort: boolean;
    views: number;
    likes: number;
    comments: number;
    thumbnailUrl: string;
  }> = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const videoResponse = await youtube.videos.list({
      id: batch,
      part: ['snippet', 'contentDetails', 'statistics'],
    });

    for (const item of videoResponse.data.items || []) {
      const durationSeconds = parseDuration(item.contentDetails?.duration || 'PT0S');
      videos.push({
        videoId: item.id!,
        title: item.snippet?.title || 'Untitled',
        publishedAt: item.snippet?.publishedAt || '',
        durationSeconds,
        isShort: durationSeconds <= 60,
        views: parseInt(item.statistics?.viewCount || '0', 10),
        likes: parseInt(item.statistics?.likeCount || '0', 10),
        comments: parseInt(item.statistics?.commentCount || '0', 10),
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
      });
    }

    // Rate limit
    if (i + 50 < videoIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return videos;
}

async function fetchVideoAnalytics(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  channelId: string,
  videoIds: string[],
  startDate: string,
  endDate: string
): Promise<Record<string, {
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  averageViewPercentage: number;
}>> {
  const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });
  const result: Record<string, {
    estimatedMinutesWatched: number;
    averageViewDuration: number;
    averageViewPercentage: number;
  }> = {};

  // Fetch analytics per video (batch by filtering)
  // YouTube Analytics API supports video dimension for aggregate queries
  try {
    const response = await youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      dimensions: 'video',
      metrics: 'estimatedMinutesWatched,averageViewDuration,averageViewPercentage',
      filters: `video==${videoIds.join(',')}`,
      maxResults: 200,
      sort: '-estimatedMinutesWatched',
    });

    const rows = response.data.rows || [];
    for (const row of rows) {
      const videoId = row[0] as string;
      result[videoId] = {
        estimatedMinutesWatched: (row[1] as number) || 0,
        averageViewDuration: (row[2] as number) || 0,
        averageViewPercentage: (row[3] as number) || 0,
      };
    }
  } catch (error) {
    console.warn('Failed to fetch per-video analytics:', error);
  }

  return result;
}

export async function ingestYouTubeData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);

  if (!config.youtube) {
    return {
      success: true,
      source: 'youtube',
      date: dateStr,
      records_processed: 0,
      error: 'YouTube not configured',
    };
  }

  const tokens = await getYouTubeTokens();
  if (tokens.length === 0) {
    return {
      success: true,
      source: 'youtube',
      date: dateStr,
      records_processed: 0,
      error: 'No YouTube channels connected. Connect via dashboard.',
    };
  }

  const logId = await createIngestionLog({
    source: 'youtube',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  let recordsProcessed = 0;

  try {
    for (const token of tokens) {
      const oauth2Client = createOAuth2Client(config.youtube.clientId, config.youtube.clientSecret);
      oauth2Client.setCredentials({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expiry_date: new Date(token.token_expiry).getTime(),
      });

      // Persist refreshed tokens
      oauth2Client.on('tokens', async (newTokens) => {
        await upsertYouTubeToken({
          channel_id: token.channel_id,
          channel_title: token.channel_title,
          access_token: newTokens.access_token || token.access_token,
          refresh_token: newTokens.refresh_token || token.refresh_token,
          token_expiry: newTokens.expiry_date
            ? new Date(newTokens.expiry_date).toISOString()
            : token.token_expiry,
          scopes: token.scopes,
        });
      });

      // YouTube Analytics has 2-3 day data lag
      // Fetch last 30 days (API supports wide ranges; upsert handles dedup)
      const endDate = new Date(context.date);
      endDate.setDate(endDate.getDate() - 1);
      const startDate = new Date(context.date);
      startDate.setDate(startDate.getDate() - 30);

      const startStr = formatDate(startDate);
      const endStr = formatDate(endDate);

      console.log(`  Fetching YouTube Analytics for ${token.channel_title || token.channel_id} (${startStr} to ${endStr})...`);

      // Fetch daily channel metrics
      const dailyMetrics = await fetchYouTubeAnalytics(oauth2Client, token.channel_id, startStr, endStr);

      for (const [date, metrics] of Object.entries(dailyMetrics)) {
        await upsertDailyYouTubeMetrics({
          channel_id: token.channel_id,
          date,
          views: metrics.views || 0,
          estimated_minutes_watched: metrics.estimatedMinutesWatched || 0,
          subscribers_gained: metrics.subscribersGained || 0,
          subscribers_lost: metrics.subscribersLost || 0,
          net_subscribers: (metrics.subscribersGained || 0) - (metrics.subscribersLost || 0),
          likes: metrics.likes || 0,
          dislikes: metrics.dislikes || 0,
          comments: metrics.comments || 0,
          shares: metrics.shares || 0,
          average_view_duration_seconds: metrics.averageViewDuration || 0,
          average_view_percentage: metrics.averageViewPercentage || 0,
          impressions: 0,
          impressions_ctr: 0,
          card_click_rate: 0,
          raw_data: metrics,
        });
        recordsProcessed++;
      }

      // Fetch video catalog
      console.log(`  Fetching video catalog...`);
      const videos = await fetchChannelVideos(oauth2Client, token.channel_id);

      // Fetch per-video analytics (last 28 days for richer data)
      const analyticsStart = new Date(context.date);
      analyticsStart.setDate(analyticsStart.getDate() - 28);
      const videoIds = videos.map(v => v.videoId);

      let videoAnalytics: Record<string, {
        estimatedMinutesWatched: number;
        averageViewDuration: number;
        averageViewPercentage: number;
      }> = {};

      if (videoIds.length > 0) {
        videoAnalytics = await fetchVideoAnalytics(
          oauth2Client,
          token.channel_id,
          videoIds,
          formatDate(analyticsStart),
          endStr
        );
      }

      for (const video of videos) {
        const analytics = videoAnalytics[video.videoId];
        await upsertYouTubeVideo({
          channel_id: token.channel_id,
          video_id: video.videoId,
          title: video.title,
          published_at: video.publishedAt,
          duration_seconds: video.durationSeconds,
          is_short: video.isShort,
          views: video.views,
          likes: video.likes,
          comments: video.comments,
          estimated_minutes_watched: analytics?.estimatedMinutesWatched || 0,
          average_view_duration_seconds: analytics?.averageViewDuration || 0,
          average_view_percentage: analytics?.averageViewPercentage || 0,
          impressions: 0,
          impressions_ctr: 0,
          thumbnail_url: video.thumbnailUrl,
        });
        recordsProcessed++;
      }

      console.log(`  ✓ ${token.channel_title || token.channel_id}: ${Object.keys(dailyMetrics).length} daily records, ${videos.length} videos`);
    }

    await updateIngestionLog(logId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    });

    return {
      success: true,
      source: 'youtube',
      date: dateStr,
      records_processed: recordsProcessed,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`YouTube ingestion failed: ${errorMessage}`);

    await updateIngestionLog(logId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
      error_message: errorMessage,
    });

    return {
      success: false,
      source: 'youtube',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
