// Curated Playlists metadata (verified working IDs)
const CURATED_PLAYLISTS = [
  { id: 'PLMRKdK25AuPVpuoz-8lT2z6Q928WjTXt0', title: 'Top 50 Assamese Songs', author: 'Assamese Hits', thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500' },
  { id: 'PLGxMK_7yVMeW5XC-sMb5YWoVtvIRTc_w3', title: 'Zubeen Garg Hit Songs', author: 'Zubeen Garg Collection', thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500' },
  { id: 'PL_TLpJkYwAK4-4KKudcKepj8vCYgVhDZy', title: 'Papon Melody Collection', author: 'Papon Hits', thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500' },
  { id: 'PLv5zZG1TjZ6L-TzCgMre3mVoeGQdPbq_A', title: 'Assamese Bihu Hits', author: 'Bihu 2026 Collection', thumbnail: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500' }
];

// App State
let selectedPlaylists = [];
let activePreviewId = null;
let playlistPreviewsData = {}; // Cache for previewed playlists

// DOM Elements
const curatedListContainer = document.getElementById('curated-list');
const selectedPlaylistsContainer = document.getElementById('selected-playlists');
const selectedCountEl = document.getElementById('selected-count');
const addonNameInput = document.getElementById('addon-name');
const customUrlInput = document.getElementById('custom-playlist-url');
const addPlaylistBtn = document.getElementById('add-playlist-btn');
const valError = document.getElementById('validation-error');
const valErrorText = document.getElementById('error-text');
const valLoading = document.getElementById('validation-loading');
const installUrlInput = document.getElementById('install-url');
const copyUrlBtn = document.getElementById('copy-url-btn');
const stremioInstallBtn = document.getElementById('stremio-install-btn');
const previewContainer = document.getElementById('preview-container');

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  // Check if opened via file:// protocol
  checkFileProtocol();

  // Initialize state with all curated playlists selected
  selectedPlaylists = CURATED_PLAYLISTS.map(p => ({
    id: p.id,
    title: p.title,
    thumbnail: p.thumbnail,
    isCurated: true
  }));

  // Render lists
  renderCuratedPlaylists();
  renderSelectedPlaylists();
  updateUrls();

  // If there are playlists, preview the first one
  if (selectedPlaylists.length > 0) {
    previewPlaylist(selectedPlaylists[0].id);
  }

  // Event Listeners
  addonNameInput.addEventListener('input', updateUrls);
  addPlaylistBtn.addEventListener('click', handleAddCustomPlaylist);
  customUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddCustomPlaylist();
  });
  
  copyUrlBtn.addEventListener('click', handleCopyUrl);
  stremioInstallBtn.addEventListener('click', handleStremioInstall);
});

// Check if file:// protocol is used, and append a warning banner
function checkFileProtocol() {
  if (window.location.protocol === 'file:') {
    const banner = document.createElement('div');
    banner.className = 'warning-banner';
    banner.innerHTML = `
      <i class="fa-solid fa-circle-exclamation"></i>
      <span>You are running this configuration page directly from your filesystem. Manifest links below have defaulted to <strong>http://127.0.0.1:7000</strong>. Make sure your server is running.</span>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
  }
}

// Render the curated checklists
function renderCuratedPlaylists() {
  curatedListContainer.innerHTML = '';
  
  CURATED_PLAYLISTS.forEach(playlist => {
    const isSelected = selectedPlaylists.some(p => p.id === playlist.id);
    
    const div = document.createElement('div');
    div.className = `curated-item ${isSelected ? 'selected' : ''}`;
    div.dataset.id = playlist.id;
    
    div.innerHTML = `
      <img src="${playlist.thumbnail}" alt="${playlist.title}" class="item-thumb" />
      <div class="item-info">
        <div class="item-title">${playlist.title}</div>
        <div class="item-meta">${playlist.author}</div>
      </div>
      <div class="checkbox-custom">
        <i class="fa-solid fa-check"></i>
      </div>
    `;
    
    div.addEventListener('click', () => toggleCuratedPlaylist(playlist));
    curatedListContainer.appendChild(div);
  });
}

// Toggle selection of curated playlist
function toggleCuratedPlaylist(playlist) {
  const index = selectedPlaylists.findIndex(p => p.id === playlist.id);
  
  if (index > -1) {
    selectedPlaylists.splice(index, 1);
  } else {
    selectedPlaylists.push({
      id: playlist.id,
      title: playlist.title,
      thumbnail: playlist.thumbnail,
      isCurated: true
    });
  }
  
  renderCuratedPlaylists();
  renderSelectedPlaylists();
  updateUrls();

  if (index > -1 && activePreviewId === playlist.id) {
    if (selectedPlaylists.length > 0) {
      previewPlaylist(selectedPlaylists[0].id);
    } else {
      clearPreview();
    }
  } else if (index === -1) {
    previewPlaylist(playlist.id);
  }
}

// Render the active selected playlists
function renderSelectedPlaylists() {
  selectedCountEl.textContent = selectedPlaylists.length;
  
  if (selectedPlaylists.length === 0) {
    selectedPlaylistsContainer.innerHTML = `
      <p class="empty-list-msg">No playlists selected. Choose curated playlists or add a custom one to begin.</p>
    `;
    return;
  }
  
  selectedPlaylistsContainer.innerHTML = '';
  
  selectedPlaylists.forEach((playlist, index) => {
    const div = document.createElement('div');
    div.className = `selected-item ${activePreviewId === playlist.id ? 'highlight-border' : ''}`;
    div.style.cursor = 'pointer';
    
    div.innerHTML = `
      <div class="selected-item-drag"><i class="fa-solid fa-grip-vertical"></i></div>
      <div class="selected-item-title">${playlist.title}</div>
      <div class="selected-item-badge">${playlist.isCurated ? 'Curated' : 'Custom'}</div>
      <button class="selected-item-delete" title="Remove Playlist">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    `;
    
    div.addEventListener('click', (e) => {
      if (e.target.closest('.selected-item-delete')) return;
      previewPlaylist(playlist.id);
    });
    
    const deleteBtn = div.querySelector('.selected-item-delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removePlaylist(playlist.id);
    });
    
    selectedPlaylistsContainer.appendChild(div);
  });
}

// Remove playlist
function removePlaylist(id) {
  selectedPlaylists = selectedPlaylists.filter(p => p.id !== id);
  
  renderCuratedPlaylists();
  renderSelectedPlaylists();
  updateUrls();
  
  if (activePreviewId === id) {
    if (selectedPlaylists.length > 0) {
      previewPlaylist(selectedPlaylists[0].id);
    } else {
      clearPreview();
    }
  }
}

// Handle adding custom playlist
async function handleAddCustomPlaylist() {
  const url = customUrlInput.value.trim();
  if (!url) return;
  
  valError.style.display = 'none';
  valLoading.style.display = 'flex';
  addPlaylistBtn.disabled = true;
  
  const isAlreadyAdded = selectedPlaylists.some(p => p.id === url || p.id.toLowerCase() === url.toLowerCase());
  if (isAlreadyAdded) {
    showError('This playlist has already been added.');
    return;
  }

  // Get active origin (with file fallback to 127.0.0.1)
  let origin = window.location.origin;
  if (!origin || origin === 'null' || origin.startsWith('file:')) {
    origin = 'http://127.0.0.1:7000';
  }
  
  try {
    const response = await fetch(`${origin}/api/playlist-info?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch playlist.');
    }
    
    const newPlaylist = {
      id: data.id,
      title: data.title,
      thumbnail: data.thumbnail,
      isCurated: false,
      songCount: data.songCount
    };
    
    playlistPreviewsData[data.id] = {
      title: data.title,
      thumbnail: data.thumbnail,
      songCount: data.songCount,
      songs: data.previewSongs
    };
    
    selectedPlaylists.push(newPlaylist);
    customUrlInput.value = '';
    
    renderCuratedPlaylists();
    renderSelectedPlaylists();
    updateUrls();
    
    previewPlaylist(data.id);
    
  } catch (err) {
    showError(err.message);
  } finally {
    valLoading.style.display = 'none';
    addPlaylistBtn.disabled = false;
  }
}

// Show validation error message
function showError(message) {
  valErrorText.textContent = message;
  valError.style.display = 'flex';
  valLoading.style.display = 'none';
  addPlaylistBtn.disabled = false;
}

// Update generated URLs
function updateUrls() {
  let origin = window.location.origin;
  
  // Handle file:// protocol fallback to 127.0.0.1
  if (!origin || origin === 'null' || origin.startsWith('file:')) {
    origin = 'http://127.0.0.1:7000';
  }

  // If the browser origin is localhost, rewrite to 127.0.0.1 for Stremio compatibility
  if (origin.includes('localhost')) {
    origin = origin.replace('localhost', '127.0.0.1');
  }
  
  const addonName = addonNameInput.value.trim() || 'YouTube Playlists';
  const playlistIds = selectedPlaylists.map(p => p.id);
  
  // Encode configuration as base64url-safe object
  const configObj = {
    name: addonName,
    playlists: playlistIds
  };
  const configStr = btoa(JSON.stringify(configObj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  let manifestUrl;
  if (playlistIds.length === 0 && addonName === 'YouTube Playlists') {
    manifestUrl = `${origin}/manifest.json`;
  } else {
    manifestUrl = `${origin}/${configStr}/manifest.json`;
  }
  
  installUrlInput.value = manifestUrl;
  
  const stremioProtocolUrl = manifestUrl
    .replace('https://', 'stremio://')
    .replace('http://', 'stremio://');
    
  stremioInstallBtn.setAttribute('href', stremioProtocolUrl);
}

// Copy Manifest URL to clipboard
// Copy Manifest URL to clipboard
function handleCopyUrl() {
  const url = installUrlInput.value;
  if (!url) return;
  
  navigator.clipboard.writeText(url).then(() => {
    const originalIcon = copyUrlBtn.innerHTML;
    copyUrlBtn.innerHTML = '<i class="fa-solid fa-check" style="color: var(--accent-cyan);"></i>';
    copyUrlBtn.style.borderColor = 'var(--accent-cyan)';
    
    setTimeout(() => {
      copyUrlBtn.innerHTML = originalIcon;
      copyUrlBtn.style.borderColor = 'var(--border-color)';
    }, 2000);
  }).catch(err => {
    alert('Failed to copy link: ' + err);
  });
}

// Track Stremio Install click
function handleStremioInstall(e) {
  if (selectedPlaylists.length === 0) {
    const proceed = confirm('You have not selected any playlists. This will install the default addon with curated playlists. Do you wish to proceed?');
    if (!proceed) {
      e.preventDefault();
    }
  }
}

// Clear preview area
function clearPreview() {
  activePreviewId = null;
  previewContainer.innerHTML = `
    <div class="preview-empty">
      <i class="fa-solid fa-music preview-empty-icon"></i>
      <p>Select or add a playlist to preview the songs inside it.</p>
    </div>
  `;
}

// Load and show details of a playlist in the preview widget
async function previewPlaylist(playlistId) {
  activePreviewId = playlistId;
  
  renderSelectedPlaylists();
  
  previewContainer.innerHTML = `
    <div class="skeleton-loader" style="height: 60px; margin-bottom: 20px;"></div>
    <div class="skeleton-loader" style="height: 35px; margin-bottom: 10px;"></div>
    <div class="skeleton-loader" style="height: 35px; margin-bottom: 10px;"></div>
    <div class="skeleton-loader" style="height: 35px; margin-bottom: 10px;"></div>
  `;

  let origin = window.location.origin;
  if (!origin || origin === 'null' || origin.startsWith('file:')) {
    origin = 'http://127.0.0.1:7000';
  }
  if (origin.includes('localhost')) {
    origin = origin.replace('localhost', '127.0.0.1');
  }

  try {
    let previewData = playlistPreviewsData[playlistId];
    
    if (!previewData) {
      const response = await fetch(`${origin}/api/playlist-info?url=${encodeURIComponent(playlistId)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load preview');
      }
      
      previewData = {
        title: data.title,
        thumbnail: data.thumbnail,
        songCount: data.songCount,
        songs: data.previewSongs
      };
      
      playlistPreviewsData[playlistId] = previewData;
    }
    
    if (activePreviewId !== playlistId) return;
    
    renderPreviewHTML(previewData);
    
  } catch (err) {
    if (activePreviewId !== playlistId) return;
    previewContainer.innerHTML = `
      <div class="preview-empty">
        <i class="fa-solid fa-circle-exclamation" style="color: var(--accent-pink); font-size: 32px; margin-bottom: 10px;"></i>
        <p>Failed to load playlist preview: ${err.message}</p>
      </div>
    `;
  }
}

// Render playlist preview details inside the container
function renderPreviewHTML(data) {
  const songsListHTML = data.songs && data.songs.length > 0 
    ? data.songs.map((song, i) => `
        <div class="preview-song-row">
          <span class="preview-song-index">${i + 1}</span>
          <img src="${song.thumbnail}" alt="${song.title}" class="preview-song-thumb" />
          <span class="preview-song-title" title="${song.title}">${song.title}</span>
        </div>
      `).join('')
    : '<p class="empty-list-msg" style="padding: 10px 0;">No songs available to preview.</p>';

  previewContainer.innerHTML = `
    <div class="preview-header">
      <img src="${data.thumbnail}" alt="${data.title}" class="preview-playlist-thumb" />
      <div class="preview-header-info">
        <h4>${data.title}</h4>
        <p>${data.songCount} Videos &bull; Showing first ${data.songs.length}</p>
      </div>
    </div>
    <div class="preview-songs-list">
      ${songsListHTML}
    </div>
  `;
}
