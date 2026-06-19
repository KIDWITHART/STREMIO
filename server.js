const express = require('express');
const cors = require('cors');
const path = require('path');
const ytpl = require('@distube/ytpl');

const app = express();
const PORT = process.env.PORT || 7000;

// Enable CORS for all routes (Stremio requirement)
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Default curated Assamese playlists (verified working IDs)
const DEFAULT_PLAYLISTS = [
  { id: 'PLMRKdK25AuPVpuoz-8lT2z6Q928WjTXt0', title: 'Top 50 Assamese Songs', thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500' },
  { id: 'PLGxMK_7yVMeW5XC-sMb5YWoVtvIRTc_w3', title: 'Zubeen Garg Hit Songs', thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500' },
  { id: 'PL_TLpJkYwAK4-4KKudcKepj8vCYgVhDZy', title: 'Papon Melody Collection', thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500' },
  { id: 'PLv5zZG1TjZ6L-TzCgMre3mVoeGQdPbq_A', title: 'Assamese Bihu Hits', thumbnail: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500' }
];

// Simple in-memory cache for playlists
const playlistCache = {};
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Helper: Extract playlist ID from a URL or return the input if it looks like an ID
function getCleanPlaylistId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  try {
    if (ytpl.validateID(trimmed)) {
      return trimmed;
    }
    const id = ytpl.getPlaylistID(trimmed);
    return id;
  } catch (err) {
    const match = trimmed.match(/[&?]list=([^&]+)/);
    if (match) return match[1];
    if (trimmed.startsWith('PL') && trimmed.length >= 18) return trimmed;
    return null;
  }
}

// Fetch playlist data with caching
async function getPlaylistData(playlistId) {
  const cached = playlistCache[playlistId];
  const now = Date.now();

  if (cached && (now - cached.fetchedAt < CACHE_TTL)) {
    return cached.data;
  }

  try {
    const playlist = await ytpl(playlistId, { limit: 100 });
    
    // Resolve thumbnail carefully (convert object to string url if needed)
    let thumbnail = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500';
    if (playlist.thumbnail) {
      thumbnail = playlist.thumbnail;
    } else if (playlist.bestThumbnail && playlist.bestThumbnail.url) {
      thumbnail = playlist.bestThumbnail.url;
    } else if (playlist.items && playlist.items.length > 0 && playlist.items[0].thumbnail) {
      thumbnail = playlist.items[0].thumbnail;
    }

    if (typeof thumbnail === 'object' && thumbnail !== null) {
      thumbnail = thumbnail.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500';
    }

    const data = {
      id: playlist.id,
      title: playlist.title,
      thumbnail: thumbnail,
      items: playlist.items.map(item => {
        let itemThumb = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500';
        if (item.thumbnail) itemThumb = item.thumbnail;
        else if (item.bestThumbnail && item.bestThumbnail.url) itemThumb = item.bestThumbnail.url;
        
        if (typeof itemThumb === 'object' && itemThumb !== null) {
          itemThumb = itemThumb.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500';
        }

        return {
          id: item.id,
          title: item.title,
          thumbnail: itemThumb
        };
      })
    };

    playlistCache[playlistId] = {
      fetchedAt: now,
      data: data
    };

    return data;
  } catch (err) {
    console.error(`Error fetching playlist ${playlistId}:`, err.message);
    if (cached) {
      console.log(`Using expired cache for ${playlistId}`);
      return cached.data;
    }
    const defaultMeta = DEFAULT_PLAYLISTS.find(p => p.id === playlistId);
    return {
      id: playlistId,
      title: defaultMeta ? defaultMeta.title : `YouTube Playlist (${playlistId.substring(0, 8)}...)`,
      thumbnail: defaultMeta ? defaultMeta.thumbnail : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500',
      items: []
    };
  }
}

// Parse configuration from request params
function parseConfig(configParam) {
  if (!configParam) {
    return {
      name: 'Assamese YouTube Songs',
      playlists: DEFAULT_PLAYLISTS.map(p => p.id)
    };
  }

  try {
    // Decodes base64url-safe config strings
    const base64 = configParam.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    
    if (parsed && Array.isArray(parsed.playlists)) {
      return {
        name: parsed.name || 'Assamese YouTube Songs',
        playlists: parsed.playlists
      };
    }
  } catch (e) {
    // Fail silently, fallback to parsing as comma-separated playlist IDs
  }

  // Fallback to comma-separated playlist IDs
  const playlists = configParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
  return {
    name: 'Assamese YouTube Songs',
    playlists: playlists
  };
}

// Build Stremio Manifest
function buildManifest(configParam) {
  const config = parseConfig(configParam);
  const isCustom = !!configParam;
  
  return {
    id: isCustom ? `org.assamesesongs.addon.${Buffer.from(configParam).toString('hex').substring(0, 16)}` : 'org.assamesesongs.addon',
    version: '1.0.0',
    name: config.name,
    description: isCustom 
      ? 'Your personalized Stremio playlist addon containing custom Assamese YouTube songs.'
      : 'Stream popular Assamese song playlists from YouTube natively on Stremio.',
    resources: ['catalog', 'meta', 'stream'],
    types: ['channel'],
    catalogs: [
      {
        type: 'channel',
        id: 'assamese_songs',
        name: 'Assamese Playlists'
      }
    ],
    idPrefixes: ['yt_as:']
  };
}

// ==========================================
// Stremio Addon API Routes
// ==========================================

// Manifest Endpoint
const handleManifest = (req, res) => {
  const config = req.params.config;
  res.json(buildManifest(config));
};
app.get('/manifest.json', handleManifest);
app.get('/:config/manifest.json', handleManifest);

// Catalog Endpoint
const handleCatalog = async (req, res) => {
  const { config, type, id } = req.params;

  if (type !== 'channel' || id !== 'assamese_songs') {
    return res.json({ metas: [] });
  }

  const configData = parseConfig(config);
  const playlistIds = configData.playlists;
  
  const playlistPromises = playlistIds.map(async (playlistId) => {
    try {
      return await getPlaylistData(playlistId);
    } catch (e) {
      return null;
    }
  });

  const playlists = await Promise.all(playlistPromises);
  const metas = playlists
    .filter(p => p !== null)
    .map(p => ({
      id: `yt_as:playlist:${p.id}`,
      type: 'channel',
      name: p.title,
      poster: p.thumbnail,
      background: p.thumbnail,
      description: `YouTube Playlist: ${p.title} (${p.items.length} songs)`
    }));

  res.json({ metas });
};
app.get('/catalog/:type/:id.json', handleCatalog);
app.get('/:config/catalog/:type/:id.json', handleCatalog);

// Meta Endpoint
const handleMeta = async (req, res) => {
  const { type, id } = req.params;

  if (!id.startsWith('yt_as:playlist:')) {
    return res.json({ meta: null });
  }

  const playlistId = id.replace('yt_as:playlist:', '');

  try {
    const playlist = await getPlaylistData(playlistId);
    
    const meta = {
      id: id,
      type: 'channel',
      name: playlist.title,
      poster: playlist.thumbnail,
      background: playlist.thumbnail,
      description: `YouTube Playlist containing ${playlist.items.length} songs.`,
      videos: playlist.items.map((item, index) => ({
        id: `yt_as:video:${item.id}`,
        title: item.title,
        thumbnail: item.thumbnail,
        released: new Date(Date.now() - index * 60000).toISOString()
      }))
    };

    res.json({ meta });
  } catch (err) {
    res.json({ meta: null });
  }
};
app.get('/meta/:type/:id.json', handleMeta);
app.get('/:config/meta/:type/:id.json', handleMeta);

// Stream Endpoint
const handleStream = (req, res) => {
  const { id } = req.params;

  if (!id.startsWith('yt_as:video:')) {
    return res.json({ streams: [] });
  }

  const videoId = id.replace('yt_as:video:', '');

  res.json({
    streams: [
      {
        ytId: videoId,
        title: 'Play on YouTube',
        name: 'YouTube Stream'
      }
    ]
  });
};
app.get('/stream/:type/:id.json', handleStream);
app.get('/:config/stream/:type/:id.json', handleStream);

// ==========================================
// Config Page Utility Routes
// ==========================================

// Validate and fetch metadata for a YouTube Playlist
app.get('/api/playlist-info', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Playlist URL/ID is required' });
  }

  const playlistId = getCleanPlaylistId(url);
  if (!playlistId) {
    return res.status(400).json({ error: 'Invalid YouTube playlist URL or ID' });
  }

  try {
    const playlist = await getPlaylistData(playlistId);
    res.json({
      id: playlist.id,
      title: playlist.title,
      thumbnail: playlist.thumbnail,
      songCount: playlist.items.length,
      previewSongs: playlist.items.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve playlist from YouTube. Ensure it is public.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Assamese Songs Stremio Addon listening on port ${PORT}`);
  console.log(`Landing Page: http://127.0.0.1:${PORT}`);
  console.log(`Addon Manifest: http://127.0.0.1:${PORT}/manifest.json`);
  console.log(`==================================================`);
});
