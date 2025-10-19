const express = require('express');
const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');

const app = express();
const PORT = process.env.PORT || 3000;

const musicDir = path.join(__dirname, 'public', 'music');
const adsDir = path.join(__dirname, 'public', 'files');

const musicFiles = fs.readdirSync(musicDir).map(file => ({ path: `music/${file}` }));
const adFiles = fs.readdirSync(adsDir).map(file => ({ path: `files/${file}` }));

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

shuffle(musicFiles);

// --- ИСПРАВЛЕННАЯ ЛОГИКА СОЗДАНИЯ ПЛЕЙЛИСТА ---
let fullPlaylist = [];
const adBlock = adFiles;

for (let i = 0; i < musicFiles.length; i++) {
    fullPlaylist.push(musicFiles[i]);
    // Добавляем рекламный блок после каждого второго трека
    if ((i + 1) % 2 === 0 && adBlock.length > 0) {
        fullPlaylist.push(...adBlock);
    }
}
// --- КОНЕЦ ИСПРАВЛЕНИЯ ---

const playlistWithDurations = [];

(async () => {
    for (const track of fullPlaylist) {
        try {
            const metadata = await mm.parseFile(path.join(__dirname, 'public', track.path));
            playlistWithDurations.push({
                url: track.path,
                duration: metadata.format.duration
            });
        } catch (error) {
            console.error(`Failed to read metadata for ${track.path}:`, error);
        }
    }
    startRadio();
})();

let currentTrackIndex = 0;
let songStartTime = 0;

function startRadio() {
    songStartTime = Date.now();
    scheduleNextTrack();
    console.log(`Radio is live! Now playing: ${playlistWithDurations[currentTrackIndex].url}`);
}

function scheduleNextTrack() {
    if (playlistWithDurations.length === 0 || !playlistWithDurations[currentTrackIndex]) {
        console.log("Playlist is empty or track is missing. Radio stopped.");
        return;
    }
    const currentTrack = playlistWithDurations[currentTrackIndex];
    const durationInMs = currentTrack.duration * 1000;

    setTimeout(() => {
        currentTrackIndex = (currentTrackIndex + 1) % playlistWithDurations.length;
        songStartTime = Date.now();
        console.log(`Next track: ${playlistWithDurations[currentTrackIndex].url}`);
        scheduleNextTrack();
    }, durationInMs);
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/current-song', (req, res) => {
    if (playlistWithDurations.length === 0) {
        return res.status(503).json({ error: "Radio is warming up." });
    }
    const currentTrack = playlistWithDurations[currentTrackIndex];
    const timeIntoSong = (Date.now() - songStartTime) / 1000;
    res.json({
        songUrl: currentTrack.url,
        timeIntoSong: timeIntoSong
    });
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});